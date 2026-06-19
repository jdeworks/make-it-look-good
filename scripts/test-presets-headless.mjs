#!/usr/bin/env node
// Headless browser test runner for all presets
// Usage: node scripts/test-presets-headless.mjs
// Requires: npm install, then either Puppeteer Chrome or Playwright Chromium:
//   npx puppeteer browsers install chrome
//   # or: npx playwright install chromium
//
// Serves docs/ locally, renders each preset in a real browser,
// runs the full extraction + scoring, saves results to research/

import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const DOCS_DIR = join(import.meta.dirname, '..', 'docs');
const RESEARCH_DIR = join(import.meta.dirname, '..', 'research');
const PORT = 8765;

async function launchBrowser() {
  const launchOptions = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };

  try {
    const browser = await puppeteer.launch(launchOptions);
    return { browser, engine: 'Puppeteer Chrome' };
  } catch (puppeteerError) {
    console.warn('Puppeteer launch failed. Trying Playwright Chromium fallback...');
    console.warn(`Puppeteer error: ${puppeteerError.message}`);
  }

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch(launchOptions);
    return { browser, engine: 'Playwright Chromium' };
  } catch (playwrightError) {
    throw new Error(
      [
        'No headless Chromium browser could be launched.',
        'Fresh clone setup:',
        '  npm install',
        '  npx puppeteer browsers install chrome',
        'Fallback:',
        '  npx playwright install chromium',
        `Playwright error: ${playwrightError.message}`
      ].join('\n')
    );
  }
}

async function setViewport(page, viewport) {
  if (typeof page.setViewport === 'function') {
    await page.setViewport(viewport);
    return;
  }
  await page.setViewportSize(viewport);
}

// Simple static file server
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

// Load manifest
function loadManifest() {
  return JSON.parse(readFileSync(join(DOCS_DIR, 'presets', 'index.json'), 'utf8'));
}

// Build test list
function buildTests(manifest) {
  const tests = [];
  for (const [el, info] of Object.entries(manifest.elements)) {
    const pers = Object.keys(info.personalities || {});
    for (const p of pers) {
      const file = join(DOCS_DIR, 'presets', el, p + '.html');
      if (existsSync(file)) tests.push({ element: el, personality: p });
    }
  }
  return tests;
}

