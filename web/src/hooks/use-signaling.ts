"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMessage, SignalingMessage } from "@/lib/types";

interface UseSignalingOptions {
  onMessage: (message: ServerMessage) => void;
}

export function useSignaling({ onMessage }: UseSignalingOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = process.env.NEXT_PUBLIC_SIGNALING_URL;
      if (!url) {
        reject(new Error("NEXT_PUBLIC_SIGNALING_URL is not set"));
        return;
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          onMessageRef.current(message);
        } catch {
          console.error("Failed to parse signaling message");
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };

      ws.onerror = () => {
        reject(new Error("WebSocket connection failed"));
        ws.close();
      };
    });
  }, []);

  const send = useCallback((message: SignalingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { connect, disconnect, send, connected };
}
