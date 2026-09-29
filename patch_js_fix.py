import re

with open('index.html', 'r') as f:
    content = f.read()

# Fix the firebaseReady initialization error in JSDOM testing context
# by mocking firebase.messaging if it doesn't exist
content = content.replace("messaging = firebase.messaging();", "messaging = typeof firebase.messaging === 'function' ? firebase.messaging() : null;")

with open('index.html', 'w') as f:
    f.write(content)
