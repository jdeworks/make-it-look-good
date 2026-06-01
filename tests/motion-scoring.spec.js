// @ts-check
// End-to-end guard for motion extraction + the "Motion & Animation" scoring module (v3.11.27).
// Before this, data.animation was never populated so the module was inert.
const { test, expect } = require('@playwright/test');
const ANALYZER = 'http://localhost:8384/analyzer.html';
const FIXTURE = 'http://localhost:8384/tests/fixtures/motion-page.html';

test('motion: extraction populates data.animation and the module flags it', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(ANALYZER);
  await page.check('#screenshotCheck');
  await page.click('[data-tab="tabUrl"]');
  await page.fill('#urlInput', FIXTURE);
  await page.click('#analyzeUrlBtn');
  await page.waitForSelector('.report-container.visible', { timeout: 90000 });
  await page.waitForTimeout(1500);

  const out = await page.evaluate(() => {
    const r = window.__milgLastReport;
    const anim = r.raw.animation || {};
    const cat = (r.categories || []).find((c) => c.label === 'Motion & Animation');
    const titles = cat ? cat.findings.map((f) => f.severity + ':' + f.title) : [];
    return {
      keyframeCount: anim.keyframeCount, infiniteCount: anim.infiniteCount,
      autoplayCount: anim.autoplayCount, hasReducedMotion: anim.hasReducedMotion,
      animationDurations: anim.animationDurations, willChangeCount: anim.willChangeCount,
      hasCategory: !!cat, titles,
    };
  });
  console.log('MOTION', JSON.stringify(out, null, 2));

  // Extraction worked.
  expect(out.keyframeCount).toBeGreaterThanOrEqual(3); // spin, pulse, slideIn
  expect(out.infiniteCount).toBeGreaterThanOrEqual(2); // spinner + badge
  expect(out.autoplayCount).toBeGreaterThanOrEqual(2);
  expect(out.hasReducedMotion).toBe(false);
  expect(out.willChangeCount).toBeGreaterThanOrEqual(1); // .hero
  expect(out.animationDurations.length).toBeGreaterThan(0);

  // Module reacted.
  expect(out.hasCategory).toBe(true);
  expect(out.titles.join(' | ')).toMatch(/prefers-reduced-motion/i);
  expect(out.titles.join(' | ')).toMatch(/infinitely-looping/i);
  expect(out.titles.join(' | ')).toMatch(/long animation duration/i);
});
