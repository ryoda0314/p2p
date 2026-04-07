// Signaling message types (mirrors signaling server types)

export type SignalingMessage =
  | JoinMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | LeaveMessage;

export type ServerMessage =
  | JoinedMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | RoomFullMessage
  | ErrorMessage;

export interface JoinMessage {
  type: "join";
  roomId: string;
}

export interface OfferMessage {
  type: "offer";
  sdp: string;
}

export interface AnswerMessage {
  type: "answer";
  sdp: string;
}

export interface IceCandidateMessage {
  type: "ice-candidate";
  candidate: RTCIceCandidateInit;
}

export interface LeaveMessage {
  type: "leave";
}

export interface JoinedMessage {
  type: "joined";
  polite: boolean;
}

export interface PeerJoinedMessage {
  type: "peer-joined";
}

export interface PeerLeftMessage {
  type: "peer-left";
}

export interface RoomFullMessage {
  type: "room-full";
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "waiting"
  | "connected"
  | "failed";
