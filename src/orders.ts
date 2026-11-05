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

const PRIMARY = ["gofood", "grabfood"] as const;

export function visibleOrderLinks(links: OrderLink[], outletId: string | null): OrderLink[] {
  const usable = links.filter((link) => link.active === 1 && link.url.trim().startsWith("https://"));
  const brand = usable.filter((link) => !link.outlet_id);
  const outlet = outletId ? usable.filter((link) => link.outlet_id === outletId) : [];
  const picked: OrderLink[] = [];
  for (const platform of PRIMARY) {
    const chosen = outlet.find((link) => link.platform === platform) || brand.find((link) => link.platform === platform);
    if (chosen) picked.push(chosen);
  }
  const extras = [...brand, ...outlet]
    .filter((link) => link.platform !== "gofood" && link.platform !== "grabfood")
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  return [...picked, ...extras];
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

/** wa.me dengan pesan siap kirim. Nomor kosong atau tidak valid mengembalikan null. */
export function bookingUrl(outletName: string, wa: string): string | null {
  const digits = normalizeWa(wa);
  const name = outletName.trim();
  if (!digits || !name) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Halo, mau order/booking di ${name}`)}`;
}

export function bookingTarget(
  outlets: Array<{ id: string; name: string; wa: string }>,
  selectedId: string | null,
): { id: string; name: string; url: string } | null {
  const ready = outlets.flatMap((outlet) => {
    const url = bookingUrl(outlet.name, outlet.wa || "");
    return url ? [{ id: outlet.id, name: outlet.name, url }] : [];
  });
  if (ready.length === 0) return null;
  if (ready.length === 1) return ready[0]!;
  return ready.find((outlet) => outlet.id === selectedId) ?? null;
}
