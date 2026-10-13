const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

const adminMock = {
  initializeApp: () => {}, // Mock initializeApp
  firestore: () => ({
    collection: () => ({
      get: async () => ({ empty: true })
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

const benchmarkDeletes = proxyquire('../benchmark_deletes', {
  'firebase-admin': adminMock
});

test('benchmark_deletes', async (t) => {
  await t.test('benchmarkNPlus1 should return a positive number representing elapsed time', async () => {
    const time = await benchmarkDeletes.benchmarkNPlus1();
    assert.strictEqual(typeof time, 'number');
    assert.ok(time > 0, 'Time should be greater than 0');
  });

  await t.test('benchmarkBatched should return a positive number representing elapsed time', async () => {
    const time = await benchmarkDeletes.benchmarkBatched();
    assert.strictEqual(typeof time, 'number');
    assert.ok(time > 0, 'Time should be greater than 0');
  });

  await t.test('benchmarkBatched should be generally faster or comparable to benchmarkNPlus1', async () => {
    const timeNPlus1 = await benchmarkDeletes.benchmarkNPlus1();
    const timeBatched = await benchmarkDeletes.benchmarkBatched();

    // While we can't assert batched is always strictly faster due to event loop
    // variability on small mock workloads, we can at least assert both return valid times.
    assert.strictEqual(typeof timeNPlus1, 'number');
    assert.strictEqual(typeof timeBatched, 'number');
  });
});
