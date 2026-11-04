import { bytesToHex, hashPin, randomBytes, randomId } from "../crypto";
import { membersCsv, membersXlsx, type ExportRow } from "../export";
import { clip, httpsUrl, prettyWa } from "../format";
import { orderLabel, orderPlatform } from "../orders";
import { html, readCookie, redirect, sameOrigin } from "../http";
import { errText } from "../messages";
import { normalizeWa, validOutletPin, weakPin } from "../phone";
import { qrSvg } from "../qr";
import * as repo from "../repo";
import { OWNER_SESSION_MS } from "../loyalty";
import { formatPoints, parsePoints, parsePointsOrZero } from "../points";
import * as pdb from "../points-db";
import { expireCodes, reviewMission } from "../points-flow";
import { loginOwner, ownerDeleteMember, ownerSetBirthday, ownerSetPhone, setOutletPinHash } from "../service";
import { clearCookie, COOKIE, loadOwner, setSessionCookie } from "../session";
import { WIB_MS, feedTime, memberSince, parseWibDate, parseWibLocal, startOfWibDay, startOfWibMonth, wibDayIndex } from "../time";
import type { Banner } from "../types";
import {
  activityPage,
  adminLoginPage,
  bannersPage,
  adminCatalogPage,
  adminMissionsPage,
  adminTiersPage,
  dashboardPage,
  deleteMemberPage,
  memberDetailPage,
  membersPage,
  messagePage,
  outletsPage,
  rewardsPage,
  rulesPage,
  stanPage,
} from "../view";
import type { App } from "./customer";

