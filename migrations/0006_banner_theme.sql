ALTER TABLE banners ADD COLUMN cta TEXT NOT NULL DEFAULT '';

UPDATE brands SET accent = '#143d28', accent_soft = '#e4f0dc' WHERE id = 'loft25';
UPDATE brands SET accent = '#9a3412', accent_soft = '#f8e3d4' WHERE id = 'soto-oseng';
UPDATE brands SET accent = '#f26b1d', accent_soft = '#ffe1c7' WHERE id = 'krispyporkk';

UPDATE banners
SET image_url = '/banners/loft-1.jpg', subtitle = 'Beli 2 lebih hemat', cta = 'Lihat menu', sort_order = 1
WHERE id = 'ban_loft' AND (image_url IS NULL OR image_url = '') AND r2_key IS NULL;

UPDATE banners
SET image_url = '/banners/soto-1.jpg', subtitle = 'Oseng + es teh manis', cta = 'Lihat paket', sort_order = 1
WHERE id = 'ban_soto' AND (image_url IS NULL OR image_url = '') AND r2_key IS NULL;

UPDATE banners
SET image_url = '/banners/krispy-1.jpg', subtitle = 'Tambah nasi cuma Rp5.000', cta = 'Lihat menu', sort_order = 1
WHERE id = 'ban_kris' AND (image_url IS NULL OR image_url = '') AND r2_key IS NULL;

INSERT OR IGNORE INTO banners (id, brand_id, title, subtitle, image_url, r2_key, link_url, starts_at, ends_at, sort_order, active, created_at, cta) VALUES
  ('ban_loft_2', 'loft25', 'Matcha pagi', 'Whisk segar tiap hari', '/banners/loft-2.jpg', NULL, NULL, NULL, NULL, 2, 1, 0, ''),
  ('ban_soto_2', 'soto-oseng', 'Oseng panas', 'Hangat, gurih, habis cepat', '/banners/soto-2.jpg', NULL, NULL, NULL, NULL, 2, 1, 0, ''),
  ('ban_kris_2', 'krispyporkk', 'Kulit garing', 'Renyah, pedas, gelap', '/banners/krispy-2.jpg', NULL, NULL, NULL, NULL, 2, 1, 0, '');
