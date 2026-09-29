import re

with open('index.html', 'r') as f:
    content = f.read()

# Make the push container have an id so we can hide it
content = content.replace(
    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">\n        <div>\n          <div style="font-weight:600; color:var(--text);">Push Notifications</div>',
    '<div id="pushNotifContainer" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">\n        <div>\n          <div style="font-weight:600; color:var(--text);">Push Notifications</div>'
)

# Hide if not supported
ui_logic = """
function updatePushUI() {
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
}
"""

content = re.sub(r'function updatePushUI\(\) \{.*?\n\}', ui_logic.strip(), content, flags=re.DOTALL)

# Add URL navigation listener to support SW postMessage
nav_logic = """
// Handle navigation from SW
navigator.serviceWorker?.addEventListener('message', event => {
  if (event.data && event.data.type === 'NAVIGATE' && event.data.url) {
    const url = new URL(event.data.url, window.location.origin);
    const testId = url.searchParams.get('test');
    if (testId) {
      // In this SPA, we can switch screens or load the test directly
      // Since there's no native URL routing, we just reload for simplicity
      // Or if the app handles ?test= query param on load, this works.
      window.location.href = event.data.url;
    }
  }
});
"""

content = content.replace("// Initialize UI", nav_logic + "\n// Initialize UI")

with open('index.html', 'w') as f:
    f.write(content)
