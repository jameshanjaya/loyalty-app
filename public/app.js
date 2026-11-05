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

async function decodeImg(img) {
  if (!img) return;
  const src = img.getAttribute("data-src");
  if (src) {
    img.src = src;
    img.removeAttribute("data-src");
  }
  if (!img.src || !img.decode) return;
  try {
    await img.decode();
  } catch {
    /* gambar tetap tampil */
  }
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
    const warm = (index) => {
      const slide = track.children[index];
      return decodeImg(slide && slide.querySelector("img"));
    };
    const go = (index) => {
      warm(index).then(() => {
        track.scrollTo({ left: width() * index, behavior: reduced ? "auto" : "smooth" });
      });
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

let birthdayTimers = [];
function bootBirthday() {
  birthdayTimers.forEach((timer) => window.clearInterval(timer));
  birthdayTimers = [];
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
        label.textContent = `Hadiah ultah dalam ${days} hari ${hours} jam ${minutes} menit`;
      }
    };
    tick();
    birthdayTimers.push(window.setInterval(tick, el.querySelector("[data-dd]") ? 1000 : 60000));
  });
}

function rememberBrand(id) {
  if (!id) return;
  try {
    localStorage.setItem("loyalty-brand", id);
  } catch {
    /* private mode */
  }
}

