'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const StudentSession = require('../student-session');

function fixture({ profileExists = false, profileWriteFails = false } = {}) {
  const values = new Map([['vocabTestApp_studentId', 'legacy-id']]);
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  const tokenRefreshes = [];
  const user = {
    uid: 'google-uid',
    providerData: [{ providerId: 'google.com' }],
    displayName: 'Google Student',
    email: 'student@example.test',
    photoURL: 'https://example.test/photo.png',
    getIdToken: async forceRefresh => { tokenRefreshes.push(forceRefresh); return 'fresh-id-token'; }
  };
  const auth = { currentUser: user, signOut: async () => {} };
  const firebaseAuth = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } };
  let savedProfile = null;
  const db = {
    collection: name => ({
      doc: id => ({
        set: async data => {
          if (profileWriteFails) throw new Error('permission-denied');
          savedProfile = { collection: name, id, data };
        },
        get: async () => ({
          exists: profileExists || Boolean(savedProfile),
          data: () => savedProfile?.data || { name: 'Existing Student' }
        })
      })
    })
  };
  let callableArgs = null;
  const functions = {
    httpsCallable: name => async args => {
      assert.equal(name, 'resolveStudentIdentity');
      callableArgs = args;
      return { data: { studentId: 'canonical-student-id' } };
    }
  };
  const studentAuth = {
    isGoogleUser: value => Boolean(value?.providerData?.some(p => p.providerId === 'google.com')),
    getGoogleProfile: value => ({ displayName: value.displayName, email: value.email, photoURL: value.photoURL }),
    handleRedirectResult: async () => user,
    signOut: async () => auth.signOut()
  };
  const session = StudentSession.create({ auth, firebaseAuth, functions, db, storage, studentAuth });
  return { session, storage, user, setCurrentUser: value => { auth.currentUser = value; }, getCallableArgs: () => callableArgs, getSavedProfile: () => savedProfile, getTokenRefreshes: () => tokenRefreshes };
}

test('resolves canonical identity through the callable and supplies legacy ID for proof', async () => {
  const f = fixture();
  const result = await f.session.handleRedirectResult();
  assert.equal(result.uid, 'google-uid');
  assert.equal(result.studentId, 'canonical-student-id');
  assert.deepEqual(f.getCallableArgs(), { legacyStudentId: 'legacy-id' });
  assert.equal(f.storage.getItem(StudentSession.CANONICAL_ID_KEY), 'canonical-student-id');
  assert.deepEqual(f.getTokenRefreshes(), [true]);
});

test('rejects non-Google identities before calling the server', async () => {
  const f = fixture();
  await assert.rejects(
    f.session.resolveGoogleIdentity({ uid: 'anonymous', providerData: [] }),
    /Google sign-in is required/
  );
  assert.equal(f.getCallableArgs(), null);
});

test('requires a non-empty name and persists the profile before marking it complete', async () => {
  const f = fixture();
  await f.session.resolveGoogleIdentity(f.user);
  await assert.rejects(f.session.saveRequiredProfile({ name: '   ' }), /name is required/);
  assert.equal(f.getSavedProfile(), null);
  const result = await f.session.saveRequiredProfile({ name: '  Student One  ', bio: ' Learner ' });
  assert.equal(result.profile.name, 'Student One');
  assert.equal(result.profile.bio, 'Learner');
  assert.equal(f.getSavedProfile().id, 'canonical-student-id');
  assert.equal(f.getSavedProfile().data.email, 'student@example.test');
});

test('does not swallow Firestore profile-save failures', async () => {
  const f = fixture({ profileWriteFails: true });
  await f.session.resolveGoogleIdentity(f.user);
  await assert.rejects(f.session.saveRequiredProfile({ name: 'Student One' }), /permission-denied/);
});

test('loads an existing profile only after identity resolution', async () => {
  const f = fixture({ profileExists: true });
  await assert.rejects(f.session.loadRequiredProfile(), /verified Google student session/);
  await f.session.resolveGoogleIdentity(f.user);
  const profile = await f.session.loadRequiredProfile();
  assert.equal(profile.name, 'Existing Student');
});

test('sign-out clears only the canonical identity cache', async () => {
  const f = fixture();
  await f.session.resolveGoogleIdentity(f.user);
  await f.session.signOut();
  assert.equal(f.storage.getItem(StudentSession.CANONICAL_ID_KEY), null);
  assert.equal(f.storage.getItem(StudentSession.LEGACY_ID_KEY), 'legacy-id');
  assert.equal(f.session.getSession(), null);
});

test('refuses profile access if the Firebase user changes after identity resolution', async () => {
  const f = fixture();
  await f.session.resolveGoogleIdentity(f.user);
  f.setCurrentUser({ uid: 'different-user', providerData: [] });
  await assert.rejects(f.session.loadRequiredProfile(), /current, verified Google student session/);
  assert.equal(f.session.getSession(), null);
});
