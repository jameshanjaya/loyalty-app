export const REFERRAL_WINDOW_MS = 7 * 86_400_000;

export type FriendCheck = {
  isNewSignup: boolean;
  profileComplete: boolean;
  hasRealStamp: boolean;
  waVerified: boolean;
  sameGoogle: boolean;
  samePhone: boolean;
  alreadyCounted: boolean;
  isStaff: boolean;
};

export type StampFact = {
  type: string;
  note: string;
  claimId: string | null;
  voided: boolean;
};

/** Only a live cashier QR scan counts. Missions, birthday, referral, manual, and admin stamps do not. */
export function isCashierQrStamp(stamp: StampFact): boolean {
  return stamp.type === "stamp" && !stamp.voided && stamp.note === "qr" && Boolean(stamp.claimId);
}

export function hasQualifyingStamp(stamps: StampFact[]): boolean {
  return stamps.some(isCashierQrStamp);
}

/** A friend counts only after a new signup, a finished profile, and one live cashier QR stamp. */
export function friendQualifies(friend: FriendCheck, waLockOn: boolean): boolean {
  if (friend.isStaff) return false;
  if (!friend.isNewSignup || friend.alreadyCounted) return false;
  if (friend.sameGoogle || friend.samePhone) return false;
  if (!friend.profileComplete || !friend.hasRealStamp) return false;
  if (waLockOn && !friend.waVerified) return false;
  return true;
}

export type AttributeReason = "ok" | "self" | "duplicate" | "staff" | "expired" | "late";

/** Attribution is signup-only and dies 7 days after the link was opened. */
export function attributeReferral(input: {
  atSignup: boolean;
  openedAt: number | null;
  now: number;
  sameGoogle: boolean;
  samePhone: boolean;
  duplicate: boolean;
  friendIsStaff: boolean;
  referrerIsStaff: boolean;
}): AttributeReason {
  if (!input.atSignup) return "late";
  if (input.sameGoogle || input.samePhone) return "self";
  if (input.duplicate) return "duplicate";
  if (input.friendIsStaff || input.referrerIsStaff) return "staff";
  if (input.openedAt == null || input.now < input.openedAt || input.now - input.openedAt > REFERRAL_WINDOW_MS) return "expired";
  return "ok";
}

export function packReferralCookie(code: string, brandId: string, openedAt: number): string {
  return `${code}.${brandId}.${openedAt}`;
}

export function unpackReferralCookie(raw: string): { code: string; brandId: string; openedAt: number } | null {
  const [code, brandId, opened] = raw.split(".");
  const openedAt = Number(opened);
  if (!code || !brandId || !Number.isFinite(openedAt)) return null;
  return { code, brandId, openedAt };
}

export function referralBatchSize(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 50) return 4;
  return n;
}

export function referralFriendBonus(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 20) return 0;
  return n;
}

/** How many referrer stamps are owed for this many qualified friends. */
export function stampsForQualified(qualified: number, batchSize: number): number {
  const size = referralBatchSize(String(batchSize));
  if (qualified < 1) return 0;
  return Math.floor(qualified / size);
}

/** Progress toward the next stamp, e.g. 2 of 4. */
export function batchProgress(qualified: number, batchSize: number): { have: number; need: number } {
  const size = referralBatchSize(String(batchSize));
  const have = qualified < 1 ? 0 : qualified % size;
  return { have, need: size };
}
