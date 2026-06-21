#!/usr/bin/env node
// Deterministic preset score/thumb matrix runner.
//
// Build jobs:
//   node scripts/generate-preset-score-matrix.mjs --mode smoke --dry-run
//
// Run incrementally:
//   node scripts/generate-preset-score-matrix.mjs --mode smoke --workers 4 --resume
//
// Combine an existing run:
//   node scripts/generate-preset-score-matrix.mjs --combine-only --out research/preset-score-matrix/<run>

import puppeteer from 'puppeteer';
import { createServer } from 'http';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs';
import { extname, join } from 'path';
import vm from 'vm';

const ROOT_DIR = join(import.meta.dirname, '..');
const DOCS_DIR = join(ROOT_DIR, 'docs');
const PRESETS_DIR = join(DOCS_DIR, 'presets');
const RESEARCH_DIR = join(ROOT_DIR, 'research', 'preset-score-matrix');
const PORT = 8788;
const VERSION = 'matrix-v1';

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3);
    if (arg === `--${name}`) {
      const next = args[i + 1];
      if (next && !next.startsWith('--')) return next;
      return 'true';
    }
  }
  return fallback;
};
const MODE = getArg('mode', 'smoke');
const WORKERS = Math.max(1, parseInt(getArg('workers', '4'), 10) || 4);
const ONLY = getArg('only', '');
const OUT_ARG = getArg('out', '');
let OUT_DIR = join(ROOT_DIR, OUT_ARG || `research/preset-score-matrix/${new Date().toISOString().replace(/[:.]/g, '-')}`);
const LATEST_RUN_FILE = join(RESEARCH_DIR, 'latest-run.txt');
const DRY_RUN = args.includes('--dry-run');
const RESUME = args.includes('--resume');
const COMBINE_ONLY = args.includes('--combine-only');
const PUBLISH = args.includes('--publish');
const THUMBNAILS = getArg('thumbnails', 'default'); // none | default | all
const CAPTURE_FORMAT = getArg('thumbnail-format', 'png');
const BLOCKER_THRESHOLD = parseInt(getArg('blocker-threshold', '95'), 10) || 95;

const VIEWPORTS = {
  'small-mobile': { name: 'small-mobile', width: 320, height: 568 },
  mobile: { name: 'mobile', width: 375, height: 812 },
  tablet: { name: 'tablet', width: 768, height: 1024 },
  desktop: { name: 'desktop', width: 1280, height: 900 },
  wide: { name: 'wide', width: 1920, height: 1080 },
  'short-desktop': { name: 'short-desktop', width: 1280, height: 720 },
};
const TIER_1_COLORS = ['primary', 'blue', 'slate', 'emerald', 'rose', 'amber', 'violet', 'cyan'];
const SMOKE_EFFECTS = ['none', 'frosted'];
const ALL_EFFECTS = ['none', 'hushed', 'bouncy', 'frosted', 'serif'];

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function fileExists(file) {
  return existsSync(file);
}

