import type { Brand } from "./types";

export type BrandArt = {
  full: string;
  mark: string;
  chip: string;
};

const ART: Record<string, BrandArt> = {
  loft25: { full: "/brands/loft-mark.svg", mark: "/brands/loft-mark.svg", chip: "#f4efe4" },
  krispyporkk: { full: "/brands/kp-full.svg", mark: "/brands/kp-pig.svg", chip: "#111111" },
  "soto-oseng": { full: "/brands/soto-full.svg", mark: "/brands/soto-face.svg", chip: "#ffffff" },
};

export function brandArt(brand: Pick<Brand, "id" | "logo_key">): BrandArt {
  const base = ART[brand.id] || { full: "/brands/loft-mark.svg", mark: "/brands/loft-mark.svg", chip: "#ffffff" };
  if (brand.logo_key) {
    const uploaded = `/media/logo/${brand.id}`;
    return { ...base, full: uploaded, mark: uploaded };
  }
  return base;
}

export function fallbackNewsPhoto(brandId: string, slot: number): string {
  const sets: Record<string, string[]> = {
    loft25: ["/banners/loft-1.jpg", "/banners/loft-2.jpg", "/banners/loft-1.jpg"],
    krispyporkk: ["/banners/krispy-1.jpg", "/banners/krispy-2.jpg", "/banners/krispy-1.jpg"],
    "soto-oseng": ["/banners/soto-1.jpg", "/banners/soto-2.jpg", "/banners/soto-1.jpg"],
  };
  const set = sets[brandId] || ["/banners/loft-1.jpg"];
  return set[(Math.max(1, slot) - 1) % set.length] || set[0]!;
}

/** Up to 3 live photos. Slotted banners win; otherwise the first three active ones. */
export function pickHeroBanners<T extends { slot?: number | null; active: number; sort_order: number }>(rows: T[]): T[] {
  const live = rows.filter((row) => row.active);
  const slotted = live
    .filter((row) => row.slot != null && row.slot >= 1 && row.slot <= 3)
    .sort((a, b) => (a.slot || 0) - (b.slot || 0));
  if (slotted.length) return slotted.slice(0, 3);
  return [...live].sort((a, b) => a.sort_order - b.sort_order).slice(0, 3);
}

export function rewardFace(text: string): { title: string; badge: string } {
  const match = text.match(/(\d+)\s*%/);
  if (match) return { title: text, badge: `${match[1]}%` };
  return { title: text, badge: "FREE" };
}

export function nextRewardLine(stamps: number, tiers: Array<{ stamps: number; reward: string }>): string {
  const next = [...tiers].filter((tier) => tier.stamps > stamps).sort((a, b) => a.stamps - b.stamps)[0];
  if (!next) return "Stamp penuh, gas tuker";
  const left = next.stamps - stamps;
  return `Kurang ${left} lagi buat ${next.reward}`;
}

export function defaultStampIcon(brandId: string): "whisk" | "bowl" | "snout" {
  if (brandId === "soto-oseng") return "bowl";
  if (brandId === "krispyporkk") return "snout";
  return "whisk";
}

/** Old plate/logo values fall back to the brand default. Custom upload wins only when a file exists. */
export function resolveStampIcon(brand: { id: string; stamp_icon?: string | null; stamp_key?: string | null }): "whisk" | "bowl" | "snout" | "custom" {
  const raw = brand.stamp_icon || "";
  if (raw === "custom" && brand.stamp_key) return "custom";
  if (raw === "whisk" || raw === "bowl" || raw === "snout") return raw;
  return defaultStampIcon(brand.id);
}

export function stampIconSrc(kind: string): string {
  if (kind === "bowl") return "/brands/toni-bowl.svg";
  if (kind === "snout") return "/brands/toni-snout.svg";
  return "/brands/toni-whisk.svg";
}

export function stampFill(brandId: string): string {
  if (brandId === "soto-oseng") return "#1F3A8A";
  if (brandId === "krispyporkk") return "#111111";
  return "#1f3d2b";
}

export function slugifyOutlet(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug;
}

export const RESERVED_KASIR = new Set([
  "masuk",
  "meja",
  "stamp",
  "qr",
  "batal",
  "keluar",
  "kode",
  "cari",
  "tukar",
  "redeem",
  "ulangtahun",
  "misi",
]);
