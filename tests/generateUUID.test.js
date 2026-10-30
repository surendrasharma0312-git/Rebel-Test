const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();

// Access the global function from the JSDOM window
const generateUUID = window.generateUUID;

test('generateUUID', async (t) => {
    await t.test('should return a string of length 36', () => {
        const uuid = generateUUID();
        assert.strictEqual(typeof uuid, 'string');
        assert.strictEqual(uuid.length, 36);
    });

    await t.test('should match the UUID v4 format', () => {
        const uuid = generateUUID();
        // UUID v4 regex format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        // Where x is any hexadecimal digit and y is one of 8, 9, a, or b.
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        assert.ok(uuidRegex.test(uuid), `UUID ${uuid} does not match format`);
    });

    await t.test('should generate unique UUIDs', () => {
        const uuid1 = generateUUID();
        const uuid2 = generateUUID();
        const uuid3 = generateUUID();

        assert.notStrictEqual(uuid1, uuid2);
        assert.notStrictEqual(uuid1, uuid3);
        assert.notStrictEqual(uuid2, uuid3);
    });

    await t.test('should generate a large number of unique UUIDs without collisions', () => {
        const count = 1000;
        const uuids = new Set();

        for (let i = 0; i < count; i++) {
            uuids.add(generateUUID());
        }

        assert.strictEqual(uuids.size, count, `Expected ${count} unique UUIDs, but found ${uuids.size}`);
    });
});
