const test = require('node:test');
const assert = require('node:assert');

// Mock firebase-admin before requiring the benchmark script
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
    if (id === 'firebase-admin') {
        return {
            initializeApp: () => {},
            firestore: () => ({
                collection: () => ({
                    get: async () => ({ empty: true, forEach: () => {} })
                }),
                batch: () => ({
                    delete: () => {},
                    commit: async () => {}
                })
            }),
            messaging: () => ({
                sendEachForMulticast: async () => ({ results: [] })
            })
        };
    }
    return originalRequire.apply(this, arguments);
};

const { benchmarkNPlus1, benchmarkBatched, runBenchmarks } = require('../firebase-functions/benchmark_deletes');

// Restore original require after we have our module
Module.prototype.require = originalRequire;

test('benchmark_deletes', async (t) => {
    await t.test('benchmarkNPlus1 should return a positive execution time', async () => {
        const time = await benchmarkNPlus1();
        assert.ok(typeof time === 'number', 'Execution time should be a number');
        assert.ok(time >= 0, 'Execution time should be positive');
    });

    await t.test('benchmarkBatched should return a positive execution time', async () => {
        const time = await benchmarkBatched();
        assert.ok(typeof time === 'number', 'Execution time should be a number');
        assert.ok(time >= 0, 'Execution time should be positive');
    });

    await t.test('runBenchmarks should execute without errors and output correctly', async () => {
        const originalConsoleLog = console.log;
        const logs = [];
        console.log = (message) => {
            logs.push(message);
        };

        try {
            await runBenchmarks();

            assert.strictEqual(logs.length, 5, 'Should output 5 lines of logs');
            assert.strictEqual(logs[0], 'Running N+1 benchmark...');
            assert.ok(logs[1].startsWith('N+1 took: '), 'Should log N+1 time');
            assert.strictEqual(logs[2], 'Running batched benchmark...');
            assert.ok(logs[3].startsWith('Batched took: '), 'Should log batched time');
            assert.ok(logs[4].startsWith('Improvement: '), 'Should log improvement ratio');
        } finally {
            console.log = originalConsoleLog;
        }
    });
});
