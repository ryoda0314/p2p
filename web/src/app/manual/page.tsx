"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import { StatusBadge } from "@/components/status-badge";
import { MediaControls } from "@/components/media-controls";
import { DeviceSelector } from "@/components/device-selector";
import { useMediaStream } from "@/hooks/use-media-stream";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { useManualWebRTC } from "@/hooks/use-manual-webrtc";

export default function ManualPage() {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  const media = useMediaStream();
  const devices = useMediaDevices();
  const rtc = useManualWebRTC({ localStream: media.stream });

  const startMedia = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    await media.start({
      cameraId: selectedCamera || undefined,
      micId: selectedMic || undefined,
    });
    await devices.enumerate();
    setStarted(true);
  }, [media, devices, selectedCamera, selectedMic]);

  useEffect(() => {
    startMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCameraChange = useCallback(
    async (deviceId: string) => {
      setSelectedCamera(deviceId);
      await media.start({ cameraId: deviceId, micId: selectedMic || undefined });
    },
    [media, selectedMic]
  );

  const handleMicChange = useCallback(
    async (deviceId: string) => {
      setSelectedMic(deviceId);
      await media.start({ cameraId: selectedCamera || undefined, micId: deviceId });
    },
    [media, selectedCamera]
  );

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleLeave = useCallback(() => {
    rtc.disconnect();
    media.stop();
    setStarted(false);
    startedRef.current = false;
    setPasteInput("");
    router.push("/");
  }, [rtc, media, router]);

  const isConnected = rtc.status === "connected";

  return (
    <main className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-semibold">P2P Video Chat — サーバーなし</h1>
        <StatusBadge status={rtc.status} />
      </header>

      {/* Error */}
      {(rtc.error || media.error) && (
        <div className={`mx-4 mt-3 rounded-lg border px-4 py-3 text-sm ${
          media.error?.startsWith("（")
            ? "border-yellow-800 bg-yellow-900/30 text-yellow-300"
            : "border-red-800 bg-red-900/30 text-red-300"
        }`}>
          {rtc.error || media.error}
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

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Video area */}
        <div className="flex flex-1 items-center justify-center gap-4 p-4">
          <div className="aspect-video w-full max-w-md">
            <VideoPlayer stream={media.stream} muted mirrored label="自分" />
          </div>
          <div className="aspect-video w-full max-w-md">
            <VideoPlayer stream={rtc.remoteStream} label="相手" />
          </div>
        </div>

        {/* Signaling panel */}
        {!isConnected && started && (
          <div className="w-full border-l border-gray-800 p-4 lg:w-96">
            <div className="space-y-4">
              {/* Role selection */}
              {!rtc.role && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">どちらの役割ですか？</p>
                  <button
                    onClick={rtc.createOffer}
                    className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500"
                  >
                    通話を開始する側
                  </button>
                  <button
                    onClick={() => rtc.receiveOfferAndCreateAnswer("")}
                    className="hidden"
                  />
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-800" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-gray-950 px-2 text-gray-500">または</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">相手から接続コードを受け取った場合:</p>
                    <textarea
                      value={pasteInput}
                      onChange={(e) => setPasteInput(e.target.value)}
                      placeholder="接続コードを貼り付け..."
                      className="h-24 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => rtc.receiveOfferAndCreateAnswer(pasteInput)}
                      disabled={!pasteInput.trim()}
                      className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      応答を生成する
                    </button>
                  </div>
                </div>
              )}

              {/* Offerer: show offer, wait for answer */}
              {rtc.role === "offerer" && (
                <div className="space-y-4">
                  {rtc.offerText && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-300">
                          ① この接続コードを相手に送ってください
                        </p>
                      </div>
                      <div className="relative">
                        <textarea
                          readOnly
                          value={rtc.offerText}
                          className="h-24 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-xs text-gray-300"
                        />
                        <button
                          onClick={() => handleCopy(rtc.offerText)}
                          className="absolute right-2 top-2 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
                        >
                          {copied ? "コピー済み" : "コピー"}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-300">
                      ② 相手から応答コードを貼り付け
                    </p>
                    <textarea
                      value={pasteInput}
                      onChange={(e) => setPasteInput(e.target.value)}
                      placeholder="応答コードを貼り付け..."
                      className="h-24 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => rtc.receiveAnswer(pasteInput)}
                      disabled={!pasteInput.trim()}
                      className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      接続する
                    </button>
                  </div>
                </div>
              )}

              {/* Answerer: show answer to copy */}
              {rtc.role === "answerer" && rtc.answerText && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-300">
                    この応答コードを相手に送ってください
                  </p>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={rtc.answerText}
                      className="h-24 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-xs text-gray-300"
                    />
                    <button
                      onClick={() => handleCopy(rtc.answerText)}
                      className="absolute right-2 top-2 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
                    >
                      {copied ? "コピー済み" : "コピー"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    相手がこのコードを貼り付けると自動的に接続されます
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {started && (
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
