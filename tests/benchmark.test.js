const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const path = require('path');

// Mock module for firebase-admin
const mockFirebaseAdmin = {
    initializeApp: () => {},
    firestore: () => ({
        batch: () => ({
            set: () => {},
            commit: async () => {
                // Simulate small delay
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }),
        collection: () => ({
            doc: () => ({})
        })
    })
};

// Override require to intercept firebase-admin
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
    if (request === 'firebase-admin') {
        return mockFirebaseAdmin;
    }
    return originalRequire.apply(this, arguments);
};

test('benchmark.js', async (t) => {
    let oldConsoleLog;
    let logOutput = '';

    t.beforeEach(() => {
        oldConsoleLog = console.log;
        console.log = (msg) => {
            logOutput += msg + '\n';
        };
    });

    t.afterEach(() => {
        console.log = oldConsoleLog;
        logOutput = '';
        // Clear require cache for benchmark to allow fresh re-require if needed
        const benchmarkPath = require.resolve('../benchmark.js');
        delete require.cache[benchmarkPath];
    });

    t.after(() => {
        // Restore original require
        Module.prototype.require = originalRequire;
    });

    await t.test('runBenchmark successfully executes and logs time', async () => {
        const { runBenchmark } = require('../benchmark.js');
        await runBenchmark();
        assert.match(logOutput, /Benchmark time: \d+(\.\d+)?ms/);
    });

    await t.test('can be required without throwing', () => {
        assert.doesNotThrow(() => {
            require('../benchmark.js');
        });
    });
});
