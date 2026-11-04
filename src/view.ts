import { esc, formatInt, maskName, maskWa, prettyWa } from "./format";
import { progressCopy } from "./loyalty";
import { errText, okText } from "./messages";
import { bannerLive } from "./repo";
import { clock, feedTime, memberSince } from "./time";
import type { DashNumbers, Lapsed, TopMember } from "./repo";
import type { ActivityRow, Banner, Brand, Card, FlagRow, Member, Outlet } from "./types";

const CUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8h8v5a4 4 0 0 1-8 0V8z"/><path d="M15 9.5h1.8a2.2 2.2 0 0 1 0 4.4H15"/><path d="M8 20h6"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 9.2 17 19 7"/></svg>`;
const GIFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="11" width="16" height="8" rx="1.4"/><path d="M12 11v8M4.5 14.5h15"/><path d="M12 11c-1.8-3.4-5-3.2-5-.8 0 1.6 2.2.8 5 .8 2.8 0 5 .8 5-.8 0-2.4-3.2-2.6-5 .8z"/></svg>`;
const LEAF = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 19C14 19 19 12 19 5 12 5 5 8 5 19z"/><path d="M8 16c2-2 4-5 6-8"/></svg>`;

function coin(points: string): string {
  return `<span class="poinbadge"><span class="coin" aria-hidden="true">🍃</span><b>${esc(points)}</b><span>Poin</span></span>`;
}

function confetti(): string {
  return `<div class="confetti" aria-hidden="true">${"<i></i>".repeat(12)}</div>`;
}

function doc(title: string, inner: string, theme = "#6ea564"): string {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="${esc(theme)}" />
<meta name="robots" content="noindex, nofollow" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<title>${esc(title)}</title>
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<link rel="stylesheet" href="/app.css" />
</head>
<body>
${inner}
<script src="/app.js" defer></script>
</body>
</html>`;
}

export function flashes(params: URLSearchParams): string {
  const err = errText(params.get("err"));
  const ok = okText(params.get("ok"));
  const siapa = params.get("siapa") || "";
  const who = /^[\p{L}\d .*']{1,48}$/u.test(siapa) ? ` ${esc(siapa)}` : "";
  let html = "";
  if (err) html += `<div class="flash bad">${esc(err)}</div>`;
  if (ok) html += `<div class="flash good">${esc(ok)}${who}</div>`;
  return html;
}

function paint(accent: string, soft: string): string {
  return `--accent:${esc(accent)};--accent-soft:${esc(soft)}`;
}

const ICO_CARD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 10h8M8 14h5"/></svg>`;
const ICO_QUEST = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3.5 14.4 8.4 19.6 9.1 15.8 12.8 16.7 18 12 15.5 7.3 18 8.2 12.8 4.4 9.1 9.6 8.4z"/></svg>`;
const ICO_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="3.1"/><path d="M5.6 19.2c1.3-2.7 3.5-3.9 6.4-3.9s5.1 1.2 6.4 3.9"/></svg>`;

type Skin = {
  page: string;
  ink: string;
  muted: string;
  accent: string;
  soft: string;
  deep: string;
  glass: string;
  line: string;
  heroA: string;
  heroB: string;
  dark: boolean;
};

const SKINS: Record<string, Skin> = {
  loft25: {
    page: "#f3eee4",
    ink: "#17241c",
    muted: "#5c6b60",
    accent: "#143d28",
    soft: "#e4f0dc",
    deep: "#0e2c1d",
    glass: "rgba(255,252,247,.74)",
    line: "rgba(255,255,255,.72)",
    heroA: "#1c5a3c",
    heroB: "#0c2418",
    dark: false,
  },
  "soto-oseng": {
    page: "#f6efe6",
    ink: "#2a1612",
    muted: "#7d5b52",
    accent: "#9a3412",
    soft: "#f8e3d4",
    deep: "#6d2414",
    glass: "rgba(255,248,242,.76)",
    line: "rgba(255,255,255,.7)",
    heroA: "#a33b28",
    heroB: "#4a1c16",
    dark: false,
  },
  krispyporkk: {
    page: "#120f0c",
    ink: "#f7f1ea",
    muted: "#cbb8a4",
    accent: "#ff7a2a",
    soft: "#3a2418",
    deep: "#e25e12",
    glass: "rgba(255,244,232,.08)",
    line: "rgba(255,255,255,.14)",
    heroA: "#2a1a12",
    heroB: "#0c0a09",
    dark: true,
  },
};

export function customerSkin(brand: Pick<Brand, "id" | "accent" | "accent_soft"> | null): { style: string; dark: boolean; accent: string } {
  const base =
    (brand && SKINS[brand.id]) ||
    ({
      page: "#f3eee4",
      ink: "#17241c",
      muted: "#6d675d",
      accent: brand?.accent || "#143d28",
      soft: brand?.accent_soft || "#e4f0dc",
      deep: brand?.accent || "#143d28",
      glass: "rgba(255,252,247,.74)",
      line: "rgba(255,255,255,.7)",
      heroA: brand?.accent || "#143d28",
      heroB: "#102018",
      dark: false,
    } satisfies Skin);
  const accent = brand?.accent || base.accent;
  const divider = base.dark ? "rgba(255,255,255,.12)" : "#efe4d4";
  const style = `--page:${base.page};--ink:${base.ink};--muted:${base.muted};--accent:${accent};--accent-soft:${base.soft};--deep:${base.deep};--glass:${base.glass};--glass-line:${base.line};--card:${base.glass};--line:${divider};--hero-a:${base.heroA};--hero-b:${base.heroB};background:var(--page);color:var(--ink)`;
  return { style, dark: base.dark, accent };
}

function tabbar(on: "kartu" | "quest" | "hadiah" | "profil", brandId: string): string {
  const q = brandId ? `?merek=${esc(brandId)}` : "";
  const links: Array<["kartu" | "quest" | "hadiah" | "profil", string, string, string]> = [
    ["kartu", `/kartu${q}`, "Kartu", ICO_CARD],
    ["quest", `/misi${q}`, "Side Quest", ICO_QUEST],
    ["hadiah", `/hadiah${q}`, "Hadiah", GIFT],
    ["profil", `/profil${q}`, "Profil", ICO_USER],
  ];
  return `<nav class="tabbar" aria-label="Menu">${links
    .map(([id, href, label, icon]) => `<a class="${on === id ? "on" : ""}" href="${href}">${icon}<span>${label}</span></a>`)
    .join("")}</nav>`;
}

function carousel(banners: Banner[], now: number): string {
  const live = banners.filter((banner) => bannerLive(banner, now));
  const slides = (live.length ? live : []).map((banner, index) => {
    const img = banner.r2_key ? `/media/${banner.r2_key}` : banner.image_url || "";
    const cta = banner.cta || (banner.link_url ? "Lihat" : "");
    const copy = `<div class="slide-copy">${banner.title ? `<h3>${esc(banner.title)}</h3>` : ""}${banner.subtitle ? `<p>${esc(banner.subtitle)}</p>` : ""}${cta ? `<span class="cta">${esc(cta)}</span>` : ""}</div>`;
    const media = img
      ? `<img src="${esc(img)}" alt="${esc(banner.title)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`
      : `<div class="slide-fallback"></div>`;
    const inner = `${media}${copy}`;
    return banner.link_url ? `<a class="slide" href="${esc(banner.link_url)}">${inner}</a>` : `<div class="slide">${inner}</div>`;
  });
  if (!slides.length) {
    return "";
  }
  const dots =
    slides.length > 1
      ? `<div class="reel-dots">${slides.map((_, i) => `<button type="button" class="dot${i === 0 ? " on" : ""}" data-dot="${i}" aria-label="Foto ${i + 1}"></button>`).join("")}</div>`
      : "";
  return `<section class="reel" data-reel data-ms="4800" aria-roledescription="carousel">${dots}<div class="reel-track">${slides.join("")}</div></section>`;
}

export function stampGrid(filled: number, total: number): string {
  const n = Math.max(1, Math.min(total, 20));
  const on = Math.min(Math.max(filled, 0), n);
  let html = `<div class="stamps" aria-label="${on} dari ${n} stamp">`;
  for (let i = 1; i <= n; i++) html += i <= on ? `<div class="stamp on">${CUP}</div>` : `<div class="stamp">${i}</div>`;
  return `${html}</div>`;
}

export function ruleLine(brand: Brand): string {
  return `${brand.condition_label} = 1 stamp · ${brand.stamps_required} stamp = ${brand.reward_text}`;
}

export function messagePage(title: string, text: string, href = "/", label = "Kembali"): string {
  return doc(
    title,
    `<main class="phone"><section class="card"><h2>${esc(title)}</h2><p class="fine" style="margin-top:8px">${esc(text)}</p><a class="btn btn-solid" href="${esc(href)}">${esc(label)}</a></section></main>`,
  );
}

export function homePage(brands: Brand[]): string {
  const pills = brands
    .map((b) => `<a class="pill" href="/gabung/${esc(b.id)}">${esc(b.emoji)} ${esc(b.short_name)}</a>`)
    .join("");
  return doc(
    "Loyalty Bos",
    `<main class="phone" style="${paint("#6ea564", "#e7f3df")}">
      <header class="hero center"><div class="checkbubble">${CUP}</div><div class="hero-big">Kartu stamp kamu</div><p class="hero-fine">Satu akun untuk semua merek. Simpan di HP, tanpa download aplikasi.</p></header>
      <section class="card"><h2>Pilih merek</h2><div class="pills">${pills}</div><a class="btn btn-solid" href="/gabung">Gabung</a><a class="btn btn-line" href="/masuk">Sudah punya kartu</a></section>
      <p class="fine center" style="margin-top:16px"><a href="/kasir">Masuk kasir</a></p>
    </main>`,
  );
}

