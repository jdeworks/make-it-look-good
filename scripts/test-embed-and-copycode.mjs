// Headless verification for v3.11.30 fixes:
//  1. Analyzer "Embed screenshot lib" actually inlines the served lib into the snippet.
//  2. Template viewer "Copy code" for edited HTML + button relabel.
//  3. Paste trust-guard (large HTML paste prompts; small paste doesn't).
//  4. Restore icon + auto-reattach on revert.
// Run: node scripts/test-embed-and-copycode.mjs
import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const DOCS = join(import.meta.dirname, '..', 'docs');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = join(DOCS, p);
  if (!file.startsWith(DOCS) || !existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

const results = [];
const ok = (n, c, extra='') => { results.push([c, n, extra]); console.log(`${c ? '✅' : '❌'} ${n}${extra ? ' — ' + extra : ''}`); };

await new Promise(r => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], executablePath: process.env.CHROME_BIN || undefined });

try {
  // ---- Test 0: served lib path exists (the bug-1 root cause) ----
  {
    const r = await fetch(`${base}/lib/modern-screenshot.min.js`);
    const t = r.ok ? await r.text() : '';
    ok('lib/modern-screenshot.min.js served on Pages path', r.ok && t.includes('modernScreenshot'), `status ${r.status}, ${t.length}b`);
  }

  // ---- Test 1: analyzer embed actually changes the snippet ----
  {
    const page = await browser.newPage();
    await page.goto(`${base}/analyzer.html`, { waitUntil: 'networkidle2' });
    await page.click('.tab-btn[data-tab="tabSnippet"]');
    await page.waitForFunction(() => {
      const el = document.getElementById('snippetCode');
      return el && el.textContent && el.textContent.length > 500 && !/^Loading/.test(el.textContent);
    }, { timeout: 15000 });
    const before = await page.$eval('#snippetCode', el => el.textContent.length);
    // UMD signature unique to the lib (not the snippet's own window.modernScreenshot guard).
    const LIB_SIG = 'v(w.modernScreenshot={})';
    const beforeHasLib = await page.$eval('#snippetCode', (el, sig) => el.textContent.includes(sig), LIB_SIG);
    await page.click('#embedScreenshotLibCheck');
    await page.waitForFunction((b) => {
      const el = document.getElementById('snippetCode');
      return el && el.textContent.length > b + 20000; // ~29KB lib prepended
    }, { timeout: 15000 }, before);
    const after = await page.$eval('#snippetCode', el => el.textContent.length);
    const afterHasLib = await page.$eval('#snippetCode', (el, sig) => el.textContent.includes(sig), LIB_SIG);
    const noteShown = await page.$eval('#embedScreenshotLibNote', el => getComputedStyle(el).display !== 'none');
    ok('embed unchecked → snippet has NO inlined lib', !beforeHasLib);
    ok('embed checked → snippet grows by ~lib size', after > before + 20000, `${before} → ${after}`);
    ok('embed checked → snippet now contains modernScreenshot lib', afterHasLib);
    ok('embed checked → explanatory note visible', noteShown);
    await page.close();
  }

  // ---- Template viewer tests (need Monaco) ----
  const page = await browser.newPage();
  // Capture clipboard writes + suppress real permission prompts.
  await page.evaluateOnNewDocument(() => {
    window.__clip = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip.push(t); return Promise.resolve(); }, readText: () => Promise.resolve('') }, configurable: true });
  });
  const dialogShown = () => page.evaluate(() => !!document.querySelector('#trust-load'));
  await page.goto(base, { waitUntil: 'networkidle2' });
  // Wait for Monaco + an autoloaded preset.
  await page.waitForFunction(() => window.monaco && document.querySelector('.template-name') && document.querySelector('.template-name').textContent.length > 0, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 600));

  const shareLabel = () => page.$eval('.share-label', el => el.textContent.trim());
  const restoreVisible = () => page.$eval('#restoreTemplateBtn', el => getComputedStyle(el).display !== 'none').catch(() => false);
  const setEditor = (v) => page.evaluate((val) => window.monaco.editor.getModels()[0].setValue(val), v);
  const typeAppend = (s) => page.evaluate((str) => { const m = window.monaco.editor.getModels()[0]; m.applyEdits([{ range: m.getFullModelRange().collapseToEnd(), text: str }]); }, s);

  // ---- Test 2: no spurious modal on fresh load ----
  ok('no trust modal on initial template load', !(await dialogShown()));
  ok('clean preset → button says "Share"', (await shareLabel()) === 'Share');
  ok('clean preset → restore icon hidden', !(await restoreVisible()));

  // ---- Test 3: edit → "Copy code" + breadcrumb + restore icon ----
  await typeAppend('\n<!-- my edit -->');
  await new Promise(r => setTimeout(r, 500));
  ok('edit → button relabels to "Copy code"', (await shareLabel()) === 'Copy code');
  ok('edit → "• modified" breadcrumb shown', (await page.$eval('.template-name', el => el.textContent)).includes('modified'));
  ok('edit → restore icon visible', await restoreVisible());
  ok('edit (small, not a paste) → NO trust modal', !(await dialogShown()));

  // Copy code copies the raw HTML (not a URL).
  await page.click('#shareBtn');
  await new Promise(r => setTimeout(r, 200));
  const clip = await page.evaluate(() => window.__clip[window.__clip.length - 1] || '');
  ok('Copy code → clipboard holds raw HTML, not a #code: URL', clip.includes('my edit') && !clip.startsWith('http'));

  // ---- Test 4: restore icon → back to Share ----
  await page.click('#restoreTemplateBtn');
  await new Promise(r => setTimeout(r, 500));
  ok('restore → button back to "Share"', (await shareLabel()) === 'Share');
  ok('restore → restore icon hidden again', !(await restoreVisible()));
  ok('restore → edit removed from editor', !(await page.evaluate(() => window.monaco.editor.getModels()[0].getValue())).includes('my edit'));

  // ---- Test 5: auto-reattach when edit is reverted ----
  const original = await page.evaluate(() => window.monaco.editor.getModels()[0].getValue());
  await typeAppend('\n<!-- temp -->');
  await new Promise(r => setTimeout(r, 400));
  ok('after edit again → "Copy code"', (await shareLabel()) === 'Copy code');
  await setEditor(original); // revert to exact clean content
  await new Promise(r => setTimeout(r, 500));
  ok('revert to original content → auto back to "Share"', (await shareLabel()) === 'Share');

  // ---- Test 6: paste guard ----
  // Dispatch a REAL ClipboardEvent on Monaco's hidden textarea so onDidPaste fires.
  const firePaste = (text) => page.evaluate((t) => {
    const ed = window.monaco.editor.getEditors()[0];
    ed.focus();
    const ta = document.querySelector('.monaco-editor textarea');
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);

  const big = '<div>' + 'x'.repeat(400) + '<script>alert(1)<\/script></div>';
  await firePaste(big);
  await new Promise(r => setTimeout(r, 700));
  const bigModal = await dialogShown();
  ok('large HTML paste → trust modal appears', bigModal);
  if (bigModal) {
    await page.click('#trust-cancel');
    await new Promise(r => setTimeout(r, 500));
    ok('paste cancel → pasted content reverted out of editor', !(await page.evaluate(() => window.monaco.editor.getModels()[0].getValue())).includes('alert(1)'));
  }

  // Small paste → no modal.
  await firePaste('<b>hi</b>');
  await new Promise(r => setTimeout(r, 500));
  ok('small paste → NO trust modal', !(await dialogShown()));

  await page.close();
} catch (e) {
  console.error('TEST ERROR:', e.message);
  results.push([false, 'harness error: ' + e.message, '']);
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter(r => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
