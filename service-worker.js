self.addEventListener("install", event => {
self.skipWaiting();
});

self.addEventListener("fetch", event => {
// Only cache site assets, NOT external APIs
if (event.request.url.includes(".netlify/functions")) return;
});
