with open('firebase-functions/index.js', 'r') as f:
    content = f.read()

# Replace sendToDevice with sendEachForMulticast
content = content.replace("const response = await admin.messaging().sendToDevice(tokens, payload);", """
      const message = {
        notification: payload.notification,
        data: payload.data,
        tokens: tokens
      };
      const response = await admin.messaging().sendEachForMulticast(message);
""")

with open('firebase-functions/index.js', 'w') as f:
    f.write(content)
