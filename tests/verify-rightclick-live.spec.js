// @ts-check
// Regression guard for the verify-box right-click behaviour using REAL mouse clicks
// (page.mouse.click with button:'right'), exercising real hit-testing + filter state.
//
// Why this exists separately from verify-debug-overlay.spec.js: that spec dispatches a
// contextmenu event STRAIGHT on the rect element, which bypasses (a) browser hit-testing
// (so it can't catch a box scrolled out of view or covered by another element) and
// (b) filter state (so it can't catch that the mask cycle only lives on the Pixel-Verified
// overlay). v3.11.20 traced a "right-click doesn't cycle the mask" report to exactly that
// gap: the user was right-clicking *finding* boxes (a findings filter), where right-click
// opens the copy-debug menu — the none->mask->zones cycle only exists on rect[data-verify].
//
// These tests therefore assert, with a genuine right-click:
//   1. URL-mode MAIN verify box cycles none->mask->zones->none,
//   2. URL-mode REGION verify box (separate _rvCycleDebug path) cycles too,
//   3. under a FINDINGS filter, right-click opens the copy-debug menu, NOT the cycle,
//   4. the v3.11.20 discoverability aids are present (button pulse + verify-overlay hint).
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8384';
const ANALYZER_URL = `${BASE_URL}/analyzer.html`;
const FIXTURE_URL = `${BASE_URL}/tests/fixtures/parity-page.html`;

// Tag the first verify rect carrying _debug inside `root` (a DOM scope), scroll it into
// view, and return its on-screen centre. `root` is evaluated in the page.
async function tagAndLocate(page, rootSelector) {
  const ok = await page.evaluate((sel) => {
    const scope = sel ? document.querySelector(sel) : document;
    if (!scope) return false;
    const svg = sel ? scope.querySelector('svg') : document.querySelector('svg.milg-viewer-svg');
    document.querySelectorAll('rect[data-repro]').forEach((r) => r.removeAttribute('data-repro'));
    const rects = svg ? Array.from(svg.querySelectorAll('rect[data-verify]')).filter((r) => r._debug) : [];
    for (const wd of rects) {
      if (sel) {
        const section = wd.closest('.milg-viewer-region-section');
        const frame = section && section.querySelector('div[style*="overflow"]');
        const img = section && section.querySelector('img');
        if (frame && img && img.naturalWidth) {
          const scale = img.offsetWidth / img.naturalWidth;
          const x = parseFloat(wd.getAttribute('x')) || 0;
          const y = parseFloat(wd.getAttribute('y')) || 0;
          frame.scrollLeft = Math.max(0, x * scale - frame.clientWidth / 2);
          frame.scrollTop = Math.max(0, y * scale - frame.clientHeight / 2);
        }
      }
      wd.scrollIntoView({ block: 'center', inline: 'center' });
      const b = wd.getBoundingClientRect();
      const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if (el === wd) {
        wd.setAttribute('data-repro', '1');
        return true;
      }
    }
    return false;
  }, rootSelector);
  if (!ok) return null;
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const wd = document.querySelector('rect[data-repro]');
    const r = wd.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, hitsRect: el === wd };
  });
}

async function tagAndLocateSample(page, rootSelector) {
  const ok = await page.evaluate((sel) => {
    const scope = sel ? document.querySelector(sel) : document;
    if (!scope) return false;
    const svg = sel ? scope.querySelector('svg') : document.querySelector('svg.milg-viewer-svg');
    document.querySelectorAll('rect[data-repro]').forEach((r) => r.removeAttribute('data-repro'));
    const rects = svg ? Array.from(svg.querySelectorAll('rect[data-verify]')).filter((r) => r._samplePoints && r._samplePoints.fg && r._samplePoints.fg.length) : [];
    for (const wd of rects) {
      const section = wd.closest('.milg-viewer-region-section');
      const frame = section && section.querySelector('div[style*="overflow"]');
      const img = section && section.querySelector('img');
      if (frame && img && img.naturalWidth) {
        const scale = img.offsetWidth / img.naturalWidth;
        const x = parseFloat(wd.getAttribute('x')) || 0;
        const y = parseFloat(wd.getAttribute('y')) || 0;
        frame.scrollLeft = Math.max(0, x * scale - frame.clientWidth / 2);
        frame.scrollTop = Math.max(0, y * scale - frame.clientHeight / 2);
      }
      wd.scrollIntoView({ block: 'center', inline: 'center' });
      const b = wd.getBoundingClientRect();
      const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if (el === wd) {
        wd.setAttribute('data-repro', '1');
        return true;
      }
    }
    return false;
  }, rootSelector);
  if (!ok) return null;
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const wd = document.querySelector('rect[data-repro]');
    const r = wd.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, hitsRect: el === wd };
  });
}

