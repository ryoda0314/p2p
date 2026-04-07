"use client";

import { useCallback, useRef, useState } from "react";
import { getRtcConfig } from "@/lib/rtc-config";
import type { ConnectionStatus } from "@/lib/types";

type Role = "offerer" | "answerer" | null;

interface PendingCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

interface SignalData {
  sdp: string;
  candidates: PendingCandidate[];
}

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
  const candidatesRef = useRef<PendingCandidate[]>([]);
  const gatherDoneRef = useRef<(() => void) | null>(null);

  function createPC(): RTCPeerConnection {
    cleanup();
    const pc = new RTCPeerConnection(getRtcConfig());
    pcRef.current = pc;
    candidatesRef.current = [];

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
      if (event.candidate) {
        candidatesRef.current.push({
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      } else {
        // ICE gathering complete
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
      // Timeout after 5 seconds in case gathering stalls
      setTimeout(resolve, 5000);
    });
  }

  // Step 1: Offerer creates an offer
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

      const data: SignalData = {
        sdp: pc.localDescription!.sdp,
        candidates: candidatesRef.current,
      };

      setOfferText(btoa(JSON.stringify(data)));
      setStatus("waiting");
    } catch (err) {
      setError(`Offer作成失敗: ${err}`);
      setStatus("failed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

  // Step 2: Offerer receives the answer
  const receiveAnswer = useCallback(async (text: string) => {
    const pc = pcRef.current;
    if (!pc) {
      setError("先にOfferを作成してください。");
      return;
    }

    try {
      const data: SignalData = JSON.parse(atob(text.trim()));
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });

      for (const c of data.candidates) {
        await pc.addIceCandidate({
          candidate: c.candidate,
          sdpMid: c.sdpMid,
          sdpMLineIndex: c.sdpMLineIndex,
        });
      }
    } catch (err) {
      setError(`応答コードが不正です: ${err}`);
    }
  }, []);

  // Step A: Answerer receives the offer and creates an answer
  const receiveOfferAndCreateAnswer = useCallback(
    async (text: string) => {
      try {
        setRole("answerer");
        setStatus("connecting");
        setError(null);
        setAnswerText("");

        const data: SignalData = JSON.parse(atob(text.trim()));

        const pc = createPC();
        await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });

        for (const c of data.candidates) {
          await pc.addIceCandidate({
            candidate: c.candidate,
            sdpMid: c.sdpMid,
            sdpMLineIndex: c.sdpMLineIndex,
          });
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await waitForIceGathering();

        const answerData: SignalData = {
          sdp: pc.localDescription!.sdp,
          candidates: candidatesRef.current,
        };

        setAnswerText(btoa(JSON.stringify(answerData)));
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
    candidatesRef.current = [];
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
