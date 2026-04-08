// Encode/decode SDP as URL-safe base64 (no compression for reliability)

export async function encode(sdp: string): Promise<string> {
  return btoa(unescape(encodeURIComponent(sdp)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function decode(code: string): Promise<string> {
  const padded = code.trim().replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(padded)));
}
