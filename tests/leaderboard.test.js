const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();
const {
  bestPerStudentPerTest,
  getLeaderboardPercentage,
  getLeaderboardDate,
  getLeaderboardTestKey,
  buildLeaderboardTestAliases
} = window;

function createDoc(id, data) {
  return { id, data: () => data };
}

test('All-Time leaderboard data integrity', async (t) => {
  await t.test('keeps two different students with the same display name separate', () => {
    const docs = [
      createDoc('attempt-1', { studentId: 'student-a', studentName: 'Rahul', testDocId: 'test-1', total: 10, correct: 8, pct: 80 }),
      createDoc('attempt-2', { studentId: 'student-b', studentName: 'Rahul', testDocId: 'test-1', total: 10, correct: 9, pct: 90 })
    ];

    assert.strictEqual(bestPerStudentPerTest(docs).length, 2);
  });

  await t.test('groups renamed attempts by stable studentId and keeps the best result', () => {
    const slower = createDoc('attempt-1', { studentId: 'student-a', studentName: 'Rahul Sharma', testDocId: 'test-1', total: 10, correct: 8, pct: 80, durationSeconds: 40 });
    const faster = createDoc('attempt-2', { studentId: 'student-a', studentName: 'Rahul S.', testDocId: 'test-1', total: 10, correct: 9, pct: 90, durationSeconds: 35 });

    const result = bestPerStudentPerTest([slower, faster]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'attempt-2');
  });

  await t.test('uses student name as a compatibility fallback for legacy records', () => {
    const docs = [
      createDoc('attempt-1', { studentName: '  Rahul ', testDocId: 'test-1', total: 10, correct: 7, pct: 70 }),
      createDoc('attempt-2', { studentName: 'rahul', testDocId: 'test-1', total: 10, correct: 8, pct: 80 })
    ];

    const result = bestPerStudentPerTest(docs);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'attempt-2');
  });

  await t.test('matches legacy name-only attempts to one unambiguous modern test ID', () => {
    const docs = [
      createDoc('legacy-attempt', { studentId: 'student-a', studentName: 'Rahul', testName: 'Vocabulary Set 1', total: 10, correct: 7, pct: 70 }),
      createDoc('modern-attempt', { studentId: 'student-a', studentName: 'Rahul', testDocId: 'test-1', testName: ' vocabulary set 1 ', total: 10, correct: 9, pct: 90 })
    ];

    const aliases = buildLeaderboardTestAliases(docs);
    assert.strictEqual(getLeaderboardTestKey(docs[0].data(), aliases), 'id:test-1');
    assert.strictEqual(bestPerStudentPerTest(docs).length, 1);
    assert.strictEqual(bestPerStudentPerTest(docs)[0].id, 'modern-attempt');
  });

  await t.test('does not guess when one test name maps to multiple IDs', () => {
    const docs = [
      createDoc('legacy-attempt', { studentId: 'student-a', testName: 'Vocabulary Set', total: 10, correct: 7, pct: 70 }),
      createDoc('modern-one', { studentId: 'student-a', testDocId: 'test-1', testName: 'Vocabulary Set', total: 10, correct: 8, pct: 80 }),
      createDoc('modern-two', { studentId: 'student-a', testDocId: 'test-2', testName: 'Vocabulary Set', total: 10, correct: 9, pct: 90 })
    ];

    const aliases = buildLeaderboardTestAliases(docs);
    assert.strictEqual(aliases.has('vocabulary set'), false);
    assert.strictEqual(getLeaderboardTestKey(docs[0].data(), aliases), 'name:vocabulary set');
  });

  await t.test('rejects zero-total and non-recoverable invalid score records', () => {
    const docs = [
      createDoc('zero-total', { studentId: 'a', testDocId: 't', total: 0, pct: 100 }),
      createDoc('nan-score', { studentId: 'b', testDocId: 't', total: 10, pct: 'NaN' }),
      createDoc('infinite-score', { studentId: 'c', testDocId: 't', total: 10, pct: 'Infinity' })
    ];

    assert.strictEqual(bestPerStudentPerTest(docs).length, 0);
  });

  await t.test('recovers an invalid stored percentage from valid correct/total counts', () => {
    const data = { total: 10, correct: 4, pct: 'Infinity' };
    assert.strictEqual(getLeaderboardPercentage(data), 40);
  });

  await t.test('accepts numeric percentage strings but rejects impossible totals', () => {
    assert.strictEqual(getLeaderboardPercentage({ total: 10, pct: '85' }), 85);
    assert.strictEqual(getLeaderboardPercentage({ total: 0, correct: 0, pct: 0 }), null);
  });

  await t.test('supports legacy testId and testName values in test filters', () => {
    assert.strictEqual(getLeaderboardTestKey({ testId: 'legacy-123' }), 'id:legacy-123');
    assert.strictEqual(getLeaderboardTestKey({ testName: '  Verb Forms ' }), 'name:verb forms');
    assert.strictEqual(getLeaderboardTestKey({}), null);
  });

  await t.test('parses Firestore timestamps and legacy string dates safely', () => {
    const expected = new Date('2025-05-01T12:00:00.000Z');
    const timestamp = { toDate: () => expected };
    const fromTimestamp = getLeaderboardDate(timestamp);
    const fromString = getLeaderboardDate('2025-05-01T12:00:00.000Z');
    const fromForeignRealmDate = getLeaderboardDate(expected);
    const fromWindowDate = getLeaderboardDate(new window.Date(expected.getTime()));

    assert.strictEqual(fromTimestamp.toISOString(), expected.toISOString());
    assert.strictEqual(fromString.toISOString(), expected.toISOString());
    assert.strictEqual(fromForeignRealmDate.toISOString(), expected.toISOString());
    assert.strictEqual(fromWindowDate.toISOString(), expected.toISOString());
    assert.strictEqual(getLeaderboardDate('not-a-date'), null);
  });
});
