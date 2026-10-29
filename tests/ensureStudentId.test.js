const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();
const ensureStudentId = window.ensureStudentId;
const localStorage = window.localStorage;

test('ensureStudentId', async (t) => {
    await t.test('generates and saves a UUID if one does not exist', () => {
        localStorage.clear();
        const id = ensureStudentId();
        assert.ok(id);
        assert.strictEqual(typeof id, 'string');
        assert.strictEqual(id.length, 36); // UUID length
        assert.strictEqual(localStorage.getItem('vocabTestApp_studentId'), id);
    });

    await t.test('returns existing UUID if one exists', () => {
        localStorage.clear();
        localStorage.setItem('vocabTestApp_studentId', 'test-uuid-123');
        const id = ensureStudentId();
        assert.strictEqual(id, 'test-uuid-123');
    });
});
