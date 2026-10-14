const test = require('node:test');
const assert = require('node:assert');

// We need JSDOM to properly load the index.html module since it uses DOM objects
const { setupJSDOM } = require('./setupTest');
const { window } = setupJSDOM();

// Access the global function from the JSDOM window
const generateUUID = window.generateUUID;

test('generateUUID', async (t) => {

    await t.test('should return a string of exactly 36 characters', () => {
        const uuid = generateUUID();
        assert.strictEqual(typeof uuid, 'string');
        assert.strictEqual(uuid.length, 36);
    });

    await t.test('should match the UUID v4 format', () => {
        const uuid = generateUUID();
        // Standard v4 UUID regex
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        assert.ok(uuidRegex.test(uuid), `UUID ${uuid} does not match v4 format`);
    });

    await t.test('should generate unique UUIDs (no collisions over 10000 iterations)', () => {
        const uuids = new Set();
        const iterations = 10000;

        for (let i = 0; i < iterations; i++) {
            const uuid = generateUUID();
            uuids.add(uuid);
        }

        assert.strictEqual(uuids.size, iterations, 'Collision detected: Some UUIDs were duplicated');
    });
});
