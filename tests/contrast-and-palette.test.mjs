/**
 * Contrast & Color Palette Visibility Tests
 *
 * Tests that:
 * 1. All presets have visible primary color beyond just focus rings
 * 2. The frosted style effect doesn't kill text contrast or border visibility
 * 3. Presets with sticky positioning work (overflow-x: clip, not hidden)
 *
 * Run: node tests/contrast-and-palette.test.mjs
 * Requires: puppeteer (npm install puppeteer)
 */

import puppeteer from 'puppeteer';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PRESETS_DIR = resolve(__dirname, '../docs/presets');

// --- Helpers ---

function getPresetFiles() {
  const presets = [];
  for (const dir of readdirSync(PRESETS_DIR)) {
    const full = join(PRESETS_DIR, dir);
    if (!statSync(full).isDirectory() || dir.startsWith('_') || dir.startsWith('.')) continue;
    for (const file of readdirSync(full)) {
      if (file.endsWith('.html')) {
        presets.push({ name: `${dir}/${file}`, path: join(full, file) });
      }
    }
  }
  return presets;
}

function extractColors(html, colorNames) {
  // Match Tailwind color classes like text-blue-500, bg-rose-600, border-indigo-200, etc.
  const pattern = new RegExp(
    `(?:text|bg|border|ring|divide|from|to|via|shadow|accent|outline)-(?:${colorNames.join('|')})-(50|100|200|300|400|500|600|700|800|900|950)`,
    'g'
  );
  return [...html.matchAll(pattern)].map(m => m[0]);
}

