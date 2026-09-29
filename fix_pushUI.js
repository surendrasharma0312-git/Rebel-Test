const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// We need to change the check inside updatePushUI
// from: const token = await messaging.getToken(...)
// to: const sub = await reg.pushManager.getSubscription(); if (sub) { isEnabled = true; }

const newUpdatePushUI = `async function updatePushUI() {
  const container = $('pushNotifContainer');
  if (container) {
    if (!('Notification' in window) || !messaging) {
      container.style.display = 'none';
      return;
    }
  }

  const btn = $('togglePushBtn');
  if (!btn) return;

  let isEnabled = false;
  if (Notification.permission === 'granted' && messaging) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        isEnabled = true;
      }
    } catch (err) {
      console.log('Error checking FCM token state:', err);
    }
  }

  localStorage.setItem('pushEnabled', isEnabled ? 'true' : 'false');

  btn.textContent = isEnabled ? 'ON' : 'OFF';
  btn.style.color = isEnabled ? 'var(--primary-hover)' : 'var(--text)';
  btn.style.borderColor = isEnabled ? 'var(--primary)' : 'var(--border)';
  btn.style.background = isEnabled ? 'var(--primary-light)' : 'var(--surface-2)';
}`;

html = html.replace(/async function updatePushUI\(\) \{[\s\S]*?btn\.style\.background = isEnabled \? 'var\(--primary-light\)' : 'var\(--surface-2\)';\n\}/, newUpdatePushUI);

fs.writeFileSync('index.html', html);
console.log("Updated push UI logic");
