const { performance } = require('perf_hooks');

// Mock data
const NUM_TOKENS = 500;
const results = Array.from({ length: NUM_TOKENS }, (_, i) => ({
  error: { code: 'messaging/invalid-registration-token' }
}));

const docs = Array.from({ length: NUM_TOKENS }, (_, i) => ({
  ref: {
    delete: () => new Promise(resolve => setTimeout(resolve, 10)) // 10ms latency per delete
  }
}));

const batchMock = {
  delete: () => {},
  commit: () => new Promise(resolve => setTimeout(resolve, 10)) // 10ms latency for batch commit
};

async function benchmarkNPlus1() {
  const start = performance.now();
  const tokensToRemove = [];
  results.forEach((result, index) => {
    const error = result.error;
    if (error) {
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        tokensToRemove.push(docs[index].ref.delete());
      }
    }
  });
  await Promise.all(tokensToRemove);
  const end = performance.now();
  return end - start;
}

async function benchmarkBatched() {
  const start = performance.now();
  const batch = batchMock;
  let hasDeletes = false;
  results.forEach((result, index) => {
    const error = result.error;
    if (error) {
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        batch.delete(docs[index].ref);
        hasDeletes = true;
      }
    }
  });
  if (hasDeletes) {
    await batch.commit();
  }
  const end = performance.now();
  return end - start;
}

async function runBenchmarks() {
  console.log("Running N+1 benchmark...");
  const timeNPlus1 = await benchmarkNPlus1();
  console.log(`N+1 took: ${timeNPlus1.toFixed(2)}ms`);

  console.log("Running batched benchmark...");
  const timeBatched = await benchmarkBatched();
  console.log(`Batched took: ${timeBatched.toFixed(2)}ms`);

  const improvement = timeNPlus1 / timeBatched;
  console.log(`Improvement: ${improvement.toFixed(2)}x faster`);
}

runBenchmarks();
