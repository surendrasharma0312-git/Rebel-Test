# Admin authentication migration

This repository now uses the callable Cloud Function `adminAccess` to verify the admin password and set a Firebase Authentication custom claim. The password is read only by the server from Secret Manager; it must never be committed to Git or stored in the public Firestore `config/admin` document.

## One-time setup

1. Choose a **new, strong admin password**. Do not reuse the old password because the old SHA-256 hash was stored in a publicly readable Firestore document.
2. In the repository root, with Firebase CLI authenticated to project `rebel-test-9a453`, run:
   ```sh
   firebase functions:secrets:set REBEL_ADMIN_PASSWORD
   ```
   Enter the new password at the CLI prompt. Do not paste it into chat, GitHub, source code, or a command-line argument.
3. Deploy the Functions after this change is merged:
   ```sh
   firebase deploy --only functions
   ```
4. Open the Rebel Test site, sign in to Admin with the **new** password, then log out and sign in again to verify that custom-claim restoration works.
5. After successful verification, delete the old Firestore document `config/admin` (it contains the exposed legacy password hash). Do not delete it before the new server-side login is deployed and verified.

## Important security boundary

This migration establishes a server-verified admin identity and custom claim. It does **not** by itself secure existing Firestore collections: current Firestore Rules still allow public writes to some collections, and client-side `AdminAuth.isAdmin` is only a UI gate. Do not claim the database is protected until a separate, fully tested Firestore Rules migration and server-side score/profile/token changes are complete.

The callable requires an authenticated Firebase user. The app uses Anonymous Authentication for students, so no student email/password registration is needed.
