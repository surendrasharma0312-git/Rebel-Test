import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))

        # We must intercept requests to the real firebase scripts to not override our mocks.
        await page.route("**/*.js", lambda route: route.continue_() if "firebase" not in route.request.url else route.fulfill(body="", status=200))

        await page.add_init_script("""
            window.firebase = {
                firestore: function() {
                    return {
                        collection: function(colName) {
                            return {
                                doc: function(docId) {
                                    return {
                                        onSnapshot: function(cb) {
                                            if (colName === 'studentProfiles') {
                                                setTimeout(() => {
                                                    cb({ exists: true, data: () => ({ bio: 'Test Bio', photo: 'data:image/png;base64,...', phone: '123-456-7890' }) });
                                                }, 50);
                                            } else {
                                                setTimeout(() => { cb({ exists: false }); }, 50);
                                            }
                                            return function() {};
                                        },
                                        set: function() { return Promise.resolve(); }
                                    };
                                },
                                where: function(field, op, val) {
                                    let w = {
                                        onSnapshot: function(cb, errCb) {
                                            if (colName === 'testResults') {
                                                setTimeout(() => {
                                                    cb({
                                                        empty: false,
                                                        docs: [
                                                            { data: () => ({ testDocId: 'test1', pct: 80, studentName: 'Alice', durationSeconds: 10, createdAt: new Date() }) },
                                                            { data: () => ({ testDocId: 'test2', pct: 90, studentName: 'Alice', durationSeconds: 15, createdAt: new Date() }) }
                                                        ]
                                                    });
                                                }, 50);
                                            } else {
                                                setTimeout(() => { cb({ empty: true }); }, 50);
                                            }
                                            return function() {};
                                        },
                                        where: function() { return w; },
                                        orderBy: function() { return w; },
                                        limit: function() { return w; }
                                    };
                                    return w;
                                },
                                orderBy: function() { return this; },
                                limit: function() { return this; }
                            };
                        }
                    };
                },
                auth: function() { return { onAuthStateChanged: () => {} }; },
                messaging: function() { return { getToken: () => Promise.resolve('mock-token'), onMessage: () => {} }; },
                app: function() { return {}; },
                initializeApp: function() { return {}; }
            };
            window.firebaseReady = true;
            window.leaderboardPeriod = 'all';
            window.leaderboardFilter = 'all';
        """)

        html_path = "file://" + os.path.abspath("index.html")
        await page.goto(html_path)

        await page.evaluate("""
            window.db = window.firebase.firestore();
        """)

        await page.evaluate("showPublicProfile('test_student_1', 'Alice');")
        await page.wait_for_selector('#publicProfileModal')
        await page.wait_for_function("document.querySelector('.pp-bio').textContent === 'Test Bio'")

        modals = await page.locator('#publicProfileModal').count()
        assert modals == 1, f"Expected 1 modal, found {modals}"

        name = await page.locator('.pp-name').text_content()
        assert name == 'Alice', f"Expected name 'Alice', found '{name}'"

        bio = await page.locator('.pp-bio').text_content()
        assert bio == 'Test Bio', f"Expected bio 'Test Bio', found '{bio}'"

        tests = await page.locator('.pp-tests').text_content()
        assert tests == '2', f"Expected 2 tests, found '{tests}'"

        score = await page.locator('.pp-score').text_content()
        assert score == '85%', f"Expected 85% average score, found '{score}'"

        print("Test passed: Modal opened, data loaded, stats computed properly, no duplicates.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
