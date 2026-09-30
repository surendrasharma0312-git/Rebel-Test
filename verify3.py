from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000')

    page.evaluate("showScreen('screen-admin')")
    page.wait_for_selector('#screen-admin', state='visible')
    page.screenshot(path='verification3.png')

    page.evaluate("showScreen('screen-admin-students')")
    page.wait_for_selector('#screen-admin-students', state='visible')
    page.screenshot(path='verification4.png')

    browser.close()
