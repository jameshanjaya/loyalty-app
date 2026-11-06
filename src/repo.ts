import type { OrderLink } from "./orders";
import { applyQuestQuarters } from "./quest-stamp";
import type { ActivityRow, Banner, Brand, Card, FlagRow, Member, NewsCard, Outlet, SessionRow } from "./types";
import type { StoredClaim } from "./tokens";

async function rows<T>(stmt: D1PreparedStatement): Promise<T[]> {
  const result = await stmt.all<T>();
  return result.results ?? [];
}

export async function listBrands(db: D1Database, activeOnly = false): Promise<Brand[]> {
  const sql = activeOnly
    ? `SELECT * FROM brands WHERE active = 1 ORDER BY name`
    : `SELECT * FROM brands ORDER BY name`;
  return rows<Brand>(db.prepare(sql));
}

export async function getBrand(db: D1Database, id: string): Promise<Brand | null> {
  return db.prepare(`SELECT * FROM brands WHERE id = ?`).bind(id).first<Brand>();
}

export async function setBrandActive(db: D1Database, id: string, active: number): Promise<void> {
  await db.prepare(`UPDATE brands SET active = ? WHERE id = ?`).bind(active ? 1 : 0, id).run();
}

const LIVE_BRAND = `IN (SELECT id FROM brands WHERE active = 1)`;

export async function saveBrand(
  db: D1Database,
  id: string,
  patch: {
    name: string;
    short_name: string;
    handle: string;
    emoji: string;
    accent: string;
    accent_soft: string;
    stamps_required: number;
    reward_text: string;
    condition_label: string;
    min_amount: number | null;
    max_stamps_per_day: number;
    reward_note: string;
    active: number;
    birthday_reward: string;
    birthday_active: number;
    birthday_window: string;
    birthday_days: number;
    cta: string;
    page_bg: string;
    stamp_icon: string;
    ig_handle: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE brands SET name=?, short_name=?, handle=?, emoji=?, accent=?, accent_soft=?,
        stamps_required=?, reward_text=?, condition_label=?, min_amount=?, max_stamps_per_day=?,
        reward_note=?, active=?, birthday_reward=?, birthday_active=?, birthday_window=?, birthday_days=?,
        cta=?, page_bg=?, stamp_icon=?, ig_handle=? WHERE id=?`,
    )
    .bind(
      patch.name,
      patch.short_name,
      patch.handle,
      patch.emoji,
      patch.accent,
      patch.accent_soft,
      patch.stamps_required,
      patch.reward_text,
      patch.condition_label,
      patch.min_amount,
      patch.max_stamps_per_day,
      patch.reward_note,
      patch.active,
      patch.birthday_reward,
      patch.birthday_active,
      patch.birthday_window,
      patch.birthday_days,
      patch.cta,
      patch.page_bg,
      patch.stamp_icon,
      patch.ig_handle,
      id,
    )
    .run();
}

export async function setBrandAsset(db: D1Database, id: string, kind: "logo" | "icon" | "stamp", key: string): Promise<void> {
  const column = kind === "logo" ? "logo_key" : kind === "icon" ? "icon_key" : "stamp_key";
  await db.prepare(`UPDATE brands SET ${column} = ? WHERE id = ?`).bind(key, id).run();
}

export async function setPhoneVerified(db: D1Database, id: string, verified: number): Promise<void> {
  await db.prepare(`UPDATE members SET wa_verified = ? WHERE id = ?`).bind(verified ? 1 : 0, id).run();
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(key, value).run();
}

export async function saveOwnerPassword(
  db: D1Database,
  input: { salt: string; hash: string; version: string; sessionId: string },
): Promise<void> {
  const upsert = `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`;
  await db.batch([
    db.prepare(upsert).bind("owner_pass_salt", input.salt),
    db.prepare(upsert).bind("owner_pass_hash", input.hash),
    db.prepare(upsert).bind("owner_session_version", input.version),
    db.prepare(`UPDATE sessions SET subject_id = ? WHERE id = ? AND kind = 'owner'`).bind(`owner:${input.version}`, input.sessionId),
    db.prepare(`DELETE FROM sessions WHERE kind = 'owner' AND id != ?`).bind(input.sessionId),
  ]);
}

export async function listOutlets(db: D1Database): Promise<Outlet[]> {
  return rows<Outlet>(db.prepare(`SELECT * FROM outlets ORDER BY name`));
}

export async function getOutlet(db: D1Database, id: string): Promise<Outlet | null> {
  return db.prepare(`SELECT * FROM outlets WHERE id = ?`).bind(id).first<Outlet>();
}

export async function getOutletBySlug(db: D1Database, slug: string): Promise<Outlet | null> {
  return db.prepare(`SELECT * FROM outlets WHERE slug = ? AND active = 1`).bind(slug).first<Outlet>();
}

export async function setOutletSlug(db: D1Database, id: string, slug: string): Promise<void> {
  await db.prepare(`UPDATE outlets SET slug = ? WHERE id = ?`).bind(slug, id).run();
}

export async function setPromoConsent(db: D1Database, id: string, at: number): Promise<void> {
  await db.prepare(`UPDATE members SET promo_consent = 1, promo_consent_at = ? WHERE id = ?`).bind(at, id).run();
}

export async function setBannerDelay(db: D1Database, brandId: string, ms: number): Promise<void> {
  await db.prepare(`UPDATE brands SET banner_ms = ? WHERE id = ?`).bind(ms, brandId).run();
}

export async function listNews(db: D1Database, brandId: string): Promise<NewsCard[]> {
  return rows<NewsCard>(db.prepare(`SELECT * FROM news_cards WHERE brand_id = ? ORDER BY slot`).bind(brandId));
}

export async function listAllNews(db: D1Database): Promise<NewsCard[]> {
  return rows<NewsCard>(db.prepare(`SELECT * FROM news_cards ORDER BY brand_id, slot`));
}

export async function upsertNews(
  db: D1Database,
  card: { id: string; brandId: string; slot: number; kind: string; title: string; subtitle: string; imageUrl: string | null; r2Key: string | null; active: number },
): Promise<void> {
  const existing = await db
    .prepare(`SELECT id, r2_key FROM news_cards WHERE brand_id = ? AND slot = ?`)
    .bind(card.brandId, card.slot)
    .first<{ id: string; r2_key: string | null }>();
  if (existing) {
    await db
      .prepare(
        `UPDATE news_cards SET kind=?, title=?, subtitle=?, image_url=COALESCE(?, image_url), r2_key=COALESCE(?, r2_key), active=? WHERE id=?`,
      )
      .bind(card.kind, card.title, card.subtitle, card.imageUrl, card.r2Key, card.active, existing.id)
      .run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO news_cards (id, brand_id, slot, kind, title, subtitle, image_url, r2_key, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(card.id, card.brandId, card.slot, card.kind, card.title, card.subtitle, card.imageUrl, card.r2Key, card.active)
    .run();
}

export async function upsertBannerSlot(
  db: D1Database,
  banner: { id: string; brandId: string; slot: number; title: string; subtitle: string; imageUrl: string | null; r2Key: string | null; now: number },
): Promise<void> {
  const existing = await db
    .prepare(`SELECT id FROM banners WHERE brand_id = ? AND slot = ?`)
    .bind(banner.brandId, banner.slot)
    .first<{ id: string }>();
  if (existing) {
    await db
      .prepare(`UPDATE banners SET title=?, subtitle=?, image_url=COALESCE(?, image_url), r2_key=COALESCE(?, r2_key), active=1, sort_order=? WHERE id=?`)
      .bind(banner.title, banner.subtitle, banner.imageUrl, banner.r2Key, banner.slot, existing.id)
      .run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO banners (id, brand_id, title, subtitle, image_url, r2_key, link_url, starts_at, ends_at, sort_order, active, created_at, cta, slot)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 1, ?, '', ?)`,
    )
    .bind(banner.id, banner.brandId, banner.title, banner.subtitle, banner.imageUrl, banner.r2Key, banner.slot, banner.now, banner.slot)
    .run();
}

