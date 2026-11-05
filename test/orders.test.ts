import { describe, expect, it } from "vitest";
import { bookingTarget, bookingUrl, visibleOrderLinks, type OrderLink } from "../src/orders";

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

  it("menyembunyikan GoFood, GrabFood, ShopeeFood, dan tautan mati", () => {
    const brand = visibleOrderLinks(links, null).map((item) => item.id);
    expect(brand).toEqual(["wa"]);
    const outlet = visibleOrderLinks(links, "o_loft").map((item) => item.id);
    expect(outlet).toEqual(["wa"]);
    expect(visibleOrderLinks(links, "lain").map((item) => item.id)).toEqual(["wa"]);
  });

  it("order / booking memakai nomor outlet, dan disembunyikan kalau kosong", () => {
    const url = bookingUrl("Loft25 Senopati", "0812 1111 2580");
    expect(url).toBe("https://wa.me/6281211112580?text=Halo%2C%20mau%20order%2Fbooking%20di%20Loft25%20Senopati");
    expect(bookingUrl("Senopati", "")).toBeNull();
    expect(bookingUrl("Senopati", "123")).toBeNull();
    const outlets = [
      { id: "a", name: "Senopati", wa: "081211112580" },
      { id: "b", name: "Kemang", wa: "081311113691" },
      { id: "c", name: "Kosong", wa: "" },
    ];
    expect(bookingTarget(outlets, null)).toBeNull();
    expect(bookingTarget(outlets, "b")?.id).toBe("b");
    expect(bookingTarget(outlets, "c")).toBeNull();
    expect(bookingTarget([outlets[0]!], null)?.id).toBe("a");
  });
});