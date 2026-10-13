const admin = require('firebase-admin');
const { performance } = require('perf_hooks');

// Initialize Firebase Admin (requires GOOGLE_APPLICATION_CREDENTIALS)
admin.initializeApp();

async function runBenchmark() {
    const db = admin.firestore();
    const start = performance.now();

    // Simulate some work
    const batch = db.batch();
    for (let i = 0; i < 100; i++) {
        const ref = db.collection('benchmark').doc(`doc_${i}`);
        batch.set(ref, { test: i });
    }
    await batch.commit();

    const end = performance.now();
    console.log(`Benchmark time: ${end - start}ms`);
}

if (require.main === module) {
    runBenchmark().catch(console.error);
}

module.exports = { runBenchmark };