function startServer() {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  };
  const server = createServer((req, res) => {
    const cleanUrl = (req.url || '/').split('?')[0].replace(/^\/+/, '');
    const filePath = join(DOCS_DIR, cleanUrl || 'index.html');
    if (!fileExists(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} already in use — assuming existing server serves docs.`);
    } else {
      throw err;
    }
  });
  server.listen(PORT, '127.0.0.1');
  return server;
}

function findBlockEnd(src, start) {
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error('Could not find function block end');
}

function findArrayEnd(src, start) {
  const open = src.indexOf('[', start);
  let depth = 0;
  let inString = '';
  let escaped = false;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inString) inString = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) return src.indexOf(';', i) + 1;
    }
  }
  throw new Error('Could not find array end');
}

function loadGalleryLogic() {
  const src = readFileSync(join(DOCS_DIR, 'app.js'), 'utf8');
  const colorStart = src.indexOf('const tailwindColors');
  const colorEnd = src.indexOf('// Primary colors now');
  const styleStart = src.indexOf('const visualStyles');
  const styleEnd = findArrayEnd(src, styleStart);
  const gradientStart = src.indexOf('const gradientCompanions');
  const applyStart = src.indexOf('function applyColorTheme');
  const applyEnd = findBlockEnd(src, applyStart);
  const code = [
    src.slice(colorStart, colorEnd),
    src.slice(styleStart, styleEnd),
    src.slice(gradientStart, applyStart),
    src.slice(applyStart, applyEnd),
    'this.__milg = { tailwindColors, tailwindRGB, accentColorNames, colorToTheme, visualStyles, applyColorTheme };',
  ].join('\n');
  const context = { console };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.__milg;
}

const gallery = loadGalleryLogic();
const EFFECTS = gallery.visualStyles.map(s => ({
  name: s.name.toLowerCase(),
  label: s.label || s.name,
  css: s.css || '',
}));
const EFFECT_BY_NAME = Object.fromEntries(EFFECTS.map(e => [e.name, e]));

function manifestPrimary(manifest, element, personality) {
  return manifest.elements[element]?.personalities?.[personality]?.primaryColor || 'blue';
}

function presetNeutral(element) {
  return element === 'restaurant' ? 'stone' : 'slate';
}

function transformHtml(html, manifest, job) {
  if (!html || job.personality === 'before') return html || '';
  const fromPrimary = manifestPrimary(manifest, job.element, job.personality);
  const toPrimary = job.color === 'primary' ? fromPrimary : job.color;
  const theme = gallery.colorToTheme(toPrimary);
  return gallery.applyColorTheme(html, fromPrimary, theme.primary, presetNeutral(job.element), theme.neutral, theme);
}

function loadExtractorText() {
  const code = readFileSync(join(DOCS_DIR, 'analyzer-extract.js'), 'utf8');
  const match = code.match(/function extractFromDocument\(\)\s*\{/);
  if (!match) throw new Error('No extractFromDocument in analyzer-extract.js');
  const start = code.indexOf(match[0]);
  const end = findBlockEnd(code, start);
  return code.slice(start, end).replace(/milg-analyzer-result/g, 'milg-headless-result');
}

function buildSrcdoc(html, job, extractFn = '') {
  const effect = EFFECT_BY_NAME[job.effect] || EFFECT_BY_NAME.none;
  const darkClass = job.dark ? ' class="dark"' : '';
  const darkVariantCSS = '@custom-variant dark (&:where(.dark, .dark *));';
  const tailwindScript = `http://localhost:${PORT}/vendor/tailwind-browser.js`;
  return '<!doctype html><html lang="en"' + darkClass + '><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<script src="' + tailwindScript + '"></' + 'script>' +
    '<style type="text/tailwindcss">' + darkVariantCSS + '</style>' +
    (effect.css ? '<style>' + effect.css + '</style>' : '') +
    '<style>body{margin:0}</style></head><body>' +
    '<script>window.__milgIsFragment=true;</' + 'script>' +
    html +
    // @tailwindcss/browser@4 compiles utilities ASYNCHRONOUSLY (MutationObserver, no
    // ready event). A flat setTimeout races the compile under parallel workers and can
    // measure a completely UNSTYLED document → spurious touch-target/line-length/contrast
    // findings. Instead poll a sentinel arbitrary utility (min-h-[44px]) until it computes,
    // then wait for fonts, then settle one frame. Hard cap so a broken render still scores.
    (extractFn ? '<script>(function(){' +
      'function ready(){' +
        'var p=document.createElement("a");' +
        'p.className="min-h-[44px]";' +
        'p.style.cssText="position:absolute;left:-9999px;top:-9999px";' +
        'document.body.appendChild(p);' +
        'var ok=parseFloat(getComputedStyle(p).minHeight)>=44;' +
        'p.remove();' +
        'return ok;' +
      '}' +
      'function go(){' +
        'var f=(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve();' +
        'f.then(function(){requestAnimationFrame(function(){requestAnimationFrame(function(){(' + extractFn + ')()})})});' +
      '}' +
      // settled = Tailwind compiled AND no finite entrance/reveal animation still active
      // (opacity-based contrast must be measured at the animation END state). Infinite loops
      // (e.g. gradient shifts) are ignored so they never block. Small floor for layout settle.
      'function settled(){' +
        'if(!ready())return false;' +
        'try{var as=document.getAnimations?document.getAnimations():[];' +
          'for(var i=0;i<as.length;i++){var a=as[i];' +
            'if(a.playState!=="running"&&a.playState!=="pending")continue;' +
            'var t=(a.effect&&a.effect.getComputedTiming)?a.effect.getComputedTiming():null;' +
            'if(t&&t.iterations===Infinity)continue;' +
            'return false;}' +
        '}catch(e){}' +
        'return true;' +
      '}' +
      // Floor of 2500ms: ready() (a probe utility compiling) does NOT guarantee the whole
      // document is painted — a large preset needs time after first compile. Empirically a
      // 300ms floor mis-measures static presets as unstyled. Keep 2500ms AND wait for any
      // finite animation still running past it.
      'var start=Date.now();' +
      '(function poll(){' +
        'var el=Date.now()-start;' +
        'if((settled()&&el>=2500)||el>8000){go();}' +
        'else{setTimeout(poll,80);}' +
      '})();' +
    '})()</' + 'script>' : '') +
    '</body></html>';
}

function allPresetVariants(manifest) {
  const variants = [];
  for (const [element, info] of Object.entries(manifest.elements || {})) {
    for (const personality of Object.keys(info.personalities || {})) {
      if (personality === 'before') continue;
      const presetKey = `${element}/${personality}`;
      if (ONLY && element !== ONLY && presetKey !== ONLY && !element.includes(ONLY)) continue;
      const file = join(PRESETS_DIR, element, `${personality}.html`);
      if (fileExists(file)) variants.push({ element, personality });
    }
  }
  return variants;
}

function allManifestPresetVariants(manifest) {
  const variants = [];
  for (const [element, info] of Object.entries(manifest.elements || {})) {
    for (const personality of Object.keys(info.personalities || {})) {
      if (personality === 'before') continue;
      const file = join(PRESETS_DIR, element, `${personality}.html`);
      if (fileExists(file)) variants.push({ element, personality });
    }
  }
  return variants;
}

function smokePresetVariants(manifest) {
  const preferred = [
    'landing/clean',
    'dashboard/clean',
    'form/clean',
    'pricing/clean',
    'hero/clean',
    'data-table/clean',
    'devtool-landing/clean',
    'docs-site/clean',
  ];
  const all = allPresetVariants(manifest);
  const byKey = Object.fromEntries(all.map(v => [`${v.element}/${v.personality}`, v]));
  const picked = preferred.map(k => byKey[k]).filter(Boolean);
  return picked.length ? picked : all.slice(0, 8);
}

function dimensionsForMode(manifest) {
  if (MODE === 'smoke') {
    return {
      variants: smokePresetVariants(manifest),
      viewports: [VIEWPORTS.mobile, VIEWPORTS.desktop],
      colors: ['primary'],
      darks: [false, true],
      effects: SMOKE_EFFECTS,
    };
  }
  if (MODE === 'full') {
    return {
      variants: allPresetVariants(manifest),
      viewports: [VIEWPORTS['small-mobile'], VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop, VIEWPORTS.wide, VIEWPORTS['short-desktop']],
      colors: gallery.accentColorNames(),
      darks: [false, true],
      effects: ALL_EFFECTS,
    };
  }
  return {
    variants: allPresetVariants(manifest),
    viewports: [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop, VIEWPORTS.wide],
    colors: TIER_1_COLORS,
    darks: [false, true],
    effects: ALL_EFFECTS,
  };
}

function jobId(job) {
  return `${job.element}/${job.personality}|${job.viewport.name}|${job.color}|${job.dark ? 'dark' : 'light'}|${job.effect}`;
}

function thumbnailPath(job) {
  return join(OUT_DIR, 'thumbnails', job.element, `${job.personality}.${CAPTURE_FORMAT}`);
}

function shouldCaptureThumbnail(job, manifest) {
  if (THUMBNAILS === 'none') return false;
  if (THUMBNAILS === 'all') return true;
  return job.viewport.name === 'desktop' &&
    job.color === 'primary' &&
    !job.dark &&
    job.effect === 'none' &&
    job.color === 'primary' &&
    manifestPrimary(manifest, job.element, job.personality);
}

function buildJobs(manifest) {
  const dims = dimensionsForMode(manifest);
  const jobs = [];
  for (const variant of dims.variants) {
    for (const viewport of dims.viewports) {
      for (const color of dims.colors) {
        for (const dark of dims.darks) {
          for (const effect of dims.effects) {
            const job = { ...variant, viewport, color, dark, effect };
            job.id = jobId(job);
            jobs.push(job);
          }
        }
      }
    }
  }
  return jobs;
}

function readCompletedIds(resultsFile) {
  if (!RESUME || !fileExists(resultsFile)) return new Set();
  const ids = new Set();
  for (const line of readFileSync(resultsFile, 'utf8').split(/\n+/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.id) ids.add(row.id);
    } catch (_) {}
  }
  return ids;
}

async function prepareWorkerPage(browser) {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/tests/preset-score-harness.html`, { waitUntil: 'networkidle0', timeout: 15000 });
  const ok = await page.evaluate(() => !!window.MilgScoring);
  if (!ok) throw new Error('MilgScoring did not load in harness');
  return page;
}

async function launchBrowser() {
  // --disable-dev-shm-usage: on WSL2/containers /dev/shm is small; chromium fills it under
  // sustained load and tabs crash with "Target closed" after a few hundred rows. Route shared
  // memory to /tmp instead so long full-matrix runs stay stable.
  const options = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
  try {
    const browser = await puppeteer.launch(options);
    return { browser, engine: 'puppeteer' };
  } catch (puppeteerError) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch(options);
    console.warn(`Puppeteer launch failed (${puppeteerError.message}). Using Playwright Chromium.`);
    return { browser, engine: 'playwright' };
  }
}

async function setViewport(page, viewport) {
  const size = { width: viewport.width, height: viewport.height };
  if (typeof page.setViewport === 'function') {
    await page.setViewport(size);
    return;
  }
  await page.setViewportSize(size);
}

async function scoreJob(page, manifest, extractFn, job) {
  const raw = readFileSync(join(PRESETS_DIR, job.element, `${job.personality}.html`), 'utf8');
  const html = transformHtml(raw, manifest, job);
  const srcdoc = buildSrcdoc(html, job, extractFn);
  await setViewport(page, job.viewport);
  return page.evaluate(async ({ srcdoc, job }) => {
    return new Promise(resolve => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${job.viewport.width}px;height:${job.viewport.height}px;border:none;`;
      iframe.sandbox = 'allow-scripts allow-same-origin';
      document.body.appendChild(iframe);
      let handled = false;
      function done(value) {
        if (handled) return;
        handled = true;
        window.removeEventListener('message', onMsg);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        resolve(value);
      }
      function onMsg(e) {
        if (!e.data || e.data.type !== 'milg-headless-result') return;
        const data = e.data.data;
        data.profile = 'general';
        data.meta.isFragment = true;
        data.meta.url = `${job.element}/${job.personality}`;
        try {
          const report = window.MilgScoring.runScoring(data);
          done({
            overall: report.overall,
            grade: report.grade,
            darknessLevel: data.colors && data.colors.darknessLevel,
            categories: report.categories.map(c => ({
              label: c.label,
              score: c.score,
              na: !!c.notApplicable,
              errors: c.findings.filter(f => f.severity === 'error').length,
              warnings: c.findings.filter(f => f.severity === 'warning').length,
              infos: c.findings.filter(f => f.severity === 'info').length,
              findings: c.findings.map(f => ({ severity: f.severity, title: f.title, detail: f.detail || '' })),
            })),
          });
        } catch (err) {
          done({ error: err.message });
        }
      }
      window.addEventListener('message', onMsg);
      iframe.srcdoc = srcdoc;
      setTimeout(() => done({ error: 'Timeout' }), 30000);
    });
  }, { srcdoc, job });
}

