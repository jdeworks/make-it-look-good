#!/usr/bin/env node
// Repro: analyze https://www.tokenmade.ai with JS enabled + pixel verify.
// Observe: manifest CORS noise, hidden-content handling, verify results, modal log.
import { spawn } from 'child_process';
import { join } from 'path';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const PORT = 8923;

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
page.setDefaultTimeout(240000);
const errors = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || /CORS|manifest|blocked/i.test(t)) errors.push(t.slice(0, 180));
  if (/milg-verify|hiddenPanel|unhidden|\[D\]/i.test(t)) console.log('[console]', t.slice(0, 180));
});

await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  for (const [id, on] of [['pixelVerifyCheck', true], ['jsEnabledCheck', true]]) {
    const c = document.getElementById(id);
    if (c && c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); }
  }
  const ack = document.getElementById('jsRiskAck');
  if (ack && !ack.checked) { ack.checked = true; ack.dispatchEvent(new Event('change')); }
});
await page.fill('#urlInput', 'https://www.tokenmade.ai');
await page.click('#analyzeUrlBtn');

// Poll the focus-modal log to see what the user sees
const modalSnapshots = [];
const modalTimer = setInterval(async () => {
  try {
    const txt = await page.evaluate(() => {
      const el = document.getElementById('focusModalLog');
      return el ? el.textContent : null;
    });
    if (txt && (!modalSnapshots.length || modalSnapshots[modalSnapshots.length - 1] !== txt)) modalSnapshots.push(txt);
  } catch (e) {}
}, 2000);

await page.waitForSelector('.report-gauge', { timeout: 220000 });
clearInterval(modalTimer);
await new Promise((r) => setTimeout(r, 15000));

const dump = await page.evaluate(() => {
  const raw = window.__milgLastReport && window.__milgLastReport.raw;
  if (!raw) return { error: 'no report' };
  const pairs = (raw.colors && raw.colors.contrastPairs) || [];
  const vr = raw._contrastVerifyResults || [];
  return {
    pairCount: pairs.length,
    clipped: pairs.filter(p => p._isClipped).length,
    region: pairs.filter(p => p._regionContainerId).length,
    hiddenPanelCount: raw.layout && raw.layout.hiddenPanelCount,
    screenshots: (raw.screenshots || []).length,
    regionScreenshots: (raw.regionScreenshots || []).length,
    verifyCount: vr.length,
    verifySkipped: vr.filter(r => r.skipped).length,
    verifyRatio1: vr.filter(r => r.pixelRatio === 1 && r.crossesBoundary).map(r => ({ sel: r.selector, text: (r.text || '').slice(0, 40), cssRatio: r.cssRatio })),
    verifyFlagged: vr.filter(r => r.crossesBoundary || r.significant).length,
  };
});

console.log('\n=== MODAL LOG over time ===');
modalSnapshots.forEach((s, i) => console.log(`--- snapshot ${i} ---\n${s}`));
console.log('\n=== DUMP ===');
console.log(JSON.stringify(dump, null, 1));
console.log('\n=== console errors (first 25) ===');
[...new Set(errors)].slice(0, 25).forEach(e => console.log(' ', e));

await browser.close();
server.kill();
