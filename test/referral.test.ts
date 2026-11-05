import { describe, expect, it } from "vitest";
import { batchProgress, friendQualifies, referralBatchSize, referralFriendBonus, stampsForQualified, type FriendCheck } from "../src/referral";

const ready: FriendCheck = {
  isNewSignup: true,
  profileComplete: true,
  hasRealStamp: true,
  waVerified: true,
  sameGoogle: false,
  samePhone: false,
  alreadyCounted: false,
};

describe("ajak temen", () => {
  it("empat temen yang lolos baru dapat 1 stamp, lalu 1 lagi tiap batch", () => {
    expect(stampsForQualified(3, 4)).toBe(0);
    expect(stampsForQualified(4, 4)).toBe(1);
    expect(stampsForQualified(8, 4)).toBe(2);
    expect(batchProgress(2, 4)).toEqual({ have: 2, need: 4 });
    expect(batchProgress(4, 4)).toEqual({ have: 0, need: 4 });
    expect(referralBatchSize("0")).toBe(4);
    expect(referralFriendBonus(null)).toBe(0);
    expect(referralFriendBonus("2")).toBe(2);
  });

  it("teman baru harus lengkap profil dan punya stamp asli", () => {
    expect(friendQualifies(ready, false)).toBe(true);
    expect(friendQualifies({ ...ready, isNewSignup: false }, false)).toBe(false);
    expect(friendQualifies({ ...ready, profileComplete: false }, false)).toBe(false);
    expect(friendQualifies({ ...ready, hasRealStamp: false }, false)).toBe(false);
    expect(friendQualifies({ ...ready, alreadyCounted: true }, false)).toBe(false);
  });

  it("tolak referral diri sendiri, dan WA wajib kalau kunci nyala", () => {
    expect(friendQualifies({ ...ready, samePhone: true }, false)).toBe(false);
    expect(friendQualifies({ ...ready, sameGoogle: true }, false)).toBe(false);
    expect(friendQualifies({ ...ready, waVerified: false }, false)).toBe(true);
    expect(friendQualifies({ ...ready, waVerified: false }, true)).toBe(false);
    expect(friendQualifies({ ...ready, waVerified: true }, true)).toBe(true);
  });
});
