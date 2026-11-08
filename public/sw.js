// Plain browser JavaScript: this file is served as-is, so no TypeScript syntax here.
const CACHE = "loyalty-bos-v18";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .catch(() => undefined)
      .then(() => self.clients.claim()),
  );
});

function shellAsset(pathname) {
  return (
    pathname === "/app.css" ||
    pathname === "/app.js" ||
    pathname === "/brand.js" ||
    pathname === "/favicon.svg" ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brands/") ||
    pathname.startsWith("/banners/")
  );
}

// Pages (navigations) are never intercepted: the browser loads them straight from the network.
// Only static shell assets go through here: network first, cached copy if the network fails,
// and if neither works the request fails exactly as it would without a service worker.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode === "navigate") return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin || !shellAsset(url.pathname)) return;
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch((err) =>
        caches
          .match(request)
          .catch(() => undefined)
          .then((cached) => {
            if (cached) return cached;
            throw err;
          }),
      ),
  );
});
