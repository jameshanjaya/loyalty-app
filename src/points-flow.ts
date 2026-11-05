import { randomId } from "./crypto";
import { birthdayStatus, toBirthdayRule } from "./birthday";
import { birthdayError, birthdayGate } from "./birthday-gate";
import { brandOpen } from "./brands";
import { allocateUpTo, expiresAtFor, splitLots, soonestBatch, type LedgerLike } from "./expiry";
import { CODE_TTL_MS, missionInWindow, missionOpen, proofKind, questLocked, randomRedeemCode, releaseExpired, tierRedeem } from "./points";
import * as pdb from "./points-db";
import type { RedeemCode } from "./points-db";
import * as repo from "./repo";
import type { Brand, Member } from "./types";
import { maskName } from "./format";
import { logEvent } from "./log";
import { missionQuarters } from "./quest-stamp";
import { STAFF_FLAG_REASON, staffFlagDetail } from "./staff";

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
    if (plan.points > 0) await restoreRedeem(db, row, now);
    if (plan.stamps > 0) await pdb.refundStamps(db, row.member_id, row.brand_id, plan.stamps, now);
    if (row.stock_held && row.reward_ref) {
      if (row.kind === "stamp") await pdb.returnTierStock(db, row.reward_ref);
      else await pdb.returnStock(db, row.reward_ref);
    }
    logEvent("code_expired", { code: row.id, kind: row.kind });
  }
}