export function joinPage(input: { brands: Brand[]; brand: Brand | null; next: string; params: URLSearchParams; values?: { nama?: string; wa?: string } }): string {
  const accent = input.brand?.accent || "#6ea564";
  const title = input.brand ? `Gabung ${input.brand.short_name}` : "Gabung kartu";
  return doc(
    title,
    `<main class="phone" style="${paint(accent, input.brand?.accent_soft || "#e7f3df")}">
      <header class="hero"><div class="hero-top"><div class="avatar">${esc(input.brand?.emoji || "🍵")}</div><div><div class="hero-title">${esc(title)}</div><div class="hero-sub">Satu akun buat semua merek</div></div></div></header>
      ${flashes(input.params)}
      <form class="card" method="post" action="/gabung">
        <input type="hidden" name="next" value="${esc(input.next)}" />
        <input type="hidden" name="merek" value="${esc(input.brand?.id || "")}" />
        <label class="lbl" for="nama">Nama</label>
        <input id="nama" name="nama" required maxlength="40" autocomplete="name" value="${esc(input.values?.nama || "")}" />
        <label class="lbl" for="wa">Nomor WhatsApp</label>
        <input id="wa" name="wa" required inputmode="tel" autocomplete="tel" placeholder="0812 3456 4567" value="${esc(input.values?.wa || "")}" />
        <label class="lbl" for="pin">PIN pilihan kamu (4–6 angka)</label>
        <input id="pin" name="pin" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="new-password" pattern="\\d{4,6}" />
        <label class="lbl" for="pin2">Ulangi PIN</label>
        <input id="pin2" name="pin2" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="new-password" pattern="\\d{4,6}" />
        <p class="fine">Tidak ada SMS. PIN ini yang dipakai kalau kamu masuk di HP lain. Jangan kasih ke orang.</p>
        <button class="btn btn-solid">Simpan &amp; lihat kartu</button>
      </form>
      <p class="fine center" style="margin-top:12px">Sudah terdaftar? <a href="/masuk?next=${encodeURIComponent(input.next)}">Masuk</a></p>
    </main>`,
    accent,
  );
}

export function loginPage(input: { next: string; params: URLSearchParams }): string {
  return doc(
    "Masuk",
    `<main class="phone">
      <header class="hero"><div class="hero-title">Masuk ke kartu</div><div class="hero-sub">Pakai nomor WA dan PIN</div></header>
      ${flashes(input.params)}
      <form class="card" method="post" action="/masuk">
        <input type="hidden" name="next" value="${esc(input.next)}" />
        <label class="lbl" for="wa">Nomor WhatsApp</label>
        <input id="wa" name="wa" required inputmode="tel" autocomplete="tel" placeholder="0812 3456 4567" />
        <label class="lbl" for="pin">PIN</label>
        <input id="pin" name="pin" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="current-password" />
        <button class="btn btn-solid">Masuk</button>
      </form>
      <a class="btn btn-google" href="/masuk/google">Masuk dengan Google</a>
      <p class="fine center" style="margin-top:12px"><a href="/gabung">Belum punya kartu</a></p>
    </main>`,
  );
}

export function cardPage(input: {
  member: Member;
  brands: Brand[];
  cards: Map<string, Card>;
  brand: Brand;
  banners: Banner[];
  history: ActivityRow[];
  now: number;
  params: URLSearchParams;
  birthday?: string | null;
  points?: string;
  tiers?: Array<{ id: string; stamps: number; reward: string; ready: boolean }>;
}): string {
  const card = input.cards.get(input.brand.id);
  const stamps = card?.stamps ?? 0;
  const copy = progressCopy(stamps, input.brand.stamps_required, input.brand.reward_text);
  const pills = input.brands
    .map((b) => `<a class="${b.id === input.brand.id ? "on" : ""}" href="/kartu?merek=${esc(b.id)}">${esc(b.short_name)}</a>`)
    .join("");
  const skin = customerSkin(input.brand);
  const rows = input.history
    .map((row) => {
      const when = feedTime(row.created_at, input.now);
      if (row.type === "redeem") return `<div class="row"><div><b class="reward">Tukar ${esc(row.reward_text)}</b><div class="small muted">${esc(row.outlet_name || row.short_name)}</div></div><div class="muted">${esc(when)}</div></div>`;
      if (row.type === "cancel") return `<div class="row"><div><b class="muted">Dibatalkan</b></div><div class="muted">${esc(when)}</div></div>`;
      if (row.type === "join") return `<div class="row"><div><b>Gabung kartu</b></div><div class="muted">${esc(when)}</div></div>`;
      if (row.type === "birthday") return `<div class="row"><div><b class="reward">Hadiah ultah</b><div class="small muted">${esc(row.note)}</div></div><div class="muted">${esc(when)}</div></div>`;
      const label = row.voided ? "Stamp dibatalkan" : "+1 stamp";
      return `<div class="row"><div><b class="${row.voided ? "muted" : "plus"}">${label}</b><div class="small muted">${esc(row.outlet_name || "")}</div></div><div class="muted">${esc(when)}</div></div>`;
    })
    .join("");
  const first = input.member.name.split(" ")[0] || input.member.name;
  return doc(
    input.brand.short_name,
    `<main class="phone skin with-tabs${skin.dark ? " skin-dark" : ""}" style="${skin.style}">
      ${carousel(input.banners, input.now) || `<section class="reel"><div class="reel-track"><div class="slide"><div class="slide-fallback"></div><div class="slide-copy"><h3>${esc(input.brand.name)}</h3><p>${esc(input.brand.handle)}</p></div></div></div></section>`}
      <section class="hello">
        <div>
          <div class="eyebrow">${esc(input.brand.emoji)} ${esc(input.brand.short_name)}</div>
          <h1 class="display">Halo, ${esc(first)}</h1>
          <p class="fine">Member sejak ${esc(memberSince(input.member.created_at))}</p>
        </div>
        ${coin(input.points || "0")}
      </section>
      <nav class="switch" aria-label="Merek">${pills}</nav>
      ${flashes(input.params)}
      <section class="card">
        <div class="split"><h2>Kartu stamp</h2><b class="count">${stamps}/${input.brand.stamps_required}</b></div>
        ${stampGrid(stamps, input.brand.stamps_required)}
        <p class="lead">${esc(copy.headline)}</p>
        <p class="fine">${esc(ruleLine(input.brand))}</p>
        ${(input.tiers || [])
          .map(
            (tier) => `<div class="row"><span>${tier.stamps} stamp = ${esc(tier.reward)}</span>${
              tier.ready
                ? `<form method="post" action="/tukar/stamp"><input type="hidden" name="tier" value="${esc(tier.id)}" /><button class="textlink">Tukar</button></form>`
                : `<span class="muted">kumpulin</span>`
            }</div>`,
          )
          .join("")}
      </section>
      ${input.birthday ? `<section class="bday"><div class="kicker">ULANG TAHUN</div><h3>Hadiah: ${esc(input.birthday)}</h3><p>Sekali setahun. Tukar di sini, kasir masukkan kodenya.</p><form method="post" action="/tukar/ultah"><input type="hidden" name="merek" value="${esc(input.brand.id)}" /><button class="btn btn-solid">Tukar hadiah ultah</button></form></section>` : ""}
      <section class="card"><h2>Riwayat</h2>${rows || `<p class="fine">Belum ada stamp di merek ini.</p>`}</section>
      ${tabbar("kartu", input.brand.id)}
    </main>`,
    skin.accent,
  );
}

export function claimHoldPage(input: { brand: Brand | null; next: string; error?: string }): string {
  const accent = input.brand?.accent || "#6ea564";
  return doc(
    "Terima stamp",
    `<main class="phone" style="${paint(accent, input.brand?.accent_soft || "#e7f3df")}">
      <header class="hero center"><div class="checkbubble">${CUP}</div><div class="hero-big">${input.brand ? esc(input.brand.short_name) : "QR"}</div><p class="hero-fine">${input.error ? esc(input.error) : "Masuk dulu, stamp-nya langsung masuk ke kartu kamu."}</p></header>
      ${input.error ? `<a class="btn btn-solid" href="/kartu">Ke kartu</a>` : `<a class="btn btn-solid" href="/masuk?next=${encodeURIComponent(input.next)}">Masuk</a><a class="btn btn-line" href="/gabung?next=${encodeURIComponent(input.next)}${input.brand ? `&merek=${esc(input.brand.id)}` : ""}">Gabung baru</a>`}
    </main>`,
    accent,
  );
}

