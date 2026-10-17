#!/bin/bash
sed -i '/<<<<<<< Updated upstream/d' index.html
sed -i '/=======/d' index.html
sed -i '/>>>>>>> Stashed changes/d' index.html

cat << 'INNEREOF' > tests/escapeHTML.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { setupJSDOM } = require('./setupTest');

const { window } = setupJSDOM();

// Access the global functions from the JSDOM window
const escapeHTML = window.escapeHTML;

test('escapeHTML tests', async (t) => {
  await t.test('returns unchanged string if no HTML characters are present', () => {
    assert.strictEqual(escapeHTML('hello world'), 'hello world');
    assert.strictEqual(escapeHTML('abc 123'), 'abc 123');
  });

  await t.test('escapes & character', () => {
    assert.strictEqual(escapeHTML('AT&T'), 'AT&amp;T');
    assert.strictEqual(escapeHTML('&'), '&amp;');
  });

  await t.test('escapes < character', () => {
    assert.strictEqual(escapeHTML('<script'), '&lt;script');
  });

  await t.test('escapes > character', () => {
    assert.strictEqual(escapeHTML('script>'), 'script&gt;');
  });

  await t.test('escapes " character', () => {
    assert.strictEqual(escapeHTML('"double quotes"'), '&quot;double quotes&quot;');
  });

  await t.test('escapes \' character', () => {
    assert.strictEqual(escapeHTML("'single quotes'"), '&#39;single quotes&#39;');
  });

  await t.test('escapes a mix of characters', () => {
    assert.strictEqual(
      escapeHTML('<div id="test" class=\'magic\'>Me & You</div>'),
      '&lt;div id=&quot;test&quot; class=&#39;magic&#39;&gt;Me &amp; You&lt;/div&gt;'
    );
  });

  await t.test('coerces non-string input to string', () => {
    assert.strictEqual(escapeHTML(123), '123');
    assert.strictEqual(escapeHTML(true), 'true');
    assert.strictEqual(escapeHTML(null), 'null');
    assert.strictEqual(escapeHTML(undefined), 'undefined');
    assert.strictEqual(escapeHTML({}), '[object Object]');
  });
});
INNEREOF
