#!/usr/bin/env node
// Test: Find ALL heading-in-container patterns that trigger the modern-screenshot domToCanvas bug.
// Known trigger: <div><h3>Text</h3></div> as sole child + white mask breaks subsequent element rendering.

var http = require('http');
var path = require('path');
var puppeteer = require('puppeteer');

var PORT = 8791;
var BASE = 'http://localhost:' + PORT;
var testPageHtml = '';

function startServer() {
  var server = http.createServer(function(req, res) {
    var url = req.url.split('?')[0];
    if (url === '/test-page') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(testPageHtml); return; }
    res.writeHead(404); res.end('Not found');
  });
  server.listen(PORT);
  return server;
}

// Build a test HTML page with a pattern before a target element
function buildHtml(patternHtml, complex) {
  if (complex) {
    // Simulate a real-world page with CSS transitions, transforms, font stacks, etc.
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
      'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;margin:0;padding:20px;line-height:1.5;}' +
      'h1,h2,h3,h4,h5,h6{margin:0 0 0.5em;font-weight:700;}' +
      '.nav{display:flex;gap:16px;padding:12px 20px;background:#1a1a2e;color:#fff;align-items:center;}' +
      '.nav a{color:#eee;text-decoration:none;transition:color 0.3s,transform 0.2s;}' +
      '.nav a:hover{color:#fff;transform:translateY(-1px);}' +
      '.hero{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:60px 20px;color:#fff;text-align:center;}' +
      '.card{border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:10px;box-shadow:0 1px 3px rgba(0,0,0,0.1);transition:box-shadow 0.3s,transform 0.2s;}' +
      '.card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.15);transform:translateY(-2px);}' +
      '.btn{display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;border-radius:6px;border:none;cursor:pointer;transition:background 0.2s;}' +
      '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0;}' +
      '</style></head><body>' +
      '<nav class="nav"><a href="#">Home</a><a href="#">About</a><a href="#">Contact</a></nav>' +
      '<div class="hero"><h1>Hero Title</h1><p>Subtitle text goes here</p><button class="btn">Call to Action</button></div>' +
      '<div class="grid">' +
      '<div class="card"><h3>Card One</h3><p>Description</p></div>' +
      '<div class="card">' + patternHtml + '</div>' +
      '<div class="card"><h3>Card Three</h3><p>Description</p></div>' +
      '</div>' +
      '<section style="padding:20px;"><h2>Section Below</h2>' +
      '<div id="target" style="margin-top:20px;padding:10px;">Target text</div>' +
      '</section>' +
      '</body></html>';
  }
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>' +
    patternHtml +
    '<div id="target" style="margin-top:20px;padding:10px;">Target text</div>' +
    '</body></html>';
}

