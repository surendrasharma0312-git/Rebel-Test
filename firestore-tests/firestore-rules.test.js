'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');

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

test('student results are private, append-only and tied to the authenticated identity', async () => {
  const owner = env.authenticatedContext('student-a', { firebase: { sign_in_provider: 'google.com' } }).firestore();
  const other = env.authenticatedContext('student-b', { firebase: { sign_in_provider: 'google.com' } }).firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  const admin = env.authenticatedContext('admin-a', { admin: true }).firestore();
  const result = { authUid: 'student-a', studentId: 'student-a', studentName: 'Student A', total: 10, correct: 8, pct: 80 };
  await assertSucceeds(setDoc(doc(owner, 'testResults/attempt-1'), result));
  await assertFails(setDoc(doc(other, 'testResults/attempt-2'), result));
  await assertSucceeds(getDoc(doc(owner, 'testResults/attempt-1')));
  await assertFails(getDoc(doc(other, 'testResults/attempt-1')));
  await assertFails(getDoc(doc(anonymous, 'testResults/attempt-1')));
  await assertSucceeds(getDoc(doc(admin, 'testResults/attempt-1')));
  const ownerHistory = await getDocs(query(collection(owner, 'testResults'), where('studentId', '==', 'student-a')));
  assert.equal(ownerHistory.size, 1);
  await assertFails(getDocs(collection(other, 'testResults')));
  await assertFails(updateDoc(doc(owner, 'testResults/attempt-1'), { pct: 100 }));
  await assertFails(deleteDoc(doc(owner, 'testResults/attempt-1')));
});

test('verified legacy identity mapping permits its owner to create results for that legacy ID', async () => {
  const owner = env.authenticatedContext('student-a', { firebase: { sign_in_provider: 'google.com' } }).firestore();
  await assertSucceeds(setDoc(doc(owner, 'testResults/legacy-attempt'), {
    authUid: 'student-a', studentId: 'legacy-student-a', studentName: 'Student A',
    total: 10, correct: 9, pct: 90
  }));
});

test('profiles are private and only the owner or admin can read or write them', async () => {
  const owner = env.authenticatedContext('student-a', { firebase: { sign_in_provider: 'google.com' } }).firestore();
  const other = env.authenticatedContext('student-b', { firebase: { sign_in_provider: 'google.com' } }).firestore();
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
  const owner = env.authenticatedContext('student-a', { firebase: { sign_in_provider: 'google.com' } }).firestore();
  const other = env.authenticatedContext('student-b', { firebase: { sign_in_provider: 'google.com' } }).firestore();
  const token = 'fcm-token-a';
  const data = { token, authUid: 'student-a', createdAt: new Date(), updatedAt: new Date() };
  await assertSucceeds(setDoc(doc(owner, 'fcmTokens/' + token), data));
  await assertFails(getDoc(doc(other, 'fcmTokens/' + token)));
  await assertFails(deleteDoc(doc(other, 'fcmTokens/' + token)));
  await assertSucceeds(deleteDoc(doc(owner, 'fcmTokens/' + token)));
});


test('anonymous Firebase sessions cannot create student results, profiles, or FCM tokens', async () => {
  const anonymous = env.authenticatedContext('anonymous-a', {
    firebase: { sign_in_provider: 'anonymous' }
  }).firestore();
  await assertFails(setDoc(doc(anonymous, 'testResults/anonymous-attempt'), {
    authUid: 'anonymous-a', studentId: 'anonymous-a', studentName: 'Anonymous',
    total: 10, correct: 8, pct: 80
  }));
  await assertFails(setDoc(doc(anonymous, 'studentProfiles/anonymous-a'), {
    name: 'Anonymous', bio: '', photo: null, phone: '', email: '', address: '',
    showPublic: false
  }));
  await assertFails(setDoc(doc(anonymous, 'fcmTokens/anonymous-token'), {
    token: 'anonymous-token', authUid: 'anonymous-a'
  }));
});


test('sanitized public projections are readable by everyone but never client-writable', async () => {
  const anonymous = env.unauthenticatedContext().firestore();
  const student = env.authenticatedContext('student-a', {
    firebase: { sign_in_provider: 'google.com' }
  }).firestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'publicLeaderboard/attempt-1'), {
      publicStudentId: 'opaque-public-id-a', studentName: 'Student A', pct: 90
    });
    await setDoc(doc(context.firestore(), 'publicStudentProfiles/opaque-public-id-a'), {
      publicStudentId: 'opaque-public-id-a', name: 'Student A'
    });
  });
  await assertSucceeds(getDoc(doc(anonymous, 'publicLeaderboard/attempt-1')));
  await assertSucceeds(getDoc(doc(anonymous, 'publicStudentProfiles/opaque-public-id-a')));
  await assertFails(setDoc(doc(student, 'publicLeaderboard/forged'), {
    publicStudentId: 'opaque-public-id-a', studentName: 'Forged', pct: 100
  }));
  await assertFails(setDoc(doc(student, 'publicStudentProfiles/opaque-public-id-a'), {
    publicStudentId: 'opaque-public-id-a', name: 'Forged'
  }));
});

test('identity links, admin attempts and legacy config are inaccessible to clients', async () => {
  const admin = env.authenticatedContext('admin-a', { admin: true }).firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(admin, 'studentAccountLinks/student-a')));
  await assertFails(setDoc(doc(admin, 'studentAccountLinks/forged'), { studentId: 'forged' }));
  await assertFails(getDoc(doc(admin, 'adminLoginAttempts/attempt-a')));
  await assertFails(getDoc(doc(anonymous, 'config/admin')));
});

test('anonymous owner cannot read or delete a profile even when its UID matches the document ID', async () => {
  const anonymousOwner = env.authenticatedContext('anonymous-a', {
    firebase: { sign_in_provider: 'anonymous' }
  }).firestore();

  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'studentProfiles/anonymous-a'), {
      name: 'Legacy Anonymous Profile', bio: '', photo: null,
      phone: '9999999999', email: 'private@example.test',
      address: 'Private address', showPublic: false
    });
  });

  await assertFails(getDoc(doc(anonymousOwner, 'studentProfiles/anonymous-a')));
  await assertFails(deleteDoc(doc(anonymousOwner, 'studentProfiles/anonymous-a')));
});
