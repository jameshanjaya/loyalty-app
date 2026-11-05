import type { LiveCode } from "./points";

export type Mission = {
  id: string;
  brand_id: string | null;
  title: string;
  description: string;
  points_tenths: number;
  proof_screenshot: number;
  proof_link: number;
  limit_kind: string;
  active: number;
  created_at: number;
  icon: string;
  tag: string;
  mystery: number;
  tease: string;
  unlock_points_tenths: number;
  sort_order: number;
  proof_kind?: string;
  starts_at?: number | null;
  ends_at?: number | null;
  steps?: string;
};

export type Submission = {
  id: string;
  mission_id: string;
  member_id: string;
  status: string;
  link_url: string | null;
  r2_key: string | null;
  points_tenths: number;
  reviewer_note: string;
  created_at: number;
  reviewed_at: number | null;
  title?: string;
  member_name?: string;
  wa?: string;
};

export type PointReward = {
  id: string;
  brand_id: string;
  title: string;
  points_tenths: number;
  stock: number | null;
  image_url: string | null;
  r2_key: string | null;
  active: number;
  created_at: number;
  icon: string;
};

export type StampTier = {
  id: string;
  brand_id: string;
  stamps: number;
  reward_text: string;
  sort_order: number;
  active: number;
};

export type RedeemCode = {
  id: string;
  code: string;
  member_id: string;
  brand_id: string;
  kind: string;
  reward_label: string;
  reward_ref: string | null;
  points_tenths: number;
  stamps_cost: number;
  stock_held: number;
  status: string;
  expires_at: number;
  created_at: number;
  confirmed_at: number | null;
  outlet_id: string | null;
  session_id: string | null;
};

async function all<T>(stmt: D1PreparedStatement): Promise<T[]> {
  const result = await stmt.all<T>();
  return result.results ?? [];
}

export async function listMissions(db: D1Database, activeOnly = false): Promise<Mission[]> {
  const sql = activeOnly
    ? `SELECT * FROM missions WHERE active = 1 ORDER BY sort_order, points_tenths, title`
    : `SELECT * FROM missions ORDER BY sort_order, active DESC, title`;
  return all<Mission>(db.prepare(sql));
}

export async function getMission(db: D1Database, id: string): Promise<Mission | null> {
  return db.prepare(`SELECT * FROM missions WHERE id = ?`).bind(id).first<Mission>();
}

