import sys

with open("firebase-functions/index.js", "r") as f:
    content = f.read()

search = """        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Successfully sent message to ${response.successCount} devices`);

        if (response.failureCount > 0) {
            const failedTokens = [];
            response.results.forEach((res, idx) => {"""

replace = """        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Successfully sent message to ${response.successCount} devices`);

        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((res, idx) => {"""

content = content.replace(search, replace)

with open("firebase-functions/index.js", "w") as f:
    f.write(content)
