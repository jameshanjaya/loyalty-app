ALTER TABLE brands ADD COLUMN cta TEXT NOT NULL DEFAULT '';
ALTER TABLE brands ADD COLUMN page_bg TEXT NOT NULL DEFAULT '';
ALTER TABLE brands ADD COLUMN logo_key TEXT;
ALTER TABLE brands ADD COLUMN icon_key TEXT;
ALTER TABLE brands ADD COLUMN stamp_icon TEXT NOT NULL DEFAULT 'whisk';
ALTER TABLE brands ADD COLUMN stamp_key TEXT;

UPDATE brands SET cta = '#143d28', page_bg = '#f3eee4', stamp_icon = 'whisk' WHERE id = 'loft25';
UPDATE brands SET accent = '#1e6a9a', accent_soft = '#b3c9ee', cta = '#c93a26', page_bg = '#e7eef8', stamp_icon = 'bowl' WHERE id = 'soto-oseng';
UPDATE brands SET accent = '#ff6fa8', accent_soft = '#ffd0e4', cta = '#111111', page_bg = '#fff5f8', stamp_icon = 'plate' WHERE id = 'krispyporkk';

ALTER TABLE missions ADD COLUMN proof_kind TEXT NOT NULL DEFAULT '';
ALTER TABLE missions ADD COLUMN starts_at INTEGER;
ALTER TABLE missions ADD COLUMN ends_at INTEGER;
ALTER TABLE missions ADD COLUMN steps TEXT NOT NULL DEFAULT '';

UPDATE missions SET proof_kind = 'upload' WHERE proof_screenshot = 1 AND proof_kind = '';
UPDATE missions SET proof_kind = 'link' WHERE proof_link = 1 AND proof_screenshot = 0 AND proof_kind = '';

ALTER TABLE point_ledger ADD COLUMN earned_at INTEGER;
ALTER TABLE point_ledger ADD COLUMN expires_at INTEGER;
ALTER TABLE point_ledger ADD COLUMN source_id TEXT;

UPDATE point_ledger SET earned_at = created_at WHERE earned_at IS NULL AND delta_tenths > 0;
UPDATE point_ledger
SET expires_at = created_at + 60 * 86400000
WHERE expires_at IS NULL AND delta_tenths > 0 AND reason IN ('mission', 'refund');

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('points_expire_days', '60');

CREATE TABLE IF NOT EXISTS mission_photos (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  r2_key TEXT,
  image_url TEXT,
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mission_photos ON mission_photos(mission_id, sort_order);

CREATE TABLE IF NOT EXISTS wa_codes (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  wa TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wa_codes_code ON wa_codes(code, used_at);

ALTER TABLE members ADD COLUMN wa_verified INTEGER NOT NULL DEFAULT 1;