export async function insertMission(db: D1Database, row: Mission): Promise<void> {
  await db
    .prepare(
      `INSERT INTO missions (
         id, brand_id, title, description, points_tenths, proof_screenshot, proof_link, limit_kind, active, created_at,
         icon, tag, mystery, tease, unlock_points_tenths, sort_order, proof_kind, starts_at, ends_at, steps
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.brand_id,
      row.title,
      row.description,
      row.points_tenths,
      row.proof_screenshot,
      row.proof_link,
      row.limit_kind,
      row.active,
      row.created_at,
      row.icon || "🍃",
      row.tag || "",
      row.mystery ? 1 : 0,
      row.tease || "",
      row.unlock_points_tenths || 0,
      row.sort_order || 0,
      row.proof_kind || "",
      row.starts_at ?? null,
      row.ends_at ?? null,
      row.steps || "",
    )
    .run();
}

export async function updateMission(db: D1Database, row: Mission): Promise<void> {
  await db
    .prepare(
      `UPDATE missions SET brand_id=?, title=?, description=?, points_tenths=?, proof_screenshot=?, proof_link=?,
        limit_kind=?, active=?, icon=?, tag=?, mystery=?, tease=?, unlock_points_tenths=?, sort_order=?,
        proof_kind=?, starts_at=?, ends_at=?, steps=? WHERE id=?`,
    )
    .bind(
      row.brand_id,
      row.title,
      row.description,
      row.points_tenths,
      row.proof_screenshot,
      row.proof_link,
      row.limit_kind,
      row.active,
      row.icon || "🍃",
      row.tag || "",
      row.mystery ? 1 : 0,
      row.tease || "",
      row.unlock_points_tenths || 0,
      row.sort_order || 0,
      row.proof_kind || "",
      row.starts_at ?? null,
      row.ends_at ?? null,
      row.steps || "",
      row.id,
    )
    .run();
}

export async function setMissionActive(db: D1Database, id: string, active: number): Promise<void> {
  await db.prepare(`UPDATE missions SET active = ? WHERE id = ?`).bind(active, id).run();
}

export async function memberMissionState(db: D1Database, memberId: string, missionId: string): Promise<{ pending: boolean; lastApprovedAt: number | null }> {
  const pending = await db
    .prepare(`SELECT id FROM mission_submissions WHERE member_id = ? AND mission_id = ? AND status = 'pending' LIMIT 1`)
    .bind(memberId, missionId)
    .first<{ id: string }>();
  const approved = await db
    .prepare(
      `SELECT reviewed_at FROM mission_submissions WHERE member_id = ? AND mission_id = ? AND status = 'approved' ORDER BY reviewed_at DESC LIMIT 1`,
    )
    .bind(memberId, missionId)
    .first<{ reviewed_at: number | null }>();
  return { pending: Boolean(pending), lastApprovedAt: approved?.reviewed_at ?? null };
}

export async function insertSubmission(
  db: D1Database,
  row: { id: string; missionId: string; memberId: string; link: string | null; r2Key: string | null; points: number; now: number; status?: "pending" | "approved" },
): Promise<void> {
  const status = row.status || "approved";
  await db
    .prepare(
      `INSERT INTO mission_submissions (id, mission_id, member_id, status, link_url, r2_key, points_tenths, reviewer_note, created_at, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
    )
    .bind(row.id, row.missionId, row.memberId, status, row.link, row.r2Key, row.points, row.now, status === "approved" ? row.now : null)
    .run();
}

export async function listPending(db: D1Database): Promise<Submission[]> {
  return all<Submission>(
    db.prepare(
      `SELECT s.*, m.title AS title, mem.name AS member_name, mem.wa AS wa
       FROM mission_submissions s
       JOIN missions m ON m.id = s.mission_id
       JOIN members mem ON mem.id = s.member_id
       WHERE s.status = 'pending' ORDER BY s.created_at ASC LIMIT 50`,
    ),
  );
}

export async function getSubmission(db: D1Database, id: string): Promise<Submission | null> {
  return db.prepare(`SELECT * FROM mission_submissions WHERE id = ?`).bind(id).first<Submission>();
}

export async function markRevoked(db: D1Database, id: string, note: string, now: number): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE mission_submissions SET status = 'revoked', reviewer_note = ?, reviewed_at = ? WHERE id = ? AND status = 'approved'`)
    .bind(note, now, id)
    .run();
  return result.meta.changes === 1;
}

export async function listApproved(db: D1Database): Promise<Submission[]> {
  return all<Submission>(
    db.prepare(
      `SELECT s.*, m.title AS title, mem.name AS member_name, mem.wa AS wa
       FROM mission_submissions s
       JOIN missions m ON m.id = s.mission_id
       JOIN members mem ON mem.id = s.member_id
       WHERE s.status = 'approved' ORDER BY s.reviewed_at DESC LIMIT 20`,
    ),
  );
}

export async function markSubmission(db: D1Database, id: string, status: "approved" | "rejected", note: string, now: number): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE mission_submissions SET status = ?, reviewer_note = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'`,
    )
    .bind(status, note, now, id)
    .run();
  return result.meta.changes === 1;
}

export async function pointsBalance(db: D1Database, memberId: string): Promise<number> {
  const row = await db.prepare(`SELECT COALESCE(SUM(delta_tenths), 0) AS n FROM point_ledger WHERE member_id = ?`).bind(memberId).first<{ n: number }>();
  return row?.n ?? 0;
}

export type LedgerEntry = {
  id: string;
  member_id: string;
  delta_tenths: number;
  reason: string;
  ref_id: string | null;
  created_at: number;
  earned_at: number | null;
  expires_at: number | null;
  source_id: string | null;
};

