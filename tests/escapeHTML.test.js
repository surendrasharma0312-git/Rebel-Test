const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();

// Access the global functions from the JSDOM window
const escapeHTML = window.escapeHTML;

test('escapeHTML', async (t) => {
    await t.test('should escape & to &amp;', () => {
        assert.strictEqual(escapeHTML("bread & butter"), "bread &amp; butter");
    });

    await t.test('should escape < to &lt;', () => {
        assert.strictEqual(escapeHTML("5 < 10"), "5 &lt; 10");
    });

    await t.test('should escape > to &gt;', () => {
        assert.strictEqual(escapeHTML("10 > 5"), "10 &gt; 5");
    });

    await t.test('should escape double quote (") to &quot;', () => {
        assert.strictEqual(escapeHTML('He said, "Hello"'), 'He said, &quot;Hello&quot;');
    });

    await t.test('should escape single quote (\') to &#39;', () => {
        assert.strictEqual(escapeHTML("It's a beautiful day"), "It&#39;s a beautiful day");
    });

    await t.test('should handle a combination of characters', () => {
        assert.strictEqual(escapeHTML('<script>alert("XSS & fun")</script>'), '&lt;script&gt;alert(&quot;XSS &amp; fun&quot;)&lt;/script&gt;');
    });

    await t.test('should return the same string if no special characters exist', () => {
        assert.strictEqual(escapeHTML('Hello World! 123'), 'Hello World! 123');
        assert.strictEqual(escapeHTML(''), '');
    });

    await t.test('should convert numbers to string and escape if needed', () => {
        assert.strictEqual(escapeHTML(123), '123');
        assert.strictEqual(escapeHTML(0), '0');
    });

    await t.test('should convert booleans to string', () => {
        assert.strictEqual(escapeHTML(true), 'true');
        assert.strictEqual(escapeHTML(false), 'false');
    });

    await t.test('should convert null and undefined to string', () => {
        assert.strictEqual(escapeHTML(null), 'null');
        assert.strictEqual(escapeHTML(undefined), 'undefined');
    });

    await t.test('should convert objects to string', () => {
        assert.strictEqual(escapeHTML({}), '[object Object]');
    });
});
