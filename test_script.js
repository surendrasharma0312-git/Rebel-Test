const fs = require('fs');
const { JSDOM } = require('jsdom');
const htmlContent = '<html><body></body></html>';
const dom = new JSDOM(htmlContent, {
    url: "http://localhost/"
});
try {
  dom.window.history.replaceState(null, '', '/somepath');
  console.log("no error thrown");
} catch(e) {
  console.log("error thrown:", e);
}
