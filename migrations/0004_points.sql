CREATE TABLE missions (
  id TEXT PRIMARY KEY,
  brand_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  points_tenths INTEGER NOT NULL,
  proof_screenshot INTEGER NOT NULL DEFAULT 0,
  proof_link INTEGER NOT NULL DEFAULT 0,
  limit_kind TEXT NOT NULL DEFAULT 'once',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE mission_submissions (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL,
  link_url TEXT,
  r2_key TEXT,
  points_tenths INTEGER NOT NULL,
  reviewer_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);

CREATE INDEX idx_mission_member ON mission_submissions(member_id, mission_id, created_at);
CREATE INDEX idx_mission_status ON mission_submissions(status, created_at);

CREATE TABLE point_ledger (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  brand_id TEXT,
  delta_tenths INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_points_member ON point_ledger(member_id, created_at);

CREATE TABLE point_rewards (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  title TEXT NOT NULL,
  points_tenths INTEGER NOT NULL,
  stock INTEGER,
  image_url TEXT,
  r2_key TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE stamp_tiers (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  stamps INTEGER NOT NULL,
  reward_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE redeem_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  member_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  reward_label TEXT NOT NULL,
  reward_ref TEXT,
  points_tenths INTEGER NOT NULL DEFAULT 0,
  stamps_cost INTEGER NOT NULL DEFAULT 0,
  stock_held INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  outlet_id TEXT,
  session_id TEXT
);

CREATE INDEX idx_codes_lookup ON redeem_codes(brand_id, code, status);
CREATE INDEX idx_codes_member ON redeem_codes(member_id, status, expires_at);

INSERT OR IGNORE INTO missions (id, brand_id, title, description, points_tenths, proof_screenshot, proof_link, limit_kind, active, created_at) VALUES
  ('misi_review', NULL, 'Foto & review Google', 'Foto struk atau minuman, lalu kasih review Google. Lampirkan tangkapan layar.', 5, 1, 0, 'once', 1, 0),
  ('misi_threads', NULL, 'Post Threads tag kami', 'Post di Threads dan tag akun kami. Tempel tautannya.', 5, 0, 1, 'week', 1, 0),
  ('misi_story', NULL, 'IG Story tag kami', 'Story Instagram yang nge-tag kami. Lampirkan tangkapan layar.', 10, 1, 0, 'week', 1, 0);

INSERT OR IGNORE INTO point_rewards (id, brand_id, title, points_tenths, stock, image_url, r2_key, active, created_at) VALUES
  ('poin_upsize', 'loft25', 'Upsize', 10, NULL, NULL, NULL, 1, 0),
  ('poin_coffee', 'loft25', 'Coffee', 20, NULL, NULL, NULL, 1, 0),
  ('poin_milktea', 'loft25', 'Milk tea', 25, NULL, NULL, NULL, 1, 0),
  ('poin_matcha', 'loft25', 'Matcha', 30, NULL, NULL, NULL, 1, 0),
  ('poin_es', 'soto-oseng', 'Es teh', 10, NULL, NULL, NULL, 1, 0),
  ('poin_krispy', 'krispyporkk', 'Es krim', 20, NULL, NULL, NULL, 1, 0);

INSERT OR IGNORE INTO stamp_tiers (id, brand_id, stamps, reward_text, sort_order, active) VALUES
  ('tier_loft_5', 'loft25', 5, 'free upsize', 1, 1),
  ('tier_loft_10', 'loft25', 10, 'free matcha', 2, 1),
  ('tier_soto_10', 'soto-oseng', 10, 'Soto Oseng paket', 1, 1),
  ('tier_kris_10', 'krispyporkk', 10, 'diskon 50%', 1, 1);
