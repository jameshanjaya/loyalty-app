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
