import re

with open('index.html', 'r') as f:
    content = f.read()

content = content.replace("""    if (testSoundEnabled) {
      btn.textContent = '🎵';
      btn.title = 'Test sound effects';
      btn.setAttribute('aria-label', 'Test sound effects');
      btn.style.opacity = '1';
    } else {
      btn.textContent = '🔇';
      btn.title = 'Test sound effects muted';
      btn.setAttribute('aria-label', 'Test sound effects muted');
      btn.style.opacity = '0.5';
    }""", """    if (testSoundEnabled) {
      btn.textContent = '🎵';
      btn.title = 'Test sound effects';
      btn.setAttribute('aria-label', 'Test sound effects');
      btn.style.opacity = '1';
      btn.style.textDecoration = 'none';
    } else {
      btn.textContent = '🎵';
      btn.title = 'Test sound effects muted';
      btn.setAttribute('aria-label', 'Test sound effects muted');
      btn.style.opacity = '0.5';
    }""")

with open('index.html', 'w') as f:
    f.write(content)
