import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { hashPin, randomBytes, bytesToHex } from "../src/crypto.ts";
import { normalizeWa } from "../src/phone.ts";
import { startOfWibDay } from "../src/time.ts";

const DAY = 86_400_000;
const now = Date.now();
const today = startOfWibDay(now);

function readVars(): Record<string, string> {
  const text = readFileSync(".dev.vars", "utf8");
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    let value = trimmed.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, i).trim()] = value;
  }
  return out;
}

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

type BrandPlan = { balance: number; redeems: number };
type Person = {
  id: string;
  name: string;
  wa: string;
  quietDays?: number;
  todayMin?: number;
  recentDays?: number;
  brands: Record<string, BrandPlan>;
};

const people: Person[] = [
  { id: "m_rina", name: "Rina Pratiwi", wa: "081234564567", todayMin: 20, brands: { loft25: { balance: 6, redeems: 4 }, "soto-oseng": { balance: 4, redeems: 1 }, krispyporkk: { balance: 2, redeems: 0 } } },
  { id: "m_kevin", name: "Kevin Tanujaya", wa: "081311110041", recentDays: 2, brands: { loft25: { balance: 1, redeems: 4 }, krispyporkk: { balance: 7, redeems: 0 } } },
  { id: "m_maya", name: "Maya Lestari", wa: "081322220037", recentDays: 4, brands: { loft25: { balance: 7, redeems: 3 } } },
  { id: "m_jessica", name: "Jessica Hartono", wa: "081333330033", recentDays: 6, brands: { loft25: { balance: 3, redeems: 3 } } },
  { id: "m_andre", name: "Andre Wijaya", wa: "081344440007", quietDays: 45, brands: { loft25: { balance: 7, redeems: 0 } } },
  { id: "m_lisa", name: "Lisa Maharani", wa: "081355550008", quietDays: 33, brands: { loft25: { balance: 8, redeems: 0 } } },
  { id: "m_hendra", name: "Hendra Kusuma", wa: "081366660005", quietDays: 33, brands: { "soto-oseng": { balance: 5, redeems: 0 } } },
  { id: "m_budi", name: "Budi Santoso", wa: "081298760007", todayMin: 55, brands: { loft25: { balance: 3, redeems: 0 }, "soto-oseng": { balance: 2, redeems: 0 } } },
  { id: "m_sari", name: "Sari Wulandari", wa: "081311110088", todayMin: 140, brands: { loft25: { balance: 10, redeems: 0 }, krispyporkk: { balance: 6, redeems: 1 } } },
  { id: "m_dewi", name: "Dewi Kartika", wa: "081377770035", todayMin: 95, brands: { loft25: { balance: 4, redeems: 0 }, "soto-oseng": { balance: 8, redeems: 0 } } },
  { id: "m_agus", name: "Agus Salim", wa: "081812340011", recentDays: 5, brands: { krispyporkk: { balance: 9, redeems: 1 }, loft25: { balance: 2, redeems: 0 } } },
  { id: "m_putri", name: "Putri Anggraini", wa: "081812340022", todayMin: 35, brands: { "soto-oseng": { balance: 10, redeems: 1 } } },
  { id: "m_dimas", name: "Dimas Pratama", wa: "081812340033", recentDays: 8, brands: { krispyporkk: { balance: 5, redeems: 2 }, loft25: { balance: 1, redeems: 0 } } },
  { id: "m_nadia", name: "Nadia Kusuma", wa: "081812340044", quietDays: 40, brands: { loft25: { balance: 6, redeems: 0 } } },
  { id: "m_farhan", name: "Farhan Malik", wa: "081812340055", recentDays: 7, brands: { "soto-oseng": { balance: 3, redeems: 2 }, krispyporkk: { balance: 4, redeems: 0 } } },
  { id: "m_citra", name: "Citra Dewi", wa: "081812340066", recentDays: 3, brands: { loft25: { balance: 9, redeems: 1 }, "soto-oseng": { balance: 1, redeems: 0 } } },
];

