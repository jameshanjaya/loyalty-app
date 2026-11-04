ALTER TABLE members ADD COLUMN email TEXT;
ALTER TABLE members ADD COLUMN birthday TEXT;
ALTER TABLE members ADD COLUMN google_sub TEXT;
ALTER TABLE members ADD COLUMN join_method TEXT NOT NULL DEFAULT 'wa';

CREATE UNIQUE INDEX idx_members_google ON members(google_sub);

ALTER TABLE brands ADD COLUMN birthday_reward TEXT NOT NULL DEFAULT '';
ALTER TABLE brands ADD COLUMN birthday_active INTEGER NOT NULL DEFAULT 0;
ALTER TABLE brands ADD COLUMN birthday_window TEXT NOT NULL DEFAULT 'month';
ALTER TABLE brands ADD COLUMN birthday_days INTEGER NOT NULL DEFAULT 7;

UPDATE brands SET birthday_reward = 'free matcha ulang tahun', birthday_active = 1, birthday_window = 'month', birthday_days = 7 WHERE id = 'loft25';
UPDATE brands SET birthday_reward = 'es teh ulang tahun', birthday_active = 1, birthday_window = 'around', birthday_days = 7 WHERE id = 'soto-oseng';
UPDATE brands SET birthday_reward = 'es krim ulang tahun', birthday_active = 0, birthday_window = 'around', birthday_days = 3 WHERE id = 'krispyporkk';

CREATE TABLE google_pending (
  id TEXT PRIMARY KEY,
  sub TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE birthday_redemptions (
  member_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  reward_year INTEGER NOT NULL,
  activity_id TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (member_id, brand_id, reward_year)
);

CREATE TABLE admin_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
