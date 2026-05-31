// @ts-check
// CROSS-MODE PARITY TEST
//
// Proves and guards that URL/iframe mode and console-snippet mode produce VERY
// SIMILAR analysis results on the SAME page. Both live modes share one capture
// core (window.MilgCapture) and the same extraction engine (window.MilgExtract)
// + scoring (window.MilgScoring.runScoring). Given the same rendered DOM the
// results should match closely; the only residual differences come from
// srcdoc-iframe vs live-page rendering fidelity and viewport WIDTH.
//
// Fixture: docs/tests/fixtures/parity-page.html — a SELF-CONTAINED full HTML
// document with ONLY inline CSS (no CDN, no web fonts), so URL mode (which uses
// the document as-is when it has <html>/<!DOCTYPE> — see analyzer-iframe.js
// ~L559) and snippet mode (live page) render it identically. It contains:
//   - 4 passing contrast pairs + 2 deliberate low-contrast failures
//   - h1/h2/h3 headings, an OK 44px button and a too-small button
//   - ONE overflow:hidden carousel-like container with 2 off-screen slides
//     so region capture fires in BOTH modes.
//
// URL mode: drive the analyzer UI against the served fixture, read the report
//   from window.__milgLastReport (the analyzer exposes the full runScoring()
//   output there — see analyzer.js L813).
//
// Snippet mode: the console snippet inlines MilgExtract + MilgRegion +
//   MilgCapture and runs them against the LIVE page, then the analyzer scores
//   the resulting `data` with MilgScoring.runScoring(). We reproduce exactly
//   that: load the SAME scoring + extract + region modules onto the live
//   fixture page (same scripts/order as analyzer.html), run MilgExtract() to
//   build `data`, run MilgRegion's marking pre-pass (the shared clip-region
//   detection the capture pipeline always runs — tags _regionContainerId and
//   counts clip containers), then apply the SAME region-content filter the
//   analyzer applies before main scoring (analyzer.js L760-786) and run
//   MilgScoring.runScoring(data). This is the real snippet-mode code path.
//
// TOLERANCES (documented):
//   overallScore      : ±3 points  — absorbs subpixel/font-rendering noise
//   contrastPairCount : ±1         — one borderline pair may resolve differently
//   regionCount       : exact (==) — region detection is pure DOM geometry,
//                                    must be identical across modes
//   totalFindings     : ±4         — a couple of pass/near-miss findings can
//                                    shift with a 1-pair delta
//   contrast category : ±4 points  — the category most sensitive to pairs
// These are tight enough to catch a real unification regression but loose
// enough to absorb pure rendering noise.

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8384';
const ANALYZER_URL = `${BASE_URL}/analyzer.html`;
const FIXTURE_URL = `${BASE_URL}/tests/fixtures/parity-page.html`;
const WIDTH = 1280; // match URL mode's default analysis viewport width

// Scoring + extraction + region scripts, in the SAME order analyzer.html loads
// them. Region needs MilgExtract defined first (it self-injects into mini-pages).
const SCORING_SCRIPTS = [
  'scoring/registry.js', 'scoring/contrast.js', 'scoring/typography.js',
  'scoring/spacing.js', 'scoring/touch.js', 'scoring/accessibility.js',
  'scoring/responsive.js', 'scoring/consistency.js', 'scoring/cognitive.js',
  'scoring/layout.js', 'scoring/performance.js', 'scoring/readability.js',
  'scoring/filters.js', 'scoring/balance.js',
];
const ENGINE_SCRIPTS = ['analyzer-extract.js', 'analyzer-region.js'];

