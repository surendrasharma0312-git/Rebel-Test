const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { setupJSDOM } = require('./setupTest');


const { window } = setupJSDOM();

// Access the global functions from the JSDOM window
const cleanWord = window.cleanWord;

test('cleanWord', async (t) => {
    await t.test('should return normal word without changes', () => {
        assert.strictEqual(cleanWord("apple"), "apple");
        assert.strictEqual(cleanWord("सेब"), "सेब");
    });

    await t.test('should remove leading numbers', () => {
        assert.strictEqual(cleanWord("1. apple"), "apple");
        assert.strictEqual(cleanWord("123 apple"), "apple");
        assert.strictEqual(cleanWord("1) apple"), "apple");
    });

    await t.test('should remove leading bullets, hyphens, asterisks, periods, and right parentheses', () => {
        assert.strictEqual(cleanWord("• apple"), "apple");
        assert.strictEqual(cleanWord("- apple"), "apple");
        assert.strictEqual(cleanWord("* apple"), "apple");
        assert.strictEqual(cleanWord(". apple"), "apple");
        assert.strictEqual(cleanWord(") apple"), "apple");
    });

    await t.test('should remove combinations of noise characters', () => {
        assert.strictEqual(cleanWord(" 1) • - * . apple "), "apple");
        assert.strictEqual(cleanWord("• 1. apple"), "apple");
        assert.strictEqual(cleanWord("- * 2) apple"), "apple");
    });

    await t.test('should preserve internal and trailing noise characters', () => {
        assert.strictEqual(cleanWord("apple - pie"), "apple - pie");
        assert.strictEqual(cleanWord("apple 123"), "apple 123");
        assert.strictEqual(cleanWord("apple."), "apple.");
        assert.strictEqual(cleanWord("apple (1)"), "apple (1)");
    });

    await t.test('should trim leading and trailing spaces', () => {
        assert.strictEqual(cleanWord("  apple  "), "apple");
        assert.strictEqual(cleanWord("\tapple\n"), "apple");
    });

    await t.test('should return empty string if input contains only noise characters', () => {
        assert.strictEqual(cleanWord("1. - •"), "");
        assert.strictEqual(cleanWord("  "), "");
        assert.strictEqual(cleanWord("123)"), "");
    });

    await t.test('should handle empty string', () => {
        assert.strictEqual(cleanWord(""), "");
    });
});
