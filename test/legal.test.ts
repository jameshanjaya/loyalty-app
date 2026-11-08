import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { googleAuthUrl } from "../src/google";
import type { Brand } from "../src/types";
import { homePage, joinPage, loginPage, privacyPage, profilePage, termsPage } from "../src/view";

function brand(): Brand {
  return {
    id: "loft25",
    name: "Loft25",
    short_name: "Loft25",
    handle: "@loft25",
    emoji: "🍵",
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
  };
}

function pageText(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

describe("halaman privasi dan syarat", () => {
  it("menjelaskan data yang benar-benar dikumpulkan", () => {
    const privacy = privacyPage();
    const terms = termsPage();
    for (const html of [privacy, terms]) {
      expect(html).toContain('lang="id"');
      expect(html).toContain("8 November 2026");
      expect(html).toContain("mandalapangan.id@gmail.com");
      expect(html).toContain("Loyalty Club");
      expect(html).toContain("Loft25");
      expect(html).toContain("Krispyporkk");
      expect(html).toContain("Soto Oseng");
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('href="/terms"');
      expect(html).not.toContain("PT ");
      expect(html).not.toContain("ISO");
      expect(html).not.toMatch(/gmail\.(readonly|modify|compose)/i);
      expect(html).not.toContain("auth/gmail");
    }
    expect(privacy).toContain("openid, email, dan profile");
    expect(privacy).toContain("tidak membuka kotak masuk");
    expect(privacy).toContain("Cloudflare Workers");
    expect(privacy).toContain("D1");
    expect(privacy).toContain("R2");
    expect(privacy).toContain("Workers AI");
    expect(privacy).toContain("Tidak ada tombol hapus akun");
    expect(privacy).toContain("tidak menjanjikan penghapusan otomatis");
    expect(privacy).toContain("Bentuk badan hukum yang terdaftar dan alamat kantor tidak tertulis");
    expect(terms).toContain("tidak menambah harga");
    expect(terms).toContain("Stamp bukan uang");
    expect(pageText(terms)).not.toMatch(/wajib bayar|denda Rp|biaya langganan/i);
  });

  it("tautan ada di beranda, masuk, gabung, dan profil", () => {
    const pages = [
      homePage([brand()]),
      loginPage({ next: "/kartu", params: new URLSearchParams() }),
      joinPage({ brands: [brand()], brand: brand(), next: "/kartu", params: new URLSearchParams() }),
      profilePage({ mode: "member", name: "Agus Salim", email: null, params: new URLSearchParams(), wa: "628111" }),
      profilePage({ mode: "google", name: "Agus", email: "agus@example.com", params: new URLSearchParams() }),
    ];
    for (const html of pages) {
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('href="/terms"');
    }
  });

  it("route publik tidak meminta login", async () => {
    const ctx = { waitUntil() {}, passThroughOnException() {} } as ExecutionContext;
    for (const path of ["/privacy", "/terms"]) {
      const res = await worker.fetch(new Request(`https://loyalty-bos.mandalapangan-id.workers.dev${path}`), {} as Env, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie")).toBeNull();
      const html = await res.text();
      expect(html).toContain("8 November 2026");
      expect(html).not.toContain("/masuk");
    }
    const denied = await worker.fetch(new Request("https://loyalty-bos.mandalapangan-id.workers.dev/privacy", { method: "POST" }), {} as Env, ctx);
    expect(denied.status).toBe(405);
    expect(denied.headers.get("location")).toBeNull();
  });

  it("izin Google tetap openid email profile tanpa saringan domain", () => {
    const url = new URL(
      googleAuthUrl({
        clientId: "client-demo.apps.googleusercontent.com",
        redirectUri: "https://loyalty-bos.mandalapangan-id.workers.dev/auth/google/callback",
        state: "state1",
        nonce: "nonce1",
      }),
    );
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.has("hd")).toBe(false);
    expect(url.searchParams.get("redirect_uri")).toBe("https://loyalty-bos.mandalapangan-id.workers.dev/auth/google/callback");
  });
});
