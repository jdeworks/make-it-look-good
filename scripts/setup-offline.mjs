#!/usr/bin/env node
// setup-offline.mjs — Vendor CDN assets into docs/vendor/ for offline analyzer use.
// Node built-ins only (fetch is global in Node 18+). No npm deps.
//
// Run:  node scripts/setup-offline.mjs
// Then: node server.js --offline

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const VENDOR = join(ROOT, 'docs', 'vendor');
const FONTS = join(VENDOR, 'fonts');

// A recent Chrome UA so Google Fonts returns modern woff2 @font-face rules.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// The 3 core libraries — failure of any of these exits non-zero.
const CORE_ASSETS = [
  {
    name: 'tailwind-browser.js',
    url: 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
    dest: join(VENDOR, 'tailwind-browser.js'),
  },
  {
    name: 'modern-screenshot.js',
    url: 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js',
    dest: join(VENDOR, 'modern-screenshot.js'),
  },
  {
    name: 'jszip.min.js',
    url: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    dest: join(VENDOR, 'jszip.min.js'),
  },
];

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap';

const MIN_LIB_BYTES = 1024;

/** @type {{name:string,bytes:number|null,ok:boolean,note:string}[]} */
const summary = [];

function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function fetchBuffer(url, headers = {}) {
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function downloadCore(asset) {
  try {
    const buf = await fetchBuffer(asset.url);
    await writeFile(asset.dest, buf);
    const ok = buf.length > MIN_LIB_BYTES;
    summary.push({
      name: asset.name,
      bytes: buf.length,
      ok,
      note: ok ? '' : `too small (< ${MIN_LIB_BYTES} B) — suspect failure`,
    });
    if (!ok) console.error(`  ! ${asset.name}: downloaded but only ${buf.length} B`);
    else console.log(`  ✓ ${asset.name}  (${fmtBytes(buf.length)})`);
    return ok;
  } catch (e) {
    summary.push({ name: asset.name, bytes: null, ok: false, note: e.message });
    console.error(`  ✗ ${asset.name}: ${e.message}`);
    return false;
  }
}

// Returns true if the Playfair font (css + at least one woff2) was vendored.
async function downloadFont() {
  try {
    console.log('Fetching Playfair Display CSS (Chrome UA for woff2)...');
    const cssRes = await fetch(FONT_CSS_URL, {
      headers: { 'User-Agent': CHROME_UA },
      redirect: 'follow',
    });
    if (!cssRes.ok) throw new Error(`CSS HTTP ${cssRes.status}`);
    let css = await cssRes.text();

    // Find every font file URL the CSS references.
    const urlRe = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
    const seen = new Map(); // remoteUrl -> localFilename
    let m;
    let idx = 0;
    const fontJobs = [];
    while ((m = urlRe.exec(css)) !== null) {
      const remote = m[1].replace(/^['"]|['"]$/g, '');
      if (seen.has(remote)) continue;
      const ext = (remote.match(/\.(woff2|woff|ttf|otf)(\?|$)/) || [, 'woff2'])[1];
      const local = `playfair-${idx++}.${ext}`;
      seen.set(remote, local);
      fontJobs.push({ remote, local });
    }

    if (fontJobs.length === 0) {
      // Still save the CSS so the analyzer doesn't 404, but report partial.
      await writeFile(join(FONTS, 'playfair.css'), css, 'utf8');
      summary.push({
        name: 'fonts/playfair.css',
        bytes: Buffer.byteLength(css),
        ok: false,
        note: 'no woff2 @font-face URLs found in CSS — partial',
      });
      console.error('  ! playfair.css saved but no font file URLs were found (partial).');
      return false;
    }

    let fontOk = 0;
    for (const job of fontJobs) {
      try {
        const buf = await fetchBuffer(job.remote, { 'User-Agent': CHROME_UA });
        await writeFile(join(FONTS, job.local), buf);
        // Rewrite the URL in the CSS to a local relative path.
        css = css.split(job.remote).join(`./${job.local}`);
        fontOk++;
        summary.push({ name: `fonts/${job.local}`, bytes: buf.length, ok: true, note: '' });
        console.log(`  ✓ fonts/${job.local}  (${fmtBytes(buf.length)})`);
      } catch (e) {
        summary.push({ name: `fonts/${job.local}`, bytes: null, ok: false, note: e.message });
        console.error(`  ✗ fonts/${job.local}: ${e.message}`);
      }
    }

    await writeFile(join(FONTS, 'playfair.css'), css, 'utf8');
    const cssOk = fontOk > 0;
    summary.push({
      name: 'fonts/playfair.css',
      bytes: Buffer.byteLength(css),
      ok: cssOk,
      note: cssOk ? `${fontOk}/${fontJobs.length} font files vendored` : 'no font files vendored — partial',
    });
    console.log(`  ${cssOk ? '✓' : '!'} fonts/playfair.css  (${fontOk}/${fontJobs.length} fonts rewritten to local)`);
    return cssOk;
  } catch (e) {
    summary.push({ name: 'fonts/playfair.css', bytes: null, ok: false, note: e.message });
    console.error(`  ✗ Playfair font step failed: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('make-it-look-good — offline asset setup');
  console.log(`Vendoring into: ${VENDOR}\n`);

  await mkdir(VENDOR, { recursive: true });
  await mkdir(FONTS, { recursive: true });

  console.log('Core libraries:');
  let coreFailures = 0;
  for (const asset of CORE_ASSETS) {
    const ok = await downloadCore(asset);
    if (!ok) coreFailures++;
  }

  console.log('\nFonts (cosmetic — non-blocking):');
  const fontOk = await downloadFont();

  // Summary table.
  console.log('\n=== Summary ===');
  const nameW = Math.max(...summary.map((s) => s.name.length), 4);
  console.log(`${'OK'.padEnd(3)} ${'ASSET'.padEnd(nameW)}  ${'SIZE'.padStart(9)}  NOTE`);
  for (const s of summary) {
    console.log(
      `${(s.ok ? '✓' : '✗').padEnd(3)} ${s.name.padEnd(nameW)}  ${fmtBytes(s.bytes).padStart(9)}  ${s.note}`
    );
  }

  console.log('');
  if (coreFailures > 0) {
    console.error(`FAILED: ${coreFailures} of ${CORE_ASSETS.length} core libraries did not download correctly.`);
    process.exit(1);
  }

  console.log('All 3 core libraries vendored successfully.');
  if (!fontOk) console.log('Font: PARTIAL/SKIPPED (cosmetic — analyzer falls back to serif).');
  console.log('\nRun: node server.js --offline');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
