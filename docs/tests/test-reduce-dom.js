#!/usr/bin/env node
// Deterministic DOM reduction: capture exact rendered state, confirm reproduction, binary-search reduce.
var http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
var PORT = 8840, SCALE = 0.75;

var harness = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js"></script>
</head><body><script>
var MS = window.modernScreenshot, SC = ${SCALE};

// Serialize entire DOM with computed styles inlined
window.serializeDOM = function(html) {
  return new Promise(function(resolve) {
    var iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;";
    iframe.sandbox = "allow-scripts allow-same-origin";
    document.body.appendChild(iframe);
    iframe.srcdoc = html;
    iframe.onload = function() { setTimeout(function() {
      var doc = iframe.contentDocument;
      // Walk entire DOM, inline ALL computed styles on every element
      var count = 0;
      doc.querySelectorAll("*").forEach(function(el) {
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "LINK") return;
        var cs = getComputedStyle(el);
        var important = [];
        for (var i = 0; i < cs.length; i++) {
          var prop = cs[i];
          var val = cs.getPropertyValue(prop);
          if (val && val !== "initial" && val !== "normal" && val !== "none" && val !== "auto" && val !== "0px" && val !== "0s") {
            important.push(prop + ":" + val);
          }
        }
        el.setAttribute("style", important.join(";"));
        el.removeAttribute("class");
        count++;
      });
      // Remove all style/link/script tags
      doc.querySelectorAll("style,link,script,noscript").forEach(function(s) { s.remove(); });
      // Get serialized HTML
      var serialized = "<!DOCTYPE html>" + doc.documentElement.outerHTML;
      iframe.parentNode.removeChild(iframe);
      resolve({ html: serialized, elements: count });
    }, 2000); };
  });
};

