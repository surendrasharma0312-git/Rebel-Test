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
        }
    });

    return { window: dom.window };
}

module.exports = { setupJSDOM };
