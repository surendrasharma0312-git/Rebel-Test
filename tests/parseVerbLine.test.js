const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();

// Access the global functions from the JSDOM window
const parseVerbLine = (line) => {
    const res = window.parseVerbLine(line);
    if (!res) return null;
    return JSON.parse(JSON.stringify(res)); // Normalize objects to avoid JSDOM context mismatch
};

test('parseVerbLine', async (t) => {
    await t.test('should parse verb lines with dash separator', () => {
        assert.deepStrictEqual(parseVerbLine("go - went - gone - going - goes"), {
            v1: "go", v2: "went", v3: "gone", v4: "going", v5: "goes", hi: ""
        });
    });

    await t.test('should parse verb lines with dash and comma separator', () => {
        assert.deepStrictEqual(parseVerbLine("go - went, gone, going, goes"), {
            v1: "go", v2: "went", v3: "gone", v4: "going", v5: "goes", hi: ""
        });
    });

    await t.test('should parse verb lines with tab separator', () => {
        assert.deepStrictEqual(parseVerbLine("go\twent\tgone\tgoing\tgoes"), {
            v1: "go", v2: "went", v3: "gone", v4: "going", v5: "goes", hi: ""
        });
    });

    await t.test('should strip number prefixes', () => {
        assert.deepStrictEqual(parseVerbLine("1. go - went - gone - going - goes"), {
            v1: "go", v2: "went", v3: "gone", v4: "going", v5: "goes", hi: ""
        });
        assert.deepStrictEqual(parseVerbLine("2) go - went - gone - going - goes"), {
            v1: "go", v2: "went", v3: "gone", v4: "going", v5: "goes", hi: ""
        });
    });

    await t.test('should strip s.no prefixes', () => {
        assert.deepStrictEqual(parseVerbLine("s.no 1 go - went - gone - going - goes"), {
            v1: "go", v2: "went", v3: "gone", v4: "going", v5: "goes", hi: ""
        });
        assert.deepStrictEqual(parseVerbLine("sno 2 go - went - gone - going - goes"), {
            v1: "go", v2: "went", v3: "gone", v4: "going", v5: "goes", hi: ""
        });
    });

    await t.test('should parse hindi part', () => {
        assert.deepStrictEqual(parseVerbLine("go - went - gone - going - goes - Hindi Meaning"), {
            v1: "go", v2: "went", v3: "gone", v4: "going", v5: "goes", hi: "Hindi Meaning"
        });
    });
});
