import { describe, expect, it } from "vitest";
import { birthdayRedeemAllowed, birthdayStatus, parseBirthday } from "../src/birthday";

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

  it("tanggal lahir tidak boleh di masa depan", () => {
    expect(parseBirthday("1998-11-04", nov4)).toBe("1998-11-04");
    expect(parseBirthday("2026-12-01", nov4)).toBeNull();
    expect(parseBirthday("2010-02-31", nov4)).toBeNull();
  });
});
