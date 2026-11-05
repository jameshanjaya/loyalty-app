import { WIB_MS } from "./time";

export const DEFAULT_EXPIRE_DAYS = 60;
export const DAY_MS = 86_400_000;
export const SOON_MS = 14 * DAY_MS;

export type Lot = {
  id: string;
  remaining: number;
  earnedAt: number;
  expiresAt: number;
};

export type LedgerLike = {
  id: string;
  delta: number;
  reason: string;
  earnedAt: number | null;
  expiresAt: number | null;
  sourceId: string | null;
  createdAt: number;
};

export type Take = { id: string; amount: number; earnedAt: number; expiresAt: number };

const EARNED = new Set(["mission", "refund"]);

export function expiresAtFor(earnedAt: number, days: number): number {
  const span = Number.isInteger(days) && days > 0 && days <= 3650 ? days : DEFAULT_EXPIRE_DAYS;
  return earnedAt + span * DAY_MS;
}

export function splitLots(rows: LedgerLike[], now: number, defaultDays = DEFAULT_EXPIRE_DAYS): { open: Lot[]; due: Lot[] } {
  const used = new Map<string, number>();
  for (const row of rows) {
    if (row.delta < 0 && row.sourceId) used.set(row.sourceId, (used.get(row.sourceId) || 0) + -row.delta);
  }
  const open: Lot[] = [];
  const due: Lot[] = [];
  for (const row of rows) {
    if (row.delta <= 0 || !EARNED.has(row.reason)) continue;
    const earnedAt = row.earnedAt ?? row.createdAt;
    const expiresAt = row.expiresAt ?? expiresAtFor(earnedAt, defaultDays);
    const remaining = row.delta - (used.get(row.id) || 0);
    if (remaining <= 0) continue;
    const lot: Lot = { id: row.id, remaining, earnedAt, expiresAt };
    if (expiresAt <= now) due.push(lot);
    else open.push(lot);
  }
  return { open, due };
}

function ordered(lots: Lot[], preferId?: string | null): Lot[] {
  return [...lots].sort((a, b) => {
    if (preferId && a.id === preferId && b.id !== preferId) return -1;
    if (preferId && b.id === preferId && a.id !== preferId) return 1;
    return a.expiresAt - b.expiresAt || a.earnedAt - b.earnedAt || a.id.localeCompare(b.id);
  });
}

export function allocateFifo(lots: Lot[], cost: number, preferId?: string | null): { ok: true; takes: Take[] } | { ok: false } {
  const plan = allocateUpTo(lots, cost, preferId);
  if (!Number.isInteger(cost) || cost <= 0 || plan.taken !== cost) return { ok: false };
  return { ok: true, takes: plan.takes };
}

export function allocateUpTo(lots: Lot[], cost: number, preferId?: string | null): { takes: Take[]; taken: number } {
  if (!Number.isInteger(cost) || cost <= 0) return { takes: [], taken: 0 };
  let left = cost;
  const takes: Take[] = [];
  for (const lot of ordered(lots, preferId)) {
    if (left <= 0) break;
    if (lot.remaining <= 0) continue;
    const amount = Math.min(lot.remaining, left);
    takes.push({ id: lot.id, amount, earnedAt: lot.earnedAt, expiresAt: lot.expiresAt });
    left -= amount;
  }
  return { takes, taken: cost - left };
}

function wibDay(ms: number): number {
  return Math.floor((ms + WIB_MS) / DAY_MS);
}

export function soonestBatch(lots: Lot[], now: number): { tenths: number; expiresAt: number; soon: boolean } | null {
  if (!lots.length) return null;
  let expiresAt = lots[0]!.expiresAt;
  for (const lot of lots) if (lot.expiresAt < expiresAt) expiresAt = lot.expiresAt;
  const day = wibDay(expiresAt);
  const tenths = lots.filter((lot) => wibDay(lot.expiresAt) === day).reduce((sum, lot) => sum + lot.remaining, 0);
  if (tenths <= 0) return null;
  return { tenths, expiresAt, soon: expiresAt - now <= SOON_MS };
}

export function expiryCopy(input: { points: string; date: string; days: number; soon: boolean }): { line: string; soon: boolean; reminder: string } {
  return {
    line: `${input.points} poin hangus ${input.date} · tahan ${input.days} hari`,
    soon: input.soon,
    reminder: input.soon ? "Poin kamu mau hangus nih, buruan tukar" : "",
  };
}
