import { normalizeWa } from "./phone";

export type VerifyEnv = {
  CONVIA_ONETAP_API_KEY?: string;
};

export type VerifyStart = {
  token: string;
  deepLink: string;
  phone: string;
};

/**
 * Plug-in point for Convia OneTap.
 * The real call is POST https://api.convia.id/api/v1/public/verify/whatsapp/initiate
 * with the E.164 phone and CONVIA_ONETAP_API_KEY. That call is intentionally not made yet.
 */
export function initiateWhatsappVerify(env: VerifyEnv, wa: string): VerifyStart | null {
  void env.CONVIA_ONETAP_API_KEY;
  const digits = normalizeWa(wa);
  if (!digits) return null;
  const phone = `+${digits}`;
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  const token = [...buf].map((n) => n.toString(16).padStart(2, "0")).join("");
  const text = `Halo, verifikasi Loyalty Bos ${token}`;
  return {
    token,
    phone,
    deepLink: `https://wa.me/?text=${encodeURIComponent(text)}`,
  };
}

export function conviaEndpoint(): string {
  return "https://api.convia.id/api/v1/public/verify/whatsapp/initiate";
}