export async function listMemberLedger(db: D1Database, memberId: string): Promise<LedgerEntry[]> {
  return all<LedgerEntry>(db.prepare(`SELECT * FROM point_ledger WHERE member_id = ?`).bind(memberId));
}

export async function listAllLedger(db: D1Database): Promise<LedgerEntry[]> {
  return all<LedgerEntry>(db.prepare(`SELECT * FROM point_ledger`));
}

export async function listRefLedger(db: D1Database, refId: string, reason: string): Promise<LedgerEntry[]> {
  return all<LedgerEntry>(db.prepare(`SELECT * FROM point_ledger WHERE ref_id = ? AND reason = ?`).bind(refId, reason));
}

export async function membersWithDuePoints(db: D1Database, now: number): Promise<string[]> {
  const rows = await all<{ member_id: string }>(
    db.prepare(
      `SELECT p.member_id AS member_id FROM point_ledger p
       WHERE p.delta_tenths > 0 AND p.expires_at IS NOT NULL AND p.expires_at <= ? AND p.reason IN ('mission', 'refund')
       AND p.delta_tenths + COALESCE((SELECT SUM(c.delta_tenths) FROM point_ledger c WHERE c.source_id = p.id), 0) > 0
       LIMIT 40`,
    ).bind(now),
  );
  return [...new Set(rows.map((row) => row.member_id))];
}

