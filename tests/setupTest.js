const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

function setupJSDOM() {
    const dom = new JSDOM(htmlContent, {
        url: "http://localhost/", // Set a URL to avoid "opaque origins" error for sessionStorage and history.replaceState bugs
        runScripts: "dangerously",
        beforeParse(window) {
            // Mock Firebase Authentication because the app starts an anonymous
            // session during initialization. Keep this isolated from real Firebase.
            const mockUser = {
                uid: 'test-anonymous-user',
                isAnonymous: true,
                getIdTokenResult: async () => ({ claims: {} })
            };
            const mockAuth = {
                currentUser: null,
                onAuthStateChanged: callback => {
                    // Defer the initial state callback until the unsubscribe
                    // function has been assigned by the application.
                    Promise.resolve().then(() => callback(null));
                    return () => {};
                },
                signInAnonymously: async () => {
                    mockAuth.currentUser = mockUser;
                    return { user: mockUser };
                },
                signOut: async () => {
                    mockAuth.currentUser = null;
                }
            };

            // Mock firebase to prevent network calls during init in index.html.
            window.firebase = {
                initializeApp: () => ({}),
                auth: () => mockAuth,
                firestore: () => ({
                    // The app enables Firestore offline persistence during startup.
                    enablePersistence: () => Promise.resolve(),
                    collection: () => ({
                        orderBy: () => ({
                            limit: () => ({
                                onSnapshot: () => {}
                            })
                        })
                    })
                })
            };
            // Mock matchMedia to prevent errors
            window.matchMedia = () => ({
                matches: false,
                addListener: () => {},
                removeListener: () => {}
            });
        }
    });

    return { window: dom.window };
}

module.exports = { setupJSDOM };
