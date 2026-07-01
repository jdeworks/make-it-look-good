// @ts-check
// Guards for three v3.11.134 follow-ups:
//   1. Budget dropdown (#spaBudget) — one Low/Medium/High/Unlimited select replaces the four SPA
//      spinners; __milgReadSpaTuning must return the preset for the selected level, and Unlimited
//      must truly uncap (even on the hosted build) since SPA runs entirely on the client.
//   2. Scrollable-pane capture — a vertically-scrollable inner pane (overflow:auto, scrollHeight >
//      clientHeight) becomes its OWN region screenshot (kind:'scroll') via the normal region
//      pipeline (no SPA/state needed), so below-the-fold scroll content is no longer invisible.
//   3. All-expanded state screenshot — the holistic "All expanded" state view now rasterizes the
//      live revealed DOM (was geometry-only), so its view carries a real screenshot.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ANALYZER_URL = 'http://localhost:8384/analyzer.html';
const BASE_URL = 'http://localhost:8384';
const DOCS_DIR = path.join(__dirname, '..', 'docs');

// A runtime fixture served from docs/ (same-origin → MilgProxy direct-fetches it). Written in
// beforeAll, removed in afterAll, and gitignored — it never lands in the published site or git.
const FIXTURE_NAME = '_milg-followups-fixture.html';
const FIXTURE_PATH = path.join(DOCS_DIR, FIXTURE_NAME);
const FIXTURE_URL = `${BASE_URL}/${FIXTURE_NAME}`;

