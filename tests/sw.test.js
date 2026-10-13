const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('Service Worker Tests', async (t) => {

    function loadSW() {
        const listeners = {};
        const mockedCaches = {};
        const state = { skipWaitingCalled: false, clientsClaimCalled: false };
        let notificationsShown = [];

        const context = {
            importScripts: () => {},
            firebase: {
                initializeApp: () => {},
                messaging: () => ({
                    onBackgroundMessage: (cb) => { listeners.onBackgroundMessage = cb; }
                })
            },
            self: {
                addEventListener: (event, cb) => { listeners[event] = cb; },
                skipWaiting: () => { state.skipWaitingCalled = true; },
                clients: {
                    claim: () => { state.clientsClaimCalled = true; return Promise.resolve(); },
                    matchAll: () => Promise.resolve([]),
                    openWindow: () => Promise.resolve()
                },
                registration: {
                    showNotification: (title, options) => {
                        notificationsShown.push({title, options});
                        return Promise.resolve();
                    }
                },
                location: {
                    origin: 'http://localhost'
                }
            },
            caches: {
                open: (cacheName) => {
                    if (!mockedCaches[cacheName]) {
                        mockedCaches[cacheName] = {
                            items: new Map(),
                            add: (url) => {
                                mockedCaches[cacheName].items.set(url, true);
                                return Promise.resolve();
                            },
                            put: (req, res) => {
                                const key = typeof req === 'string' ? req : req.url;
                                mockedCaches[cacheName].items.set(key, res);
                                return Promise.resolve();
                            },
                            match: (req) => {
                                const key = typeof req === 'string' ? req : req.url;
                                return Promise.resolve(mockedCaches[cacheName].items.get(key) || null);
                            }
                        };
                    }
                    return Promise.resolve(mockedCaches[cacheName]);
                },
                keys: () => Promise.resolve(Object.keys(mockedCaches)),
                delete: (cacheName) => {
                    delete mockedCaches[cacheName];
                    return Promise.resolve(true);
                },
                match: (req) => {
                    const key = typeof req === 'string' ? req : req.url;
                    for (const cache of Object.values(mockedCaches)) {
                        if (cache.items.has(key)) {
                            return Promise.resolve(cache.items.get(key));
                        }
                    }
                    return Promise.resolve(undefined);
                }
            },
            fetch: (req) => Promise.resolve({
                status: 200,
                clone: function() { return this; },
                type: 'basic',
                url: typeof req === 'string' ? req : req.url
            }),
            URL: URL,
            console: {
                log: () => {},
                error: () => {},
                warn: () => {}
            },
            Promise: Promise,
            Response: {
                error: () => ({ type: 'error' })
            },
            setTimeout: setTimeout,
            clients: {
                claim: () => { state.clientsClaimCalled = true; return Promise.resolve(); },
                matchAll: () => Promise.resolve([]),
                openWindow: () => Promise.resolve()
            },
        };
        // Ensure context.clients and context.self.clients refer to same obj if needed, but self.clients is accessed
        context.self.clients = context.clients;

        const swCode = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
        vm.createContext(context);
        vm.runInContext(swCode, context);

        return {
            listeners,
            context,
            mockedCaches,
            state,
            notificationsShown
        };
    }

    await t.test('registers install, activate, fetch, and notificationclick events', () => {
        const { listeners } = loadSW();
        assert.ok(listeners.install);
        assert.ok(listeners.activate);
        assert.ok(listeners.fetch);
        assert.ok(listeners.notificationclick);
        assert.ok(listeners.onBackgroundMessage);
    });

    await t.test('install event caches APP_SHELL and calls skipWaiting', async () => {
        const { listeners, mockedCaches, state } = loadSW();
        let waitUntilPromise;
        const event = {
            waitUntil: (p) => { waitUntilPromise = p; }
        };

        listeners.install(event);
        await waitUntilPromise;

        const cacheName = 'rebel-test-v5';
        assert.ok(mockedCaches[cacheName]);
        assert.ok(mockedCaches[cacheName].items.has('./index.html'));
        assert.strictEqual(state.skipWaitingCalled, true);
    });
});

