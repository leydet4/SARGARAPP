const CACHE_NAME = "pov-sar-gar-v2";

// Keep this list minimal and GUARANTEED to exist.
// Missing files = SW install fails = no Active + no Controller.
const ASSETS = [
  "/",
  "/index.html",
  "/gar.html",
  "/install.html",
  "/manifest.json",
  "/css/app.css",
  "/js/config.js",
  "/js/app.js",
  "/js/install.js",
  "/assets/povsargarapp-qr.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Add assets safely so a single missing file doesn't break the install.
    const results = await Promise.allSettled(
      ASSETS.map((url) => cache.add(url))
    );

    // Optional: log failures (viewable in DevTools > Application > Service Workers)
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        // eslint-disable-next-line no-console
        console.warn("SW cache add failed:", ASSETS[i], r.reason);
      }
    });

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))
    );
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Network-first for API requests (always prefer latest live data)
  if (
    req.url.includes("tidesandcurrents.noaa.gov") ||
    req.url.includes("api.weather.gov") ||
    req.url.includes("ndbc.noaa.gov")
  ) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for site assets
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
