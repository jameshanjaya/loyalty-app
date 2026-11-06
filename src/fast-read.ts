import { birthdayNotice, toBirthdayRule, type BirthdayNotice } from "./birthday";
import { bookingTarget, bookingUrl, visibleOrderLinks } from "./orders";
import { referralBatchSize } from "./referral";
import { missionInWindow, questLocked, questProgress, tierChoices } from "./points";
import type { Mission } from "./points-db";
import { bannerLive } from "./repo";
import type { ActivityRow, Banner, Brand, Card, NewsCard, Outlet } from "./types";
import type { OrderLink } from "./orders";

const BRAND_PICK = `COALESCE((SELECT id FROM brands WHERE id = ? AND active = 1), (SELECT id FROM brands WHERE active = 1 ORDER BY name LIMIT 1))`;

type Part<T> = { results?: T[] };

function list<T>(part: Part<T> | null | undefined): T[] {
  return part?.results ?? [];
}

function one<T>(part: Part<T> | null | undefined): T | null {
  return part?.results?.[0] ?? null;
}

const brandMemory: { at: number; rows: Brand[] } = { at: 0, rows: [] };
const settingMemory = new Map<string, { at: number; value: string | null }>();
const MEMORY_MS = 20_000;

export function clearReadCache(): void {
  brandMemory.at = 0;
  brandMemory.rows = [];
  settingMemory.clear();
}

export async function cachedBrands(db: D1Database, now = Date.now()): Promise<Brand[]> {
  if (brandMemory.rows.length && now - brandMemory.at < MEMORY_MS) return brandMemory.rows;
  const rows = list<Brand>(await db.prepare(`SELECT * FROM brands WHERE active = 1 ORDER BY name`).all<Brand>());
  brandMemory.at = now;
  brandMemory.rows = rows;
  return rows;
}

export async function cachedSetting(db: D1Database, key: string, now = Date.now()): Promise<string | null> {
  const hit = settingMemory.get(key);
  if (hit && now - hit.at < MEMORY_MS) return hit.value;
  const row = await db.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string }>();
  const value = row?.value ?? null;
  settingMemory.set(key, { at: now, value });
  return value;
}

function rememberSettings(rows: Array<{ key: string; value: string }>, now: number) {
  for (const row of rows) settingMemory.set(row.key, { at: now, value: row.value });
}

function rememberBrands(rows: Brand[], now: number) {
  if (rows.length) {
    brandMemory.at = now;
    brandMemory.rows = rows;
  }
}

export type KartuBundle = {
  brands: Brand[];
  brand: Brand;
  card: Card | null;
  lockOn: boolean;
  referralFriendId: string | null;
  slice: {
    brand: Brand;
    banners: Banner[];
    history: ActivityRow[];
    birthday: BirthdayNotice;
    birthdayReward: string;
    tiers: Array<{ id: string; stamps: number; reward: string; icon: string; ready: boolean }>;
    orders: OrderLink[];
    orderOutlets: Array<{ id: string; name: string; on: boolean }>;
    booking: { id: string; name: string; url: string } | null;
    pickBooking: boolean;
    missions: Array<{ id: string; title: string; blurb: string; kind: string; status: string; reason: string }>;
    quarters: number;
  };
};

