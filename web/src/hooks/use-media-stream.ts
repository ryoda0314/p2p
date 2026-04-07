"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface MediaStreamState {
  stream: MediaStream | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  error: string | null;
}

export interface StartOptions {
  cameraId?: string;
  micId?: string;
}

export function useMediaStream() {
  const [state, setState] = useState<MediaStreamState>({
    stream: null,
    cameraEnabled: true,
    micEnabled: true,
    error: null,
  });
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async (options?: StartOptions) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState((prev) => ({
        ...prev,
        error: "このブラウザはカメラ/マイクに対応していないか、HTTPS環境ではありません。",
      }));
      return null;
    }

    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 640 },
      height: { ideal: 360 },
      frameRate: { ideal: 30, max: 30 },
      ...(options?.cameraId ? { deviceId: { exact: options.cameraId } } : {}),
    };

    const audioConstraints: MediaTrackConstraints = {
      ...(options?.micId ? { deviceId: { exact: options.micId } } : {}),
    };

    // Try video + audio first, then fallback
    const attempts: {
      video: boolean | MediaTrackConstraints;
      audio: boolean | MediaTrackConstraints;
      label: string;
    }[] = [
      { video: videoConstraints, audio: audioConstraints, label: "カメラ+マイク" },
      { video: videoConstraints, audio: false, label: "カメラのみ" },
      { video: false, audio: audioConstraints, label: "マイクのみ" },
    ];

    let lastErr: unknown;
    for (const attempt of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: attempt.video,
          audio: attempt.audio,
        });
        streamRef.current = stream;
        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;
        const warning =
          attempt.label !== "カメラ+マイク"
            ? `（${attempt.label}で接続中。${!hasVideo ? "カメラ" : "マイク"}が使用できませんでした）`
            : null;
        setState({
          stream,
          cameraEnabled: hasVideo,
          micEnabled: hasAudio,
          error: warning,
        });
        return stream;
      } catch (err) {
        lastErr = err;
      }
    }

    // All attempts failed
    let message: string;
    if (lastErr instanceof DOMException) {
      switch (lastErr.name) {
        case "NotAllowedError":
          message =
            "カメラ・マイクのアクセスが拒否されました。ブラウザのアドレスバー左のカメラアイコンから許可してください。";
          break;
        case "NotFoundError":
          message = "カメラまたはマイクが見つかりません。デバイスが接続されているか確認してください。";
          break;
        case "NotReadableError":
          message =
            "カメラ・マイクが他のアプリで使用中か、ハードウェアエラーです。ブラウザを全て閉じて再起動してみてください。";
          break;
        case "OverconstrainedError":
          message = "カメラが要求された設定に対応していません。";
          break;
        default:
          message = `メディアデバイスエラー: ${lastErr.name} - ${lastErr.message}`;
      }
    } else {
      message = `メディアデバイスの取得に失敗しました: ${lastErr}`;
    }
    setState((prev) => ({ ...prev, error: message }));
    return null;
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setState({
        stream: null,
        cameraEnabled: true,
        micEnabled: true,
        error: null,
      });
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (!streamRef.current) return;
    const videoTracks = streamRef.current.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setState((prev) => ({ ...prev, cameraEnabled: !prev.cameraEnabled }));
  }, []);

  const toggleMic = useCallback(() => {
    if (!streamRef.current) return;
    const audioTracks = streamRef.current.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setState((prev) => ({ ...prev, micEnabled: !prev.micEnabled }));
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    stream: state.stream,
    cameraEnabled: state.cameraEnabled,
    micEnabled: state.micEnabled,
    error: state.error,
    start,
    stop,
    toggleCamera,
    toggleMic,
  };
}
