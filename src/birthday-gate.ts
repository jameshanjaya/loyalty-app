import { birthdayClaimDecision, birthdayNotice, birthdayStatus, toBirthdayRule, type BirthdayDeny, type BirthdayNotice, type BirthdayRule } from "./birthday";
import * as repo from "./repo";
import type { Brand, Member } from "./types";

export async function birthdayGate(db: D1Database, member: Member, brand: Brand, now: number): Promise<BirthdayDeny> {
  const rule = toBirthdayRule(brand);
  const hit = birthdayStatus(member.birthday, now, rule);
  const taken = hit.open ? await repo.birthdayTaken(db, member.id, brand.id, hit.rewardYear) : false;
  return birthdayClaimDecision({
    birthday: member.birthday,
    now,
    rule,
    alreadyRedeemed: taken,
    setAt: member.birthday_set_at ?? null,
    overrideYear: member.birthday_override_year ?? null,
  });
}

export function birthdayError(decision: BirthdayDeny): "ultah" | "ultah-sudah" | "ultah-baru" | null {
  if (decision === "ok") return null;
  if (decision === "used") return "ultah-sudah";
  if (decision === "fresh") return "ultah-baru";
  return "ultah";
}

export function ruleOf(brand: Brand): BirthdayRule {
  return toBirthdayRule(brand);
}

export async function loadBirthdayNotice(db: D1Database, member: Member, brand: Brand, now: number): Promise<BirthdayNotice> {
  const rule = toBirthdayRule(brand);
  let claimed = new Set<number>();
  if (member.birthday && rule.active) {
    const wibYear = new Date(now + 7 * 60 * 60 * 1000).getUTCFullYear();
    claimed = new Set(await repo.birthdayClaimedYears(db, member.id, brand.id, wibYear - 1, wibYear + 2));
  }
  return birthdayNotice(member.birthday, now, rule, claimed);
}
