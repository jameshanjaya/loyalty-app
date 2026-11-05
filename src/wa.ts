import { normalizeWa } from "./phone";

export const WA_CODE_TTL_MS = 10 * 60 * 1000;

type WaEnv = {
  WA_BUSINESS_NUMBER?: string;
  WA_VERIFY_TOKEN?: string;
  WA_ACCESS_TOKEN?: string;
  WA_APP_SECRET?: string;
  WA_OTP_ENABLED?: string;
};

export function waReady(env: WaEnv): boolean {
  const number = (env.WA_BUSINESS_NUMBER || "").replace(/\D/g, "");
  const token = env.WA_VERIFY_TOKEN || "";
  return number.length >= 10 && token.length >= 8;
}

export function otpStubOn(env: WaEnv): boolean {
  return env.WA_OTP_ENABLED === "1";
}

export function businessNumber(env: WaEnv): string {
  return (env.WA_BUSINESS_NUMBER || "").replace(/\D/g, "");
}

export function makeVerifyCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return `VERIF-${String(buf[0]! % 1_000_000).padStart(6, "0")}`;
}

export function waChatLink(business: string, code: string): string {
  return `https://wa.me/${business.replace(/\D/g, "")}?text=${encodeURIComponent(code)}`;
}

export function extractVerifyCode(text: string): string | null {
  const found = text.toUpperCase().match(/VERIF-\d{6}/);
  return found ? found[0] : null;
}

export function samePhone(a: string, b: string): boolean {
  const left = normalizeWa(a);
  const right = normalizeWa(b);
  return Boolean(left && right && left === right);
}

export type WaDecision = "ok" | "expired" | "used" | "mismatch" | "wrong_number";

export function decideWaVerify(input: {
  body: string;
  sender: string;
  code: string;
  memberWa: string;
  expiresAt: number;
  now: number;
  used: boolean;
}): WaDecision {
  const found = extractVerifyCode(input.body);
  if (!found || found !== input.code.toUpperCase()) return "mismatch";
  if (input.used) return "used";
  if (input.now > input.expiresAt) return "expired";
  if (!samePhone(input.sender, input.memberWa)) return "wrong_number";
  return "ok";
}

export function inboundTexts(payload: unknown): Array<{ from: string; text: string }> {
  const out: Array<{ from: string; text: string }> = [];
  if (!payload || typeof payload !== "object") return out;
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = entry && typeof entry === "object" ? (entry as { changes?: unknown }).changes : null;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = change && typeof change === "object" ? (change as { value?: { messages?: unknown } }).value : null;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        const from = String((message as { from?: unknown }).from || "");
        const textBody = (message as { text?: { body?: unknown } }).text?.body;
        const button = (message as { button?: { text?: unknown } }).button?.text;
        const text = String(textBody || button || "");
        if (from && text) out.push({ from, text });
        if (out.length >= 20) return out;
      }
    }
  }
  return out;
}

export function mustVerify(env: WaEnv, member: { wa_verified?: number } | null): boolean {
  return Boolean(member && waReady(env) && member.wa_verified === 0);
}
