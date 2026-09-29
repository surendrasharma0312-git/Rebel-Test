import re

with open('index.html', 'r') as f:
    content = f.read()

# 3. Add JS for Firebase Messaging
js_code = """
let messaging = null;

try{
  if(firebaseConfig.apiKey && firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY"){
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    messaging = firebase.messaging();
    firebaseReady = true;
  }
}catch(e){
  console.error('Firebase init failed', e);
  firebaseReady = false;
}
"""
content = re.sub(
    r"try\{\s*if\(firebaseConfig.apiKey.*?\)\{\s*firebase.initializeApp\(firebaseConfig\);\s*db = firebase.firestore\(\);\s*firebaseReady = true;\s*\}\s*\}catch\(e\)\{\s*console.error\('Firebase init failed', e\);\s*firebaseReady = false;\s*\}",
    js_code.strip(),
    content,
    flags=re.DOTALL
)

# 4. Add messaging logic
messaging_logic = """
/* =========================================================
   PUSH NOTIFICATIONS
========================================================= */
const VAPID_KEY = "BDr1kP7J0uL1c8F6iGj9z2Rk5tM4Nn7O-pQv3Xy8A9sCw6Dq0_E4uF1gH5jK7mL2xP5rS4vW9nB2kM1qZ8xR3yA"; // Replace with actual VAPID key if needed, or leave it to Firebase

async function checkNotificationPermission() {
  if (!('Notification' in window) || !messaging) return 'unsupported';
  return Notification.permission;
}

async function subscribeToPush() {
  if (!messaging) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission not granted');
      return false;
    }
    const token = await messaging.getToken();
    if (token) {
      console.log('FCM Token:', token);
      await saveTokenToFirestore(token);
      localStorage.setItem('pushEnabled', 'true');
      updatePushUI();
      return true;
    }
  } catch (error) {
    console.error('Error subscribing to push:', error);
  }
  return false;
}

async function unsubscribeFromPush() {
  if (!messaging) return;
  try {
    const token = await messaging.getToken();
    if (token) {
      await messaging.deleteToken();
      await removeTokenFromFirestore(token);
    }
    localStorage.setItem('pushEnabled', 'false');
    updatePushUI();
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
  }
}

async function saveTokenToFirestore(token) {
  if (!db) return;
  try {
    const tokensRef = db.collection('fcmTokens');
    await tokensRef.doc(token).set({
      token: token,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error("Error saving token", e);
  }
}

async function removeTokenFromFirestore(token) {
  if (!db) return;
  try {
    await db.collection('fcmTokens').doc(token).delete();
  } catch (e) {
    console.error("Error deleting token", e);
  }
}

function updatePushUI() {
  const btn = $('togglePushBtn');
  if (!btn) return;
  const isEnabled = localStorage.getItem('pushEnabled') === 'true';
  btn.textContent = isEnabled ? 'ON' : 'OFF';
  btn.style.color = isEnabled ? 'var(--primary-hover)' : 'var(--text)';
  btn.style.borderColor = isEnabled ? 'var(--primary)' : 'var(--border)';
  btn.style.background = isEnabled ? 'var(--primary-light)' : 'var(--surface-2)';
}

$('togglePushBtn')?.addEventListener('click', async () => {
  const isEnabled = localStorage.getItem('pushEnabled') === 'true';
  if (isEnabled) {
    await unsubscribeFromPush();
  } else {
    await subscribeToPush();
  }
});

// Foreground messages
if (messaging) {
  messaging.onMessage((payload) => {
    console.log('Message received. ', payload);
    // The existing snapshot listener handles the in-app notification UI,
    // so we don't necessarily need to show a custom banner here unless desired.
    // If we wanted to, we could show a toast.
  });
}

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
  updatePushUI();
});
"""

# Find a good place to insert this. Before the end of the script tag is good.
content = content.replace("/* =========================================================\n   CLOUD (SHARED) TESTS\n========================================================= */", messaging_logic + "\n/* =========================================================\n   CLOUD (SHARED) TESTS\n========================================================= */")

with open('index.html', 'w') as f:
    f.write(content)
