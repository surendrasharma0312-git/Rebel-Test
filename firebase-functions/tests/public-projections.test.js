'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPublicStudentId,
  projectPublicLeaderboardResult,
  projectPublicStudentProfile
} = require('../public-projections');

test('public student IDs are stable pseudonymous keys, not raw account IDs', () => {
  const sourceId = 'firebase-uid-private';
  const publicId = createPublicStudentId(sourceId);

  assert.match(publicId, /^ps_[a-f0-9]{64}$/);
  assert.equal(createPublicStudentId(sourceId), publicId);
  assert.notEqual(publicId, sourceId);
  assert.equal(createPublicStudentId(''), null);
  assert.notEqual(publicId, createPublicStudentId('another-private-id'));
});

test('leaderboard projection keeps ranking fields and excludes raw/private identifiers', () => {
  const sourceId = 'student-1';
  const projected = projectPublicLeaderboardResult({
    studentId: sourceId, studentName: 'Student One', authUid: 'private-auth-uid',
    testDocId: 'test-1', testName: 'Vocabulary', testType: 'vocab',
    total: 20, correct: 18, wrong: 2, timeout: 0, pct: 90,
    durationSeconds: 120, createdAt: 'timestamp', privateNote: 'do not expose'
  });

  assert.deepEqual(projected, {
    publicStudentId: createPublicStudentId(sourceId),
    studentName: 'Student One',
    testDocId: 'test-1', testName: 'Vocabulary', testType: 'vocab',
    total: 20, correct: 18, wrong: 2, timeout: 0, pct: 90,
    durationSeconds: 120, createdAt: 'timestamp'
  });
  assert.equal('studentId' in projected, false);
  assert.equal('authUid' in projected, false);
  assert.equal('privateNote' in projected, false);
});

test('invalid leaderboard records are not projected', () => {
  assert.equal(projectPublicLeaderboardResult({ authUid: 'private' }), null);
  assert.equal(projectPublicLeaderboardResult({ studentId: '', studentName: 'Student' }), null);
  assert.equal(projectPublicLeaderboardResult(null), null);
});

test('public profile projection hides contact fields unless the student opts in', () => {
  const publicStudentId = createPublicStudentId('student-1');
  const privateProfile = projectPublicStudentProfile({
    name: 'Student One', bio: 'Learner', photo: 'photo-data',
    phone: '9999999999', email: 'student@example.test',
    address: 'Private address', showPublic: false, authUid: 'private'
  }, 'student-1');
  assert.deepEqual(privateProfile, {
    publicStudentId, name: 'Student One', bio: 'Learner', photo: 'photo-data'
  });

  const publicProfile = projectPublicStudentProfile({
    name: 'Student One', phone: '9999999999',
    email: 'student@example.test', address: 'Public address', showPublic: true
  }, 'student-1');
  assert.deepEqual(publicProfile, {
    publicStudentId, name: 'Student One', bio: '', photo: null,
    phone: '9999999999', email: 'student@example.test', address: 'Public address'
  });
  assert.equal('studentId' in publicProfile, false);
  assert.equal('authUid' in publicProfile, false);
});

test('invalid profile projection input is rejected', () => {
  assert.equal(projectPublicStudentProfile(null, 'student-1'), null);
  assert.equal(projectPublicStudentProfile({ name: 'Student' }, ''), null);
});
