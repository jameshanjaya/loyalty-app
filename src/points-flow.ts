import { randomId } from "./crypto";
import { birthdayRedeemAllowed, birthdayStatus } from "./birthday";
import { CODE_TTL_MS, missionOpen, randomRedeemCode, releaseExpired, spendPoints, tierRedeem } from "./points";
import * as pdb from "./points-db";
import type { RedeemCode } from "./points-db";
import * as repo from "./repo";
import type { Brand, Member } from "./types";
import { maskName } from "./format";
import { logEvent } from "./log";

export type Fail = { ok: false; error: string };

async function logActivity(
  db: D1Database,
  row: { type: string; memberId: string; brandId: string; outletId: string | null; sessionId: string | null; delta: number; after: number; note: string; now: number },
) {
  await repo.insertActivity(db, {
    id: randomId(),
    type: row.type,
    memberId: row.memberId,
    brandId: row.brandId,
    outletId: row.outletId,
    sessionId: row.sessionId,
    claimId: null,
    stampsDelta: row.delta,
    stampsAfter: row.after,
    note: row.note,
    reversesId: null,
    now: row.now,
  });
}

export async function expireCodes(db: D1Database, now: number): Promise<void> {
  const due = await pdb.listDueCodes(db, now);
  for (const row of due) {
    const plan = releaseExpired(pdb.asLive(row), now);
    if (!plan.changed) continue;
    const won = await pdb.markCodeExpired(db, row.id);
    if (!won) continue;
    if (plan.points > 0) {
      await pdb.addLedger(db, {
        id: randomId(),
        memberId: row.member_id,
        brandId: row.brand_id,
        delta: plan.points,
        reason: "refund",
        refId: row.id,
        now,
      });
    }
    if (plan.stamps > 0) await pdb.refundStamps(db, row.member_id, row.brand_id, plan.stamps, now);
    if (row.stock_held && row.reward_ref) await pdb.returnStock(db, row.reward_ref);
    logEvent("code_expired", { code: row.id, kind: row.kind });
  }
}

async function saveCode(
  db: D1Database,
  input: {
    memberId: string;
    brandId: string;
    kind: string;
    label: string;
    ref: string | null;
    points: number;
    stamps: number;
    stockHeld: number;
    now: number;
  },
): Promise<RedeemCode> {
  let code = randomRedeemCode();
  for (let i = 0; i < 5; i++) {
    const clash = await pdb.findPendingCode(db, input.brandId, code, input.now);
    if (!clash) break;
    code = randomRedeemCode();
  }
  const row: RedeemCode = {
    id: randomId(),
    code,
    member_id: input.memberId,
    brand_id: input.brandId,
    kind: input.kind,
    reward_label: input.label,
    reward_ref: input.ref,
    points_tenths: input.points,
    stamps_cost: input.stamps,
    stock_held: input.stockHeld,
    status: "pending",
    expires_at: input.now + CODE_TTL_MS,
    created_at: input.now,
    confirmed_at: null,
    outlet_id: null,
    session_id: null,
  };
  await pdb.insertCode(db, row);
  return row;
}

export async function redeemPointsReward(db: D1Database, member: Member, rewardId: string, now: number): Promise<{ ok: true; code: RedeemCode } | Fail> {
  await expireCodes(db, now);
  const reward = await pdb.getReward(db, rewardId);
  if (!reward || !reward.active) return { ok: false, error: "umum" };
  const balance = await pdb.pointsBalance(db, member.id);
  if (!spendPoints(balance, reward.points_tenths).ok) return { ok: false, error: "poin" };
  const stock = await pdb.takeStock(db, reward.id);
  if (stock === "empty") return { ok: false, error: "stok" };
  await pdb.addLedger(db, {
    id: randomId(),
    memberId: member.id,
    brandId: reward.brand_id,
    delta: -reward.points_tenths,
    reason: "redeem",
    refId: reward.id,
    now,
  });
  const code = await saveCode(db, {
    memberId: member.id,
    brandId: reward.brand_id,
    kind: "points",
    label: reward.title,
    ref: reward.id,
    points: reward.points_tenths,
    stamps: 0,
    stockHeld: stock === "taken" ? 1 : 0,
    now,
  });
  logEvent("code_points", { member: member.id, reward: reward.id });
  return { ok: true, code };
}

export async function redeemTier(db: D1Database, member: Member, tierId: string, now: number): Promise<{ ok: true; code: RedeemCode } | Fail> {
  await expireCodes(db, now);
  const tier = await pdb.getTier(db, tierId);
  if (!tier || !tier.active) return { ok: false, error: "umum" };
  const card = await repo.ensureCard(db, member.id, tier.brand_id, now);
  if (!tierRedeem(card.stamps, tier.stamps).ok) return { ok: false, error: "kurang" };
  const left = await pdb.holdStamps(db, member.id, tier.brand_id, tier.stamps, now);
  if (left == null) return { ok: false, error: "kurang" };
  const code = await saveCode(db, {
    memberId: member.id,
    brandId: tier.brand_id,
    kind: "stamp",
    label: tier.reward_text,
    ref: tier.id,
    points: 0,
    stamps: tier.stamps,
    stockHeld: 0,
    now,
  });
  logEvent("code_stamp", { member: member.id, tier: tier.id });
  return { ok: true, code };
}

