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
    // Only strip lines that are proven safe to remove
    if (line.startsWith("a=extmap-allow-mixed")) continue;
    if (line.startsWith("a=extmap:")) continue;
    if (line.startsWith("a=ssrc:")) continue;
    if (line.startsWith("a=ssrc-group:")) continue;
    kept.push(line);
  }

  return kept.join("\n");
}

function restoreSdp(sdp: string): string {
  return sdp.replace(/\n/g, "\r\n") + "\r\n";
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
