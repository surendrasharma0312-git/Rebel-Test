'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const StudentEntry = require('../student-entry');
const StudentAuth = require('../student-auth');

function createElement(textContent = '') {
  const listeners = new Map();
  return {
    disabled: false,
    textContent,
    value: '',
    checked: false,
    style: { display: 'none' },
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    reset() {},
    async trigger(type, event = {}) {
      const callback = listeners.get(type);
      assert.equal(typeof callback, 'function', 'expected event listener to be registered');
      return callback(event);
    }
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(res => { resolve = res; });
  return { promise, resolve };
}

test('waits for Firebase auth restoration before starting Google redirect', async () => {
  const ids = Object.fromEntries([
    ['googleStudentSignInBtn', createElement('Continue with Google')],
    ['welcomeAdminBtn', createElement()],
    ['studentEntryError', createElement()],
    ['studentProfileSetupForm', createElement()],
    ['studentProfileSetupError', createElement()],
    ['studentProfileSaveBtn', createElement()],
    ['studentProfileNameInput', createElement()],
    ['studentProfileEmailInput', createElement()],
    ['studentProfilePhotoInput', createElement()],
    ['studentProfileBioInput', createElement()],
    ['studentProfilePhoneInput', createElement()],
    ['studentProfileAddressInput', createElement()],
    ['studentProfilePublicInput', createElement()],
    ['adminLoginError', createElement()]
  ]);

  const keys = [
    'document', 'localStorage', 'firebase', 'StudentAuth', 'StudentSession',
    'RebelStudentRuntime', 'showScreen', 'updateSettingsUI',
    'StudentSessionManager', 'handleStudentSignOut'
  ];
  const previous = new Map(keys.map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key)
  ]));

  const authReady = deferred();
  let currentUser = null;
  let redirectCalls = 0;
  const auth = {
    get currentUser() { return currentUser; },
    signInWithRedirect: async () => { redirectCalls += 1; }
  };
  class GoogleAuthProvider {
    setCustomParameters() {}
  }
  const screens = [];
  const studentSession = {
    handleRedirectResult: async () => null,
    loadRequiredProfile: async () => null,
    getSession: () => null,
    saveRequiredProfile: async () => null,
    signOut: async () => {}
  };
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };

  Object.assign(globalThis, {
    document: { getElementById: id => ids[id] || null },
    localStorage: storage,
    firebase: { GoogleAuthProvider, functions: () => ({}) },
    StudentAuth,
    StudentSession: { create: () => studentSession },
    RebelStudentRuntime: {
      firebaseReady: true,
      auth,
      db: {},
      authSessionPromise: authReady.promise
    },
    showScreen: screen => screens.push(screen),
    updateSettingsUI: () => {}
  });

  try {
    const initialization = StudentEntry.initialize();
    const signIn = ids.googleStudentSignInBtn.trigger('click');

    // The account is not restored yet. A redirect must not start while
    // Firebase temporarily reports currentUser as null.
    assert.equal(redirectCalls, 0);

    currentUser = {
      uid: 'existing-account',
      isAnonymous: false,
      providerData: [{ providerId: 'password' }]
    };
    authReady.resolve(currentUser);

    await Promise.all([initialization, signIn]);

    assert.equal(redirectCalls, 0);
    assert.match(
      ids.studentEntryError.textContent,
      /will not switch or merge accounts automatically/
    );
    assert.equal(ids.googleStudentSignInBtn.disabled, false);
    assert.equal(ids.googleStudentSignInBtn.textContent, 'Continue with Google');
    assert.deepEqual(screens, ['screen-welcome']);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('retries identity resolution for the existing Google session after startup failure', async () => {
  const ids = Object.fromEntries([
    ['googleStudentSignInBtn', createElement('Continue with Google')],
    ['welcomeAdminBtn', createElement()],
    ['studentEntryError', createElement()],
    ['studentProfileSetupForm', createElement()],
    ['studentProfileSetupError', createElement()],
    ['studentProfileSaveBtn', createElement()],
    ['studentProfileNameInput', createElement()],
    ['studentProfileEmailInput', createElement()],
    ['studentProfilePhotoInput', createElement()],
    ['studentProfileBioInput', createElement()],
    ['studentProfilePhoneInput', createElement()],
    ['studentProfileAddressInput', createElement()],
    ['studentProfilePublicInput', createElement()],
    ['adminLoginError', createElement()]
  ]);

  const keys = [
    'document', 'localStorage', 'firebase', 'StudentAuth', 'StudentSession',
    'RebelStudentRuntime', 'showScreen', 'updateSettingsUI',
    'StudentSessionManager', 'handleStudentSignOut'
  ];
  const previous = new Map(keys.map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key)
  ]));

  const currentUser = {
    uid: 'existing-google-uid',
    isAnonymous: false,
    displayName: 'Existing Student',
    email: 'student@example.com',
    providerData: [{ providerId: 'google.com' }]
  };
  let identityAttempts = 0;
  let redirectCalls = 0;
  const auth = {
    currentUser,
    signInWithRedirect: async () => { redirectCalls += 1; }
  };
  class GoogleAuthProvider {
    setCustomParameters() {}
  }
  const screens = [];
  const studentSession = {
    handleRedirectResult: async () => {
      identityAttempts += 1;
      if (identityAttempts === 1) {
        throw new Error('Temporary identity lookup failure');
      }
      return {
        studentId: 'canonical-student-id',
        profile: {
          displayName: 'Existing Student',
          email: 'student@example.com'
        }
      };
    },
    loadRequiredProfile: async () => ({
      name: 'Existing Student',
      bio: 'Existing profile',
      photo: 'https://example.com/student.png'
    }),
    getSession: () => null,
    saveRequiredProfile: async () => null,
    signOut: async () => {}
  };
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };

  Object.assign(globalThis, {
    document: { getElementById: id => ids[id] || null },
    localStorage: storage,
    firebase: { GoogleAuthProvider, functions: () => ({}) },
    StudentAuth,
    StudentSession: { create: () => studentSession },
    RebelStudentRuntime: {
      firebaseReady: true,
      auth,
      db: {},
      authSessionPromise: Promise.resolve(currentUser)
    },
    showScreen: screen => screens.push(screen),
    updateSettingsUI: () => {}
  });

  try {
    await StudentEntry.initialize();
    assert.equal(identityAttempts, 1);
    assert.deepEqual(screens, ['screen-welcome']);

    await ids.googleStudentSignInBtn.trigger('click');

    assert.equal(identityAttempts, 2);
    assert.equal(redirectCalls, 0);
    assert.equal(ids.googleStudentSignInBtn.disabled, false);
    assert.equal(ids.googleStudentSignInBtn.textContent, 'Continue with Google');
    assert.deepEqual(screens, ['screen-welcome', 'screen-home']);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});


