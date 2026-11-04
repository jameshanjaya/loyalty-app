import { describe, expect, it } from "vitest";
import { visibleOrderLinks, type OrderLink } from "../src/orders";

function link(partial: Partial<OrderLink> & Pick<OrderLink, "id" | "platform" | "url">): OrderLink {
  return {
    brand_id: "loft25",
    outlet_id: null,
    label: partial.platform,
    sort_order: 0,
    active: 1,
    ...partial,
  };
}

describe("tautan pesan", () => {
  const links = [
    link({ id: "go", platform: "gofood", url: "https://gofood.co.id/loft" }),
    link({ id: "grab", platform: "grabfood", url: "https://food.grab.com/loft" }),
    link({ id: "empty", platform: "shopeefood", url: "   " }),
    link({ id: "off", platform: "wa", url: "https://wa.me/62811", active: 0 }),
    link({ id: "wa", platform: "wa", url: "https://wa.me/62812", label: "WhatsApp" }),
    link({ id: "out-go", platform: "gofood", url: "https://gofood.co.id/senopati", outlet_id: "o_loft" }),
  ];

  it("menyembunyikan yang kosong atau mati, dan outlet menimpa merek", () => {
    const brand = visibleOrderLinks(links, null).map((item) => item.id);
    expect(brand).toEqual(["go", "grab", "wa"]);
    const outlet = visibleOrderLinks(links, "o_loft").map((item) => item.id);
    expect(outlet).toEqual(["out-go", "grab", "wa"]);
    expect(visibleOrderLinks(links, "lain").map((item) => item.id)).toEqual(["go", "grab", "wa"]);
  });
});