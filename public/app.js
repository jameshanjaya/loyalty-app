function boot() {
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

document.querySelectorAll("[data-print]").forEach((el) => {
  el.addEventListener("click", () => window.print());
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
document.addEventListener("DOMContentLoaded", boot);
