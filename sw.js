importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDqH_MHlDoOutizI4-Htcc18UIXouA2xDo",
  authDomain: "rebel-test-9a453.firebaseapp.com",
  projectId: "rebel-test-9a453",
  storageBucket: "rebel-test-9a453.firebasestorage.app",
  messagingSenderId: "39692234468",
  appId: "1:39692234468:web:12c07b504765114522c6f1"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Received background message ', payload);
    const notificationTitle = payload.data.title || payload.notification?.title || 'Rebel Test Series';
    const notificationOptions = {
      body: payload.data.body || payload.notification?.body || '',
      icon: './icon-192.png',
      data: payload.data
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch(e) {
  console.error("Firebase SW init error:", e);
}

// sw.js — Service worker with Stale-While-Revalidate caching strategy
const CACHE_NAME = 'rebel-test-v5';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache the app shell gracefully (don't fail if one cross-origin fails)
      return Promise.allSettled(
        APP_SHELL.map(url => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip caching for Firebase Firestore / Auth API calls to prevent stale data
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('fcmregistrations.googleapis.com')) {
    return; // let the browser handle it directly
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Stale-while-revalidate strategy
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache successful same-origin or opaque responses
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache)).catch(() => {});
        }
        return networkResponse;
      }).catch((err) => {
        // Network failed, we'll rely on the cache if available
        console.warn('Network request failed, relying on cache', err);
        return Response.error();
      });

      // Ensure the service worker doesn't terminate before the background fetch completes
      if (cachedResponse) {
        event.waitUntil(fetchPromise);
      }

      // Return cached immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});



self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received.');
  event.notification.close();

  let targetPath = '/';
  if (event.notification.data && event.notification.data.testId) {
    targetPath = '/?test=' + event.notification.data.testId;
  }
  const urlToOpen = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // If a client is open, focus it and optionally send a message to navigate
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetPath });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
