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

// Access the global window from JSDOM
const window = dom.window;

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
