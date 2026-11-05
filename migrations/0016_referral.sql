ALTER TABLE members ADD COLUMN referral_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_referral ON members(referral_code);

CREATE TABLE IF NOT EXISTS referrals (
  friend_id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  code TEXT NOT NULL,
  profile_done INTEGER NOT NULL DEFAULT 0,
  stamped INTEGER NOT NULL DEFAULT 0,
  qualified INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  friend_paid INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id, brand_id, qualified, consumed);

CREATE TABLE IF NOT EXISTS referral_grants (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  activity_id TEXT,
  friends INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('referral_batch', '4');
INSERT OR IGNORE INTO settings (key, value) VALUES ('referral_friend_bonus', '0');