export function successPage(input: {
  member: Member;
  brand: Brand;
  outletName: string;
  stamps: number;
  when: number;
  banners: Banner[];
  otherBrands: string[];
  kind: "stamp" | "redeem" | "birthday";
  now: number;
}): string {
  const copy = progressCopy(input.stamps, input.brand.stamps_required, input.brand.reward_text);
  const skin = customerSkin(input.brand);
  const title =
    input.kind === "stamp"
      ? `+1 stamp di ${input.brand.short_name}!`
      : input.kind === "birthday"
        ? `Hadiah ultah ${input.brand.short_name}!`
        : `Reward ${input.brand.short_name} ditukar!`;
  const others = input.otherBrands.length ? `Cek juga kartu kamu di ${input.otherBrands.join(" & ")}` : "Kartu kamu tersimpan di HP ini";
  return doc(
    title,
    `${confetti()}<main class="phone skin with-tabs${skin.dark ? " skin-dark" : ""}" style="${skin.style}">
      ${carousel(input.banners, input.now)}
      <header class="hello">
        <div>
          <div class="checkbubble burst">${CHECK}</div>
          <h1 class="display">${esc(title)}</h1>
          <p class="fine">Makasih, ${esc(input.member.name.split(" ")[0] || "")}! · ${esc(input.outletName)} · ${esc(clock(input.when))}</p>
        </div>
      </header>
      <section class="card">
        <div class="split"><h2>Kartu stamp ${esc(input.brand.short_name)}</h2><b class="count">${input.stamps}/${input.brand.stamps_required}</b></div>
        ${stampGrid(input.stamps, input.brand.stamps_required)}
        <p class="lead">${esc(copy.headline)}</p>
        <p class="fine">${esc(ruleLine(input.brand))}</p>
      </section>
      <div class="hint">${esc(others)}</div>
      <a class="btn btn-solid" href="/kartu?merek=${esc(input.brand.id)}">Lihat kartu saya</a>
      ${tabbar("kartu", input.brand.id)}
    </main>`,
    skin.accent,
  );
}

export function cashierLoginPage(outlets: Array<Outlet & { brand_name: string; emoji: string; accent: string }>, params: URLSearchParams): string {
  const options = outlets
    .map((o) => `<option value="${esc(o.id)}">${esc(o.emoji)} ${esc(o.name)}</option>`)
    .join("");
  return doc(
    "Kasir",
    `<main class="phone">
      <header class="hero"><div class="hero-title">Masuk kasir</div><div class="hero-sub">Pilih outlet, lalu PIN outlet</div></header>
      ${flashes(params)}
      <form class="card" method="post" action="/kasir/masuk">
        <label class="lbl" for="outlet">Outlet</label>
        <select id="outlet" name="outlet_id" required>${options}</select>
        <label class="lbl" for="pin">PIN outlet</label>
        <input id="pin" name="pin" required inputmode="numeric" minlength="4" maxlength="8" autocomplete="current-password" />
        <button class="btn btn-solid">Masuk</button>
      </form>
    </main>`,
  );
}

export function cashierDeskPage(input: {
  outlet: Outlet;
  brand: Brand;
  feed: ActivityRow[];
  cancelId: string | null;
  found: { member: Member; stamps: number; birthday: string | null } | null;
  now: number;
  params: URLSearchParams;
}): string {
  const rows = input.feed
    .map((row) => {
      const right = row.voided
        ? `<span class="muted">dibatalkan</span>`
        : row.type === "redeem"
          ? `<span class="reward">${esc(row.reward_text)}</span>`
          : row.type === "birthday"
            ? `<span class="reward">Ultah</span>`
            : `<span class="plus">+1 stamp</span>`;
      const batal =
        row.id === input.cancelId && !row.voided
          ? `<form method="post" action="/kasir/batal/${esc(row.id)}"><button class="textlink">Batalkan</button></form>`
          : "";
      return `<div class="row"><div class="time">${esc(feedTime(row.created_at, input.now))}</div><div class="grow ${row.voided ? "void" : ""}">${esc(maskName(row.member_name, row.wa))}${batal}</div><div>${right}</div></div>`;
    })
    .join("");
  let found = "";
  if (input.found) {
    const copy = progressCopy(input.found.stamps, input.brand.stamps_required, input.brand.reward_text);
    found = `<section class="card">
      <div class="split"><h2>${esc(input.found.member.name)}</h2><b class="count">${input.found.stamps}/${input.brand.stamps_required}</b></div>
      <p class="fine">${esc(prettyWa(input.found.member.wa))}</p>
      ${stampGrid(input.found.stamps, input.brand.stamps_required)}
      <p class="lead">${esc(copy.headline)}</p>
      ${copy.ready ? `<a class="btn btn-amber" href="/kasir/tukar?member=${esc(input.found.member.id)}">${GIFT} Tukar Reward: ${esc(input.brand.reward_text)}</a>` : ""}
      ${input.found.birthday ? `<a class="btn btn-line" href="/kasir/ulangtahun?member=${esc(input.found.member.id)}">Tukar ultah: ${esc(input.found.birthday)}</a>` : ""}
    </section>`;
  }
  return doc(
    `Kasir ${input.outlet.name}`,
    `<main class="phone" style="${paint(input.brand.accent, input.brand.accent_soft)}">
      <header class="hero">
        <div class="hero-top"><div class="avatar">${esc(input.brand.emoji)}</div><div><div class="hero-title">Kasir · ${esc(input.outlet.name)}</div><div class="hero-sub">Tablet outlet</div></div></div>
        <div class="badge">${CHECK} Login PIN outlet</div>
      </header>
      ${flashes(input.params)}
      <section class="card">
        <h2>Kasih stamp ke customer</h2>
        <p class="fine">Customer scan QR pakai kamera HP, stamp langsung masuk</p>
        <form method="post" action="/kasir/stamp">
          <label class="checkline"><input type="checkbox" name="syarat" value="on" required /> ${esc(input.brand.condition_label)}</label>
          <button class="btn btn-solid">${CUP} Kasih Stamp</button>
        </form>
        <form method="post" action="/kasir/redeem"><button class="btn btn-gold">${GIFT} Tukar Reward</button></form>
        <form method="post" action="/kasir/ulangtahun"><button class="btn btn-line">Hadiah ulang tahun</button></form>
        <a class="btn btn-line" href="/kasir/kode">Masukkan kode customer</a>
      </section>
      <section class="card">
        <h2>QR susah kebaca?</h2>
        <p class="fine">Ketik nomor WA sebagai cadangan. Tetap 1 stamp, tetap kena batas harian.</p>
        <form method="post" action="/kasir/stamp/manual">
          <label class="lbl" for="wa">Nomor WA customer</label>
          <input id="wa" name="wa" inputmode="tel" placeholder="0812 3456 4567" required value="${esc(input.params.get("wa") || "")}" />
          <label class="checkline"><input type="checkbox" name="syarat" value="on" /> ${esc(input.brand.condition_label)}</label>
          <button class="btn btn-solid">+1 Stamp ke nomor ini</button>
          <button class="btn btn-line" formaction="/kasir/cari">Cari member</button>
        </form>
      </section>
      ${found}
      <section class="card">
        <h2>Aktivitas terakhir (otomatis)</h2>
        ${rows || `<p class="fine">Belum ada aktivitas di outlet ini.</p>`}
      </section>
      <form method="post" action="/kasir/keluar"><button class="linkbtn">Keluar kasir</button></form>
    </main>`,
    input.brand.accent,
  );
}

export function cashierQrPage(input: {
  brand: Brand;
  claimId: string;
  kind: "stamp" | "redeem" | "birthday";
  svg: string;
  claimUrl: string;
  remainingMs: number;
  status: string;
  masked: string | null;
  when: string | null;
}): string {
  const noun = input.kind === "stamp" ? "1 stamp" : input.kind === "birthday" ? "hadiah ulang tahun" : "tukar reward";
  const waiting =
    input.status === "pending"
      ? `<div data-poll="/kasir/qr/${esc(input.claimId)}/status" data-remaining="${Math.max(0, input.remainingMs)}" data-ttl="60000">
          <div class="qrbox" data-url="${esc(input.claimUrl)}">${input.svg}</div>
          <div class="countpill">Berlaku <span data-count>1:00</span></div>
          <div class="track"><span data-bar></span></div>
          <p class="fine center" data-wait>Menunggu customer scan...</p>
        </div>
        <div class="note">Setelah discan, layar berubah jadi nama yang nerima. Kalau waktu habis, QR hangus dan tap lagi.</div>
        <form method="post" action="/kasir/qr/${esc(input.claimId)}/batal"><button class="linkbtn">× Batal</button></form>`
      : `<section class="card center"><h2>${input.status === "claimed" ? `Terkirim ke ${esc(input.masked || "member")}` : esc(input.status === "cancelled" ? "QR dibatalkan" : "QR sudah hangus")}</h2>
          <p class="fine">${input.when ? esc(input.when) : ""}</p>
          <a class="btn btn-solid" href="/kasir/meja">Kembali</a></section>`;
  const refresh = input.status === "claimed" ? `<meta http-equiv="refresh" content="5;url=/kasir/meja" />` : "";
  return doc(
    "QR kasir",
    `${refresh}<main class="phone" style="${paint(input.brand.accent, input.brand.accent_soft)}">
      <header class="hero"><div class="hero-top"><div class="avatar">${esc(input.brand.emoji)}</div><div><div class="hero-title">Kasir · ${esc(input.brand.short_name)}</div><div class="hero-sub">Login PIN outlet</div></div></div></header>
      <section class="card center">
        <h2>${input.status === "pending" ? "Minta customer scan QR ini" : "Status QR"}</h2>
        <p class="fine">${noun} · ${esc(input.brand.short_name)} · sekali pakai</p>
        ${waiting}
      </section>
    </main>`,
    input.brand.accent,
  );
}

