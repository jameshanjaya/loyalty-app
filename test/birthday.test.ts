import { describe, expect, it } from "vitest";
import { BIRTHDAY_LOCK_MS, birthdayClaimDecision, birthdayNotice, birthdayRedeemAllowed, birthdayStatus, countdownText, parseBirthday } from "../src/birthday";

const nov4 = Date.UTC(2026, 10, 4, 5, 0, 0);

describe("hadiah ulang tahun", () => {
  it("bulan ulang tahun terbuka, bulan lain tertutup", () => {
    const month = { active: true, window: "month" as const, days: 0 };
    expect(birthdayStatus("1998-11-10", nov4, month)).toEqual({ open: true, rewardYear: 2026 });
    expect(birthdayStatus("1998-12-01", nov4, month).open).toBe(false);
    expect(birthdayStatus("1998-11-10", nov4, { ...month, active: false }).open).toBe(false);
  });

  it("jendela N hari melewati pergantian tahun", () => {
    const around = { active: true, window: "around" as const, days: 7 };
    const dec30 = Date.UTC(2026, 11, 30, 5, 0, 0);
    expect(birthdayStatus("1990-01-02", dec30, around)).toEqual({ open: true, rewardYear: 2027 });
    expect(birthdayStatus("1990-01-20", dec30, around).open).toBe(false);
    expect(birthdayStatus("1990-11-10", nov4, { ...around, days: 3 }).open).toBe(false);
    expect(birthdayStatus("1990-11-06", nov4, { ...around, days: 3 })).toEqual({ open: true, rewardYear: 2026 });
  });

  it("29 Februari di tahun non-kabisat jatuh di 28 Februari", () => {
    const feb28 = Date.UTC(2026, 1, 28, 5, 0, 0);
    expect(birthdayStatus("2000-02-29", feb28, { active: true, window: "around", days: 0 })).toEqual({
      open: true,
      rewardYear: 2026,
    });
  });

  it("sekali per tahun", () => {
    expect(birthdayRedeemAllowed(true, false)).toBe("ok");
    expect(birthdayRedeemAllowed(true, true)).toBe("used");
    expect(birthdayRedeemAllowed(false, false)).toBe("closed");
  });

  it("hitung mundur ke jendela berikutnya, termasuk 29 Februari dan akhir tahun", () => {
    const jakarta = (year: number, month: number, day: number, hour = 0, minute = 0) =>
      Date.UTC(year, month - 1, day, hour, minute) - 7 * 60 * 60 * 1000;
    const around = { active: true, window: "around" as const, days: 0 };
    const beforeLeap = jakarta(2026, 2, 27, 15);
    const febNotice = birthdayNotice("2000-02-29", beforeLeap, around, new Set());
    expect(febNotice).toEqual({ show: true, phase: "wait", target: jakarta(2026, 2, 28) });
    const leapDay = birthdayNotice("2000-02-29", jakarta(2028, 2, 28, 12), { ...around, days: 0 }, new Set());
    expect(leapDay).toEqual({ show: true, phase: "wait", target: jakarta(2028, 2, 29) });

    const yearEnd = { active: true, window: "around" as const, days: 7 };
    const dec20 = jakarta(2026, 12, 20, 10);
    expect(birthdayNotice("1990-01-02", dec20, yearEnd, new Set())).toEqual({
      show: true,
      phase: "wait",
      target: jakarta(2026, 12, 26),
    });
    const during = birthdayNotice("1990-01-02", jakarta(2026, 12, 30, 12), yearEnd, new Set());
    expect(during).toEqual({ show: true, phase: "open", rewardYear: 2027 });
    const claimed = birthdayNotice("1990-01-02", jakarta(2027, 1, 3, 12), yearEnd, new Set([2027]));
    expect(claimed).toEqual({ show: true, phase: "claimed", target: jakarta(2027, 12, 26) });
    expect(birthdayNotice(null, dec20, yearEnd, new Set())).toEqual({ show: false });
    expect(birthdayNotice("1990-01-02", dec20, { ...yearEnd, active: false }, new Set())).toEqual({ show: false });
    expect(countdownText(dec20 + 90 * 60_000, dec20)).toBe("Claim your birthday freebies in 0 days 1 hours 30 minutes");
  });

  it("Hari H: hitung mundur, terbuka di tanggalnya, tutup besoknya, sekali, dan tanggal baru diblokir", () => {
    const jakarta = (year: number, month: number, day: number, hour = 0, minute = 0) =>
      Date.UTC(year, month - 1, day, hour, minute) - 7 * 60 * 60 * 1000;
    const day = { active: true, window: "day" as const, days: 0 };
    const before = jakarta(2026, 11, 9, 15);
    expect(birthdayNotice("1998-11-10", before, day, new Set())).toEqual({
      show: true,
      phase: "wait",
      target: jakarta(2026, 11, 10),
    });
    const onDay = jakarta(2026, 11, 10, 9);
    expect(birthdayStatus("1998-11-10", onDay, day)).toEqual({ open: true, rewardYear: 2026 });
    expect(birthdayNotice("1998-11-10", onDay, day, new Set())).toEqual({ show: true, phase: "open", rewardYear: 2026 });
    const after = jakarta(2026, 11, 11, 0, 30);
    expect(birthdayStatus("1998-11-10", after, day).open).toBe(false);
    expect(birthdayClaimDecision({ birthday: "1998-11-10", now: after, rule: day, alreadyRedeemed: false, setAt: null, overrideYear: null })).toBe("closed");
    expect(birthdayClaimDecision({ birthday: "1998-11-10", now: onDay, rule: day, alreadyRedeemed: true, setAt: null, overrideYear: null })).toBe("used");
    expect(
      birthdayClaimDecision({ birthday: "1998-11-10", now: onDay, rule: day, alreadyRedeemed: false, setAt: onDay - 60_000, overrideYear: null }),
    ).toBe("fresh");
    expect(
      birthdayClaimDecision({
        birthday: "1998-11-10",
        now: onDay,
        rule: day,
        alreadyRedeemed: false,
        setAt: onDay - BIRTHDAY_LOCK_MS - 1,
        overrideYear: null,
      }),
    ).toBe("ok");
    expect(
      birthdayClaimDecision({ birthday: "1998-11-10", now: onDay, rule: day, alreadyRedeemed: false, setAt: onDay, overrideYear: 2026 }),
    ).toBe("ok");
  });

  it("tanggal lahir tidak boleh di masa depan", () => {
    expect(parseBirthday("1998-11-04", nov4)).toBe("1998-11-04");
    expect(parseBirthday("2026-12-01", nov4)).toBeNull();
    expect(parseBirthday("2010-02-31", nov4)).toBeNull();
  });
});
