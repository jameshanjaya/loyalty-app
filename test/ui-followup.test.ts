import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatBirthdayId, readBirthdayRaw } from "../src/birthday";
import { brandArt } from "../src/brand-visual";
import { RESERVASI_LABEL, orderLabel } from "../src/orders";
import type { Brand, Card, Member } from "../src/types";
import { cardPage, catalogPage, homePage, joinPage, loginPage, profilePage } from "../src/view";

function brand(id: string, short: string, name = short): Brand {
  return {
    id,
    name,
    short_name: short,
    handle: "@x",
    emoji: "🍗",
    accent: "#143d28",
    accent_soft: "#e4f0dc",
    stamps_required: 10,
    reward_text: "reward",
    condition_label: "ok",
    min_amount: null,
    max_stamps_per_day: 2,
    reward_note: "",
    active: 1,
    birthday_reward: "",
    birthday_active: 0,
    birthday_window: "day",
    birthday_days: 0,
    non_halal: id === "loft25" ? 0 : 1,
  };
}

function person(): Member {
  return {
    id: "m1",
    name: "Agus Salim",
    wa: "6281812340011",
    pin_hash: "x",
    pin_salt: "y",
    created_at: Date.UTC(2024, 0, 2),
    last_seen_at: Date.UTC(2024, 0, 2),
    email: null,
    birthday: null,
    google_sub: null,
    join_method: "wa",
  };
}

