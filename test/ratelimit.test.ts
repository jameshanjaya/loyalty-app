import { describe, expect, it } from "vitest";
import { hitLimit, judgeLimit, LIMITS, windowStart } from "../src/ratelimit";

describe("batas percobaan", () => {
  it("PIN member mengizinkan 5 percobaan lalu menolak", () => {
    const state = new Map();
    const now = 1_700_000_000_000;
    for (let i = 1; i <= 5; i++) {
      const hit = hitLimit(state, "pin:wa:628123", now + i, LIMITS.memberPin);
      expect(hit.ok).toBe(true);
      if (hit.ok) expect(hit.count).toBe(i);
    }
    const blocked = hitLimit(state, "pin:wa:628123", now + 6, LIMITS.memberPin);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("jendela baru membuka lagi, ember lain tidak ketularan", () => {
    const state = new Map();
    const now = 5_000_000;
    const rule = { windowMs: 1_000, limit: 1 };
    expect(hitLimit(state, "a", now, rule).ok).toBe(true);
    expect(hitLimit(state, "a", now + 10, rule).ok).toBe(false);
    expect(hitLimit(state, "b", now + 10, rule).ok).toBe(true);
    const next = windowStart(now, rule.windowMs) + rule.windowMs;
    expect(hitLimit(state, "a", next, rule).ok).toBe(true);
  });

  it("judgeLimit sama dengan hitungan yang sudah naik di database", () => {
    const start = windowStart(10_000, LIMITS.claimIp.windowMs);
    expect(judgeLimit(30, LIMITS.claimIp, start + 5, start).ok).toBe(true);
    const over = judgeLimit(31, LIMITS.claimIp, start + 5, start);
    expect(over.ok).toBe(false);
  });

  it("login owner mengizinkan 5 gagal per 15 menit lalu mengunci", () => {
    expect(LIMITS.ownerPin).toEqual({ windowMs: 15 * 60_000, limit: 5 });
    const state = new Map();
    const now = 1_700_000_000_000;
    for (let i = 1; i <= 5; i++) expect(hitLimit(state, "owner:ip:1.2.3.4", now, LIMITS.ownerPin).ok).toBe(true);
    expect(hitLimit(state, "owner:ip:1.2.3.4", now, LIMITS.ownerPin).ok).toBe(false);
    expect(hitLimit(state, "owner:ip:9.9.9.9", now, LIMITS.ownerPin).ok).toBe(true);
  });

  it("batas klaim dan batas kasir terpisah", () => {
    const state = new Map();
    const now = 9_000_000;
    for (let i = 0; i < LIMITS.claimMember.limit; i++) {
      expect(hitLimit(state, "claim:m1", now, LIMITS.claimMember).ok).toBe(true);
    }
    expect(hitLimit(state, "claim:m1", now, LIMITS.claimMember).ok).toBe(false);
    expect(hitLimit(state, "issue:kasir", now, LIMITS.cashierIssue).ok).toBe(true);
  });
});
