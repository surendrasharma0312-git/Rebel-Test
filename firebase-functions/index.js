const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

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

      console.log(`Sending notification to ${totalTokens} devices...`);
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
      let lastDoc = null;
      let hasMore = true;

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

        const message = {
          notification: payload.notification,
          data: payload.data,
          tokens: tokens
        };
        const response = await admin.messaging().sendEachForMulticast(message);

        const batch = admin.firestore().batch();
        let hasDeletes = false;

        response.results.forEach((result, index) => {
          const error = result.error;
          if (error) {
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

      return null;
    } catch (error) {
      console.error('Error sending update notification:', error);
      return null;
    }
  });
