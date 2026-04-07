"use client";

import type { ConnectionStatus } from "@/lib/types";

const statusConfig: Record<
  ConnectionStatus,
  { label: string; color: string; dot: string }
> = {
  disconnected: {
    label: "未接続",
    color: "text-gray-400",
    dot: "bg-gray-400",
  },
  connecting: {
    label: "接続中...",
    color: "text-yellow-400",
    dot: "bg-yellow-400",
  },
  waiting: {
    label: "相手を待っています",
    color: "text-blue-400",
    dot: "bg-blue-400",
  },
  connected: {
    label: "通話中",
    color: "text-green-400",
    dot: "bg-green-400",
  },
  failed: {
    label: "接続失敗",
    color: "text-red-400",
    dot: "bg-red-400",
  },
};

export function StatusBadge({ status }: { status: ConnectionStatus }) {
  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 ${config.color}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot} ${status === "connecting" ? "animate-pulse" : ""}`} />
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  );
}
