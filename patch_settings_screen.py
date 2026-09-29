import re

with open('index.html', 'r') as f:
    content = f.read()

# Add Settings Screen
settings_screen = """
  <!-- ============ SCREEN: SETTINGS ============ -->
  <section class="screen" id="screen-settings">
    <div class="top-actions">
      <button class="btn btn-ghost" id="backFromSettingsBtn">← Back</button>
    </div>
    <h2 class="section-title">Settings</h2>

    <div class="card" style="margin-bottom: 14px;">
      <h3 style="margin-top:0;margin-bottom:12px;font-size:16px;">Test Experience</h3>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
        <div style="font-weight:600; color:var(--text);">Test Sound Effects</div>
        <button id="toggleTestSoundBtn" class="btn btn-sm" style="background:var(--surface-2); border:1px solid var(--border); color:var(--text); width: 60px;">ON</button>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <div style="font-weight:600; color:var(--text);">Volume</div>
          <div id="volumeLabel" style="font-size:13px; color:var(--text-muted); font-weight:700;">50%</div>
        </div>
        <input type="range" id="testVolumeSlider" min="0" max="100" value="50" style="width:100%; accent-color:var(--primary);">
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:600; color:var(--text);">Haptic Feedback</div>
        <button id="toggleHapticBtn" class="btn btn-sm" style="background:var(--surface-2); border:1px solid var(--border); color:var(--text); width: 60px;">ON</button>
      </div>
    </div>
  </section>
"""

# Insert after screen-manage
content = content.replace("""</section>\n\n</div>\n\n<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>""", """</section>""" + settings_screen + """\n</div>\n\n<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>""")

with open('index.html', 'w') as f:
    f.write(content)
