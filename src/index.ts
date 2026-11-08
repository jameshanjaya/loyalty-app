import { clientIp, html, json, tinyError } from "./http";
import { privacyPage, termsPage } from "./view";
import { cookieAlreadySet } from "./loyalty";
import { logEvent } from "./log";
import { COOKIE, renewMemberCookie } from "./session";
import { handleAdmin } from "./routes/admin";
import { handleCashier } from "./routes/cashier";
import { handleCustomer, type App } from "./routes/customer";
import { handleGoogle } from "./routes/google";
import { handleShop } from "./routes/shop";
import { handleWa } from "./routes/wa";
import { sweepExpiry } from "./points-flow";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      const now = Date.now();
      let response: Response;
      if (url.pathname === "/health") response = json({ ok: true });
      else if (url.pathname === "/privacy" || url.pathname === "/terms") {
        if (request.method !== "GET") response = html(tinyError("Halaman ini cuma bisa dibuka."), 405);
        else response = html(url.pathname === "/privacy" ? privacyPage() : termsPage());
      } else if (url.pathname === "/app.webmanifest") response = await appManifest(env, url);
      else {
        const media = await serveMedia(env, url);
        if (media) response = media;
        else {
          const app: App = { request, env, url, now, ip: clientIp(request), ctx };
          response =
            (await handleWa(app)) ||
            (await handleGoogle(app)) ||
            (await handleShop(app)) ||
            (await handleCustomer(app)) ||
            (await handleCashier(app)) ||
            (await handleAdmin(app)) ||
            html(tinyError("Halaman tidak ketemu."), 404);
        }
      }
      return attachMemberRenewal(request, env.DB, now, response);
    } catch (error) {
      logEvent("unhandled", { message: error instanceof Error ? error.message : "error" });
      return html(tinyError("Ada yang macet. Coba lagi sebentar."), 500);
    }
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    void controller.scheduledTime;
    ctx.waitUntil(sweepExpiry(env.DB, Date.now()));
  },
};

async function attachMemberRenewal(request: Request, db: D1Database, now: number, response: Response): Promise<Response> {
  const existing = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (cookieAlreadySet(existing, COOKIE.member)) return response;
  const cookie = await renewMemberCookie(request, db, now);
  if (!cookie) return response;
  const headers = new Headers(response.headers);
  headers.append("set-cookie", cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function imageResponse(object: R2ObjectBody, url: URL): Response {
  const type = object.httpMetadata?.contentType || "application/octet-stream";
  if (!type.startsWith("image/") || type === "image/svg+xml") return new Response("Tidak ketemu", { status: 404 });
  const versioned = url.searchParams.has("v");
  return new Response(object.body, {
    headers: {
      "content-type": type,
      "cache-control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}

async function serveMedia(env: Env, url: URL): Promise<Response | null> {
  const brandMedia = url.pathname.match(/^\/media\/(logo|ikon|stamp)\/([A-Za-z0-9_-]{1,40})$/);
  if (brandMedia) {
    const kind = brandMedia[1] === "logo" ? "logo_key" : brandMedia[1] === "ikon" ? "icon_key" : "stamp_key";
    const row = await env.DB.prepare(`SELECT ${kind} AS key FROM brands WHERE id = ?`).bind(brandMedia[2]).first<{ key: string | null }>();
    if (!row?.key) return new Response("Tidak ketemu", { status: 404 });
    const object = await env.BANNERS.get(row.key);
    return object ? imageResponse(object, url) : new Response("Tidak ketemu", { status: 404 });
  }
  const guide = url.pathname.match(/^\/media\/panduan\/([A-Za-z0-9_-]{8,80})$/);
  if (guide) {
    const row = await env.DB.prepare(`SELECT r2_key FROM mission_photos WHERE id = ?`).bind(guide[1]).first<{ r2_key: string | null }>();
    if (!row?.r2_key) return new Response("Tidak ketemu", { status: 404 });
    const object = await env.BANNERS.get(row.r2_key);
    return object ? imageResponse(object, url) : new Response("Tidak ketemu", { status: 404 });
  }
  const news = url.pathname.match(/^\/media\/news\/([A-Za-z0-9_-]{8,80})$/);
  if (news) {
    const row = await env.DB.prepare(`SELECT r2_key FROM news_cards WHERE id = ?`).bind(news[1]).first<{ r2_key: string | null }>();
    if (!row?.r2_key) return new Response("Tidak ketemu", { status: 404 });
    const object = await env.BANNERS.get(row.r2_key);
    return object ? imageResponse(object, url) : new Response("Tidak ketemu", { status: 404 });
  }
  const redeem = url.pathname.match(/^\/media\/redeem\/([A-Za-z0-9_-]{8,80})$/);
  if (redeem) {
    const row = await env.DB.prepare(`SELECT r2_key FROM stamp_tiers WHERE id = ?`).bind(redeem[1]).first<{ r2_key: string | null }>();
    if (!row?.r2_key) return new Response("Tidak ketemu", { status: 404 });
    const object = await env.BANNERS.get(row.r2_key);
    return object ? imageResponse(object, url) : new Response("Tidak ketemu", { status: 404 });
  }
  if (!url.pathname.startsWith("/media/banners/")) return null;
  const id = url.pathname.slice("/media/banners/".length);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return new Response("Tidak ketemu", { status: 404 });
  const object = await env.BANNERS.get(`banners/${id}`);
  if (!object) return new Response("Tidak ketemu", { status: 404 });
  return imageResponse(object, url);
}

async function appManifest(env: Env, url: URL): Promise<Response> {
  const rows = await env.DB.prepare(`SELECT id, short_name, accent, page_bg, icon_key FROM brands WHERE active = 1 ORDER BY name`).all<{
    id: string;
    short_name: string;
    accent: string;
    page_bg: string | null;
    icon_key: string | null;
  }>();
  const asked = url.searchParams.get("merek") || "";
  const brand = (rows.results || []).find((row) => row.id === asked) || (rows.results || []).find((row) => row.icon_key) || rows.results?.[0];
  const fallback192 = `${url.origin}/icons/icon-192.png?v=2`;
  const fallback512 = `${url.origin}/icons/icon-512.png?v=2`;
  const icon = brand?.icon_key ? `${url.origin}/media/ikon/${brand.id}` : fallback192;
  const icons = brand?.icon_key
    ? [
        { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: fallback512, sizes: "512x512", type: "image/png", purpose: "any" },
      ]
    : [
        { src: fallback192, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: fallback512, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: fallback192, sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: fallback512, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];
  const body = {
    name: brand ? `Loyalty ${brand.short_name}` : "Loyalty Bos",
    short_name: brand?.short_name || "Loyalty",
    start_url: brand ? `/kartu?merek=${encodeURIComponent(brand.id)}` : "/kartu",
    scope: "/",
    display: "standalone",
    background_color: brand?.page_bg || "#f4efe4",
    theme_color: brand?.accent || "#143d28",
    lang: "id",
    icons,
  };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=300" },
  });
}
