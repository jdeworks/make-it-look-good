// @ts-check
// Round-trip guards (v3.11.24):
//  - audience profile survives export→import (import restores #profileSelect + re-scores with it)
//  - crawl export can retain per-viewport data so a re-imported deep-scan crawl rebuilds the
//    page×viewport matrix LLM pack.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = 'http://localhost:8384';
const ANALYZER = `${BASE}/analyzer.html`;
const FIXTURE = `${BASE}/tests/fixtures/parity-page.html`;

async function analyzeAndGetRaw(page) {
  await page.goto(ANALYZER);
  await page.check('#screenshotCheck');
  await page.click('[data-tab="tabUrl"]');
  await page.fill('#urlInput', FIXTURE);
  await page.click('#analyzeUrlBtn');
  await page.waitForSelector('.report-container.visible', { timeout: 90000 });
  await page.waitForTimeout(1500);
  return page.evaluate(() => JSON.stringify(window.__milgLastReport.raw));
}

test('profile: import restores #profileSelect and re-scores with it', async ({ page }) => {
  test.setTimeout(150000);
  const raw = await analyzeAndGetRaw(page);
  const data = JSON.parse(raw); data.profile = 'elderly';
  const f = path.join(os.tmpdir(), 'milg-prof.json'); fs.writeFileSync(f, JSON.stringify(data));
  await page.goto(ANALYZER);
  // Default #profileSelect is 'general'; importing data with profile 'elderly' must flip it.
  await page.setInputFiles('#importJsonFile', f);
  await page.waitForSelector('.report-container.visible', { timeout: 60000 });
  await page.waitForTimeout(1500);
  const out = await page.evaluate(() => ({
    dropdown: document.getElementById('profileSelect').value,
    reportProfile: window.__milgLastReport && window.__milgLastReport.raw && window.__milgLastReport.raw.profile,
  }));
  console.log('PROFILE_RT', JSON.stringify(out));
  expect(out.dropdown).toBe('elderly');
  expect(out.reportProfile).toBe('elderly');
});

test('matrix export flag: renderCrawlJSON keeps viewportData only when asked', async ({ page }) => {
  test.setTimeout(120000);
  await analyzeAndGetRaw(page);
  const res = await page.evaluate(() => {
    const r = window.__milgLastReport;
    const rawVp = JSON.parse(JSON.stringify(r.raw));
    rawVp.deepScan = { viewports: [{ label: 'D', width: 1280 }], darkMode: null,
      viewportData: [{ label: 'D', width: 1280, data: r.raw }] };
    const session = { startUrl: 'https://e.com', startedAt: null, options: {}, summary: {},
      pages: [{ url: 'https://e.com', status: 'done', rawData: rawVp, reportData: r }] };
    const withVp = JSON.parse(MilgCrawl.renderCrawlJSON(session, 'all', true));
    const without = JSON.parse(MilgCrawl.renderCrawlJSON(session, 'all', false));
    return {
      withHas: !!(withVp.results[0].data.deepScan && withVp.results[0].data.deepScan.viewportData),
      withoutHas: !!(without.results[0].data.deepScan && without.results[0].data.deepScan.viewportData),
    };
  });
  console.log('MATRIX_EXPORT_FLAG', JSON.stringify(res));
  expect(res.withHas).toBe(true);
  expect(res.withoutHas).toBe(false);
});

test('matrix import: crawl JSON with viewportData → page×viewport (-site-viewports) pack', async ({ page }) => {
  test.setTimeout(150000);
  const raw = await analyzeAndGetRaw(page);
  const pageData = JSON.parse(raw);
  pageData.deepScan = { viewports: [{ label: 'Desktop', width: 1280 }, { label: 'Phone', width: 375 }], darkMode: null,
    viewportData: [{ label: 'Desktop', width: 1280, data: JSON.parse(raw) }, { label: 'Phone', width: 375, data: JSON.parse(raw) }] };
  const crawl = { _milgCrawl: true, startUrl: 'https://example.com/', results: [{ url: 'https://example.com/', data: pageData }] };
  const f = path.join(os.tmpdir(), 'milg-matrix.json'); fs.writeFileSync(f, JSON.stringify(crawl));
  await page.goto(ANALYZER);
  await page.setInputFiles('#importJsonFile', f);
  await page.waitForFunction(() => !!(window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession()), { timeout: 30000 });
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.evaluate(() => document.getElementById('llmPackBtn').click());
  const d = await dl;
  console.log('MATRIX_PACK_FILE', d.suggestedFilename());
  expect(d.suggestedFilename()).toMatch(/-site-viewports\.zip$/);
});
