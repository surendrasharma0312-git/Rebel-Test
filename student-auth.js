(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.StudentAuth = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function create(auth, firebaseAuth) {
    if (!auth || !firebaseAuth || typeof firebaseAuth.GoogleAuthProvider !== 'function') {
      throw new Error('Firebase Authentication and GoogleAuthProvider are required.');
    }

    function createGoogleProvider() {
      const provider = new firebaseAuth.GoogleAuthProvider();
      if (typeof provider.setCustomParameters === 'function') {
        provider.setCustomParameters({ prompt: 'select_account' });
      }
      return provider;
    }

    return Object.freeze({
      async signInWithGoogle() {
        const provider = createGoogleProvider();
        const currentUser = auth.currentUser;

        // An anonymous UID may already own historical attempts. Never fall
        // back to signInWithRedirect for that session: it can replace the
        // current account instead of linking Google to the existing identity.
        if (currentUser && currentUser.isAnonymous) {
          if (typeof currentUser.linkWithRedirect !== 'function') {
            throw new Error(
              'Google account linking is unavailable for the current anonymous session. ' +
              'Sign-in was stopped to protect existing student history.'
            );
          }
          return currentUser.linkWithRedirect(provider);
        }

        // A registered Firebase account may already own student history or an
        // admin session. Do not let a second Google redirect silently replace
        // that identity. Account linking/recovery must be an explicit flow.
        if (currentUser) {
          throw new Error(
            'A Firebase account is already signed in. To protect existing student history, ' +
            'Rebel Test will not switch or merge accounts automatically. Sign out or contact ' +
            'the administrator before using a different Google account.'
          );
        }

        if (typeof auth.signInWithRedirect !== 'function') {
          throw new Error('Google redirect sign-in is not available in this Firebase SDK.');
        }
        return auth.signInWithRedirect(provider);
      },

      async handleRedirectResult() {
        if (typeof auth.getRedirectResult !== 'function') {
          throw new Error('Google redirect result handling is not available in this Firebase SDK.');
        }
        const result = await auth.getRedirectResult();
        return result && result.user ? result.user : null;
      },

      isGoogleUser(user) {
        return Boolean(user && Array.isArray(user.providerData) &&
          user.providerData.some(provider => provider && provider.providerId === 'google.com'));
      },

      getGoogleProfile(user) {
        if (!user) return null;
        const googleProvider = Array.isArray(user.providerData)
          ? user.providerData.find(provider => provider && provider.providerId === 'google.com')
          : null;
        if (!googleProvider) return null;
        return {
          uid: user.uid || null,
          displayName: user.displayName || googleProvider.displayName || '',
          email: user.email || googleProvider.email || '',
          photoURL: user.photoURL || googleProvider.photoURL || ''
        };
      },

      signOut() {
        if (typeof auth.signOut !== 'function') {
          throw new Error('Firebase sign-out is not available.');
        }
        return auth.signOut();
      }
    });
  }

  return Object.freeze({ create });
});
