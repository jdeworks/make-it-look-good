import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`
<!DOCTYPE html>
<html>
<body>
  <details id="d1">
    <summary>Header</summary>
    <p id="inner">Inner text</p>
    <input id="inp" placeholder="test">
  </details>
</body>
</html>
`);

const result = await page.evaluate(() => {
  const d = document.getElementById('d1');
  const inner = document.getElementById('inner');
  const inp = document.getElementById('inp');
  
  const checkVis = (el) => {
    try { return typeof el.checkVisibility === 'function' ? el.checkVisibility() : 'N/A'; } catch(e) { return 'error: ' + e.message; }
  };
  
  return {
    detailsOpen: d.open,
    innerCheckVis: checkVis(inner),
    inpCheckVis: checkVis(inp),
    innerBbox: JSON.stringify(inner.getBoundingClientRect()),
    inpBbox: JSON.stringify(inp.getBoundingClientRect()),
    innerDisplay: getComputedStyle(inner).display,
    innerVisibility: getComputedStyle(inner).visibility,
    innerContentVis: getComputedStyle(inner).contentVisibility,
    inpDisplay: getComputedStyle(inp).display,
    closestDetails: inner.closest && inner.closest('details:not([open])') ? 'found' : 'not found',
    closestSummary: inner.closest && inner.closest('summary') ? 'found' : 'not found',
  };
});

console.log(JSON.stringify(result, null, 2));

await browser.close();
