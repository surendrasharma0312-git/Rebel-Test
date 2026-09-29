const { JSDOM } = require('jsdom');
JSDOM.fromFile('index.html', { runScripts: "dangerously" }).then(dom => {
  const window = dom.window;
  const document = window.document;
}).catch(console.error);
