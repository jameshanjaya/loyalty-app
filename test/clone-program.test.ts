import { describe, expect, it } from "vitest";
import { planClone, swapBrandCopy, type BrandRow, type MissionRow, type TierRow } from "../src/clone-program";

const loft: BrandRow = {
  id: "loft25",
  name: "Loft25 Matcha Studio",
  short_name: "Loft25",
  active: 1,
  stamps_required: 10,
  reward_text: "free matcha",
  condition_label: "Transaksi min Rp50.000",
  min_amount: 50000,
  max_stamps_per_day: 2,
  reward_note: "Matcha di Loft25.",
  birthday_reward: "free matcha ulang tahun",
  birthday_active: 1,
  birthday_window: "day",
  birthday_days: 0,
};

const soto: BrandRow = { ...loft, id: "soto-oseng", name: "Soto Oseng Bang Jem", short_name: "Soto Oseng", active: 0 };
const kris: BrandRow = { ...loft, id: "krispyporkk", name: "Krispyporkk", short_name: "Krispyporkk", active: 0 };

const tiers: TierRow[] = [
  { id: "tier_loft_5", brand_id: "loft25", stamps: 5, reward_text: "free upsize", sort_order: 1, active: 1, icon: "🥤" },
  { id: "tier_loft_10", brand_id: "loft25", stamps: 10, reward_text: "free matcha", sort_order: 2, active: 1, icon: "🍵" },
  { id: "tier_soto_10", brand_id: "soto-oseng", stamps: 10, reward_text: "Soto Oseng paket", sort_order: 1, active: 1 },
];

const missions: MissionRow[] = [
  {
    id: "misi_loft",
    brand_id: "loft25",
    title: "Foto matcha",
    description: "Foto Matcha di Loft25",
    points_tenths: 4,
    proof_screenshot: 1,
    proof_link: 0,
    limit_kind: "once",
    active: 1,
    created_at: 1,
    points_quarters: 4,
    proof_kind: "upload",
    steps: "Foto matcha",
  },
];

describe("salin program Loft25", () => {
  it("mengganti matcha jadi free menu dan nama merek", () => {
    expect(swapBrandCopy("free matcha di Loft25", "Soto Oseng")).toBe("free menu di Soto Oseng");
    expect(swapBrandCopy("Matcha", "Krispyporkk")).toBe("Free menu");
  });

  it("menyalin program, Redeem, dan misi tanpa menyalakan merek", () => {
    const plan = planClone({ source: loft, targets: [soto, kris], tiers, missions, photos: [] });
    expect(plan.sql).toContain("stamps_required = 10");
    expect(plan.sql).toContain("reward_text = 'free menu'");
    expect(plan.sql).toContain("birthday_window = 'day'");
    expect(plan.sql).toContain("c_soto-oseng_tier_loft_5");
    expect(plan.sql).toContain("c_krispyporkk_tier_loft_10");
    expect(plan.sql).not.toContain("misi_loft");
    expect(plan.sql).not.toMatch(/UPDATE brands SET[^;]*\bactive\b/);
    expect(plan.sql).toContain("SET active = 0 WHERE brand_id = 'soto-oseng'");
    const again = planClone({ source: loft, targets: [soto, kris], tiers, missions, photos: [] });
    expect(again.sql).toBe(plan.sql);
  });
});
