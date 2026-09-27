const mockPdfJsLib = {
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 50,
      getPage: async (i) => {
        // simulate async work
        await new Promise(r => setTimeout(r, 10));
        return {
          getTextContent: async () => {
            await new Promise(r => setTimeout(r, 10));
            return {
              items: [
                { str: 'hello', transform: [1, 0, 0, 1, 10, 20] },
                { str: 'world', transform: [1, 0, 0, 1, 30, 20] }
              ]
            };
          }
        };
      }
    })
  })
};

global.pdfjsLib = mockPdfJsLib;

const extractTextFromPdf = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
  let fullText = '';
  const Y_TOLERANCE = 4;

  for(let i=1;i<=pdf.numPages;i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const items = content.items
      .filter(it => it.str && it.str.trim().length > 0)
      .map(it => ({ x: it.transform[4], y: it.transform[5], str: it.str }));

    items.sort((a,b) => b.y - a.y || a.x - b.x);

    const rows = [];
    items.forEach(item=>{
      let row = rows.find(r => Math.abs(r.y - item.y) <= Y_TOLERANCE);
      if(!row){
        row = { y: item.y, items: [] };
        rows.push(row);
      }
      row.items.push(item);
    });

    rows.forEach(row=>{
      row.items.sort((a,b)=> a.x - b.x);
      fullText += row.items.map(it=>it.str).join('  ') + '\n';
    });
    fullText += '\n';
  }
  return fullText;
}

const run = async () => {
  const file = { arrayBuffer: async () => new ArrayBuffer(0) };
  const start = Date.now();
  await extractTextFromPdf(file);
  const end = Date.now();
  console.log(`Sequential time: ${end - start}ms`);
}

run();
