import { bytesToHex, hexToBytes, hmacRaw, passwordMatches, randomBytes, timingSafeEqual } from "./crypto";

export type StoredOwnerPassword = { salt: string; hash: string };

const MIN_LEN = 8;
const MAX_LEN = 200;

export function ownerSubject(version: string | null): string {
  if (!version) return "owner";
  return `owner:${version}`;
}

export function ownerSessionCurrent(subjectId: string | null, version: string | null): boolean {
  return subjectId === ownerSubject(version);
}

export async function hashOwnerPassword(password: string, salt: Uint8Array, pepper: string): Promise<string> {
  const mac = await hmacRaw(pepper, `owner-pass:${bytesToHex(salt)}:${password}`);
  return bytesToHex(mac);
}

export async function verifyOwnerPassword(password: string, saltHex: string, hashHex: string, pepper: string): Promise<boolean> {
  if (!pepper || !saltHex || !hashHex || saltHex.length % 2 !== 0 || hashHex.length % 2 !== 0) return false;
  const actual = await hashOwnerPassword(password, hexToBytes(saltHex), pepper);
  return timingSafeEqual(hexToBytes(actual), hexToBytes(hashHex));
}

/** D1 menang kalau hash-nya ada. Kalau belum, pakai password di secret. */
export async function ownerPasswordOk(input: {
  password: string;
  pepper: string;
  envPassword: string;
  stored: StoredOwnerPassword | null;
}): Promise<boolean> {
  if (input.stored) return verifyOwnerPassword(input.password, input.stored.salt, input.stored.hash, input.pepper);
  if (!input.pepper || !input.envPassword || input.envPassword.length < MIN_LEN) return false;
  return passwordMatches(input.password, input.envPassword, input.pepper);
}

export async function planOwnerPasswordChange(input: {
  current: string;
  next: string;
  confirm: string;
  pepper: string;
  envPassword: string;
  stored: StoredOwnerPassword | null;
}): Promise<{ ok: true; salt: string; hash: string } | { ok: false; error: "passpendek" | "passbeda" | "passsalah" | "secret" }> {
  if (!input.pepper || input.pepper.length < 16) return { ok: false, error: "secret" };
  if (input.next.length < MIN_LEN || input.next.length > MAX_LEN) return { ok: false, error: "passpendek" };
  if (input.next !== input.confirm) return { ok: false, error: "passbeda" };
  const currentOk = await ownerPasswordOk({
    password: input.current,
    pepper: input.pepper,
    envPassword: input.envPassword,
    stored: input.stored,
  });
  if (!currentOk) return { ok: false, error: "passsalah" };
  const salt = randomBytes(16);
  const hash = await hashOwnerPassword(input.next, salt, input.pepper);
  return { ok: true, salt: bytesToHex(salt), hash };
}
