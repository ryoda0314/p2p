// WebRTC configuration with STUN/TURN servers

export function getRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [];

  const stunUrl = process.env.NEXT_PUBLIC_STUN_URL;
  if (stunUrl) {
    iceServers.push({ urls: stunUrl });
  }

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  // Fallback to Google STUN if nothing configured
  if (iceServers.length === 0) {
    iceServers.push({ urls: "stun:stun.l.google.com:19302" });
  }

  return { iceServers };
}
