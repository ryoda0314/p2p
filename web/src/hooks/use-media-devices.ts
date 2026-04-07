"use client";

import { useCallback, useEffect, useState } from "react";

interface DeviceInfo {
  deviceId: string;
  label: string;
}

export function useMediaDevices() {
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [mics, setMics] = useState<DeviceInfo[]>([]);

  const enumerate = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(
        devices
          .filter((d) => d.kind === "videoinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `カメラ ${d.deviceId.slice(0, 4)}` }))
      );
      setMics(
        devices
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `マイク ${d.deviceId.slice(0, 4)}` }))
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    enumerate();
    navigator.mediaDevices?.addEventListener("devicechange", enumerate);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", enumerate);
    };
  }, [enumerate]);

  return { cameras, mics, enumerate };
}
