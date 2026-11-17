'use strict';

const crypto = require('node:crypto');

const RESULT_PUBLIC_FIELDS = Object.freeze([
  'studentName', 'testDocId', 'testId', 'testName', 'testType',
  'total', 'correct', 'wrong', 'timeout', 'pct', 'durationSeconds', 'createdAt'
]);

// Keep the public join key stable without publishing the raw Firebase UID or
// legacy student ID. Source IDs are generated as Firebase UIDs or UUIDs.
function createPublicStudentId(studentId) {
  if (typeof studentId !== 'string' || !studentId) return null;
  const digest = crypto.createHash('sha256')
    .update(`rebel-test:public-student:v1:${studentId}`, 'utf8')
    .digest('hex');
  return `ps_${digest}`;
}

function projectPublicLeaderboardResult(data) {
  if (!data || typeof data !== 'object' ||
      typeof data.studentId !== 'string' || !data.studentId ||
      typeof data.studentName !== 'string' || !data.studentName) {
    return null;
  }

  const projected = {
    publicStudentId: createPublicStudentId(data.studentId)
  };
  for (const field of RESULT_PUBLIC_FIELDS) {
    if (data[field] !== undefined) projected[field] = data[field];
  }
  return projected;
}

function projectPublicStudentProfile(data, studentId) {
  const publicStudentId = createPublicStudentId(studentId);
  if (!data || typeof data !== 'object' || !publicStudentId) return null;

  const projected = {
    publicStudentId,
    name: typeof data.name === 'string' ? data.name : '',
    bio: typeof data.bio === 'string' ? data.bio : '',
    photo: typeof data.photo === 'string' ? data.photo : null
  };
  if (data.showPublic === true || String(data.showPublic) === 'true') {
    for (const field of ['phone', 'email', 'address']) {
      if (typeof data[field] === 'string' && data[field]) projected[field] = data[field];
    }
  }
  return projected;
}

module.exports = Object.freeze({
  createPublicStudentId,
  projectPublicLeaderboardResult,
  projectPublicStudentProfile
});
