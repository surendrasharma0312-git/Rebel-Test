import re

with open('sw.js', 'r') as f:
    content = f.read()

# Add importScripts and Firebase init at the top
imports = """importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
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

"""

# Increment CACHE_NAME
content = re.sub(r"const CACHE_NAME = 'rebel-test-v\d+';", "const CACHE_NAME = 'rebel-test-v4';", content)

# Update fetch listener
content = content.replace(
    "url.hostname.includes('identitytoolkit.googleapis.com')) {",
    "url.hostname.includes('identitytoolkit.googleapis.com') ||\n      url.hostname.includes('fcmregistrations.googleapis.com')) {"
)

# Add notificationclick listener at the end
notification_click = """

self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received.');
  event.notification.close();

  const urlToOpen = new URL('/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
"""

with open('sw.js', 'w') as f:
    f.write(imports + content + notification_click)
