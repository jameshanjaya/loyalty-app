/** 4 perempat = 1 stamp utuh. Sisa pecahan tidak hangus dan tidak kedaluwarsa. */
export const QUARTERS_PER_STAMP = 4;

export type QuestPool = { stamps: number; quarters: number };

export function questQuarters(raw: string): 1 | 2 | 3 | 4 | null {
  const text = raw.trim().replace(",", ".");
  if (text === "0.25") return 1;
  if (text === "0.5" || text === "0.50") return 2;
  if (text === "0.75") return 3;
  if (text === "1" || text === "1.0" || text === "1.00") return 4;
  return null;
}

export function formatAward(quarters: number): string {
  if (quarters === 4) return "1 stamp";
  if (quarters === 3) return "0,75 stamp";
  if (quarters === 2) return "0,5 stamp";
  return quarters === 1 ? "0,25 stamp" : `${quarters} perempat`;
}

export function formatQuarter(quarters: number): string {
  const q = Math.abs(Math.trunc(quarters)) % QUARTERS_PER_STAMP;
  if (q === 1) return "0,25";
  if (q === 2) return "0,5";
  if (q === 3) return "0,75";
  return "0";
}

export function questProgressLabel(quarters: number): string {
  return `${formatQuarter(quarters)}/1 menuju stamp berikutnya`;
}

/** Tambah atau kurangi pecahan. Negatif menarik stamp utuh kalau sisanya kurang. */
export function applyQuestQuarters(pool: QuestPool, deltaQuarters: number): { pool: QuestPool; stampDelta: number } {
  if (!Number.isInteger(deltaQuarters) || deltaQuarters === 0) return { pool, stampDelta: 0 };
  const total = pool.stamps * QUARTERS_PER_STAMP + pool.quarters + deltaQuarters;
  const clamped = Math.max(0, total);
  const stamps = Math.floor(clamped / QUARTERS_PER_STAMP);
  const quarters = clamped % QUARTERS_PER_STAMP;
  return { pool: { stamps, quarters }, stampDelta: stamps - pool.stamps };
}

export function missionQuarters(row: { points_quarters?: number | null; points_tenths: number }): number {
  if (row.points_quarters && row.points_quarters > 0) return row.points_quarters;
  const scaled = (row.points_tenths * QUARTERS_PER_STAMP) / 10;
  return Number.isInteger(scaled) && scaled > 0 ? scaled : 0;
}
