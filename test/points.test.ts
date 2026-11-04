import { describe, expect, it } from "vitest";
import {
  confirmCode,
  formatPoints,
  missionOpen,
  parsePoints,
  pickLevel,
  questLocked,
  questProgress,
  releaseExpired,
  spendPoints,
  startOfWibWeek,
  tierChoices,
  tierRedeem,
  weekStreak,
} from "../src/points";

describe("poin desimal", () => {
  it("0.5 ditambah 1 jadi 1.5, dan 3 dikurangi 2.5 sisa 0.5", () => {
    const half = parsePoints("0.5");
    const one = parsePoints("1");
    const twoHalf = parsePoints("2.5");
    const three = parsePoints("3");
    expect(half).toBe(5);
    expect(one).toBe(10);
    expect(formatPoints((half ?? 0) + (one ?? 0))).toBe("1.5");
    const spent = spendPoints(three ?? 0, twoHalf ?? 0);
    expect(spent).toEqual({ ok: true, remaining: 5 });
    if (spent.ok) expect(formatPoints(spent.remaining)).toBe("0.5");
    expect(spendPoints(5, 10)).toEqual({ ok: false, reason: "not_enough" });
    expect(parsePoints("0")).toBeNull();
    expect(parsePoints("1.25")).toBeNull();
  });
});

describe("kode tukar", () => {
  const now = 1_700_000_000_000;
  it("sekali pakai, hangus, dan poin dikembalikan sekali", () => {
    const row = { status: "pending", expiresAt: now + 1_000, pointsTenths: 25, stamps: 0 };
    expect(confirmCode(row, now)).toBe("ok");
    row.status = "confirmed";
    expect(confirmCode(row, now)).toBe("used");

    const live = { status: "pending", expiresAt: now + 500, pointsTenths: 15, stamps: 5 };
    expect(releaseExpired(live, now).changed).toBe(false);
    const expired = releaseExpired(live, now + 5_000);
    expect(expired).toEqual({ changed: true, points: 15, stamps: 5, status: "expired" });
    const twice = releaseExpired({ ...live, status: "expired" }, now + 5_000);
    expect(twice.changed).toBe(false);
    expect(twice.points).toBe(0);
  });
});

describe("tingkat stamp", () => {
  it("menukar tingkat rendah hanya memakai stamp tingkat itu", () => {
    expect(tierRedeem(6, 5)).toEqual({ ok: true, spent: 5, remaining: 1 });
    expect(tierRedeem(6, 10)).toEqual({ ok: false, reason: "not_enough" });
    const choice = tierChoices(6, [
      { stamps: 10, reward: "free matcha" },
      { stamps: 5, reward: "free upsize" },
    ]);
    expect(choice.available.map((tier) => tier.reward)).toEqual(["free upsize"]);
    expect(choice.next?.reward).toBe("free matcha");
  });
});

describe("batas misi", () => {
  it("sekali selamanya dan sekali seminggu", () => {
    const now = Date.UTC(2026, 10, 4, 5, 0, 0);
    expect(missionOpen({ limit: "once", hasPending: false, lastApprovedAt: null, now })).toBe(true);
    expect(missionOpen({ limit: "once", hasPending: true, lastApprovedAt: null, now })).toBe(false);
    expect(missionOpen({ limit: "once", hasPending: false, lastApprovedAt: now - 1000, now })).toBe(false);
    const week = startOfWibWeek(now);
    expect(missionOpen({ limit: "week", hasPending: false, lastApprovedAt: week - 1000, now })).toBe(true);
    expect(missionOpen({ limit: "week", hasPending: false, lastApprovedAt: week + 1000, now })).toBe(false);
  });
});

describe("rasa permainan", () => {
  const levels = [
    { name: "Matcha Newbie", minTenths: 0, icon: "🌱" },
    { name: "Matcha Regular", minTenths: 20, icon: "🍵" },
    { name: "Matcha Master", minTenths: 50, icon: "👑" },
  ];

  it("level naik dari poin quest seumur hidup, dan quest rahasia terkunci sebelumnya", () => {
    expect(pickLevel(0, levels).current.name).toBe("Matcha Newbie");
    const mid = pickLevel(30, levels);
    expect(mid.current.name).toBe("Matcha Regular");
    expect(mid.next?.name).toBe("Matcha Master");
    expect(mid.progress).toBeCloseTo(10 / 30);
    expect(mid.remaining).toBe(20);
    expect(pickLevel(50, levels).next).toBeNull();
    expect(pickLevel(80, levels).progress).toBe(1);
    expect(questLocked({ mystery: true, unlockTenths: 100, lifetimeTenths: 30 })).toBe(true);
    expect(questLocked({ mystery: true, unlockTenths: 100, lifetimeTenths: 100 })).toBe(false);
    expect(questLocked({ mystery: false, unlockTenths: 100, lifetimeTenths: 0 })).toBe(false);
  });

  it("progress quest dan streak minggu", () => {
    const now = Date.UTC(2026, 10, 4, 5, 0, 0);
    const week = startOfWibWeek(now);
    expect(questProgress({ limit: "once", pending: false, lastApprovedAt: week, now })).toEqual({ pct: 100, done: true, label: "Selesai" });
    expect(questProgress({ limit: "week", pending: true, lastApprovedAt: null, now }).pct).toBe(50);
    expect(questProgress({ limit: "week", pending: false, lastApprovedAt: week + 1000, now }).label).toBe("Minggu ini beres");
    expect(weekStreak([week, week - 7 * 86_400_000, week - 14 * 86_400_000], now)).toBe(3);
    expect(weekStreak([week, week - 14 * 86_400_000], now)).toBe(1);
    expect(weekStreak([week - 7 * 86_400_000, week - 14 * 86_400_000], now)).toBe(2);
    expect(weekStreak([week - 14 * 86_400_000], now)).toBe(0);
  });
});
