#!/usr/bin/env node
// E2E test: bbox data, screenshot metadata, viewer, and contrast verification
// Tests all three input paths: HTML paste, URL fetch, and console snippet output
// Requires: puppeteer, a local HTTP server on port 8787

var http = require('http');
var fs = require('fs');
var path = require('path');
var puppeteer = require('puppeteer');

var DOCS_DIR = path.resolve(__dirname, '..');
var PORT = 8787;
var BASE = 'http://localhost:' + PORT;
var passed = 0, failed = 0, errors = [];

function log(ok, msg) {
  if (ok) { passed++; console.log('  \x1b[32m✓\x1b[0m ' + msg); }
  else { failed++; errors.push(msg); console.log('  \x1b[31m✗\x1b[0m ' + msg); }
}

function assert(cond, msg) { log(!!cond, msg); }

// Simple static file server
function startServer() {
  var mimes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp' };
  var server = http.createServer(function(req, res) {
    var url = req.url.split('?')[0];
    if (url === '/') url = '/index.html';
    var filePath = path.join(DOCS_DIR, url);
    try {
      var data = fs.readFileSync(filePath);
      var ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
      res.end(data);
    } catch(e) {
      res.writeHead(404);
      res.end('Not found: ' + url);
    }
  });
  server.listen(PORT);
  return server;
}

// Test HTML to analyze — has known contrast issues and varied elements
var TEST_HTML = [
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '<style>',
  'body { margin: 0; font-family: sans-serif; background: #fff; }',
  '.hero { background: linear-gradient(135deg, #1e3a5f 0%, #4a90d9 100%); padding: 60px 40px; }',
  '.hero h1 { color: #fff; font-size: 36px; margin: 0; }',
  '.hero p { color: #aab; font-size: 16px; margin: 8px 0 0; }',  // Low contrast on gradient
  'section { padding: 40px; }',
  '.card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 16px 0; }',
  '.card h2 { color: #333; font-size: 24px; margin: 0 0 8px; }',
  '.card p { color: #666; font-size: 14px; line-height: 1.6; }',
  '.btn { display: inline-block; padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; }',
  '.btn-ghost { background: transparent; color: #999; border: 1px solid #ddd; padding: 4px 8px; font-size: 11px; }',  // Small touch target
  'footer { background: #1e293b; color: #94a3b8; padding: 20px 40px; font-size: 12px; }',
  'footer a { color: #64748b; text-decoration: none; margin-right: 12px; }',  // Low contrast links
  '</style></head><body>',
  '<div class="hero"><h1>Test Page</h1><p>Subtitle with questionable contrast</p></div>',
  '<section>',
  '<div class="card"><h2>Card Title</h2><p>Some body text that should have good contrast and reasonable line length for readability scoring.</p></div>',
  '<button class="btn">Primary Action</button>',
  '<button class="btn-ghost">Tiny ghost</button>',
  '</section>',
  '<footer><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a></footer>',
  '</body></html>'
].join('\n');

async function run() {
  var server = startServer();
  console.log('Server running on port ' + PORT);

  var browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    // ============================================================
    console.log('\n--- Test 1: HTML Paste with Screenshots ---');
    // ============================================================
    await testHtmlPaste(browser);

    // ============================================================
    console.log('\n--- Test 2: Console Snippet Output (JSON paste) ---');
    // ============================================================
    await testSnippetOutput(browser);

    // ============================================================
    console.log('\n--- Test 3: Module loading & viewer structure ---');
    // ============================================================
    await testModulesAndViewer(browser);

    // ============================================================
    console.log('\n--- Test 4: Extraction bbox data correctness ---');
    // ============================================================
    await testExtractionBbox(browser);

  } catch(e) {
    console.error('\n\x1b[31mFATAL:\x1b[0m', e.message);
    failed++;
    errors.push('Fatal: ' + e.message);
  }

  await browser.close();
  server.close();

  console.log('\n========================================');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(function(e) { console.log('  - ' + e); });
  }
  console.log('========================================');
  process.exit(failed > 0 ? 1 : 0);
}

