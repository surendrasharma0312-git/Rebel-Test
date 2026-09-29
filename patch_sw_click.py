with open('sw.js', 'r') as f:
    content = f.read()

# Update notificationclick listener to use event.notification.data.testId
new_click = """
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
"""

# Replace existing click listener
content = content.split("self.addEventListener('notificationclick',")[0] + new_click

with open('sw.js', 'w') as f:
    f.write(content)