export function confirmRedeemPage(input: { brand: Brand; member: Member; stamps: number }): string {
  return doc(
    "Tukar reward",
    `<main class="phone" style="${paint(input.brand.accent, input.brand.accent_soft)}">
      <header class="hero"><div class="hero-title">Tukar untuk ${esc(input.member.name)}?</div><div class="hero-sub">${input.stamps}/${input.brand.stamps_required} · ${esc(input.brand.reward_text)}</div></header>
      <section class="card">
        <p class="fine">Stamp berkurang ${input.brand.stamps_required}. Sisa stamp tetap ikut.</p>
        <p class="fine">${esc(input.brand.reward_note)}</p>
        <form method="post" action="/kasir/redeem/manual">
          <input type="hidden" name="member_id" value="${esc(input.member.id)}" />
          <button class="btn btn-amber">${GIFT} Ya, tukar sekarang</button>
        </form>
        <a class="btn btn-line" href="/kasir/meja">Batal</a>
      </section>
    </main>`,
    input.brand.accent,
  );
}

const NAV: Array<[string, string]> = [
  ["/admin/dasbor", "Dasbor"],
  ["/admin/member", "Member"],
  ["/admin/reward", "Reward"],
  ["/admin/banner", "Banner Promo"],
  ["/admin/aturan", "Setting Program"],
  ["/admin/misi", "Side Quest"],
  ["/admin/katalog", "Hadiah"],
  ["/admin/tingkat", "Tingkat stamp"],
  ["/admin/outlet", "Outlet & PIN"],
  ["/admin/aktivitas", "Aktivitas"],
  ["/admin/stan", "QR Stan"],
];

function adminShell(active: string, body: string, accent = "#5c8f4b"): string {
  const nav = NAV.map(([href, label]) => `<a class="${active === href ? "on" : ""}" href="${href}">${esc(label)}</a>`).join("");
  return doc(
    "Loyalty Bos",
    `<div class="shell" style="${paint(accent, "#e7f3df")}">
      <aside class="side"><div class="brandlock">${LEAF} Loyalty Bos</div><nav>${nav}</nav>
        <form method="post" action="/admin/keluar"><button class="linkbtn" style="color:white">Keluar</button></form>
      </aside>
      <div class="main">${body}</div>
    </div>`,
    accent,
  );
}

export function adminLoginPage(params: URLSearchParams): string {
  return doc(
    "Owner",
    `<main class="phone">
      <header class="hero"><div class="hero-title">Loyalty Bos</div><div class="hero-sub">Masuk owner</div></header>
      ${flashes(params)}
      <form class="card" method="post" action="/admin/masuk">
        <label class="lbl" for="password">Password</label>
        <input id="password" name="password" type="password" required autocomplete="current-password" />
        <button class="btn btn-solid">Masuk</button>
      </form>
    </main>`,
  );
}

export function dashboardPage(input: {
  brands: Brand[];
  brand: Brand | null;
  numbers: DashNumbers;
  days: Array<{ label: string; n: number }>;
  top: TopMember[];
  lapsed: Lapsed[];
  banners: Banner[];
  flags: FlagRow[];
  now: number;
  birthdays: Array<{ name: string; birthday: string }>;
  birthdayRedeems: number;
  pointsIssued: string;
  pointsRedeemed: string;
  pendingMissions: number;
}): string {
  const chips = [`<a class="chip${input.brand ? "" : " on"}" href="/admin/dasbor">Semua</a>`]
    .concat(input.brands.map((b) => `<a class="chip${input.brand?.id === b.id ? " on" : ""}" href="/admin/dasbor?merek=${esc(b.id)}">${esc(b.emoji)} ${esc(b.short_name)}</a>`))
    .join("");
  const max = Math.max(1, ...input.days.map((d) => d.n));
  const bars = input.days
    .map((d) => {
      const h = d.n === 0 ? 3 : Math.max(10, Math.round((d.n / max) * 100));
      return `<div class="barcol" title="${d.n} stamp"><div class="bar" style="height:${h}%"></div><span>${esc(d.label)}</span></div>`;
    })
    .join("");
  const top = input.top
    .map((m) => `<tr><td>${esc(m.name)}</td><td>${m.stamps}</td><td>${m.rewards}</td></tr>`)
    .join("");
  const lapsed = input.lapsed
    .map((m) => {
      const days = Math.max(1, Math.round((input.now - m.last_seen_at) / 86_400_000));
      return `<tr><td>${esc(m.name)}</td><td>${days} hari</td><td>${m.stamps}/${m.stamps_required}</td></tr>`;
    })
    .join("");
  const banner = input.banners[0];
  const program = input.brand;
  const activePct = input.numbers.members ? Math.round((input.numbers.active30 / input.numbers.members) * 100) : 0;
  const flags = input.flags
    .map((f) => `<div class="flag"><b>${esc(f.reason === "ramai" ? "Kasir terlalu ramai" : "Batas harian")}</b> · ${esc(f.outlet_name || "")} ${esc(f.member_name || "")}<div class="small">${esc(f.detail)} · ${esc(feedTime(f.created_at, input.now))}</div></div>`)
    .join("");
  const body = `
    <div class="toprow"><h1>Dashboard</h1><div class="chips">${chips}</div></div>
    <section class="kpis">
      <article class="kpi"><span>Total member</span><b>${formatInt(input.numbers.members)}</b><span>${input.brand ? esc(input.brand.short_name) : "semua merek"}</span></article>
      <article class="kpi"><span>Stamp hari ini</span><b>${input.numbers.stampsToday}</b><span>${input.numbers.outletsToday} outlet</span></article>
      <article class="kpi"><span>Reward ditukar (bulan ini)</span><b>${input.numbers.redeemsMonth}</b><span>${esc(program?.reward_text || "semua merek")}</span></article>
      <article class="kpi"><span>Member aktif 30 hari</span><b>${input.numbers.active30}</b><span>${activePct}% dari total</span></article>
      <article class="kpi"><span>Hadiah ultah bulan ini</span><b>${input.birthdayRedeems}</b><span>yang sudah ditukar</span></article>
      <article class="kpi"><span>Poin masuk bulan ini</span><b>${input.pointsIssued}</b><span>poin disetujui</span></article>
      <article class="kpi"><span>Poin ditukar bulan ini</span><b>${input.pointsRedeemed}</b><span>dari katalog</span></article>
      <article class="kpi"><span>Side Quest menunggu</span><b>${input.pendingMissions}</b><span><a href="/admin/misi">antrian review</a></span></article>
    </section>
    <section class="grid-2">
      <article class="panel"><h2>Stamp per hari (14 hari)</h2><div class="bars">${bars}</div></article>
      <article class="panel"><h2>Member paling loyal</h2>
        <table><thead><tr><th>Nama</th><th>Stamp</th><th>Reward</th></tr></thead><tbody>${top || `<tr><td colspan="3">Belum ada data.</td></tr>`}</tbody></table>
      </article>
    </section>
    <section class="grid-3">
      <article class="panel"><h2>Lama tidak datang (&gt;30 hari)</h2>
        <table><tbody>${lapsed || `<tr><td>Tidak ada.</td></tr>`}</tbody></table>
      </article>
      <article class="panel"><h2>Kelola Banner Promo</h2>
        ${banner ? `<div class="promo"><div class="kicker">PROMO</div><h3>${esc(banner.title)}</h3><p>${esc(banner.subtitle)}</p></div>` : `<p class="fine">Belum ada banner.</p>`}
        <a class="btn btn-line" href="/admin/banner">+ Tambah banner</a>
      </article>
      <article class="panel"><h2>Setting Program${program ? ` · ${esc(program.short_name)}` : ""}</h2>
        ${
          program
            ? `<div class="row"><span>Stamp dibutuhkan</span><b>${program.stamps_required}</b></div>
               <div class="row"><span>Reward</span><b>${esc(program.reward_text)}</b></div>
               <div class="row"><span>Syarat</span><b>${esc(program.condition_label)}</b></div>
               <div class="row"><span>Maks stamp / hari</span><b>${program.max_stamps_per_day}</b></div>`
            : `<p class="fine">Pilih satu merek untuk lihat aturannya.</p>`
        }
        <a class="btn btn-line" href="/admin/aturan">Ubah aturan</a>
      </article>
    </section>
    <section class="panel" style="margin-top:12px"><h2>Ulang tahun bulan ini</h2>
      ${
        input.birthdays.length
          ? input.birthdays
              .map((m) => `<div class="row"><span>${esc(m.name)}</span><b>${esc(m.birthday.slice(8))}/${esc(m.birthday.slice(5, 7))}</b></div>`)
              .join("")
          : `<p class="fine">Tidak ada.</p>`
      }
    </section>
    ${flags ? `<section class="panel" style="margin-top:12px"><h2>Yang perlu dicek</h2>${flags}</section>` : ""}
    <p class="fine" style="margin-top:14px">Angka dihitung dari data tersimpan. Waktu dalam WIB.</p>`;
  return adminShell("/admin/dasbor", body, input.brand?.accent || "#5c8f4b");
}

