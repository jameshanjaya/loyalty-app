import { describe, expect, it } from "vitest";
import {
  applyRedeem,
  applyStamp,
  canCancel,
  nextDayCount,
  progressCopy,
  reverseRedeem,
  reverseStamp,
  CANCEL_WINDOW_MS,
  MEMBER_SESSION_MS,
  MEMBER_SESSION_REFRESH_MS,
  cookieAlreadySet,
  memberSessionDue,
} from "../src/loyalty";
import { clearCookie, setSessionCookie } from "../src/session";

describe("sesi member", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = 1_700_000_000_000;

  it("berlaku 365 hari dan belum diperpanjang di hari yang sama", () => {
    expect(MEMBER_SESSION_MS).toBe(365 * day);
    expect(MEMBER_SESSION_REFRESH_MS).toBe(day);
    const expiresAt = now + MEMBER_SESSION_MS;
    expect(memberSessionDue({ expiresAt, now, lifetimeMs: MEMBER_SESSION_MS, refreshAfterMs: MEMBER_SESSION_REFRESH_MS })).toBe(false);
    expect(
      memberSessionDue({
        expiresAt,
        now: now + MEMBER_SESSION_REFRESH_MS - 1,
        lifetimeMs: MEMBER_SESSION_MS,
        refreshAfterMs: MEMBER_SESSION_REFRESH_MS,
      }),
    ).toBe(false);
  });

  it("memperpanjang setelah sehari, termasuk sesi lama 180 hari, dan tidak menghidupkan sesi hangus", () => {
    const expiresAt = now + MEMBER_SESSION_MS;
    expect(
      memberSessionDue({
        expiresAt,
        now: now + MEMBER_SESSION_REFRESH_MS,
        lifetimeMs: MEMBER_SESSION_MS,
        refreshAfterMs: MEMBER_SESSION_REFRESH_MS,
      }),
    ).toBe(true);
    const oldExpiry = now + 180 * day;
    expect(memberSessionDue({ expiresAt: oldExpiry, now, lifetimeMs: MEMBER_SESSION_MS, refreshAfterMs: MEMBER_SESSION_REFRESH_MS })).toBe(true);
    expect(memberSessionDue({ expiresAt: now - 1, now, lifetimeMs: MEMBER_SESSION_MS, refreshAfterMs: MEMBER_SESSION_REFRESH_MS })).toBe(false);
  });

  it("cookie tetap HttpOnly, SameSite=Lax, Secure di https, dan logout mengosongkannya", () => {
    const https = new Request("https://loyalty.example/kartu");
    const cookie = setSessionCookie(https, "lb_member", "sesi-1", MEMBER_SESSION_MS);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).not.toContain("Max-Age=15552000");
    const http = setSessionCookie(new Request("http://127.0.0.1/kartu"), "lb_member", "sesi-1", MEMBER_SESSION_MS);
    expect(http).not.toContain("Secure");
    const cleared = clearCookie(https, "lb_member");
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("HttpOnly");
    expect(cookieAlreadySet([cookie, "lain=1"], "lb_member")).toBe(true);
    expect(cookieAlreadySet(["lb_cashier=abc"], "lb_member")).toBe(false);
    expect(cookieAlreadySet([cleared], "lb_member")).toBe(true);
  });
});

describe("aturan stamp", () => {
  it("menolak stamp kalau syarat belum dicentang", () => {
    expect(applyStamp({ confirmed: false, balance: 3 })).toEqual({ ok: false, reason: "not_confirmed" });
  });

  it("satu transaksi menambah tepat satu stamp", () => {
    expect(applyStamp({ confirmed: true, balance: 6 })).toEqual({ ok: true, balance: 7 });
  });

  it("batas harian default menolak stamp ke-3 di hari yang sama", () => {
    expect(nextDayCount(0, 10, 10, 2)).toEqual({ ok: true, count: 1, day: 10 });
    expect(nextDayCount(1, 10, 10, 2)).toEqual({ ok: true, count: 2, day: 10 });
    expect(nextDayCount(2, 10, 10, 2)).toEqual({ ok: false, reason: "daily_cap" });
  });

  it("hari baru mengosongkan hitungan, dan batas 0 menutup stamp", () => {
    expect(nextDayCount(2, 10, 11, 2)).toEqual({ ok: true, count: 1, day: 11 });
    expect(nextDayCount(0, 11, 11, 0)).toEqual({ ok: false, reason: "daily_cap" });
  });
});

describe("tukar reward dan sisa stamp", () => {
  it("10 stamp habis jadi 0", () => {
    expect(applyRedeem(10, 10)).toEqual({ ok: true, spent: 10, remaining: 0 });
  });

  it("stamp lebih ikut terbawa", () => {
    expect(applyRedeem(12, 10)).toEqual({ ok: true, spent: 10, remaining: 2 });
    expect(applyRedeem(23, 10)).toEqual({ ok: true, spent: 10, remaining: 13 });
  });

  it("menolak kalau belum cukup", () => {
    expect(applyRedeem(9, 10)).toEqual({ ok: false, reason: "not_enough" });
    expect(applyRedeem(0, 10)).toEqual({ ok: false, reason: "not_enough" });
    expect(applyRedeem(10, 0)).toEqual({ ok: false, reason: "not_enough" });
  });

  it("batal stamp mengurangi 1, batal tukar mengembalikan yang terpakai", () => {
    expect(reverseStamp(7)).toEqual({ ok: true, balance: 6 });
    expect(reverseStamp(0)).toEqual({ ok: false, reason: "empty" });
    expect(reverseRedeem(2, 10)).toEqual({ balance: 12 });
  });

  it("teks progres dan jendela batal", () => {
    expect(progressCopy(6, 10, "free matcha").headline).toBe("Dikit lagi! 4 stamp lagi dapet free matcha");
    expect(progressCopy(10, 10, "free matcha").ready).toBe(true);
    const now = 1_000_000;
    expect(canCancel({ createdAt: now - 60_000, now, sameSession: true, voided: false, isLast: true })).toBe(true);
    expect(canCancel({ createdAt: now - CANCEL_WINDOW_MS - 1, now, sameSession: true, voided: false, isLast: true })).toBe(false);
    expect(canCancel({ createdAt: now - 1000, now, sameSession: false, voided: false, isLast: true })).toBe(false);
    expect(canCancel({ createdAt: now - 1000, now, sameSession: true, voided: false, isLast: false })).toBe(false);
  });
});