/** One D1 batch for the active brand only. Steady /kartu is member lookup + this batch. */
export async function loadKartuBundle(
  db: D1Database,
  memberId: string,
  wanted: string,
  now: number,
  outletParam: string,
  memberBirthday: string | null,
): Promise<KartuBundle | null> {
  const pick = BRAND_PICK;
  const parts = await db.batch([
    db.prepare(`SELECT * FROM brands WHERE active = 1 ORDER BY name`),
    db.prepare(`SELECT key, value FROM settings WHERE key IN ('wa_verify_lock', 'referral_batch', 'referral_friend_bonus', 'points_expire_days')`),
    db.prepare(`SELECT * FROM cards WHERE member_id = ? AND brand_id = (${pick})`).bind(memberId, wanted),
    db.prepare(`SELECT * FROM outlets WHERE active = 1 AND brand_id = (${pick}) ORDER BY name`).bind(wanted),
    db.prepare(`SELECT * FROM order_links WHERE brand_id = (${pick}) ORDER BY sort_order, label`).bind(wanted),
    db.prepare(`SELECT * FROM banners WHERE brand_id = (${pick}) ORDER BY sort_order, created_at DESC`).bind(wanted),
    db.prepare(`SELECT * FROM stamp_tiers WHERE brand_id = (${pick}) AND active = 1 ORDER BY stamps`).bind(wanted),
    db.prepare(`SELECT * FROM missions WHERE brand_id = (${pick}) AND active = 1 ORDER BY sort_order, title`).bind(wanted),
    db.prepare(
      `SELECT mission_id, status, reviewed_at, reviewer_note FROM mission_submissions WHERE member_id = ? ORDER BY reviewed_at DESC`,
    ).bind(memberId),
    db.prepare(
      `SELECT a.*, m.name AS member_name, m.wa AS wa, b.name AS brand_name, b.short_name AS short_name,
              o.name AS outlet_name, b.reward_text AS reward_text
       FROM activities a
       JOIN members m ON m.id = a.member_id
       JOIN brands b ON b.id = a.brand_id
       LEFT JOIN outlets o ON o.id = a.outlet_id
       WHERE a.member_id = ? AND a.brand_id = (${pick})
         AND a.type IN ('stamp', 'redeem', 'cancel', 'join', 'birthday', 'mission', 'points')
       ORDER BY a.created_at DESC LIMIT 12`,
    ).bind(memberId, wanted),
    db.prepare(`SELECT brand_id, reward_year FROM birthday_redemptions WHERE member_id = ?`).bind(memberId),
    db.prepare(
      `SELECT COALESCE(SUM(delta_tenths), 0) AS n FROM point_ledger WHERE member_id = ? AND reason = 'mission' AND delta_tenths > 0`,
    ).bind(memberId),
    db.prepare(`SELECT friend_id FROM referrals WHERE friend_id = ?`).bind(memberId),
  ]);
  const brands = list<Brand>(parts[0] as Part<Brand>);
  rememberBrands(brands, now);
  rememberSettings(list<{ key: string; value: string }>(parts[1] as Part<{ key: string; value: string }>), now);
  const brand = brands.find((item) => item.id === wanted) || brands[0];
  if (!brand) return null;
  const card = one<Card>(parts[2] as Part<Card>);
  const named = list<Outlet>(parts[3] as Part<Outlet>).filter((outlet) => outlet.brand_id === brand.id);
  const selected = named.some((outlet) => outlet.id === outletParam) ? outletParam : "";
  const orders = visibleOrderLinks(list<OrderLink>(parts[4] as Part<OrderLink>).filter((link) => link.brand_id === brand.id), selected || null);
  const bookable = named.filter((outlet) => bookingUrl(brand.name, outlet.name, outlet.wa || ""));
  const target = bookingTarget(
    brand.name,
    named.map((outlet) => ({ id: outlet.id, name: outlet.name, wa: outlet.wa || "" })),
    selected || null,
  );
  const chipIds = new Set<string>([
    ...orders.flatMap((link) => (link.outlet_id ? [link.outlet_id] : [])),
    ...(bookable.length > 1 ? bookable.map((outlet) => outlet.id) : []),
  ]);
  const tiers = list<{ id: string; stamps: number; reward_text: string; icon: string | null; stock: number | null }>(parts[6] as Part<{ id: string; stamps: number; reward_text: string; icon: string | null; stock: number | null }>);
  const choice = tierChoices(
    card?.stamps ?? 0,
    tiers.map((tier) => ({ stamps: tier.stamps, reward: tier.reward_text })),
  );
  const missions = missionRows(
    list<Mission>(parts[7] as Part<Mission>).filter((mission) => mission.brand_id === brand.id),
    list<{ mission_id: string; status: string; reviewed_at: number | null; reviewer_note: string | null }>(parts[8] as Part<{ mission_id: string; status: string; reviewed_at: number | null; reviewer_note: string | null }>),
    one<{ n: number }>(parts[11] as Part<{ n: number }>)?.n ?? 0,
    now,
  );
  const claimed = new Set(
    list<{ brand_id: string; reward_year: number }>(parts[10] as Part<{ brand_id: string; reward_year: number }>)
      .filter((row) => row.brand_id === brand.id)
      .map((row) => row.reward_year),
  );
  const lock = list<{ key: string; value: string }>(parts[1] as Part<{ key: string; value: string }>).find((row) => row.key === "wa_verify_lock");
  return {
    brands,
    brand,
    card,
    lockOn: lock?.value === "1",
    referralFriendId: one<{ friend_id: string }>(parts[12] as Part<{ friend_id: string }>)?.friend_id || null,
    slice: {
      brand,
      banners: list<Banner>(parts[5] as Part<Banner>).filter((banner) => banner.brand_id === brand.id && bannerLive(banner, now)),
      history: list<ActivityRow>(parts[9] as Part<ActivityRow>),
      birthday: birthdayNotice(memberBirthday, now, toBirthdayRule(brand), claimed),
      birthdayReward: brand.birthday_reward,
      tiers: tiers.map((tier) => ({
        id: tier.id,
        stamps: tier.stamps,
        reward: tier.reward_text,
        icon: tier.icon || "🎁",
        ready: choice.available.some((item) => item.stamps === tier.stamps && item.reward === tier.reward_text),
      })),
      orders,
      orderOutlets: named.filter((outlet) => chipIds.has(outlet.id)).map((outlet) => ({ id: outlet.id, name: outlet.name, on: outlet.id === selected })),
      booking: target,
      pickBooking: bookable.length > 1 && !target,
      missions,
      quarters: card?.remainder_quarters || 0,
    },
  };
}

