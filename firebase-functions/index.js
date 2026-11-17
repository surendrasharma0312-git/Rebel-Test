const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
admin.initializeApp();

async function sendMulticastInBatches(payload) {
  let lastDoc = null;
  let hasMore = true;
  let totalTokens = 0;

  while (hasMore) {
    let query = admin.firestore().collection('fcmTokens').orderBy(admin.firestore.FieldPath.documentId()).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const tokensSnapshot = await query.get();
    if (tokensSnapshot.empty) {
      hasMore = false;
      break;
    }

    const tokens = [];
    const docs = [];
    tokensSnapshot.forEach(doc => {
      tokens.push(doc.data().token);
      docs.push(doc);
    });

    totalTokens += tokens.length;

    const message = {
      notification: payload.notification,
      data: payload.data,
      tokens: tokens
    };
    const response = await admin.messaging().sendEachForMulticast(message);

    // Cleanup invalid tokens
    const batch = admin.firestore().batch();
    let hasDeletes = false;

    response.results.forEach((result, index) => {
      const error = result.error;
      if (error) {
        console.error('Failure sending notification to', tokens[index], error);
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
          batch.delete(docs[index].ref);
          hasDeletes = true;
        }
      }
    });

    if (hasDeletes) {
      await batch.commit();
    }

    if (tokensSnapshot.size < 500) {
      hasMore = false;
    } else {
      lastDoc = tokensSnapshot.docs[tokensSnapshot.size - 1];
    }
  }
  return totalTokens;
}

exports.sendTestNotification = functions.firestore
  .document('vocabTests/{testId}')
  .onCreate(async (snap, context) => {
    const testData = snap.data();
    const testName = testData.name || 'A new test';

    const payload = {
      notification: {
        title: 'New Test Available 📚',
        body: `"${testName}" has been published. Tap to start!`,
        icon: '/icon-192.png'
      },
      data: {
        type: 'NEW_TEST',
        testId: context.params.testId,
        testTitle: testName,
        click_action: 'FLUTTER_NOTIFICATION_CLICK' // Optional, for web we use the sw.js notificationclick
      }
    };

    try {
      const totalTokens = await sendMulticastInBatches(payload);

      return null;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return null;
    }
  });

exports.sendUpdateNotification = functions.firestore
  .document('vocabTests/{testId}')
  .onUpdate(async (change, context) => {
    const newValue = change.after.data();
    const previousValue = change.before.data();

    // Check if it's a meaningful update
    // We assume an update is meaningful if 'words' or 'name' changed
    if (newValue.name === previousValue.name &&
        JSON.stringify(newValue.words) === JSON.stringify(previousValue.words)) {
      return null;
    }

    const testName = newValue.name || 'A test';

    const payload = {
      notification: {
        title: 'Test Updated',
        body: `"${testName}" has been updated. Tap to view it.`,
        icon: '/icon-192.png'
      },
      data: {
        type: 'TEST_UPDATED',
        testId: context.params.testId,
        testTitle: testName
      }
    };

    try {
      await sendMulticastInBatches(payload);

      return null;
    } catch (error) {
      console.error('Error sending update notification:', error);
      return null;
    }
  });

const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const adminPasswordSecret = defineSecret('REBEL_ADMIN_PASSWORD');

async function recordAdminLoginFailure(request, uid) {
  const rawIp = request.rawRequest && request.rawRequest.ip;
  const identity = rawIp || uid;
  const key = crypto.createHash('sha256').update(String(identity)).digest('hex');
  const ref = admin.firestore().collection('adminLoginAttempts').doc(key);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;

  return admin.firestore().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : {};
    const startedAt = Number(data.windowStartedAt || 0);
    const withinWindow = startedAt > 0 && now - startedAt < windowMs;
    const attempts = withinWindow ? Number(data.failedAttempts || 0) : 0;
    if (attempts >= maxAttempts) return false;

    transaction.set(ref, {
      failedAttempts: attempts + 1,
      windowStartedAt: withinWindow ? startedAt : now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
  });
}

