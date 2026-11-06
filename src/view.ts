import { esc, formatInt, maskName, maskWa, prettyWa } from "./format";
import { RESERVASI_LABEL, hiddenOrderPlatform, orderLabel, type OrderLink } from "./orders";
import { ID_MONTHS, birthdayParts, birthdayYears, formatBirthdayId, type BirthdayNotice } from "./birthday";
import { progressCopy } from "./loyalty";
import { missionQuarters } from "./quest-stamp";
import { errText, okText } from "./messages";
import { bannerLive } from "./repo";
import { clock, feedTime, memberSince, toWibDateInput } from "./time";
import type { DashNumbers, Lapsed, TopMember } from "./repo";
import { brandArt, defaultStampIcon, nextRewardLine, pickHeroBanners, resolveStampIcon, stampFill, stampIconSrc } from "./brand-visual";
import type { ActivityRow, Banner, Brand, Card, FlagRow, Member, NewsCard, Outlet } from "./types";

const CUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8h8v5a4 4 0 0 1-8 0V8z"/><path d="M15 9.5h1.8a2.2 2.2 0 0 1 0 4.4H15"/><path d="M8 20h6"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 9.2 17 19 7"/></svg>`;
const GIFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="11" width="16" height="8" rx="1.4"/><path d="M12 11v8M4.5 14.5h15"/><path d="M12 11c-1.8-3.4-5-3.2-5-.8 0 1.6 2.2.8 5 .8 2.8 0 5 .8 5-.8 0-2.4-3.2-2.6-5 .8z"/></svg>`;
const LEAF = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 19C14 19 19 12 19 5 12 5 5 8 5 19z"/><path d="M8 16c2-2 4-5 6-8"/></svg>`;
function stampMark(brand: Brand): string {
  const kind = resolveStampIcon(brand);
  if (kind === "custom") return `<img class="stampimg" src="/media/stamp/${esc(brand.id)}" alt="" />`;
  return `<img class="stampimg" src="${stampIconSrc(kind)}" alt="" />`;
}

function logoSlot(brand: Brand, opts?: { decorative?: boolean; extra?: string; attrs?: string }): string {
  const art = brandArt(brand);
  const extra = opts?.extra ? ` ${opts.extra}` : "";
  const alt = opts?.decorative ? "" : brand.short_name;
  return `<span class="logo-chip brand-${esc(brand.id)}${extra}" style="--chip:${esc(art.chip)}"${opts?.attrs || ""}><img src="${esc(art.mark)}" alt="${esc(alt)}" /></span>`;
}

function birthdayFields(value: string | null | undefined): string {
  const parts = birthdayParts(value);
  const years = birthdayYears(Date.now(), parts?.year);
  const dayOpts = [`<option value="">–</option>`]
    .concat(
      Array.from({ length: 31 }, (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        return `<option value="${day}"${parts?.day === day ? " selected" : ""}>${index + 1}</option>`;
      }),
    )
    .join("");
  const monthOpts = [`<option value="">–</option>`]
    .concat(
      ID_MONTHS.map((name, index) => {
        const month = String(index + 1).padStart(2, "0");
        return `<option value="${month}"${parts?.month === month ? " selected" : ""}>${name}</option>`;
      }),
    )
    .join("");
  const yearOpts = [`<option value="">–</option>`]
    .concat(years.map((year) => `<option value="${year}"${parts?.year === String(year) ? " selected" : ""}>${year}</option>`))
    .join("");
  return `<div class="bdate">
    <div class="lbl">Tanggal lahir</div>
    <div class="bdate-row">
      <label><span>Tanggal</span><select name="lahir_tgl" required>${dayOpts}</select></label>
      <label><span>Bulan</span><select name="lahir_bln" required>${monthOpts}</select></label>
      <label><span>Tahun</span><select name="lahir_thn" required>${yearOpts}</select></label>
    </div>
  </div>`;
}

function confetti(): string {
  return `<canvas class="confetti" data-confetti aria-hidden="true"></canvas>`;
}

