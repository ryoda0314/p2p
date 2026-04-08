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
        // ICE gathering complete - localDescription now contains all candidates
        gatherDoneRef.current?.();
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connected":
          setStatus("connected");
          break;
        case "disconnected":
        case "closed":
          setStatus("disconnected");
          break;
        case "failed":
          setStatus("failed");
          setError("接続に失敗しました。");
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    return pc;
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

  const receiveAnswer = useCallback(async (text: string) => {
    const pc = pcRef.current;
    if (!pc) {
      setError("先にOfferを作成してください。");
      return;
    }

    try {
      const sdp = await decode(text);
      await pc.setRemoteDescription({ type: "answer", sdp });
    } catch (err) {
      setError(`応答コードが不正です: ${err}`);
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
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    gatherDoneRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
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
