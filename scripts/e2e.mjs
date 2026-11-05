import { readFileSync } from "node:fs";

const base = "http://127.0.0.1:8787";
const ownerPassword = readFileSync(".dev.vars", "utf8")
  .split("\n")
  .find((line) => line.startsWith("OWNER_PASSWORD="))
  ?.slice("OWNER_PASSWORD=".length)
  .trim()
  .replace(/^["']|["']$/g, "");
if (!ownerPassword) {
  console.error("OWNER_PASSWORD belum ada di .dev.vars");
  process.exit(1);
}

function jar() {
  const cookies = new Map();
  return {
    headers(extra = {}) {
      const cookie = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
      return { origin: base, ...(cookie ? { cookie } : {}), ...extra };
    },
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() || []) {
        const pair = line.split(";")[0];
        const i = pair.indexOf("=");
        cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      }
    },
  };
}

async function req(j, path, opts = {}) {
  const res = await fetch(base + path, { redirect: "manual", ...opts, headers: j.headers(opts.headers || {}) });
  j.absorb(res);
  const text = await res.text();
  return { status: res.status, loc: res.headers.get("location"), text };
}

function form(j, path, data) {
  return req(j, path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data),
  });
}

function assert(cond, message, extra = "") {
  if (!cond) {
    console.error("GAGAL:", message);
    if (extra) console.error(extra.slice(0, 500));
    process.exit(1);
  }
  console.log("ok", message);
}

const kasir = jar();
const rina = jar();
const sari = jar();
const baru = jar();
const owner = jar();

const home = await req(kasir, "/");
assert(home.status === 200 && home.text.includes("Gabung"), "halaman depan");

const masukKasir = await form(kasir, "/kasir/masuk", { outlet_id: "o_loft", pin: "258025" });
assert(masukKasir.status === 303 && masukKasir.loc === "/kasir/meja", "kasir masuk", masukKasir.loc || "");

const tanpa = await form(kasir, "/kasir/stamp", {});
assert(tanpa.loc?.includes("err=syarat"), "tanpa centang ditolak", tanpa.loc || "");

const buka = await form(kasir, "/kasir/stamp", { syarat: "on" });
assert(buka.status === 303 && buka.loc?.startsWith("/kasir/qr/"), "QR dibuat", buka.loc || "");
const qr = await req(kasir, buka.loc);
assert(qr.status === 200 && qr.text.includes("<svg"), "halaman QR", qr.text.slice(0, 200));
const tokenAbs = qr.text.match(/data-url="([^"]+)"/)?.[1];
const tokenPath = tokenAbs ? new URL(tokenAbs).pathname : "";
assert(tokenPath.startsWith("/k/"), "link QR ketemu", tokenAbs || "");

const loginRina = await form(rina, "/masuk", { wa: "081234564567", pin: "2468", next: "/kartu" });
assert(loginRina.status === 303, "Rina masuk", loginRina.loc || loginRina.text.slice(0, 200));

const klaim = await req(rina, tokenPath);
assert(klaim.status === 303 && klaim.loc?.startsWith("/berhasil/"), "stamp masuk", klaim.loc || klaim.text.slice(0, 300));
const sukses = await req(rina, klaim.loc);
assert(sukses.status === 200 && sukses.text.includes("+1 stamp"), "layar sukses", sukses.text.slice(0, 300));

const ulang = await req(rina, tokenPath);
assert(ulang.status === 400 && ulang.text.includes("sudah dipakai"), "token sekali pakai", ulang.text.slice(0, 300));

const status = await req(kasir, `${buka.loc}/status`);
assert(status.status === 200 && status.text.includes("claimed"), "kasir lihat yang klaim", status.text);

const meja = await req(kasir, "/kasir/meja");
const batalMatch = meja.text.match(/action="(\/kasir\/batal\/[^"]+)"/);
assert(batalMatch, "tombol batal ada", meja.text.slice(0, 400));
const batal = await form(kasir, batalMatch[1], {});
assert(batal.loc?.includes("ok=batal"), "batal stamp", batal.loc || "");

