const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

describe('ensureStudentId and generateUUID', () => {
    let window;
    let generateUUID;
    let ensureStudentId;

    beforeEach(() => {
        const dom = setupJSDOM();
        window = dom.window;

        generateUUID = window.generateUUID;
        ensureStudentId = window.ensureStudentId;

        // Clear local storage before each test
        window.localStorage.clear();
    });

    afterEach(() => {
        window.localStorage.clear();
    });

    test('generateUUID should generate a valid v4 UUID format string', () => {
        const uuid = generateUUID();
        assert.strictEqual(typeof uuid, 'string');
        assert.strictEqual(uuid.length, 36);
        // Validating the format "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        assert.ok(uuidRegex.test(uuid), 'UUID format is valid');
    });

    test('ensureStudentId should return existing ID if present in localStorage', () => {
        const existingId = '123e4567-e89b-12d3-a456-426614174000';
        window.localStorage.setItem('vocabTestApp_studentId', existingId);

        const studentId = ensureStudentId();

        assert.strictEqual(studentId, existingId);
        assert.strictEqual(window.localStorage.getItem('vocabTestApp_studentId'), existingId);
    });

    test('ensureStudentId should generate, store, and return a new ID if not present in localStorage', () => {
        // Confirm it's empty initially
        assert.strictEqual(window.localStorage.getItem('vocabTestApp_studentId'), null);

        const studentId = ensureStudentId();

        // It should have generated an ID
        assert.ok(studentId);
        assert.strictEqual(typeof studentId, 'string');

        // It should have stored the ID
        const storedId = window.localStorage.getItem('vocabTestApp_studentId');
        assert.strictEqual(storedId, studentId);

        // The ID should be a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        assert.ok(uuidRegex.test(studentId), 'UUID format is valid');
    });
});
