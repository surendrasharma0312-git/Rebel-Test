import sys

with open("index.html", "r") as f:
    content = f.read()

search = """async function subscribeToPush() {
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
}"""

replace = """async function subscribeToPush() {
  if (!messaging) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission not granted');
      localStorage.setItem('pushEnabled', 'false');
      updatePushUI();
      return false;
    }
    const token = await messaging.getToken({ vapidKey: 'BDr1kP7J0uL1c8F6iGj9z2Rk5tM4Nn7O-pQv3Xy8A9sCw6Dq0_E4uF1gH5jK7mL2xP5rS4vW9nB2kM1qZ8xR3yA' }); // Use the VAPID key
    if (token) {
      console.log('FCM Token:', token);
      await saveTokenToFirestore(token);
      localStorage.setItem('pushEnabled', 'true');
      updatePushUI();
      return true;
    }
  } catch (error) {
    console.error('Error subscribing to push:', error);
    localStorage.setItem('pushEnabled', 'false');
    updatePushUI();
  }
  return false;
}"""

content = content.replace(search, replace)

with open("index.html", "w") as f:
    f.write(content)
