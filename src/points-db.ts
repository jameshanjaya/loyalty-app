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
    ? `SELECT * FROM missions WHERE active = 1 ORDER BY points_tenths, title`
    : `SELECT * FROM missions ORDER BY active DESC, title`;
  return all<Mission>(db.prepare(sql));
}

export async function getMission(db: D1Database, id: string): Promise<Mission | null> {
  return db.prepare(`SELECT * FROM missions WHERE id = ?`).bind(id).first<Mission>();
}

export async function insertMission(db: D1Database, row: Mission): Promise<void> {
  await db
    .prepare(
      `INSERT INTO missions (id, brand_id, title, description, points_tenths, proof_screenshot, proof_link, limit_kind, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, row.brand_id, row.title, row.description, row.points_tenths, row.proof_screenshot, row.proof_link, row.limit_kind, row.active, row.created_at)
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
  row: { id: string; missionId: string; memberId: string; link: string | null; r2Key: string | null; points: number; now: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO mission_submissions (id, mission_id, member_id, status, link_url, r2_key, points_tenths, reviewer_note, created_at, reviewed_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, '', ?, NULL)`,
    )
    .bind(row.id, row.missionId, row.memberId, row.link, row.r2Key, row.points, row.now)
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

export async function addLedger(
  db: D1Database,
  row: { id: string; memberId: string; brandId: string | null; delta: number; reason: string; refId: string | null; now: number },
): Promise<void> {
  await db
    .prepare(`INSERT INTO point_ledger (id, member_id, brand_id, delta_tenths, reason, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.memberId, row.brandId, row.delta, row.reason, row.refId, row.now)
    .run();
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
      `INSERT INTO point_rewards (id, brand_id, title, points_tenths, stock, image_url, r2_key, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, row.brand_id, row.title, row.points_tenths, row.stock, row.image_url, row.r2_key, row.active, row.created_at)
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

export function asLive(row: RedeemCode): LiveCode {
  return { status: row.status, expiresAt: row.expires_at, pointsTenths: row.points_tenths, stamps: row.stamps_cost };
}