// The harness: loads modern-screenshot, provides testPattern function
// Mode A: simple mask+black+capture
// Mode B: screenshot-first (like real analyzer pipeline) then mask+black+capture
var HARNESS = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
  '<script src="https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js"></' + 'script>' +
  '</head><body><div id="log"></div>' +
  '<script>' +
  'var MS = window.modernScreenshot;' +

  // opts.screenshotFirst = true: do a domToCanvas capture BEFORE masking (like real analyzer)
  // opts.killTransitions = true: kill transitions before mask
  // opts.complexPage = true: inject a complex page around the pattern
  'window.testPattern = function(html, opts) {' +
    'opts = opts || {};' +
    'return new Promise(function(resolve) {' +
      'var existing = document.getElementById("tf");' +
      'if (existing) existing.parentNode.removeChild(existing);' +
      'var iframe = document.createElement("iframe");' +
      'iframe.id = "tf";' +
      'iframe.style.cssText = "position:fixed;top:0;left:0;width:800px;height:600px;border:none;";' +
      'iframe.sandbox = "allow-scripts allow-same-origin";' +
      'document.body.appendChild(iframe);' +
      'iframe.srcdoc = html;' +
      'iframe.onload = function() {' +
        'setTimeout(function() {' +
          'try { _doTest(iframe, opts, resolve); }' +
          'catch(e) { resolve({ error: e.message }); }' +
        '}, 500);' +
      '};' +
    '});' +
  '};' +

  'function _doTest(iframe, opts, resolve) {' +
    'var doc = iframe.contentDocument;' +
    'var target = doc.getElementById("target");' +
    'if (!target) { resolve({ error: "no target element" }); return; }' +

    // Get target bbox before mask
    'var r = target.getBoundingClientRect();' +
    'var bbox = { left: r.left, top: r.top, width: r.width, height: r.height };' +

    'function doMaskAndCapture() {' +
      // Kill transitions
      'if (opts.killTransitions) {' +
        'doc.querySelectorAll("*").forEach(function(el) {' +
          'el.style.setProperty("transition-duration", "0s", "important");' +
          'el.style.setProperty("transition", "none", "important");' +
        '});' +
        'doc.body.offsetHeight;' +
      '}' +

      // Apply mask: everything white
      'var ms = doc.createElement("style");' +
      'ms.textContent = "*,*::before,*::after{color:#fff !important;background-color:#fff !important;background-image:none !important;background:white !important;border-color:transparent !important;box-shadow:none !important;text-shadow:none !important;outline-color:transparent !important;-webkit-text-fill-color:#fff !important;opacity:1 !important;transition:none !important;animation:none !important;}img,svg,video,canvas,picture,iframe{opacity:0 !important;}";' +
      'doc.head.appendChild(ms);' +
      'doc.body.offsetHeight;' +

      // Set target to black
      'target.style.setProperty("color", "#000", "important");' +
      'target.style.setProperty("-webkit-text-fill-color", "#000", "important");' +
      'doc.body.offsetHeight;' +

      // Verify computed color is black
      'var computedColor = getComputedStyle(target).color;' +

      // domToCanvas capture (mask capture)
      'MS.domToCanvas(doc.documentElement, { scale: 1, timeout: 10000 }).then(function(canvas) {' +
        'var ctx = canvas.getContext("2d", { willReadFrequently: true });' +
        'var bx = Math.max(0, Math.round(bbox.left));' +
        'var by = Math.max(0, Math.round(bbox.top));' +
        'var bw = Math.min(Math.round(bbox.width), canvas.width - bx);' +
        'var bh = Math.min(Math.round(bbox.height), canvas.height - by);' +
        'if (bw < 2 || bh < 2) { resolve({ error: "bbox too small", bw: bw, bh: bh }); return; }' +
        'var px = ctx.getImageData(bx, by, bw, bh).data;' +
        'var darkPixels = 0;' +
        'for (var i = 0; i < px.length; i += 4) {' +
          'if ((px[i] + px[i+1] + px[i+2]) / 3 < 128) darkPixels++;' +
        '}' +
        // Sample center pixel
        'var ci = (Math.floor(bh/2) * bw + Math.floor(bw/2)) * 4;' +
        'var centerRgb = "rgb(" + px[ci] + "," + px[ci+1] + "," + px[ci+2] + ")";' +
        'resolve({ darkPixels: darkPixels, totalPixels: bw*bh, centerRgb: centerRgb, computedColor: computedColor, canvasSize: canvas.width+"x"+canvas.height });' +
      '}).catch(function(e) { resolve({ error: "domToCanvas: " + e.message }); });' +
    '}' +

    // If screenshotFirst, do an initial domToCanvas before masking
    'if (opts.screenshotFirst) {' +
      'MS.domToCanvas(doc.documentElement, { scale: 1, timeout: 10000 }).then(function(fc) {' +
        'try { fc.toDataURL("image/webp", 0.85); } catch(e) {}' +
        'setTimeout(doMaskAndCapture, 100);' +
      '}).catch(function(e) { resolve({ error: "screenshotFirst: " + e.message }); });' +
    '} else {' +
      'doMaskAndCapture();' +
    '}' +
  '}' +
  '</' + 'script></body></html>';

// ============================================
// Test case definitions
// ============================================

var testCases = [];

// Category 1: All heading levels as sole child of div
['h1','h2','h3','h4','h5','h6'].forEach(function(tag) {
  testCases.push({
    name: tag.toUpperCase() + ' sole child of DIV',
    category: '1-heading-in-div',
    html: '<div><' + tag + '>Heading text</' + tag + '></div>'
  });
});

