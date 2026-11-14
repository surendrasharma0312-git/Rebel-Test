const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();
const {
  bestPerStudentPerTest,
  rankLeaderboardEntries,
  hasLeaderboardProfile,
  buildLeaderboardFilterOptions,
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
  await t.test('assigns competition ranks when percentage and duration are tied', () => {
    const docs = [
      createDoc('z-attempt', { studentId: 'z', studentName: 'Zara', total: 10, correct: 9, pct: 90, durationSeconds: 30 }),
      createDoc('b-attempt', { studentId: 'b', studentName: 'Aman', total: 10, correct: 9, pct: 90, durationSeconds: 30 }),
      createDoc('c-attempt', { studentId: 'c', studentName: 'Chetan', total: 10, correct: 8, pct: 80, durationSeconds: 35 })
    ];

    const ranked = rankLeaderboardEntries(docs);
    assert.deepStrictEqual(ranked.map(item => item.rank), [1, 1, 3]);
    assert.deepStrictEqual(ranked.map(item => item.doc.id), ['b-attempt', 'z-attempt', 'c-attempt']);
  });

  await t.test('does not tie students when their durations differ', () => {
    const docs = [
      createDoc('slower', { studentName: 'A', total: 10, correct: 9, pct: 90, durationSeconds: 31 }),
      createDoc('faster', { studentName: 'B', total: 10, correct: 9, pct: 90, durationSeconds: 30 })
    ];

    assert.deepStrictEqual(rankLeaderboardEntries(docs).map(item => item.rank), [1, 2]);
  });

  await t.test('treats two missing durations as a tie and keeps a stable name order', () => {
    const docs = [
      createDoc('z', { studentName: 'Zara', total: 10, correct: 9, pct: 90 }),
      createDoc('a', { studentName: 'Aman', total: 10, correct: 9, pct: 90 })
    ];

    const ranked = rankLeaderboardEntries(docs);
    assert.deepStrictEqual(ranked.map(item => item.rank), [1, 1]);
    assert.deepStrictEqual(ranked.map(item => item.doc.id), ['a', 'z']);
  });

  await t.test('only modern records with a studentId can open a public profile', () => {
    assert.strictEqual(hasLeaderboardProfile({ studentId: 'student-a' }), true);
    assert.strictEqual(hasLeaderboardProfile({ studentId: '  student-a  ' }), true);
    assert.strictEqual(hasLeaderboardProfile({ studentName: 'Rahul' }), false);
    assert.strictEqual(hasLeaderboardProfile({ studentId: '  ' }), false);
  });

  await t.test('excludes invalid-only tests and disambiguates duplicate test names', () => {
    const docs = [
      createDoc('modern-one', { testDocId: 'test-123456', testName: 'Vocabulary Set', testType: 'vocab', total: 10, correct: 8, pct: 80 }),
      createDoc('modern-two', { testDocId: 'test-abcdef', testName: 'Vocabulary Set', testType: 'vocab', total: 10, correct: 9, pct: 90 }),
      createDoc('invalid', { testDocId: 'test-invalid', testName: 'Broken Test', testType: 'vocab', total: 0, pct: 100 }),
      createDoc('verb', { testDocId: 'verb-1', testName: 'Verb Forms', testType: 'verb', total: 10, correct: 7, pct: 70 })
    ];

    const allOptions = buildLeaderboardFilterOptions(docs, 'all');
    assert.strictEqual(allOptions.length, 3);
    assert.notStrictEqual(allOptions[0].label, allOptions[1].label);
    assert.strictEqual(allOptions.some(option => option.label.includes('Broken Test')), false);

    const vocabOptions = buildLeaderboardFilterOptions(docs, 'vocab');
    assert.strictEqual(vocabOptions.length, 2);
    assert.strictEqual(vocabOptions.every(option => option.key.startsWith('id:')), true);
  });

});
