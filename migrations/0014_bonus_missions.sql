ALTER TABLE brands ADD COLUMN ig_handle TEXT NOT NULL DEFAULT '';
ALTER TABLE missions ADD COLUMN check_kind TEXT NOT NULL DEFAULT '';

UPDATE brands SET ig_handle = '@loft25.matchastudio' WHERE id = 'loft25' AND ig_handle = '';
UPDATE brands SET ig_handle = '@krispyporkk' WHERE id = 'krispyporkk' AND ig_handle = '';
UPDATE brands SET ig_handle = '@sotooseng.bangjem' WHERE id = 'soto-oseng' AND ig_handle = '';

UPDATE missions SET active = 0
WHERE id IN ('misi_review', 'misi_threads', 'misi_story', 'misi_rahasia', 'misi_gulai')
   OR brand_id IS NULL
   OR (brand_id IN ('loft25', 'soto-oseng', 'krispyporkk') AND id NOT LIKE 'misi_google_%' AND id NOT LIKE 'misi_threads_%' AND id NOT LIKE 'misi_story_%');

INSERT INTO missions (
  id, brand_id, title, description, points_tenths, proof_screenshot, proof_link, limit_kind, active, created_at,
  icon, tag, mystery, tease, unlock_points_tenths, sort_order, proof_kind, steps, points_quarters, check_kind
) VALUES
  ('misi_google_loft25', 'loft25', 'Review di Google', 'Upload screenshot review Google kamu. Nama yang keliatan harus mirip nama akun kamu.', 4, 1, 0, 'once', 1, 0, '⭐', '', 0, '', 0, 1, 'upload', 'Buka Google Maps.' || char(10) || 'Kasih review outlet-nya.' || char(10) || 'Screenshot yang keliatan namanya.' || char(10) || 'Upload di sini.', 4, 'google'),
  ('misi_threads_loft25', 'loft25', 'Posting Threads', 'Foto struk dan produk di outlet, lalu upload fotonya. Boleh lebih dari satu foto.', 4, 1, 0, 'once', 1, 0, '🧵', '', 0, '', 0, 2, 'upload', 'Foto struk pembelian.' || char(10) || 'Foto produknya di outlet.' || char(10) || 'Post di Threads pakai caption.' || char(10) || 'Upload fotonya di sini.', 4, 'threads'),
  ('misi_story_loft25', 'loft25', 'Story Instagram', 'Upload screenshot story IG yang nge-tag akun kami.', 4, 1, 0, 'once', 1, 0, '📸', '', 0, '', 0, 3, 'upload', 'Buat story dan tag akun kami.' || char(10) || 'Screenshot story-nya.' || char(10) || 'Upload di sini.', 4, 'story'),
  ('misi_google_soto-oseng', 'soto-oseng', 'Review di Google', 'Upload screenshot review Google kamu. Nama yang keliatan harus mirip nama akun kamu.', 4, 1, 0, 'once', 1, 0, '⭐', '', 0, '', 0, 1, 'upload', 'Buka Google Maps.' || char(10) || 'Kasih review outlet-nya.' || char(10) || 'Screenshot yang keliatan namanya.' || char(10) || 'Upload di sini.', 4, 'google'),
  ('misi_threads_soto-oseng', 'soto-oseng', 'Posting Threads', 'Foto struk dan produk di outlet, lalu upload fotonya. Boleh lebih dari satu foto.', 4, 1, 0, 'once', 1, 0, '🧵', '', 0, '', 0, 2, 'upload', 'Foto struk pembelian.' || char(10) || 'Foto produknya di outlet.' || char(10) || 'Post di Threads pakai caption.' || char(10) || 'Upload fotonya di sini.', 4, 'threads'),
  ('misi_story_soto-oseng', 'soto-oseng', 'Story Instagram', 'Upload screenshot story IG yang nge-tag akun kami.', 4, 1, 0, 'once', 1, 0, '📸', '', 0, '', 0, 3, 'upload', 'Buat story dan tag akun kami.' || char(10) || 'Screenshot story-nya.' || char(10) || 'Upload di sini.', 4, 'story'),
  ('misi_google_krispyporkk', 'krispyporkk', 'Review di Google', 'Upload screenshot review Google kamu. Nama yang keliatan harus mirip nama akun kamu.', 4, 1, 0, 'once', 1, 0, '⭐', '', 0, '', 0, 1, 'upload', 'Buka Google Maps.' || char(10) || 'Kasih review outlet-nya.' || char(10) || 'Screenshot yang keliatan namanya.' || char(10) || 'Upload di sini.', 4, 'google'),
  ('misi_threads_krispyporkk', 'krispyporkk', 'Posting Threads', 'Foto struk dan produk di outlet, lalu upload fotonya. Boleh lebih dari satu foto.', 4, 1, 0, 'once', 1, 0, '🧵', '', 0, '', 0, 2, 'upload', 'Foto struk pembelian.' || char(10) || 'Foto produknya di outlet.' || char(10) || 'Post di Threads pakai caption.' || char(10) || 'Upload fotonya di sini.', 4, 'threads'),
  ('misi_story_krispyporkk', 'krispyporkk', 'Story Instagram', 'Upload screenshot story IG yang nge-tag akun kami.', 4, 1, 0, 'once', 1, 0, '📸', '', 0, '', 0, 3, 'upload', 'Buat story dan tag akun kami.' || char(10) || 'Screenshot story-nya.' || char(10) || 'Upload di sini.', 4, 'story')
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  description = excluded.description,
  points_tenths = excluded.points_tenths,
  proof_screenshot = 1,
  proof_link = 0,
  limit_kind = 'once',
  active = 1,
  proof_kind = 'upload',
  steps = excluded.steps,
  points_quarters = 4,
  check_kind = excluded.check_kind;