const readState = (page) => page.evaluate(() => {
  const wd = document.querySelector('rect[data-repro]');
  const svg = wd.ownerSVGElement;
  return { mode: wd._debugMode || 'none', overlays: svg.querySelectorAll('.milg-debug-overlay').length };
});

test.describe.configure({ mode: 'serial' });

test.describe('Verify-box right-click (real mouse)', () => {
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(ANALYZER_URL);
    await page.check('#screenshotCheck');
    await page.check('#pixelVerifyCheck');
    await page.click('[data-tab="tabUrl"]');
    await page.fill('#urlInput', FIXTURE_URL);
    await page.click('#analyzeUrlBtn');
    await page.waitForSelector('.report-container.visible', { timeout: 90000 });
    await page.waitForTimeout(3000);
    await page.locator('.report-screenshots img').first().click();
    await page.waitForSelector('.milg-viewer-overlay.visible', { timeout: 10000 });
  });

  test.afterAll(async () => { await page.close(); });

  test('discoverability: Pixel Verified button pulses + tooltip', async () => {
    const btn = await page.evaluate(() => {
      const b = document.querySelector('.milg-viewer-filter-btn[data-filter-type="verify"][data-filter-value="all"]');
      if (!b) return null;
      return { hl: b.classList.contains('milg-viewer-verify-hl'),
        anim: getComputedStyle(b).animationName, title: b.getAttribute('title') || '' };
    });
    expect(btn, 'Pixel Verified button should exist (verify ran)').not.toBeNull();
    expect(btn.hl, 'button carries the highlight class').toBe(true);
    expect(btn.anim).toContain('milg-verify-pulse');
    expect(btn.title.toLowerCase()).toContain('right-click');
  });

  test('MAIN verify box: real right-click cycles none->mask->zones->none', async () => {
    await page.locator('.milg-viewer-filter-btn[data-filter-type="verify"][data-filter-value="all"]').click();
    await page.waitForTimeout(400);

    // The verify overlay shows the right-click hint.
    const hint = await page.evaluate(() => {
      const h = document.querySelector('.milg-viewer-content .milg-viewer-hint');
      return h ? h.textContent : null;
    });
    expect(hint, 'verify overlay shows a hint').toBeTruthy();
    expect(hint).toMatch(/right-click/i);
    expect(hint).toMatch(/mask/i);

    const loc = await tagAndLocate(page, null);
    expect(loc, 'a main verify box with _debug exists').not.toBeNull();
    expect(loc.hitsRect, 'the box centre is actually the topmost element (real hit-test)').toBe(true);

    await page.mouse.click(loc.cx, loc.cy, { button: 'right' });
    await page.waitForTimeout(150);
    let s = await readState(page);
    expect(s.mode).toBe('mask');
    expect(s.overlays).toBeGreaterThan(0);

    await page.mouse.click(loc.cx, loc.cy, { button: 'right' });
    await page.waitForTimeout(150);
    s = await readState(page);
    expect(s.mode).toBe('zones');
    expect(s.overlays).toBeGreaterThan(0);

    await page.mouse.click(loc.cx, loc.cy, { button: 'right' });
    await page.waitForTimeout(150);
    s = await readState(page);
    expect(s.mode).toBe('none');
    expect(s.overlays).toBe(0);
  });

  test('REGION verify box: real right-click cycles (separate _rvCycleDebug path)', async () => {
    // Verify filter is already active from the previous test; ensure region overlays exist.
    const hasRegion = await page.evaluate(() => {
      const secs = Array.from(document.querySelectorAll('.milg-viewer-region-section'));
      return secs.some((s) => { const svg = s.querySelector('svg'); return svg && Array.from(svg.querySelectorAll('rect[data-verify]')).some((r) => r._debug); });
    });
    test.skip(!hasRegion, 'fixture produced no region verify box with _debug');

    const loc = await tagAndLocate(page, '.milg-viewer-region-section');
    expect(loc, 'a region verify box with _debug exists').not.toBeNull();
    expect(loc.hitsRect, 'region box centre is the topmost element').toBe(true);

    const seq = [];
    for (let i = 0; i < 3; i++) {
      await page.mouse.click(loc.cx, loc.cy, { button: 'right' });
      await page.waitForTimeout(150);
      seq.push(await readState(page));
    }
    expect(seq[0].mode).toBe('mask');
    expect(seq[0].overlays).toBeGreaterThan(0);
    expect(seq[1].mode).toBe('zones');
    expect(seq[1].overlays).toBeGreaterThan(0);
    expect(seq[2].mode).toBe('none');
    expect(seq[2].overlays).toBe(0);
  });

  test('REGION verify box: real left-click shows sample dots', async () => {
    const hasRegion = await page.evaluate(() => {
      const secs = Array.from(document.querySelectorAll('.milg-viewer-region-section'));
      return secs.some((s) => { const svg = s.querySelector('svg'); return svg && Array.from(svg.querySelectorAll('rect[data-verify]')).some((r) => r._samplePoints && r._samplePoints.fg && r._samplePoints.fg.length); });
    });
    test.skip(!hasRegion, 'fixture produced no region verify box with sample points');

    const loc = await tagAndLocateSample(page, '.milg-viewer-region-section');
    expect(loc, 'a region verify box with sample points exists').not.toBeNull();
    expect(loc.hitsRect, 'region box centre is the topmost element').toBe(true);

    await page.mouse.click(loc.cx, loc.cy, { button: 'left' });
    await page.waitForTimeout(200);
    const dots = await page.evaluate(() => {
      const repro = document.querySelector('rect[data-repro]');
      const svg = repro && repro.ownerSVGElement;
      return svg ? svg.querySelectorAll('.milg-sample-dot').length : 0;
    });
    expect(dots).toBeGreaterThan(0);
  });

  test('FINDINGS filter: real right-click opens the copy-debug menu, not the cycle', async () => {
    // Switch to a findings filter — this must clear the verify hint and show finding boxes.
    await page.locator('.milg-viewer-filter-btn[data-filter-type="category"]').first().click();
    await page.waitForTimeout(400);

    const clearedHint = await page.evaluate(() => {
      const h = document.querySelector('.milg-viewer-content .milg-viewer-hint');
      return !h || !/right-click/i.test(h.textContent || '');
    });
    expect(clearedHint, 'verify hint is removed under a findings filter').toBe(true);

    const loc = await page.evaluate(() => {
      const svg = document.querySelector('svg.milg-viewer-svg');
      const r = svg && svg.querySelector('rect[data-finding]');
      if (!r) return null;
      r.scrollIntoView({ block: 'center' });
      const b = r.getBoundingClientRect();
      return { cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
    });
    expect(loc, 'a finding box exists under the findings filter').not.toBeNull();
    await page.waitForTimeout(300);

    // Re-read centre after scroll.
    const c = await page.evaluate(() => {
      const r = document.querySelector('svg.milg-viewer-svg rect[data-finding]').getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    await page.mouse.click(c.cx, c.cy, { button: 'right' });
    await page.waitForTimeout(200);

    const menu = await page.evaluate(() => {
      const p = document.querySelector('.milg-viewer-overlap-picker');
      const overlays = document.querySelectorAll('svg.milg-viewer-svg .milg-debug-overlay').length;
      return { menu: !!p, header: p ? p.querySelector('.milg-viewer-overlap-header').textContent : null, maskOverlays: overlays };
    });
    expect(menu.menu, 'right-click on a finding box opens the copy-debug picker').toBe(true);
    expect(menu.header).toMatch(/copy debug/i);
    expect(menu.maskOverlays, 'no mask overlay is drawn on the findings overlay').toBe(0);
  });
});