function buildFixture() {
  const rows = Array.from({ length: 30 }, (_, i) =>
    `<p style="margin:6px 0;font-size:15px;color:#1f2937">Row ${i + 1} — activity event with enough descriptive text to be real, readable content the analyzer can sample for contrast.</p>`
  ).join('\n');
  const details = Array.from({ length: 7 }, (_, i) =>
    `<details style="margin:8px 0;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px"><summary style="font-size:16px;font-weight:600;cursor:pointer">Disclosure section ${i + 1}</summary><p style="font-size:15px;color:#374151;margin:8px 0 0">Hidden body copy for section ${i + 1}. It carries a full sentence of readable text so the panel counts as real disclosure content once expanded.</p></details>`
  ).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Follow-ups fixture</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;margin:0;padding:28px;background:#ffffff;color:#111827">
  <h1 style="font-size:30px;font-weight:800;margin:0 0 12px">Scrollable pane + disclosures fixture</h1>
  <p style="font-size:17px;color:#1f2937;max-width:640px">Intro paragraph with enough readable body text to give the analyzer real contrast pairs to sample and score on the base page.</p>
  <section aria-label="Activity log" style="overflow:auto;height:200px;width:540px;border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin:18px 0">
    <h2 style="font-size:22px;font-weight:700;margin:0 0 8px">Activity log</h2>
    ${rows}
  </section>
  <h2 style="font-size:22px;font-weight:700;margin:20px 0 8px">Frequently asked</h2>
  ${details}
</body></html>`;
}

test.beforeAll(() => { fs.writeFileSync(FIXTURE_PATH, buildFixture(), 'utf8'); });
test.afterAll(() => { try { fs.unlinkSync(FIXTURE_PATH); } catch (e) {} });

// ── 1. Budget dropdown ──────────────────────────────────────────────────────
test('budget dropdown: __milgReadSpaTuning returns the selected preset; Unlimited uncaps', async ({ page }) => {
  test.setTimeout(30000);
  await page.goto(ANALYZER_URL);
  await page.waitForFunction(() => !!(window.__milgReadSpaTuning && window.__milgSpaBudget), { timeout: 10000 });

  const out = await page.evaluate(() => {
    function pick(lvl) {
      var sel = document.getElementById('spaBudget');
      if (sel) { sel.value = lvl; sel.dispatchEvent(new Event('change')); }
      return window.__milgReadSpaTuning();
    }
    // Default (no change) should be medium.
    var def = window.__milgReadSpaTuning();
    return {
      def: def,
      low: pick('low'),
      medium: pick('medium'),
      high: pick('high'),
      unlimited: pick('unlimited'),
      budgets: window.__milgSpaBudgets
    };
  });

  // Default = medium preset (30 views / 90s / 8 passes).
  expect(out.def.maxViews).toBe(30);
  expect(out.def.timeBudgetMs).toBe(90000);
  expect(out.medium.maxViews).toBe(30);
  // Levels are ordered and distinct.
  expect(out.low.maxViews).toBeLessThan(out.medium.maxViews);
  expect(out.high.maxViews).toBeGreaterThan(out.medium.maxViews);
  // Unlimited truly uncaps — matches the exposed preset maxima, not a hosted ceiling.
  expect(out.unlimited.maxViews).toBe(out.budgets.unlimited.maxViews);
  expect(out.unlimited.maxViews).toBeGreaterThanOrEqual(250);
  expect(out.unlimited.timeBudgetMs).toBe(out.budgets.unlimited.timeSec * 1000);
  // captureScale still read independently.
  expect(out.def.captureScale === 1 || out.def.captureScale === 2).toBe(true);
});

// ── 2. Scrollable-pane capture (plain single-page analysis) ──────────────────
test('scroll pane becomes its own region screenshot (kind:scroll) with full content height', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(ANALYZER_URL);
  await page.click('[data-tab="tabUrl"]');
  await page.evaluate(() => {
    function set(id, on) { var c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
    set('screenshotCheck', true);      // region capture requires screenshots
    set('pixelVerifyCheck', false);
    set('spaExploreCheck', false);
    set('stateCaptureCheck', false);   // stay single-page (no crawl-UI divert)
    set('crawlSiteCheck', false);
  });
  await page.fill('#urlInput', FIXTURE_URL);
  await page.click('#analyzeUrlBtn');
  await page.waitForSelector('.report-container.visible', { timeout: 55000 });
  // Region screenshots are attached asynchronously after the main report renders.
  await page.waitForFunction(() => {
    var r = window.__milgLastReport;
    return !!(r && r.raw && Array.isArray(r.raw.regionScreenshots));
  }, { timeout: 20000 }).catch(() => {});

  const info = await page.evaluate(() => {
    var r = window.__milgLastReport;
    var regions = (r && r.raw && r.raw.regionScreenshots) || [];
    var scroll = regions.filter((x) => x && x.kind === 'scroll');
    var count = (r && r.raw && r.raw.layout && r.raw.layout.scrollRegionCount) || 0;
    return {
      total: regions.length,
      scrollCount: scroll.length,
      detected: count,
      sample: scroll[0] ? { canvasHeight: scroll[0].screenshotMeta && scroll[0].screenshotMeta.canvasHeight, hasShot: !!scroll[0].screenshot, label: scroll[0].label } : null
    };
  });

  // Detection fired on the overflow:auto pane…
  expect(info.detected).toBeGreaterThanOrEqual(1);
  // …and it produced its own region screenshot tagged kind:'scroll'.
  expect(info.scrollCount).toBeGreaterThanOrEqual(1);
  expect(info.sample && info.sample.hasShot).toBe(true);
  // The clone force-reveals overflow → the captured canvas is TALLER than the 200px visible pane
  // (its full scrollable content), which is the whole point.
  expect(info.sample.canvasHeight).toBeGreaterThan(200);
});

// ── 3. All-expanded state view now carries a screenshot ──────────────────────
test('All-expanded state view rasterizes the revealed DOM (hasShot + screenshots)', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(ANALYZER_URL);
  await page.click('[data-tab="tabUrl"]');
  await page.evaluate(() => {
    function set(id, on) { var c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
    set('screenshotCheck', true);
    set('pixelVerifyCheck', false);
    set('spaExploreCheck', false);
    set('stateCaptureCheck', true);    // 7 <details> ≥ threshold → holistic states run (crawl UI)
    set('crawlSiteCheck', false);
  });
  await page.fill('#urlInput', FIXTURE_URL);
  await page.click('#analyzeUrlBtn');

  // A disclosure-dense page diverts to the crawl UI; wait for that session to complete.
  await page.waitForFunction(() => {
    var s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
    return !!(s && s.status === 'complete');
  }, { timeout: 80000 });

  const found = await page.evaluate(() => {
    var s = MilgCrawlUI.getCrawlSession();
    var pages = (s && s.pages) || [];
    // The all-expanded holistic view surfaces as a page/view whose title/label mentions it.
    var hits = pages.filter((p) => /expanded/i.test((p.title || '') + ' ' + (p.label || '') + ' ' + (p.url || '')));
    var withShot = hits.filter((p) => p.rawData && p.rawData.screenshots && p.rawData.screenshots.length);
    return {
      pages: pages.length,
      expandedViews: hits.length,
      expandedWithShot: withShot.length,
      anyShot: withShot.length > 0
    };
  });

  expect(found.expandedViews).toBeGreaterThanOrEqual(1);
  // The key regression guard: the all-expanded view is no longer screenshot-less.
  expect(found.anyShot).toBe(true);
});
