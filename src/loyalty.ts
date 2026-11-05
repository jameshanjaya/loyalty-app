export const CLAIM_TTL_MS = 60_000;
export const CANCEL_WINDOW_MS = 5 * 60_000;
export const CASHIER_SESSION_MS = 16 * 60 * 60 * 1000;
export const MEMBER_SESSION_MS = 365 * 24 * 60 * 60 * 1000;
/** Perpanjang cookie kalau kunjungan terakhir sudah lewat sekitar sehari. */
export const MEMBER_SESSION_REFRESH_MS = 24 * 60 * 60 * 1000;
export const OWNER_SESSION_MS = 12 * 60 * 60 * 1000;
export const CASHIER_FLAG_AT = 25;
export const CASHIER_FLAG_WINDOW_MS = 15 * 60_000;

export type StampDecision =
  | { ok: true; balance: number }
  | { ok: false; reason: "not_confirmed" | "daily_cap" };

/**
 * Satu transaksi = satu stamp. Kasir harus mencentang syarat.
 * Batas harian dicek terpisah di nextDayCount supaya aman dari dua tap bersamaan.
 */
export function applyStamp(input: { confirmed: boolean; balance: number }): StampDecision {
  if (!input.confirmed) return { ok: false, reason: "not_confirmed" };
  return { ok: true, balance: input.balance + 1 };
}

/** Transisi penghitung harian. Harus sama dengan UPDATE di service.ts. */
export function nextDayCount(
  prevCount: number,
  prevDay: number,
  today: number,
  maxPerDay: number,
): { ok: true; count: number; day: number } | { ok: false; reason: "daily_cap" } {
  if (maxPerDay < 1) return { ok: false, reason: "daily_cap" };
  const used = prevDay === today ? prevCount : 0;
  if (used >= maxPerDay) return { ok: false, reason: "daily_cap" };
  return { ok: true, count: used + 1, day: today };
}

export type RedeemDecision =
  | { ok: true; spent: number; remaining: number }
  | { ok: false; reason: "not_enough" };

/** Sisa stamp di atas kelipatan ikut terbawa, tidak hangus. */
export function applyRedeem(balance: number, required: number): RedeemDecision {
  if (!Number.isInteger(required) || required <= 0) return { ok: false, reason: "not_enough" };
  if (!Number.isInteger(balance) || balance < required) return { ok: false, reason: "not_enough" };
  return { ok: true, spent: required, remaining: balance - required };
}

export function reverseStamp(balance: number): { ok: true; balance: number } | { ok: false; reason: "empty" } {
  if (balance < 1) return { ok: false, reason: "empty" };
  return { ok: true, balance: balance - 1 };
}

export function reverseRedeem(balance: number, spent: number): { balance: number } {
  return { balance: balance + Math.max(0, spent) };
}

export function progressCopy(stamps: number, required: number, reward: string): { ready: boolean; left: number; headline: string } {
  if (stamps >= required) {
    const extra = stamps - required;
    return {
      ready: true,
      left: 0,
      headline: extra > 0 ? `Yeay, stamp penuh! ${reward} siap, sisa ${extra} stamp.` : "Yeay, stamp penuh! Reward-nya bisa ditukar sekarang",
    };
  }
  const left = required - stamps;
  return { ready: false, left, headline: `Dikit lagi! ${left} stamp lagi dapet ${reward}` };
}

/**
 * Sesi member menyimpan masa berlaku = waktu perpanjang terakhir + 365 hari.
 * Kalau sejak perpanjang itu sudah lewat sehari, dan sesinya belum hangus, cookie perlu dibuat lagi.
 */
export function memberSessionDue(input: { expiresAt: number; now: number; lifetimeMs: number; refreshAfterMs: number }): boolean {
  if (input.now >= input.expiresAt) return false;
  const refreshedAt = input.expiresAt - input.lifetimeMs;
  return input.now - refreshedAt >= input.refreshAfterMs;
}

export function cookieAlreadySet(setCookies: string[], name: string): boolean {
  const prefix = `${name}=`;
  return setCookies.some((cookie) => cookie.trimStart().startsWith(prefix));
}

export function canCancel(input: { createdAt: number; now: number; sameSession: boolean; voided: boolean; isLast: boolean }): boolean {
  if (!input.sameSession || input.voided || !input.isLast) return false;
  return input.now - input.createdAt <= CANCEL_WINDOW_MS && input.now >= input.createdAt;
}
