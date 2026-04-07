"use client";

interface DeviceInfo {
  deviceId: string;
  label: string;
}

interface DeviceSelectorProps {
  cameras: DeviceInfo[];
  mics: DeviceInfo[];
  selectedCamera: string;
  selectedMic: string;
  onCameraChange: (deviceId: string) => void;
  onMicChange: (deviceId: string) => void;
}

export function DeviceSelector({
  cameras,
  mics,
  selectedCamera,
  selectedMic,
  onCameraChange,
  onMicChange,
}: DeviceSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {cameras.length > 0 && (
        <label className="flex items-center gap-2">
          <span className="text-gray-400">カメラ:</span>
          <select
            value={selectedCamera}
            onChange={(e) => onCameraChange(e.target.value)}
            className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-gray-200 focus:border-blue-500 focus:outline-none"
          >
            {cameras.map((cam) => (
              <option key={cam.deviceId} value={cam.deviceId}>
                {cam.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {mics.length > 0 && (
        <label className="flex items-center gap-2">
          <span className="text-gray-400">マイク:</span>
          <select
            value={selectedMic}
            onChange={(e) => onMicChange(e.target.value)}
            className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-gray-200 focus:border-blue-500 focus:outline-none"
          >
            {mics.map((mic) => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
