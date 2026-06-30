// Full-pipeline dogfood probe — reproduces what a user sees in the analyzer UI, end to end:
// screenshots + PIXEL VERIFY + SPA explore + state capture, then dumps per-view contrast
// diagnostics so we can see exactly how each contrast finding was classified and whether the
// small-text demotion fired. This is the committed counterpart to the structure-only scratch
// probes (_tune-probe / _verify-graph), which deliberately skip pixels.
//
// Usage:
//   node scripts/dogfood-probe.mjs <url> [--port N] [--viewport WxH] [--mode light|dark|auto]
//                                        [--no-spa] [--json]
// Prints a human-readable contrast report to stdout; add --json for the raw object instead.
import { spawn } from 'node:child_process';
const pw = await import('/home/jens/repos/make-it-look-good/node_modules/playwright/index.js');
const chromium = pw.chromium || (pw.default && pw.default.chromium);

const ROOT = '/home/jens/repos/make-it-look-good';
function arg(name, def) { const i = process.argv.indexOf('--' + name); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def; }
const flag = (n) => process.argv.includes('--' + n);
const url = process.argv[2];
if (!url || url.startsWith('--')) { console.error('usage: node scripts/dogfood-probe.mjs <url> [--port N] [--viewport WxH] [--mode light|dark] [--no-spa] [--json]'); process.exit(2); }
const PORT = parseInt(arg('port', '8990'), 10);
const VIEWPORT = arg('viewport', '1280x900');
const MODE = arg('mode', 'auto');
const WANT_SPA = !flag('no-spa');
const AS_JSON = flag('json');
const [vw, vh] = VIEWPORT.split('x').map((n) => parseInt(n, 10));

function startServer() {
  const child = spawn('node', ['server.js', '--port', String(PORT)], { cwd: ROOT, stdio: 'pipe' });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 12000);
    child.stdout.on('data', (d) => { if (String(d).includes('http://localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (c) => { clearTimeout(t); reject(new Error('server exited ' + c)); });
  });
}

const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: vw || 1280, height: vh || 900 } });
page.setDefaultTimeout(200000);

await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
await page.evaluate(({ mode, spa }) => {
  function set(id, on) { const c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
  function sel(id, v) { const c = document.getElementById(id); if (c && v && c.value !== v) { c.value = v; c.dispatchEvent(new Event('change')); } }
  set('screenshotCheck', true); set('pixelVerifyCheck', true);     // <-- the whole point: pixels ON
  set('jsEnabledCheck', true); set('jsRiskAck', true);
  set('spaExploreCheck', spa); set('stateCaptureCheck', true); set('crawlSiteCheck', false);
  sel('colorSchemeSelect', mode);
}, { mode: MODE, spa: WANT_SPA });
await page.fill('#urlInput', url);
await page.click('#analyzeUrlBtn');

// Wait for a completed SPA/crawl session OR a single-page report.
await page.waitForFunction(() => {
  const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
  if (s && s.status === 'complete') return true;
  return !!document.querySelector('.report-gauge');
}, { timeout: 200000 });
// Pixel-verify settle: every done page that has screenshots must carry _contrastVerifyResults.
await page.waitForFunction(() => {
  const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
  if (s && s.status === 'complete') {
    return s.pages.every((p) => p.status !== 'done' || !(p.rawData && p.rawData.screenshots && p.rawData.screenshots.length) || (p.rawData && p.rawData._contrastVerifyResults));
  }
  return !!(window.__milgLastReport && window.__milgLastReport.raw);
}, { timeout: 150000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1000));

const out = await page.evaluate(() => {
  // Color/Contrast findings from a scored report.
  function contrastFindings(report) {
    const out = [];
    ((report && report.categories) || []).forEach((c) => {
      if (!/contrast|colou?r/i.test(c.label || '')) return;
      (c.findings || []).forEach((f) => out.push({ severity: f.severity, title: (f.title || f.message || '?'), detail: (f.detail || '') }));
    });
    return out;
  }
  // Pixel-verify rows that matter: any real/hidden failure or boundary-crosser, with the fields
  // that drive the small-text demotion. Sorted small-font-first.
  function verifyRows(raw) {
    const rs = (raw && raw._contrastVerifyResults) || [];
    return rs.filter((r) => r && !r.skipped && (!r.cssPasses || !r.pixelPasses || r.crossesBoundary || r.demoted))
      .map((r) => ({
        text: (r.text || '').slice(0, 40), selector: r.selector, fontSize: r.fontSize || 0, isLarge: !!r.isLarge,
        cssRatio: r.cssRatio, cssPasses: !!r.cssPasses, pixelRatio: r.pixelRatio, pixelPasses: !!r.pixelPasses,
        crossesBoundary: !!r.crossesBoundary, demoted: r.demoted || null, demotionReason: r.demotionReason ? r.demotionReason.slice(0, 90) : null,
        bgHasImage: !!r.bgHasImage
      }))
      .sort((a, b) => (a.fontSize || 99) - (b.fontSize || 99));
  }
  function pageObj(title, raw, report) {
    return { title, score: report && report.overall, grade: report && report.grade, contrastFindings: contrastFindings(report), verify: verifyRows(raw), verifyTotal: (raw && raw._contrastVerifyResults || []).length };
  }
  const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
  if (s && s.pages && s.pages.length) {
    return { kind: 'spa', pages: s.pages.filter((p) => p.status === 'done').map((p) => pageObj((p.rawData && p.rawData.meta && p.rawData.meta.title) || p.title || p.url, p.rawData, p.reportData)) };
  }
  const r = window.__milgLastReport;
  return { kind: 'single', pages: [pageObj((r && r.meta && r.meta.title) || 'page', r && r.raw, r)] };
});

await browser.close();
try { server.kill(); } catch (e) {}

if (AS_JSON) { console.log(JSON.stringify(out, null, 1)); }
else {
  const SMALL = 16;
  console.log(`\n=== dogfood (full pipeline: screenshots + pixel verify${WANT_SPA ? ' + SPA + state' : ''}) ===`);
  console.log(`${url}  [${VIEWPORT} ${MODE}]  → ${out.kind}, ${out.pages.length} view(s)\n`);
  for (const p of out.pages) {
    const cFinds = p.contrastFindings.filter((f) => f.severity === 'error' || f.severity === 'warning');
    if (!cFinds.length && !p.verify.length) continue;
    console.log(`▼ ${p.title}  (score ${p.score ?? '?'} ${p.grade || ''}, ${p.verifyTotal} verify rows)`);
    cFinds.forEach((f) => console.log(`   [${f.severity}] ${f.title}${f.detail ? '  — ' + f.detail.slice(0, 110) : ''}`));
    p.verify.forEach((v) => {
      const tag = v.fontSize && v.fontSize <= SMALL && !v.isLarge ? 'SMALL' : '     ';
      const cls = !v.cssPasses ? 'CSS-FAIL' : (!v.pixelPasses ? 'hidden-fail' : 'boundary');
      console.log(`   ${tag} ${v.fontSize}px ${cls}  css=${(v.cssRatio||0).toFixed(2)} px=${(v.pixelRatio||0).toFixed(2)}  demoted=${v.demoted || '-'}  "${v.text}"  ${v.selector || ''}`);
    });
    console.log('');
  }
}
