const CACHE_NAME = "pov-sar-gar-v3";

const ASSETS = [
  "/",
  "/index.html",
  "/gar.html",
  "/resources.html",
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

    // Safe caching: a missing file won't break install
    await Promise.allSettled(ASSETS.map((url) => cache.add(url)));

    // Become ready immediately
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Cleanup old caches
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));

    // Take control immediately
    await self.clients.claim();
  })());
});

// Allow the page to force SW to take control + refresh
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "CLAIM_CLIENTS") {
    self.clients.claim();
  }

  if (event.data.type === "CLEAR_CACHES") {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    })());
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Network-first for live APIs
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

  // Cache-first for app assets
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
