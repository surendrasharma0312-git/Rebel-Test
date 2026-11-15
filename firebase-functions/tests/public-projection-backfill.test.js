'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { backfillCollection } = require('../scripts/backfill-public-projections');

function fakeDb(rows) {
  const writes = [];
  const collections = new Map();
  const db = {
    collection(name) {
      if (!collections.has(name)) collections.set(name, {
        orderBy() {
          let cursor = null;
          let pageSize = rows.length;
          return {
            limit(value) { pageSize = value; return this; },
            startAfter(doc) { cursor = doc.id; return this; },
            async get() {
              const start = cursor ? rows.findIndex(row => row.id === cursor) + 1 : 0;
              const docs = rows.slice(start, start + pageSize);
              return { docs, size: docs.length, empty: docs.length === 0 };
            }
          };
        },
        doc(id) { return { collection: name, id }; }
      });
      return collections.get(name);
    },
    batch() {
      const pending = [];
      return {
        set(ref, value, options) { pending.push({ ref, value, options }); },
        async commit() { writes.push(...pending); }
      };
    }
  };
  return { db, writes };
}

test('backfill dry run scans and counts projections without writing', async () => {
  const rows = [
    { id: 'a', data: () => ({ studentId: 's1', studentName: 'One' }) },
    { id: 'b', data: () => ({ authUid: 'private-only' }) }
  ];
  const { db, writes } = fakeDb(rows);
  const result = await backfillCollection({
    db, sourceName: 'testResults', targetName: 'publicLeaderboard',
    project: data => data.studentId ? { studentId: data.studentId, studentName: data.studentName } : null,
    pageSize: 1, dryRun: true
  });
  assert.deepEqual(result, {
    source: 'testResults', target: 'publicLeaderboard',
    scanned: 2, projected: 1, skipped: 1, written: 0
  });
  assert.equal(writes.length, 0);
});

test('backfill apply writes eligible documents in paginated batches', async () => {
  const rows = [
    { id: 'a', data: () => ({ studentId: 's1', studentName: 'One' }) },
    { id: 'b', data: () => ({ studentId: 's2', studentName: 'Two' }) }
  ];
  const { db, writes } = fakeDb(rows);
  const result = await backfillCollection({
    db, sourceName: 'testResults', targetName: 'publicLeaderboard',
    project: data => ({ studentId: data.studentId, studentName: data.studentName }),
    pageSize: 1, dryRun: false
  });
  assert.equal(result.scanned, 2);
  assert.equal(result.written, 2);
  assert.deepEqual(writes.map(write => write.ref.id), ['a', 'b']);
  assert.ok(writes.every(write => write.options.merge === false));
});
