(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StudentSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CANONICAL_ID_KEY = 'vocabTestApp_canonicalStudentId';
  const LEGACY_ID_KEY = 'vocabTestApp_studentId';

  function create({ auth, firebaseAuth, functions, db, storage, studentAuth }) {
    if (!auth || !firebaseAuth || !functions || !db || !storage || !studentAuth) {
      throw new Error('Student session dependencies are required.');
    }

    let currentSession = null;

    async function resolveGoogleIdentity(user) {
      if (!studentAuth.isGoogleUser(user)) {
        throw new Error('Google sign-in is required for a student account.');
      }
      const callable = functions.httpsCallable('resolveStudentIdentity');
      const legacyStudentId = storage.getItem(LEGACY_ID_KEY) || null;
      const response = await callable({ legacyStudentId });
      const studentId = response && response.data && response.data.studentId;
      if (typeof studentId !== 'string' || !studentId.trim()) {
        throw new Error('The server did not return a valid student identity.');
      }
      storage.setItem(CANONICAL_ID_KEY, studentId);
      currentSession = Object.freeze({
        uid: user.uid,
        studentId,
        profile: studentAuth.getGoogleProfile(user)
      });
      return currentSession;
    }

    async function handleRedirectResult() {
      const redirectedUser = await studentAuth.handleRedirectResult();
      const user = redirectedUser || auth.currentUser;
      if (!user || !studentAuth.isGoogleUser(user)) return null;
      return resolveGoogleIdentity(user);
    }

    function assertCurrentSession() {
      if (!currentSession || !auth.currentUser ||
          auth.currentUser.uid !== currentSession.uid ||
          !studentAuth.isGoogleUser(auth.currentUser)) {
        currentSession = null;
        throw new Error('A current, verified Google student session is required.');
      }
    }

    async function saveRequiredProfile(profile) {
      assertCurrentSession();
      const name = typeof profile?.name === 'string' ? profile.name.trim() : '';
      if (!name) throw new Error('Student name is required to complete the profile.');

      const payload = {
        name,
        bio: typeof profile.bio === 'string' ? profile.bio.trim().slice(0, 500) : '',
        photo: typeof profile.photo === 'string' ? profile.photo : (currentSession.profile?.photoURL || null),
        phone: typeof profile.phone === 'string' ? profile.phone.trim() : '',
        email: currentSession.profile?.email || '',
        address: typeof profile.address === 'string' ? profile.address.trim() : '',
        showPublic: profile.showPublic === true,
        updatedAt: firebaseAuth.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('studentProfiles').doc(currentSession.studentId).set(payload, { merge: true });
      currentSession = Object.freeze({ ...currentSession, profile: Object.freeze(payload) });
      return currentSession;
    }

    async function loadRequiredProfile() {
      assertCurrentSession();
      const snapshot = await db.collection('studentProfiles').doc(currentSession.studentId).get();
      if (!snapshot.exists || !snapshot.data()?.name) return null;
      return snapshot.data();
    }

    function getSession() { return currentSession; }

    async function signOut() {
      currentSession = null;
      storage.removeItem(CANONICAL_ID_KEY);
      await studentAuth.signOut();
    }

    return Object.freeze({
      resolveGoogleIdentity,
      handleRedirectResult,
      saveRequiredProfile,
      loadRequiredProfile,
      getSession,
      signOut
    });
  }

  return Object.freeze({ create, CANONICAL_ID_KEY, LEGACY_ID_KEY });
});
