const test = require('node:test');
const assert = require('node:assert/strict');
const StudentAuth = require('../student-auth');

function createFirebaseAuthMock() {
  class GoogleAuthProvider {
    setCustomParameters(parameters) {
      this.parameters = parameters;
    }
  }
  return { GoogleAuthProvider };
}

test('links the existing anonymous user instead of creating a second identity', async () => {
  const providerAuth = createFirebaseAuthMock();
  let linkedProvider = null;
  let redirectCalled = false;
  const anonymousUser = {
    uid: 'anonymous-uid',
    isAnonymous: true,
    linkWithRedirect: async provider => {
      linkedProvider = provider;
      return 'linked';
    }
  };
  const auth = {
    currentUser: anonymousUser,
    signInWithRedirect: async () => { redirectCalled = true; }
  };

  const result = await StudentAuth.create(auth, providerAuth).signInWithGoogle();

  assert.equal(result, 'linked');
  assert.ok(linkedProvider instanceof providerAuth.GoogleAuthProvider);
  assert.deepEqual(linkedProvider.parameters, { prompt: 'select_account' });
  assert.equal(redirectCalled, false);
});

test('starts Google redirect sign-in when there is no anonymous user', async () => {
  const providerAuth = createFirebaseAuthMock();
  let redirectProvider = null;
  const auth = {
    currentUser: null,
    signInWithRedirect: async provider => { redirectProvider = provider; }
  };

  await StudentAuth.create(auth, providerAuth).signInWithGoogle();

  assert.ok(redirectProvider instanceof providerAuth.GoogleAuthProvider);
});

test('starts Google redirect sign-in for an already registered user session', async () => {
  const providerAuth = createFirebaseAuthMock();
  let redirectProvider = null;
  const auth = {
    currentUser: { uid: 'registered-uid', isAnonymous: false },
    signInWithRedirect: async provider => { redirectProvider = provider; }
  };

  await StudentAuth.create(auth, providerAuth).signInWithGoogle();

  assert.ok(redirectProvider instanceof providerAuth.GoogleAuthProvider);
});

test('returns the signed-in user from the redirect result and null when cancelled', async () => {
  const providerAuth = createFirebaseAuthMock();
  const user = { uid: 'google-user' };
  let redirectResult = { user };
  const auth = { getRedirectResult: async () => redirectResult };
  const studentAuth = StudentAuth.create(auth, providerAuth);

  assert.equal(await studentAuth.handleRedirectResult(), user);
  redirectResult = null;
  assert.equal(await studentAuth.handleRedirectResult(), null);
});

test('identifies Google accounts and returns a safe profile snapshot', () => {
  const studentAuth = StudentAuth.create(
    { signOut: async () => {} },
    createFirebaseAuthMock()
  );
  const user = {
    uid: 'google-uid',
    displayName: 'Student Name',
    email: 'student@example.com',
    photoURL: 'https://example.com/photo.png',
    providerData: [{ providerId: 'google.com' }]
  };

  assert.equal(studentAuth.isGoogleUser(user), true);
  assert.deepEqual(studentAuth.getGoogleProfile(user), {
    uid: 'google-uid',
    displayName: 'Student Name',
    email: 'student@example.com',
    photoURL: 'https://example.com/photo.png'
  });
  assert.equal(studentAuth.getGoogleProfile({ uid: 'anonymous' }), null);
});

test('does not hide account-linking errors that may require explicit migration', async () => {
  const providerAuth = createFirebaseAuthMock();
  const expectedError = Object.assign(new Error('Credential already in use'), {
    code: 'auth/credential-already-in-use'
  });
  const auth = {
    currentUser: { isAnonymous: true, linkWithRedirect: async () => { throw expectedError; } }
  };

  await assert.rejects(
    StudentAuth.create(auth, providerAuth).signInWithGoogle(),
    error => error === expectedError
  );
});

test('validates Firebase Auth dependencies', () => {
  assert.throws(() => StudentAuth.create(null, createFirebaseAuthMock()), /required/);
  assert.throws(() => StudentAuth.create({}, {}), /required/);
});
