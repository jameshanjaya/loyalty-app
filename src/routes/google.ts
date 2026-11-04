import { randomId } from "../crypto";
import { exchangeGoogleCode, googleAuthUrl, googleReady, openOAuthState, sealOAuthState, verifyGoogleIdToken } from "../google";
import { cookieHeader, html, isSecure, readCookie, redirect } from "../http";
import { errText } from "../messages";
import { profileComplete } from "../profile";
import * as repo from "../repo";
import { MEMBER_SESSION_MS } from "../loyalty";
import { clearCookie, COOKIE, loadMember, setSessionCookie } from "../session";
import { messagePage } from "../view";
import type { App } from "./customer";

const OAUTH_COOKIE = "lb_google";

export async function handleGoogle(app: App): Promise<Response | null> {
  const { request, env, url, now } = app;
  const path = url.pathname;
  if (path !== "/masuk/google" && path !== "/auth/google/callback") return null;
  const redirectUri = `${url.origin}/auth/google/callback`;

  if (path === "/masuk/google" && request.method === "GET") {
    if (!googleReady(env) || !env.TOKEN_SECRET) return redirect("/masuk?err=google-off");
    const intent = url.searchParams.get("niat") === "hubung" ? "link" : "login";
    let memberId = "";
    if (intent === "link") {
      const member = await loadMember(request, env.DB, now);
      if (!member) return redirect("/masuk");
      if (member.google_sub) return redirect("/kartu?err=google-lain");
      memberId = member.id;
    }
    const state = randomId();
    const nonce = randomId();
    const sealed = await sealOAuthState({ state, nonce, intent, memberId, exp: now + 10 * 60_000 }, env.TOKEN_SECRET);
    const next = googleAuthUrl({ clientId: env.GOOGLE_CLIENT_ID, redirectUri, state, nonce });
    return redirect(next, [cookieHeader(OAUTH_COOKIE, sealed, 600, isSecure(request))]);
  }

  if (path === "/auth/google/callback" && request.method === "GET") {
    const fail = (code: string) => html(messagePage("Login Google", errText(code) || "Gagal", "/masuk", "Ke halaman masuk"), 400);
    if (!googleReady(env) || !env.TOKEN_SECRET) return fail("google-off");
    const sealed = readCookie(request.headers.get("cookie"), OAUTH_COOKIE);
    const saved = sealed ? await openOAuthState(sealed, env.TOKEN_SECRET, now) : null;
    const code = url.searchParams.get("code") || "";
    if (!saved || !code || saved.state !== (url.searchParams.get("state") || "")) return fail("google");
    const idToken = await exchangeGoogleCode({
      code,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    });
    if (!idToken) return fail("google");
    const identity = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID, saved.nonce, Math.floor(now / 1000));
    if (!identity) return fail("google");
    const clear = clearCookie(request, OAUTH_COOKIE);

    if (saved.intent === "link") {
      const member = await repo.getMember(env.DB, saved.memberId);
      if (!member) return fail("google");
      const other = await repo.getMemberByGoogle(env.DB, identity.sub);
      if (other && other.id !== member.id) return fail("google-lain");
      await repo.setMemberGoogle(env.DB, member.id, identity.sub, identity.email, "link");
      return redirect("/kartu?ok=simpan", [clear]);
    }

    const existing = await repo.getMemberByGoogle(env.DB, identity.sub);
    if (existing) {
      const sessionId = randomId();
      await repo.createSession(env.DB, {
        id: sessionId,
        kind: "member",
        subjectId: existing.id,
        now,
        expiresAt: now + MEMBER_SESSION_MS,
      });
      const dest = profileComplete({
        name: existing.name,
        wa: existing.wa,
        birthday: existing.birthday,
        joinMethod: existing.join_method,
      })
        ? "/kartu"
        : "/profil";
      return redirect(dest, [setSessionCookie(request, COOKIE.member, sessionId, MEMBER_SESSION_MS), clear]);
    }

    const previous = await repo.getPendingBySub(env.DB, identity.sub);
    const pendingId = previous?.id || randomId();
    await repo.upsertPending(env.DB, {
      id: pendingId,
      sub: identity.sub,
      email: identity.email,
      name: identity.name,
      created_at: previous?.created_at || now,
    });
    const sessionId = randomId();
    await repo.createSession(env.DB, {
      id: sessionId,
      kind: "signup",
      subjectId: pendingId,
      now,
      expiresAt: now + 2 * 60 * 60 * 1000,
    });
    return redirect("/profil", [setSessionCookie(request, COOKIE.member, sessionId, 2 * 60 * 60 * 1000), clear]);
  }

  return html(messagePage("Tidak ketemu", "Halaman itu tidak ada."), 404);
}
