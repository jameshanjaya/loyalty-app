import { birthdayWaitLine, toBirthdayRule } from "../birthday";
import { birthdayError, birthdayGate } from "../birthday-gate";
import { brandOpen } from "../brands";
import { maskName } from "../format";
import type { Brand, Member } from "../types";
import { html, json, readCookie, redirect, sameOrigin } from "../http";
import { errText } from "../messages";
import { normalizeWa } from "../phone";
import { qrSvg } from "../qr";
import * as repo from "../repo";
import { CASHIER_SESSION_MS, canCancel } from "../loyalty";
import { LIMITS, enforceLimit } from "../ratelimit";
import { confirmRedeemCode, expireCodes, grantCashierMission } from "../points-flow";
import { formatPoints, missionInWindow, missionOpen, proofKind, questLocked } from "../points";
import * as pdb from "../points-db";
import { cancelOwn, giveBirthday, loginCashier, manualRedeem, manualStamp, openClaim } from "../service";
import { clearCookie, COOKIE, loadCashier, setSessionCookie } from "../session";
import { signClaim } from "../tokens";
import { clock } from "../time";
import {
  cashierCodePage,
  cashierDeskPage,
  cashierLoginPage,
  cashierQrPage,
  confirmBirthdayPage,
  confirmRedeemPage,
  emptyDbPage,
  messagePage,
} from "../view";
import type { App } from "./customer";

function go(path: string, code: string, extra = ""): Response {
  const join = path.includes("?") ? "&" : "?";
  return redirect(`${path}${join}err=${encodeURIComponent(code)}${extra}`);
}

