// @ts-check
// Regression guard for the SPA / no-mask GRID contrast path (analyzer-contrast-verify.js
// verifyPairGrid). SPA-explored views carry no render-based glyph mask, so pixel-verify runs
// through the grid sampler. Two bugs this locks down (both reported live on SPA views):
//
//   Fix A — each samplePoints.fg entry must carry its OWN paired bg pixel (bgX/bgY). The grid
//   path's paired-bg list is deduped/reordered, so if fg entries lack bgX/bgY the viewer's
//   normalizeSamplePoints falls back to index-pairing fg[i]↔bg[i] and draws the compare dot to
//   an unrelated far-away pixel ("compare pixels are halfway across the picture").
//
//   Fix B — the grid result must attach a `_debug` mask (derived from the colour-classified
//   grid) so the viewer's right-click none→mask→zones cycle has something to show on SPA boxes
//   (previously a no-op: grid results had no `_debug`).
//
// The test drives the exported MilgContrastVerify.verify() with a maskless pair over a
// canvas-drawn black-on-white text region — the same shape the SPA path produces.
const { test, expect } = require('@playwright/test');

const ANALYZER_URL = 'http://localhost:8384/analyzer.html';

test('SPA grid path: fg samples carry their own bg pair + a debug mask', async ({ page }) => {
  test.setTimeout(30000);
  await page.goto(ANALYZER_URL);
  await page.waitForFunction(() => !!(window.MilgContrastVerify && window.MilgContrastVerify.verify), { timeout: 10000 });

  const out = await page.evaluate(() => new Promise((resolve) => {
    // Draw a maskless "screenshot": black text on solid white, scale=1 so canvas px == page px.
    var c = document.createElement('canvas');
    c.width = 400; c.height = 140;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000'; ctx.font = 'bold 28px system-ui';
    ctx.textBaseline = 'top';
    ctx.fillText('Hello World Sample', 20, 40);
    var uri = c.toDataURL('image/png');

    var bbox = { left: 18, top: 38, width: 300, height: 40 };
    var report = {
      raw: {
        screenshots: [uri],
        screenshotMeta: { scale: 1, viewportHeight: 140, cropOffsetX: 0, cropOffsetY: 0 },
        colors: { contrastPairs: [{
          bbox: bbox, fg: 'rgb(0,0,0)', bg: 'rgb(255,255,255)',
          ratio: 21, needed: 4.5, selector: '#t', text: 'Hello World Sample', fontSize: 28
        }] }
      }
    };
    window.MilgContrastVerify.verify(report, function(results) {
      var r = (results || [])[0] || null;
      resolve({ r: r, bbox: bbox });
    });
  }));

  expect(out.r, 'grid path produced a verify result').not.toBeNull();
  const r = out.r;

  // Fix B — debug mask present, from the grid, sized to the bbox canvas region.
  expect(r._debug, 'result carries a _debug payload for the right-click mask cycle').toBeTruthy();
  expect(r._debug.method).toBe('grid');
  expect(Array.isArray(r._debug.mask)).toBe(true);
  expect(r._debug.mask.length).toBe(r._debug.bw * r._debug.bh);
  expect(r._debug.mask.some((v) => v === 1), 'mask marks some text pixels').toBe(true);

  // Fix A — every fg sample has its OWN bg pair, and that bg is CLOSE (never "halfway across").
  const fg = r.samplePoints && r.samplePoints.fg;
  expect(Array.isArray(fg) && fg.length > 0, 'grid path emitted fg sample points').toBe(true);
  const diag = Math.hypot(out.bbox.width, out.bbox.height); // bbox diagonal at scale=1
  for (const p of fg) {
    expect(typeof p.bgX === 'number' && typeof p.bgY === 'number',
      'each fg sample carries its paired bgX/bgY').toBe(true);
    const dist = Math.hypot(p.x - p.bgX, p.y - p.bgY);
    // The paired bg is the NEAREST bg pixel to this fg — it must sit within the element, i.e.
    // well inside the bbox diagonal. The pre-fix index-pairing bug produced distances far beyond
    // this (linking to unrelated pixels across the image).
    expect(dist, `fg→bg compare distance (${dist.toFixed(1)}px) is local, not across the image`)
      .toBeLessThanOrEqual(diag);
  }
});

test('SPA grid path: BG compare pixels may come from OUTSIDE a text-filled bbox', async ({ page }) => {
  // When text/ink fills its whole bbox there is no background INSIDE it, so the grid sampler must
  // reach a few px outside (dead-zone-excluded) for the compare pixel — else it finds no bg and
  // abstains entirely. Guard: a solid black bar on white, bbox == the bar. Pre-fix the grid found
  // zero in-bbox bg and returned null; now it samples the surrounding white and reports ~21:1 with
  // at least one bg point beyond the bbox edge.
  test.setTimeout(30000);
  await page.goto(ANALYZER_URL);
  await page.waitForFunction(() => !!(window.MilgContrastVerify && window.MilgContrastVerify.verify), { timeout: 10000 });

  const out = await page.evaluate(() => new Promise((resolve) => {
    var c = document.createElement('canvas');
    c.width = 240; c.height = 120;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000'; ctx.fillRect(60, 40, 120, 40); // solid ink fills the whole bbox
    var uri = c.toDataURL('image/png');
    var bbox = { left: 60, top: 40, width: 120, height: 40 };
    var report = { raw: {
      screenshots: [uri],
      screenshotMeta: { scale: 1, viewportHeight: 120, cropOffsetX: 0, cropOffsetY: 0 },
      colors: { contrastPairs: [{ bbox: bbox, fg: 'rgb(0,0,0)', bg: 'rgb(255,255,255)', ratio: 21, needed: 4.5, selector: '#bar', text: 'BAR', fontSize: 40 }] }
    } };
    window.MilgContrastVerify.verify(report, function(results) { resolve({ r: (results || [])[0] || null, bbox: bbox }); });
  }));

  expect(out.r, 'grid path found background outside the bbox and produced a result').not.toBeNull();
  const b = out.bbox;
  const bg = out.r.samplePoints && out.r.samplePoints.bg;
  expect(Array.isArray(bg) && bg.length > 0, 'bg sample points exist').toBe(true);
  const anyOutside = bg.some((p) => p.x < b.left || p.x >= b.left + b.width || p.y < b.top || p.y >= b.top + b.height);
  expect(anyOutside, 'at least one bg compare pixel lies outside the text-filled bbox').toBe(true);
  // Black ink on white → high measured contrast (sanity that the outside pixels are the real bg).
  expect(out.r.pixelRatio).toBeGreaterThan(10);
});
