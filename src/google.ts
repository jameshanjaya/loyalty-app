import { bytesToB64Url, b64UrlToBytes, hmacRaw, timingSafeEqual } from "./crypto";

export type GoogleIdentity = {
  sub: string;
  email: string | null;
  name: string;
};

export type OAuthState = {
  state: string;
  nonce: string;
  intent: "login" | "link";
  memberId: string;
  exp: number;
};

type Jwk = JsonWebKey & { kid?: string };

export function googleReady(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CLIENT_ID.length > 8 && env.GOOGLE_CLIENT_SECRET.length > 8);
}

export function googleAuthUrl(input: { clientId: string; redirectUri: string; state: string; nonce: string }): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function sealOAuthState(payload: OAuthState, secret: string): Promise<string> {
  const body = bytesToB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = bytesToB64Url((await hmacRaw(secret, `oauth:${body}`)).slice(0, 16));
  return `${body}.${sig}`;
}

export async function openOAuthState(token: string, secret: string, now: number): Promise<OAuthState | null> {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = bytesToB64Url((await hmacRaw(secret, `oauth:${body}`)).slice(0, 16));
  const a = b64UrlToBytes(sig);
  const b = b64UrlToBytes(expected);
  if (!a || !b || !(await timingSafeEqual(a, b))) return null;
  const raw = b64UrlToBytes(body);
  if (!raw) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(raw)) as OAuthState;
    if (!payload.state || !payload.nonce || payload.exp < now) return null;
    if (payload.intent !== "login" && payload.intent !== "link") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string | null> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { id_token?: string };
  return json.id_token || null;
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  nonce: string,
  nowSec: number,
): Promise<GoogleIdentity | null> {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const headerRaw = b64UrlToBytes(parts[0] || "");
  if (!headerRaw) return null;
  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(headerRaw)) as { alg?: string; kid?: string };
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;
  const certs = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!certs.ok) return null;
  const jwks = (await certs.json()) as { keys?: Jwk[] };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const sig = b64UrlToBytes(parts[2] || "");
  if (!sig) return null;
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) return null;
  const payloadRaw = b64UrlToBytes(parts[1] || "");
  if (!payloadRaw) return null;
  const payload = JSON.parse(new TextDecoder().decode(payloadRaw)) as {
    iss?: string;
    aud?: string | string[];
    exp?: number;
    nonce?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  const audOk = payload.aud === clientId || (Array.isArray(payload.aud) && payload.aud.includes(clientId));
  const issOk = payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";
  if (!audOk || !issOk || !payload.sub || !payload.exp || payload.exp < nowSec) return null;
  if (payload.nonce !== nonce) return null;
  const email = payload.email_verified && payload.email ? payload.email : payload.email || null;
  const name = (payload.name || email?.split("@")[0] || "Teman").slice(0, 40);
  return { sub: payload.sub, email, name };
}
