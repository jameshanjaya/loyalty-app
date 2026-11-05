import { randomId } from "./crypto";
import { profileComplete } from "./profile";
import { attributeReferral, friendQualifies, hasQualifyingStamp, referralBatchSize, referralFriendBonus, type StampFact } from "./referral";
import * as repo from "./repo";
import type { Member } from "./types";

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function makeReferralCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
}

export async function ensureReferralCode(db: D1Database, memberId: string): Promise<string> {
  const row = await db.prepare(`SELECT referral_code FROM members WHERE id = ?`).bind(memberId).first<{ referral_code: string | null }>();
  if (row?.referral_code) return row.referral_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeReferralCode();
    const taken = await db.prepare(`SELECT id FROM members WHERE referral_code = ?`).bind(code).first();
    if (taken) continue;
    await db.prepare(`UPDATE members SET referral_code = ? WHERE id = ? AND referral_code IS NULL`).bind(code, memberId).run();
    const saved = await db.prepare(`SELECT referral_code FROM members WHERE id = ?`).bind(memberId).first<{ referral_code: string | null }>();
    if (saved?.referral_code) return saved.referral_code;
  }
  return memberId.slice(0, 8);
}

export async function findReferrerByCode(db: D1Database, code: string): Promise<Member | null> {
  const clean = code.trim().toLowerCase();
  if (!/^[a-z0-9]{6,12}$/.test(clean)) return null;
  return db.prepare(`SELECT * FROM members WHERE referral_code = ?`).bind(clean).first<Member>();
}

