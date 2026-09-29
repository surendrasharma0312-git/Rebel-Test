import re

with open('index.html', 'r') as f:
    content = f.read()

# I had added it in patch_mute_btn.py but then I accidentally overwrote index.html in patch_settings_btn.py which caused it to be lost.
# Let's add it back properly to the screen-test section.

test_topline_replacement = """    <div class="test-topline" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <span id="qCounter">Question 1 of 20</span>
        <span id="qCorrectCount" style="margin-left:8px;">✅ 0</span>
      </div>
      <button id="inTestMuteBtn" class="icon-btn" title="Test sound effects" aria-label="Test sound effects" style="width:32px; height:32px; font-size:14px; border-radius:10px; background:transparent; box-shadow:none;">🎵</button>
    </div>"""

content = content.replace("""    <div class="test-topline">
      <span id="qCounter">Question 1 of 20</span>
      <span id="qCorrectCount">✅ 0</span>
    </div>""", test_topline_replacement)

with open('index.html', 'w') as f:
    f.write(content)
