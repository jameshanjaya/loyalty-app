import { html, isPrefetch, readCookie, redirect, sameOrigin } from "../http";
import { errText } from "../messages";
import { safeNext } from "../format";
import * as repo from "../repo";
import { MEMBER_SESSION_MS } from "../loyalty";
import { finishClaim, joinMember, loginMember } from "../service";
import { clearCookie, COOKIE, loadMember, setSessionCookie } from "../session";
import { readClaim } from "../tokens";
import {
  cardPage,
  claimHoldPage,
  emptyDbPage,
  homePage,
  joinPage,
  loginPage,
  messagePage,
  successPage,
} from "../view";

export type App = {
  request: Request;
  env: Env;
  url: URL;
  now: number;
  ip: string;
  ctx: ExecutionContext;
};

function errQuery(code: string): URLSearchParams {
  return new URLSearchParams({ err: code });
}

export async function handleCustomer(app: App): Promise<Response | null> {
  const { request, env, url, now, ip } = app;
  const db = env.DB;
  const path = url.pathname;
  const mine =
    path === "/" ||
    path === "/gabung" ||
    path.startsWith("/gabung/") ||
    path === "/masuk" ||
    path === "/keluar" ||
    path === "/kartu" ||
    path.startsWith("/k/") ||
    path.startsWith("/berhasil/");
  if (!mine) return null;
  const member = await loadMember(request, db, now);

  if (path === "/" && request.method === "GET") {
    if (member) return redirect("/kartu");
    const brands = await repo.listBrands(db, true);
    if (!brands.length) return html(emptyDbPage());
    return html(homePage(brands));
  }

  if ((path === "/gabung" || path.startsWith("/gabung/")) && request.method === "GET") {
    if (member) {
      const brand = path.startsWith("/gabung/") ? path.slice("/gabung/".length) : url.searchParams.get("merek");
      return redirect(brand ? `/kartu?merek=${encodeURIComponent(brand)}` : "/kartu");
    }
    const brands = await repo.listBrands(db, true);
    if (!brands.length) return html(emptyDbPage());
    const slug = path.startsWith("/gabung/") ? decodeURIComponent(path.slice("/gabung/".length)) : url.searchParams.get("merek") || "";
    const brand = brands.find((b) => b.id === slug) || null;
    const next = safeNext(url.searchParams.get("next"), brand ? `/kartu?merek=${brand.id}` : "/kartu");
    return html(joinPage({ brands, brand, next, params: url.searchParams }));
  }

  if (path === "/gabung" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const form = await request.formData();
    const nama = String(form.get("nama") || "");
    const wa = String(form.get("wa") || "");
    const next = safeNext(String(form.get("next") || ""), "/kartu");
    const merek = String(form.get("merek") || "") || null;
    const result = await joinMember(db, env, {
      name: nama,
      waRaw: wa,
      pin: String(form.get("pin") || ""),
      pin2: String(form.get("pin2") || ""),
      brandId: merek,
      ip,
      now,
    });
    if (!result.ok) {
      const brands = await repo.listBrands(db, true);
      const brand = brands.find((b) => b.id === merek) || null;
      return html(joinPage({ brands, brand, next, params: errQuery(result.error), values: { nama, wa } }), 400);
    }
    const dest = merek ? `/kartu?merek=${encodeURIComponent(merek)}` : next;
    return redirect(safeNext(dest, "/kartu"), [setSessionCookie(request, COOKIE.member, result.sessionId, MEMBER_SESSION_MS)]);
  }

  if (path === "/masuk" && request.method === "GET") {
    if (member) return redirect(safeNext(url.searchParams.get("next"), "/kartu"));
    return html(loginPage({ next: safeNext(url.searchParams.get("next"), "/kartu"), params: url.searchParams }));
  }

  if (path === "/masuk" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const form = await request.formData();
    const next = safeNext(String(form.get("next") || ""), "/kartu");
    const result = await loginMember(db, env, { waRaw: String(form.get("wa") || ""), pin: String(form.get("pin") || ""), ip, now });
    if (!result.ok) return html(loginPage({ next, params: errQuery(result.error) }), 400);
    return redirect(next, [setSessionCookie(request, COOKIE.member, result.sessionId, MEMBER_SESSION_MS)]);
  }

  if (path === "/keluar" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const sid = readCookie(request.headers.get("cookie"), COOKIE.member);
    if (sid) await repo.deleteSession(db, sid);
    return redirect("/", [clearCookie(request, COOKIE.member)]);
  }

  if (path === "/kartu" && request.method === "GET") {
    if (!member) return redirect("/masuk");
    const brands = await repo.listBrands(db, true);
    if (!brands.length) return html(emptyDbPage());
    const wanted = url.searchParams.get("merek");
    const brand = brands.find((b) => b.id === wanted) || brands[0];
    if (!brand) return html(emptyDbPage());
    for (const item of brands) await repo.ensureCard(db, member.id, item.id, now);
    const cards = new Map((await repo.listCards(db, member.id)).map((c) => [c.brand_id, c]));
    const banners = await repo.listBanners(db, brand.id);
    const history = await repo.memberHistory(db, member.id, brand.id);
    return html(cardPage({ member, brands, cards, brand, banners, history, now, params: url.searchParams }));
  }

  if (path.startsWith("/k/") && request.method === "GET") {
    const token = decodeURIComponent(path.slice(3));
    const next = path;
    if (isPrefetch(request)) return html(claimHoldPage({ brand: null, next, error: "Buka halaman ini langsung di HP." }));
    const read = env.TOKEN_SECRET ? await readClaim(token, env.TOKEN_SECRET, now) : { ok: false as const, reason: "malformed" as const };
    const brand = read.ok ? await repo.getBrand(db, read.payload.brandId) : null;
    if (!member) {
      if (!read.ok) return html(claimHoldPage({ brand, next, error: errText(read.reason === "expired" ? "expired" : "claim") || "" }), 400);
      return html(claimHoldPage({ brand, next }));
    }
    const done = await finishClaim(db, env, { token, member, ip, now });
    if (!done.ok) return html(claimHoldPage({ brand, next, error: errText(done.error) || "Gagal" }), 400);
    return redirect(`/berhasil/${done.activityId}`);
  }

  if (path.startsWith("/berhasil/") && request.method === "GET") {
    if (!member) return redirect("/masuk");
    const activity = await repo.getActivity(db, decodeURIComponent(path.slice("/berhasil/".length)));
    if (!activity || activity.member_id !== member.id || (activity.type !== "stamp" && activity.type !== "redeem")) {
      return redirect("/kartu");
    }
    const brand = await repo.getBrand(db, activity.brand_id);
    if (!brand) return redirect("/kartu");
    const card = await repo.ensureCard(db, member.id, brand.id, now);
    const banners = await repo.listBanners(db, brand.id);
    const brands = await repo.listBrands(db, true);
    return html(
      successPage({
        member,
        brand,
        outletName: activity.outlet_name || brand.short_name,
        stamps: card.stamps,
        when: activity.created_at,
        banners,
        otherBrands: brands.filter((b) => b.id !== brand.id).map((b) => b.short_name),
        kind: activity.type,
        now,
      }),
    );
  }

  return null;
}
