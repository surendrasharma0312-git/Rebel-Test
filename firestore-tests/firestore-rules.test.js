'use strict';
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');

let env;
test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rebel-test',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') }
  });
});
test.after(async () => { if (env) await env.cleanup(); });
test.beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'studentAccountLinks/student-a'), {
      authUid: 'student-a', studentId: 'legacy-student-a'
    });
  });
});

test('vocab tests are public-read and admin-write only', async () => {
  const anonymous = env.unauthenticatedContext().firestore();
  const student = env.authenticatedContext('student-a').firestore();
  const admin = env.authenticatedContext('admin-a', { admin: true }).firestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'vocabTests/test-1'), { name: 'Sample' });
  });
  await assertSucceeds(getDoc(doc(anonymous, 'vocabTests/test-1')));
  await assertFails(setDoc(doc(student, 'vocabTests/test-2'), { name: 'Student write' }));
  await assertSucceeds(setDoc(doc(admin, 'vocabTests/test-2'), { name: 'Admin write' }));
});

test('students can create results only for their authenticated identity; results are immutable', async () => {
  const owner = env.authenticatedContext('student-a').firestore();
  const other = env.authenticatedContext('student-b').firestore();
  const result = { authUid: 'student-a', studentId: 'student-a', studentName: 'Student A', total: 10, correct: 8, pct: 80 };
  await assertSucceeds(setDoc(doc(owner, 'testResults/attempt-1'), result));
  await assertFails(setDoc(doc(other, 'testResults/attempt-2'), result));
  await assertFails(updateDoc(doc(owner, 'testResults/attempt-1'), { pct: 100 }));
  await assertFails(deleteDoc(doc(owner, 'testResults/attempt-1')));
});

test('verified legacy identity mapping permits its owner to create results for that legacy ID', async () => {
  const owner = env.authenticatedContext('student-a').firestore();
  await assertSucceeds(setDoc(doc(owner, 'testResults/legacy-attempt'), {
    authUid: 'student-a', studentId: 'legacy-student-a', studentName: 'Student A',
    total: 10, correct: 9, pct: 90
  }));
});

test('profiles are private and only the owner or admin can read or write them', async () => {
  const owner = env.authenticatedContext('student-a').firestore();
  const other = env.authenticatedContext('student-b').firestore();
  const admin = env.authenticatedContext('admin-a', { admin: true }).firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  const profile = {
    name: 'Student A', bio: '', photo: null, phone: '9999999999',
    email: 'student@example.test', address: 'Private address', showPublic: true
  };
  await assertSucceeds(setDoc(doc(owner, 'studentProfiles/legacy-student-a'), profile));
  await assertSucceeds(getDoc(doc(owner, 'studentProfiles/legacy-student-a')));
  await assertFails(getDoc(doc(other, 'studentProfiles/legacy-student-a')));
  await assertFails(getDoc(doc(anonymous, 'studentProfiles/legacy-student-a')));
  await assertSucceeds(getDoc(doc(admin, 'studentProfiles/legacy-student-a')));
  await assertFails(setDoc(doc(other, 'studentProfiles/legacy-student-a'), profile));
});

test('FCM tokens are private and writable only by their owner', async () => {
  const owner = env.authenticatedContext('student-a').firestore();
  const other = env.authenticatedContext('student-b').firestore();
  const token = 'fcm-token-a';
  const data = { token, authUid: 'student-a', createdAt: new Date(), updatedAt: new Date() };
  await assertSucceeds(setDoc(doc(owner, 'fcmTokens/' + token), data));
  await assertFails(getDoc(doc(other, 'fcmTokens/' + token)));
  await assertFails(deleteDoc(doc(other, 'fcmTokens/' + token)));
  await assertSucceeds(deleteDoc(doc(owner, 'fcmTokens/' + token)));
});

test('identity links, admin attempts and legacy config are inaccessible to clients', async () => {
  const admin = env.authenticatedContext('admin-a', { admin: true }).firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(admin, 'studentAccountLinks/student-a')));
  await assertFails(setDoc(doc(admin, 'studentAccountLinks/forged'), { studentId: 'forged' }));
  await assertFails(getDoc(doc(admin, 'adminLoginAttempts/attempt-a')));
  await assertFails(getDoc(doc(anonymous, 'config/admin')));
});
