ALTER TABLE referral_grants ADD COLUMN friend_ids TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS referral_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  referrer_id TEXT,
  friend_id TEXT,
  brand_id TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_events_time ON referral_events(created_at);
