#!/usr/bin/env node
// Test: Find ALL failing elements on real tokenmade.ai page,
// extract their DOM context, and verify the dummy-element fix works.

var http = require('http');
var path = require('path');
var puppeteer = require('puppeteer');

var PORT = 8820;
var SCALE = 0.75;
var DOCS_DIR = path.resolve(__dirname, '..');

var harness = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js"></script>
</head><body><script>
var MS = window.modernScreenshot, SC = ${SCALE};

// Test mask on real page HTML, return detailed info about each failing element
window.findFailures = function(html) {
  return new Promise(function(resolve) {
    var iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;";
    iframe.sandbox = "allow-scripts allow-same-origin";
    document.body.appendChild(iframe);
    iframe.srcdoc = html;
    iframe.onload = function() { setTimeout(function() {
      var doc = iframe.contentDocument;
      // Find text elements
      var walker = doc.createTreeWalker(doc.body, 4, null, false);
      var node, els = [], seen = new Set();
      while (node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        var el = node.parentElement;
        if (!el || el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT") continue;
        if (seen.has(el)) continue; seen.add(el);
        var r = el.getBoundingClientRect();
        if (r.width < 3 || r.height < 3) continue;
        els.push({ el: el, text: el.textContent.substring(0, 40).trim(), tag: el.tagName,
          bbox: { left: r.left, top: r.top, width: r.width, height: r.height } });
      }

      // Apply mask
      var ms = doc.createElement("style");
      ms.textContent = "*,*::before,*::after{color:#fff !important;background-color:#fff !important;background-image:none !important;background:white !important;-webkit-text-fill-color:#fff !important;opacity:1 !important;transition:none !important;animation:none !important;}img,svg,video,canvas,picture,iframe{opacity:0 !important;}";
      doc.head.appendChild(ms);
      els.forEach(function(te) {
        te.el.style.setProperty("color", "#000", "important");
        te.el.style.setProperty("-webkit-text-fill-color", "#000", "important");
        te.el.querySelectorAll("*").forEach(function(ch) {
          ch.style.setProperty("color", "#000", "important");
          ch.style.setProperty("-webkit-text-fill-color", "#000", "important");
        });
      });
      doc.body.offsetHeight;

      setTimeout(function() {
        MS.domToCanvas(doc.documentElement, { scale: SC, timeout: 20000 }).then(function(c) {
          var ctx = c.getContext("2d", { willReadFrequently: true });
          var results = [];
          els.forEach(function(te) {
            var bx = Math.max(0, Math.round(te.bbox.left * SC));
            var by = Math.max(0, Math.round(te.bbox.top * SC));
            var bw = Math.min(Math.round(te.bbox.width * SC), c.width - bx);
            var bh = Math.min(Math.round(te.bbox.height * SC), c.height - by);
            if (bw < 2 || bh < 2) return;
            var px = ctx.getImageData(bx, by, bw, bh).data;
            var dk = 0;
            for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 240) dk++; }
            if (dk === 0) {
              // Extract context: parent chain and sibling info
              var parent = te.el.parentElement;
              var grandparent = parent ? parent.parentElement : null;
              var parentTag = parent ? parent.tagName : "?";
              var parentChildCount = parent ? parent.children.length : 0;
              var parentChildren = [];
              if (parent) {
                for (var ci = 0; ci < Math.min(parent.children.length, 5); ci++) {
                  parentChildren.push(parent.children[ci].tagName);
                }
              }
              var isSoleChild = parentChildCount === 1;
              var gpTag = grandparent ? grandparent.tagName : "?";
              var gpChildCount = grandparent ? grandparent.children.length : 0;
              // Check if any ancestor up to 3 levels has a sole heading child
              var headingAncestor = null;
              var anc = te.el;
              for (var d = 0; d < 5 && anc; d++) {
                var p = anc.parentElement;
                if (p && p.children.length === 1 && /^H[1-6]$/.test(anc.tagName)) {
                  headingAncestor = { depth: d, headingTag: anc.tagName, wrapperTag: p.tagName,
                    wrapperCls: (p.className || "").toString().substring(0, 40) };
                }
                anc = p;
              }
              // Get outerHTML of parent (truncated)
              var parentHtml = parent ? parent.outerHTML.substring(0, 200) : "";

              results.push({
                text: te.text, tag: te.tag,
                parentTag: parentTag, parentChildCount: parentChildCount, parentChildren: parentChildren,
                isSoleChild: isSoleChild, gpTag: gpTag, gpChildCount: gpChildCount,
                headingAncestor: headingAncestor,
                parentHtml: parentHtml
              });
            }
          });
          iframe.parentNode.removeChild(iframe);
          resolve({ total: els.length, fails: results });
        }).catch(function(e) { resolve({ error: e.message }); });
      }, 300);
    }, 1500); };
  });
};

