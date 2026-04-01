#!/usr/bin/env node
// Test: domToCanvas mask rendering — headless Puppeteer
// Loads pages into an iframe, applies mask style, captures with domToCanvas,
// checks which elements render as black text and which render as invisible white.
// Tests with both synthetic HTML and real-world pages to isolate the cause.

var http = require('http');
var fs = require('fs');
var path = require('path');
var puppeteer = require('puppeteer');

var PORT = 8789;
var BASE = 'http://localhost:' + PORT;
var DOCS_DIR = path.resolve(__dirname, '..');
var passed = 0, failed = 0, skipped = 0;

function log(ok, msg) {
  if (ok === null) { skipped++; console.log('  \x1b[33m⊘\x1b[0m ' + msg); }
  else if (ok) { passed++; console.log('  \x1b[32m✓\x1b[0m ' + msg); }
  else { failed++; console.log('  \x1b[31m✗\x1b[0m ' + msg); }
}

// ---- Test pages ----

// Minimal: just text, no special CSS
var MINIMAL_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>' +
  '<p id="t1" style="color:#000">Simple paragraph</p>' +
  '<a id="t2" href="#" style="color:#000;text-decoration:none">Simple link</a>' +
  '<button id="t3" style="color:#000;background:none;border:none;font:inherit">Simple button</button>' +
  '</body></html>';

// Next.js error page pattern (exact reproduction)
var NEXTJS_ERROR_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
  '<style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif;margin:0;padding:0}</style>' +
  '</head><body>' +
  '<div id="__next">' +
  '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif;height:100vh;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
  '<div>' +
  '<style>body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}</style>' +
  '<h1 class="next-error-h1" id="t1" style="display:inline-block;margin:0 20px 0 0;padding:0 23px 0 0;font-size:24px;font-weight:500;vertical-align:top;line-height:49px">500</h1>' +
  '<div style="display:inline-block"><h2 id="t2" style="font-size:14px;font-weight:400;line-height:49px;margin:0">Application error: a client-side exception has occurred</h2></div>' +
  '</div></div></div></body></html>';

// Tailwind-like page with transitions
var TAILWIND_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
  '<style>' +
  '*, ::before, ::after { box-sizing: border-box; border-width: 0; border-style: solid; }' +
  'body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.5; }' +
  // Tailwind transition-colors utility
  '.transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(.4, 0, .2, 1); transition-duration: .15s; }' +
  '.text-white { color: #fff; } .text-black { color: #000; } .text-gray-400 { color: #9ca3af; }' +
  '.bg-gray-900 { background-color: #111827; } .bg-white { background-color: #fff; }' +
  '.font-bold { font-weight: 700; } .text-sm { font-size: 0.875rem; } .text-4xl { font-size: 2.25rem; }' +
  '.p-4 { padding: 1rem; } .p-12 { padding: 3rem; } .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; } .px-4 { padding-left: 1rem; padding-right: 1rem; }' +
  '.flex { display: flex; } .gap-4 { gap: 1rem; } .items-center { align-items: center; }' +
  '.sticky { position: sticky; } .top-0 { top: 0; } .z-50 { z-index: 50; }' +
  '.rounded { border-radius: 0.25rem; } .no-underline { text-decoration: none; }' +
  '</style></head><body>' +
  // Sticky nav with transition-colors links
  '<nav class="sticky top-0 z-50 bg-gray-900 p-4 flex gap-4 items-center">' +
    '<span id="t1" class="text-white font-bold">Brand</span>' +
    '<a id="t2" href="#" class="text-gray-400 no-underline transition-colors">About</a>' +
    '<a id="t3" href="#" class="text-gray-400 no-underline transition-colors">Features</a>' +
    '<button id="t4" class="text-white bg-gray-900 rounded py-2 px-4 transition-colors" style="border:none;font:inherit;cursor:pointer">CTA</button>' +
  '</nav>' +
  // Hero section
  '<section class="bg-gray-900 p-12">' +
    '<h1 id="t5" class="text-white text-4xl font-bold">Hero Heading</h1>' +
    '<p id="t6" class="text-gray-400">Hero description text</p>' +
  '</section>' +
  // Content section
  '<section class="bg-white p-12">' +
    '<h2 id="t7" class="text-black text-4xl">Content Heading</h2>' +
    '<p id="t8" class="text-black">Content paragraph</p>' +
    '<a id="t9" href="#" class="text-black no-underline transition-colors">Content link</a>' +
  '</section>' +
  // Footer
  '<footer class="bg-gray-900 p-4 flex gap-4">' +
    '<a id="t10" href="#" class="text-gray-400 no-underline text-sm transition-colors">Privacy</a>' +
    '<a id="t11" href="#" class="text-gray-400 no-underline text-sm transition-colors">Terms</a>' +
    '<a id="t12" href="#" class="text-gray-400 no-underline text-sm transition-colors">Contact</a>' +
  '</footer>' +
  '<div style="height:3000px"></div>' + // Force tall page
  '</body></html>';

