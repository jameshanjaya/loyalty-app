import { cookieHeader, isSecure, readCookie } from "./http";
import { MEMBER_SESSION_MS, MEMBER_SESSION_REFRESH_MS, memberSessionDue } from "./loyalty";
import * as repo from "./repo";
import type { Brand, Member, Outlet } from "./types";

export const COOKIE = { member: "lb_member", cashier: "lb_cashier", owner: "lb_owner" };

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
  const session = await liveSession(db, readCookie(request.headers.get("cookie"), COOKIE.member), "member", now);
  if (!session?.subject_id) return null;
  return repo.getMember(db, session.subject_id);
}

export async function loadCashier(
  request: Request,
  db: D1Database,
  now: number,
): Promise<{ sessionId: string; outlet: Outlet; brand: Brand } | null> {
  const id = readCookie(request.headers.get("cookie"), COOKIE.cashier);
  const session = await liveSession(db, id, "cashier", now);
  if (!session?.subject_id || !id) return null;
  const outlet = await repo.getOutlet(db, session.subject_id);
  if (!outlet?.active) return null;
  const brand = await repo.getBrand(db, outlet.brand_id);
  if (!brand?.active) return null;
  return { sessionId: id, outlet, brand };
}

export async function loadOwner(request: Request, db: D1Database, now: number): Promise<string | null> {
  const id = readCookie(request.headers.get("cookie"), COOKIE.owner);
  const session = await liveSession(db, id, "owner", now);
  return session ? id : null;
}

/** Kalau sesi member sudah lebih dari sehari sejak diperpanjang, kembalikan cookie 365 hari yang baru. */
export async function renewMemberCookie(request: Request, db: D1Database, now: number): Promise<string | null> {
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
