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
const isStandaloneApp = window.isStandaloneApp;

test('isStandaloneApp', async (t) => {
    // Save original matchMedia and navigator to restore after tests
    const originalMatchMedia = window.matchMedia;
    const originalNavigator = window.navigator;

    t.afterEach(() => {
        window.matchMedia = originalMatchMedia;
        // Since we cannot easily re-assign window.navigator, we modify its properties
        delete window.navigator.standalone;
    });

    await t.test('should return true when display-mode is standalone', () => {
        window.matchMedia = (query) => {
            if (query === '(display-mode: standalone)') {
                return { matches: true };
            }
            return { matches: false };
        };
        window.navigator.standalone = false;

        assert.strictEqual(isStandaloneApp(), true);
    });

    await t.test('should return true when navigator.standalone is true (iOS Safari)', () => {
        window.matchMedia = (query) => ({ matches: false });
        window.navigator.standalone = true;

        assert.strictEqual(isStandaloneApp(), true);
    });

    await t.test('should return true when both are true', () => {
        window.matchMedia = (query) => {
            if (query === '(display-mode: standalone)') {
                return { matches: true };
            }
            return { matches: false };
        };
        window.navigator.standalone = true;

        assert.strictEqual(isStandaloneApp(), true);
    });

    await t.test('should return false when neither is true', () => {
        window.matchMedia = (query) => ({ matches: false });
        window.navigator.standalone = false;

        assert.strictEqual(isStandaloneApp(), false);
    });

    await t.test('should return false when matchMedia is false and navigator.standalone is undefined', () => {
        window.matchMedia = (query) => ({ matches: false });
        delete window.navigator.standalone;

        assert.strictEqual(isStandaloneApp(), false);
    });
});
