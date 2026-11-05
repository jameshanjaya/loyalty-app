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
    setTimeout(tick, 1000);
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
    const warm = (index) => {
      const slide = track.children[index];
      const img = slide && slide.querySelector("img[data-src]");
      if (!img) return;
      img.src = img.getAttribute("data-src");
      img.removeAttribute("data-src");
    };
    track.addEventListener(
      "scroll",
      () => {
        mark();
        warm(current());
        warm(current() + 1);
      },
      { passive: true },
    );
    warm(1);
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

function paintFlip(root, left) {
  const parts = {
    dd: Math.floor(left / 86400000),
    hh: Math.floor((left % 86400000) / 3600000),
    mm: Math.floor((left % 3600000) / 60000),
    ss: Math.floor((left % 60000) / 1000),
  };
  for (const key of Object.keys(parts)) {
    const box = root.querySelector(`[data-${key}]`);
    if (!box) continue;
    const text = String(Math.max(0, parts[key])).padStart(2, "0");
    box.innerHTML = text
      .split("")
      .map((digit) => `<span class="d">${digit}</span>`)
      .join("");
  }
}

function bootBirthday() {
  document.querySelectorAll("[data-bday]").forEach((el) => {
    const target = Number(el.getAttribute("data-bday"));
    if (!Number.isFinite(target)) return;
    const label = el.querySelector("[data-bday-label]");
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
      if (el.querySelector("[data-dd]")) paintFlip(el, left);
      if (label) {
        const total = Math.floor(left / 60000);
        const days = Math.floor(total / 1440);
        const hours = Math.floor((total % 1440) / 60);
        const minutes = total % 60;
        label.textContent = `Claim your birthday gift in ${days} days ${hours} hours ${minutes} minutes`;
      }
    };
    tick();
    setInterval(tick, el.querySelector("[data-dd]") ? 1000 : 60000);
  });
}

function bootRail() {
  const rail = document.querySelector("[data-rail]");
  if (!rail) return;
  const cards = [...rail.querySelectorAll(".stampcard")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mark = () => {
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let best = cards[0];
    let bestDist = Infinity;
    for (const card of cards) {
      const center = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        best = card;
        bestDist = dist;
      }
    }
    cards.forEach((card) => card.classList.toggle("on", card === best));
    document.querySelectorAll("[data-dot-brand]").forEach((dot) => {
      dot.classList.toggle("on", dot.getAttribute("data-dot-brand") === (best && best.getAttribute("data-brand")));
    });
    return best;
  };
  rail.addEventListener("scroll", () => mark(), { passive: true });
  const show = (id) => {
    if (!id) return;
    document.querySelectorAll("[data-pane]").forEach((pane) => {
      pane.hidden = pane.getAttribute("data-pane") !== id;
    });
    const skin = document.querySelector(`.stage[data-pane="${id}"]`);
    const root = document.querySelector("[data-brand-root]");
    if (skin && root) {
      root.setAttribute("style", skin.getAttribute("data-skin") || "");
      root.classList.toggle("skin-dark", skin.getAttribute("data-dark") === "1");
      root.classList.add(reduced ? "theme-fade" : "theme-shift");
    }
    document.querySelectorAll(".tabbar a").forEach((link) => {
      const url = new URL(link.getAttribute("href"), location.origin);
      url.searchParams.set("merek", id);
      link.setAttribute("href", `${url.pathname}${url.search}`);
    });
    const here = new URL(location.href);
    if (here.searchParams.get("merek") !== id) {
      here.searchParams.set("merek", id);
      history.replaceState({}, "", `${here.pathname}${here.search}`);
    }
  };
  let timer = 0;
  rail.addEventListener("scrollend", () => {
    const card = mark();
    if (!card || cards.length < 2) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => show(card.getAttribute("data-brand")), reduced ? 0 : 160);
  });
  const active = rail.querySelector(".stampcard.on");
  if (active && cards.length > 1) active.scrollIntoView({ inline: "center", block: "nearest" });
  mark();
}

function bootVerify() {
  const sheet = document.querySelector("[data-verify-sheet]");
  const dim = document.querySelector("[data-verify-dim]");
  if (!sheet) return;
  const open = async () => {
    sheet.hidden = false;
    if (dim) dim.hidden = false;
    const go = sheet.querySelector("[data-verify-go]");
    if (!go || go.getAttribute("href") !== "#") return;
    try {
      const res = await fetch("/verifikasi/wa", { method: "POST", headers: { accept: "application/json" } });
      const data = await res.json();
      if (data.deepLink) go.setAttribute("href", data.deepLink);
    } catch {
      /* stub stays */
    }
  };
  document.querySelectorAll("[data-open-verify]").forEach((button) => {
    button.addEventListener("click", () => open());
  });
  if (dim) dim.addEventListener("click", () => {
    sheet.hidden = true;
    dim.hidden = true;
  });
}

