'use strict';

const RESULT_PUBLIC_FIELDS = Object.freeze([
  'studentId', 'studentName', 'testDocId', 'testId', 'testName', 'testType',
  'total', 'correct', 'wrong', 'timeout', 'pct', 'durationSeconds', 'createdAt'
]);

function projectPublicLeaderboardResult(data) {
  if (!data || typeof data !== 'object') return null;
  const projected = {};
  for (const field of RESULT_PUBLIC_FIELDS) {
    if (data[field] !== undefined) projected[field] = data[field];
  }
  if (typeof projected.studentId !== 'string' || !projected.studentId ||
      typeof projected.studentName !== 'string' || !projected.studentName) {
    return null;
  }
  return projected;
}

function projectPublicStudentProfile(data, studentId) {
  if (!data || typeof data !== 'object' || typeof studentId !== 'string' || !studentId) {
    return null;
  }
  const projected = {
    studentId,
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
  projectPublicLeaderboardResult,
  projectPublicStudentProfile
});
