#!/usr/bin/env node
// Self-analysis regression test ("dogfood gate").
// Analyzes the analyzer's own pages (index.html + analyzer.html) through the
// real URL-mode pipeline — extraction, scoring, screenshots, pixel verify —
// and fails when a page regresses against scripts/self-analysis-baseline.json:
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
  // Pixel verify ON — the verify pipeline is part of what we guard.
  await page.evaluate(() => {
    const c = document.getElementById('pixelVerifyCheck');
    if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change')); }
  });
  await page.fill('#urlInput', `http://localhost:${PORT}/${target}`);
  await page.click('#analyzeUrlBtn');
  await page.waitForSelector('.report-gauge', { timeout: 150000 });
  await new Promise((r) => setTimeout(r, 10000)); // let pixel verify settle
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

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(180000);

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

await browser.close();
server.kill();

if (process.env.UPDATE_BASELINE === '1') {
  writeFileSync(BASELINE_PATH, JSON.stringify(measured, null, 2) + '\n');
  console.log('baseline updated:', BASELINE_PATH, JSON.stringify(measured));
  process.exit(0);
}
process.exit(failed ? 1 : 0);
