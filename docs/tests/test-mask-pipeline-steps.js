#!/usr/bin/env node
// Test: Incrementally rebuild the analyzer mask pipeline to find the breaking step.
// Approach 1: Start clean, add steps one at a time → find when it breaks
// Approach 2: If approach 1 doesn't find it, start with full flow, remove steps → find minimum failing state

var http = require('http');
var fs = require('fs');
var path = require('path');
var puppeteer = require('puppeteer');

var PORT = 8790;
var BASE = 'http://localhost:' + PORT;
var DOCS_DIR = path.resolve(__dirname, '..');
var SCALE = 0.75;

// Known failing elements from the analyzer logs
var KNOWN_FAILS = ['Token', 'Über uns', 'Details', 'Gastgeber', 'EN', 'DE', 'Jetzt bewerben', 'TokenMade'];

var testPageHtml = '';
function startServer() {
  var server = http.createServer(function(req, res) {
    var url = req.url.split('?')[0];
    if (url === '/test-page') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(testPageHtml); return; }
    var filePath = path.join(DOCS_DIR, url);
    try { var data = fs.readFileSync(filePath); res.writeHead(200, { 'Content-Type': (path.extname(filePath) === '.js' ? 'application/javascript' : 'text/html') }); res.end(data); }
    catch(e) { res.writeHead(404); res.end('Not found'); }
  });
  server.listen(PORT);
  return server;
}

// Fetch real page HTML
async function fetchRealPage(page) {
  return await page.evaluate(async function() {
    var proxies = ['https://api.allorigins.win/raw?url=', 'https://api.codetabs.com/v1/proxy?quest=', 'https://corsproxy.io/?'];
    for (var i = 0; i < proxies.length; i++) {
      try { var r = await fetch(proxies[i] + encodeURIComponent('https://www.tokenmade.ai/')); if (r.ok) { var t = await r.text(); if (t.length > 100) return t; } } catch(e) {}
    }
    return null;
  });
}

