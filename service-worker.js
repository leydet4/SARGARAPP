/* sw.js — CFD Marine v8
   - No response re-use (clone before cache write, return original)
   - HTML: network-first with short timeout, fallback to cache
   - Images: network-first so updates show quickly
   - CSS/JS/Fonts: stale-while-revalidate
   - Bypass Google domains + do not cache Netlify Functions (APIs)
*/

const APP_VERSION   = "cfd-marine-v8";       // ⬅️ bump on every deploy
const CORE_CACHE    = `${APP_VERSION}-core`;
const STATIC_CACHE  = `${APP_VERSION}-static`;
const RUNTIME_CACHE = `${APP_VERSION}-runtime`;
const HTML_TIMEOUT  = 1500;

// Keep this small; everything else is runtime-cached.
const CORE_ASSETS = [
  "/", "/index.html", "/app.css", "/manifest.json",

  // icons used by app + push notifications
  "/assets/icons/icon-180.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",

  // Common pages (optional)
  "/pages/dashboard.html",
  "/pages/hrbt-wave.html",
  "/pages/sop-realtime-temp.html",
  "/pages/contacts.html",
  "/pages/bridges-locks.html",
  "/pages/gar.html",
  "/pages/training-deckhand.html",
  "/pages/training-navigator.html",
  "/pages/training-rov.html",
  "/pages/training-fb4.html",
  "/pages/training-nsbc.html",

  // Maintenance pages (added so they work offline)
  "/pages/maintenance.html",
  "/pages/maintenance-boat.html",
  "/pages/maintenance-admin.html",
  "/pages/maintenance-new.html"
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

const isGoogleDomain = (url) => {
  try {
    const u = new URL(url);
    const h = u.hostname;
    return (
      h.endsWith("google.com") ||
      h.endsWith("gstatic.com") ||
      h.endsWith("googleapis.com") ||
      h.endsWith("googleusercontent.com") ||
      h.endsWith("appspot.com")
    );
  } catch { return false; }
};

const isApiRequest = (req) => {
  // Don’t cache Netlify functions or JSON APIs
  const url = req.url || "";
  const accept = req.headers?.get?.("accept") || "";
  return url.includes("/.netlify/functions/") || accept.includes("application/json");
};

// Best-effort background task (never throws)
const bg = (p) => { try { p && p.catch?.(()=>{}); } catch {} };

// ---------- Install / Activate ----------
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const c = await caches.open(CORE_CACHE);
    await c.addAll(CORE_ASSETS);
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
      bg(cache.put(request, res.clone()));
    }
    return res;
  })();

  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve(null), HTML_TIMEOUT)
  );

  const result = await Promise.race([net, timeout]);
  if (result) return result;
  if (cached) return cached;
  // If timed out and no cache, await network and return it (or a 504)
  try {
    const res = await net;
    return res || new Response("", { status: 504, statusText: "Gateway Timeout" });
  } catch {
    return new Response("", { status: 504, statusText: "Gateway Timeout" });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request, { cache: "no-store" });
    if (res && (res.ok || res.type === "opaque") && sameOrigin(request.url) && res.type === "basic") {
      bg(cache.put(request, res.clone()));
    }
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response("", { status: 504, statusText: "Gateway Timeout" });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetching = fetch(request).then((res) => {
    if (res && (res.ok || res.type === "opaque") && sameOrigin(request.url) && res.type === "basic") {
      bg(cache.put(request, res.clone()));
    }
    return res;
  }).catch(() => null);

  return cached || fetching || new Response("", { status: 504, statusText: "Gateway Timeout" });
}

// ---------- Fetch ----------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = req.url;

  // Never intercept Google (Drive, Forms, Apps Script, etc.)
  if (isGoogleDomain(url)) return;

  // Don’t cache API calls (Netlify Functions / JSON); just pass through
  if (isApiRequest(req)) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML/doc navigations
  if (isHTML(req)) {
    event.respondWith(htmlNetworkFirstWithTimeout(req));
    return;
  }

  // Same-origin assets
  if (sameOrigin(url)) {
    if (req.destination === "image") {
      event.respondWith(networkFirst(req, STATIC_CACHE)); // images network-first
      return;
    }
    if (["style","script","font"].includes(req.destination)) {
      event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
      return;
    }
    // Other same-origin: network-first
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // Cross-origin non-Google: network-first
  event.respondWith(networkFirst(req, RUNTIME_CACHE));
});

// Optional: allow page to promote a newly installed SW immediately
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* --- Web Push handlers --- */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || 'New maintenance issue';
  const body  = data.body  || '';
  const url   = data.url   || '/pages/maintenance.html';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      // Use your existing icons; change if you keep a separate badge file.
      icon:  '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-192.png',
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/pages/maintenance.html';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of allClients) {
      if (client.url.includes(new URL(url, self.location.origin).pathname) && 'focus' in client) {
        return client.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
