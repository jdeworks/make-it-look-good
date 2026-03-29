#!/usr/bin/env node
// Test a specific template across all combinations (effects × viewports × dark modes)
// Usage:
//   node scripts/test-template.mjs dashboard/clean     # test one template
//   node scripts/test-template.mjs dashboard            # test all variants of dashboard
//   node scripts/test-template.mjs --all                # test everything (full matrix)
//   node scripts/test-template.mjs --all --threads=6    # parallel threads
//
// Options:
//   --threads=N    Number of concurrent browser pages (default: 3)
//   --all          Test all templates
//   --light-only   Skip dark mode tests
//   --desktop-only Skip mobile/tablet viewports
//
// Results saved to: research/template-results/<template-name>.json + .md

import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const DOCS_DIR = join(import.meta.dirname, '..', 'docs');
const RESEARCH_DIR = join(import.meta.dirname, '..', 'research');
const RESULTS_DIR = join(RESEARCH_DIR, 'template-results');
const PORT = 8767;

const args = process.argv.slice(2);
const ALL = args.includes('--all');
const LIGHT_ONLY = args.includes('--light-only');
const DESKTOP_ONLY = args.includes('--desktop-only');
const THREADS = parseInt((args.find(a => a.startsWith('--threads=')) || '--threads=3').split('=')[1]);
const TEMPLATE = args.find(a => !a.startsWith('--')) || '';

if (!ALL && !TEMPLATE) {
  console.log('Usage: node scripts/test-template.mjs <template> [--threads=N] [--light-only] [--desktop-only]');
  console.log('       node scripts/test-template.mjs --all [--threads=N]');
  console.log('\nExamples:');
  console.log('  node scripts/test-template.mjs dashboard/clean');
  console.log('  node scripts/test-template.mjs dashboard');
  console.log('  node scripts/test-template.mjs --all --threads=6');
  process.exit(0);
}

// Effect names — CSS extracted from test-full-matrix.mjs
const EFFECT_LIST = [
  { name: 'none', css: '' },
  { name: 'hushed' },
  { name: 'bouncy' },
  { name: 'frosted' },
  { name: 'serif' },
];

// Read effects from the full matrix test file
let fullMatrixSrc;
try {
  fullMatrixSrc = readFileSync(join(import.meta.dirname, 'test-full-matrix.mjs'), 'utf8');
} catch(e) {
  console.error('Cannot read test-full-matrix.mjs for effect definitions');
  process.exit(1);
}

// Extract each effect's CSS from the source
function extractEffectCSS(src, name) {
  if (name === 'none') return '';
  const re = new RegExp(`\\{\\s*name:\\s*'${name}'\\s*,\\s*css:\\s*\`([\\s\\S]*?)\`\\s*\\}`, 'm');
  const m = src.match(re);
  return m ? m[1] : '';
}

const EFFECTS_PARSED = EFFECT_LIST.map(e => ({
  name: e.name,
  css: extractEffectCSS(fullMatrixSrc, e.name)
}));

const VIEWPORTS = DESKTOP_ONLY
  ? [{ w: 1280, h: 900 }]
  : [{ w: 375, h: 812 }, { w: 768, h: 1024 }, { w: 1280, h: 900 }];

const DARK_MODES = LIGHT_ONLY ? [false] : [false, true];