async function captureThumbnail(page, manifest, job) {
  const out = thumbnailPath(job);
  if (fileExists(out)) return out;
  ensureDir(join(OUT_DIR, 'thumbnails', job.element));
  const raw = readFileSync(join(PRESETS_DIR, job.element, `${job.personality}.html`), 'utf8');
  const html = transformHtml(raw, manifest, job);
  const srcdoc = buildSrcdoc(html, job);
  await setViewport(page, { width: 1280, height: 900 });
  await page.setContent(srcdoc, { waitUntil: 'networkidle0', timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: out,
    type: CAPTURE_FORMAT === 'png' ? 'png' : 'webp',
    quality: CAPTURE_FORMAT === 'png' ? undefined : 78,
    fullPage: false,
  });
  return out;
}

function compactResult(row) {
  const errors = row.categories ? row.categories.reduce((s, c) => s + c.errors, 0) : 0;
  const warnings = row.categories ? row.categories.reduce((s, c) => s + c.warnings, 0) : 0;
  return {
    id: row.id,
    preset: `${row.element}/${row.personality}`,
    score: row.overall,
    grade: row.grade,
    errors,
    warnings,
    viewport: row.viewport.name,
    color: row.color,
    dark: row.dark,
    effect: row.effect,
  };
}

function isBlockerRow(row) {
  return !!row.error || (typeof row.overall === 'number' && row.overall < BLOCKER_THRESHOLD);
}

