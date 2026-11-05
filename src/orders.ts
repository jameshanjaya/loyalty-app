import { normalizeWa } from "./phone";

export type OrderLink = {
  id: string;
  brand_id: string;
  outlet_id: string | null;
  platform: string;
  label: string;
  url: string;
  sort_order: number;
  active: number;
};

const HIDDEN_ORDER = new Set(["gofood", "grabfood", "shopeefood"]);

/** GoFood, GrabFood, and ShopeeFood stay in the database but are not shown. */
export function hiddenOrderPlatform(platform: string): boolean {
  return HIDDEN_ORDER.has(platform);
}

export function visibleOrderLinks(links: OrderLink[], outletId: string | null): OrderLink[] {
  const usable = links.filter(
    (link) => link.active === 1 && link.url.trim().startsWith("https://") && !hiddenOrderPlatform(link.platform),
  );
  const brand = usable.filter((link) => !link.outlet_id);
  const outlet = outletId ? usable.filter((link) => link.outlet_id === outletId) : [];
  return [...brand, ...outlet].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

export function orderPlatform(raw: string): "gofood" | "grabfood" | "shopeefood" | "wa" | "other" | null {
  if (raw === "gofood" || raw === "grabfood" || raw === "shopeefood" || raw === "wa" || raw === "other") return raw;
  return null;
}

export function orderLabel(platform: string, custom: string): string {
  if (platform === "gofood") return "GoFood";
  if (platform === "grabfood") return "GrabFood";
  if (platform === "shopeefood") return "ShopeeFood";
  if (platform === "booking") return "Order / Booking";
  if (platform === "wa") return custom.trim() || "WhatsApp";
  return custom.trim() || "Pesan";
}

/** Direct wa.me link. wa.me opens the app on a phone and api.whatsapp.com on desktop. */
export function bookingUrl(brandName: string, outletName: string, wa: string): string | null {
  const digits = normalizeWa(wa);
  const outlet = outletName.trim();
  const brand = brandName.trim();
  if (!digits || !outlet) return null;
  const place = brand && brand.toLowerCase() !== outlet.toLowerCase() ? `${brand}, ${outlet}` : outlet;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Halo, mau booking / order di ${place}`)}`;
}

export function bookingTarget(
  brandName: string,
  outlets: Array<{ id: string; name: string; wa: string }>,
  selectedId: string | null,
): { id: string; name: string; url: string } | null {
  const ready = outlets.flatMap((outlet) => {
    const url = bookingUrl(brandName, outlet.name, outlet.wa || "");
    return url ? [{ id: outlet.id, name: outlet.name, url }] : [];
  });
  if (ready.length === 0) return null;
  if (ready.length === 1) return ready[0]!;
  return ready.find((outlet) => outlet.id === selectedId) ?? null;
}
