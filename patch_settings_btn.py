import re

with open('index.html', 'r') as f:
    content = f.read()

# Add to topbar
topbar_replacement = """      <button class="icon-btn" id="themeToggleBtn" title="Toggle Theme" aria-label="Toggle Dark Mode">🌙</button>
      <button class="icon-btn" id="settingsBtn" title="Settings" aria-label="Settings">⚙️</button>
      <button class="icon-btn" id="notifyBtn" title="Notifications" style="position:relative;">"""

content = content.replace("""      <button class="icon-btn" id="themeToggleBtn" title="Toggle Theme" aria-label="Toggle Dark Mode">🌙</button>
      <button class="icon-btn" id="notifyBtn" title="Notifications" style="position:relative;">""", topbar_replacement)

with open('index.html', 'w') as f:
    f.write(content)
