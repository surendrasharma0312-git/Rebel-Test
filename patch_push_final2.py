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
  const isEnabled = localStorage.getItem('pushEnabled') === 'true';
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

  // We only show ON if the permission is granted AND our token setup was successful
  let isEnabled = (permission === 'granted') && (localStorage.getItem('pushEnabled') === 'true');

  if (permission === 'denied' || permission === 'default') {
    isEnabled = false;
    // If it was somehow true in localstorage but permission is denied/default, reset it
    if (localStorage.getItem('pushEnabled') === 'true') {
        localStorage.setItem('pushEnabled', 'false');
    }
  }

  btn.textContent = isEnabled ? 'ON' : 'OFF';
  btn.style.color = isEnabled ? 'var(--primary-hover)' : 'var(--text)';
  btn.style.borderColor = isEnabled ? 'var(--primary)' : 'var(--border)';
  btn.style.background = isEnabled ? 'var(--primary-light)' : 'var(--surface-2)';
}"""

content = content.replace(search, replace)

with open("index.html", "w") as f:
    f.write(content)
