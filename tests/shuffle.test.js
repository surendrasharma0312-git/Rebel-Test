const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { setupJSDOM } = require('./setupTest');


const { window } = setupJSDOM();

// Access the global functions from the JSDOM window
const shuffle = window.shuffle;

test('shuffle', async (t) => {
    await t.test('should return a new array and not modify the original array', () => {
        const original = [1, 2, 3, 4, 5];
        const originalCopy = [...original];
        const shuffled = shuffle(original);

        assert.notStrictEqual(shuffled, original);
        assert.deepStrictEqual(original, originalCopy, 'Original array should not be modified');
    });

    await t.test('should contain all the same elements as the original array', () => {
        const original = [1, 2, 3, 4, 5];
        const shuffled = shuffle(original);

        assert.strictEqual(shuffled.length, original.length);

        const sortedOriginal = [...original].sort();
        const sortedShuffled = [...shuffled].sort();

        assert.deepStrictEqual(sortedShuffled, sortedOriginal);
    });

    await t.test('should handle an empty array', () => {
        const original = [];
        const shuffled = shuffle(original);
        assert.deepStrictEqual(shuffled, []);
        assert.notStrictEqual(shuffled, original);
    });

    await t.test('should handle a single-element array', () => {
        const original = [42];
        const shuffled = shuffle(original);
        assert.deepStrictEqual(shuffled, [42]);
        assert.notStrictEqual(shuffled, original);
    });

    await t.test('should handle a larger array', () => {
        const original = Array.from({ length: 100 }, (_, i) => i);
        const shuffled = shuffle(original);
        assert.strictEqual(shuffled.length, 100);

        const sortedOriginal = [...original].sort((a, b) => a - b);
        const sortedShuffled = [...shuffled].sort((a, b) => a - b);

        assert.deepStrictEqual(sortedShuffled, sortedOriginal);
    });
});