// Page with multiple <style> blocks and @layer (modern CSS)
var MULTI_STYLE_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
  '<style>body { margin: 0; font-family: sans-serif; }</style>' +
  '<style>.heading { color: #000; font-size: 24px; font-weight: 700; }</style>' +
  '<style>.link { color: #2563eb; text-decoration: none; transition: color 0.15s; }</style>' +
  '<style>.btn { color: #fff; background: #2563eb; border: none; padding: 8px 16px; border-radius: 4px; font: inherit; cursor: pointer; transition: all 0.15s; }</style>' +
  '</head><body style="padding:20px">' +
  '<h1 id="t1" class="heading">Heading from style 2</h1>' +
  '<p id="t2" style="color:#000">Inline styled paragraph</p>' +
  '<a id="t3" href="#" class="link">Link from style 3</a>' +
  '<br><button id="t4" class="btn">Button from style 4</button>' +
  '<br><span id="t5" style="color:#000;font-weight:600">Inline span</span>' +
  '</body></html>';

var TEST_PAGES = [
  { name: 'Minimal', html: MINIMAL_HTML },
  { name: 'Next.js Error Page', html: NEXTJS_ERROR_HTML },
  { name: 'Tailwind Page', html: TAILWIND_HTML },
  { name: 'Multi Style Blocks', html: MULTI_STYLE_HTML },
];

// ---- Server ----
var testPageHtml = '';
function startServer() {
  var mimes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
  var server = http.createServer(function(req, res) {
    var url = req.url.split('?')[0];
    if (url === '/test-page') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(testPageHtml); return; }
    var filePath = path.join(DOCS_DIR, url);
    try { var data = fs.readFileSync(filePath); res.writeHead(200, { 'Content-Type': mimes[path.extname(filePath)] || 'application/octet-stream' }); res.end(data); }
    catch(e) { res.writeHead(404); res.end('Not found'); }
  });
  server.listen(PORT);
  return server;
}

