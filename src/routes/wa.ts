import { randomId } from "../crypto";
import { html, json, redirect, sameOrigin } from "../http";
import { errText } from "../messages";
import * as repo from "../repo";
import { enforceLimit, LIMITS } from "../ratelimit";
import { loadMember } from "../session";
import { initiateWhatsappVerify } from "../verify-provider";
import { decideWaVerify, extractVerifyCode, inboundTexts, makeVerifyCode, mustVerify, otpStubOn, waChatLink, waReady, businessNumber, WA_CODE_TTL_MS } from "../wa";
import { messagePage, waPage } from "../view";
import type { App } from "./customer";

type CodeRow = { id: string; member_id: string; wa: string; code: string; expires_at: number; used_at: number | null };

async function openCode(db: D1Database, memberId: string, wa: string, now: number): Promise<CodeRow> {
  const live = await db
    .prepare(`SELECT * FROM wa_codes WHERE member_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`)
    .bind(memberId, now)
    .first<CodeRow>();
  if (live) return live;
  const row: CodeRow = { id: randomId(), member_id: memberId, wa, code: makeVerifyCode(), expires_at: now + WA_CODE_TTL_MS, used_at: null };
  await db
    .prepare(`INSERT INTO wa_codes (id, member_id, wa, code, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)`)
    .bind(row.id, memberId, wa, row.code, row.expires_at, now)
    .run();
  return row;
}

export async function handleWa(app: App): Promise<Response | null> {
  const { request, env, url, now, ip } = app;
  const path = url.pathname;
  const db = env.DB;

  if (path === "/webhook/convia" && request.method === "POST") {
    let token = "";
    try {
      const body = (await request.json()) as { token?: string };
      token = String(body.token || "");
    } catch {
      token = "";
    }
    if (!/^[a-f0-9]{16,64}$/i.test(token)) return json({ ok: false }, 400);
    const memberId = await repo.markVerifyToken(db, token, now);
    return json({ ok: Boolean(memberId) }, memberId ? 200 : 404);
  }

  if (path === "/verifikasi/wa" && request.method === "POST") {
    const member = await loadMember(request, db, now);
    if (!member) return json({ error: "masuk" }, 401);
    const start = initiateWhatsappVerify({ CONVIA_ONETAP_API_KEY: (env as { CONVIA_ONETAP_API_KEY?: string }).CONVIA_ONETAP_API_KEY }, member.wa);
    if (!start) return json({ error: "wa" }, 400);
    await repo.insertVerifySession(db, {
      id: randomId(),
      memberId: member.id,
      phone: start.phone,
      token: start.token,
      deepLink: start.deepLink,
      now,
    });
    return json({ deepLink: start.deepLink, phone: start.phone, token: start.token });
  }

  if (path === "/webhook/whatsapp" && request.method === "GET") {
    if (!waReady(env)) return new Response("Not found", { status: 404 });
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (mode === "subscribe" && token === env.WA_VERIFY_TOKEN && challenge.length < 256) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }

  if (path === "/webhook/whatsapp" && request.method === "POST") {
    if (!waReady(env)) return new Response("Not found", { status: 404 });
    const limited = await enforceLimit(env.DB, `wa:${ip}`, now, LIMITS.waHook);
    if (!limited.ok) return new Response("Too many", { status: 429 });
    const raw = await request.text();
    if (raw.length > 100_000) return new Response("Bad request", { status: 400 });
    if (env.WA_APP_SECRET && !(await signed(raw, request.headers.get("x-hub-signature-256"), env.WA_APP_SECRET))) {
      return new Response("Forbidden", { status: 403 });
    }
    let payload: unknown = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    for (const message of inboundTexts(payload)) {
      const code = extractVerifyCode(message.text);
      if (!code) continue;
      const row = await env.DB.prepare(`SELECT * FROM wa_codes WHERE code = ? ORDER BY created_at DESC LIMIT 1`).bind(code).first<CodeRow>();
      if (!row) continue;
      const member = await repo.getMember(env.DB, row.member_id);
      if (!member) continue;
      const decision = decideWaVerify({
        body: message.text,
        sender: message.from,
        code: row.code,
        memberWa: member.wa,
        expiresAt: row.expires_at,
        now,
        used: row.used_at != null,
      });
      if (decision !== "ok") continue;
      const taken = await env.DB.prepare(`SELECT id FROM members WHERE wa = ? AND id != ? AND wa_verified = 1 LIMIT 1`).bind(member.wa, member.id).first<{ id: string }>();
      if (taken) continue;
      const marked = await env.DB.prepare(`UPDATE wa_codes SET used_at = ? WHERE id = ? AND used_at IS NULL`).bind(now, row.id).run();
      if (marked.meta.changes !== 1) continue;
      await repo.setPhoneVerified(env.DB, member.id, 1);
    }
    return new Response("OK", { status: 200 });
  }

  if (path !== "/verifikasi" && path !== "/verifikasi/status" && path !== "/verifikasi/otp") return null;
  if (!waReady(env)) return redirect("/kartu");
  const member = await loadMember(request, env.DB, now);
  if (!member) return path.endsWith("/status") ? json({ status: "missing" }, 401) : redirect("/masuk");
  if (member.wa_verified === 1 && path.endsWith("/status")) return json({ status: "verified" });
  if (member.wa_verified === 1) {
    return html(waPage({ phase: "done", link: "", code: "", otp: false, brand: (await repo.listBrands(env.DB, true))[0] || null }));
  }

  if (path === "/verifikasi/otp") {
    if (!otpStubOn(env)) return redirect("/verifikasi");
    return html(messagePage("OTP belum nyala", "Kirim kode OTP ke WA belum diaktifkan. Pakai tombol Verifikasi via WA ya.", "/verifikasi", "Kembali"));
  }

  if (path === "/verifikasi/status") return json({ status: "pending" });

  if (request.method !== "GET") {
    if (!sameOrigin(request)) return html(messagePage("Ditolak", errText("csrf") || ""), 403);
  }
  const limited = await enforceLimit(env.DB, `wacode:${member.id}`, now, LIMITS.waIssue);
  if (!limited.ok) return html(messagePage("Tunggu sebentar", "Kode verifikasinya kebanyakan. Coba lagi nanti.", "/kartu", "Ke kartu"), 429);
  const code = await openCode(env.DB, member.id, member.wa, now);
  const brand = (await repo.listBrands(env.DB, true))[0] || null;
  const waiting = url.searchParams.get("tunggu") === "1";
  return html(
    waPage({
      phase: waiting ? "wait" : "ask",
      link: waChatLink(businessNumber(env), code.code),
      code: code.code,
      otp: otpStubOn(env),
      brand,
      remainingMs: code.expires_at - now,
    }),
  );
}

async function signed(body: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const expected = `sha256=${hex}`;
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

export { mustVerify };
