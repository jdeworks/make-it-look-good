#!/usr/bin/env node
// Repro for: "pixel verify collects hidden pixels but verifies against
// page without expanding". Analyzes analyzer.html on itself (pixel verify ON),
// dumps verify results, then checks each verified selector's visibility on a
// pristine page to find pairs that are hidden in the default state.
import { spawn } from 'child_process';
import { join } from 'path';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const PORT = 8919;

function startServer() {
  const child = spawn('node', ['server.js', '--port', String(PORT)], { cwd: ROOT, stdio: 'pipe' });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), 10000);
    child.stdout.on('data', (d) => { if (String(d).includes('http://localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (c) => { clearTimeout(t); reject(new Error('server exited ' + c)); });
  });
}

const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(180000);
page.on('console', (m) => {
  const t = m.text();
  if (/milg-verify|hiddenPanel|\[D\]|unhidden/i.test(t)) console.log('[console]', t.slice(0, 200));
});

await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const c = document.getElementById('pixelVerifyCheck');
  if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change')); }
});
await page.fill('#urlInput', `http://localhost:${PORT}/analyzer.html`);
await page.click('#analyzeUrlBtn');
await page.waitForSelector('.report-gauge', { timeout: 150000 });
await new Promise((r) => setTimeout(r, 12000));

const dump = await page.evaluate(() => {
  const rep = window.__milgLastReport;
  const raw = rep && rep.raw;
  if (!raw) return { error: 'no __milgLastReport.raw' };
  const out = {
    rawKeys: Object.keys(raw),
    deepScan: !!raw.deepScan,
    hiddenPanelCount: raw.layout && raw.layout.hiddenPanelCount,
    hiddenPanelIssues: (raw.layout && raw.layout.hiddenPanelIssues || []).map(h => h.selector),
    screenshots: (raw.screenshots || []).length,
    screenshotsUnhidden: (raw.screenshotsUnhidden || []).length,
    pairCount: (raw.colors && raw.colors.contrastPairs || []).length,
    verify: null,
  };
  const vr = raw._contrastVerifyResults;
  if (vr) {
    out.verify = vr.map(r => ({
      selector: r.selector, text: (r.text || '').slice(0, 40),
      cssRatio: r.cssRatio, pixelRatio: r.pixelRatio,
      crossesBoundary: r.crossesBoundary, significant: r.significant,
      skipped: r.skipped, reason: r.reason, demoted: r.demoted,
      bbox: r.bbox,
    }));
  }
  // also pairs flagged clipped/region
  const pairs = (raw.colors && raw.colors.contrastPairs || []);
  out.clippedPairs = pairs.filter(p => p._isClipped || p._regionContainerId).map(p => p.selector);
  // region screenshots with kind/label
  out.regionScreenshots = (raw.regionScreenshots || []).map(r => ({
    kind: r.kind || 'clipped',
    label: r.label || '',
    containerRect: r.containerRect || null,
  }));
  return out;
});

console.log('\n=== DUMP ===');
console.log(JSON.stringify({ ...dump, verify: undefined }, null, 1));
// Print regionScreenshots detail
console.log('\n=== regionScreenshots ===', (dump.regionScreenshots || []).length);
(dump.regionScreenshots || []).forEach((r, i) => {
  console.log(' [' + i + ']', JSON.stringify(r));
});
const verify = dump.verify || [];
console.log('verify results:', verify.length);
const interesting = verify.filter(v => v.crossesBoundary || v.significant || v.skipped);
console.log('flagged (crossesBoundary/significant/skipped):', interesting.length);

// Pristine page: check visibility of every verified selector
const probe = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await probe.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
const visChecks = await probe.evaluate((sels) => {
  return sels.map((sel) => {
    let el = null;
    try { el = document.querySelector(sel); } catch (e) { return { sel, error: 'bad-selector' }; }
    if (!el) return { sel, found: false };
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    let hiddenAncestor = null;
    let p = el;
    while (p && p !== document.body) {
      const ps = getComputedStyle(p);
      if (ps.display === 'none' || ps.visibility === 'hidden' || ps.opacity === '0') { hiddenAncestor = (p.id ? '#' + p.id : p.tagName) + ':' + (ps.display === 'none' ? 'display-none' : ps.visibility === 'hidden' ? 'vis-hidden' : 'opacity-0'); break; }
      p = p.parentElement;
    }
    return { sel, found: true, w: Math.round(r.width), h: Math.round(r.height), display: s.display, visibility: s.visibility, opacity: s.opacity, hiddenAncestor };
  });
}, [...new Set(verify.map(v => v.selector))]);

const hiddenVerified = visChecks.filter(v => v.found && (v.w === 0 || v.h === 0 || v.display === 'none' || v.visibility === 'hidden' || v.opacity === '0' || v.hiddenAncestor));
console.log('\n=== verified pairs that are HIDDEN on pristine page ===', hiddenVerified.length);
hiddenVerified.slice(0, 30).forEach(v => console.log(' ', JSON.stringify(v)));
const notFound = visChecks.filter(v => !v.found);
console.log('selectors not found on pristine page:', notFound.length);
notFound.slice(0, 15).forEach(v => console.log('  ', v.sel));

// Show the interesting verify entries with their pristine visibility
console.log('\n=== flagged verify entries ===');
interesting.slice(0, 30).forEach(v => {
  const vis = visChecks.find(c => c.sel === v.selector);
  console.log(' ', JSON.stringify({ ...v, bbox: v.bbox ? [v.bbox.x, v.bbox.y, v.bbox.w || v.bbox.width, v.bbox.h || v.bbox.height] : null, pristine: vis && (vis.hiddenAncestor || (vis.w === 0 ? '0x0' : 'visible')) }));
});

await browser.close();
server.kill();