// ---- Harness page ----
var HARNESS_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
  '<script src="https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js"></' + 'script>' +
  '</head><body>' +
  '<iframe id="testFrame" style="position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none"></iframe>' +
  '<iframe id="testFrameSrcdoc" style="position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none" sandbox="allow-scripts allow-same-origin"></iframe>' +
  '<script>' +
  'var MS = window.modernScreenshot;' +
  'var SCALE = 0.75;' +

  // Test via srcdoc (like the real analyzer)
  'window.runMaskTestSrcdoc = function(html) {' +
    'return new Promise(function(resolve) {' +
      'var iframe = document.getElementById("testFrameSrcdoc");' +
      'iframe.srcdoc = html;' +
      'iframe.onload = function() {' +
        'setTimeout(function() {' +
          'try {' +
            'var doc = iframe.contentDocument;' +
            'var results = { elements: [], canvasSize: null, mode: "srcdoc" };' +
            'var testEls = [];' +
            'for (var i = 1; i <= 20; i++) {' +
              'var el = doc.getElementById("t" + i);' +
              'if (el) testEls.push({ id: "t" + i, el: el });' +
            '}' +
            'testEls.forEach(function(te) {' +
              'var r = te.el.getBoundingClientRect();' +
              'te.bbox = { left: r.left, top: r.top, width: r.width, height: r.height };' +
              'te.text = te.el.textContent.substring(0, 30);' +
              'te.tag = te.el.tagName;' +
            '});' +
            // Apply mask directly (skip pass 1 for speed)
            'var maskStyle = doc.createElement("style");' +
            'maskStyle.textContent = "*, *::before, *::after { color: #fff !important; background-color: #fff !important; background-image: none !important; background: white !important; border-color: transparent !important; box-shadow: none !important; text-shadow: none !important; -webkit-text-fill-color: #fff !important; opacity: 1 !important; transition: none !important; animation: none !important; } img, svg, video, canvas { opacity: 0 !important; }";' +
            'doc.head.appendChild(maskStyle);' +
            'doc.querySelectorAll("*").forEach(function(el){ el.style.setProperty("transition","none","important"); });' +
            'testEls.forEach(function(te) {' +
              'te.el.style.setProperty("color", "#000", "important");' +
              'te.el.style.setProperty("-webkit-text-fill-color", "#000", "important");' +
            '});' +
            'doc.body.offsetHeight;' +
            'testEls.forEach(function(te) { te.postMaskColor = getComputedStyle(te.el).color; });' +
            'setTimeout(function() {' +
              'MS.domToCanvas(doc.documentElement, { scale: SCALE, timeout: 15000 }).then(function(c) {' +
                'results.canvasSize = c.width + "x" + c.height;' +
                'var ctx = c.getContext("2d", { willReadFrequently: true });' +
                'testEls.forEach(function(te) {' +
                  'var bx = Math.max(0, Math.round(te.bbox.left * SCALE));' +
                  'var by = Math.max(0, Math.round(te.bbox.top * SCALE));' +
                  'var bw = Math.min(Math.round(te.bbox.width * SCALE), c.width - bx);' +
                  'var bh = Math.min(Math.round(te.bbox.height * SCALE), c.height - by);' +
                  'if (bw < 2 || bh < 2) { results.elements.push({ id: te.id, text: te.text, tag: te.tag, dark: -1 }); return; }' +
                  'var px = ctx.getImageData(bx, by, bw, bh).data;' +
                  'var dk = 0; for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 200) dk++; }' +
                  'var ci = (Math.floor(bh/2)*bw+Math.floor(bw/2))*4;' +
                  'results.elements.push({ id: te.id, text: te.text, tag: te.tag, dark: dk, center: "rgb("+px[ci]+","+px[ci+1]+","+px[ci+2]+")", postColor: te.postMaskColor });' +
                '});' +
                'resolve(results);' +
              '}).catch(function(e) { resolve({ error: e.message, elements: [] }); });' +
            '}, 300);' +
          '} catch(e) { resolve({ error: e.message, elements: [] }); }' +
        '}, 1000);' +
      '};' +
    '});' +
  '};' +

  // Expose test function to Puppeteer (via src)
  'window.runMaskTest = function(url) {' +
    'return new Promise(function(resolve) {' +
      'var iframe = document.getElementById("testFrame");' +
      'iframe.src = url;' +
      'iframe.onload = function() {' +
        'setTimeout(function() {' +
          'var doc = iframe.contentDocument;' +
          'var results = { elements: [], canvasSize: null };' +

          // Find test elements
          'var testEls = [];' +
          'for (var i = 1; i <= 20; i++) {' +
            'var el = doc.getElementById("t" + i);' +
            'if (el) testEls.push({ id: "t" + i, el: el });' +
          '}' +

          // Collect bboxes
          'testEls.forEach(function(te) {' +
            'var r = te.el.getBoundingClientRect();' +
            'var cs = getComputedStyle(te.el);' +
            'te.bbox = { left: r.left, top: r.top, width: r.width, height: r.height };' +
            'te.text = te.el.textContent.substring(0, 30);' +
            'te.tag = te.el.tagName;' +
            'te.computedColor = cs.color;' +
            'te.computedDisplay = cs.display;' +
            'te.computedTransition = cs.transition;' +
          '});' +

          // Pass 1: As-is
          'MS.domToCanvas(doc.documentElement, { scale: SCALE, timeout: 15000 }).then(function(c1) {' +
            'var ctx1 = c1.getContext("2d", { willReadFrequently: true });' +
            'testEls.forEach(function(te) {' +
              'var bx = Math.max(0, Math.round(te.bbox.left * SCALE));' +
              'var by = Math.max(0, Math.round(te.bbox.top * SCALE));' +
              'var bw = Math.min(Math.round(te.bbox.width * SCALE), c1.width - bx);' +
              'var bh = Math.min(Math.round(te.bbox.height * SCALE), c1.height - by);' +
              'if (bw < 2 || bh < 2) { te.pass1 = -1; return; }' +
              'var px = ctx1.getImageData(bx, by, bw, bh).data;' +
              'var dk = 0; for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 200) dk++; }' +
              'te.pass1 = dk;' +
            '});' +

            // Apply mask style
            'var maskStyle = doc.createElement("style");' +
            'maskStyle.textContent = "*, *::before, *::after { color: #fff !important; background-color: #fff !important; background-image: none !important; background: white !important; border-color: transparent !important; box-shadow: none !important; text-shadow: none !important; -webkit-text-fill-color: #fff !important; opacity: 1 !important; transition: none !important; animation: none !important; } img, svg, video, canvas { opacity: 0 !important; }";' +
            'doc.head.appendChild(maskStyle);' +

            // Kill transitions on all elements
            'doc.querySelectorAll("*").forEach(function(el) {' +
              'el.style.setProperty("transition", "none", "important");' +
              'el.style.setProperty("animation", "none", "important");' +
            '});' +

            // Set target elements to black
            'testEls.forEach(function(te) {' +
              'te.el.style.setProperty("color", "#000", "important");' +
              'te.el.style.setProperty("-webkit-text-fill-color", "#000", "important");' +
            '});' +
            'doc.body.offsetHeight;' +

            // Log computed styles after mask
            'testEls.forEach(function(te) {' +
              'te.postMaskColor = getComputedStyle(te.el).color;' +
              'te.postMaskFill = getComputedStyle(te.el).webkitTextFillColor;' +
            '});' +

            // Wait for transitions to settle
            'setTimeout(function() {' +
              // Pass 2: Mask with pre-mask bboxes
              'MS.domToCanvas(doc.documentElement, { scale: SCALE, timeout: 15000 }).then(function(c2) {' +
                'results.canvasSize = c2.width + "x" + c2.height;' +
                'var ctx2 = c2.getContext("2d", { willReadFrequently: true });' +
                'testEls.forEach(function(te) {' +
                  'var bx = Math.max(0, Math.round(te.bbox.left * SCALE));' +
                  'var by = Math.max(0, Math.round(te.bbox.top * SCALE));' +
                  'var bw = Math.min(Math.round(te.bbox.width * SCALE), c2.width - bx);' +
                  'var bh = Math.min(Math.round(te.bbox.height * SCALE), c2.height - by);' +
                  'if (bw < 2 || bh < 2) { te.pass2 = -1; return; }' +
                  'var px = ctx2.getImageData(bx, by, bw, bh).data;' +
                  'var dk = 0; for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 200) dk++; }' +
                  'te.pass2 = dk;' +
                  // Sample center pixel
                  'var ci = (Math.floor(bh/2)*bw+Math.floor(bw/2))*4;' +
                  'te.centerPixel = "rgb("+px[ci]+","+px[ci+1]+","+px[ci+2]+")";' +
                '});' +

                // Build results
                'testEls.forEach(function(te) {' +
                  'results.elements.push({' +
                    'id: te.id, text: te.text, tag: te.tag,' +
                    'pass1Dark: te.pass1, pass2Dark: te.pass2,' +
                    'centerPixel: te.centerPixel,' +
                    'computedColor: te.computedColor,' +
                    'postMaskColor: te.postMaskColor,' +
                    'postMaskFill: te.postMaskFill,' +
                    'display: te.computedDisplay,' +
                    'transition: (te.computedTransition || "").substring(0, 50),' +
                    'bbox: te.bbox' +
                  '});' +
                '});' +
                'resolve(results);' +
              '}).catch(function(e) { resolve({ error: "pass2: " + e.message, elements: [] }); });' +
            '}, 300);' +
          '}).catch(function(e) { resolve({ error: "pass1: " + e.message, elements: [] }); });' +
        '}, 1000);' +
      '};' +
    '});' +
  '};' +
  '</' + 'script></body></html>';

