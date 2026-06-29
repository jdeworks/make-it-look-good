// @ts-check
// CONSOLE-SNIPPET SPA DISCOVERY PARITY
//
// The assembled console snippet, run in a live single-page app, must explore the app's
// hidden views (clicking nav/tabs in place) and emit the SAME {_milgCrawl, results,
// _spaProvenance} payload the analyzer ingests — the shape URL-mode SPA discovery produces
// (analyzer.js _finishUrl). This guards that MilgSpaExplore + MilgSpaMap are correctly
// inlined into the snippet (SNIPPET_MANIFEST) and that the SPA branch fires + maps views.
//
// Fixture: docs/tests/fixtures/spa-views.html — vanilla-JS SPA with nav views, a Features
// sub-tab strip (pages > tabs), and a theme toggle. Deterministic, self-contained.
const { test, expect } = require('@playwright/test');
const BASE = 'http://localhost:8384';

test('console snippet explores SPA views and emits a crawl payload', async ({ page, context }) => {
  test.setTimeout(90000);
  // Avoid the clipboard-failure → file-download fallback in headless.
  try { await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE }); } catch (e) {}

  // 1) Assemble the PLAIN snippet (screenshots off → no lib wait, fast + deterministic) with
  //    "Explore SPA views" on, so the copy-time prefix sets window.__milgSpaExplore.
  await page.goto(`${BASE}/analyzer.html`);
  await page.click('[data-tab="tabSnippet"]');
  await page.evaluate(() => {
    function set(id, on) { const c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
    set('screenshotCheck', false);
    set('spaExploreCheck', true);
  });
  await page.waitForFunction(() => {
    const c = document.getElementById('snippetCode'); const t = (c && c.textContent) || '';
    return t.indexOf('window.__milgSpaExplore=true') >= 0 && t.indexOf('_milgRunSpaExplore') >= 0 && t.indexOf('window.MilgSpaMap') >= 0;
  }, { timeout: 20000 });
  const snippet = await page.evaluate(() => (document.getElementById('snippetCode') || {}).textContent);

  // 2) Run the snippet in the live fixture SPA (page.evaluate runs in an isolated world,
  //    bypassing page CSP — exactly like pasting into the console).
  await page.goto(`${BASE}/tests/fixtures/spa-views.html`);
  await page.evaluate((code) => { (0, eval)(code); }, snippet);

  // 3) The SPA branch sets window.__milgCrawlJson when done (before any clipboard attempt).
  await page.waitForFunction(() => !!window.__milgCrawlJson, { timeout: 60000 });
  const payload = await page.evaluate(() => JSON.parse(window.__milgCrawlJson));

  expect(payload._milgCrawl).toBe(true);
  expect(Array.isArray(payload.results)).toBe(true);
  // Home + Features + Specs + FAQ + Pricing + Contact (≥5 tolerates minor exploration order).
  expect(payload.results.length).toBeGreaterThanOrEqual(5);
  expect(payload._spaProvenance).toBeTruthy();
  expect(payload._spaProvenance.counts.subViews).toBeGreaterThanOrEqual(1);

  // Hierarchy: at least one sub-view nested under another view (pages > tabs).
  const maxDepth = Math.max.apply(null, payload.results.map((r) => (r.data && r.data.meta && r.data.meta._spaDepth) || 0));
  expect(maxDepth).toBeGreaterThanOrEqual(2);

  // Every folded view carries the SPA meta + a breadcrumb title.
  for (const r of payload.results) {
    expect(r.data.meta._spaView).toBe(true);
    expect(typeof r.data.meta.title).toBe('string');
    expect(r.data.meta.title.length).toBeGreaterThan(0);
  }
});
