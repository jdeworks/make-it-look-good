import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`
<!DOCTYPE html>
<html>
<body>
  <details>
    <summary>Summary</summary>
    <div>Some text <strong>bold text</strong> more text</div>
  </details>
</body>
</html>
`);

const result = await page.evaluate(() => {
  const strong = document.querySelector('strong');
  const div = document.querySelector('div');
  const details = document.querySelector('details');
  return {
    detailsOpen: details.open,
    strongCheckVis: strong.checkVisibility(),
    divCheckVis: div.checkVisibility(),
    strongBbox: JSON.stringify(strong.getBoundingClientRect()),
    divBbox: JSON.stringify(div.getBoundingClientRect()),
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
