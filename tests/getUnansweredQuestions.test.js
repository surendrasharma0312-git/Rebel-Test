const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');


const { window } = setupJSDOM();

// Access the global window from JSDOM

test('getUnansweredQuestions', async (t) => {
    // Helper to evaluate in the context since currentTest is a let variable
    const runUnansweredTest = (testData) => {
        window.eval(`currentTest = ${JSON.stringify(testData)};`);
        return window.eval('getUnansweredQuestions();');
    };

    // We parse the result because evaling returns a Proxy object from jsdom context sometimes,
    // or deepEqual fails due to different Array/Object constructors.
    const runUnansweredTestSafe = (data) => {
        const raw = runUnansweredTest(data);
        return JSON.parse(JSON.stringify(raw));
    };

    await t.test('should return empty array when currentTest is empty', () => {
        const result = runUnansweredTestSafe([]);
        assert.deepStrictEqual(result, []);
    });

    await t.test('should return all questions when none have status', () => {
        const data = [
            { question: 'A?', status: null },
            { question: 'B?' },
            { question: 'C?' } // undefined status stringifies out
        ];
        // JSDOM and JSON.stringify will drop undefined. Make data consistent with JSON structure
        const expected = [
            { question: 'A?', status: null },
            { question: 'B?' },
            { question: 'C?' }
        ];
        const result = runUnansweredTestSafe(data);
        assert.deepStrictEqual(result, expected);
    });

    await t.test('should filter out questions that have a status', () => {
        const data = [
            { question: 'A?', status: 'correct' },
            { question: 'B?', status: null },
            { question: 'C?', status: 'wrong' }
        ];
        const result = runUnansweredTestSafe(data);
        assert.deepStrictEqual(result, [{ question: 'B?', status: null }]);
    });

    await t.test('should handle completely answered tests', () => {
        const data = [
            { question: 'A?', status: 'correct' },
            { question: 'B?', status: 'correct' },
            { question: 'C?', status: 'wrong' }
        ];
        const result = runUnansweredTestSafe(data);
        assert.deepStrictEqual(result, []);
    });
});
