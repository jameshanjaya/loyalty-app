import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const base = "http://127.0.0.1:8787";
const outDir = "/opt/cursor/artifacts/screenshots";
mkdirSync(outDir, { recursive: true });
const now = Date.now();
const sid = "sess_profil_demo";
const pid = "pend_profil_demo";
spawnSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "loyalty-bos",
    "--local",
    "--command",
    `DELETE FROM sessions WHERE id='${sid}'; DELETE FROM google_pending WHERE id='${pid}'; INSERT INTO google_pending (id, sub, email, name, created_at) VALUES ('${pid}','google-demo-sub','ayu.demo@gmail.com','Ayu Lestari',${now}); INSERT INTO sessions (id, kind, subject_id, created_at, expires_at) VALUES ('${sid}','signup','${pid}',${now},${now + 3600_000});`,
  ],
  { stdio: "inherit" },
);

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
}

const rina = jar();
const owner = jar();
await form(rina, "/masuk", { wa: "081234564567", pin: "2468", next: "/kartu" });
const ownerPassword = readFileSync(".dev.vars", "utf8")
  .split("\n")
  .find((line) => line.startsWith("OWNER_PASSWORD="))
  ?.slice("OWNER_PASSWORD=".length)
  .trim();
await form(owner, "/admin/masuk", { password: ownerPassword || "" });

const dir = mkdtempSync(`${tmpdir()}/chr-`);
const chrome = spawn(
  "/usr/local/bin/google-chrome",
  ["--headless=new", "--no-sandbox", "--disable-gpu", `--user-data-dir=${dir}`, "--remote-debugging-port=9334", "about:blank"],
  { stdio: "ignore" },
);
for (let i = 0; i < 40; i++) {
  try {
    if ((await fetch("http://127.0.0.1:9334/json/version")).ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}
const tab = await fetch("http://127.0.0.1:9334/json/new?about:blank", { method: "PUT" }).then((r) => r.json());
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
  for (const cookie of cookies) await send("Network.setCookie", { name: cookie.name, value: cookie.value, url: base });
  await send("Page.enable");
  await send("Page.navigate", { url: base + path });
  await new Promise((r) => setTimeout(r, 800));
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${outDir}/${file}`, Buffer.from(shot.result.data, "base64"));
  console.log("saved", file);
}

await shoot("login-google.png", [], "/masuk", 430, 900);
await shoot("profil-google.png", [{ name: "lb_member", value: sid }], "/profil", 430, 1100);
await shoot("kartu-ultah.png", rina.list(), "/kartu?merek=loft25", 430, 1200);
await shoot("member-list.png", owner.list(), "/admin/member", 1280, 900);
ws.close();
chrome.kill();
