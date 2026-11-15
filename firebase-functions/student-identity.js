'use strict';

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeLegacyStudentId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 128 || value.trim() !== value) {
    throw createError('invalid-argument', 'The legacy student ID is invalid.');
  }
  return value;
}

/**
 * Resolve a Google-authenticated Firebase UID to one stable app student ID.
 * A legacy ID is adopted only when an old result proves that this same
 * Firebase UID previously wrote under that ID.
 */
async function resolveStudentIdentity({ uid, legacyStudentId, db, FieldValue }) {
  if (typeof uid !== 'string' || !uid || uid.length > 128) {
    throw createError('unauthenticated', 'A valid signed-in user is required.');
  }
  if (!db || typeof db.collection !== 'function' ||
      !FieldValue || typeof FieldValue.serverTimestamp !== 'function') {
    throw createError('failed-precondition', 'Student identity storage is unavailable.');
  }

  const requestedLegacyId = normalizeLegacyStudentId(legacyStudentId);
  const linkRef = db.collection('studentAccountLinks').doc(uid);

  return db.runTransaction(async transaction => {
    const existingLink = await transaction.get(linkRef);
    if (existingLink.exists) {
      const existingStudentId = existingLink.data() && existingLink.data().studentId;
      if (typeof existingStudentId !== 'string' || !existingStudentId) {
        throw createError('failed-precondition', 'The saved student identity link is invalid.');
      }
      if (requestedLegacyId && requestedLegacyId !== existingStudentId) {
        throw createError('failed-precondition', 'This Google account is already linked to a different student record.');
      }
      return {
        studentId: existingStudentId,
        linked: existingStudentId !== uid,
        alreadyLinked: true
      };
    }

    let canonicalStudentId = uid;
    let verifiedLegacyRecord = false;

    if (requestedLegacyId) {
      const proofQuery = db.collection('testResults')
        .where('studentId', '==', requestedLegacyId)
        .where('authUid', '==', uid)
        .limit(1);
      const proof = await transaction.get(proofQuery);
      if (!proof.empty) {
        canonicalStudentId = requestedLegacyId;
        verifiedLegacyRecord = true;
      }
    }

    transaction.create(linkRef, {
      authUid: uid,
      studentId: canonicalStudentId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return {
      studentId: canonicalStudentId,
      linked: verifiedLegacyRecord,
      alreadyLinked: false
    };
  });
}

module.exports = Object.freeze({ resolveStudentIdentity });
