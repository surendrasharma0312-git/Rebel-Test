import sys

with open("index.html", "r") as f:
    content = f.read()

search = """function updatePushUI() {
  const container = $('pushNotifContainer');
  if (container) {
    if (!('Notification' in window) || !messaging) {
      container.style.display = 'none';
      return;
    }
  }

  const btn = $('togglePushBtn');
  if (!btn) return;

  const permission = Notification.permission;
  let isEnabled = localStorage.getItem('pushEnabled') === 'true';

  // Actually check the Notification permission state to keep it robust
  // Playwright might force it to 'denied' in headless, so handle real-world cases properly
  if (permission === 'denied') {
    isEnabled = false;
    localStorage.setItem('pushEnabled', 'false');
  } else if (permission === 'default' && isEnabled) {
    // Edge case: localStorage says true but browser hasn't granted yet? Reset it.
    isEnabled = false;
    localStorage.setItem('pushEnabled', 'false');
  }

  btn.textContent = isEnabled ? 'ON' : 'OFF';
  btn.style.color = isEnabled ? 'var(--primary-hover)' : 'var(--text)';
  btn.style.borderColor = isEnabled ? 'var(--primary)' : 'var(--border)';
  btn.style.background = isEnabled ? 'var(--primary-light)' : 'var(--surface-2)';
}"""

replace = """function updatePushUI() {
  const container = $('pushNotifContainer');
  if (container) {
    if (!('Notification' in window) || !messaging) {
      container.style.display = 'none';
      return;
    }
  }

  const btn = $('togglePushBtn');
  if (!btn) return;

  const permission = Notification.permission;
  let isEnabled = localStorage.getItem('pushEnabled') === 'true';

  // If permission is already granted natively but localstorage doesn't reflect it,
  // we could automatically subscribe in the background, but for now we just reflect state.
  // Actually, if it's granted, we should reflect that in the UI.
  // Let's assume if they granted it natively, they want it ON, unless they explicitly turned it OFF in our app.
  if (permission === 'granted') {
    // if it's not explicitly false in localstorage, assume true
    if (localStorage.getItem('pushEnabled') !== 'false') {
        isEnabled = true;
        // optionally, we could call subscribeToPush() here silently to ensure token is captured
    }
  } else if (permission === 'denied') {
    isEnabled = false;
    localStorage.setItem('pushEnabled', 'false');
  } else if (permission === 'default') {
    isEnabled = false;
    // Don't overwrite localstorage yet, wait for them to click
  }

  btn.textContent = isEnabled ? 'ON' : 'OFF';
  btn.style.color = isEnabled ? 'var(--primary-hover)' : 'var(--text)';
  btn.style.borderColor = isEnabled ? 'var(--primary)' : 'var(--border)';
  btn.style.background = isEnabled ? 'var(--primary-light)' : 'var(--surface-2)';
}"""

content = content.replace(search, replace)

with open("index.html", "w") as f:
    f.write(content)
