import sys

with open("firebase-functions/index.js", "r") as f:
    content = f.read()

content = content.replace("response.results.forEach", "response.responses.forEach")

with open("firebase-functions/index.js", "w") as f:
    f.write(content)