export async function redeemBirthdayCode(db: D1Database, member: Member, brand: Brand, now: number): Promise<{ ok: true; code: RedeemCode } | Fail> {
  await expireCodes(db, now);
  const offer = birthdayStatus(member.birthday, now, {
    active: brand.birthday_active === 1,
    window: brand.birthday_window === "around" ? "around" : "month",
    days: brand.birthday_days,
  });
  const taken = offer.open ? await repo.birthdayTaken(db, member.id, brand.id, offer.rewardYear) : true;
  if (birthdayRedeemAllowed(offer.open, taken) !== "ok" || !offer.open) return { ok: false, error: taken ? "ultah-sudah" : "ultah" };
  const code = await saveCode(db, {
    memberId: member.id,
    brandId: brand.id,
    kind: "birthday",
    label: brand.birthday_reward,
    ref: String(offer.rewardYear),
    points: 0,
    stamps: 0,
    stockHeld: 0,
    now,
  });
  return { ok: true, code };
}

export async function confirmRedeemCode(
  db: D1Database,
  input: { brandId: string; code: string; outletId: string; sessionId: string; now: number },
): Promise<{ ok: true; masked: string; label: string } | Fail> {
  await expireCodes(db, input.now);
  if (!/^\d{5}$/.test(input.code)) return { ok: false, error: "kode" };
  const row = await pdb.findPendingCode(db, input.brandId, input.code, input.now);
  if (!row) return { ok: false, error: "kode" };
  const won = await pdb.confirmCodeRow(db, row.id, input.outletId, input.sessionId, input.now);
  if (!won) return { ok: false, error: "kode" };
  const member = await repo.getMember(db, row.member_id);
  if (!member) return { ok: false, error: "kode" };
  if (row.kind === "stamp") {
    await dbBumpRedeems(db, member.id, row.brand_id);
    const card = await repo.getCard(db, member.id, row.brand_id);
    await logActivity(db, {
      type: "redeem",
      memberId: member.id,
      brandId: row.brand_id,
      outletId: input.outletId,
      sessionId: input.sessionId,
      delta: -row.stamps_cost,
      after: card?.stamps ?? 0,
      note: row.reward_label,
      now: input.now,
    });
  } else if (row.kind === "birthday") {
    const year = Number(row.reward_ref || 0);
    await repo.insertBirthdayRedemption(db, { memberId: member.id, brandId: row.brand_id, year, activityId: row.id, now: input.now });
    await logActivity(db, {
      type: "birthday",
      memberId: member.id,
      brandId: row.brand_id,
      outletId: input.outletId,
      sessionId: input.sessionId,
      delta: 0,
      after: (await repo.getCard(db, member.id, row.brand_id))?.stamps ?? 0,
      note: row.reward_label,
      now: input.now,
    });
  } else {
    await logActivity(db, {
      type: "points",
      memberId: member.id,
      brandId: row.brand_id,
      outletId: input.outletId,
      sessionId: input.sessionId,
      delta: 0,
      after: (await repo.getCard(db, member.id, row.brand_id))?.stamps ?? 0,
      note: row.reward_label,
      now: input.now,
    });
  }
  logEvent("code_ok", { kind: row.kind, member: member.id });
  return { ok: true, masked: maskName(member.name, member.wa), label: row.reward_label };
}

async function dbBumpRedeems(db: D1Database, memberId: string, brandId: string) {
  await db.prepare(`UPDATE cards SET lifetime_redeems = lifetime_redeems + 1 WHERE member_id = ? AND brand_id = ?`).bind(memberId, brandId).run();
}

export async function submitMission(
  db: D1Database,
  input: { member: Member; missionId: string; link: string | null; r2Key: string | null; now: number },
): Promise<Fail | { ok: true }> {
  const mission = await pdb.getMission(db, input.missionId);
  if (!mission || !mission.active) return { ok: false, error: "umum" };
  if (mission.proof_link && !input.link) return { ok: false, error: "bukti" };
  if (mission.proof_screenshot && !input.r2Key) return { ok: false, error: "bukti" };
  const state = await pdb.memberMissionState(db, input.member.id, mission.id);
  const limit = mission.limit_kind === "week" ? "week" : "once";
  if (!missionOpen({ limit, hasPending: state.pending, lastApprovedAt: state.lastApprovedAt, now: input.now })) {
    return { ok: false, error: "misi" };
  }
  await pdb.insertSubmission(db, {
    id: randomId(),
    missionId: mission.id,
    memberId: input.member.id,
    link: input.link,
    r2Key: input.r2Key,
    points: mission.points_tenths,
    now: input.now,
  });
  logEvent("mission_submit", { mission: mission.id, member: input.member.id });
  return { ok: true };
}

export async function reviewMission(db: D1Database, input: { id: string; approve: boolean; now: number }): Promise<Fail | { ok: true }> {
  const row = await pdb.getSubmission(db, input.id);
  if (!row || row.status !== "pending") return { ok: false, error: "umum" };
  const mission = await pdb.getMission(db, row.mission_id);
  const won = await pdb.markSubmission(db, row.id, input.approve ? "approved" : "rejected", "", input.now);
  if (!won) return { ok: false, error: "umum" };
  if (input.approve) {
    await pdb.addLedger(db, {
      id: randomId(),
      memberId: row.member_id,
      brandId: mission?.brand_id ?? null,
      delta: row.points_tenths,
      reason: "mission",
      refId: row.id,
      now: input.now,
    });
    const brandId = mission?.brand_id || (await repo.listBrands(db, true))[0]?.id;
    if (brandId) {
      await logActivity(db, {
        type: "mission",
        memberId: row.member_id,
        brandId,
        outletId: null,
        sessionId: null,
        delta: 0,
        after: (await repo.getCard(db, row.member_id, brandId))?.stamps ?? 0,
        note: mission?.title || "misi",
        now: input.now,
      });
    }
    logEvent("mission_ok", { id: row.id });
  } else {
    logEvent("mission_no", { id: row.id });
  }
  return { ok: true };
}
