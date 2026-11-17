'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAttempt } = require('../attempt-validation');

const vocabTest = {
  words: [
    { en: 'Apple', hi: 'सेब' },
    { en: 'Book', hi: 'किताब' },
    { en: 'Water', hi: 'पानी' },
    { en: 'House', hi: 'घर' }
  ]
};

test('calculates score from authoritative vocabulary answers, not client totals', () => {
  const result = validateAttempt({
    testData: vocabTest,
    answers: [
      { sourceIndex: 0, mode: 'vocab', answer: 'सेब' },
      { sourceIndex: 1, mode: 'vocab', answer: 'गलत' },
      { sourceIndex: 2, mode: 'vocab', answer: null },
      { sourceIndex: 3, mode: 'vocab', answer: 'घर' }
    ]
  });
  assert.deepEqual(result, { total: 4, correct: 2, wrong: 1, timeout: 1, pct: 50 });
});

test('rejects partial submissions that could inflate the percentage', () => {
  assert.throws(() => validateAttempt({
    testData: vocabTest,
    answers: [{ sourceIndex: 0, mode: 'vocab', answer: 'सेब' }]
  }), error => error.code === 'invalid-argument');
});

test('rejects duplicate question references and out-of-range source indexes', () => {
  assert.throws(() => validateAttempt({
    testData: vocabTest,
    answers: [
      { sourceIndex: 0, mode: 'vocab', answer: 'सेब' },
      { sourceIndex: 0, mode: 'vocab', answer: 'सेब' },
      { sourceIndex: 2, mode: 'vocab', answer: 'पानी' },
      { sourceIndex: 3, mode: 'vocab', answer: 'घर' }
    ]
  }), error => error.code === 'invalid-argument');

  assert.throws(() => validateAttempt({
    testData: vocabTest,
    answers: [
      { sourceIndex: 0, mode: 'vocab', answer: 'सेब' },
      { sourceIndex: 1, mode: 'vocab', answer: 'किताब' },
      { sourceIndex: 2, mode: 'vocab', answer: 'पानी' },
      { sourceIndex: 99, mode: 'vocab', answer: 'घर' }
    ]
  }), error => error.code === 'invalid-argument');
});

test('honors configured mixed-test question count', () => {
  const result = validateAttempt({
    testData: { ...vocabTest, questionCount: 2 },
    answers: [
      { sourceIndex: 0, mode: 'vocab', answer: 'सेब' },
      { sourceIndex: 3, mode: 'vocab', answer: 'घर' }
    ]
  });
  assert.deepEqual(result, { total: 2, correct: 2, wrong: 0, timeout: 0, pct: 100 });
});

test('validates verb-form answers against the selected authoritative form', () => {
  const testData = {
    isVerbTest: true,
    questionCount: 4,
    verbs: [
      { v1: 'go', v2: 'went', v3: 'gone', v4: 'going', v5: 'goes', hi: 'जाना' },
      { v1: 'eat', v2: 'ate', v3: 'eaten', v4: 'eating', v5: 'eats', hi: 'खाना' },
      { v1: 'write', v2: 'wrote', v3: 'written', v4: 'writing', v5: 'writes', hi: 'लिखना' },
      { v1: 'see', v2: 'saw', v3: 'seen', v4: 'seeing', v5: 'sees', hi: 'देखना' }
    ]
  };
  const result = validateAttempt({
    testData,
    answers: [
      { sourceIndex: 0, mode: 'v2', answer: 'went' },
      { sourceIndex: 1, mode: 'v2', answer: 'ate' },
      { sourceIndex: 2, mode: 'v2', answer: 'wrong' },
      { sourceIndex: 3, mode: 'v2', answer: null }
    ]
  });
  assert.deepEqual(result, { total: 4, correct: 2, wrong: 1, timeout: 1, pct: 50 });
});

test('rejects unknown verb modes, malformed answers, and unscorable tests', () => {
  const testData = {
    isVerbTest: true,
    verbs: [
      { v1: 'go', v2: 'went' }, { v1: 'eat', v2: 'ate' },
      { v1: 'write', v2: 'wrote' }, { v1: 'see', v2: 'saw' }
    ]
  };
  assert.throws(() => validateAttempt({
    testData,
    answers: [{ sourceIndex: 0, mode: 'v6', answer: 'x' }]
  }), error => error.code === 'invalid-argument');
  assert.throws(() => validateAttempt({
    testData,
    answers: [
      { sourceIndex: 0, mode: 'v2', answer: 42 },
      { sourceIndex: 1, mode: 'v2', answer: 'ate' },
      { sourceIndex: 2, mode: 'v2', answer: 'wrote' },
      { sourceIndex: 3, mode: 'v2', answer: 'saw' }
    ]
  }), error => error.code === 'invalid-argument');
  assert.throws(() => validateAttempt({
    testData: { words: [{ en: 'one', hi: 'एक' }] },
    answers: [{ sourceIndex: 0, mode: 'vocab', answer: 'एक' }]
  }), error => error.code === 'failed-precondition');
  assert.throws(() => validateAttempt({
    testData: { ...testData, questionCount: -3 },
    answers: [
      { sourceIndex: 0, mode: 'v2', answer: 'went' },
      { sourceIndex: 1, mode: 'v2', answer: 'ate' },
      { sourceIndex: 2, mode: 'v2', answer: 'wrote' },
      { sourceIndex: 3, mode: 'v2', answer: 'saw' }
    ]
  }), error => error.code === 'failed-precondition');
});
