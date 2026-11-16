(function (root) {
  'use strict';

  async function initialize() {
    const byId = id => document.getElementById(id);
    const signInButton = byId('googleStudentSignInBtn');
    const adminButton = byId('welcomeAdminBtn');
    const errorBox = byId('studentEntryError');
    const profileForm = byId('studentProfileSetupForm');
    const profileError = byId('studentProfileSetupError');

    const runtime = root.RebelStudentRuntime;
    if (!runtime || !runtime.firebaseReady || !runtime.auth || !runtime.db || !root.StudentAuth || !root.StudentSession) {
      errorBox.textContent = 'Student sign-in is temporarily unavailable. Please try again later.';
      signInButton.disabled = true;
      return;
    }

    const studentAuth = root.StudentAuth.create(runtime.auth, root.firebase);
    const studentSession = root.StudentSession.create({
      auth: runtime.auth,
      firebaseAuth: root.firebase,
      functions: root.firebase.functions(),
      db: runtime.db,
      storage: root.localStorage,
      studentAuth
    });
    root.StudentSessionManager = studentSession;

    function showError(target, error) {
      target.textContent = error && error.message
        ? error.message
        : 'Something went wrong. Please try again.';
      target.style.display = 'block';
    }

    function setSignedInProfile(profile) {
      if (!profile) return;
      if (profile.name) root.localStorage.setItem('vocabTestApp_studentName', profile.name);
      if (profile.bio) root.localStorage.setItem('vocabTestApp_studentBio', profile.bio);
      if (profile.photo) root.localStorage.setItem('vocabTestApp_studentPhoto', profile.photo);
      const action = byId('studentLoginActionContainer');
      if (action) {
        action.innerHTML = '<button type="button" class="btn btn-ghost btn-sm" id="studentSignOutBtn">Sign out</button>';
        byId('studentSignOutBtn').addEventListener('click', async () => {
          try {
            await studentSession.signOut();
            root.localStorage.removeItem('vocabTestApp_studentName');
            root.localStorage.removeItem('vocabTestApp_studentBio');
            root.localStorage.removeItem('vocabTestApp_studentPhoto');
            root.showScreen('screen-welcome');
          } catch (error) {
            showError(errorBox, error);
          }
        });
      }
      if (typeof root.updateSettingsUI === 'function') root.updateSettingsUI();
    }

    async function completeStudentEntry() {
      const session = await studentSession.handleRedirectResult();
      if (!session) return false;
      let profile = await studentSession.loadRequiredProfile();
      if (!profile) {
        const googleProfile = session.profile || {};
        byId('studentProfileNameInput').value = googleProfile.displayName || '';
        byId('studentProfileEmailInput').value = googleProfile.email || '';
        byId('studentProfilePhotoInput').value = googleProfile.photoURL || '';
        root.showScreen('screen-student-profile');
        return true;
      }
      setSignedInProfile(profile);
      root.showScreen('screen-home');
      return true;
    }

    signInButton.addEventListener('click', async () => {
      signInButton.disabled = true;
      signInButton.textContent = 'Connecting to Google...';
      errorBox.style.display = 'none';
      try {
        await studentAuth.signInWithGoogle();
      } catch (error) {
        showError(errorBox, error);
        signInButton.disabled = false;
        signInButton.textContent = 'Continue with Google';
      }
    });

    adminButton.addEventListener('click', () => {
      byId('adminLoginError').innerHTML = '';
      root.showScreen('screen-admin-login');
    });

    profileForm.addEventListener('submit', async event => {
      event.preventDefault();
      const saveButton = byId('studentProfileSaveBtn');
      saveButton.disabled = true;
      saveButton.textContent = 'Saving profile...';
      profileError.style.display = 'none';
      try {
        const session = studentSession.getSession();
        const saved = await studentSession.saveRequiredProfile({
          name: byId('studentProfileNameInput').value,
          bio: byId('studentProfileBioInput').value,
          phone: byId('studentProfilePhoneInput').value,
          address: byId('studentProfileAddressInput').value,
          photo: byId('studentProfilePhotoInput').value || session?.profile?.photoURL || null,
          showPublic: byId('studentProfilePublicInput').checked
        });
        setSignedInProfile(saved.profile);
        root.showScreen('screen-home');
      } catch (error) {
        showError(profileError, error);
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save and continue';
      }
    });

    try {
      await runtime.authSessionPromise;
      const entered = await completeStudentEntry();
      if (!entered) root.showScreen('screen-welcome');
    } catch (error) {
      showError(errorBox, error);
      root.showScreen('screen-welcome');
    }

    if (runtime.AdminAuth && typeof runtime.AdminAuth.restore === 'function') {
      await runtime.AdminAuth.restore();
      runtime.updateAdminUI();
    }
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { initialize };
  }
  if (root && root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', () => initialize().catch(error => console.error(error)));
    } else {
      initialize().catch(error => console.error(error));
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
