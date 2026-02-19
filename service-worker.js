const CACHE_NAME = "pov-sar-gar-v1";

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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Network-first for API calls
  if (
    req.url.includes("tidesandcurrents.noaa.gov") ||
    req.url.includes("api.weather.gov") ||
    req.url.includes("ndbc.noaa.gov")
  ) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for app files
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