const outletByBrand: Record<string, string> = { loft25: "o_loft", "soto-oseng": "o_soto", krispyporkk: "o_kris" };

type Ev = { id: string; type: "stamp" | "redeem"; at: number; delta: number; after: number; brand: string; member: string; outlet: string };

function history(person: Person, brand: string, plan: BrandPlan, n: { i: number }): Ev[] {
  const lifetime = plan.balance + plan.redeems * 10;
  const end = person.quietDays ? now - person.quietDays * DAY : now - (person.recentDays ?? 1) * DAY;
  const start = end - 70 * DAY;
  const times: number[] = [];
  for (let i = 0; i < lifetime; i++) {
    const t = lifetime === 1 ? end : start + ((end - start) * i) / (lifetime - 1);
    times.push(Math.round(t));
  }
  if (!person.quietDays && times.length && person.todayMin != null) {
    times[times.length - 1] = now - person.todayMin * 60_000;
  }
  times.sort((a, b) => a - b);
  const events: Ev[] = [];
  let stamps = 0;
  let redeemsLeft = plan.redeems;
  for (const at of times) {
    stamps += 1;
    events.push({
      id: `a${n.i++}`,
      type: "stamp",
      at,
      delta: 1,
      after: stamps,
      brand,
      member: person.id,
      outlet: outletByBrand[brand] || "",
    });
    if (redeemsLeft > 0 && stamps % 10 === 0) {
      stamps -= 10;
      redeemsLeft -= 1;
      events.push({
        id: `a${n.i++}`,
        type: "redeem",
        at: at + 1000,
        delta: -10,
        after: stamps,
        brand,
        member: person.id,
        outlet: outletByBrand[brand] || "",
      });
    }
  }
  if (stamps !== plan.balance || redeemsLeft !== 0) {
    throw new Error(`saldo ${person.name} ${brand} jadi ${stamps}, harus ${plan.balance}`);
  }
  return events;
}

const vars = readVars();
const pepper = vars.PIN_PEPPER;
if (!pepper || pepper.length < 16) {
  console.error("PIN_PEPPER di .dev.vars belum diisi (minimal 16 karakter).");
  process.exit(1);
}

const pin = "2468";
const birthdays: Record<string, string> = {
  m_rina: "1998-11-04",
  m_sari: "1992-11-22",
  m_budi: "1988-11-28",
  m_dewi: "1994-03-02",
  m_kevin: "1991-07-19",
  m_maya: "1996-11-18",
};
const emails: Record<string, string> = {
  m_rina: "rina.pratiwi@gmail.com",
  m_sari: "sari.wulandari@gmail.com",
  m_kevin: "kevin.t@gmail.com",
};
const lines: string[] = [
  "DELETE FROM wa_codes;",
  "DELETE FROM mission_photos;",
  "DELETE FROM settings;",
  "DELETE FROM order_clicks;",
  "DELETE FROM order_links;",
  "DELETE FROM redeem_codes;",
  "DELETE FROM point_ledger;",
  "DELETE FROM mission_submissions;",
  "DELETE FROM missions;",
  "DELETE FROM levels;",
  "DELETE FROM point_rewards;",
  "DELETE FROM stamp_tiers;",
  "DELETE FROM outlet_staff;",
  "DELETE FROM flags;",
  "DELETE FROM rate_limits;",
  "DELETE FROM activities;",
  "DELETE FROM birthday_redemptions;",
  "DELETE FROM claim_tokens;",
  "DELETE FROM sessions;",
  "DELETE FROM google_pending;",
  "DELETE FROM admin_log;",
  "DELETE FROM banners;",
  "DELETE FROM cards;",
  "DELETE FROM members;",
  "DELETE FROM outlets;",
  "DELETE FROM brands;",
];

