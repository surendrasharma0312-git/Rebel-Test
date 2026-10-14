const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { setupJSDOM } = require('./setupTest');


test('isStandaloneApp', async (t) => {

    // Helper to create JSDOM environment with specific mocks
    const setupEnv = (matchMediaMatches, isStandalone) => {
        const { window } = setupJSDOM();
        window.matchMedia = (query) => ({
            matches: query === '(display-mode: standalone)' ? matchMediaMatches : false,
            addListener: () => {},
            removeListener: () => {}
        });
        Object.defineProperty(window.navigator, 'standalone', {
            value: isStandalone,
            configurable: true
        });
        return window;
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
