const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

const mockFirebaseAdmin = {
  initializeApp: () => {}
};

const benchmarkDeletes = proxyquire('../benchmark_deletes', {
  'firebase-admin': mockFirebaseAdmin
});

const {
  benchmarkNPlus1,
  benchmarkBatched,
  runBenchmarks,
  results,
  docs,
  batchMock
} = benchmarkDeletes;

test('benchmark_deletes', async (t) => {

  await t.test('benchmarkNPlus1 should process results and call delete on docs', async () => {
    let originalDeletes = [];
    let deleteCallCount = 0;

    for (const doc of docs) {
      originalDeletes.push(doc.ref.delete);
      doc.ref.delete = () => {
        deleteCallCount++;
        return Promise.resolve();
      };
    }

    const time = await benchmarkNPlus1();

    assert.strictEqual(deleteCallCount, 500, 'Should have called delete 500 times');
    assert.strictEqual(typeof time, 'number', 'Should return execution time');

    for (let i = 0; i < docs.length; i++) {
      docs[i].ref.delete = originalDeletes[i];
    }
  });

  await t.test('benchmarkBatched should call batch.delete and batch.commit', async () => {
    let batchDeleteCallCount = 0;
    let batchCommitCallCount = 0;

    const originalBatchDelete = batchMock.delete;
    const originalBatchCommit = batchMock.commit;

    batchMock.delete = () => {
      batchDeleteCallCount++;
    };

    batchMock.commit = () => {
      batchCommitCallCount++;
      return Promise.resolve();
    };

    const time = await benchmarkBatched();

    assert.strictEqual(batchDeleteCallCount, 500, 'Should have called batch.delete 500 times');
    assert.strictEqual(batchCommitCallCount, 1, 'Should have called batch.commit 1 time');
    assert.strictEqual(typeof time, 'number', 'Should return execution time');

    batchMock.delete = originalBatchDelete;
    batchMock.commit = originalBatchCommit;
  });

  await t.test('runBenchmarks should run benchmarks and log results', async () => {
    const originalConsoleLog = console.log;
    const logs = [];
    console.log = (msg) => {
      logs.push(msg);
    };

    await runBenchmarks();

    console.log = originalConsoleLog;

    assert.ok(logs.some(log => log.includes('Running N+1 benchmark...')), 'Should log N+1 start');
    assert.ok(logs.some(log => log.includes('Running batched benchmark...')), 'Should log batched start');
    assert.ok(logs.some(log => log.includes('Improvement:')), 'Should log improvement');
  });

});