test('Service Worker Extended Tests', async (t) => {

    function loadSW() {
        const listeners = {};
        const mockedCaches = {};
        const state = { skipWaitingCalled: false, clientsClaimCalled: false };
        let notificationsShown = [];
        let fetchedUrls = [];
        let networkFetchMock = (req) => {
            fetchedUrls.push(req.url || req);
            return Promise.resolve({
                status: 200,
                clone: function() { return this; },
                type: 'basic',
                url: typeof req === 'string' ? req : req.url
            });
        };

        const context = {
            importScripts: () => {},
            firebase: {
                initializeApp: () => {},
                messaging: () => ({
                    onBackgroundMessage: (cb) => { listeners.onBackgroundMessage = cb; }
                })
            },
            self: {
                addEventListener: (event, cb) => { listeners[event] = cb; },
                skipWaiting: () => { state.skipWaitingCalled = true; },
                registration: {
                    showNotification: (title, options) => {
                        notificationsShown.push({title, options});
                        return Promise.resolve();
                    }
                },
                location: {
                    origin: 'http://localhost'
                }
            },
            caches: {
                open: (cacheName) => {
                    if (!mockedCaches[cacheName]) {
                        mockedCaches[cacheName] = {
                            items: new Map(),
                            add: (url) => {
                                mockedCaches[cacheName].items.set(url, true);
                                return Promise.resolve();
                            },
                            put: (req, res) => {
                                const key = typeof req === 'string' ? req : req.url;
                                mockedCaches[cacheName].items.set(key, res);
                                return Promise.resolve();
                            },
                            match: (req) => {
                                const key = typeof req === 'string' ? req : req.url;
                                return Promise.resolve(mockedCaches[cacheName].items.get(key) || null);
                            }
                        };
                    }
                    return Promise.resolve(mockedCaches[cacheName]);
                },
                keys: () => Promise.resolve(Object.keys(mockedCaches)),
                delete: (cacheName) => {
                    delete mockedCaches[cacheName];
                    return Promise.resolve(true);
                },
                match: (req) => {
                    const key = typeof req === 'string' ? req : req.url;
                    for (const cache of Object.values(mockedCaches)) {
                        if (cache.items.has(key)) {
                            return Promise.resolve(cache.items.get(key));
                        }
                    }
                    return Promise.resolve(undefined);
                }
            },
            fetch: (req) => networkFetchMock(req),
            URL: URL,
            console: {
                log: () => {},
                error: () => {},
                warn: () => {}
            },
            Promise: Promise,
            Response: {
                error: () => ({ type: 'error' })
            },
            setTimeout: setTimeout,
            clients: {
                claim: () => { state.clientsClaimCalled = true; return Promise.resolve(); },
                matchAll: () => Promise.resolve([]),
                openWindow: () => Promise.resolve()
            },
        };
        context.self.clients = context.clients;

        const swCode = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
        vm.createContext(context);
        vm.runInContext(swCode, context);

        return {
            listeners,
            context,
            mockedCaches,
            state,
            notificationsShown,
            fetchedUrls,
            setNetworkFetchMock: (mock) => { networkFetchMock = mock; }
        };
    }

    await t.test('activate event clears old caches', async () => {
        const { listeners, mockedCaches, state, context } = loadSW();

        // Setup old caches
        await context.caches.open('old-cache-v1');
        await context.caches.open('old-cache-v2');
        await context.caches.open('rebel-test-v5');

        assert.strictEqual(Object.keys(mockedCaches).length, 3);

        let waitUntilPromise;
        listeners.activate({
            waitUntil: (p) => { waitUntilPromise = p; }
        });

        await waitUntilPromise;

        // Old caches should be deleted, current cache should remain
        assert.strictEqual(Object.keys(mockedCaches).length, 1);
        assert.ok(mockedCaches['rebel-test-v5']);
        assert.strictEqual(state.clientsClaimCalled, true);
    });

    await t.test('fetch event ignores non-GET requests', async () => {
        const { listeners } = loadSW();

        let responded = false;
        listeners.fetch({
            request: { method: 'POST', url: 'http://localhost/api' },
            respondWith: () => { responded = true; }
        });

        assert.strictEqual(responded, false);
    });

    await t.test('fetch event ignores Firestore/Auth API calls', async () => {
        const { listeners } = loadSW();

        let responded = false;
        listeners.fetch({
            request: { method: 'GET', url: 'https://firestore.googleapis.com/v1/projects/...' },
            respondWith: () => { responded = true; }
        });

        assert.strictEqual(responded, false);
    });

    await t.test('fetch event caches successful responses (stale-while-revalidate)', async () => {
        const { listeners, mockedCaches } = loadSW();

        let respondWithPromise;
        let waitUntilPromise;

        const reqUrl = 'http://localhost/style.css';

        listeners.fetch({
            request: { method: 'GET', url: reqUrl },
            respondWith: (p) => { respondWithPromise = p; },
            waitUntil: (p) => { waitUntilPromise = p; }
        });

        const response = await respondWithPromise;

        assert.strictEqual(response.status, 200);

        // Wait for the cache put to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        const cache = mockedCaches['rebel-test-v5'];
        assert.ok(cache);
        assert.ok(cache.items.has(reqUrl));
    });

    await t.test('notificationclick event focuses client and navigates', async () => {
        const { listeners, context } = loadSW();

        let urlOpened = null;
        let postMessageData = null;
        let focusCalled = false;

        context.clients.matchAll = () => Promise.resolve([
            {
                url: 'http://localhost/something',
                focus: () => { focusCalled = true; },
                postMessage: (msg) => { postMessageData = msg; }
            }
        ]);

        let waitUntilPromise;
        listeners.notificationclick({
            notification: {
                close: () => {},
                data: { testId: '123' }
            },
            waitUntil: (p) => { waitUntilPromise = p; }
        });

        await waitUntilPromise;

        assert.strictEqual(focusCalled, true);
        assert.strictEqual(postMessageData.type, 'NAVIGATE'); assert.strictEqual(postMessageData.url, '/?test=123');
    });
});

