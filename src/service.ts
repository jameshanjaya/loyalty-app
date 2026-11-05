import { birthdayRedeemAllowed, birthdayStatus, parseBirthday } from "./birthday";
import { bytesToHex, hashPin, randomBytes, randomId, verifyPin } from "./crypto";
import { ownerPasswordOk, ownerSubject, planOwnerPasswordChange, type StoredOwnerPassword } from "./owner-password";
import { maskName } from "./format";
import {
  CASHIER_FLAG_AT,
  CASHIER_FLAG_WINDOW_MS,
  CASHIER_SESSION_MS,
  MEMBER_SESSION_MS,
  OWNER_SESSION_MS,
  applyStamp,
  canCancel,
  nextDayCount,
} from "./loyalty";
import { logEvent } from "./log";
import { normalizeWa, validName, validOutletPin, validPin, weakPin } from "./phone";
import { birthdayEditAllowed, decidePhone } from "./profile";
import * as repo from "./repo";
import { LIMITS, enforceLimit, failureBlocked } from "./ratelimit";
import { STAFF_FLAG_REASON, staffFlagDetail } from "./staff";
import { startOfWibDay } from "./time";
import { issueClaim, inspectClaim, type ClaimReader } from "./tokens";
import type { Brand, Member, Outlet } from "./types";

const DUMMY_SALT = "ab".repeat(16);
const DUMMY_HASH = "cd".repeat(32);

export type Fail = { ok: false; error: string };

function saltHex(): string {
  return bytesToHex(randomBytes(16));
}

function secretsReady(env: Env): boolean {
  return Boolean(env.PIN_PEPPER && env.PIN_PEPPER.length >= 16 && env.TOKEN_SECRET && env.TOKEN_SECRET.length >= 16);
}

function reader(db: D1Database): ClaimReader {
  return {
    get: (id) => repo.getClaim(db, id),
    markClaimed: (id, memberId, now) => repo.markClaimClaimed(db, id, memberId, now),
  };
}

async function paceFlag(db: D1Database, sessionId: string | null, outletId: string | null, now: number): Promise<void> {
  if (!sessionId) return;
  const n = await repo.countSessionStamps(db, sessionId, now - CASHIER_FLAG_WINDOW_MS);
  if (n < CASHIER_FLAG_AT) return;
  await repo.insertFlag(db, {
    id: randomId(),
    outletId,
    sessionId,
    memberId: null,
    reason: "ramai",
    detail: `${n} stamp dalam 15 menit dari sesi kasir yang sama.`,
    now,
  });
  logEvent("flag_ramai", { outlet: outletId, count: n });
}

async function blockIfStaff(
  db: D1Database,
  input: { outletId: string | null; member: Member; sessionId: string | null; now: number },
): Promise<Fail | null> {
  if (!input.outletId) return null;
  if (!(await repo.isOutletStaff(db, input.outletId, input.member.id))) return null;
  await repo.insertFlag(db, {
    id: randomId(),
    outletId: input.outletId,
    sessionId: input.sessionId,
    memberId: input.member.id,
    reason: STAFF_FLAG_REASON,
    detail: staffFlagDetail(input.member.name),
    now: input.now,
    dedupe: false,
  });
  logEvent("staff_block", { outlet: input.outletId, member: input.member.id });
  return { ok: false, error: "sendiri" };
}

async function capFlag(db: D1Database, memberId: string, outletId: string | null, sessionId: string | null, now: number): Promise<void> {
  await repo.insertFlag(db, {
    id: randomId(),
    outletId,
    sessionId,
    memberId,
    reason: "batas",
    detail: "Stamp ditolak karena batas harian member.",
    now,
  });
}

