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

async function buildPlainSpaSnippet(page) {
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
  return page.evaluate(() => (document.getElementById('snippetCode') || {}).textContent);
}

test('console snippet explores SPA views and emits a crawl payload', async ({ page, context }) => {
  test.setTimeout(90000);
  try { await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE }); } catch (e) {}

  // 1) Assemble the PLAIN snippet (screenshots off → no lib wait, fast + deterministic) with
  //    "Explore SPA views" on, so the copy-time prefix sets window.__milgSpaExplore.
  const snippet = await buildPlainSpaSnippet(page);

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

test('SPA exploration reports target page script errors without failing the crawl', async ({ page, context }) => {
  test.setTimeout(90000);
  try { await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE }); } catch (e) {}

  const snippet = await buildPlainSpaSnippet(page);
  await page.goto(`${BASE}/tests/fixtures/spa-page-errors.html`);
  await page.evaluate((code) => { (0, eval)(code); }, snippet);

  await page.waitForFunction(() => !!window.__milgCrawlJson, { timeout: 60000 });
  const payload = await page.evaluate(() => JSON.parse(window.__milgCrawlJson));
  const provenance = payload._spaProvenance;

  expect(payload._milgCrawl).toBe(true);
  expect(payload.results.length).toBeGreaterThanOrEqual(2);
  expect(provenance.notes.some((n) => /Target page script error after clicking/.test(n) && /header is not defined/.test(n))).toBe(true);
  expect(provenance.clicked.some((c) => Array.isArray(c.pageErrors) && c.pageErrors.some((e) => /header is not defined/.test(e)))).toBe(true);
  expect(provenance.skipped.some((s) => s.reason === 'locale-control' && /language/i.test(s.label))).toBe(true);
});

// Settings parity: every analyzer option that has a snippet counterpart must actually be
// baked into the emitted snippet text (and re-baked when toggled). Guards the gaps found in
// the v3.11.140 audit: stateCapture was never passed; crawl+screenshots emitted a snippet
// whose crawl globals the screenshots shell silently ignored.
test('snippet builder bakes stateCapture and forces the plain shell for crawl', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(`${BASE}/analyzer.html`);
  await page.click('[data-tab="tabSnippet"]');
  function snippetText(p) { return p.evaluate(() => (document.getElementById('snippetCode') || {}).textContent || ''); }

  // SPA + state capture ON → prefix carries __milgSpaStateCapture=true.
  await page.evaluate(() => {
    function set(id, on) { const c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
    set('screenshotCheck', false);
    set('spaExploreCheck', true);
    set('stateCaptureCheck', true);
  });
  await page.waitForFunction(() => (((document.getElementById('snippetCode') || {}).textContent) || '').indexOf('window.__milgSpaStateCapture=true') >= 0, { timeout: 20000 });

  // Toggle state capture OFF → re-baked to false (stale-snippet guard).
  await page.evaluate(() => {
    const c = document.getElementById('stateCaptureCheck'); c.checked = false; c.dispatchEvent(new Event('change'));
  });
  await page.waitForFunction(() => (((document.getElementById('snippetCode') || {}).textContent) || '').indexOf('window.__milgSpaStateCapture=false') >= 0, { timeout: 20000 });

  // Crawl + screenshots ON (SPA off) → plain data-only shell with crawl globals, and the
  // data-only note is visible. The screenshots shell has no crawl logic.
  await page.evaluate(() => {
    function set(id, on) { const c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
    set('spaExploreCheck', false);
    set('screenshotCheck', true);
    set('snippetCrawlCheck', true);
  });
  await page.waitForFunction(() => (((document.getElementById('snippetCode') || {}).textContent) || '').indexOf('window.__milgCrawlSite=true') >= 0, { timeout: 20000 });
  const crawlSnippet = await snippetText(page);
  expect(crawlSnippet.indexOf('starting screenshot capture')).toBe(-1); // plain shell, not screenshots shell
  const noteVisible = await page.evaluate(() => {
    const n = document.getElementById('snippetCrawlDataOnlyNote');
    return !!n && n.style.display !== 'none';
  });
  expect(noteVisible).toBe(true);
});
