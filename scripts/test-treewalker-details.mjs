import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`
<!DOCTYPE html>
<html>
<body>
  <details id="d1">
    <summary>Summary</summary>
    <p id="p1">Hidden text</p>
  </details>
  <p id="p2">Visible text</p>
</body>
</html>
`);

const result = await page.evaluate(() => {
  const textNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el) continue;
    const text = node.textContent.trim();
    if (!text) continue;
    textNodes.push({
      text,
      tag: el.tagName,
      checkVis: el.checkVisibility ? el.checkVisibility() : 'N/A',
      bboxW: el.getBoundingClientRect().width,
      bboxH: el.getBoundingClientRect().height,
    });
  }
  return textNodes;
});

console.log(JSON.stringify(result, null, 2));

await browser.close();