export async function giveStamp(
  db: D1Database,
  input: {
    member: Member;
    brand: Brand;
    outletId: string | null;
    sessionId: string | null;
    claimId: string | null;
    now: number;
    confirmed: boolean;
    note: string;
  },
): Promise<{ ok: true; activityId: string; balance: number; masked: string } | Fail> {
  const staff = await blockIfStaff(db, input);
  if (staff) return staff;
  const previewRule = applyStamp({ confirmed: input.confirmed, balance: 0 });
  if (!previewRule.ok) return { ok: false, error: "syarat" };
  const today = startOfWibDay(input.now);
  const card = await repo.ensureCard(db, input.member.id, input.brand.id, input.now);
  const day = nextDayCount(card.day_count, card.day_on, today, input.brand.max_stamps_per_day);
  if (!day.ok) {
    await capFlag(db, input.member.id, input.outletId, input.sessionId, input.now);
    return { ok: false, error: "cap" };
  }
  const updated = await repo.addStampAtomic(db, {
    memberId: input.member.id,
    brandId: input.brand.id,
    today,
    now: input.now,
    maxPerDay: input.brand.max_stamps_per_day,
  });
  if (!updated) {
    await capFlag(db, input.member.id, input.outletId, input.sessionId, input.now);
    return { ok: false, error: "cap" };
  }
  const activityId = randomId();
  try {
    await repo.insertActivity(db, {
      id: activityId,
      type: "stamp",
      memberId: input.member.id,
      brandId: input.brand.id,
      outletId: input.outletId,
      sessionId: input.sessionId,
      claimId: input.claimId,
      stampsDelta: 1,
      stampsAfter: updated.stamps,
      note: input.note,
      reversesId: null,
      now: input.now,
    });
  } catch (error) {
    await repo.revertStampNumbers(db, { memberId: input.member.id, brandId: input.brand.id, today, now: input.now });
    throw error;
  }
  try {
    await repo.touchMember(db, input.member.id, input.now);
    await paceFlag(db, input.sessionId, input.outletId, input.now);
  } catch (error) {
    logEvent("stamp_followup_fail", { member: input.member.id, message: error instanceof Error ? error.message : "error" });
  }
  const masked = maskName(input.member.name, input.member.wa);
  logEvent("stamp", { brand: input.brand.id, outlet: input.outletId, member: input.member.id, balance: updated.stamps });
  return { ok: true, activityId, balance: updated.stamps, masked };
}

export async function giveRedeem(
  db: D1Database,
  input: {
    member: Member;
    brand: Brand;
    outletId: string | null;
    sessionId: string | null;
    claimId: string | null;
    now: number;
    note: string;
  },
): Promise<{ ok: true; activityId: string; balance: number; masked: string } | Fail> {
  const staff = await blockIfStaff(db, input);
  if (staff) return staff;
  await repo.ensureCard(db, input.member.id, input.brand.id, input.now);
  const updated = await repo.redeemAtomic(db, {
    memberId: input.member.id,
    brandId: input.brand.id,
    required: input.brand.stamps_required,
    now: input.now,
  });
  if (!updated) return { ok: false, error: "kurang" };
  const activityId = randomId();
  try {
    await repo.insertActivity(db, {
      id: activityId,
      type: "redeem",
      memberId: input.member.id,
      brandId: input.brand.id,
      outletId: input.outletId,
      sessionId: input.sessionId,
      claimId: input.claimId,
      stampsDelta: -input.brand.stamps_required,
      stampsAfter: updated.stamps,
      note: input.note,
      reversesId: null,
      now: input.now,
    });
  } catch (error) {
    await repo.revertRedeemNumbers(db, {
      memberId: input.member.id,
      brandId: input.brand.id,
      spent: input.brand.stamps_required,
      now: input.now,
    });
    throw error;
  }
  try {
    await repo.touchMember(db, input.member.id, input.now);
  } catch (error) {
    logEvent("redeem_followup_fail", { member: input.member.id, message: error instanceof Error ? error.message : "error" });
  }
  const masked = maskName(input.member.name, input.member.wa);
  logEvent("redeem", { brand: input.brand.id, outlet: input.outletId, member: input.member.id, balance: updated.stamps });
  return { ok: true, activityId, balance: updated.stamps, masked };
}