const manual = await form(kasir, "/kasir/stamp/manual", { wa: "081234564567", syarat: "on" });
assert(manual.loc?.includes("ok=stamp"), "stamp cadangan nomor WA", manual.loc || "");
const lagi = await form(kasir, "/kasir/stamp/manual", { wa: "081234564567", syarat: "on" });
assert(lagi.loc?.includes("err=cap"), "batas harian menolak stamp ke-3", lagi.loc || "");

const cari = await form(kasir, "/kasir/cari", { wa: "081311110088" });
assert(cari.loc?.includes("wa="), "cari Sari", cari.loc || "");
const ketemu = await req(kasir, cari.loc);
assert(ketemu.text.includes("Sari") && ketemu.text.includes("Tukar Reward"), "Sari siap ditukar");
const member = ketemu.text.match(/member=([^"&]+)/)?.[1];
assert(member, "id member");
const yakin = await req(kasir, `/kasir/tukar?member=${member}`);
assert(yakin.text.includes("tukar sekarang"), "halaman yakin tukar");
const tukar = await form(kasir, "/kasir/redeem/manual", { member_id: decodeURIComponent(member) });
assert(tukar.loc?.includes("ok=redeem"), "reward ditukar", tukar.loc || "");

const loginSari = await form(sari, "/masuk", { wa: "0813 1111 0088", pin: "2468", next: "/kartu?merek=loft25" });
assert(loginSari.status === 303, "Sari masuk");
const kartuSari = await req(sari, "/kartu?merek=loft25");
assert(kartuSari.text.includes("0/10") || kartuSari.text.includes(">0<"), "sisa stamp Sari 0", kartuSari.text.match(/\d+\/10/)?.[0] || "");

const gabung = await form(baru, "/gabung", {
  nama: "Ayu Lestari",
  wa: "081298760099",
  pin: "9753",
  pin2: "9753",
  merek: "loft25",
  next: "/kartu",
});
assert(gabung.status === 303, "member baru gabung", gabung.loc || gabung.text.slice(0, 250));
const kartuBaru = await req(baru, gabung.loc);
assert(kartuBaru.text.includes("Ayu"), "kartu Ayu");

for (let i = 0; i < 5; i++) {
  const salah = await form(jar(), "/masuk", { wa: "081298760099", pin: "0000", next: "/kartu" });
  assert(salah.status === 400, `pin salah ${i + 1}`);
}
const kunci = await form(jar(), "/masuk", { wa: "081298760099", pin: "9753", next: "/kartu" });
assert(kunci.text.includes("Terlalu banyak"), "rate limit PIN", kunci.text.slice(0, 200));

const bukaRedeem = await form(kasir, "/kasir/redeem", {});
assert(bukaRedeem.loc?.startsWith("/kasir/qr/"), "QR tukar");
const qrRedeem = await req(kasir, bukaRedeem.loc);
const redeemAbs = qrRedeem.text.match(/data-url="([^"]+)"/)?.[1];
const redeemPath = redeemAbs ? new URL(redeemAbs).pathname : "";
const klaimRedeem = await req(rina, redeemPath);
assert(klaimRedeem.status === 400 && klaimRedeem.text.toLowerCase().includes("belum cukup"), "Rina belum bisa tukar", klaimRedeem.text.slice(0, 250));

const ownerIn = await form(owner, "/admin/masuk", { password: ownerPassword });
assert(ownerIn.loc === "/admin/dasbor", "owner masuk", ownerIn.loc || ownerIn.text.slice(0, 200));
const dasbor = await req(owner, "/admin/dasbor");
assert(dasbor.text.includes("Stamp per hari") && dasbor.text.includes("Rina"), "dasbor");
const csv = await req(owner, "/admin/aktivitas.csv");
assert(csv.status === 200 && csv.text.includes("waktu") && csv.text.includes("Rina"), "csv");
const aturan = await req(owner, "/admin/aturan");
assert(aturan.text.includes("Transaksi min Rp50.000"), "aturan merek");

console.log("SEMUA ALUR LOKAL LULUS");
