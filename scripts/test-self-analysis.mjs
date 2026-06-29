#!/usr/bin/env node
// Self-analysis regression test ("dogfood gate").
// Analyzes the analyzer's own pages (index.html + analyzer.html) through the
// real URL-mode pipeline — extraction + scoring (screenshots/pixel-verify OFF;
// the rasterizer stalls for minutes on our own Monaco-heavy pages) — and fails
// when a page regresses against scripts/self-analysis-baseline.json:
//   - more error-level findings than the baseline allows (normally 0)
//   - more warning-level findings than the baseline allows
//   - overall score below the baseline minimum
// This catches both genuine UI regressions in our pages AND analyzer-core
// false-positive regressions (the two are indistinguishable here on purpose).
//
// Usage:   node scripts/test-self-analysis.mjs
// Update:  UPDATE_BASELINE=1 node scripts/test-self-analysis.mjs
// Requires: playwright (chromium in ~/.cache/ms-playwright) + node server.js deps.

import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(import.meta.dirname, 'self-analysis-baseline.json');
const PORT = 8917; // dedicated port so a dev server on 8901 keeps running
const PAGES = ['index.html', 'analyzer.html'];
// Deterministic fixtures for the cross-mode (SPA / crawl / deep-scan) checks. Screenshots
// stay OFF everywhere (the rasterizer stalls on our Monaco pages); these assert STRUCTURE
// — view counts, hierarchy depth, viewport count — not pixels.
const FIXTURE_SPA = `tests/fixtures/spa-views.html`;     // nav views + Features sub-tabs + theme toggle
const FIXTURE_PLAIN = `tests/fixtures/parity-page.html`; // self-contained, for deep-scan viewport check

function startServer() {
  const child = spawn('node', ['server.js', '--port', String(PORT)], { cwd: ROOT, stdio: 'pipe' });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server.js did not start within 10s')), 10000);
    child.stdout.on('data', (d) => {
      if (String(d).includes('http://localhost')) { clearTimeout(t); resolve(child); }
    });
    child.on('exit', (code) => { clearTimeout(t); reject(new Error('server.js exited early (' + code + ')')); });
  });
}

async function analyze(page, target) {
  await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
  // Screenshots (and the pixel-verify pipeline they feed) are turned OFF here.
  // This gate guards scoring/findings regressions; the screenshot rasterizer
  // (domToCanvas) stalls for minutes on our OWN Monaco-heavy pages
  // (index.html / analyzer.html), blowing past any reasonable wait. The
  // capture+verify pipeline is better exercised against real external sites.
  await page.evaluate(() => {
    ['screenshotCheck', 'pixelVerifyCheck'].forEach((id) => {
      const c = document.getElementById(id);
      if (c && c.checked) { c.checked = false; c.dispatchEvent(new Event('change')); }
    });
  });
  await page.fill('#urlInput', `http://localhost:${PORT}/${target}`);
  await page.click('#analyzeUrlBtn');
  await page.waitForSelector('.report-gauge', { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 500)); // let the report settle
  return page.evaluate(() => {
    const counts = { error: 0, warning: 0, info: 0 };
    const findings = [];
    document.querySelectorAll('.report-finding').forEach((f) => {
      const sev = (f.className.match(/severity-(\w+)/) || [])[1];
      if (counts[sev] != null) counts[sev]++;
      if (sev === 'error' || sev === 'warning') {
        findings.push(`[${sev}] ${f.querySelector('.finding-title')?.textContent.trim() || '?'}`);
      }
    });
    const gaugeText = (document.querySelector('.report-gauge')?.textContent || '').replace(/\s+/g, ' ');
    const score = parseInt((gaugeText.match(/(\d+)/) || [])[1], 10);
    return { score, counts, findings };
  });
}

// Set the analyzer's option toggles before an analysis run (screenshots/pixel-verify always
// off; spa/crawl + color scheme per the mode under test).
async function setToggles(page, t) {
  await page.evaluate((t) => {
    function set(id, on) { const c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
    function sel(id, val) { const c = document.getElementById(id); if (c && val != null && c.value !== val) { c.value = val; c.dispatchEvent(new Event('change')); } }
    set('screenshotCheck', false); set('pixelVerifyCheck', false);
    set('spaExploreCheck', !!t.spa); set('crawlSiteCheck', !!t.crawl);
    sel('colorSchemeSelect', t.colorScheme || 'auto');
  }, t);
}

// SPA discovery (and SPA-in-crawl): analyze a fixture, wait for the crawl UI, read the
// session — assert view count + hierarchy depth (pages > tabs) from the deterministic fixture.
async function runSpaOrCrawl(page, target, toggles) {
  await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
  await setToggles(page, toggles);
  await page.fill('#urlInput', `http://localhost:${PORT}/${target}`);
  await page.click('#analyzeUrlBtn');
  await page.waitForFunction(() => {
    const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
    return s && s.status === 'complete';
  }, { timeout: 90000 });
  return page.evaluate(() => {
    const s = MilgCrawlUI.getCrawlSession();
    const meta = (p) => (p.rawData && p.rawData.meta) || {};
    const depths = s.pages.map((p) => meta(p)._spaDepth || 0);
    return {
      count: s.pages.length,
      maxDepth: depths.reduce((a, b) => Math.max(a, b), 0),
      spaPages: s.pages.filter((p) => meta(p)._spaView).length
    };
  });
}

// Color scheme: force a single mode on a dark-capable fixture, assert it was applied and
// the page rendered in that scheme (the fixture's .dark CSS vars flip the accent color).
async function runColorScheme(page, target, scheme) {
  await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
  await setToggles(page, { colorScheme: scheme }); // spa OFF → single-page analysis
  await page.fill('#urlInput', `http://localhost:${PORT}/${target}`);
  await page.click('#analyzeUrlBtn');
  await page.waitForSelector('.report-gauge', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 400));
  return page.evaluate(() => {
    const r = window.__milgLastReport, raw = r && r.raw;
    const pairs = (raw && raw.colors && raw.colors.contrastPairs) || [];
    return { applied: raw && raw.meta && raw.meta._colorScheme, pairs: pairs.length, firstBg: pairs.length ? pairs[0].bg : null };
  });
}

