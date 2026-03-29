#!/usr/bin/env node
// Test all templates for layout/overflow issues across viewports
// Skips effects (they only change colors/fonts) and "before" variants
//
// Usage:
//   node scripts/test-layout.mjs              # test all templates
//   node scripts/test-layout.mjs dashboard    # test one element
//   node scripts/test-layout.mjs --threads=6  # parallel threads
//
// Checks:
//   - Body horizontal overflow (scrollWidth > clientWidth)
//   - Elements wider than viewport without scroll wrapper
//   - Content clipped outside viewport bounds
//   - Hidden panels that overflow when revealed

import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const DOCS_DIR = join(import.meta.dirname, '..', 'docs');
const RESULTS_DIR = join(import.meta.dirname, '..', 'research', 'template-results');
const PORT = 8768;

const args = process.argv.slice(2);
const THREADS = parseInt((args.find(a => a.startsWith('--threads=')) || '--threads=3').split('=')[1]);
const TEMPLATE = args.find(a => !a.startsWith('--')) || '';

const VIEWPORTS = [
  { w: 375, h: 812, label: 'phone' },
  { w: 768, h: 1024, label: 'tablet' },
  { w: 1280, h: 900, label: 'desktop' },
];

const DARK_MODES = [false, true];

function startServer() {
  const mimeTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = createServer((req, res) => {
    let filePath = join(DOCS_DIR, req.url === '/' ? 'index.html' : req.url);
    if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  server.listen(PORT);
  return server;
}

function buildTests() {
  const manifest = JSON.parse(readFileSync(join(DOCS_DIR, 'presets', 'index.json'), 'utf8'));
  const tests = [];
  for (const [el, info] of Object.entries(manifest.elements)) {
    for (const pers of Object.keys(info.personalities || {})) {
      // Skip "before" variants
      if (pers === 'before') continue;
      // Filter by template if specified
      if (TEMPLATE && el !== TEMPLATE && `${el}/${pers}` !== TEMPLATE) continue;
      const file = join(DOCS_DIR, 'presets', el, pers + '.html');
      if (!existsSync(file)) continue;
      for (const vp of VIEWPORTS) {
        for (const dark of DARK_MODES) {
          tests.push({ element: el, personality: pers, viewport: vp, dark });
        }
      }
    }
  }
  return tests;
}

function testKey(t) {
  return `${t.element}/${t.personality}|${t.viewport.label}|${t.dark ? 'dark' : 'light'}`;
}

async function runTest(page, t) {
  const html = readFileSync(join(DOCS_DIR, 'presets', t.element, t.personality + '.html'), 'utf8');
  await page.setViewport({ width: t.viewport.w, height: t.viewport.h });

  const result = await page.evaluate(async (html, dark, vpWidth, vpHeight) => {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = `position:fixed;top:0;left:0;width:${vpWidth}px;height:${vpHeight}px;border:none;`;
      document.body.appendChild(iframe);

      const darkClass = dark ? ' class="dark"' : '';
      const darkVariantCSS = '@custom-variant dark (&:where(.dark, .dark *));';
      const srcdoc = '<!DOCTYPE html><html lang="en"' + darkClass + '><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></' + 'script>' +
        (dark ? '<style type="text/tailwindcss">' + darkVariantCSS + '</style>' : '') +
        '<style>body{margin:0}</style></head><body>' + html +
        '<script>setTimeout(function(){' +
        // Layout checks running inside the iframe
        'var doc = document.documentElement;' +
        'var body = document.body;' +
        'var vpW = window.innerWidth;' +
        'var vpH = window.innerHeight;' +
        'var issues = [];' +
        // 1. Body overflow
        'var bodyScrollW = Math.max(doc.scrollWidth, body.scrollWidth);' +
        'if (bodyScrollW > vpW + 2) {' +
        '  issues.push({ type: "body-overflow", scrollWidth: bodyScrollW, viewport: vpW, overflow: bodyScrollW - vpW });' +
        '}' +
        // 2. Elements wider than viewport without scroll wrapper
        'var all = body.querySelectorAll("*");' +
        'var checked = new Set();' +
        'for (var i = 0; i < all.length && i < 500; i++) {' +
        '  var el = all[i];' +
        '  if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;' +
        '  var r = el.getBoundingClientRect();' +
        '  if (r.width < 4 || r.height < 4) continue;' +
        '  if (r.right > vpW + 2 || r.left < -2) {' +
        // Check if inside overflow-x-auto/scroll container
        '    var inScroll = false;' +
        '    var anc = el.parentElement;' +
        '    while (anc && anc !== body) {' +
        '      var ox = getComputedStyle(anc).overflowX;' +
        '      if (ox === "auto" || ox === "scroll") { inScroll = true; break; }' +
        '      anc = anc.parentElement;' +
        '    }' +
        '    if (!inScroll) {' +
        // Skip if parent already recorded
        '      var sel = el.tagName.toLowerCase();' +
        '      if (el.id) sel = "#" + el.id;' +
        '      else if (el.className && typeof el.className === "string") sel += "." + el.className.trim().split(/\\s+/).slice(0,2).join(".");' +
        '      var text = (el.textContent || "").trim().substring(0, 40);' +
        '      if (!checked.has(sel)) {' +
        '        checked.add(sel);' +
        '        issues.push({ type: "element-overflow", selector: sel, text: text, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), vpWidth: vpW });' +
        '      }' +
        '    }' +
        '  }' +
        '}' +
        // 3. Elements wider than viewport but hidden by overflow:hidden (silent clip)
        'for (var j = 0; j < all.length && j < 300; j++) {' +
        '  var el2 = all[j];' +
        '  if (el2.tagName === "SCRIPT" || el2.tagName === "STYLE") continue;' +
        '  var s2 = getComputedStyle(el2);' +
        '  var br2 = s2.borderRadius;' +
        '  if (s2.overflowX === "hidden" && el2.scrollWidth > el2.clientWidth + 4 && (!br2 || br2 === "0px") && s2.pointerEvents !== "none" && s2.position !== "fixed") {' +
        '    var sel2 = el2.tagName.toLowerCase();' +
        '    if (el2.id) sel2 = "#" + el2.id;' +
        '    else if (el2.className && typeof el2.className === "string") sel2 += "." + el2.className.trim().split(/\\s+/).slice(0,2).join(".");' +
        '    issues.push({ type: "hidden-clip", selector: sel2, clientWidth: el2.clientWidth, scrollWidth: el2.scrollWidth, clipped: el2.scrollWidth - el2.clientWidth });' +
        '  }' +
        '}' +
        'parent.postMessage({ type: "layout-result", issues: issues }, "*");' +
        '}, 2500);</' + 'script></body></html>';

      let handled = false;
      function onMsg(e) {
        if (!e.data || e.data.type !== 'layout-result') return;
        if (handled) return;
        handled = true;
        window.removeEventListener('message', onMsg);
        if (iframe.parentNode) document.body.removeChild(iframe);
        resolve({ issues: e.data.issues || [] });
      }
      window.addEventListener('message', onMsg);
      iframe.srcdoc = srcdoc;

      setTimeout(() => {
        if (handled) return;
        handled = true;
        window.removeEventListener('message', onMsg);
        if (iframe.parentNode) document.body.removeChild(iframe);
        resolve({ error: 'Timeout' });
      }, 12000);
    });
  }, html, t.dark, t.viewport.w, t.viewport.h);

  return result;
}