function bootRail() {
  const rail = document.querySelector("[data-rail]");
  const root = document.querySelector("[data-brand-root]");
  if (!rail || !root) return;
  const page = root.querySelector("[data-page]") || root;
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
  const pointTabs = (id) => {
    document.querySelectorAll(".tabbar a").forEach((link) => {
      const url = new URL(link.getAttribute("href"), location.origin);
      url.searchParams.set("merek", id);
      link.setAttribute("href", `${url.pathname}${url.search}`);
    });
    rememberBrand(id);
  };
  let token = 0;
  const show = async (id, mine) => {
    if (!id) return;
    const incoming = [...document.querySelectorAll(`[data-pane="${id}"] img`)];
    for (const img of incoming) {
      const src = img.getAttribute("data-src");
      if (src) {
        img.src = src;
        img.removeAttribute("data-src");
      }
    }
    if (mine !== token) return;
    document.querySelectorAll("[data-pane]").forEach((pane) => {
      pane.hidden = pane.getAttribute("data-pane") !== id;
    });
    const skin = document.querySelector(`.stage[data-pane="${id}"]`);
    if (skin) {
      root.setAttribute("style", skin.getAttribute("data-skin") || "");
      root.classList.toggle("skin-dark", skin.getAttribute("data-dark") === "1");
      root.classList.add(reduced ? "theme-fade" : "theme-shift");
    }
    pointTabs(id);
    const here = new URL(location.href);
    if (here.searchParams.get("merek") !== id) {
      here.searchParams.set("merek", id);
      history.replaceState({}, "", `${here.pathname}${here.search}`);
    }
    shown = id;
    await Promise.race([
      Promise.all(incoming.map((img) => decodeImg(img))),
      new Promise((resolve) => window.setTimeout(resolve, 400)),
    ]);
  };
  let shown = (cards.find((card) => card.classList.contains("on")) || cards[0])?.getAttribute("data-brand") || "";
  rememberBrand(shown);
  let timer = 0;
  let clearTimer = 0;
  const settle = () => {
    const card = mark();
    const id = card && card.getAttribute("data-brand");
    if (!id) return;
    pointTabs(id);
    if (id === shown) {
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => page.classList.remove("is-blurring"), reduced ? 0 : 180);
      return;
    }
    const mine = ++token;
    show(id, mine).finally(() => {
      if (mine !== token) return;
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => page.classList.remove("is-blurring"), reduced ? 0 : 220);
    });
  };
  rail.addEventListener(
    "scroll",
    () => {
      const card = mark();
      const id = card && card.getAttribute("data-brand");
      if (id && id !== shown && !reduced) page.classList.add("is-blurring");
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 80);
    },
    { passive: true },
  );
  rail.addEventListener("scrollend", () => {
    window.clearTimeout(timer);
    settle();
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
      const width = 1200;
      const height = 600;
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
      const send = (blob, type, name) => {
        if (!blob) return;
        const data = new FormData(form);
        data.set("gambar", new File([blob], name, { type }));
        fetch(form.action, { method: "POST", body: data, credentials: "same-origin" }).then((response) => {
          location.href = response.url || "/admin/banner?ok=simpan";
        });
      };
      canvas.toBlob((blob) => {
        if (blob) send(blob, "image/webp", "banner.webp");
        else canvas.toBlob((jpeg) => send(jpeg, "image/jpeg", "banner.jpg"), "image/jpeg", 0.82);
      }, "image/webp", 0.82);
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

function bootConfetti() {
  const canvas = document.querySelector("[data-confetti]");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    canvas.remove();
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.scale(dpr, dpr);
  const colors = ["#6ea564", "#f2c14e", "#f3b4c6", "#e08a3c", "#fff"];
  const parts = Array.from({ length: 60 }, () => ({
    x: Math.random() * width,
    y: -10 - Math.random() * height * 0.3,
    vx: (Math.random() - 0.5) * 1.6,
    vy: 2.2 + Math.random() * 2.4,
    w: 4 + Math.random() * 4,
    h: 6 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (now) => {
    const elapsed = now - start;
    if (elapsed > 1500) {
      canvas.remove();
      return;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 1 - elapsed / 1500;
    for (const part of parts) {
      part.x += part.vx;
      part.y += part.vy;
      ctx.fillStyle = part.color;
      ctx.fillRect(part.x, part.y, part.w, part.h);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function bootCelebrate() {
  if (!document.querySelector("[data-tepok]")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
}

const tabCache = new Map();

function tabUrl(href) {
  const url = new URL(href, location.origin);
  if (url.origin !== location.origin) return "";
  if (url.pathname !== "/kartu" && url.pathname !== "/hadiah" && url.pathname !== "/profil") return "";
  return `${url.pathname}${url.search}`;
}

function fetchTab(href) {
  const key = tabUrl(href);
  if (!key) return Promise.resolve("");
  const hit = tabCache.get(key);
  if (hit && Date.now() - hit.at < 20000) return Promise.resolve(hit.html);
  return fetch(key, { headers: { accept: "text/html" }, credentials: "same-origin" })
    .then((res) => (res.ok ? res.text() : ""))
    .then((html) => {
      if (html) tabCache.set(key, { at: Date.now(), html });
      return html;
    })
    .catch(() => "");
}

function bootTabs() {
  if (document.documentElement.dataset.tabs) return;
  document.documentElement.dataset.tabs = "1";
  document.addEventListener("pointerenter", (event) => {
    const link = event.target.closest && event.target.closest("nav.tabbar a");
    if (link) fetchTab(link.href);
  }, true);
  document.addEventListener("touchstart", (event) => {
    const link = event.target.closest && event.target.closest("nav.tabbar a");
    if (link) fetchTab(link.href);
  }, { capture: true, passive: true });
  document.addEventListener("click", (event) => {
    const link = event.target.closest && event.target.closest("nav.tabbar a");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const key = tabUrl(link.href);
    if (!key) return;
    event.preventDefault();
    const shell = document.querySelector("main.phone");
    if (!shell) {
      location.href = key;
      return;
    }
    shell.classList.add("is-tabbing");
    fetchTab(key).then((html) => {
      if (!html) {
        location.href = key;
        return;
      }
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const next = parsed.querySelector("main.phone");
      const current = document.querySelector("main.phone");
      if (!next || !current) {
        location.href = key;
        return;
      }
      current.replaceWith(next);
      document.title = parsed.title || document.title;
      history.pushState({}, "", key);
      boot();
    });
  });
  window.addEventListener("popstate", () => {
    const key = tabUrl(location.href);
    if (!key) return;
    fetchTab(key).then((html) => {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const next = parsed.querySelector("main.phone");
      const current = document.querySelector("main.phone");
      if (next && current) {
        current.replaceWith(next);
        boot();
      }
    });
  });
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
  bootConfetti();
  bootTabs();
}

document.querySelectorAll("[data-print]").forEach((el) => {
  el.addEventListener("click", () => window.print());
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
document.addEventListener("DOMContentLoaded", boot);