test('retries the required profile read for the existing Google session after startup failure', async () => {
  const ids = Object.fromEntries([
    ['googleStudentSignInBtn', createElement('Continue with Google')],
    ['welcomeAdminBtn', createElement()],
    ['studentEntryError', createElement()],
    ['studentProfileSetupForm', createElement()],
    ['studentProfileSetupError', createElement()],
    ['studentProfileSaveBtn', createElement()],
    ['studentProfileNameInput', createElement()],
    ['studentProfileEmailInput', createElement()],
    ['studentProfilePhotoInput', createElement()],
    ['studentProfileBioInput', createElement()],
    ['studentProfilePhoneInput', createElement()],
    ['studentProfileAddressInput', createElement()],
    ['studentProfilePublicInput', createElement()],
    ['adminLoginError', createElement()]
  ]);

  const keys = [
    'document', 'localStorage', 'firebase', 'StudentAuth', 'StudentSession',
    'RebelStudentRuntime', 'showScreen', 'updateSettingsUI',
    'StudentSessionManager', 'handleStudentSignOut'
  ];
  const previous = new Map(keys.map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key)
  ]));

  const currentUser = {
    uid: 'existing-google-uid',
    isAnonymous: false,
    displayName: 'Existing Student',
    email: 'student@example.com',
    providerData: [{ providerId: 'google.com' }]
  };
  let identityAttempts = 0;
  let profileReads = 0;
  let redirectCalls = 0;
  const auth = {
    currentUser,
    signInWithRedirect: async () => { redirectCalls += 1; }
  };
  class GoogleAuthProvider {
    setCustomParameters() {}
  }
  const screens = [];
  const studentSession = {
    handleRedirectResult: async () => {
      identityAttempts += 1;
      return {
        studentId: 'canonical-student-id',
        profile: {
          displayName: 'Existing Student',
          email: 'student@example.com'
        }
      };
    },
    loadRequiredProfile: async () => {
      profileReads += 1;
      if (profileReads === 1) {
        throw new Error('Temporary profile read failure');
      }
      return {
        name: 'Existing Student',
        bio: 'Existing profile',
        photo: 'https://example.com/student.png'
      };
    },
    getSession: () => null,
    saveRequiredProfile: async () => null,
    signOut: async () => {}
  };
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };

  Object.assign(globalThis, {
    document: { getElementById: id => ids[id] || null },
    localStorage: storage,
    firebase: { GoogleAuthProvider, functions: () => ({}) },
    StudentAuth,
    StudentSession: { create: () => studentSession },
    RebelStudentRuntime: {
      firebaseReady: true,
      auth,
      db: {},
      authSessionPromise: Promise.resolve(currentUser)
    },
    showScreen: screen => screens.push(screen),
    updateSettingsUI: () => {}
  });

  try {
    await StudentEntry.initialize();
    assert.equal(identityAttempts, 1);
    assert.equal(profileReads, 1);
    assert.deepEqual(screens, ['screen-welcome']);
    assert.match(ids.studentEntryError.textContent, /Temporary profile read failure/);

    await ids.googleStudentSignInBtn.trigger('click');

    assert.equal(identityAttempts, 2);
    assert.equal(profileReads, 2);
    assert.equal(redirectCalls, 0);
    assert.equal(ids.googleStudentSignInBtn.disabled, false);
    assert.equal(ids.googleStudentSignInBtn.textContent, 'Continue with Google');
    assert.deepEqual(screens, ['screen-welcome', 'screen-home']);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
