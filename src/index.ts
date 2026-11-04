import { clientIp, html, json, tinyError } from "./http";
import { logEvent } from "./log";
import { handleAdmin } from "./routes/admin";
import { handleCashier } from "./routes/cashier";
import { handleCustomer, type App } from "./routes/customer";
import { handleGoogle } from "./routes/google";
import { handleShop } from "./routes/shop";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") return json({ ok: true });
      const media = await serveBanner(env, url);
      if (media) return media;
      const app: App = { request, env, url, now: Date.now(), ip: clientIp(request), ctx };
      return (
        (await handleGoogle(app)) ||
        (await handleShop(app)) ||
        (await handleCustomer(app)) ||
        (await handleCashier(app)) ||
        (await handleAdmin(app)) ||
        html(tinyError("Halaman tidak ketemu."), 404)
      );
    } catch (error) {
      logEvent("unhandled", { message: error instanceof Error ? error.message : "error" });
      return html(tinyError("Ada yang macet. Coba lagi sebentar."), 500);
    }
  },
};

async function serveBanner(env: Env, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/media/banners/")) return null;
  const id = url.pathname.slice("/media/banners/".length);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return new Response("Tidak ketemu", { status: 404 });
  const object = await env.BANNERS.get(`banners/${id}`);
  if (!object) return new Response("Tidak ketemu", { status: 404 });
  const type = object.httpMetadata?.contentType || "application/octet-stream";
  if (!type.startsWith("image/") || type === "image/svg+xml") return new Response("Tidak ketemu", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
