const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

const functionRegex = /function formatDuration\(totalSeconds\)\s*\{[\s\S]*?\n\}/;
const match = htmlContent.match(functionRegex);

if (!match) {
  throw new Error("Could not find formatDuration function in index.html");
}

eval(match[0]);

describe('formatDuration', () => {
  test('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  test('formats less than a minute', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  test('formats exactly 1 minute', () => {
    expect(formatDuration(60)).toBe('1m 0s');
  });

  test('formats exactly 1 minute and some seconds', () => {
    expect(formatDuration(65)).toBe('1m 5s');
  });

  test('formats multiple minutes', () => {
    expect(formatDuration(120)).toBe('2m 0s');
  });

  test('formats multiple minutes and some seconds', () => {
    expect(formatDuration(125)).toBe('2m 5s');
  });
});
