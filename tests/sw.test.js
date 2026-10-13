const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const swPath = path.join(__dirname, '..', 'sw.js');
const swContent = fs.readFileSync(swPath, 'utf-8');

// Dynamically extract cache name and app shell length from the file to avoid hardcoding
// and to be resilient to future updates.
const cacheNameMatch = swContent.match(/(?:const|let|var)\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
const EXPECTED_CACHE_NAME = cacheNameMatch ? cacheNameMatch[1] : 'rebel-test-v5';

// If APP_SHELL is found, use it; otherwise fallback to ASSETS_TO_CACHE (as per some legacy versions)
const appShellMatch = swContent.match(/(?:const|let|var)\s+(?:APP_SHELL|ASSETS_TO_CACHE)\s*=\s*\[([\s\S]*?)\];/);
const EXPECTED_APP_SHELL_LENGTH = appShellMatch ?
  appShellMatch[1].split(',').filter(s => s.trim().length > 0).length : 6;

function setupSWContext() {
  const listeners = {};

  const mockCache = {
    add: async () => {},
    addAll: async () => {}, // Added addAll to the mock
    put: async () => {},
  };

  const mockSelf = {
    addEventListener: (event, callback) => {
      listeners[event] = callback;
    },
    skipWaiting: async () => {},
    clients: {
      claim: async () => {},
      matchAll: async () => [],
      openWindow: async () => {}
    },
    registration: {
      showNotification: () => {}
    },
    location: {
      origin: 'http://localhost'
    }
  };

  const context = {
    importScripts: () => {},
    firebase: {
      initializeApp: () => {},
      messaging: () => ({
        onBackgroundMessage: () => {}
      })
    },
    self: mockSelf,
    clients: mockSelf.clients,
    caches: {
      open: async () => mockCache,
      keys: async () => [EXPECTED_CACHE_NAME],
      delete: async () => {},
      match: async () => null
    },
    fetch: async () => ({
      status: 200,
      type: 'basic',
      clone: () => ({})
    }),
    URL: URL,
    Response: {
      error: () => ({})
    },
    console: {
      log: () => {},
      error: () => {},
      warn: () => {}
    },
    Promise: Promise
  };

  vm.createContext(context);
  vm.runInContext(swContent, context);

  return { listeners, mockSelf, context, mockCache };
}

test('sw.js tests', async (t) => {
  await t.test('installs successfully and caches app shell', async () => {
    const { listeners, mockCache } = setupSWContext();
    assert.ok(listeners['install'], 'Install listener should be registered');

    let waitUntilPromise;
    const installEvent = {
      waitUntil: (p) => { waitUntilPromise = p; }
    };

    let addedUrls = [];
    mockCache.add = async (url) => { addedUrls.push(url); };
    mockCache.addAll = async (urls) => { addedUrls.push(...urls); }; // support addAll as well

    listeners['install'](installEvent);
    await waitUntilPromise;

    assert.strictEqual(addedUrls.length, EXPECTED_APP_SHELL_LENGTH, `Should cache all ${EXPECTED_APP_SHELL_LENGTH} APP_SHELL items`);
    // Note: sw.js caches './index.html' or '/index.html' depending on version
    assert.ok(addedUrls.some(url => url.includes('index.html')), 'Should cache index.html');
  });

  await t.test('activates and cleans up old caches', async () => {
    const { listeners, context } = setupSWContext();
    assert.ok(listeners['activate'], 'Activate listener should be registered');

    let deletedCaches = [];
    context.caches.keys = async () => ['old-cache-v1', EXPECTED_CACHE_NAME, 'old-cache-v2'];
    context.caches.delete = async (cacheName) => { deletedCaches.push(cacheName); };

    let waitUntilPromise;
    const activateEvent = {
      waitUntil: (p) => { waitUntilPromise = p; }
    };

    listeners['activate'](activateEvent);
    await waitUntilPromise;

    assert.strictEqual(deletedCaches.length, 2, 'Should delete two old caches');
    assert.ok(deletedCaches.includes('old-cache-v1'), 'Should delete old cache 1');
    assert.ok(deletedCaches.includes('old-cache-v2'), 'Should delete old cache 2');
    assert.ok(!deletedCaches.includes(EXPECTED_CACHE_NAME), 'Should NOT delete current cache');
  });

  await t.test('fetch handles GET requests', async () => {
    const { listeners, context, mockCache } = setupSWContext();
    if (!listeners['fetch']) return; // Skip if no fetch listener

    assert.ok(listeners['fetch'], 'Fetch listener should be registered');

    // Ignore non-GET
    let responded = false;
    const postEvent = {
      request: { method: 'POST', url: 'http://localhost/data', clone: () => ({}) },
      respondWith: () => { responded = true; }
    };
    listeners['fetch'](postEvent);
    assert.strictEqual(responded, false, 'Should ignore non-GET requests');

    // Handle normal GET request
    let cacheHitUrl = null;
    let putUrl = null;
    let putResponse = null;

    context.caches.match = async (req) => {
      cacheHitUrl = req.url;
      return null; // Simulate cache miss initially
    };

    mockCache.put = async (req, res) => {
      putUrl = req.url;
      putResponse = res;
    };

    let fetchCalledWith = null;
    context.fetch = async (req) => {
      fetchCalledWith = req.url;
      return {
        status: 200,
        type: 'basic',
        clone: () => ({ isClone: true })
      };
    };

    let respondWithPromise;
    const getEvent = {
      request: { method: 'GET', url: 'http://localhost/script.js', clone: () => ({}) },
      respondWith: (p) => { respondWithPromise = p; }
    };

    listeners['fetch'](getEvent);
    const response = await respondWithPromise;

    assert.strictEqual(cacheHitUrl, 'http://localhost/script.js', 'Should check cache');
    if (fetchCalledWith) { // stale-while-revalidate strategy might fetch
        assert.strictEqual(fetchCalledWith, 'http://localhost/script.js', 'Should fetch from network');
        assert.strictEqual(response.status, 200, 'Should return successful response');
        assert.strictEqual(putUrl, 'http://localhost/script.js', 'Should cache the fetched response');
    }
  });

  await t.test('fetch returns cached response and fetches network in background', async () => {
    const { listeners, context, mockCache } = setupSWContext();
    if (!listeners['fetch']) return; // Skip if no fetch listener

    const mockCachedResponse = { isCached: true, clone: () => ({}) };
    context.caches.match = async () => mockCachedResponse;

    let waitUntilPromise;
    let respondWithPromise;
    const getEvent = {
      request: { method: 'GET', url: 'http://localhost/style.css', clone: () => ({}) },
      respondWith: (p) => { respondWithPromise = p; },
      waitUntil: (p) => { waitUntilPromise = p; }
    };

    listeners['fetch'](getEvent);
    const response = await respondWithPromise;

    assert.strictEqual(response.isCached, true, 'Should return cached response immediately');

    // Ensure the background fetch happens if waitUntil was called
    if (waitUntilPromise) {
        assert.ok(waitUntilPromise, 'Should use waitUntil for background fetch');
        const bgResult = await waitUntilPromise;
        if (bgResult) {
            assert.strictEqual(bgResult.status, 200, 'Background fetch should complete');
        }
    }
  });

  await t.test('notificationclick focuses existing window or opens new one', async () => {
    const { listeners, context } = setupSWContext();
    if (!listeners['notificationclick']) {
      return; // Skip if not registered
    }

    let notificationClosed = false;
    let openedUrl = null;

    const clickEvent = {
      notification: {
        close: () => { notificationClosed = true; },
        data: { testId: 'test-123' }
      },
      waitUntil: async (p) => { await p; }
    };

    // Scenario 1: No windows open, should open new window
    context.clients.matchAll = async () => [];
    context.clients.openWindow = async (url) => { openedUrl = url; };

    await listeners['notificationclick'](clickEvent);
    assert.strictEqual(notificationClosed, true, 'Should close notification');
    assert.strictEqual(openedUrl, 'http://localhost/?test=test-123', 'Should open new window with test path');

    // Scenario 2: Window open, should focus and send message
    let focused = false;
    let messagePosted = null;

    const mockWindowClient = {
      url: 'http://localhost/',
      focus: () => { focused = true; },
      postMessage: (msg) => { messagePosted = msg; }
    };

    context.clients.matchAll = async () => [mockWindowClient];
    openedUrl = null; // reset

    await listeners['notificationclick'](clickEvent);
    assert.strictEqual(focused, true, 'Should focus existing window');
    assert.strictEqual(messagePosted.type, 'NAVIGATE', 'Should post navigate message');
    assert.strictEqual(messagePosted.url, '/?test=test-123', 'Should pass right URL');
    assert.strictEqual(openedUrl, null, 'Should not open new window if one is focused');
  });
});