// ---- Main ----
async function run() {
  var server = startServer();
  console.log('\n\x1b[1mdomToCanvas Mask Rendering Test (headless)\x1b[0m\n');

  var browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
  } catch(e) {
    console.log('\x1b[31mFailed to launch browser: ' + e.message + '\x1b[0m');
    console.log('Install puppeteer: npm install puppeteer');
    server.close();
    process.exit(1);
  }

  var page = await browser.newPage();

  // Load harness page
  testPageHtml = HARNESS_HTML;
  await page.goto(BASE + '/test-page', { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for modern-screenshot to load
  await page.waitForFunction('window.modernScreenshot && window.runMaskTest', { timeout: 10000 });

  for (var ti = 0; ti < TEST_PAGES.length; ti++) {
    var tp = TEST_PAGES[ti];
    console.log('\x1b[36m── ' + tp.name + ' ──\x1b[0m');

    // Serve the test page
    testPageHtml = tp.html;

    // Run the mask test
    var results;
    try {
      results = await page.evaluate(function(url) {
        return window.runMaskTest(url);
      }, BASE + '/test-page');
    } catch(e) {
      console.log('  \x1b[31mTest failed: ' + e.message + '\x1b[0m');
      continue;
    }

    if (results.error) {
      log(false, 'Error: ' + results.error);
      continue;
    }

    console.log('  Canvas: ' + results.canvasSize + ', Elements: ' + results.elements.length);

    results.elements.forEach(function(el) {
      var p1 = el.pass1Dark;
      var p2 = el.pass2Dark;
      var p1ok = p1 > 0;
      var p2ok = p2 > 0;

      if (p1ok && p2ok) {
        log(true, el.id + ' (' + el.tag + ') "' + el.text + '" — pass1:' + p1 + 'dk pass2:' + p2 + 'dk');
      } else if (p1ok && !p2ok) {
        // This is the bug: visible as-is but invisible after mask
        log(false, el.id + ' (' + el.tag + ') "' + el.text + '" — MASK BREAKS: pass1:' + p1 + 'dk pass2:0dk center=' + el.centerPixel +
          ' postColor=' + el.postMaskColor + ' postFill=' + el.postMaskFill +
          ' display=' + el.display + ' trans=' + el.transition);
      } else if (!p1ok && !p2ok) {
        log(null, el.id + ' (' + el.tag + ') "' + el.text + '" — not rendered in either pass (bbox issue?)');
      } else {
        log(true, el.id + ' (' + el.tag + ') "' + el.text + '" — pass1:' + p1 + 'dk pass2:' + p2 + 'dk (mask helped)');
      }
    });

    // === Also test via srcdoc (the way the real analyzer does it) ===
    console.log('\x1b[36m── ' + tp.name + ' (via srcdoc) ──\x1b[0m');
    var srcdocResults;
    try {
      srcdocResults = await page.evaluate(function(html) {
        return window.runMaskTestSrcdoc(html);
      }, tp.html);
    } catch(e) {
      console.log('  \x1b[31mSrcdoc test failed: ' + e.message + '\x1b[0m');
      continue;
    }

    if (srcdocResults.error) {
      log(false, 'Srcdoc error: ' + srcdocResults.error);
    } else {
      console.log('  Canvas: ' + srcdocResults.canvasSize + ', Elements: ' + srcdocResults.elements.length);
      srcdocResults.elements.forEach(function(el) {
        if (el.dark > 0) {
          log(true, el.id + ' (' + el.tag + ') "' + el.text + '" — ' + el.dark + 'dk');
        } else if (el.dark === 0) {
          log(false, el.id + ' (' + el.tag + ') "' + el.text + '" — SRCDOC FAIL: 0dk center=' + el.center + ' postColor=' + el.postColor);
        } else {
          log(null, el.id + ' (' + el.tag + ') "' + el.text + '" — too small');
        }
      });
    }
  }

  // === Test exact analyzer pipeline: screenshot THEN mask ===
  console.log('\n\x1b[36m── Pipeline Test: screenshot → mask (real tokenmade.ai via srcdoc) ──\x1b[0m');
  try {
    var realHtmlForPipeline = await page.evaluate(async function() {
      var proxies = ['https://api.allorigins.win/raw?url=', 'https://api.codetabs.com/v1/proxy?quest=', 'https://corsproxy.io/?'];
      for (var i = 0; i < proxies.length; i++) {
        try { var r = await fetch(proxies[i] + encodeURIComponent('https://www.tokenmade.ai/')); if (r.ok) { var t = await r.text(); if (t.length > 100) return t; } } catch(e) {}
      }
      return null;
    });
    if (realHtmlForPipeline) {
      var pipeResults = await page.evaluate(function(html) {
        return new Promise(function(resolve) {
          var iframe = document.getElementById('testFrameSrcdoc');
          iframe.srcdoc = html;
          iframe.onload = function() {
            setTimeout(function() {
              try {
                var doc = iframe.contentDocument;
                var MS = window.modernScreenshot;
                var SCALE = 0.75;
                var results = { elements: [] };

                // Find text elements
                var walker = doc.createTreeWalker(doc.body || doc.documentElement, 4, null, false);
                var node, testEls = [], idx = 0;
                while ((node = walker.nextNode()) && idx < 30) {
                  if (!node.textContent.trim()) continue;
                  var el = node.parentElement;
                  if (!el || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
                  var r = el.getBoundingClientRect();
                  if (r.width < 5 || r.height < 5) continue;
                  if (testEls.some(function(t) { return t.el === el; })) continue;
                  idx++;
                  testEls.push({ id: 'p' + idx, el: el, text: el.textContent.substring(0, 30).trim(), tag: el.tagName });
                }

                // Collect bboxes
                testEls.forEach(function(te) {
                  var r = te.el.getBoundingClientRect();
                  te.bbox = { left: r.left, top: r.top, width: r.width, height: r.height };
                });

                // === STEP 1: Mimic analyzer — set height:auto, overflow:visible ===
                doc.documentElement.style.cssText += 'height:auto !important;overflow-y:auto !important;';
                doc.body.style.cssText += 'height:auto !important;';
                doc.body.offsetHeight;

                // === STEP 2: Pre-scroll ===
                var vh = iframe.contentWindow.innerHeight || 900;
                var totalH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
                for (var s = 0; s < totalH; s += vh) { iframe.contentWindow.scrollTo(0, s); }
                iframe.contentWindow.scrollTo(0, 0);
                doc.documentElement.scrollTop = 0;

                // === STEP 3: Force-reveal hidden animations ===
                doc.querySelectorAll('*').forEach(function(el) {
                  var cs = getComputedStyle(el);
                  if (cs.opacity === '0' && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') {
                    var cls = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
                    if (cs.transition && cs.transition.indexOf('opacity') !== -1 || /fade|reveal|animate|aos/.test(cls)) {
                      el.style.cssText += ';opacity:1 !important;transform:none !important;transition:none !important;animation:none !important;';
                    }
                  }
                });

                // === STEP 4: Switch overflow to visible ===
                doc.documentElement.style.cssText += 'overflow:visible !important;';
                doc.body.style.cssText += 'overflow:visible !important;';
                doc.body.offsetHeight;

                setTimeout(function() {
                  // === STEP 5: First domToCanvas (screenshot) ===
                  MS.domToCanvas(doc.documentElement, { scale: SCALE, timeout: 15000 }).then(function(c1) {
                    results.screenshotSize = c1.width + 'x' + c1.height;

                    // === STEP 6: Apply mask style (AFTER screenshot) ===
                    doc.querySelectorAll('*').forEach(function(el) {
                      el.style.setProperty('transition-duration', '0s', 'important');
                      el.style.setProperty('transition', 'none', 'important');
                    });
                    doc.body.offsetHeight;

                    var maskStyle = doc.createElement('style');
                    maskStyle.textContent = '*, *::before, *::after { color: #fff !important; background-color: #fff !important; background-image: none !important; background: white !important; border-color: transparent !important; box-shadow: none !important; text-shadow: none !important; -webkit-text-fill-color: #fff !important; opacity: 1 !important; transition: none !important; animation: none !important; } img, svg, video, canvas { opacity: 0 !important; }';
                    doc.head.appendChild(maskStyle);
                    doc.body.offsetHeight;

                    // Set test elements to black
                    testEls.forEach(function(te) {
                      te.el.style.setProperty('color', '#000', 'important');
                      te.el.style.setProperty('-webkit-text-fill-color', '#000', 'important');
                      te.el.querySelectorAll('*').forEach(function(ch) {
                        ch.style.setProperty('color', '#000', 'important');
                        ch.style.setProperty('-webkit-text-fill-color', '#000', 'important');
                      });
                    });
                    doc.body.offsetHeight;

                    // === STEP 7: Second domToCanvas (mask) ===
                    MS.domToCanvas(doc.documentElement, { scale: SCALE, timeout: 15000 }).then(function(c2) {
                      results.maskSize = c2.width + 'x' + c2.height;
                      var ctx = c2.getContext('2d', { willReadFrequently: true });

                      testEls.forEach(function(te) {
                        var bx = Math.max(0, Math.round(te.bbox.left * SCALE));
                        var by = Math.max(0, Math.round(te.bbox.top * SCALE));
                        var bw = Math.min(Math.round(te.bbox.width * SCALE), c2.width - bx);
                        var bh = Math.min(Math.round(te.bbox.height * SCALE), c2.height - by);
                        if (bw < 2 || bh < 2) { results.elements.push({ id: te.id, text: te.text, tag: te.tag, dark: -1 }); return; }
                        var px = ctx.getImageData(bx, by, bw, bh).data;
                        var dk = 0; for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 200) dk++; }
                        var ci = (Math.floor(bh/2)*bw+Math.floor(bw/2))*4;
                        var postColor = getComputedStyle(te.el).color;
                        results.elements.push({ id: te.id, text: te.text, tag: te.tag, dark: dk, center: 'rgb('+px[ci]+','+px[ci+1]+','+px[ci+2]+')', postColor: postColor });
                      });
                      resolve(results);
                    }).catch(function(e) { resolve({ error: 'mask capture: ' + e.message }); });
                  }).catch(function(e) { resolve({ error: 'screenshot: ' + e.message }); });
                }, 800);
              } catch(e) { resolve({ error: e.message }); }
            }, 2000);
          };
        });
      }, realHtmlForPipeline);

      if (pipeResults.error) {
        log(false, 'Pipeline error: ' + pipeResults.error);
      } else {
        console.log('  Screenshot: ' + pipeResults.screenshotSize + ', Mask: ' + pipeResults.maskSize + ', Elements: ' + pipeResults.elements.length);
        var pipeBreaks = 0;
        pipeResults.elements.forEach(function(el) {
          if (el.dark > 0) {
            log(true, el.id + ' (' + el.tag + ') "' + el.text + '" — ' + el.dark + 'dk');
          } else if (el.dark === 0) {
            pipeBreaks++;
            log(false, el.id + ' (' + el.tag + ') "' + el.text + '" — PIPELINE FAIL: 0dk center=' + el.center + ' postColor=' + el.postColor);
          }
        });
        if (pipeBreaks > 0) console.log('  \x1b[31m' + pipeBreaks + ' elements broken by pipeline!\x1b[0m');
        else console.log('  \x1b[32mPipeline test passed!\x1b[0m');
      }
    }
  } catch(e) {
    console.log('  \x1b[33mPipeline test error: ' + e.message + '\x1b[0m');
  }

  // Try with real URL if accessible
  console.log('\n\x1b[36m── Real URL Test (tokenmade.ai) ──\x1b[0m');
  try {
    var realHtml = await page.evaluate(async function() {
      var proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://corsproxy.io/?'
      ];
      var url = 'https://www.tokenmade.ai/';
      for (var i = 0; i < proxies.length; i++) {
        try {
          var r = await fetch(proxies[i] + encodeURIComponent(url));
          if (r.ok) { var t = await r.text(); if (t.length > 100) return t; }
        } catch(e) {}
      }
      return null;
    });

    if (realHtml) {
      console.log('  Fetched ' + realHtml.length + ' chars');
      testPageHtml = realHtml;
      // Add test IDs to elements we can find
      testPageHtml = realHtml.replace(/<body/i, '<body data-milg-test="1"');

      var realResults = await page.evaluate(function(url) {
        return new Promise(function(resolve) {
          var iframe = document.getElementById('testFrame');
          iframe.src = url;
          iframe.onload = function() {
            setTimeout(function() {
              var doc = iframe.contentDocument;
              // Find text elements
              var walker = doc.createTreeWalker(doc.body || doc.documentElement, 4 /* SHOW_TEXT */, null, false);
              var node, testEls = [], idx = 0;
              while ((node = walker.nextNode()) && idx < 30) {
                if (!node.textContent.trim()) continue;
                var el = node.parentElement;
                if (!el || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
                var r = el.getBoundingClientRect();
                if (r.width < 5 || r.height < 5) continue;
                if (testEls.some(function(t) { return t.el === el; })) continue;
                idx++;
                el.id = el.id || ('rt' + idx);
                testEls.push({ id: el.id, el: el });
              }

              var results = { elements: [], canvasSize: null, elementCount: testEls.length };

              // Collect info
              testEls.forEach(function(te) {
                var r = te.el.getBoundingClientRect();
                te.bbox = { left: r.left, top: r.top, width: r.width, height: r.height };
                te.text = te.el.textContent.substring(0, 30).trim();
                te.tag = te.el.tagName;
                te.computedColor = getComputedStyle(te.el).color;
                te.computedDisplay = getComputedStyle(te.el).display;
                te.computedTransition = getComputedStyle(te.el).transition;
              });

              var MS = window.modernScreenshot;
              var SCALE = 0.75;

              // Pass 1
              MS.domToCanvas(doc.documentElement, { scale: SCALE, timeout: 15000 }).then(function(c1) {
                var ctx1 = c1.getContext('2d', { willReadFrequently: true });
                testEls.forEach(function(te) {
                  var bx = Math.max(0, Math.round(te.bbox.left * SCALE));
                  var by = Math.max(0, Math.round(te.bbox.top * SCALE));
                  var bw = Math.min(Math.round(te.bbox.width * SCALE), c1.width - bx);
                  var bh = Math.min(Math.round(te.bbox.height * SCALE), c1.height - by);
                  if (bw < 2 || bh < 2) { te.pass1 = -1; return; }
                  var px = ctx1.getImageData(bx, by, bw, bh).data;
                  var dk = 0; for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 200) dk++; }
                  te.pass1 = dk;
                });

                // Apply mask
                var maskStyle = doc.createElement('style');
                maskStyle.textContent = '*, *::before, *::after { color: #fff !important; background-color: #fff !important; background-image: none !important; background: white !important; border-color: transparent !important; box-shadow: none !important; text-shadow: none !important; -webkit-text-fill-color: #fff !important; opacity: 1 !important; transition: none !important; animation: none !important; } img, svg, video, canvas { opacity: 0 !important; }';
                doc.head.appendChild(maskStyle);
                doc.querySelectorAll('*').forEach(function(el) { el.style.setProperty('transition', 'none', 'important'); });
                testEls.forEach(function(te) {
                  te.el.style.setProperty('color', '#000', 'important');
                  te.el.style.setProperty('-webkit-text-fill-color', '#000', 'important');
                });
                doc.body.offsetHeight;

                testEls.forEach(function(te) {
                  te.postMaskColor = getComputedStyle(te.el).color;
                });

                setTimeout(function() {
                  MS.domToCanvas(doc.documentElement, { scale: SCALE, timeout: 15000 }).then(function(c2) {
                    results.canvasSize = c2.width + 'x' + c2.height;
                    var ctx2 = c2.getContext('2d', { willReadFrequently: true });
                    testEls.forEach(function(te) {
                      var bx = Math.max(0, Math.round(te.bbox.left * SCALE));
                      var by = Math.max(0, Math.round(te.bbox.top * SCALE));
                      var bw = Math.min(Math.round(te.bbox.width * SCALE), c2.width - bx);
                      var bh = Math.min(Math.round(te.bbox.height * SCALE), c2.height - by);
                      if (bw < 2 || bh < 2) { te.pass2 = -1; return; }
                      var px = ctx2.getImageData(bx, by, bw, bh).data;
                      var dk = 0; for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 200) dk++; }
                      te.pass2 = dk;
                      var ci = (Math.floor(bh/2)*bw+Math.floor(bw/2))*4;
                      te.centerPixel = 'rgb('+px[ci]+','+px[ci+1]+','+px[ci+2]+')';
                    });

                    testEls.forEach(function(te) {
                      results.elements.push({
                        id: te.id, text: te.text, tag: te.tag,
                        pass1Dark: te.pass1, pass2Dark: te.pass2,
                        centerPixel: te.centerPixel,
                        computedColor: te.computedColor,
                        postMaskColor: te.postMaskColor,
                        display: te.computedDisplay,
                        transition: (te.computedTransition || '').substring(0, 50),
                      });
                    });
                    resolve(results);
                  }).catch(function(e) { resolve({ error: 'pass2: ' + e.message, elements: [] }); });
                }, 500);
              }).catch(function(e) { resolve({ error: 'pass1: ' + e.message, elements: [] }); });
            }, 2000);
          };
        });
      }, BASE + '/test-page');

      if (realResults.error) {
        log(false, 'Error: ' + realResults.error);
      } else {
        console.log('  Canvas: ' + realResults.canvasSize + ', Elements: ' + (realResults.elementCount || realResults.elements.length));
        var maskBreaks = 0;
        realResults.elements.forEach(function(el) {
          var p1ok = el.pass1Dark > 0;
          var p2ok = el.pass2Dark > 0;
          if (p1ok && !p2ok) {
            maskBreaks++;
            log(false, el.id + ' (' + el.tag + ') "' + el.text + '" — MASK BREAKS: pass1:' + el.pass1Dark + 'dk pass2:0dk center=' + el.centerPixel +
              ' postColor=' + el.postMaskColor + ' display=' + el.display + ' trans=' + el.transition);
          } else if (p1ok && p2ok) {
            log(true, el.id + ' (' + el.tag + ') "' + el.text + '" — OK');
          }
        });
        if (maskBreaks === 0) {
          console.log('  \x1b[32mNo mask rendering issues detected on real page\x1b[0m');
        } else {
          console.log('  \x1b[31m' + maskBreaks + ' elements broken by mask style!\x1b[0m');
        }
      }
    } else {
      console.log('  \x1b[33mCould not fetch real page (proxy blocked)\x1b[0m');
    }
  } catch(e) {
    console.log('  \x1b[33mReal URL test skipped: ' + e.message + '\x1b[0m');
  }

  console.log('\n\x1b[1mResults: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped\x1b[0m');

  await browser.close();
  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(function(e) { console.error(e); process.exit(1); });
