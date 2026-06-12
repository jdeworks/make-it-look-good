#!/usr/bin/env node
// Usage: node scripts/diag-regions.mjs [self|tokenmade]
// Diagnostic: (1) mask/bbox alignment on analyzer.html phantom pairs,
// (2) tokenmade region screenshots saved to files.
// Outputs annotated overlay + region webp files to /tmp/milg-diag/.
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';

const ROOT = '/home/jens/repos/make-it-look-good';
const OUT = '/tmp/milg-diag';
mkdirSync(OUT, { recursive: true });
const PORT = 8925;
const MODE = process.argv[2] || 'self'; // self | tokenmade

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
page.setDefaultTimeout(260000);
page.on('console', (m) => {
  const t = m.text();
  if (/milg-region|milg-verify|\[D\]/.test(t)) console.log('[console]', t.slice(0, 220));
});

await page.goto(`http://localhost:${PORT}/analyzer.html`, { waitUntil: 'networkidle' });
await page.evaluate((wantJs) => {
  const ids = [['pixelVerifyCheck', true]];
  if (wantJs) { ids.push(['jsEnabledCheck', true]); }
  for (const [id, on] of ids) {
    const c = document.getElementById(id);
    if (c && c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); }
  }
  const ack = document.getElementById('jsRiskAck');
  if (ack && !ack.checked) { ack.checked = true; ack.dispatchEvent(new Event('change')); }
}, MODE === 'tokenmade');
const target = MODE === 'tokenmade' ? 'https://www.tokenmade.ai' : `http://localhost:${PORT}/analyzer.html`;
await page.fill('#urlInput', target);
await page.click('#analyzeUrlBtn');
await page.waitForSelector('.report-gauge', { timeout: 240000 });
await new Promise((r) => setTimeout(r, 15000));

// --- Save main + region screenshots, dump region info ---
const regionInfo = await page.evaluate(() => {
  const raw = window.__milgLastReport && window.__milgLastReport.raw;
  if (!raw) return { error: 'no report' };
  return {
    screenshotMeta: raw.screenshotMeta,
    main: (raw.screenshots && raw.screenshots[0] || '').slice(0, 100000000),
    regions: (raw.regionScreenshots || []).map((r) => ({
      kind: r.kind, label: r.label, noAnchor: !!r.noAnchor,
      containerRect: r.containerRect, meta: r.screenshotMeta,
      shot: r.screenshot || '',
      extracted: r.extractedData ? {
        pairs: (r.extractedData.colors && r.extractedData.colors.contrastPairs || []).length,
        textColors: (r.extractedData.colors && r.extractedData.colors.textColors || []).slice(0, 5),
        bgColors: (r.extractedData.colors && r.extractedData.colors.bgColors || []).slice(0, 5),
        elements: r.extractedData.structure && r.extractedData.structure.totalElements,
      } : null,
      maskCount: r.maskResults ? Object.keys(r.maskResults).length : 0,
    })),
  };
});
function saveDataUri(uri, name) {
  if (!uri || !uri.startsWith('data:')) { console.log('  (no data for ' + name + ')'); return; }
  const b64 = uri.split(',')[1];
  const ext = uri.includes('webp') ? 'webp' : 'png';
  writeFileSync(join(OUT, name + '.' + ext), Buffer.from(b64, 'base64'));
  console.log('  saved', name + '.' + ext, Math.round(b64.length * 0.75 / 1024) + 'kB');
}
console.log('\n=== regions (' + MODE + ') ===');
saveDataUri(regionInfo.main, MODE + '-main');
(regionInfo.regions || []).forEach((r, i) => {
  console.log(`[${i}] kind=${r.kind} label="${r.label}" noAnchor=${r.noAnchor} rect=${JSON.stringify(r.containerRect)} meta=${JSON.stringify(r.meta)} extracted=${JSON.stringify(r.extracted)} masks=${r.maskCount}`);
  saveDataUri(r.shot, MODE + '-region-' + i);
});

// --- Phantom-pair bbox annotation + mask rendering (self mode) ---
if (MODE === 'self') {
  const annot = await page.evaluate(async () => {
    const raw = window.__milgLastReport && window.__milgLastReport.raw;
    const vr = raw._contrastVerifyResults || [];
    const pairs = (raw.colors && raw.colors.contrastPairs) || [];
    const suspects = vr.filter((r) => !r.skipped && r.cssRatio >= 4 && r.pixelRatio <= 2);
    const meta = raw.screenshotMeta;
    const scale = meta.scale || 1.5;
    // load main screenshot to canvas
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = raw.screenshots[0]; });
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.strokeStyle = 'red'; ctx.lineWidth = 3; ctx.font = '20px sans-serif'; ctx.fillStyle = 'red';
    const out = [];
    suspects.forEach((s, i) => {
      const pair = pairs.find((p) => p.selector === s.selector && (p.text || '').trim().slice(0, 40) === (s.text || '').slice(0, 40).trim()) || pairs.find((p) => p.selector === s.selector);
      if (!pair || !pair.bbox) { out.push({ sel: s.selector, noPair: true }); return; }
      const b = pair.bbox;
      ctx.strokeRect(b.left * scale, b.top * scale, b.width * scale, b.height * scale);
      ctx.fillText('#' + i, b.left * scale - 28, b.top * scale + 16);
      out.push({
        i, sel: s.selector, text: (s.text || '').slice(0, 35), cssRatio: s.cssRatio, pixelRatio: s.pixelRatio,
        bbox: b, hasMask: !!pair._maskBmp, maskW: pair._maskW, maskH: pair._maskH,
        maskPacked: !!pair._maskPacked, maskLayer: pair._maskLayer,
        fg: pair.fg, bg: pair.bg,
        pixelBgDominant: s.pixelBgDominant, pixelBgWorst: s.pixelBgWorst, bgSamples: s.bgSamples,
      });
    });
    // render the first suspect's mask bitmap if present
    let maskUri = null;
    const first = suspects.map((s) => pairs.find((p) => p.selector === s.selector)).find((p) => p && p._maskBmp);
    if (first) {
      const mw = first._maskW, mh = first._maskH;
      const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
      const mctx = mc.getContext('2d');
      const id = mctx.createImageData(mw, mh);
      const bmp = first._maskBmp;
      for (let p = 0; p < mw * mh; p++) {
        let bit;
        if (first._maskPacked) bit = (bmp[p >> 3] >> (p & 7)) & 1;
        else bit = bmp[p] ? 1 : 0;
        id.data[p * 4] = bit ? 255 : 255; id.data[p * 4 + 1] = bit ? 0 : 255;
        id.data[p * 4 + 2] = bit ? 255 : 255; id.data[p * 4 + 3] = 255;
      }
      mctx.putImageData(id, 0, 0);
      maskUri = mc.toDataURL('image/png');
    }
    return { annotated: cv.toDataURL('image/png'), suspects: out, maskUri, meta };
  });
  console.log('\n=== phantom suspects ===');
  (annot.suspects || []).forEach((s) => console.log(' ', JSON.stringify(s)));
  console.log('screenshotMeta:', JSON.stringify(annot.meta));
  saveDataUri(annot.annotated, 'self-annotated');
  if (annot.maskUri) saveDataUri(annot.maskUri, 'self-first-suspect-mask');
}

await browser.close();
server.kill();
console.log('done');
