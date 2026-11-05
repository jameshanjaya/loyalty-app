export type BirthdayRule = {
  active: boolean;
  window: "month" | "around";
  days: number;
};

export type BirthdayHit = { open: true; rewardYear: number } | { open: false };

export function parseBirthday(raw: string, now: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const today = wibParts(now);
  if (year < 1920 || year > today.y) return null;
  if (year === today.y && (month > today.m || (month === today.m && day > today.d))) return null;
  if (month < 1 || month > 12) return null;
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > dim) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function wibParts(now: number): { y: number; m: number; d: number } {
  const w = new Date(now + 7 * 60 * 60 * 1000);
  return { y: w.getUTCFullYear(), m: w.getUTCMonth() + 1, d: w.getUTCDate() };
}

function dayNumber(year: number, month: number, day: number): number {
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(day, dim);
  return Math.floor(Date.UTC(year, month - 1, clamped) / 86_400_000);
}

/** Hadiah ultah aktif di bulan ulang tahun, atau N hari sebelum/sesudah. */
export function birthdayStatus(birthday: string | null, now: number, rule: BirthdayRule): BirthdayHit {
  if (!birthday || !rule.active) return { open: false };
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!parts) return { open: false };
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const today = wibParts(now);
  if (rule.window === "month") {
    if (today.m !== month) return { open: false };
    return { open: true, rewardYear: today.y };
  }
  const span = Math.max(0, Math.min(30, rule.days));
  const todayNum = dayNumber(today.y, today.m, today.d);
  for (const year of [today.y - 1, today.y, today.y + 1]) {
    const target = dayNumber(year, month, day);
    if (Math.abs(todayNum - target) <= span) return { open: true, rewardYear: year };
  }
  return { open: false };
}

export function birthdayRedeemAllowed(open: boolean, alreadyRedeemed: boolean): "ok" | "closed" | "used" {
  if (!open) return "closed";
  if (alreadyRedeemed) return "used";
  return "ok";
}

const WIB_MS = 7 * 60 * 60 * 1000;

export type BirthdayNotice =
  | { show: false }
  | { show: true; phase: "open"; rewardYear: number }
  | { show: true; phase: "wait" | "claimed"; target: number };

type BirthdayWindow = { rewardYear: number; start: number; end: number };

function wibStamp(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) - WIB_MS;
}

function shiftDay(year: number, month: number, day: number, delta: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function clampDay(year: number, month: number, day: number): number {
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(day, dim);
}

function birthdayWindow(year: number, month: number, day: number, rule: BirthdayRule): BirthdayWindow {
  if (rule.window === "month") {
    return { rewardYear: year, start: wibStamp(year, month, 1), end: wibStamp(year, month + 1, 1) };
  }
  const span = Math.max(0, Math.min(30, rule.days));
  const on = clampDay(year, month, day);
  const start = shiftDay(year, month, on, -span);
  const end = shiftDay(year, month, on, span + 1);
  return { rewardYear: year, start: wibStamp(start.y, start.m, start.d), end: wibStamp(end.y, end.m, end.d) };
}

/** Next moment the gift can be claimed, in absolute time. Windows use Asia/Jakarta. */
export function birthdayNotice(
  birthday: string | null,
  now: number,
  rule: BirthdayRule,
  claimedYears: ReadonlySet<number>,
): BirthdayNotice {
  if (!birthday || !rule.active) return { show: false };
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!parts) return { show: false };
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return { show: false };
  const today = wibParts(now);
  const windows: BirthdayWindow[] = [];
  for (let year = today.y - 1; year <= today.y + 3; year++) windows.push(birthdayWindow(year, month, day, rule));
  windows.sort((a, b) => a.start - b.start);
  const current = windows.find((window) => now >= window.start && now < window.end);
  if (current && !claimedYears.has(current.rewardYear)) return { show: true, phase: "open", rewardYear: current.rewardYear };
  const next = windows.find((window) => window.start > now);
  if (!next) return { show: false };
  const started = [...windows].reverse().find((window) => window.start <= now);
  const claimed = Boolean(started && claimedYears.has(started.rewardYear));
  return { show: true, phase: claimed ? "claimed" : "wait", target: next.start };
}

export function countdownText(target: number, now: number): string {
  const left = Math.max(0, target - now);
  const total = Math.floor(left / 60_000);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  return `Claim your gift in ${days} days ${hours} hours ${minutes} minutes`;
}
