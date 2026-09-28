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
const resolveOrder = (a, b) => {
    // Because Objects cross contexts, we extract the primitive properties
    const res = window.resolveOrder(a, b);
    return { word: res.word, meaning: res.meaning };
};

test('resolveOrder', async (t) => {
    await t.test('should return {word: a, meaning: b} when a is English and b is Hindi', () => {
        assert.deepStrictEqual(resolveOrder("Apple", "सेब"), { word: "Apple", meaning: "सेब" });
    });

    await t.test('should return {word: b, meaning: a} when a is Hindi and b is English (reversed layout correction)', () => {
        assert.deepStrictEqual(resolveOrder("आक्रमण करना", "Attack"), { word: "Attack", meaning: "आक्रमण करना" });
    });

    await t.test('should default to {word: a, meaning: b} when both are English', () => {
        assert.deepStrictEqual(resolveOrder("Apple", "Fruit"), { word: "Apple", meaning: "Fruit" });
    });

    await t.test('should default to {word: a, meaning: b} when both are Hindi', () => {
        assert.deepStrictEqual(resolveOrder("सेब", "फल"), { word: "सेब", meaning: "फल" });
    });

    await t.test('should handle empty strings', () => {
        assert.deepStrictEqual(resolveOrder("", ""), { word: "", meaning: "" });
    });

    await t.test('should handle undefined inputs', () => {
        assert.deepStrictEqual(resolveOrder(undefined, undefined), { word: undefined, meaning: undefined });
    });
});
