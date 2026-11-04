export const WIB_MS = 7 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function wibParts(ms: number): { y: number; m: number; d: number; hh: number; mm: number } {
  const w = new Date(ms + WIB_MS);
  return {
    y: w.getUTCFullYear(),
    m: w.getUTCMonth(),
    d: w.getUTCDate(),
    hh: w.getUTCHours(),
    mm: w.getUTCMinutes(),
  };
}

export function startOfWibDay(now: number): number {
  const p = wibParts(now);
  return Date.UTC(p.y, p.m, p.d) - WIB_MS;
}

export function startOfWibMonth(now: number): number {
  const p = wibParts(now);
  return Date.UTC(p.y, p.m, 1) - WIB_MS;
}

export function memberSince(ms: number): string {
  const p = wibParts(ms);
  return `${MONTHS[p.m]} ${p.y}`;
}

export function clock(ms: number): string {
  const p = wibParts(ms);
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

export function feedTime(ms: number, now: number): string {
  if (ms >= startOfWibDay(now)) return clock(ms);
  const p = wibParts(ms);
  return `${p.d} ${MONTHS[p.m]}`;
}

export function dayLabel(dayIndex: number): string {
  const ms = dayIndex * 86_400_000;
  const w = new Date(ms);
  return `${w.getUTCDate()} ${MONTHS[w.getUTCMonth()]}`;
}

export function wibDayIndex(ms: number): number {
  return Math.floor((ms + WIB_MS) / 86_400_000);
}

/** Input dari <input type="datetime-local"> dibaca sebagai waktu WIB. */
export function parseWibLocal(input: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  if (Number.isNaN(utc)) return null;
  return utc - WIB_MS;
}

export function parseWibDate(input: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(utc)) return null;
  return utc - WIB_MS;
}

export function toWibDateInput(ms: number): string {
  const p = wibParts(ms);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function toWibLocalInput(ms: number | null): string {
  if (ms == null) return "";
  const p = wibParts(ms);
  const mo = String(p.m + 1).padStart(2, "0");
  const d = String(p.d).padStart(2, "0");
  return `${p.y}-${mo}-${d}T${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}