function doc(title: string, inner: string, theme = "#6ea564", brandId = ""): string {
  const manifest = brandId ? `/app.webmanifest?merek=${encodeURIComponent(brandId)}` : "/app.webmanifest";
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="${esc(theme)}" />
<meta name="robots" content="noindex, nofollow" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Loyalty Bos" />
<title>${esc(title)}</title>
<link rel="manifest" href="${manifest}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<link rel="stylesheet" href="/app.css?v=15" />
<script src="/brand.js?v=13"></script>
</head>
<body>
${inner}
<script src="/app.js?v=15" defer></script>
</body>
</html>`;
}

function installPrompt(): string {
  return `<aside class="install" data-install hidden>
    <p><b>Simpan ke home screen biar gampang</b></p>
    <p class="fine" data-ios hidden>Di iPhone: tap tombol Share, lalu Add to Home Screen.</p>
    <div class="actions"><button type="button" class="btn btn-solid" data-install-go>Simpan</button><button type="button" class="btn btn-line" data-install-no>Nanti</button></div>
  </aside>`;
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
const ICO_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="3.1"/><path d="M5.6 19.2c1.3-2.7 3.5-3.9 6.4-3.9s5.1 1.2 6.4 3.9"/></svg>`;

type Skin = {
  page: string;
  ink: string;
  muted: string;
  accent: string;
  soft: string;
  deep: string;
  cta: string;
  glass: string;
  line: string;
  heroA: string;
  heroB: string;
  dark: boolean;
  onInk: string;
};

const SKINS: Record<string, Skin> = {
  loft25: {
    page: "#f4efe4",
    ink: "#1f3d2b",
    muted: "#7a7a6a",
    accent: "#143d28",
    soft: "#cfe3b8",
    deep: "#143d28",
    cta: "#143d28",
    glass: "#fffdf8",
    line: "rgba(255,255,255,.72)",
    heroA: "#1c5a3c",
    heroB: "#0c2418",
    dark: false,
    onInk: "#ffffff",
  },
  "soto-oseng": {
    page: "#f7f3ee",
    ink: "#1F3A8A",
    muted: "#7a7a8a",
    accent: "#1F3A8A",
    soft: "#d6e4f5",
    deep: "#D7262E",
    cta: "#D7262E",
    glass: "#ffffff",
    line: "rgba(255,255,255,.72)",
    heroA: "#1F3A8A",
    heroB: "#16324a",
    dark: false,
    onInk: "#ffffff",
  },
  krispyporkk: {
    page: "#1a1a1a",
    ink: "#ffffff",
    muted: "#bbbbbb",
    accent: "#F27BA6",
    soft: "#ffd0e4",
    deep: "#F27BA6",
    cta: "#F27BA6",
    glass: "#111111",
    line: "rgba(255,255,255,.14)",
    heroA: "#111111",
    heroB: "#000000",
    dark: true,
    onInk: "#111111",
  },
};

export function customerSkin(brand: Brand | null): { style: string; dark: boolean; accent: string } {
  const base =
    (brand && SKINS[brand.id]) ||
    ({
      page: "#f3eee4",
      ink: "#17241c",
      muted: "#6d675d",
      accent: brand?.accent || "#143d28",
      soft: brand?.accent_soft || "#e4f0dc",
      deep: brand?.accent || "#143d28",
      cta: brand?.accent || "#143d28",
      glass: "#fffdf8",
      line: "rgba(255,255,255,.7)",
      heroA: brand?.accent || "#143d28",
      heroB: "#102018",
      dark: false,
      onInk: "#ffffff",
    } satisfies Skin);
  const accent = brand?.accent || base.accent;
  const soft = brand?.accent_soft || base.soft;
  const page = brand?.page_bg || base.page;
  const cta = brand?.cta || base.cta;
  const onInk = base.onInk;
  const divider = base.dark ? "rgba(255,255,255,.12)" : "#efe4d4";
  const style = `--page:${page};--ink:${base.ink};--muted:${base.muted};--accent:${accent};--accent-soft:${soft};--deep:${cta};--cta:${cta};--on-ink:${onInk};--glass:${base.glass};--glass-line:${base.line};--card:${base.glass};--line:${divider};--hero-a:${base.heroA};--hero-b:${base.heroB};background:var(--page);color:var(--ink)`;
  return { style, dark: base.dark, accent };
}

function orderBlock(
  links: OrderLink[],
  outlets: Array<{ id: string; name: string; on: boolean }>,
  brandId: string,
  booking: { id: string; name: string; url: string } | null,
  pickBooking: boolean,
): string {
  const extras = links.filter((link) => !hiddenOrderPlatform(link.platform) && link.platform !== "wa" && link.platform !== "booking");
  if (!extras.length && !booking && !pickBooking) return "";
  const badge = (link: OrderLink) =>
    `<a class="obadge extra" href="${esc(link.url)}">${esc(orderLabel(link.platform, link.label))}</a>`;
  const chips = outlets.length
    ? `<div class="pills">${[`<a class="pill${!outlets.some((o) => o.on) ? " on" : ""}" href="/kartu?merek=${esc(brandId)}">Semua outlet</a>`]
        .concat(outlets.map((o) => `<a class="pill${o.on ? " on" : ""}" href="/kartu?merek=${esc(brandId)}&outlet=${esc(o.id)}">${esc(o.name)}</a>`))
        .join("")}</div>`
    : "";
  const book = booking
    ? `<a class="obadge booking" href="${esc(booking.url)}" data-track="/pesan/outlet/${esc(booking.id)}">${RESERVASI_LABEL}</a>`
    : pickBooking
      ? `<p class="fine">Pilih outlet dulu buat ${RESERVASI_LABEL}.</p>`
      : "";
  return `<section class="card order">
    <div class="eyebrow">${RESERVASI_LABEL}</div>
    ${chips}
    ${book}
    ${extras.length ? `<div class="order-extra">${extras.map(badge).join("")}</div>` : ""}
  </section>`;
}

const BONUS_STAR = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.2 14.5 8.6l5.9.6-4.4 3.9 1.3 5.7L12 16.2 6.7 18.8l1.3-5.7L3.6 9.2l5.9-.6z"/></svg>`;
const BONUS_AT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M16 12v1.4a2.6 2.6 0 0 0 5.2 0V12a9.2 9.2 0 1 0-3.6 7.3"/></svg>`;
const BONUS_CAM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 7.2 9.2 5h5.6L16 7.2h3.2v11.2H4.8V7.2z"/><circle cx="12" cy="12.4" r="3.1"/></svg>`;

function bonusIcon(kind: string): string {
  if (kind === "google") return BONUS_STAR;
  if (kind === "threads") return BONUS_AT;
  if (kind === "story") return BONUS_CAM;
  return BONUS_STAR;
}

function bonusReason(code: string): string {
  if (code === "namafoto") return "Nama belum mirip";
  if (code === "struk") return "Struk belum keliatan";
  if (code === "produk") return "Produk belum keliatan";
  if (code === "tag") return "Tag IG belum keliatan";
  if (code === "ditolak") return "Ditolak";
  return code;
}

function bonusStamp(
  missions: Array<{ id: string; title: string; blurb: string; kind: string; status: string; reason: string }>,
  brandId: string,
): string {
  if (!missions.length) return "";
  const open = missions.filter((mission) => mission.status !== "done");
  const done = missions.filter((mission) => mission.status === "done");
  const row = (mission: { id: string; title: string; blurb: string; kind: string; status: string; reason: string }, finished = false) => {
    const status =
      finished || mission.status === "done"
        ? `<span class="bonus-status ok">Beres ${CHECK}</span>`
        : mission.status === "wait"
          ? `<span class="bonus-status">Menunggu dicek</span>`
          : mission.status === "no"
            ? `<span class="bonus-status no">Ditolak${mission.reason ? ` · ${esc(bonusReason(mission.reason))}` : ""}</span>`
            : mission.status === "locked"
              ? `<span class="bonus-status">Belum kebuka</span>`
              : `<span class="bonus-status">Belum</span>`;
    const cta =
      finished || mission.status === "done" || mission.status === "wait" || mission.status === "locked"
        ? ""
        : `<a class="bonus-go" href="/misi/${esc(mission.id)}?merek=${esc(brandId)}">Kerjain</a>`;
    return `<div class="bonus-item">
      <span class="bonus-ico">${bonusIcon(mission.kind)}</span>
      <div class="bonus-copy">
        <b>${esc(mission.title)}</b>
        <p>${esc(mission.blurb)}</p>
        ${status}
      </div>
      <div class="bonus-side"><span class="stamp-pill">+1 stamp</span>${cta}</div>
    </div>`;
  };
  const finished = done.length
    ? `<details class="bonus-done"><summary>Udah beres · ${done.length}</summary>${done.map((mission) => row(mission, true)).join("")}</details>`
    : "";
  return `<section class="card" id="bonus-stamp">
    <h2>Bonus Stamp</h2>
    <p class="fine">Kerjain misi, dapet stamp tambahan</p>
    <div class="bonus-list">${open.map((mission) => row(mission)).join("")}</div>
    ${finished}
  </section>`;
}

function flipDigits(n: number): string {
  return String(Math.max(0, Math.min(99, n)))
    .padStart(2, "0")
    .split("")
    .map((d) => `<span class="d">${d}</span>`)
    .join("");
}

function birthdayBlock(notice: BirthdayNotice, reward: string, brandId: string, now: number): string {
  if (!notice.show) return "";
  if (notice.phase === "open") {
    return `<section class="bday"><div class="kicker">Klaim hadiah ultah</div><h3>${esc(reward)}</h3><form method="post" action="/tukar/ultah"><input type="hidden" name="merek" value="${esc(brandId)}" /><button class="btn btn-solid">Klaim hadiah ultah</button></form></section>`;
  }
  const left = Math.max(0, notice.target - now);
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  const note = notice.phase === "claimed" ? `<p class="bday-note">Udah diklaim, sampai tahun depan</p>` : "";
  return `<section class="bday" data-bday="${notice.target}"><div class="kicker">Hadiah ultah dalam…</div>${note}<div class="flip"><div class="u"><div data-dd>${flipDigits(days)}</div><small>HARI</small></div><div class="u"><div data-hh>${flipDigits(hours)}</div><small>JAM</small></div><div class="u"><div data-mm>${flipDigits(minutes)}</div><small>MENIT</small></div><div class="u"><div data-ss>${flipDigits(seconds)}</div><small>DETIK</small></div></div></section>`;
}

function tabbar(on: "kartu" | "hadiah" | "profil", brandId: string): string {
  const q = brandId ? `?merek=${esc(brandId)}` : "";
  const links: Array<{ id: "kartu" | "hadiah" | "profil"; href: string; label: string; icon: string }> = [
    { id: "kartu", href: `/kartu${q}`, label: "Kartu", icon: ICO_CARD },
    { id: "hadiah", href: `/hadiah${q}`, label: "News &<br>Redeem", icon: GIFT },
    { id: "profil", href: `/profil${q}`, label: "Profil", icon: ICO_USER },
  ];
  return `<nav class="tabbar" aria-label="Menu">${links
    .map((link) => `<a class="${on === link.id ? "on" : ""}" href="${link.href}">${link.icon}<span>${link.label}</span></a>`)
    .join("")}</nav>`;
}

function carousel(banners: Banner[], now: number, delayMs = 3000, nonHalal = false, eager = true): string {
  const live = pickHeroBanners(banners.filter((banner) => bannerLive(banner, now)));
  const slides = live.map((banner, index) => {
    const img = banner.r2_key ? `/media/${banner.r2_key}` : banner.image_url || "";
    const badge = nonHalal ? `<span class="nonhalal">Non-halal</span>` : "";
    const copy = `<div class="slide-copy">${banner.title ? `<h3>${esc(banner.title)}</h3>` : ""}${banner.subtitle ? `<p>${esc(banner.subtitle)}</p>` : ""}${badge}</div>`;
    const media = img
      ? eager && index === 0
        ? `<img src="${esc(img)}" alt="${esc(banner.title)}" fetchpriority="high" decoding="async" loading="eager" width="860" height="430" sizes="100vw" />`
        : `<img data-src="${esc(img)}" alt="${esc(banner.title)}" decoding="async" loading="lazy" width="860" height="430" sizes="100vw" />`
      : `<div class="slide-fallback"></div>`;
    const inner = `${media}${copy}`;
    return banner.link_url ? `<a class="slide" href="${esc(banner.link_url)}">${inner}</a>` : `<div class="slide">${inner}</div>`;
  });
  if (!slides.length) return "";
  const dots =
    slides.length > 1
      ? `<div class="reel-dots">${slides.map((_, i) => `<button type="button" class="dot${i === 0 ? " on" : ""}" data-dot="${i}" aria-label="Foto ${i + 1}"></button>`).join("")}</div>`
      : "";
  const ms = Math.min(20000, Math.max(1500, delayMs || 3000));
  return `<section class="reel" data-reel data-ms="${ms}" aria-roledescription="carousel">${dots}<div class="reel-track">${slides.join("")}</div></section>`;
}

export function stampGrid(
  filled: number,
  total: number,
  mark = `<img class="stampimg" src="${stampIconSrc("whisk")}" alt="" />`,
  gifts: Array<{ stamps: number; icon: string }> = [],
  brandId = "",
  celebrate = false,
): string {
  const n = Math.max(1, Math.min(total, 20));
  const on = Math.min(Math.max(filled, 0), n);
  const giftAt = new Map(gifts.map((gift) => [gift.stamps, gift.icon || "🎁"]));
  let html = `<div class="stamps" data-brand="${esc(brandId)}" style="--stamp-fill:${esc(stampFill(brandId))}" aria-label="${on} dari ${n} stamp">`;
  for (let i = 1; i <= n; i++) {
    if (i <= on) html += `<div class="stamp on${celebrate && i === on ? " tepok" : ""}">${mark}</div>`;
    else if (giftAt.has(i)) html += `<div class="stamp gift" title="${esc(giftAt.get(i) || "")}">${esc(giftAt.get(i) || "🎁")}</div>`;
    else html += `<div class="stamp">${i}</div>`;
  }
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
    .map((b) => {
      const halal = b.non_halal === 1 ? `<span class="nonhalal-tag">Non-halal</span>` : "";
      return `<a class="pill brandpill" href="/gabung/${esc(b.id)}">${logoSlot(b, { decorative: true })}<span class="brandpill-copy"><span>${esc(b.short_name)}</span>${halal}</span></a>`;
    })
    .join("");
  return doc(
    "Loyalty Bos",
    `<main class="phone landing">
      <header class="hero hero-plain center"><div class="checkbubble">${CUP}</div><div class="hero-big">Kartu stamp kamu</div><p class="hero-fine">1 kartu buat semua brand favorit lu. Simpan di HP, tanpa download aplikasi.</p></header>
      <section class="card"><h2>Pilih brand</h2><div class="pills">${pills}</div><a class="btn btn-solid" href="/gabung">Gabung</a><a class="btn btn-line" href="/masuk">Udah punya kartu</a></section>
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
      <header class="hero"><div class="hero-top">${input.brand ? logoSlot(input.brand) : `<div class="avatar">${CUP}</div>`}<div><div class="hero-title">${esc(title)}</div><div class="hero-sub">1 kartu buat semua brand favorit lu</div></div></div></header>
      ${flashes(input.params)}
      <form class="card" method="post" action="/gabung">
        <input type="hidden" name="next" value="${esc(input.next)}" />
        <input type="hidden" name="merek" value="${esc(input.brand?.id || "")}" />
        <input type="hidden" name="ajak" value="${esc(input.params.get("ajak") || "")}" />
        <label class="lbl" for="nama">Nama</label>
        <input id="nama" name="nama" type="text" required maxlength="40" autocomplete="name" value="${esc(input.values?.nama || "")}" />
        <label class="lbl" for="wa">Nomor WhatsApp</label>
        <input id="wa" name="wa" type="tel" required inputmode="tel" autocomplete="tel" placeholder="0812 3456 4567" value="${esc(input.values?.wa || "")}" />
        <label class="lbl" for="pin">PIN pilihan kamu (4–6 angka)</label>
        <input id="pin" name="pin" type="text" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="new-password" pattern="\\d{4,6}" />
        <label class="lbl" for="pin2">Ulangi PIN</label>
        <input id="pin2" name="pin2" type="text" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="new-password" pattern="\\d{4,6}" />
        <p class="fine">Tidak ada SMS. PIN ini yang dipakai kalau kamu masuk di HP lain. Jangan kasih ke orang.</p>
        <label class="checkline"><input type="checkbox" name="setuju" value="on" required /> Aku setuju nerima promo dan ucapan ulang tahun (UU PDP).</label>
        <button class="btn btn-solid">Simpan &amp; lihat kartu</button>
      </form>
      <p class="fine center" style="margin-top:12px">Udah terdaftar? <a href="/masuk?next=${encodeURIComponent(input.next)}">Masuk</a></p>
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
        <input id="wa" name="wa" type="tel" required inputmode="tel" autocomplete="tel" placeholder="0812 3456 4567" />
        <label class="lbl" for="pin">PIN</label>
        <input id="pin" name="pin" type="text" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="current-password" />
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
  birthday: BirthdayNotice;
  birthdayReward: string;
  tiers?: Array<{ id: string; stamps: number; reward: string; ready: boolean; icon?: string }>;
  orders?: OrderLink[];
  orderOutlets?: Array<{ id: string; name: string; on: boolean }>;
  booking?: { id: string; name: string; url: string } | null;
  pickBooking?: boolean;
  missions?: Array<{ id: string; title: string; blurb: string; kind: string; status: string; reason: string }>;
  waLock?: boolean;
  slices?: Array<{
    brand: Brand;
    banners: Banner[];
    history: ActivityRow[];
    birthday: BirthdayNotice;
    birthdayReward: string;
    tiers: Array<{ id: string; stamps: number; reward: string; ready: boolean; icon?: string }>;
    orders: OrderLink[];
    orderOutlets: Array<{ id: string; name: string; on: boolean }>;
    booking: { id: string; name: string; url: string } | null;
    pickBooking: boolean;
    missions: Array<{ id: string; title: string; blurb: string; kind: string; status: string; reason: string }>;
    quarters: number;
  }>;
}): string {
  const skin = customerSkin(input.brand);
  const historyRows = (rowsIn: ActivityRow[]) =>
    rowsIn
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
  const slices = input.slices?.length
    ? input.slices
    : [
        {
          brand: input.brand,
          banners: input.banners,
          history: input.history,
          birthday: input.birthday,
          birthdayReward: input.birthdayReward,
          tiers: input.tiers || [],
          orders: input.orders || [],
          orderOutlets: input.orderOutlets || [],
          booking: input.booking || null,
          pickBooking: Boolean(input.pickBooking),
          missions: input.missions || [],
          quarters: input.cards.get(input.brand.id)?.remainder_quarters || 0,
        },
      ];
  const first = input.member.name.split(" ")[0] || input.member.name;
  const celebrate = input.params.get("ok") === "stampquest";
  const locked = Boolean(input.waLock);
  const gifts = (input.tiers || []).map((tier) => ({ stamps: tier.stamps, icon: tier.icon || "🎁" }));
  const rail = input.brands
    .map((brand) => {
      const count = input.cards.get(brand.id)?.stamps ?? 0;
      const tone = customerSkin(brand);
      const active = brand.id === input.brand.id;
      const slice = slices.find((item) => item.brand.id === brand.id);
      const brandGifts = (slice?.tiers || (active ? gifts : [])).map((tier) => ({ stamps: tier.stamps, icon: tier.icon || "🎁" }));
      const veil = locked
        ? `<div class="lockveil"><div class="lockbadge">🔒</div><b>Verifikasi WhatsApp dulu</b><span>Biar stamp lu aman &amp; gak ketuker</span><button type="button" class="lockbtn" data-open-verify>Verifikasi dulu</button></div>`
        : "";
      const cardBg = brand.id === "krispyporkk" ? "#111111" : brand.accent || "#143d28";
      return `<article class="stampcard${active ? " on" : ""}" data-brand="${esc(brand.id)}" data-href="/kartu?merek=${esc(brand.id)}" data-skin="${tone.style}" data-dark="${tone.dark ? "1" : "0"}" style="${tone.style};background:${esc(cardBg)};color:#fff${brand.id === "krispyporkk" ? ";border:1.5px solid #F27BA6" : ""}">
        ${veil}
        <div class="stamphead">${logoSlot(brand)}<b>${count}/${brand.stamps_required}</b></div>
        ${stampGrid(count, brand.stamps_required, stampMark(brand), brandGifts, brand.id)}
        <p class="stampnote">${esc(nextRewardLine(count, slice?.tiers || []))}</p>
      </article>`;
    })
    .join("");
  const many = input.brands.length > 1;
  const dots = many
    ? input.brands
        .map((brand) =>
          logoSlot(brand, {
            decorative: true,
            extra: brand.id === input.brand.id ? "on" : "",
            attrs: ` data-dot-brand="${esc(brand.id)}"`,
          }),
        )
        .join("")
    : "";
  const phone = input.member.wa.startsWith("62") ? `+${input.member.wa}` : input.member.wa;
  const stages = slices
    .map((slice) => {
      const on = slice.brand.id === input.brand.id;
      const tone = customerSkin(slice.brand);
      const banner =
        carousel(slice.banners, input.now, slice.brand.banner_ms || 3000, slice.brand.non_halal === 1, on) ||
        `<section class="reel"><div class="reel-track"><div class="slide"><div class="slide-fallback"></div><div class="slide-copy"><h3>${esc(slice.brand.name)}</h3><p>${esc(slice.brand.handle)}</p></div></div></div></section>`;
      return `<div class="stage" data-pane="${esc(slice.brand.id)}" data-skin="${tone.style}" data-dark="${tone.dark ? "1" : "0"}"${on ? "" : " hidden"}>${banner}<p class="fine igline">${esc(slice.brand.ig_handle || slice.brand.handle)}</p></div>`;
    })
    .join("");
  const rests = slices
    .map((slice) => {
      const on = slice.brand.id === input.brand.id;
      const rows = historyRows(slice.history);
      return `<div class="rest" data-pane="${esc(slice.brand.id)}"${on ? "" : " hidden"}>
        ${birthdayBlock(slice.birthday, slice.birthdayReward, slice.brand.id, input.now)}
        ${orderBlock(slice.orders, slice.orderOutlets, slice.brand.id, slice.booking, slice.pickBooking)}
        ${bonusStamp(slice.missions, slice.brand.id)}
        <section class="card"><h2>Riwayat</h2>${rows || `<p class="fine">Belum ada stamp di merek ini.</p>`}</section>
      </div>`;
    })
    .join("");
  return doc(
    input.brand.short_name,
    `${celebrate ? confetti() : ""}${installPrompt()}<main class="phone skin with-tabs${skin.dark ? " skin-dark" : ""}" style="${skin.style}" data-brand-root data-member="1">
      <div class="page-swap" data-page>
      ${stages}
      <section class="hello">
        <h1 class="display">Hai, ${esc(first)} 👋</h1>
        <p class="fine">Member dari ${esc(memberSince(input.member.created_at))}</p>
      </section>
      ${flashes(input.params)}
      <div class="rail${many ? "" : " solo"}" data-rail>${rail}</div>
      <div class="raildots" aria-hidden="true"${many ? "" : " hidden"}>${dots}</div>
      <button type="button" class="btn btn-solid"${locked ? " data-open-verify" : " data-scan"}>${locked ? "🔒 Collect Stamps" : "Collect Stamps"}</button>
      <p class="fine center">${locked ? "Verifikasi dulu biar stamp-nya kebuka." : "Arahin kamera ke QR di kasir ya"}</p>
      ${rests}
      </div>
      <div class="dimmer" data-verify-dim hidden></div>
      <section class="sheet" data-verify-sheet hidden>
        <div class="grab"></div>
        <h2>Verifikasi WhatsApp</h2>
        <p>Pencet tombol di bawah, WhatsApp kebuka dengan pesan yang udah keisi. Tinggal kirim.</p>
        <div class="sheet-phone">Nomor lu: ${esc(phone)} ✓</div>
        <a class="btn btn-wa" data-verify-go href="#">Buka WhatsApp &amp; kirim</a>
        <div data-verify-done hidden>
          <div class="lockbadge">✅</div>
          <h2>Udah keverifikasi!</h2>
          <p>Kartu lu udah kebuka, gas kumpulin stamp.</p>
          <a class="btn btn-solid" href="/kartu?merek=${esc(input.brand.id)}">Lanjut ke kartu</a>
        </div>
      </section>
      <div class="scan-sheet" data-scanner hidden>
        <div class="scan-top">
          <p>Arahin kamera ke QR di kasir ya</p>
          <button type="button" class="textlink" data-scan-cancel>Batal</button>
        </div>
        <div class="scan-stage" data-scan-stage>
          <video data-scan-video playsinline muted autoplay></video>
          <div class="scan-frame" aria-hidden="true"></div>
        </div>
        <p class="scan-msg" data-scan-msg></p>
        <button type="button" class="btn btn-line" data-scan-torch hidden>Senter</button>
        <div class="scan-fallback" data-scan-fallback hidden>
          <h2>Minta kasir ketik nomor WA kamu</h2>
          <p class="fine">Kamera tidak bisa dipakai. Kasir bisa ketik nomor WA kamu di tablet. Atau buka kamera HP dan scan QR di kasir dari situ.</p>
          <button type="button" class="btn btn-solid" data-scan-cancel>Tutup</button>
        </div>
      </div>
      ${tabbar("kartu", input.brand.id)}
    </main>`,
    skin.accent,
    input.brand.id,
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
  unlocked?: boolean;
  nextLine?: string;
}): string {
  const copy = progressCopy(input.stamps, input.brand.stamps_required, input.brand.reward_text);
  const skin = customerSkin(input.brand);
  const burst = input.kind === "stamp" && input.unlocked;
  const title =
    input.kind === "stamp"
      ? "Yeay, stamp kamu nambah!"
      : input.kind === "birthday"
        ? `Hadiah ultah ${input.brand.short_name}!`
        : `Reward ${input.brand.short_name} ditukar!`;
  const others = input.otherBrands.length ? `Cek juga kartu kamu di ${input.otherBrands.join(" & ")}` : "Kartu kamu tersimpan di HP ini";
  return doc(
    title,
    `${burst ? confetti() : ""}<main class="phone skin with-tabs${skin.dark ? " skin-dark" : ""}" style="${skin.style}" ${input.kind === "stamp" ? "data-tepok" : ""}>
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
        ${stampGrid(input.stamps, input.brand.stamps_required, stampMark(input.brand), [], input.brand.id, input.kind === "stamp")}
        <p class="lead">${esc(copy.headline)}</p>
        ${input.nextLine ? `<p class="stampnote">${esc(input.nextLine)}</p>` : ""}
        <p class="fine">${esc(ruleLine(input.brand))}</p>
      </section>
      <div class="hint">${esc(others)}</div>
      <a class="btn btn-solid" href="/kartu?merek=${esc(input.brand.id)}">Lihat kartu saya</a>
      ${tabbar("kartu", input.brand.id)}
    </main>`,
    skin.accent,
    input.brand.id,
  );
}

export function cashierPinPage(outlet: Outlet, brand: Brand, params: URLSearchParams): string {
  return doc(
    `Kasir ${outlet.name}`,
    `<main class="phone" style="${paint(brand.accent, brand.accent_soft)}">
      <header class="hero"><div class="hero-title">${esc(outlet.name)}</div><div class="hero-sub">Masukkan PIN outlet</div></header>
      ${flashes(params)}
      <form class="card" method="post" action="/kasir/masuk">
        <input type="hidden" name="outlet_id" value="${esc(outlet.id)}" />
        <label class="lbl" for="pin">PIN</label>
        <input id="pin" name="pin" type="text" required inputmode="numeric" minlength="4" maxlength="8" autocomplete="current-password" />
        <button class="btn btn-solid">Masuk</button>
      </form>
      <p class="fine"><a href="/kasir">Pilih outlet lain</a></p>
    </main>`,
    brand.accent,
  );
}

export function cashierLoginPage(outlets: Array<Outlet & { brand_name: string; emoji: string; accent: string }>, params: URLSearchParams): string {
  const options = outlets
    .map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`)
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
        <input id="pin" name="pin" type="text" required inputmode="numeric" minlength="4" maxlength="8" autocomplete="current-password" />
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
  found: { member: Member; stamps: number; birthdayOpen: boolean; birthdayLine: string | null; quests?: Array<{ id: string; title: string; points: string }> } | null;
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
      ${stampGrid(input.found.stamps, input.brand.stamps_required, stampMark(input.brand), [], input.brand.id)}
      <p class="lead">${esc(copy.headline)}</p>
      ${(input.found.quests || [])
        .map(
          (quest) => `<form method="post" action="/kasir/misi">
            <input type="hidden" name="member_id" value="${esc(input.found?.member.id || "")}" />
            <input type="hidden" name="mission_id" value="${esc(quest.id)}" />
            <button class="btn btn-line">Kasih stamp: ${esc(quest.title)}</button>
          </form>`,
        )
        .join("")}
      ${copy.ready ? `<a class="btn btn-amber" href="/kasir/tukar?member=${esc(input.found.member.id)}">${GIFT} Tukar Reward: ${esc(input.brand.reward_text)}</a>` : ""}
      ${input.found.birthdayLine ? `<p class="fine">${esc(input.found.birthdayLine)}</p>` : ""}
      ${input.found.birthdayOpen ? `<a class="btn btn-line" href="/kasir/ulangtahun?member=${esc(input.found.member.id)}">Claim your birthday freebies</a>` : ""}
    </section>`;
  }
  return doc(
    `Kasir ${input.outlet.name}`,
    `<main class="kasir-desk phone" style="${paint(input.brand.accent, input.brand.accent_soft)}">
      <header class="hero">
        <div class="hero-top">${logoSlot(input.brand)}<div><div class="hero-title">Kasir · ${esc(input.outlet.name)}</div><div class="hero-sub">Tablet outlet</div></div></div>
        <div class="badge">${CHECK} Login PIN outlet</div>
      </header>
      ${input.params.get("ok") === "stamp" && input.params.get("siapa") ? `<div class="flash good">✓ Stamp masuk ke ${esc(input.params.get("siapa") || "")}${input.cancelId ? `<form method="post" action="/kasir/batal/${esc(input.cancelId)}"><button class="textlink">Batalkan</button></form>` : ""}</div>` : flashes(input.params)}
      <section class="kasir-col">
      <section class="card">
        <h2>Kasih stamp ke customer</h2>
        <p class="fine">Customer scan QR pakai kamera HP. Kalau QR susah, ketik nomor WA. Satu centang, tetap kena batas harian.</p>
        <form method="post" action="/kasir/stamp">
          <label class="checkline"><input type="checkbox" name="syarat" value="on" required /> ${esc(input.brand.condition_label)}</label>
          <button class="btn btn-solid">${CUP} Buka QR stamp</button>
          <label class="lbl" for="wa">Nomor WA customer</label>
          <input id="wa" name="wa" type="tel" inputmode="tel" placeholder="0812 3456 4567" value="${esc(input.params.get("wa") || "")}" />
          <button class="btn btn-line" formaction="/kasir/stamp/manual">+1 stamp ke nomor ini</button>
          <button class="btn btn-line" formaction="/kasir/cari" formnovalidate>Cari member</button>
        </form>
        <a class="btn btn-line" href="/kasir/kode">Masukkan kode customer</a>
      </section>
      ${found}
      </section>
      <section class="kasir-col">
      <section class="card">
        <h2>Aktivitas terakhir</h2>
        ${rows || `<p class="fine">Belum ada aktivitas di outlet ini.</p>`}
      </section>
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
  const noun = input.kind === "stamp" ? "1 stamp" : input.kind === "birthday" ? "Birthday Freebies" : "tukar reward";
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
      <header class="hero"><div class="hero-top">${logoSlot(input.brand)}<div><div class="hero-title">Kasir · ${esc(input.brand.short_name)}</div><div class="hero-sub">Login PIN outlet</div></div></div></header>
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
  ["/admin/dasbor", "Dashboard"],
  ["/admin/member", "Member"],
  ["/admin/reward", "Reward"],
  ["/admin/banner", "Banner Promo"],
  ["/admin/aturan", "Setting Program"],
  ["/admin/misi", "Misi"],
  ["/admin/tingkat", "Redeem"],
  ["/admin/outlet", "Outlet & PIN"],
  ["/admin/aktivitas", "Aktivitas"],
  ["/admin/stan", "QR Stan"],
  ["/admin/password", "Ganti Password"],
  ["/admin/ajak", "Ajak temen"],
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

export function referralsAdminPage(input: {
  rows: Array<{ friend: string; referrer: string; brand: string; qualified: number; consumed: number; grantId: string | null }>;
  batch: number;
  bonus: number;
  params: URLSearchParams;
  events?: Array<{ when: string; kind: string; detail: string }>;
}): string {
  const body = input.rows
    .map(
      (row) => `<tr><td>${esc(row.referrer)}</td><td>${esc(row.friend)}</td><td>${esc(row.brand)}</td><td>${row.qualified ? "lolos" : "belum"}</td><td>${
        row.grantId
          ? `<form method="post" action="/admin/ajak/${esc(row.grantId)}/tarik"><button class="textlink">Tarik stamp</button></form>`
          : "-"
      }</td></tr>`,
    )
    .join("");
  return adminShell(
    "/admin/ajak",
    `<h1>Ajak temen</h1>${flashes(input.params)}
     <form class="panel" method="post" action="/admin/ajak">
       <label class="lbl">Temen per 1 stamp (batch)</label><input name="batch" type="number" min="1" max="50" value="${input.batch}" required />
       <label class="lbl">Bonus stamp buat temen (0 = tidak ada)</label><input name="bonus" type="number" min="0" max="20" value="${input.bonus}" required />
       <button class="btn btn-solid">Simpan</button>
     </form>
     <article class="panel" style="margin-top:12px;overflow:auto"><table><thead><tr><th>Yang ngajak</th><th>Temen</th><th>Merek</th><th>Status</th><th></th></tr></thead><tbody>${body || `<tr><td colspan="5">Belum ada.</td></tr>`}</tbody></table></article>
     <article class="panel" style="margin-top:12px"><h2>Jejak</h2>${(input.events || []).map((event) => `<div class="row"><span>${esc(event.kind)} · ${esc(event.detail)}</span><b>${esc(event.when)}</b></div>`).join("") || `<p class="fine">Belum ada jejak.</p>`}</article>`,
  );
}

export function ownerPasswordPage(params: URLSearchParams): string {
  return adminShell(
    "/admin/password",
    `<h1>Ganti Password</h1>
     ${flashes(params)}
     <form class="panel" style="margin-top:12px" method="post" action="/admin/password">
       <p class="fine">Minimal 8 karakter. Setelah disimpan, password di secret tidak bisa dipakai lagi. Sesi owner yang lain ikut keluar. Sesi kamu tetap masuk.</p>
       <label class="lbl" for="password_lama">Password sekarang</label>
       <input id="password_lama" name="password_lama" type="password" required autocomplete="current-password" />
       <label class="lbl" for="password_baru">Password baru</label>
       <input id="password_baru" name="password_baru" type="password" required minlength="8" maxlength="200" autocomplete="new-password" />
       <label class="lbl" for="password_ulang">Ulangi password baru</label>
       <input id="password_ulang" name="password_ulang" type="password" required minlength="8" maxlength="200" autocomplete="new-password" />
       <button class="btn btn-solid">Simpan password</button>
     </form>`,
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
  expireDays?: number;
  story?: {
    new7: number;
    new30: number;
    returnPct: number;
    stamps30: number;
    referralSigned: number;
    referralQualified: number;
    topRewards: Array<{ label: string; n: number }>;
  };
}): string {
  const chips = [`<a class="chip${input.brand ? "" : " on"}" href="/admin/dasbor">Semua</a>`]
    .concat(input.brands.map((b) => `<a class="chip${input.brand?.id === b.id ? " on" : ""}" href="/admin/dasbor?merek=${esc(b.id)}">${logoSlot(b, { decorative: true })} ${esc(b.short_name)}</a>`))
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
    .map((f) => `<div class="flag"><b>${esc(f.reason === "ramai" ? "Kasir terlalu ramai" : f.reason === "sendiri" ? "Stamp ke akun sendiri" : "Batas harian")}</b> · ${esc(f.outlet_name || "")} ${esc(f.member_name || "")}<div class="small">${esc(f.detail)} · ${esc(feedTime(f.created_at, input.now))}</div></div>`)
    .join("");
  const body = `
    <div class="toprow"><h1>Dashboard</h1><div class="chips">${chips}</div></div>
    <section class="kpis">
      <article class="kpi"><span>Total member</span><b>${formatInt(input.numbers.members)}</b><span>${input.brand ? esc(input.brand.short_name) : "semua merek"}</span></article>
      <article class="kpi"><span>Stamp hari ini</span><b>${input.numbers.stampsToday}</b><span>${input.numbers.outletsToday} outlet</span></article>
      <article class="kpi"><span>Reward ditukar (bulan ini)</span><b>${input.numbers.redeemsMonth}</b><span>${esc(program?.reward_text || "semua merek")}</span></article>
      <article class="kpi"><span>Member aktif 30 hari</span><b>${input.numbers.active30}</b><span>${activePct}% dari total</span></article>
      <article class="kpi"><span>Birthday Freebies bulan ini</span><b>${input.birthdayRedeems}</b><span>yang sudah diklaim</span></article>
      <article class="kpi"><span>Misi menunggu</span><b>${input.pendingMissions}</b><span><a href="/admin/misi">Kelola Misi</a></span></article>
    </section>
    ${
      input.story
        ? `<section class="kpis">
            <article class="kpi"><span>Member baru 7 hari</span><b>${input.story.new7}</b></article>
            <article class="kpi"><span>Member baru 30 hari</span><b>${input.story.new30}</b></article>
            <article class="kpi"><span>Balik dalam 30 hari</span><b>${input.story.returnPct}%</b><span>yang pernah stamp, lalu stamp lagi</span></article>
            <article class="kpi"><span>Stamp 30 hari</span><b>${input.story.stamps30}</b></article>
            <article class="kpi"><span>Ajak temen</span><b>${input.story.referralQualified}/${input.story.referralSigned}</b><span>lolos / daftar</span></article>
          </section>
          <article class="panel" style="margin-top:12px"><h2>Reward paling sering ditukar</h2>
            <table><thead><tr><th>Reward</th><th>Jumlah</th></tr></thead><tbody>${
              input.story.topRewards.map((row) => `<tr><td>${esc(row.label || "-")}</td><td>${row.n}</td></tr>`).join("") || `<tr><td colspan="2">Belum ada.</td></tr>`
            }</tbody></table>
          </article>`
        : ""
    }
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
  pointsNote?: string;
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
       <div class="row"><span>Ulang tahun</span><b>${esc(input.member.birthday ? formatBirthdayId(input.member.birthday) : "-")}</b></div>
       <div class="row"><span>Gabung</span><b>${esc(memberSince(input.member.created_at))} · ${esc(input.member.join_method)}</b></div>
       <div class="row"><span>Terakhir datang</span><b>${esc(feedTime(input.member.last_seen_at, Date.now()))}</b></div>
       <div class="row"><span>WA terverifikasi</span><b>${input.member.wa_verified === 1 ? "ya" : "belum"}</b></div>
       <div class="row"><span>Persetujuan promo</span><b>${input.member.promo_consent === 1 ? "ya" : "belum"}</b></div>
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
       <p class="fine">Pelanggan tidak bisa mengubah ini sendiri setelah terisi. Owner boleh. Kalau baru diubah, Birthday Freebies tahun ini terkunci 30 hari kecuali dicentang.</p>
       ${birthdayFields(input.member.birthday)}
       <label class="checkline"><input type="checkbox" name="boleh" value="on" /> Boleh klaim Birthday Freebies tahun ini</label>
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
  consent?: boolean;
  referral?: { have: number; need: number; code: string; url: string };
}): string {
  const link = input.mode === "link";
  const skin = input.mode === "member" && input.brand ? customerSkin(input.brand) : null;
  return doc(
    "Profil",
    `<main class="phone${skin ? ` skin with-tabs${skin.dark ? " skin-dark" : ""}` : ""}"${skin ? ` style="${skin.style}"` : ""} ${input.mode === "member" ? `data-member="1"` : ""}>
      ${skin ? "" : `<header class="hero"><div class="hero-title">${link ? "Nomor ini udah punya kartu" : "Lengkapi profil"}</div><div class="hero-sub">${esc(input.email || input.name)}</div></header>`}
      ${flashes(input.params)}
      ${
        link
          ? `<form class="card" method="post" action="/profil/hubungkan">
              <p class="fine">Masukkan PIN kartu nomor ini supaya akun Google-nya nyambung. Kalau tidak ingat PIN, masuk lewat nomor WA.</p>
              <input type="hidden" name="wa" value="${esc(input.wa || "")}" />
              <input type="hidden" name="lahir" value="${esc(input.birthday || "")}" />
              <label class="lbl">PIN</label>
              <input name="pin" type="text" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="current-password" />
              <button class="btn btn-solid">Hubungkan</button>
            </form>`
          : input.mode === "google"
            ? `<form class="card" method="post" action="/profil">
                <label class="lbl">Nama</label><input name="nama" type="text" required value="${esc(input.name)}" />
                ${birthdayFields(input.birthday)}
                <p class="fine">Tanggal lahir tidak bisa diubah sendiri setelah disimpan.</p>
                <label class="lbl">Nomor WhatsApp</label><input name="wa" type="tel" required inputmode="tel" value="${esc(input.wa || "")}" placeholder="0812 3456 4567" />
                <label class="lbl">PIN 4–6 angka</label><input name="pin" type="text" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="new-password" />
                <label class="lbl">Ulangi PIN</label><input name="pin2" type="text" required inputmode="numeric" minlength="4" maxlength="6" autocomplete="new-password" />
                <p class="fine">PIN ini buat masuk tanpa Google, di HP lain.</p>
                <label class="checkline"><input type="checkbox" name="setuju" value="on" required /> Aku setuju nerima promo dan ucapan ulang tahun (UU PDP).</label>
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
                ${input.birthday ? `<p><b>Ulang tahun ${esc(formatBirthdayId(input.birthday))}</b> udah tersimpan. Tidak bisa diubah sendiri.</p>` : `${birthdayFields(null)}<p class="fine">Sekali simpan, dikunci. Hadiah ultah baru bisa 30 hari kemudian.</p>`}
                ${input.consent ? `<p class="fine">Persetujuan promo dan ulang tahun sudah tercatat.</p>` : `<label class="checkline"><input type="checkbox" name="setuju" value="on" required /> Aku setuju nerima promo dan ucapan ulang tahun (UU PDP).</label>`}
                ${!input.birthday || !input.consent ? `<button class="btn btn-solid">Simpan</button>` : ""}
              </form>
              ${input.google ? "" : `<a class="btn btn-google" href="/masuk/google?niat=hubung">Hubungkan Google</a>`}
              ${
                input.referral
                  ? `<section class="card" id="ajak"><h2>Ajak temen</h2><p>Temen yang udah gabung: ${input.referral.have}/${input.referral.need}</p><p class="fine">Kode ${esc(input.referral.code)}. ${input.referral.need} temen baru, profil lengkap, dan udah kena stamp = 1 stamp buat kamu.</p><button type="button" class="btn btn-solid" data-share data-url="${esc(input.referral.url)}">Bagikan link</button></section>`
                  : ""
              }
              ${installPrompt()}
              <form method="post" action="/keluar"><button class="linkbtn">Keluar</button></form>`
      }
      ${skin && input.brand ? tabbar("profil", input.brand.id) : ""}
    </main>`,
    skin?.accent,
    input.brand?.id || "",
  );
}

export function confirmBirthdayPage(input: { brand: Brand; member: Member; reward: string }): string {
  return doc(
    "Birthday Freebies",
    `<main class="phone" style="${paint(input.brand.accent, input.brand.accent_soft)}">
      <header class="hero"><div class="hero-title">Birthday Freebies untuk ${esc(input.member.name)}?</div><div class="hero-sub">${esc(input.reward)}</div></header>
      <section class="card">
        <p class="fine">Sekali setahun, di tanggal yang diatur. Stamp tidak berkurang.</p>
        <form method="post" action="/kasir/ulangtahun/manual">
          <input type="hidden" name="member_id" value="${esc(input.member.id)}" />
          <button class="btn btn-amber">Claim your birthday freebies</button>
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

function cropFields(name: string): string {
  return `<label class="lbl">Foto 2:1</label>
    <input name="${name}" type="file" accept="image/*" data-crop-file />
    <canvas class="cropbox" data-crop-canvas hidden></canvas>
    <p class="fine">Geser fotonya di kotak 2:1. Yang ke-crop ini yang tersimpan.</p>`;
}

export function bannersPage(input: { banners: Banner[]; news: NewsCard[]; brands: Brand[]; params: URLSearchParams }): string {
  const blocks = input.brands
    .map((brand) => {
      const slots = [1, 2, 3].map((slot) => {
        const row = input.banners.find((banner) => banner.brand_id === brand.id && banner.slot === slot);
        const img = row?.r2_key ? `/media/${row.r2_key}` : row?.image_url || "";
        return `<form class="panel" style="margin-top:12px" data-crop method="post" action="/admin/banner/slot" enctype="multipart/form-data">
          <h3>Banner slot ${slot}</h3>
          <input type="hidden" name="brand_id" value="${esc(brand.id)}" />
          <input type="hidden" name="slot" value="${slot}" />
          ${img ? `<img class="croppreview" src="${esc(img)}" alt="" />` : `<p class="fine">Slot kosong.</p>`}
          <label class="lbl">Judul pendek</label><input name="title" maxlength="40" value="${esc(row?.title || "")}" />
          <label class="lbl">Satu baris</label><input name="subtitle" maxlength="80" value="${esc(row?.subtitle || "")}" />
          ${cropFields("gambar")}
          <button class="btn btn-solid">Simpan slot ${slot}</button>
        </form>`;
      });
      const news = [1, 2, 3].map((slot) => {
        const row = input.news.find((item) => item.brand_id === brand.id && item.slot === slot);
        const img = row?.r2_key ? `/media/news/${row.id}` : row?.image_url || "";
        return `<form class="panel" style="margin-top:12px" data-crop method="post" action="/admin/news/slot" enctype="multipart/form-data">
          <h3>News slot ${slot}</h3>
          <input type="hidden" name="brand_id" value="${esc(brand.id)}" />
          <input type="hidden" name="slot" value="${slot}" />
          ${img ? `<img class="croppreview" src="${esc(img)}" alt="" />` : `<p class="fine">Kosong. Kartu pelanggan pakai foto menu bawaan.</p>`}
          <label class="lbl">Label</label>
          <select name="kind">
            ${["NEWS", "PROMO", "MENU"].map((kind) => `<option value="${kind}" ${row?.kind === kind ? "selected" : ""}>${kind}</option>`).join("")}
          </select>
          <label class="lbl">Judul</label><input name="title" maxlength="40" value="${esc(row?.title || "")}" />
          <label class="lbl">Teks pendek</label><input name="subtitle" maxlength="80" value="${esc(row?.subtitle || "")}" />
          ${cropFields("gambar")}
          <button class="btn btn-solid">Simpan news ${slot}</button>
        </form>`;
      });
      return `<section style="margin-top:22px">
        <h2>${logoSlot(brand)} ${esc(brand.short_name)}</h2>
        <form class="panel" method="post" action="/admin/banner/jeda">
          <input type="hidden" name="brand_id" value="${esc(brand.id)}" />
          <label class="lbl">Jeda geser banner (detik)</label>
          <div class="actions"><input name="seconds" type="number" min="2" max="20" step="1" value="${Math.round((brand.banner_ms || 3000) / 1000)}" required /><button class="btn btn-solid">Simpan jeda</button></div>
          <p class="fine">Bawaan 3 detik. Berhenti pas disentuh.</p>
        </form>
        ${slots.join("")}
        ${news.join("")}
      </section>`;
    })
    .join("");
  return adminShell(
    "/admin/banner",
    `<h1>Kelola Banner</h1>${flashes(input.params)}
     <p class="fine">Tiga foto banner dan tiga kabar per merek. Kotak crop-nya 2:1. Slot news yang kosong jatuh ke foto menu bawaan.</p>
     ${blocks}`,
  );
}

export function rulesPage(brands: Brand[], hidden: Brand[], links: OrderLink[], params: URLSearchParams): string {
  const forms = brands
    .map(
      (b) => `<form class="panel" style="margin-top:12px;${paint(b.accent, b.accent_soft)}" method="post" action="/admin/aturan/${esc(b.id)}">
        <h2>${logoSlot(b)} ${esc(b.name)}</h2>
        <label class="lbl">Nama</label><input name="name" value="${esc(b.name)}" required />
        <label class="lbl">Nama singkat</label><input name="short_name" value="${esc(b.short_name)}" required />
        <label class="lbl">Handle</label><input name="handle" value="${esc(b.handle)}" required />
        <label class="lbl">Emoji</label><input name="emoji" value="${esc(b.emoji)}" maxlength="8" />
        <label class="lbl">Warna utama</label><input name="accent" type="color" value="${esc(b.accent)}" />
        <label class="lbl">Warna lembut</label><input name="accent_soft" type="color" value="${esc(b.accent_soft)}" />
        <label class="lbl">Warna tombol</label><input name="cta" type="color" value="${esc(b.cta || b.accent)}" />
        <label class="lbl">Warna latar</label><input name="page_bg" type="color" value="${esc(b.page_bg || "#f3eee4")}" />
        <label class="lbl">Ikon stamp</label>
        <select name="stamp_icon">
          ${["whisk", "bowl", "snout", "custom"].map((kind) => {
            const chosen = b.stamp_icon === "whisk" || b.stamp_icon === "bowl" || b.stamp_icon === "snout" || b.stamp_icon === "custom" ? b.stamp_icon : defaultStampIcon(b.id);
            const label = kind === "whisk" ? "Whisk · Loft25" : kind === "bowl" ? "Mangkok · Soto" : kind === "snout" ? "Hidung babi · Krispy" : "Upload sendiri";
            return `<option value="${kind}" ${chosen === kind ? "selected" : ""}>${label}</option>`;
          }).join("")}
        </select>
        ${b.logo_key ? `<p class="fine">Logo header sudah ada.</p>` : `<p class="fine">Logo header masih slot LOGO.</p>`}
        <label class="lbl">Stamp untuk reward</label><input name="stamps_required" type="number" min="1" max="30" value="${b.stamps_required}" required />
        <label class="lbl">Teks reward</label><input name="reward_text" value="${esc(b.reward_text)}" required />
        <label class="lbl">Teks centang kasir</label><input name="condition_label" value="${esc(b.condition_label)}" required />
        <label class="lbl">Minimal transaksi (Rp, opsional)</label><input name="min_amount" type="number" min="0" value="${b.min_amount ?? ""}" />
        <label class="lbl">Maks stamp per member per hari</label><input name="max_stamps_per_day" type="number" min="1" max="10" value="${b.max_stamps_per_day}" required />
        <label class="lbl">Catatan reward</label><textarea name="reward_note">${esc(b.reward_note)}</textarea>
        <label class="lbl">Birthday Freebies</label><input name="birthday_reward" value="${esc(b.birthday_reward || "")}" maxlength="80" />
        <label class="lbl">Kapan Birthday Freebies berlaku</label>
        <select name="birthday_window">
          <option value="day" ${b.birthday_window === "month" || b.birthday_window === "around" ? "" : "selected"}>Hari H aja</option>
          <option value="month" ${b.birthday_window === "month" ? "selected" : ""}>Bulan ultah</option>
          <option value="around" ${b.birthday_window === "around" ? "selected" : ""}>± N hari</option>
        </select>
        <label class="lbl">N hari (kalau pilih ± N hari)</label><input name="birthday_days" type="number" min="0" max="30" value="${b.birthday_days ?? 7}" />
        <label class="lbl">Akun Instagram untuk Story</label><input name="ig_handle" value="${esc(b.ig_handle || "")}" maxlength="80" placeholder="@akun" />
        <label class="checkline"><input type="checkbox" name="birthday_active" value="on" ${b.birthday_active ? "checked" : ""} /> Birthday Freebies aktif</label>
        <label class="checkline"><input type="checkbox" name="active" value="on" ${b.active ? "checked" : ""} /> Merek aktif</label>
        <h3 style="margin-top:14px">Tautan lain</h3>
        <p class="fine">Order / Booking diatur per outlet. GoFood, GrabFood, dan ShopeeFood tidak ditampilkan.</p>
        <label class="lbl">Tautan tambahan</label>
        <select name="extra_platform"><option value="">Tidak tambah</option><option value="wa">WhatsApp</option><option value="other">Lainnya</option></select>
        <label class="lbl">Nama tombol tambahan</label><input name="extra_label" maxlength="24" placeholder="WhatsApp" />
        <label class="lbl">URL tambahan (https)</label><input name="extra_url" type="url" placeholder="https://wa.me/62..." />
        <button class="btn btn-solid">Simpan</button>
      </form>
      <form class="panel" style="margin-top:8px" method="post" action="/admin/merek/${esc(b.id)}/logo" enctype="multipart/form-data">
        <h3>Logo, ikon aplikasi, dan stempel</h3>
        <p class="fine">Logo tampil di header kartu. Ikon dipakai di manifest aplikasi. Stempel custom menggantikan ikon bawaan.</p>
        <label class="lbl">Logo header</label><input name="logo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
        <label class="lbl">Ikon aplikasi</label><input name="ikon" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
        <label class="lbl">Stempel upload</label><input name="stamp" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
        <button class="btn btn-line">Unggah</button>
      </form>
      ${extraLinks(links, b.id)}`,
    )
    .join("");
  const tucked = hidden.length
    ? `<details class="panel" style="margin-top:16px">
        <summary>Merek disembunyiin</summary>
        <p class="fine">Data merek ini tetap utuh. Satu ketukan nyalakan lagi, kartu, quest, redeem, dan outlet-nya balik.</p>
        ${hidden
          .map(
            (b) => `<form method="post" action="/admin/aturan/${esc(b.id)}/nyala" style="margin-top:10px">
              <span>${logoSlot(b)} ${esc(b.name)}</span>
              <button class="btn btn-line">Merek aktif</button>
            </form>`,
          )
          .join("")}
      </details>`
    : "";
  return adminShell("/admin/aturan", `<h1>Setting program</h1>${flashes(params)}<p class="fine">Teks centang inilah yang dilihat kasir sebelum kasih stamp.</p>${forms}${tucked}`);
}

function extraLinks(links: OrderLink[], brandId: string): string {
  const extras = links.filter(
    (link) => link.brand_id === brandId && !link.outlet_id && !hiddenOrderPlatform(link.platform),
  );
  if (!extras.length) return "";
  return extras
    .map(
      (link) => `<form method="post" action="/admin/pesan/${esc(link.id)}/hapus" style="margin-top:8px">
        <span>${esc(orderLabel(link.platform, link.label))}</span>
        <button class="textlink">Hapus</button>
      </form>`,
    )
    .join("");
}

export function outletsPage(
  outlets: Array<Outlet & { brand_name: string }>,
  brands: Brand[],
  params: URLSearchParams,
  staff: Array<{ outlet_id: string; id: string; name: string; wa: string; email: string | null }> = [],
): string {
  const options = brands.map((b) => `<option value="${esc(b.id)}">${esc(b.short_name)}</option>`).join("");
  const list = outlets
    .map(
      (o) => `<article class="panel" style="margin-top:12px">
        <h2>${esc(o.name)}</h2>
        <p class="fine">${esc(o.brand_name)} · ${o.active ? "aktif" : "nonaktif"}${o.slug ? ` · /kasir/${esc(o.slug)}` : ""}</p>
        <form method="post" action="/admin/outlet/${esc(o.id)}/slug">
          <label class="lbl">Link kasir (slug)</label>
          <div class="actions"><input name="slug" maxlength="60" placeholder="loft25-senopati" value="${esc(o.slug || "")}" /><button class="btn btn-solid">Simpan link</button></div>
        </form>
        <form method="post" action="/admin/outlet/${esc(o.id)}/pin">
          <label class="lbl">PIN baru (4–8 angka)</label>
          <div class="actions"><input name="pin" inputmode="numeric" minlength="4" maxlength="8" required /><button class="btn btn-solid">Ganti PIN</button></div>
        </form>
        <form method="post" action="/admin/outlet/${esc(o.id)}/aktif">
          <input type="hidden" name="active" value="${o.active ? "0" : "1"}" />
          <button class="btn btn-line">${o.active ? "Nonaktifkan" : "Aktifkan"}</button>
        </form>
        <form method="post" action="/admin/outlet/${esc(o.id)}/pesan">
          <h3 style="margin-top:8px">${RESERVASI_LABEL}</h3>
          <label class="lbl">WhatsApp order / booking</label><input name="wa" type="tel" inputmode="tel" value="${esc(o.wa || "")}" placeholder="0812 3456 4567" />
          <p class="fine">Satu tombol ${RESERVASI_LABEL} di kartu. Pesannya “Halo, mau booking / order di …” pakai nomor ini. Kosongkan untuk menyembunyikan.</p>
          <button class="btn btn-solid">Simpan tautan</button>
        </form>
        <h3 style="margin-top:8px">Staf</h3>
        <p class="fine">Akun ini tidak bisa dapat stamp atau tukar dari kasir outlet ini.</p>
        ${staff
          .filter((person) => person.outlet_id === o.id)
          .map(
            (person) => `<form method="post" action="/admin/outlet/${esc(o.id)}/staf/lepas">
              <span>${esc(person.name)} · ${esc(prettyWa(person.wa))}${person.email ? ` · ${esc(person.email)}` : ""}</span>
              <input type="hidden" name="member_id" value="${esc(person.id)}" />
              <button class="textlink">Lepas</button>
            </form>`,
          )
          .join("") || `<p class="fine">Belum ada staf.</p>`}
        <form method="post" action="/admin/outlet/${esc(o.id)}/staf">
          <label class="lbl">Tambah staf (nomor WA atau email)</label>
          <div class="actions"><input name="cari" required placeholder="0812… atau email" /><button class="btn btn-solid">Jadikan staf</button></div>
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
        <h2>${logoSlot(b)} ${esc(b.name)}</h2>
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

function stampChoices(selected: number): string {
  const opts: Array<[string, number]> = [
    ["0,25", 1],
    ["0,5", 2],
    ["0,75", 3],
    ["1", 4],
  ];
  return opts.map(([label, quarters]) => `<option value="${label}"${selected === quarters ? " selected" : ""}>${label} stamp</option>`).join("");
}

export function catalogPage(input: {
  stamps: number;
  brandName: string;
  brand: Brand;
  brands: Array<{ id: string; name: string; on: boolean }>;
  rewards: Array<{ id: string; title: string; stamps: number; cost: string; note: string; ready: boolean; icon: string; image: string; soldOut: boolean }>;
  params: URLSearchParams;
  birthday?: BirthdayNotice;
  birthdayReward?: string;
  now?: number;
  news?: Array<{ title: string; subtitle: string; kind: string; image: string; href?: string }>;
}): string {
  const art = brandArt(input.brand);
  const rewards = input.rewards
    .map((reward) => {
      const gap = reward.stamps - input.stamps;
      const stamps = Math.max(0, Math.trunc(reward.stamps));
      const onStamps = stamps === 1 ? "On 1 stamp" : `On ${stamps} stamps`;
      const action = reward.ready
        ? `<form class="redeemact" method="post" action="/tukar/stamp"><input type="hidden" name="tier" value="${esc(reward.id)}" /><input type="hidden" name="dari" value="hadiah" /><button class="textlink go" type="submit">Tukar</button></form>`
        : `<span class="soon">${reward.soldOut ? "Habis" : `Kurang ${gap} lagi`}</span>`;
      return `<article class="redeemrow"><span class="ic">${reward.image ? `<img src="${esc(reward.image)}" alt="" />` : esc(reward.icon || "🎁")}</span><div class="redeemcopy"><span class="freelabel">Free</span><b>${esc(reward.title)}</b><small>${esc(onStamps)}</small></div>${action}</article>`;
    })
    .join("");
  const news = (input.news || []).slice(0, 3).map((item) => {
    const photo = item.image || "";
    return `<a class="newscard" href="${esc(item.href || "#")}">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" decoding="async" width="860" height="430" sizes="(max-width: 440px) 100vw, 440px" />` : ""}<span class="tag">${esc(item.kind || "NEWS")}</span><div><b>${esc(item.title)}</b><small>${esc(item.subtitle)}</small><em>${esc(input.brand.short_name)}</em></div></a>`;
  });
  const skin = customerSkin(input.brand);
  return doc(
    "News & Redeem",
    `<main class="phone skin with-tabs${skin.dark ? " skin-dark" : ""}" style="${skin.style}">
      <div class="brandchip">${logoSlot(input.brand)} ${esc(art.full ? input.brand.short_name : input.brandName)}</div>
      <p class="stampbal">Stamps kamu udah <b>${input.stamps}</b> nih</p>
      <h2 class="sectiontitle">Tukerin stamp lu</h2>
      <div class="redeemlist">${rewards || `<p class="fine">Belum ada redeem.</p>`}</div>
      ${flashes(input.params)}
      <h2 class="sectiontitle">Lagi ada apa nih</h2>
      <div class="newslist">${news.join("") || `<p class="fine">Belum ada kabar.</p>`}</div>
      ${tabbar("hadiah", input.brand.id)}
    </main>`,
    skin.accent,
    input.brand.id,
  );
}

export function codePage(input: { code: string; label: string; brand: string; svg: string; remainingMs: number; status: string; claimUrl: string; brandTheme?: Brand | null }): string {
  const live = input.status === "pending";
  const skin = customerSkin(input.brandTheme || null);
  const mark = input.brandTheme ? stampMark(input.brandTheme) : `<img class="stampimg" src="${stampIconSrc("whisk")}" alt="" />`;
  return doc(
    "Kode tukar",
    `<main class="phone skin${skin.dark ? " skin-dark" : ""}" style="${skin.style}">
      <header class="hero center">
        <div class="qico">${mark}</div>
        <div class="hero-big">${esc(input.code)}</div>
        <div class="hero-fine">${esc(input.label)} · ${esc(input.brand)}</div>
      </header>
      ${
        live
          ? `<section class="card center" data-poll="/kode/${esc(input.claimUrl)}/status" data-remaining="${Math.max(0, input.remainingMs)}" data-ttl="600000">
              <p class="fine">Kasih kode ini ke kasir ya. Atau minta mereka scan QR. Berlaku sekitar 10 menit.</p>
              <div class="qrbox">${input.svg}</div>
              <div class="countpill">Berlaku <span data-count>10:00</span></div>
              <div class="track"><span data-bar></span></div>
              <p class="fine" data-wait>Nunggu kasir...</p>
            </section>`
          : input.status === "confirmed"
            ? `${confetti()}<section class="card center"><div class="qcheck burst">${CHECK}</div><h2>Yeay, hadiahnya sudah di tangan!</h2><p class="fine">${esc(input.label)}</p><a class="btn btn-solid" href="/kartu">Ke kartu</a></section>`
            : `<section class="card center"><h2>Kodenya hangus, stamp-nya balik</h2><a class="btn btn-solid" href="/kartu">Ke kartu</a></section>`
      }
    </main>`,
    skin.accent,
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
  missions: Array<{ id: string; title: string; points: string; limit: string; active: boolean; brand: string; icon: string; tag: string; mystery: boolean; unlock: string; sort: number; proof?: string }>;
  queue: Array<{ id: string; title: string; member: string; when: string; link: string; image: string }>;
  brands: Array<{ id: string; name: string }>;
  levels: Array<{ name: string; min: string; icon: string; brand: string }>;
  approved?: Array<{ id: string; title: string; member: string; points: string }>;
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
      (m) => `<div class="row"><span>${esc(m.icon)} <a href="/admin/misi/quest/${esc(m.id)}">${esc(m.title)}</a> · ${esc(m.points)} · ${esc(m.proof || "")} · ${esc(m.limit)} · ${esc(m.brand)}${m.tag ? ` · ${esc(m.tag)}` : ""}${m.mystery ? ` · rahasia sampai ${esc(m.unlock)}` : ""}</span>
        <form method="post" action="/admin/misi/${esc(m.id)}/aktif"><button class="textlink">${m.active ? "Matikan" : "Nyalakan"}</button></form></div>`,
    )
    .join("");
  const options = input.brands.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("");
  const badges = input.levels
    .map((level) => `<div class="row"><span>${esc(level.icon)} ${esc(level.name)} · ${esc(level.brand)}</span><b>${esc(level.min)} poin</b></div>`)
    .join("");
  const approved = (input.approved || [])
    .map(
      (row) => `<div class="row"><span>${esc(row.member)} · ${esc(row.title)} · ${esc(row.points)}</span>
        <form method="post" action="/admin/misi/${esc(row.id)}/tarik"><button class="textlink">Tarik stamp</button></form></div>`,
    )
    .join("");
  return adminShell(
    "/admin/misi",
    `<h1>Kelola Misi</h1>${flashes(input.params)}
     <p class="fine">Foto bukti langsung dapat pecahan stamp. Satu quest sekali per pelanggan. Kalau perlu, stamp quest bisa ditarik.</p>
     <h2 style="margin-top:16px">Menunggu dicek</h2>
     ${queue || `<p class="fine">Tidak ada yang menunggu.</p>`}
     <h2 style="margin-top:16px">Quest yang sudah masuk</h2>
     ${approved || `<p class="fine">Belum ada.</p>`}
     <form class="panel" style="margin-top:16px" method="post" action="/admin/misi">
       <h2>Quest baru</h2>
       <label class="lbl">Judul</label><input name="title" required maxlength="80" placeholder="Makan ayam pakai kuah gulai" />
       <label class="lbl">Deskripsi</label><textarea name="description" placeholder="Cerita singkat buat customer"></textarea>
       <label class="lbl">Langkah (satu baris satu langkah)</label><textarea name="steps" placeholder="Pesan menunya&#10;Tunjukin ke kasir"></textarea>
       <label class="lbl">Stamp</label><select name="points" required>${stampChoices(2)}</select>
       <label class="lbl">Ikon</label><input name="icon" maxlength="8" placeholder="🍜" />
       <label class="lbl">Tag</label><select name="tag"><option value="">Biasa</option><option value="new">NEW</option><option value="limited">Limited</option></select>
       <label class="lbl">Urutan</label><input name="sort" type="number" min="0" max="999" value="0" />
       <label class="lbl">Merek</label><select name="brand_id" required>${options}</select>
       <label class="lbl">Mulai</label><input name="starts" type="date" />
       <label class="lbl">Selesai</label><input name="ends" type="date" />
       <p class="fine">Sekali per pelanggan. Buktinya foto. Misi Google, Threads, dan Story tetap 1 stamp.</p>
       <label class="lbl">Pengecekan otomatis</label>
       <select name="check_kind"><option value="">Langsung masuk</option><option value="google">Review Google</option><option value="threads">Struk + produk</option><option value="story">Tag Instagram</option></select>
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
       <label class="lbl">Merek (kosong = semua)</label><select name="brand_id"><option value="">Semua merek</option>${options}</select>
       <button class="btn btn-solid">Simpan lencana</button>
     </form>
     <article class="panel" style="margin-top:12px"><h2>Lencana</h2>${badges || `<p>Belum ada lencana.</p>`}</article>`,
  );
}

export function adminTiersPage(input: {
  tiers: Array<{ id: string; brand: string; stamps: number; reward: string; icon: string; stock: string; active: boolean }>;
  brands: Array<{ id: string; name: string }>;
  params: URLSearchParams;
}): string {
  const options = input.brands.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("");
  const rows = input.tiers
    .map(
      (t) => `<div class="row"><span>${esc(t.icon)} ${esc(t.brand)} · ${esc(t.reward)} · ${t.stamps} stamp · stok ${esc(t.stock)}</span>
        <form method="post" action="/admin/tingkat/${esc(t.id)}/aktif"><button class="textlink">${t.active ? "Matikan" : "Nyalakan"}</button></form></div>`,
    )
    .join("");
  return adminShell(
    "/admin/tingkat",
    `<h1>Redeem</h1>${flashes(input.params)}
     <p class="fine">Reward ditukar pakai stamp utuh. 5 dan 10 cuma pintasan. Kosongkan stok kalau tidak dibatasi. Kode kasir tetap 5 angka, sekitar 10 menit. Kalau hangus, stamp kembali.</p>
     <form class="panel" style="margin-top:12px" method="post" action="/admin/tingkat" enctype="multipart/form-data">
       <label class="lbl">Merek</label><select name="brand_id" required>${options}</select>
       <label class="lbl">Nama hadiah</label><input name="reward_text" required maxlength="80" placeholder="Free upsize" />
       <label class="lbl">Ikon</label><input name="icon" maxlength="8" placeholder="🎁" />
       <label class="lbl">Foto (opsional)</label><input name="gambar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
       <label class="lbl">Pintasan</label>
       <label class="checkline"><input type="radio" name="preset" value="5" checked /> 5 stamp</label>
       <label class="checkline"><input type="radio" name="preset" value="10" /> 10 stamp</label>
       <label class="lbl">Atau jumlah stamp lain</label><input name="stamps" type="number" min="1" max="999" placeholder="misalnya 7" />
       <label class="lbl">Stok (kosong = tidak terbatas)</label><input name="stock" type="number" min="0" />
       <label class="checkline"><input type="checkbox" name="active" value="on" checked /> Aktif</label>
       <button class="btn btn-solid">Simpan</button>
     </form>
     <article class="panel" style="margin-top:12px">${rows || `<p>Belum ada hadiah.</p>`}</article>`,
  );
}

export function missionDetailPage(input: {
  id: string;
  brand: Brand | null;
  title: string;
  description: string;
  steps: string;
  points: string;
  open: boolean;
  locked: boolean;
  tease: string;
  photos: Array<{ src: string; caption: string }>;
  params: URLSearchParams;
  multi?: boolean;
}): string {
  const skin = customerSkin(input.brand);
  const slides = input.photos
    .filter((photo) => photo.src)
    .map(
      (photo, index) =>
        `<a class="slide" href="${esc(photo.src)}" target="_blank" rel="noopener"><img src="${esc(photo.src)}" alt="${esc(photo.caption || input.title)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} /></a>`,
    );
  const dots = slides.length > 1 ? `<div class="reel-dots">${slides.map((_, i) => `<button type="button" class="dot${i === 0 ? " on" : ""}" data-dot="${i}" aria-label="Foto ${i + 1}"></button>`).join("")}</div>` : "";
  const gallery = slides.length ? `<section class="reel guide" data-reel data-ms="5200">${dots}<div class="reel-track">${slides.join("")}</div></section>` : "";
  const steps = input.steps
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<li>${esc(line)}</li>`)
    .join("");
  const proof = input.locked
    ? `<p class="fine">${esc(input.tease || "Belum kebuka nih.")}</p>`
    : input.open
      ? `<form method="post" action="/misi/${esc(input.id)}" enctype="multipart/form-data">
          <label class="lbl">Foto bukti</label><input name="gambar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" ${input.multi ? "multiple" : ""} required />
          ${input.multi ? `<p class="fine">Boleh lebih dari satu foto: struk dan produk.</p>` : ""}
          <button class="btn btn-solid">Kirim bukti</button>
        </form>`
      : `<p class="fine">Quest ini sudah kamu selesaikan.</p>`;
  return doc(
    input.title,
    `<main class="phone skin with-tabs${skin.dark ? " skin-dark" : ""}" style="${skin.style}">
      ${gallery}
      ${flashes(input.params)}
      <section class="card">
        <div class="eyebrow">BONUS STAMP</div>
        <h1 class="display" style="font-size:1.6rem">${esc(input.title)}</h1>
        <span class="poinbadge sm"><b>${esc(input.points)}</b></span>
        <p class="fine">${esc(input.description)}</p>
        ${steps ? `<ol class="steps">${steps}</ol>` : ""}
        ${proof}
        <a class="btn btn-line" href="/kartu${input.brand ? `?merek=${esc(input.brand.id)}` : ""}#bonus-stamp">Kembali</a>
      </section>
      ${tabbar("kartu", input.brand?.id || "")}
    </main>`,
    skin.accent,
  );
}

export function waPage(input: { phase: "ask" | "wait" | "done"; link: string; code: string; otp: boolean; brand: Brand | null; remainingMs?: number }): string {
  const skin = customerSkin(input.brand);
  const otp = input.otp ? `<a class="textlink" href="/verifikasi/otp">Kirim kode OTP ke WA saya</a>` : "";
  const body =
    input.phase === "done"
      ? `${confetti()}<section class="card center"><div class="qcheck burst">${CHECK}</div><h1>Nomor terverifikasi ✓</h1><p class="fine">Sip, nomor kamu sudah ke-verif.</p><a class="btn btn-solid" href="/kartu">Ke kartu</a></section>`
      : input.phase === "wait"
        ? `<section class="card center" data-poll="/verifikasi/status" data-remaining="${Math.max(0, input.remainingMs || 0)}" data-ttl="600000">
            <h1>Menunggu pesan kamu…</h1>
            <p class="fine" data-wait>Kirim WA-nya ya, biar nomor kamu ke-verif.</p>
            <div class="countpill">Kode <span data-count>10:00</span></div>
            <a class="btn btn-solid" href="${esc(input.link)}">Buka WA lagi</a>
            ${otp}
          </section>`
        : `<section class="card center">
            <h1>Verifikasi nomor WA</h1>
            <p class="fine">Kirim WA-nya ya, biar nomor kamu ke-verif. Kode-nya sudah kami siapkan.</p>
            <a class="btn btn-solid" href="${esc(input.link)}">Verifikasi via WA</a>
            <a class="btn btn-line" href="/verifikasi?tunggu=1">Sudah kirim, tunggu di sini</a>
            ${otp}
          </section>`;
  return doc("Verifikasi WA", `<main class="phone skin${skin.dark ? " skin-dark" : ""}" style="${skin.style}">${body}</main>`, skin.accent);
}

export function adminMissionEditPage(input: {
  mission: {
    id: string;
    brand_id: string | null;
    title: string;
    description: string;
    steps?: string;
    points_tenths: number;
    points_quarters?: number;
    icon: string;
    tag: string;
    mystery: number;
    tease: string;
    unlock_points_tenths: number;
    sort_order: number;
    limit_kind: string;
    proof_kind?: string;
    check_kind?: string;
    proof_screenshot: number;
    proof_link: number;
    starts_at?: number | null;
    ends_at?: number | null;
    active: number;
  };
  brands: Array<{ id: string; name: string }>;
  photos: Array<{ id: string; caption: string; sort: number; src: string }>;
  params: URLSearchParams;
}): string {
  const m = input.mission;
  const options = input.brands.map((b) => `<option value="${esc(b.id)}"${b.id === m.brand_id ? " selected" : ""}>${esc(b.name)}</option>`).join("");
  const award = missionQuarters(m);
  const photos = input.photos
    .map(
      (photo) => `<div class="row">
        ${photo.src ? `<img src="${esc(photo.src)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:12px" />` : ""}
        <input name="caption_${esc(photo.id)}" value="${esc(photo.caption)}" maxlength="80" placeholder="Keterangan" />
        <input name="sort_${esc(photo.id)}" type="number" min="0" max="99" value="${photo.sort}" />
        <button class="textlink" formaction="/admin/misi/quest/${esc(m.id)}/foto/${esc(photo.id)}/buang" formmethod="post">Hapus</button>
      </div>`,
    )
    .join("");
  return adminShell(
    "/admin/misi",
    `<p><a href="/admin/misi">← Kelola Misi</a></p>
     <h1>Edit quest</h1>${flashes(input.params)}
     <form class="panel" style="margin-top:12px" method="post" action="/admin/misi/quest/${esc(m.id)}/simpan">
       <label class="lbl">Judul</label><input name="title" required maxlength="80" value="${esc(m.title)}" />
       <label class="lbl">Deskripsi</label><textarea name="description">${esc(m.description)}</textarea>
       <label class="lbl">Langkah</label><textarea name="steps">${esc(m.steps || "")}</textarea>
       <label class="lbl">Stamp</label><select name="points" required>${stampChoices(award || 2)}</select>
       <label class="lbl">Ikon</label><input name="icon" maxlength="8" value="${esc(m.icon)}" />
       <label class="lbl">Tag</label><select name="tag"><option value="">Biasa</option><option value="new" ${m.tag === "new" ? "selected" : ""}>NEW</option><option value="limited" ${m.tag === "limited" ? "selected" : ""}>Limited</option></select>
       <label class="lbl">Urutan</label><input name="sort" type="number" min="0" max="999" value="${m.sort_order}" />
       <label class="lbl">Merek</label><select name="brand_id" required>${options}</select>
       <label class="lbl">Mulai</label><input name="starts" type="date" value="${m.starts_at ? esc(toWibDateInput(m.starts_at)) : ""}" />
       <label class="lbl">Selesai</label><input name="ends" type="date" value="${m.ends_at ? esc(toWibDateInput(m.ends_at)) : ""}" />
       <p class="fine">Sekali per pelanggan. Buktinya foto. Misi Google, Threads, dan Story tetap 1 stamp.</p>
       <label class="lbl">Pengecekan otomatis</label>
       <select name="check_kind">
         <option value="" ${m.check_kind ? "" : "selected"}>Langsung masuk</option>
         <option value="google" ${m.check_kind === "google" ? "selected" : ""}>Review Google</option>
         <option value="threads" ${m.check_kind === "threads" ? "selected" : ""}>Struk + produk</option>
         <option value="story" ${m.check_kind === "story" ? "selected" : ""}>Tag Instagram</option>
       </select>
       <label class="checkline"><input type="checkbox" name="mystery" ${m.mystery ? "checked" : ""} /> Quest rahasia</label>
       <label class="checkline"><input type="checkbox" name="active" ${m.active ? "checked" : ""} /> Aktif</label>
       <label class="lbl">Teks godaan</label><input name="tease" maxlength="140" value="${esc(m.tease)}" />
       <label class="lbl">Terbuka setelah poin</label><input name="unlock" value="${m.unlock_points_tenths ? (m.unlock_points_tenths / 10).toString() : "0"}" />
       <button class="btn btn-solid">Simpan</button>
     </form>
     <form class="panel" style="margin-top:12px" method="post" action="/admin/misi/quest/${esc(m.id)}/urut">
       <h2>Foto instruksi</h2>
       <p class="fine">Isi keterangan dan urutan, lalu simpan. Hapus lewat tombol di barisnya.</p>
       ${photos || `<p class="fine">Belum ada foto.</p>`}
       ${photos ? `<button class="btn btn-solid">Simpan urutan</button>` : ""}
     </form>
     <form class="panel" style="margin-top:12px" method="post" action="/admin/misi/quest/${esc(m.id)}/foto" enctype="multipart/form-data">
       <label class="lbl">Tambah foto</label><input name="gambar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required />
       <label class="lbl">Keterangan</label><input name="caption" maxlength="80" />
       <button class="btn btn-line">Unggah</button>
     </form>`,
  );
}