export function membersPage(
  members: Array<Member & { stamps_label: string; rewards: number }>,
  brands: Brand[],
  params: URLSearchParams,
): string {
  const sort = params.get("urut") || "kunjungan";
  const merek = params.get("merek") || "";
  const q = params.get("q") || "";
  const chips = [`<a class="chip${merek ? "" : " on"}" href="/admin/member?urut=${esc(sort)}">Semua</a>`]
    .concat(
      brands.map(
        (b) =>
          `<a class="chip${merek === b.id ? " on" : ""}" href="/admin/member?merek=${esc(b.id)}&urut=${esc(sort)}">${esc(b.short_name)}</a>`,
      ),
    )
    .join("");
  const sorts: Array<[string, string]> = [
    ["kunjungan", "Terakhir datang"],
    ["nama", "Nama"],
    ["gabung", "Tanggal gabung"],
    ["ulang", "Ulang tahun"],
  ];
  const sortLinks = sorts
    .map(([key, label]) => `<a class="chip${sort === key ? " on" : ""}" href="/admin/member?urut=${key}&merek=${esc(merek)}&q=${encodeURIComponent(q)}">${label}</a>`)
    .join("");
  const rows = members
    .map(
      (m) => `<tr>
        <td><a href="/admin/member/${esc(m.id)}"><b>${esc(m.name)}</b></a><div class="small muted">${esc(m.email || "")}</div></td>
        <td>${esc(prettyWa(m.wa))}</td>
        <td>${esc(m.birthday || "-")}</td>
        <td>${esc(memberSince(m.created_at))}<div class="small muted">${esc(m.join_method)}</div></td>
        <td>${esc(m.stamps_label || "-")}</td>
        <td>${m.rewards}</td>
        <td>${esc(feedTime(m.last_seen_at, Date.now()))}</td>
      </tr>`,
    )
    .join("");
  const query = params.toString();
  return adminShell(
    "/admin/member",
    `<div class="toprow"><h1>Member</h1>
      <div class="actions">
        <a class="btn btn-line" style="width:auto;padding:0 14px" href="/admin/member.csv?${esc(query)}">CSV</a>
        <a class="btn btn-line" style="width:auto;padding:0 14px" href="/admin/member.xlsx?${esc(query)}">Excel</a>
      </div>
    </div>
    ${flashes(params)}
    <div class="chips" style="margin-top:12px">${chips}</div>
    <div class="chips" style="margin-top:8px">${sortLinks}</div>
    <form class="panel" style="margin-top:12px" method="get" action="/admin/member">
      <input type="hidden" name="urut" value="${esc(sort)}" />
      <input type="hidden" name="merek" value="${esc(merek)}" />
      <label class="lbl" for="q">Cari nama, WA, atau email</label>
      <div class="actions"><input id="q" name="q" value="${esc(q)}" /><button class="btn btn-solid">Cari</button></div>
    </form>
    <article class="panel" style="margin-top:12px;overflow:auto"><table>
      <thead><tr><th>Nama</th><th>WA</th><th>Ulang tahun</th><th>Gabung</th><th>Stamp</th><th>Reward</th><th>Terakhir</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7">Tidak ketemu.</td></tr>`}</tbody>
    </table></article>`,
  );
}

export function memberDetailPage(input: {
  member: Member;
  cards: Array<{ short_name: string; stamps: number; lifetime_redeems: number }>;
  params: URLSearchParams;
}): string {
  const cards = input.cards
    .map((c) => `<div class="row"><span>${esc(c.short_name)}</span><b>${c.stamps} stamp · ${c.lifetime_redeems} reward</b></div>`)
    .join("");
  return adminShell(
    "/admin/member",
    `<p><a href="/admin/member">← Semua member</a></p>
     <h1>${esc(input.member.name)}</h1>
     ${flashes(input.params)}
     <article class="panel" style="margin-top:12px">
       <div class="row"><span>WA</span><b>${esc(prettyWa(input.member.wa))}</b></div>
       <div class="row"><span>Email</span><b>${esc(input.member.email || "-")}</b></div>
       <div class="row"><span>Ulang tahun</span><b>${esc(input.member.birthday || "-")}</b></div>
       <div class="row"><span>Gabung</span><b>${esc(memberSince(input.member.created_at))} · ${esc(input.member.join_method)}</b></div>
       <div class="row"><span>Terakhir datang</span><b>${esc(feedTime(input.member.last_seen_at, Date.now()))}</b></div>
       ${cards}
     </article>
     <form class="panel" style="margin-top:12px" method="post" action="/admin/member/${esc(input.member.id)}/telepon">
       <h2>Ganti nomor WA</h2>
       <label class="lbl">Nomor baru</label>
       <input name="wa" required value="${esc(prettyWa(input.member.wa))}" />
       <button class="btn btn-solid">Simpan nomor</button>
     </form>
     <form class="panel" style="margin-top:12px" method="post" action="/admin/member/${esc(input.member.id)}/lahir">
       <h2>Tanggal lahir</h2>
       <p class="fine">Pelanggan tidak bisa mengubah ini sendiri setelah terisi. Owner boleh.</p>
       <input name="lahir" type="date" required value="${esc(input.member.birthday || "")}" />
       <button class="btn btn-solid">Simpan tanggal lahir</button>
     </form>
     <a class="btn btn-gold" href="/admin/member/${esc(input.member.id)}/hapus">Hapus member</a>`,
  );
}

export function deleteMemberPage(member: Member): string {
  return adminShell(
    "/admin/member",
    `<h1>Hapus ${esc(member.name)}?</h1>
     <article class="panel" style="margin-top:12px">
       <p>Stamp, riwayat, dan login ${esc(member.name)} (${esc(prettyWa(member.wa))}) akan hilang. Penghapusan ini dicatat.</p>
       <form method="post" action="/admin/member/${esc(member.id)}/hapus">
         <button class="btn btn-solid" style="background:#a33b36">Ya, hapus</button>
       </form>
       <a class="btn btn-line" href="/admin/member/${esc(member.id)}">Batal</a>
     </article>`,
  );
}

export function profilePage(input: {
  mode: "google" | "link" | "member";
  name: string;
  email: string | null;
  params: URLSearchParams;
  wa?: string;
  birthday?: string | null;
  google?: boolean;
  brand?: Brand | null;
  since?: number;
}): string {
  const link = input.mode === "link";
  const skin = input.mode === "member" && input.brand ? customerSkin(input.brand) : null;
  return doc(
    "Profil",
    `<main class="phone${skin ? ` skin with-tabs${skin.dark ? " skin-dark" : ""}` : ""}"${skin ? ` style="${skin.style}"` : ""}>
      ${skin ? "" : `<header class="hero"><div class="hero-title">${link ? "Nomor ini sudah punya kartu" : "Lengkapi profil"}</div><div class="hero-sub">${esc(input.email || input.name)}</div></header>`}
      ${flashes(input.params)}
      ${
        link
          ? `<form class="card" method="post" action="/profil/hubungkan">
              <p class="fine">Masukkan PIN kartu nomor ini supaya akun Google-nya nyambung. Kalau tidak ingat PIN, masuk lewat nomor WA.</p>
              <input type="hidden" name="wa" value="${esc(input.wa || "")}" />
              <input type="hidden" name="lahir" value="${esc(input.birthday || "")}" />
              <label class="lbl">PIN</label>
              <input name="pin" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="current-password" />
              <button class="btn btn-solid">Hubungkan</button>
            </form>`
          : input.mode === "google"
            ? `<form class="card" method="post" action="/profil">
                <label class="lbl">Nama</label><input name="nama" required value="${esc(input.name)}" />
                <label class="lbl">Tanggal lahir</label><input name="lahir" type="date" required value="${esc(input.birthday || "")}" />
                <p class="fine">Tanggal lahir tidak bisa diubah sendiri setelah disimpan.</p>
                <label class="lbl">Nomor WhatsApp</label><input name="wa" required inputmode="tel" value="${esc(input.wa || "")}" placeholder="0812 3456 4567" />
                <label class="lbl">PIN 4–6 angka</label><input name="pin" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="new-password" />
                <label class="lbl">Ulangi PIN</label><input name="pin2" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="new-password" />
                <p class="fine">PIN ini buat masuk tanpa Google, di HP lain.</p>
                <button class="btn btn-solid">Simpan dan lihat kartu</button>
              </form>`
            : `<section class="hello">
                <div>
                  <div class="eyebrow">Profil</div>
                  <h1 class="display">${esc(input.name.split(" ")[0] || input.name)}</h1>
                  <p class="fine">${esc(input.name)}${input.since ? ` · member sejak ${esc(memberSince(input.since))}` : ""}</p>
                </div>
              </section>
              <form class="card" method="post" action="/profil">
                <p class="fine">${input.wa ? esc(maskWa(input.wa)) : ""}${input.email ? ` · ${esc(input.email)}` : ""}</p>
                ${input.birthday ? `<p><b>Ulang tahun ${esc(input.birthday)}</b> sudah tersimpan.</p>` : `<label class="lbl">Tanggal lahir</label><input name="lahir" type="date" required /><button class="btn btn-solid">Simpan</button>`}
              </form>
              ${input.google ? "" : `<a class="btn btn-google" href="/masuk/google?niat=hubung">Hubungkan Google</a>`}
              <form method="post" action="/keluar"><button class="linkbtn">Keluar</button></form>`
      }
      ${skin && input.brand ? tabbar("profil", input.brand.id) : ""}
    </main>`,
    skin?.accent,
  );
}

export function confirmBirthdayPage(input: { brand: Brand; member: Member; reward: string }): string {
  return doc(
    "Hadiah ulang tahun",
    `<main class="phone" style="${paint(input.brand.accent, input.brand.accent_soft)}">
      <header class="hero"><div class="hero-title">Hadiah ultah untuk ${esc(input.member.name)}?</div><div class="hero-sub">${esc(input.reward)}</div></header>
      <section class="card">
        <p class="fine">Sekali setahun. Stamp tidak berkurang.</p>
        <form method="post" action="/kasir/ulangtahun/manual">
          <input type="hidden" name="member_id" value="${esc(input.member.id)}" />
          <button class="btn btn-amber">Ya, tukar hadiah ultah</button>
        </form>
        <a class="btn btn-line" href="/kasir/meja">Batal</a>
      </section>
    </main>`,
    input.brand.accent,
  );
}

export function rewardsPage(rows: ActivityRow[], brands: Brand[], brandId: string): string {
  const chips = [`<a class="chip${brandId ? "" : " on"}" href="/admin/reward">Semua</a>`]
    .concat(brands.map((b) => `<a class="chip${brandId === b.id ? " on" : ""}" href="/admin/reward?merek=${esc(b.id)}">${esc(b.short_name)}</a>`))
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(feedTime(r.created_at, Date.now()))}</td><td>${esc(r.member_name)}</td><td>${esc(r.short_name)}</td><td>${esc(r.outlet_name || "-")}</td><td>${r.voided ? "dibatalkan" : esc(r.reward_text)}</td><td>${r.stamps_after}</td></tr>`,
    )
    .join("");
  return adminShell(
    "/admin/reward",
    `<div class="toprow"><h1>Reward ditukar</h1><div class="chips">${chips}</div></div>
     <article class="panel" style="margin-top:12px"><table><thead><tr><th>Waktu</th><th>Member</th><th>Merek</th><th>Outlet</th><th>Reward</th><th>Sisa</th></tr></thead><tbody>${body || `<tr><td colspan="6">Belum ada.</td></tr>`}</tbody></table></article>`,
  );
}

