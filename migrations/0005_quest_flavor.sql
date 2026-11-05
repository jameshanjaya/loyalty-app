ALTER TABLE missions ADD COLUMN icon TEXT NOT NULL DEFAULT '🍃';
ALTER TABLE missions ADD COLUMN tag TEXT NOT NULL DEFAULT '';
ALTER TABLE missions ADD COLUMN mystery INTEGER NOT NULL DEFAULT 0;
ALTER TABLE missions ADD COLUMN tease TEXT NOT NULL DEFAULT '';
ALTER TABLE missions ADD COLUMN unlock_points_tenths INTEGER NOT NULL DEFAULT 0;
ALTER TABLE missions ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE point_rewards ADD COLUMN icon TEXT NOT NULL DEFAULT '🍵';

UPDATE missions SET icon = '📸', tag = 'new', sort_order = 1 WHERE id = 'misi_review';
UPDATE missions SET icon = '🧵', sort_order = 2 WHERE id = 'misi_threads';
UPDATE missions SET icon = '✨', tag = 'limited', sort_order = 3 WHERE id = 'misi_story';

INSERT OR IGNORE INTO missions (
  id, brand_id, title, description, points_tenths, proof_screenshot, proof_link, limit_kind, active, created_at,
  icon, tag, mystery, tease, unlock_points_tenths, sort_order
) VALUES (
  'misi_rahasia', NULL, 'Quest rahasia', 'Kejutan buat yang sudah rajin. Kirim tautan postingan favoritmu.',
  15, 0, 1, 'once', 1, 0, '🎁', '', 1, 'Selesaikan side quest dulu. Ada hadiah yang belum kelihatan.', 100, 9
);

UPDATE point_rewards SET icon = '🥤' WHERE id = 'poin_upsize';
UPDATE point_rewards SET icon = '☕' WHERE id = 'poin_coffee';
UPDATE point_rewards SET icon = '🧋' WHERE id = 'poin_milktea';
UPDATE point_rewards SET icon = '🍵' WHERE id = 'poin_matcha';
UPDATE point_rewards SET icon = '🧊' WHERE id = 'poin_es';
UPDATE point_rewards SET icon = '🍨' WHERE id = 'poin_krispy';

CREATE TABLE levels (
  id TEXT PRIMARY KEY,
  brand_id TEXT,
  name TEXT NOT NULL,
  min_points_tenths INTEGER NOT NULL,
  icon TEXT NOT NULL DEFAULT '🌱',
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO levels (id, brand_id, name, min_points_tenths, icon, sort_order) VALUES
  ('lvl_newbie', NULL, 'Matcha Newbie', 0, '🌱', 1),
  ('lvl_regular', NULL, 'Matcha Regular', 20, '🍵', 2),
  ('lvl_master', NULL, 'Matcha Master', 50, '👑', 3);
