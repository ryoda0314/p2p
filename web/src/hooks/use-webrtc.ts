"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRtcConfig } from "@/lib/rtc-config";
import { useSignaling } from "./use-signaling";
import type { ConnectionStatus, ServerMessage } from "@/lib/types";

interface UseWebRTCOptions {
  localStream: MediaStream | null;
}

export function useWebRTC({ localStream }: UseWebRTCOptions) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const politeRef = useRef(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const roomIdRef = useRef<string | null>(null);

  const cleanupPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onnegotiationneeded = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
  }, []);

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "joined": {
          politeRef.current = message.polite;
          setStatus("waiting");
          setError(null);
          break;
        }

        case "peer-joined": {
          // Peer joined - create peer connection (impolite peer initiates)
          createPeerConnection();
          break;
        }

        case "peer-left": {
          cleanupPeerConnection();
          setStatus("waiting");
          break;
        }

        case "offer": {
          handleOffer(message.sdp);
          break;
        }

        case "answer": {
          handleAnswer(message.sdp);
          break;
        }

        case "ice-candidate": {
          handleIceCandidate(message.candidate);
          break;
        }

        case "room-full": {
          setStatus("disconnected");
          setError("ルームが満員です（最大2人）。");
          break;
        }

        case "error": {
          setError(message.message);
          break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localStream]
  );

  const signaling = useSignaling({ onMessage: handleMessage });

  function createPeerConnection(): RTCPeerConnection {
    cleanupPeerConnection();

    const pc = new RTCPeerConnection(getRtcConfig());
    pcRef.current = pc;

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle remote tracks
    const remoteMediaStream = new MediaStream();
    setRemoteStream(remoteMediaStream);

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remoteMediaStream.addTrack(track);
      });
    };

    // Perfect negotiation: negotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        signaling.send({
          type: "offer",
          sdp: pc.localDescription!.sdp,
        });
      } catch (err) {
        console.error("Failed to create offer:", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    // Trickle ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.send({
          type: "ice-candidate",
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Connection state tracking
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connected":
          setStatus("connected");
          break;
        case "disconnected":
          setStatus("waiting");
          break;
        case "failed":
          setStatus("failed");
          setError("接続に失敗しました。再接続してください。");
          break;
        case "closed":
          setStatus("disconnected");
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

  async function handleOffer(sdp: string): Promise<void> {
    const pc = pcRef.current ?? createPeerConnection();

    // Perfect negotiation: handle glare
    const offerCollision =
      makingOfferRef.current || pc.signalingState !== "stable";

    ignoreOfferRef.current = !politeRef.current && offerCollision;
    if (ignoreOfferRef.current) return;

    try {
      await pc.setRemoteDescription({ type: "offer", sdp });
      await pc.setLocalDescription();
      signaling.send({
        type: "answer",
        sdp: pc.localDescription!.sdp,
      });
    } catch (err) {
      console.error("Failed to handle offer:", err);
    }
  }

  async function handleAnswer(sdp: string): Promise<void> {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription({ type: "answer", sdp });
    } catch (err) {
      console.error("Failed to handle answer:", err);
    }
  }

  async function handleIceCandidate(
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      if (!ignoreOfferRef.current) {
        console.error("Failed to add ICE candidate:", err);
      }
    }
  }

  const joinRoom = useCallback(
    async (roomId: string) => {
      roomIdRef.current = roomId;
      setStatus("connecting");
      setError(null);

      try {
        await signaling.connect();
        signaling.send({ type: "join", roomId });
      } catch {
        setStatus("failed");
        setError("シグナリングサーバーに接続できません。サーバーが起動しているか確認してください。");
      }
    },
    [signaling]
  );

  const leaveRoom = useCallback(() => {
    signaling.send({ type: "leave" });
    cleanupPeerConnection();
    signaling.disconnect();
    setStatus("disconnected");
    setError(null);
    roomIdRef.current = null;
  }, [signaling, cleanupPeerConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pcRef.current?.close();
    };
  }, []);

  return {
    remoteStream,
    status,
    error,
    joinRoom,
    leaveRoom,
    signalingConnected: signaling.connected,
  };
}