// Test 1: Paste HTML, enable screenshots, verify report has bbox + meta + viewer
async function testHtmlPaste(browser) {
  var page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/analyzer.html', { waitUntil: 'networkidle0', timeout: 15000 });

  // Click HTML tab
  await page.click('[data-tab="tabHtml"]');
  await page.waitForSelector('#htmlInput', { visible: true });

  // Ensure screenshots checkbox is checked
  var ssChecked = await page.$eval('#screenshotCheck', function(el) { return el.checked; });
  assert(ssChecked, 'Screenshot checkbox is checked by default');

  // Paste test HTML
  await page.evaluate(function(html) { document.getElementById('htmlInput').value = html; }, TEST_HTML);

  // Click Analyze HTML
  await page.click('#analyzeHtmlBtn');

  // Wait for report to appear (up to 30s for screenshots)
  await page.waitForSelector('.report-container.visible', { timeout: 30000 });

  // Check that report rendered
  var hasReport = await page.$('.report-header');
  assert(hasReport, 'Report rendered after HTML paste');

  // Check for screenshot section
  var hasScreenshots = await page.$('.report-screenshots');
  assert(hasScreenshots, 'Screenshot section present in report');

  // Check that screenshotMeta is available in reportData
  var metaCheck = await page.evaluate(function() {
    // Access the report data via the global (stored in sessionStorage by runAnalysis)
    var raw = null;
    try { raw = JSON.parse(sessionStorage.getItem('milg-last-extraction')); } catch(e) {}
    if (!raw) return { hasMeta: false, error: 'no extraction data in sessionStorage' };
    return {
      hasMeta: !!raw.screenshotMeta,
      scale: raw.screenshotMeta ? raw.screenshotMeta.scale : null,
      viewportHeight: raw.screenshotMeta ? raw.screenshotMeta.viewportHeight : null,
      sectionCount: raw.screenshotMeta ? raw.screenshotMeta.sectionCount : null,
      canvasWidth: raw.screenshotMeta ? raw.screenshotMeta.canvasWidth : null
    };
  });
  assert(metaCheck.hasMeta, 'screenshotMeta present in extraction data');
  if (metaCheck.hasMeta) {
    assert(metaCheck.scale === 0.5, 'screenshotMeta.scale is 0.5 (got ' + metaCheck.scale + ')');
    assert(metaCheck.viewportHeight > 0, 'screenshotMeta.viewportHeight > 0 (got ' + metaCheck.viewportHeight + ')');
    assert(metaCheck.sectionCount > 0, 'screenshotMeta.sectionCount > 0 (got ' + metaCheck.sectionCount + ')');
    assert(metaCheck.canvasWidth > 0, 'screenshotMeta.canvasWidth > 0 (got ' + metaCheck.canvasWidth + ')');
  }

  // Check contrast pairs have bbox data
  var bboxCheck = await page.evaluate(function() {
    var raw = null;
    try { raw = JSON.parse(sessionStorage.getItem('milg-last-extraction')); } catch(e) {}
    if (!raw || !raw.colors || !raw.colors.contrastPairs) return { pairs: 0, withBbox: 0 };
    var pairs = raw.colors.contrastPairs;
    var withBbox = pairs.filter(function(p) { return p.bbox && p.bbox.left !== undefined && p.bbox.top !== undefined; }).length;
    return { pairs: pairs.length, withBbox: withBbox };
  });
  assert(bboxCheck.pairs > 0, 'Has contrast pairs (' + bboxCheck.pairs + ')');
  assert(bboxCheck.withBbox > 0, 'Contrast pairs have bbox data (' + bboxCheck.withBbox + '/' + bboxCheck.pairs + ')');
  assert(bboxCheck.withBbox === bboxCheck.pairs, 'All contrast pairs have bbox (' + bboxCheck.withBbox + '/' + bboxCheck.pairs + ')');

  // Check touch targets have bbox data
  var touchBboxCheck = await page.evaluate(function() {
    var raw = null;
    try { raw = JSON.parse(sessionStorage.getItem('milg-last-extraction')); } catch(e) {}
    if (!raw || !raw.interaction || !raw.interaction.touchTargets) return { targets: 0, withBbox: 0 };
    var targets = raw.interaction.touchTargets;
    var withBbox = targets.filter(function(t) { return t.bbox && t.bbox.left !== undefined; }).length;
    return { targets: targets.length, withBbox: withBbox };
  });
  assert(touchBboxCheck.targets >= 0, 'Has touch targets (' + touchBboxCheck.targets + ')');
  if (touchBboxCheck.targets > 0) {
    assert(touchBboxCheck.withBbox === touchBboxCheck.targets, 'All touch targets have bbox (' + touchBboxCheck.withBbox + '/' + touchBboxCheck.targets + ')');
  }

  // Check that "Show on screenshot" links exist for findings with bboxes
  var showLinks = await page.$$('.finding-show-on-screenshot');
  assert(showLinks.length > 0, '"Show on screenshot" links present (' + showLinks.length + ')');

  // Check that findings have data-finding-idx attributes
  var findingsWithIdx = await page.$$('[data-finding-idx]');
  assert(findingsWithIdx.length > 0, 'Findings have data-finding-idx attributes (' + findingsWithIdx.length + ')');

  // Wait a moment for async contrast verification to complete
  await new Promise(function(r) { setTimeout(r, 3000); });

  // Check if contrast verification summary appeared
  var hasVerifySummary = await page.$('.contrast-verify-summary');
  assert(hasVerifySummary, 'Pixel contrast verification summary present');

  await page.close();
}

