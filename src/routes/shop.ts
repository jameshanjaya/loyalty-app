import { randomId } from "../crypto";
import { httpsUrl } from "../format";
import { html, json, redirect, sameOrigin } from "../http";
import { errText } from "../messages";
import { missionInWindow, missionOpen, questLocked } from "../points";
import * as pdb from "../points-db";
import { expireCodes, redeemBirthdayCode, redeemPointsReward, redeemTier, submitMission } from "../points-flow";
import { formatAward, missionQuarters } from "../quest-stamp";
import { checkProof } from "../vision";
import { brandOpen, pickLiveBrand } from "../brands";
import { mustVerify } from "../wa";
import { qrSvg } from "../qr";
import * as repo from "../repo";
import { loadMember, loadSignup } from "../session";
import { fallbackNewsPhoto } from "../brand-visual";
import { loadHadiahBundle } from "../fast-read";
import { catalogPage, codePage, messagePage, missionDetailPage } from "../view";
import type { App } from "./customer";

function go(path: string, code: string): Response {
  return redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(code)}`);
}

function kartuBonus(brandId: string | null, extra: { ok?: string | null; err?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (brandId) params.set("merek", brandId);
  if (extra.ok) params.set("ok", extra.ok);
  if (extra.err) params.set("err", extra.err);
  const query = params.toString();
  return `/kartu${query ? `?${query}` : ""}#bonus-stamp`;
}