lines.push(
  `INSERT INTO brands (id, name, short_name, handle, emoji, accent, accent_soft, stamps_required, reward_text, condition_label, min_amount, max_stamps_per_day, reward_note, active, birthday_reward, birthday_active, birthday_window, birthday_days) VALUES
  ('loft25','Loft25 Matcha Studio','Loft25','@loft25.matchastudio','🍵','#143d28','#e4f0dc',10,'free matcha','Transaksi min Rp50.000',50000,2,'1 transaksi yang memenuhi syarat = 1 stamp.',1,'free matcha ulang tahun',1,'day',0),
  ('soto-oseng','Soto Oseng Bang Jem','Soto Oseng','@sotooseng.bangjem','🍜','#1e6a9a','#b3c9ee',10,'Soto Oseng paket','Transaksi ada oseng babi',NULL,2,'Kasir pastikan nota ada oseng babi.',1,'es teh ulang tahun',1,'day',0),
  ('krispyporkk','Krispyporkk','Krispyporkk','@krispyporkk','🍗','#ff6fa8','#ffd0e4',10,'diskon 50%','Transaksi min Rp100.000',100000,2,'Diskon 50% dari tagihan, paling banyak Rp400.000. Kasir yang hitung di kasir.',1,'es krim ulang tahun',0,'day',0);`,
);

async function pinPair(plain: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = randomBytes(16);
  const salt = bytesToHex(saltBytes);
  const hash = await hashPin(plain, saltBytes, pepper);
  return { hash, salt };
}

const outlets = [
  ["o_loft", "loft25", "Loft25 Senopati", "258025"],
  ["o_loft_kemang", "loft25", "Loft25 Kemang", "258026"],
  ["o_soto", "soto-oseng", "Soto Oseng", "369136"],
  ["o_kris", "krispyporkk", "Krispyporkk Kembangan", "470247"],
  ["o_kris_gading", "krispyporkk", "Krispyporkk Gading Serpong", "470248"],
] as const;

for (const [id, brand, name, plain] of outlets) {
  const made = await pinPair(plain);
  lines.push(
    `INSERT INTO outlets (id, brand_id, name, pin_hash, pin_salt, active, created_at) VALUES (${sql(id)},${sql(brand)},${sql(name)},${sql(made.hash)},${sql(made.salt)},1,${now - 90 * DAY});`,
  );
}
lines.push(
  `UPDATE outlets SET wa = '6281211112580', slug = 'loft25-senopati' WHERE id = 'o_loft';
   UPDATE outlets SET wa = '6281233332586', slug = 'loft25-kemang' WHERE id = 'o_loft_kemang';
   UPDATE outlets SET wa = '6287890143089', slug = 'soto-oseng' WHERE id = 'o_soto';
   UPDATE outlets SET wa = '6285778336066', slug = 'krispyporkk-kembangan' WHERE id = 'o_kris';
   UPDATE outlets SET wa = '6285880903421', slug = 'krispyporkk-gading-serpong' WHERE id = 'o_kris_gading';`,
);

