export type LimitRule = { windowMs: number; limit: number };

export const LIMITS = {
  memberPin: { windowMs: 15 * 60_000, limit: 5 },
  memberPinIp: { windowMs: 15 * 60_000, limit: 20 },
  cashierPin: { windowMs: 15 * 60_000, limit: 5 },
  cashierPinIp: { windowMs: 15 * 60_000, limit: 20 },
  ownerPin: { windowMs: 15 * 60_000, limit: 5 },
  claimMember: { windowMs: 10 * 60_000, limit: 10 },
  claimIp: { windowMs: 10 * 60_000, limit: 30 },
  cashierIssue: { windowMs: 15 * 60_000, limit: 40 },
  lookup: { windowMs: 10 * 60_000, limit: 20 },
  join: { windowMs: 15 * 60_000, limit: 40 },
} as const satisfies Record<string, LimitRule>;

export type LimitState = Map<string, { windowStart: number; count: number }>;

export type LimitResult = { ok: true; count: number } | { ok: false; count: number; retryAfterSec: number };

export function windowStart(now: number, windowMs: number): number {
  if (windowMs <= 0) return now;
  return now - (now % windowMs);
}

export function retryAfterSec(now: number, start: number, windowMs: number): number {
  return Math.max(1, Math.ceil((start + windowMs - now) / 1000));
}

/**
 * Jendela tetap. Hit ke-(limit+1) ditolak.
 * Dipakai tes. Versi database melakukan increment yang sama lalu memakai judge().
 */
export function hitLimit(state: LimitState, bucket: string, now: number, rule: LimitRule): LimitResult {
  const start = windowStart(now, rule.windowMs);
  const prev = state.get(bucket);
  const count = !prev || prev.windowStart !== start ? 1 : prev.count + 1;
  state.set(bucket, { windowStart: start, count });
  if (count > rule.limit) return { ok: false, count, retryAfterSec: retryAfterSec(now, start, rule.windowMs) };
  return { ok: true, count };
}

export function judgeLimit(count: number, rule: LimitRule, now: number, start: number): LimitResult {
  if (count > rule.limit) return { ok: false, count, retryAfterSec: retryAfterSec(now, start, rule.windowMs) };
  return { ok: true, count };
}

export async function enforceLimit(db: D1Database, bucket: string, now: number, rule: LimitRule): Promise<LimitResult> {
  const start = windowStart(now, rule.windowMs);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(bucket, start)
    .first<{ count: number }>();
  return judgeLimit(row?.count ?? 1, rule, now, start);
}

/** Cek gagal-login yang sudah tercatat, tanpa menambah hitungan. */
export async function failureBlocked(db: D1Database, bucket: string, now: number, rule: LimitRule): Promise<LimitResult> {
  const start = windowStart(now, rule.windowMs);
  const row = await db
    .prepare(`SELECT "count" AS count FROM rate_limits WHERE bucket = ? AND window_start = ?`)
    .bind(bucket, start)
    .first<{ count: number }>();
  const count = row?.count ?? 0;
  if (count >= rule.limit) return { ok: false, count, retryAfterSec: retryAfterSec(now, start, rule.windowMs) };
  return { ok: true, count };
}
