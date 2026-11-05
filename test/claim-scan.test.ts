import { describe, expect, it } from "vitest";
import { claimScan as claimScanJs } from "../public/claim-scan.js";
import { claimScan } from "../src/claim-scan";
import { signClaim } from "../src/tokens";

const secret = "test-secret-yang-cukup-panjang";
const origin = "https://loyalty.example";
const now = 1_700_000_000_000;

async function link(kind: "stamp" | "redeem" | "birthday", exp = now + 30_000) {
  const token = await signClaim(
    { id: "abcdefghij12", exp, kind, brandId: "loft25", outletId: "o_loft" },
    secret,
  );
  return { token, url: `${origin}/k/${token}` };
}

describe("QR klaim di kartu", () => {
  it("menerima QR stamp, tukar, dan ultah dari origin yang sama", async () => {
    for (const kind of ["stamp", "redeem", "birthday"] as const) {
      const made = await link(kind);
      const result = claimScan(made.url, origin, now);
      expect(result).toEqual({ ok: true, path: `/k/${made.token}` });
      expect(claimScanJs(made.url, origin, now)).toEqual(result);
    }
  });

  it("menolak QR luar, yang bukan klaim, dan yang sudah hangus", async () => {
    const made = await link("stamp");
    expect(claimScan(`https://evil.example/k/${made.token}`, origin, now)).toEqual({ ok: false, reason: "foreign" });
    expect(claimScan(`${origin}/hadiah`, origin, now)).toEqual({ ok: false, reason: "not_claim" });
    expect(claimScan("bukan-url", origin, now)).toEqual({ ok: false, reason: "not_claim" });
    const expired = await link("redeem", now - 1);
    expect(claimScan(expired.url, origin, now)).toEqual({ ok: false, reason: "expired" });
    expect(claimScanJs(expired.url, origin, now)).toEqual({ ok: false, reason: "expired" });
    expect(claimScan("", origin, now)).toEqual({ ok: false, reason: "bad" });
  });
});
