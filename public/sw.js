const CACHE = "loyalty-bos-v11";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function shellAsset(pathname: string): boolean {
  return (
    pathname === "/app.css" ||
    pathname === "/app.js" ||
    pathname === "/offline.html" ||
    pathname === "/favicon.svg" ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brands/")
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!shellAsset(url.pathname)) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/offline.html"))),
  );
});