export async function handleShop(app: App): Promise<Response | null> {
  const { request, env, url, now } = app;
  const path = url.pathname;
  const shop =
    path === "/misi" ||
    path === "/side-quest" ||
    path.startsWith("/misi/") ||
    path === "/hadiah" ||
    path.startsWith("/hadiah/") ||
    path === "/tukar/stamp" ||
    path === "/tukar/ultah" ||
    path.startsWith("/kode/");
  if (!shop) return null;
  const db = env.DB;
  await expireCodes(db, now);
  const member = await loadMember(request, db, now);
  if (!member) {
    const signup = await loadSignup(request, db, now);
    if (signup) return redirect("/profil");
    return redirect("/masuk");
  }
  if (mustVerify(env, member)) return redirect("/verifikasi");

  if ((path === "/misi" || path === "/side-quest") && request.method === "GET") {
    const brands = await repo.listBrands(db, true);
    const picked = pickLiveBrand(brands, url.searchParams.get("merek"));
    return redirect(kartuBonus(picked?.id || url.searchParams.get("merek"), { ok: url.searchParams.get("ok"), err: url.searchParams.get("err") }));
  }

  const missionDetail = path.startsWith("/misi/") && request.method === "GET" ? decodeURIComponent(path.slice("/misi/".length)) : "";
  if (missionDetail && !missionDetail.includes("/")) {
    const mission = await pdb.getMission(db, missionDetail);
    if (!mission || !mission.active || !missionInWindow(mission.starts_at, mission.ends_at, now)) return redirect(kartuBonus(url.searchParams.get("merek"), { err: "umum" }));
    if (!brandOpen(mission.brand_id ? await repo.getBrand(db, mission.brand_id) : null)) return redirect(kartuBonus(mission.brand_id, { err: "merek" }));
    const brands = await repo.listBrands(db, true);
    const earned = await pdb.lifetimeEarned(db, member.id);
    const state = await pdb.memberMissionState(db, member.id, mission.id);
    const locked = questLocked({ mystery: mission.mystery === 1, unlockTenths: mission.unlock_points_tenths, lifetimeTenths: earned });
    const open = !locked && missionOpen({ limit: "once", hasPending: state.pending, lastApprovedAt: state.lastApprovedAt, now });
    const photos = await pdb.listMissionPhotos(db, mission.id);
    const picked = brands.find((b) => b.id === (url.searchParams.get("merek") || mission.brand_id)) || brands[0] || null;
    return html(
      missionDetailPage({
        id: mission.id,
        brand: picked,
        title: mission.title,
        description: mission.description,
        steps: mission.steps || "",
        points: formatAward(missionQuarters(mission)),
        open,
        locked,
        tease: mission.tease || "",
        photos: photos.map((photo) => ({
          src: photo.r2_key ? `/media/panduan/${photo.id}` : photo.image_url || "",
          caption: photo.caption,
        })),
        params: url.searchParams,
        multi: mission.check_kind === "threads",
      }),
    );
  }

  if (path.startsWith("/misi/") && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const id = decodeURIComponent(path.slice("/misi/".length));
    const form = await request.formData();
    const mission = await pdb.getMission(db, id);
    if (!mission) return redirect(kartuBonus(null, { err: "umum" }));
    let link = httpsUrl(String(form.get("link") || ""));
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    const files = form.getAll("gambar").filter((item): item is File => item instanceof File && item.size > 0).slice(0, 3);
    const images: Array<{ bytes: Uint8Array; type: string }> = [];
    const keys: string[] = [];
    for (const file of files) {
      if (file.size > 2_000_000 || !allowed.has(file.type)) return redirect(kartuBonus(mission.brand_id, { err: "gambar" }));
      const bytes = new Uint8Array(await file.arrayBuffer());
      const key = `missions/${randomId()}`;
      await env.BANNERS.put(key, bytes, { httpMetadata: { contentType: file.type } });
      keys.push(key);
      images.push({ bytes, type: file.type });
    }
    const r2Key = keys.join(",") || null;
    const brand = mission.brand_id ? await repo.getBrand(db, mission.brand_id) : null;
    const proof = await checkProof(env.AI, {
      kind: mission.check_kind,
      images,
      name: member.name,
      email: member.email,
      handle: brand?.ig_handle || "",
    });
    const result = await submitMission(db, { member, missionId: id, link, r2Key, now, verdict: proof.verdict, failCode: proof.code });
    if (!result.ok) return redirect(kartuBonus(mission.brand_id, { err: result.error }));
    const ok = result.status === "pending" ? "tunggu" : result.stampsAdded > 0 ? "stampquest" : "misi";
    return redirect(kartuBonus(mission.brand_id, { ok }));
  }

  if (path === "/hadiah" && request.method === "GET") {
    const packed = await loadHadiahBundle(db, member.id, url.searchParams.get("merek") || "", now, member.birthday);
    if (!packed) return html(messagePage("Kosong", "Belum ada merek."));
    const { brand, brands, stamps } = packed;
    const rewards = packed.tiers;
    const birthday = packed.birthday;
    const storedNews = packed.news;
    const news = [1, 2, 3].map((slot) => {
      const row = storedNews.find((item) => item.slot === slot && item.active);
      return {
        title: row?.title || "Menu andalan",
        subtitle: row?.subtitle || brand.short_name,
        kind: row?.kind || "MENU",
        image: row?.r2_key ? `/media/news/${row.id}` : row?.image_url || fallbackNewsPhoto(brand.id, slot),
      };
    });
    return html(
      catalogPage({
        stamps,
        brandName: brand.short_name,
        brand,
        brands: brands.map((b) => ({ id: b.id, name: b.short_name, on: b.id === brand.id })),
        rewards: rewards.map((r) => ({
          id: r.id,
          title: r.reward_text,
          stamps: r.stamps,
          cost: `${r.stamps} stamp`,
          note: r.stock == null ? "" : r.stock === 0 ? "Habis" : `Sisa ${r.stock}`,
          ready: stamps >= r.stamps && (r.stock == null || r.stock > 0),
          icon: r.icon || "🎁",
          image: r.r2_key ? `/media/redeem/${r.id}` : r.image_url || "",
          soldOut: r.stock === 0,
        })),
        params: url.searchParams,
        birthday,
        birthdayReward: brand.birthday_reward,
        now,
        news,
      }),
    );
  }

  if (path.startsWith("/hadiah/") && path.endsWith("/tukar") && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const id = decodeURIComponent(path.slice("/hadiah/".length, -"/tukar".length));
    const result = await redeemPointsReward(db, member, id, now);
    if (!result.ok) return go("/hadiah", result.error);
    return redirect(`/kode/${result.code.id}`);
  }

  if (path === "/tukar/stamp" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const form = await request.formData();
    const result = await redeemTier(db, member, String(form.get("tier") || ""), now);
    if (!result.ok) return go(form.get("dari") === "hadiah" ? "/hadiah" : "/kartu", result.error);
    return redirect(`/kode/${result.code.id}`);
  }

  if (path === "/tukar/ultah" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const form = await request.formData();
    const brand = await repo.getBrand(db, String(form.get("merek") || ""));
    if (!brand) return go("/kartu", "umum");
    const result = await redeemBirthdayCode(db, member, brand, now);
    if (!result.ok) return go(`/kartu?merek=${brand.id}`, result.error);
    return redirect(`/kode/${result.code.id}`);
  }

  if (path.startsWith("/kode/") && request.method === "GET") {
    const rest = path.slice("/kode/".length);
    const statusPoll = rest.endsWith("/status");
    const id = decodeURIComponent(statusPoll ? rest.slice(0, -"/status".length) : rest);
    const code = await pdb.getCode(db, id);
    if (!code || code.member_id !== member.id) return statusPoll ? json({ status: "missing" }, 404) : go("/kartu", "kode");
    if (statusPoll) return json({ status: code.status === "pending" && code.expires_at <= now ? "expired" : code.status });
    const brand = await repo.getBrand(db, code.brand_id);
    const live = code.status === "pending" && code.expires_at > now;
    return html(
      codePage({
        code: code.code,
        label: code.reward_label,
        brand: brand?.short_name || "",
        svg: live ? qrSvg(`${url.origin}/kasir/kode/${code.code}`) : "",
        remainingMs: code.expires_at - now,
        status: live ? "pending" : code.status === "confirmed" ? "confirmed" : "expired",
        claimUrl: code.id,
        brandTheme: brand,
      }),
    );
  }

  return html(messagePage("Tidak ketemu", "Halaman itu tidak ada.", "/kartu"), 404);
}
