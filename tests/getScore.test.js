const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();

test('getScore', async (t) => {
    // Helper to evaluate in the context since currentTest is a let variable
    const runScoreTest = (testData) => {
        window.eval(`currentTest = ${JSON.stringify(testData)};`);
        return window.eval('getScore();');
    };

    await t.test('should return 0 when currentTest is empty', () => {
        assert.strictEqual(runScoreTest([]), 0);
    });

    await t.test('should return 0 when no answers are correct', () => {
        const data = [
            { status: 'wrong' },
            { status: 'unanswered' },
            { status: null }
        ];
        assert.strictEqual(runScoreTest(data), 0);
    });

    await t.test('should return the correct count when some answers are correct', () => {
        const data = [
            { status: 'correct' },
            { status: 'wrong' },
            { status: 'correct' }
        ];
        assert.strictEqual(runScoreTest(data), 2);
    });

    await t.test('should return the total count when all answers are correct', () => {
        const data = [
            { status: 'correct' },
            { status: 'correct' },
            { status: 'correct' }
        ];
        assert.strictEqual(runScoreTest(data), 3);
    });

    await t.test('should ignore other properties and only consider status', () => {
        const data = [
            { question: 'A?', status: 'correct', otherProp: true },
            { question: 'B?', status: 'wrong', correct: true }, // 'correct' in key but not in status
            { question: 'C?', status: 'correct' }
        ];
        assert.strictEqual(runScoreTest(data), 2);
    });
});
