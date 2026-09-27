const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// Load HTML content
const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Load HTML in JSDOM, enabling script execution but ignoring external scripts
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

// Access the global function from the JSDOM window
const window = dom.window;
const parseVocabText = (text) => {
    // Because Objects cross contexts, we extract the primitive properties using stringify
    return JSON.parse(JSON.stringify(window.parseVocabText(text)));
};

test('parseVocabText', async (t) => {
    await t.test('should parse text with em dash separator', () => {
        const text = "Apple — सेब\nBanana — केला";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Apple", hi: "सेब" },
            { en: "Banana", hi: "केला" }
        ]);
    });

    await t.test('should parse text with en dash separator', () => {
        const text = "Cat – बिल्ली";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Cat", hi: "बिल्ली" }
        ]);
    });

    await t.test('should parse text with colon separator', () => {
        const text = "Dog : कुत्ता\nElephant :- हाथी";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Dog", hi: "कुत्ता" },
            { en: "Elephant", hi: "हाथी" }
        ]);
    });

    await t.test('should parse text with tab separator', () => {
        const text = "Fish\tमछली";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Fish", hi: "मछली" }
        ]);
    });

    await t.test('should parse text with equals sign separator', () => {
        const text = "Goat = बकरी";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Goat", hi: "बकरी" }
        ]);
    });

    await t.test('should parse text with arrow separator', () => {
        const text = "Horse -> घोड़ा\nIce → बर्फ";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Horse", hi: "घोड़ा" },
            { en: "Ice", hi: "बर्फ" }
        ]);
    });

    await t.test('should parse text with pipe separator', () => {
        const text = "Jug | जग";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Jug", hi: "जग" }
        ]);
    });

    await t.test('should parse text with hyphen w/ mandatory spaces separator', () => {
        const text = "Kite - पतंग"; // Hyphen with spaces
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Kite", hi: "पतंग" }
        ]);
    });

    await t.test('should not split on hyphenated words without spaces', () => {
        const text = "Well-known - प्रसिद्ध";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Well-known", hi: "प्रसिद्ध" }
        ]);
    });

    await t.test('should parse text with bare comma separator if right side is Hindi', () => {
        const text = "Lion, शेर";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Lion", hi: "शेर" }
        ]);
    });

    await t.test('should not use bare comma if right side is not Hindi', () => {
        const text = "Monkey, Apes - बंदर";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Monkey", hi: "बंदर" }
        ]);
    });

    await t.test('should handle fallback 1: English then Devanagari with space', () => {
        const text = "Nest घोंसला";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Nest", hi: "घोंसला" }
        ]);
    });

    await t.test('should handle fallback 2: Devanagari then English (reversed layout)', () => {
        const text = "उल्लू Owl";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Owl", hi: "उल्लू" }
        ]);
    });

    await t.test('should handle fallback 3: Word (Meaning) parenthetical', () => {
        const text = "Parrot (तोता)";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Parrot", hi: "तोता" }
        ]);
    });

    await t.test('should extract base form from multiple word-forms (comma)', () => {
        const text = "Queen, Queens - रानी";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Queen", hi: "रानी" }
        ]);
    });

    await t.test('should extract base form from multiple word-forms (slash)', () => {
        const text = "Rat / Mouse - चूहा";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Rat", hi: "चूहा" }
        ]);
    });

    await t.test('should capitalize first letter and lowercase the rest', () => {
        const text = "sNAKE - साँप";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Snake", hi: "साँप" }
        ]);
    });

    await t.test('should remove duplicates based on the English word (case-insensitive)', () => {
        const text = "Tiger - बाघ\nTIGER - शेर\ntiger - बाघ";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Tiger", hi: "बाघ" }
        ]);
    });

    await t.test('should ignore common header rows', () => {
        const text = "Page 1\nUnit 5\nChapter 3\nLesson 2\nS.No. Words\nWord List 1\nVocabulary\nEnglish   हिंदी अर्थ\nUmbrella - छाता";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Umbrella", hi: "छाता" }
        ]);
    });

    await t.test('should skip lines with invalid or no English words', () => {
        const text = "12345 - numbers\n Van - वैन";
        assert.deepStrictEqual(parseVocabText(text), [
            { en: "Van", hi: "वैन" }
        ]);
    });
});
