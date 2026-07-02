// Threshold-tuning probe — measures the signals that drive the SPA feature gates for ONE URL.
// Usage: node scripts/_tune-probe.mjs <url> [--port N] [--no-state] [--no-agg-cap]
// Prints ONE compact JSON object to stdout (everything else to stderr).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const pw = await import(ROOT + '/node_modules/playwright/index.js');
const chromium = pw.chromium || (pw.default && pw.default.chromium);

const url = process.argv[2];
if (!url) { console.error('need url'); process.exit(2); }
const portArg = process.argv.indexOf('--port');
const PORT = portArg >= 0 ? parseInt(process.argv[portArg + 1], 10) : 8940;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const log = (...a) => console.error(...a);

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/analyzer.html';
    const fp = join(ROOT, 'docs', p.startsWith('/docs') ? p.slice(5) : p);
    const b = await readFile(fp);
    res.writeHead(200, { 'content-type': MIME[extname(fp)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(150000);
let pageErrors = 0;
page.on('pageerror', () => { pageErrors++; });

const tuneArg = process.argv.indexOf('--tune');
const tuneJson = tuneArg >= 0 ? process.argv[tuneArg + 1] : null;

await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
if (tuneJson) { await page.evaluate((t) => localStorage.setItem('__milgSpaTune', t), tuneJson); log('tune override:', tuneJson); }
await page.evaluate(() => {
  function set(id, on) { const c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
  set('screenshotCheck', false); set('pixelVerifyCheck', false);
  set('spaExploreCheck', true); set('crawlSiteCheck', false); set('stateCaptureCheck', true);
});
await page.fill('#urlInput', url);
await page.click('#analyzeUrlBtn');

// Wait for either a crawl session (SPA, multi-view) or a single-page report (no graph).
await Promise.race([
  page.waitForFunction(() => { const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession(); return s && s.status === 'complete'; }, { timeout: 150000 }).catch(() => {}),
  page.waitForSelector('.report-gauge', { timeout: 150000 }).catch(() => {})
]);
await new Promise((r) => setTimeout(r, 600));

const out = await page.evaluate(() => {
  const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
  if (!s || !s.pages || !s.pages.length) {
    const r = window.__milgLastReport;
    return { isSpa: false, rootHidden: (r && r.raw && r.raw.layout && r.raw.layout.hiddenPanelCount) || 0 };
  }
  const prov = s._spaProvenance || {};
  const g = prov.graph || { nodes: [], edges: [], coverage: {} };
  const hp = s.pages.map((p) => (p.rawData && p.rawData.layout && p.rawData.layout.hiddenPanelCount) || 0);
  const skipTally = {};
  (prov.skipped || []).forEach((x) => { const k = x.reason || '?'; skipTally[k] = (skipTally[k] || 0) + 1; });
  return {
    isSpa: true,
    navCandidates: prov.navCandidateCount || 0,
    aggressive: (prov.notes || []).some((n) => /aggressive/i.test(n)),
    pages: s.pages.length,
    rootHidden: hp[0] || 0,
    hpDistribution: hp,
    hpMax: hp.reduce((a, b) => Math.max(a, b), 0),
    hpPagesGte: { 2: hp.filter((x) => x >= 2).length, 3: hp.filter((x) => x >= 3).length, 4: hp.filter((x) => x >= 4).length, 6: hp.filter((x) => x >= 6).length },
    graph: {
      nodes: g.nodes.length, edges: g.edges.length,
      backEdges: g.edges.filter((e) => e.back).length,
      stateNodes: g.nodes.filter((n) => n.kind === 'state').length,
      perPageStates: g.nodes.filter((n) => n.kind === 'state' && /all-expanded:/.test(n.stateKey || '')).length,
      kinds: g.nodes.reduce((m, n) => ((m[n.kind] = (m[n.kind] || 0) + 1), m), {}),
      coverage: g.coverage
    },
    skipTally,
    clicked: (prov.clicked || []).length,
    notes: prov.notes || []
  };
});
out.url = url;
out.pageErrors = pageErrors;
console.log(JSON.stringify(out));
await browser.close();
server.close();