function back(path: string, code: string): Response {
  return redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(code)}`);
}

function ok(path: string, code: string): Response {
  return redirect(`${path}?ok=${encodeURIComponent(code)}`);
}

export async function handleAdmin(app: App): Promise<Response | null> {
  const { request, env, url, now, ip, ctx } = app;
  const db = env.DB;
  const path = url.pathname;
  if (path !== "/admin" && !path.startsWith("/admin/")) return null;

  if (path === "/admin" && request.method === "GET") return html(adminLoginPage(url.searchParams));

  if (path === "/admin/masuk" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const form = await request.formData();
    const result = await loginOwner(db, env, { password: String(form.get("password") || ""), ip, now });
    if (!result.ok) return redirect(`/admin?err=${encodeURIComponent(result.error)}`);
    return redirect("/admin/dasbor", [setSessionCookie(request, COOKIE.owner, result.sessionId, OWNER_SESSION_MS)]);
  }

  const owner = await loadOwner(request, db, now);
  if (!owner && path !== "/admin/keluar") return redirect("/admin");

  if (path === "/admin/keluar" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const sid = readCookie(request.headers.get("cookie"), COOKIE.owner);
    if (sid) await repo.deleteSession(db, sid);
    return redirect("/admin", [clearCookie(request, COOKIE.owner)]);
  }

  if (request.method === "POST" && !sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);

  if (path === "/admin/dasbor" && request.method === "GET") {
    try {
      await repo.housekeeping(db, now);
    } catch {
      /* bersihkan lain kali */
    }
    const brands = await repo.listBrands(db, false);
    const brand = brands.find((b) => b.id === url.searchParams.get("merek")) || null;
    const brandId = brand?.id || null;
    const dayStart = startOfWibDay(now);
    const numbers = await repo.dashNumbers(db, brandId, now, dayStart, startOfWibMonth(now));
    const since = dayStart - 13 * 86_400_000;
    const buckets = await repo.stampsByDay(db, brandId, since, WIB_MS);
    const days = Array.from({ length: 14 }, (_, i) => {
      const start = since + i * 86_400_000;
      return { label: String(new Date(start + WIB_MS).getUTCDate()), n: buckets.get(wibDayIndex(start)) ?? 0 };
    });
    const top = await repo.topMembers(db, brandId);
    const lapsed = await repo.lapsedMembers(db, brandId, now - 30 * 86_400_000);
    const banners = (await repo.listBanners(db, brandId)).filter((b) => repo.bannerLive(b, now));
    const flags = await repo.recentFlags(db, now - 7 * 86_400_000);
    const month = new Date(now + WIB_MS).getUTCMonth() + 1;
    const birthdays = (await repo.birthdaysThisMonth(db, month)).map((m) => ({ name: m.name, birthday: m.birthday || "" }));
    const birthdayRedeems = await repo.countBirthdayRedeems(db, startOfWibMonth(now), brandId);
    await expireCodes(db, now);
    const points = await pdb.pointsTotals(db, startOfWibMonth(now));
    const pendingMissions = await pdb.countPending(db);
    return html(
      dashboardPage({
        brands,
        brand,
        numbers,
        days,
        top,
        lapsed,
        banners,
        flags,
        now,
        birthdays,
        birthdayRedeems,
        pointsIssued: formatPoints(points.issued),
        pointsRedeemed: formatPoints(points.redeemed),
        pendingMissions,
        orderClicks: (await repo.orderClickCounts(db, startOfWibMonth(now), brandId)).map((row) => ({
          brand: brands.find((b) => b.id === row.brand_id)?.short_name || row.brand_id,
          platform: orderLabel(row.platform, row.platform),
          n: row.n,
        })),
      }),
    );
  }

  if ((path === "/admin/member.csv" || path === "/admin/member.xlsx") && request.method === "GET") {
    const listed = await repo.listMemberRows(db, memberQuery(url));
    const exported = listed.map((m) => toExport(m, now));
    if (path.endsWith(".xlsx")) {
      const bytes = membersXlsx(exported);
      return new Response(Uint8Array.from(bytes), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": "attachment; filename=member.xlsx",
          "cache-control": "no-store",
        },
      });
    }
    return new Response(`\uFEFF${membersCsv(exported)}`, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=member.csv", "cache-control": "no-store" },
    });
  }

  if (path === "/admin/member" && request.method === "GET") {
    const members = await repo.listMemberRows(db, memberQuery(url));
    return html(membersPage(members, await repo.listBrands(db, false), url.searchParams));
  }

  if (path.startsWith("/admin/member/") && request.method === "GET" && path.endsWith("/hapus")) {
    const id = decodeURIComponent(path.slice("/admin/member/".length, -"/hapus".length));
    const member = await repo.getMember(db, id);
    if (!member) return back("/admin/member", "belum");
    return html(deleteMemberPage(member));
  }

  if (path.startsWith("/admin/member/") && request.method === "POST" && path.endsWith("/hapus")) {
    const id = decodeURIComponent(path.slice("/admin/member/".length, -"/hapus".length));
    const member = await repo.getMember(db, id);
    if (!member) return back("/admin/member", "belum");
    await ownerDeleteMember(db, { member, now });
    return ok("/admin/member", "member-hapus");
  }

  if (path.startsWith("/admin/member/") && request.method === "POST" && path.endsWith("/telepon")) {
    const id = decodeURIComponent(path.slice("/admin/member/".length, -"/telepon".length));
    const member = await repo.getMember(db, id);
    if (!member) return back("/admin/member", "belum");
    const form = await request.formData();
    const result = await ownerSetPhone(db, { member, waRaw: String(form.get("wa") || ""), now });
    if (!result.ok) return back(`/admin/member/${id}`, result.error);
    return ok(`/admin/member/${id}`, "telepon");
  }

  if (path.startsWith("/admin/member/") && request.method === "POST" && path.endsWith("/lahir")) {
    const id = decodeURIComponent(path.slice("/admin/member/".length, -"/lahir".length));
    const member = await repo.getMember(db, id);
    if (!member) return back("/admin/member", "belum");
    const form = await request.formData();
    const result = await ownerSetBirthday(db, { member, birthdayRaw: String(form.get("lahir") || ""), now });
    if (!result.ok) return back(`/admin/member/${id}`, result.error);
    return ok(`/admin/member/${id}`, "lahirsimpan");
  }

  if (path.startsWith("/admin/member/") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/admin/member/".length));
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return back("/admin/member", "belum");
    const member = await repo.getMember(db, id);
    if (!member) return back("/admin/member", "belum");
    const cards = await repo.memberCards(db, id);
    return html(memberDetailPage({ member, cards, params: url.searchParams }));
  }

  if (path === "/admin/reward" && request.method === "GET") {
    const brands = await repo.listBrands(db, false);
    const brandId = url.searchParams.get("merek") || "";
    const rows = await repo.listActivities(db, { brandId: brandId || undefined, type: "redeem", limit: 80, offset: 0 });
    return html(rewardsPage(rows, brands, brandId));
  }

  if (path === "/admin/banner" && request.method === "GET") {
    return html(bannersPage(await repo.listBanners(db, null), await repo.listBrands(db, false), url.searchParams));
  }

  if (path === "/admin/banner" && request.method === "POST") {
    const len = Number(request.headers.get("content-length") || "0");
    if (len > 2_500_000) return back("/admin/banner", "besar");
    const form = await request.formData();
    const brandId = String(form.get("brand_id") || "");
    const brand = await repo.getBrand(db, brandId);
    if (!brand) return back("/admin/banner", "aturan");
    const title = clip(String(form.get("title") || ""), 80);
    if (!title) return back("/admin/banner", "aturan");
    const file = form.get("gambar");
    let imageUrl = httpsUrl(String(form.get("image_url") || ""));
    let r2Key: string | null = null;
    if (file instanceof File && file.size > 0) {
      const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
      if (file.size > 2_000_000 || !allowed.has(file.type)) return back("/admin/banner", "gambar");
      const id = randomId();
      r2Key = `banners/${id}`;
      await env.BANNERS.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } });
      imageUrl = null;
    }
    const link = httpsUrl(String(form.get("link_url") || ""));
    const banner: Banner = {
      id: randomId(),
      brand_id: brand.id,
      title,
      subtitle: clip(String(form.get("subtitle") || ""), 140),
      image_url: imageUrl,
      r2_key: r2Key,
      link_url: link,
      cta: clip(String(form.get("cta") || ""), 24),
      starts_at: parseWibLocal(String(form.get("starts_at") || "")),
      ends_at: parseWibLocal(String(form.get("ends_at") || "")),
      sort_order: Number(form.get("sort_order") || 0) || 0,
      active: form.get("active") === "on" ? 1 : 0,
      created_at: now,
    };
    await repo.insertBanner(db, banner);
    return ok("/admin/banner", "banner");
  }

  if (path.startsWith("/admin/banner/") && path.endsWith("/hapus") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/banner/".length, -"/hapus".length));
    const banner = await repo.getBanner(db, id);
    if (banner?.r2_key) ctx.waitUntil(env.BANNERS.delete(banner.r2_key));
    await repo.deleteBanner(db, id);
    return ok("/admin/banner", "hapus");
  }

  if (path === "/admin/aturan" && request.method === "GET") {
    return html(rulesPage(await repo.listBrands(db, false), await repo.listOrderLinks(db, null), url.searchParams));
  }

  if (path.startsWith("/admin/aturan/") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/aturan/".length));
    const existing = await repo.getBrand(db, id);
    if (!existing) return back("/admin/aturan", "aturan");
    const form = await request.formData();
    const patch = readBrand(form);
    if (!patch) return back("/admin/aturan", "aturan");
    await repo.saveBrand(db, id, patch);
    const stores = await readStorePair(form);
    if (!stores) return back("/admin/aturan", "aturan");
    await repo.upsertOrderLink(db, { id: randomId(), brandId: id, outletId: null, platform: "gofood", label: "GoFood", url: stores.gofood, sort: 1 });
    await repo.upsertOrderLink(db, { id: randomId(), brandId: id, outletId: null, platform: "grabfood", label: "GrabFood", url: stores.grabfood, sort: 2 });
    const extraRaw = String(form.get("extra_url") || "").trim();
    if (extraRaw) {
      const extraUrl = httpsUrl(extraRaw);
      const platform = orderPlatform(String(form.get("extra_platform") || ""));
      if (!extraUrl || !platform || platform === "gofood" || platform === "grabfood") return back("/admin/aturan", "aturan");
      await repo.insertOrderLink(db, {
        id: randomId(),
        brandId: id,
        outletId: null,
        platform,
        label: orderLabel(platform, clip(String(form.get("extra_label") || ""), 24)),
        url: extraUrl,
        sort: 5,
      });
    }
    return ok("/admin/aturan", "simpan");
  }

  if (path === "/admin/outlet" && request.method === "GET") {
    const outlets = await repo.listOutlets(db);
    const brands = await repo.listBrands(db, false);
    const view = outlets.map((o) => ({ ...o, brand_name: brands.find((b) => b.id === o.brand_id)?.name || o.brand_id }));
    return html(outletsPage(view, brands, await repo.listOrderLinks(db, null), url.searchParams));
  }

  if (path === "/admin/outlet" && request.method === "POST") {
    const form = await request.formData();
    const brand = await repo.getBrand(db, String(form.get("brand_id") || ""));
    const name = clip(String(form.get("name") || ""), 60);
    if (!brand || !name) return back("/admin/outlet", "aturan");
    const pin = String(form.get("pin") || "");
    const made = await hashNewPin(env, pin);
    if (!made.ok) return back("/admin/outlet", made.error);
    await repo.insertOutlet(db, { id: randomId(), brandId: brand.id, name, pinHash: made.hash, pinSalt: made.salt, now });
    return ok("/admin/outlet", "outlet");
  }

  if (path.startsWith("/admin/outlet/") && path.endsWith("/pesan") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/outlet/".length, -"/pesan".length));
    const outlet = await repo.getOutlet(db, id);
    if (!outlet) return back("/admin/outlet", "aturan");
    const form = await request.formData();
    const stores = await readStorePair(form);
    if (!stores) return back("/admin/outlet", "aturan");
    await repo.upsertOrderLink(db, { id: randomId(), brandId: outlet.brand_id, outletId: outlet.id, platform: "gofood", label: "GoFood", url: stores.gofood, sort: 1 });
    await repo.upsertOrderLink(db, { id: randomId(), brandId: outlet.brand_id, outletId: outlet.id, platform: "grabfood", label: "GrabFood", url: stores.grabfood, sort: 2 });
    const waRaw = String(form.get("wa") || "").trim();
    const wa = waRaw ? normalizeWa(waRaw) : "";
    if (waRaw && !wa) return back("/admin/outlet", "wa");
    await repo.setOutletWa(db, outlet.id, wa || "");
    return ok("/admin/outlet", "simpan");
  }

  if (path.startsWith("/admin/pesan/") && path.endsWith("/hapus") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/pesan/".length, -"/hapus".length));
    await repo.deleteOrderLink(db, id);
    return ok("/admin/aturan", "hapus");
  }

  if (path.startsWith("/admin/outlet/") && path.endsWith("/pin") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/outlet/".length, -"/pin".length));
    const form = await request.formData();
    const result = await setOutletPinHash(db, env, id, String(form.get("pin") || ""));
    if (!result.ok) return back("/admin/outlet", result.error);
    return ok("/admin/outlet", "pin");
  }

  if (path.startsWith("/admin/outlet/") && path.endsWith("/aktif") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/outlet/".length, -"/aktif".length));
    const form = await request.formData();
    await repo.setOutletActive(db, id, String(form.get("active") || "") === "1" ? 1 : 0);
    return ok("/admin/outlet", "simpan");
  }

  if (path === "/admin/aktivitas" && request.method === "GET") {
    const filter = activityFilter(url);
    const rows = await repo.listActivities(db, { ...filter, limit: 100, offset: 0 });
    return html(
      activityPage({
        rows,
        brands: await repo.listBrands(db, false),
        outlets: await repo.listOutlets(db),
        query: url.searchParams.toString(),
        params: url.searchParams,
      }),
    );
  }

  if (path === "/admin/aktivitas.csv" && request.method === "GET") {
    const rows = await repo.listActivities(db, { ...activityFilter(url), limit: 5000, offset: 0 });
    const header = ["waktu", "member", "wa", "merek", "outlet", "jenis", "delta", "sisa", "catatan", "sesi", "batal"];
    const lines = [header.join(",")];
    for (const row of rows) {
      lines.push(
        [
          feedTime(row.created_at, now),
          row.member_name,
          prettyWa(row.wa),
          row.short_name,
          row.outlet_name || "",
          row.type,
          String(row.stamps_delta),
          String(row.stamps_after),
          row.note,
          row.session_id || "",
          row.voided ? "ya" : "tidak",
        ]
          .map(csv)
          .join(","),
      );
    }
    return new Response(lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=aktivitas.csv",
        "cache-control": "no-store",
      },
    });
  }

  if (path.startsWith("/admin/bukti/") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/admin/bukti/".length));
    const submission = await pdb.getSubmission(db, id);
    if (!submission?.r2_key?.startsWith("missions/")) return new Response("Tidak ketemu", { status: 404 });
    const object = await env.BANNERS.get(submission.r2_key);
    if (!object) return new Response("Tidak ketemu", { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType || "image/jpeg",
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  }

  if (path === "/admin/misi" && request.method === "GET") {
    const missions = await pdb.listMissions(db, false);
    const queue = await pdb.listPending(db);
    const brands = await repo.listBrands(db, false);
    return html(
      adminMissionsPage({
        missions: missions.map((m) => ({
          id: m.id,
          title: m.title,
          points: formatPoints(m.points_tenths),
          limit: m.limit_kind === "week" ? "seminggu" : "sekali",
          active: m.active === 1,
          brand: brands.find((b) => b.id === m.brand_id)?.short_name || "Semua",
          icon: m.icon || "🍃",
          tag: m.tag || "",
          mystery: m.mystery === 1,
          unlock: formatPoints(m.unlock_points_tenths || 0),
          sort: m.sort_order || 0,
        })),
        queue: queue.map((q) => ({
          id: q.id,
          title: q.title || "",
          member: q.member_name || "",
          when: feedTime(q.created_at, now),
          link: q.link_url || "",
          image: q.r2_key ? `/admin/bukti/${q.id}` : "",
        })),
        brands: brands.map((b) => ({ id: b.id, name: b.short_name })),
        levels: (await pdb.listLevels(db)).map((level) => ({
          name: level.name,
          min: formatPoints(level.min_points_tenths),
          icon: level.icon || "🌱",
          brand: brands.find((b) => b.id === level.brand_id)?.short_name || "Semua merek",
        })),
        params: url.searchParams,
      }),
    );
  }

  if (path === "/admin/misi" && request.method === "POST") {
    const form = await request.formData();
    const points = parsePoints(String(form.get("points") || ""));
    const title = clip(String(form.get("title") || ""), 80);
    const shot = form.get("shot") === "on";
    const link = form.get("link") === "on";
    if (!title || points == null || (!shot && !link)) return back("/admin/misi", "aturan");
    const brandId = String(form.get("brand_id") || "") || null;
    if (brandId && !(await repo.getBrand(db, brandId))) return back("/admin/misi", "aturan");
    const tagRaw = String(form.get("tag") || "");
    const tag = tagRaw === "new" || tagRaw === "limited" ? tagRaw : "";
    const unlock = parsePointsOrZero(String(form.get("unlock") || "0"));
    const sort = Number(form.get("sort") || 0);
    if (unlock == null || !Number.isInteger(sort) || sort < 0 || sort > 999) return back("/admin/misi", "aturan");
    await pdb.insertMission(db, {
      id: randomId(),
      brand_id: brandId,
      title,
      description: clip(String(form.get("description") || ""), 240),
      points_tenths: points,
      proof_screenshot: shot ? 1 : 0,
      proof_link: link ? 1 : 0,
      limit_kind: String(form.get("limit_kind") || "") === "week" ? "week" : "once",
      active: 1,
      created_at: now,
      icon: markIcon(String(form.get("icon") || ""), "🍃"),
      tag,
      mystery: form.get("mystery") === "on" ? 1 : 0,
      tease: clip(String(form.get("tease") || ""), 140),
      unlock_points_tenths: unlock,
      sort_order: sort,
    });
    return ok("/admin/misi", "simpan");
  }

  if (path === "/admin/misi/level" && request.method === "POST") {
    const form = await request.formData();
    const name = clip(String(form.get("name") || ""), 40);
    const min = parsePointsOrZero(String(form.get("points") || ""));
    const brandId = String(form.get("brand_id") || "") || null;
    if (!name || min == null) return back("/admin/misi", "aturan");
    if (brandId && !(await repo.getBrand(db, brandId))) return back("/admin/misi", "aturan");
    await pdb.insertLevel(db, {
      id: randomId(),
      brand_id: brandId,
      name,
      min_points_tenths: min,
      icon: markIcon(String(form.get("icon") || ""), "🌱"),
      sort_order: min,
    });
    return ok("/admin/misi", "simpan");
  }

  if (path.startsWith("/admin/misi/") && request.method === "POST") {
    const rest = path.slice("/admin/misi/".length);
    const approve = rest.endsWith("/setuju");
    const reject = rest.endsWith("/tolak");
    if (!approve && !reject) return back("/admin/misi", "umum");
    const id = decodeURIComponent(rest.slice(0, rest.lastIndexOf("/")));
    const result = await reviewMission(db, { id, approve, now });
    if (!result.ok) return back("/admin/misi", result.error);
    return ok("/admin/misi", approve ? "setuju" : "tolak");
  }

  if (path === "/admin/katalog" && request.method === "GET") {
    const rewards = await pdb.listRewards(db, null, false);
    const brands = await repo.listBrands(db, false);
    return html(
      adminCatalogPage({
        rewards: rewards.map((r) => ({
          id: r.id,
          brand: brands.find((b) => b.id === r.brand_id)?.short_name || r.brand_id,
          title: r.title,
          cost: formatPoints(r.points_tenths),
          stock: r.stock == null ? "bebas" : String(r.stock),
          active: r.active === 1,
          icon: r.icon || "🍵",
        })),
        brands: brands.map((b) => ({ id: b.id, name: b.short_name })),
        params: url.searchParams,
      }),
    );
  }

  if (path === "/admin/katalog" && request.method === "POST") {
    const form = await request.formData();
    const points = parsePoints(String(form.get("points") || ""));
    const title = clip(String(form.get("title") || ""), 60);
    const brand = await repo.getBrand(db, String(form.get("brand_id") || ""));
    if (!brand || !title || points == null) return back("/admin/katalog", "aturan");
    const stockRaw = String(form.get("stock") || "").trim();
    const stock = stockRaw === "" ? null : Number(stockRaw);
    if (stock != null && (!Number.isInteger(stock) || stock < 0)) return back("/admin/katalog", "aturan");
    await pdb.insertReward(db, {
      id: randomId(),
      brand_id: brand.id,
      title,
      points_tenths: points,
      stock,
      image_url: null,
      r2_key: null,
      active: form.get("active") === "on" ? 1 : 0,
      created_at: now,
      icon: markIcon(String(form.get("icon") || ""), "🍵"),
    });
    return ok("/admin/katalog", "simpan");
  }

  if (path === "/admin/tingkat" && request.method === "GET") {
    const tiers = await pdb.listAllTiers(db);
    const brands = await repo.listBrands(db, false);
    return html(
      adminTiersPage({
        tiers: tiers.map((t) => ({ brand: brands.find((b) => b.id === t.brand_id)?.short_name || t.brand_id, stamps: t.stamps, reward: t.reward_text })),
        brands: brands.map((b) => ({ id: b.id, name: b.short_name })),
        params: url.searchParams,
      }),
    );
  }

  if (path === "/admin/tingkat" && request.method === "POST") {
    const form = await request.formData();
    const brand = await repo.getBrand(db, String(form.get("brand_id") || ""));
    const stamps = Number(form.get("stamps") || 0);
    const reward = clip(String(form.get("reward_text") || ""), 80);
    if (!brand || !reward || !Number.isInteger(stamps) || stamps < 1 || stamps > 50) return back("/admin/tingkat", "aturan");
    await pdb.insertTier(db, { id: randomId(), brand_id: brand.id, stamps, reward_text: reward, sort_order: stamps, active: 1 });
    return ok("/admin/tingkat", "simpan");
  }

  if (path === "/admin/stan" && request.method === "GET") {
    const brands = await repo.listBrands(db, true);
    const svgs: Record<string, string> = {};
    for (const brand of brands) svgs[brand.id] = qrSvg(`${url.origin}/gabung/${brand.id}`);
    return html(stanPage(brands, url.origin, svgs));
  }

  return html(messagePage("Tidak ketemu", "Halaman itu tidak ada.", "/admin/dasbor"), 404);
}

async function hashNewPin(env: Env, pin: string): Promise<{ ok: true; hash: string; salt: string } | { ok: false; error: string }> {
  if (!env.PIN_PEPPER || env.PIN_PEPPER.length < 16) return { ok: false, error: "secret" };
  if (!validOutletPin(pin) || weakPin(pin)) return { ok: false, error: "pinweak" };
  const saltBytes = randomBytes(16);
  const salt = bytesToHex(saltBytes);
  const hash = await hashPin(pin, saltBytes, env.PIN_PEPPER);
  return { ok: true, hash, salt };
}

function markIcon(raw: string, fallback: string): string {
  const text = clip(raw, 8);
  if (!text || /[<>&]/.test(text)) return fallback;
  return text;
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function activityFilter(url: URL) {
  const jenis = url.searchParams.get("jenis") || "";
  const allowed = new Set(["stamp", "redeem", "birthday", "cancel", "join"]);
  const dari = parseWibDate(url.searchParams.get("dari") || "");
  const sampaiHari = parseWibDate(url.searchParams.get("sampai") || "");
  return {
    brandId: url.searchParams.get("merek") || undefined,
    outletId: url.searchParams.get("outlet") || undefined,
    type: allowed.has(jenis) ? jenis : undefined,
    q: url.searchParams.get("q") || undefined,
    from: dari || undefined,
    to: sampaiHari ? sampaiHari + 86_400_000 - 1 : undefined,
  };
}

function readStorePair(form: FormData): { gofood: string; grabfood: string } | null {
  const goRaw = String(form.get("gofood") || "").trim();
  const grabRaw = String(form.get("grabfood") || "").trim();
  const gofood = goRaw ? httpsUrl(goRaw) : "";
  const grabfood = grabRaw ? httpsUrl(grabRaw) : "";
  if (goRaw && !gofood) return null;
  if (grabRaw && !grabfood) return null;
  return { gofood: gofood || "", grabfood: grabfood || "" };
}

function readBrand(form: FormData) {
  const name = clip(String(form.get("name") || ""), 60);
  const short_name = clip(String(form.get("short_name") || ""), 24);
  const handle = clip(String(form.get("handle") || ""), 40);
  const emoji = clip(String(form.get("emoji") || "🍵"), 8) || "🍵";
  const accent = String(form.get("accent") || "");
  const accent_soft = String(form.get("accent_soft") || "");
  const stamps_required = Number(form.get("stamps_required"));
  const max_stamps_per_day = Number(form.get("max_stamps_per_day"));
  const reward_text = clip(String(form.get("reward_text") || ""), 80);
  const condition_label = clip(String(form.get("condition_label") || ""), 80);
  const reward_note = clip(String(form.get("reward_note") || ""), 280);
  const minRaw = String(form.get("min_amount") || "").trim();
  const min_amount = minRaw === "" ? null : Number(minRaw);
  if (!name || !short_name || !handle || !reward_text || !condition_label) return null;
  if (!/^#[0-9a-fA-F]{6}$/.test(accent) || !/^#[0-9a-fA-F]{6}$/.test(accent_soft)) return null;
  if (!Number.isInteger(stamps_required) || stamps_required < 1 || stamps_required > 30) return null;
  if (!Number.isInteger(max_stamps_per_day) || max_stamps_per_day < 1 || max_stamps_per_day > 10) return null;
  if (min_amount != null && (!Number.isFinite(min_amount) || min_amount < 0 || min_amount > 10_000_000)) return null;
  const birthday_window = String(form.get("birthday_window") || "") === "around" ? "around" : "month";
  const birthday_days = Number(form.get("birthday_days") || 7);
  if (!Number.isInteger(birthday_days) || birthday_days < 0 || birthday_days > 30) return null;
  return {
    name,
    short_name,
    handle,
    emoji,
    accent,
    accent_soft,
    stamps_required,
    reward_text,
    condition_label,
    min_amount,
    max_stamps_per_day,
    reward_note,
    active: form.get("active") === "on" ? 1 : 0,
    birthday_reward: clip(String(form.get("birthday_reward") || ""), 80),
    birthday_active: form.get("birthday_active") === "on" ? 1 : 0,
    birthday_window,
    birthday_days,
  };
}

function memberQuery(url: URL) {
  const sort = url.searchParams.get("urut") || "kunjungan";
  return { q: (url.searchParams.get("q") || "").trim(), brandId: url.searchParams.get("merek") || "", sort };
}

function toExport(m: { name: string; wa: string; email: string | null; birthday: string | null; created_at: number; join_method: string; stamps_label: string; rewards: number; last_seen_at: number }, now: number): ExportRow {
  return {
    name: m.name,
    wa: prettyWa(m.wa),
    email: m.email || "",
    birthday: m.birthday || "",
    joined: memberSince(m.created_at),
    method: m.join_method,
    stamps: m.stamps_label,
    rewards: String(m.rewards),
    lastVisit: feedTime(m.last_seen_at, now),
  };
}
