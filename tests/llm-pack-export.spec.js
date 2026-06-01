// @ts-check
// Regression guard for the "LLM pack (.zip)" export (v3.11.21).
// Asserts (a) MilgReport.buildLlmPack produces the expected document set with real
// content, and (b) clicking the button loads JSZip and downloads a valid .zip.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:8384';
const ANALYZER_URL = `${BASE_URL}/analyzer.html`;
const FIXTURE_URL = `${BASE_URL}/tests/fixtures/parity-page.html`;

test('LLM pack: builder manifest + real button download', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(ANALYZER_URL);
  await page.check('#screenshotCheck');
  await page.click('[data-tab="tabUrl"]');
  await page.fill('#urlInput', FIXTURE_URL);
  await page.click('#analyzeUrlBtn');
  await page.waitForSelector('.report-container.visible', { timeout: 90000 });
  await page.waitForTimeout(2000);

  // (a) Builder manifest shape + content.
  const pack = await page.evaluate(() => {
    const r = window.__milgLastReport;
    const p = MilgReport.buildLlmPack(r, { severityFilter: 'all' });
    const byPath = {};
    p.files.forEach((f) => { byPath[f.path] = f.text; });
    return {
      folder: p.folder,
      paths: p.files.map((f) => f.path),
      assets: p.assets.map((a) => ({ path: a.path, len: (a.b64 || '').length })),
      readmeHasScore: /Overall score:/.test(byPath['README.md'] || ''),
      agentHasObjective: /## Objective/.test(byPath['AGENT_PROMPT.md'] || ''),
      guidelinesHasTokens: /## 1\. Design tokens to honor/.test(byPath['GUIDELINES.md'] || ''),
      guidelinesHasContrast: /4\.5:1/.test(byPath['GUIDELINES.md'] || ''),
      indexHasTable: /\| # \| Category \|/.test(byPath['findings/00-index.md'] || ''),
      thirdPartyHasJSZip: /JSZip/.test(byPath['THIRD_PARTY.md'] || ''),
      categoryDocs: p.files.filter((f) => /^findings\/\d\d-/.test(f.path) && f.path !== 'findings/00-index.md').length,
      // A category doc that has a selector-bearing finding should surface a `Selector(s):` block.
      anyDocHasSelector: p.files.some((f) => /^findings\/\d\d-/.test(f.path) && /\*\*Selector\(s\):\*\*/.test(f.text)),
    };
  });
  console.log('PACK', JSON.stringify(pack, null, 2));

  expect(pack.folder).toMatch(/^milg-llm-pack-/);
  expect(pack.paths).toContain('README.md');
  expect(pack.paths).toContain('AGENT_PROMPT.md');
  expect(pack.paths).toContain('GUIDELINES.md');
  expect(pack.paths).toContain('findings/00-index.md');
  expect(pack.paths).toContain('THIRD_PARTY.md');
  expect(pack.categoryDocs).toBeGreaterThan(0);
  expect(pack.readmeHasScore).toBe(true);
  expect(pack.agentHasObjective).toBe(true);
  expect(pack.guidelinesHasTokens).toBe(true);
  expect(pack.guidelinesHasContrast).toBe(true);
  expect(pack.indexHasTable).toBe(true);
  expect(pack.thirdPartyHasJSZip).toBe(true);
  expect(pack.assets.length, 'clean screenshot asset included').toBeGreaterThan(0);
  expect(pack.assets[0].path).toMatch(/^assets\/clean-screenshot\./);
  expect(pack.anyDocHasSelector, 'at least one finding surfaces selectors').toBe(true);

  // (b) Real button click → JSZip load → .zip download.
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.click('#llmPackBtn');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^milg-llm-pack-.*\.zip$/);
  const savePath = await download.path();
  expect(savePath).toBeTruthy();
  const buf = fs.readFileSync(savePath);
  // ZIP magic bytes "PK\x03\x04".
  expect(buf.length).toBeGreaterThan(200);
  expect(buf[0]).toBe(0x50); expect(buf[1]).toBe(0x4b);

  // List entries with the system unzip (present in CI/dev images) to confirm structure.
  let listing = '';
  try { listing = execSync(`unzip -l "${savePath}"`, { encoding: 'utf8' }); } catch (e) { listing = ''; }
  if (listing) {
    console.log('ZIP_LISTING', listing);
    expect(listing).toMatch(/README\.md/);
    expect(listing).toMatch(/AGENT_PROMPT\.md/);
    expect(listing).toMatch(/GUIDELINES\.md/);
    expect(listing).toMatch(/findings\/00-index\.md/);
    expect(listing).toMatch(/assets\/clean-screenshot\./);
    expect(listing).toMatch(/THIRD_PARTY\.md/);
  }
});
