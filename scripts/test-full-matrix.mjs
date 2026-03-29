#!/usr/bin/env node
// Full matrix test runner: preset × personality × effect × viewport × dark mode
// Usage: node scripts/test-full-matrix.mjs [--quick] [--filter=hero] [--effects-only] [--divergence-only]
//
// --quick: skip viewports (test only 1280px), skip dark mode → 650 tests instead of 3900
// --filter=hero: only test presets matching "hero"
// --effects-only: only test effect variants (skip viewport/dark combos)
// --divergence-only: skip scoring, only compute divergence from cached results
//
// Outputs: research/full-matrix-results.md (scores + divergence + flagged combos)

import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const DOCS_DIR = join(import.meta.dirname, '..', 'docs');
const RESEARCH_DIR = join(import.meta.dirname, '..', 'research');
const CACHE_FILE = join(RESEARCH_DIR, 'full-matrix-cache.json');
const PORT = 8766; // different from basic test runner

const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const EFFECTS_ONLY = args.includes('--effects-only');
const DIVERGENCE_ONLY = args.includes('--divergence-only');
const FILTER = (args.find(a => a.startsWith('--filter=')) || '').replace('--filter=', '');

// --- Effect definitions (must match docs/app.js visualStyles) ---
const EFFECTS = [
  { name: 'none', css: '' },
  { name: 'hushed', css: `[class*="shadow"]{box-shadow:none!important}
[class*="border"]{border-color:rgba(0,0,0,0.06)!important}
[class*="rounded-lg"],[class*="rounded-xl"],[class*="rounded-2xl"],[class*="rounded-3xl"]{border-radius:4px!important}
[class*="rounded-full"]{border-radius:9999px!important}
h1,h2,h3,h4,h5,h6{font-weight:300!important;letter-spacing:0.02em}
h1{font-size:2.25em!important}
p,span,li,td,th{opacity:0.75}
button:not([class*="bg-"]),[role="button"]:not([class*="bg-"]){font-weight:400!important;letter-spacing:0.06em;text-transform:uppercase;font-size:0.82em!important;border:1px solid rgba(0,0,0,0.1)!important;background:transparent!important;color:inherit!important}
button[class*="bg-"],[role="button"][class*="bg-"]{font-weight:400!important;letter-spacing:0.06em;text-transform:uppercase;font-size:0.82em!important;opacity:0.85}
button:hover,a:hover,[role="button"]:hover{opacity:0.5;transition:opacity 250ms ease-out}
nav,aside,[class*="border-b"],[class*="border-r"]{border-color:rgba(0,0,0,0.04)!important}` },
  { name: 'bouncy', css: `[class*="rounded-md"],[class*="rounded-lg"]{border-radius:16px!important}
[class*="rounded-xl"],[class*="rounded-2xl"],[class*="rounded-3xl"]{border-radius:24px!important}
[class*="shadow-sm"],[class*="shadow-md"]{box-shadow:0 4px 14px rgba(99,102,241,0.18),0 2px 6px rgba(244,63,94,0.12)!important}
[class*="shadow-lg"],[class*="shadow-xl"]{box-shadow:0 10px 30px rgba(99,102,241,0.22),0 4px 12px rgba(244,63,94,0.14)!important}
button,[role="button"],article{transition:transform 300ms cubic-bezier(0.34,1.56,0.64,1),box-shadow 300ms cubic-bezier(0.34,1.56,0.64,1)!important}
button:hover,[role="button"]:hover{transform:scale(1.05) translateY(-2px)!important}
article:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(99,102,241,0.2)!important}
h1,h2,h3{font-weight:800!important;letter-spacing:-0.01em}
input,select,textarea{border-radius:14px!important}
button:active,[role="button"]:active{transform:scale(0.95)!important;transition-duration:80ms!important}` },
  { name: 'frosted', css: `html:not(.dark) body{background:linear-gradient(135deg,#dbeafe 0%,#ede9fe 35%,#fce7f3 65%,#e0f2fe 100%)!important;min-height:100vh}
.dark body,.dark.min-h-screen,html.dark body{background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 35%,#1e1b4b 65%,#0f172a 100%)!important;min-height:100vh}
html:not(.dark) [class*="bg-white"]{background:rgba(255,255,255,0.55)!important;-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(255,255,255,0.4)!important;box-shadow:0 4px 24px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.6)!important}
.dark [class*="bg-slate-900"],.dark [class*="bg-slate-950"],.dark [class*="bg-gray-900"],.dark [class*="bg-gray-950"]{background:rgba(15,23,42,0.78)!important;-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(99,102,241,0.15)!important;box-shadow:0 4px 24px rgba(0,0,0,0.2),inset 0 1px 0 rgba(99,102,241,0.1)!important}
html:not(.dark) [class*="bg-slate-50"],html:not(.dark) [class*="bg-gray-50"],html:not(.dark) [class*="bg-zinc-50"]{background:rgba(248,250,252,0.4)!important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.dark [class*="bg-slate-800"],.dark [class*="bg-gray-800"],.dark [class*="bg-slate-850"]{background:rgba(30,41,59,0.72)!important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
[class*="shadow-sm"],[class*="shadow-md"],[class*="shadow-lg"],[class*="shadow-xl"]{box-shadow:0 4px 20px rgba(0,0,0,0.05),inset 0 1px 0 rgba(255,255,255,0.5)!important}
.dark [class*="shadow-sm"],.dark [class*="shadow-md"],.dark [class*="shadow-lg"],.dark [class*="shadow-xl"]{box-shadow:0 4px 20px rgba(0,0,0,0.3),inset 0 1px 0 rgba(99,102,241,0.1)!important}
[class*="rounded-lg"]{border-radius:14px!important}
[class*="rounded-xl"],[class*="rounded-2xl"]{border-radius:18px!important}
html:not(.dark) [class*="border-slate-200"],html:not(.dark) [class*="border-gray-200"],html:not(.dark) [class*="border-zinc-200"]{border-color:rgba(255,255,255,0.35)!important}
.dark [class*="border-slate-700"],.dark [class*="border-slate-800"],.dark [class*="border-gray-700"],.dark [class*="border-gray-800"]{border-color:rgba(99,102,241,0.15)!important}
[class*="divide-slate"],[class*="divide-gray"],[class*="divide-zinc"]{--tw-divide-opacity:0.3}
html:not(.dark) [class*="border-t"]:not([class*="border-t-0"]){border-color:rgba(100,116,139,0.2)!important}
.dark [class*="border-t"]:not([class*="border-t-0"]){border-color:rgba(99,102,241,0.12)!important}
html:not(.dark) [class*="text-slate-500"],html:not(.dark) [class*="text-gray-500"],html:not(.dark) [class*="text-zinc-500"]{color:rgb(51,65,85)!important}
html:not(.dark) [class*="text-slate-400"],html:not(.dark) [class*="text-gray-400"]{color:rgb(71,85,105)!important}
.dark [class*="text-slate-400"],.dark [class*="text-gray-400"]{color:rgb(148,163,184)!important}
.dark [class*="text-slate-300"],.dark [class*="text-gray-300"]{color:rgb(203,213,225)!important}
input,select,textarea{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-radius:12px!important}
html:not(.dark) input,html:not(.dark) select,html:not(.dark) textarea{background:rgba(255,255,255,0.45)!important;border:1px solid rgba(255,255,255,0.4)!important}
.dark input,.dark select,.dark textarea{background:rgba(15,23,42,0.45)!important;border:1px solid rgba(99,102,241,0.2)!important}
button:hover,[role="button"]:hover{box-shadow:0 0 24px rgba(99,102,241,0.18),0 6px 20px rgba(0,0,0,0.06)!important;transition:box-shadow 250ms ease-out,transform 250ms ease-out;transform:translateY(-1px)}
html:not(.dark) nav,html:not(.dark) aside,html:not(.dark) header{-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);background:rgba(255,255,255,0.65)!important}
.dark nav,.dark aside,.dark header{-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);background:rgba(15,23,42,0.65)!important}` },
  { name: 'serif', css: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
h1,h2,h3,h4,h5,h6{font-family:'Playfair Display',Georgia,'Times New Roman',serif!important;letter-spacing:-0.02em;line-height:1.15}
h1{font-weight:400!important;font-size:2.75em!important;letter-spacing:-0.03em}
h2{font-weight:700!important}
h3,h4,h5,h6{font-weight:700!important}
[class*="shadow"]{box-shadow:none!important}
[class*="border"]{border-color:#e2e8f0!important}
[class*="rounded-lg"],[class*="rounded-xl"],[class*="rounded-2xl"],[class*="rounded-3xl"],[class*="rounded-md"]{border-radius:2px!important}
button,[role="button"]{font-weight:400!important;letter-spacing:0.1em;text-transform:uppercase;font-size:0.78em!important;border-radius:1px!important;padding-top:0.75rem!important;padding-bottom:0.75rem!important}
a:hover{text-decoration:underline!important;text-underline-offset:4px;text-decoration-thickness:1px}
button:hover,[role="button"]:hover{opacity:0.75;transition:opacity 200ms ease}
p{line-height:1.75!important}
body{letter-spacing:0.005em}
[class*="bg-blue-600"],[class*="bg-indigo-600"],[class*="bg-violet-600"],[class*="bg-teal-600"],[class*="bg-emerald-600"],[class*="bg-rose-600"],[class*="bg-orange-600"],[class*="bg-fuchsia-600"]{background-color:#334155!important}
[class*="bg-blue-600"]:hover,[class*="bg-indigo-600"]:hover,[class*="bg-violet-600"]:hover,[class*="bg-teal-600"]:hover,[class*="bg-emerald-600"]:hover{background-color:#1e293b!important}
input,select,textarea{border-radius:1px!important}` },
];

const VIEWPORTS = QUICK ? [{ w: 1280, h: 900 }] : [
  { w: 375, h: 812 },
  { w: 768, h: 1024 },
  { w: 1280, h: 900 },
];

const DARK_MODES = QUICK ? [false] : [false, true];

// --- Server ---
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

// --- Build test matrix ---
function buildTests() {
  const manifest = JSON.parse(readFileSync(join(DOCS_DIR, 'presets', 'index.json'), 'utf8'));
  const tests = [];

  for (const [el, info] of Object.entries(manifest.elements)) {
    if (FILTER && !el.includes(FILTER)) continue;
    const personalities = Object.keys(info.personalities || {});
    for (const pers of personalities) {
      const file = join(DOCS_DIR, 'presets', el, pers + '.html');
      if (!existsSync(file)) continue;

      for (const effect of EFFECTS) {
        if (EFFECTS_ONLY) {
          // Only test at 1280, no dark mode for effects-only
          tests.push({ element: el, personality: pers, effect: effect.name, effectCSS: effect.css, viewport: { w: 1280, h: 900 }, dark: false });
        } else {
          for (const vp of VIEWPORTS) {
            for (const dark of DARK_MODES) {
              tests.push({ element: el, personality: pers, effect: effect.name, effectCSS: effect.css, viewport: vp, dark });
            }
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

// --- Run a single test ---
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
            darknessLevel: darknessLevel,
            categories: report.categories.map(c => ({
              label: c.label,
              score: c.score,
              na: !!c.notApplicable,
              errors: c.findings.filter(f => f.severity === 'error').length,
              warnings: c.findings.filter(f => f.severity === 'warning').length,
              infos: c.findings.filter(f => f.severity === 'info').length,
              findings: c.findings.map(f => ({ severity: f.severity, title: f.title }))
            })),
            // Capture raw metrics for divergence analysis
            metrics: {
              contrastPairs: (data.colors && data.colors.contrastPairs) ? data.colors.contrastPairs.length : 0,
              fontSizes: data.typography ? Object.keys(data.typography.fontSizes || {}).length : 0,
              borderRadii: data.spacing ? Object.keys(data.spacing.borderRadii || {}).length : 0,
              touchTargets: (data.interaction && data.interaction.touchTargets) ? data.interaction.touchTargets.length : 0,
              headingCount: data.structure ? (data.structure.headingCount || 0) : 0,
              totalElements: data.structure ? (data.structure.totalElements || 0) : 0,
              colors: data.colors ? Object.keys(data.colors.textColors || {}).length : 0,
              bgColors: data.colors ? Object.keys(data.colors.backgroundColors || {}).length : 0,
            }
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

// --- Divergence scoring ---
// Compares two test results to measure how different they are (0 = identical, 100 = completely different)
function divergenceScore(a, b) {
  if (!a || !b || a.error || b.error) return null;

  let totalDiff = 0;
  let comparisons = 0;

  // 1. Overall score difference (weight: 3)
  totalDiff += Math.abs(a.overall - b.overall) * 3;
  comparisons += 3;

  // 2. Per-category score differences (weight: 1 each)
  const aCats = {};
  const bCats = {};
  (a.categories || []).forEach(c => { aCats[c.label] = c; });
  (b.categories || []).forEach(c => { bCats[c.label] = c; });

  for (const label of Object.keys(aCats)) {
    if (bCats[label]) {
      // Normalize score diff to 0-100
      totalDiff += Math.abs((aCats[label].score || 0) - (bCats[label].score || 0));
      comparisons++;

      // Finding count differences
      const aFindings = (aCats[label].errors || 0) + (aCats[label].warnings || 0);
      const bFindings = (bCats[label].errors || 0) + (bCats[label].warnings || 0);
      totalDiff += Math.min(100, Math.abs(aFindings - bFindings) * 15);
      comparisons++;
    }
  }

  // 3. Metric differences (structural signals)
  if (a.metrics && b.metrics) {
    const metricKeys = ['contrastPairs', 'fontSizes', 'borderRadii', 'touchTargets', 'colors', 'bgColors'];
    for (const k of metricKeys) {
      const av = a.metrics[k] || 0;
      const bv = b.metrics[k] || 0;
      const maxVal = Math.max(av, bv, 1);
      totalDiff += (Math.abs(av - bv) / maxVal) * 100;
      comparisons++;
    }
  }

  return comparisons > 0 ? Math.round(totalDiff / comparisons) : 0;
}

// --- Report generation ---
function generateReport(results, tests) {
  const resultMap = {};
  for (const r of results) {
    resultMap[r.key] = r;
  }

  let md = '# Full Matrix Test Results\n\n';
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Tests run:** ${results.length} | **Errors:** ${results.filter(r => r.error).length}\n`;
  md += `**Matrix:** ${new Set(results.map(r => r.element + '/' + r.personality)).size} presets × ${EFFECTS.length} effects × ${VIEWPORTS.length} viewports × ${DARK_MODES.length} dark modes\n\n`;

  const ok = results.filter(r => !r.error);
  if (ok.length === 0) { return md + 'No successful results.\n'; }

  const avg = Math.round(ok.reduce((s, r) => s + r.overall, 0) / ok.length);
  const min = Math.min(...ok.map(r => r.overall));
  const max = Math.max(...ok.map(r => r.overall));
  md += `**Overall:** avg=${avg} min=${min} max=${max}\n\n`;

  // === Section 1: Effect impact summary ===
  md += '## 1. Effect Impact Summary\n\n';
  md += 'Average score by effect (across all presets, viewports, dark modes):\n\n';
  md += '| Effect | Avg Score | Min | Max | Avg Errors | Avg Warnings |\n';
  md += '|--------|-----------|-----|-----|------------|-------------|\n';
  for (const effect of EFFECTS) {
    const effResults = ok.filter(r => r.effect === effect.name);
    if (effResults.length === 0) continue;
    const eAvg = Math.round(effResults.reduce((s, r) => s + r.overall, 0) / effResults.length);
    const eMin = Math.min(...effResults.map(r => r.overall));
    const eMax = Math.max(...effResults.map(r => r.overall));
    const eErr = (effResults.reduce((s, r) => s + r.categories.reduce((cs, c) => cs + c.errors, 0), 0) / effResults.length).toFixed(1);
    const eWarn = (effResults.reduce((s, r) => s + r.categories.reduce((cs, c) => cs + c.warnings, 0), 0) / effResults.length).toFixed(1);
    md += `| ${effect.name} | ${eAvg} | ${eMin} | ${eMax} | ${eErr} | ${eWarn} |\n`;
  }

  // === Section 1b: Darkness Level Analysis ===
  md += '\n## 1b. Page Darkness Level\n\n';
  md += 'Scale: 1 = white page, 10 = black page. Range 2.5–7.5 is expected; outside = warning.\n\n';
  md += '| Preset | Light DL | Dark DL | Delta | Warning |\n';
  md += '|--------|----------|---------|-------|---------|\n';
  {
    const presetsDL = [...new Set(ok.map(r => r.element + '/' + r.personality))];
    for (const preset of presetsDL) {
      const lk = `${preset}|none|1280|light`;
      const dk = `${preset}|none|1280|dark`;
      const lr = resultMap[lk];
      const dr = resultMap[dk];
      const lDL = lr && !lr.error ? (lr.darknessLevel || '?') : '—';
      const dDL = dr && !dr.error ? (dr.darknessLevel || '?') : '—';
      const delta = (typeof lDL === 'number' && typeof dDL === 'number') ? dDL - lDL : '—';
      let warn = '';
      if (typeof lDL === 'number' && (lDL < 2.5 || lDL > 7.5)) warn += 'light-mode ';
      if (typeof dDL === 'number' && (dDL < 2.5 || dDL > 7.5)) warn += 'dark-mode ';
      if (typeof lDL === 'number' && typeof dDL === 'number' && Math.abs(dDL - lDL) < 2) warn += 'low-contrast-switch ';
      if (warn || (typeof delta === 'number' && Math.abs(delta) < 2)) {
        md += `| ${preset} | ${lDL} | ${dDL} | ${typeof delta === 'number' ? (delta >= 0 ? '+' : '') + delta : delta} | ${warn.trim() || '—'} |\n`;
      }
    }
  }

  // === Section 2: Dark mode impact ===
  if (DARK_MODES.length > 1) {
    md += '\n## 2. Dark Mode Impact\n\n';
    md += '| Preset | Light Score | Dark Score | Delta | Worse Categories |\n';
    md += '|--------|------------ |------------|-------|-------------------|\n';

    const presets = [...new Set(ok.map(r => r.element + '/' + r.personality))];
    const darkIssues = [];
    for (const preset of presets) {
      // Compare none effect, 1280px, light vs dark
      const lightKey = `${preset}|none|1280|light`;
      const darkKey = `${preset}|none|1280|dark`;
      const light = resultMap[lightKey];
      const dark = resultMap[darkKey];
      if (!light || !dark || light.error || dark.error) continue;

      const delta = dark.overall - light.overall;
      let worse = [];
      for (let i = 0; i < (light.categories || []).length; i++) {
        const lc = light.categories[i];
        const dc = dark.categories[i];
        if (dc && lc && dc.score < lc.score - 5) {
          worse.push(`${lc.label} (${lc.score}→${dc.score})`);
        }
      }

      if (delta < -5 || worse.length > 0) {
        darkIssues.push({ preset, light: light.overall, dark: dark.overall, delta, worse });
        md += `| ${preset} | ${light.overall} | ${dark.overall} | ${delta >= 0 ? '+' : ''}${delta} | ${worse.join(', ') || '—'} |\n`;
      }
    }
    if (darkIssues.length === 0) md += '| (no significant dark mode regressions) | | | | |\n';
  }

  // === Section 3: Viewport responsiveness ===
  if (VIEWPORTS.length > 1) {
    md += '\n## 3. Viewport Responsiveness\n\n';
    md += '| Preset | 375px | 768px | 1280px | Mobile Delta |\n';
    md += '|--------|-------|-------|--------|-------------|\n';

    const presets = [...new Set(ok.map(r => r.element + '/' + r.personality))];
    const vpIssues = [];
    for (const preset of presets) {
      const scores = {};
      for (const vp of VIEWPORTS) {
        const key = `${preset}|none|${vp.w}|light`;
        const r = resultMap[key];
        if (r && !r.error) scores[vp.w] = r.overall;
      }
      if (Object.keys(scores).length < VIEWPORTS.length) continue;

      const mobileDelta = (scores[375] || 0) - (scores[1280] || 0);
      if (Math.abs(mobileDelta) > 5 || (scores[375] || 100) < 70) {
        vpIssues.push({ preset, scores, mobileDelta });
        md += `| ${preset} | ${scores[375] ?? '—'} | ${scores[768] ?? '—'} | ${scores[1280] ?? '—'} | ${mobileDelta >= 0 ? '+' : ''}${mobileDelta} |\n`;
      }
    }
    if (vpIssues.length === 0) md += '| (no significant viewport regressions) | | | | |\n';
  }

  // === Section 4: Frosted + dark mode (known problem combo) ===
  md += '\n## 4. Frosted Effect Analysis\n\n';
  md += 'Frosted is the most invasive effect (replaces backgrounds, adds glassmorphism). Checking for issues:\n\n';
  md += '| Preset | None Score | Frosted Score | Delta | Frosted+Dark | Dark Delta | Key Issues |\n';
  md += '|--------|-----------|---------------|-------|-------------|------------|------------|\n';

  const presets = [...new Set(ok.map(r => r.element + '/' + r.personality))];
  for (const preset of presets) {
    const noneKey = `${preset}|none|1280|light`;
    const frostedKey = `${preset}|frosted|1280|light`;
    const frostedDarkKey = `${preset}|frosted|1280|dark`;
    const none = resultMap[noneKey];
    const frosted = resultMap[frostedKey];
    const frostedDark = resultMap[frostedDarkKey];

    if (!none || none.error || !frosted || frosted.error) continue;

    const delta = frosted.overall - none.overall;
    const darkScore = frostedDark && !frostedDark.error ? frostedDark.overall : '—';
    const darkDelta = frostedDark && !frostedDark.error ? frostedDark.overall - frosted.overall : '—';

    // Collect key issues from frosted
    const issues = [];
    for (const c of frosted.categories) {
      if (c.errors > 0) {
        const titles = c.findings.filter(f => f.severity === 'error').map(f => f.title.substring(0, 50));
        issues.push(...titles.slice(0, 2));
      }
    }

    if (delta < -3 || (typeof darkDelta === 'number' && darkDelta < -3) || issues.length > 0) {
      md += `| ${preset} | ${none.overall} | ${frosted.overall} | ${delta >= 0 ? '+' : ''}${delta} | ${darkScore} | ${typeof darkDelta === 'number' ? (darkDelta >= 0 ? '+' : '') + darkDelta : '—'} | ${issues.slice(0, 2).join('; ') || '—'} |\n`;
    }
  }

  // === Section 5: Divergence analysis — are variants meaningfully different? ===
  md += '\n## 5. Variant Divergence Analysis\n\n';
  md += 'How different is each variant from "none" effect? Low divergence (< 5) = variant adds negligible value.\n\n';

  // 5a. Effect divergence per preset (at 1280px, light)
  md += '### 5a. Effect Divergence (per preset, 1280px light)\n\n';
  md += '| Preset | Hushed | Bouncy | Frosted | Serif | Avg |\n';
  md += '|--------|--------|--------|---------|-------|-----|\n';

  const lowDivergence = [];
  for (const preset of presets) {
    const baseKey = `${preset}|none|1280|light`;
    const base = resultMap[baseKey];
    if (!base || base.error) continue;

    const divs = {};
    let total = 0;
    let count = 0;
    for (const eff of EFFECTS.slice(1)) { // skip "none"
      const key = `${preset}|${eff.name}|1280|light`;
      const r = resultMap[key];
      const d = divergenceScore(base, r);
      divs[eff.name] = d;
      if (d !== null) { total += d; count++; }
    }
    const avgDiv = count > 0 ? Math.round(total / count) : 0;

    md += `| ${preset} | ${divs.hushed ?? '—'} | ${divs.bouncy ?? '—'} | ${divs.frosted ?? '—'} | ${divs.serif ?? '—'} | ${avgDiv} |\n`;

    // Flag low divergence
    for (const [eff, d] of Object.entries(divs)) {
      if (d !== null && d < 5) {
        lowDivergence.push({ preset, effect: eff, divergence: d });
      }
    }
  }

  // 5b. Personality divergence (do clean/minimalist/playful actually differ?)
  md += '\n### 5b. Personality Divergence (same element, none effect, 1280px light)\n\n';
  md += 'Low divergence = personalities are too similar. Should be > 10 for meaningful differentiation.\n\n';
  md += '| Element | Clean vs Min | Clean vs Play | Min vs Play | Clean vs Edit | Avg |\n';
  md += '|---------|-------------|---------------|-------------|--------------|-----|\n';

  const elements = [...new Set(ok.map(r => r.element))];
  const lowPersDiv = [];
  for (const el of elements) {
    const getR = (p) => resultMap[`${el}/${p}|none|1280|light`];
    const clean = getR('clean');
    const min = getR('minimalist');
    const play = getR('playful');
    const edit = getR('editorial');

    if (!clean || clean.error) continue;

    const cmDiv = divergenceScore(clean, min);
    const cpDiv = divergenceScore(clean, play);
    const mpDiv = divergenceScore(min, play);
    const ceDiv = divergenceScore(clean, edit);

    const vals = [cmDiv, cpDiv, mpDiv, ceDiv].filter(v => v !== null);
    const avgDiv = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : 0;

    md += `| ${el} | ${cmDiv ?? '—'} | ${cpDiv ?? '—'} | ${mpDiv ?? '—'} | ${ceDiv ?? '—'} | ${avgDiv} |\n`;

    if (cmDiv !== null && cmDiv < 5) lowPersDiv.push({ element: el, pair: 'clean/minimalist', divergence: cmDiv });
    if (cpDiv !== null && cpDiv < 5) lowPersDiv.push({ element: el, pair: 'clean/playful', divergence: cpDiv });
    if (mpDiv !== null && mpDiv < 5) lowPersDiv.push({ element: el, pair: 'minimalist/playful', divergence: mpDiv });
  }

  // === Section 6: Flagged combinations ===
  md += '\n## 6. Flagged Combinations\n\n';

  // 6a. Worst scores overall
  md += '### 6a. Worst Scores (bottom 20)\n\n';
  md += '| Combo | Score | Grade | Errors | Warnings |\n';
  md += '|-------|-------|-------|--------|----------|\n';
  const sorted = ok.sort((a, b) => a.overall - b.overall);
  for (const r of sorted.slice(0, 20)) {
    const errs = r.categories.reduce((s, c) => s + c.errors, 0);
    const warns = r.categories.reduce((s, c) => s + c.warnings, 0);
    md += `| ${r.key} | ${r.overall} | ${r.grade} | ${errs} | ${warns} |\n`;
  }

  // 6b. Low divergence (unnecessary variants)
  md += '\n### 6b. Low Effect Divergence (< 5 — may be unnecessary)\n\n';
  if (lowDivergence.length > 0) {
    md += '| Preset | Effect | Divergence |\n';
    md += '|--------|--------|------------|\n';
    lowDivergence.sort((a, b) => a.divergence - b.divergence);
    for (const ld of lowDivergence) {
      md += `| ${ld.preset} | ${ld.effect} | ${ld.divergence} |\n`;
    }
  } else {
    md += 'None — all effects produce meaningful differentiation.\n';
  }

  md += '\n### 6c. Low Personality Divergence (< 5 — personalities too similar)\n\n';
  if (lowPersDiv.length > 0) {
    md += '| Element | Pair | Divergence |\n';
    md += '|---------|------|------------|\n';
    lowPersDiv.sort((a, b) => a.divergence - b.divergence);
    for (const ld of lowPersDiv) {
      md += `| ${ld.element} | ${ld.pair} | ${ld.divergence} |\n`;
    }
  } else {
    md += 'None — all personalities produce meaningful differentiation.\n';
  }

  // 6d. Effect regressions (effect makes things worse by >10 points)
  md += '\n### 6d. Effect Regressions (score drops > 10 points vs none)\n\n';
  md += '| Preset | Effect | None Score | Effect Score | Delta |\n';
  md += '|--------|--------|------------|-------------|-------|\n';
  let regressionCount = 0;
  for (const preset of presets) {
    const baseKey = `${preset}|none|1280|light`;
    const base = resultMap[baseKey];
    if (!base || base.error) continue;

    for (const eff of EFFECTS.slice(1)) {
      const key = `${preset}|${eff.name}|1280|light`;
      const r = resultMap[key];
      if (!r || r.error) continue;
      const delta = r.overall - base.overall;
      if (delta < -10) {
        md += `| ${preset} | ${eff.name} | ${base.overall} | ${r.overall} | ${delta} |\n`;
        regressionCount++;
      }
    }
  }
  if (regressionCount === 0) md += '| (no regressions > 10 points) | | | | |\n';

  // === Section 7: Most common issues by effect ===
  md += '\n## 7. Most Common Issues by Effect\n\n';
  for (const effect of EFFECTS) {
    const effResults = ok.filter(r => r.effect === effect.name);
    if (effResults.length === 0) continue;

    md += `### ${effect.name} (${effResults.length} tests)\n\n`;
    const issueCounts = {};
    for (const r of effResults) {
      for (const c of r.categories) {
        for (const f of c.findings) {
          if (f.severity === 'info') continue; // skip info
          const key = `[${f.severity}] ${c.label}: ${f.title.substring(0, 80)}`;
          issueCounts[key] = (issueCounts[key] || 0) + 1;
        }
      }
    }
    const sortedIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]);
    for (const [issue, count] of sortedIssues.slice(0, 10)) {
      const pct = Math.round(count / effResults.length * 100);
      md += `- **${count}x** (${pct}%) ${issue}\n`;
    }
    md += '\n';
  }

  return md;
}

// --- Main ---
async function main() {
  const tests = buildTests();
  console.log(`Full matrix: ${tests.length} test combinations`);
  console.log(`  Presets: ${new Set(tests.map(t => t.element + '/' + t.personality)).size}`);
  console.log(`  Effects: ${EFFECTS.length} (${EFFECTS.map(e => e.name).join(', ')})`);
  console.log(`  Viewports: ${VIEWPORTS.map(v => v.w + 'px').join(', ')}`);
  console.log(`  Dark modes: ${DARK_MODES.map(d => d ? 'dark' : 'light').join(', ')}`);
  console.log();

  if (DIVERGENCE_ONLY) {
    if (!existsSync(CACHE_FILE)) {
      console.error('No cache file found. Run the full test first.');
      process.exit(1);
    }
    const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    const md = generateReport(cached, tests);
    const outFile = join(RESEARCH_DIR, 'full-matrix-results.md');
    writeFileSync(outFile, md);
    console.log(`Report written to: ${outFile}`);
    return;
  }

  const server = startServer();
  console.log(`Server on port ${PORT}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  // Use multiple pages for parallelism (3 concurrent)
  const CONCURRENCY = 3;
  const pages = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    pages.push(await browser.newPage());
  }

  const results = [];
  let completed = 0;
  const startTime = Date.now();

  // Process tests in batches
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
        const dl = result.darknessLevel || '?';
        process.stdout.write(`\r[${completed}/${tests.length}] ${elapsed}s (ETA ${eta}s) ${key} → ${result.overall}${result.grade} (${e}E ${w}W) D${dl}          \n`);
        results.push({ key, ...t, overall: result.overall, grade: result.grade, categories: result.categories, metrics: result.metrics, darknessLevel: result.darknessLevel });
      }
    } catch (err) {
      completed++;
      process.stdout.write(`\r[${completed}/${tests.length}] ${key} CRASH: ${err.message}          \n`);
      results.push({ key, ...t, error: err.message });
    }
  }

  // Run with concurrency
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

  // Cache results
  if (!existsSync(RESEARCH_DIR)) mkdirSync(RESEARCH_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(results, null, 2));
  console.log(`\nCached ${results.length} results to ${CACHE_FILE}`);

  // Generate report
  const md = generateReport(results, tests);
  const outFile = join(RESEARCH_DIR, 'full-matrix-results.md');
  writeFileSync(outFile, md);
  console.log(`Report written to: ${outFile}`);

  // Quick summary
  const ok = results.filter(r => !r.error);
  const errs = results.filter(r => r.error);
  console.log(`\n=== SUMMARY ===`);
  console.log(`Tested: ${ok.length} | Errors: ${errs.length}`);
  if (ok.length > 0) {
    const avg = Math.round(ok.reduce((s, r) => s + r.overall, 0) / ok.length);
    console.log(`Average: ${avg} | Min: ${Math.min(...ok.map(r => r.overall))} | Max: ${Math.max(...ok.map(r => r.overall))}`);
    for (const eff of EFFECTS) {
      const effOk = ok.filter(r => r.effect === eff.name);
      if (effOk.length > 0) {
        const effAvg = Math.round(effOk.reduce((s, r) => s + r.overall, 0) / effOk.length);
        console.log(`  ${eff.name}: avg=${effAvg} (${effOk.length} tests)`);
      }
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
