// @ts-check
// Regression guard for the verify-box debug overlay cycle (none -> mask -> zones).
//
// The screenshot viewer lets a user right-click / double-click a pixel-verify box to
// cycle a debug overlay. This requires, end to end:
//   1. per-pair text-mask bitmaps (_maskBmp/_maskW/_maskDark) on the contrast pairs,
//   2. MilgContrastVerify using the EDGE method (which alone emits result._debug),
//   3. the viewer rendering rect[data-verify] with rect._debug set, and
//   4. _cycleDebug drawing/removing .milg-debug-overlay elements.
//
// This silently regressed once: a console/snippet capture exports per-pair masks +
// screenshots but NO precomputed _contrastVerifyResults, so on import the analyzer
// left pixel-verify OFF and never ran verification -> no verify boxes -> the right-
// click cycle had nothing to act on. Two cases are covered:
//   A) URL mode with pixel-verify enabled (the always-worked path), and
//   B) the snippet-capture -> Import flow (the regressed path).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE_URL = 'http://localhost:8384';
const ANALYZER_URL = `${BASE_URL}/analyzer.html`;
const FIXTURE_URL = `${BASE_URL}/tests/fixtures/parity-page.html`;

// Engine scripts needed to produce a real snippet-mode capture on the live page.
const SNIPPET_SCRIPTS = [
  'scoring/registry.js', 'scoring/contrast.js', 'scoring/typography.js',
  'scoring/spacing.js', 'scoring/touch.js', 'scoring/accessibility.js',
  'scoring/responsive.js', 'scoring/consistency.js', 'scoring/cognitive.js',
  'scoring/layout.js', 'scoring/performance.js', 'scoring/readability.js',
  'scoring/filters.js', 'scoring/balance.js',
  'analyzer-extract.js', 'analyzer-region.js', 'analyzer-capture.js',
];

// Open the screenshot viewer, switch to the pixel-verify filter, then simulate the
// right-click cycle on the first verify box that carries _debug. Returns the overlay
// state after each of the three contextmenu events.
async function openViewerAndCycle(page) {
  const thumb = page.locator('.report-screenshots img').first();
  await expect(thumb, 'screenshot thumbnail should be present').toHaveCount(1);
  await thumb.click();
  await page.waitForSelector('.milg-viewer-overlay.visible', { timeout: 10000 });
  const verifyBtn = page.locator('.milg-viewer-filter-btn[data-filter-type="verify"][data-filter-value="all"]').first();
  await expect(verifyBtn, 'a "Pixel Verified" filter button should exist (verify ran)').toHaveCount(1);
  await verifyBtn.click();
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const svg = document.querySelector('svg.milg-viewer-svg');
    const rects = svg ? Array.from(svg.querySelectorAll('rect[data-verify]')) : [];
    const wd = rects.find((r) => r._debug);
    if (!wd) return { verifyRects: rects.length, withDebug: 0 };
    const fire = () => wd.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const states = [];
    fire(); states.push({ mode: wd._debugMode, overlays: svg.querySelectorAll('.milg-debug-overlay').length });
    fire(); states.push({ mode: wd._debugMode, overlays: svg.querySelectorAll('.milg-debug-overlay').length });
    fire(); states.push({ mode: wd._debugMode, overlays: svg.querySelectorAll('.milg-debug-overlay').length });
    return { verifyRects: rects.length, withDebug: rects.filter((r) => r._debug).length, states };
  });
}