// The harness page loads modern-screenshot and provides test functions
var HARNESS = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
  '<script src="https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js"></' + 'script>' +
  '</head><body><div id="log"></div>' +
  '<script>' +
  'var MS = window.modernScreenshot;' +
  'var SC = ' + SCALE + ';' +

  // Core function: load HTML in srcdoc iframe, apply steps, capture mask, check elements
  'window.testPipeline = function(html, steps) {' +
    'return new Promise(function(resolve) {' +
      'var existing = document.getElementById("tf");' +
      'if (existing) existing.parentNode.removeChild(existing);' +
      'var iframe = document.createElement("iframe");' +
      'iframe.id = "tf";' +
      'iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;";' +
      'iframe.sandbox = "allow-scripts allow-same-origin";' +
      'document.body.appendChild(iframe);' +
      'iframe.srcdoc = html;' +
      'iframe.onload = function() {' +
        'setTimeout(function() {' +
          'try { _runSteps(iframe, steps, resolve); }' +
          'catch(e) { resolve({ error: e.message }); }' +
        '}, 1500);' + // wait for page to settle
      '};' +
    '});' +
  '};' +

  'function _runSteps(iframe, steps, resolve) {' +
    'var doc = iframe.contentDocument;' +
    'var win = iframe.contentWindow;' +
    'var vh = win.innerHeight || 900;' +

    // Find all text elements (same as analyzer extractor)
    'var walker = doc.createTreeWalker(doc.body, 4, null, false);' +
    'var node, textEls = [], seen = new Set();' +
    'while (node = walker.nextNode()) {' +
      'if (!node.textContent.trim()) continue;' +
      'var el = node.parentElement;' +
      'if (!el || el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT") continue;' +
      'if (seen.has(el)) continue; seen.add(el);' +
      'var r = el.getBoundingClientRect();' +
      'if (r.width < 3 || r.height < 3) continue;' +
      'textEls.push({ el: el, text: el.textContent.substring(0, 40).trim(), tag: el.tagName,' +
        'bbox: { left: r.left + win.scrollX, top: r.top + win.scrollY, width: r.width, height: r.height } });' +
    '}' +

    // Apply steps
    'var applied = [];' +

    // Step 1: height:auto + overflow:auto
    'if (steps.heightAuto) {' +
      'doc.documentElement.style.cssText += "height:auto !important;overflow-y:auto !important;";' +
      'doc.body.style.cssText += "height:auto !important;";' +
      'doc.body.offsetHeight;' +
      'applied.push("heightAuto");' +
    '}' +

    // Step 2: Pre-scroll
    'if (steps.preScroll) {' +
      'var totalH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);' +
      'var captureH = Math.min(totalH, vh * 10);' +
      'for (var p = 0; p < captureH; p += vh) {' +
        'win.scrollTo(0, p); doc.documentElement.scrollTop = p;' +
        'try { win.dispatchEvent(new Event("scroll")); } catch(e) {}' +
      '}' +
      'applied.push("preScroll("+captureH+")");' +
    '}' +

    // Step 3: Reset scroll
    'if (steps.scrollReset) {' +
      'doc.documentElement.style.scrollBehavior = "auto";' +
      'doc.body.style.scrollBehavior = "auto";' +
      'win.scrollTo(0, 0); doc.documentElement.scrollTop = 0; doc.body.scrollTop = 0;' +
      'doc.querySelectorAll("*").forEach(function(el) {' +
        'if (el.scrollTop > 0) { var s = getComputedStyle(el);' +
        'if (s.overflow === "auto" || s.overflow === "scroll" || s.overflowY === "auto" || s.overflowY === "scroll") {' +
        'el.style.scrollBehavior = "auto"; el.scrollTop = 0; } }' +
      '});' +
      'applied.push("scrollReset");' +
    '}' +

    // Step 4: Force-reveal hidden animations
    'if (steps.forceReveal) {' +
      'var revealed = 0;' +
      'doc.querySelectorAll("*").forEach(function(el) {' +
        'var cs = getComputedStyle(el);' +
        'if (cs.opacity === "0" && el.tagName !== "SCRIPT" && el.tagName !== "STYLE") {' +
          'var hasTrans = cs.transition && cs.transition.indexOf("opacity") !== -1;' +
          'var hasAnim = cs.animationName && cs.animationName !== "none";' +
          'var cls = (el.className && typeof el.className === "string") ? el.className.toLowerCase() : "";' +
          'var isScrollAnim = hasTrans || hasAnim || /fade|reveal|animate|aos|scroll|slide|appear/.test(cls);' +
          'if (isScrollAnim) { el.style.cssText += ";opacity:1 !important;transform:none !important;transition:none !important;animation:none !important;"; revealed++; }' +
        '}' +
      '});' +
      'applied.push("forceReveal("+revealed+")");' +
    '}' +

    // Step 5: Fast-forward animations style
    'if (steps.fastForwardAnims) {' +
      'var ffStyle = doc.createElement("style");' +
      'ffStyle.textContent = "*,*::before,*::after{animation-delay:0s !important;animation-duration:0.01s !important;}";' +
      'doc.head.appendChild(ffStyle);' +
      'doc.body.offsetHeight;' +
      'applied.push("fastForwardAnims");' +
    '}' +

    // Step 6: Overflow visible
    'if (steps.overflowVisible) {' +
      'doc.documentElement.style.cssText += "overflow:visible !important;";' +
      'doc.body.style.cssText += "overflow:visible !important;";' +
      'doc.body.offsetHeight;' +
      'applied.push("overflowVisible");' +
    '}' +

    // Step 7: Re-read bboxes (simulates __milgReReadBboxes)
    'if (steps.reReadBboxes) {' +
      'textEls.forEach(function(te) {' +
        'var r = te.el.getBoundingClientRect();' +
        'te.bbox = { left: r.left + win.scrollX, top: r.top + win.scrollY, width: r.width, height: r.height };' +
      '});' +
      'applied.push("reReadBboxes");' +
    '}' +

    // Step 8: Screenshot capture (first domToCanvas call)
    'function doScreenshot(cb) {' +
      'if (!steps.screenshotFirst) { cb(); return; }' +
      'MS.domToCanvas(doc.documentElement, { scale: SC, timeout: 15000 }).then(function(fc) {' +
        'applied.push("screenshot("+fc.width+"x"+fc.height+")");' +
        // Convert to dataURL like the real pipeline does
        'try { fc.toDataURL("image/webp", 0.85); } catch(e) {}' +
        'cb();' +
      '}).catch(function(e) { applied.push("screenshot:ERROR:"+e.message); cb(); });' +
    '}' +

    // Step 9: Kill transitions
    'function doKillTransitions() {' +
      'if (!steps.killTransitions) return;' +
      'doc.querySelectorAll("*").forEach(function(el) {' +
        'el.style.setProperty("transition-duration", "0s", "important");' +
        'el.style.setProperty("transition", "none", "important");' +
      '});' +
      'doc.body.offsetHeight;' +
      'applied.push("killTransitions");' +
    '}' +

    // Step 10: Mask style
    'function doMaskStyle() {' +
      'if (!steps.maskStyle) return;' +
      'var ms = doc.createElement("style");' +
      'ms.setAttribute("data-milg-mask", "1");' +
      'ms.textContent = "*,*::before,*::after{color:#fff !important;background-color:#fff !important;background-image:none !important;background:white !important;border-color:transparent !important;box-shadow:none !important;text-shadow:none !important;outline-color:transparent !important;-webkit-text-fill-color:#fff !important;opacity:1 !important;transition:none !important;animation:none !important;}img,svg,video,canvas,picture,iframe{opacity:0 !important;}";' +
      'doc.head.appendChild(ms);' +
      'doc.body.offsetHeight;' +
      'applied.push("maskStyle");' +
    '}' +

    // Step 11: Set elements to black
    'function doSetBlack() {' +
      'if (!steps.setBlack) return;' +
      'textEls.forEach(function(te) {' +
        'te.el.style.setProperty("color", "#000", "important");' +
        'te.el.style.setProperty("-webkit-text-fill-color", "#000", "important");' +
        'te.el.querySelectorAll("*").forEach(function(ch) {' +
          'ch.style.setProperty("color", "#000", "important");' +
          'ch.style.setProperty("-webkit-text-fill-color", "#000", "important");' +
        '});' +
      '});' +
      'doc.body.offsetHeight;' +
      'applied.push("setBlack");' +
    '}' +

    // Execute screenshot step then remaining steps and capture
    'doScreenshot(function() {' +
      'doKillTransitions();' +
      'doMaskStyle();' +
      'doSetBlack();' +

      'setTimeout(function() {' +
        // Final capture (mask)
        'MS.domToCanvas(doc.documentElement, { scale: SC, timeout: 15000 }).then(function(mc) {' +
          'applied.push("maskCapture("+mc.width+"x"+mc.height+")");' +
          'var ctx = mc.getContext("2d", { willReadFrequently: true });' +
          'var results = { applied: applied, canvas: mc.width+"x"+mc.height, elements: [] };' +

          'textEls.forEach(function(te) {' +
            'var bx = Math.max(0, Math.round(te.bbox.left * SC));' +
            'var by = Math.max(0, Math.round(te.bbox.top * SC));' +
            'var bw = Math.min(Math.round(te.bbox.width * SC), mc.width - bx);' +
            'var bh = Math.min(Math.round(te.bbox.height * SC), mc.height - by);' +
            'if (bw < 2 || bh < 2) return;' +
            'try {' +
              'var px = ctx.getImageData(bx, by, bw, bh).data;' +
              'var dk = 0; for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 240) dk++; }' +
              'var ci = (Math.floor(bh/2)*bw+Math.floor(bw/2))*4;' +
              'results.elements.push({ text: te.text, tag: te.tag, dark: dk, bw: bw, bh: bh,' +
                'center: "rgb("+px[ci]+","+px[ci+1]+","+px[ci+2]+")",' +
                'postColor: getComputedStyle(te.el).color });' +
            '} catch(e) {}' +
          '});' +
          'resolve(results);' +
        '}).catch(function(e) { resolve({ error: "maskCapture: "+e.message, applied: applied }); });' +
      '}, 300);' +
    '});' +
  '}' +
  '</' + 'script></body></html>';

