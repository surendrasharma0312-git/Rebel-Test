const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();
const generateUUID = window.generateUUID;

test('generateUUID', async (t) => {
    await t.test('should return a string of length 36', () => {
        const uuid = generateUUID();
        assert.strictEqual(typeof uuid, 'string');
        assert.strictEqual(uuid.length, 36);
    });

    await t.test('should match UUID v4 string format', () => {
        const uuid = generateUUID();
        // UUID v4 regex format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        // x is [0-9a-f], y is [89ab]
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        assert.ok(uuidRegex.test(uuid), `UUID ${uuid} does not match expected format.`);
    });

    await t.test('should generate unique UUIDs without collisions', () => {
        const numIterations = 1000;
        const uuids = new Set();

        for (let i = 0; i < numIterations; i++) {
            const uuid = generateUUID();
            assert.ok(!uuids.has(uuid), `Collision detected for UUID: ${uuid} on iteration ${i}`);
            uuids.add(uuid);
        }

        assert.strictEqual(uuids.size, numIterations);
    });
});
