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
  btn.style.color = isEnabled ? '#ffffff' : 'var(--text)';
  btn.style.borderColor = isEnabled ? 'var(--primary)' : 'var(--border)';
  btn.style.background = isEnabled ? 'var(--primary)' : 'var(--surface-2)';
}"""

content = content.replace(search, replace)

with open("index.html", "w") as f:
    f.write(content)
