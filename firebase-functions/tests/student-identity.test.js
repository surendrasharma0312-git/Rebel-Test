'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveStudentIdentity, hasGoogleIdentity } = require('../student-identity');

function createDb({ existingLink = null, proofExists = false } = {}) {
  const writes = [];
  const db = {
    collection(name) {
      if (name === 'studentAccountLinks') {
        return { doc: uid => ({ path: name + '/' + uid }) };
      }
      if (name === 'testResults') {
        return {
          where(field, operator, value) {
            return {
              where(secondField, secondOperator, secondValue) {
                return {
                  limit(count) {
                    return { kind: 'proof-query', values: [field, operator, value, secondField, secondOperator, secondValue, count] };
                  }
                };
              }
            };
          }
        };
      }
      throw new Error('Unexpected collection: ' + name);
    },
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          if (ref.kind === 'proof-query') return { empty: !proofExists };
          return { exists: Boolean(existingLink), data: () => existingLink };
        },
        create(ref, data) {
          writes.push({ ref, data });
        }
      };
      return callback(transaction);
    }
  };
  return { db, writes };
}

const FieldValue = { serverTimestamp: () => 'SERVER_TIMESTAMP' };

test('recognizes Google-linked anonymous accounts without trusting sign-in provider alone', () => {
  assert.equal(hasGoogleIdentity({ sign_in_provider: 'google.com' }), true);
  assert.equal(hasGoogleIdentity({
    sign_in_provider: 'anonymous',
    identities: { 'google.com': ['google-user-id'] }
  }), true);
  assert.equal(hasGoogleIdentity({
    sign_in_provider: 'anonymous',
    identities: {}
  }), false);
  assert.equal(hasGoogleIdentity(null), false);
});

test('adopts a legacy student ID only when a historical result proves the same auth UID', async () => {
  const { db, writes } = createDb({ proofExists: true });
  const result = await resolveStudentIdentity({
    uid: 'test-uid', legacyStudentId: 'legacy-student-1', db, FieldValue
  });

  assert.deepEqual(result, {
    studentId: 'legacy-student-1', linked: true, alreadyLinked: false
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].ref.path, 'studentAccountLinks/test-uid');
  assert.equal(writes[0].data.studentId, 'legacy-student-1');
  assert.equal(writes[0].data.authUid, 'test-uid');
});

test('does not let a client claim a legacy ID without matching authUid history', async () => {
  const { db, writes } = createDb({ proofExists: false });
  const result = await resolveStudentIdentity({
    uid: 'test-uid', legacyStudentId: 'someone-elses-record', db, FieldValue
  });

  assert.equal(result.studentId, 'test-uid');
  assert.equal(result.linked, false);
  assert.equal(writes[0].data.studentId, 'test-uid');
});

test('returns the existing mapping and refuses a conflicting legacy ID', async () => {
  const { db, writes } = createDb({
    existingLink: { studentId: 'already-linked-student' }
  });
  const result = await resolveStudentIdentity({
    uid: 'test-uid', legacyStudentId: 'already-linked-student', db, FieldValue
  });

  assert.deepEqual(result, {
    studentId: 'already-linked-student', linked: true, alreadyLinked: true
  });
  assert.equal(writes.length, 0);

  await assert.rejects(
    resolveStudentIdentity({
      uid: 'test-uid', legacyStudentId: 'different-student', db, FieldValue
    }),
    error => error.code === 'failed-precondition'
  );
});

test('uses the Firebase UID for a new student with no legacy ID', async () => {
  const { db, writes } = createDb();
  const result = await resolveStudentIdentity({
    uid: 'new-google-uid', db, FieldValue
  });

  assert.equal(result.studentId, 'new-google-uid');
  assert.equal(writes[0].data.studentId, 'new-google-uid');
});

test('rejects invalid IDs and missing dependencies', async () => {
  const { db } = createDb();
  await assert.rejects(
    resolveStudentIdentity({ uid: 'test-uid', legacyStudentId: ' padded ', db, FieldValue }),
    error => error.code === 'invalid-argument'
  );
  await assert.rejects(
    resolveStudentIdentity({ uid: '', db, FieldValue }),
    error => error.code === 'unauthenticated'
  );
  await assert.rejects(
    resolveStudentIdentity({ uid: 'test-uid', db: null, FieldValue }),
    error => error.code === 'failed-precondition'
  );
});
