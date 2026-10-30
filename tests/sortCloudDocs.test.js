const test = require('node:test');
const assert = require('node:assert');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();
const sortCloudDocs = window.sortCloudDocs;

function createDoc(dataObj) {
    return {
        data: () => dataObj
    };
}

test('sortCloudDocs', async (t) => {
    await t.test('should not mutate original array', () => {
        const original = [
            createDoc({ order: 2 }),
            createDoc({ order: 1 })
        ];
        const originalCopy = [...original];

        const sorted = sortCloudDocs(original);

        assert.notStrictEqual(sorted, original);
        assert.deepStrictEqual(original, originalCopy, 'Original array should not be modified');
    });

    await t.test('should sort by order ascending', () => {
        const doc1 = createDoc({ order: 3 });
        const doc2 = createDoc({ order: 1 });
        const doc3 = createDoc({ order: 2 });

        const docs = [doc1, doc2, doc3];
        const sorted = sortCloudDocs(docs);

        assert.strictEqual(sorted[0], doc2);
        assert.strictEqual(sorted[1], doc3);
        assert.strictEqual(sorted[2], doc1);
    });

    await t.test('should fall back to createdAt.toMillis() if order is missing', () => {
        const doc1 = createDoc({ createdAt: { toMillis: () => 3000 } });
        const doc2 = createDoc({ createdAt: { toMillis: () => 1000 } });
        const doc3 = createDoc({ createdAt: { toMillis: () => 2000 } });

        const docs = [doc1, doc2, doc3];
        const sorted = sortCloudDocs(docs);

        assert.strictEqual(sorted[0], doc2);
        assert.strictEqual(sorted[1], doc3);
        assert.strictEqual(sorted[2], doc1);
    });

    await t.test('should handle missing order and missing createdAt', () => {
        const doc1 = createDoc({});
        const doc2 = createDoc({});

        const docs = [doc1, doc2];
        const sorted = sortCloudDocs(docs);

        assert.strictEqual(sorted.length, 2);
    });

    await t.test('should correctly sort mixed docs (order vs createdAt vs missing)', () => {
        const docWithOrder1 = createDoc({ order: 5 }); // oa = 5
        const docWithOrder2 = createDoc({ order: 10 }); // oa = 10
        const docWithCreatedAt1 = createDoc({ createdAt: { toMillis: () => 8 } }); // oa = 8
        const docWithCreatedAt2 = createDoc({ createdAt: { toMillis: () => 12 } }); // oa = 12
        const docMissing = createDoc({}); // oa = 0
        const docOrderZero = createDoc({ order: 0 }); // oa = 0
        const docOrderNegative = createDoc({ order: -5 }); // oa = -5

        const docs = [
            docWithOrder1,
            docWithCreatedAt2,
            docMissing,
            docOrderZero,
            docWithOrder2,
            docOrderNegative,
            docWithCreatedAt1
        ];

        const sorted = sortCloudDocs(docs);

        assert.strictEqual(sorted[0], docOrderNegative);
        assert.ok(sorted[1] === docMissing || sorted[1] === docOrderZero);
        assert.ok(sorted[2] === docMissing || sorted[2] === docOrderZero);
        assert.strictEqual(sorted[3], docWithOrder1);
        assert.strictEqual(sorted[4], docWithCreatedAt1);
        assert.strictEqual(sorted[5], docWithOrder2);
        assert.strictEqual(sorted[6], docWithCreatedAt2);
    });

    await t.test('should handle order equal to 0 correctly instead of falling back to createdAt', () => {
        const doc1 = createDoc({ order: 0, createdAt: { toMillis: () => 9999 } });
        const doc2 = createDoc({ order: 1, createdAt: { toMillis: () => 1 } });

        const docs = [doc1, doc2];
        const sorted = sortCloudDocs(docs);

        assert.strictEqual(sorted[0], doc1);
        assert.strictEqual(sorted[1], doc2);
    });
});