// Category 2: All heading levels as sole child of other containers
var containers = ['section','article','aside','nav','main','header','footer','li','details','figure','figcaption','blockquote','fieldset'];
['h2','h3'].forEach(function(htag) {
  containers.forEach(function(ctag) {
    var inner = '<' + htag + '>Heading text</' + htag + '>';
    // Some elements need special wrapping
    var wrapper = '<' + ctag + '>' + inner + '</' + ctag + '>';
    if (ctag === 'li') wrapper = '<ul>' + wrapper + '</ul>';
    if (ctag === 'details') wrapper = '<details open><summary>Summary</summary>' + inner + '</details>';
    testCases.push({
      name: htag.toUpperCase() + ' sole child of ' + ctag.toUpperCase(),
      category: '2-heading-in-container',
      html: wrapper
    });
  });
});

// Category 2b: td/th
['td','th'].forEach(function(ctag) {
  testCases.push({
    name: 'H3 sole child of ' + ctag.toUpperCase(),
    category: '2-heading-in-container',
    html: '<table><tr><' + ctag + '><h3>Heading text</h3></' + ctag + '></tr></table>'
  });
});

// Category 3: Heading with siblings (should pass)
var siblings = [
  { name: 'H3 + SPAN sibling', html: '<div><h3>Heading</h3><span>Sibling</span></div>' },
  { name: 'H3 + BR sibling', html: '<div><h3>Heading</h3><br></div>' },
  { name: 'H3 + DIV sibling', html: '<div><h3>Heading</h3><div>Sibling</div></div>' },
  { name: 'H3 + P sibling', html: '<div><h3>Heading</h3><p>Paragraph</p></div>' },
  { name: 'H3 + H4 sibling', html: '<div><h3>Heading</h3><h4>Sub</h4></div>' },
  { name: 'SPAN + H3 (heading not first)', html: '<div><span>Before</span><h3>Heading</h3></div>' },
  { name: 'H3 + text node sibling', html: '<div><h3>Heading</h3>Some loose text</div>' },
];
siblings.forEach(function(s) {
  testCases.push({ name: s.name, category: '3-with-siblings', html: s.html });
});

// Category 4: Empty heading as sole child (should pass)
testCases.push({ name: 'Empty H3 sole child', category: '4-empty-heading', html: '<div><h3></h3></div>' });
testCases.push({ name: 'H3 with only whitespace', category: '4-empty-heading', html: '<div><h3>   </h3></div>' });
testCases.push({ name: 'H3 with &nbsp;', category: '4-empty-heading', html: '<div><h3>&nbsp;</h3></div>' });

// Category 5: Non-heading block elements as sole child
var blockEls = ['p','div','blockquote','pre','ul','ol','dl','table','form','address'];
blockEls.forEach(function(tag) {
  var inner;
  if (tag === 'ul' || tag === 'ol') inner = '<' + tag + '><li>Item</li></' + tag + '>';
  else if (tag === 'dl') inner = '<dl><dt>Term</dt><dd>Def</dd></dl>';
  else if (tag === 'table') inner = '<table><tr><td>Cell</td></tr></table>';
  else if (tag === 'form') inner = '<form><input type="text" value="test"></form>';
  else inner = '<' + tag + '>Block content</' + tag + '>';
  testCases.push({
    name: tag.toUpperCase() + ' sole child of DIV',
    category: '5-non-heading-block',
    html: '<div>' + inner + '</div>'
  });
});

// Category 6: Multiple headings in sequence
testCases.push({ name: '3x DIV>H3 in sequence', category: '6-multiple-headings', html: '<div><h3>A</h3></div><div><h3>B</h3></div><div><h3>C</h3></div>' });
testCases.push({ name: 'H2 + H3 + H4 each wrapped', category: '6-multiple-headings', html: '<div><h2>A</h2></div><div><h3>B</h3></div><div><h4>C</h4></div>' });
testCases.push({ name: 'H3 siblings (no wrapper)', category: '6-multiple-headings', html: '<h3>A</h3><h3>B</h3><h3>C</h3>' });