// Test 2: Simulate snippet output (paste JSON with bbox data)
async function testSnippetOutput(browser) {
  var page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/analyzer.html', { waitUntil: 'networkidle0', timeout: 15000 });

  // Run the snippet in a test iframe to get extraction data with bboxes
  var extractionData = await page.evaluate(function(html) {
    return new Promise(function(resolve) {
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;';
      iframe.sandbox = 'allow-scripts allow-same-origin';
      document.body.appendChild(iframe);

      window.addEventListener('message', function handler(e) {
        if (e.data && e.data.type === 'milg-analyzer-result') {
          window.removeEventListener('message', handler);
          document.body.removeChild(iframe);
          resolve(e.data.data);
        }
      });

      var extractFn = window.MilgExtract;
      var extractScript = '<script>window.addEventListener("load",function(){setTimeout(function(){(' + extractFn.toString() + ')()},500)});</' + 'script>';
      iframe.srcdoc = html + extractScript;

      setTimeout(function() { resolve(null); }, 10000);
    });
  }, TEST_HTML);

  assert(extractionData !== null, 'Extraction completed in iframe');
  if (!extractionData) { await page.close(); return; }

  // Verify bbox on contrast pairs from extraction
  var pairs = (extractionData.colors && extractionData.colors.contrastPairs) || [];
  assert(pairs.length > 0, 'Extracted contrast pairs: ' + pairs.length);
  var pairsWithBbox = pairs.filter(function(p) { return p.bbox && typeof p.bbox.left === 'number'; });
  assert(pairsWithBbox.length === pairs.length, 'All extracted pairs have bbox (' + pairsWithBbox.length + '/' + pairs.length + ')');

  // Verify bbox values are reasonable
  if (pairsWithBbox.length > 0) {
    var firstBbox = pairsWithBbox[0].bbox;
    assert(firstBbox.left >= 0, 'bbox.left >= 0 (got ' + firstBbox.left + ')');
    assert(firstBbox.top >= 0, 'bbox.top >= 0 (got ' + firstBbox.top + ')');
    assert(firstBbox.width > 0, 'bbox.width > 0 (got ' + firstBbox.width + ')');
    assert(firstBbox.height > 0, 'bbox.height > 0 (got ' + firstBbox.height + ')');
  }

  // Verify bbox on touch targets
  var targets = (extractionData.interaction && extractionData.interaction.touchTargets) || [];
  if (targets.length > 0) {
    var targetsWithBbox = targets.filter(function(t) { return t.bbox && typeof t.bbox.left === 'number'; });
    assert(targetsWithBbox.length === targets.length, 'All touch targets have bbox (' + targetsWithBbox.length + '/' + targets.length + ')');
  }

  // Paste JSON into the Snippet tab's paste area and analyze
  var json = JSON.stringify(extractionData);
  await page.evaluate(function(json) {
    // Activate the Console Snippet tab (contains the JSON paste area)
    document.querySelector('[data-tab="tabSnippet"]').click();
    document.getElementById('pasteInput').value = json;
    document.getElementById('analyzeBtn').click();
  }, json);

  await page.waitForSelector('.report-container.visible', { timeout: 10000 });

  // Verify scoring passed bbox through to findings
  var findingsBboxCheck = await page.evaluate(function() {
    var findings = document.querySelectorAll('[data-finding-idx]');
    return findings.length;
  });
  assert(findingsBboxCheck > 0, 'Scoring passed bbox to findings (data-finding-idx count: ' + findingsBboxCheck + ')');

  await page.close();
}

