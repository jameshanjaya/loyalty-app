import { randomId } from "../crypto";
import { httpsUrl } from "../format";
import { html, json, redirect, sameOrigin } from "../http";
import { errText } from "../messages";
import { formatPoints, missionOpen, pickLevel, questLocked, questProgress, weekStreak } from "../points";
import * as pdb from "../points-db";
import { expireCodes, redeemBirthdayCode, redeemPointsReward, redeemTier, submitMission } from "../points-flow";
import { qrSvg } from "../qr";
import * as repo from "../repo";
import { loadMember, loadSignup } from "../session";
import { catalogPage, codePage, messagePage, missionsPage } from "../view";
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

  if (path === "/misi" && request.method === "GET") {
    const missions = await pdb.listMissions(db, true);
    const brands = await repo.listBrands(db, false);
    const balance = await pdb.pointsBalance(db, member.id);
    const earned = await pdb.lifetimeEarned(db, member.id);
    const allLevels = await pdb.listLevels(db);
    const globals = allLevels.filter((level) => !level.brand_id);
    const ladder = globals.length ? globals : allLevels;
    const level = pickLevel(
      earned,
      ladder.map((row) => ({ name: row.name, minTenths: row.min_points_tenths, icon: row.icon })),
    );
    const streak = weekStreak(await pdb.visitMarks(db, member.id), now);
    const celebrate = await pdb.recentApproval(db, member.id, now - 3 * 60 * 1000);
    const view = [];
    for (const mission of missions) {
      const state = await pdb.memberMissionState(db, member.id, mission.id);
      const limit = mission.limit_kind === "week" ? "week" : "once";
      const locked = questLocked({ mystery: mission.mystery === 1, unlockTenths: mission.unlock_points_tenths, lifetimeTenths: earned });
      const open =
        !locked &&
        missionOpen({
          limit,
          hasPending: state.pending,
          lastApprovedAt: state.lastApprovedAt,
          now,
        });
      const progress = questProgress({ limit, pending: state.pending, lastApprovedAt: state.lastApprovedAt, now });
      view.push({
        id: mission.id,
        title: mission.title,
        description: mission.description,
        points: formatPoints(mission.points_tenths),
        limit: limit === "week" ? "Sekali seminggu" : "Sekali saja",
        needShot: mission.proof_screenshot === 1,
        needLink: mission.proof_link === 1,
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
    const hint = level.next ? `${formatPoints(level.remaining)} Poin quest lagi menuju ${level.next.name}` : "Level tertinggi. Mantap!";
    return html(
      missionsPage({
        points: formatPoints(balance),
        streak,
        levelName: level.current.name,
        levelIcon: level.current.icon,
        levelPct: Math.round(level.progress * 100),
        levelHint: hint,
        celebrate,
        missions: view,
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
    return redirect("/misi?ok=misi");
  }

  if (path === "/hadiah" && request.method === "GET") {
    const brands = await repo.listBrands(db, true);
    const brand = brands.find((b) => b.id === url.searchParams.get("merek")) || brands[0];
    if (!brand) return html(messagePage("Kosong", "Belum ada merek."));
    const balance = await pdb.pointsBalance(db, member.id);
    const rewards = await pdb.listRewards(db, brand.id, true);
    return html(
      catalogPage({
        points: formatPoints(balance),
        brandName: brand.short_name,
        accent: brand.accent,
        accentSoft: brand.accent_soft,
        brands: brands.map((b) => ({ id: b.id, name: b.short_name, on: b.id === brand.id })),
        rewards: rewards.map((r) => ({
          id: r.id,
          title: r.title,
          cost: formatPoints(r.points_tenths),
          note: r.stock == null ? "" : r.stock === 0 ? "Habis" : `Sisa ${r.stock}`,
          ready: balance >= r.points_tenths && (r.stock == null || r.stock > 0),
          icon: r.icon || "🍵",
          soldOut: r.stock === 0,
        })),
        params: url.searchParams,
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
    if (!result.ok) return go("/kartu", result.error);
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
      }),
    );
  }

  return html(messagePage("Tidak ketemu", "Halaman itu tidak ada.", "/kartu"), 404);
}
