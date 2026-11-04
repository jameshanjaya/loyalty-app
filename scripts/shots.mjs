import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const base = "http://127.0.0.1:8787";
const outDir = "/opt/cursor/artifacts/screenshots";
mkdirSync(outDir, { recursive: true });

function jar() {
  const cookies = new Map();
  return {
    headers(extra = {}) {
      const cookie = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
      return { origin: base, ...(cookie ? { cookie } : {}), ...extra };
    },
    list() {
      return [...cookies.entries()].map(([name, value]) => ({ name, value: decodeURIComponent(value) }));
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

async function form(j, path, data) {
  const res = await fetch(base + path, {
    method: "POST",
    redirect: "manual",
    headers: j.headers({ "content-type": "application/x-www-form-urlencoded" }),
    body: new URLSearchParams(data),
  });
  j.absorb(res);
  return { status: res.status, loc: res.headers.get("location"), text: await res.text() };
}
async function get(j, path) {
  const res = await fetch(base + path, { redirect: "manual", headers: j.headers() });
  j.absorb(res);
  return { status: res.status, loc: res.headers.get("location"), text: await res.text() };
}

const dewi = jar();
const rina = jar();
const kasir = jar();
const owner = jar();
await form(rina, "/masuk", { wa: "081234564567", pin: "2468", next: "/kartu?merek=loft25" });
await form(dewi, "/masuk", { wa: "081377770035", pin: "2468", next: "/kartu?merek=loft25" });
await form(kasir, "/kasir/masuk", { outlet_id: "o_loft", pin: "258025" });
const ownerPassword = readFileSync(".dev.vars", "utf8")
  .split("\n")
  .find((line) => line.startsWith("OWNER_PASSWORD="))
  ?.slice("OWNER_PASSWORD=".length)
  .trim()
  .replace(/^["']|["']$/g, "");
await form(owner, "/admin/masuk", { password: ownerPassword || "" });
const opened = await form(kasir, "/kasir/stamp", { syarat: "on" });
const qrHtml = await get(kasir, opened.loc);
const claimAbs = qrHtml.text.match(/data-url="([^"]+)"/)?.[1];
if (!claimAbs) throw new Error("no qr");
const claimPath = new URL(claimAbs).pathname;

const dir = mkdtempSync(`${tmpdir()}/chr-`);
const chrome = spawn(
  "/usr/local/bin/google-chrome",
  ["--headless=new", "--no-sandbox", "--disable-gpu", `--user-data-dir=${dir}`, "--remote-debugging-port=9333", "about:blank"],
  { stdio: "ignore" },
);
for (let i = 0; i < 40; i++) {
  try {
    const ping = await fetch("http://127.0.0.1:9333/json/version");
    if (ping.ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (i === 39) throw new Error("chrome tidak nyala");
}

const tab = await fetch("http://127.0.0.1:9333/json/new?about:blank", { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
let seq = 0;
const waiters = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && waiters.has(msg.id)) waiters.get(msg.id)(msg);
});
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve) => {
    waiters.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function shoot(file, cookies, path, width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  await send("Network.enable");
  await send("Network.clearBrowserCookies");
  for (const cookie of cookies) {
    await send("Network.setCookie", { name: cookie.name, value: cookie.value, url: base });
  }
  await send("Page.enable");
  await send("Page.navigate", { url: base + path });
  await new Promise((r) => setTimeout(r, 700));
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${outDir}/${file}`, Buffer.from(shot.result.data, "base64"));
  console.log("saved", file);
}

await shoot("kartu.png", rina.list(), "/kartu?merek=loft25", 430, 1100);
await shoot("kasir.png", kasir.list(), "/kasir/meja", 430, 1100);
await shoot("kasir-qr.png", kasir.list(), opened.loc, 430, 980);
const claimed = await get(dewi, claimPath);
if (!claimed.loc?.startsWith("/berhasil/")) throw new Error(`klaim gagal ${claimed.status} ${claimed.text.slice(0, 180)}`);
await shoot("sukses.png", dewi.list(), claimed.loc, 430, 980);
await shoot("kartu.png", dewi.list(), "/kartu?merek=loft25", 430, 1100);
await shoot("dasbor.png", owner.list(), "/admin/dasbor", 1280, 900);
await shoot("dasbor-merek.png", owner.list(), "/admin/dasbor?merek=loft25", 1280, 980);
ws.close();
chrome.kill();
console.log("selesai");
