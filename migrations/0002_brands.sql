-- Merek awal. Aman dijalankan ulang.
INSERT OR IGNORE INTO brands
  (id, name, short_name, handle, emoji, accent, accent_soft, stamps_required, reward_text, condition_label, min_amount, max_stamps_per_day, reward_note, active)
VALUES
  ('loft25', 'Loft25 Matcha Studio', 'Loft25', '@loft25.matchastudio', '🍵', '#6ea564', '#e7f3df', 10, 'free matcha', 'Transaksi min Rp50.000', 50000, 2, '1 transaksi yang memenuhi syarat = 1 stamp.', 1),
  ('soto-oseng', 'Soto Oseng Bang Jem', 'Soto Oseng', '@sotooseng.bangjem', '🍜', '#e08a3c', '#fdecd9', 10, 'Soto Oseng paket', 'Transaksi ada oseng babi', NULL, 2, 'Kasir pastikan nota ada oseng babi.', 1),
  ('krispyporkk', 'Krispyporkk', 'Krispyporkk', '@krispyporkk', '🍗', '#d4654f', '#fde4de', 10, 'diskon 50%', 'Transaksi min Rp100.000', 100000, 2, 'Diskon 50% dari tagihan, paling banyak Rp400.000. Kasir yang hitung di kasir.', 1);

INSERT OR IGNORE INTO banners
  (id, brand_id, title, subtitle, image_url, r2_key, link_url, starts_at, ends_at, sort_order, active, created_at)
VALUES
  ('ban_loft', 'loft25', 'Matcha Strawberry Latte', 'Beli 2 lebih hemat!', NULL, NULL, NULL, NULL, NULL, 1, 1, 0),
  ('ban_soto', 'soto-oseng', 'Paket Jumat', 'Oseng + es teh manis', NULL, NULL, NULL, NULL, NULL, 1, 1, 0),
  ('ban_kris', 'krispyporkk', 'Crispy Bowl Baru', 'Tambah nasi cuma Rp5.000', NULL, NULL, NULL, NULL, NULL, 1, 1, 0);
