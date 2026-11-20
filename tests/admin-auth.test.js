'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setupJSDOM } = require('./setupTest');

test('admin session restore refreshes claims and drops a revoked admin claim', async () => {
  const { window } = setupJSDOM();
  try {
    const runtime = window.RebelStudentRuntime;
    await runtime.authSessionPromise;

    const refreshArguments = [];
    runtime.auth.currentUser = {
      getIdTokenResult: async forceRefresh => {
        refreshArguments.push(forceRefresh);
        return { claims: { admin: true } };
      }
    };

    await runtime.AdminAuth.restore();
    assert.equal(runtime.AdminAuth.isAdmin, true);
    assert.deepEqual(refreshArguments, [true]);

    // Simulate the server removing the custom claim after the first restore.
    runtime.auth.currentUser = {
      getIdTokenResult: async forceRefresh => {
        refreshArguments.push(forceRefresh);
        return { claims: { admin: false } };
      }
    };

    await runtime.AdminAuth.restore();
    assert.equal(runtime.AdminAuth.isAdmin, false);
    assert.deepEqual(refreshArguments, [true, true]);
  } finally {
    window.close();
  }
});
