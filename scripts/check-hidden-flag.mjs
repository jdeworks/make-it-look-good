import { spawn } from 'child_process';
import { join } from 'path';
import { chromium } from 'playwright';

const ROOT = '/home/jens/repos/make-it-look-good';
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
page.setDefaultTimeout(90000);
page.on('console', (m) => {
  const t = m.text();
  if (/\[D\]|\[milg\]/i.test(t)) console.log('[console]', t.slice(0, 200));
});

await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
await page.fill('#urlInput', `http://localhost:${PORT}/analyzer.html`);
await page.click('#analyzeUrlBtn');
await page.waitForSelector('.report-gauge', { timeout: 80000 });
await new Promise((r) => setTimeout(r, 3000));

const result = await page.evaluate(() => {
  const raw = window.__milgLastReport && window.__milgLastReport.raw;
  if (!raw) return { error: 'no report' };
  const pairs = (raw.colors && raw.colors.contrastPairs) || [];
  const hiddenPairs = pairs.filter(p => p._hiddenAtCapture);
  const hiddenPanelCount = raw.layout && raw.layout.hiddenPanelCount;
  return {
    totalPairs: pairs.length,
    hiddenAtCapturePairs: hiddenPairs.length,
    hiddenPanelCount: hiddenPanelCount,
    screenshotsUnhidden: (raw.screenshotsUnhidden || []).length,
    sampleHiddenPairs: hiddenPairs.slice(0, 5).map(p => ({ selector: p.selector, text: p.text.slice(0, 40) }))
  };
});

console.log('\\n=== RESULT ===');
console.log(JSON.stringify(result, null, 2));

await browser.close();
server.kill();
