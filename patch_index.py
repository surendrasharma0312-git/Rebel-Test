import re

with open('index.html', 'r') as f:
    content = f.read()

# 1. Add messaging to the imports
firebase_scripts = """<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"></script>"""
content = content.replace(
    '<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>\n<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>',
    firebase_scripts
)

# 2. Add push notifications to Settings UI
settings_ui = """      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
        <div style="font-weight:600; color:var(--text);">Test Sound Effects</div>
        <button id="toggleTestSoundBtn" class="btn btn-sm" style="background:var(--surface-2); border:1px solid var(--border); color:var(--text); width: 60px;">ON</button>
      </div>"""
push_ui = """      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
        <div style="font-weight:600; color:var(--text);">Test Sound Effects</div>
        <button id="toggleTestSoundBtn" class="btn btn-sm" style="background:var(--surface-2); border:1px solid var(--border); color:var(--text); width: 60px;">ON</button>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
        <div>
          <div style="font-weight:600; color:var(--text);">Push Notifications</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Get notified when new tests are published</div>
        </div>
        <button id="togglePushBtn" class="btn btn-sm" style="background:var(--surface-2); border:1px solid var(--border); color:var(--text); width: 60px;">OFF</button>
      </div>"""
content = content.replace(settings_ui, push_ui)


with open('index.html', 'w') as f:
    f.write(content)