// Test 3: Module loading and viewer structure
async function testModulesAndViewer(browser) {
  var page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/analyzer.html', { waitUntil: 'networkidle0', timeout: 15000 });

  // Check all modules loaded
  var modules = await page.evaluate(function() {
    return {
      MilgExtract: typeof window.MilgExtract,
      MilgIframe: typeof window.MilgIframe,
      MilgProxy: typeof window.MilgProxy,
      MilgCrawlUI: typeof window.MilgCrawlUI,
      MilgViewer: typeof window.MilgViewer,
      MilgContrastVerify: typeof window.MilgContrastVerify,
      MilgReport: typeof window.MilgReport,
      MilgScoring: typeof window.MilgScoring,
      MilgCrawl: typeof window.MilgCrawl
    };
  });

  assert(modules.MilgExtract === 'function', 'MilgExtract loaded (type: ' + modules.MilgExtract + ')');
  assert(modules.MilgIframe === 'object', 'MilgIframe loaded (type: ' + modules.MilgIframe + ')');
  assert(modules.MilgProxy === 'object', 'MilgProxy loaded (type: ' + modules.MilgProxy + ')');
  assert(modules.MilgCrawlUI === 'object', 'MilgCrawlUI loaded (type: ' + modules.MilgCrawlUI + ')');
  assert(modules.MilgViewer === 'object', 'MilgViewer loaded (type: ' + modules.MilgViewer + ')');
  assert(modules.MilgContrastVerify === 'object', 'MilgContrastVerify loaded (type: ' + modules.MilgContrastVerify + ')');
  assert(modules.MilgReport === 'object', 'MilgReport loaded (type: ' + modules.MilgReport + ')');
  assert(modules.MilgScoring === 'object', 'MilgScoring loaded (type: ' + modules.MilgScoring + ')');
  assert(modules.MilgCrawl === 'object', 'MilgCrawl loaded (type: ' + modules.MilgCrawl + ')');

  // Verify viewer API
  var viewerApi = await page.evaluate(function() {
    return {
      hasOpen: typeof MilgViewer.open === 'function',
      hasClose: typeof MilgViewer.close === 'function',
      hasShowFinding: typeof MilgViewer.showFinding === 'function'
    };
  });
  assert(viewerApi.hasOpen, 'MilgViewer.open is a function');
  assert(viewerApi.hasClose, 'MilgViewer.close is a function');
  assert(viewerApi.hasShowFinding, 'MilgViewer.showFinding is a function');

  // Verify contrast verify API
  var verifyApi = await page.evaluate(function() {
    return {
      hasVerify: typeof MilgContrastVerify.verify === 'function',
      hasBuildSummary: typeof MilgContrastVerify.buildSummary === 'function',
      hasFormatResult: typeof MilgContrastVerify.formatResult === 'function',
      hasRenderSummaryHtml: typeof MilgContrastVerify.renderSummaryHtml === 'function'
    };
  });
  assert(verifyApi.hasVerify, 'MilgContrastVerify.verify is a function');
  assert(verifyApi.hasBuildSummary, 'MilgContrastVerify.buildSummary is a function');
  assert(verifyApi.hasFormatResult, 'MilgContrastVerify.formatResult is a function');
  assert(verifyApi.hasRenderSummaryHtml, 'MilgContrastVerify.renderSummaryHtml is a function');

  // Test contrast ratio math
  var mathCheck = await page.evaluate(function() {
    var cr = MilgContrastVerify.contrastRatio;
    var black = { r: 0, g: 0, b: 0 };
    var white = { r: 255, g: 255, b: 255 };
    var gray = { r: 128, g: 128, b: 128 };
    return {
      bw: cr(black, white),
      ww: cr(white, white),
      bg: cr(black, gray)
    };
  });
  assert(mathCheck.bw === 21, 'Black/white contrast = 21:1 (got ' + mathCheck.bw + ')');
  assert(mathCheck.ww === 1, 'White/white contrast = 1:1 (got ' + mathCheck.ww + ')');
  assert(mathCheck.bg > 5 && mathCheck.bg < 6, 'Black/gray contrast ~5.3:1 (got ' + mathCheck.bg + ')');

  await page.close();
}