async function saveCode(
  db: D1Database,
  input: {
    id?: string;
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
    id: input.id || randomId(),
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
  const codeId = randomId();
  const stock = await pdb.takeStock(db, reward.id);
  if (stock === "empty") return { ok: false, error: "stok" };
  const spent = await spendPointsFifo(db, {
    memberId: member.id,
    brandId: reward.brand_id,
    cost: reward.points_tenths,
    reason: "redeem",
    refId: codeId,
    now,
  });
  if (!spent.ok) {
    if (stock === "taken") await pdb.returnStock(db, reward.id);
    return { ok: false, error: "poin" };
  }
  const code = await saveCode(db, {
    id: codeId,
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
  if (!brandOpen(await repo.getBrand(db, tier.brand_id))) return { ok: false, error: "merek" };
  const card = await repo.ensureCard(db, member.id, tier.brand_id, now);
  if (!tierRedeem(card.stamps, tier.stamps).ok) return { ok: false, error: "kurang" };
  const stock = await pdb.takeTierStock(db, tier.id);
  if (stock === "empty") return { ok: false, error: "stok" };
  const left = await pdb.holdStamps(db, member.id, tier.brand_id, tier.stamps, now);
  if (left == null) {
    if (stock === "taken") await pdb.returnTierStock(db, tier.id);
    return { ok: false, error: "kurang" };
  }
  const code = await saveCode(db, {
    memberId: member.id,
    brandId: tier.brand_id,
    kind: "stamp",
    label: tier.reward_text,
    ref: tier.id,
    points: 0,
    stamps: tier.stamps,
    stockHeld: stock === "taken" ? 1 : 0,
    now,
  });
  logEvent("code_stamp", { member: member.id, tier: tier.id });
  return { ok: true, code };
}

export async function redeemBirthdayCode(db: D1Database, member: Member, brand: Brand, now: number): Promise<{ ok: true; code: RedeemCode } | Fail> {
  if (!brandOpen(brand)) return { ok: false, error: "merek" };
  await expireCodes(db, now);
  const blocked = birthdayError(await birthdayGate(db, member, brand, now));
  if (blocked) return { ok: false, error: blocked };
  const offer = birthdayStatus(member.birthday, now, toBirthdayRule(brand));
  if (!offer.open) return { ok: false, error: "ultah" };
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
  const member = await repo.getMember(db, row.member_id);
  if (!member) return { ok: false, error: "kode" };
  if (await repo.isOutletStaff(db, input.outletId, member.id)) {
    await repo.insertFlag(db, {
      id: randomId(),
      outletId: input.outletId,
      sessionId: input.sessionId,
      memberId: member.id,
      reason: STAFF_FLAG_REASON,
      detail: staffFlagDetail(member.name),
      now: input.now,
      dedupe: false,
    });
    logEvent("staff_block", { outlet: input.outletId, member: member.id });
    return { ok: false, error: "sendiri" };
  }
  if (row.kind === "birthday") {
    const brand = await repo.getBrand(db, row.brand_id);
    if (!brandOpen(brand)) return { ok: false, error: "merek" };
    const blocked = birthdayError(await birthdayGate(db, member, brand, input.now));
    if (blocked) return { ok: false, error: blocked };
  }
  const won = await pdb.confirmCodeRow(db, row.id, input.outletId, input.sessionId, input.now);
  if (!won) return { ok: false, error: "kode" };
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
): Promise<Fail | { ok: true; stampsAdded: number }> {
  const mission = await pdb.getMission(db, input.missionId);
  if (!mission || !mission.active || !mission.brand_id) return { ok: false, error: "umum" };
  if (!brandOpen(await repo.getBrand(db, mission.brand_id))) return { ok: false, error: "merek" };
  if (!missionInWindow(mission.starts_at, mission.ends_at, input.now)) return { ok: false, error: "misi" };
  const earned = await pdb.lifetimeEarned(db, input.member.id);
  if (questLocked({ mystery: mission.mystery === 1, unlockTenths: mission.unlock_points_tenths, lifetimeTenths: earned })) {
    return { ok: false, error: "misi" };
  }
  if (!input.r2Key) return { ok: false, error: "bukti" };
  const state = await pdb.memberMissionState(db, input.member.id, mission.id);
  if (!missionOpen({ limit: "once", hasPending: state.pending, lastApprovedAt: state.lastApprovedAt, now: input.now })) {
    return { ok: false, error: "misi" };
  }
  const quarters = missionQuarters(mission);
  if (!quarters) return { ok: false, error: "umum" };
  const id = randomId();
  await pdb.insertSubmission(db, {
    id,
    missionId: mission.id,
    memberId: input.member.id,
    link: null,
    r2Key: input.r2Key,
    points: quarters,
    now: input.now,
    status: "approved",
  });
  const moved = await repo.adjustQuestProgress(db, {
    memberId: input.member.id,
    brandId: mission.brand_id,
    quarterDelta: quarters,
    now: input.now,
  });
  await pdb.addLedger(db, {
    id: randomId(),
    memberId: input.member.id,
    brandId: mission.brand_id,
    delta: quarters,
    reason: "quest",
    refId: id,
    now: input.now,
    earnedAt: input.now,
    expiresAt: null,
  });
  await logMission(db, input.member.id, mission.brand_id, mission.title, input.now);
  if (moved.stampDelta > 0) {
    await logActivity(db, {
      type: "stamp",
      memberId: input.member.id,
      brandId: mission.brand_id,
      outletId: null,
      sessionId: null,
      delta: moved.stampDelta,
      after: moved.stamps,
      note: mission.title,
      now: input.now,
    });
  }
  logEvent("mission_ok", { mission: mission.id, member: input.member.id, stamps: moved.stampDelta });
  return { ok: true, stampsAdded: moved.stampDelta };
}

export async function grantCashierMission(
  db: D1Database,
  input: { member: Member; missionId: string; brandId: string; now: number },
): Promise<Fail | { ok: true }> {
  const mission = await pdb.getMission(db, input.missionId);
  if (!mission || !mission.active || proofKind(mission) !== "cashier") return { ok: false, error: "misi" };
  if (mission.brand_id && mission.brand_id !== input.brandId) return { ok: false, error: "misi" };
  if (!missionInWindow(mission.starts_at, mission.ends_at, input.now)) return { ok: false, error: "misi" };
  const earned = await pdb.lifetimeEarned(db, input.member.id);
  if (questLocked({ mystery: mission.mystery === 1, unlockTenths: mission.unlock_points_tenths, lifetimeTenths: earned })) {
    return { ok: false, error: "misi" };
  }
  const state = await pdb.memberMissionState(db, input.member.id, mission.id);
  const limit = mission.limit_kind === "week" ? "week" : "once";
  if (!missionOpen({ limit, hasPending: state.pending, lastApprovedAt: state.lastApprovedAt, now: input.now })) {
    return { ok: false, error: "misi" };
  }
  const id = randomId();
  await pdb.insertSubmission(db, {
    id,
    missionId: mission.id,
    memberId: input.member.id,
    link: null,
    r2Key: null,
    points: mission.points_tenths,
    now: input.now,
    status: "approved",
  });
  await grantEarned(db, {
    memberId: input.member.id,
    brandId: mission.brand_id || input.brandId,
    delta: mission.points_tenths,
    reason: "mission",
    refId: id,
    now: input.now,
  });
  await logMission(db, input.member.id, mission.brand_id || input.brandId, mission.title, input.now);
  logEvent("mission_ok", { mission: mission.id, member: input.member.id, via: "kasir" });
  return { ok: true };
}

export async function revokeMission(db: D1Database, id: string, now: number): Promise<Fail | { ok: true; taken: number; stampDelta: number }> {
  const row = await pdb.getSubmission(db, id);
  if (!row || row.status !== "approved") return { ok: false, error: "umum" };
  const mission = await pdb.getMission(db, row.mission_id);
  const brandId = mission?.brand_id;
  const quarters = row.points_tenths > 0 && row.points_tenths <= 4 ? row.points_tenths : missionQuarters(mission || { points_tenths: row.points_tenths });
  let stampDelta = 0;
  if (brandId && quarters > 0) {
    const moved = await repo.adjustQuestProgress(db, { memberId: row.member_id, brandId, quarterDelta: -quarters, now });
    stampDelta = moved.stampDelta;
    await pdb.addLedger(db, {
      id: `rv_${row.id}`,
      memberId: row.member_id,
      brandId,
      delta: -quarters,
      reason: "quest_revoke",
      refId: row.id,
      now,
      earnedAt: now,
      expiresAt: null,
    });
    if (stampDelta !== 0) {
      await logActivity(db, {
        type: "cancel",
        memberId: row.member_id,
        brandId,
        outletId: null,
        sessionId: null,
        delta: stampDelta,
        after: moved.stamps,
        note: "tarik quest",
        now,
      });
    }
  }
  const won = await pdb.markRevoked(db, row.id, "stamp ditarik", now);
  if (!won) return { ok: false, error: "umum" };
  await repo.insertAdminLog(db, { id: randomId(), action: "tarik-poin", detail: `${row.id} q=${quarters} stamp=${stampDelta}`, now });
  logEvent("mission_revoke", { id: row.id, quarters, stampDelta });
  return { ok: true, taken: quarters, stampDelta };
}

export async function reviewMission(db: D1Database, input: { id: string; approve: boolean; now: number }): Promise<Fail | { ok: true }> {
  const row = await pdb.getSubmission(db, input.id);
  if (!row || row.status !== "pending") return { ok: false, error: "umum" };
  const mission = await pdb.getMission(db, row.mission_id);
  const won = await pdb.markSubmission(db, row.id, input.approve ? "approved" : "rejected", "", input.now);
  if (!won) return { ok: false, error: "umum" };
  if (input.approve) {
    await grantEarned(db, {
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

function asLots(rows: pdb.LedgerEntry[]): LedgerLike[] {
  return rows.map((row) => ({
    id: row.id,
    delta: row.delta_tenths,
    reason: row.reason,
    earnedAt: row.earned_at,
    expiresAt: row.expires_at,
    sourceId: row.source_id,
    createdAt: row.created_at,
  }));
}

export async function expireDays(db: D1Database): Promise<number> {
  const raw = Number(await repo.getSetting(db, "points_expire_days"));
  if (!Number.isInteger(raw) || raw < 1 || raw > 3650) return 60;
  return raw;
}

export async function refreshMember(db: D1Database, memberId: string, now: number): Promise<void> {
  const days = await expireDays(db);
  const { due } = splitLots(asLots(await pdb.listMemberLedger(db, memberId)), now, days);
  for (const lot of due) {
    await pdb.addLedger(db, {
      id: `exp_${lot.id}`,
      memberId,
      brandId: null,
      delta: -lot.remaining,
      reason: "expired",
      refId: lot.id,
      now,
      earnedAt: lot.earnedAt,
      expiresAt: lot.expiresAt,
      sourceId: lot.id,
    });
  }
}

export async function sweepExpiry(db: D1Database, now: number): Promise<void> {
  for (const memberId of await pdb.membersWithDuePoints(db, now)) await refreshMember(db, memberId, now);
}

async function grantEarned(
  db: D1Database,
  input: { memberId: string; brandId: string | null; delta: number; reason: string; refId: string | null; now: number; earnedAt?: number | null; expiresAt?: number | null },
) {
  const earnedAt = input.earnedAt ?? input.now;
  const expiresAt = input.expiresAt ?? expiresAtFor(earnedAt, await expireDays(db));
  await pdb.addLedger(db, {
    id: randomId(),
    memberId: input.memberId,
    brandId: input.brandId,
    delta: input.delta,
    reason: input.reason,
    refId: input.refId,
    now: input.now,
    earnedAt,
    expiresAt,
  });
}

async function spendPointsFifo(
  db: D1Database,
  input: { memberId: string; brandId: string | null; cost: number; reason: string; refId: string; now: number; preferId?: string | null },
): Promise<{ ok: true } | { ok: false }> {
  await refreshMember(db, input.memberId, input.now);
  const days = await expireDays(db);
  const { open } = splitLots(asLots(await pdb.listMemberLedger(db, input.memberId)), input.now, days);
  const plan = allocateUpTo(open, input.cost, input.preferId);
  if (plan.taken !== input.cost) return { ok: false };
  for (const take of plan.takes) {
    await pdb.addLedger(db, {
      id: randomId(),
      memberId: input.memberId,
      brandId: input.brandId,
      delta: -take.amount,
      reason: input.reason,
      refId: input.refId,
      now: input.now,
      earnedAt: take.earnedAt,
      expiresAt: take.expiresAt,
      sourceId: take.id,
    });
  }
  return { ok: true };
}

async function restoreRedeem(db: D1Database, row: pdb.RedeemCode, now: number): Promise<void> {
  const slices = await pdb.listRefLedger(db, row.id, "redeem");
  if (!slices.length) {
    if (row.points_tenths > 0) {
      await grantEarned(db, { memberId: row.member_id, brandId: row.brand_id, delta: row.points_tenths, reason: "refund", refId: row.id, now });
    }
    return;
  }
  for (const slice of slices) {
    await pdb.addLedger(db, {
      id: randomId(),
      memberId: row.member_id,
      brandId: row.brand_id,
      delta: -slice.delta_tenths,
      reason: "refund",
      refId: row.id,
      now,
      earnedAt: slice.earned_at,
      expiresAt: slice.expires_at,
    });
  }
}

async function logMission(db: D1Database, memberId: string, brandId: string | null, title: string, now: number) {
  const brand = brandId || (await repo.listBrands(db, true))[0]?.id;
  if (!brand) return;
  await logActivity(db, {
    type: "mission",
    memberId,
    brandId: brand,
    outletId: null,
    sessionId: null,
    delta: 0,
    after: (await repo.getCard(db, memberId, brand))?.stamps ?? 0,
    note: title,
    now,
  });
}

export async function memberPointState(db: D1Database, memberId: string, now: number): Promise<{
  balance: number;
  days: number;
  batch: { tenths: number; expiresAt: number; soon: boolean } | null;
}> {
  await refreshMember(db, memberId, now);
  const days = await expireDays(db);
  const { open } = splitLots(asLots(await pdb.listMemberLedger(db, memberId)), now, days);
  return { balance: await pdb.pointsBalance(db, memberId), days, batch: soonestBatch(open, now) };
}

export async function expiryNotes(db: D1Database, now: number): Promise<Map<string, { tenths: number; expiresAt: number }>> {
  await sweepExpiry(db, now);
  const grouped = new Map<string, LedgerLike[]>();
  for (const row of await pdb.listAllLedger(db)) {
    const list = grouped.get(row.member_id) || [];
    list.push({
      id: row.id,
      delta: row.delta_tenths,
      reason: row.reason,
      earnedAt: row.earned_at,
      expiresAt: row.expires_at,
      sourceId: row.source_id,
      createdAt: row.created_at,
    });
    grouped.set(row.member_id, list);
  }
  const days = await expireDays(db);
  const notes = new Map<string, { tenths: number; expiresAt: number }>();
  for (const [memberId, rows] of grouped) {
    const batch = soonestBatch(splitLots(rows, now, days).open, now);
    if (batch) notes.set(memberId, { tenths: batch.tenths, expiresAt: batch.expiresAt });
  }
  return notes;
}
