'use strict';

const VERB_MODES = Object.freeze(['v2', 'v3', 'v4', 'v5', 'hi']);

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeAnswer(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

function getQuestionLimit(testData, sourceLength) {
  if (testData.questionCount === undefined || testData.questionCount === null ||
      testData.questionCount === '') {
    return sourceLength;
  }
  const configured = Number(testData.questionCount);
  if (!Number.isSafeInteger(configured) || configured < 1) {
    throw createError('failed-precondition', 'The published test question count is invalid.');
  }
  return Math.min(configured, sourceLength);
}

function validateAttempt({ testData, answers }) {
  if (!testData || typeof testData !== 'object') {
    throw createError('invalid-argument', 'A valid published test is required.');
  }
  if (!Array.isArray(answers) || answers.length === 0 || answers.length > 200) {
    throw createError('invalid-argument', 'The submitted answer list is invalid.');
  }

  const isVerbTest = testData.isVerbTest === true;
  const source = isVerbTest ? testData.verbs : testData.words;
  if (!Array.isArray(source) || source.length === 0) {
    throw createError('failed-precondition', 'This test has no valid question source.');
  }

  const questionLimit = getQuestionLimit(testData, source.length);
  let expectedTotal = questionLimit;
  let selectedModes = [];

  if (isVerbTest) {
    selectedModes = [...new Set(answers.map(item => item && item.mode))];
    if (selectedModes.length === 0 ||
        selectedModes.some(mode => !VERB_MODES.includes(mode))) {
      throw createError('invalid-argument', 'The verb test mode is invalid.');
    }

    const availableQuestions = selectedModes.reduce((total, mode) => {
      const field = mode === 'hi' ? 'v1' : mode;
      const uniqueAnswers = new Set(source
        .map(item => item && item[field])
        .filter(value => typeof value === 'string' && value.trim())
        .map(value => normalizeAnswer(value)));
      if (uniqueAnswers.size < 4) return total;
      const candidates = source.filter(item =>
        item && typeof item[field] === 'string' && item[field].trim() &&
        (mode !== 'hi' || (typeof item.hi === 'string' && item.hi.trim()))
      ).length;
      return total + candidates;
    }, 0);

    expectedTotal = Math.min(questionLimit, availableQuestions);
  } else {
    const uniqueMeanings = new Set(source
      .map(item => item && item.hi)
      .filter(value => typeof value === 'string' && value.trim())
      .map(value => normalizeAnswer(value)));
    if (uniqueMeanings.size < 4) {
      throw createError('failed-precondition', 'This vocabulary test cannot generate four distinct options.');
    }
  }

  if (expectedTotal < 1 || answers.length !== expectedTotal) {
    throw createError('invalid-argument', 'The submitted question count does not match this test.');
  }

  const seen = new Set();
  let correct = 0;
  let wrong = 0;
  let timeout = 0;

  for (const item of answers) {
    if (!item || typeof item !== 'object' ||
        !Number.isSafeInteger(item.sourceIndex) ||
        item.sourceIndex < 0 || item.sourceIndex >= source.length) {
      throw createError('invalid-argument', 'A submitted question reference is invalid.');
    }

    const mode = isVerbTest ? item.mode : 'vocab';
    if ((!isVerbTest && item.mode !== 'vocab') ||
        (isVerbTest && !VERB_MODES.includes(mode))) {
      throw createError('invalid-argument', 'A submitted question mode is invalid.');
    }

    const uniqueKey = item.sourceIndex + ':' + mode;
    if (seen.has(uniqueKey)) {
      throw createError('invalid-argument', 'The same question cannot be submitted twice.');
    }
    seen.add(uniqueKey);

    if (item.answer !== null && (typeof item.answer !== 'string' || item.answer.length > 256)) {
      throw createError('invalid-argument', 'A submitted answer is invalid.');
    }

    const sourceItem = source[item.sourceIndex];
    const expected = isVerbTest
      ? sourceItem && sourceItem[mode === 'hi' ? 'v1' : mode]
      : sourceItem && sourceItem.hi;

    if (typeof expected !== 'string' || !expected.trim()) {
      throw createError('invalid-argument', 'A submitted question does not match the published test.');
    }

    if (item.answer === null || !item.answer.trim()) {
      timeout += 1;
    } else if (normalizeAnswer(item.answer) === normalizeAnswer(expected)) {
      correct += 1;
    } else {
      wrong += 1;
    }
  }

  const total = answers.length;
  return Object.freeze({
    total,
    correct,
    wrong,
    timeout,
    pct: Math.round((correct / total) * 100)
  });
}

module.exports = Object.freeze({ validateAttempt, VERB_MODES });
