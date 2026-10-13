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
const escapeHTML = window.escapeHTML;

test('escapeHTML', async (t) => {
    await t.test('escapes & character', () => {
        assert.strictEqual(escapeHTML('Tom & Jerry'), 'Tom &amp; Jerry');
    });

    await t.test('escapes < character', () => {
        assert.strictEqual(escapeHTML('5 < 10'), '5 &lt; 10');
    });

    await t.test('escapes > character', () => {
        assert.strictEqual(escapeHTML('10 > 5'), '10 &gt; 5');
    });

    await t.test('escapes double quotes', () => {
        assert.strictEqual(escapeHTML('He said "Hello"'), 'He said &quot;Hello&quot;');
    });

    await t.test('escapes single quotes', () => {
        assert.strictEqual(escapeHTML("It's a beautiful day"), 'It&#39;s a beautiful day');
    });

    await t.test('escapes multiple different characters in same string', () => {
        assert.strictEqual(
            escapeHTML('<script>alert("XSS & \'attack\'")</script>'),
            '&lt;script&gt;alert(&quot;XSS &amp; &#39;attack&#39;&quot;)&lt;/script&gt;'
        );
    });

    await t.test('returns string unchanged if no special characters', () => {
        assert.strictEqual(escapeHTML('Hello World 123'), 'Hello World 123');
    });

    await t.test('converts non-string inputs to string before escaping', () => {
        assert.strictEqual(escapeHTML(123), '123');
        assert.strictEqual(escapeHTML(true), 'true');
        assert.strictEqual(escapeHTML(null), 'null');
        assert.strictEqual(escapeHTML(undefined), 'undefined');
    });

    await t.test('handles object conversion properly', () => {
        const obj = { toString: () => '<obj>' };
        assert.strictEqual(escapeHTML(obj), '&lt;obj&gt;');
    });
});
