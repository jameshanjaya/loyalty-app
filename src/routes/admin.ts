import { RESERVED_KASIR, slugifyOutlet } from "../brand-visual";
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
import { brandOpen } from "../brands";
import { formatPoints, parsePointsOrZero, proofKind } from "../points";
import { formatAward, missionQuarters, questQuarters } from "../quest-stamp";
import * as pdb from "../points-db";
import { expireCodes, expireDays, expiryNotes, memberPointState, reviewMission, revokeMission } from "../points-flow";
import { shortDate } from "../time";
import { changeOwnerPassword, loginOwner, ownerDeleteMember, ownerSetBirthday, ownerSetPhone, setOutletPinHash } from "../service";
import { clearCookie, COOKIE, loadOwner, setSessionCookie } from "../session";
import { WIB_MS, feedTime, memberSince, parseWibDate, parseWibLocal, startOfWibDay, startOfWibMonth, wibDayIndex } from "../time";
import type { Banner } from "../types";
import {
  activityPage,
  adminLoginPage,
  ownerPasswordPage,
  bannersPage,
  adminMissionsPage,
  adminMissionEditPage,
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

  if (path === "/admin/password" && request.method === "GET") return html(ownerPasswordPage(url.searchParams));

  if (path === "/admin/password" && request.method === "POST") {
    if (!owner) return redirect("/admin");
    const form = await request.formData();
    const result = await changeOwnerPassword(db, env, {
      sessionId: owner,
      current: String(form.get("password_lama") || ""),
      next: String(form.get("password_baru") || ""),
      confirm: String(form.get("password_ulang") || ""),
      now,
    });
    if (!result.ok) return back("/admin/password", result.error);
    return ok("/admin/password", "password");
  }

  if (path === "/admin/dasbor" && request.method === "GET") {
    try {
      await repo.housekeeping(db, now);
    } catch {
      /* bersihkan lain kali */
    }
    const brands = await repo.listBrands(db, true);
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
        expireDays: await expireDays(db),
      }),
    );
  }

  if ((path === "/admin/member.csv" || path === "/admin/member.xlsx") && request.method === "GET") {
    const listed = await repo.listMemberRows(db, await liveMemberQuery(db, url));
    const notes = await expiryNotes(db, now);
    const exported = listed.map((m) => toExport(m, now, notes.get(m.id)));
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
    const members = await repo.listMemberRows(db, await liveMemberQuery(db, url));
    return html(membersPage(members, await repo.listBrands(db, true), url.searchParams));
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
    const result = await ownerSetBirthday(db, {
      member,
      birthdayRaw: String(form.get("lahir") || ""),
      now,
      allowThisYear: form.get("boleh") === "on",
    });
    if (!result.ok) return back(`/admin/member/${id}`, result.error);
    return ok(`/admin/member/${id}`, "lahirsimpan");
  }

  if (path.startsWith("/admin/member/") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/admin/member/".length));
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return back("/admin/member", "belum");
    const member = await repo.getMember(db, id);
    if (!member) return back("/admin/member", "belum");
    const cards = await repo.memberCards(db, id);
    const state = await memberPointState(db, member.id, now);
    const pointsNote = state.batch
      ? `${formatPoints(state.balance)} poin · ${formatPoints(state.batch.tenths)} hangus ${shortDate(state.batch.expiresAt)}${state.batch.soon ? " · segera hangus" : ""}`
      : `${formatPoints(state.balance)} poin`;
    return html(memberDetailPage({ member, cards, params: url.searchParams, pointsNote }));
  }

  if (path === "/admin/reward" && request.method === "GET") {
    const brands = await repo.listBrands(db, true);
    const requested = url.searchParams.get("merek") || "";
    const brandId = brands.some((brand) => brand.id === requested) ? requested : "";
    const rows = await repo.listActivities(db, { brandId: brandId || undefined, type: "redeem", limit: 80, offset: 0 });
    return html(rewardsPage(rows, brands, brandId));
  }

  if (path === "/admin/banner" && request.method === "GET") {
    return html(bannersPage(await repo.listBanners(db, null), await repo.listBrands(db, true), url.searchParams));
  }

  if (path === "/admin/banner" && request.method === "POST") {
    const len = Number(request.headers.get("content-length") || "0");
    if (len > 2_500_000) return back("/admin/banner", "besar");
    const form = await request.formData();
    const brandId = String(form.get("brand_id") || "");
    const brand = await repo.getBrand(db, brandId);
    if (!brandOpen(brand)) return back("/admin/banner", "merek");
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
    const program = await repo.listBrands(db, false);
    return html(
      rulesPage(
        program.filter((brand) => brand.active === 1),
        program.filter((brand) => brand.active !== 1),
        await repo.listOrderLinks(db, null),
        url.searchParams,
      ),
    );
  }

  if (path.startsWith("/admin/aturan/") && path.endsWith("/nyala") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/aturan/".length, -"/nyala".length));
    const existing = await repo.getBrand(db, id);
    if (!existing) return back("/admin/aturan", "aturan");
    await repo.setBrandActive(db, id, 1);
    return ok("/admin/aturan", "simpan");
  }

  if (path.startsWith("/admin/aturan/") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/aturan/".length));
    const existing = await repo.getBrand(db, id);
    if (!existing) return back("/admin/aturan", "aturan");
    const form = await request.formData();
    const patch = readBrand(form);
    if (!patch) return back("/admin/aturan", "aturan");
    await repo.saveBrand(db, id, patch);
    const extraRaw = String(form.get("extra_url") || "").trim();
    if (extraRaw) {
      const extraUrl = httpsUrl(extraRaw);
      const platform = orderPlatform(String(form.get("extra_platform") || ""));
      if (!extraUrl || !platform || platform === "gofood" || platform === "grabfood" || platform === "shopeefood") {
        return back("/admin/aturan", "aturan");
      }
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
    const brands = await repo.listBrands(db, true);
    const live = new Set(brands.map((brand) => brand.id));
    const view = outlets
      .filter((outlet) => live.has(outlet.brand_id))
      .map((o) => ({ ...o, brand_name: brands.find((b) => b.id === o.brand_id)?.name || o.brand_id }));
    return html(outletsPage(view, brands, url.searchParams, await repo.listOutletStaff(db)));
  }

  if (path === "/admin/outlet" && request.method === "POST") {
    const form = await request.formData();
    const brand = await repo.getBrand(db, String(form.get("brand_id") || ""));
    const name = clip(String(form.get("name") || ""), 60);
    if (!brandOpen(brand) || !name) return back("/admin/outlet", "merek");
    const pin = String(form.get("pin") || "");
    const made = await hashNewPin(env, pin);
    if (!made.ok) return back("/admin/outlet", made.error);
    await repo.insertOutlet(db, { id: randomId(), brandId: brand.id, name, pinHash: made.hash, pinSalt: made.salt, now });
    return ok("/admin/outlet", "outlet");
  }

  if (path.startsWith("/admin/outlet/") && path.endsWith("/slug") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/outlet/".length, -"/slug".length));
    const outlet = await repo.getOutlet(db, id);
    if (!outlet) return back("/admin/outlet", "aturan");
    const form = await request.formData();
    const slug = slugifyOutlet(String(form.get("slug") || ""));
    if (slug && (RESERVED_KASIR.has(slug) || !/^[a-z0-9-]{2,60}$/.test(slug))) return back("/admin/outlet", "aturan");
    const taken = slug ? await repo.getOutletBySlug(db, slug) : null;
    if (taken && taken.id !== outlet.id) return back("/admin/outlet", "ada");
    await repo.setOutletSlug(db, outlet.id, slug);
    return ok("/admin/outlet", "simpan");
  }

  if (path.startsWith("/admin/outlet/") && path.endsWith("/pesan") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/outlet/".length, -"/pesan".length));
    const outlet = await repo.getOutlet(db, id);
    if (!outlet) return back("/admin/outlet", "aturan");
    const form = await request.formData();
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

  if (path.startsWith("/admin/outlet/") && path.endsWith("/staf/lepas") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/outlet/".length, -"/staf/lepas".length));
    const form = await request.formData();
    const memberId = String(form.get("member_id") || "");
    if (!memberId || !(await repo.getOutlet(db, id))) return back("/admin/outlet", "aturan");
    await repo.removeOutletStaff(db, id, memberId);
    return ok("/admin/outlet", "simpan");
  }

  if (path.startsWith("/admin/outlet/") && path.endsWith("/staf") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/outlet/".length, -"/staf".length));
    if (!(await repo.getOutlet(db, id))) return back("/admin/outlet", "aturan");
    const form = await request.formData();
    const raw = String(form.get("cari") || "").trim();
    const wa = normalizeWa(raw);
    const member = wa ? await repo.getMemberByWa(db, wa) : raw.includes("@") ? await repo.findMemberByEmail(db, raw) : null;
    if (!member) return back("/admin/outlet", "belum");
    await repo.addOutletStaff(db, id, member.id, now);
    return ok("/admin/outlet", "simpan");
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
    const filter = await liveActivityFilter(db, url);
    const rows = await repo.listActivities(db, { ...filter, limit: 100, offset: 0 });
    const brands = await repo.listBrands(db, true);
    const live = new Set(brands.map((brand) => brand.id));
    const outlets = (await repo.listOutlets(db)).filter((outlet) => live.has(outlet.brand_id));
    return html(
      activityPage({
        rows,
        brands,
        outlets,
        query: url.searchParams.toString(),
        params: url.searchParams,
      }),
    );
  }

  if (path === "/admin/aktivitas.csv" && request.method === "GET") {
    const rows = await repo.listActivities(db, { ...(await liveActivityFilter(db, url)), limit: 5000, offset: 0 });
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
    const proofKey = submission?.r2_key?.split(",")[0] || "";
    if (!proofKey.startsWith("missions/")) return new Response("Tidak ketemu", { status: 404 });
    const object = await env.BANNERS.get(proofKey);
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
    const brands = await repo.listBrands(db, true);
    return html(
      adminMissionsPage({
        missions: missions.map((m) => ({
          id: m.id,
          title: m.title,
          points: formatAward(missionQuarters(m)),
          limit: m.limit_kind === "week" ? "seminggu" : "sekali",
          active: m.active === 1,
          proof: proofKind(m) === "cashier" ? "kasir" : proofKind(m) === "link" ? "tautan" : "foto",
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
        levels: (await pdb.listLevels(db))
          .filter((level) => !level.brand_id || brands.some((b) => b.id === level.brand_id))
          .map((level) => ({
          name: level.name,
          min: formatPoints(level.min_points_tenths),
          icon: level.icon || "🌱",
          brand: brands.find((b) => b.id === level.brand_id)?.short_name || "Semua merek",
        })),
        approved: (await pdb.listApproved(db)).map((row) => ({
          id: row.id,
          title: row.title || "",
          member: row.member_name || "",
          points: row.points_tenths > 0 && row.points_tenths <= 4 ? formatAward(row.points_tenths) : formatPoints(row.points_tenths),
        })),
        params: url.searchParams,
      }),
    );
  }

  if (path.startsWith("/admin/misi/quest/") && request.method === "GET") {
    const id = decodeURIComponent(path.slice("/admin/misi/quest/".length).split("/")[0] || "");
    const mission = await pdb.getMission(db, id);
    if (!mission) return back("/admin/misi", "umum");
    const brands = await repo.listBrands(db, true);
    const photos = await pdb.listMissionPhotos(db, mission.id);
    return html(
      adminMissionEditPage({
        mission,
        brands: brands.map((b) => ({ id: b.id, name: b.short_name })),
        photos: photos.map((photo) => ({
          id: photo.id,
          caption: photo.caption,
          sort: photo.sort_order,
          src: photo.r2_key ? `/media/panduan/${photo.id}` : photo.image_url || "",
        })),
        params: url.searchParams,
      }),
    );
  }

  if (path === "/admin/misi" && request.method === "POST") {
    const form = await request.formData();
    const built = readMission(form);
    if (!built) return back("/admin/misi", "aturan");
    if (!brandOpen(await repo.getBrand(db, built.brand_id))) return back("/admin/misi", "merek");
    const id = randomId();
    await pdb.insertMission(db, { ...built, id, active: 1, created_at: now });
    return redirect(`/admin/misi/quest/${id}?ok=simpan`);
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
    if (rest.startsWith("quest/")) {
      const bits = rest.split("/");
      const id = decodeURIComponent(bits[1] || "");
      const mission = await pdb.getMission(db, id);
      if (!mission) return back("/admin/misi", "umum");
      const action = bits[2] || "";
      if (action === "simpan") {
        const form = await request.formData();
        const built = readMission(form);
        if (!built) return back(`/admin/misi/quest/${id}`, "aturan");
        if (!brandOpen(await repo.getBrand(db, built.brand_id))) return back(`/admin/misi/quest/${id}`, "merek");
        await pdb.updateMission(db, { ...built, id, active: form.get("active") === "on" ? 1 : 0, created_at: mission.created_at });
        return ok(`/admin/misi/quest/${id}`, "simpan");
      }
      if (action === "foto" && bits.length === 3) {
        const form = await request.formData();
        const saved = await storeImage(env, form.get("gambar"), `guides/${randomId()}`);
        if (!saved) return back(`/admin/misi/quest/${id}`, "gambar");
        const photos = await pdb.listMissionPhotos(db, id);
        await pdb.insertMissionPhoto(db, {
          id: randomId(),
          missionId: id,
          r2Key: saved.key,
          imageUrl: null,
          caption: clip(String(form.get("caption") || ""), 80),
          sort: photos.length + 1,
        });
        return ok(`/admin/misi/quest/${id}`, "simpan");
      }
      if (action === "foto" && bits[4] === "buang") {
        const photoId = decodeURIComponent(bits[3] || "");
        const photo = await pdb.getMissionPhoto(db, photoId);
        if (photo?.r2_key) await env.BANNERS.delete(photo.r2_key);
        await pdb.deleteMissionPhoto(db, photoId, id);
        return ok(`/admin/misi/quest/${id}`, "hapus");
      }
      if (action === "urut") {
        const form = await request.formData();
        const photos = await pdb.listMissionPhotos(db, id);
        for (const photo of photos) {
          const sort = Number(form.get(`sort_${photo.id}`));
          const caption = clip(String(form.get(`caption_${photo.id}`) || ""), 80);
          if (!Number.isInteger(sort) || sort < 0 || sort > 99) return back(`/admin/misi/quest/${id}`, "aturan");
          await pdb.saveMissionPhotoMeta(db, photo.id, id, caption, sort);
        }
        return ok(`/admin/misi/quest/${id}`, "simpan");
      }
      return back("/admin/misi", "umum");
    }
    const approve = rest.endsWith("/setuju");
    const reject = rest.endsWith("/tolak");
    const pull = rest.endsWith("/tarik");
    const toggle = rest.endsWith("/aktif");
    const id = decodeURIComponent(rest.slice(0, rest.lastIndexOf("/")));
    if (pull) {
      const result = await revokeMission(db, id, now);
      if (!result.ok) return back("/admin/misi", result.error);
      return ok("/admin/misi", "tarik");
    }
    if (toggle) {
      const mission = await pdb.getMission(db, id);
      if (!mission) return back("/admin/misi", "umum");
      await pdb.setMissionActive(db, id, mission.active ? 0 : 1);
      return ok("/admin/misi", "simpan");
    }
    if (!approve && !reject) return back("/admin/misi", "umum");
    const result = await reviewMission(db, { id, approve, now });
    if (!result.ok) return back("/admin/misi", result.error);
    return ok("/admin/misi", approve ? "setuju" : "tolak");
  }

  if (path === "/admin/poin" && request.method === "POST") {
    const form = await request.formData();
    const days = Number(form.get("days"));
    if (!Number.isInteger(days) || days < 1 || days > 3650) return back("/admin/dasbor", "aturan");
    await repo.setSetting(db, "points_expire_days", String(days));
    return ok("/admin/dasbor", "simpan");
  }

  if (path.startsWith("/admin/merek/") && path.endsWith("/logo") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/admin/merek/".length, -"/logo".length));
    if (!(await repo.getBrand(db, id))) return back("/admin/aturan", "aturan");
    const form = await request.formData();
    const logo = await storeImage(env, form.get("logo"), `logos/${id}`);
    const icon = await storeImage(env, form.get("ikon"), `icons/${id}`);
    const stamp = await storeImage(env, form.get("stamp"), `stamps/${id}`);
    if (form.get("logo") instanceof File && (form.get("logo") as File).size > 0 && !logo) return back("/admin/aturan", "gambar");
    if (form.get("ikon") instanceof File && (form.get("ikon") as File).size > 0 && !icon) return back("/admin/aturan", "gambar");
    if (form.get("stamp") instanceof File && (form.get("stamp") as File).size > 0 && !stamp) return back("/admin/aturan", "gambar");
    if (logo) await repo.setBrandAsset(db, id, "logo", logo.key);
    if (icon) await repo.setBrandAsset(db, id, "icon", icon.key);
    if (stamp) await repo.setBrandAsset(db, id, "stamp", stamp.key);
    return ok("/admin/aturan", "simpan");
  }

  if (path === "/admin/katalog") return redirect("/admin/tingkat");

  if (path === "/admin/tingkat" && request.method === "GET") {
    const tiers = await pdb.listAllTiers(db);
    const brands = await repo.listBrands(db, true);
    return html(
      adminTiersPage({
        tiers: tiers.map((t) => ({
          id: t.id,
          brand: brands.find((b) => b.id === t.brand_id)?.short_name || t.brand_id,
          stamps: t.stamps,
          reward: t.reward_text,
          icon: t.icon || "🎁",
          stock: t.stock == null ? "tak terbatas" : String(t.stock),
          active: t.active === 1,
        })),
        brands: brands.map((b) => ({ id: b.id, name: b.short_name })),
        params: url.searchParams,
      }),
    );
  }

  if (path === "/admin/tingkat" && request.method === "POST") {
    const form = await request.formData();
    const brand = await repo.getBrand(db, String(form.get("brand_id") || ""));
    const typed = Number(form.get("stamps") || 0);
    const preset = Number(form.get("preset") || 0);
    const stamps = Number.isInteger(typed) && typed >= 1 ? typed : preset;
    const reward = clip(String(form.get("reward_text") || ""), 80);
    const stockRaw = String(form.get("stock") || "").trim();
    const stock = stockRaw === "" ? null : Number(stockRaw);
    if (!brandOpen(brand) || !reward || !Number.isInteger(stamps) || stamps < 1 || stamps > 999) return back("/admin/tingkat", "merek");
    if (stock != null && (!Number.isInteger(stock) || stock < 0)) return back("/admin/tingkat", "aturan");
    const id = randomId();
    const image = await storeImage(env, form.get("gambar"), `redeem/${id}`);
    if (form.get("gambar") instanceof File && (form.get("gambar") as File).size > 0 && !image) return back("/admin/tingkat", "gambar");
    await pdb.insertTier(db, {
      id,
      brand_id: brand.id,
      stamps,
      reward_text: reward,
      sort_order: stamps,
      active: form.get("active") === "on" ? 1 : 0,
      icon: markIcon(String(form.get("icon") || ""), "🎁"),
      stock,
      image_url: null,
      r2_key: image?.key || null,
    });
    return ok("/admin/tingkat", "simpan");
  }

  const tierToggle = path.match(/^\/admin\/tingkat\/([A-Za-z0-9_-]+)\/aktif$/);
  if (tierToggle && request.method === "POST") {
    const tier = await pdb.getTier(db, tierToggle[1] || "");
    if (!tier) return back("/admin/tingkat", "umum");
    await pdb.setTierActive(db, tier.id, tier.active ? 0 : 1);
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

async function liveActivityFilter(db: D1Database, url: URL) {
  const filter = activityFilter(url);
  if (!filter.brandId) return filter;
  const brand = await repo.getBrand(db, filter.brandId);
  if (!brandOpen(brand)) return { ...filter, brandId: undefined };
  return filter;
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
  const windowRaw = String(form.get("birthday_window") || "day");
  const birthday_window = windowRaw === "month" || windowRaw === "around" || windowRaw === "day" ? windowRaw : "day";
  const birthday_days = Number(form.get("birthday_days") || 7);
  if (!Number.isInteger(birthday_days) || birthday_days < 0 || birthday_days > 30) return null;
  const cta = hexOrEmpty(String(form.get("cta") || ""));
  const page_bg = hexOrEmpty(String(form.get("page_bg") || ""));
  const stamp_icon = String(form.get("stamp_icon") || "whisk");
  if (cta == null || page_bg == null) return null;
  if (!["whisk", "bowl", "plate", "custom", "logo"].includes(stamp_icon)) return null;
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
    cta,
    page_bg,
    stamp_icon,
    ig_handle: clip(String(form.get("ig_handle") || ""), 80),
  };
}

function hexOrEmpty(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}

function readMission(form: FormData) {
  const title = clip(String(form.get("title") || ""), 80);
  const checkRaw = String(form.get("check_kind") || "");
  const check_kind = checkRaw === "google" || checkRaw === "threads" || checkRaw === "story" ? checkRaw : "";
  const quarters = check_kind ? 4 : questQuarters(String(form.get("points") || ""));
  const brandId = String(form.get("brand_id") || "");
  if (!title || !quarters || !brandId) return null;
  const tagRaw = String(form.get("tag") || "");
  const tag = tagRaw === "new" || tagRaw === "limited" ? tagRaw : "";
  const unlock = parsePointsOrZero(String(form.get("unlock") || "0"));
  const sort = Number(form.get("sort") || 0);
  if (unlock == null || !Number.isInteger(sort) || sort < 0 || sort > 999) return null;
  const startRaw = String(form.get("starts") || "").trim();
  const endRaw = String(form.get("ends") || "").trim();
  const starts = startRaw ? parseWibDate(startRaw) : null;
  const ends = endRaw ? parseWibDate(endRaw) : null;
  if (startRaw && starts == null) return null;
  if (endRaw && ends == null) return null;
  return {
    brand_id: brandId,
    title,
    description: clip(String(form.get("description") || ""), 240),
    points_tenths: quarters,
    points_quarters: quarters,
    check_kind,
    proof_screenshot: 1,
    proof_link: 0,
    proof_kind: "upload",
    limit_kind: "once" as const,
    icon: markIcon(String(form.get("icon") || ""), "🍃"),
    tag,
    mystery: form.get("mystery") === "on" ? 1 : 0,
    tease: clip(String(form.get("tease") || ""), 140),
    unlock_points_tenths: unlock,
    sort_order: sort,
    starts_at: starts,
    ends_at: ends == null ? null : ends + 86_400_000 - 1,
    steps: clip(String(form.get("steps") || ""), 800),
  };
}

async function storeImage(env: Env, value: unknown, key: string): Promise<{ key: string } | null> {
  if (!(value instanceof File) || value.size <= 0) return null;
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (value.size > 2_000_000 || !allowed.has(value.type)) return null;
  await env.BANNERS.put(key, value.stream(), { httpMetadata: { contentType: value.type } });
  return { key };
}

async function liveMemberQuery(db: D1Database, url: URL) {
  const query = memberQuery(url);
  if (!query.brandId) return query;
  const brand = await repo.getBrand(db, query.brandId);
  if (!brandOpen(brand)) return { ...query, brandId: "" };
  return query;
}

function memberQuery(url: URL) {
  const sort = url.searchParams.get("urut") || "kunjungan";
  return { q: (url.searchParams.get("q") || "").trim(), brandId: url.searchParams.get("merek") || "", sort };
}

function toExport(
  m: { id: string; name: string; wa: string; email: string | null; birthday: string | null; created_at: number; join_method: string; stamps_label: string; rewards: number; last_seen_at: number; wa_verified?: number; promo_consent?: number },
  now: number,
  note?: { tenths: number; expiresAt: number },
): ExportRow {
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
    pointsExpiry: note ? `${Math.floor(note.tenths / 10)} stamp · ${shortDate(note.expiresAt)}` : "",
    waVerified: m.wa_verified === 1 ? "ya" : "belum",
    promoConsent: m.promo_consent === 1 ? "ya" : "belum",
  };
}
