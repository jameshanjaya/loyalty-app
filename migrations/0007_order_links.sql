CREATE TABLE order_links (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  outlet_id TEXT,
  platform TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_order_links_brand ON order_links(brand_id, outlet_id, platform);

CREATE TABLE order_clicks (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  outlet_id TEXT,
  platform TEXT NOT NULL,
  link_id TEXT NOT NULL,
  member_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_order_clicks_brand ON order_clicks(brand_id, created_at);

INSERT OR IGNORE INTO order_links (id, brand_id, outlet_id, platform, label, url, sort_order, active) VALUES
  ('ol_loft_go', 'loft25', NULL, 'gofood', 'GoFood', 'https://gofood.co.id/jakarta/restaurant/loft25-matcha-studio', 1, 1),
  ('ol_loft_grab', 'loft25', NULL, 'grabfood', 'GrabFood', 'https://food.grab.com/id/id/restaurant/loft25-matcha-studio', 2, 1),
  ('ol_loft_wa', 'loft25', NULL, 'wa', 'WhatsApp', 'https://wa.me/6281234564567?text=Halo%20Loft25', 3, 1),
  ('ol_loft_sen_grab', 'loft25', 'o_loft', 'grabfood', 'GrabFood', 'https://food.grab.com/id/id/restaurant/loft25-senopati', 2, 1),
  ('ol_soto_go', 'soto-oseng', NULL, 'gofood', 'GoFood', 'https://gofood.co.id/jakarta/restaurant/soto-oseng-bang-jem', 1, 1),
  ('ol_soto_grab', 'soto-oseng', NULL, 'grabfood', 'GrabFood', 'https://food.grab.com/id/id/restaurant/soto-oseng-bang-jem', 2, 1),
  ('ol_kris_go', 'krispyporkk', NULL, 'gofood', 'GoFood', 'https://gofood.co.id/jakarta/restaurant/krispyporkk', 1, 1),
  ('ol_kris_grab', 'krispyporkk', NULL, 'grabfood', 'GrabFood', 'https://food.grab.com/id/id/restaurant/krispyporkk', 2, 1),
  ('ol_kris_sp', 'krispyporkk', NULL, 'shopeefood', 'ShopeeFood', 'https://shopee.co.id/universal-link/now-food/store/krispyporkk', 3, 1);