// Server
function startServer() {
  const mimeTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = createServer((req, res) => {
    let filePath = join(DOCS_DIR, req.url === '/' ? 'index.html' : req.url);
    if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  server.listen(PORT);
  return server;
}

// Build test list
function buildTests() {
  const manifest = JSON.parse(readFileSync(join(DOCS_DIR, 'presets', 'index.json'), 'utf8'));
  const tests = [];

  for (const [el, info] of Object.entries(manifest.elements)) {
    const personalities = Object.keys(info.personalities || {});
    for (const pers of personalities) {
      const presetKey = `${el}/${pers}`;

      // Filter
      if (!ALL) {
        if (TEMPLATE.includes('/')) {
          // Exact match: dashboard/clean
          if (presetKey !== TEMPLATE) continue;
        } else {
          // Element match: dashboard (all variants)
          if (el !== TEMPLATE) continue;
        }
      }

      const file = join(DOCS_DIR, 'presets', el, pers + '.html');
      if (!existsSync(file)) continue;

      for (const effect of EFFECTS_PARSED) {
        for (const vp of VIEWPORTS) {
          for (const dark of DARK_MODES) {
            tests.push({ element: el, personality: pers, effect: effect.name, effectCSS: effect.css, viewport: vp, dark });
          }
        }
      }
    }
  }
  return tests;
}

function testKey(t) {
  return `${t.element}/${t.personality}|${t.effect}|${t.viewport.w}|${t.dark ? 'dark' : 'light'}`;
}

// Run a single test (same logic as full matrix)
async function runTest(page, t) {
  const html = readFileSync(join(DOCS_DIR, 'presets', t.element, t.personality + '.html'), 'utf8');
  await page.setViewport({ width: t.viewport.w, height: t.viewport.h });
  await page.goto(`http://localhost:${PORT}/tests/test-presets-rendered.html`, { waitUntil: 'networkidle0', timeout: 15000 });

  const result = await page.evaluate(async (html, element, personality, effectCSS, dark, vpWidth) => {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${vpWidth}px;height:900px;border:none;`;
      iframe.sandbox = 'allow-scripts allow-same-origin';
      document.body.appendChild(iframe);

      let handled = false;
      function onMsg(e) {
        if (!e.data || e.data.type !== 'milg-headless-result') return;
        if (handled) return;
        handled = true;
        window.removeEventListener('message', onMsg);
        if (iframe.parentNode) document.body.removeChild(iframe);

        const data = e.data.data;
        data.profile = 'general';
        data.meta.isFragment = true;
        data.meta.url = element + '/' + personality;
        try {
          const report = window.MilgScoring.runScoring(data);

          // Read darkness level from extraction (computed area-weighted in extractFromDocument)
          var darknessLevel = (data.colors && data.colors.darknessLevel) || 5;

          resolve({
            overall: report.overall,
            grade: report.grade,
            darknessLevel,
            categories: report.categories.map(c => ({
              label: c.label, score: c.score, na: !!c.notApplicable,
              errors: c.findings.filter(f => f.severity === 'error').length,
              warnings: c.findings.filter(f => f.severity === 'warning').length,
              findings: c.findings.map(f => ({ severity: f.severity, title: f.title }))
            }))
          });
        } catch(err) {
          resolve({ error: err.message });
        }
      }
      window.addEventListener('message', onMsg);

      fetch('/analyzer.js').then(r => r.text()).then(code => {
        const match = code.match(/function extractFromDocument\(\)\s*\{/);
        if (!match) { resolve({ error: 'No extractFromDocument' }); return; }
        const start = code.indexOf(match[0]);
        let depth = 0, end = start;
        for (let i = start; i < code.length; i++) {
          if (code[i] === '{') depth++;
          if (code[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        const extractFn = code.substring(start, end).replace(/milg-analyzer-result/g, 'milg-headless-result');

        const darkClass = dark ? ' class="dark"' : '';
        const darkVariantCSS = '@custom-variant dark (&:where(.dark, .dark *));';
        const srcdoc = '<!DOCTYPE html><html lang="en"' + darkClass + '><head><meta charset="UTF-8">' +
          '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
          '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></' + 'script>' +
          (dark ? '<style type="text/tailwindcss">' + darkVariantCSS + '</style>' : '') +
          (effectCSS ? '<style>' + effectCSS + '</style>' : '') +
          '<style>body{margin:0}</style></head><body>' +
          '<script>window.__milgIsFragment=true;</' + 'script>' +
          html +
          '<script>setTimeout(function(){(' + extractFn + ')()}, 2500);</' + 'script>' +
          '</body></html>';
        iframe.srcdoc = srcdoc;
      });

      setTimeout(() => {
        if (handled) return;
        handled = true;
        window.removeEventListener('message', onMsg);
        if (iframe.parentNode) document.body.removeChild(iframe);
        resolve({ error: 'Timeout' });
      }, 15000);
    });
  }, html, t.element, t.personality, t.effectCSS, t.dark, t.viewport.w);

  return result;
}

// Generate per-template report
function generateReport(templateName, results) {
  const ok = results.filter(r => !r.error);
  if (ok.length === 0) return '# No results\n';

  const avg = Math.round(ok.reduce((s, r) => s + r.overall, 0) / ok.length);
  const min = Math.min(...ok.map(r => r.overall));
  const max = Math.max(...ok.map(r => r.overall));

  let md = `# Test Results: ${templateName}\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Tests:** ${ok.length} | **Avg:** ${avg} | **Min:** ${min} | **Max:** ${max}\n\n`;

  // Score matrix
  md += '## Score Matrix\n\n';
  md += '| Effect | Viewport | Mode | Score | Grade | DL | Errors | Warnings |\n';
  md += '|--------|----------|------|-------|-------|----|--------|----------|\n';
  for (const r of ok.sort((a, b) => a.overall - b.overall)) {
    const errs = r.categories.reduce((s, c) => s + c.errors, 0);
    const warns = r.categories.reduce((s, c) => s + c.warnings, 0);
    md += `| ${r.effect} | ${r.viewport.w} | ${r.dark ? 'dark' : 'light'} | ${r.overall} | ${r.grade} | ${r.darknessLevel || '?'} | ${errs} | ${warns} |\n`;
  }

  // Issues
  md += '\n## Issues Found\n\n';
  const issueCounts = {};
  for (const r of ok) {
    for (const c of r.categories) {
      for (const f of c.findings) {
        if (f.severity === 'info') continue;
        const key = `[${f.severity}] ${c.label}: ${f.title.substring(0, 80)}`;
        issueCounts[key] = (issueCounts[key] || 0) + 1;
      }
    }
  }
  const sorted = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]);
  for (const [issue, count] of sorted) {
    md += `- **${count}x** ${issue}\n`;
  }

  // Darkness levels
  md += '\n## Darkness Levels\n\n';
  const byMode = {};
  for (const r of ok) {
    const modeKey = r.dark ? 'dark' : 'light';
    if (!byMode[modeKey]) byMode[modeKey] = [];
    byMode[modeKey].push(r.darknessLevel || 5);
  }
  for (const [mode, levels] of Object.entries(byMode)) {
    const avgDL = (levels.reduce((s, l) => s + l, 0) / levels.length).toFixed(1);
    md += `- **${mode}:** avg DL=${avgDL} (range ${Math.min(...levels)}-${Math.max(...levels)})\n`;
  }

  return md;
}

// Main
async function main() {
  const tests = buildTests();
  if (tests.length === 0) {
    console.error(`No tests found for "${TEMPLATE}". Check the template name exists in docs/presets/index.json`);
    process.exit(1);
  }

  const templateName = ALL ? 'all' : TEMPLATE;
  console.log(`Testing: ${templateName} (${tests.length} combinations, ${THREADS} threads)`);

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const server = startServer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  const pages = [];
  for (let i = 0; i < THREADS; i++) {
    pages.push(await browser.newPage());
  }

  const results = [];
  let completed = 0;
  const startTime = Date.now();

  async function processTest(page, t) {
    const key = testKey(t);
    try {
      const result = await runTest(page, t);
      completed++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const eta = Math.round((Date.now() - startTime) / completed * (tests.length - completed) / 1000);

      if (result.error) {
        process.stdout.write(`\r[${completed}/${tests.length}] ${elapsed}s (ETA ${eta}s) ${key} ERROR: ${result.error}          \n`);
        results.push({ key, ...t, error: result.error });
      } else {
        const e = result.categories.reduce((s, c) => s + c.errors, 0);
        const w = result.categories.reduce((s, c) => s + c.warnings, 0);
        process.stdout.write(`\r[${completed}/${tests.length}] ${elapsed}s (ETA ${eta}s) ${key} → ${result.overall}${result.grade} D${result.darknessLevel || '?'} (${e}E ${w}W)          \n`);
        results.push({ key, ...t, ...result });
      }
    } catch (err) {
      completed++;
      results.push({ key, ...t, error: err.message });
    }
  }

  let idx = 0;
  async function worker(page) {
    while (idx < tests.length) {
      const myIdx = idx++;
      await processTest(page, tests[myIdx]);
    }
  }

  await Promise.all(pages.map(p => worker(p)));
  await browser.close();
  server.close();

  // Save results
  const safeName = templateName.replace(/\//g, '-');
  const jsonFile = join(RESULTS_DIR, `${safeName}.json`);
  const mdFile = join(RESULTS_DIR, `${safeName}.md`);

  writeFileSync(jsonFile, JSON.stringify(results, null, 2));
  const md = generateReport(templateName, results);
  writeFileSync(mdFile, md);

  console.log(`\nResults saved to:`);
  console.log(`  ${jsonFile}`);
  console.log(`  ${mdFile}`);

  // Summary
  const ok = results.filter(r => !r.error);
  const avg = ok.length > 0 ? Math.round(ok.reduce((s, r) => s + r.overall, 0) / ok.length) : 0;
  console.log(`\n=== SUMMARY ===`);
  console.log(`Tested: ${ok.length} | Errors: ${results.filter(r => r.error).length}`);
  console.log(`Average: ${avg} | Min: ${Math.min(...ok.map(r => r.overall))} | Max: ${Math.max(...ok.map(r => r.overall))}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
