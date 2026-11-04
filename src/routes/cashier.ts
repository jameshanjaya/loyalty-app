import { maskName } from "../format";
import type { Member } from "../types";
import { html, json, readCookie, redirect, sameOrigin } from "../http";
import { errText } from "../messages";
import { normalizeWa } from "../phone";
import { qrSvg } from "../qr";
import * as repo from "../repo";
import { CASHIER_SESSION_MS, canCancel } from "../loyalty";
import { LIMITS, enforceLimit } from "../ratelimit";
import { cancelOwn, loginCashier, manualRedeem, manualStamp, openClaim } from "../service";
import { clearCookie, COOKIE, loadCashier, setSessionCookie } from "../session";
import { signClaim } from "../tokens";
import { clock } from "../time";
import {
  cashierDeskPage,
  cashierLoginPage,
  cashierQrPage,
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
    const outlets = await repo.listOutlets(db);
    const brands = await repo.listBrands(db, false);
    if (!brands.length) return html(emptyDbPage());
    const view = outlets
      .filter((o) => o.active)
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
  if (!cashier && path !== "/kasir/keluar") return redirect("/kasir");

  if (path === "/kasir/keluar" && request.method === "POST") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
    const sid = readCookie(request.headers.get("cookie"), COOKIE.cashier);
    if (sid) await repo.deleteSession(db, sid);
    return redirect("/kasir", [clearCookie(request, COOKIE.cashier)]);
  }

  if (!cashier) return redirect("/kasir");

  if (path === "/kasir/meja" && request.method === "GET") {
    const feed = await repo.outletFeed(db, cashier.outlet.id);
    const last = await repo.latestOpenActivity(db, cashier.sessionId);
    const cancelId =
      last && canCancel({ createdAt: last.created_at, now, sameSession: true, voided: false, isLast: true }) ? last.id : null;
    let found: { member: Member; stamps: number } | null = null;
    const waRaw = url.searchParams.get("wa") || "";
    const wa = waRaw ? normalizeWa(waRaw) : null;
    if (wa) {
      const limited = await enforceLimit(db, `look:${cashier.sessionId}`, now, LIMITS.lookup);
      if (!limited.ok) return redirect("/kasir/meja?err=cari");
      const member = await repo.getMemberByWa(db, wa);
      if (!member) return redirect("/kasir/meja?err=belum");
      const card = await repo.ensureCard(db, member.id, cashier.brand.id, now);
      found = { member, stamps: card.stamps };
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

  return html(messagePage("Tidak ketemu", "Halaman kasir itu tidak ada.", "/kasir/meja"), 404);
}
