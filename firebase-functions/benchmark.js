const { performance } = require('perf_hooks');

// Mock Firestore batch
class MockBatch {
  constructor() {
    this.operations = 0;
  }
  delete(ref) {
    this.operations++;
    if (this.operations > 500) {
      throw new Error("Firestore limit exceeded: max 500 operations per batch.");
    }
  }
  async commit() {
    return new Promise(resolve => setTimeout(resolve, 10)); // simulate network delay
  }
}

const mockDb = {
  batch: () => new MockBatch()
};

const NUM_TOKENS = 5000;
const mockResponse = {
  results: Array(NUM_TOKENS).fill({
    error: { code: 'messaging/invalid-registration-token' }
  })
};

const mockSnapshot = {
  docs: Array(NUM_TOKENS).fill({ ref: 'mock_ref' })
};

async function originalImplementation() {
  const batch = mockDb.batch();
  let hasDeletes = false;

  try {
    mockResponse.results.forEach((result, index) => {
      const error = result.error;
      if (error) {
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
          batch.delete(mockSnapshot.docs[index].ref);
          hasDeletes = true;
        }
      }
    });

    if (hasDeletes) {
      await batch.commit();
    }
  } catch (e) {
    return e.message;
  }
  return "Success";
}

// Function exactly matching the new implementation in index.js
async function deleteInBatches(refsToDelete) {
  if (refsToDelete.length === 0) return null;

  const db = mockDb; // Using mockDb
  const batches = [];
  let currentBatch = db.batch();
  let deleteCount = 0;

  for (const ref of refsToDelete) {
    currentBatch.delete(ref);
    deleteCount++;

    if (deleteCount === 500) {
      batches.push(currentBatch.commit());
      currentBatch = db.batch();
      deleteCount = 0;
    }
  }

  if (deleteCount > 0) {
    batches.push(currentBatch.commit());
  }

  return Promise.all(batches);
}

async function optimizedImplementation() {
  const invalidTokenRefs = [];
  mockResponse.results.forEach((result, index) => {
    const error = result.error;
    if (error) {
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        invalidTokenRefs.push(mockSnapshot.docs[index].ref);
      }
    }
  });

  if (invalidTokenRefs.length > 0) {
    await deleteInBatches(invalidTokenRefs);
  }

  return "Success";
}

async function run() {
  console.log("Running Original Implementation...");
  const startOriginal = performance.now();
  const resOriginal = await originalImplementation();
  const endOriginal = performance.now();
  console.log(`Result: ${resOriginal}, Time: ${(endOriginal - startOriginal).toFixed(2)} ms`);

  console.log("Running Optimized Implementation...");
  const startOptimized = performance.now();
  const resOptimized = await optimizedImplementation();
  const endOptimized = performance.now();
  console.log(`Result: ${resOptimized}, Time: ${(endOptimized - startOptimized).toFixed(2)} ms`);
}

run();