const counter = { i: 1 };
const allEvents: Ev[] = [];
for (const person of people) {
  const wa = normalizeWa(person.wa);
  if (!wa) throw new Error(`nomor ${person.wa}`);
  const made = await pinPair(pin);
  const events = Object.entries(person.brands).flatMap(([brand, plan]) => history(person, brand, plan, counter));
  allEvents.push(...events);
  const first = events.reduce((min, e) => Math.min(min, e.at), now);
  const last = events.reduce((max, e) => Math.max(max, e.at), 0);
  const birthday = birthdays[person.id] ? sql(birthdays[person.id]) : "NULL";
  const email = emails[person.id] ? sql(emails[person.id]) : "NULL";
  lines.push(
    `INSERT INTO members (id, name, wa, pin_hash, pin_salt, created_at, last_seen_at, email, birthday, join_method) VALUES (${sql(person.id)},${sql(person.name)},${sql(wa)},${sql(made.hash)},${sql(made.salt)},${first - DAY},${last},${email},${birthday},'wa');`,
  );
  for (const [brand, plan] of Object.entries(person.brands)) {
    const brandEvents = events.filter((e) => e.brand === brand);
    const lifetime = brandEvents.filter((e) => e.type === "stamp").length;
    const redeems = brandEvents.filter((e) => e.type === "redeem").length;
    const dayCount = brandEvents.filter((e) => e.type === "stamp" && e.at >= today).length;
    const updated = brandEvents.reduce((max, e) => Math.max(max, e.at), last);
    lines.push(
      `INSERT INTO cards (member_id, brand_id, stamps, lifetime_stamps, lifetime_redeems, day_count, day_on, updated_at) VALUES (${sql(person.id)},${sql(brand)},${plan.balance},${lifetime},${redeems},${dayCount},${dayCount ? today : 0},${updated});`,
    );
  }
  lines.push(
    `INSERT INTO activities (id, type, member_id, brand_id, outlet_id, session_id, claim_id, stamps_delta, stamps_after, note, reverses_id, voided, created_at) VALUES (${sql(`j${person.id}`)},'join',${sql(person.id)},${sql(Object.keys(person.brands)[0] || "loft25")},NULL,NULL,NULL,0,0,'gabung',NULL,0,${first - DAY});`,
  );
}

for (const event of allEvents) {
  lines.push(
    `INSERT INTO activities (id, type, member_id, brand_id, outlet_id, session_id, claim_id, stamps_delta, stamps_after, note, reverses_id, voided, created_at) VALUES (${sql(event.id)},${sql(event.type)},${sql(event.member)},${sql(event.brand)},${sql(event.outlet)},NULL,NULL,${event.delta},${event.after},${sql(event.type === "stamp" ? "contoh" : "contoh")},NULL,0,${event.at});`,
  );
}

