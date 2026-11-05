function bootPoll() {
  const box = document.querySelector("[data-poll]");
  if (!box) return;
  const url = box.getAttribute("data-poll");
  const remaining0 = Number(box.getAttribute("data-remaining") || "0");
  const ttl = Number(box.getAttribute("data-ttl") || "60000");
  const started = Date.now();
  const label = box.querySelector("[data-count]");
  const bar = box.querySelector("[data-bar]");
  const wait = box.querySelector("[data-wait]");
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    const left = Math.max(0, remaining0 - (Date.now() - started));
    const s = Math.ceil(left / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (label) label.textContent = `${m}:${String(r).padStart(2, "0")}`;
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, (left / ttl) * 100))}%`;
    if (left <= 0) {
      stopped = true;
      if (wait) wait.textContent = "QR hangus. Tap Kasih Stamp lagi.";
      return;
    }
    setTimeout(tick, 250);
  };
  tick();

  const poll = async () => {
    if (stopped || !url) return;
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      const data = await res.json();
      if (data.status && data.status !== "pending") {
        location.reload();
        return;
      }
    } catch {
      /* coba lagi */
    }
    setTimeout(poll, 2000);
  };
  poll();
}

function bootReel() {
  document.querySelectorAll("[data-reel]").forEach((root) => {
    const track = root.querySelector(".reel-track");
    const dots = [...root.querySelectorAll("[data-dot]")];
    if (!track || dots.length < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer = 0;
    let paused = false;
    const width = () => track.clientWidth || 1;
    const current = () => Math.round(track.scrollLeft / width());
    const mark = () => {
      const index = current();
      dots.forEach((dot, n) => dot.classList.toggle("on", n === index));
    };
    const go = (index) => {
      track.scrollTo({ left: width() * index, behavior: reduced ? "auto" : "smooth" });
    };
    track.addEventListener("scroll", mark, { passive: true });
    dots.forEach((dot) => {
      dot.addEventListener("click", () => go(Number(dot.getAttribute("data-dot") || "0")));
    });
    const arm = () => {
      window.clearInterval(timer);
      if (reduced || paused || document.hidden) return;
      const ms = Number(root.getAttribute("data-ms") || "4800");
      timer = window.setInterval(() => go((current() + 1) % dots.length), ms);
    };
    track.addEventListener("pointerdown", () => {
      paused = true;
      window.clearInterval(timer);
    });
    const resume = () => {
      paused = false;
      arm();
    };
    track.addEventListener("pointerup", resume);
    track.addEventListener("pointercancel", resume);
    document.addEventListener("visibilitychange", arm);
    arm();
  });
}

function bootScan() {
  let loading = false;
  document.querySelectorAll("[data-scan]").forEach((button) => {
    button.addEventListener("click", () => {
      if (window.__loyaltyScan) {
        window.__loyaltyScan();
        return;
      }
      if (loading) return;
      loading = true;
      const tag = document.createElement("script");
      tag.type = "module";
      tag.src = "/scan.js";
      tag.onerror = () => {
        loading = false;
        const root = document.querySelector("[data-scanner]");
        const fallback = root && root.querySelector("[data-scan-fallback]");
        if (root) root.hidden = false;
        if (fallback) fallback.hidden = false;
      };
      document.body.appendChild(tag);
    });
  });
  document.querySelectorAll("[data-scan-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      const root = document.querySelector("[data-scanner]");
      if (root) root.hidden = true;
    });
  });
}

function bootBirthday() {
  document.querySelectorAll("[data-bday]").forEach((el) => {
    const target = Number(el.getAttribute("data-bday"));
    const label = el.querySelector("[data-bday-label]");
    if (!label || !Number.isFinite(target)) return;
    let reloaded = false;
    const tick = () => {
      const left = target - Date.now();
      if (left <= 0) {
        if (!reloaded) {
          reloaded = true;
          location.reload();
        }
        return;
      }
      const total = Math.floor(left / 60000);
      const days = Math.floor(total / 1440);
      const hours = Math.floor((total % 1440) / 60);
      const minutes = total % 60;
      label.textContent = `Claim your gift in ${days} days ${hours} hours ${minutes} minutes`;
    };
    tick();
    setInterval(tick, 60000);
  });
}

function boot() {
  bootPoll();
  bootReel();
  bootScan();
  bootBirthday();
}

document.querySelectorAll("[data-print]").forEach((el) => {
  el.addEventListener("click", () => window.print());
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
document.addEventListener("DOMContentLoaded", boot);
