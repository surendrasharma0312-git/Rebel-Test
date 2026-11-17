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


## Sanitized public projection rollout
- Cloud Functions mirror each new/updated `testResults/{attemptId}` into `publicLeaderboard/{attemptId}` using an explicit allowlist. The public projection uses `publicStudentId`, never the Firebase UID or source `studentId`.
- Public student IDs are deterministic HMAC-SHA256 pseudonyms generated with the Secret Manager secret `REBEL_PUBLIC_ID_SECRET` (minimum 32 characters). Keep this secret stable and private; rotating it changes public IDs and requires a coordinated rebuild of projections.
- Cloud Functions mirror `studentProfiles/{studentId}` into `publicStudentProfiles/{publicStudentId}`. Only name, bio and photo are copied. Phone, email and address are never copied, even when the broad `showPublic` checkbox is enabled.
- Clients may read these projection collections but cannot write them; only trusted Cloud Functions/Admin SDK maintain them.
- Existing historical results and profiles are not automatically backfilled by these triggers. Before switching leaderboard/profile UI reads or making `testResults` private, run and verify a one-time Admin SDK backfill, compare counts and rankings, and retain a rollback path.
- Do not deploy these rules or functions to production until the backfill, staging verification, and full UI migration are reviewed.


## Historical public projection backfill

The trigger only mirrors writes made after it is deployed; it does not populate existing records. A one-time Admin SDK backfill script is provided at `firebase-functions/scripts/backfill-public-projections.js`.

1. Configure Application Default Credentials for the intended Firebase project and verify the active project before running anything.
2. Configure the same stable `REBEL_PUBLIC_ID_SECRET` used by the deployed projection triggers in the shell environment (at least 32 characters). Do not commit or share the secret.
3. Run `npm run backfill:public-projections` first. This is read-only and reports scanned, eligible and skipped documents for both source collections.
4. Review the counts and investigate skipped records. Confirm the intended Firebase project and take a backup/export.
5. Only after an explicit production change approval, run `npm run backfill:public-projections -- --apply`. The script overwrites matching projection documents with the current allowlisted projection and does not delete unrelated/orphaned projection documents.
6. Compare source/projection counts and leaderboard ranking in staging, then migrate UI reads before restricting `testResults`.

The backfill is intentionally not run by CI or automatically against production. A dry run is the default; writes require the explicit `--apply` flag.
