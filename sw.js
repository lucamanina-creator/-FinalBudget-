const CACHE = "pm-cache-v1";

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(["/", "/manifest.webmanifest"]);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
      return res;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === "navigate") {
        return caches.match("/");
      }
      throw err;
    }
  })());
});