test.describe('Cross-Mode Parity', () => {

  test('URL mode and snippet mode produce very similar results on the same page', async ({ page, context }) => {
    test.setTimeout(180000);

    // ── URL MODE ──────────────────────────────────────────────────────────
    await page.setViewportSize({ width: WIDTH, height: 900 });
    await page.goto(ANALYZER_URL);
    await page.click('[data-tab="tabUrl"]');
    await page.fill('#urlInput', FIXTURE_URL);
    await page.click('#analyzeUrlBtn');
    await page.waitForSelector('.report-container.visible', { timeout: 90000 });

    const urlSummary = await page.evaluate(() => {
      const r = window.__milgLastReport;
      if (!r) return null;
      const cats = r.categories || [];
      const contrastCat = cats.find((c) => c.label === 'Color & Contrast') || {};
      const raw = r.raw || {};
      const pairs = (raw.colors && raw.colors.contrastPairs) || [];
      let totalFindings = 0;
      cats.forEach((c) => { totalFindings += (c.findings || []).length; });
      return {
        overall: r.overall,
        contrastScore: contrastCat.score,
        contrastPairCount: pairs.length,
        regionCount: (raw.regionScreenshots || []).length,
        totalFindings,
      };
    });
    expect(urlSummary, 'window.__milgLastReport should be populated in URL mode').not.toBeNull();

    // ── SNIPPET MODE ──────────────────────────────────────────────────────
    // Fresh page, SAME fixture, SAME width. Load the live capture/score modules
    // exactly as analyzer.html does, then run the real snippet code path.
    const snippetPage = await context.newPage();
    await snippetPage.setViewportSize({ width: WIDTH, height: 900 });
    await snippetPage.goto(FIXTURE_URL);

    const cacheBust = '?v=parity';
    for (const src of [...SCORING_SCRIPTS, ...ENGINE_SCRIPTS]) {
      await snippetPage.addScriptTag({ url: `${BASE_URL}/${src}${cacheBust}` });
    }

    const snippetSummary = await snippetPage.evaluate(async () => {
      // 1. Run extraction against the LIVE page (this is what the snippet's
      //    inlined MilgExtract does). It populates window.__milgData and
      //    window.__milgBboxRefs synchronously via the onComplete callback.
      const data = await new Promise((resolve) => {
        window.__milgOnExtractComplete = function (d) { resolve(d); };
        window.MilgExtract();
      });

      // 2. Run MilgRegion's marking pre-pass — the shared clip-region detection
      //    the capture pipeline runs in BOTH modes. getClipDetectionScript()
      //    tags pair._isClipped / pair._regionContainerId on the live DOM.
      //    Then count distinct clip containers the same way region capture does.
      // eslint-disable-next-line no-eval
      eval(window.MilgRegion.getClipDetectionScript());

      // Count clip containers (>=100x30) that actually contain a clipped pair —
      // identical geometry to _regionScreenshotFn's _clipContainerList, clamped
      // to 5 like the capture pipeline does.
      const seen = new Set();
      (window.__milgBboxRefs || []).forEach((ref) => {
        if (!ref.el || !ref.obj || ref.key !== 'bbox' || !ref.obj._isClipped) return;
        let anc = ref.el.parentElement;
        while (anc && anc !== document.documentElement) {
          const cs = getComputedStyle(anc);
          const ov = cs.overflow || '', ovx = cs.overflowX || '', ovy = cs.overflowY || '';
          if (ov === 'hidden' || ov === 'clip' || ovx === 'hidden' || ovx === 'clip' || ovy === 'hidden' || ovy === 'clip') {
            const ar = anc.getBoundingClientRect();
            if (ar.width >= 100 && ar.height >= 30) { seen.add(anc); break; }
          }
          anc = anc.parentElement;
        }
      });
      const regionCount = Math.min(seen.size, 5);

      // 3. Apply the SAME region-content filter the analyzer applies before
      //    main scoring (analyzer.js L760-786): region pairs/elements are
      //    excluded from the main page score (they get scored separately).
      const origPairs = data.colors ? data.colors.contrastPairs : null;
      const origTouch = data.interaction ? data.interaction.touchTargets : null;
      const origHeadings = data.typography ? data.typography.headings : null;
      const origAlign = data.layout ? data.layout.alignmentElements : null;
      const origRadii = data.layout ? data.layout.borderRadii : null;
      if (origPairs) data.colors.contrastPairs = origPairs.filter((cp) => !cp._regionContainerId);
      if (origTouch) data.interaction.touchTargets = origTouch.filter((t) => !t._regionContainerId);
      if (origHeadings) data.typography.headings = origHeadings.filter((h) => !h._regionContainerId);
      if (origAlign) data.layout.alignmentElements = origAlign.filter((a) => !a._regionContainerId);
      if (origRadii) data.layout.borderRadii = origRadii.filter((r) => {
        if (!r.bboxes || r.bboxes.length === 0) return true;
        return r.bboxes.some((b) => !b._rcid);
      });

      const report = window.MilgScoring.runScoring(data);

      // Restore originals (mirror analyzer.js) — not strictly needed here.
      if (origPairs) data.colors.contrastPairs = origPairs;

      const cats = report.categories || [];
      const contrastCat = cats.find((c) => c.label === 'Color & Contrast') || {};
      const pairs = (report.raw.colors && report.raw.colors.contrastPairs) || [];
      let totalFindings = 0;
      cats.forEach((c) => { totalFindings += (c.findings || []).length; });
      return {
        overall: report.overall,
        contrastScore: contrastCat.score,
        contrastPairCount: pairs.length,
        regionCount,
        totalFindings,
      };
    });

    // ── SIDE-BY-SIDE REPORT ────────────────────────────────────────────────
    console.log('\n=== CROSS-MODE PARITY (width ' + WIDTH + ') ===');
    console.log('metric              | URL mode | snippet mode');
    console.log('--------------------|----------|-------------');
    const rows = [
      ['overall score', urlSummary.overall, snippetSummary.overall],
      ['contrast score', urlSummary.contrastScore, snippetSummary.contrastScore],
      ['contrast pairs', urlSummary.contrastPairCount, snippetSummary.contrastPairCount],
      ['region count', urlSummary.regionCount, snippetSummary.regionCount],
      ['total findings', urlSummary.totalFindings, snippetSummary.totalFindings],
    ];
    rows.forEach(([k, a, b]) => {
      console.log(String(k).padEnd(19) + ' | ' + String(a).padEnd(8) + ' | ' + String(b));
    });
    console.log('');

    // ── ASSERTIONS (tolerances documented at top of file) ──────────────────
    expect(Math.abs(urlSummary.overall - snippetSummary.overall),
      'overall score within ±3').toBeLessThanOrEqual(3);
    expect(Math.abs(urlSummary.contrastScore - snippetSummary.contrastScore),
      'contrast category score within ±4').toBeLessThanOrEqual(4);
    expect(Math.abs(urlSummary.contrastPairCount - snippetSummary.contrastPairCount),
      'contrast pair count within ±1').toBeLessThanOrEqual(1);
    expect(urlSummary.regionCount,
      'region count must be identical').toBe(snippetSummary.regionCount);
    expect(Math.abs(urlSummary.totalFindings - snippetSummary.totalFindings),
      'total findings within ±4').toBeLessThanOrEqual(4);

    await snippetPage.close();
  });
});
