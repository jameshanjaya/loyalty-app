import { describe, expect, it } from "vitest";
import { brandOpen, liveBrands, pickLiveBrand } from "../src/brands";

const brands = [
  { id: "krispyporkk", active: 0, name: "Krispyporkk" },
  { id: "loft25", active: 1, name: "Loft25" },
  { id: "soto-oseng", active: 0, name: "Soto Oseng" },
];

describe("active brand filter", () => {
  it("drops inactive brands and keeps their rows out of the default list", () => {
    expect(liveBrands(brands).map((brand) => brand.id)).toEqual(["loft25"]);
  });

  it("falls back to Loft25 when the requested brand is hidden", () => {
    expect(pickLiveBrand(brands, "soto-oseng")?.id).toBe("loft25");
    expect(pickLiveBrand(brands, "krispyporkk")?.id).toBe("loft25");
    expect(pickLiveBrand(brands, null)?.id).toBe("loft25");
  });

  it("keeps a live brand when it is the one requested", () => {
    expect(pickLiveBrand(brands, "loft25")?.name).toBe("Loft25");
  });

  it("blocks kasir work on an inactive brand", () => {
    expect(brandOpen({ active: 0 })).toBe(false);
    expect(brandOpen(null)).toBe(false);
    expect(brandOpen({ active: 1 })).toBe(true);
  });

  it("returns nothing when every brand is hidden", () => {
    expect(pickLiveBrand([{ id: "soto-oseng", active: 0 }], "soto-oseng")).toBeNull();
  });
});
