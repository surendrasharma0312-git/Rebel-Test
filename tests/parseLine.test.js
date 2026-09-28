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
const parseLine = (line) => {
    const res = window.parseLine(line);
    if (!res) return null;
    return { word: res.word, meaning: res.meaning };
};

test('parseLine', async (t) => {
    await t.test('should parse lines with various separators', () => {
        assert.deepStrictEqual(parseLine("Apple - सेब"), { word: "Apple", meaning: "सेब" });
        assert.deepStrictEqual(parseLine("Apple — सेब"), { word: "Apple", meaning: "सेब" }); // em-dash
        assert.deepStrictEqual(parseLine("Apple – सेब"), { word: "Apple", meaning: "सेब" }); // en-dash
        assert.deepStrictEqual(parseLine("Apple: सेब"), { word: "Apple", meaning: "सेब" }); // colon
        assert.deepStrictEqual(parseLine("Apple :- सेब"), { word: "Apple", meaning: "सेब" }); // colon dash
        assert.deepStrictEqual(parseLine("Apple\tसेब"), { word: "Apple", meaning: "सेब" }); // tab
        assert.deepStrictEqual(parseLine("Apple = सेब"), { word: "Apple", meaning: "सेब" }); // equals
        assert.deepStrictEqual(parseLine("Apple -> सेब"), { word: "Apple", meaning: "सेब" }); // arrow
        assert.deepStrictEqual(parseLine("Apple → सेब"), { word: "Apple", meaning: "सेब" }); // arrow char
        assert.deepStrictEqual(parseLine("Apple | सेब"), { word: "Apple", meaning: "सेब" }); // pipe
        assert.deepStrictEqual(parseLine("Apple , सेब"), { word: "Apple", meaning: "सेब" }); // comma (only if meaning has Hindi)
    });

    await t.test('should fall back to chunk formats', () => {
        // Space only fallback
        assert.deepStrictEqual(parseLine("Apple       सेब"), { word: "Apple", meaning: "सेब" });
        // Parenthetical fallback
        assert.deepStrictEqual(parseLine("Apple (सेब)"), { word: "Apple", meaning: "सेब" });
    });

    await t.test('should handle reversed layouts', () => {
        assert.deepStrictEqual(parseLine("आक्रमण करना Attack"), { word: "Attack", meaning: "आक्रमण करना" });
        assert.deepStrictEqual(parseLine("सेब - Apple"), { word: "Apple", meaning: "सेब" });
    });

    await t.test('should filter out synonyms and word-forms', () => {
        assert.deepStrictEqual(parseLine("Attack, Attacked, Attacked - आक्रमण करना"), { word: "Attack", meaning: "आक्रमण करना" });
        assert.deepStrictEqual(parseLine("Nab / Arrest - पकड़ लेना"), { word: "Nab", meaning: "पकड़ लेना" });
    });

    await t.test('should return null for noise lines and headers', () => {
        assert.strictEqual(parseLine("Page 1"), null);
        assert.strictEqual(parseLine("Unit 4"), null);
        assert.strictEqual(parseLine("Vocabulary List"), null);
        assert.strictEqual(parseLine("English   हिंदी अर्थ"), null);
    });

    await t.test('should return null if english word has non-english characters', () => {
        // reversed layout works, but not when the resolved english word is invalid
        assert.strictEqual(parseLine("12345 - सेब"), null);
        assert.strictEqual(parseLine("Apple123 - सेब"), null);
    });

    await t.test('should return null if meaning is empty', () => {
        assert.strictEqual(parseLine("Apple - "), null);
    });
});
