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
const generateUUID = window.generateUUID;

test('generateUUID', async (t) => {
    await t.test('should return a string', () => {
        const uuid = generateUUID();
        assert.strictEqual(typeof uuid, 'string');
    });

    await t.test('should return a string of exactly 36 characters', () => {
        const uuid = generateUUID();
        assert.strictEqual(uuid.length, 36);
    });

    await t.test('should match standard UUID v4 format', () => {
        const uuid = generateUUID();
        // Standard UUID regex
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        assert.match(uuid, uuidRegex);
    });

    await t.test('should return unique values on consecutive calls', () => {
        const uuid1 = generateUUID();
        const uuid2 = generateUUID();
        const uuid3 = generateUUID();

        assert.notStrictEqual(uuid1, uuid2);
        assert.notStrictEqual(uuid1, uuid3);
        assert.notStrictEqual(uuid2, uuid3);

        // Also check with a larger sample size to be more certain
        const uuids = new Set();
        for (let i = 0; i < 100; i++) {
            uuids.add(generateUUID());
        }
        assert.strictEqual(uuids.size, 100);
    });
});
