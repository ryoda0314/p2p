// Signaling message types exchanged between client and server

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

// Server-side representation of an ICE candidate (browser's RTCIceCandidateInit)
export interface IceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface IceCandidateMessage {
  type: "ice-candidate";
  candidate: IceCandidateInit;
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
