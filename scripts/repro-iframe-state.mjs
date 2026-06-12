#!/usr/bin/env node
// Probe the analysis iframe's DOM state over time while analyzer.html analyzes itself.
import { spawn } from 'child_process';
import { join } from 'path';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const PORT = 8921;

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

await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const c = document.getElementById('pixelVerifyCheck');
  if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change')); }
});
await page.fill('#urlInput', `http://localhost:${PORT}/analyzer.html`);
await page.click('#analyzeUrlBtn');

const start = Date.now();
const seen = new Set();
const timer = setInterval(async () => {
  try {
    const states = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('iframe').forEach((f) => {
        try {
          const d = f.contentDocument;
          if (!d || !d.getElementById) return;
          const det = d.getElementById('excludeDetails');
          const jso = d.getElementById('jsEnabledOptions');
          const exi = d.getElementById('excludeSelector');
          if (!det && !jso) return;
          const rect = exi ? exi.getBoundingClientRect() : null;
          out.push({
            detailsOpen: det ? det.open : null,
            jsOptDisplay: jso ? getComputedStyle(jso).display : null,
            excludeSelRect: rect ? Math.round(rect.width) + 'x' + Math.round(rect.height) + '@' + Math.round(rect.top) : null,
            scriptsRan: !!(d.defaultView && d.defaultView.__milgIframeId),
            pageHasOwnJs: !!(d.defaultView && d.defaultView.MilgIframe),
          });
        } catch (e) {}
      });
      return out;
    });
    for (const s of states) {
      const key = JSON.stringify(s);
      if (!seen.has(key)) { seen.add(key); console.log(((Date.now() - start) / 1000).toFixed(1) + 's', key); }
    }
    const done = await page.evaluate(() => !!document.querySelector('.report-gauge'));
    if (done) { clearInterval(timer); console.log('report rendered'); await browser.close(); server.kill(); process.exit(0); }
  } catch (e) { /* navigation race */ }
}, 500);

setTimeout(async () => { clearInterval(timer); console.log('timeout'); await browser.close(); server.kill(); process.exit(1); }, 150000);