const sampai = now + 26 * DAY;
lines.push(
  `INSERT INTO banners (id, brand_id, title, subtitle, image_url, r2_key, link_url, starts_at, ends_at, sort_order, active, created_at, cta) VALUES
  ('ban_loft','loft25','Matcha Strawberry Latte','Beli 2 lebih hemat','/banners/loft-1.jpg',NULL,NULL,${now - DAY},${sampai},1,1,${now - DAY},'Lihat menu'),
  ('ban_loft_2','loft25','Matcha pagi','Whisk segar tiap hari','/banners/loft-2.jpg',NULL,NULL,${now - DAY},${sampai},2,1,${now},''),
  ('ban_loft_soon','loft25','Menu baru','Belum tayang','/banners/loft-2.jpg',NULL,NULL,${now + 10 * DAY},NULL,3,1,${now},''),
  ('ban_soto','soto-oseng','Paket Jumat','Oseng + es teh manis','/banners/soto-1.jpg',NULL,NULL,${now - DAY},NULL,1,1,${now - DAY},'Lihat paket'),
  ('ban_soto_2','soto-oseng','Oseng panas','Hangat, gurih, habis cepat','/banners/soto-2.jpg',NULL,NULL,${now - DAY},NULL,2,1,${now},''),
  ('ban_kris','krispyporkk','Crispy Bowl','Tambah nasi cuma Rp5.000','/banners/krispy-1.jpg',NULL,NULL,${now - DAY},NULL,1,1,${now - DAY},'Lihat menu'),
  ('ban_kris_2','krispyporkk','Kulit garing','Renyah dan pedas','/banners/krispy-2.jpg',NULL,NULL,${now - DAY},NULL,2,1,${now},'');
  INSERT INTO order_links (id, brand_id, outlet_id, platform, label, url, sort_order, active) VALUES
  ('ol_loft_go','loft25',NULL,'gofood','GoFood','https://gofood.co.id/jakarta/restaurant/loft25-matcha-studio',1,1),
  ('ol_loft_grab','loft25',NULL,'grabfood','GrabFood','https://food.grab.com/id/id/restaurant/loft25-matcha-studio',2,1),
  ('ol_loft_wa','loft25',NULL,'wa','WhatsApp','https://wa.me/6281234564567?text=Halo%20Loft25',3,1),
  ('ol_loft_sen_grab','loft25','o_loft','grabfood','GrabFood','https://food.grab.com/id/id/restaurant/loft25-senopati',2,1),
  ('ol_soto_go','soto-oseng',NULL,'gofood','GoFood','https://gofood.co.id/jakarta/restaurant/soto-oseng-bang-jem',1,1),
  ('ol_soto_grab','soto-oseng',NULL,'grabfood','GrabFood','https://food.grab.com/id/id/restaurant/soto-oseng-bang-jem',2,1),
  ('ol_kris_go','krispyporkk',NULL,'gofood','GoFood','https://gofood.co.id/jakarta/restaurant/krispyporkk',1,1),
  ('ol_kris_grab','krispyporkk',NULL,'grabfood','GrabFood','https://food.grab.com/id/id/restaurant/krispyporkk',2,1),
  ('ol_kris_sp','krispyporkk',NULL,'shopeefood','ShopeeFood','https://shopee.co.id/universal-link/now-food/store/krispyporkk',3,1);
  INSERT INTO missions (id, brand_id, title, description, points_tenths, proof_screenshot, proof_link, limit_kind, active, created_at, icon, tag, mystery, tease, unlock_points_tenths, sort_order) VALUES
  ('misi_review', NULL, 'Foto & review Google', 'Foto struk atau minuman, lalu kasih review Google. Lampirkan tangkapan layar.', 5, 1, 0, 'once', 1, ${now}, '📸', 'new', 0, '', 0, 1),
  ('misi_threads', NULL, 'Post Threads tag kami', 'Post di Threads dan tag akun kami. Tempel tautannya.', 5, 0, 1, 'week', 1, ${now}, '🧵', '', 0, '', 0, 2),
  ('misi_story', NULL, 'IG Story tag kami', 'Story Instagram yang nge-tag kami. Lampirkan tangkapan layar.', 10, 1, 0, 'week', 1, ${now}, '✨', 'limited', 0, '', 0, 3),
  ('misi_rahasia', NULL, 'Quest rahasia', 'Kejutan buat yang sudah rajin. Kirim tautan postingan favoritmu.', 15, 0, 1, 'once', 1, ${now}, '🎁', '', 1, 'Selesaikan side quest dulu. Ada hadiah yang belum kelihatan.', 100, 9);
  INSERT INTO point_rewards (id, brand_id, title, points_tenths, stock, image_url, r2_key, active, created_at, icon) VALUES
  ('poin_upsize', 'loft25', 'Upsize', 10, NULL, NULL, NULL, 1, ${now}, '🥤'),
  ('poin_coffee', 'loft25', 'Coffee', 20, NULL, NULL, NULL, 1, ${now}, '☕'),
  ('poin_milktea', 'loft25', 'Milk tea', 25, NULL, NULL, NULL, 1, ${now}, '🧋'),
  ('poin_matcha', 'loft25', 'Matcha', 30, NULL, NULL, NULL, 1, ${now}, '🍵'),
  ('poin_es', 'soto-oseng', 'Es teh', 10, NULL, NULL, NULL, 1, ${now}, '🧊'),
  ('poin_krispy', 'krispyporkk', 'Es krim', 20, NULL, NULL, NULL, 1, ${now}, '🍨');
  INSERT INTO levels (id, brand_id, name, min_points_tenths, icon, sort_order) VALUES
  ('lvl_newbie', NULL, 'Matcha Newbie', 0, '🌱', 1),
  ('lvl_regular', NULL, 'Matcha Regular', 20, '🍵', 2),
  ('lvl_master', NULL, 'Matcha Master', 50, '👑', 3);
  INSERT INTO mission_submissions (id, mission_id, member_id, status, link_url, r2_key, points_tenths, reviewer_note, created_at, reviewed_at) VALUES
  ('sub_rina_review', 'misi_review', 'm_rina', 'approved', NULL, NULL, 5, '', ${now - 2 * DAY}, ${now - 2 * DAY});
  INSERT INTO stamp_tiers (id, brand_id, stamps, reward_text, sort_order, active) VALUES
  ('tier_loft_5', 'loft25', 5, 'free upsize', 1, 1),
  ('tier_loft_10', 'loft25', 10, 'free matcha', 2, 1),
  ('tier_soto_10', 'soto-oseng', 10, 'Soto Oseng paket', 1, 1),
  ('tier_kris_10', 'krispyporkk', 10, 'diskon 50%', 1, 1);
  INSERT INTO point_ledger (id, member_id, brand_id, delta_tenths, reason, ref_id, created_at, earned_at, expires_at) VALUES
  ('poin_rina', 'm_rina', 'loft25', 15, 'mission', 'sub_rina_review', ${now - 2 * DAY}, ${now - 2 * DAY}, ${now + 11 * DAY});
  UPDATE brands SET accent='#143d28', accent_soft='#cfe3b8', cta='#143d28', page_bg='#f4efe4', stamp_icon='whisk', non_halal=0 WHERE id='loft25';
  UPDATE brands SET accent='#1F3A8A', accent_soft='#d6e4f5', cta='#D7262E', page_bg='#f7f3ee', stamp_icon='bowl', non_halal=1 WHERE id='soto-oseng';
  UPDATE brands SET accent='#F27BA6', accent_soft='#ffd0e4', cta='#F27BA6', page_bg='#1a1a1a', stamp_icon='snout', non_halal=1 WHERE id='krispyporkk';
  UPDATE missions SET proof_kind='upload', description='Foto struk atau minuman, terus review di Google. Lampirin screenshot-nya ya.', steps='Buka Google Maps.\nCari outlet-nya.\nKasih bintang dan tulis review.\nScreenshot, lalu kirim di sini.' WHERE id='misi_review';
  UPDATE missions SET proof_kind='link', description='Post di Threads, tag kami, terus tempel tautannya.' WHERE id='misi_threads';
  UPDATE missions SET proof_kind='upload', description='Story Instagram yang nge-tag kami. Lampirin screenshot-nya.' WHERE id='misi_story';
  UPDATE missions SET proof_kind='link', description='Kejutan buat yang sudah rajin. Kirim tautan postingan favoritmu.' WHERE id='misi_rahasia';
  INSERT INTO missions (id, brand_id, title, description, points_tenths, proof_screenshot, proof_link, limit_kind, active, created_at, icon, tag, mystery, tease, unlock_points_tenths, sort_order, proof_kind, starts_at, ends_at, steps) VALUES
  ('misi_gulai', 'soto-oseng', 'Makan ayam pakai kuah gulai', 'Pesan ayam plus kuah gulai. Kasir yang kasih poinnya.', 10, 0, 0, 'once', 1, ${now}, '🍜', 'new', 0, '', 0, 4, 'cashier', NULL, NULL, 'Pesan ayam pakai kuah gulai.\nTunjukin ke kasir.\nKasir tap kasih poin.');
  INSERT INTO mission_photos (id, mission_id, r2_key, image_url, caption, sort_order) VALUES
  ('foto_gulai_1', 'misi_gulai', NULL, '/banners/soto-1.jpg', 'Ayamnya disiram kuah gulai', 1),
  ('foto_gulai_2', 'misi_gulai', NULL, '/banners/soto-2.jpg', 'Sajikan panas', 2);
  UPDATE missions SET active = 0;
  INSERT INTO missions (id, brand_id, title, description, points_tenths, proof_screenshot, proof_link, limit_kind, active, created_at, icon, sort_order, proof_kind, steps, points_quarters, check_kind) VALUES
  ('misi_google_loft25','loft25','Review di Google','Upload screenshot review Google kamu. Nama yang keliatan harus mirip nama akun kamu.',4,1,0,'once',1,${now},'⭐',1,'upload','Buka Google Maps. Kasih review outlet-nya. Screenshot yang keliatan namanya. Upload di sini.',4,'google'),
  ('misi_threads_loft25','loft25','Posting Threads','Foto struk dan produk di outlet, lalu upload fotonya. Boleh lebih dari satu foto.',4,1,0,'once',1,${now},'🧵',2,'upload','Foto struk pembelian. Foto produknya di outlet. Post di Threads pakai caption. Upload fotonya di sini.',4,'threads'),
  ('misi_story_loft25','loft25','Story Instagram','Upload screenshot story IG yang nge-tag akun kami.',4,1,0,'once',1,${now},'📸',3,'upload','Buat story dan tag akun kami. Screenshot story-nya. Upload di sini.',4,'story'),
  ('misi_google_soto-oseng','soto-oseng','Review di Google','Upload screenshot review Google kamu. Nama yang keliatan harus mirip nama akun kamu.',4,1,0,'once',1,${now},'⭐',1,'upload','Buka Google Maps. Kasih review outlet-nya. Screenshot yang keliatan namanya. Upload di sini.',4,'google'),
  ('misi_threads_soto-oseng','soto-oseng','Posting Threads','Foto struk dan produk di outlet, lalu upload fotonya. Boleh lebih dari satu foto.',4,1,0,'once',1,${now},'🧵',2,'upload','Foto struk pembelian. Foto produknya di outlet. Post di Threads pakai caption. Upload fotonya di sini.',4,'threads'),
  ('misi_story_soto-oseng','soto-oseng','Story Instagram','Upload screenshot story IG yang nge-tag akun kami.',4,1,0,'once',1,${now},'📸',3,'upload','Buat story dan tag akun kami. Screenshot story-nya. Upload di sini.',4,'story'),
  ('misi_google_krispyporkk','krispyporkk','Review di Google','Upload screenshot review Google kamu. Nama yang keliatan harus mirip nama akun kamu.',4,1,0,'once',1,${now},'⭐',1,'upload','Buka Google Maps. Kasih review outlet-nya. Screenshot yang keliatan namanya. Upload di sini.',4,'google'),
  ('misi_threads_krispyporkk','krispyporkk','Posting Threads','Foto struk dan produk di outlet, lalu upload fotonya. Boleh lebih dari satu foto.',4,1,0,'once',1,${now},'🧵',2,'upload','Foto struk pembelian. Foto produknya di outlet. Post di Threads pakai caption. Upload fotonya di sini.',4,'threads'),
  ('misi_story_krispyporkk','krispyporkk','Story Instagram','Upload screenshot story IG yang nge-tag akun kami.',4,1,0,'once',1,${now},'📸',3,'upload','Buat story dan tag akun kami. Screenshot story-nya. Upload di sini.',4,'story');
  UPDATE brands SET ig_handle='@loft25.matchastudio' WHERE id='loft25';
  UPDATE brands SET ig_handle='@krispyporkk' WHERE id='krispyporkk';
  UPDATE brands SET ig_handle='@sotooseng.bangjem' WHERE id='soto-oseng';
  INSERT INTO settings (key, value) VALUES ('points_expire_days', '60');`,
);

writeFileSync(".seed.tmp.sql", lines.join("\n"));
const run = spawnSync("npx", ["wrangler", "d1", "execute", "loyalty-bos", "--local", "--file", ".seed.tmp.sql"], {
  stdio: "inherit",
});
process.exit(run.status ?? 1);
