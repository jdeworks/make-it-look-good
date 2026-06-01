// @ts-check
// Guards the analyzer UI's own accessibility affordances (v3.11.25).
const { test, expect } = require('@playwright/test');
const ANALYZER = 'http://localhost:8384/analyzer.html';

test('analyzer UI exposes accessible names + live regions', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(ANALYZER);
  const a = await page.evaluate(() => {
    const attr = (id, name) => { const el = document.getElementById(id); return el ? el.getAttribute(name) : '__missing__'; };
    return {
      toastLive: attr('toast', 'aria-live'),
      toastRole: attr('toast', 'role'),
      copySnippet: attr('copySnippetBtn', 'aria-label'),
      exportJson: attr('exportJsonBtn', 'aria-label'),
      markdown: attr('markdownBtn', 'aria-label'),
      copyMd: attr('copyMdBtn', 'aria-label'),
      llmPack: attr('llmPackBtn', 'aria-label'),
      newAnalysis: attr('newAnalysisBtn', 'aria-label'),
      sevFilter: attr('exportSeverityFilter', 'aria-label'),
      viewportSel: attr('viewportSelect', 'aria-label'),
      analysisProgressLive: attr('analysisProgress', 'aria-live'),
      // No <h4> should be used for the audience-profiles section heading (heading-order skip).
      hasProfilesH2: !!Array.from(document.querySelectorAll('h2')).find((h) => /audience profile/i.test(h.textContent || '')),
    };
  });
  console.log('A11Y', JSON.stringify(a, null, 2));
  expect(a.toastLive).toBe('polite');
  expect(a.toastRole).toBe('status');
  for (const k of ['copySnippet', 'exportJson', 'markdown', 'copyMd', 'llmPack', 'newAnalysis', 'sevFilter', 'viewportSel']) {
    expect(a[k], `${k} aria-label`).toBeTruthy();
    expect(a[k]).not.toBe('__missing__');
  }
  expect(a.analysisProgressLive).toBe('polite');
  expect(a.hasProfilesH2).toBe(true);
});
