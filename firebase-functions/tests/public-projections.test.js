'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPublicStudentId,
  projectPublicLeaderboardResult,
  projectPublicStudentProfile
} = require('../public-projections');

const secret = 'test-only-public-id-secret-with-32-bytes-minimum';

test('public student IDs are stable, opaque, and secret-scoped', () => {
  const first = createPublicStudentId('firebase-auth-uid-private', secret);
  assert.equal(first, createPublicStudentId('firebase-auth-uid-private', secret));
  assert.notEqual(first, 'firebase-auth-uid-private');
  assert.notEqual(first, createPublicStudentId('firebase-auth-uid-private', 'different-test-secret-with-32-bytes'));
  assert.equal(first.length, 32);
  assert.equal(createPublicStudentId('firebase-auth-uid-private', 'short'), null);
});

test('leaderboard projection uses opaque public ID and excludes auth identifiers and arbitrary fields', () => {
  const projected = projectPublicLeaderboardResult({
    studentId: 'firebase-auth-uid-private', studentName: 'Student One',
    authUid: 'firebase-auth-uid-private', testDocId: 'test-1',
    testName: 'Vocabulary', testType: 'vocab',
    total: 20, correct: 18, wrong: 2, timeout: 0, pct: 90,
    durationSeconds: 120, createdAt: 'timestamp', privateNote: 'do not expose'
  }, secret);

  assert.deepEqual(projected, {
    publicStudentId: createPublicStudentId('firebase-auth-uid-private', secret),
    studentName: 'Student One', testDocId: 'test-1',
    testName: 'Vocabulary', testType: 'vocab',
    total: 20, correct: 18, wrong: 2, timeout: 0, pct: 90,
    durationSeconds: 120, createdAt: 'timestamp'
  });
  assert.equal(JSON.stringify(projected).includes('firebase-auth-uid-private'), false);
  assert.equal('studentId' in projected, false);
  assert.equal('authUid' in projected, false);
  assert.equal('privateNote' in projected, false);
});

test('invalid leaderboard records are not projected', () => {
  assert.equal(projectPublicLeaderboardResult({ authUid: 'private' }, secret), null);
  assert.equal(projectPublicLeaderboardResult({ studentId: 's1', studentName: 'One' }), null);
  assert.equal(projectPublicLeaderboardResult(null, secret), null);
});

test('public profile projection never exposes auth IDs or contact fields, even after broad opt-in', () => {
  const projected = projectPublicStudentProfile({
    name: 'Student One', bio: 'Learner', photo: 'photo-data',
    phone: '9999999999', email: 'student@example.test',
    address: 'Private address', showPublic: true, authUid: 'private-auth-uid'
  }, 'private-auth-uid', secret);

  assert.deepEqual(projected, {
    publicStudentId: createPublicStudentId('private-auth-uid', secret),
    name: 'Student One', bio: 'Learner', photo: 'photo-data'
  });
  assert.equal(JSON.stringify(projected).includes('private-auth-uid'), false);
  assert.equal(JSON.stringify(projected).includes('9999999999'), false);
  assert.equal(JSON.stringify(projected).includes('student@example.test'), false);
  assert.equal(JSON.stringify(projected).includes('Private address'), false);
});

test('public profile opt-out removes the public projection', () => {
  assert.equal(projectPublicStudentProfile({
    name: 'Student One', showPublic: false
  }, 'private-auth-uid', secret), null);
});

test('invalid profile projection input or missing secret is rejected', () => {
  assert.equal(projectPublicStudentProfile(null, 'student-1', secret), null);
  assert.equal(projectPublicStudentProfile({ name: 'Student' }, '', secret), null);
  assert.equal(projectPublicStudentProfile({ name: 'Student' }, 'student-1'), null);
});