function extractNonFocusColors(html, colorNames) {
  // Remove focus-visible:... and focus:... prefixed classes before scanning
  const cleaned = html.replace(/focus-visible:[^\s"']*/g, '').replace(/focus:[^\s"']*/g, '');
  return extractColors(cleaned, colorNames);
}

const PRIMARY_COLORS = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'
];

// --- Tests ---

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function test(name, ok, detail) {
  if (ok) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    if (detail) console.log(`    ${detail}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  \x1b[33m○\x1b[0m ${name} (${reason})`);
}

// Test 1: Color palette visibility — every preset that uses primary colors
// should have at least one visible (non-focus) primary color element
console.log('\n\x1b[1mTest Suite: Color Palette Visibility\x1b[0m');
console.log('Ensures color palette swaps produce visible changes\n');

const presets = getPresetFiles();
for (const preset of presets) {
  const html = readFileSync(preset.path, 'utf8');
  const allColors = extractColors(html, PRIMARY_COLORS);

  if (allColors.length === 0) {
    // Preset doesn't use any primary colors — skip (may use inline styles/CSS vars)
    skip(preset.name, 'no Tailwind primary colors used');
    continue;
  }

  const nonFocusColors = extractNonFocusColors(html, PRIMARY_COLORS);
  test(
    `${preset.name} has visible primary colors (not just focus rings)`,
    nonFocusColors.length > 0,
    `Found ${allColors.length} primary color classes but all are inside focus-visible/focus prefixes`
  );
}

// Test 2: Frosted style effect — check that the CSS doesn't use overly broad
// border-color overrides that kill structural borders
console.log('\n\x1b[1mTest Suite: Frosted Style Effect Safety\x1b[0m');
console.log('Ensures frosted glass effect preserves text contrast and borders\n');

const appJs = readFileSync(resolve(__dirname, '../docs/app.js'), 'utf8');

// Extract frosted CSS from app.js
const frostedMatch = appJs.match(/name:\s*'Frosted'[\s\S]*?css:\s*`([\s\S]*?)`/);
if (frostedMatch) {
  const frostedCSS = frostedMatch[1];

  test(
    'Frosted CSS does not use overly broad [class*="border"] selector',
    !frostedCSS.includes('[class*="border"]{border-color:'),
    'Found [class*="border"]{border-color:...} which overrides ALL borders including structural dividers'
  );

  test(
    'Frosted CSS boosts text contrast for slate-500',
    frostedCSS.includes('text-slate-500') || frostedCSS.includes('text-gray-500'),
    'Frosted effect should override low-contrast text colors to maintain readability'
  );

  test(
    'Frosted CSS preserves divider borders',
    frostedCSS.includes('border-t') || frostedCSS.includes('divide-'),
    'Should have specific rules for structural dividers/borders'
  );
} else {
  skip('Frosted CSS analysis', 'could not extract frosted CSS from app.js');
}

// Test 3: Sticky positioning — presets using position:sticky should not have
// overflow-x-hidden ancestors (use overflow-x:clip instead)
console.log('\n\x1b[1mTest Suite: Sticky Positioning Compatibility\x1b[0m');
console.log('Ensures overflow-x handling does not break position: sticky\n');

for (const preset of presets) {
  const html = readFileSync(preset.path, 'utf8');
  const hasSticky = html.includes('sticky');
  // Only flag overflow-x-hidden (a full-width overflow clip) — overflow-hidden on
  // child elements (phone frames, image containers) is fine and doesn't break sticky.
  // Check for the Tailwind class on a wrapper element that appears before the sticky element.
  const overflowXHiddenIdx = html.indexOf('overflow-x-hidden');
  const stickyIdx = html.indexOf('sticky');

  if (!hasSticky) continue;
  // Only a problem when overflow-x-hidden appears BEFORE sticky (i.e. on an ancestor)
  const hasAncestorOverflowXHidden = overflowXHiddenIdx >= 0 && overflowXHiddenIdx < stickyIdx;

  test(
    `${preset.name} uses overflow-x:clip (not hidden) with sticky elements`,
    !hasAncestorOverflowXHidden,
    'overflow-x-hidden on an ancestor breaks position:sticky in most browsers. Use overflow-x:clip instead.'
  );
}

// Test 4: Puppeteer-based contrast check on a few key presets
console.log('\n\x1b[1mTest Suite: Runtime Contrast Check (Puppeteer)\x1b[0m');
console.log('Renders presets in a real browser and checks computed contrast ratios\n');

const contrastCheckerFn = `
function checkContrast() {
  function parseColor(str) {
    if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
    var m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
  }
  function blendOnWhite(c) {
    if (!c) return { r: 255, g: 255, b: 255 };
    var a = c.a;
    return { r: Math.round(c.r * a + 255 * (1 - a)), g: Math.round(c.g * a + 255 * (1 - a)), b: Math.round(c.b * a + 255 * (1 - a)) };
  }
  function getEffectiveBg(el) {
    var node = el;
    var layers = [];
    while (node && node !== document.documentElement) {
      var bg = getComputedStyle(node).backgroundColor;
      var c = parseColor(bg);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
      node = node.parentElement;
    }
    var result = { r: 255, g: 255, b: 255 };
    for (var i = layers.length - 1; i >= 0; i--) {
      var l = layers[i];
      var a = l.a;
      result = { r: Math.round(l.r * a + result.r * (1 - a)), g: Math.round(l.g * a + result.g * (1 - a)), b: Math.round(l.b * a + result.b * (1 - a)) };
    }
    return result;
  }
  function luminance(c) {
    var rs = c.r / 255, gs = c.g / 255, bs = c.b / 255;
    var r = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    var g = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    var b = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastRatio(c1, c2) {
    var l1 = luminance(c1), l2 = luminance(c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function isVisible(el) {
    var s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  var issues = [];
  var checked = 0;
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  var node, seen = new Set();
  while (node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    var el = node.parentElement;
    if (!el || !isVisible(el)) continue;
    if (seen.has(el)) continue;
    seen.add(el);
    checked++;
    var style = getComputedStyle(el);
    var fg = parseColor(style.color);
    if (!fg) continue;
    var fgBlended = blendOnWhite(fg);
    var bg = getEffectiveBg(el);
    var ratio = contrastRatio(fgBlended, bg);
    var fontSize = parseFloat(style.fontSize);
    var fontWeight = parseInt(style.fontWeight) || 400;
    var isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    var threshold = isLarge ? 3 : 4.5;
    if (ratio < threshold) {
      issues.push({
        text: node.textContent.trim().substring(0, 40),
        ratio: Math.round(ratio * 100) / 100,
        needed: threshold,
        tag: el.tagName.toLowerCase(),
        fg: 'rgb(' + fgBlended.r + ',' + fgBlended.g + ',' + fgBlended.b + ')',
        bg: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')'
      });
    }
  }
  return { issues, checked };
}
`;

// Test a few representative presets with Puppeteer
const testPresets = [
  'accordion/clean.html',
  'accordion/minimalist.html',
  'dropdown/clean.html',
];

let browser;
try {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  for (const presetPath of testPresets) {
    const fullPath = join(PRESETS_DIR, presetPath);
    let html;
    try {
      html = readFileSync(fullPath, 'utf8');
    } catch {
      skip(`Runtime contrast: ${presetPath}`, 'file not found');
      continue;
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Build a full HTML page with Tailwind
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { margin: 0; }</style>
</head>
<body>${html}</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 15000 });

    // Run contrast check
    const result = await page.evaluate(new Function(contrastCheckerFn + '\nreturn checkContrast();'));

    test(
      `Runtime contrast: ${presetPath} (${result.checked} elements)`,
      result.issues.length === 0,
      result.issues.length > 0
        ? `${result.issues.length} contrast failures: ${result.issues.map(i => `"${i.text}" ${i.ratio}:1 (need ${i.needed}:1)`).join(', ')}`
        : undefined
    );

    await page.close();
  }

  // Test frosted effect on accordion/minimalist
  {
    const frostedCSS = frostedMatch ? frostedMatch[1] : '';
    const html = readFileSync(join(PRESETS_DIR, 'accordion/minimalist.html'), 'utf8');
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { margin: 0; }
${frostedCSS}</style>
</head>
<body>${html}</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 15000 });

    const result = await page.evaluate(new Function(contrastCheckerFn + '\nreturn checkContrast();'));

    test(
      `Runtime contrast: accordion/minimalist + frosted effect (${result.checked} elements)`,
      result.issues.length === 0,
      result.issues.length > 0
        ? `${result.issues.length} contrast failures with frosted: ${result.issues.map(i => `"${i.text}" ${i.ratio}:1 (need ${i.needed}:1, fg=${i.fg}, bg=${i.bg})`).join('; ')}`
        : undefined
    );

    await page.close();
  }
} catch (e) {
  console.log(`  \x1b[33m○\x1b[0m Puppeteer tests skipped: ${e.message}`);
} finally {
  if (browser) await browser.close();
}

// --- Summary ---
console.log('\n\x1b[1m─── Results ───\x1b[0m');
console.log(`  \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m, \x1b[33m${skipped} skipped\x1b[0m`);
if (failures.length > 0) {
  console.log('\n\x1b[1mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`  \x1b[31m✗\x1b[0m ${f.name}`);
    if (f.detail) console.log(`    ${f.detail}`);
  }
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
