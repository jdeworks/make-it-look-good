// @ts-check
// Regression guard for two silently-regressing viewer geometry bugs:
//   Bug 1 — region overlay boxes drift (proportional): the region SVG was sized to
//           the scroll FRAME (width/height:100%) instead of the IMAGE's rendered box,
//           so when the image was smaller/larger than the frame the SVG scaled
//           differently from the image → overlay rects offset proportionally.
//   Bug 2 — main screenshot zoom cut off the right side: the .milg-viewer-frame
//           (display:inline-block; max-width:95vw) stayed ~95vw while the image grew
//           on zoom, so the image overflowed the frame and most of it was unreachable.
//
// Both are invisible to functional tests but are pure geometry, so we assert the
// numbers directly: SVG render box == image render box (region), viewBox == image
// natural dims, and frame width == image width at high zoom.
const { test, expect } = require('@playwright/test');

const ANALYZER_URL = 'http://localhost:8384/analyzer.html';
const BASE_URL = 'http://localhost:8384';
// Vertical-clip carousel: region image is narrower than the viewer AND taller than the
// frame's max-height cap — exactly the condition that exposed Bug 1.
const FIXTURE = `${BASE_URL}/tests/fixtures/carousel-vexpand.html`;

test('viewer overlay geometry: region SVG tracks image, zoom does not clip', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto(ANALYZER_URL);
  await page.check('#screenshotCheck');
  await page.click('[data-tab="tabUrl"]');
  await page.fill('#urlInput', FIXTURE);
  await page.click('#analyzeUrlBtn');
  await page.waitForSelector('.report-container.visible', { timeout: 120000 });

  // Open the viewer
  const img = page.locator('.report-screenshots img').first();
  await img.waitFor({ state: 'visible', timeout: 10000 });
  await img.click();
  await page.waitForSelector('.milg-viewer-overlay.visible', { timeout: 10000 });
  await page.waitForTimeout(500);

  // --- MAIN: viewBox must equal the displayed image's natural dimensions ---
  const main = await page.evaluate(() => {
    const im = document.querySelector('.milg-viewer-img');
    const svg = document.querySelector('svg.milg-viewer-svg');
    return { natural: { w: im.naturalWidth, h: im.naturalHeight }, viewBox: svg.getAttribute('viewBox') };
  });
  expect(main.viewBox).toBe(`0 0 ${main.natural.w} ${main.natural.h}`);

  // Activate a filter so region overlays render.
  const allBtn = page.locator('.milg-viewer-filter-btn[data-filter-value="all"]').first();
  if (await allBtn.count()) { await allBtn.click(); await page.waitForTimeout(400); }

  // --- BUG 1: region SVG render box must match the region IMAGE render box exactly ---
  const regions = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.milg-viewer-region-section')).map(s => {
      const im = s.querySelector('img');
      const svg = s.querySelector('svg');
      const ir = im.getBoundingClientRect(), sr = svg.getBoundingClientRect();
      return {
        img: { w: Math.round(ir.width), h: Math.round(ir.height), left: Math.round(ir.left), top: Math.round(ir.top) },
        svg: { w: Math.round(sr.width), h: Math.round(sr.height), left: Math.round(sr.left), top: Math.round(sr.top) },
        natural: { w: im.naturalWidth, h: im.naturalHeight },
        viewBox: svg.getAttribute('viewBox'),
      };
    });
  });
  expect(regions.length).toBeGreaterThan(0);
  for (const r of regions) {
    // Region image must be narrower than the viewer here (the bug-triggering case)
    // — but the assertion holds regardless: SVG box == image box, within 1px.
    expect(Math.abs(r.svg.w - r.img.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.svg.h - r.img.h)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.svg.left - r.img.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.svg.top - r.img.top)).toBeLessThanOrEqual(1);
    // viewBox encodes the canvas dims == image natural dims
    expect(r.viewBox).toBe(`0 0 ${r.natural.w} ${r.natural.h}`);
  }

  // --- BUG 2: at high zoom the frame must grow to the image, not clip it ---
  await page.locator('.milg-viewer-zoom-select').selectOption('3');
  await page.waitForTimeout(400);
  const zoom = await page.evaluate(() => {
    const fr = document.querySelector('.milg-viewer-frame');
    const im = document.querySelector('.milg-viewer-img');
    const svg = document.querySelector('svg.milg-viewer-svg');
    const f = fr.getBoundingClientRect(), i = im.getBoundingClientRect(), s = svg.getBoundingClientRect();
    return {
      frame: { w: Math.round(f.width), h: Math.round(f.height) },
      img: { w: Math.round(i.width), h: Math.round(i.height) },
      svg: { w: Math.round(s.width), h: Math.round(s.height) },
    };
  });
  // Frame must be at least as wide as the image (no right-side cutoff) and SVG must
  // still track the image so overlays stay aligned when zoomed.
  expect(zoom.frame.w).toBeGreaterThanOrEqual(zoom.img.w - 1);
  expect(Math.abs(zoom.svg.w - zoom.img.w)).toBeLessThanOrEqual(1);
  expect(Math.abs(zoom.svg.h - zoom.img.h)).toBeLessThanOrEqual(1);
});
