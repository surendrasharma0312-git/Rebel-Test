const { performance } = require('perf_hooks');

// Mock batch
const createBatch = () => ({
  ops: 0,
  delete: function() { this.ops++; },
  commit: async function() {
    if (this.ops > 500) throw new Error("Firestore batch limit exceeded");
    return new Promise(r => setTimeout(r, 5));
  }
});

const tokensSnapshotDocs = Array.from({ length: 2500 }).map((_, i) => ({ id: i }));
const results = tokensSnapshotDocs.map((_, i) => ({
  error: { code: 'messaging/invalid-registration-token' }
}));

async function originalCleanup() {
  const batch = createBatch();
  let hasDeletes = false;

  results.forEach((result, index) => {
    const error = result.error;
    if (error) {
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        batch.delete(tokensSnapshotDocs[index]);
        hasDeletes = true;
      }
    }
  });

  if (hasDeletes) {
    return batch.commit();
  }
}

async function optimizedCleanup() {
  const batches = [];
  let currentBatch = createBatch();
  let currentBatchSize = 0;

  results.forEach((result, index) => {
    const error = result.error;
    if (error) {
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        currentBatch.delete(tokensSnapshotDocs[index]);
        currentBatchSize++;

        if (currentBatchSize === 500) {
          batches.push(currentBatch.commit());
          currentBatch = createBatch();
          currentBatchSize = 0;
        }
      }
    }
  });

  if (currentBatchSize > 0) {
    batches.push(currentBatch.commit());
  }

  return Promise.all(batches);
}

async function runBenchmark() {
  console.log("Running baseline (Original)");
  let originalFailed = false;
  try {
    const start = performance.now();
    await originalCleanup();
    console.log(`Original took: ${performance.now() - start} ms`);
  } catch (e) {
    console.log("Original failed with error:", e.message);
    originalFailed = true;
  }

  console.log("\nRunning Optimized");
  const startOpt = performance.now();
  await optimizedCleanup();
  const optTime = performance.now() - startOpt;
  console.log(`Optimized took: ${optTime} ms`);

  if (originalFailed) {
    console.log("\nResult: Optimized prevented crash (batch limit exceeded) and took " + optTime.toFixed(2) + " ms.");
  }
}

runBenchmark();
