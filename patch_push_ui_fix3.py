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

  // Actually check the Notification permission state to keep it robust
  const permission = Notification.permission;
  let isEnabled = localStorage.getItem('pushEnabled') === 'true';

  // If permission is denied, it definitely shouldn't be ON
  if (permission === 'denied') {
      isEnabled = false;
      localStorage.setItem('pushEnabled', 'false');
  } else if (permission === 'granted' && isEnabled) {
      // If it's granted and localStorage says true, it's ON
      isEnabled = true;
  } else if (permission === 'default' && isEnabled) {
      // shouldn't happen but just in case
      isEnabled = false;
      localStorage.setItem('pushEnabled', 'false');
  } else if (isEnabled === false && permission === 'granted' && localStorage.getItem('pushEnabled') !== 'false') {
      // We haven't stored it explicitly false but it's granted? We'll rely on pushEnabled.
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
  let isEnabled = false;

  if (permission === 'granted') {
    isEnabled = localStorage.getItem('pushEnabled') !== 'false';
  }

  btn.textContent = isEnabled ? 'ON' : 'OFF';
  btn.style.color = isEnabled ? 'var(--primary-hover)' : 'var(--text)';
  btn.style.borderColor = isEnabled ? 'var(--primary)' : 'var(--border)';
  btn.style.background = isEnabled ? 'var(--primary-light)' : 'var(--surface-2)';
}"""

content = content.replace(search, replace)

with open("index.html", "w") as f:
    f.write(content)
