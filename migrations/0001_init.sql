-- Kartu stamp Loyalty Bos. Angka waktu disimpan sebagai milidetik.

CREATE TABLE brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  handle TEXT NOT NULL,
  emoji TEXT NOT NULL,
  accent TEXT NOT NULL,
  accent_soft TEXT NOT NULL,
  stamps_required INTEGER NOT NULL,
  reward_text TEXT NOT NULL,
  condition_label TEXT NOT NULL,
  min_amount INTEGER,
  max_stamps_per_day INTEGER NOT NULL DEFAULT 2,
  reward_note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE outlets (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  wa TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE cards (
  member_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  stamps INTEGER NOT NULL DEFAULT 0,
  lifetime_stamps INTEGER NOT NULL DEFAULT 0,
  lifetime_redeems INTEGER NOT NULL DEFAULT 0,
  day_count INTEGER NOT NULL DEFAULT 0,
  day_on INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (member_id, brand_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  subject_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE claim_tokens (
  id TEXT PRIMARY KEY,
  outlet_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  member_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER
);

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  member_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  outlet_id TEXT,
  session_id TEXT,
  claim_id TEXT UNIQUE,
  stamps_delta INTEGER NOT NULL,
  stamps_after INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  reverses_id TEXT,
  voided INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE banners (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  r2_key TEXT,
  link_url TEXT,
  starts_at INTEGER,
  ends_at INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);

CREATE TABLE flags (
  id TEXT PRIMARY KEY,
  outlet_id TEXT,
  session_id TEXT,
  member_id TEXT,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_act_created ON activities(created_at);
CREATE INDEX idx_act_member ON activities(member_id, created_at);
CREATE INDEX idx_act_brand_time ON activities(brand_id, created_at);
CREATE INDEX idx_act_outlet_time ON activities(outlet_id, created_at);
CREATE INDEX idx_act_session ON activities(session_id, created_at);
CREATE INDEX idx_act_daily ON activities(member_id, brand_id, type, created_at);
CREATE INDEX idx_members_seen ON members(last_seen_at);
CREATE INDEX idx_cards_brand ON cards(brand_id);
CREATE INDEX idx_claims_status ON claim_tokens(status, expires_at);
CREATE INDEX idx_flags_time ON flags(created_at);
CREATE INDEX idx_banners_brand ON banners(brand_id, sort_order);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);
