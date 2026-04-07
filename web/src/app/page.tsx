"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const id = roomId.trim();
    if (id) {
      router.push(`/room?id=${encodeURIComponent(id)}`);
    }
  };

  const handleCreateRoom = () => {
    const id = Math.random().toString(36).substring(2, 8);
    router.push(`/room?id=${encodeURIComponent(id)}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">P2P Video Chat</h1>
          <p className="mt-2 text-gray-400">
            1対1のビデオ通話
          </p>
        </div>

        {/* Manual mode - no server needed */}
        <button
          onClick={() => router.push("/manual")}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-500"
        >
          サーバーなしで通話する
        </button>
        <p className="text-center text-xs text-gray-500">
          コードをコピペで交換するだけ。サーバー不要、完全P2P。
        </p>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-gray-950 px-2 text-gray-500">シグナリングサーバー使用</span>
          </div>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-300">
              ルームID
            </label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="例: my-room-123"
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={64}
            />
          </div>

          <button
            type="submit"
            disabled={!roomId.trim()}
            className="w-full rounded-lg border border-gray-700 px-4 py-3 font-medium text-gray-300 transition hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            入室する
          </button>
        </form>

        <button
          onClick={handleCreateRoom}
          className="w-full rounded-lg border border-gray-700 px-4 py-3 font-medium text-gray-300 transition hover:border-gray-500 hover:text-white"
        >
          新しいルームを作成
        </button>
      </div>
    </main>
  );
}
