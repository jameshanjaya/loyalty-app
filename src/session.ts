import { cookieHeader, isSecure, readCookie } from "./http";
import { MEMBER_SESSION_MS, MEMBER_SESSION_REFRESH_MS, memberSessionDue } from "./loyalty";
import { ownerSessionCurrent } from "./owner-password";
import * as repo from "./repo";
import type { Brand, Member, Outlet } from "./types";

export const COOKIE = { member: "lb_member", cashier: "lb_cashier", owner: "lb_owner" };

const sessionPeek = new WeakMap<Request, { id: string; expiresAt: number; kind: string }>();

export function peekRequestSession(request: Request): { id: string; expiresAt: number; kind: string } | null {
  return sessionPeek.get(request) || null;
}

async function liveSession(db: D1Database, id: string | null, kind: string, now: number) {
  if (!id) return null;
  const session = await repo.getSession(db, id);
  if (!session || session.expires_at < now) {
    if (session) await repo.deleteSession(db, id);
    return null;
  }
  if (session.kind !== kind) return null;
  return session;
}

export async function loadSignup(request: Request, db: D1Database, now: number) {
  const session = await liveSession(db, readCookie(request.headers.get("cookie"), COOKIE.member), "signup", now);
  if (!session?.subject_id) return null;
  const pending = await repo.getPending(db, session.subject_id);
  if (!pending) return null;
  return { sessionId: session.id, pending };
}

export async function loadMember(request: Request, db: D1Database, now: number): Promise<Member | null> {
  const id = readCookie(request.headers.get("cookie"), COOKIE.member);
  if (!id) return null;
  const row = await db
    .prepare(
      `SELECT m.*, s.expires_at AS __exp FROM sessions s JOIN members m ON m.id = s.subject_id
       WHERE s.id = ? AND s.kind = 'member' AND s.expires_at >= ?`,
    )
    .bind(id, now)
    .first<Member & { __exp: number }>();
  if (!row) return null;
  sessionPeek.set(request, { id, expiresAt: row.__exp, kind: "member" });
  const member = { ...row };
  delete (member as { __exp?: number }).__exp;
  return member;
}

export async function loadCashier(
  request: Request,
  db: D1Database,
  now: number,
): Promise<{ sessionId: string; outlet: Outlet; brand: Brand } | null> {
  const id = readCookie(request.headers.get("cookie"), COOKIE.cashier);
  if (!id) return null;
  const row = await db
    .prepare(
      `SELECT o.id AS outlet_id, o.brand_id AS outlet_brand, o.name AS outlet_name, o.pin_hash, o.pin_salt, o.wa AS outlet_wa,
              o.active AS outlet_active, o.created_at AS outlet_created, o.slug AS outlet_slug,
              b.*
       FROM sessions s
       JOIN outlets o ON o.id = s.subject_id
       JOIN brands b ON b.id = o.brand_id
       WHERE s.id = ? AND s.kind = 'cashier' AND s.expires_at >= ? AND o.active = 1 AND b.active = 1`,
    )
    .bind(id, now)
    .first<Brand & { outlet_id: string; outlet_brand: string; outlet_name: string; pin_hash: string; pin_salt: string; outlet_wa: string; outlet_active: number; outlet_created: number; outlet_slug: string | null }>();
  if (!row) return null;
  const outlet: Outlet = {
    id: row.outlet_id,
    brand_id: row.outlet_brand,
    name: row.outlet_name,
    pin_hash: row.pin_hash,
    pin_salt: row.pin_salt,
    wa: row.outlet_wa || "",
    active: row.outlet_active,
    created_at: row.outlet_created,
    slug: row.outlet_slug,
  };
  const brand = { ...row } as Brand;
  return { sessionId: id, outlet, brand };
}

export async function loadOwner(request: Request, db: D1Database, now: number): Promise<string | null> {
  const id = readCookie(request.headers.get("cookie"), COOKIE.owner);
  if (!id) return null;
  const row = await db
    .prepare(
      `SELECT s.subject_id AS subject_id,
              (SELECT value FROM settings WHERE key = 'owner_session_version') AS version
       FROM sessions s WHERE s.id = ? AND s.kind = 'owner' AND s.expires_at >= ?`,
    )
    .bind(id, now)
    .first<{ subject_id: string | null; version: string | null }>();
  if (!row) return null;
  if (!ownerSessionCurrent(row.subject_id, row.version)) {
    await repo.deleteSession(db, id);
    return null;
  }
  return id;
}

/** Kalau sesi member sudah lebih dari sehari sejak diperpanjang, kembalikan cookie 365 hari yang baru. */
export async function renewMemberCookie(request: Request, db: D1Database, now: number): Promise<string | null> {
  const peeked = sessionPeek.get(request);
  if (peeked?.kind === "member") {
    if (!memberSessionDue({ expiresAt: peeked.expiresAt, now, lifetimeMs: MEMBER_SESSION_MS, refreshAfterMs: MEMBER_SESSION_REFRESH_MS })) return null;
    await repo.extendSession(db, peeked.id, now + MEMBER_SESSION_MS);
    return setSessionCookie(request, COOKIE.member, peeked.id, MEMBER_SESSION_MS);
  }
  const id = readCookie(request.headers.get("cookie"), COOKIE.member);
  if (!id) return null;
  const session = await repo.getSession(db, id);
  if (!session || session.kind !== "member" || !session.subject_id) return null;
  if (!memberSessionDue({ expiresAt: session.expires_at, now, lifetimeMs: MEMBER_SESSION_MS, refreshAfterMs: MEMBER_SESSION_REFRESH_MS })) {
    return null;
  }
  await repo.extendSession(db, session.id, now + MEMBER_SESSION_MS);
  return setSessionCookie(request, COOKIE.member, session.id, MEMBER_SESSION_MS);
}

export function setSessionCookie(request: Request, name: string, id: string, maxAgeMs: number): string {
  return cookieHeader(name, id, Math.floor(maxAgeMs / 1000), isSecure(request));
}

export function clearCookie(request: Request, name: string): string {
  return cookieHeader(name, "", 0, isSecure(request));
}
