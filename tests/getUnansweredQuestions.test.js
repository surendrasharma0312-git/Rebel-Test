const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();
const getUnansweredQuestions = window.getUnansweredQuestions;

test('getUnansweredQuestions', async (t) => {
    await t.test('should return all questions if none have status', () => {
        const testData = [
            { id: 1, text: 'Q1' },
            { id: 2, text: 'Q2' },
            { id: 3, text: 'Q3' }
        ];
        window.eval(`currentTest = ${JSON.stringify(testData)}`);

        const result = getUnansweredQuestions();
        assert.strictEqual(result.length, 3);
        assert.deepEqual(result, testData);
    });

    await t.test('should return correctly filtered questions if some have status', () => {
        const testData = [
            { id: 1, text: 'Q1', status: 'correct' },
            { id: 2, text: 'Q2' },
            { id: 3, text: 'Q3', status: 'incorrect' },
            { id: 4, text: 'Q4' }
        ];
        window.eval(`currentTest = ${JSON.stringify(testData)}`);

        const result = getUnansweredQuestions();
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].id, 2);
        assert.strictEqual(result[1].id, 4);
    });

    await t.test('should return empty array if all questions have status', () => {
        const testData = [
            { id: 1, text: 'Q1', status: 'correct' },
            { id: 2, text: 'Q2', status: 'skipped' },
            { id: 3, text: 'Q3', status: 'incorrect' }
        ];
        window.eval(`currentTest = ${JSON.stringify(testData)}`);

        const result = getUnansweredQuestions();
        assert.strictEqual(result.length, 0);
        assert.deepEqual(result, []);
    });

    await t.test('should return empty array if currentTest is empty', () => {
        window.eval(`currentTest = []`);
        const result = getUnansweredQuestions();
        assert.strictEqual(result.length, 0);
        assert.deepEqual(result, []);
    });
});
