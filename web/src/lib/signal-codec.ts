// Compress and encode signal data to a short string

async function compress(input: string): Promise<Uint8Array> {
  const stream = new Blob([input])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompress(data: Uint8Array): Promise<string> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

// URL-safe base64
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function stripSdp(sdp: string): string {
  const lines = sdp.split("\r\n").filter(Boolean);
  const kept: string[] = [];

  for (const line of lines) {
    // Remove session boilerplate
    if (line.startsWith("a=msid-semantic")) continue;
    if (line.startsWith("a=group:BUNDLE")) continue;
    if (line.startsWith("a=extmap-allow-mixed")) continue;
    // Remove RTP header extensions (not needed for basic call)
    if (line.startsWith("a=extmap:")) continue;
    // Remove RTCP feedback params
    if (line.startsWith("a=rtcp-fb:")) continue;
    // Remove ssrc lines (browser regenerates)
    if (line.startsWith("a=ssrc:")) continue;
    if (line.startsWith("a=ssrc-group:")) continue;
    // Remove msid
    if (line.startsWith("a=msid:")) continue;
    // Remove mid
    if (line.startsWith("a=mid:")) continue;
    // Remove rtcp mux/rsize (default on)
    if (line === "a=rtcp-mux") continue;
    if (line === "a=rtcp-rsize") continue;
    // Remove redundant session fields
    if (line.startsWith("s=")) continue;
    if (line.startsWith("t=")) continue;
    // Remove host candidates (only keep srflx/relay for remote)
    // Keep all for local testing though
    kept.push(line);
  }

  return kept.join("\n");
}

function restoreSdp(sdp: string): string {
  let restored = sdp.replace(/\n/g, "\r\n");
  // Re-add required fields if stripped
  if (!restored.includes("s=")) {
    restored = restored.replace("o=", "s=-\r\nt=0 0\r\no=");
  }
  // Re-add rtcp-mux to each m= section
  restored = restored.replace(/(m=(?:audio|video)\s[^\r]*)/g, "$1\r\na=rtcp-mux");
  return restored + "\r\n";
}

export async function encode(sdp: string): Promise<string> {
  const stripped = stripSdp(sdp);
  const compressed = await compress(stripped);
  return toBase64Url(compressed);
}

export async function decode(code: string): Promise<string> {
  const bytes = fromBase64Url(code.trim());
  const sdp = await decompress(bytes);
  return restoreSdp(sdp);
}
