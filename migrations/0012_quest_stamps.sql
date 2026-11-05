ALTER TABLE cards ADD COLUMN remainder_quarters INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cards ADD COLUMN quest_stamps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE missions ADD COLUMN points_quarters INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stamp_tiers ADD COLUMN icon TEXT NOT NULL DEFAULT '🎁';
ALTER TABLE stamp_tiers ADD COLUMN stock INTEGER;
ALTER TABLE stamp_tiers ADD COLUMN image_url TEXT;
ALTER TABLE stamp_tiers ADD COLUMN r2_key TEXT;

UPDATE missions
SET points_quarters = points_tenths * 4 / 10
WHERE points_quarters = 0 AND points_tenths > 0 AND points_tenths * 4 % 10 = 0;
