const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

test('Benchmark deletes script execution', async (t) => {
    const originalConsoleLog = console.log;
    const logs = [];
    let resolveTest;
    const testCompleted = new Promise(resolve => resolveTest = resolve);

    console.log = (msg) => {
        logs.push(msg);
        if (typeof msg === 'string' && msg.includes('Improvement:')) {
            resolveTest(); // Resolve when the last log is printed
        }
    };

    let initializeAppCalled = false;

    // Mock firebase-admin completely
    // We only need to mock initializeApp for this file because it does not actually use the rest of admin methods.
    const mockAdmin = {
        initializeApp: () => {
            initializeAppCalled = true;
        },
        '@noCallThru': true
    };

    try {
        // Run the script directly but mock dependencies
        proxyquire('../../firebase-functions/benchmark_deletes.js', {
            'firebase-admin': mockAdmin
        });

        // Wait for the script to finish
        await testCompleted;

        assert.ok(initializeAppCalled, 'admin.initializeApp() should be called');
        assert.ok(logs.some(log => log.includes('Running N+1 benchmark...')));
        assert.ok(logs.some(log => log.includes('N+1 took:')));
        assert.ok(logs.some(log => log.includes('Running batched benchmark...')));
        assert.ok(logs.some(log => log.includes('Batched took:')));
        assert.ok(logs.some(log => log.includes('Improvement:')));

    } finally {
        console.log = originalConsoleLog;
    }
});