describe("salinan dan logo", () => {
  const loft = brand("loft25", "Loft25", "Loft25 Matcha Studio");
  const kris = brand("krispyporkk", "Krispyporkk");
  const soto = brand("soto-oseng", "Soto Oseng", "Soto Oseng Bang Jem");

  it("landing pakai logo, label non-halal, dan header netral", () => {
    const html = homePage([loft, kris, soto]);
    expect(html).toContain('lang="id"');
    expect(html).toContain("Pilih brand");
    expect(html).toContain("1 kartu buat semua brand favorit lu");
    expect(html).toContain("Udah punya kartu");
    expect(html).toContain("hero-plain");
    expect(html).not.toContain("Pilih merek");
    expect(html).not.toContain("Satu akun untuk semua merek");
    expect(html).not.toContain("Sudah punya kartu");
    expect(html).not.toContain("🍗");
    expect(html).toContain("/brands/loft-mark.svg");
    expect(html).toContain("/brands/kp-pig.png");
    expect(html).toContain("/brands/soto-face.png");
    expect(html).toContain("brand-soto-oseng");
    expect(html.match(/Non-halal/g)?.length).toBe(2);
    expect(html.indexOf("Non-halal")).toBeGreaterThan(html.indexOf("kp-pig.png"));
  });

  it("gabung dan masuk tidak formal, input-nya penuh", () => {
    const join = joinPage({ brands: [kris], brand: kris, next: "/kartu", params: new URLSearchParams() });
    expect(join).toContain("1 kartu buat semua brand favorit lu");
    expect(join).toContain("Udah terdaftar?");
    expect(join).toContain("/brands/kp-pig.png");
    expect(join).not.toContain("🍗");
    expect(join).toContain('type="tel"');
    const login = loginPage({ next: "/kartu", params: new URLSearchParams() });
    expect(login).toContain('lang="id"');
    expect(login).toContain('type="tel"');
    expect(login).toContain('name="pin" type="text"');
  });

  it("kartu memakai Reservasi / Order via WhatsApp dan lingkaran logo", () => {
    const cards = new Map<string, Card>([
      ["loft25", { member_id: "m1", brand_id: "loft25", stamps: 3, lifetime_stamps: 3, lifetime_redeems: 0, day_count: 0, day_on: 0, updated_at: 1 }],
    ]);
    const slice = (item: Brand, photo: string, reward: string) => ({
      brand: item,
      banners: [
        {
          id: item.id,
          brand_id: item.id,
          title: item.short_name,
          subtitle: photo,
          image_url: photo,
          r2_key: null,
          link_url: null,
          starts_at: null,
          ends_at: null,
          sort_order: 1,
          active: 1,
          created_at: 1,
          cta: "",
          slot: 1,
        },
      ],
      history: [],
      birthday: { show: false } as const,
      birthdayReward: reward,
      tiers: [],
      orders: [],
      orderOutlets: [],
      booking: { id: `${item.id}-out`, name: item.short_name, url: `https://wa.me/62812?text=${item.id}` },
      pickBooking: false,
      missions: [{ id: `m-${item.id}`, title: `Misi ${item.short_name}`, blurb: item.handle, kind: "google", status: "open", reason: "" }],
      quarters: 0,
    });
    const html = cardPage({
      member: person(),
      brands: [loft, kris, soto],
      cards,
      brand: loft,
      banners: [],
      history: [],
      now: Date.UTC(2026, 10, 5),
      params: new URLSearchParams(),
      birthday: { show: false },
      birthdayReward: "",
      booking: { id: "o1", name: "Senopati", url: "https://wa.me/6281211112580?text=Halo" },
      orderOutlets: [{ id: "o1", name: "Senopati", on: true }],
      slices: [slice(loft, "/banners/loft-1.jpg", "free matcha"), slice(kris, "/banners/krispy-1.jpg", "es krim"), slice(soto, "/banners/soto-1.jpg", "es teh")],
    });
    expect(html).toContain(RESERVASI_LABEL);
    expect(html).not.toContain("Booking / Order via WA");
    expect(html).toContain("brand-loft25");
    expect(html).toContain("brand-krispyporkk");
    expect(html).toContain('data-dot-brand="soto-oseng"');
    expect(html).toContain('data-page');
    expect(html).toContain('src="/brand.js?v=13"');
    expect(html).toContain("/hadiah?merek=loft25");
    expect(html).toContain('data-pane="krispyporkk"');
    expect(html).toContain('data-pane="soto-oseng"');
    expect(html).toContain("/banners/loft-1.jpg");
    expect(html).toContain("/banners/krispy-1.jpg");
    expect(html).toContain("/banners/soto-1.jpg");
    expect(html).toContain("Misi Krispyporkk");
    expect(html).toContain("Misi Soto Oseng");
    expect(orderLabel("booking", "")).toBe(RESERVASI_LABEL);
    expect(brandArt({ id: "loft25" }).chip).toBe("#f4efe4");
    expect(brandArt({ id: "krispyporkk" }).chip).toBe("#111111");
    expect(brandArt({ id: "soto-oseng" }).mark).toBe("/brands/soto-face.png");
  });

  it("redeem menulis kekurangan stamp dan profil lahir dd/mm/yyyy", () => {
    const html = catalogPage({
      stamps: 3,
      brandName: "Loft25",
      brand: loft,
      brands: [{ id: "loft25", name: "Loft25", on: true }],
      rewards: [
        { id: "a", title: "Filter Coffee", stamps: 3, cost: "3 stamp", note: "", ready: true, icon: "☕", image: "", soldOut: false },
        { id: "b", title: "Upsize", stamps: 6, cost: "6 stamp", note: "", ready: false, icon: "🎁", image: "", soldOut: false },
        { id: "c", title: "Matcha GUMOH", stamps: 10, cost: "10 stamp", note: "", ready: false, icon: "🍵", image: "", soldOut: false },
      ],
      params: new URLSearchParams(),
    });
    expect(html).toContain(">Tukar<");
    expect(html).toContain("Kurang 3 lagi");
    expect(html).toContain("Kurang 7 lagi");
    expect(html).not.toContain("dikit");
    const open = profilePage({ mode: "member", name: "Agus Salim", email: null, params: new URLSearchParams(), wa: "6281812340011" });
    expect(open).toContain("Januari");
    expect(open).toContain("Desember");
    expect(open).toContain('name="lahir_bln"');
    expect(open).not.toContain('type="date"');
    const locked = profilePage({
      mode: "member",
      name: "Rina Pratiwi",
      email: null,
      params: new URLSearchParams(),
      birthday: "1998-11-04",
      wa: "6281234564567",
    });
    expect(locked).toContain("04/11/1998");
    expect(locked).not.toContain('name="lahir_tgl"');
    const parts = new FormData();
    parts.set("lahir_tgl", "4");
    parts.set("lahir_bln", "11");
    parts.set("lahir_thn", "1998");
    parts.set("lahir", "2000-01-01");
    expect(readBirthdayRaw(parts)).toBe("1998-11-04");
    const iso = new FormData();
    iso.set("lahir", "1992-03-02");
    expect(readBirthdayRaw(iso)).toBe("1992-03-02");
    expect(formatBirthdayId("1998-11-04")).toBe("04/11/1998");
  });

  it("css lingkaran logo, input setinggi tombol, dan pill redeem", () => {
    const css = readFileSync(new URL("../public/app.css", import.meta.url), "utf8");
    expect(css).toContain("min-height: 54px");
    expect(css).toContain(".logo-chip.brand-soto-oseng");
    expect(css).toContain("min-height: 40px");
    expect(css).toContain("white-space: nowrap");
    expect(css).toContain(".hero-plain");
  });
});