// Category 7: Whitespace-only text vs real text
testCases.push({ name: 'H3 with real text in DIV', category: '7-text-variations', html: '<div><h3>Real text here</h3></div>' });
testCases.push({ name: 'H3 with single char in DIV', category: '7-text-variations', html: '<div><h3>X</h3></div>' });
testCases.push({ name: 'H3 with very long text in DIV', category: '7-text-variations', html: '<div><h3>This is a much longer heading that spans multiple words and might wrap to the next line</h3></div>' });
testCases.push({ name: 'H3 with inline child in DIV', category: '7-text-variations', html: '<div><h3><span>Span inside</span></h3></div>' });
testCases.push({ name: 'H3 with link child in DIV', category: '7-text-variations', html: '<div><h3><a href="#">Link heading</a></h3></div>' });
testCases.push({ name: 'H3 with strong child in DIV', category: '7-text-variations', html: '<div><h3><strong>Bold heading</strong></h3></div>' });

// Category 8: Bare headings (no wrapper) — control
['h1','h2','h3','h4','h5','h6'].forEach(function(tag) {
  testCases.push({
    name: 'Bare ' + tag.toUpperCase() + ' (no wrapper)',
    category: '8-bare-heading',
    html: '<' + tag + '>Heading text</' + tag + '>'
  });
});

// Category 9: Nested wrappers
testCases.push({ name: 'DIV>DIV>H3 (deeply nested)', category: '9-nested', html: '<div><div><h3>Deep</h3></div></div>' });
testCases.push({ name: 'SECTION>DIV>H3', category: '9-nested', html: '<section><div><h3>Nested</h3></div></section>' });
testCases.push({ name: 'DIV>SECTION>H3', category: '9-nested', html: '<div><section><h3>Nested</h3></section></div>' });

// Category 10: Styled containers
testCases.push({ name: 'DIV(flex)>H3', category: '10-styled', html: '<div style="display:flex"><h3>Flex child</h3></div>' });
testCases.push({ name: 'DIV(grid)>H3', category: '10-styled', html: '<div style="display:grid"><h3>Grid child</h3></div>' });
testCases.push({ name: 'DIV(inline-block)>H3', category: '10-styled', html: '<div style="display:inline-block"><h3>Inline-block child</h3></div>' });
testCases.push({ name: 'DIV(position:relative)>H3', category: '10-styled', html: '<div style="position:relative"><h3>Relative child</h3></div>' });
testCases.push({ name: 'DIV(overflow:hidden)>H3', category: '10-styled', html: '<div style="overflow:hidden"><h3>Overflow child</h3></div>' });

// Test modes: each mode adds more real-world conditions
var TEST_MODES = [
  { name: 'A: simple mask', opts: {} },
  { name: 'B: screenshot-first + mask', opts: { screenshotFirst: true } },
  { name: 'C: screenshot-first + killTransitions + mask', opts: { screenshotFirst: true, killTransitions: true } },
];

async function runMode(page, modeName, opts, cases, useComplex) {
  var results = [];
  var currentCategory = '';
  var passCount = 0, failCount = 0, errorCount = 0;

  console.log('\x1b[1;36m========== MODE: ' + modeName + (useComplex ? ' (complex page)' : ' (simple page)') + ' ==========\x1b[0m\n');

  for (var i = 0; i < cases.length; i++) {
    var tc = cases[i];

    if (tc.category !== currentCategory) {
      currentCategory = tc.category;
      console.log('\x1b[1m--- ' + currentCategory + ' ---\x1b[0m');
    }

    var html = buildHtml(tc.html, useComplex);
    var result;
    try {
      result = await page.evaluate(function(h, o) {
        return window.testPattern(h, o);
      }, html, opts);
    } catch(e) {
      result = { error: 'evaluate: ' + e.message };
    }

    var status;
    if (result.error) {
      status = 'ERROR';
      errorCount++;
      console.log('  \x1b[33m? ' + tc.name + ' — ERROR: ' + result.error + '\x1b[0m');
    } else if (result.darkPixels > 0) {
      status = 'PASS';
      passCount++;
      console.log('  \x1b[32m+ ' + tc.name + ' — dark=' + result.darkPixels + '\x1b[0m');
    } else {
      status = 'FAIL';
      failCount++;
      console.log('  \x1b[31mX ' + tc.name + ' — dark=0 center=' + result.centerRgb + ' computed=' + result.computedColor + '\x1b[0m');
    }

    results.push({
      name: tc.name,
      category: tc.category,
      mode: modeName,
      complex: useComplex,
      status: status,
      darkPixels: result.darkPixels || 0,
      centerRgb: result.centerRgb || '',
      error: result.error || ''
    });
  }

  console.log('\n  => PASS: ' + passCount + '  FAIL: ' + failCount + '  ERROR: ' + errorCount + '\n');
  return results;
}