export async function insertVerifySession(
  db: D1Database,
  row: { id: string; memberId: string; phone: string; token: string; deepLink: string; now: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO wa_verify_sessions (id, member_id, phone, token, deep_link, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .bind(row.id, row.memberId, row.phone, row.token, row.deepLink, row.now)
    .run();
}

export async function latestVerifySession(db: D1Database, memberId: string): Promise<{ token: string; deep_link: string; phone: string; status: string } | null> {
  return db
    .prepare(`SELECT token, deep_link, phone, status FROM wa_verify_sessions WHERE member_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(memberId)
    .first();
}

export async function markVerifyToken(db: D1Database, token: string, now: number): Promise<string | null> {
  const row = await db.prepare(`SELECT member_id FROM wa_verify_sessions WHERE token = ?`).bind(token).first<{ member_id: string }>();
  if (!row) return null;
  await db.batch([
    db.prepare(`UPDATE wa_verify_sessions SET status = 'verified', verified_at = ? WHERE token = ?`).bind(now, token),
    db.prepare(`UPDATE members SET wa_verified = 1 WHERE id = ?`).bind(row.member_id),
  ]);
  return row.member_id;
}

export async function insertOutlet(
  db: D1Database,
  outlet: { id: string; brandId: string; name: string; pinHash: string; pinSalt: string; now: number },
): Promise<void> {
  await db
    .prepare(`INSERT INTO outlets (id, brand_id, name, pin_hash, pin_salt, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`)
    .bind(outlet.id, outlet.brandId, outlet.name, outlet.pinHash, outlet.pinSalt, outlet.now)
    .run();
}

export async function setOutletPin(db: D1Database, id: string, pinHash: string, pinSalt: string): Promise<void> {
  await db.prepare(`UPDATE outlets SET pin_hash=?, pin_salt=? WHERE id=?`).bind(pinHash, pinSalt, id).run();
}

export async function setOutletWa(db: D1Database, id: string, wa: string): Promise<void> {
  await db.prepare(`UPDATE outlets SET wa = ? WHERE id = ?`).bind(wa, id).run();
}

export async function setOutletActive(db: D1Database, id: string, active: number): Promise<void> {
  await db.prepare(`UPDATE outlets SET active=? WHERE id=?`).bind(active, id).run();
}

export async function getMember(db: D1Database, id: string): Promise<Member | null> {
  return db.prepare(`SELECT * FROM members WHERE id = ?`).bind(id).first<Member>();
}

export async function getMemberByWa(db: D1Database, wa: string): Promise<Member | null> {
  return db.prepare(`SELECT * FROM members WHERE wa = ?`).bind(wa).first<Member>();
}

export async function insertMember(
  db: D1Database,
  member: { id: string; name: string; wa: string; pinHash: string; pinSalt: string; now: number },
): Promise<void> {
  await db
    .prepare(`INSERT INTO members (id, name, wa, pin_hash, pin_salt, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(member.id, member.name, member.wa, member.pinHash, member.pinSalt, member.now, member.now)
    .run();
}

export async function touchMember(db: D1Database, id: string, now: number): Promise<void> {
  await db.prepare(`UPDATE members SET last_seen_at=? WHERE id=?`).bind(now, id).run();
}

export async function isOutletStaff(db: D1Database, outletId: string, memberId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS n FROM outlet_staff WHERE outlet_id = ? AND member_id = ?`)
    .bind(outletId, memberId)
    .first<{ n: number }>();
  return Boolean(row);
}

export async function listOutletStaff(db: D1Database): Promise<Array<Member & { outlet_id: string }>> {
  return rows<Member & { outlet_id: string }>(
    db.prepare(
      `SELECT m.*, s.outlet_id AS outlet_id
       FROM outlet_staff s JOIN members m ON m.id = s.member_id
       ORDER BY m.name`,
    ),
  );
}

export async function addOutletStaff(db: D1Database, outletId: string, memberId: string, now: number): Promise<void> {
  await db.prepare(`INSERT OR IGNORE INTO outlet_staff (outlet_id, member_id, created_at) VALUES (?, ?, ?)`).bind(outletId, memberId, now).run();
}

export async function removeOutletStaff(db: D1Database, outletId: string, memberId: string): Promise<void> {
  await db.prepare(`DELETE FROM outlet_staff WHERE outlet_id = ? AND member_id = ?`).bind(outletId, memberId).run();
}

export async function findMemberByEmail(db: D1Database, email: string): Promise<Member | null> {
  return db.prepare(`SELECT * FROM members WHERE email = ? COLLATE NOCASE LIMIT 1`).bind(email.trim()).first<Member>();
}

export async function searchMembers(db: D1Database, q: string): Promise<Member[]> {
  const like = `%${q.replace(/[%_]/g, "")}%`;
  return rows<Member>(
    db.prepare(`SELECT * FROM members WHERE name LIKE ? OR wa LIKE ? ORDER BY last_seen_at DESC LIMIT 40`).bind(like, like),
  );
}

export async function getCard(db: D1Database, memberId: string, brandId: string): Promise<Card | null> {
  return db.prepare(`SELECT * FROM cards WHERE member_id=? AND brand_id=?`).bind(memberId, brandId).first<Card>();
}

export async function listCards(db: D1Database, memberId: string): Promise<Card[]> {
  return rows<Card>(db.prepare(`SELECT * FROM cards WHERE member_id=?`).bind(memberId));
}

export async function ensureCard(db: D1Database, memberId: string, brandId: string, now: number): Promise<Card> {
  await db
    .prepare(
      `INSERT INTO cards (member_id, brand_id, stamps, lifetime_stamps, lifetime_redeems, day_count, day_on, updated_at)
       VALUES (?, ?, 0, 0, 0, 0, 0, ?)
       ON CONFLICT(member_id, brand_id) DO NOTHING`,
    )
    .bind(memberId, brandId, now)
    .run();
  const card = await getCard(db, memberId, brandId);
  if (!card) throw new Error("card");
  return card;
}

export async function createSession(
  db: D1Database,
  session: { id: string; kind: string; subjectId: string | null; now: number; expiresAt: number },
): Promise<void> {
  await db
    .prepare(`INSERT INTO sessions (id, kind, subject_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(session.id, session.kind, session.subjectId, session.now, session.expiresAt)
    .run();
}

export async function getSession(db: D1Database, id: string): Promise<SessionRow | null> {
  return db.prepare(`SELECT * FROM sessions WHERE id=?`).bind(id).first<SessionRow>();
}

export async function deleteSession(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE id=?`).bind(id).run();
}

export async function extendSession(db: D1Database, id: string, expiresAt: number): Promise<void> {
  await db.prepare(`UPDATE sessions SET expires_at = ? WHERE id = ? AND kind = 'member'`).bind(expiresAt, id).run();
}

export async function insertClaim(db: D1Database, record: StoredClaim): Promise<void> {
  await db
    .prepare(
      `INSERT INTO claim_tokens (id, outlet_id, brand_id, session_id, kind, status, member_id, expires_at, created_at, claimed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.id,
      record.outletId,
      record.brandId,
      record.sessionId,
      record.kind,
      record.status,
      record.memberId,
      record.expiresAt,
      record.createdAt,
      record.claimedAt,
    )
    .run();
}

export async function getClaim(db: D1Database, id: string): Promise<StoredClaim | null> {
  const row = await db
    .prepare(
      `SELECT id, outlet_id, brand_id, session_id, kind, status, member_id, expires_at, created_at, claimed_at
       FROM claim_tokens WHERE id=?`,
    )
    .bind(id)
    .first<{
      id: string;
      outlet_id: string;
      brand_id: string;
      session_id: string;
      kind: "stamp" | "redeem";
      status: "pending" | "claimed" | "cancelled";
      member_id: string | null;
      expires_at: number;
      created_at: number;
      claimed_at: number | null;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    outletId: row.outlet_id,
    brandId: row.brand_id,
    sessionId: row.session_id,
    kind: row.kind,
    status: row.status,
    memberId: row.member_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
  };
}

export async function markClaimClaimed(db: D1Database, id: string, memberId: string, now: number): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE claim_tokens SET status='claimed', member_id=?, claimed_at=?
       WHERE id=? AND status='pending' AND expires_at > ?`,
    )
    .bind(memberId, now, id, now)
    .run();
  return result.meta.changes === 1;
}

export async function markClaimCancelled(db: D1Database, id: string, sessionId: string): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE claim_tokens SET status='cancelled' WHERE id=? AND session_id=? AND status='pending'`)
    .bind(id, sessionId)
    .run();
  return result.meta.changes === 1;
}

export async function reopenClaim(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`UPDATE claim_tokens SET status='pending', member_id=NULL, claimed_at=NULL WHERE id=? AND status='claimed'`)
    .bind(id)
    .run();
}

type StampUpdate = { stamps: number; lifetime_stamps: number };

export async function adjustQuestProgress(
  db: D1Database,
  input: { memberId: string; brandId: string; quarterDelta: number; now: number },
): Promise<{ stampDelta: number; stamps: number; quarters: number }> {
  const card = await ensureCard(db, input.memberId, input.brandId, input.now);
  const next = applyQuestQuarters(
    { stamps: card.quest_stamps || 0, quarters: card.remainder_quarters || 0 },
    input.quarterDelta,
  );
  const stampDelta = next.stampDelta;
  const stamps = Math.max(0, card.stamps + stampDelta);
  const lifetime = Math.max(0, card.lifetime_stamps + stampDelta);
  await db
    .prepare(
      `UPDATE cards SET stamps = ?, lifetime_stamps = ?, remainder_quarters = ?, quest_stamps = ?, updated_at = ?
       WHERE member_id = ? AND brand_id = ?`,
    )
    .bind(stamps, lifetime, next.pool.quarters, next.pool.stamps, input.now, input.memberId, input.brandId)
    .run();
  return { stampDelta, stamps, quarters: next.pool.quarters };
}

export async function addStampAtomic(
  db: D1Database,
  input: { memberId: string; brandId: string; today: number; now: number; maxPerDay: number },
): Promise<StampUpdate | null> {
  return db
    .prepare(
      `UPDATE cards SET
         stamps = stamps + 1,
         lifetime_stamps = lifetime_stamps + 1,
         day_count = CASE WHEN day_on = ?1 THEN day_count + 1 ELSE 1 END,
         day_on = ?1,
         updated_at = ?2
       WHERE member_id = ?3 AND brand_id = ?4
         AND (CASE WHEN day_on = ?1 THEN day_count ELSE 0 END) < ?5
       RETURNING stamps, lifetime_stamps`,
    )
    .bind(input.today, input.now, input.memberId, input.brandId, input.maxPerDay)
    .first<StampUpdate>();
}

export async function undoStampAtomic(
  db: D1Database,
  input: { memberId: string; brandId: string; today: number; now: number; countToday: boolean },
): Promise<StampUpdate | null> {
  return db
    .prepare(
      `UPDATE cards SET
         stamps = stamps - 1,
         lifetime_stamps = MAX(lifetime_stamps - 1, 0),
         day_count = CASE WHEN ?1 = 1 AND day_on = ?2 THEN MAX(day_count - 1, 0) ELSE day_count END,
         updated_at = ?3
       WHERE member_id = ?4 AND brand_id = ?5 AND stamps >= 1
       RETURNING stamps, lifetime_stamps`,
    )
    .bind(input.countToday ? 1 : 0, input.today, input.now, input.memberId, input.brandId)
    .first<StampUpdate>();
}

export async function redeemAtomic(
  db: D1Database,
  input: { memberId: string; brandId: string; required: number; now: number },
): Promise<{ stamps: number } | null> {
  return db
    .prepare(
      `UPDATE cards SET
         stamps = stamps - ?1,
         lifetime_redeems = lifetime_redeems + 1,
         updated_at = ?2
       WHERE member_id = ?3 AND brand_id = ?4 AND stamps >= ?1
       RETURNING stamps`,
    )
    .bind(input.required, input.now, input.memberId, input.brandId)
    .first<{ stamps: number }>();
}

export async function undoRedeemAtomic(
  db: D1Database,
  input: { memberId: string; brandId: string; spent: number; now: number },
): Promise<{ stamps: number } | null> {
  return db
    .prepare(
      `UPDATE cards SET
         stamps = stamps + ?1,
         lifetime_redeems = MAX(lifetime_redeems - 1, 0),
         updated_at = ?2
       WHERE member_id = ?3 AND brand_id = ?4
       RETURNING stamps`,
    )
    .bind(input.spent, input.now, input.memberId, input.brandId)
    .first<{ stamps: number }>();
}

export async function revertStampNumbers(
  db: D1Database,
  input: { memberId: string; brandId: string; today: number; now: number },
): Promise<void> {
  await db
    .prepare(
      `UPDATE cards SET
         stamps = MAX(stamps - 1, 0),
         lifetime_stamps = MAX(lifetime_stamps - 1, 0),
         day_count = CASE WHEN day_on = ?1 THEN MAX(day_count - 1, 0) ELSE day_count END,
         updated_at = ?2
       WHERE member_id = ?3 AND brand_id = ?4`,
    )
    .bind(input.today, input.now, input.memberId, input.brandId)
    .run();
}

export async function revertRedeemNumbers(
  db: D1Database,
  input: { memberId: string; brandId: string; spent: number; now: number },
): Promise<void> {
  await db
    .prepare(
      `UPDATE cards SET stamps = stamps + ?1, lifetime_redeems = MAX(lifetime_redeems - 1, 0), updated_at = ?2
       WHERE member_id = ?3 AND brand_id = ?4`,
    )
    .bind(input.spent, input.now, input.memberId, input.brandId)
    .run();
}

export async function insertActivity(
  db: D1Database,
  row: {
    id: string;
    type: string;
    memberId: string;
    brandId: string;
    outletId: string | null;
    sessionId: string | null;
    claimId: string | null;
    stampsDelta: number;
    stampsAfter: number;
    note: string;
    reversesId: string | null;
    now: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO activities
        (id, type, member_id, brand_id, outlet_id, session_id, claim_id, stamps_delta, stamps_after, note, reverses_id, voided, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(
      row.id,
      row.type,
      row.memberId,
      row.brandId,
      row.outletId,
      row.sessionId,
      row.claimId,
      row.stampsDelta,
      row.stampsAfter,
      row.note,
      row.reversesId,
      row.now,
    )
    .run();
}

const ACTIVITY_SELECT = `
  SELECT a.*, m.name AS member_name, m.wa AS wa, b.name AS brand_name, b.short_name AS short_name,
         o.name AS outlet_name, b.reward_text AS reward_text
  FROM activities a
  JOIN members m ON m.id = a.member_id
  JOIN brands b ON b.id = a.brand_id
  LEFT JOIN outlets o ON o.id = a.outlet_id
`;

export async function getActivity(db: D1Database, id: string): Promise<ActivityRow | null> {
  return db.prepare(`${ACTIVITY_SELECT} WHERE a.id = ?`).bind(id).first<ActivityRow>();
}

export async function latestOpenActivity(db: D1Database, sessionId: string): Promise<ActivityRow | null> {
  return db
    .prepare(
      `${ACTIVITY_SELECT}
       WHERE a.session_id = ? AND a.type IN ('stamp', 'redeem') AND a.voided = 0
       ORDER BY a.created_at DESC LIMIT 1`,
    )
    .bind(sessionId)
    .first<ActivityRow>();
}

export async function markVoided(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare(`UPDATE activities SET voided = 1 WHERE id = ? AND voided = 0`).bind(id).run();
  return result.meta.changes === 1;
}

export async function unvoid(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE activities SET voided = 0 WHERE id = ?`).bind(id).run();
}

export async function outletFeed(db: D1Database, outletId: string): Promise<ActivityRow[]> {
  return rows<ActivityRow>(
    db
      .prepare(
        `${ACTIVITY_SELECT}
         WHERE a.outlet_id = ? AND a.type IN ('stamp', 'redeem')
         ORDER BY a.created_at DESC LIMIT 10`,
      )
      .bind(outletId),
  );
}

export async function memberHistory(db: D1Database, memberId: string, brandId: string): Promise<ActivityRow[]> {
  return rows<ActivityRow>(
    db
      .prepare(
        `${ACTIVITY_SELECT}
         WHERE a.member_id = ? AND a.brand_id = ? AND a.type IN ('stamp', 'redeem', 'cancel', 'join', 'birthday', 'mission', 'points')
         ORDER BY a.created_at DESC LIMIT 12`,
      )
      .bind(memberId, brandId),
  );
}

export type ActivityFilter = {
  brandId?: string;
  outletId?: string;
  type?: string;
  q?: string;
  from?: number;
  to?: number;
  limit: number;
  offset: number;
  includeHidden?: boolean;
};

export async function listActivities(db: D1Database, filter: ActivityFilter): Promise<ActivityRow[]> {
  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (filter.brandId) {
    where.push("a.brand_id = ?");
    binds.push(filter.brandId);
  } else if (filter.includeHidden !== true) {
    where.push(`a.brand_id ${LIVE_BRAND}`);
  }
  if (filter.outletId) {
    where.push("a.outlet_id = ?");
    binds.push(filter.outletId);
  }
  if (filter.type) {
    where.push("a.type = ?");
    binds.push(filter.type);
  }
  if (filter.q) {
    const like = `%${filter.q.replace(/[%_]/g, "")}%`;
    where.push("(m.name LIKE ? OR m.wa LIKE ?)");
    binds.push(like, like);
  }
  if (filter.from) {
    where.push("a.created_at >= ?");
    binds.push(filter.from);
  }
  if (filter.to) {
    where.push("a.created_at <= ?");
    binds.push(filter.to);
  }
  const sql = `${ACTIVITY_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
  binds.push(filter.limit, filter.offset);
  return rows<ActivityRow>(db.prepare(sql).bind(...binds));
}

export async function countSessionStamps(db: D1Database, sessionId: string, since: number): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM activities
       WHERE session_id = ? AND type = 'stamp' AND voided = 0 AND created_at >= ?`,
    )
    .bind(sessionId, since)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function insertFlag(
  db: D1Database,
  flag: { id: string; outletId: string | null; sessionId: string | null; memberId: string | null; reason: string; detail: string; now: number; dedupe?: boolean },
): Promise<void> {
  if (flag.dedupe !== false) {
    const existing = await db
      .prepare(`SELECT id FROM flags WHERE session_id IS ? AND reason = ? AND created_at > ? LIMIT 1`)
      .bind(flag.sessionId, flag.reason, flag.now - 60 * 60 * 1000)
      .first<{ id: string }>();
    if (existing) return;
  }
  await db
    .prepare(`INSERT INTO flags (id, outlet_id, session_id, member_id, reason, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(flag.id, flag.outletId, flag.sessionId, flag.memberId, flag.reason, flag.detail, flag.now)
    .run();
}

export async function recentFlags(db: D1Database, since: number): Promise<FlagRow[]> {
  return rows<FlagRow>(
    db
      .prepare(
        `SELECT f.*, o.name AS outlet_name, m.name AS member_name
         FROM flags f
         LEFT JOIN outlets o ON o.id = f.outlet_id
         LEFT JOIN members m ON m.id = f.member_id
         WHERE f.created_at >= ?
         ORDER BY f.created_at DESC LIMIT 20`,
      )
      .bind(since),
  );
}

export async function listEveryBanner(db: D1Database): Promise<Banner[]> {
  return rows<Banner>(db.prepare(`SELECT * FROM banners ORDER BY brand_id, sort_order, created_at DESC`));
}

export async function listBanners(db: D1Database, brandId: string | null): Promise<Banner[]> {
  if (brandId) {
    return rows<Banner>(db.prepare(`SELECT * FROM banners WHERE brand_id = ? ORDER BY sort_order, created_at DESC`).bind(brandId));
  }
  return rows<Banner>(
    db.prepare(`SELECT * FROM banners WHERE brand_id ${LIVE_BRAND} ORDER BY sort_order, created_at DESC`),
  );
}

export function bannerLive(banner: Banner, now: number): boolean {
  if (!banner.active) return false;
  if (banner.starts_at != null && banner.starts_at > now) return false;
  if (banner.ends_at != null && banner.ends_at < now) return false;
  return true;
}

export async function getBanner(db: D1Database, id: string): Promise<Banner | null> {
  return db.prepare(`SELECT * FROM banners WHERE id = ?`).bind(id).first<Banner>();
}

export async function insertBanner(db: D1Database, banner: Banner): Promise<void> {
  await db
    .prepare(
      `INSERT INTO banners
        (id, brand_id, title, subtitle, image_url, r2_key, link_url, starts_at, ends_at, sort_order, active, created_at, cta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      banner.id,
      banner.brand_id,
      banner.title,
      banner.subtitle,
      banner.image_url,
      banner.r2_key,
      banner.link_url,
      banner.starts_at,
      banner.ends_at,
      banner.sort_order,
      banner.active,
      banner.created_at,
      banner.cta || "",
    )
    .run();
}

export async function updateBanner(db: D1Database, banner: Banner): Promise<void> {
  await db
    .prepare(
      `UPDATE banners SET brand_id=?, title=?, subtitle=?, image_url=?, r2_key=?, link_url=?,
        starts_at=?, ends_at=?, sort_order=?, active=?, cta=? WHERE id=?`,
    )
    .bind(
      banner.brand_id,
      banner.title,
      banner.subtitle,
      banner.image_url,
      banner.r2_key,
      banner.link_url,
      banner.starts_at,
      banner.ends_at,
      banner.sort_order,
      banner.active,
      banner.cta || "",
      banner.id,
    )
    .run();
}

export async function deleteBanner(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM banners WHERE id = ?`).bind(id).run();
}

export async function housekeeping(db: D1Database, now: number): Promise<void> {
  const day = 24 * 60 * 60 * 1000;
  await db.batch([
    db.prepare(`DELETE FROM rate_limits WHERE window_start < ?`).bind(now - 2 * day),
    db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(now),
    db.prepare(`DELETE FROM claim_tokens WHERE expires_at < ? AND status = 'pending'`).bind(now - day),
  ]);
}

export type DashNumbers = {
  members: number;
  stampsToday: number;
  outletsToday: number;
  redeemsMonth: number;
  active30: number;
};

export async function dashNumbers(db: D1Database, brandId: string | null, now: number, dayStart: number, monthStart: number): Promise<DashNumbers> {
  const since30 = now - 30 * 24 * 60 * 60 * 1000;
  const memberSql = brandId
    ? `SELECT COUNT(*) AS n FROM cards WHERE brand_id = ? AND (stamps > 0 OR lifetime_stamps > 0)`
    : `SELECT COUNT(*) AS n FROM members`;
  const activeSql = brandId
    ? `SELECT COUNT(DISTINCT member_id) AS n FROM activities WHERE brand_id = ? AND created_at >= ? AND type IN ('stamp','redeem') AND voided = 0`
    : `SELECT COUNT(*) AS n FROM members WHERE last_seen_at >= ?`;
  const [members, stamps, outlets, redeems, active] = await db.batch<{ n: number }>([
    brandId ? db.prepare(memberSql).bind(brandId) : db.prepare(memberSql),
    brandId
      ? db.prepare(`SELECT COUNT(*) AS n FROM activities WHERE type='stamp' AND voided=0 AND created_at>=? AND brand_id=?`).bind(dayStart, brandId)
      : db.prepare(`SELECT COUNT(*) AS n FROM activities WHERE type='stamp' AND voided=0 AND created_at>=? AND brand_id ${LIVE_BRAND}`).bind(dayStart),
    brandId
      ? db
          .prepare(
            `SELECT COUNT(DISTINCT outlet_id) AS n FROM activities WHERE type='stamp' AND voided=0 AND created_at>=? AND brand_id=? AND outlet_id IS NOT NULL`,
          )
          .bind(dayStart, brandId)
      : db
          .prepare(
            `SELECT COUNT(DISTINCT outlet_id) AS n FROM activities WHERE type='stamp' AND voided=0 AND created_at>=? AND outlet_id IS NOT NULL AND brand_id ${LIVE_BRAND}`,
          )
          .bind(dayStart),
    brandId
      ? db.prepare(`SELECT COUNT(*) AS n FROM activities WHERE type='redeem' AND voided=0 AND created_at>=? AND brand_id=?`).bind(monthStart, brandId)
      : db.prepare(`SELECT COUNT(*) AS n FROM activities WHERE type='redeem' AND voided=0 AND created_at>=? AND brand_id ${LIVE_BRAND}`).bind(monthStart),
    brandId ? db.prepare(activeSql).bind(brandId, since30) : db.prepare(activeSql).bind(since30),
  ]);
  const n = (part: D1Result<{ n: number }>) => part.results[0]?.n ?? 0;
  return {
    members: n(members),
    stampsToday: n(stamps),
    outletsToday: n(outlets),
    redeemsMonth: n(redeems),
    active30: n(active),
  };
}

export async function dashStory(
  db: D1Database,
  brandId: string | null,
  now: number,
): Promise<{
  new7: number;
  new30: number;
  returnPct: number;
  stamps30: number;
  referralSigned: number;
  referralQualified: number;
  topRewards: Array<{ label: string; n: number }>;
}> {
  const day = 86_400_000;
  const since7 = now - 7 * day;
  const since30 = now - 30 * day;
  const brandCard = brandId ? `AND EXISTS (SELECT 1 FROM cards c WHERE c.member_id = m.id AND c.brand_id = ?)` : "";
  const brandAct = brandId ? `AND brand_id = ?` : `AND brand_id ${LIVE_BRAND}`;
  const nOf = (part: D1Result<{ n: number }>) => part.results[0]?.n ?? 0;
  const [fresh7, fresh30, stamps, base, cameBack, signed, qualified, rewards] = await db.batch<{ n: number } | { label: string; n: number }>([
    brandId
      ? db.prepare(`SELECT COUNT(*) AS n FROM members m WHERE m.created_at >= ? ${brandCard}`).bind(since7, brandId)
      : db.prepare(`SELECT COUNT(*) AS n FROM members m WHERE m.created_at >= ?`).bind(since7),
    brandId
      ? db.prepare(`SELECT COUNT(*) AS n FROM members m WHERE m.created_at >= ? ${brandCard}`).bind(since30, brandId)
      : db.prepare(`SELECT COUNT(*) AS n FROM members m WHERE m.created_at >= ?`).bind(since30),
    db.prepare(`SELECT COUNT(*) AS n FROM activities WHERE type = 'stamp' AND voided = 0 AND created_at >= ? ${brandAct}`).bind(...(brandId ? [since30, brandId] : [since30])),
    db.prepare(`SELECT COUNT(DISTINCT member_id) AS n FROM activities WHERE type = 'stamp' AND voided = 0 AND created_at < ? ${brandAct}`).bind(...(brandId ? [since30, brandId] : [since30])),
    db.prepare(
      `SELECT COUNT(DISTINCT a.member_id) AS n FROM activities a
       WHERE a.type = 'stamp' AND a.voided = 0 AND a.created_at >= ? ${brandId ? "AND a.brand_id = ?" : `AND a.brand_id ${LIVE_BRAND}`}
       AND EXISTS (
         SELECT 1 FROM activities older
         WHERE older.member_id = a.member_id AND older.type = 'stamp' AND older.voided = 0 AND older.created_at < ?
         ${brandId ? "AND older.brand_id = ?" : `AND older.brand_id ${LIVE_BRAND}`}
       )`,
    ).bind(...(brandId ? [since30, brandId, since30, brandId] : [since30, since30])),
    db.prepare(`SELECT COUNT(*) AS n FROM referrals ${brandId ? "WHERE brand_id = ?" : ""}`).bind(...(brandId ? [brandId] : [])),
    db.prepare(`SELECT COUNT(*) AS n FROM referrals WHERE qualified = 1 ${brandId ? "AND brand_id = ?" : ""}`).bind(...(brandId ? [brandId] : [])),
    db.prepare(`SELECT note AS label, COUNT(*) AS n FROM activities WHERE type = 'redeem' AND voided = 0 ${brandAct} GROUP BY note ORDER BY n DESC LIMIT 5`).bind(...(brandId ? [brandId] : [])),
  ]);
  const earlier = nOf(base as D1Result<{ n: number }>);
  const returned = nOf(cameBack as D1Result<{ n: number }>);
  return {
    new7: nOf(fresh7 as D1Result<{ n: number }>),
    new30: nOf(fresh30 as D1Result<{ n: number }>),
    returnPct: earlier ? Math.round((returned / earlier) * 100) : 0,
    stamps30: nOf(stamps as D1Result<{ n: number }>),
    referralSigned: nOf(signed as D1Result<{ n: number }>),
    referralQualified: nOf(qualified as D1Result<{ n: number }>),
    topRewards: (rewards.results || []) as Array<{ label: string; n: number }>,
  };
}

export async function stampsByDay(db: D1Database, brandId: string | null, since: number, wibMs: number): Promise<Map<number, number>> {
  const sql = brandId
    ? `SELECT CAST((created_at + ?) / 86400000 AS INTEGER) AS day, COUNT(*) AS n
       FROM activities WHERE type='stamp' AND voided=0 AND created_at>=? AND brand_id=? GROUP BY day`
    : `SELECT CAST((created_at + ?) / 86400000 AS INTEGER) AS day, COUNT(*) AS n
       FROM activities WHERE type='stamp' AND voided=0 AND created_at>=? AND brand_id ${LIVE_BRAND} GROUP BY day`;
  const stmt = brandId ? db.prepare(sql).bind(wibMs, since, brandId) : db.prepare(sql).bind(wibMs, since);
  const list = await rows<{ day: number; n: number }>(stmt);
  return new Map(list.map((row) => [row.day, row.n]));
}

export type TopMember = { id: string; name: string; stamps: number; rewards: number };
export async function topMembers(db: D1Database, brandId: string | null): Promise<TopMember[]> {
  const sql = brandId
    ? `SELECT m.id, m.name, SUM(c.lifetime_stamps) AS stamps, SUM(c.lifetime_redeems) AS rewards
       FROM cards c JOIN members m ON m.id = c.member_id
       WHERE c.brand_id = ?
       GROUP BY m.id HAVING stamps > 0
       ORDER BY stamps DESC LIMIT 5`
    : `SELECT m.id, m.name, SUM(c.lifetime_stamps) AS stamps, SUM(c.lifetime_redeems) AS rewards
       FROM cards c JOIN members m ON m.id = c.member_id
       JOIN brands b ON b.id = c.brand_id AND b.active = 1
       GROUP BY m.id HAVING stamps > 0
       ORDER BY stamps DESC LIMIT 5`;
  const stmt = brandId ? db.prepare(sql).bind(brandId) : db.prepare(sql);
  return rows<TopMember>(stmt);
}

export type Lapsed = {
  id: string;
  name: string;
  last_seen_at: number;
  stamps: number;
  stamps_required: number;
  brand_name: string;
};
export async function lapsedMembers(db: D1Database, brandId: string | null, before: number): Promise<Lapsed[]> {
  const sql = `
    SELECT m.id, m.name, m.last_seen_at, c.stamps, b.stamps_required, b.short_name AS brand_name
    FROM members m
    JOIN cards c ON c.member_id = m.id
    JOIN brands b ON b.id = c.brand_id
    WHERE m.last_seen_at < ? AND c.stamps > 0 AND b.active = 1
      AND (? IS NULL OR c.brand_id = ?)
      AND c.stamps = (
        SELECT MAX(c2.stamps) FROM cards c2
        WHERE c2.member_id = m.id AND (? IS NULL OR c2.brand_id = ?)
      )
    GROUP BY m.id
    ORDER BY m.last_seen_at ASC
    LIMIT 6`;
  return rows<Lapsed>(db.prepare(sql).bind(before, brandId, brandId, brandId, brandId));
}

export type PendingGoogle = { id: string; sub: string; email: string | null; name: string; created_at: number };

export async function upsertPending(db: D1Database, row: PendingGoogle): Promise<void> {
  await db
    .prepare(
      `INSERT INTO google_pending (id, sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(sub) DO UPDATE SET email=excluded.email, name=excluded.name`,
    )
    .bind(row.id, row.sub, row.email, row.name, row.created_at)
    .run();
}

export async function getPending(db: D1Database, id: string): Promise<PendingGoogle | null> {
  return db.prepare(`SELECT * FROM google_pending WHERE id = ?`).bind(id).first<PendingGoogle>();
}

export async function getPendingBySub(db: D1Database, sub: string): Promise<PendingGoogle | null> {
  return db.prepare(`SELECT * FROM google_pending WHERE sub = ?`).bind(sub).first<PendingGoogle>();
}

export async function deletePending(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM google_pending WHERE id = ?`).bind(id).run();
}

export async function getMemberByGoogle(db: D1Database, sub: string): Promise<Member | null> {
  return db.prepare(`SELECT * FROM members WHERE google_sub = ?`).bind(sub).first<Member>();
}

export async function setMemberGoogle(
  db: D1Database,
  id: string,
  sub: string,
  email: string | null,
  method: "google" | "link",
): Promise<void> {
  const join = method === "google" ? "google" : "wa+google";
  await db
    .prepare(`UPDATE members SET google_sub = ?, email = COALESCE(email, ?), join_method = ? WHERE id = ?`)
    .bind(sub, email, join, id)
    .run();
}

export async function setMemberPhone(db: D1Database, id: string, wa: string): Promise<void> {
  await db.prepare(`UPDATE members SET wa = ? WHERE id = ?`).bind(wa, id).run();
}

export async function setMemberBirthday(db: D1Database, id: string, birthday: string, now: number): Promise<void> {
  await db.prepare(`UPDATE members SET birthday = ?, birthday_set_at = ? WHERE id = ?`).bind(birthday, now, id).run();
}

export async function setBirthdayOverride(db: D1Database, id: string, year: number | null): Promise<void> {
  await db.prepare(`UPDATE members SET birthday_override_year = ? WHERE id = ?`).bind(year, id).run();
}

export async function insertAdminLog(db: D1Database, row: { id: string; action: string; detail: string; now: number }): Promise<void> {
  await db.prepare(`INSERT INTO admin_log (id, action, detail, created_at) VALUES (?, ?, ?, ?)`).bind(row.id, row.action, row.detail, row.now).run();
}

export async function deleteMemberCascade(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM activities WHERE member_id = ?`).bind(id),
    db.prepare(`DELETE FROM birthday_redemptions WHERE member_id = ?`).bind(id),
    db.prepare(`DELETE FROM cards WHERE member_id = ?`).bind(id),
    db.prepare(`DELETE FROM sessions WHERE subject_id = ?`).bind(id),
    db.prepare(`UPDATE claim_tokens SET member_id = NULL WHERE member_id = ?`).bind(id),
    db.prepare(`DELETE FROM members WHERE id = ?`).bind(id),
  ]);
}

export async function birthdayClaimedYears(db: D1Database, memberId: string, brandId: string, fromYear: number, toYear: number): Promise<number[]> {
  const result = await db
    .prepare(
      `SELECT reward_year FROM birthday_redemptions WHERE member_id = ? AND brand_id = ? AND reward_year >= ? AND reward_year <= ?`,
    )
    .bind(memberId, brandId, fromYear, toYear)
    .all<{ reward_year: number }>();
  return (result.results ?? []).map((row) => row.reward_year);
}

export async function birthdayTaken(db: D1Database, memberId: string, brandId: string, year: number): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS n FROM birthday_redemptions WHERE member_id = ? AND brand_id = ? AND reward_year = ?`)
    .bind(memberId, brandId, year)
    .first<{ n: number }>();
  return Boolean(row);
}

export async function insertBirthdayRedemption(
  db: D1Database,
  row: { memberId: string; brandId: string; year: number; activityId: string; now: number },
): Promise<boolean> {
  try {
    await db
      .prepare(
        `INSERT INTO birthday_redemptions (member_id, brand_id, reward_year, activity_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(row.memberId, row.brandId, row.year, row.activityId, row.now)
      .run();
    return true;
  } catch {
    return false;
  }
}

export async function deleteBirthdayRedemption(db: D1Database, memberId: string, brandId: string, year: number): Promise<void> {
  await db
    .prepare(`DELETE FROM birthday_redemptions WHERE member_id = ? AND brand_id = ? AND reward_year = ?`)
    .bind(memberId, brandId, year)
    .run();
}

export type MemberListRow = Member & { stamps_label: string; rewards: number };

export async function listMemberRows(
  db: D1Database,
  filter: { q: string; brandId: string; sort: string },
): Promise<MemberListRow[]> {
  const sortSql: Record<string, string> = {
    nama: "m.name COLLATE NOCASE ASC",
    gabung: "m.created_at DESC",
    kunjungan: "m.last_seen_at DESC",
    ulang: "CASE WHEN m.birthday IS NULL THEN 1 ELSE 0 END, substr(m.birthday, 6, 5) ASC",
  };
  const order = sortSql[filter.sort] || sortSql.kunjungan;
  const where: string[] = [];
  const binds: string[] = [];
  if (filter.q) {
    const like = `%${filter.q.replace(/[%_]/g, "")}%`;
    where.push("(m.name LIKE ? OR m.wa LIKE ? OR IFNULL(m.email,'') LIKE ?)");
    binds.push(like, like, like);
  }
  if (filter.brandId) {
    where.push(`EXISTS (SELECT 1 FROM cards c WHERE c.member_id = m.id AND c.brand_id = ? AND (c.stamps > 0 OR c.lifetime_stamps > 0))`);
    binds.push(filter.brandId);
  }
  const sql = `
    SELECT m.*,
      IFNULL((
        SELECT group_concat(b.short_name || ' ' || c.stamps || '/' || b.stamps_required, ' · ')
        FROM cards c JOIN brands b ON b.id = c.brand_id AND b.active = 1
        WHERE c.member_id = m.id
      ), '') AS stamps_label,
      IFNULL((SELECT SUM(c.lifetime_redeems) FROM cards c JOIN brands b ON b.id = c.brand_id AND b.active = 1 WHERE c.member_id = m.id), 0) AS rewards
    FROM members m
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY ${order}
    LIMIT 1000`;
  return rows<MemberListRow>(db.prepare(sql).bind(...binds));
}

export async function birthdaysThisMonth(db: D1Database, month: number): Promise<Member[]> {
  return rows<Member>(
    db
      .prepare(
        `SELECT * FROM members WHERE birthday IS NOT NULL AND CAST(substr(birthday, 6, 2) AS INTEGER) = ?
         AND EXISTS (SELECT 1 FROM cards c JOIN brands b ON b.id = c.brand_id AND b.active = 1 WHERE c.member_id = members.id)
         ORDER BY substr(birthday, 9, 2), name LIMIT 30`,
      )
      .bind(month),
  );
}

export async function countBirthdayRedeems(db: D1Database, since: number, brandId: string | null): Promise<number> {
  const sql = brandId
    ? `SELECT COUNT(*) AS n FROM activities WHERE type = 'birthday' AND voided = 0 AND created_at >= ? AND brand_id = ?`
    : `SELECT COUNT(*) AS n FROM activities WHERE type = 'birthday' AND voided = 0 AND created_at >= ? AND brand_id ${LIVE_BRAND}`;
  const stmt = brandId ? db.prepare(sql).bind(since, brandId) : db.prepare(sql).bind(since);
  const row = await stmt.first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listOrderLinks(db: D1Database, brandId: string | null): Promise<OrderLink[]> {
  const sql = brandId
    ? `SELECT * FROM order_links WHERE brand_id = ? ORDER BY sort_order, label`
    : `SELECT * FROM order_links ORDER BY brand_id, sort_order, label`;
  const stmt = brandId ? db.prepare(sql).bind(brandId) : db.prepare(sql);
  return rows<OrderLink>(stmt);
}

export async function getOrderLink(db: D1Database, id: string): Promise<OrderLink | null> {
  return db.prepare(`SELECT * FROM order_links WHERE id = ?`).bind(id).first<OrderLink>();
}

export async function upsertOrderLink(
  db: D1Database,
  row: { id: string; brandId: string; outletId: string | null; platform: string; label: string; url: string; sort: number },
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM order_links WHERE brand_id = ? AND platform = ? AND IFNULL(outlet_id, '') = IFNULL(?, '') AND platform IN ('gofood', 'grabfood')`,
    )
    .bind(row.brandId, row.platform, row.outletId)
    .run();
  if (!row.url) return;
  await db
    .prepare(
      `INSERT INTO order_links (id, brand_id, outlet_id, platform, label, url, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(row.id, row.brandId, row.outletId, row.platform, row.label, row.url, row.sort)
    .run();
}

export async function insertOrderLink(
  db: D1Database,
  row: { id: string; brandId: string; outletId: string | null; platform: string; label: string; url: string; sort: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO order_links (id, brand_id, outlet_id, platform, label, url, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(row.id, row.brandId, row.outletId, row.platform, row.label, row.url, row.sort)
    .run();
}

export async function deleteOrderLink(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM order_links WHERE id = ?`).bind(id).run();
}

export async function logOrderClick(
  db: D1Database,
  row: { id: string; brandId: string; outletId: string | null; platform: string; linkId: string; memberId: string | null; now: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO order_clicks (id, brand_id, outlet_id, platform, link_id, member_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, row.brandId, row.outletId, row.platform, row.linkId, row.memberId, row.now)
    .run();
}

export async function orderClickCounts(
  db: D1Database,
  since: number,
  brandId: string | null,
): Promise<Array<{ brand_id: string; platform: string; n: number }>> {
  const sql = brandId
    ? `SELECT brand_id, platform, COUNT(*) AS n FROM order_clicks WHERE created_at >= ? AND brand_id = ? GROUP BY brand_id, platform ORDER BY n DESC`
    : `SELECT brand_id, platform, COUNT(*) AS n FROM order_clicks WHERE created_at >= ? GROUP BY brand_id, platform ORDER BY n DESC`;
  const stmt = brandId ? db.prepare(sql).bind(since, brandId) : db.prepare(sql).bind(since);
  return rows<{ brand_id: string; platform: string; n: number }>(stmt);
}

export async function memberCards(db: D1Database, memberId: string): Promise<Array<Card & { short_name: string }>> {
  return rows<Card & { short_name: string }>(
    db
      .prepare(
        `SELECT c.*, b.short_name AS short_name FROM cards c JOIN brands b ON b.id = c.brand_id AND b.active = 1
         WHERE c.member_id = ? ORDER BY b.name`,
      )
      .bind(memberId),
  );
}
