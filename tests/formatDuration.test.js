const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { setupJSDOM } = require('./setupTest');


const { window } = setupJSDOM();

// Access the global functions from the JSDOM window
const formatDuration = window.formatDuration;

test('formatDuration', async (t) => {
    await t.test('should handle durations under a minute', () => {
        assert.strictEqual(formatDuration(0), "0s");
        assert.strictEqual(formatDuration(45), "45s");
        assert.strictEqual(formatDuration(59), "59s");
    });

    await t.test('should handle exact minutes', () => {
        assert.strictEqual(formatDuration(60), "1m 0s");
        assert.strictEqual(formatDuration(120), "2m 0s");
        assert.strictEqual(formatDuration(600), "10m 0s");
    });

    await t.test('should handle mixed minutes and seconds', () => {
        assert.strictEqual(formatDuration(65), "1m 5s");
        assert.strictEqual(formatDuration(125), "2m 5s");
        assert.strictEqual(formatDuration(365), "6m 5s");
        assert.strictEqual(formatDuration(90), "1m 30s");
    });

    await t.test('should handle large durations (hours displayed in minutes)', () => {
        assert.strictEqual(formatDuration(3600), "60m 0s");
        assert.strictEqual(formatDuration(3665), "61m 5s");
    });
});
