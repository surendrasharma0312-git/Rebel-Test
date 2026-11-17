'use strict';

// Safe-by-default one-time backfill for sanitized public projections.
// Run with application-default credentials for the intended Firebase project.
// Without --apply this performs a read-only dry run.
const admin = require('firebase-admin');
const {
  createPublicStudentId,
  projectPublicLeaderboardResult,
  projectPublicStudentProfile
} = require('../public-projections');

async function backfillCollection({
  db,
  sourceName,
  targetName,
  project,
  targetId,
  pageSize = 400,
  dryRun = true
}) {
  let cursor = null;
  // Use the Admin SDK document-id sentinel in production. The string fallback
  // keeps this helper testable with lightweight Firestore fakes.
  const documentIdField = admin.firestore && admin.firestore.FieldPath
    ? admin.firestore.FieldPath.documentId()
    : '__name__';
  const summary = { source: sourceName, target: targetName, scanned: 0, projected: 0, skipped: 0, written: 0 };

  while (true) {
    let query = db.collection(sourceName)
      .orderBy(documentIdField)
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = dryRun ? null : db.batch();
    let pageWrites = 0;
    for (const doc of snapshot.docs) {
      summary.scanned += 1;
      const value = project(doc.data(), doc.id);
      if (!value) {
        summary.skipped += 1;
        continue;
      }
      const destinationId = typeof targetId === 'function'
        ? targetId(doc, value)
        : doc.id;
      if (typeof destinationId !== 'string' || !destinationId) {
        summary.skipped += 1;
        continue;
      }
      summary.projected += 1;
      if (batch) {
        batch.set(db.collection(targetName).doc(destinationId), value, { merge: false });
        summary.written += 1;
        pageWrites += 1;
      }
    }

    if (batch && pageWrites > 0) await batch.commit();
    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < pageSize) break;
  }

  return summary;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  const results = await backfillCollection({
    db,
    sourceName: 'testResults',
    targetName: 'publicLeaderboard',
    project: data => projectPublicLeaderboardResult(data),
    dryRun
  });
  const profiles = await backfillCollection({
    db,
    sourceName: 'studentProfiles',
    targetName: 'publicStudentProfiles',
    project: (data, id) => projectPublicStudentProfile(data, id),
    targetId: (_doc, value) => value.publicStudentId,
    dryRun
  });

  console.log(JSON.stringify({
    mode: dryRun ? 'DRY RUN — no writes performed' : 'APPLY — projection documents written',
    results,
    profiles
  }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error('Public projection backfill failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { backfillCollection };
