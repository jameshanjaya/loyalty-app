/** Keep in step with src/claim-scan.ts. Tests compare the two. */
export function claimScan(raw, origin, now) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, reason: "bad" };
  let url;
  try {
    url = new URL(text);
  } catch {
    try {
      url = new URL(text, origin);
    } catch {
      return { ok: false, reason: "bad" };
    }
  }
  if (url.username || url.password) return { ok: false, reason: "foreign" };
  if (url.origin !== origin) return { ok: false, reason: "foreign" };
  if (!url.pathname.startsWith("/k/")) return { ok: false, reason: "not_claim" };
  let token = "";
  try {
    token = decodeURIComponent(url.pathname.slice(3));
  } catch {
    return { ok: false, reason: "not_claim" };
  }
  const parts = token.split(".");
  if (parts.length !== 6) return { ok: false, reason: "not_claim" };
  const [id, expStr, kind, brandId, outletId, sig] = parts;
  if (kind !== "stamp" && kind !== "redeem" && kind !== "birthday") return { ok: false, reason: "not_claim" };
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) return { ok: false, reason: "not_claim" };
  if (!brandId || !/^[a-z0-9-]{2,40}$/.test(brandId)) return { ok: false, reason: "not_claim" };
  if (!outletId || !/^[A-Za-z0-9_-]{2,40}$/.test(outletId)) return { ok: false, reason: "not_claim" };
  if (!sig || !/^[A-Za-z0-9_-]{8,64}$/.test(sig)) return { ok: false, reason: "not_claim" };
  if (!expStr || !/^\d+$/.test(expStr)) return { ok: false, reason: "not_claim" };
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || String(exp) !== expStr) return { ok: false, reason: "not_claim" };
  if (now > exp) return { ok: false, reason: "expired" };
  return { ok: true, path: url.pathname };
}