export async function joinMember(
  db: D1Database,
  env: Env,
  input: { name: string; waRaw: string; pin: string; pin2: string; brandId: string | null; ip: string; now: number },
): Promise<{ ok: true; sessionId: string; member: Member } | Fail> {
  if (!secretsReady(env)) return { ok: false, error: "secret" };
  const ipLimit = await enforceLimit(db, `join:ip:${input.ip}`, input.now, LIMITS.join);
  if (!ipLimit.ok) return { ok: false, error: "pinwait" };
  if (!validName(input.name)) return { ok: false, error: "nama" };
  const wa = normalizeWa(input.waRaw);
  if (!wa) return { ok: false, error: "wa" };
  if (!validPin(input.pin)) return { ok: false, error: "pinrule" };
  if (weakPin(input.pin)) return { ok: false, error: "pinweak" };
  if (input.pin !== input.pin2) return { ok: false, error: "pinmatch" };
  const existing = await repo.getMemberByWa(db, wa);
  if (existing) return { ok: false, error: "ada" };
  const salt = saltHex();
  const pinHash = await hashPin(input.pin, hexToBytesSafe(salt), env.PIN_PEPPER);
  const member: Member = {
    id: randomId(),
    name: input.name.trim(),
    wa,
    pin_hash: pinHash,
    pin_salt: salt,
    created_at: input.now,
    last_seen_at: input.now,
    email: null,
    birthday: null,
    google_sub: null,
    join_method: "wa",
  };
  await repo.insertMember(db, { id: member.id, name: member.name, wa, pinHash, pinSalt: salt, now: input.now });
  const brands = await repo.listBrands(db, false);
  for (const brand of brands) await repo.ensureCard(db, member.id, brand.id, input.now);
  const brandId = input.brandId && brands.some((b) => b.id === input.brandId) ? input.brandId : brands[0]?.id;
  if (brandId) {
    await repo.insertActivity(db, {
      id: randomId(),
      type: "join",
      memberId: member.id,
      brandId,
      outletId: null,
      sessionId: null,
      claimId: null,
      stampsDelta: 0,
      stampsAfter: 0,
      note: "gabung",
      reversesId: null,
      now: input.now,
    });
  }
  const sessionId = randomId();
  await repo.createSession(db, {
    id: sessionId,
    kind: "member",
    subjectId: member.id,
    now: input.now,
    expiresAt: input.now + MEMBER_SESSION_MS,
  });
  logEvent("join", { member: member.id });
  return { ok: true, sessionId, member };
}

