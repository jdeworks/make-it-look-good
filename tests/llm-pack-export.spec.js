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

test('LLM pack multi (viewport): dedup, affects N/M, per-unit docs', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(ANALYZER_URL);
  await page.check('#screenshotCheck');
  await page.click('[data-tab="tabUrl"]');
  await page.fill('#urlInput', FIXTURE_URL);
  await page.click('#analyzeUrlBtn');
  await page.waitForSelector('.report-container.visible', { timeout: 90000 });
  await page.waitForTimeout(2000);

  // Build a 2-viewport pack: unit A (Desktop) = full report; unit B (Phone) = same
  // report with the FIRST category's findings removed → those findings become
  // "Desktop only" (1/2), the rest "all 2 viewports" (2/2).
  const m = await page.evaluate(() => {
    const r = window.__milgLastReport;
    const clone = () => ({ overall: r.overall, grade: r.grade, gradeLabel: r.gradeLabel, meta: r.meta, raw: r.raw,
      categories: r.categories.map((c) => ({ label: c.label, weight: c.weight, score: c.score, findings: c.findings.slice() })) });
    const a = clone();                 // Desktop — full
    const b = clone(); b.categories[0].findings = []; // Phone — first category cleared
    const firstCat = r.categories[0].label;
    const p = MilgReport.buildLlmPackMulti({
      mode: 'viewport',
      units: [{ id: 'v0', label: 'Desktop (1280px)', report: a }, { id: 'v1', label: 'Phone (375px)', report: b }],
      primaryReport: r, host: 'example', aggregateScore: r.overall, dims: { viewports: 2 }, severityFilter: 'all',
    });
    const byPath = {}; p.files.forEach((f) => { byPath[f.path] = f.text; });
    return {
      folder: p.folder,
      paths: p.files.map((f) => f.path),
      unitDocs: p.files.filter((f) => /^units\//.test(f.path)).map((f) => f.path),
      readme: byPath['README.md'],
      agent: byPath['AGENT_PROMPT.md'],
      index: byPath['findings/00-index.md'],
      firstCat,
      firstCatDoc: byPath['findings/01-' + (r.categories[0].label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))  + '.md'],
    };
  });
  console.log('MULTI_PATHS', JSON.stringify(m.paths, null, 2));
  console.log('MULTI_INDEX', m.index);

  expect(m.folder).toMatch(/-viewports$/);
  expect(m.unitDocs.length).toBe(2);              // one per viewport
  expect(m.readme).toMatch(/Checked across:\*\* 2 viewports/);
  expect(m.agent).toMatch(/scored independently/);
  expect(m.agent).toMatch(/Viewport-specific/);   // mode-specific solve strategy present
  // Affects column shows both the universal (2/2) and the desktop-only (1/2) issues.
  expect(m.index).toMatch(/\| 2\/2 \|/);
  expect(m.index).toMatch(/\| 1\/2 \|/);
  // The first category's issues are Desktop-only → badge "1/2 ... Desktop".
  if (m.firstCatDoc) {
    expect(m.firstCatDoc).toMatch(/\*\*Affects:\*\*/);
    expect(m.firstCatDoc).toMatch(/Desktop/);
  }
});
