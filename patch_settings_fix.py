import re

with open('index.html', 'r') as f:
    content = f.read()

settings_logic = """
/* =========================================================
   SETTINGS SYSTEM
========================================================= */
let testSoundEnabled = localStorage.getItem('testSoundEnabled') !== 'false';
let testVolume = localStorage.getItem('testVolume') ? parseInt(localStorage.getItem('testVolume'), 10) : 50;
let hapticEnabled = localStorage.getItem('hapticEnabled') !== 'false';

function updateSettingsUI() {
  const soundBtn = $('toggleTestSoundBtn');
  if (soundBtn) {
    soundBtn.textContent = testSoundEnabled ? 'ON' : 'OFF';
    soundBtn.style.color = testSoundEnabled ? 'var(--success)' : 'var(--danger)';
    soundBtn.style.borderColor = testSoundEnabled ? 'var(--success)' : 'var(--danger)';
  }

  const slider = $('testVolumeSlider');
  if (slider) slider.value = testVolume;

  const volLabel = $('volumeLabel');
  if (volLabel) volLabel.textContent = testVolume + '%';

  const hapticBtn = $('toggleHapticBtn');
  if (hapticBtn) {
    hapticBtn.textContent = hapticEnabled ? 'ON' : 'OFF';
    hapticBtn.style.color = hapticEnabled ? 'var(--success)' : 'var(--danger)';
    hapticBtn.style.borderColor = hapticEnabled ? 'var(--success)' : 'var(--danger)';
  }
}

function updateInTestMuteBtn() {
  const btn = $('inTestMuteBtn');
  if (btn) {
    if (testSoundEnabled) {
      btn.textContent = '🎵';
      btn.title = 'Test sound effects';
      btn.setAttribute('aria-label', 'Test sound effects');
      btn.style.opacity = '1';
    } else {
      btn.textContent = '🔇';
      btn.title = 'Test sound effects muted';
      btn.setAttribute('aria-label', 'Test sound effects muted');
      btn.style.opacity = '0.5';
    }
  }
}

// Initialize mute button state on load
document.addEventListener('DOMContentLoaded', () => {
    updateInTestMuteBtn();
});


// Event Listeners for Settings Screen
$('settingsBtn')?.addEventListener('click', () => {
  updateSettingsUI();
  showScreen('screen-settings');
});

$('backFromSettingsBtn')?.addEventListener('click', () => showScreen('screen-home'));

$('toggleTestSoundBtn')?.addEventListener('click', () => {
  testSoundEnabled = !testSoundEnabled;
  localStorage.setItem('testSoundEnabled', testSoundEnabled);
  updateSettingsUI();
  updateInTestMuteBtn();
});

$('testVolumeSlider')?.addEventListener('input', (e) => {
  testVolume = parseInt(e.target.value, 10);
  $('volumeLabel').textContent = testVolume + '%';
});
$('testVolumeSlider')?.addEventListener('change', (e) => {
  localStorage.setItem('testVolume', testVolume);
});

$('toggleHapticBtn')?.addEventListener('click', () => {
  hapticEnabled = !hapticEnabled;
  localStorage.setItem('hapticEnabled', hapticEnabled);
  updateSettingsUI();
  if (hapticEnabled && navigator.vibrate) {
    navigator.vibrate(30);
  }
});

$('inTestMuteBtn')?.addEventListener('click', () => {
  testSoundEnabled = !testSoundEnabled;
  localStorage.setItem('testSoundEnabled', testSoundEnabled);
  updateSettingsUI();
  updateInTestMuteBtn();
});

/* =========================================================
   AUDIO FEEDBACK SYSTEM (WEB AUDIO API)
========================================================= */
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Initialize audio on first user interaction to bypass autoplay restrictions
document.addEventListener('click', initAudio, { once: true, passive: true });
document.addEventListener('touchstart', initAudio, { once: true, passive: true });


function triggerHaptic(type) {
  if (!hapticEnabled || !navigator.vibrate) return;

  if (type === 'tap') {
    navigator.vibrate(20);
  } else if (type === 'correct') {
    navigator.vibrate([30, 50, 30]);
  } else if (type === 'wrong') {
    navigator.vibrate([60, 40, 60]);
  } else if (type === 'timeout') {
    navigator.vibrate([80, 60, 80]);
  } else if (type === 'finish') {
    navigator.vibrate([30, 40, 30, 40, 50]);
  }
}

function playTestSound(type) {
  if (!testSoundEnabled || !audioCtx) return;
  initAudio();

  const volumeNode = audioCtx.createGain();
  const volRatio = testVolume / 100;
  // Use a sensible max volume curve
  volumeNode.gain.value = volRatio * 0.3;
  volumeNode.connect(audioCtx.destination);

  const t = audioCtx.currentTime;

  if (type === 'tap') {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);

    volumeNode.gain.setValueAtTime(volRatio * 0.2, t);
    volumeNode.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(volumeNode);
    osc.start(t);
    osc.stop(t + 0.05);
  }
  else if (type === 'correct') {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(523.25, t); // C5
    osc2.frequency.setValueAtTime(659.25, t + 0.1); // E5

    volumeNode.gain.setValueAtTime(0, t);
    volumeNode.gain.linearRampToValueAtTime(volRatio * 0.3, t + 0.02);
    volumeNode.gain.setValueAtTime(volRatio * 0.3, t + 0.1);
    volumeNode.gain.linearRampToValueAtTime(0, t + 0.3);

    osc1.connect(volumeNode);
    osc2.connect(volumeNode);

    osc1.start(t);
    osc1.stop(t + 0.1);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.3);
  }
  else if (type === 'wrong') {
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);

    volumeNode.gain.setValueAtTime(volRatio * 0.3, t);
    volumeNode.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(volumeNode);
    osc.start(t);
    osc.stop(t + 0.2);
  }
  else if (type === 'timeout') {
    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.4);

    // low-pass filter to make the square wave less harsh
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;

    volumeNode.gain.setValueAtTime(volRatio * 0.2, t);
    volumeNode.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(filter);
    filter.connect(volumeNode);
    osc.start(t);
    osc.stop(t + 0.4);
  }
  else if (type === 'warning') {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);

    volumeNode.gain.setValueAtTime(volRatio * 0.1, t);
    volumeNode.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(volumeNode);
    osc.start(t);
    osc.stop(t + 0.1);
  }
  else if (type === 'finish') {
    // A simple C major arpeggio
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const oscVol = audioCtx.createGain();
      oscVol.gain.setValueAtTime(0, t + i * 0.1);
      oscVol.gain.linearRampToValueAtTime(volRatio * 0.2, t + i * 0.1 + 0.05);
      oscVol.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.4);

      osc.connect(oscVol);
      oscVol.connect(audioCtx.destination);

      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.4);
    });
  }
}
"""

content = content.replace("""// Theme Toggle Logic""", settings_logic + """\n// Theme Toggle Logic""")

with open('index.html', 'w') as f:
    f.write(content)
