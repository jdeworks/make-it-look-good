// Ad-hoc P2 flow-graph verification. Drives the analyzer headless against (1) the local
// deterministic SPA fixture and (2) live narratu-poc, reading session._spaProvenance.graph.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const pw = await import(ROOT + '/node_modules/playwright/index.js');
const chromium = pw.chromium || (pw.default && pw.default.chromium);

const PORT = 8933;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/analyzer.html';
    const fp = join(ROOT, 'docs', p.startsWith('/docs') ? p.slice(5) : p);
    const body = await readFile(fp);
    res.writeHead(200, { 'content-type': MIME[extname(fp)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(120000);
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

async function runGraph(url, { useUrlInput = true } = {}) {
  await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    function set(id, on) { const c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
    set('screenshotCheck', false); set('pixelVerifyCheck', false);
    set('spaExploreCheck', true); set('crawlSiteCheck', false); set('stateCaptureCheck', true);
  });
  await page.fill('#urlInput', url);
  await page.click('#analyzeUrlBtn');
  await page.waitForFunction(() => {
    const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
    return s && s.status === 'complete';
  }, { timeout: 120000 }).catch(() => {});
  return page.evaluate(() => {
    const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
    const g = s && s._spaProvenance && s._spaProvenance.graph;
    const notes = (s && s._spaProvenance && s._spaProvenance.notes) || [];
    const aggNote = notes.find((n) => /aggressive/i.test(n)) || null;
    if (!g) return { ok: false, reason: 'no graph', sessionStatus: s && s.status, pages: s && s.pages.length, notes };
    const flowCard = Array.from(document.querySelectorAll('summary')).some((el) => /Flow graph/i.test(el.textContent));
    const svg = document.querySelector('[data-flow-node]') ? document.querySelectorAll('svg').length : 0;
    const flowNodes = document.querySelectorAll('[data-flow-node]').length;
    return {
      ok: true, nodes: g.nodes.length, edges: g.edges.length,
      backEdges: g.edges.filter((e) => e.back).length,
      coverage: g.coverage, kinds: g.nodes.map((n) => n.kind),
      flowCardRendered: flowCard, svgCount: svg, flowNodesInSvg: flowNodes, pages: s.pages.length,
      aggressive: !!aggNote, aggNote, truncated: !!(g.coverage && g.coverage.truncated),
      stateNodes: g.nodes.filter((n) => n.kind === 'state').map((n) => n.stateKey),
      perPageStates: g.nodes.filter((n) => n.kind === 'state' && /all-expanded:/.test(n.stateKey || '')).length,
      notes,
      pageHidden: s.pages.map((p) => ({
        t: (p.rawData && p.rawData.meta && p.rawData.meta.title || '').split('›').pop().trim().slice(0, 24),
        hp: (p.rawData && p.rawData.layout && p.rawData.layout.hiddenPanelCount) || 0,
        kind: (p.rawData && p.rawData.meta && p.rawData.meta._spaKind) || '?'
      }))
    };
  });
}

async function clickRouteTest() {
  return page.evaluate(() => {
    // Click a non-initial flow node and see whether a page tab becomes active.
    const gs = Array.from(document.querySelectorAll('[data-flow-node]'));
    const target = gs.find((g) => { const k = g.getAttribute('data-flow-node'); return k && k !== '/' && k !== ''; });
    if (!target) return { routed: false, reason: 'no non-initial node' };
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const active = document.querySelector('.crawl-page-tab.active');
    const activeKey = active && active.getAttribute('data-crawl-page');
    return { routed: !!(activeKey && activeKey !== 'summary'), activeKey };
  });
}

const targets = [
  ['FIXTURE', `http://localhost:${PORT}/tests/fixtures/spa-views.html`],
  ['DEAD-DATA', 'https://jdeworks.github.io/dead-data-cleaner-poc/'],
  ['ANVIL', 'https://jdeworks.github.io/anvil-poc/'],
  ['NARRATU', 'https://jdeworks.github.io/narratu-poc/'],
  ['FINK', 'https://www.fink-translate.com/']
];
for (const [name, url] of targets) {
  console.log(`\n=== ${name} (${url}) ===`);
  try {
    const r = await runGraph(url);
    console.log(JSON.stringify(r, null, 2));
    if (r.ok) {
      const route = await clickRouteTest();
      console.log('  route:', JSON.stringify(route));
      const pass = r.nodes > 1 && r.edges >= 1 && (r.coverage.controlsFired || 0) > 0 && r.svgCount > 0 && r.flowNodesInSvg > 0;
      console.log(pass ? '  PASS basic assertions (+SVG)' : '  *** FAIL basic assertions');
    }
  } catch (e) { console.log('  ERR', e.message); }
}
await browser.close();
server.close();
