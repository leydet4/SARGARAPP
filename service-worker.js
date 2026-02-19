const APP_VERSION   = "pov-sar-v1";      // bump this when you deploy changes
const CORE_CACHE    = `${APP_VERSION}-core`;
const STATIC_CACHE  = `${APP_VERSION}-static`;
const RUNTIME_CACHE = `${APP_VERSION}-runtime`;
const HTML_TIMEOUT  = 1500;

const CORE_ASSETS = [
  "/", "/index.html", "/install.html", "/gar.html", "/resources.html",
  "/css/app.css",
  "/js/config.js", "/js/app.js", "/js/install.js",
  "/manifest.json",
  "/assets/povsargarapp-qr.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png"
];

// ---------- Helpers ----------
const isHTML = (req) =>
  req.mode === "navigate" ||
  req.destination === "document" ||
  (req.headers && typeof req.headers.get === "function" &&
   req.headers.get("accept")?.includes("text/html"));

const sameOrigin = (url) => {
  try { return new URL(url).origin === self.location.origin; } catch { return false; }
};

const bg = (p) => { try { p && p.catch?.(()=>{}); } catch {} };

// ---------- Install / Activate ----------
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const c = await caches.open(CORE_CACHE);

    // Safe add so one missing file doesn't kill install
    await Promise.allSettled(CORE_ASSETS.map(u => c.add(u)));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => !k.startsWith(APP_VERSION))
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ---------- Strategies ----------
async function htmlNetworkFirstWithTimeout(request) {
  const cache = await caches.open(CORE_CACHE);
  const cached = await cache.match(request);

  const net = (async () => {
    const res = await fetch(request);
    if (res && res.ok && res.type === "basic") {
