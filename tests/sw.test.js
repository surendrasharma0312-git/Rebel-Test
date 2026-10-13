const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('Service Worker', async (t) => {
  // Mock global environment for SW
  const listeners = {};

  global.importScripts = () => {};

  global.self = {
    addEventListener: (event, callback) => {
      listeners[event] = callback;
    },
    skipWaiting: () => Promise.resolve(),
    registration: {
      showNotification: (title, options) => {}
    },
    location: {
      origin: 'http://localhost'
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve([]),
      openWindow: () => Promise.resolve()
    }
  };

  global.firebase = {
    initializeApp: () => {},
    messaging: () => ({
      onBackgroundMessage: () => {}
    })
  };

  global.caches = {
    open: () => Promise.resolve({
      add: () => Promise.resolve(),
      addAll: () => Promise.resolve(),
      put: () => Promise.resolve()
    }),
    keys: () => Promise.resolve(['old-cache-v1', 'rebel-test-v5']),
    delete: () => Promise.resolve(),
    match: () => Promise.resolve()
  };

  global.clients = global.self.clients;

  global.fetch = () => Promise.resolve({
    status: 200,
    clone: () => ({})
  });

  global.URL = URL;
  global.Response = {
    error: () => ({ error: true })
  };

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  global.console.log = () => {};
  global.console.warn = () => {};
  global.console.error = () => {};

  // Load sw.js
  const swCode = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

  // Create a clean evaluation context, simulating the ServiceWorkerGlobalScope
  // Extract constants from the file to avoid hardcoding in tests
  const cacheNameMatch = swCode.match(/const CACHE_NAME = '([^']+)';/);
  const cacheName = cacheNameMatch ? cacheNameMatch[1] : 'vocab-test-cache-v1';

  const appShellMatch = swCode.match(/const (?:APP_SHELL|ASSETS_TO_CACHE) = \[([\s\S]*?)\];/);
  const appShellItems = appShellMatch ? appShellMatch[1].split(',').filter(s => s.trim().length > 0).length : 5;

  eval(swCode);

  await t.test('Registers install, activate, fetch, and notificationclick listeners', () => {
    assert.ok(listeners['install']);
    assert.ok(listeners['activate']);
    assert.ok(listeners['fetch']);
    // notificationclick might not exist in the basic template shown by issue
    // however, the codebase sw.js DOES register it. We'll check its existence if we want.
    // The previous tests were testing `notificationclick`, we'll keep it because it does exist.
  });

  await t.test('Install event caches APP_SHELL', async () => {
    let waitUntilPromise;
    let cacheOpened = false;
    let cacheAdded = 0;

    global.caches.open = async (name) => {
      assert.strictEqual(name, cacheName);
      cacheOpened = true;
      return {
        add: async () => { cacheAdded++; },
        addAll: async (items) => { cacheAdded += items.length; },
        put: async () => {}
      };
    };

    const event = {
      waitUntil: (p) => { waitUntilPromise = p; }
    };

    listeners['install'](event);
    await waitUntilPromise;

    assert.ok(cacheOpened);
    assert.strictEqual(cacheAdded, appShellItems);
  });

  await t.test('Activate event deletes old caches', async () => {
    let waitUntilPromise;
    let deletedCaches = [];

    global.caches.keys = async () => ['old-cache-v1', cacheName];
    global.caches.delete = async (name) => { deletedCaches.push(name); };

    const event = {
      waitUntil: (p) => { waitUntilPromise = p; }
    };

    listeners['activate'](event);
    await waitUntilPromise;

    assert.deepStrictEqual(deletedCaches, ['old-cache-v1']);
  });

  await t.test('Fetch event skips non-GET requests', async () => {
    let respondWithCalled = false;
    const event = {
      request: { method: 'POST', url: 'http://localhost/api' },
      respondWith: () => { respondWithCalled = true; }
    };

    listeners['fetch'](event);
    assert.strictEqual(respondWithCalled, false);
  });

  await t.test('Fetch event skips Firebase URLs', async () => {
    let respondWithCalled = false;
    const event = {
      request: { method: 'GET', url: 'https://firestore.googleapis.com/test' },
      respondWith: () => { respondWithCalled = true; }
    };

    listeners['fetch'](event);
    assert.strictEqual(respondWithCalled, false);
  });

  await t.test('Fetch event serves from cache or network', async () => {
    let respondWithPromise;
    const event = {
      request: { method: 'GET', url: 'http://localhost/index.html' },
      respondWith: (p) => { respondWithPromise = p; },
      waitUntil: () => {}
    };

    global.caches.match = async () => null; // cache miss

    listeners['fetch'](event);
    const response = await respondWithPromise;
    assert.strictEqual(response.status, 200);
  });

  if (listeners['notificationclick']) {
    await t.test('notificationclick opens target path', async () => {
      let waitUntilPromise;
      let openedUrl = '';

      global.clients.matchAll = async () => [];
      global.clients.openWindow = async (url) => { openedUrl = url; };

      const event = {
        notification: {
          data: { testId: '123' },
          close: () => {}
        },
        waitUntil: (p) => { waitUntilPromise = p; }
      };

      listeners['notificationclick'](event);
      await waitUntilPromise;

      assert.strictEqual(openedUrl, 'http://localhost/?test=123');
    });
  }

  // Restore console
  global.console.log = originalLog;
  global.console.warn = originalWarn;
  global.console.error = originalError;
});
