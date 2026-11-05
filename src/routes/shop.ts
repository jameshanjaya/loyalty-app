import { randomId } from "../crypto";
import { httpsUrl } from "../format";
import { html, json, redirect, sameOrigin } from "../http";
import { errText } from "../messages";
import { formatPoints, missionInWindow, missionOpen, proofKind, questLocked, questProgress, weekStreak } from "../points";
import * as pdb from "../points-db";
import { expireCodes, redeemBirthdayCode, redeemPointsReward, redeemTier, submitMission } from "../points-flow";
import { formatAward, missionQuarters, questProgressLabel } from "../quest-stamp";
import { loadBirthdayNotice } from "../birthday-gate";
import { brandOpen, pickLiveBrand } from "../brands";
import { mustVerify } from "../wa";
import { qrSvg } from "../qr";
import * as repo from "../repo";
import { loadMember, loadSignup } from "../session";
import { catalogPage, codePage, messagePage, missionDetailPage, missionsPage } from "../view";
import type { App } from "./customer";

function go(path: string, code: string): Response {
  return redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(code)}`);
}

export async function handleShop(app: App): Promise<Response | null> {
  const { request, env, url, now } = app;
  const path = url.pathname;
  const shop =
    path === "/misi" ||
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

  if (path === "/misi" && request.method === "GET") {
    const missions = (await pdb.listMissions(db, true)).filter((mission) => missionInWindow(mission.starts_at, mission.ends_at, now));
    const brands = await repo.listBrands(db, true);
    const earned = await pdb.lifetimeEarned(db, member.id);
    const streak = weekStreak(await pdb.visitMarks(db, member.id), now);
    const celebrate = url.searchParams.get("ok") === "stampquest";
    const picked = pickLiveBrand(brands, url.searchParams.get("merek"));
    const card = picked ? await repo.getCard(db, member.id, picked.id) : null;
    const view = [];
    for (const mission of missions) {
      const state = await pdb.memberMissionState(db, member.id, mission.id);
      const locked = questLocked({ mystery: mission.mystery === 1, unlockTenths: mission.unlock_points_tenths, lifetimeTenths: earned });
      const open =
        !locked &&
        missionOpen({
          limit: "once",
          hasPending: state.pending,
          lastApprovedAt: state.lastApprovedAt,
          now,
        });
      const progress = questProgress({ limit: "once", pending: state.pending, lastApprovedAt: state.lastApprovedAt, now });
      view.push({
        id: mission.id,
        title: mission.title,
        description: mission.description,
        points: formatAward(missionQuarters(mission)),
        limit: "Sekali saja",
        needShot: proofKind(mission) === "upload",
        needLink: proofKind(mission) === "link",
        cashier: proofKind(mission) === "cashier",
        open,
        brand: brands.find((b) => b.id === mission.brand_id)?.short_name || "Semua merek",
        icon: mission.icon || "🍃",
        tag: mission.tag === "new" || mission.tag === "limited" ? mission.tag : "",
        locked,
        tease: mission.tease || "",
        unlock: formatPoints(mission.unlock_points_tenths),
        pct: progress.pct,
        done: progress.done,
        statusLabel: progress.label,
      });
    }
    return html(
      missionsPage({
        stamps: card?.stamps || 0,
        progress: questProgressLabel(card?.remainder_quarters || 0),
        streak,
        celebrate,
        brand: picked,
        missions: view,
        params: url.searchParams,
      }),
    );
  }

  const missionDetail = path.startsWith("/misi/") && request.method === "GET" ? decodeURIComponent(path.slice("/misi/".length)) : "";
  if (missionDetail && !missionDetail.includes("/")) {
    const mission = await pdb.getMission(db, missionDetail);
    if (!mission || !mission.active || !missionInWindow(mission.starts_at, mission.ends_at, now)) return go("/misi", "umum");
    if (!brandOpen(mission.brand_id ? await repo.getBrand(db, mission.brand_id) : null)) return go("/misi", "merek");
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
      }),
    );
  }

  if (path.startsWith("/misi/") && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const id = decodeURIComponent(path.slice("/misi/".length));
    const form = await request.formData();
    const mission = await pdb.getMission(db, id);
    if (!mission) return go("/misi", "umum");
    let link = httpsUrl(String(form.get("link") || ""));
    let r2Key: string | null = null;
    const file = form.get("gambar");
    if (file instanceof File && file.size > 0) {
      const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
      if (file.size > 2_000_000 || !allowed.has(file.type)) return go("/misi", "gambar");
      const keyId = randomId();
      r2Key = `missions/${keyId}`;
      await env.BANNERS.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } });
    }
    const result = await submitMission(db, { member, missionId: id, link, r2Key, now });
    if (!result.ok) return go("/misi", result.error);
    const merek = mission.brand_id ? `&merek=${encodeURIComponent(mission.brand_id)}` : "";
    return redirect(result.stampsAdded > 0 ? `/misi?ok=stampquest${merek}` : `/misi?ok=misi${merek}`);
  }

  if (path === "/hadiah" && request.method === "GET") {
    const brands = await repo.listBrands(db, true);
    const brand = pickLiveBrand(brands, url.searchParams.get("merek"));
    if (!brand) return html(messagePage("Kosong", "Belum ada merek."));
    const card = await repo.getCard(db, member.id, brand.id);
    const stamps = card?.stamps || 0;
    const rewards = await pdb.listTiers(db, brand.id);
    const birthday = await loadBirthdayNotice(db, member, brand, now);
    return html(
      catalogPage({
        stamps,
        brandName: brand.short_name,
        brand,
        brands: brands.map((b) => ({ id: b.id, name: b.short_name, on: b.id === brand.id })),
        rewards: rewards.map((r) => ({
          id: r.id,
          title: r.reward_text,
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