async function run() {
  var server = startServer();
  console.log('\n\x1b[1m=== Heading Pattern Bug Test (modern-screenshot domToCanvas) ===\x1b[0m');
  console.log('Total patterns: ' + testCases.length);
  console.log('Test modes: ' + TEST_MODES.length + ' modes x 2 page types = ' + (TEST_MODES.length * 2) + ' runs');
  console.log('Total individual tests: ' + (testCases.length * TEST_MODES.length * 2) + '\n');

  var browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  var page = await browser.newPage();

  // Load harness
  testPageHtml = HARNESS;
  await page.goto(BASE + '/test-page', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction('window.modernScreenshot && window.testPattern', { timeout: 15000 });
  console.log('Harness loaded, modern-screenshot ready.\n');

  var allResults = [];

  for (var m = 0; m < TEST_MODES.length; m++) {
    var mode = TEST_MODES[m];
    // Simple page
    var simpleResults = await runMode(page, mode.name, mode.opts, testCases, false);
    allResults = allResults.concat(simpleResults);
    // Complex page
    var complexResults = await runMode(page, mode.name, mode.opts, testCases, true);
    allResults = allResults.concat(complexResults);
  }

  // Grand summary
  console.log('\x1b[1m=== GRAND SUMMARY ===\x1b[0m\n');

  var allFails = allResults.filter(function(r) { return r.status === 'FAIL'; });
  var allErrors = allResults.filter(function(r) { return r.status === 'ERROR'; });
  var allPasses = allResults.filter(function(r) { return r.status === 'PASS'; });

  console.log('Total: ' + allResults.length + '  PASS: ' + allPasses.length + '  FAIL: ' + allFails.length + '  ERROR: ' + allErrors.length + '\n');

  if (allFails.length > 0) {
    console.log('\x1b[1;31m=== ALL FAILURES ===\x1b[0m\n');
    var col1 = 50, col2 = 40, col3 = 10;
    console.log(pad('Pattern', col1) + pad('Mode + Page', col2) + pad('Dark px', col3));
    console.log('-'.repeat(col1 + col2 + col3));
    allFails.forEach(function(f) {
      var pageType = f.complex ? 'complex' : 'simple';
      console.log('\x1b[31m' + pad(f.name, col1) + pad(f.mode + ' (' + pageType + ')', col2) + pad(String(f.darkPixels), col3) + '\x1b[0m');
    });

    // Unique failing patterns
    var failNames = {};
    allFails.forEach(function(f) { failNames[f.name] = true; });
    console.log('\n\x1b[1;31mUnique failing patterns: ' + Object.keys(failNames).length + '\x1b[0m');
    Object.keys(failNames).forEach(function(n) {
      var modes = allFails.filter(function(f) { return f.name === n; }).map(function(f) { return f.mode + (f.complex ? ' (complex)' : ' (simple)'); });
      console.log('  X ' + n + '  => fails in: ' + modes.join(', '));
    });
  } else {
    console.log('\x1b[32mNo failures in any mode or page type.\x1b[0m');
    console.log('The heading-in-container pattern alone (even with screenshot-first) does NOT trigger the bug.');
    console.log('The bug likely requires interaction with specific real-world CSS/DOM conditions not covered by these synthetic tests.');
  }

  if (allErrors.length > 0) {
    console.log('\n\x1b[33m=== ERRORS ===\x1b[0m');
    allErrors.forEach(function(e) {
      console.log('  ? ' + e.name + ' [' + e.mode + '] ' + e.error);
    });
  }

  console.log('\n\x1b[1mDone.\x1b[0m');
  await browser.close();
  server.close();
}

function pad(s, n) {
  if (s.length >= n) return s.substring(0, n);
  return s + ' '.repeat(n - s.length);
}

run().catch(function(e) { console.error(e); process.exit(1); });
