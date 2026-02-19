self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('pov-sar-v1').then((cache) =>
      cache.addAll([
        '/',               // IMPORTANT: cache root too
        '/index.html',
        '/install.html',
        '/gar.html',
        '/resources.html',
        '/css/app.css',
        '/manifest.json',
        '/assets/povsargarapp-qr.png',
        '/assets/icon-192.png',
        '/assets/icon-512.png'
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // cache-first
  e.respondWith(
    caches.match(e.request).then((resp) => resp || fetch(e.request))
  );
});
