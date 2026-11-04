import { startOfWibDay, WIB_MS } from "./time";

/** Poin disimpan sebagai persepuluhan: 0.5 = 5, 2.5 = 25. */
export function parsePoints(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d)?$/.test(text)) return null;
  const tenths = Math.round(Number(text) * 10);
  if (!Number.isInteger(tenths) || tenths <= 0 || tenths > 100_000) return null;
  return tenths;
}

export function formatPoints(tenths: number): string {
  const sign = tenths < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(tenths));
  const whole = Math.floor(abs / 10);
  const frac = abs % 10;
  return frac === 0 ? `${sign}${whole}` : `${sign}${whole}.${frac}`;
}

export function spendPoints(
  balanceTenths: number,
  costTenths: number,
): { ok: true; remaining: number } | { ok: false; reason: "not_enough" } {
  if (!Number.isInteger(balanceTenths) || !Number.isInteger(costTenths) || costTenths <= 0) {
    return { ok: false, reason: "not_enough" };
  }
  if (balanceTenths < costTenths) return { ok: false, reason: "not_enough" };
  return { ok: true, remaining: balanceTenths - costTenths };
}

export function tierRedeem(
  stamps: number,
  cost: number,
): { ok: true; spent: number; remaining: number } | { ok: false; reason: "not_enough" } {
  if (!Number.isInteger(stamps) || !Number.isInteger(cost) || cost <= 0 || stamps < cost) {
    return { ok: false, reason: "not_enough" };
  }
  return { ok: true, spent: cost, remaining: stamps - cost };
}

export type TierChoice = { stamps: number; reward: string };

export function tierChoices(balance: number, tiers: TierChoice[]): { available: TierChoice[]; next: TierChoice | null } {
  const sorted = [...tiers].sort((a, b) => a.stamps - b.stamps);
  return {
    available: sorted.filter((tier) => tier.stamps <= balance),
    next: sorted.find((tier) => tier.stamps > balance) ?? null,
  };
}

export const CODE_TTL_MS = 10 * 60 * 1000;

export type LiveCode = {
  status: string;
  expiresAt: number;
  pointsTenths: number;
  stamps: number;
};

export function releaseExpired(row: LiveCode, now: number): { changed: boolean; points: number; stamps: number; status: string } {
  if (row.status !== "pending") return { changed: false, points: 0, stamps: 0, status: row.status };
  if (now <= row.expiresAt) return { changed: false, points: 0, stamps: 0, status: "pending" };
  return { changed: true, points: row.pointsTenths, stamps: row.stamps, status: "expired" };
}

export function confirmCode(row: { status: string; expiresAt: number }, now: number): "ok" | "used" | "expired" {
  if (row.status === "confirmed" || row.status === "cancelled") return "used";
  if (row.status === "expired" || now > row.expiresAt) return "expired";
  if (row.status !== "pending") return "used";
  return "ok";
}

export function randomRedeemCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0]! % 100_000).padStart(5, "0");
}

export function startOfWibWeek(now: number): number {
  const day = startOfWibDay(now);
  const dow = new Date(day + WIB_MS).getUTCDay();
  const sinceMonday = (dow + 6) % 7;
  return day - sinceMonday * 86_400_000;
}

export function missionOpen(input: {
  limit: "once" | "week";
  hasPending: boolean;
  lastApprovedAt: number | null;
  now: number;
}): boolean {
  if (input.hasPending) return false;
  if (input.lastApprovedAt == null) return true;
  if (input.limit === "once") return false;
  return input.lastApprovedAt < startOfWibWeek(input.now);
}
