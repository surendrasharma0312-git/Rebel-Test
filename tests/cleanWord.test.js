const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// Load HTML content
const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Load HTML in JSDOM, enabling script execution but ignoring external scripts
// Mock necessary globals before script execution
const dom = new JSDOM(htmlContent, {
    url: "http://localhost/", // Set a URL to avoid "opaque origins" error for sessionStorage
    runScripts: "dangerously",
    beforeParse(window) {
        // Mock firebase to prevent errors during init in index.html
        window.firebase = {
            initializeApp: () => ({}),
            firestore: () => ({
                collection: () => ({
                    orderBy: () => ({
                        limit: () => ({
                            onSnapshot: () => {}
                        })
                    })
                })
            })
        };
        // Mock matchMedia to prevent errors
        window.matchMedia = () => ({
            matches: false,
            addListener: () => {},
            removeListener: () => {}
        });
        // Mock history.replaceState to avoid JSDOM errors with the targetURL thing
        const originalReplaceState = window.history.replaceState;
        window.history.replaceState = function(...args) {
            try {
               return originalReplaceState.apply(this, args);
            } catch (e) {
               // ignore JSDOM bug with url resolution
            }
        };
    }
});

// Access the global functions from the JSDOM window
const window = dom.window;
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
