const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('Service Worker Tests', async (t) => {
  // Mock ServiceWorkerGlobalScope
  const listeners = {};
  const mockCaches = {
    open: async (name) => {
      mockCaches.opened[name] = mockCaches.opened[name] || new Set();
      return {
        add: async (req) => mockCaches.opened[name].add(req),
        put: async (req, res) => mockCaches.opened[name].add(req)
      };
    },
    keys: async () => Object.keys(mockCaches.opened),
    delete: async (name) => { delete mockCaches.opened[name]; return true; },
    match: async (req) => {
      for (const cache of Object.values(mockCaches.opened)) {
        if (cache.has(req)) return { type: 'basic', status: 200 };
      }
      return undefined;
    },
    opened: {}
  };

  const mockClients = {
    claim: async () => {},
    matchAll: async () => [],
    openWindow: async (url) => { mockClients.openedWindow = url; }
  };

  const mockRegistration = {
    showNotification: async (title, options) => {
      mockRegistration.shownNotifications.push({ title, options });
    },
    shownNotifications: []
  };

  const mockFirebase = {
    initializeApp: () => {},
    messaging: () => ({
      onBackgroundMessage: (cb) => { mockFirebase.bgMessageCb = cb; }
    })
  };

  const mockSelf = {
    addEventListener: (event, cb) => { listeners[event] = cb; },
    skipWaiting: async () => { mockSelf.skippedWaiting = true; },
    registration: mockRegistration,
    location: { origin: 'http://localhost:3000' },
    clients: mockClients
  };

  const context = {
    self: mockSelf,
    caches: mockCaches,
    clients: mockClients, // Some things access globally `clients`
    firebase: mockFirebase,
    importScripts: () => {},
    console: { log: () => {}, error: () => {}, warn: () => {} },
    URL: URL,
    Promise: Promise,
    Response: { error: () => ({ type: 'error' }) },
    fetch: async (req) => {
      if (req.url === 'http://localhost:3000/fail') throw new Error('Network error');
      return { clone: () => ({}), status: 200, type: 'basic' };
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };

  vm.createContext(context);

  const swCode = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
  vm.runInContext(swCode, context);

  await t.test('Install event caches APP_SHELL', async () => {
    mockCaches.opened = {};
    let waitPromise = Promise.resolve();
    const event = { waitUntil: (p) => { waitPromise = p; } };

    await listeners['install'](event);
    await waitPromise;

    assert.ok(mockSelf.skippedWaiting);
    assert.ok(mockCaches.opened['rebel-test-v5']);
    assert.ok(mockCaches.opened['rebel-test-v5'].has('./index.html'));
  });

  await t.test('Activate event deletes old caches', async () => {
    mockCaches.opened = { 'old-cache': new Set(), 'rebel-test-v5': new Set() };
    let waitPromise = Promise.resolve();
    const event = { waitUntil: (p) => { waitPromise = p; } };

    await listeners['activate'](event);
    await waitPromise;

    assert.strictEqual(Object.keys(mockCaches.opened).length, 1);
    assert.ok(mockCaches.opened['rebel-test-v5']);
  });

  await t.test('Fetch event skips non-GET requests', async () => {
    let responded = false;
    const event = {
      request: { method: 'POST', url: 'http://localhost:3000/api' },
      respondWith: () => { responded = true; }
    };

    await listeners['fetch'](event);
    assert.strictEqual(responded, false);
  });

  await t.test('Fetch event skips Firebase domains', async () => {
    let responded = false;
    const event = {
      request: { method: 'GET', url: 'https://firestore.googleapis.com/v1' },
      respondWith: () => { responded = true; }
    };

    await listeners['fetch'](event);
    assert.strictEqual(responded, false);
  });

  await t.test('Notification click opens window with testId', async () => {
    mockClients.openedWindow = null;
    let waitPromise = Promise.resolve();
    const event = {
      notification: { close: () => {}, data: { testId: '12345' } },
      waitUntil: (p) => { waitPromise = p; }
    };

    await listeners['notificationclick'](event);
    await waitPromise;

    assert.strictEqual(mockClients.openedWindow, 'http://localhost:3000/?test=12345');
  });

  await t.test('Background message shows notification', async () => {
    mockRegistration.shownNotifications = [];
    mockFirebase.bgMessageCb({
      data: { title: 'Test Title', body: 'Test Body', testId: '67890' }
    });

    assert.strictEqual(mockRegistration.shownNotifications.length, 1);
    assert.strictEqual(mockRegistration.shownNotifications[0].title, 'Test Title');
    assert.strictEqual(mockRegistration.shownNotifications[0].options.body, 'Test Body');
  });
});
