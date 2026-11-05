/** Copy Loft25's program onto other brands. Never changes brands.active, names, colors, logos, or stamp icons. */

export const SOURCE_BRAND_ID = "loft25";
export const TARGET_BRAND_IDS = ["soto-oseng", "krispyporkk"] as const;

export const PROGRAM_FIELDS = [
  "stamps_required",
  "reward_text",
  "condition_label",
  "min_amount",
  "max_stamps_per_day",
  "reward_note",
  "birthday_reward",
  "birthday_active",
  "birthday_window",
  "birthday_days",
] as const;

export type ProgramField = (typeof PROGRAM_FIELDS)[number];

export type BrandRow = {
  id: string;
  name: string;
  short_name: string;
  active: number;
  stamps_required: number;
  reward_text: string;
  condition_label: string;
  min_amount: number | null;
  max_stamps_per_day: number;
  reward_note: string;
  birthday_reward: string;
  birthday_active: number;
  birthday_window: string;
  birthday_days: number;
};

export type TierRow = {
  id: string;
  brand_id: string;
  stamps: number;
  reward_text: string;
  sort_order: number;
  active: number;
  icon?: string | null;
  stock?: number | null;
  image_url?: string | null;
  r2_key?: string | null;
};

export type MissionRow = {
  id: string;
  brand_id: string | null;
  title: string;
  description: string;
  points_tenths: number;
  proof_screenshot: number;
  proof_link: number;
  limit_kind: string;
  active: number;
  created_at: number;
  icon?: string | null;
  tag?: string | null;
  mystery?: number | null;
  tease?: string | null;
  unlock_points_tenths?: number | null;
  sort_order?: number | null;
  points_quarters?: number | null;
  proof_kind?: string | null;
  starts_at?: number | null;
  ends_at?: number | null;
  steps?: string | null;
};

export type PhotoRow = {
  id: string;
  mission_id: string;
  r2_key: string | null;
  image_url: string | null;
  caption: string;
  sort_order: number;
};

const TEXT_FIELDS = new Set<ProgramField>(["reward_text", "condition_label", "reward_note", "birthday_reward"]);

export function cloneId(targetId: string, sourceId: string): string {
  return `c_${targetId}_${sourceId}`;
}

export function swapBrandCopy(text: string, targetName: string): string {
  return text
    .replace(/free matcha/gi, (word) => matchCase(word, "free menu"))
    .replace(/Loft25/gi, targetName)
    .replace(/matcha/gi, (word) => matchCase(word, "free menu"));
}

function matchCase(sample: string, replacement: string): string {
  if (sample === sample.toUpperCase()) return replacement.toUpperCase();
  if (sample[0] === sample[0].toUpperCase()) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  return replacement;
}

export function sqlLiteral(value: string | number | null | undefined): string {
  if (value == null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

export type CloneInput = {
  source: BrandRow;
  targets: BrandRow[];
  tiers: TierRow[];
  missions: MissionRow[];
  photos: PhotoRow[];
};

export function planClone(input: CloneInput): { sql: string; summary: string[] } {
  if (input.source.id !== SOURCE_BRAND_ID) throw new Error("Sumbernya harus Loft25.");
  const lines: string[] = ["BEGIN;"];
  const summary: string[] = [];
  const sourceTiers = input.tiers.filter((tier) => tier.brand_id === input.source.id);
  for (const target of input.targets) {
    if (target.id === input.source.id) continue;
    const sets = PROGRAM_FIELDS.map((field) => {
      const raw = input.source[field];
      const value = typeof raw === "string" && TEXT_FIELDS.has(field) ? swapBrandCopy(raw, target.short_name) : raw;
      return `${field} = ${sqlLiteral(value)}`;
    });
    lines.push(`UPDATE brands SET ${sets.join(", ")} WHERE id = ${sqlLiteral(target.id)};`);
    summary.push(
      `${target.short_name}: program (stamp untuk reward ${input.source.stamps_required}, teks reward, syarat transaksi, catatan, Birthday Freebies ${input.source.birthday_window} / ${input.source.birthday_days} hari, aktif ${input.source.birthday_active}). active tetap ${target.active}.`,
    );
    const tierIds = sourceTiers.map((tier) => cloneId(target.id, tier.id));
    lines.push(
      `UPDATE stamp_tiers SET active = 0 WHERE brand_id = ${sqlLiteral(target.id)} AND id NOT GLOB ${sqlLiteral(`c_${target.id}_*`)};`,
    );
    for (const tier of sourceTiers) {
      const id = cloneId(target.id, tier.id);
      const reward = swapBrandCopy(tier.reward_text, target.short_name);
      lines.push(
        `INSERT INTO stamp_tiers (id, brand_id, stamps, reward_text, sort_order, active, icon, stock, image_url, r2_key) VALUES (${[
          sqlLiteral(id),
          sqlLiteral(target.id),
          sqlLiteral(tier.stamps),
          sqlLiteral(reward),
          sqlLiteral(tier.sort_order),
          sqlLiteral(tier.active),
          sqlLiteral(tier.icon || "🎁"),
          sqlLiteral(tier.stock ?? null),
          sqlLiteral(tier.image_url ?? null),
          sqlLiteral(tier.r2_key ?? null),
        ].join(", ")}) ON CONFLICT(id) DO UPDATE SET stamps = excluded.stamps, reward_text = excluded.reward_text, sort_order = excluded.sort_order, active = excluded.active, icon = excluded.icon, stock = excluded.stock, image_url = excluded.image_url, r2_key = excluded.r2_key;`,
      );
    }
    summary.push(
      `${target.short_name}: Redeem disalin dari Loft25 (${sourceTiers.map((tier) => `${tier.stamps} stamp = ${swapBrandCopy(tier.reward_text, target.short_name)}`).join("; ") || "tidak ada"}). Baris Redeem lama dimatikan, tidak dihapus. Id: ${tierIds.join(", ") || "-"}.`,
    );
    summary.push(`${target.short_name}: Bonus Stamp tidak disalin. Tiga misi yang sama diisi migrasi.`);
    void input.missions;
    void input.photos;
  }
  lines.push("COMMIT;");
  return { sql: lines.join("\n"), summary };
}
