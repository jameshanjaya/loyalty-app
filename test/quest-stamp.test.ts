import { describe, expect, it } from "vitest";
import { missionOpen } from "../src/points";
import { applyQuestQuarters, missionQuarters, questProgressLabel, questQuarters } from "../src/quest-stamp";

describe("side quest jadi stamp", () => {
  it("0,75 lalu 0,5 jadi 1 stamp dan sisa 0,25", () => {
    const first = applyQuestQuarters({ stamps: 0, quarters: 0 }, questQuarters("0,75") || 0);
    expect(first).toEqual({ pool: { stamps: 0, quarters: 3 }, stampDelta: 0 });
    expect(questProgressLabel(first.pool.quarters)).toBe("0,75/1 menuju stamp berikutnya");
    const second = applyQuestQuarters(first.pool, questQuarters("0.5") || 0);
    expect(second).toEqual({ pool: { stamps: 1, quarters: 1 }, stampDelta: 1 });
    expect(questProgressLabel(second.pool.quarters)).toBe("0,25/1 menuju stamp berikutnya");
  });

  it("menolak nilai di luar 0,25 sampai 1", () => {
    expect(questQuarters("1")).toBe(4);
    expect(questQuarters("0.25")).toBe(1);
    expect(questQuarters("1.25")).toBeNull();
    expect(questQuarters("2")).toBeNull();
  });

  it("tarik misi membalik stamp kalau pecahan tidak cukup", () => {
    const back = applyQuestQuarters({ stamps: 1, quarters: 1 }, -2);
    expect(back).toEqual({ pool: { stamps: 0, quarters: 3 }, stampDelta: -1 });
    const empty = applyQuestQuarters({ stamps: 0, quarters: 1 }, -4);
    expect(empty.pool).toEqual({ stamps: 0, quarters: 0 });
    expect(empty.stampDelta).toBe(0);
  });

  it("satu misi hanya sekali", () => {
    const now = 1_700_000_000_000;
    expect(missionOpen({ limit: "once", hasPending: false, lastApprovedAt: null, now })).toBe(true);
    expect(missionOpen({ limit: "once", hasPending: false, lastApprovedAt: now - 1000, now })).toBe(false);
    expect(missionOpen({ limit: "week", hasPending: false, lastApprovedAt: now - 1000, now })).toBe(false);
  });

  it("misi lama 0,5 poin tetap 2 perempat", () => {
    expect(missionQuarters({ points_tenths: 5, points_quarters: 0 })).toBe(2);
    expect(missionQuarters({ points_tenths: 10, points_quarters: 4 })).toBe(4);
  });
});