export function bannersPage(banners: Banner[], brands: Brand[], params: URLSearchParams): string {
  const options = brands.map((b) => `<option value="${esc(b.id)}">${esc(b.short_name)}</option>`).join("");
  const list = banners
    .map(
      (b) => {
        const img = b.r2_key ? `/media/${b.r2_key}` : b.image_url || "";
        const when = [b.starts_at ? `mulai ${esc(feedTime(b.starts_at, Date.now()))}` : "", b.ends_at ? `sampai ${esc(feedTime(b.ends_at, Date.now()))}` : ""]
          .filter(Boolean)
          .join(" · ");
        return `<form class="banner-row" method="post" action="/admin/banner/${esc(b.id)}/hapus">
        ${img ? `<img src="${esc(img)}" alt="" />` : ""}
        <div><b>${esc(b.title)}</b> · ${esc(b.brand_id)} · urutan ${b.sort_order} · ${b.active ? "aktif" : "mati"}${b.cta ? ` · ${esc(b.cta)}` : ""}
        <div class="small muted">${esc(b.subtitle)}${when ? ` · ${when}` : ""}</div></div>
        <button class="textlink">Hapus</button>
      </form>`;
      },
    )
    .join("");
  return adminShell(
    "/admin/banner",
    `<h1>Banner promo</h1>${flashes(params)}
     <p class="fine">Satu merek boleh punya beberapa foto. Urutan kecil tampil lebih dulu. Tanggal mulai dan selesai mengatur kapan foto itu muncul di carousel.</p>
     <form class="panel" style="margin-top:12px" method="post" action="/admin/banner" enctype="multipart/form-data">
       <label class="lbl">Merek</label><select name="brand_id" required>${options}</select>
       <label class="lbl">Judul di atas foto</label><input name="title" required maxlength="80" />
       <label class="lbl">Subjudul</label><input name="subtitle" maxlength="140" />
       <label class="lbl">Teks tombol (opsional)</label><input name="cta" maxlength="24" placeholder="Lihat menu" />
       <label class="lbl">Tautan tombol (opsional, https)</label><input name="link_url" type="url" placeholder="https://" />
       <label class="lbl">URL gambar (opsional, https)</label><input name="image_url" type="url" placeholder="https://" />
       <label class="lbl">atau upload gambar (maks 2 MB)</label><input name="gambar" type="file" accept="image/*" />
       <label class="lbl">Mulai (WIB, opsional)</label><input name="starts_at" type="datetime-local" />
       <label class="lbl">Selesai (WIB, opsional)</label><input name="ends_at" type="datetime-local" />
       <label class="lbl">Urutan</label><input name="sort_order" type="number" value="1" />
       <label class="checkline"><input type="checkbox" name="active" value="on" checked /> Tampilkan</label>
       <button class="btn btn-solid">Simpan banner</button>
     </form>
     <article class="panel" style="margin-top:12px"><h2>Yang sudah ada</h2>${list || `<p class="fine">Kosong.</p>`}</article>`,
  );
}

export function rulesPage(brands: Brand[], params: URLSearchParams): string {
  const forms = brands
    .map(
      (b) => `<form class="panel" style="margin-top:12px;${paint(b.accent, b.accent_soft)}" method="post" action="/admin/aturan/${esc(b.id)}">
        <h2>${esc(b.emoji)} ${esc(b.name)}</h2>
        <label class="lbl">Nama</label><input name="name" value="${esc(b.name)}" required />
        <label class="lbl">Nama singkat</label><input name="short_name" value="${esc(b.short_name)}" required />
        <label class="lbl">Handle</label><input name="handle" value="${esc(b.handle)}" required />
        <label class="lbl">Emoji</label><input name="emoji" value="${esc(b.emoji)}" maxlength="8" />
        <label class="lbl">Warna</label><input name="accent" type="color" value="${esc(b.accent)}" />
        <label class="lbl">Warna lembut</label><input name="accent_soft" type="color" value="${esc(b.accent_soft)}" />
        <label class="lbl">Stamp untuk reward</label><input name="stamps_required" type="number" min="1" max="30" value="${b.stamps_required}" required />
        <label class="lbl">Teks reward</label><input name="reward_text" value="${esc(b.reward_text)}" required />
        <label class="lbl">Teks centang kasir</label><input name="condition_label" value="${esc(b.condition_label)}" required />
        <label class="lbl">Minimal transaksi (Rp, opsional)</label><input name="min_amount" type="number" min="0" value="${b.min_amount ?? ""}" />
        <label class="lbl">Maks stamp per member per hari</label><input name="max_stamps_per_day" type="number" min="1" max="10" value="${b.max_stamps_per_day}" required />
        <label class="lbl">Catatan reward</label><textarea name="reward_note">${esc(b.reward_note)}</textarea>
        <label class="lbl">Hadiah ulang tahun</label><input name="birthday_reward" value="${esc(b.birthday_reward || "")}" maxlength="80" />
        <label class="lbl">Kapan hadiah ultah berlaku</label>
        <select name="birthday_window">
          <option value="month" ${b.birthday_window === "around" ? "" : "selected"}>Sepanjang bulan ulang tahun</option>
          <option value="around" ${b.birthday_window === "around" ? "selected" : ""}>N hari sebelum dan sesudah</option>
        </select>
        <label class="lbl">N hari (kalau pilih hari di sekitar)</label><input name="birthday_days" type="number" min="0" max="30" value="${b.birthday_days ?? 7}" />
        <label class="checkline"><input type="checkbox" name="birthday_active" value="on" ${b.birthday_active ? "checked" : ""} /> Hadiah ulang tahun aktif</label>
        <label class="checkline"><input type="checkbox" name="active" value="on" ${b.active ? "checked" : ""} /> Merek aktif</label>
        <button class="btn btn-solid">Simpan</button>
      </form>`,
    )
    .join("");
  return adminShell("/admin/aturan", `<h1>Setting program</h1>${flashes(params)}<p class="fine">Teks centang inilah yang dilihat kasir sebelum kasih stamp.</p>${forms}`);
}

export function outletsPage(
  outlets: Array<Outlet & { brand_name: string }>,
  brands: Brand[],
  params: URLSearchParams,
): string {
  const options = brands.map((b) => `<option value="${esc(b.id)}">${esc(b.short_name)}</option>`).join("");
  const list = outlets
    .map(
      (o) => `<article class="panel" style="margin-top:12px">
        <h2>${esc(o.name)}</h2>
        <p class="fine">${esc(o.brand_name)} · ${o.active ? "aktif" : "nonaktif"}</p>
        <form method="post" action="/admin/outlet/${esc(o.id)}/pin">
          <label class="lbl">PIN baru (4–8 angka)</label>
          <div class="actions"><input name="pin" inputmode="numeric" minlength="4" maxlength="8" required /><button class="btn btn-solid">Ganti PIN</button></div>
        </form>
        <form method="post" action="/admin/outlet/${esc(o.id)}/aktif">
          <input type="hidden" name="active" value="${o.active ? "0" : "1"}" />
          <button class="btn btn-line">${o.active ? "Nonaktifkan" : "Aktifkan"}</button>
        </form>
      </article>`,
    )
    .join("");
  return adminShell(
    "/admin/outlet",
    `<h1>Outlet &amp; PIN</h1>${flashes(params)}
     <form class="panel" style="margin-top:12px" method="post" action="/admin/outlet">
       <h2>Tambah outlet</h2>
       <label class="lbl">Merek</label><select name="brand_id" required>${options}</select>
       <label class="lbl">Nama outlet</label><input name="name" required maxlength="60" />
       <label class="lbl">PIN</label><input name="pin" required inputmode="numeric" minlength="4" maxlength="8" />
       <button class="btn btn-solid">Tambah</button>
     </form>
     ${list}`,
  );
}

