"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import { StatusBadge } from "@/components/status-badge";
import { MediaControls } from "@/components/media-controls";
import { DeviceSelector } from "@/components/device-selector";
import { useMediaStream } from "@/hooks/use-media-stream";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { useWebRTC } from "@/hooks/use-webrtc";

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-gray-400">読み込み中...</p>
        </main>
      }
    >
      <RoomContent />
    </Suspense>
  );
}

function RoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = searchParams.get("id");
  const [joined, setJoined] = useState(false);
  const joinedRef = useRef(false);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMic, setSelectedMic] = useState("");

  const media = useMediaStream();
  const devices = useMediaDevices();
  const webrtc = useWebRTC({ localStream: media.stream });

  const startCall = useCallback(async () => {
    if (joinedRef.current || !roomId) return;
    joinedRef.current = true;

    const stream = await media.start({
      cameraId: selectedCamera || undefined,
      micId: selectedMic || undefined,
    });
    // Re-enumerate to get labels (requires active stream)
    await devices.enumerate();

    if (!stream) return;

    setTimeout(() => {
      webrtc.joinRoom(roomId);
      setJoined(true);
    }, 200);
  }, [roomId, media, webrtc, devices, selectedCamera, selectedMic]);

  const handleLeave = useCallback(() => {
    webrtc.leaveRoom();
    media.stop();
    setJoined(false);
    joinedRef.current = false;
    router.push("/");
  }, [webrtc, media, router]);

  const handleCameraChange = useCallback(
    async (deviceId: string) => {
      setSelectedCamera(deviceId);
      if (joined) {
        await media.start({ cameraId: deviceId, micId: selectedMic || undefined });
      }
    },
    [joined, media, selectedMic]
  );

  const handleMicChange = useCallback(
    async (deviceId: string) => {
      setSelectedMic(deviceId);
      if (joined) {
        await media.start({ cameraId: selectedCamera || undefined, micId: deviceId });
      }
    },
    [joined, media, selectedCamera]
  );

  // Auto-start on mount
  useEffect(() => {
    if (roomId && !joinedRef.current) {
      startCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    return () => {
      joinedRef.current = false;
    };
  }, []);

  if (!roomId) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">ルームIDが指定されていません。</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
          >
            トップへ戻る
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">P2P Video Chat</h1>
          <div className="flex items-center gap-2 rounded bg-gray-800 px-3 py-1 text-sm text-gray-300">
            <span>Room:</span>
            <code className="font-mono text-blue-400">{roomId}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/room?id=${encodeURIComponent(roomId)}`
                );
              }}
              className="ml-1 text-gray-500 hover:text-gray-300"
              title="URLをコピー"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
        <StatusBadge status={webrtc.status} />
      </header>

      {/* Error / Warning display */}
      {(webrtc.error || media.error) && (
        <div className={`mx-4 mt-3 rounded-lg border px-4 py-3 text-sm ${
          media.error?.startsWith("（")
            ? "border-yellow-800 bg-yellow-900/30 text-yellow-300"
            : "border-red-800 bg-red-900/30 text-red-300"
        }`}>
          {webrtc.error || media.error}
        </div>
      )}

      {/* Device selector */}
      {(devices.cameras.length > 1 || devices.mics.length > 1) && (
        <div className="mx-4 mt-3">
          <DeviceSelector
            cameras={devices.cameras}
            mics={devices.mics}
            selectedCamera={selectedCamera}
            selectedMic={selectedMic}
            onCameraChange={handleCameraChange}
            onMicChange={handleMicChange}
          />
        </div>
      )}

      {/* Video area */}
      <div className="flex flex-1 items-center justify-center gap-4 p-4">
        <div className="aspect-video w-full max-w-xl">
          <VideoPlayer
            stream={media.stream}
            muted
            mirrored
            label="自分"
          />
        </div>
        <div className="aspect-video w-full max-w-xl">
          <VideoPlayer
            stream={webrtc.remoteStream}
            label="相手"
          />
        </div>
      </div>

      {/* Controls */}
      {joined && (
        <div className="border-t border-gray-800 px-4 py-4">
          <MediaControls
            cameraEnabled={media.cameraEnabled}
            micEnabled={media.micEnabled}
            onToggleCamera={media.toggleCamera}
            onToggleMic={media.toggleMic}
            onLeave={handleLeave}
          />
        </div>
      )}
    </main>
  );
}