exports.adminAccess = onCall(
  { secrets: [adminPasswordSecret] },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'Sign in is required.');
    }

    const uid = request.auth.uid;
    const action = request.data && request.data.action;

    if (action === 'logout') {
      const current = await admin.auth().getUser(uid);
      const claims = { ...(current.customClaims || {}) };
      delete claims.admin;
      await admin.auth().setCustomUserClaims(uid, claims);
      return { ok: true, admin: false };
    }

    if (action !== 'login') {
      throw new HttpsError('invalid-argument', 'Unsupported admin action.');
    }

    const suppliedPassword = request.data && request.data.password;
    const configuredPassword = adminPasswordSecret.value();
    if (typeof suppliedPassword !== 'string' || !suppliedPassword ||
        typeof configuredPassword !== 'string' || !configuredPassword) {
      throw new HttpsError('failed-precondition', 'Admin password secret is not configured.');
    }

    const supplied = Buffer.from(suppliedPassword, 'utf8');
    const expected = Buffer.from(configuredPassword, 'utf8');
    const matches = supplied.length === expected.length &&
      crypto.timingSafeEqual(supplied, expected);
    if (!matches) {
      const mayRetry = await recordAdminLoginFailure(request, uid);
      if (!mayRetry) {
        throw new HttpsError('resource-exhausted', 'Too many failed admin sign-in attempts. Try again in 15 minutes.');
      }
      throw new HttpsError('permission-denied', 'Incorrect admin password.');
    }

    const rawIp = request.rawRequest && request.rawRequest.ip;
    const rateLimitKey = crypto.createHash('sha256').update(String(rawIp || uid)).digest('hex');
    await admin.firestore().collection('adminLoginAttempts').doc(rateLimitKey).delete();

    const current = await admin.auth().getUser(uid);
    await admin.auth().setCustomUserClaims(uid, {
      ...(current.customClaims || {}),
      admin: true
    });
    return { ok: true, admin: true };
  }
);


const { resolveStudentIdentity, hasGoogleIdentity } = require('./student-identity');
const { validateAttempt } = require('./attempt-validation');

exports.resolveStudentIdentity = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const firebaseIdentity = request.auth.token && request.auth.token.firebase;
  if (!hasGoogleIdentity(firebaseIdentity)) {
    throw new HttpsError('permission-denied', 'Google sign-in is required.');
  }

  try {
    return await resolveStudentIdentity({
      uid: request.auth.uid,
      legacyStudentId: request.data && request.data.legacyStudentId,
      db: admin.firestore(),
      FieldValue: admin.firestore.FieldValue
    });
  } catch (error) {
    const allowedCodes = ['invalid-argument', 'failed-precondition', 'unauthenticated'];
    if (allowedCodes.includes(error.code)) {
      throw new HttpsError(error.code, error.message);
    }
    console.error('Failed to resolve student identity:', error);
    throw new HttpsError('internal', 'Unable to resolve the student account right now.');
  }
});


