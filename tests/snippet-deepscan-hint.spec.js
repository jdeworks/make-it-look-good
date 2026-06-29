// @ts-check
// Guards that the console-snippet overlay surfaces the single-viewport caveat (the snippet
// captures one viewport; to check another, use the analyzer's viewport selector and re-run).
// The hint lives in the shell source, so the rendered #snippetCode must contain it.
const { test, expect } = require('@playwright/test');
const ANALYZER_URL = 'http://localhost:8384/analyzer.html';
const HINT = /viewport selector/i;

test('snippet code surfaces the single-viewport hint', async ({ page }) => {
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
  expect(code).toContain("var _MILG_VERSION = 'v3.11.66'");
  expect(code).toContain('capture failed at stage');
  expect(code).toContain('screenshotError');
  expect(code).toContain('snippet-capture-start-error');
  expect(code).toContain('snippet-library-promise-rejected');
  expect(code).not.toContain('the page render was likely tainted by a cross-origin image without CORS');
});

test('analyzer asset cache-busters match the visible analyzer version', async ({ page }) => {
  await page.goto(ANALYZER_URL);
  const versions = await page.evaluate(() => {
    const label = document.querySelector('.input-hero h1 span')?.textContent?.trim() || '';
    const expected = label.replace(/^v/, '');
    const assets = Array.from(document.querySelectorAll('script[src*="?v="],link[href*="?v="]')).map((el) => {
      const url = el.getAttribute('src') || el.getAttribute('href') || '';
      return { url, version: new URL(url, location.href).searchParams.get('v') };
    }).filter((a) => /^(analyzer|scoring\/)/.test(a.url));
    return { label, expected, assets };
  });
  // Version-agnostic: the point is that EVERY asset cache-buster matches the visible
  // version label, not that the label equals a hard-coded value (which breaks on every bump).
  expect(versions.label).toMatch(/^v\d+\.\d+\.\d+$/);
  expect(versions.assets.length).toBeGreaterThan(10);
  expect(versions.assets.every((a) => a.version === versions.expected)).toBe(true);
});
