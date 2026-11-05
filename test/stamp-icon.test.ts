import { describe, expect, it } from "vitest";
import { defaultStampIcon, resolveStampIcon, stampFill, stampIconSrc } from "../src/brand-visual";

describe("ikon stamp Toni", () => {
  it("pakai whisk, mangkok, dan hidung babi sebagai bawaan merek", () => {
    expect(defaultStampIcon("loft25")).toBe("whisk");
    expect(defaultStampIcon("soto-oseng")).toBe("bowl");
    expect(defaultStampIcon("krispyporkk")).toBe("snout");
    expect(stampIconSrc("whisk")).toBe("/brands/toni-whisk.svg");
    expect(stampIconSrc("bowl")).toBe("/brands/toni-bowl.svg");
    expect(stampIconSrc("snout")).toBe("/brands/toni-snout.svg");
    expect(stampFill("krispyporkk")).toBe("#111111");
    expect(stampFill("soto-oseng")).toBe("#1F3A8A");
  });

  it("ikon lama plate dan logo jatuh ke bawaan merek, upload custom tetap menang", () => {
    expect(resolveStampIcon({ id: "krispyporkk", stamp_icon: "plate" })).toBe("snout");
    expect(resolveStampIcon({ id: "loft25", stamp_icon: "logo" })).toBe("whisk");
    expect(resolveStampIcon({ id: "soto-oseng", stamp_icon: "custom", stamp_key: "stamp/soto" })).toBe("custom");
    expect(resolveStampIcon({ id: "soto-oseng", stamp_icon: "custom" })).toBe("bowl");
    expect(resolveStampIcon({ id: "loft25", stamp_icon: "snout" })).toBe("snout");
  });
});