// Test with dummy elements injected before mask
window.testWithFix = function(html) {
  return new Promise(function(resolve) {
    var iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;";
    iframe.sandbox = "allow-scripts allow-same-origin";
    document.body.appendChild(iframe);
    iframe.srcdoc = html;
    iframe.onload = function() { setTimeout(function() {
      var doc = iframe.contentDocument;
      var walker = doc.createTreeWalker(doc.body, 4, null, false);
      var node, els = [], seen = new Set();
      while (node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        var el = node.parentElement;
        if (!el || el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT") continue;
        if (seen.has(el)) continue; seen.add(el);
        var r = el.getBoundingClientRect();
        if (r.width < 3 || r.height < 3) continue;
        els.push({ el: el, text: el.textContent.substring(0, 40).trim(), tag: el.tagName,
          bbox: { left: r.left, top: r.top, width: r.width, height: r.height } });
      }

      // FIX: Inject dummy <span> into containers that have a sole heading child
      var injected = 0;
      doc.querySelectorAll("div,section,article,aside,nav,main,header,footer,li,td,th,figure,figcaption,blockquote,fieldset,details").forEach(function(container) {
        if (container.children.length === 1 && /^H[1-6]$/.test(container.children[0].tagName)) {
          var dummy = doc.createElement("span");
          dummy.setAttribute("data-milg-dummy", "1");
          dummy.style.cssText = "display:block;height:0;overflow:hidden;";
          container.appendChild(dummy);
          injected++;
        }
      });

      // Apply mask
      var ms = doc.createElement("style");
      ms.textContent = "*,*::before,*::after{color:#fff !important;background-color:#fff !important;background-image:none !important;background:white !important;-webkit-text-fill-color:#fff !important;opacity:1 !important;transition:none !important;animation:none !important;}img,svg,video,canvas,picture,iframe{opacity:0 !important;}";
      doc.head.appendChild(ms);
      els.forEach(function(te) {
        te.el.style.setProperty("color", "#000", "important");
        te.el.style.setProperty("-webkit-text-fill-color", "#000", "important");
        te.el.querySelectorAll("*").forEach(function(ch) {
          ch.style.setProperty("color", "#000", "important");
          ch.style.setProperty("-webkit-text-fill-color", "#000", "important");
        });
      });
      doc.body.offsetHeight;

      setTimeout(function() {
        MS.domToCanvas(doc.documentElement, { scale: SC, timeout: 20000 }).then(function(c) {
          var ctx = c.getContext("2d", { willReadFrequently: true });
          var fails = 0, failNames = [];
          els.forEach(function(te) {
            var bx = Math.max(0, Math.round(te.bbox.left * SC));
            var by = Math.max(0, Math.round(te.bbox.top * SC));
            var bw = Math.min(Math.round(te.bbox.width * SC), c.width - bx);
            var bh = Math.min(Math.round(te.bbox.height * SC), c.height - by);
            if (bw < 2 || bh < 2) return;
            var px = ctx.getImageData(bx, by, bw, bh).data;
            var dk = 0;
            for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 240) dk++; }
            if (dk === 0) { fails++; failNames.push(te.text); }
          });
          iframe.parentNode.removeChild(iframe);
          resolve({ total: els.length, fails: fails, failNames: failNames, injected: injected });
        }).catch(function(e) { resolve({ error: e.message }); });
      }, 300);
    }, 1500); };
  });
};
</script></body></html>`;

var currentHtml = harness;
var server = http.createServer(function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(currentHtml);
});
server.listen(PORT);

async function run() {
  console.log('\n\x1b[1m=== Real Page Failure Analysis & Fix Verification ===\x1b[0m\n');

  var browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-web-security'] });
  var page = await browser.newPage();

  currentHtml = harness;
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction('window.findFailures && window.testWithFix', { timeout: 15000 });

  // Fetch real page
  console.log('Fetching tokenmade.ai...');
  var html = await page.evaluate(async function() {
    var proxies = ['https://api.allorigins.win/raw?url=', 'https://api.codetabs.com/v1/proxy?quest=', 'https://corsproxy.io/?'];
    for (var i = 0; i < proxies.length; i++) {
      try { var r = await fetch(proxies[i] + encodeURIComponent('https://www.tokenmade.ai/')); if (r.ok) { var t = await r.text(); if (t.length > 100) return t; } } catch(e) {}
    }
    return null;
  });
  if (!html) { console.log('\x1b[31mFetch failed\x1b[0m'); await browser.close(); server.close(); return; }
  console.log('Got ' + html.length + ' chars\n');

  // Step 1: Find all failures
  console.log('\x1b[36m--- Step 1: Find all failing elements ---\x1b[0m\n');
  var failures = await page.evaluate(function(h) { return window.findFailures(h); }, html);

  if (failures.error) {
    console.log('\x1b[31mError: ' + failures.error + '\x1b[0m');
    await browser.close(); server.close(); return;
  }

  console.log('Total elements: ' + failures.total + ', Failing: ' + failures.fails.length + '\n');

  // Analyze patterns
  var patterns = {};
  failures.fails.forEach(function(f) {
    console.log('\x1b[31m✗ "' + f.text + '" (' + f.tag + ')\x1b[0m');
    console.log('  parent: <' + f.parentTag + '> children=' + f.parentChildCount + ' [' + f.parentChildren.join(',') + '] sole=' + f.isSoleChild);
    console.log('  grandparent: <' + f.gpTag + '> children=' + f.gpChildCount);
    if (f.headingAncestor) {
      console.log('  \x1b[33m→ HEADING ANCESTOR: <' + f.headingAncestor.wrapperTag + '><' + f.headingAncestor.headingTag + '> (depth ' + f.headingAncestor.depth + ')\x1b[0m');
    }
    console.log('  parentHTML: ' + f.parentHtml.substring(0, 120));
    console.log('');

    // Categorize pattern
    var key = f.parentTag + '>' + f.tag + (f.isSoleChild ? '(sole)' : '(siblings:' + f.parentChildCount + ')');
    patterns[key] = (patterns[key] || 0) + 1;
  });

  console.log('\n\x1b[36m--- Pattern Summary ---\x1b[0m');
  Object.keys(patterns).sort(function(a, b) { return patterns[b] - patterns[a]; }).forEach(function(k) {
    console.log('  ' + patterns[k] + 'x  ' + k);
  });

  // Step 2: Test with dummy element fix
  console.log('\n\x1b[36m--- Step 2: Test with dummy element fix ---\x1b[0m\n');
  var fixed = await page.evaluate(function(h) { return window.testWithFix(h); }, html);

  if (fixed.error) {
    console.log('\x1b[31mError: ' + fixed.error + '\x1b[0m');
  } else {
    console.log('Injected ' + fixed.injected + ' dummy elements');
    console.log('Before fix: ' + failures.fails.length + '/' + failures.total + ' fail');
    console.log('After fix:  ' + fixed.fails + '/' + fixed.total + ' fail');
    if (fixed.fails > 0) {
      console.log('\x1b[31mStill failing:\x1b[0m');
      fixed.failNames.forEach(function(n) { console.log('  - ' + n); });
    } else {
      console.log('\x1b[32m✓ All elements pass with dummy element fix!\x1b[0m');
    }
  }

  // Step 3: Test broader fix — also inject into containers with sole block-level children
  console.log('\n\x1b[36m--- Step 3: Broader fix (sole heading OR sole block child) ---\x1b[0m\n');
  var broadFixed = await page.evaluate(function(html) {
    return new Promise(function(resolve) {
      var iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;";
      iframe.sandbox = "allow-scripts allow-same-origin";
      document.body.appendChild(iframe);
      iframe.srcdoc = html;
      iframe.onload = function() { setTimeout(function() {
        var doc = iframe.contentDocument;
        var walker = doc.createTreeWalker(doc.body, 4, null, false);
        var node, els = [], seen = new Set();
        while (node = walker.nextNode()) {
          if (!node.textContent.trim()) continue;
          var el = node.parentElement;
          if (!el || el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT") continue;
          if (seen.has(el)) continue; seen.add(el);
          var r = el.getBoundingClientRect();
          if (r.width < 3 || r.height < 3) continue;
          els.push({ el: el, text: el.textContent.substring(0, 40).trim(), tag: el.tagName,
            bbox: { left: r.left, top: r.top, width: r.width, height: r.height } });
        }

        // Broader fix: inject dummy into ANY container with a sole child element
        var injected = 0;
        doc.querySelectorAll("*").forEach(function(container) {
          if (container.tagName === "SCRIPT" || container.tagName === "STYLE") return;
          if (container.children.length === 1) {
            var child = container.children[0];
            // Only if child is a block-level or heading element
            if (/^(H[1-6]|P|DIV|SECTION|ARTICLE|BLOCKQUOTE|PRE|UL|OL|DL|TABLE|FORM|FIELDSET|ADDRESS|DETAILS|SUMMARY|FIGURE|FIGCAPTION|MAIN|NAV|ASIDE|HEADER|FOOTER)$/.test(child.tagName)) {
              var dummy = doc.createElement("span");
              dummy.setAttribute("data-milg-dummy", "1");
              dummy.style.cssText = "display:block;height:0;overflow:hidden;";
              container.appendChild(dummy);
              injected++;
            }
          }
        });

        var ms = doc.createElement("style");
        ms.textContent = "*,*::before,*::after{color:#fff !important;background-color:#fff !important;background-image:none !important;background:white !important;-webkit-text-fill-color:#fff !important;opacity:1 !important;transition:none !important;animation:none !important;}img,svg,video,canvas,picture,iframe{opacity:0 !important;}";
        doc.head.appendChild(ms);
        els.forEach(function(te) {
          te.el.style.setProperty("color", "#000", "important");
          te.el.style.setProperty("-webkit-text-fill-color", "#000", "important");
          te.el.querySelectorAll("*").forEach(function(ch) {
            ch.style.setProperty("color", "#000", "important");
            ch.style.setProperty("-webkit-text-fill-color", "#000", "important");
          });
        });
        doc.body.offsetHeight;

        setTimeout(function() {
          MS.domToCanvas(doc.documentElement, { scale: 0.75, timeout: 20000 }).then(function(c) {
            var ctx = c.getContext("2d", { willReadFrequently: true });
            var fails = 0, failNames = [];
            els.forEach(function(te) {
              var bx = Math.max(0, Math.round(te.bbox.left * 0.75));
              var by = Math.max(0, Math.round(te.bbox.top * 0.75));
              var bw = Math.min(Math.round(te.bbox.width * 0.75), c.width - bx);
              var bh = Math.min(Math.round(te.bbox.height * 0.75), c.height - by);
              if (bw < 2 || bh < 2) return;
              var px = ctx.getImageData(bx, by, bw, bh).data;
              var dk = 0;
              for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 240) dk++; }
              if (dk === 0) { fails++; failNames.push(te.text); }
            });
            iframe.parentNode.removeChild(iframe);
            resolve({ total: els.length, fails: fails, failNames: failNames, injected: injected });
          }).catch(function(e) { resolve({ error: e.message }); });
        }, 300);
      }, 1500); };
    });
  }, html);

  if (broadFixed.error) {
    console.log('\x1b[31mError: ' + broadFixed.error + '\x1b[0m');
  } else {
    console.log('Injected ' + broadFixed.injected + ' dummy elements (broader pattern)');
    console.log('Before fix: ' + failures.fails.length + '/' + failures.total + ' fail');
    console.log('After fix:  ' + broadFixed.fails + '/' + broadFixed.total + ' fail');
    if (broadFixed.fails > 0) {
      console.log('\x1b[31mStill failing:\x1b[0m');
      broadFixed.failNames.forEach(function(n) { console.log('  - ' + n); });
    } else {
      console.log('\x1b[32m✓ All elements pass with broader fix!\x1b[0m');
    }
  }

  console.log('\n\x1b[1mDone.\x1b[0m');
  await browser.close();
  server.close();
}

run().catch(function(e) { console.error(e); process.exit(1); });
