const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { setupJSDOM } = require('./setupTest');


const { window } = setupJSDOM();

// Access the global functions from the JSDOM window
const isIOSDevice = window.isIOSDevice;

function setUserAgent(ua) {
    Object.defineProperty(window.navigator, 'userAgent', {
        value: ua,
        configurable: true
    });
}

test('isIOSDevice', async (t) => {
    // Reset MSStream before each test
    t.beforeEach(() => {
        window.MSStream = undefined;
    });

    await t.test('should return true for iPhone user agent', () => {
        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1');
        assert.strictEqual(isIOSDevice(), true);
    });

    await t.test('should return true for iPad user agent', () => {
        setUserAgent('Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1');
        assert.strictEqual(isIOSDevice(), true);
    });

    await t.test('should return true for iPod user agent', () => {
        setUserAgent('Mozilla/5.0 (iPod; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
        assert.strictEqual(isIOSDevice(), true);
    });

    await t.test('should return false for Android user agent', () => {
        setUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36');
        assert.strictEqual(isIOSDevice(), false);
    });

    await t.test('should return false for Windows user agent', () => {
        setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        assert.strictEqual(isIOSDevice(), false);
    });

    await t.test('should return false for macOS user agent', () => {
        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36');
        assert.strictEqual(isIOSDevice(), false);
    });

    await t.test('should return false if MSStream is defined (Windows Phone mimicking iOS)', () => {
        window.MSStream = true;
        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1');
        assert.strictEqual(isIOSDevice(), false);
    });
});
