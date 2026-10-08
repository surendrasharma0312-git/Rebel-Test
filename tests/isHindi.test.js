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
const isHindi = window.isHindi;

test('isHindi', async (t) => {
    await t.test('should return true for pure Hindi text', () => {
        assert.strictEqual(isHindi("सेब"), true);
        assert.strictEqual(isHindi("नमस्ते"), true);
        assert.strictEqual(isHindi("आक्रमण करना"), true);
    });

    await t.test('should return false for pure English text', () => {
        assert.strictEqual(isHindi("apple"), false);
        assert.strictEqual(isHindi("hello"), false);
        assert.strictEqual(isHindi("attack"), false);
    });

    await t.test('should return true for mixed Hindi and English text', () => {
        assert.strictEqual(isHindi("apple सेब"), true);
        assert.strictEqual(isHindi("hello नमस्ते world"), true);
        assert.strictEqual(isHindi("123 आक्रमण"), true);
    });

    await t.test('should return false for numbers and symbols only', () => {
        assert.strictEqual(isHindi("123"), false);
        assert.strictEqual(isHindi("!@#$%^&*()"), false);
        assert.strictEqual(isHindi("123 !@#"), false);
    });

    await t.test('should return false for empty string', () => {
        assert.strictEqual(isHindi(""), false);
        assert.strictEqual(isHindi("   "), false);
    });
});
