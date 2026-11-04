### Root Cause Analysis

1. **Bug 1 & 3: Missing Result (LocalStorage Sync)**
   The results are stored locally successfully (in history and potentially localStorage `vocabTestApp_history`) and displayed at the end of the test. However, the result write to Firestore using `db.collection('testResults').add(...)` might fail (for instance if internet fails) but the app continues by catching the error `catch(err) { console.error('Leaderboard save failed', err); }` and proceeding silently. Additionally, `saveToLeaderboard()` is missing a mechanism to retry failed uploads, so the data only stays locally. Also, when saving, the `studentId` might be mismatched or skipped if the user isn't successfully prompted for their name.
   Wait, the bug report says "Do not assume Local Storage is the cause. Verify it...". The record shown is "Test Student - Untitled Test - 0/0 - NaN%".
   If `currentTest.length` is 0, total is 0, correct is 0. pct becomes NaN. A test without questions could be submitted if the app doesn't validate `currentTest.length > 0` before calling `finishTest()`.
   Actually, the user completed a *full test* and achieved 100%, but it didn't appear. That indicates Bug 1 could be `saveToLeaderboard` being skipped or failing. `saveToLeaderboard` returns immediately if `!currentTestDocId`. `currentTestDocId` tracks if a test came from the cloud. If the user creates a test or plays a practice test, it is null. Let's see: `currentTestDocId = null` happens in `continueSavedBtn` click, practice mistakes, parsePastePersonal, etc. But if they take a *published test*, `currentTestDocId` should be the doc ID.

2. **Bug 2: All-Time → All Tests Missing Results**
   In `index.html`:
   ```javascript
    query = query.where('createdAt', '>=', startUTC)
                 .where('createdAt', '<=', endUTC)
                 .orderBy('createdAt', 'desc')
                 .limit(300);
   ```
   vs
   ```javascript
    query = query.orderBy('createdAt', 'desc').limit(300);
   ```
   Wait! `query.orderBy('createdAt', 'desc')` requires an index if there is a `where` clause. But if it's "All-Time -> All Tests", there's NO `where` clause. So it shouldn't drop records *unless* `bestPerStudentPerTest` drops them, or unless the leaderboard filtering in `renderLeaderboardList` excludes them.
   Ah, `bestPerStudentPerTest` groups by student and `testDocId`. Wait, if `testDocId` is null/missing for older tests, it groups them all into one bucket: `studentName|undefined`! Then the student only gets ONE all-time "Untitled Test" result across all missing testDocIds! Let's check `bestPerStudentPerTest`.
   ```javascript
    const key = `${(d.studentName||'').trim().toLowerCase()}|${d.testDocId}`;
   ```
   If `d.testDocId` is undefined or missing on some records, all those records get clumped together, effectively dropping all but the "best" score across different modules. In "All-Time -> Verb Forms", if the module filter runs *first*, it might still clump them. BUT `leaderboardModuleFilter !== 'all'` filters `docs` *before* `bestPerStudentPerTest`! Thus, separating verb and vocab might allow one of each. But for "All-Time -> All Tests", they compete for the same `null`/`undefined` key, meaning you only see one result!
   Wait, if `testDocId` *is* present (e.g. they took two distinct published tests), they would have distinct `testDocId`s. But what if older tests used a different identifier, like `testId` or something? I should check `saveToLeaderboard`. It uses `testDocId: currentTestDocId`.

3. **Bug 4: NaN% Record**
   ```javascript
   const pct = Math.round((correct/total)*100);
   ```
   If `total === 0`, `pct` is `NaN`. In `finishTest()`, we should check `if (total === 0) pct = 0;`.
   Wait, if `total === 0`, we shouldn't save it to the leaderboard at all!
   ```javascript
   if (total === 0) return; // Prevent zero-question tests
   ```

Let me review the `bestPerStudentPerTest` function:
```javascript
function bestPerStudentPerTest(docs){
  const best = new Map();
  docs.forEach(doc=>{
    const d = doc.data();
    // FALLBACK to doc.id as testDocId if it doesn't exist? No, testDocId is the module ID.
    // If testDocId is missing, maybe fallback to testName?
    const testKey = d.testDocId || d.testName || 'unknown_test';
    const key = `${(d.studentName||'').trim().toLowerCase()}|${testKey}`;
    // ...
```