export function activityPage(input: {
  rows: ActivityRow[];
  brands: Brand[];
  outlets: Outlet[];
  query: string;
  params: URLSearchParams;
}): string {
  const p = input.params;
  const brandOpts = [`<option value="">Semua merek</option>`]
    .concat(input.brands.map((b) => `<option value="${esc(b.id)}"${p.get("merek") === b.id ? " selected" : ""}>${esc(b.short_name)}</option>`))
    .join("");
  const outletOpts = [`<option value="">Semua outlet</option>`]
    .concat(input.outlets.map((o) => `<option value="${esc(o.id)}"${p.get("outlet") === o.id ? " selected" : ""}>${esc(o.name)}</option>`))
    .join("");
  const types = ["", "stamp", "redeem", "birthday", "cancel", "join"]
    .map((t) => `<option value="${t}"${p.get("jenis") === t ? " selected" : ""}>${t || "Semua jenis"}</option>`)
    .join("");
  const body = input.rows
    .map(
      (r) =>
        `<tr><td>${esc(feedTime(r.created_at, Date.now()))}</td><td>${esc(r.member_name)}<div class="small muted">${esc(prettyWa(r.wa))}</div></td><td>${esc(r.short_name)}</td><td>${esc(r.outlet_name || "-")}</td><td>${esc(r.type)}${r.voided ? " (batal)" : ""}</td><td>${r.stamps_delta}</td><td>${esc(r.note)}</td><td class="small muted">${esc(r.session_id || "-")}</td></tr>`,
    )
    .join("");
  return adminShell(
    "/admin/aktivitas",
    `<div class="toprow"><h1>Aktivitas</h1><a class="btn btn-line noprint" style="width:auto;padding:0 16px" href="/admin/aktivitas.csv?${esc(input.query)}">Unduh CSV</a></div>
     <form class="panel" method="get" action="/admin/aktivitas" style="margin-top:12px">
       <div class="grid-3">
         <label>Merek<select name="merek">${brandOpts}</select></label>
         <label>Outlet<select name="outlet">${outletOpts}</select></label>
         <label>Jenis<select name="jenis">${types}</select></label>
       </div>
       <label class="lbl">Cari nama / nomor</label><input name="q" value="${esc(p.get("q") || "")}" />
       <div class="actions" style="margin-top:10px">
         <input type="date" name="dari" value="${esc(p.get("dari") || "")}" />
         <input type="date" name="sampai" value="${esc(p.get("sampai") || "")}" />
         <button class="btn btn-solid">Filter</button>
       </div>
     </form>
     <article class="panel" style="margin-top:12px;overflow:auto"><table><thead><tr><th>Waktu</th><th>Member</th><th>Merek</th><th>Outlet</th><th>Jenis</th><th>Delta</th><th>Catatan</th><th>Sesi kasir</th></tr></thead><tbody>${body || `<tr><td colspan="8">Kosong.</td></tr>`}</tbody></table></article>`,
  );
}

export function stanPage(brands: Brand[], origin: string, svgs: Record<string, string>): string {
  const cards = brands
    .map(
      (b) => `<article class="stan" style="${paint(b.accent, b.accent_soft)}">
        <h2>${esc(b.emoji)} ${esc(b.name)}</h2>
        <p class="fine">Scan untuk gabung kartu stamp</p>
        <div class="qrbox">${svgs[b.id] || ""}</div>
        <p class="small">${esc(`${origin}/gabung/${b.id}`)}</p>
      </article>`,
    )
    .join("");
  return adminShell(
    "/admin/stan",
    `<div class="toprow"><h1>QR stan meja</h1><button class="btn btn-line noprint" style="width:auto;padding:0 16px" type="button" data-print>Cetak</button></div>
     <p class="fine noprint">Cetak, tempel di kasir. Customer scan pakai kamera HP.</p>
     <div class="grid-3">${cards}</div>`,
  );
}

export function emptyDbPage(): string {
  return messagePage("Database masih kosong", "Jalankan npm run setup di komputer, lalu buka lagi.", "/health", "Cek server");
}