async function logReferral(
  db: D1Database,
  event: { kind: string; code?: string; referrerId?: string | null; friendId?: string | null; brandId?: string | null; detail?: string; now: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO referral_events (id, kind, code, referrer_id, friend_id, brand_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(randomId(), event.kind, event.code || "", event.referrerId || null, event.friendId || null, event.brandId || null, event.detail || "", event.now)
    .run();
}

export async function logReferralOpen(db: D1Database, input: { code: string; brandId: string; now: number }): Promise<void> {
  const referrer = await findReferrerByCode(db, input.code);
  await logReferral(db, {
    kind: "opened",
    code: input.code,
    referrerId: referrer?.id || null,
    brandId: input.brandId,
    now: input.now,
  });
}

async function memberIsStaff(db: D1Database, memberId: string): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 AS n FROM outlet_staff WHERE member_id = ? LIMIT 1`).bind(memberId).first<{ n: number }>();
  return Boolean(row);
}

export async function attachReferral(
  db: D1Database,
  input: { friend: Member; code: string; brandId: string; openedAt: number | null; now: number },
): Promise<void> {
  const referrer = await findReferrerByCode(db, input.code);
  const samePhone = Boolean(referrer && referrer.wa === input.friend.wa);
  const sameGoogle = Boolean(referrer?.google_sub && input.friend.google_sub && referrer.google_sub === input.friend.google_sub);
  const existing = await db.prepare(`SELECT friend_id FROM referrals WHERE friend_id = ?`).bind(input.friend.id).first();
  const friendIsStaff = await memberIsStaff(db, input.friend.id);
  const referrerIsStaff = referrer ? await memberIsStaff(db, referrer.id) : false;
  const reason = attributeReferral({
    atSignup: true,
    openedAt: input.openedAt,
    now: input.now,
    sameGoogle: Boolean(referrer && (sameGoogle || referrer.id === input.friend.id)),
    samePhone,
    duplicate: Boolean(existing),
    friendIsStaff,
    referrerIsStaff,
  });
  if (reason !== "ok" || !referrer) {
    await logReferral(db, {
      kind: "rejected",
      code: input.code,
      referrerId: referrer?.id || null,
      friendId: input.friend.id,
      brandId: input.brandId,
      detail: referrer ? reason : "unknown",
      now: input.now,
    });
    return;
  }
  const brand = await repo.getBrand(db, input.brandId);
  if (!brand) return;
  const inserted = await db
    .prepare(
      `INSERT OR IGNORE INTO referrals (friend_id, referrer_id, brand_id, code, profile_done, stamped, qualified, consumed, friend_paid, created_at)
       VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, ?)`,
    )
    .bind(input.friend.id, referrer.id, brand.id, referrer.referral_code, input.now)
    .run();
  if (!inserted.meta.changes) {
    await logReferral(db, { kind: "rejected", code: input.code, referrerId: referrer.id, friendId: input.friend.id, brandId: brand.id, detail: "duplicate", now: input.now });
    return;
  }
  await logReferral(db, { kind: "signup", code: referrer.referral_code || input.code, referrerId: referrer.id, friendId: input.friend.id, brandId: brand.id, now: input.now });
  await refreshReferral(db, input.friend.id, input.now);
}

async function referralSettings(db: D1Database): Promise<{ batch: number; bonus: number; waLock: boolean }> {
  const [batch, bonus, lock] = await Promise.all([
    repo.getSetting(db, "referral_batch"),
    repo.getSetting(db, "referral_friend_bonus"),
    repo.getSetting(db, "wa_verify_lock"),
  ]);
  return { batch: referralBatchSize(batch), bonus: referralFriendBonus(bonus), waLock: lock === "1" };
}

async function qualifyingStamps(db: D1Database, memberId: string): Promise<StampFact[]> {
  const rows = await db
    .prepare(`SELECT type, note, claim_id, voided FROM activities WHERE member_id = ? AND type = 'stamp'`)
    .bind(memberId)
    .all<{ type: string; note: string; claim_id: string | null; voided: number }>();
  return (rows.results || []).map((row) => ({
    type: row.type,
    note: row.note,
    claimId: row.claim_id,
    voided: row.voided === 1,
  }));
}

async function grantPlainStamp(db: D1Database, input: { memberId: string; brandId: string; note: string; now: number }): Promise<string> {
  await repo.ensureCard(db, input.memberId, input.brandId, input.now);
  const updated = await db
    .prepare(`UPDATE cards SET stamps = stamps + 1, lifetime_stamps = lifetime_stamps + 1, updated_at = ? WHERE member_id = ? AND brand_id = ? RETURNING stamps`)
    .bind(input.now, input.memberId, input.brandId)
    .first<{ stamps: number }>();
  const activityId = randomId();
  await repo.insertActivity(db, {
    id: activityId,
    type: "stamp",
    memberId: input.memberId,
    brandId: input.brandId,
    outletId: null,
    sessionId: null,
    claimId: null,
    stampsDelta: 1,
    stampsAfter: updated?.stamps ?? 1,
    note: input.note,
    reversesId: null,
    now: input.now,
  });
  return activityId;
}

export async function refreshReferral(db: D1Database, friendId: string, now: number): Promise<void> {
  const row = await db
    .prepare(`SELECT * FROM referrals WHERE friend_id = ?`)
    .bind(friendId)
    .first<{
      friend_id: string;
      referrer_id: string;
      brand_id: string;
      qualified: number;
      consumed: number;
      friend_paid: number;
    }>();
  if (!row) return;
  const friend = await repo.getMember(db, friendId);
  const referrer = await repo.getMember(db, row.referrer_id);
  if (!friend || !referrer) return;
  const settings = await referralSettings(db);
  const liveStamp = hasQualifyingStamp(await qualifyingStamps(db, friendId));
  const staff = (await memberIsStaff(db, friendId)) || (await memberIsStaff(db, referrer.id));
  const profileDone = profileComplete({ name: friend.name, wa: friend.wa, birthday: friend.birthday, joinMethod: friend.join_method });
  const ok = friendQualifies(
    {
      isNewSignup: true,
      profileComplete: profileDone,
      hasRealStamp: liveStamp,
      waVerified: friend.wa_verified === 1,
      sameGoogle: Boolean(referrer.google_sub && friend.google_sub && referrer.google_sub === friend.google_sub),
      samePhone: referrer.wa === friend.wa,
      alreadyCounted: false,
      isStaff: staff,
    },
    settings.waLock,
  );
  await db.prepare(`UPDATE referrals SET profile_done = ?, stamped = ? WHERE friend_id = ?`).bind(profileDone ? 1 : 0, liveStamp ? 1 : 0, friendId).run();
  if (!ok) {
    if (row.qualified === 1) await dropQualifiedFriend(db, row, now);
    return;
  }
  if (row.qualified === 1) return;
  await db.prepare(`UPDATE referrals SET qualified = 1 WHERE friend_id = ?`).bind(friendId).run();
  await logReferral(db, { kind: "qualified", code: "", referrerId: row.referrer_id, friendId, brandId: row.brand_id, now });
  if (settings.bonus > 0 && row.friend_paid !== 1) {
    for (let i = 0; i < settings.bonus; i++) {
      await grantPlainStamp(db, { memberId: friendId, brandId: row.brand_id, note: "bonus temen", now });
    }
    await db.prepare(`UPDATE referrals SET friend_paid = 1 WHERE friend_id = ?`).bind(friendId).run();
  }
  await settleReferrer(db, row.referrer_id, row.brand_id, now);
}

async function settleReferrer(db: D1Database, referrerId: string, brandId: string, now: number): Promise<void> {
  const settings = await referralSettings(db);
  for (let guard = 0; guard < 20; guard++) {
    const waiting = await db
      .prepare(
        `SELECT friend_id FROM referrals WHERE referrer_id = ? AND brand_id = ? AND qualified = 1 AND consumed = 0 ORDER BY created_at LIMIT ?`,
      )
      .bind(referrerId, brandId, settings.batch)
      .all<{ friend_id: string }>();
    const ids = waiting.results || [];
    if (ids.length < settings.batch) return;
    if (await memberIsStaff(db, referrerId)) {
      await logReferral(db, { kind: "rejected", referrerId, brandId, detail: "staff", now });
      return;
    }
    const activityId = await grantPlainStamp(db, { memberId: referrerId, brandId, note: "ajak temen", now });
    const friendIds = ids.map((id) => id.friend_id).join(",");
    await db
      .prepare(
        `INSERT INTO referral_grants (id, referrer_id, brand_id, activity_id, friends, revoked, created_at, friend_ids) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .bind(randomId(), referrerId, brandId, activityId, settings.batch, now, friendIds)
      .run();
    await logReferral(db, { kind: "awarded", referrerId, brandId, detail: friendIds, now });
    for (const id of ids) {
      await db.prepare(`UPDATE referrals SET consumed = 1 WHERE friend_id = ?`).bind(id.friend_id).run();
    }
  }
}

