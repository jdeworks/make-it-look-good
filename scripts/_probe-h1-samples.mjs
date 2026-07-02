// Scratch probe: compare how the h1 "Keep your codebase lean..." collects contrast sample pairs
// on https://jdeworks.github.io/dead-data-cleaner-poc/ in (1) pixel-verify no-SPA vs (2) pixel-verify
// + SPA. Dumps which verify path ran (edge/grid), the bbox, and how many bg compare points land
// OUTSIDE the bbox. Usage: node scripts/_probe-h1-samples.mjs
import { spawn } from 'node:child_process';
const pw = await import('/home/jens/repos/make-it-look-good/node_modules/playwright/index.js');
const chromium = pw.chromium || (pw.default && pw.default.chromium);
const ROOT = '/home/jens/repos/make-it-look-good';
const PORT = 8991;
const URL = 'https://jdeworks.github.io/dead-data-cleaner-poc/';
const MATCH = 'Keep your codebase';

function startServer() {
  const child = spawn('node', ['server.js', '--port', String(PORT)], { cwd: ROOT, stdio: 'pipe' });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 12000);
    child.stdout.on('data', (d) => { if (String(d).includes('http://localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (c) => { clearTimeout(t); reject(new Error('server exited ' + c)); });
  });
}

function analyzeExtract(spa) {
  return async (page) => {
    await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
    await page.evaluate((useSpa) => {
      function set(id, on) { const c = document.getElementById(id); if (c && !!c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }
      set('screenshotCheck', true); set('pixelVerifyCheck', true);
      set('jsEnabledCheck', true); set('jsRiskAck', true);
      set('spaExploreCheck', useSpa); set('stateCaptureCheck', false); set('crawlSiteCheck', false);
    }, spa);
    await page.fill('#urlInput', URL);
    await page.click('#analyzeUrlBtn');
    await page.waitForFunction(() => {
      const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
      if (s && s.status === 'complete') return true;
      return !!document.querySelector('.report-gauge');
    }, { timeout: 200000 });
    await page.waitForFunction(() => {
      const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
      if (s && s.status === 'complete') return s.pages.every((p) => p.status !== 'done' || !(p.rawData && p.rawData.screenshots && p.rawData.screenshots.length) || (p.rawData && p.rawData._contrastVerifyResults));
      return !!(window.__milgLastReport && window.__milgLastReport.raw && window.__milgLastReport.raw._contrastVerifyResults);
    }, { timeout: 150000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));

    return page.evaluate((match) => {
      function scanRaw(raw, label) {
        const rs = (raw && raw._contrastVerifyResults) || [];
        const hit = rs.find((r) => r && (r.text || '').indexOf(match) >= 0);
        if (!hit) return { label, found: false, total: rs.length };
        const bb = hit.bbox || {};
        const meta = raw.screenshotMeta || {};
        const sc = meta.scale || 1, cox = meta.cropOffsetX || 0, coy = meta.cropOffsetY || 0;
        // bbox mapped into canvas px, same as the sampler
        const cx = bb.left * sc - cox, cy = bb.top * sc - coy, cw = bb.width * sc, ch = bb.height * sc;
        const fg = (hit.samplePoints && hit.samplePoints.fg) || [];
        const bg = (hit.samplePoints && hit.samplePoints.bg) || [];
        function outside(p) { return p.x < cx || p.x >= cx + cw || p.y < cy || p.y >= cy + ch; }
        const fgWithBg = fg.filter((p) => typeof p.bgX === 'number');
        const fgBgOutside = fgWithBg.filter((p) => (p.bgX < cx || p.bgX >= cx + cw || p.bgY < cy || p.bgY >= cy + ch));
        const bgOutside = bg.filter(outside);
        // How FAR is each fg from its paired bg? (edge path = tight glyph ring; grid = keep-out)
        const dists = fgWithBg.map((p) => Math.hypot(p.x - p.bgX, p.y - p.bgY)).sort((a, b) => a - b);
        const q = (f) => dists.length ? Math.round(dists[Math.min(dists.length - 1, Math.floor(dists.length * f))]) : 0;
        const distStats = { median: q(0.5), p90: q(0.9), max: dists.length ? Math.round(dists[dists.length - 1]) : 0 };
        return {
          label, found: true, total: rs.length,
          method: (hit._debug && hit._debug.method) || (hit._debug ? 'edge?' : 'none'),
          isRegion: !!meta.isRegion, scale: sc, crop: [cox, coy],
          bboxCanvas: [Math.round(cx), Math.round(cy), Math.round(cw), Math.round(ch)],
          fgCount: fg.length, fgWithBg: fgWithBg.length,
          fgBgOutsideCount: fgBgOutside.length,
          bgCount: bg.length, bgOutsideCount: bgOutside.length,
          pairDist: distStats,
          cssRatio: hit.cssRatio, pixelRatio: hit.pixelRatio
        };
      }
      const s = window.MilgCrawlUI && MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession();
      if (s && s.pages && s.pages.length) {
        const done = s.pages.filter((p) => p.status === 'done');
        const scans = done.map((p, i) => scanRaw(p.rawData, `spa-view#${i} ${(p.title || p.url || '').slice(0, 40)}`)).filter((x) => x.found);
        return { kind: 'spa', scans };
      }
      const r = window.__milgLastReport;
      return { kind: 'single', scans: [scanRaw(r && r.raw, 'single')] };
    }, MATCH);
  };
}

const server = await startServer();
const browser = await chromium.launch();
try {
  for (const spa of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(200000);
    const res = await analyzeExtract(spa)(page);
    console.log(`\n===== ${spa ? 'SPA + pixel-verify' : 'pixel-verify (NO SPA)'} =====`);
    console.log('kind:', res.kind);
    for (const s of res.scans) {
      if (!s.found) { console.log(`  ${s.label}: h1 NOT found (total ${s.total})`); continue; }
      console.log(`  ${s.label}: path=${s.method} isRegion=${s.isRegion} scale=${s.scale} crop=${s.crop}`);
      console.log(`     bboxCanvas=[${s.bboxCanvas}] css=${(s.cssRatio||0).toFixed(2)} px=${(s.pixelRatio||0).toFixed(2)}`);
      console.log(`     fg=${s.fgCount} (withBg ${s.fgWithBg}) → fg-paired-bg OUTSIDE bbox: ${s.fgBgOutsideCount}`);
      console.log(`     bg=${s.bgCount} → bg points OUTSIDE bbox: ${s.bgOutsideCount}`);
      console.log(`     fg→bg pair distance (canvas px): median=${s.pairDist.median} p90=${s.pairDist.p90} max=${s.pairDist.max}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  try { server.kill(); } catch (e) {}
}
