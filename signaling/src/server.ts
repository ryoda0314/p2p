import { WebSocketServer, WebSocket } from "ws";
import type { SignalingMessage, ServerMessage, IceCandidateInit } from "./types";

const PORT = Number(process.env.PORT) || 8080;

interface Client {
  ws: WebSocket;
  roomId: string | null;
}

// Room management: roomId -> Set of clients (max 2)
const rooms = new Map<string, Set<Client>>();
const clients = new Map<WebSocket, Client>();

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function getPeer(client: Client): Client | undefined {
  if (!client.roomId) return undefined;
  const room = rooms.get(client.roomId);
  if (!room) return undefined;
  for (const member of room) {
    if (member !== client) return member;
  }
  return undefined;
}

function leaveRoom(client: Client): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (room) {
    room.delete(client);
    // Notify remaining peer
    for (const member of room) {
      send(member.ws, { type: "peer-left" });
    }
    if (room.size === 0) {
      rooms.delete(client.roomId);
    }
  }
  client.roomId = null;
}

function validateMessage(data: unknown): SignalingMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const msg = data as Record<string, unknown>;

  switch (msg.type) {
    case "join":
      if (typeof msg.roomId === "string" && msg.roomId.length > 0 && msg.roomId.length <= 64) {
        return { type: "join", roomId: msg.roomId };
      }
      return null;

    case "offer":
      if (typeof msg.sdp === "string") {
        return { type: "offer", sdp: msg.sdp };
      }
      return null;

    case "answer":
      if (typeof msg.sdp === "string") {
        return { type: "answer", sdp: msg.sdp };
      }
      return null;

    case "ice-candidate":
      if (msg.candidate && typeof msg.candidate === "object") {
        return {
          type: "ice-candidate",
          candidate: msg.candidate as IceCandidateInit,
        };
      }
      return null;

    case "leave":
      return { type: "leave" };

    default:
      return null;
  }
}

function handleMessage(client: Client, message: SignalingMessage): void {
  switch (message.type) {
    case "join": {
      // Leave current room if in one
      leaveRoom(client);

      const { roomId } = message;
      let room = rooms.get(roomId);

      if (room && room.size >= 2) {
        send(client.ws, { type: "room-full" });
        return;
      }

      if (!room) {
        room = new Set();
        rooms.set(roomId, room);
      }

      client.roomId = roomId;
      const isPolite = room.size > 0; // Second to join is polite
      room.add(client);

      send(client.ws, { type: "joined", polite: isPolite });

      // Notify existing peer that someone joined
      if (isPolite) {
        const peer = getPeer(client);
        if (peer) {
          send(peer.ws, { type: "peer-joined" });
        }
      }
      break;
    }

    case "offer":
    case "answer":
    case "ice-candidate": {
      // Relay to peer
      const peer = getPeer(client);
      if (peer) {
        send(peer.ws, message);
      }
      break;
    }

    case "leave": {
      leaveRoom(client);
      break;
    }
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws: WebSocket) => {
  const client: Client = { ws, roomId: null };
  clients.set(ws, client);

  ws.on("message", (raw: Buffer) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    const message = validateMessage(parsed);
    if (!message) {
      send(ws, { type: "error", message: "Invalid message format" });
      return;
    }

    handleMessage(client, message);
  });

  ws.on("close", () => {
    leaveRoom(client);
    clients.delete(ws);
  });

  ws.on("error", () => {
    leaveRoom(client);
    clients.delete(ws);
  });
});

console.log(`Signaling server running on ws://localhost:${PORT}`);
