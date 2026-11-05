import { describe, expect, it } from "vitest";
import { errText } from "../src/messages";
import { STAFF_FLAG_REASON, staffFlagDetail, staffSelfDeal } from "../src/staff";

describe("kasir tidak boleh stamp ke akun staf", () => {
  const rina = "m_rina";
  const sari = "m_sari";

  it("memblokir member yang ada di daftar staf outlet itu", () => {
    expect(staffSelfDeal([rina], rina)).toBe(true);
    expect(staffSelfDeal([sari, rina], rina)).toBe(true);
  });

  it("mengizinkan member yang bukan staf, termasuk staf outlet lain", () => {
    expect(staffSelfDeal([], rina)).toBe(false);
    expect(staffSelfDeal([sari], rina)).toBe(false);
  });

  it("pesan kasir dan catatan dasbor", () => {
    expect(errText("sendiri")).toBe("Gak bisa kasih stamp ke akun sendiri ya");
    expect(STAFF_FLAG_REASON).toBe("sendiri");
    expect(staffFlagDetail("Rina")).toContain("Rina");
  });
});
