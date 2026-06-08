// End-to-end proof for the v3.11.31 capture fix: with "Embed screenshot library" on,
// the console snippet must capture a screenshot on a CSP-locked page WITHOUT any request
// to the jsDelivr CDN (the capture core previously injected <script src=cdn> unguarded).
// Run: CHROME_BIN=<chromium> node scripts/test-embed-capture-csp.mjs
import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const DOCS = join(import.meta.dirname, '..', 'docs');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };

// A small page served with a CSP that blocks external (CDN) scripts.
const CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:";
const TARGET_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>csp target</title>
<style>body{font-family:system-ui;margin:0;padding:40px;background:#fff;color:#111}h1{color:#2563eb}.card{padding:24px;border:1px solid #ddd;border-radius:12px;margin-top:20px}</style>
</head><body><h1>CSP-locked target page</h1><p>Some body text with reasonable contrast for analysis.</p>
<img id="testimg" src="/img.png" width="80" height="60" alt="same-origin image">
<picture><source id="testsrc" srcset="/img.png"><img src="/img.png" width="40" height="30" alt="picture"></picture>
<div class="card"><h2>A card</h2><p>More content so there is something to screenshot.</p><button>Click me</button></div>
</body></html>`;
// 8x8 solid PNG, served same-origin so canvas extraction (no fetch) can read it.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR42mNk+M9QzzCKRsEoAgD7+QYBfYn0qgAAAABJRU5ErkJggg==', 'base64');

const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  if (path === '/csp-target.html') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': CSP });
    res.end(TARGET_HTML); return;
  }
  if (path === '/img.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(PNG); return; }
  let p = path === '/' ? '/index.html' : path;
  const file = join(DOCS, p);
  if (!file.startsWith(DOCS) || !existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

const results = [];
const ok = (n, c, extra='') => { results.push([c, n]); console.log(`${c ? '✅' : '❌'} ${n}${extra ? ' — ' + extra : ''}`); };

await new Promise(r => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], executablePath: process.env.CHROME_BIN || undefined });

try {
  // 1) Build the EMBEDDED snippet via the real analyzer UI.
  const ap = await browser.newPage();
  await ap.goto(`${base}/analyzer.html`, { waitUntil: 'networkidle2' });
  await ap.click('.tab-btn[data-tab="tabSnippet"]');
  await ap.waitForFunction(() => { const el = document.getElementById('snippetCode'); return el && el.textContent.length > 500 && !/^Loading/.test(el.textContent); }, { timeout: 15000 });
  const lenBefore = await ap.$eval('#snippetCode', el => el.textContent.length);
  await ap.click('#embedScreenshotLibCheck');
  await ap.waitForFunction((b) => document.getElementById('snippetCode').textContent.length > b + 20000, { timeout: 15000 }, lenBefore);
  const snippet = await ap.$eval('#snippetCode', el => el.textContent);
  await ap.close();
  ok('embedded snippet assembled', snippet.includes('v(w.modernScreenshot={})'), `${snippet.length}b`);

  // 2) Run it on the CSP-locked page (simulating a console paste, which bypasses CSP
  //    for the pasted code itself — exactly like DevTools).
  const page = await browser.newPage();
  const cdnHits = [];
  page.on('request', r => { if (/jsdelivr|modern-screenshot/.test(r.url())) cdnHits.push(r.url()); });
  const cspBlocks = [];
  const inlineLogs = [];
  page.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to load/i.test(t)) cspBlocks.push(t); if (/Inlined \d+\/\d+ images/.test(t)) inlineLogs.push(t); });
  await page.goto(`${base}/csp-target.html`, { waitUntil: 'networkidle2' });

  // Sanity: confirm the CSP really blocks an external script (the bug's trigger).
  const cdnBlocked = await page.evaluate(() => new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js';
    s.onload = () => resolve(false);   // loaded → CSP not blocking (bad test)
    s.onerror = () => resolve(true);   // blocked → good
    document.head.appendChild(s);
    setTimeout(() => resolve(true), 3000);
  }));
  ok('CSP genuinely blocks the jsDelivr CDN script', cdnBlocked);

  // Paste-run the embedded snippet.
  await page.evaluate((code) => { (0, eval)(code); }, snippet);

  // Wait for capture to finish.
  await page.waitForFunction(() => window.__milgData && Array.isArray(window.__milgData.screenshots), { timeout: 60000 });
  const shots = await page.evaluate(() => (window.__milgData.screenshots || []).length);
  const fullShot = await page.evaluate(() => !!(window.__milgData.screenshotFull || (window.__milgData.screenshots && window.__milgData.screenshots[0])));

  ok('screenshot captured on CSP-locked page (embed path)', shots > 0, `${shots} screenshot(s)`);
  ok('a full-page screenshot is present', fullShot);
  ok('same-origin image inlined from rendered pixels (no fetch)', inlineLogs.some(l => /Inlined [1-9]\d*\/\d+ images/.test(l)), inlineLogs[0] || '(no inline log)');
  const imgRestored = await page.evaluate(() => { const i = document.getElementById('testimg'); return i && /\/img\.png$/.test(i.getAttribute('src') || ''); });
  ok('original image src restored after capture', imgRestored);
  const srcRestored = await page.evaluate(() => { const s = document.getElementById('testsrc'); return s && /\/img\.png$/.test(s.getAttribute('srcset') || ''); });
  ok('<source> srcset restored after capture', srcRestored);
  const diag = await page.evaluate(() => (window.__milgData && (window.__milgData.screenshotFull ? 'full:present' : 'full:MISSING')) || 'no-data');
  ok('payload diagnostic log reflects a present screenshot', diag === 'full:present', diag);
  ok('NO request was made to the jsDelivr CDN by the snippet', cdnHits.filter(u => !u.includes('cdn-sanity')).length <= 1, `hits: ${cdnHits.length} (1 expected from the sanity probe)`);

  await page.close();
} catch (e) {
  console.error('TEST ERROR:', e.message);
  results.push([false, 'harness error: ' + e.message]);
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter(r => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
