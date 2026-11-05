export type FriendCheck = {
  isNewSignup: boolean;
  profileComplete: boolean;
  hasRealStamp: boolean;
  waVerified: boolean;
  sameGoogle: boolean;
  samePhone: boolean;
  alreadyCounted: boolean;
};

/** A friend counts only after a new signup, a finished profile, and one real stamp. */
export function friendQualifies(friend: FriendCheck, waLockOn: boolean): boolean {
  if (!friend.isNewSignup || friend.alreadyCounted) return false;
  if (friend.sameGoogle || friend.samePhone) return false;
  if (!friend.profileComplete || !friend.hasRealStamp) return false;
  if (waLockOn && !friend.waVerified) return false;
  return true;
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
