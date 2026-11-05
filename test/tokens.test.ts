import { describe, expect, it } from "vitest";
import { decideClaim, inspectClaim, issueClaim, MemoryClaimStore, readClaim, signClaim } from "../src/tokens";

const secret = "test-secret-yang-cukup-panjang";

describe("token QR sekali pakai dan kedaluwarsa", () => {
  it("bisa dibaca sekali, pemakaian kedua ditolak", async () => {
    const store = new MemoryClaimStore();
    const now = 1_700_000_000_000;
    const issued = await issueClaim(
      store,
      { outletId: "o_loft", brandId: "loft25", sessionId: "kasir1", kind: "stamp" },
      secret,
      now,
    );
    const first = await inspectClaim(store, issued.token, secret, now + 1000);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.payload.brandId).toBe("loft25");
    expect(first.payload.outletId).toBe("o_loft");
    expect(first.record.kind).toBe("stamp");

    expect(await store.markClaimed(first.payload.id, "member-rina", now + 1000)).toBe(true);
    expect(await store.markClaimed(first.payload.id, "member-lain", now + 1000)).toBe(false);

    const second = await inspectClaim(store, issued.token, secret, now + 2000);
    expect(second).toEqual({ ok: false, reason: "used" });
  });

  it("token yang lewat 60 detik hangus", async () => {
    const store = new MemoryClaimStore();
    const now = 1_700_000_000_000;
    const issued = await issueClaim(
      store,
      { outletId: "o_soto", brandId: "soto-oseng", sessionId: "kasir2", kind: "redeem" },
      secret,
      now,
    );
    const late = await inspectClaim(store, issued.token, secret, now + 60_001);
    expect(late).toEqual({ ok: false, reason: "expired" });
    expect(await store.markClaimed(issued.record.id, "m", now + 60_001)).toBe(false);
  });

  it("tanda tangan yang diubah ditolak, termasuk merek yang ditukar", async () => {
    const now = 1_700_000_000_000;
    const token = await signClaim(
      { id: "abc12345xyz", exp: now + 30_000, kind: "stamp", brandId: "loft25", outletId: "o_loft" },
      secret,
    );
    const dot = token.lastIndexOf(".");
    const sig = token.slice(dot + 1).split("");
    sig[2] = sig[2] === "A" ? "B" : "A";
    const flipped = `${token.slice(0, dot + 1)}${sig.join("")}`;
    expect(await readClaim(flipped, secret, now)).toEqual({ ok: false, reason: "bad_sig" });
    expect(await readClaim(token, "secret-lain-yang-panjang", now)).toEqual({ ok: false, reason: "bad_sig" });

    const parts = token.split(".");
    parts[3] = "krispyporkk";
    const swapped = parts.join(".");
    expect((await readClaim(swapped, secret, now)).ok).toBe(false);
  });

  it("baris database yang tidak cocok dengan isi token ditolak", () => {
    const now = 1_700_000_000_000;
    const payload = { id: "abc12345xyz", exp: now + 1000, kind: "stamp" as const, brandId: "loft25", outletId: "o_loft" };
    expect(
      decideClaim(
        {
          id: payload.id,
          outletId: "o_lain",
          brandId: "loft25",
          sessionId: "s",
          kind: "stamp",
          status: "pending",
          memberId: null,
          expiresAt: payload.exp,
          createdAt: now,
          claimedAt: null,
        },
        payload,
        now,
      ),
    ).toBe("mismatch");
    expect(
      decideClaim(
        {
          id: payload.id,
          outletId: payload.outletId,
          brandId: payload.brandId,
          sessionId: "s",
          kind: "stamp",
          status: "cancelled",
          memberId: null,
          expiresAt: payload.exp,
          createdAt: now,
          claimedAt: null,
        },
        payload,
        now,
      ),
    ).toBe("cancelled");
  });
});
