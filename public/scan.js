import { claimScan } from "/claim-scan.js";

const COPY = {
  foreign: "QR ini bukan punya kasir kita.",
  not_claim: "Ini bukan QR stamp. Coba yang di kasir ya.",
  expired: "QR-nya sudah hangus. Minta kasir tap lagi.",
  bad: "QR-nya kurang kebaca. Coba lagi ya.",
};

let stream = null;
let stop = false;
let scanning = false;

function sheet() {
  return document.querySelector("[data-scanner]");
}

function setMsg(text) {
  const node = sheet()?.querySelector("[data-scan-msg]");
  if (node) node.textContent = text || "";
}

function showFallback() {
  const root = sheet();
  if (!root) return;
  root.hidden = false;
  const stage = root.querySelector("[data-scan-stage]");
  const torch = root.querySelector("[data-scan-torch]");
  const fallback = root.querySelector("[data-scan-fallback]");
  if (stage) stage.hidden = true;
  if (torch) torch.hidden = true;
  if (fallback) fallback.hidden = false;
  setMsg("");
}

function shutdown() {
  stop = true;
  scanning = false;
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
  const video = sheet()?.querySelector("[data-scan-video]");
  if (video) video.srcObject = null;
  const root = sheet();
  if (root) root.hidden = true;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const tag = document.createElement("script");
    tag.src = src;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error("script"));
    document.body.appendChild(tag);
  });
}

function handle(raw) {
  const result = claimScan(raw, location.origin, Date.now());
  if (result.ok) {
    shutdown();
    location.assign(result.path);
    return true;
  }
  setMsg(COPY[result.reason] || COPY.bad);
  return false;
}

async function loopDetector(detector, video) {
  while (!stop) {
    try {
      const codes = await detector.detect(video);
      const value = codes && codes[0] && (codes[0].rawValue || codes[0].raw);
      if (value && handle(value)) return;
    } catch {
      /* frame berikutnya */
    }
    await new Promise((resolve) => setTimeout(resolve, 140));
  }
}

async function loopJsQR(video) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !window.jsQR) {
    showFallback();
    return;
  }
  while (!stop) {
    if (video.readyState >= 2 && video.videoWidth) {
      const width = Math.min(480, video.videoWidth);
      const height = Math.max(1, Math.round(video.videoHeight * (width / video.videoWidth)));
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);
      const image = ctx.getImageData(0, 0, width, height);
      const code = window.jsQR(image.data, width, height, { inversionAttempts: "dontInvert" });
      if (code && code.data && handle(code.data)) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 160));
  }
}

async function setupTorch(videoTrack) {
  const button = sheet()?.querySelector("[data-scan-torch]");
  if (!button) return;
  const caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
  if (!caps.torch) {
    button.hidden = true;
    return;
  }
  button.hidden = false;
  let on = false;
  button.onclick = async () => {
    on = !on;
    try {
      await videoTrack.applyConstraints({ advanced: [{ torch: on }] });
      button.textContent = on ? "Matikan senter" : "Senter";
    } catch {
      button.hidden = true;
    }
  };
}

async function open() {
  const root = sheet();
  if (!root || scanning) {
    if (root) root.hidden = false;
    return;
  }
  stop = false;
  scanning = true;
  root.hidden = false;
  const stage = root.querySelector("[data-scan-stage]");
  const fallback = root.querySelector("[data-scan-fallback]");
  const video = root.querySelector("[data-scan-video]");
  if (stage) stage.hidden = false;
  if (fallback) fallback.hidden = true;
  setMsg("Arahin kamera ke QR di kasir ya");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !video) {
    scanning = false;
    showFallback();
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
  } catch {
    scanning = false;
    showFallback();
    return;
  }
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  try {
    await video.play();
  } catch {
    /* autoplay may still paint frames */
  }
  const track = stream.getVideoTracks()[0];
  if (track) await setupTorch(track);
  if ("BarcodeDetector" in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      await loopDetector(detector, video);
      return;
    } catch {
      /* lanjut ke jsQR */
    }
  }
  try {
    await loadScript("/vendor/jsQR.js");
  } catch {
    showFallback();
    return;
  }
  await loopJsQR(video);
}

document.querySelectorAll("[data-scan-cancel]").forEach((button) => {
  button.addEventListener("click", shutdown);
});

window.__loyaltyScan = () => {
  void open();
};
void open();