export async function referralProgress(db: D1Database, memberId: string, brandId: string): Promise<{ have: number; need: number; code: string }> {
  const code = await ensureReferralCode(db, memberId);
  const settings = await referralSettings(db);
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ? AND brand_id = ? AND qualified = 1 AND consumed = 0`)
    .bind(memberId, brandId)
    .first<{ n: number }>();
  const have = row?.n ?? 0;
  return { have: have % settings.batch, need: settings.batch, code };
}

export async function clawReferralGrant(db: D1Database, grantId: string, now: number): Promise<boolean> {
  const grant = await db
    .prepare(`SELECT * FROM referral_grants WHERE id = ? AND revoked = 0`)
    .bind(grantId)
    .first<{ id: string; referrer_id: string; brand_id: string; activity_id: string | null }>();
  if (!grant) return false;
  const card = await db
    .prepare(`UPDATE cards SET stamps = MAX(stamps - 1, 0), updated_at = ? WHERE member_id = ? AND brand_id = ? RETURNING stamps`)
    .bind(now, grant.referrer_id, grant.brand_id)
    .first<{ stamps: number }>();
  await repo.insertActivity(db, {
    id: randomId(),
    type: "cancel",
    memberId: grant.referrer_id,
    brandId: grant.brand_id,
    outletId: null,
    sessionId: null,
    claimId: null,
    stampsDelta: -1,
    stampsAfter: card?.stamps ?? 0,
    note: "tarik ajak temen",
    reversesId: grant.activity_id,
    now,
  });
  await db.prepare(`UPDATE referral_grants SET revoked = 1 WHERE id = ?`).bind(grantId).run();
  await logReferral(db, { kind: "clawed", referrerId: grant.referrer_id, brandId: grant.brand_id, detail: "tarik", now });
  return true;
}

async function dropQualifiedFriend(
  db: D1Database,
  row: { friend_id: string; referrer_id: string; brand_id: string; consumed: number },
  now: number,
): Promise<void> {
  await db.prepare(`UPDATE referrals SET qualified = 0, consumed = 0 WHERE friend_id = ?`).bind(row.friend_id).run();
  await logReferral(db, { kind: "disqualified", referrerId: row.referrer_id, friendId: row.friend_id, brandId: row.brand_id, now });
  if (row.consumed !== 1) return;
  const grant = await db
    .prepare(`SELECT id, friend_ids FROM referral_grants WHERE referrer_id = ? AND brand_id = ? AND revoked = 0 AND (',' || friend_ids || ',') LIKE ? ORDER BY created_at DESC LIMIT 1`)
    .bind(row.referrer_id, row.brand_id, `%,${row.friend_id},%`)
    .first<{ id: string; friend_ids: string }>();
  if (!grant) return;
  await clawReferralGrant(db, grant.id, now);
  for (const id of grant.friend_ids.split(",").filter((id) => id && id !== row.friend_id)) {
    await db.prepare(`UPDATE referrals SET consumed = 0 WHERE friend_id = ? AND qualified = 1`).bind(id).run();
  }
  await settleReferrer(db, row.referrer_id, row.brand_id, now);
}