export async function addLedger(
  db: D1Database,
  row: {
    id: string;
    memberId: string;
    brandId: string | null;
    delta: number;
    reason: string;
    refId: string | null;
    now: number;
    earnedAt?: number | null;
    expiresAt?: number | null;
    sourceId?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO point_ledger (id, member_id, brand_id, delta_tenths, reason, ref_id, created_at, earned_at, expires_at, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, row.memberId, row.brandId, row.delta, row.reason, row.refId, row.now, row.earnedAt ?? null, row.expiresAt ?? null, row.sourceId ?? null)
    .run();
}

export type MissionPhoto = {
  id: string;
  mission_id: string;
  r2_key: string | null;
  image_url: string | null;
  caption: string;
  sort_order: number;
};

export async function listMissionPhotos(db: D1Database, missionId: string): Promise<MissionPhoto[]> {
  return all<MissionPhoto>(db.prepare(`SELECT * FROM mission_photos WHERE mission_id = ? ORDER BY sort_order, id`).bind(missionId));
}

export async function getMissionPhoto(db: D1Database, id: string): Promise<MissionPhoto | null> {
  return db.prepare(`SELECT * FROM mission_photos WHERE id = ?`).bind(id).first<MissionPhoto>();
}

export async function insertMissionPhoto(
  db: D1Database,
  row: { id: string; missionId: string; r2Key: string | null; imageUrl: string | null; caption: string; sort: number },
): Promise<void> {
  await db
    .prepare(`INSERT INTO mission_photos (id, mission_id, r2_key, image_url, caption, sort_order) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.missionId, row.r2Key, row.imageUrl, row.caption, row.sort)
    .run();
}

export async function deleteMissionPhoto(db: D1Database, id: string, missionId: string): Promise<void> {
  await db.prepare(`DELETE FROM mission_photos WHERE id = ? AND mission_id = ?`).bind(id, missionId).run();
}

export async function saveMissionPhotoMeta(db: D1Database, id: string, missionId: string, caption: string, sort: number): Promise<void> {
  await db.prepare(`UPDATE mission_photos SET caption = ?, sort_order = ? WHERE id = ? AND mission_id = ?`).bind(caption, sort, id, missionId).run();
}

export async function pointsTotals(db: D1Database, since: number): Promise<{ issued: number; redeemed: number }> {
  const issued = await db
    .prepare(`SELECT COALESCE(SUM(delta_tenths), 0) AS n FROM point_ledger WHERE reason = 'mission' AND created_at >= ?`)
    .bind(since)
    .first<{ n: number }>();
  const redeemed = await db
    .prepare(`SELECT COALESCE(SUM(-delta_tenths), 0) AS n FROM point_ledger WHERE reason = 'redeem' AND created_at >= ?`)
    .bind(since)
    .first<{ n: number }>();
  return { issued: issued?.n ?? 0, redeemed: redeemed?.n ?? 0 };
}

export async function countPending(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM mission_submissions WHERE status = 'pending'`).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listRewards(db: D1Database, brandId: string | null, activeOnly = false): Promise<PointReward[]> {
  const where = [brandId ? "brand_id = ?" : "1=1", activeOnly ? "active = 1" : "1=1"].join(" AND ");
  const stmt = brandId
    ? db.prepare(`SELECT * FROM point_rewards WHERE ${where} ORDER BY points_tenths, title`).bind(brandId)
    : db.prepare(`SELECT * FROM point_rewards WHERE ${where} ORDER BY brand_id, points_tenths`);
  return all<PointReward>(stmt);
}

export async function getReward(db: D1Database, id: string): Promise<PointReward | null> {
  return db.prepare(`SELECT * FROM point_rewards WHERE id = ?`).bind(id).first<PointReward>();
}

export async function insertReward(db: D1Database, row: PointReward): Promise<void> {
  await db
    .prepare(
      `INSERT INTO point_rewards (id, brand_id, title, points_tenths, stock, image_url, r2_key, active, created_at, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, row.brand_id, row.title, row.points_tenths, row.stock, row.image_url, row.r2_key, row.active, row.created_at, row.icon || "🍵")
    .run();
}

export async function takeStock(db: D1Database, id: string): Promise<"unlimited" | "taken" | "empty"> {
  const row = await db.prepare(`SELECT stock, active FROM point_rewards WHERE id = ?`).bind(id).first<{ stock: number | null; active: number }>();
  if (!row || !row.active) return "empty";
  if (row.stock == null) return "unlimited";
  const result = await db.prepare(`UPDATE point_rewards SET stock = stock - 1 WHERE id = ? AND stock > 0`).bind(id).run();
  return result.meta.changes === 1 ? "taken" : "empty";
}

export async function returnStock(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE point_rewards SET stock = stock + 1 WHERE id = ? AND stock IS NOT NULL`).bind(id).run();
}

export async function listTiers(db: D1Database, brandId: string): Promise<StampTier[]> {
  return all<StampTier>(
    db.prepare(`SELECT * FROM stamp_tiers WHERE brand_id = ? AND active = 1 ORDER BY stamps`).bind(brandId),
  );
}

export async function listAllTiers(db: D1Database): Promise<StampTier[]> {
  return all<StampTier>(db.prepare(`SELECT * FROM stamp_tiers ORDER BY brand_id, stamps`));
}

export async function insertTier(db: D1Database, row: StampTier): Promise<void> {
  await db
    .prepare(`INSERT INTO stamp_tiers (id, brand_id, stamps, reward_text, sort_order, active) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.brand_id, row.stamps, row.reward_text, row.sort_order, row.active)
    .run();
}

export async function getTier(db: D1Database, id: string): Promise<StampTier | null> {
  return db.prepare(`SELECT * FROM stamp_tiers WHERE id = ?`).bind(id).first<StampTier>();
}

export async function insertCode(db: D1Database, row: RedeemCode): Promise<void> {
  await db
    .prepare(
      `INSERT INTO redeem_codes (id, code, member_id, brand_id, kind, reward_label, reward_ref, points_tenths, stamps_cost, stock_held, status, expires_at, created_at, confirmed_at, outlet_id, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
    )
    .bind(
      row.id,
      row.code,
      row.member_id,
      row.brand_id,
      row.kind,
      row.reward_label,
      row.reward_ref,
      row.points_tenths,
      row.stamps_cost,
      row.stock_held,
      row.status,
      row.expires_at,
      row.created_at,
    )
    .run();
}

export async function getCode(db: D1Database, id: string): Promise<RedeemCode | null> {
  return db.prepare(`SELECT * FROM redeem_codes WHERE id = ?`).bind(id).first<RedeemCode>();
}

export async function findPendingCode(db: D1Database, brandId: string, code: string, now: number): Promise<RedeemCode | null> {
  return db
    .prepare(`SELECT * FROM redeem_codes WHERE brand_id = ? AND code = ? AND status = 'pending' AND expires_at > ? LIMIT 1`)
    .bind(brandId, code, now)
    .first<RedeemCode>();
}

export async function confirmCodeRow(db: D1Database, id: string, outletId: string, sessionId: string, now: number): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE redeem_codes SET status = 'confirmed', confirmed_at = ?, outlet_id = ?, session_id = ? WHERE id = ? AND status = 'pending' AND expires_at > ?`,
    )
    .bind(now, outletId, sessionId, id, now)
    .run();
  return result.meta.changes === 1;
}

export async function listDueCodes(db: D1Database, now: number): Promise<RedeemCode[]> {
  return all<RedeemCode>(db.prepare(`SELECT * FROM redeem_codes WHERE status = 'pending' AND expires_at <= ? LIMIT 30`).bind(now));
}

export async function markCodeExpired(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare(`UPDATE redeem_codes SET status = 'expired' WHERE id = ? AND status = 'pending'`).bind(id).run();
  return result.meta.changes === 1;
}

export async function holdStamps(db: D1Database, memberId: string, brandId: string, cost: number, now: number): Promise<number | null> {
  return db
    .prepare(`UPDATE cards SET stamps = stamps - ?, updated_at = ? WHERE member_id = ? AND brand_id = ? AND stamps >= ? RETURNING stamps`)
    .bind(cost, now, memberId, brandId, cost)
    .first<{ stamps: number }>()
    .then((row) => row?.stamps ?? null);
}

export async function refundStamps(db: D1Database, memberId: string, brandId: string, cost: number, now: number): Promise<void> {
  await db
    .prepare(`UPDATE cards SET stamps = stamps + ?, updated_at = ? WHERE member_id = ? AND brand_id = ?`)
    .bind(cost, now, memberId, brandId)
    .run();
}

export async function lifetimeEarned(db: D1Database, memberId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(SUM(delta_tenths), 0) AS n FROM point_ledger WHERE member_id = ? AND reason = 'mission' AND delta_tenths > 0`)
    .bind(memberId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function recentApproval(db: D1Database, memberId: string, since: number): Promise<boolean> {
  const row = await db
    .prepare(`SELECT id FROM mission_submissions WHERE member_id = ? AND status = 'approved' AND reviewed_at >= ? LIMIT 1`)
    .bind(memberId, since)
    .first<{ id: string }>();
  return Boolean(row);
}

export async function visitMarks(db: D1Database, memberId: string): Promise<number[]> {
  const stamps = await all<{ created_at: number }>(
    db.prepare(`SELECT created_at FROM activities WHERE member_id = ? AND type = 'stamp' AND voided = 0 ORDER BY created_at DESC LIMIT 400`).bind(memberId),
  );
  const approved = await all<{ reviewed_at: number }>(
    db.prepare(
      `SELECT reviewed_at AS reviewed_at FROM mission_submissions WHERE member_id = ? AND status = 'approved' AND reviewed_at IS NOT NULL ORDER BY reviewed_at DESC LIMIT 80`,
    ).bind(memberId),
  );
  return [...stamps.map((row) => row.created_at), ...approved.map((row) => row.reviewed_at)];
}

export type Level = {
  id: string;
  brand_id: string | null;
  name: string;
  min_points_tenths: number;
  icon: string;
  sort_order: number;
};

export async function listLevels(db: D1Database): Promise<Level[]> {
  return all<Level>(db.prepare(`SELECT * FROM levels ORDER BY min_points_tenths, sort_order, name`));
}

export async function insertLevel(db: D1Database, row: Level): Promise<void> {
  await db
    .prepare(`INSERT INTO levels (id, brand_id, name, min_points_tenths, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.brand_id, row.name, row.min_points_tenths, row.icon || "🌱", row.sort_order)
    .run();
}

export function asLive(row: RedeemCode): LiveCode {
  return { status: row.status, expiresAt: row.expires_at, pointsTenths: row.points_tenths, stamps: row.stamps_cost };
}
