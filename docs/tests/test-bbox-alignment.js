#!/usr/bin/env node
// Test: bbox alignment accuracy
// Creates a page with elements at known positions, captures with domToCanvas,
// then verifies that bbox coordinates map to the correct pixel positions.

var http = require('http');
var fs = require('fs');
var path = require('path');
var puppeteer = require('puppeteer');

var PORT = 8788;
var BASE = 'http://localhost:' + PORT;
var DOCS_DIR = path.resolve(__dirname, '..');
var passed = 0, failed = 0;

function log(ok, msg) {
  if (ok) { passed++; console.log('  \x1b[32m✓\x1b[0m ' + msg); }
  else { failed++; console.log('  \x1b[31m✗\x1b[0m ' + msg); }
}

// Test page with colored markers at known positions
var TEST_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<style>body{margin:0;padding:0;background:#fff;font-family:sans-serif}' +
  '.marker{position:absolute;background:red;color:#fff;font-size:12px;padding:2px 4px}' +
  '</style></head><body>' +
  '<div class="marker" id="m1" style="left:100px;top:50px;width:200px;height:30px">Marker 1 (100,50)</div>' +
  '<div class="marker" id="m2" style="left:50px;top:500px;width:300px;height:40px">Marker 2 (50,500)</div>' +
  '<div class="marker" id="m3" style="left:200px;top:1500px;width:150px;height:25px">Marker 3 (200,1500)</div>' +
  '<div class="marker" id="m4" style="left:100px;top:3000px;width:250px;height:35px">Marker 4 (100,3000)</div>' +
  '<div class="marker" id="m5" style="left:150px;top:4500px;width:180px;height:28px">Marker 5 (150,4500)</div>' +
  '<div style="height:5000px"></div>' + // Force page height
  '</body></html>';

function startServer() {
  var mimes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
  var server = http.createServer(function(req, res) {
    var url = req.url.split('?')[0];
    if (url === '/test-page') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(TEST_HTML); return; }
    var filePath = path.join(DOCS_DIR, url);
    try { var data = fs.readFileSync(filePath); res.writeHead(200, { 'Content-Type': mimes[path.extname(filePath)] || 'application/octet-stream' }); res.end(data); }
    catch(e) { res.writeHead(404); res.end('Not found'); }
  });
  server.listen(PORT);
  return server;
}