function hexToBytesSafe(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function loginMember(
  db: D1Database,
  env: Env,
  input: { waRaw: string; pin: string; ip: string; now: number },
): Promise<{ ok: true; sessionId: string; member: Member } | Fail> {
  if (!secretsReady(env)) return { ok: false, error: "secret" };
  const wa = normalizeWa(input.waRaw);
  if (!wa || !validPin(input.pin)) {
    await verifyPin(input.pin || "0000", DUMMY_SALT, DUMMY_HASH, env.PIN_PEPPER);
    return { ok: false, error: "tidak" };
  }
  const byWa = await failureBlocked(db, `pin:wa:${wa}`, input.now, LIMITS.memberPin);
  const byIp = await failureBlocked(db, `pin:ip:${input.ip}`, input.now, LIMITS.memberPinIp);
  if (!byWa.ok || !byIp.ok) return { ok: false, error: "pinwait" };
  const member = await repo.getMemberByWa(db, wa);
  const ok = member
    ? await verifyPin(input.pin, member.pin_salt, member.pin_hash, env.PIN_PEPPER)
    : await verifyPin(input.pin, DUMMY_SALT, DUMMY_HASH, env.PIN_PEPPER);
  if (!member || !ok) {
    await enforceLimit(db, `pin:wa:${wa}`, input.now, LIMITS.memberPin);
    await enforceLimit(db, `pin:ip:${input.ip}`, input.now, LIMITS.memberPinIp);
    logEvent("member_login_fail", { ip: input.ip });
    return { ok: false, error: "tidak" };
  }
  await repo.touchMember(db, member.id, input.now);
  const sessionId = randomId();
  await repo.createSession(db, {
    id: sessionId,
    kind: "member",
    subjectId: member.id,
    now: input.now,
    expiresAt: input.now + MEMBER_SESSION_MS,
  });
  logEvent("member_login", { member: member.id });
  return { ok: true, sessionId, member };
}

export async function loginCashier(
  db: D1Database,
  env: Env,
  input: { outletId: string; pin: string; ip: string; now: number },
): Promise<{ ok: true; sessionId: string; outlet: Outlet } | Fail> {
  if (!secretsReady(env)) return { ok: false, error: "secret" };
  const outlet = await repo.getOutlet(db, input.outletId);
  if (!outlet || !outlet.active) return { ok: false, error: "outlet" };
  const byOut = await failureBlocked(db, `cpin:out:${outlet.id}`, input.now, LIMITS.cashierPin);
  const byIp = await failureBlocked(db, `cpin:ip:${input.ip}`, input.now, LIMITS.cashierPinIp);
  if (!byOut.ok || !byIp.ok) return { ok: false, error: "pinwait" };
  const ok = await verifyPin(input.pin, outlet.pin_salt, outlet.pin_hash, env.PIN_PEPPER);
  if (!ok) {
    await enforceLimit(db, `cpin:out:${outlet.id}`, input.now, LIMITS.cashierPin);
    await enforceLimit(db, `cpin:ip:${input.ip}`, input.now, LIMITS.cashierPinIp);
    logEvent("cashier_login_fail", { outlet: outlet.id });
    return { ok: false, error: "pin" };
  }
  const sessionId = randomId();
  await repo.createSession(db, {
    id: sessionId,
    kind: "cashier",
    subjectId: outlet.id,
    now: input.now,
    expiresAt: input.now + CASHIER_SESSION_MS,
  });
  logEvent("cashier_login", { outlet: outlet.id });
  return { ok: true, sessionId, outlet };
}

async function storedOwnerPassword(db: D1Database): Promise<StoredOwnerPassword | null> {
  const salt = await repo.getSetting(db, "owner_pass_salt");
  const hash = await repo.getSetting(db, "owner_pass_hash");
  if (!salt || !hash) return null;
  return { salt, hash };
}

export async function loginOwner(
  db: D1Database,
  env: Env,
  input: { password: string; ip: string; now: number },
): Promise<{ ok: true; sessionId: string } | Fail> {
  if (!env.PIN_PEPPER || env.PIN_PEPPER.length < 16) return { ok: false, error: "secret" };
  const stored = await storedOwnerPassword(db);
  if (!stored && (!env.OWNER_PASSWORD || env.OWNER_PASSWORD.length < 8)) return { ok: false, error: "secret" };
  const blocked = await failureBlocked(db, `owner:ip:${input.ip}`, input.now, LIMITS.ownerPin);
  if (!blocked.ok) return { ok: false, error: "pinwait" };
  const ok = await ownerPasswordOk({
    password: input.password,
    pepper: env.PIN_PEPPER,
    envPassword: env.OWNER_PASSWORD || "",
    stored,
  });
  if (!ok) {
    await enforceLimit(db, `owner:ip:${input.ip}`, input.now, LIMITS.ownerPin);
    logEvent("owner_login_fail", { ip: input.ip });
    return { ok: false, error: "pin" };
  }
  const version = await repo.getSetting(db, "owner_session_version");
  const sessionId = randomId();
  await repo.createSession(db, {
    id: sessionId,
    kind: "owner",
    subjectId: ownerSubject(version),
    now: input.now,
    expiresAt: input.now + OWNER_SESSION_MS,
  });
  logEvent("owner_login", {});
  return { ok: true, sessionId };
}

export async function changeOwnerPassword(
  db: D1Database,
  env: Env,
  input: { sessionId: string; current: string; next: string; confirm: string; now: number },
): Promise<{ ok: true } | Fail> {
  const stored = await storedOwnerPassword(db);
  const plan = await planOwnerPasswordChange({
    current: input.current,
    next: input.next,
    confirm: input.confirm,
    pepper: env.PIN_PEPPER || "",
    envPassword: env.OWNER_PASSWORD || "",
    stored,
  });
  if (!plan.ok) return plan;
  const previous = Number(await repo.getSetting(db, "owner_session_version")) || 0;
  const version = String(previous + 1);
  await repo.saveOwnerPassword(db, { salt: plan.salt, hash: plan.hash, version, sessionId: input.sessionId });
  await repo.insertAdminLog(db, { id: randomId(), action: "ganti-password", detail: `versi ${version}`, now: input.now });
  logEvent("owner_password", { version });
  return { ok: true };
}

export async function openClaim(
  db: D1Database,
  env: Env,
  input: { outlet: Outlet; sessionId: string; kind: "stamp" | "redeem" | "birthday"; confirmed: boolean; now: number },
): Promise<{ ok: true; id: string } | Fail> {
  if (!secretsReady(env)) return { ok: false, error: "secret" };
  if (input.kind === "stamp" && !input.confirmed) return { ok: false, error: "syarat" };
  const limited = await enforceLimit(db, `issue:${input.sessionId}`, input.now, LIMITS.cashierIssue);
  if (!limited.ok) return { ok: false, error: "cepat" };
  const issued = await issueClaim(
    { insert: (record) => repo.insertClaim(db, record) },
    { outletId: input.outlet.id, brandId: input.outlet.brand_id, sessionId: input.sessionId, kind: input.kind },
    env.TOKEN_SECRET,
    input.now,
  );
  logEvent("claim_open", { kind: input.kind, outlet: input.outlet.id });
  return { ok: true, id: issued.record.id };
}

export async function finishClaim(
  db: D1Database,
  env: Env,
  input: { token: string; member: Member; ip: string; now: number },
): Promise<{ ok: true; activityId: string; masked: string } | Fail> {
  if (!secretsReady(env)) return { ok: false, error: "secret" };
  const byMember = await enforceLimit(db, `claim:m:${input.member.id}`, input.now, LIMITS.claimMember);
  const byIp = await enforceLimit(db, `claim:ip:${input.ip}`, input.now, LIMITS.claimIp);
  if (!byMember.ok || !byIp.ok) return { ok: false, error: "pinwait" };
  const seen = await inspectClaim(reader(db), input.token, env.TOKEN_SECRET, input.now);
  if (!seen.ok) {
    if (seen.reason === "expired") return { ok: false, error: "expired" };
    if (seen.reason === "used") return { ok: false, error: "used" };
    if (seen.reason === "cancelled") return { ok: false, error: "cancelled" };
    return { ok: false, error: "claim" };
  }
  const brand = await repo.getBrand(db, seen.payload.brandId);
  const outlet = await repo.getOutlet(db, seen.payload.outletId);
  if (!brand || !brand.active || !outlet) return { ok: false, error: "claim" };
  if (seen.payload.kind === "stamp") {
    const today = startOfWibDay(input.now);
    const card = await repo.ensureCard(db, input.member.id, brand.id, input.now);
    if (!nextDayCount(card.day_count, card.day_on, today, brand.max_stamps_per_day).ok) {
      await capFlag(db, input.member.id, outlet.id, seen.record.sessionId, input.now);
      return { ok: false, error: "cap" };
    }
  } else if (seen.payload.kind === "birthday") {
    const offer = birthdayStatus(input.member.birthday, input.now, {
      active: brand.birthday_active === 1,
      window: brand.birthday_window === "around" ? "around" : "month",
      days: brand.birthday_days,
    });
    if (birthdayRedeemAllowed(offer.open, false) !== "ok") return { ok: false, error: "ultah" };
    if (offer.open && (await repo.birthdayTaken(db, input.member.id, brand.id, offer.rewardYear))) {
      return { ok: false, error: "ultah-sudah" };
    }
  } else {
    const card = await repo.ensureCard(db, input.member.id, brand.id, input.now);
    if (card.stamps < brand.stamps_required) return { ok: false, error: "kurang" };
  }
  const won = await repo.markClaimClaimed(db, seen.record.id, input.member.id, input.now);
  if (!won) return { ok: false, error: "used" };
  try {
    const done =
      seen.payload.kind === "stamp"
        ? await giveStamp(db, {
            member: input.member,
            brand,
            outletId: outlet.id,
            sessionId: seen.record.sessionId,
            claimId: seen.record.id,
            now: input.now,
            confirmed: true,
            note: "qr",
          })
        : seen.payload.kind === "birthday"
          ? await giveBirthday(db, {
              member: input.member,
              brand,
              outletId: outlet.id,
              sessionId: seen.record.sessionId,
              claimId: seen.record.id,
              now: input.now,
              note: "qr",
            })
          : await giveRedeem(db, {
              member: input.member,
              brand,
              outletId: outlet.id,
              sessionId: seen.record.sessionId,
              claimId: seen.record.id,
              now: input.now,
              note: "qr",
            });
    if (!done.ok) {
      await repo.reopenClaim(db, seen.record.id);
      return done;
    }
    return { ok: true, activityId: done.activityId, masked: done.masked };
  } catch (error) {
    await repo.reopenClaim(db, seen.record.id);
    throw error;
  }
}

export async function manualStamp(
  db: D1Database,
  input: { outlet: Outlet; brand: Brand; sessionId: string; waRaw: string; confirmed: boolean; now: number },
): Promise<{ ok: true; activityId: string; masked: string } | Fail> {
  const limited = await enforceLimit(db, `issue:${input.sessionId}`, input.now, LIMITS.cashierIssue);
  if (!limited.ok) return { ok: false, error: "cepat" };
  if (!input.confirmed) return { ok: false, error: "syarat" };
  const wa = normalizeWa(input.waRaw);
  if (!wa) return { ok: false, error: "wa" };
  const member = await repo.getMemberByWa(db, wa);
  if (!member) return { ok: false, error: "belum" };
  const done = await giveStamp(db, {
    member,
    brand: input.brand,
    outletId: input.outlet.id,
    sessionId: input.sessionId,
    claimId: null,
    now: input.now,
    confirmed: true,
    note: "nomor WA",
  });
  if (!done.ok) return done;
  return { ok: true, activityId: done.activityId, masked: done.masked };
}

export async function manualRedeem(
  db: D1Database,
  input: { outlet: Outlet; brand: Brand; sessionId: string; member: Member; now: number },
): Promise<{ ok: true; activityId: string; masked: string } | Fail> {
  const limited = await enforceLimit(db, `issue:${input.sessionId}`, input.now, LIMITS.cashierIssue);
  if (!limited.ok) return { ok: false, error: "cepat" };
  return giveRedeem(db, {
    member: input.member,
    brand: input.brand,
    outletId: input.outlet.id,
    sessionId: input.sessionId,
    claimId: null,
    now: input.now,
    note: "nomor WA",
  });
}

export async function lookupMember(
  db: D1Database,
  input: { sessionId: string; waRaw: string; now: number },
): Promise<{ ok: true; member: Member } | Fail> {
  const limited = await enforceLimit(db, `look:${input.sessionId}`, input.now, LIMITS.lookup);
  if (!limited.ok) return { ok: false, error: "cari" };
  const wa = normalizeWa(input.waRaw);
  if (!wa) return { ok: false, error: "wa" };
  const member = await repo.getMemberByWa(db, wa);
  if (!member) return { ok: false, error: "belum" };
  return { ok: true, member };
}

export async function cancelOwn(
  db: D1Database,
  input: { sessionId: string; activityId: string; now: number },
): Promise<{ ok: true } | Fail> {
  const last = await repo.latestOpenActivity(db, input.sessionId);
  if (!last || last.id !== input.activityId) return { ok: false, error: "batal" };
  if (!canCancel({ createdAt: last.created_at, now: input.now, sameSession: true, voided: last.voided === 1, isLast: true })) {
    return { ok: false, error: "batal" };
  }
  const voided = await repo.markVoided(db, last.id);
  if (!voided) return { ok: false, error: "batal" };
  try {
    if (last.type === "stamp") {
      const today = startOfWibDay(input.now);
      const updated = await repo.undoStampAtomic(db, {
        memberId: last.member_id,
        brandId: last.brand_id,
        today,
        now: input.now,
        countToday: last.created_at >= today,
      });
      if (!updated) {
        await repo.unvoid(db, last.id);
        return { ok: false, error: "batal" };
      }
      await repo.insertActivity(db, {
        id: randomId(),
        type: "cancel",
        memberId: last.member_id,
        brandId: last.brand_id,
        outletId: last.outlet_id,
        sessionId: input.sessionId,
        claimId: null,
        stampsDelta: -1,
        stampsAfter: updated.stamps,
        note: "batal kasir",
        reversesId: last.id,
        now: input.now,
      });
    } else if (last.type === "redeem") {
      const spent = -last.stamps_delta;
      const updated = await repo.undoRedeemAtomic(db, {
        memberId: last.member_id,
        brandId: last.brand_id,
        spent,
        now: input.now,
      });
      if (!updated) {
        await repo.unvoid(db, last.id);
        return { ok: false, error: "batal" };
      }
      await repo.insertActivity(db, {
        id: randomId(),
        type: "cancel",
        memberId: last.member_id,
        brandId: last.brand_id,
        outletId: last.outlet_id,
        sessionId: input.sessionId,
        claimId: null,
        stampsDelta: spent,
        stampsAfter: updated.stamps,
        note: "batal kasir",
        reversesId: last.id,
        now: input.now,
      });
    } else {
      await repo.unvoid(db, last.id);
      return { ok: false, error: "batal" };
    }
  } catch (error) {
    await repo.unvoid(db, last.id);
    throw error;
  }
  logEvent("cancel", { activity: last.id, outlet: last.outlet_id });
  return { ok: true };
}

export async function giveBirthday(
  db: D1Database,
  input: {
    member: Member;
    brand: Brand;
    outletId: string | null;
    sessionId: string | null;
    claimId: string | null;
    now: number;
    note: string;
  },
): Promise<{ ok: true; activityId: string; balance: number; masked: string } | Fail> {
  const staff = await blockIfStaff(db, input);
  if (staff) return staff;
  const offer = birthdayStatus(input.member.birthday, input.now, {
    active: input.brand.birthday_active === 1,
    window: input.brand.birthday_window === "around" ? "around" : "month",
    days: input.brand.birthday_days,
  });
  if (!offer.open) return { ok: false, error: "ultah" };
  const card = await repo.ensureCard(db, input.member.id, input.brand.id, input.now);
  const activityId = randomId();
  const saved = await repo.insertBirthdayRedemption(db, {
    memberId: input.member.id,
    brandId: input.brand.id,
    year: offer.rewardYear,
    activityId,
    now: input.now,
  });
  if (!saved) return { ok: false, error: "ultah-sudah" };
  try {
    await repo.insertActivity(db, {
      id: activityId,
      type: "birthday",
      memberId: input.member.id,
      brandId: input.brand.id,
      outletId: input.outletId,
      sessionId: input.sessionId,
      claimId: input.claimId,
      stampsDelta: 0,
      stampsAfter: card.stamps,
      note: input.brand.birthday_reward || "ulang tahun",
      reversesId: null,
      now: input.now,
    });
  } catch (error) {
    await repo.deleteBirthdayRedemption(db, input.member.id, input.brand.id, offer.rewardYear);
    throw error;
  }
  const masked = maskName(input.member.name, input.member.wa);
  logEvent("birthday", { brand: input.brand.id, member: input.member.id, year: offer.rewardYear });
  return { ok: true, activityId, balance: card.stamps, masked };
}

export async function completeGoogleProfile(
  db: D1Database,
  env: Env,
  input: { pendingId: string; sub: string; email: string | null; name: string; waRaw: string; birthdayRaw: string; pin: string; pin2: string; now: number },
): Promise<{ ok: true; sessionId: string; member: Member } | Fail> {
  if (!secretsReady(env)) return { ok: false, error: "secret" };
  if (!validName(input.name)) return { ok: false, error: "nama" };
  const wa = normalizeWa(input.waRaw);
  if (!wa) return { ok: false, error: "wa" };
  const birthday = parseBirthday(input.birthdayRaw, input.now);
  if (!birthday) return { ok: false, error: "lahir" };
  if (!validPin(input.pin)) return { ok: false, error: "pinrule" };
  if (weakPin(input.pin)) return { ok: false, error: "pinweak" };
  if (input.pin !== input.pin2) return { ok: false, error: "pinmatch" };
  const existing = await repo.getMemberByWa(db, wa);
  const choice = decidePhone(existing ? { googleSub: existing.google_sub } : null);
  if (choice === "taken") return { ok: false, error: "google-lain" };
  if (choice === "link") return { ok: false, error: "punya" };
  const salt = saltHex();
  const pinHash = await hashPin(input.pin, hexToBytesSafe(salt), env.PIN_PEPPER);
  const member: Member = {
    id: randomId(),
    name: input.name.trim(),
    wa,
    pin_hash: pinHash,
    pin_salt: salt,
    created_at: input.now,
    last_seen_at: input.now,
    email: input.email,
    birthday,
    google_sub: input.sub,
    join_method: "google",
  };
  await repo.insertMember(db, { id: member.id, name: member.name, wa, pinHash, pinSalt: salt, now: input.now });
  await repo.setMemberGoogle(db, member.id, input.sub, input.email, "google");
  await repo.setMemberBirthday(db, member.id, birthday);
  const brands = await repo.listBrands(db, false);
  for (const brand of brands) await repo.ensureCard(db, member.id, brand.id, input.now);
  if (brands[0]) {
    await repo.insertActivity(db, {
      id: randomId(),
      type: "join",
      memberId: member.id,
      brandId: brands[0].id,
      outletId: null,
      sessionId: null,
      claimId: null,
      stampsDelta: 0,
      stampsAfter: 0,
      note: "gabung google",
      reversesId: null,
      now: input.now,
    });
  }
  await repo.deletePending(db, input.pendingId);
  const sessionId = randomId();
  await repo.createSession(db, { id: sessionId, kind: "member", subjectId: member.id, now: input.now, expiresAt: input.now + MEMBER_SESSION_MS });
  logEvent("join_google", { member: member.id });
  return { ok: true, sessionId, member };
}

export async function linkGoogleWithPin(
  db: D1Database,
  env: Env,
  input: { pendingId: string; sub: string; email: string | null; waRaw: string; pin: string; birthdayRaw: string; ip: string; now: number },
): Promise<{ ok: true; sessionId: string; member: Member } | Fail> {
  if (!secretsReady(env)) return { ok: false, error: "secret" };
  const wa = normalizeWa(input.waRaw);
  if (!wa) return { ok: false, error: "wa" };
  const blocked = await failureBlocked(db, `pin:wa:${wa}`, input.now, LIMITS.memberPin);
  if (!blocked.ok) return { ok: false, error: "pinwait" };
  const member = await repo.getMemberByWa(db, wa);
  if (!member) return { ok: false, error: "belum" };
  const choice = decidePhone({ googleSub: member.google_sub });
  if (choice === "taken") return { ok: false, error: "google-lain" };
  const ok = await verifyPin(input.pin, member.pin_salt, member.pin_hash, env.PIN_PEPPER);
  if (!ok) {
    await enforceLimit(db, `pin:wa:${wa}`, input.now, LIMITS.memberPin);
    return { ok: false, error: "pin" };
  }
  await repo.setMemberGoogle(db, member.id, input.sub, input.email, "link");
  if (!member.birthday) {
    const birthday = parseBirthday(input.birthdayRaw, input.now);
    if (birthday && birthdayEditAllowed(member.birthday, false)) await repo.setMemberBirthday(db, member.id, birthday);
  }
  await repo.deletePending(db, input.pendingId);
  await repo.insertAdminLog(db, {
    id: randomId(),
    action: "link_google",
    detail: `${member.name} menghubungkan Google`,
    now: input.now,
  });
  const sessionId = randomId();
  await repo.createSession(db, { id: sessionId, kind: "member", subjectId: member.id, now: input.now, expiresAt: input.now + MEMBER_SESSION_MS });
  logEvent("link_google", { member: member.id });
  return { ok: true, sessionId, member: { ...member, google_sub: input.sub, email: member.email || input.email } };
}

export async function setOwnBirthday(
  db: D1Database,
  input: { member: Member; birthdayRaw: string; now: number },
): Promise<Fail | { ok: true }> {
  if (!birthdayEditAllowed(input.member.birthday, false)) return { ok: false, error: "lahir" };
  const birthday = parseBirthday(input.birthdayRaw, input.now);
  if (!birthday) return { ok: false, error: "lahir" };
  await repo.setMemberBirthday(db, input.member.id, birthday);
  return { ok: true };
}

export async function ownerSetPhone(
  db: D1Database,
  input: { member: Member; waRaw: string; now: number },
): Promise<Fail | { ok: true; wa: string }> {
  const wa = normalizeWa(input.waRaw);
  if (!wa) return { ok: false, error: "wa" };
  const other = await repo.getMemberByWa(db, wa);
  if (other && other.id !== input.member.id) return { ok: false, error: "ada" };
  await repo.setMemberPhone(db, input.member.id, wa);
  await repo.insertAdminLog(db, {
    id: randomId(),
    action: "edit_phone",
    detail: `${input.member.name}: ${input.member.wa} -> ${wa}`,
    now: input.now,
  });
  return { ok: true, wa };
}

export async function ownerSetBirthday(
  db: D1Database,
  input: { member: Member; birthdayRaw: string; now: number },
): Promise<Fail | { ok: true }> {
  const birthday = parseBirthday(input.birthdayRaw, input.now);
  if (!birthday) return { ok: false, error: "lahir" };
  await repo.setMemberBirthday(db, input.member.id, birthday);
  await repo.insertAdminLog(db, {
    id: randomId(),
    action: "edit_birthday",
    detail: `${input.member.name}: ${input.member.birthday || "-"} -> ${birthday}`,
    now: input.now,
  });
  return { ok: true };
}

export async function ownerDeleteMember(db: D1Database, input: { member: Member; now: number }): Promise<{ ok: true }> {
  await repo.insertAdminLog(db, {
    id: randomId(),
    action: "delete_member",
    detail: `${input.member.name} ${input.member.wa} ${input.member.email || ""}`.trim(),
    now: input.now,
  });
  await repo.deleteMemberCascade(db, input.member.id);
  logEvent("delete_member", { member: input.member.id });
  return { ok: true };
}

export async function setOutletPinHash(db: D1Database, env: Env, outletId: string, pin: string): Promise<Fail | { ok: true }> {
  if (!secretsReady(env)) return { ok: false, error: "secret" };
  if (!validOutletPin(pin) || weakPin(pin)) return { ok: false, error: "pinweak" };
  const salt = saltHex();
  const pinHash = await hashPin(pin, hexToBytesSafe(salt), env.PIN_PEPPER);
  await repo.setOutletPin(db, outletId, pinHash, salt);
  return { ok: true };
}

export { hexToBytesSafe };
