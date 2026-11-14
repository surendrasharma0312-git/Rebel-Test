const functions = require('firebase-functions');
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