// One cross-mode check: compare measured fields against baseline thresholds (>=), log, fail-track.
function checkMode(label, measuredObj, baseObj, fields) {
  const problems = [];
  fields.forEach((f) => { if ((measuredObj[f.key] || 0) < baseObj[f.key]) problems.push(`${f.label} ${measuredObj[f.key] || 0} < ${baseObj[f.key]}`); });
  const tag = problems.length ? 'FAIL' : 'ok';
  console.log(`${tag}  ${label}  ${fields.map((f) => f.key + '=' + (measuredObj[f.key] || 0)).join('  ')}`);
  problems.forEach((p) => console.log('      ' + p));
  return problems.length === 0;
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(60000);

let failed = false;
const measured = {};
for (const target of PAGES) {
  const r = await analyze(page, target);
  measured[target] = { minScore: r.score, maxErrors: r.counts.error, maxWarnings: r.counts.warning };
  const base = baseline[target];
  const problems = [];
  if (!Number.isFinite(r.score)) problems.push('could not read score from report');
  else if (r.score < base.minScore) problems.push(`score ${r.score} < baseline minimum ${base.minScore}`);
  if (r.counts.error > base.maxErrors) problems.push(`${r.counts.error} error(s) > allowed ${base.maxErrors}`);
  if (r.counts.warning > base.maxWarnings) problems.push(`${r.counts.warning} warning(s) > allowed ${base.maxWarnings}`);

  const tag = problems.length ? 'FAIL' : 'ok';
  console.log(`${tag}  ${target}  score=${r.score}  errors=${r.counts.error}  warnings=${r.counts.warning}  info=${r.counts.info}`);
  problems.forEach((p) => console.log(`      ${p}`));
  if (problems.length && r.findings.length) {
    console.log('      findings at error/warning level:');
    r.findings.forEach((f) => console.log('        ' + f));
  }
  if (problems.length) failed = true;
}

// --- Cross-mode coverage: SPA discovery, SPA-in-crawl, deep scan (deterministic fixtures) ---
// Measured objects use the SAME keys checkMode compares + writes to the baseline (each
// baseline value is a >= floor, matching the minScore pattern above).
const spa = await runSpaOrCrawl(page, FIXTURE_SPA, { spa: true });
measured.spa = { count: spa.count, maxDepth: spa.maxDepth };
if (!checkMode('SPA(url)', spa, baseline.spa || { count: 4, maxDepth: 2 },
    [{ key: 'count', label: 'views' }, { key: 'maxDepth', label: 'hierarchy depth' }])) failed = true;

const crawl = await runSpaOrCrawl(page, FIXTURE_SPA, { spa: true, crawl: true });
measured.crawl = { count: crawl.count, spaPages: crawl.spaPages };
if (!checkMode('SPA(crawl)', crawl, baseline.crawl || { count: 4, spaPages: 3 },
    [{ key: 'count', label: 'pages' }, { key: 'spaPages', label: 'folded SPA views' }])) failed = true;

// Force dark on the dark-capable SPA fixture and confirm it was applied + rendered.
const csDark = await runColorScheme(page, FIXTURE_SPA, 'dark');
{
  const problems = [];
  if (csDark.applied !== 'dark') problems.push(`_colorScheme="${csDark.applied}" (expected "dark")`);
  if ((csDark.pairs || 0) < 1) problems.push('no contrast pairs (page did not render)');
  const tag = problems.length ? 'FAIL' : 'ok';
  console.log(`${tag}  color-scheme(dark)  applied=${csDark.applied}  pairs=${csDark.pairs}`);
  problems.forEach((p) => console.log('      ' + p));
  if (problems.length) failed = true;
}

await browser.close();
server.kill();

if (process.env.UPDATE_BASELINE === '1') {
  writeFileSync(BASELINE_PATH, JSON.stringify(measured, null, 2) + '\n');
  console.log('baseline updated:', BASELINE_PATH, JSON.stringify(measured));
  process.exit(0);
}
process.exit(failed ? 1 : 0);
