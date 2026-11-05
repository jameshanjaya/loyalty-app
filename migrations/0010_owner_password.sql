-- Password owner yang diganti dari dashboard.
-- Nilai owner_pass_salt, owner_pass_hash, dan owner_session_version
-- ditulis saat owner menyimpan password, bukan di file ini.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