function isPolishRow(row) {
  return !row.error && !isBlockerRow(row) && (
    totalFindings(row, 'error') > 0 ||
    totalFindings(row, 'warning') > 0
  );
}

function readRows(resultsFile) {
  if (!fileExists(resultsFile)) return [];
  return readFileSync(resultsFile, 'utf8')
    .split(/\n+/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function combineReports() {
  ensureDir(join(ROOT_DIR, 'docs', 'presets'));
  ensureDir(OUT_DIR);
  const resultsFile = join(OUT_DIR, 'results.jsonl');
  const rows = readRows(resultsFile);
  const ok = rows.filter(r => !r.error && typeof r.overall === 'number');
  const manifest = readJson(join(PRESETS_DIR, 'index.json'));
  const byPreset = new Map();
  for (const row of ok) {
    const key = `${row.element}/${row.personality}`;
    if (!byPreset.has(key)) byPreset.set(key, []);
    byPreset.get(key).push(row);
  }
  const isCompleteGlobalRun = MODE !== 'smoke' && byPreset.size >= allManifestPresetVariants(manifest).length;
  const shouldPublish = PUBLISH;

  const matrix = {};
  for (const [preset, presetRows] of byPreset) {
    const scores = presetRows.map(r => r.overall);
    const defaultRow = presetRows.find(r =>
      r.viewport.name === 'desktop' &&
      r.color === 'primary' &&
      !r.dark &&
      r.effect === 'none'
    ) || presetRows[0];
    const blockers = presetRows.filter(isBlockerRow);
    const polish = presetRows.filter(isPolishRow);
    matrix[preset] = {
      default: {
        score: defaultRow.overall,
        grade: defaultRow.grade,
        errors: totalFindings(defaultRow, 'error'),
        warnings: totalFindings(defaultRow, 'warning'),
      },
      min: Math.min(...scores),
      max: Math.max(...scores),
      avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      blockers: blockers.length,
      polish: polish.length,
      failures: blockers.length,
      worst: presetRows
        .slice()
        .sort((a, b) => a.overall - b.overall)
        .slice(0, 5)
        .map(compactResult),
    };
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    analyzerVersion: VERSION,
    mode: MODE,
    scope: isCompleteGlobalRun ? 'global' : 'focused',
    published: shouldPublish,
    blockerThreshold: BLOCKER_THRESHOLD,
    rows: ok.length,
    matrix,
  };
  if (shouldPublish) {
    writeFileSync(join(DOCS_DIR, 'presets', 'scores.json'), JSON.stringify(artifact, null, 2) + '\n');
  }
  writeFileSync(join(OUT_DIR, 'latest.json'), JSON.stringify({ generatedAt: artifact.generatedAt, rows }, null, 2) + '\n');
  writeFileSync(join(OUT_DIR, 'latest.md'), buildLatestMarkdown(rows, ok, artifact));
  writeFileSync(join(OUT_DIR, 'failures.md'), buildFailuresMarkdown(rows));
  writeThumbnailIndex();
  return artifact;
}

function totalFindings(row, severity) {
  if (!row.categories) return 0;
  const key = severity === 'error' ? 'errors' : severity === 'warning' ? 'warnings' : 'infos';
  return row.categories.reduce((s, c) => s + (c[key] || 0), 0);
}

function buildLatestMarkdown(rows, ok, artifact = {}) {
  const errors = rows.filter(r => r.error);
  const avg = ok.length ? Math.round(ok.reduce((s, r) => s + r.overall, 0) / ok.length) : 0;
  const min = ok.length ? Math.min(...ok.map(r => r.overall)) : 0;
  const max = ok.length ? Math.max(...ok.map(r => r.overall)) : 0;
  const blockers = rows.filter(isBlockerRow);
  const polish = ok.filter(isPolishRow);
  let md = '# Preset Score Matrix\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `Rows: ${rows.length} | Successful: ${ok.length} | Errors: ${errors.length}\n\n`;
  md += `Average: ${avg} | Min: ${min} | Max: ${max}\n\n`;
  md += `Blocker gate: score < ${BLOCKER_THRESHOLD} or run error | Blockers: ${blockers.length}\n\n`;
  md += `Polish gate: non-blocking category errors/warnings at score >= ${BLOCKER_THRESHOLD} | Rows: ${polish.length}\n\n`;
  if (!artifact.published) {
    md += 'Focused run: `docs/presets/scores.json` was not updated. Pass `--publish` to publish this run intentionally.\n\n';
  }
  md += '## Worst Rows\n\n';
  md += '| Preset | Viewport | Color | Mode | Effect | Score | Grade | Errors | Warnings |\n';
  md += '|--------|----------|-------|------|--------|-------|-------|--------|----------|\n';
  for (const row of ok.slice().sort((a, b) => a.overall - b.overall).slice(0, 30)) {
    md += `| ${row.element}/${row.personality} | ${row.viewport.name} | ${row.color} | ${row.dark ? 'dark' : 'light'} | ${row.effect} | ${row.overall} | ${row.grade} | ${totalFindings(row, 'error')} | ${totalFindings(row, 'warning')} |\n`;
  }
  return md;
}

function buildFailuresMarkdown(rows) {
  const blockers = rows.filter(isBlockerRow);
  const polish = rows.filter(isPolishRow);
  let md = '# Preset Matrix Gates\n\n';
  md += `Blocker gate: score < ${BLOCKER_THRESHOLD} or run error.\n\n`;
  md += '## Blockers\n\n';
  md += blockers.length ? buildGateGroups(blockers) : 'No blockers.\n\n';
  md += '## Polish\n\n';
  md += `Non-blocking rows with category errors/warnings and score >= ${BLOCKER_THRESHOLD}.\n\n`;
  md += polish.length ? buildGateGroups(polish) : 'No polish findings.\n';
  return md;
}

function buildGateGroups(rows) {
  const byPreset = new Map();
  for (const row of rows) {
    const key = `${row.element}/${row.personality}`;
    if (!byPreset.has(key)) byPreset.set(key, []);
    byPreset.get(key).push(row);
  }
  let md = '';
  for (const [preset, presetRows] of byPreset) {
    md += `### ${preset}\n\n`;
    const worst = presetRows.slice().sort((a, b) => (a.overall || 0) - (b.overall || 0))[0];
    md += `- Worst score: ${worst.error ? 'error' : worst.overall}\n`;
    if (worst.error) md += `- Script error: ${worst.error}\n`;
    const issueCounts = {};
    for (const row of presetRows) {
      for (const cat of row.categories || []) {
        for (const finding of cat.findings || []) {
          if (finding.severity === 'info' || finding.severity === 'pass') continue;
          const key = `${finding.severity}: ${cat.label}: ${finding.title}`;
          issueCounts[key] = (issueCounts[key] || 0) + 1;
        }
      }
    }
    const issues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [issue, count] of issues) md += `- ${count}x ${issue}\n`;
    md += '- Affected combinations:\n';
    for (const row of presetRows.slice(0, 12)) {
      md += `  - ${row.viewport?.name || '?'} ${row.dark ? 'dark' : 'light'} ${row.color} ${row.effect}${row.error ? ` (${row.error})` : ` (${row.overall})`}\n`;
    }
    md += '\n';
  }
  return md;
}

function writeThumbnailIndex() {
  const thumbRoot = join(OUT_DIR, 'thumbnails');
  if (!fileExists(thumbRoot)) return;
  const index = {};
  for (const element of readdirSync(thumbRoot)) {
    const elementDir = join(thumbRoot, element);
    for (const file of readdirSync(elementDir)) {
      if (!file.endsWith(`.${CAPTURE_FORMAT}`)) continue;
      const personality = file.replace(new RegExp(`\\.${CAPTURE_FORMAT}$`), '');
      index[`${element}/${personality}`] = `thumbnails/${element}/${file}`;
    }
  }
  writeFileSync(join(OUT_DIR, 'thumbnails.json'), JSON.stringify(index, null, 2) + '\n');
}

async function runMatrix() {
  ensureDir(OUT_DIR);
  ensureDir(join(OUT_DIR, 'logs'));
  const manifest = readJson(join(PRESETS_DIR, 'index.json'));
  const jobs = buildJobs(manifest);
  const resultsFile = join(OUT_DIR, 'results.jsonl');
  const completed = readCompletedIds(resultsFile);
  const pending = jobs.filter(j => !completed.has(j.id));
  const plan = {
    mode: MODE,
    outDir: OUT_DIR,
    totalJobs: jobs.length,
    pendingJobs: pending.length,
    workers: WORKERS,
    thumbnails: THUMBNAILS,
    publish: PUBLISH,
    blockerThreshold: BLOCKER_THRESHOLD,
  };
  writeFileSync(join(OUT_DIR, 'jobs.json'), JSON.stringify(jobs, null, 2) + '\n');
  writeFileSync(join(OUT_DIR, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
  console.log(JSON.stringify(plan, null, 2));
  if (DRY_RUN) return;
  ensureDir(RESEARCH_DIR);
  writeFileSync(LATEST_RUN_FILE, OUT_DIR + '\n');

  const server = startServer();
  const extractFn = loadExtractorText();
  const launched = await launchBrowser();
  const browser = launched.browser;
  console.log(`Using ${launched.engine}`);
  let cursor = 0;
  let done = completed.size;

  async function worker(workerId) {
    const scorePage = await prepareWorkerPage(browser);
    const thumbPage = await browser.newPage();
    while (cursor < pending.length) {
      const job = pending[cursor++];
      const startedAt = Date.now();
      try {
        const result = await scoreJob(scorePage, manifest, extractFn, job);
        const thumb = shouldCaptureThumbnail(job, manifest) ? await captureThumbnail(thumbPage, manifest, job) : null;
        const row = {
          ...job,
          id: job.id,
          generatedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          thumbnail: thumb ? thumb.replace(OUT_DIR + '/', '') : null,
          ...result,
        };
        appendFileSync(resultsFile, JSON.stringify(row) + '\n');
        done++;
        process.stdout.write(`[${done}/${jobs.length}] ${job.id} ${row.error ? 'ERROR ' + row.error : row.overall + ' ' + row.grade}\n`);
      } catch (err) {
        appendFileSync(resultsFile, JSON.stringify({ ...job, id: job.id, error: err.message, generatedAt: new Date().toISOString() }) + '\n');
        done++;
        process.stdout.write(`[${done}/${jobs.length}] ${job.id} CRASH ${err.message}\n`);
      }
    }
    await scorePage.close();
    await thumbPage.close();
  }

  try {
    await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
  } finally {
    await browser.close();
    server.close();
  }
  combineReports();
}

async function main() {
  if (COMBINE_ONLY) {
    if (!OUT_ARG) {
      if (!fileExists(LATEST_RUN_FILE)) {
        throw new Error('No latest run recorded. Pass --out research/preset-score-matrix/<run> to combine a specific run.');
      }
      OUT_DIR = readFileSync(LATEST_RUN_FILE, 'utf8').trim();
    }
    const artifact = combineReports();
    const target = artifact.published ? 'docs/presets/scores.json' : `${OUT_DIR}/latest.json`;
    console.log(`Combined ${artifact.rows} successful rows into ${target}`);
    return;
  }
  await runMatrix();
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
