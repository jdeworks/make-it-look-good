#!/usr/bin/env node
// Analyzer-quality EVAL route (discovery tool, NOT a pass/fail gate).
//
// Drives the REAL analyzer UI pipeline (screenshots + pixel-verify + JS + SPA explore)
// over external demo sites × viewports × {light,dark}, and writes a findings report so we
// can triage where the ANALYZER needs work AND where the PAGES need work. SPA exploration
// is ON (one tab can look fine while another has issues), so each discovered view is scored
// per mode. Bounded by a maxAnalyses budget (like the crawl SPA cap) — stops + logs skips.
//
// Usage:
//   node scripts/eval-analyzer-quality.mjs
//   node scripts/eval-analyzer-quality.mjs --targets https://a,https://b --max 40 --viewports desktop,mobile --modes light,dark
//   node scripts/eval-analyzer-quality.mjs --no-spa        (top-level page only, faster)
// Output: eval/analyzer-quality-<stamp>.{md,json} (eval/ is gitignored).

import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const PORT = 8920 + Math.floor((Date.now() / 1000) % 50); // avoid collisions across runs
function arg(name, def) { const i = process.argv.indexOf('--' + name); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def; }
const flag = (name) => process.argv.includes('--' + name);

const TARGETS = (arg('targets', [
  'https://jdeworks.github.io/dead-data-cleaner-poc/',
  'https://jdeworks.github.io/anvil-poc/',
  'https://jdeworks.github.io/narratu-poc/',
  'https://www.fink-translate.com/',
].join(','))).split(',').map((s) => s.trim()).filter(Boolean);
const VIEWPORTS = { desktop: '1280x900', tablet: '768x1024', mobile: '375x812' };
const PICK_VP = (arg('viewports', 'desktop,mobile')).split(',').map((s) => s.trim());
const PICK_MODES = (arg('modes', 'light,dark')).split(',').map((s) => s.trim());
const MAX_ANALYSES = parseInt(arg('max', '60'), 10);   // total views scored across all cells
const SPA = !flag('no-spa');
const STAMP = arg('stamp', String(Math.floor(Date.now() / 1000)));

