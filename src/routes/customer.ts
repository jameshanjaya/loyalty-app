import { nextRewardLine } from "../brand-visual";
import { randomId } from "../crypto";
import { packReferralCookie, unpackReferralCookie } from "../referral";
import { attachReferral, logReferralOpen, referralProgress, refreshReferral } from "../referral-flow";
import { readBirthdayRaw } from "../birthday";
import { loadBirthdayNotice } from "../birthday-gate";
import { brandOpen, pickLiveBrand } from "../brands";
import { bookingTarget, bookingUrl, hiddenOrderPlatform, visibleOrderLinks } from "../orders";
import { missionInWindow, questLocked, questProgress, tierChoices } from "../points";
import { LIMITS, enforceLimit } from "../ratelimit";
import * as pdb from "../points-db";
import { expireCodes } from "../points-flow";
import { mustVerify, waReady } from "../wa";
import { html, isPrefetch, readCookie, redirect, sameOrigin } from "../http";
import { errText } from "../messages";
import { safeNext } from "../format";
import * as repo from "../repo";
import { MEMBER_SESSION_MS } from "../loyalty";
import { finishClaim, joinMember, linkGoogleWithPin, loginMember, completeGoogleProfile, setOwnBirthday } from "../service";
import { clearCookie, COOKIE, loadMember, loadSignup, setSessionCookie } from "../session";
import { readClaim } from "../tokens";
import {
  cardPage,
  claimHoldPage,
  emptyDbPage,
  homePage,
  joinPage,
  loginPage,
  messagePage,
  profilePage,
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

async function brandSlice(db: D1Database, member: NonNullable<Awaited<ReturnType<typeof loadMember>>>, brand: NonNullable<Awaited<ReturnType<typeof repo.getBrand>>>, now: number, outletParam: string) {
  const earned = await pdb.lifetimeEarned(db, member.id);
  const missions = [];
  for (const mission of (await pdb.listMissions(db, true)).filter((item) => item.brand_id === brand.id && missionInWindow(item.starts_at, item.ends_at, now))) {
    const state = await pdb.memberMissionState(db, member.id, mission.id);
    const locked = questLocked({ mystery: mission.mystery === 1, unlockTenths: mission.unlock_points_tenths, lifetimeTenths: earned });
    const progress = questProgress({ limit: "once", pending: state.pending, lastApprovedAt: state.lastApprovedAt, now });
    const status = progress.done ? "done" : state.pending ? "wait" : locked ? "locked" : state.rejectedNote ? "no" : "open";
    missions.push({
      id: mission.id,
      title: mission.title,
      blurb: (mission.description || "").split("\n")[0] || "",
      kind: mission.check_kind || "",
      status,
      reason: status === "no" ? state.rejectedNote || "" : "",
    });
  }
  const named = (await repo.listOutlets(db)).filter((outlet) => outlet.brand_id === brand.id && outlet.active);
  const selected = named.some((outlet) => outlet.id === outletParam) ? outletParam : "";
  const orders = visibleOrderLinks(await repo.listOrderLinks(db, brand.id), selected || null);
  const bookable = named.filter((outlet) => bookingUrl(brand.name, outlet.name, outlet.wa || ""));
  const target = bookingTarget(
    brand.name,
    named.map((outlet) => ({ id: outlet.id, name: outlet.name, wa: outlet.wa || "" })),
    selected || null,
  );
  const chipIds = new Set<string>([
    ...orders.flatMap((link) => (link.outlet_id ? [link.outlet_id] : [])),
    ...(bookable.length > 1 ? bookable.map((outlet) => outlet.id) : []),
  ]);
  const tiers = await pdb.listTiers(db, brand.id);
  const card = await repo.getCard(db, member.id, brand.id);
  const choice = tierChoices(
    card?.stamps ?? 0,
    tiers.map((tier) => ({ stamps: tier.stamps, reward: tier.reward_text })),
  );
  return {
    brand,
    banners: await repo.listBanners(db, brand.id),
    history: await repo.memberHistory(db, member.id, brand.id),
    birthday: await loadBirthdayNotice(db, member, brand, now),
    birthdayReward: brand.birthday_reward,
    tiers: tiers.map((tier) => ({
      id: tier.id,
      stamps: tier.stamps,
      reward: tier.reward_text,
      icon: tier.icon || "🎁",
      ready: choice.available.some((item) => item.stamps === tier.stamps && item.reward === tier.reward_text),
    })),
    orders,
    orderOutlets: named.filter((outlet) => chipIds.has(outlet.id)).map((outlet) => ({ id: outlet.id, name: outlet.name, on: outlet.id === selected })),
    booking: target,
    pickBooking: bookable.length > 1 && !target,
    missions,
    quarters: card?.remainder_quarters || 0,
  };
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
    path === "/profil" ||
    path === "/profil/hubungkan" ||
    path === "/keluar" ||
    path === "/kartu" ||
    path.startsWith("/pesan/") ||
    path.startsWith("/k/") ||
    path.startsWith("/berhasil/");
  if (!mine) return null;
  const member = await loadMember(request, db, now);
  const signup = member ? null : await loadSignup(request, db, now);

  if (path === "/" && request.method === "GET") {
    if (signup) return redirect("/profil");
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
    const ajak = (url.searchParams.get("ajak") || "").trim().toLowerCase();
    const params = new URLSearchParams(url.searchParams);
    if (ajak) params.set("ajak", ajak);
    const packed = ajak ? packReferralCookie(ajak, brand?.id || "", now) : "";
    if (ajak && brand) {
      try {
        await logReferralOpen(db, { code: ajak, brandId: brand.id, now });
      } catch {
        /* audit menyusul */
      }
    }
    const cookie = packed ? `ajak=${encodeURIComponent(packed)}; Path=/; Max-Age=604800; SameSite=Lax; HttpOnly` : "";
    return html(joinPage({ brands, brand, next, params }), 200, cookie ? { "set-cookie": cookie } : undefined);
  }

  if (path === "/gabung" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const form = await request.formData();
    const nama = String(form.get("nama") || "");
    const wa = String(form.get("wa") || "");
    const next = safeNext(String(form.get("next") || ""), "/kartu");
    const merek = String(form.get("merek") || "") || null;
    if (form.get("setuju") !== "on") {
      const brands = await repo.listBrands(db, true);
      const brand = brands.find((b) => b.id === merek) || null;
      return html(joinPage({ brands, brand, next, params: errQuery("setuju"), values: { nama, wa } }), 400);
    }
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
    await repo.setPromoConsent(db, result.member.id, now);
    const opened = unpackReferralCookie(readCookie(request.headers.get("cookie"), "ajak") || "");
    if (opened) await attachReferral(db, { friend: result.member, code: opened.code, brandId: opened.brandId, openedAt: opened.openedAt, now });
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

  if (path === "/profil" && request.method === "GET") {
    if (signup) return html(profilePage({ mode: "google", name: signup.pending.name, email: signup.pending.email, params: url.searchParams }));
    if (!member) return redirect("/masuk");
    const brands = await repo.listBrands(db, true);
    const brand = pickLiveBrand(brands, url.searchParams.get("merek"));
    const referral = brand ? await referralProgress(db, member.id, brand.id) : null;
    return html(
      profilePage({
        mode: "member",
        name: member.name,
        email: member.email,
        birthday: member.birthday,
        google: Boolean(member.google_sub),
        params: url.searchParams,
        brand,
        wa: member.wa,
        since: member.created_at,
        consent: member.promo_consent === 1,
        referral: referral
          ? { ...referral, url: `${url.origin}/gabung/${encodeURIComponent(brand?.id || "")}?ajak=${encodeURIComponent(referral.code)}` }
          : undefined,
      }),
    );
  }

  if (path === "/profil" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const form = await request.formData();
    const birthdayRaw = readBirthdayRaw(form);
    if (signup) {
      if (form.get("setuju") !== "on") {
        return html(
          profilePage({
            mode: "google",
            name: signup.pending.name,
            email: signup.pending.email,
            params: errQuery("setuju"),
            wa: String(form.get("wa") || ""),
            birthday: birthdayRaw,
          }),
          400,
        );
      }
      const result = await completeGoogleProfile(db, env, {
        pendingId: signup.pending.id,
        sub: signup.pending.sub,
        email: signup.pending.email,
        name: String(form.get("nama") || signup.pending.name),
        waRaw: String(form.get("wa") || ""),
        birthdayRaw,
        pin: String(form.get("pin") || ""),
        pin2: String(form.get("pin2") || ""),
        now,
      });
      if (!result.ok) {
        const params = errQuery(result.error);
        if (result.error === "punya") params.set("wa", String(form.get("wa") || ""));
        return html(
          profilePage({
            mode: result.error === "punya" ? "link" : "google",
            name: signup.pending.name,
            email: signup.pending.email,
            params,
            wa: String(form.get("wa") || ""),
            birthday: birthdayRaw,
          }),
          400,
        );
      }
      await repo.setPromoConsent(db, result.member.id, now);
      const opened = unpackReferralCookie(readCookie(request.headers.get("cookie"), "ajak") || "");
      if (opened) await attachReferral(db, { friend: result.member, code: opened.code, brandId: opened.brandId, openedAt: opened.openedAt, now });
      await repo.deleteSession(db, signup.sessionId);
      const cookies = [setSessionCookie(request, COOKIE.member, result.sessionId, MEMBER_SESSION_MS)];
      if (waReady(env)) {
        await repo.setPhoneVerified(db, result.member.id, 0);
        return redirect("/verifikasi", cookies);
      }
      return redirect("/kartu", cookies);
    }
    if (!member) return redirect("/masuk");
    if (form.get("setuju") === "on") await repo.setPromoConsent(db, member.id, now);
    try {
      await refreshReferral(db, member.id, now);
    } catch {
      /* referral dicek lagi nanti */
    }
    if (member.birthday && !birthdayRaw) return redirect("/profil?ok=setuju");
    const saved = await setOwnBirthday(db, { member, birthdayRaw, now });
    if (!saved.ok) return redirect(`/profil?err=${saved.error}`);
    return redirect("/kartu?ok=lahirsimpan");
  }

  if (path === "/profil/hubungkan" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    if (!signup) return redirect("/masuk");
    const form = await request.formData();
    const birthdayRaw = readBirthdayRaw(form);
    const result = await linkGoogleWithPin(db, env, {
      pendingId: signup.pending.id,
      sub: signup.pending.sub,
      email: signup.pending.email,
      waRaw: String(form.get("wa") || ""),
      pin: String(form.get("pin") || ""),
      birthdayRaw,
      ip,
      now,
    });
    if (!result.ok) {
      const params = errQuery(result.error);
      params.set("wa", String(form.get("wa") || ""));
      return html(profilePage({ mode: "link", name: signup.pending.name, email: signup.pending.email, params, wa: String(form.get("wa") || ""), birthday: birthdayRaw }), 400);
    }
    await repo.deleteSession(db, signup.sessionId);
    return redirect("/kartu", [setSessionCookie(request, COOKIE.member, result.sessionId, MEMBER_SESSION_MS)]);
  }

  if (path === "/kartu" && request.method === "GET") {
    if (signup) return redirect("/profil");
    if (!member) return redirect("/masuk");
    await expireCodes(db, now);
    const brands = await repo.listBrands(db, true);
    if (!brands.length) return html(emptyDbPage());
    const brand = pickLiveBrand(brands, url.searchParams.get("merek"));
    if (!brand) return html(emptyDbPage());
    for (const item of brands) await repo.ensureCard(db, member.id, item.id, now);
    const cards = new Map((await repo.listCards(db, member.id)).map((c) => [c.brand_id, c]));
    const outletParam = url.searchParams.get("outlet") || "";
    const slices = [];
    for (const item of brands) slices.push(await brandSlice(db, member, item, now, item.id === brand.id ? outletParam : ""));
    const active = slices.find((slice) => slice.brand.id === brand.id) || slices[0];
    try {
      await refreshReferral(db, member.id, now);
    } catch {
      /* referral dicek lagi nanti */
    }
    const lockOn = (await repo.getSetting(db, "wa_verify_lock")) === "1";
    if (!lockOn && mustVerify(env, member)) return redirect("/verifikasi");
    return html(
      cardPage({
        member,
        brands,
        cards,
        brand,
        banners: active.banners,
        history: active.history,
        now,
        params: url.searchParams,
        birthday: active.birthday,
        birthdayReward: active.birthdayReward,
        tiers: active.tiers,
        orders: active.orders,
        orderOutlets: active.orderOutlets,
        booking: active.booking,
        pickBooking: active.pickBooking,
        missions: active.missions,
        waLock: lockOn && member.wa_verified !== 1,
        slices,
      }),
    );
  }

  if (path.startsWith("/pesan/outlet/") && request.method === "POST") {
    const outletId = decodeURIComponent(path.slice("/pesan/outlet/".length));
    const outlet = await repo.getOutlet(db, outletId);
    const outletBrand = outlet ? await repo.getBrand(db, outlet.brand_id) : null;
    if (outlet && outlet.active && brandOpen(outletBrand) && bookingUrl(outletBrand?.name || "", outlet.name, outlet.wa || "")) {
      const gate = await enforceLimit(db, `order:${ip}`, now, LIMITS.orderClick);
      if (gate.ok) {
        await repo.logOrderClick(db, {
          id: randomId(),
          brandId: outlet.brand_id,
          outletId: outlet.id,
          platform: "booking",
          linkId: outlet.id,
          memberId: member?.id || null,
          now,
        });
      }
    }
    return new Response(null, { status: 204 });
  }

  if (path.startsWith("/pesan/") && request.method === "GET") {
    if (isPrefetch(request)) return new Response(null, { status: 204 });
    if (path.startsWith("/pesan/outlet/")) {
      const outletId = decodeURIComponent(path.slice("/pesan/outlet/".length));
      const outlet = await repo.getOutlet(db, outletId);
      const outletBrand = outlet ? await repo.getBrand(db, outlet.brand_id) : null;
      const dest = outlet && outlet.active && outletBrand ? bookingUrl(outletBrand.name, outlet.name, outlet.wa || "") : null;
      if (!outlet || !dest || !brandOpen(outletBrand)) return redirect("/kartu");
      const gate = await enforceLimit(db, `order:${ip}`, now, LIMITS.orderClick);
      if (gate.ok) {
        await repo.logOrderClick(db, {
          id: randomId(),
          brandId: outlet.brand_id,
          outletId: outlet.id,
          platform: "booking",
          linkId: outlet.id,
          memberId: member?.id || null,
          now,
        });
      }
      return redirect(dest);
    }
    const id = decodeURIComponent(path.slice("/pesan/".length));
    const link = await repo.getOrderLink(db, id);
    const linkBrand = link ? await repo.getBrand(db, link.brand_id) : null;
    if (!link || link.active !== 1 || !link.url.startsWith("https://") || hiddenOrderPlatform(link.platform) || !brandOpen(linkBrand)) return redirect("/kartu");
    const gate = await enforceLimit(db, `order:${ip}`, now, LIMITS.orderClick);
    if (gate.ok) {
      await repo.logOrderClick(db, {
        id: randomId(),
        brandId: link.brand_id,
        outletId: link.outlet_id,
        platform: link.platform,
        linkId: link.id,
        memberId: member?.id || null,
        now,
      });
    }
    return redirect(link.url);
  }

  if (path.startsWith("/k/") && request.method === "GET") {
    const token = decodeURIComponent(path.slice(3));
    const next = path;
    if (isPrefetch(request)) return html(claimHoldPage({ brand: null, next, error: "Buka halaman ini langsung di HP." }));
    const read = env.TOKEN_SECRET ? await readClaim(token, env.TOKEN_SECRET, now) : { ok: false as const, reason: "malformed" as const };
    const brand = read.ok ? await repo.getBrand(db, read.payload.brandId) : null;
    if (signup) return redirect(`/profil`);
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
    if (!activity || activity.member_id !== member.id || (activity.type !== "stamp" && activity.type !== "redeem" && activity.type !== "birthday")) {
      return redirect("/kartu");
    }
    const brand = await repo.getBrand(db, activity.brand_id);
    if (!brandOpen(brand)) return redirect("/kartu");
    const card = await repo.ensureCard(db, member.id, brand.id, now);
    const banners = await repo.listBanners(db, brand.id);
    const brands = await repo.listBrands(db, true);
    const tiers = await pdb.listTiers(db, brand.id);
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
        unlocked: activity.type === "stamp" && tiers.some((tier) => tier.stamps === card.stamps),
        nextLine: activity.type === "stamp" ? nextRewardLine(card.stamps, tiers.map((tier) => ({ stamps: tier.stamps, reward: tier.reward_text }))) : "",
      }),
    );
  }

  return null;
}
