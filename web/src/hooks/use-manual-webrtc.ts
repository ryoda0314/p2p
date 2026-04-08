"use client";

import { useCallback, useRef, useState } from "react";
import { getRtcConfig } from "@/lib/rtc-config";
import { encode, decode } from "@/lib/signal-codec";
import type { ConnectionStatus } from "@/lib/types";

type Role = "offerer" | "answerer" | null;

interface UseManualWebRTCOptions {
  localStream: MediaStream | null;
}

export function useManualWebRTC({ localStream }: UseManualWebRTCOptions) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [offerText, setOfferText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [role, setRole] = useState<Role>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const gatherDoneRef = useRef<(() => void) | null>(null);
  const remoteSdpRef = useRef<{ type: RTCSdpType; sdp: string } | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  function createPC(): RTCPeerConnection {
    cleanup();
    const pc = new RTCPeerConnection(getRtcConfig());
    pcRef.current = pc;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remote.addTrack(track);
      });
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        gatherDoneRef.current?.();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] connectionState:", pc.connectionState);
      switch (pc.connectionState) {
        case "connected":
          setStatus("connected");
          setError(null);
          retryCountRef.current = 0;
          break;
        case "disconnected":
        case "closed":
          setStatus("disconnected");
          break;
        case "failed":
          // Defer retry to avoid destroying PC from within its own event handler
          setTimeout(() => retryConnection(), 500);
          break;
      }
    };

    pc.onsignalingstatechange = () => {
      console.log("[WebRTC] signalingState:", pc.signalingState);
    };

    pc.onicegatheringstatechange = () => {
      console.log("[WebRTC] iceGatheringState:", pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] iceConnectionState:", pc.iceConnectionState);
    };

    return pc;
  }

  async function retryConnection(): Promise<void> {
    const remote = remoteSdpRef.current;
    if (!remote || retryCountRef.current >= MAX_RETRIES) {
      setStatus("failed");
      setError("接続に失敗しました。両方のタブでやり直してください。");
      return;
    }

    retryCountRef.current++;
    console.log(`[WebRTC] Retry ${retryCountRef.current}/${MAX_RETRIES}...`);
    setStatus("connecting");

    const pc = createPC();

    try {
      if (remote.type === "offer") {
        // We are the answerer
        await pc.setRemoteDescription(remote);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
      } else {
        // We are the offerer - recreate offer then apply stored answer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIceGathering();
        await pc.setRemoteDescription(remote);
      }
    } catch (err) {
      console.error("[WebRTC] Retry failed:", err);
      setStatus("failed");
      setError("再接続に失敗しました。");
    }
  }

  function waitForIceGathering(): Promise<void> {
    const pc = pcRef.current;
    if (!pc) return Promise.resolve();
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      gatherDoneRef.current = resolve;
      setTimeout(resolve, 5000);
    });
  }

  const createOffer = useCallback(async () => {
    try {
      setRole("offerer");
      setStatus("connecting");
      setError(null);
      setOfferText("");
      setAnswerText("");

      const pc = createPC();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering();

      // After gathering, localDescription.sdp contains SDP + all ICE candidates
      const code = await encode(pc.localDescription!.sdp);
      setOfferText(code);
      setStatus("waiting");
    } catch (err) {
      setError(`Offer作成失敗: ${err}`);
      setStatus("failed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

  const receivingRef = useRef(false);

  const receiveAnswer = useCallback(async (text: string) => {
    // Guard against double-calls
    if (receivingRef.current) return;
    receivingRef.current = true;

    try {
      const pc = pcRef.current;
      if (!pc) {
        setError("接続がリセットされました。「再生成」を押してください。");
        return;
      }

      console.log("[WebRTC] receiveAnswer signalingState:", pc.signalingState);

      // Already processed - ignore silently
      if (pc.signalingState === "stable") return;

      if (pc.signalingState !== "have-local-offer") {
        setError("接続がリセットされました。「再生成」を押してください。");
        return;
      }

      const sdp = await decode(text);
      remoteSdpRef.current = { type: "answer", sdp };
      await pc.setRemoteDescription({ type: "answer", sdp });
    } catch (err) {
      setError(`応答コードが不正です: ${err}`);
    } finally {
      receivingRef.current = false;
    }
  }, []);

  const receiveOfferAndCreateAnswer = useCallback(
    async (text: string) => {
      try {
        setRole("answerer");
        setStatus("connecting");
        setError(null);
        setAnswerText("");

        const sdp = await decode(text);
        remoteSdpRef.current = { type: "offer", sdp };
        const pc = createPC();
        await pc.setRemoteDescription({ type: "offer", sdp });

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIceGathering();

        const code = await encode(pc.localDescription!.sdp);
        setAnswerText(code);
      } catch (err) {
        setError(`接続コードが不正です: ${err}`);
        setStatus("failed");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localStream]
  );

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onsignalingstatechange = null;
      pcRef.current.onicegatheringstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    gatherDoneRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    remoteSdpRef.current = null;
    retryCountRef.current = 0;
    receivingRef.current = false;
    setStatus("disconnected");
    setError(null);
    setOfferText("");
    setAnswerText("");
    setRole(null);
  }, [cleanup]);

  return {
    remoteStream,
    status,
    error,
    role,
    offerText,
    answerText,
    createOffer,
    receiveAnswer,
    receiveOfferAndCreateAnswer,
    disconnect,
  };
}
