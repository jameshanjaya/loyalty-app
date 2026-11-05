export type BrandFlag = { id: string; active: number };

export function liveBrands<T extends BrandFlag>(brands: readonly T[]): T[] {
  return brands.filter((brand) => brand.active === 1);
}

/** Requested brand only if it is active. Otherwise the first active brand, so a hidden card falls back to Loft25 when that is the live one. */
export function pickLiveBrand<T extends BrandFlag>(brands: readonly T[], wanted: string | null | undefined): T | null {
  const live = liveBrands(brands);
  if (!live.length) return null;
  return live.find((brand) => brand.id === wanted) || live[0];
}

export function brandOpen<T extends { active: number }>(brand: T | null | undefined): brand is T {
  return Boolean(brand && brand.active === 1);
}