function bootWa() {
  document.querySelectorAll("[data-track]").forEach((link) => {
    link.addEventListener("click", () => {
      const track = link.getAttribute("data-track");
      if (track && navigator.sendBeacon) navigator.sendBeacon(track);
    });
  });
}

function bootCrop() {
  document.querySelectorAll("[data-crop]").forEach((form) => {
    const file = form.querySelector("[data-crop-file]");
    const canvas = form.querySelector("[data-crop-canvas]");
    if (!file || !canvas) return;
    let image = null;
    let offsetX = 0;
    let offsetY = 0;
    let drag = null;
    const draw = () => {
      if (!image) return;
      const width = 640;
      const height = 320;
      canvas.width = width;
      canvas.height = height;
      const scale = Math.max(width / image.width, height / image.height);
      const dw = image.width * scale;
      const dh = image.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, (width - dw) / 2 + offsetX, (height - dh) / 2 + offsetY, dw, dh);
    };
    file.addEventListener("change", () => {
      const picked = file.files && file.files[0];
      if (!picked) return;
      const next = new Image();
      next.onload = () => {
        image = next;
        offsetX = 0;
        offsetY = 0;
        canvas.hidden = false;
        draw();
      };
      next.src = URL.createObjectURL(picked);
    });
    canvas.addEventListener("pointerdown", (event) => {
      drag = { x: event.clientX, y: event.clientY, offsetX, offsetY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drag) return;
      offsetX = drag.offsetX + (event.clientX - drag.x);
      offsetY = drag.offsetY + (event.clientY - drag.y);
      draw();
    });
    canvas.addEventListener("pointerup", () => {
      drag = null;
    });
    form.addEventListener("submit", (event) => {
      if (!image) return;
      event.preventDefault();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const data = new FormData(form);
        data.set("gambar", new File([blob], "crop.jpg", { type: "image/jpeg" }));
        const response = await fetch(form.action, { method: "POST", body: data, credentials: "same-origin" });
        location.href = response.url || "/admin/banner?ok=simpan";
      }, "image/jpeg", 0.9);
    });
  });
}

function bootInstall() {
  const box = document.querySelector("[data-install]");
  if (!box || !document.querySelector("[data-member]")) return;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (standalone) return;
  const hiddenUntil = Number(localStorage.getItem("loyalty-install-hide") || "0");
  if (hiddenUntil > Date.now()) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const iosNote = box.querySelector("[data-ios]");
  if (ios && iosNote) iosNote.hidden = false;
  box.hidden = false;
  let promptEvent = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptEvent = event;
  });
  const hide = () => {
    box.hidden = true;
    localStorage.setItem("loyalty-install-hide", String(Date.now() + 7 * 86400000));
  };
  const later = box.querySelector("[data-install-no]");
  const go = box.querySelector("[data-install-go]");
  if (later) later.addEventListener("click", hide);
  if (go) {
    go.addEventListener("click", async () => {
      if (promptEvent) {
        promptEvent.prompt();
        await promptEvent.userChoice;
      }
      hide();
    });
  }
  if (reduced) box.style.animation = "none";
}

function bootShare() {
  document.querySelectorAll("[data-share]").forEach((button) => {
    button.addEventListener("click", async () => {
      const url = button.getAttribute("data-url") || location.href;
      const text = "Ajak temen ke kartu stamp";
      if (navigator.share) {
        try {
          await navigator.share({ title: "Ajak temen", text, url });
          return;
        } catch {
          /* salin aja */
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        button.textContent = "Link ke-copy";
      } catch {
        window.prompt("Salin link ini", url);
      }
    });
  });
}

function bootCelebrate() {
  if (!document.querySelector("[data-tepok]")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
}

function boot() {
  bootPoll();
  bootReel();
  bootScan();
  bootBirthday();
  bootWa();
  bootRail();
  bootVerify();
  bootCrop();
  bootInstall();
  bootShare();
  bootCelebrate();
}

document.querySelectorAll("[data-print]").forEach((el) => {
  el.addEventListener("click", () => window.print());
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
document.addEventListener("DOMContentLoaded", boot);