test.describe('Verify debug overlay cycle', () => {
  test('URL mode + pixel verify: verify boxes carry _debug and cycle none->mask->zones', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(ANALYZER_URL);
    await page.check('#screenshotCheck');
    await page.check('#pixelVerifyCheck');
    await page.click('[data-tab="tabUrl"]');
    await page.fill('#urlInput', FIXTURE_URL);
    await page.click('#analyzeUrlBtn');
    await page.waitForSelector('.report-container.visible', { timeout: 90000 });
    await page.waitForTimeout(3000);

    const verifyDbg = await page.evaluate(() => {
      const r = window.__milgLastReport;
      const vr = (r && r._contrastVerifyResults) || [];
      return { count: vr.length, withDebug: vr.filter((x) => x && x._debug).length };
    });
    expect(verifyDbg.count).toBeGreaterThan(0);
    expect(verifyDbg.withDebug, 'some verify results should carry _debug (edge method)').toBeGreaterThan(0);

    const cycle = await openViewerAndCycle(page);
    expect(cycle.withDebug).toBeGreaterThan(0);
    expect(cycle.states[0].mode).toBe('mask');
    expect(cycle.states[0].overlays).toBeGreaterThan(0);
    expect(cycle.states[1].mode).toBe('zones');
    expect(cycle.states[1].overlays).toBeGreaterThan(0);
    expect(cycle.states[2].mode).toBe('none');
    expect(cycle.states[2].overlays).toBe(0);
  });

  test('snippet capture -> import: verify runs so boxes carry _debug and cycle works', async ({ page, context }) => {
    test.setTimeout(150000);

    // Produce a real snippet-mode JSON (per-pair masks + screenshots, NO precomputed
    // _contrastVerifyResults) exactly as the console snippet's outputData() does.
    const capPage = await context.newPage();
    await capPage.setViewportSize({ width: 1280, height: 900 });
    await capPage.goto(FIXTURE_URL);
    for (const s of SNIPPET_SCRIPTS) await capPage.addScriptTag({ url: `${BASE_URL}/${s}?v=verifydbg` });
    const json = await capPage.evaluate(async () => {
      const data = await new Promise((resolve) => {
        window.__milgOnExtractComplete = (d) => resolve(d);
        window.MilgExtract();
      });
      window.__milgData = data;
      const _pre = (_p, done) => done();
      const _pl = (_p, _u, done) => done();
      await new Promise((resolve) => {
        function _send(payload) {
          if (window.__milgCapDone) return; window.__milgCapDone = true;
          data.screenshots = payload.screenshots || [];
          data.screenshotFull = payload.screenshotFull || null;
          data.screenshotClean = payload.screenshotClean || null;
          data.screenshotCleanMeta = payload.screenshotCleanMeta || null;
          data.textMask = payload.textMask || null;
          data.screenshotMeta = payload.screenshotMeta || null;
          data.regionScreenshots = payload.regionScreenshots || [];
          const ud = payload.updatedData;
          if (ud && ud.colors && ud.colors.contrastPairs && data.colors) data.colors.contrastPairs = ud.colors.contrastPairs;
          resolve();
        }
        const opts = {
          msgType: 'milg-screenshots-result',
          cdnUrl: 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js',
          proxyUrl: '', expand: true,
          preHookSrc: _pre.toString(), preloadSrc: _pl.toString(),
          regionFnSrc: window.MilgRegion.getRegionFn().toString(),
          sendFn: _send,
        };
        window.MilgCapture.getCaptureFn()(1.5, 0.8, () => {}, opts)(() => {});
      });
      return JSON.stringify(data);
    });
    await capPage.close();

    // Sanity: the snippet export has masks + screenshots but no precomputed verify.
    const parsed = JSON.parse(json);
    expect(parsed._contrastVerifyResults, 'snippet export has no precomputed verify results').toBeFalsy();
    expect((parsed.colors.contrastPairs || []).some((p) => p._maskBmp && p._maskDark > 0)).toBe(true);
    expect(parsed.screenshots && parsed.screenshots.length).toBeTruthy();
    expect(parsed.screenshotMeta).toBeTruthy();

    const tmpFile = path.join(os.tmpdir(), 'milg-verify-debug-import.json');
    fs.writeFileSync(tmpFile, json);

    // Import via the analyzer's Import-JSON file input (the real user path).
    await page.goto(ANALYZER_URL);
    await page.setInputFiles('#importJsonFile', tmpFile);
    await page.waitForSelector('.report-container.visible', { timeout: 60000 });
    await page.waitForTimeout(4000);

    const afterImport = await page.evaluate(() => {
      const r = window.__milgLastReport;
      const vr = (r && r._contrastVerifyResults) || [];
      return { count: vr.length, withDebug: vr.filter((x) => x && x._debug).length };
    });
    // The fix enables pixel verify on import when masks+screenshots are present.
    expect(afterImport.count, 'verify should run on snippet import').toBeGreaterThan(0);
    expect(afterImport.withDebug, 'imported verify results should carry _debug').toBeGreaterThan(0);

    const cycle = await openViewerAndCycle(page);
    expect(cycle.withDebug).toBeGreaterThan(0);
    expect(cycle.states[0].mode).toBe('mask');
    expect(cycle.states[0].overlays).toBeGreaterThan(0);
    expect(cycle.states[1].mode).toBe('zones');
    expect(cycle.states[1].overlays).toBeGreaterThan(0);
    expect(cycle.states[2].mode).toBe('none');
    expect(cycle.states[2].overlays).toBe(0);
  });
});