function startServer() {
  const child = spawn('node', ['server.js', '--port', String(PORT)], { cwd: ROOT, stdio: 'pipe' });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 12000);
    child.stdout.on('data', (d) => { if (String(d).includes('http://localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (c) => { clearTimeout(t); reject(new Error('server exited ' + c)); });
  });
}

// Drive one cell: set toggles, analyze, wait for completion + pixel-verify settle, read findings.
async function runCell(page, url, viewportVal, mode) {
  await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
  await page.evaluate(({ viewportVal, mode, spa }) => {
    function set(id, on) { const c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
    function sel(id, v) { const c = document.getElementById(id); if (c && c.value !== v) { c.value = v; c.dispatchEvent(new Event('change')); } }
    set('screenshotCheck', true); set('pixelVerifyCheck', true);
    set('jsEnabledCheck', true); set('jsRiskAck', true);
    set('spaExploreCheck', !!spa); set('crawlSiteCheck', false);
    sel('viewportSelect', viewportVal); sel('colorSchemeSelect', mode);
  }, { viewportVal, mode, spa: SPA });
  await page.fill('#urlInput', url);
  await page.click('#analyzeUrlBtn');

  // Wait for either a single-page report or a completed SPA/crawl session.
  await page.waitForFunction(() => {
    const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
    if (s && s.status === 'complete') return true;
    return !!document.querySelector('.report-gauge');
  }, { timeout: 180000 });
  // Pixel-verify settle: wait until every done page with screenshots has verify results.
  await page.waitForFunction(() => {
    const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
    if (s && s.status === 'complete') {
      return s.pages.every((p) => p.status !== 'done' || !(p.rawData && p.rawData.screenshots && p.rawData.screenshots.length) || (p.rawData && p.rawData._contrastVerifyResults));
    }
    return !!(window.__milgLastReport);
  }, { timeout: 120000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));

  return page.evaluate(() => {
    function findingsOf(report) {
      const out = [];
      ((report && report.categories) || []).forEach((c) => (c.findings || []).forEach((f) => {
        if (f.severity === 'error' || f.severity === 'warning') out.push({ sev: f.severity, cat: c.label, title: (f.title || f.message || '?').slice(0, 120) });
      }));
      return out;
    }
    const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
    if (s && s.status === 'complete') {
      return {
        kind: 'spa', views: s.pages.filter((p) => p.status === 'done').map((p) => ({
          title: (p.rawData && p.rawData.meta && p.rawData.meta.title) || p.title || p.url,
          score: p.reportData && p.reportData.overall, grade: p.reportData && p.reportData.grade,
          findings: findingsOf(p.reportData),
        })),
      };
    }
    const r = window.__milgLastReport;
    return { kind: 'single', views: [{ title: (r && r.meta && r.meta.title) || 'page', score: r && r.overall, grade: r && r.grade, findings: findingsOf(r) }] };
  });
}

// ---- run ----
const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(180000);

const cells = [];
for (const target of TARGETS) for (const vp of PICK_VP) for (const mode of PICK_MODES) cells.push({ target, vp, mode });

const results = [];
let analysed = 0, truncated = false;
for (const cell of cells) {
  if (analysed >= MAX_ANALYSES) { truncated = true; console.log(`  [budget] maxAnalyses ${MAX_ANALYSES} reached — skipping ${cell.target} ${cell.vp}/${cell.mode}`); continue; }
  const label = `${cell.target} · ${cell.vp} · ${cell.mode}`;
  process.stdout.write(`▶ ${label} … `);
  try {
    const r = await runCell(page, cell.target, VIEWPORTS[cell.vp] || VIEWPORTS.desktop, cell.mode);
    analysed += r.views.length;
    const errs = r.views.reduce((a, v) => a + v.findings.filter((f) => f.sev === 'error').length, 0);
    const warns = r.views.reduce((a, v) => a + v.findings.filter((f) => f.sev === 'warning').length, 0);
    console.log(`${r.views.length} view(s), ${errs} err / ${warns} warn  (budget ${analysed}/${MAX_ANALYSES})`);
    results.push({ ...cell, ...r });
  } catch (e) {
    console.log('FAILED: ' + (e.message || e).slice(0, 80));
    results.push({ ...cell, error: String(e.message || e) });
  }
}

await browser.close();
server.kill();

// ---- report ----
mkdirSync(join(ROOT, 'eval'), { recursive: true });
const jsonPath = join(ROOT, 'eval', `analyzer-quality-${STAMP}.json`);
const mdPath = join(ROOT, 'eval', `analyzer-quality-${STAMP}.md`);
writeFileSync(jsonPath, JSON.stringify({ stamp: STAMP, spa: SPA, maxAnalyses: MAX_ANALYSES, truncated, results }, null, 2));

const md = [];
md.push(`# Analyzer quality eval — ${STAMP}`);
md.push(`SPA explore: ${SPA} · budget: ${analysed}/${MAX_ANALYSES}${truncated ? ' (capped — some cells skipped)' : ''} · viewports: ${PICK_VP.join(', ')} · modes: ${PICK_MODES.join(', ')}\n`);
for (const r of results) {
  md.push(`## ${r.target} — ${r.vp} / ${r.mode}`);
  if (r.error) { md.push(`> FAILED: ${r.error}\n`); continue; }
  for (const v of (r.views || [])) {
    md.push(`- **${v.title}** — score ${v.score} (${v.grade}), ${v.findings.length} finding(s)`);
    for (const f of v.findings) md.push(`    - ${f.sev === 'error' ? '❌' : '⚠️'} [${f.cat}] ${f.title}`);
  }
  md.push('');
}
writeFileSync(mdPath, md.join('\n'));
console.log(`\nReport written:\n  ${mdPath}\n  ${jsonPath}`);
process.exit(0);
