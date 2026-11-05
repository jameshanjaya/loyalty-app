import { describe, expect, it } from "vitest";
import {
  attributeReferral,
  friendQualifies,
  hasQualifyingStamp,
  isCashierQrStamp,
  stampsForQualified,
  type FriendCheck,
  type StampFact,
} from "../src/referral";

const day = 86_400_000;
const ready: FriendCheck = {
  isNewSignup: true,
  profileComplete: true,
  hasRealStamp: true,
  waVerified: true,
  sameGoogle: false,
  samePhone: false,
  alreadyCounted: false,
  isStaff: false,
};

const qr = (voided = false): StampFact => ({ type: "stamp", note: "qr", claimId: "claim1", voided });

describe("ajak temen", () => {
  it("3 teman dapat 0 stamp, 4 dapat +1, 8 dapat +2", () => {
    expect(stampsForQualified(3, 4)).toBe(0);
    expect(stampsForQualified(4, 4)).toBe(1);
    expect(stampsForQualified(8, 4)).toBe(2);
  });

  it("teman yang belum lolos tidak dihitung", () => {
    const friends = [
      friendQualifies(ready, false),
      friendQualifies({ ...ready, profileComplete: false }, false),
      friendQualifies({ ...ready, hasRealStamp: false }, false),
    ];
    expect(friends.filter(Boolean)).toHaveLength(1);
    expect(stampsForQualified(friends.filter(Boolean).length, 4)).toBe(0);
  });

  it("tolak referral diri sendiri lewat Google atau nomor yang sama", () => {
    expect(attributeReferral({ atSignup: true, openedAt: 0, now: day, sameGoogle: true, samePhone: false, duplicate: false, friendIsStaff: false, referrerIsStaff: false })).toBe("self");
    expect(attributeReferral({ atSignup: true, openedAt: 0, now: day, sameGoogle: false, samePhone: true, duplicate: false, friendIsStaff: false, referrerIsStaff: false })).toBe("self");
    expect(friendQualifies({ ...ready, sameGoogle: true }, false)).toBe(false);
    expect(friendQualifies({ ...ready, samePhone: true }, false)).toBe(false);
  });

  it("tolak teman yang sudah pernah dihitung", () => {
    expect(attributeReferral({ atSignup: true, openedAt: 0, now: day, sameGoogle: false, samePhone: false, duplicate: true, friendIsStaff: false, referrerIsStaff: false })).toBe("duplicate");
    expect(friendQualifies({ ...ready, alreadyCounted: true }, false)).toBe(false);
  });

  it("stamp misi tidak lolos, stamp QR yang dibatalkan juga tidak", () => {
    expect(isCashierQrStamp({ type: "stamp", note: "Review di Google", claimId: null, voided: false })).toBe(false);
    expect(isCashierQrStamp({ type: "stamp", note: "ajak temen", claimId: null, voided: false })).toBe(false);
    expect(isCashierQrStamp({ type: "stamp", note: "nomor WA", claimId: null, voided: false })).toBe(false);
    expect(isCashierQrStamp({ type: "birthday", note: "qr", claimId: "claim1", voided: false })).toBe(false);
    expect(isCashierQrStamp(qr(false))).toBe(true);
    expect(isCashierQrStamp(qr(true))).toBe(false);
    expect(hasQualifyingStamp([qr(true), { type: "stamp", note: "Review di Google", claimId: null, voided: false }])).toBe(false);
    expect(hasQualifyingStamp([qr(true), qr(false)])).toBe(true);
    expect(friendQualifies({ ...ready, hasRealStamp: false }, false)).toBe(false);
  });

  it("akun staf ditolak, dan link yang lewat 7 hari atau ditambah belakangan tidak nempel", () => {
    expect(attributeReferral({ atSignup: true, openedAt: 0, now: day, sameGoogle: false, samePhone: false, duplicate: false, friendIsStaff: true, referrerIsStaff: false })).toBe("staff");
    expect(attributeReferral({ atSignup: true, openedAt: 0, now: day, sameGoogle: false, samePhone: false, duplicate: false, friendIsStaff: false, referrerIsStaff: true })).toBe("staff");
    expect(friendQualifies({ ...ready, isStaff: true }, false)).toBe(false);
    expect(attributeReferral({ atSignup: true, openedAt: 0, now: 8 * day, sameGoogle: false, samePhone: false, duplicate: false, friendIsStaff: false, referrerIsStaff: false })).toBe("expired");
    expect(attributeReferral({ atSignup: false, openedAt: 0, now: day, sameGoogle: false, samePhone: false, duplicate: false, friendIsStaff: false, referrerIsStaff: false })).toBe("late");
  });
});
