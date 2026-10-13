const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// Load HTML content
const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

test('isStandaloneApp', async (t) => {

    // Helper to create JSDOM environment with specific mocks
    const setupEnv = (matchMediaMatches, isStandalone) => {
        const dom = new JSDOM(htmlContent, {
            url: "http://localhost/",
            runScripts: "dangerously",
            beforeParse(window) {
                // Mock firebase
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

                // Mock matchMedia
                window.matchMedia = (query) => {
                    return {
                        matches: query === '(display-mode: standalone)' ? matchMediaMatches : false,
                        addListener: () => {},
                        removeListener: () => {}
                    };
                };

                // Mock navigator.standalone
                Object.defineProperty(window.navigator, 'standalone', {
                    value: isStandalone,
                    configurable: true
                });

                // Mock history.replaceState
                const originalReplaceState = window.history.replaceState;
                window.history.replaceState = function(...args) {
                    try {
                       return originalReplaceState.apply(this, args);
                    } catch (e) {
                    }
                };
            }
        });
        return dom.window;
    };

    await t.test('should return true if matchMedia matches (display-mode: standalone)', () => {
        const window = setupEnv(true, false);
        assert.strictEqual(window.isStandaloneApp(), true);
    });

    await t.test('should return true if window.navigator.standalone is true', () => {
        const window = setupEnv(false, true);
        assert.strictEqual(window.isStandaloneApp(), true);
    });

    await t.test('should return true if both are true', () => {
        const window = setupEnv(true, true);
        assert.strictEqual(window.isStandaloneApp(), true);
    });

    await t.test('should return false if neither is true', () => {
        const window = setupEnv(false, false);
        assert.strictEqual(window.isStandaloneApp(), false);
    });

    await t.test('should return false if navigator.standalone is undefined', () => {
        const window = setupEnv(false, undefined);
        assert.strictEqual(window.isStandaloneApp(), false);
    });
});