exports.submitStudentAttempt = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const uid = request.auth.uid;
  const firebaseIdentity = request.auth.token && request.auth.token.firebase;
  if (!hasGoogleIdentity(firebaseIdentity)) {
    throw new HttpsError('permission-denied', 'Google sign-in is required.');
  }

  const data = request.data && typeof request.data === 'object' ? request.data : {};
  const attemptId = data.attemptId;
  const testDocId = data.testDocId;
  if (typeof attemptId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId) ||
      typeof testDocId !== 'string' || !testDocId.trim() || testDocId.trim() !== testDocId ||
      testDocId.includes('/') || testDocId.length > 150) {
    throw new HttpsError('invalid-argument', 'The attempt or test identifier is invalid.');
  }

  if (data.durationSeconds !== null && data.durationSeconds !== undefined &&
      (typeof data.durationSeconds !== 'number' || !Number.isFinite(data.durationSeconds) ||
       data.durationSeconds < 0 || data.durationSeconds > 86400)) {
    throw new HttpsError('invalid-argument', 'The test duration is invalid.');
  }

  try {
    const db = admin.firestore();
    const linkSnapshot = await db.collection('studentAccountLinks').doc(uid).get();
    const studentId = linkSnapshot.exists && linkSnapshot.data()
      ? linkSnapshot.data().studentId
      : null;
    if (typeof studentId !== 'string' || !studentId) {
      throw new HttpsError('failed-precondition', 'Complete Google student sign-in before submitting a test.');
    }

    const [profileSnapshot, testSnapshot] = await Promise.all([
      db.collection('studentProfiles').doc(studentId).get(),
      db.collection('vocabTests').doc(testDocId).get()
    ]);
    const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
    const testData = testSnapshot.exists ? testSnapshot.data() : null;
    if (!profile || typeof profile.name !== 'string' || !profile.name.trim()) {
      throw new HttpsError('failed-precondition', 'Complete your student profile before submitting a test.');
    }
    if (!testData || (testData.isVerbTest === true && testData.isPublished !== true)) {
      throw new HttpsError('not-found', 'The published test could not be found.');
    }

    const score = validateAttempt({ testData, answers: data.answers });
    const resultData = {
      studentId,
      authUid: uid,
      studentName: profile.name.trim().slice(0, 100),
      testDocId,
      testName: typeof testData.name === 'string' && testData.name.trim()
        ? testData.name.trim().slice(0, 160)
        : 'Untitled Test',
      testType: testData.isVerbTest === true ? 'verb' : 'vocab',
      ...score,
      durationSeconds: data.durationSeconds == null ? null : Math.round(data.durationSeconds),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const resultRef = db.collection('testResults').doc(attemptId);
    let savedScore = score;
    let alreadySubmitted = false;
    await db.runTransaction(async transaction => {
      const existing = await transaction.get(resultRef);
      if (existing.exists) {
        const previous = existing.data() || {};
        if (previous.authUid === uid && previous.studentId === studentId &&
            previous.testDocId === testDocId) {
          // A retry after a lost network response is idempotent and cannot
          // replace the original server-calculated result.
          savedScore = {
            total: previous.total,
            correct: previous.correct,
            wrong: previous.wrong,
            timeout: previous.timeout,
            pct: previous.pct
          };
          alreadySubmitted = true;
          return;
        }
        throw new HttpsError('already-exists', 'This attempt identifier is already in use.');
      }
      transaction.create(resultRef, resultData);
    });

    return { saved: true, alreadySubmitted, attemptId, score: savedScore };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error && ['invalid-argument', 'failed-precondition'].includes(error.code)) {
      throw new HttpsError(error.code, error.message);
    }
    console.error('Failed to validate and save student attempt:', error);
    throw new HttpsError('internal', 'Unable to save this test result right now.');
  }
});


const {
  createPublicStudentId,
  projectPublicLeaderboardResult,
  projectPublicStudentProfile
} = require('./public-projections');
const publicStudentIdSecret = defineSecret('REBEL_PUBLIC_ID_SECRET');

exports.syncPublicLeaderboardResult = functions.runWith({
  secrets: [publicStudentIdSecret]
}).firestore
  .document('testResults/{attemptId}')
  .onWrite(async (change, context) => {
    const publicRef = admin.firestore().collection('publicLeaderboard').doc(context.params.attemptId);
    if (!change.after.exists) {
      await publicRef.delete();
      return null;
    }
    const projected = projectPublicLeaderboardResult(
      change.after.data(), publicStudentIdSecret.value()
    );
    if (!projected) {
      await publicRef.delete();
      return null;
    }
    await publicRef.set(projected);
    return null;
  });

exports.syncPublicStudentProfile = functions.runWith({
  secrets: [publicStudentIdSecret]
}).firestore
  .document('studentProfiles/{studentId}')
  .onWrite(async (change, context) => {
    const publicStudentId = createPublicStudentId(
      context.params.studentId, publicStudentIdSecret.value()
    );
    if (!publicStudentId) return null;
    const publicRef = admin.firestore().collection('publicStudentProfiles').doc(publicStudentId);
    if (!change.after.exists) {
      await publicRef.delete();
      return null;
    }
    const projected = projectPublicStudentProfile(
      change.after.data(), context.params.studentId, publicStudentIdSecret.value()
    );
    if (!projected) {
      await publicRef.delete();
      return null;
    }
    await publicRef.set(projected);
    return null;
  });

