Wait, Bug 1 says "I personally completed a full test and achieved 100%, but my actual result, student name and other details are not appearing correctly under All-Time -> All Tests."
And it says: "Instead, the leaderboard displays this suspicious record: Student: Test Student, Test: Untitled Test, Correct Answers: 0/0, Percentage: NaN%."
This means the NaN% record **is** what they are seeing *in place* of their actual result?
Wait, if it was recorded as 0/0, that means `total` was 0. How could `total` be 0?
If `currentTestDocId` is set, but `currentTest` is somehow empty? Or maybe it's falling back to an incorrect record in Local Storage?
Let's see: `currentTestDocId` is set when opening a test.
Wait, the prompt says "Investigate whether Local Storage is being incorrectly treated as the permanent source of test results."
And: "A result must not silently appear saved when the Firebase write actually failed."
"Use a stable attempt/result ID for each test attempt."

Let's look at `index.html` again. Does it pull results from local storage and inject them into the leaderboard?
Let's check `lastLeaderboardDocs`. It is populated by `query.onSnapshot(...)` in `loadLeaderboard()`.
It does NOT read from Local Storage.
But what about `Bug 3: Local Storage and Firebase Sync`?
Maybe `saveHistoryEntry` is saving to Local Storage, and the user thinks it's saved.
The prompt says: "Investigate whether Local Storage is being incorrectly treated as the permanent source of test results. Requirements: Firebase Firestore must remain the permanent source of submitted test results... Handle Firebase write failures clearly. Prevent duplicate submissions... Use a stable attempt/result ID... Ensure the same student's valid results can be fetched across different devices after authentication."

Wait, how do we handle Firebase write failures clearly, use a stable attempt/result ID, prevent duplicate submissions when retrying a failed save, and ensure valid results can be fetched across devices?
If `db.collection('testResults').doc(stableId).set({...})` instead of `.add()`, we can guarantee idempotency!
Let's generate a stable `attemptId` before saving.
```javascript
  const attemptId = generateUUID();
```
And how to retry if offline or failed? Firebase handles retries automatically *IF* persistence is enabled and the app doesn't close. But to be safe and persistent across reloads, we could implement a basic offline queue, or just rely on Firebase's built-in offline persistence. Let's enable Firebase offline persistence in `initFirebase()` or at the top of the file!

Wait, `index.html` initializes Firebase at the top. Let's check `firebase.initializeApp`.
