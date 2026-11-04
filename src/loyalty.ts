export const CLAIM_TTL_MS = 60_000;
export const CANCEL_WINDOW_MS = 5 * 60_000;
export const CASHIER_SESSION_MS = 16 * 60 * 60 * 1000;
export const MEMBER_SESSION_MS = 180 * 24 * 60 * 60 * 1000;
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
      headline: extra > 0 ? `Stamp penuh! ${reward} siap ditukar, ${extra} stamp ikut sisa.` : "Stamp penuh! Reward bisa ditukar sekarang",
    };
  }
  const left = required - stamps;
  return { ready: false, left, headline: `${left} stamp lagi dapat ${reward}!` };
}

export function canCancel(input: { createdAt: number; now: number; sameSession: boolean; voided: boolean; isLast: boolean }): boolean {
  if (!input.sameSession || input.voided || !input.isLast) return false;
  return input.now - input.createdAt <= CANCEL_WINDOW_MS && input.now >= input.createdAt;
}
