import { spawn } from 'child_process';
import { chromium } from 'playwright';

const ROOT = '/home/jens/repos/make-it-look-good';
const PORT = 8935;

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
  if (/DEBUG-MSG|DEBUG-RUN|DEBUG-ORIG/i.test(t)) console.log('[c]', t.slice(0, 300));
});

await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });

// Intercept ALL milg messages
await page.evaluate(() => {
  const origAddEventListener = window.addEventListener.bind(window);
  window.addEventListener = function(type, handler, opts) {
    if (type === 'message') {
      const wrapped = function(e) {
        if (e.data && e.data.type && e.data.type.startsWith('milg')) {
          const pairs = (e.data.data && e.data.data.colors && e.data.data.colors.contrastPairs)
            || (e.data.updatedData && e.data.updatedData.colors && e.data.updatedData.colors.contrastPairs)
            || [];
          const hidden = pairs.filter(p => p._hiddenAtCapture).length;
          console.log('[DEBUG-MSG]', e.data.type, 'pairs=' + pairs.length, 'hidden=' + hidden, '@t=' + Date.now());
        }
        return handler(e);
      };
      return origAddEventListener(type, wrapped, opts);
    }
    return origAddEventListener(type, handler, opts);
  };
});

await page.fill('#urlInput', `http://localhost:${PORT}/analyzer.html`);
await page.click('#analyzeUrlBtn');
await page.waitForSelector('.report-gauge', { timeout: 80000 });
await new Promise(r => setTimeout(r, 3000));

await browser.close();
server.kill();