async function runTest(page, element, personality) {
  const presetUrl = `http://localhost:${PORT}/presets/${element}/${personality}.html`;
  const html = readFileSync(join(DOCS_DIR, 'presets', element, personality + '.html'), 'utf8');

  // Navigate to a blank page with scoring modules loaded
  await page.goto(`http://localhost:${PORT}/tests/test-presets-rendered.html`, { waitUntil: 'networkidle0', timeout: 15000 });

  // Use the page's scoring modules + extraction to analyze the preset
  const result = await page.evaluate(async ({ html, element, personality }) => {
    return new Promise((resolve) => {
      // Create iframe with the preset
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;';
      iframe.sandbox = 'allow-scripts allow-same-origin';
      document.body.appendChild(iframe);

      let handled = false;
      function onMsg(e) {
        if (!e.data || e.data.type !== 'milg-headless-result') return;
        if (handled) return;
        handled = true;
        window.removeEventListener('message', onMsg);
        if (iframe.parentNode) document.body.removeChild(iframe);

        // Score the data
        const data = e.data.data;
        data.profile = 'general';
        data.meta.isFragment = true;
        data.meta.url = element + '/' + personality;
        try {
          const report = window.MilgScoring.runScoring(data);
          resolve({
            name: element + '/' + personality,
            overall: report.overall,
            grade: report.grade,
            categories: report.categories.map(c => ({
              label: c.label,
              score: c.score,
              checks: c.checks || 0,
              errors: c.findings.filter(f => f.severity === 'error').length,
              warnings: c.findings.filter(f => f.severity === 'warning').length,
              infos: c.findings.filter(f => f.severity === 'info').length,
              findings: c.findings.map(f => ({ severity: f.severity, title: f.title }))
            }))
          });
        } catch(err) {
          resolve({ name: element + '/' + personality, error: err.message });
        }
      }
      window.addEventListener('message', onMsg);

      // Load extraction function from the analyzer extractor module.
      fetch('/analyzer-extract.js').then(r => r.text()).then(code => {
        const match = code.match(/function extractFromDocument\(\)\s*\{/);
        if (!match) { resolve({ name: element + '/' + personality, error: 'No extractFromDocument' }); return; }
        const start = code.indexOf(match[0]);
        let depth = 0, end = start;
        for (let i = start; i < code.length; i++) {
          if (code[i] === '{') depth++;
          if (code[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        const extractFn = code.substring(start, end).replace(/milg-analyzer-result/g, 'milg-headless-result');

        const srcdoc = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
          '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
          '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></' + 'script>' +
          '<style>body{margin:0}</style></head><body>' +
          '<script>window.__milgIsFragment=true;</' + 'script>' +
          html +
          '<script>setTimeout(function(){(' + extractFn + ')()}, 2500);</' + 'script>' +
          '</body></html>';
        iframe.srcdoc = srcdoc;
      });

      // Timeout
      setTimeout(() => {
        if (handled) return;
        handled = true;
        window.removeEventListener('message', onMsg);
        if (iframe.parentNode) document.body.removeChild(iframe);
        resolve({ name: element + '/' + personality, error: 'Timeout' });
      }, 12000);
    });
  }, { html, element, personality });

  return result;
}

async function main() {
  console.log('Starting headless preset test runner...');
  const server = startServer();
  console.log(`Server running on port ${PORT}`);

  const manifest = loadManifest();
  const tests = buildTests(manifest);
  console.log(`Found ${tests.length} presets to test\n`);

  const { browser, engine } = await launchBrowser();
  console.log(`Using ${engine}\n`);
  const page = await browser.newPage();
  await setViewport(page, { width: 1280, height: 900 });

  const results = [];
  const errors = [];

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const name = `${t.element}/${t.personality}`;
    process.stdout.write(`[${i + 1}/${tests.length}] ${name}...`);

    try {
      const result = await runTest(page, t.element, t.personality);
      if (result.error) {
        process.stdout.write(` ERROR: ${result.error}\n`);
        errors.push(result);
      } else {
        const e = result.categories.reduce((s, c) => s + c.errors, 0);
        const w = result.categories.reduce((s, c) => s + c.warnings, 0);
        process.stdout.write(` ${result.overall} ${result.grade} (${e}E ${w}W)\n`);
        results.push(result);
      }
    } catch(err) {
      process.stdout.write(` CRASH: ${err.message}\n`);
      errors.push({ name, error: err.message });
    }
  }

  await browser.close();
  server.close();

  // Generate reports
  console.log(`\n--- Results ---`);
  console.log(`Tested: ${results.length} | Errors: ${errors.length}`);

  if (results.length > 0) {
    const avg = Math.round(results.reduce((s, r) => s + r.overall, 0) / results.length);
    const min = Math.min(...results.map(r => r.overall));
    const max = Math.max(...results.map(r => r.overall));
    const beforeResults = results.filter(r => r.name.endsWith('/before'));
    const cleanResults = results.filter(r => r.name.endsWith('/clean'));
    const beforeAvg = beforeResults.length > 0 ? Math.round(beforeResults.reduce((s, r) => s + r.overall, 0) / beforeResults.length) : 'N/A';
    const cleanAvg = cleanResults.length > 0 ? Math.round(cleanResults.reduce((s, r) => s + r.overall, 0) / cleanResults.length) : 'N/A';

    console.log(`Average: ${avg} | Min: ${min} | Max: ${max}`);
    console.log(`Before avg: ${beforeAvg} | Clean avg: ${cleanAvg}`);

    // Write summary
    let md = '# Preset Test Results (Headless Browser-Rendered)\n\n';
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Tested:** ${results.length} presets | **Errors:** ${errors.length}\n`;
    md += `**Average:** ${avg} | **Min:** ${min} | **Max:** ${max}\n`;
    md += `**Before avg:** ${beforeAvg} | **Clean avg:** ${cleanAvg}\n\n`;

    md += '## Scores\n\n';
    md += '| Preset | Score | Grade | Errors | Warnings | Infos |\n';
    md += '|--------|-------|-------|--------|----------|-------|\n';
    results.sort((a, b) => a.overall - b.overall);
    for (const r of results) {
      const e = r.categories.reduce((s, c) => s + c.errors, 0);
      const w = r.categories.reduce((s, c) => s + c.warnings, 0);
      const inf = r.categories.reduce((s, c) => s + c.infos, 0);
      md += `| ${r.name} | ${r.overall} | ${r.grade} | ${e} | ${w} | ${inf} |\n`;
    }

    md += '\n## Category Score Distribution\n\n';
    const catNames = results[0].categories.map(c => c.label);
    for (const cat of catNames) {
      const scores = results.map(r => r.categories.find(c => c.label === cat)?.score ?? 100);
      const catAvg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
      const catMin = Math.min(...scores);
      const catMax = Math.max(...scores);
      md += `- **${cat}**: avg=${catAvg} min=${catMin} max=${catMax}\n`;
    }

    md += '\n## Most Common Issues\n\n';
    const issueCounts = {};
    for (const r of results) {
      for (const c of r.categories) {
        for (const f of c.findings) {
          const key = `[${f.severity}] ${c.label}: ${f.title.substring(0, 80)}`;
          issueCounts[key] = (issueCounts[key] || 0) + 1;
        }
      }
    }
    const sortedIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]);
    for (const [issue, count] of sortedIssues.slice(0, 30)) {
      md += `- **${count}x** ${issue}\n`;
    }

    if (errors.length > 0) {
      md += '\n## Extraction Errors\n\n';
      for (const e of errors) {
        md += `- ${e.name}: ${e.error}\n`;
      }
    }

    const outFile = join(RESEARCH_DIR, 'analyzer-test-rendered.md');
    writeFileSync(outFile, md);
    console.log(`\nResults written to: ${outFile}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