export async function handleCashier(app: App): Promise<Response | null> {
  const { request, env, url, now, ip } = app;
  const db = env.DB;
  const path = url.pathname;
  if (path !== "/kasir" && !path.startsWith("/kasir/")) return null;

  if (path === "/kasir" && request.method === "GET") {
    const parked = readCookie(request.headers.get("cookie"), COOKIE.cashier);
    if (parked && !url.searchParams.get("err") && (await hiddenCashierBrand(db, parked))) return redirect("/kasir?err=merek");
    const outlets = await repo.listOutlets(db);
    const brands = await repo.listBrands(db, true);
    if (!brands.length) return html(emptyDbPage());
    const view = outlets
      .filter((o) => o.active && brandOpen(brands.find((b) => b.id === o.brand_id)))
      .map((o) => {
        const brand = brands.find((b) => b.id === o.brand_id);
        return { ...o, brand_name: brand?.name || "", emoji: brand?.emoji || "🍵", accent: brand?.accent || "#6ea564" };
      })
      .filter((o) => o.brand_name);
    if (!view.length) {
      return html(messagePage("Belum ada outlet", "Owner perlu menambah outlet dan PIN dulu, lewat dashboard.", "/admin", "Ke dashboard"));
    }
    return html(cashierLoginPage(view, url.searchParams));
  }

  if (path === "/kasir/masuk" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const form = await request.formData();
    const result = await loginCashier(db, env, {
      outletId: String(form.get("outlet_id") || ""),
      pin: String(form.get("pin") || ""),
      ip,
      now,
    });
    if (!result.ok) return redirect(`/kasir?err=${encodeURIComponent(result.error)}`);
    return redirect("/kasir/meja", [setSessionCookie(request, COOKIE.cashier, result.sessionId, CASHIER_SESSION_MS)]);
  }

  const cashier = await loadCashier(request, db, now);
  if (!cashier && path !== "/kasir/keluar") {
    const parked = readCookie(request.headers.get("cookie"), COOKIE.cashier);
    if (parked && (await hiddenCashierBrand(db, parked))) return redirect("/kasir?err=merek");
    return redirect("/kasir");
  }

  if (path === "/kasir/keluar" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const sid = readCookie(request.headers.get("cookie"), COOKIE.cashier);
    if (sid) await repo.deleteSession(db, sid);
    return redirect("/kasir", [clearCookie(request, COOKIE.cashier)]);
  }

  if (!cashier) return redirect("/kasir");

  if (path === "/kasir/meja" && request.method === "GET") {
    await expireCodes(db, now);
    const feed = await repo.outletFeed(db, cashier.outlet.id);
    const last = await repo.latestOpenActivity(db, cashier.sessionId);
    const cancelId =
      last && canCancel({ createdAt: last.created_at, now, sameSession: true, voided: false, isLast: true }) ? last.id : null;
    let found: { member: Member; stamps: number; birthdayOpen: boolean; birthdayLine: string | null; quests: Array<{ id: string; title: string; points: string }> } | null = null;
    const waRaw = url.searchParams.get("wa") || "";
    const wa = waRaw ? normalizeWa(waRaw) : null;
    if (wa) {
      const limited = await enforceLimit(db, `look:${cashier.sessionId}`, now, LIMITS.lookup);
      if (!limited.ok) return redirect("/kasir/meja?err=cari");
      const member = await repo.getMemberByWa(db, wa);
      if (!member) return redirect("/kasir/meja?err=belum");
      const card = await repo.ensureCard(db, member.id, cashier.brand.id, now);
      const desk = await birthdayDesk(db, member, cashier.brand, now);
      const quests = [];
      const earned = await pdb.lifetimeEarned(db, member.id);
      for (const mission of await pdb.listMissions(db, true)) {
        if (proofKind(mission) !== "cashier") continue;
        if (mission.brand_id && mission.brand_id !== cashier.brand.id) continue;
        if (!missionInWindow(mission.starts_at, mission.ends_at, now)) continue;
        if (questLocked({ mystery: mission.mystery === 1, unlockTenths: mission.unlock_points_tenths, lifetimeTenths: earned })) continue;
        const state = await pdb.memberMissionState(db, member.id, mission.id);
        const limit = mission.limit_kind === "week" ? "week" : "once";
        if (!missionOpen({ limit, hasPending: state.pending, lastApprovedAt: state.lastApprovedAt, now })) continue;
        quests.push({ id: mission.id, title: mission.title, points: formatPoints(mission.points_tenths) });
      }
      found = { member, stamps: card.stamps, birthdayOpen: desk.open, birthdayLine: desk.line, quests };
    }
    return html(
      cashierDeskPage({
        outlet: cashier.outlet,
        brand: cashier.brand,
        feed,
        cancelId,
        found,
        now,
        params: url.searchParams,
      }),
    );
  }

  if (request.method === "POST" && !sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);

  if (path === "/kasir/misi" && request.method === "POST") {
    const limited = await enforceLimit(db, `issue:${cashier.sessionId}`, now, LIMITS.cashierIssue);
    if (!limited.ok) return go("/kasir/meja", "cepat");
    const form = await request.formData();
    const member = await repo.getMember(db, String(form.get("member_id") || ""));
    if (!member) return go("/kasir/meja", "belum");
    const result = await grantCashierMission(db, { member, missionId: String(form.get("mission_id") || ""), brandId: cashier.brand.id, now });
    if (!result.ok) return go(`/kasir/meja?wa=${encodeURIComponent(member.wa)}`, result.error);
    return redirect(`/kasir/meja?wa=${encodeURIComponent(member.wa)}&ok=misi`);
  }

  if (path === "/kasir/stamp" && request.method === "POST") {
    const form = await request.formData();
    const opened = await openClaim(db, env, {
      outlet: cashier.outlet,
      sessionId: cashier.sessionId,
      kind: "stamp",
      confirmed: form.get("syarat") === "on",
      now,
    });
    if (!opened.ok) return go("/kasir/meja", opened.error);
    return redirect(`/kasir/qr/${opened.id}`);
  }

  if (path === "/kasir/ulangtahun" && request.method === "POST") {
    const form = await request.formData();
    const member = await repo.getMember(db, String(form.get("member_id") || ""));
    if (!member) return go("/kasir/meja", "ultah");
    const blocked = birthdayError(await birthdayGate(db, member, cashier.brand, now));
    if (blocked) return go("/kasir/meja", blocked);
    const opened = await openClaim(db, env, {
      outlet: cashier.outlet,
      sessionId: cashier.sessionId,
      kind: "birthday",
      confirmed: true,
      now,
    });
    if (!opened.ok) return go("/kasir/meja", opened.error);
    return redirect(`/kasir/qr/${opened.id}`);
  }

  if (path === "/kasir/ulangtahun" && request.method === "GET") {
    const member = await repo.getMember(db, url.searchParams.get("member") || "");
    if (!member) return go("/kasir/meja", "belum");
    const blocked = birthdayError(await birthdayGate(db, member, cashier.brand, now));
    if (blocked) return go("/kasir/meja", blocked);
    return html(confirmBirthdayPage({ brand: cashier.brand, member, reward: cashier.brand.birthday_reward }));
  }

  if (path === "/kasir/ulangtahun/manual" && request.method === "POST") {
    const form = await request.formData();
    const member = await repo.getMember(db, String(form.get("member_id") || ""));
    if (!member) return go("/kasir/meja", "belum");
    const paced = await enforceLimit(db, `issue:${cashier.sessionId}`, now, LIMITS.cashierIssue);
    if (!paced.ok) return go("/kasir/meja", "cepat");
    const limited = await giveBirthday(db, {
      member,
      brand: cashier.brand,
      outletId: cashier.outlet.id,
      sessionId: cashier.sessionId,
      claimId: null,
      now,
      note: "nomor WA",
    });
    if (!limited.ok) return go("/kasir/meja", limited.error);
    return redirect(`/kasir/meja?ok=redeem&siapa=${encodeURIComponent(limited.masked)}`);
  }

  if (path === "/kasir/redeem" && request.method === "POST") {
    const opened = await openClaim(db, env, {
      outlet: cashier.outlet,
      sessionId: cashier.sessionId,
      kind: "redeem",
      confirmed: true,
      now,
    });
    if (!opened.ok) return go("/kasir/meja", opened.error);
    return redirect(`/kasir/qr/${opened.id}`);
  }

  if (path === "/kasir/cari" && request.method === "POST") {
    const form = await request.formData();
    const wa = normalizeWa(String(form.get("wa") || ""));
    if (!wa) return go("/kasir/meja", "wa");
    return redirect(`/kasir/meja?wa=${encodeURIComponent(wa)}`);
  }

  if (path === "/kasir/stamp/manual" && request.method === "POST") {
    const form = await request.formData();
    const wa = String(form.get("wa") || "");
    const result = await manualStamp(db, {
      outlet: cashier.outlet,
      brand: cashier.brand,
      sessionId: cashier.sessionId,
      waRaw: wa,
      confirmed: form.get("syarat") === "on",
      now,
    });
    if (!result.ok) return redirect(`/kasir/meja?err=${encodeURIComponent(result.error)}&wa=${encodeURIComponent(wa)}`);
    return redirect(`/kasir/meja?ok=stamp&siapa=${encodeURIComponent(result.masked)}`);
  }

  if (path === "/kasir/tukar" && request.method === "GET") {
    const member = await repo.getMember(db, url.searchParams.get("member") || "");
    if (!member) return go("/kasir/meja", "belum");
    const card = await repo.ensureCard(db, member.id, cashier.brand.id, now);
    if (card.stamps < cashier.brand.stamps_required) return go("/kasir/meja", "kurang");
    return html(confirmRedeemPage({ brand: cashier.brand, member, stamps: card.stamps }));
  }

  if (path === "/kasir/redeem/manual" && request.method === "POST") {
    const form = await request.formData();
    const member = await repo.getMember(db, String(form.get("member_id") || ""));
    if (!member) return go("/kasir/meja", "belum");
    const result = await manualRedeem(db, {
      outlet: cashier.outlet,
      brand: cashier.brand,
      sessionId: cashier.sessionId,
      member,
      now,
    });
    if (!result.ok) return go("/kasir/meja", result.error);
    return redirect(`/kasir/meja?ok=redeem&siapa=${encodeURIComponent(result.masked)}`);
  }

  if (path.startsWith("/kasir/batal/") && request.method === "POST") {
    const activityId = decodeURIComponent(path.slice("/kasir/batal/".length));
    const result = await cancelOwn(db, { sessionId: cashier.sessionId, activityId, now });
    if (!result.ok) return go("/kasir/meja", result.error);
    return redirect("/kasir/meja?ok=batal");
  }

  if (path.startsWith("/kasir/qr/") && request.method === "GET") {
    const rest = path.slice("/kasir/qr/".length);
    const statusPoll = rest.endsWith("/status");
    const id = decodeURIComponent(statusPoll ? rest.slice(0, -"/status".length) : rest);
    const claim = await repo.getClaim(db, id);
    if (!claim || claim.sessionId !== cashier.sessionId) return statusPoll ? json({ status: "missing" }, 404) : go("/kasir/meja", "claim");
    let status: string = claim.status;
    if (status === "pending" && claim.expiresAt <= now) status = "expired";
    let masked: string | null = null;
    if (claim.memberId) {
      const person = await repo.getMember(db, claim.memberId);
      if (person) masked = maskName(person.name, person.wa);
    }
    if (statusPoll) return json({ status, masked });
    const token = await signClaim(
      { id: claim.id, exp: claim.expiresAt, kind: claim.kind, brandId: claim.brandId, outletId: claim.outletId },
      env.TOKEN_SECRET,
    );
    const claimUrl = `${url.origin}/k/${token}`;
    return html(
      cashierQrPage({
        brand: cashier.brand,
        claimId: claim.id,
        kind: claim.kind,
        claimUrl,
        svg: status === "pending" ? qrSvg(claimUrl) : "",
        remainingMs: claim.expiresAt - now,
        status,
        masked,
        when: claim.claimedAt ? clock(claim.claimedAt) : null,
      }),
    );
  }

  if (path.startsWith("/kasir/qr/") && path.endsWith("/batal") && request.method === "POST") {
    const id = decodeURIComponent(path.slice("/kasir/qr/".length, -"/batal".length));
    await repo.markClaimCancelled(db, id, cashier.sessionId);
    return redirect("/kasir/meja");
  }

  if (path === "/kasir/kode" || path.startsWith("/kasir/kode/")) {
    const fromPath = path.startsWith("/kasir/kode/") ? decodeURIComponent(path.slice("/kasir/kode/".length)) : "";
    const filled = /^\d{5}$/.test(fromPath) ? fromPath : "";
    if (request.method === "POST") {
      if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
      const limited = await enforceLimit(db, `kode:${cashier.sessionId}`, now, { windowMs: 10 * 60_000, limit: 15 });
      if (!limited.ok) return go("/kasir/kode", "pinwait");
      const form = await request.formData();
      const result = await confirmRedeemCode(db, {
        brandId: cashier.brand.id,
        code: String(form.get("kode") || ""),
        outletId: cashier.outlet.id,
        sessionId: cashier.sessionId,
        now,
      });
      if (!result.ok) return go("/kasir/kode", result.error);
      return redirect(`/kasir/meja?ok=kode&siapa=${encodeURIComponent(result.masked + " · " + result.label)}`);
    }
    return html(cashierCodePage({ brand: cashier.brand.short_name, code: filled, params: url.searchParams }));
  }

  return html(messagePage("Tidak ketemu", "Halaman kasir itu tidak ada.", "/kasir/meja"), 404);
}

async function birthdayDesk(
  db: D1Database,
  member: Member,
  brand: Brand,
  now: number,
): Promise<{ open: boolean; line: string | null }> {
  const rule = toBirthdayRule(brand);
  if (!member.birthday || !rule.active) return { open: false, line: null };
  const decision = await birthdayGate(db, member, brand, now);
  if (decision === "ok") return { open: true, line: null };
  if (decision === "fresh") return { open: false, line: "Birthday Freebies: tanggal lahir baru, klaim 30 hari lagi" };
  const wibYear = new Date(now + 7 * 60 * 60 * 1000).getUTCFullYear();
  const claimed = new Set(await repo.birthdayClaimedYears(db, member.id, brand.id, wibYear - 1, wibYear + 2));
  return { open: false, line: birthdayWaitLine(member.birthday, now, rule, claimed) };
}

async function hiddenCashierBrand(db: D1Database, sessionId: string): Promise<boolean> {
  const session = await repo.getSession(db, sessionId);
  if (!session || session.kind !== "cashier" || !session.subject_id) return false;
  const outlet = await repo.getOutlet(db, session.subject_id);
  if (!outlet) return false;
  const brand = await repo.getBrand(db, outlet.brand_id);
  return Boolean(brand && !brand.active);
}
