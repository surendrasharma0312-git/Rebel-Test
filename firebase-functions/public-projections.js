'use strict';

const crypto = require('node:crypto');

function createPublicStudentId(studentId, secret) {
  if (typeof studentId !== 'string' || !studentId ||
      typeof secret !== 'string' || secret.length < 32) {
    return null;
  }
  return crypto.createHmac('sha256', secret)
    .update('rebel-test:public-student:v1:')
    .update(studentId)
    .digest('hex')
    .slice(0, 32);
}

const RESULT_PUBLIC_FIELDS = Object.freeze([
  'studentName', 'testDocId', 'testId', 'testName', 'testType',
  'total', 'correct', 'wrong', 'timeout', 'pct', 'durationSeconds', 'createdAt'
]);

function projectPublicLeaderboardResult(data, secret) {
  if (!data || typeof data !== 'object') return null;
  const publicStudentId = createPublicStudentId(data.studentId, secret);
  if (!publicStudentId || typeof data.studentName !== 'string' || !data.studentName) {
    return null;
  }
  const projected = { publicStudentId };
  for (const field of RESULT_PUBLIC_FIELDS) {
    if (data[field] !== undefined) projected[field] = data[field];
  }
  return projected;
}

function projectPublicStudentProfile(data, studentId, secret) {
  if (!data || typeof data !== 'object') return null;
  const showPublic = data.showPublic === true || String(data.showPublic).toLowerCase() === 'true';
  if (!showPublic) return null;
  const publicStudentId = createPublicStudentId(studentId, secret);
  if (!publicStudentId) return null;

  // Contact information is never copied to the public projection. A broad
  // "Show on Public Profile" toggle is not sufficient consent to publish it.
  return {
    publicStudentId,
    name: typeof data.name === 'string' ? data.name : '',
    bio: typeof data.bio === 'string' ? data.bio : '',
    photo: typeof data.photo === 'string' ? data.photo : null
  };
}

module.exports = Object.freeze({
  createPublicStudentId,
  projectPublicLeaderboardResult,
  projectPublicStudentProfile
});