test('Background Message Handling', async (t) => {

    function loadSW() {
        const listeners = {};
        const state = { skipWaitingCalled: false, clientsClaimCalled: false };
        let notificationsShown = [];

        const context = {
            importScripts: () => {},
            firebase: {
                initializeApp: () => {},
                messaging: () => ({
                    onBackgroundMessage: (cb) => { listeners.onBackgroundMessage = cb; }
                })
            },
            self: {
                addEventListener: (event, cb) => { listeners[event] = cb; },
                registration: {
                    showNotification: (title, options) => {
                        notificationsShown.push({title, options});
                        return Promise.resolve();
                    }
                },
                location: { origin: 'http://localhost' }
            },
            caches: {
                open: () => Promise.resolve({
                    items: new Map(),
                    add: () => Promise.resolve(),
                    put: () => Promise.resolve(),
                    match: () => Promise.resolve(null)
                }),
                keys: () => Promise.resolve([]),
                delete: () => Promise.resolve(true),
                match: () => Promise.resolve(undefined)
            },
            fetch: () => Promise.resolve({
                status: 200,
                clone: function() { return this; },
                type: 'basic'
            }),
            URL: URL,
            console: { log: () => {}, error: () => {}, warn: () => {} },
            Promise: Promise,
            Response: { error: () => ({ type: 'error' }) },
            setTimeout: setTimeout,
            clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]), openWindow: () => Promise.resolve() }
        };
        context.self.clients = context.clients;

        const swCode = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
        vm.createContext(context);
        vm.runInContext(swCode, context);

        return { listeners, notificationsShown };
    }

    await t.test('shows notification on background message', () => {
        const { listeners, notificationsShown } = loadSW();

        assert.ok(listeners.onBackgroundMessage);

        listeners.onBackgroundMessage({
            data: { title: 'Test Title', body: 'Test Body', testId: '123' }
        });

        assert.strictEqual(notificationsShown.length, 1);
        assert.strictEqual(notificationsShown[0].title, 'Test Title');
        assert.strictEqual(notificationsShown[0].options.body, 'Test Body');
        assert.strictEqual(notificationsShown[0].options.data.testId, '123');
        assert.strictEqual(notificationsShown[0].options.icon, './icon-192.png');
    });

    await t.test('falls back to default title if missing', () => {
        const { listeners, notificationsShown } = loadSW();

        listeners.onBackgroundMessage({
            data: {}
        });

        assert.strictEqual(notificationsShown.length, 1);
        assert.strictEqual(notificationsShown[0].title, 'Rebel Test Series');
    });

    await t.test('handles notification object payload', () => {
        const { listeners, notificationsShown } = loadSW();

        listeners.onBackgroundMessage({
            data: {},
            notification: { title: 'Notification Title', body: 'Notification Body' }
        });

        assert.strictEqual(notificationsShown.length, 1);
        assert.strictEqual(notificationsShown[0].title, 'Notification Title');
        assert.strictEqual(notificationsShown[0].options.body, 'Notification Body');
    });
});

