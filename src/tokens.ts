import { bytesToB64Url, hmacRaw, randomId, timingSafeEqual, b64UrlToBytes } from "./crypto";
import { CLAIM_TTL_MS } from "./loyalty";

export type ClaimKind = "stamp" | "redeem" | "birthday";

export type ClaimPayload = {
  id: string;
  exp: number;
  kind: ClaimKind;
  brandId: string;
  outletId: string;
};

export type StoredClaim = {
  id: string;
  outletId: string;
  brandId: string;
  sessionId: string;
  kind: ClaimKind;
  status: "pending" | "claimed" | "cancelled";
  memberId: string | null;
  expiresAt: number;
  createdAt: number;
  claimedAt: number | null;
};

export type ClaimInsert = {
  insert(record: StoredClaim): Promise<void>;
};

export type ClaimReader = {
  get(id: string): Promise<StoredClaim | null>;
  markClaimed(id: string, memberId: string, now: number): Promise<boolean>;
};

export async function signClaim(payload: ClaimPayload, secret: string): Promise<string> {
  const body = [payload.id, String(payload.exp), payload.kind, payload.brandId, payload.outletId].join(".");
  const sig = bytesToB64Url((await hmacRaw(secret, `claim:${body}`)).slice(0, 16));
  return `${body}.${sig}`;
}

export async function readClaim(
  token: string,
  secret: string,
  now: number,
): Promise<{ ok: true; payload: ClaimPayload } | { ok: false; reason: "malformed" | "bad_sig" | "expired" }> {
  const parts = token.split(".");
  if (parts.length !== 6) return { ok: false, reason: "malformed" };
  const [id, expStr, kind, brandId, outletId, sig] = parts as [string, string, string, string, string, string];
  if (kind !== "stamp" && kind !== "redeem" && kind !== "birthday") return { ok: false, reason: "malformed" };
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return { ok: false, reason: "malformed" };
  if (!/^[a-z0-9-]{2,40}$/.test(brandId) || !/^[A-Za-z0-9_-]{2,40}$/.test(outletId)) {
    return { ok: false, reason: "malformed" };
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || expStr !== String(exp)) return { ok: false, reason: "malformed" };
  const body = [id, expStr, kind, brandId, outletId].join(".");
  const expected = bytesToB64Url((await hmacRaw(secret, `claim:${body}`)).slice(0, 16));
  const a = b64UrlToBytes(sig);
  const b = b64UrlToBytes(expected);
  if (!a || !b || !(await timingSafeEqual(a, b))) return { ok: false, reason: "bad_sig" };
  if (now > exp) return { ok: false, reason: "expired" };
  return { ok: true, payload: { id, exp, kind, brandId, outletId } };
}

export function decideClaim(
  record: StoredClaim | null,
  payload: ClaimPayload,
  now: number,
): "ok" | "missing" | "expired" | "used" | "cancelled" | "mismatch" {
  if (!record) return "missing";
  if (record.brandId !== payload.brandId || record.outletId !== payload.outletId || record.kind !== payload.kind || record.id !== payload.id) {
    return "mismatch";
  }
  if (record.status === "cancelled") return "cancelled";
  if (record.status !== "pending") return "used";
  if (now > record.expiresAt || now > payload.exp) return "expired";
  return "ok";
}

export async function issueClaim(
  store: ClaimInsert,
  input: { outletId: string; brandId: string; sessionId: string; kind: ClaimKind },
  secret: string,
  now: number,
  ttlMs = CLAIM_TTL_MS,
): Promise<{ token: string; record: StoredClaim }> {
  const record: StoredClaim = {
    id: randomId(),
    outletId: input.outletId,
    brandId: input.brandId,
    sessionId: input.sessionId,
    kind: input.kind,
    status: "pending",
    memberId: null,
    expiresAt: now + ttlMs,
    createdAt: now,
    claimedAt: null,
  };
  const token = await signClaim(
    { id: record.id, exp: record.expiresAt, kind: record.kind, brandId: record.brandId, outletId: record.outletId },
    secret,
  );
  await store.insert(record);
  return { token, record };
}

export async function inspectClaim(
  store: ClaimReader,
  token: string,
  secret: string,
  now: number,
): Promise<
  | { ok: true; payload: ClaimPayload; record: StoredClaim }
  | { ok: false; reason: "malformed" | "bad_sig" | "expired" | "missing" | "used" | "cancelled" | "mismatch" }
> {
  const read = await readClaim(token, secret, now);
  if (!read.ok) return read;
  const record = await store.get(read.payload.id);
  const decision = decideClaim(record, read.payload, now);
  if (decision !== "ok" || !record) return { ok: false, reason: decision === "ok" ? "missing" : decision };
  return { ok: true, payload: read.payload, record };
}

/** Penyimpanan di memori untuk tes. Produksi memakai D1 dengan aturan yang sama. */
export class MemoryClaimStore implements ClaimInsert, ClaimReader {
  readonly rows = new Map<string, StoredClaim>();

  async insert(record: StoredClaim): Promise<void> {
    this.rows.set(record.id, { ...record });
  }

  async get(id: string): Promise<StoredClaim | null> {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  }

  async markClaimed(id: string, memberId: string, now: number): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.status !== "pending" || now > row.expiresAt) return false;
    row.status = "claimed";
    row.memberId = memberId;
    row.claimedAt = now;
    return true;
  }
}