// Test mask on HTML, return list of failing element texts
window.testMask = function(html) {
  return new Promise(function(resolve) {
    var iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;";
    iframe.sandbox = "allow-scripts allow-same-origin";
    document.body.appendChild(iframe);
    iframe.srcdoc = html;
    iframe.onload = function() { setTimeout(function() {
      try {
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
          els.push({ el: el, text: el.textContent.substring(0, 35).trim(),
            bbox: { left: r.left, top: r.top, width: r.width, height: r.height } });
        }
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
            var fails = [], passes = 0;
            els.forEach(function(te) {
              var bx = Math.max(0, Math.round(te.bbox.left * SC));
              var by = Math.max(0, Math.round(te.bbox.top * SC));
              var bw = Math.min(Math.round(te.bbox.width * SC), c.width - bx);
              var bh = Math.min(Math.round(te.bbox.height * SC), c.height - by);
              if (bw < 2 || bh < 2) return;
              var px = ctx.getImageData(bx, by, bw, bh).data;
              var dk = 0;
              for (var i = 0; i < px.length; i += 4) { if ((px[i]+px[i+1]+px[i+2])/3 < 240) dk++; }
              if (dk === 0) fails.push(te.text);
              else passes++;
            });
            iframe.parentNode.removeChild(iframe);
            resolve({ fails: fails, passes: passes, total: els.length });
          }).catch(function(e) { resolve({ error: "canvas: " + e.message }); });
        }, 300);
      } catch(e) { resolve({ error: e.message }); }
    }, 1500); };
  });
};
</script></body></html>`;

var server = http.createServer(function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(harness);
});
server.listen(PORT);

async function run() {
  console.log('\n\x1b[1m=== Deterministic DOM Reduction ===\x1b[0m\n');
  var browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-web-security'] });
  var page = await browser.newPage();
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction('window.serializeDOM && window.testMask', { timeout: 15000 });

  // Step 1: Fetch real page
  console.log('Step 1: Fetching tokenmade.ai...');
  var srcHtml = await page.evaluate(async function() {
    var p = ['https://api.allorigins.win/raw?url=', 'https://api.codetabs.com/v1/proxy?quest=', 'https://corsproxy.io/?'];
    for (var i = 0; i < p.length; i++) {
      try { var r = await fetch(p[i] + encodeURIComponent('https://www.tokenmade.ai/')); if (r.ok) { var t = await r.text(); if (t.length > 100) return t; } } catch(e) {}
    }
    return null;
  });
  if (!srcHtml) { console.log('Fetch failed'); process.exit(1); }
  console.log('  Source: ' + srcHtml.length + ' chars');

  // Step 2: Serialize DOM with computed styles inlined
  console.log('\nStep 2: Serializing rendered DOM with computed styles...');
  var serialized = await page.evaluate(function(h) { return window.serializeDOM(h); }, srcHtml);
  console.log('  Serialized: ' + serialized.html.length + ' chars, ' + serialized.elements + ' elements');
  fs.writeFileSync('/tmp/serialized-full.html', serialized.html);

  // Step 3: Confirm reproduction with serialized HTML
  console.log('\nStep 3: Confirming reproduction...');
  var baseline = await page.evaluate(function(h) { return window.testMask(h); }, serialized.html);
  if (baseline.error) { console.log('  Error: ' + baseline.error); process.exit(1); }
  console.log('  Source HTML: ' + baseline.fails.length + '/' + baseline.total + ' fail');
  if (baseline.fails.length === 0) {
    console.log('  \x1b[33mSerialized DOM does not reproduce! Trying source HTML directly...\x1b[0m');
    baseline = await page.evaluate(function(h) { return window.testMask(h); }, srcHtml);
    console.log('  Source HTML direct: ' + baseline.fails.length + '/' + baseline.total + ' fail');
    if (baseline.fails.length === 0) {
      console.log('  \x1b[31mCannot reproduce. Exiting.\x1b[0m');
      await browser.close(); server.close(); return;
    }
    // Use source HTML for reduction
    serialized.html = srcHtml;
  }

  var failTexts = baseline.fails;
  console.log('  Failing: ' + failTexts.slice(0, 5).join(', ') + (failTexts.length > 5 ? '...' : ''));
  var targetFail = failTexts[0]; // Track this specific element
  console.log('  Tracking: "' + targetFail + '"');

  // Step 4: Binary reduction — remove top-level body children
  console.log('\nStep 4: Reducing top-level children...');
  var workingHtml = serialized.html;

  // Parse and get body children
  var bodyChildren = await page.evaluate(function(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var head = doc.head ? doc.head.innerHTML : '';
    var children = [];
    if (doc.body) {
      for (var i = 0; i < doc.body.children.length; i++) {
        children.push({ idx: i, tag: doc.body.children[i].tagName, len: doc.body.children[i].outerHTML.length,
          text: doc.body.children[i].textContent.substring(0, 30).trim() });
      }
    }
    return { head: head, childCount: children.length, children: children };
  }, workingHtml);

  console.log('  Body has ' + bodyChildren.childCount + ' children');

  // Try removing each child one at a time; keep those whose removal fixes the bug
  var removable = [];
  for (var ci = bodyChildren.childCount - 1; ci >= 0; ci--) {
    var testHtml = await page.evaluate(function(html, skipIdx) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      if (doc.body.children[skipIdx]) doc.body.children[skipIdx].remove();
      return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
    }, workingHtml, ci);

    var r = await page.evaluate(function(h) { return window.testMask(h); }, testHtml);
    var stillFails = r.fails && r.fails.some(function(f) { return f.indexOf(targetFail.substring(0, 15)) !== -1; });

    if (!stillFails) {
      removable.push(ci);
      console.log('  [' + ci + '] ' + bodyChildren.children[ci].tag + ' "' + bodyChildren.children[ci].text.substring(0, 20) + '" — \x1b[33mNEEDED (removal fixes bug)\x1b[0m');
    } else {
      // Can safely remove this child — bug persists without it
      workingHtml = testHtml;
      console.log('  [' + ci + '] ' + bodyChildren.children[ci].tag + ' "' + bodyChildren.children[ci].text.substring(0, 20) + '" — \x1b[32mremoved (bug persists)\x1b[0m');
    }
  }

  // Verify reduced HTML still fails
  var reduced1 = await page.evaluate(function(h) { return window.testMask(h); }, workingHtml);
  console.log('\n  After top-level reduction: ' + reduced1.fails.length + ' fails, ' + workingHtml.length + ' chars');
  fs.writeFileSync('/tmp/reduced-toplevel.html', workingHtml);

  // Step 5: Deep reduction — for each remaining top-level child, try removing ITS children
  console.log('\nStep 5: Deep reducing remaining children...');
  for (var depth = 0; depth < 3; depth++) {
    var changed = false;
    var deepChildren = await page.evaluate(function(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var paths = [];
      function walk(el, path) {
        for (var i = el.children.length - 1; i >= 0; i--) {
          var child = el.children[i];
          if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
          var p = path + '>' + i;
          paths.push({ path: p, tag: child.tagName, len: child.outerHTML.length, text: child.textContent.substring(0, 20).trim() });
          if (child.children.length > 0) walk(child, p);
        }
      }
      walk(doc.body, 'body');
      // Sort by size descending (remove biggest first)
      paths.sort(function(a, b) { return b.len - a.len; });
      return paths;
    }, workingHtml);

    console.log('  Depth ' + depth + ': ' + deepChildren.length + ' removable nodes');
    var removedCount = 0;

    for (var di = 0; di < deepChildren.length; di++) {
      var dc = deepChildren[di];
      if (dc.len < 50) continue; // skip tiny nodes

      var testHtml = await page.evaluate(function(html, pathStr) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var parts = pathStr.split('>');
        var el = doc.body;
        for (var i = 1; i < parts.length; i++) {
          var idx = parseInt(parts[i]);
          if (!el || !el.children[idx]) return null;
          el = el.children[idx];
        }
        if (el) el.remove();
        return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
      }, workingHtml, dc.path);

      if (!testHtml) continue;

      var r = await page.evaluate(function(h) { return window.testMask(h); }, testHtml);
      if (r.error) continue;
      var stillFails = r.fails && r.fails.some(function(f) { return f.indexOf(targetFail.substring(0, 15)) !== -1; });

      if (stillFails) {
        workingHtml = testHtml;
        removedCount++;
        changed = true;
      }
    }
    console.log('  Removed ' + removedCount + ' nodes, now ' + workingHtml.length + ' chars');
    if (!changed) break;
  }

  // Final verification
  var finalResult = await page.evaluate(function(h) { return window.testMask(h); }, workingHtml);
  console.log('\n\x1b[1m=== Final Result ===\x1b[0m');
  console.log('Reduced from ' + serialized.html.length + ' → ' + workingHtml.length + ' chars');
  console.log('Fails: ' + finalResult.fails.length + '/' + finalResult.total);
  console.log('Failing: ' + finalResult.fails.join(', '));

  fs.writeFileSync('/tmp/reduced-final.html', workingHtml);
  console.log('\nSaved to /tmp/reduced-final.html');
  console.log('Size: ' + workingHtml.length + ' chars');

  await browser.close();
  server.close();
}

run().catch(function(e) { console.error(e); process.exit(1); });
