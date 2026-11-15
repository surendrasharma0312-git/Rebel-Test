# Firestore Rules Migration Notes

## Status

The rules in `firestore.rules` are a **draft for emulator validation only**. They are not deployed. Do not deploy them or enable Google student login until the compatibility items below are completed and tested against the production Firebase project.

## Current policy

- `vocabTests`: public reads; create/update/delete require the existing server-issued `admin: true` custom claim.
- `testResults`: public reads remain enabled because the current class and all-time leaderboards query the collection. Student creates require a Google-authenticated session, `authUid == request.auth.uid`, and a student ID equal to the UID or authorized by the server-managed `studentAccountLinks/{uid}` mapping. Student updates/deletes are denied; Admin SDK writes bypass rules.
- `studentProfiles`: private to the owning Google-authenticated student (including a verified legacy ID mapping) and admins; student writes require Google authentication. Only the known profile fields are accepted.
- `fcmTokens`: private; writes require Google authentication, an `authUid` matching the caller, and a document ID matching the token.
- `studentAccountLinks`, `adminLoginAttempts`, and legacy `config`: client access denied.
- All unlisted collections are denied by default.

## Required compatibility work before deployment

1. Complete the Google sign-in flow and call `resolveStudentIdentity` before any student profile, history, result, or token operation. The app must use the returned canonical `studentId`.
2. FCM token writes now include the current authenticated `authUid`; token deletion is owner-checked by the rules. Validate this behavior after the Google login flow is integrated, including tokens created by older anonymous sessions.
3. Profile documents contain phone, email, and address. Firestore Rules cannot redact individual fields from a document. These draft rules therefore keep the whole profile private even when `showPublic` is true. Before restoring public profile views, publish a separate allowlisted public profile document/collection containing only safe fields; never expose the private profile document.
4. The current leaderboard reads the full `testResults` collection. That collection contains `authUid` ownership proof and is still publicly readable for compatibility. Before production, move public leaderboard data to a sanitized projection and keep ownership proof in a private server-managed record. Do not treat a Firebase UID as public profile data.
5. Existing anonymous/local-only profile IDs and results without a matching `authUid` cannot be safely migrated automatically. Leave them unresolved for an explicit recovery path; do not claim ownership based only on a client-supplied student ID.
6. Client-submitted scores are not independently verified by these rules. Owner-only create access prevents writing as another student, but does not prevent a modified client from submitting an inflated score. Server-side attempt validation is a separate integrity requirement.
7. Confirm the legacy `config/admin` password hash is no longer needed, then remove it through a separately reviewed migration after the server-side AdminAuth deployment is verified.

## Emulator tests

The CI workflow installs the emulator test libraries without changing the committed lockfile, then runs:

```sh
npm install --no-save --package-lock=false @firebase/rules-unit-testing firebase
npm run test:firestore
```

The command starts the Firestore emulator and tests public/admin test access, Google-only student writes (anonymous sessions denied), student ownership, verified legacy mappings, profile privacy, FCM token ownership, and server-only collections.

## Deployment gate

Do not deploy these rules until the login/profile/token compatibility work is complete, the public profile and leaderboard projections are addressed, and the emulator suite passes. The rules are not a substitute for production backup, staging verification, or a reviewed rollout plan.
