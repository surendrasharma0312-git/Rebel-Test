'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  projectPublicLeaderboardResult,
  projectPublicStudentProfile
} = require('../public-projections');

test('leaderboard projection allowlists ranking fields and never copies authUid or arbitrary fields', () => {
  const projected = projectPublicLeaderboardResult({
    studentId: 'student-1', studentName: 'Student One', authUid: 'private-auth-uid',
    testDocId: 'test-1', testName: 'Vocabulary', testType: 'vocab',
    total: 20, correct: 18, wrong: 2, timeout: 0, pct: 90,
    durationSeconds: 120, createdAt: 'timestamp', privateNote: 'do not expose'
  });

  assert.deepEqual(projected, {
    studentId: 'student-1', studentName: 'Student One',
    testDocId: 'test-1', testName: 'Vocabulary', testType: 'vocab',
    total: 20, correct: 18, wrong: 2, timeout: 0, pct: 90,
    durationSeconds: 120, createdAt: 'timestamp'
  });
  assert.equal('authUid' in projected, false);
  assert.equal('privateNote' in projected, false);
});

test('invalid leaderboard records are not projected', () => {
  assert.equal(projectPublicLeaderboardResult({ authUid: 'private' }), null);
  assert.equal(projectPublicLeaderboardResult(null), null);
});

test('public profile projection hides contact fields unless the student opts in', () => {
  const privateProfile = projectPublicStudentProfile({
    name: 'Student One', bio: 'Learner', photo: 'photo-data',
    phone: '9999999999', email: 'student@example.test',
    address: 'Private address', showPublic: false, authUid: 'private'
  }, 'student-1');
  assert.deepEqual(privateProfile, {
    studentId: 'student-1', name: 'Student One', bio: 'Learner', photo: 'photo-data'
  });

  const publicProfile = projectPublicStudentProfile({
    name: 'Student One', phone: '9999999999',
    email: 'student@example.test', address: 'Public address', showPublic: true
  }, 'student-1');
  assert.deepEqual(publicProfile, {
    studentId: 'student-1', name: 'Student One', bio: '', photo: null,
    phone: '9999999999', email: 'student@example.test', address: 'Public address'
  });
  assert.equal('authUid' in publicProfile, false);
});

test('invalid profile projection input is rejected', () => {
  assert.equal(projectPublicStudentProfile(null, 'student-1'), null);
  assert.equal(projectPublicStudentProfile({ name: 'Student' }, ''), null);
});
