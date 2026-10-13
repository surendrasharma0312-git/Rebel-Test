const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function setupJSDOM() {
    // Load HTML content
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Load HTML in JSDOM, enabling script execution but ignoring external scripts
    // Mock necessary globals before script execution
    const dom = new JSDOM(htmlContent, {
        url: "http://localhost/", // Set a URL to avoid "opaque origins" error for sessionStorage
        runScripts: "dangerously",
        beforeParse(window) {
            // Mock firebase to prevent errors during init in index.html
            window.firebase = {
                initializeApp: () => ({}),
                firestore: () => ({
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
            // Mock history.replaceState to avoid JSDOM errors with the targetURL thing
            const originalReplaceState = window.history.replaceState;
            window.history.replaceState = function(...args) {
                try {
                   return originalReplaceState.apply(this, args);
                } catch (e) {
                   // ignore JSDOM bug with url resolution
                }
            };
        }
    });

    return { dom, window: dom.window };
}

module.exports = { setupJSDOM };