async function main() {
  const tests = buildTests();
  if (tests.length === 0) {
    console.error('No tests found' + (TEMPLATE ? ` for "${TEMPLATE}"` : '') + '. Check docs/presets/index.json');
    process.exit(1);
  }

  console.log(`Layout test: ${TEMPLATE || 'ALL'} (${tests.length} combinations, ${THREADS} threads)`);
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const server = startServer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  const pages = [];
  for (let i = 0; i < THREADS; i++) pages.push(await browser.newPage());

  const results = [];
  let completed = 0;
  const startTime = Date.now();

  let idx = 0;
  async function worker(page) {
    while (idx < tests.length) {
      const t = tests[idx++];
      const key = testKey(t);
      try {
        const result = await runTest(page, t);
        completed++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        if (result.error) {
          process.stdout.write(`\r[${completed}/${tests.length}] ${elapsed}s ${key} ERROR          \n`);
          results.push({ key, ...t, error: result.error });
        } else {
          const bodyOF = result.issues.filter(i => i.type === 'body-overflow').length;
          const elemOF = result.issues.filter(i => i.type === 'element-overflow').length;
          const clip = result.issues.filter(i => i.type === 'hidden-clip').length;
          // Only count body overflow and hidden-clip as failures — element-overflow
          // without body scroll is usually intentional (hidden sidebars, translate off-screen)
          const realIssues = bodyOF + clip;
          if (realIssues > 0) {
            process.stdout.write(`\r[${completed}/${tests.length}] ${elapsed}s ${key} ❌ ${bodyOF} body-overflow, ${clip} hidden-clip${elemOF > 0 ? ', ' + elemOF + ' elem-overflow' : ''}          \n`);
          } else if (elemOF > 0) {
            process.stdout.write(`\r[${completed}/${tests.length}] ${elapsed}s ${key} ⚠ ${elemOF} offscreen (no body scroll)          `);
          } else {
            process.stdout.write(`\r[${completed}/${tests.length}] ${elapsed}s ${key} ✓          `);
          }
          results.push({ key, ...t, issues: result.issues });
        }
      } catch (err) {
        completed++;
        results.push({ key, ...t, error: err.message });
      }
    }
  }

  await Promise.all(pages.map(p => worker(p)));
  await browser.close();
  server.close();

  // Report
  const ok = results.filter(r => !r.error);
  // Real issues = body overflow or hidden clip (not just off-screen elements without scroll)
  const withIssues = ok.filter(r => r.issues && r.issues.some(i => i.type === 'body-overflow' || i.type === 'hidden-clip'));

  let md = `# Layout Test Results\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Templates tested:** ${ok.length} | **With issues:** ${withIssues.length}\n\n`;

  if (withIssues.length > 0) {
    md += '## Failures\n\n';
    md += '| Template | Viewport | Mode | Body OF | Elem OF | Clip | Details |\n';
    md += '|----------|----------|------|---------|---------|------|---------|\n';
    for (const r of withIssues.sort((a, b) => b.issues.length - a.issues.length)) {
      const bodyOF = r.issues.filter(i => i.type === 'body-overflow');
      const elemOF = r.issues.filter(i => i.type === 'element-overflow');
      const clip = r.issues.filter(i => i.type === 'hidden-clip');
      const details = [
        ...bodyOF.map(i => `body +${i.overflow}px`),
        ...elemOF.slice(0, 2).map(i => `${i.selector} right=${i.right}px`),
        ...clip.slice(0, 1).map(i => `${i.selector} clipped ${i.clipped}px`)
      ].join('; ');
      md += `| ${r.element}/${r.personality} | ${r.viewport.label} | ${r.dark ? 'dark' : 'light'} | ${bodyOF.length} | ${elemOF.length} | ${clip.length} | ${details} |\n`;
    }

    // Aggregate by template
    md += '\n## Summary by Template\n\n';
    const byTemplate = {};
    for (const r of withIssues) {
      const tpl = `${r.element}/${r.personality}`;
      if (!byTemplate[tpl]) byTemplate[tpl] = { phone: 0, tablet: 0, desktop: 0, issues: [] };
      byTemplate[tpl][r.viewport.label]++;
      for (const i of r.issues) byTemplate[tpl].issues.push(i);
    }
    for (const [tpl, data] of Object.entries(byTemplate).sort((a, b) => b[1].issues.length - a[1].issues.length)) {
      md += `### ${tpl}\n`;
      md += `- Phone: ${data.phone} | Tablet: ${data.tablet} | Desktop: ${data.desktop}\n`;
      const uniqueIssues = new Set(data.issues.map(i => `${i.type}: ${i.selector || 'body'}`));
      for (const ui of uniqueIssues) md += `  - ${ui}\n`;
      md += '\n';
    }
  } else {
    md += '## All templates pass! No overflow issues detected.\n';
  }

  const outFile = join(RESULTS_DIR, 'layout-test.md');
  writeFileSync(outFile, md);
  writeFileSync(join(RESULTS_DIR, 'layout-test.json'), JSON.stringify(results, null, 2));

  console.log(`\n\n=== LAYOUT TEST RESULTS ===`);
  console.log(`Tested: ${ok.length} | Issues: ${withIssues.length} | Errors: ${results.filter(r => r.error).length}`);
  if (withIssues.length > 0) {
    console.log(`\nTemplates with overflow:`);
    for (const r of withIssues) {
      console.log(`  ${r.key}: ${r.issues.map(i => i.type).join(', ')}`);
    }
  }
  console.log(`\nReport: ${outFile}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