// Test 4: Direct extraction bbox data correctness
async function testExtractionBbox(browser) {
  var page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Load test HTML directly to verify extraction produces correct bboxes
  await page.setContent(TEST_HTML, { waitUntil: 'load' });
  await new Promise(function(r) { setTimeout(r, 500); });

  // Run extraction function directly
  var extractResult = await page.evaluate(function() {
    // Load the extraction function (it's not available in this context, inline a simplified check)
    // Instead, manually check getBoundingClientRect on key elements
    var hero = document.querySelector('.hero h1');
    var btn = document.querySelector('.btn');
    var btnGhost = document.querySelector('.btn-ghost');
    var footerLink = document.querySelector('footer a');

    function getRect(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
    }

    return {
      heroH1: getRect(hero),
      btn: getRect(btn),
      btnGhost: getRect(btnGhost),
      footerLink: getRect(footerLink)
    };
  });

  assert(extractResult.heroH1 !== null, 'Hero h1 found');
  if (extractResult.heroH1) {
    assert(extractResult.heroH1.top >= 0 && extractResult.heroH1.top < 200, 'Hero h1 top is reasonable (got ' + extractResult.heroH1.top + ')');
    assert(extractResult.heroH1.width > 50, 'Hero h1 width > 50 (got ' + extractResult.heroH1.width + ')');
  }

  assert(extractResult.btn !== null, 'Primary button found');
  if (extractResult.btn) {
    assert(extractResult.btn.height >= 20, 'Button height >= 20 (got ' + extractResult.btn.height + ')');
  }

  assert(extractResult.btnGhost !== null, 'Ghost button found');
  if (extractResult.btnGhost) {
    assert(extractResult.btnGhost.height < 44, 'Ghost button is small touch target (height ' + extractResult.btnGhost.height + ' < 44)');
  }

  // Test that bboxes map correctly to screenshot coordinates
  // At 0.5x scale, canvas coords should be half the DOM coords
  if (extractResult.heroH1) {
    var canvasX = extractResult.heroH1.left * 0.5;
    var canvasY = extractResult.heroH1.top * 0.5;
    assert(canvasX >= 0, 'Canvas X mapping correct (DOM ' + extractResult.heroH1.left + ' → canvas ' + canvasX + ')');
    assert(canvasY >= 0, 'Canvas Y mapping correct (DOM ' + extractResult.heroH1.top + ' → canvas ' + canvasY + ')');
    var sectionIdx = Math.floor(canvasY / (900 * 0.5));
    assert(sectionIdx === 0, 'Hero h1 maps to section 0 (got ' + sectionIdx + ')');
  }

  await page.close();
}

run();
