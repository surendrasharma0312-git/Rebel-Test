'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Load before installing a document: student-entry.js only auto-starts in a
// browser. These tests call its exported initializer with controlled globals.
const StudentEntry = require('../student-entry');

function createElement() {
  const listeners = new Map();
  return {
    disabled: false,
    textContent: '',
    value: '',
    checked: false,
    style: { display: 'none' },
    resetCount: 0,
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    reset() {
      this.resetCount += 1;
    },
    async trigger(type, event = {}) {
      const callback = listeners.get(type);
      assert.equal(typeof callback, 'function', 'expected event listener to be registered');
      return callback(event);
    }
  };
}

function createHarness({ profile = null, saveError = null } = {}) {
  const ids = Object.fromEntries([
    'googleStudentSignInBtn',
    'welcomeAdminBtn',
    'studentEntryError',
    'studentProfileSetupForm',
    'studentProfileSetupError',
    'studentProfileSaveBtn',
    'studentProfileNameInput',
    'studentProfileEmailInput',
    'studentProfilePhotoInput',
    'studentProfileBioInput',
    'studentProfilePhoneInput',
    'studentProfileAddressInput',
    'studentProfilePublicInput',
    'adminLoginError'
  ].map(id => [id, createElement()]));

  const previous = new Map();
  const keys = [
    'document', 'localStorage', 'firebase', 'StudentAuth', 'StudentSession',
    'RebelStudentRuntime', 'showScreen', 'updateSettingsUI',
    'StudentSessionManager', 'handleStudentSignOut'
  ];
  for (const key of keys) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  }

  const storageValues = new Map([
    ['vocabTestApp_studentName', 'Old Device Student'],
    ['vocabTestApp_studentBio', 'Old bio'],
    ['vocabTestApp_studentPhoto', 'old-photo']
  ]);
  const localStorage = {
    getItem: key => storageValues.has(key) ? storageValues.get(key) : null,
    setItem: (key, value) => storageValues.set(key, String(value)),
    removeItem: key => storageValues.delete(key)
  };
  const screens = [];
  const submittedProfiles = [];
  let settingsUpdates = 0;

  const studentSession = {
    handleRedirectResult: async () => ({
      uid: 'google-user-1',
      studentId: 'canonical-student-1',
      profile: {
        displayName: 'Google Student',
        email: 'student@example.test',
        photoURL: 'https://example.test/google-photo.png'
      }
    }),
    loadRequiredProfile: async () => profile,
    getSession: () => ({
      profile: { photoURL: 'https://example.test/google-photo.png' }
    }),
    saveRequiredProfile: async value => {
      submittedProfiles.push(value);
      if (saveError) throw saveError;
      return { profile: { ...value } };
    },
    signOut: async () => {}
  };

  Object.assign(globalThis, {
    document: { getElementById: id => ids[id] || null },
    localStorage,
    firebase: { functions: () => ({}) },
    StudentAuth: { create: () => ({ signInWithGoogle: async () => {} }) },
    StudentSession: { create: () => studentSession },
    RebelStudentRuntime: {
      firebaseReady: true,
      auth: {},
      db: {},
      authSessionPromise: Promise.resolve()
    },
    showScreen: screen => screens.push(screen),
    updateSettingsUI: () => { settingsUpdates += 1; }
  });

  return {
    ids,
    localStorage,
    screens,
    submittedProfiles,
    get settingsUpdates() { return settingsUpdates; },
    async initialize() {
      await StudentEntry.initialize();
    },
    restore() {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  };
}

test('existing verified student profile opens the dashboard without profile setup', async () => {
  const harness = createHarness({
    profile: { name: 'Existing Student', bio: 'Learner', photo: 'profile-photo' }
  });

  try {
    await harness.initialize();

    assert.deepEqual(harness.screens, ['screen-home']);
    assert.equal(harness.localStorage.getItem('vocabTestApp_studentName'), 'Existing Student');
    assert.equal(harness.localStorage.getItem('vocabTestApp_studentBio'), 'Learner');
    assert.equal(harness.localStorage.getItem('vocabTestApp_studentPhoto'), 'profile-photo');
    assert.equal(harness.settingsUpdates, 1);
    assert.equal(harness.ids.studentProfileSetupForm.resetCount, 0);
  } finally {
    harness.restore();
  }
});

test('missing profile is mandatory and only opens the profile setup screen', async () => {
  const harness = createHarness({ profile: null });

  try {
    await harness.initialize();

    assert.deepEqual(harness.screens, ['screen-student-profile']);
    assert.equal(harness.ids.studentProfileNameInput.value, 'Google Student');
    assert.equal(harness.ids.studentProfileEmailInput.value, 'student@example.test');
    assert.equal(harness.ids.studentProfilePhotoInput.value, 'https://example.test/google-photo.png');
    assert.equal(harness.ids.studentProfileSetupForm.resetCount, 1);
    assert.equal(harness.screens.includes('screen-home'), false);
  } finally {
    harness.restore();
  }
});

test('failed cloud profile save keeps the student out of the dashboard', async () => {
  const harness = createHarness({
    profile: null,
    saveError: new Error('permission-denied')
  });

  try {
    await harness.initialize();
    harness.ids.studentProfileNameInput.value = 'New Student';
    await harness.ids.studentProfileSetupForm.trigger('submit', {
      preventDefault() {}
    });

    assert.equal(harness.submittedProfiles.length, 1);
    assert.equal(harness.submittedProfiles[0].name, 'New Student');
    assert.equal(harness.screens.includes('screen-home'), false);
    assert.equal(harness.ids.studentProfileSetupError.textContent, 'permission-denied');
    assert.equal(harness.ids.studentProfileSetupError.style.display, 'block');
  } finally {
    harness.restore();
  }
});

test('successful required profile save is the only missing-profile path to the dashboard', async () => {
  const harness = createHarness({ profile: null });

  try {
    await harness.initialize();
    harness.ids.studentProfileNameInput.value = 'New Student';
    harness.ids.studentProfileBioInput.value = 'Learning English';
    harness.ids.studentProfilePhoneInput.value = '9999999999';
    harness.ids.studentProfileAddressInput.value = 'Barharia';

    await harness.ids.studentProfileSetupForm.trigger('submit', {
      preventDefault() {}
    });

    assert.equal(harness.submittedProfiles.length, 1);
    assert.equal(harness.submittedProfiles[0].name, 'New Student');
    assert.deepEqual(harness.screens, ['screen-student-profile', 'screen-home']);
    assert.equal(harness.localStorage.getItem('vocabTestApp_studentName'), 'New Student');
  } finally {
    harness.restore();
  }
});