test('Notification Click Handling (openWindow)', async (t) => {

    function loadSW() {
        const listeners = {};
        let urlOpened = null;

        const context = {
            importScripts: () => {},
            firebase: {
                initializeApp: () => {},
                messaging: () => ({
                    onBackgroundMessage: (cb) => {}
                })
            },
            self: {
                addEventListener: (event, cb) => { listeners[event] = cb; },
                location: { origin: 'http://localhost' }
            },
            URL: URL,
            console: { log: () => {}, error: () => {}, warn: () => {} },
            Promise: Promise,
            setTimeout: setTimeout,
            clients: {
                matchAll: () => Promise.resolve([]),
                openWindow: (url) => { urlOpened = url; return Promise.resolve(); }
            }
        };
        context.self.clients = context.clients;

        const swCode = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
        vm.createContext(context);
        vm.runInContext(swCode, context);

        return { listeners, getUrlOpened: () => urlOpened };
    }

    await t.test('opens new window if no client is found', async () => {
        const { listeners, getUrlOpened } = loadSW();

        let waitUntilPromise;
        listeners.notificationclick({
            notification: {
                close: () => {},
                data: { testId: '456' }
            },
            waitUntil: (p) => { waitUntilPromise = p; }
        });

        await waitUntilPromise;

        assert.strictEqual(getUrlOpened(), 'http://localhost/?test=456');
    });
});

test('Fetch Fallback Handling', async (t) => {

    function loadSW() {
        const listeners = {};
        const mockedCaches = {};

        const context = {
            importScripts: () => {},
            firebase: { initializeApp: () => {}, messaging: () => ({ onBackgroundMessage: () => {} }) },
            self: { addEventListener: (event, cb) => { listeners[event] = cb; }, location: { origin: 'http://localhost' } },
            caches: {
                open: (cacheName) => {
                    if (!mockedCaches[cacheName]) {
                        mockedCaches[cacheName] = {
                            items: new Map(),
                            add: (url) => Promise.resolve(),
                            put: (req, res) => {
                                const key = typeof req === 'string' ? req : req.url;
                                mockedCaches[cacheName].items.set(key, res);
                                return Promise.resolve();
                            },
                            match: (req) => {
                                const key = typeof req === 'string' ? req : req.url;
                                return Promise.resolve(mockedCaches[cacheName].items.get(key) || null);
                            }
                        };
                    }
                    return Promise.resolve(mockedCaches[cacheName]);
                },
                match: (req) => {
                    const key = typeof req === 'string' ? req : req.url;
                    for (const cache of Object.values(mockedCaches)) {
                        if (cache.items.has(key)) return Promise.resolve(cache.items.get(key));
                    }
                    return Promise.resolve(undefined);
                }
            },
            fetch: () => Promise.reject(new Error('Network offline')),
            URL: URL,
            console: { log: () => {}, error: () => {}, warn: () => {} },
            Promise: Promise,
            Response: { error: () => ({ type: 'error', isResponseError: true }) },
            setTimeout: setTimeout,
        };

        const swCode = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
        vm.createContext(context);
        vm.runInContext(swCode, context);

        return { listeners, mockedCaches, context };
    }

    await t.test('returns error response when network fails and not in cache', async () => {
        const { listeners } = loadSW();

        let respondWithPromise;
        listeners.fetch({
            request: { method: 'GET', url: 'http://localhost/new-image.png' },
            respondWith: (p) => { respondWithPromise = p; }
        });

        const response = await respondWithPromise;
        assert.strictEqual(response.isResponseError, true);
        assert.strictEqual(response.type, 'error');
    });

    await t.test('returns cached response when network fails', async () => {
        const { listeners, mockedCaches, context } = loadSW();

        const reqUrl = 'http://localhost/cached-style.css';

        // Setup cache
        await context.caches.open('rebel-test-v5');
        mockedCaches['rebel-test-v5'].items.set(reqUrl, { status: 200, type: 'basic', url: reqUrl });

        let respondWithPromise;
        let waitUntilPromise;
        listeners.fetch({
            request: { method: 'GET', url: reqUrl },
            respondWith: (p) => { respondWithPromise = p; },
            waitUntil: (p) => { waitUntilPromise = p; }
        });

        const response = await respondWithPromise;

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.url, reqUrl);

        // Ensure background fetch was caught
        try {
            await waitUntilPromise;
        } catch(e) {
            // expected to throw or resolve safely
        }
    });
});
