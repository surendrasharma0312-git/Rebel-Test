import sys

with open("index.html", "r") as f:
    content = f.read()

search = """  btn.textContent = isEnabled ? 'ON' : 'OFF';
  btn.style.color = isEnabled ? '#ffffff' : 'var(--text)';
  btn.style.borderColor = isEnabled ? 'var(--primary)' : 'var(--border)';
  btn.style.background = isEnabled ? 'var(--primary)' : 'var(--surface-2)';"""

replace = """  btn.textContent = isEnabled ? 'ON' : 'OFF';
  btn.style.color = isEnabled ? 'var(--primary-hover)' : 'var(--text)';
  btn.style.borderColor = isEnabled ? 'var(--primary)' : 'var(--border)';
  btn.style.background = isEnabled ? 'var(--primary-light)' : 'var(--surface-2)';"""

content = content.replace(search, replace)

with open("index.html", "w") as f:
    f.write(content)