// Count fails for a specific set of known-failing element names
function countKnownFails(results) {
  var fails = 0;
  results.elements.forEach(function(el) {
    if (el.dark === 0 && KNOWN_FAILS.some(function(k) { return el.text.indexOf(k) !== -1; })) {
      fails++;
    }
  });
  return fails;
}

function countTotalFails(results) {
  return results.elements.filter(function(el) { return el.dark === 0; }).length;
}

async function run() {
  var server = startServer();
  console.log('\n\x1b[1m=== Pipeline Step-by-Step Mask Test ===\x1b[0m\n');

  var browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  var page = await browser.newPage();

  // Load harness
  testPageHtml = HARNESS;
  await page.goto(BASE + '/test-page', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction('window.modernScreenshot && window.testPipeline', { timeout: 15000 });

  // Fetch real page
  console.log('Fetching tokenmade.ai...');
  var realHtml = await fetchRealPage(page);
  if (!realHtml) { console.log('\x1b[31mCould not fetch page\x1b[0m'); await browser.close(); server.close(); return; }
  console.log('Got ' + realHtml.length + ' chars\n');

  // ============================================
  // APPROACH 1: Add steps incrementally
  // ============================================
  console.log('\x1b[1m--- APPROACH 1: Add steps one at a time ---\x1b[0m\n');

  var stepSets = [
    { name: 'Baseline: mask only', maskStyle: true, setBlack: true },
    { name: '+ heightAuto', heightAuto: true, maskStyle: true, setBlack: true },
    { name: '+ preScroll', heightAuto: true, preScroll: true, maskStyle: true, setBlack: true },
    { name: '+ scrollReset', heightAuto: true, preScroll: true, scrollReset: true, maskStyle: true, setBlack: true },
    { name: '+ forceReveal', heightAuto: true, preScroll: true, scrollReset: true, forceReveal: true, maskStyle: true, setBlack: true },
    { name: '+ fastForwardAnims', heightAuto: true, preScroll: true, scrollReset: true, forceReveal: true, fastForwardAnims: true, maskStyle: true, setBlack: true },
    { name: '+ overflowVisible', heightAuto: true, preScroll: true, scrollReset: true, forceReveal: true, fastForwardAnims: true, overflowVisible: true, maskStyle: true, setBlack: true },
    { name: '+ reReadBboxes', heightAuto: true, preScroll: true, scrollReset: true, forceReveal: true, fastForwardAnims: true, overflowVisible: true, reReadBboxes: true, maskStyle: true, setBlack: true },
    { name: '+ screenshotFirst', heightAuto: true, preScroll: true, scrollReset: true, forceReveal: true, fastForwardAnims: true, overflowVisible: true, reReadBboxes: true, screenshotFirst: true, maskStyle: true, setBlack: true },
    { name: '+ killTransitions', heightAuto: true, preScroll: true, scrollReset: true, forceReveal: true, fastForwardAnims: true, overflowVisible: true, reReadBboxes: true, screenshotFirst: true, killTransitions: true, maskStyle: true, setBlack: true },
  ];

  var firstFailStep = null;
  for (var i = 0; i < stepSets.length; i++) {
    var ss = stepSets[i];
    process.stdout.write('\x1b[36m' + ss.name + '\x1b[0m ... ');

    var result = await page.evaluate(function(html, steps) {
      return window.testPipeline(html, steps);
    }, realHtml, ss);

    if (result.error) {
      console.log('\x1b[31mERROR: ' + result.error + '\x1b[0m');
      continue;
    }

    var totalFails = countTotalFails(result);
    var knownFails = countKnownFails(result);
    var total = result.elements.length;

    if (knownFails > 0) {
      console.log('\x1b[31m' + totalFails + '/' + total + ' fail (' + knownFails + ' known) canvas=' + result.canvas + '\x1b[0m');
      if (!firstFailStep) {
        firstFailStep = ss.name;
        // Show which elements failed
        result.elements.forEach(function(el) {
          if (el.dark === 0) {
            console.log('    \x1b[31m✗ "' + el.text + '" (' + el.tag + ') center=' + el.center + ' postColor=' + el.postColor + '\x1b[0m');
          }
        });
      }
    } else if (totalFails > 0) {
      console.log('\x1b[33m' + totalFails + '/' + total + ' fail (0 known) canvas=' + result.canvas + '\x1b[0m');
    } else {
      console.log('\x1b[32m0/' + total + ' fail canvas=' + result.canvas + '\x1b[0m');
    }
  }

  if (firstFailStep) {
    console.log('\n\x1b[1;31m>>> First failure at: ' + firstFailStep + '\x1b[0m\n');
  } else {
    console.log('\n\x1b[32mApproach 1: No failures detected in any step combination\x1b[0m\n');

    // ============================================
    // APPROACH 2: Full flow, remove steps
    // ============================================
    console.log('\x1b[1m--- APPROACH 2: Full flow, remove steps one at a time ---\x1b[0m\n');

    var fullSteps = { heightAuto: true, preScroll: true, scrollReset: true, forceReveal: true, fastForwardAnims: true, overflowVisible: true, reReadBboxes: true, screenshotFirst: true, killTransitions: true, maskStyle: true, setBlack: true };

    // First confirm full flow passes
    process.stdout.write('\x1b[36mFull pipeline\x1b[0m ... ');
    var fullResult = await page.evaluate(function(html, steps) { return window.testPipeline(html, steps); }, realHtml, fullSteps);
    var fullFails = countTotalFails(fullResult);
    console.log(fullFails + '/' + fullResult.elements.length + ' fail');

    if (fullFails === 0) {
      console.log('\x1b[32mFull pipeline passes — issue is something not covered by our step reproduction\x1b[0m');
      console.log('Steps applied: ' + (fullResult.applied || []).join(' → '));

      // Try with iframe at different positions
      console.log('\n\x1b[1m--- APPROACH 3: Vary iframe position ---\x1b[0m\n');
      var positions = [
        'position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;',
        'position:fixed;top:0;left:0;width:1280px;height:900px;border:none;opacity:0.01;',
        'position:absolute;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;',
      ];
      for (var pi = 0; pi < positions.length; pi++) {
        process.stdout.write('\x1b[36mPosition: ' + positions[pi].substring(0, 40) + '...\x1b[0m ');
        var posResult = await page.evaluate(function(html, steps, pos) {
          return new Promise(function(resolve) {
            var existing = document.getElementById('tf');
            if (existing) existing.parentNode.removeChild(existing);
            var iframe = document.createElement('iframe');
            iframe.id = 'tf';
            iframe.style.cssText = pos;
            iframe.sandbox = 'allow-scripts allow-same-origin';
            document.body.appendChild(iframe);
            iframe.srcdoc = html;
            iframe.onload = function() {
              setTimeout(function() {
                try { _runSteps(iframe, steps, resolve); }
                catch(e) { resolve({ error: e.message }); }
              }, 1500);
            };
          });
        }, realHtml, fullSteps, positions[pi]);
        if (posResult.error) { console.log('\x1b[31mERROR: ' + posResult.error + '\x1b[0m'); }
        else { console.log(countTotalFails(posResult) + '/' + posResult.elements.length + ' fail'); }
      }
    }
  }

  console.log('\n\x1b[1mDone.\x1b[0m');
  await browser.close();
  server.close();
}

run().catch(function(e) { console.error(e); process.exit(1); });
