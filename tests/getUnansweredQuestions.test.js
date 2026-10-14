const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();

test('getUnansweredQuestions', async (t) => {
    // Helper to evaluate in the context since currentTest is a let variable
    // We stringify the result back so that we are comparing native Node objects
    const runTest = (testData) => {
        window.eval(`currentTest = ${JSON.stringify(testData)};`);
        const resultString = window.eval('JSON.stringify(getUnansweredQuestions());');
        return JSON.parse(resultString);
    };

    await t.test('should return empty array when currentTest is empty', () => {
        assert.deepStrictEqual(runTest([]), []);
    });

    await t.test('should return all questions if none have a status', () => {
        const data = [
            { id: 1 },
            { id: 2, status: null },
            { id: 3, status: '' } // empty string is falsy, so !q.status is true
        ];
        assert.deepStrictEqual(runTest(data), data);
    });

    await t.test('should filter out questions that have a truthy status', () => {
        const data = [
            { id: 1, status: 'correct' },
            { id: 2 },
            { id: 3, status: 'wrong' },
            { id: 4, status: 'timeout' }
        ];
        assert.deepStrictEqual(runTest(data), [{ id: 2 }]);
    });
});
