const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();
const resolveOrder = (a, b) => {
    // Because Objects cross contexts, we extract the primitive properties
    const res = window.resolveOrder(a, b);
    return { word: res.word, meaning: res.meaning };
};

test('resolveOrder', async (t) => {
    await t.test('should return {word: a, meaning: b} when a is English and b is Hindi', () => {
        assert.deepStrictEqual(resolveOrder("Apple", "सेब"), { word: "Apple", meaning: "सेब" });
    });

    await t.test('should return {word: b, meaning: a} when a is Hindi and b is English (reversed layout correction)', () => {
        assert.deepStrictEqual(resolveOrder("आक्रमण करना", "Attack"), { word: "Attack", meaning: "आक्रमण करना" });
    });

    await t.test('should default to {word: a, meaning: b} when both are English', () => {
        assert.deepStrictEqual(resolveOrder("Apple", "Fruit"), { word: "Apple", meaning: "Fruit" });
    });

    await t.test('should default to {word: a, meaning: b} when both are Hindi', () => {
        assert.deepStrictEqual(resolveOrder("सेब", "फल"), { word: "सेब", meaning: "फल" });
    });

    await t.test('should handle empty strings', () => {
        assert.deepStrictEqual(resolveOrder("", ""), { word: "", meaning: "" });
    });

    await t.test('should handle undefined inputs', () => {
        assert.deepStrictEqual(resolveOrder(undefined, undefined), { word: undefined, meaning: undefined });
    });
});
