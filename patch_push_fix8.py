import sys

with open("index.html", "r") as f:
    content = f.read()

search = """    const token = await messaging.getToken({ vapidKey: 'BDr1kP7J0uL1c8F6iGj9z2Rk5tM4Nn7O-pQv3Xy8A9sCw6Dq0_E4uF1gH5jK7mL2xP5rS4vW9nB2kM1qZ8xR3yA' }); // Use the VAPID key"""

replace = """    const swRegistration = await navigator.serviceWorker.ready;
    const token = await messaging.getToken({
      serviceWorkerRegistration: swRegistration,
      vapidKey: 'BDr1kP7J0uL1c8F6iGj9z2Rk5tM4Nn7O-pQv3Xy8A9sCw6Dq0_E4uF1gH5jK7mL2xP5rS4vW9nB2kM1qZ8xR3yA'
    });"""

content = content.replace(search, replace)

with open("index.html", "w") as f:
    f.write(content)
