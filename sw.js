// sw.js — a minimal service worker. Its only real job is to satisfy the
// browser's "installability" requirement so the custom Install button
// (and the native Chrome install banner) can appear. As a bonus it lets
// already-visited pages keep working if the connection drops.
const CACHE_NAME = 'rebel-test-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache a copy of successful same-origin GET requests for offline use
        if (event.request.method === 'GET' && response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
