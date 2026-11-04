const enc = new TextEncoder();

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToB64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function b64UrlToBytes(s: string): Uint8Array | null {
  try {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function randomId(): string {
  return bytesToB64Url(randomBytes(16));
}

export async function hmacRaw(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

export async function timingSafeEqual(a: Uint8Array, b: Uint8Array): Promise<boolean> {
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** PIN disimpan sebagai HMAC(pepper, salt + pin). Pepper ada di secret, bukan di database. */
export async function hashPin(pin: string, salt: Uint8Array, pepper: string): Promise<string> {
  const mac = await hmacRaw(pepper, `pin:${bytesToHex(salt)}:${pin}`);
  return bytesToHex(mac);
}

export async function verifyPin(pin: string, saltHex: string, hashHex: string, pepper: string): Promise<boolean> {
  if (!pepper || !saltHex || !hashHex || saltHex.length % 2 !== 0 || hashHex.length % 2 !== 0) return false;
  const actual = await hashPin(pin, hexToBytes(saltHex), pepper);
  return timingSafeEqual(hexToBytes(actual), hexToBytes(hashHex));
}

/** Bandingkan password owner tanpa membocorkan panjang lewat waktu. */
export async function passwordMatches(input: string, expected: string, pepper: string): Promise<boolean> {
  if (!pepper || !expected || expected.length < 8) return false;
  const a = await hmacRaw(pepper, `owner:${input}`);
  const b = await hmacRaw(pepper, `owner:${expected}`);
  return timingSafeEqual(a, b);
}