export function missionsPage(input: {
  points: string;
  streak: number;
  levelName: string;
  levelIcon: string;
  levelPct: number;
  levelHint: string;
  celebrate: boolean;
  brand: Brand | null;
  missions: Array<{
    id: string;
    title: string;
    description: string;
    points: string;
    limit: string;
    needShot: boolean;
    needLink: boolean;
    open: boolean;
    brand: string;
    icon: string;
    tag: string;
    locked: boolean;
    tease: string;
    unlock: string;
    pct: number;
    done: boolean;
    statusLabel: string;
  }>;
  params: URLSearchParams;
}): string {
  const cards = input.missions
    .map((m) => {
      if (m.locked) {
        return `<section class="quest locked">
          <div class="qtop">
            <div class="qico mystery" aria-hidden="true">?</div>
            <div><div class="qtitle">Quest rahasia</div><p class="fine">${esc(m.tease || "Ada quest yang belum terbuka.")}</p></div>
          </div>
          <div class="lockline">Terbuka setelah ${esc(m.unlock)} Poin quest terkumpul</div>
        </section>`;
      }
      const tag = m.tag === "new" ? `<span class="tag tag-new">NEW</span>` : m.tag === "limited" ? `<span class="tag tag-lim">Limited</span>` : "";
      const form = m.open
        ? `<form method="post" action="/misi/${esc(m.id)}" enctype="multipart/form-data">
            ${m.needLink ? `<label class="lbl">Tautan</label><input name="link" type="url" placeholder="https://" required />` : ""}
            ${m.needShot ? `<label class="lbl">Tangkapan layar</label><input name="gambar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required />` : ""}
            <button class="btn btn-solid">Kirim bukti</button>
          </form>`
        : "";
      return `<section class="quest${m.done ? " done" : ""}">
        <div class="qtop">
          <div class="qico" aria-hidden="true">${esc(m.icon || "🍃")}</div>
          <div class="qbody">
            <div class="qtitle">${esc(m.title)}${tag}</div>
            <p class="fine">${esc(m.description)}</p>
          </div>
          ${m.done ? `<span class="qcheck" aria-label="Selesai">${CHECK}</span>` : ""}
        </div>
        <div class="qfoot">
          <span class="poinbadge sm"><span class="coin" aria-hidden="true">🍃</span><b>${esc(m.points)}</b></span>
          <span class="fine">${esc(m.brand)} · ${esc(m.limit)}</span>
        </div>
        <div class="qbar" role="progressbar" aria-valuenow="${m.pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${m.pct}%"></span></div>
        <p class="fine">${esc(m.statusLabel)}</p>
        ${form}
      </section>`;
    })
    .join("");
  const streak = input.streak >= 2 ? `<span class="streak">🔥 ${input.streak} minggu</span>` : "";
  const skin = customerSkin(input.brand);
  return doc(
    "Side Quest",
    `${input.celebrate ? confetti() : ""}<main class="phone skin with-tabs${skin.dark ? " skin-dark" : ""}" style="${skin.style}">
      <header class="hero">
        <div class="hero-kicker">SIDE QUEST</div>
        <div class="hero-title">Kumpulin Poin</div>
        <div class="hero-row">${coin(input.points)}${streak}</div>
        <div class="level">
          <div class="qico" aria-hidden="true">${esc(input.levelIcon || "🌱")}</div>
          <div>
            <b>${esc(input.levelName)}</b>
            <div class="qbar light"><span style="width:${Math.max(0, Math.min(100, input.levelPct))}%"></span></div>
            <p class="hero-fine">${esc(input.levelHint)}</p>
          </div>
        </div>
      </header>
      ${flashes(input.params)}
      ${cards || `<section class="card"><p>Belum ada side quest.</p></section>`}
      ${tabbar("quest", input.brand?.id || "")}
    </main>`,
    skin.accent,
  );
}

export function catalogPage(input: {
  points: string;
  brandName: string;
  brand: Brand;
  brands: Array<{ id: string; name: string; on: boolean }>;
  rewards: Array<{ id: string; title: string; cost: string; note: string; ready: boolean; icon: string; soldOut: boolean }>;
  params: URLSearchParams;
}): string {
  const chips = input.brands.map((b) => `<a class="pill${b.on ? " on" : ""}" href="/hadiah?merek=${esc(b.id)}">${esc(b.name)}</a>`).join("");
  const cards = input.rewards
    .map((r) => {
      const action = r.ready
        ? `<form method="post" action="/hadiah/${esc(r.id)}/tukar"><button class="btn btn-solid">Tukar</button></form>`
        : `<button class="btn btn-line" type="button" disabled>${r.soldOut ? "Habis" : "Belum cukup"}</button>`;
      return `<article class="goods${r.ready ? "" : " dim"}">
        <div class="face" aria-hidden="true">${esc(r.icon || "🍵")}</div>
        <h2>${esc(r.title)}</h2>
        <span class="poinbadge sm"><span class="coin" aria-hidden="true">🍃</span><b>${esc(r.cost)}</b></span>
        ${r.note ? `<p class="fine">${esc(r.note)}</p>` : ""}
        ${action}
      </article>`;
    })
    .join("");
  const skin = customerSkin(input.brand);
  return doc(
    "Hadiah",
    `<main class="phone skin with-tabs${skin.dark ? " skin-dark" : ""}" style="${skin.style}">
      <header class="hero">
        <div class="hero-kicker">HADIAH</div>
        <div class="hero-title">Toko hadiah</div>
        <div class="hero-sub">${esc(input.brandName)}</div>
        <div class="hero-row">${coin(input.points)}</div>
      </header>
      <div class="pills">${chips}</div>
      ${flashes(input.params)}
      <div class="shop">${cards || `<section class="card"><p>Toko merek ini masih kosong.</p></section>`}</div>
      ${tabbar("hadiah", input.brand.id)}
    </main>`,
    skin.accent,
  );
}

export function codePage(input: { code: string; label: string; brand: string; svg: string; remainingMs: number; status: string; claimUrl: string }): string {
  const live = input.status === "pending";
  return doc(
    "Kode tukar",
    `<main class="phone">
      <header class="hero center">
        <div class="hero-big">${esc(input.code)}</div>
        <div class="hero-fine">${esc(input.label)} · ${esc(input.brand)}</div>
      </header>
      ${
        live
          ? `<section class="card center" data-poll="/kode/${esc(input.claimUrl)}/status" data-remaining="${Math.max(0, input.remainingMs)}" data-ttl="600000">
              <p class="fine">Kasih kode ini ke kasir, atau minta mereka scan QR. Berlaku sekitar 10 menit.</p>
              <div class="qrbox">${input.svg}</div>
              <div class="countpill">Berlaku <span data-count>10:00</span></div>
              <div class="track"><span data-bar></span></div>
              <p class="fine" data-wait>Menunggu kasir...</p>
            </section>`
          : input.status === "confirmed"
            ? `${confetti()}<section class="card center"><div class="qcheck burst">${CHECK}</div><h2>Hadiah sudah di tangan</h2><p class="fine">${esc(input.label)}</p><a class="btn btn-solid" href="/kartu">Ke kartu</a></section>`
            : `<section class="card center"><h2>Kode hangus, poin atau stamp kembali</h2><a class="btn btn-solid" href="/kartu">Ke kartu</a></section>`
      }
    </main>`,
  );
}

export function cashierCodePage(input: { brand: string; code: string; params: URLSearchParams }): string {
  return doc(
    "Kode kasir",
    `<main class="phone">
      <header class="hero"><div class="hero-title">Masukkan kode</div><div class="hero-sub">${esc(input.brand)}</div></header>
      ${flashes(input.params)}
      <form class="card" method="post" action="/kasir/kode">
        <label class="lbl" for="kode">5 angka</label>
        <input id="kode" name="kode" inputmode="numeric" minlength="5" maxlength="5" pattern="\\d{5}" required value="${esc(input.code)}" />
        <button class="btn btn-solid">Konfirmasi</button>
      </form>
      <a class="btn btn-line" href="/kasir/meja">Kembali</a>
    </main>`,
  );
}

export function adminMissionsPage(input: {
  missions: Array<{ id: string; title: string; points: string; limit: string; active: boolean; brand: string; icon: string; tag: string; mystery: boolean; unlock: string; sort: number }>;
  queue: Array<{ id: string; title: string; member: string; when: string; link: string; image: string }>;
  brands: Array<{ id: string; name: string }>;
  levels: Array<{ name: string; min: string; icon: string; brand: string }>;
  params: URLSearchParams;
}): string {
  const queue = input.queue
    .map(
      (q) => `<article class="panel" style="margin-top:10px">
        <b>${esc(q.member)}</b> · ${esc(q.title)} · ${esc(q.when)}
        ${q.link ? `<div><a href="${esc(q.link)}">${esc(q.link)}</a></div>` : ""}
        ${q.image ? `<div><a href="${esc(q.image)}">Lihat gambar</a></div>` : ""}
        <form method="post" action="/admin/misi/${esc(q.id)}/setuju"><button class="btn btn-solid">Setujui</button></form>
        <form method="post" action="/admin/misi/${esc(q.id)}/tolak"><button class="btn btn-gold">Tolak</button></form>
      </article>`,
    )
    .join("");
  const list = input.missions
    .map(
      (m) => `<div class="row"><span>${esc(m.icon)} ${esc(m.title)} · ${esc(m.points)} · ${esc(m.limit)} · ${esc(m.brand)}${m.tag ? ` · ${esc(m.tag)}` : ""}${m.mystery ? ` · rahasia sampai ${esc(m.unlock)}` : ""} · urut ${m.sort}</span><b>${m.active ? "aktif" : "mati"}</b></div>`,
    )
    .join("");
  const options = [`<option value="">Semua merek</option>`].concat(input.brands.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`)).join("");
  const badges = input.levels
    .map((level) => `<div class="row"><span>${esc(level.icon)} ${esc(level.name)} · ${esc(level.brand)}</span><b>${esc(level.min)} poin</b></div>`)
    .join("");
  return adminShell(
    "/admin/misi",
    `<h1>Side Quest</h1>${flashes(input.params)}
     <h2 style="margin-top:16px">Antrian review</h2>
     ${queue || `<p class="fine">Tidak ada yang menunggu.</p>`}
     <form class="panel" style="margin-top:16px" method="post" action="/admin/misi">
       <h2>Quest baru</h2>
       <label class="lbl">Judul</label><input name="title" required maxlength="80" />
       <label class="lbl">Deskripsi</label><textarea name="description"></textarea>
       <label class="lbl">Poin (boleh 0.5)</label><input name="points" required placeholder="0.5" />
       <label class="lbl">Ikon</label><input name="icon" maxlength="8" placeholder="🍃" />
       <label class="lbl">Tag</label><select name="tag"><option value="">Biasa</option><option value="new">NEW</option><option value="limited">Limited</option></select>
       <label class="lbl">Urutan</label><input name="sort" type="number" min="0" max="999" value="0" />
       <label class="lbl">Merek</label><select name="brand_id">${options}</select>
       <label class="lbl">Batas</label><select name="limit_kind"><option value="once">Sekali selamanya</option><option value="week">Sekali seminggu</option></select>
       <label class="checkline"><input type="checkbox" name="shot" value="on" /> Wajib tangkapan layar</label>
       <label class="checkline"><input type="checkbox" name="link" value="on" /> Wajib tautan</label>
       <label class="checkline"><input type="checkbox" name="mystery" value="on" /> Quest rahasia, judul disembunyikan</label>
       <label class="lbl">Teks godaan saat terkunci</label><input name="tease" maxlength="140" placeholder="Selesaikan side quest dulu" />
       <label class="lbl">Terbuka setelah poin quest (0 = langsung)</label><input name="unlock" placeholder="0" />
       <button class="btn btn-solid">Simpan quest</button>
     </form>
     <article class="panel" style="margin-top:12px"><h2>Daftar quest</h2>${list}</article>
     <form class="panel" style="margin-top:16px" method="post" action="/admin/misi/level">
       <h2>Lencana level</h2>
       <p class="fine">Diukur dari poin quest yang pernah didapat, bukan saldo yang tersisa. Menukar hadiah tidak menurunkan level.</p>
       <label class="lbl">Nama</label><input name="name" required maxlength="40" placeholder="Matcha Master" />
       <label class="lbl">Mulai dari poin</label><input name="points" required placeholder="5" />
       <label class="lbl">Ikon</label><input name="icon" maxlength="8" placeholder="👑" />
       <label class="lbl">Merek (kosong = semua)</label><select name="brand_id">${options}</select>
       <button class="btn btn-solid">Simpan lencana</button>
     </form>
     <article class="panel" style="margin-top:12px"><h2>Lencana</h2>${badges || `<p>Belum ada lencana.</p>`}</article>`,
  );
}

export function adminCatalogPage(input: {
  rewards: Array<{ id: string; brand: string; title: string; cost: string; stock: string; active: boolean; icon: string }>;
  brands: Array<{ id: string; name: string }>;
  params: URLSearchParams;
}): string {
  const options = input.brands.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("");
  const rows = input.rewards
    .map((r) => `<div class="row"><span>${esc(r.icon)} ${esc(r.brand)} · ${esc(r.title)} · ${esc(r.cost)} poin · ${esc(r.stock)}</span><b>${r.active ? "aktif" : "mati"}</b></div>`)
    .join("");
  return adminShell(
    "/admin/katalog",
    `<h1>Hadiah</h1>${flashes(input.params)}
     <form class="panel" style="margin-top:12px" method="post" action="/admin/katalog">
       <label class="lbl">Merek</label><select name="brand_id" required>${options}</select>
       <label class="lbl">Nama hadiah</label><input name="title" required maxlength="60" />
       <label class="lbl">Ikon</label><input name="icon" maxlength="8" placeholder="🍵" />
       <label class="lbl">Harga poin</label><input name="points" required placeholder="2.5" />
       <label class="lbl">Stok (kosong = tidak terbatas)</label><input name="stock" type="number" min="0" />
       <label class="checkline"><input type="checkbox" name="active" value="on" checked /> Aktif</label>
       <button class="btn btn-solid">Tambah</button>
     </form>
     <article class="panel" style="margin-top:12px">${rows || `<p>Kosong.</p>`}</article>`,
  );
}

export function adminTiersPage(input: {
  tiers: Array<{ brand: string; stamps: number; reward: string }>;
  brands: Array<{ id: string; name: string }>;
  params: URLSearchParams;
}): string {
  const options = input.brands.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("");
  const rows = input.tiers.map((t) => `<div class="row"><span>${esc(t.brand)}</span><b>${t.stamps} stamp = ${esc(t.reward)}</b></div>`).join("");
  return adminShell(
    "/admin/tingkat",
    `<h1>Tingkat stamp</h1>${flashes(input.params)}
     <p class="fine">Pelanggan boleh menukar tingkat yang lebih rendah sekarang, atau lanjut kumpulin.</p>
     <form class="panel" style="margin-top:12px" method="post" action="/admin/tingkat">
       <label class="lbl">Merek</label><select name="brand_id">${options}</select>
       <label class="lbl">Jumlah stamp</label><input name="stamps" type="number" min="1" max="50" required />
       <label class="lbl">Hadiah</label><input name="reward_text" required maxlength="80" />
       <button class="btn btn-solid">Tambah tingkat</button>
     </form>
     <article class="panel" style="margin-top:12px">${rows}</article>`,
  );
}
