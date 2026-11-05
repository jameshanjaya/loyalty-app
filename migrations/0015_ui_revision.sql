ALTER TABLE brands ADD COLUMN banner_ms INTEGER NOT NULL DEFAULT 3000;
ALTER TABLE brands ADD COLUMN non_halal INTEGER NOT NULL DEFAULT 0;

UPDATE brands SET non_halal = 1 WHERE id IN ('soto-oseng', 'krispyporkk');
UPDATE brands SET accent = '#143d28', accent_soft = '#cfe3b8', cta = '#143d28', page_bg = '#f4efe4', stamp_icon = 'logo' WHERE id = 'loft25';
UPDATE brands SET accent = '#1F3A8A', accent_soft = '#d6e4f5', cta = '#D7262E', page_bg = '#f7f3ee', stamp_icon = 'logo' WHERE id = 'soto-oseng';
UPDATE brands SET accent = '#F27BA6', accent_soft = '#ffd0e4', cta = '#F27BA6', page_bg = '#1a1a1a', stamp_icon = 'logo' WHERE id = 'krispyporkk';

ALTER TABLE outlets ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_outlets_slug ON outlets(slug) WHERE slug IS NOT NULL AND slug != '';

ALTER TABLE members ADD COLUMN promo_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN promo_consent_at INTEGER;

ALTER TABLE banners ADD COLUMN slot INTEGER;

INSERT OR IGNORE INTO settings (key, value) VALUES ('wa_verify_lock', '0');

CREATE TABLE IF NOT EXISTS news_cards (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  slot INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'NEWS',
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  r2_key TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (brand_id, slot)
);

CREATE TABLE IF NOT EXISTS wa_verify_sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  deep_link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  verified_at INTEGER
);

UPDATE stamp_tiers SET active = 0 WHERE brand_id IN ('loft25', 'soto-oseng', 'krispyporkk') AND id NOT LIKE 'tier_ui_%';

INSERT INTO stamp_tiers (id, brand_id, stamps, reward_text, sort_order, active, icon) VALUES
  ('tier_ui_loft_3', 'loft25', 3, 'Filter Coffee', 1, 1, '☕'),
  ('tier_ui_loft_6', 'loft25', 6, 'Upsize', 2, 1, '🎁'),
  ('tier_ui_loft_10', 'loft25', 10, 'Matcha GUMOH', 3, 1, '🍵'),
  ('tier_ui_kris_6', 'krispyporkk', 6, '20% off bill', 1, 1, '🎁'),
  ('tier_ui_kris_8', 'krispyporkk', 8, 'Hainam Platter', 2, 1, '🍚'),
  ('tier_ui_kris_10', 'krispyporkk', 10, 'Porkbelly Party', 3, 1, '🎁'),
  ('tier_ui_soto_3', 'soto-oseng', 3, '2 Bakso Goreng', 1, 1, '🎁'),
  ('tier_ui_soto_6', 'soto-oseng', 6, 'Soto Oseng Set', 2, 1, '🍜'),
  ('tier_ui_soto_10', 'soto-oseng', 10, '30% off bill', 3, 1, '🎁')
ON CONFLICT(id) DO UPDATE SET
  stamps = excluded.stamps,
  reward_text = excluded.reward_text,
  sort_order = excluded.sort_order,
  active = 1,
  icon = excluded.icon;

INSERT INTO news_cards (id, brand_id, slot, kind, title, subtitle, image_url, active) VALUES
  ('news_loft_1', 'loft25', 1, 'NEWS', 'Ube Matcha', 'Ungu di bawah, matcha di atas', '/banners/loft-1.jpg', 1),
  ('news_loft_2', 'loft25', 2, 'PROMO', 'Contoh promo', 'Isi dari dashboard', '/banners/loft-2.jpg', 1),
  ('news_loft_3', 'loft25', 3, 'NEWS', 'Sore di Loft', 'Info outlet / event', '/banners/loft-1.jpg', 1),
  ('news_kris_1', 'krispyporkk', 1, 'NEWS', 'Menu Andalan', 'Pork · Non-halal', '/banners/krispy-1.jpg', 1),
  ('news_kris_2', 'krispyporkk', 2, 'PROMO', 'Contoh promo', 'Isi dari dashboard', '/banners/krispy-2.jpg', 1),
  ('news_kris_3', 'krispyporkk', 3, 'NEWS', 'Makan rame-rame', 'Info outlet / event', '/banners/krispy-1.jpg', 1),
  ('news_soto_1', 'soto-oseng', 1, 'MENU', 'Oseng Babi', 'Pork · Non-halal', '/banners/soto-1.jpg', 1),
  ('news_soto_2', 'soto-oseng', 2, 'MENU', 'Soto Kuah Kuning', 'Pork · Non-halal', '/banners/soto-2.jpg', 1),
  ('news_soto_3', 'soto-oseng', 3, 'NEWS', 'Makan di Bang Jem', 'Info outlet', '/banners/soto-1.jpg', 1)
ON CONFLICT(id) DO NOTHING;

-- Booking / Order via WA. Per outlet, still editable in Outlet & PIN. Loft25 stays as it is.
UPDATE outlets SET wa = '6287890143089' WHERE brand_id = 'soto-oseng';

UPDATE outlets
SET wa = '6285778336066',
    name = CASE WHEN id = 'o_kris' OR name LIKE '%Kemang%' THEN 'Krispyporkk Kembangan' ELSE name END
WHERE brand_id = 'krispyporkk' AND (id = 'o_kris' OR name LIKE '%Kembangan%' OR name LIKE '%Kemang%');

INSERT INTO outlets (id, brand_id, name, pin_hash, pin_salt, active, created_at, wa, slug)
SELECT 'o_kris_gading', brand_id, 'Krispyporkk Gading Serpong', pin_hash, pin_salt, 1, created_at, '6285880903421', 'krispyporkk-gading-serpong'
FROM outlets
WHERE brand_id = 'krispyporkk'
  AND NOT EXISTS (
    SELECT 1 FROM outlets WHERE brand_id = 'krispyporkk' AND (id = 'o_kris_gading' OR name LIKE '%Gading%')
  )
LIMIT 1;

UPDATE outlets SET wa = '6285880903421' WHERE brand_id = 'krispyporkk' AND (id = 'o_kris_gading' OR name LIKE '%Gading%');
UPDATE outlets SET slug = 'krispyporkk-kembangan' WHERE brand_id = 'krispyporkk' AND name LIKE '%Kembangan%' AND (slug IS NULL OR slug = '');
UPDATE outlets SET slug = 'krispyporkk-gading-serpong' WHERE brand_id = 'krispyporkk' AND name LIKE '%Gading%' AND (slug IS NULL OR slug = '');
UPDATE outlets SET slug = 'soto-oseng' WHERE brand_id = 'soto-oseng' AND (slug IS NULL OR slug = '');
