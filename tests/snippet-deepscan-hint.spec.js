// @ts-check
// Guards that the console-snippet overlay surfaces the "deep scan needs URL mode" hint.
// The snippet is assembled by loadSnippet() from the shell files; the hint lives in the
// shell source, so the rendered #snippetCode must contain it for both screenshot modes.
const { test, expect } = require('@playwright/test');
const ANALYZER_URL = 'http://localhost:8384/analyzer.html';
const HINT = /multi-viewport \(deep scan\)/i;

test('snippet code surfaces the multi-viewport / deep-scan hint', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(ANALYZER_URL);
  await page.click('[data-tab="tabSnippet"]');
  // Wait for the snippet to assemble (loadSnippet fetches the shell + parts).
  await page.waitForFunction(() => {
    const el = document.getElementById('snippetCode');
    return el && el.textContent && el.textContent.length > 2000 && !/^Loading/.test(el.textContent);
  }, { timeout: 30000 });
  const code = await page.evaluate(() => document.getElementById('snippetCode').textContent);
  expect(code).toMatch(HINT);
  expect(code).toContain("var _MILG_VERSION = 'v1.9'");
  expect(code).toContain('capture failed at stage');
  expect(code).toContain('screenshotError');
  expect(code).toContain('snippet-capture-start-error');
  expect(code).toContain('snippet-library-promise-rejected');
  expect(code).not.toContain('the page render was likely tainted by a cross-origin image without CORS');
});