async function run() {
  var server = startServer();
  var browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  try {
    var page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Load test page
    await page.goto(BASE + '/test-page', { waitUntil: 'load' });
    await new Promise(function(r) { setTimeout(r, 500); });

    // Get marker positions via getBoundingClientRect + scrollY
    var markers = await page.evaluate(function() {
      var results = [];
      for (var i = 1; i <= 5; i++) {
        var el = document.getElementById('m' + i);
        var r = el.getBoundingClientRect();
        results.push({
          id: 'm' + i,
          dom: { left: Math.round(r.left + window.scrollX), top: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) },
          expected: { left: parseInt(el.style.left), top: parseInt(el.style.top) }
        });
      }
      return results;
    });

    console.log('\n--- Marker positions (getBoundingClientRect + scrollY) ---');
    markers.forEach(function(m) {
      log(m.dom.left === m.expected.left, m.id + ': dom.left=' + m.dom.left + ' expected=' + m.expected.left);
      log(m.dom.top === m.expected.top, m.id + ': dom.top=' + m.dom.top + ' expected=' + m.expected.top);
    });

    // Now load modern-screenshot and capture via domToCanvas
    console.log('\n--- domToCanvas capture test ---');
    var captureResult = await page.evaluate(function() {
      return new Promise(function(resolve) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js';
        s.onload = function() {
          var ms = window.modernScreenshot;
          if (!ms || !ms.domToCanvas) { resolve({ error: 'no modernScreenshot' }); return; }

          // Scroll to middle of page first (simulating pre-scroll)
          window.scrollTo(0, 2000);

          setTimeout(function() {
            // Now scroll back to 0 and capture
            document.documentElement.style.scrollBehavior = 'auto';
            window.scrollTo(0, 0);
            var scrollAfterReset = window.scrollY;

            ms.domToCanvas(document.documentElement, { scale: 0.5, timeout: 8000 }).then(function(canvas) {
              var ctx = canvas.getContext('2d', { willReadFrequently: true });
              var scale = 0.5;

              // For each marker, check if the RED pixel is at the expected canvas position
              var results = [];
              var markerPositions = [
                { id: 'm1', left: 100, top: 50, w: 200, h: 30 },
                { id: 'm2', left: 50, top: 500, w: 300, h: 40 },
                { id: 'm3', left: 200, top: 1500, w: 150, h: 25 },
                { id: 'm4', left: 100, top: 3000, w: 250, h: 35 },
                { id: 'm5', left: 150, top: 4500, w: 180, h: 28 }
              ];

              markerPositions.forEach(function(m) {
                // Expected canvas position
                // Sample at the CENTER of the marker
                var cx = Math.round((m.left + m.w / 2) * scale);
                var cy = Math.round((m.top + m.h / 2) * scale);

                // Sample pixel at expected position
                var pixel = ctx.getImageData(cx, cy, 1, 1).data;
                var isRed = pixel[0] > 200 && pixel[1] < 50 && pixel[2] < 50;

                // If not red, scan vertically to find where the red actually is
                var actualY = -1;
                if (!isRed) {
                  for (var scanY = Math.max(0, cy - 50); scanY < Math.min(canvas.height, cy + 50); scanY++) {
                    var p = ctx.getImageData(cx, scanY, 1, 1).data;
                    if (p[0] > 200 && p[1] < 50 && p[2] < 50) { actualY = scanY; break; }
                  }
                }

                results.push({
                  id: m.id,
                  expectedCanvasXY: { x: cx, y: cy },
                  pixelAtExpected: { r: pixel[0], g: pixel[1], b: pixel[2] },
                  isRedAtExpected: isRed,
                  actualRedY: actualY,
                  offsetY: actualY >= 0 ? (cy - actualY) : 0
                });
              });

              resolve({
                canvasSize: { width: canvas.width, height: canvas.height },
                scrollAfterReset: scrollAfterReset,
                docHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                actualScaleX: canvas.width / window.innerWidth,
                actualScaleY: canvas.height / Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
                markers: results
              });
            }).catch(function(e) { resolve({ error: e.message }); });
          }, 200);
        };
        s.onerror = function() { resolve({ error: 'failed to load library' }); };
        document.head.appendChild(s);
      });
    });

    if (captureResult.error) {
      console.log('  ERROR: ' + captureResult.error);
    } else {
      console.log('  Canvas: ' + captureResult.canvasSize.width + 'x' + captureResult.canvasSize.height);
      console.log('  Viewport: ' + captureResult.viewportWidth + 'x' + captureResult.viewportHeight);
      console.log('  DocHeight: ' + captureResult.docHeight);
      console.log('  ScrollY after reset: ' + captureResult.scrollAfterReset);
      console.log('  Actual scaleX: ' + captureResult.actualScaleX.toFixed(6) + ' (nominal: 0.5)');
      console.log('  Actual scaleY: ' + captureResult.actualScaleY.toFixed(6) + ' (nominal: 0.5)');
      console.log('');

      captureResult.markers.forEach(function(m) {
        if (m.isRedAtExpected) {
          log(true, m.id + ': RED found at expected canvas position (' + m.expectedCanvasXY.x + ',' + m.expectedCanvasXY.y + ')');
        } else {
          var msg = m.id + ': NOT red at expected (' + m.expectedCanvasXY.x + ',' + m.expectedCanvasXY.y + ') — got rgb(' + m.pixelAtExpected.r + ',' + m.pixelAtExpected.g + ',' + m.pixelAtExpected.b + ')';
          if (m.actualRedY >= 0) {
            msg += ' — RED found at Y=' + m.actualRedY + ' (offset: ' + m.offsetY + 'px in canvas, ' + (m.offsetY * 2) + 'px in DOM)';
          } else {
            msg += ' — RED not found within ±50px scan';
          }
          log(false, msg);
        }
      });
    }

    await page.close();

    // Test 2: Page with sticky header
    console.log('\n--- Test with sticky header ---');
    var page2 = await browser.newPage();
    await page2.setViewport({ width: 1280, height: 900 });

    var STICKY_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<style>body{margin:0;padding:0;background:#fff}' +
      'header{position:sticky;top:0;height:60px;background:#333;color:#fff;z-index:10;display:flex;align-items:center;padding:0 20px}' +
      '.content{padding:20px}' +
      '.marker{background:red;color:#fff;padding:4px 8px;margin:20px 0;display:inline-block}' +
      '</style></head><body>' +
      '<header>Sticky Header (60px)</header>' +
      '<div class="content">' +
      '<div class="marker" id="s1">Below header</div>' +
      '<div style="height:2000px"></div>' +
      '<div class="marker" id="s2">Deep in page</div>' +
      '<div style="height:2000px"></div>' +
      '<div class="marker" id="s3">Near bottom</div>' +
      '<div style="height:500px"></div>' +
      '</div></body></html>';

    await page2.setContent(STICKY_HTML, { waitUntil: 'load' });
    await new Promise(function(r) { setTimeout(r, 300); });

    var stickyResult = await page2.evaluate(function() {
      return new Promise(function(resolve) {
        // Get bbox positions at scroll=0
        var positions = [];
        ['s1', 's2', 's3'].forEach(function(id) {
          var el = document.getElementById(id);
          var r = el.getBoundingClientRect();
          positions.push({
            id: id,
            bboxTop: Math.round(r.top + window.scrollY),
            bboxLeft: Math.round(r.left + window.scrollX)
          });
        });

        // Load modern-screenshot and capture
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js';
        s.onload = function() {
          window.modernScreenshot.domToCanvas(document.documentElement, { scale: 0.5, timeout: 8000 }).then(function(canvas) {
            var ctx = canvas.getContext('2d', { willReadFrequently: true });
            var results = [];
            positions.forEach(function(p) {
              // Sample at center of where the marker element should be
              var el = document.getElementById(p.id);
              var r = el.getBoundingClientRect();
              var cx = Math.round((r.left + r.width / 2) * 0.5);
              var cy = Math.round((r.top + window.scrollY + r.height / 2) * 0.5);
              var pixel = ctx.getImageData(cx, cy, 1, 1).data;
              var isRed = pixel[0] > 200 && pixel[1] < 80 && pixel[2] < 80;
              var actualY = -1;
              if (!isRed) {
                for (var scan = Math.max(0, cy - 100); scan < Math.min(canvas.height, cy + 100); scan++) {
                  var sp = ctx.getImageData(cx, scan, 1, 1).data;
                  if (sp[0] > 200 && sp[1] < 80 && sp[2] < 80) { actualY = scan; break; }
                }
              }
              results.push({
                id: p.id,
                bboxTop: p.bboxTop,
                canvasY: cy,
                isRedAtExpected: isRed,
                actualRedY: actualY,
                offsetPx: actualY >= 0 ? (cy - actualY) : 0,
                offsetDOM: actualY >= 0 ? ((cy - actualY) * 2) : 0
              });
            });
            resolve({ canvasSize: { w: canvas.width, h: canvas.height }, docHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight), results: results });
          });
        };
        document.head.appendChild(s);
      });
    });

    if (stickyResult) {
      console.log('  Canvas: ' + stickyResult.canvasSize.w + 'x' + stickyResult.canvasSize.h + ', DocHeight: ' + stickyResult.docHeight);
      stickyResult.results.forEach(function(r) {
        if (r.isRedAtExpected) {
          log(true, r.id + ': aligned at canvas Y=' + r.canvasY + ' (dom.top=' + r.bboxTop + ')');
        } else {
          log(false, r.id + ': OFF by ' + r.offsetPx + 'px canvas (' + r.offsetDOM + 'px DOM) — bbox.top=' + r.bboxTop + ', expectedY=' + r.canvasY + ', actualY=' + r.actualRedY);
        }
      });
    }

    await page2.close();
  } catch(e) {
    console.error('FATAL:', e.message);
    failed++;
  }

  await browser.close();
  server.close();

  console.log('\n========================================');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  console.log('========================================');
  process.exit(failed > 0 ? 1 : 0);
}

run();
