const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const pctLine = html.split('\n').findIndex(l => l.includes('const pct = Math.round((correct/total)*100);'));
console.log('Line for pct calculation:', pctLine + 1);
const finishTestLine = html.split('\n').findIndex(l => l.includes('function finishTest(){'));
console.log('Line for finishTest:', finishTestLine + 1);