function missionRows(
  missions: Mission[],
  submissions: Array<{ mission_id: string; status: string; reviewed_at: number | null; reviewer_note: string | null }>,
  earned: number,
  now: number,
) {
  return missions
    .filter((mission) => missionInWindow(mission.starts_at, mission.ends_at, now))
    .map((mission) => {
      const rows = submissions.filter((row) => row.mission_id === mission.id);
      const pending = rows.some((row) => row.status === "pending");
      const approved = rows.find((row) => row.status === "approved");
      const rejected = rows.find((row) => row.status === "rejected");
      const locked = questLocked({ mystery: mission.mystery === 1, unlockTenths: mission.unlock_points_tenths, lifetimeTenths: earned });
      const progress = questProgress({ limit: "once", pending, lastApprovedAt: approved?.reviewed_at ?? null, now });
      const status = progress.done ? "done" : pending ? "wait" : locked ? "locked" : rejected ? "no" : "open";
      return {
        id: mission.id,
        title: mission.title,
        blurb: (mission.description || "").split("\n")[0] || "",
        kind: mission.check_kind || "",
        status,
        reason: status === "no" ? rejected?.reviewer_note || "" : "",
      };
    });
}

export async function loadHadiahBundle(db: D1Database, memberId: string, wanted: string, now: number, memberBirthday: string | null) {
  const pick = BRAND_PICK;
  const parts = await db.batch([
    db.prepare(`SELECT * FROM brands WHERE active = 1 ORDER BY name`),
    db.prepare(`SELECT * FROM cards WHERE member_id = ? AND brand_id = (${pick})`).bind(memberId, wanted),
    db.prepare(`SELECT * FROM stamp_tiers WHERE brand_id = (${pick}) AND active = 1 ORDER BY stamps`).bind(wanted),
    db.prepare(`SELECT * FROM news_cards WHERE brand_id = (${pick}) ORDER BY slot`).bind(wanted),
    db.prepare(`SELECT brand_id, reward_year FROM birthday_redemptions WHERE member_id = ?`).bind(memberId),
  ]);
  const brands = list<Brand>(parts[0] as Part<Brand>);
  rememberBrands(brands, now);
  const brand = brands.find((item) => item.id === wanted) || brands[0];
  if (!brand) return null;
  const card = one<Card>(parts[1] as Part<Card>);
  const claimed = new Set(
    list<{ brand_id: string; reward_year: number }>(parts[4] as Part<{ brand_id: string; reward_year: number }>)
      .filter((row) => row.brand_id === brand.id)
      .map((row) => row.reward_year),
  );
  return {
    brands,
    brand,
    stamps: card?.stamps ?? 0,
    tiers: list<{ id: string; stamps: number; reward_text: string; icon: string | null; stock: number | null; image_url: string | null; r2_key: string | null }>(parts[2] as Part<{ id: string; stamps: number; reward_text: string; icon: string | null; stock: number | null; image_url: string | null; r2_key: string | null }>).filter((tier) => !("brand_id" in tier) || true),
    news: list<NewsCard>(parts[3] as Part<NewsCard>),
    birthday: birthdayNotice(memberBirthday, now, toBirthdayRule(brand), claimed),
  };
}

export async function loadProfilBundle(db: D1Database, memberId: string, wanted: string, now: number) {
  const pick = BRAND_PICK;
  const parts = await db.batch([
    db.prepare(`SELECT * FROM brands WHERE active = 1 ORDER BY name`),
    db.prepare(`SELECT key, value FROM settings WHERE key IN ('referral_batch', 'referral_friend_bonus', 'wa_verify_lock')`),
    db.prepare(`SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ? AND brand_id = (${pick}) AND qualified = 1 AND consumed = 0`).bind(memberId, wanted),
  ]);
  const brands = list<Brand>(parts[0] as Part<Brand>);
  rememberBrands(brands, now);
  rememberSettings(list<{ key: string; value: string }>(parts[1] as Part<{ key: string; value: string }>), now);
  const brand = brands.find((item) => item.id === wanted) || brands[0] || null;
  const have = one<{ n: number }>(parts[2] as Part<{ n: number }>)?.n ?? 0;
  const batch = referralBatchSize(settingMemory.get("referral_batch")?.value);
  return { brands, brand, have, need: batch };
}
