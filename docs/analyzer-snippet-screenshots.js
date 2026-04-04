// make-it-look-good — Design Extraction Snippet (with screenshots)
// Version: 2026-04-04-v26
// Run this in the browser console on any page.
// Loads extraction engine from CDN (single source of truth), then captures screenshots.
// Output is larger (~200-800KB extra) but includes visual reference.
// Then paste into the analyzer at: https://jdeworks.github.io/make-it-look-good/analyzer.html

(function() {
  'use strict';
  var _MILG_VERSION = '2026-04-04-v26';
  console.log('%c[milg] Snippet version: ' + _MILG_VERSION, 'color: #64748b;');

  // --- Pixel verify option ---
  // Set window.__milgPixelVerify = true before running to enable inline pixel contrast verification.
  // Default: off (the analyzer can run pixel verify post-hoc from screenshots).
  var _doPixelVerify = !!window.__milgPixelVerify;

  // --- Auto-scroll option ---
  // To scroll the page before extraction (triggers lazy loading + intersection observers):
  // Run: window.__milgScrollFirst = true   then paste the snippet.
  // The snippet will scroll the full page, wait for content to load, then extract.
  if (window.__milgScrollFirst && !window.__milgScrollDone) {
    window.__milgScrollDone = true;
    console.log('%c\u23F3 Scrolling page to trigger lazy loading and intersection observers...', 'color: #3b82f6; font-weight: bold;');
    var _scrollH = document.body.scrollHeight;
    var _pos = 0;
    var _step = Math.max(window.innerHeight * 0.8, 400);
    var _si = setInterval(function() {
      _pos += _step;
      window.scrollTo(0, _pos);
      if (_pos >= _scrollH) {
        clearInterval(_si);
        setTimeout(function() { window.scrollTo(0, 0); }, 300);
        // Wait for newly loaded content, then user must re-run snippet
        setTimeout(function() {
          console.log('%c\u2713 Scroll complete! Page content should now be fully loaded.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
          console.log('%cRe-run the snippet now for complete analysis.', 'color: #3b82f6;');
          window.__milgScrollFirst = false;
        }, 1500);
      }
    }, 150);
    return; // Exit — re-run snippet after scroll completes
  }

  // --- Load extraction engine from CDN (single source of truth) ---
  console.log('%c[milg] Loading extraction engine...', 'color: #3b82f6;');
  // Cache-bust with hourly bucket so deploys take effect within ~1 hour
  var _cacheBust = 'v=' + Math.floor(Date.now() / 3600000);
  // Primary: jsDelivr (fast global CDN, mirrors GitHub). Fallback: GitHub Pages direct.
  var _extractUrls = [
    'https://cdn.jsdelivr.net/gh/jdeworks/make-it-look-good@dev/docs/analyzer-extract.js?' + _cacheBust,
    'https://jdeworks.github.io/make-it-look-good/analyzer-extract.js?' + _cacheBust
  ];

  if (window.MilgExtract) {
    _runExtraction();
  } else {
    (function _tryLoad(idx) {
      if (idx >= _extractUrls.length) {
        console.error('[milg] Cannot load extraction engine from any CDN.');
        return;
      }
      var url = _extractUrls[idx];
      console.log('[milg] Fetching:', url.split('?')[0]);
      fetch(url).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function(code) {
        (new Function(code))();
        if (!window.MilgExtract) throw new Error('MilgExtract not defined after eval');
        _runExtraction();
      }).catch(function(err) {
        console.warn('[milg] CDN ' + (idx + 1) + ' failed:', err.message || err);
        _tryLoad(idx + 1);
      });
    })(0);
  }

  function _runExtraction() {
    window.__milgOnExtractComplete = function(data) {
      window.__milgData = data;
      console.log('%c[milg] Extraction complete, starting screenshot capture...', 'color: #3b82f6;');

  // --- Screenshot capture ---
  // The modern-screenshot library is loaded inline to bypass CSP restrictions.
  // Console-pasted code is executed directly by the engine, not subject to CSP script-src.
  console.log('%c\uD83D\uDCF8 Capturing screenshots...', 'color: #3b82f6; font-weight: bold; font-size: 14px;');

  // Inline modern-screenshot library (loaded from separate file at build time)
  // This block is replaced by scripts/build-screenshot-snippet.sh
  // __INLINE_MODERN_SCREENSHOT_START__
  try {
    var _msScript = document.createElement('script');
    _msScript.src = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js';
    var _msLoaded = new Promise(function(resolve, reject) {
      _msScript.onload = resolve;
      _msScript.onerror = function() {
        // CDN blocked by CSP — try inline fallback via fetch + eval (works if unsafe-eval allowed)
        // Otherwise fall back gracefully
        console.log('%c\u26A0 CDN blocked by CSP. Trying fetch fallback...', 'color: #b45309;');
        fetch('https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js')
          .then(function(r) { return r.text(); })
          .then(function(code) { (new Function(code))(); resolve(); })
          .catch(function() {
            console.log('%c\u26A0 Screenshot library unavailable on this site (CSP blocks external scripts and eval).', 'color: #b45309;');
            console.log('%cScreenshots skipped. The design data extraction still works \u2014 just paste into the analyzer.', 'color: #64748b;');
            reject();
          });
      };
    });
    document.head.appendChild(_msScript);
  } catch(e) { var _msLoaded = Promise.reject(); }

  _msLoaded.then(function() {
    var ms = window.modernScreenshot;
    if (!ms || !ms.domToCanvas) {
      console.log('%c\u26A0 Screenshot API not found. Skipping.', 'color: #b45309;');
      data.screenshots = [];
      outputData(data);
      return;
    }

    var totalH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var vh = window.innerHeight || 900;
    var captureH = Math.min(totalH, 32000);

    var _ssStart = Date.now();
    function _t() { return '[' + ((Date.now() - _ssStart) / 1000).toFixed(1) + 's] '; }
    // Cap at 10 viewports for the full capture (avoid huge canvases on very long pages)
    captureH = Math.min(captureH, vh * 10);
    var numSections = Math.ceil(captureH / vh);
    console.log('[ss] ' + _t() + 'totalH=' + totalH + ' vh=' + vh + ' captureH=' + captureH + ' sections=' + numSections);

    // Show overlay so users aren't confused during capture
    var _overlay = document.createElement('div');
    _overlay.setAttribute('data-milg-overlay', '1');
    _overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
    _overlay.innerHTML = '<div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:milg-spin 0.8s linear infinite"></div>' +
      '<div id="milg-ss-status" style="color:#fff;margin-top:16px;font-size:14px;font-weight:500">Preparing screenshots...</div>' +
      '<div style="color:rgba(255,255,255,0.6);margin-top:6px;font-size:12px">Scrolling page to load all content, then capturing</div>' +
      '<style>@keyframes milg-spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(_overlay);
    var _ssFilter = function(el) { return !el.getAttribute || !el.getAttribute('data-milg-overlay'); };
    var _origScrollY = window.scrollY;

    // Phase 1: Pre-scroll the entire page to trigger ALL lazy content, IntersectionObservers, etc.
    console.log('[ss] ' + _t() + 'Phase 1: Pre-scrolling page to trigger lazy content...');
    var _preScrollPositions = [];
    for (var _ps = 0; _ps < captureH; _ps += vh) _preScrollPositions.push(_ps);
    var _psIdx = 0;
    function _preScrollNext() {
      if (_psIdx >= _preScrollPositions.length) {
        // All positions scrolled — wait for content to finish loading
        console.log('[ss] ' + _t() + 'Phase 1 complete. Waiting for lazy content to finish loading...');
        var statusEl = document.getElementById('milg-ss-status');
        if (statusEl) statusEl.textContent = 'Waiting for images to load...';
        setTimeout(function() { _startCapture(); }, 500);
        return;
      }
      var scrollY = _preScrollPositions[_psIdx];
      window.scrollTo(0, scrollY);
      try { window.dispatchEvent(new Event('scroll')); } catch(e) {}
      var statusEl = document.getElementById('milg-ss-status');
      if (statusEl) statusEl.textContent = 'Loading content... (section ' + (_psIdx + 1) + '/' + _preScrollPositions.length + ')';
      _psIdx++;
      setTimeout(_preScrollNext, 200); // 200ms per scroll position
    }
    _preScrollNext();

    // Phase 2: Capture the full page as one big canvas, then split into sections
    function _startCapture() {
      // Force instant scroll to 0 on ALL scroll containers
      // Some pages use a div with overflow:auto as the main scroll container,
      // so window.scrollTo(0,0) alone doesn't reset scroll position.
      var origScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      document.body.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      // Reset any overflow scroll containers
      document.querySelectorAll('*').forEach(function(el) {
        if (el.scrollTop > 0) {
          var s = getComputedStyle(el);
          if (s.overflow === 'auto' || s.overflow === 'scroll' || s.overflowY === 'auto' || s.overflowY === 'scroll') {
            el.style.scrollBehavior = 'auto';
            el.scrollTop = 0;
          }
        }
      });
      var actualScroll = Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop);

      var statusEl = document.getElementById('milg-ss-status');
      if (statusEl) statusEl.textContent = 'Waiting for animations to settle...';
      console.log('[ss] ' + _t() + 'Waiting 1.5s for animations to settle...');

      setTimeout(function() {
      // Re-read all bboxes using the extraction engine's exported function
      // This compensates for CSS transforms and propagates to fontSizes entries
      if (typeof window.__milgReReadBboxes === 'function') {
        var bboxResult = window.__milgReReadBboxes();
        console.log('[ss] ' + _t() + 'Updated bboxes after animations settled: ' + bboxResult);
      }

      console.log('[ss] ' + _t() + 'Phase 2: Capturing full page (' + captureH + 'px), scrollY=' + actualScroll + '...');
      var statusEl = document.getElementById('milg-ss-status');
      if (statusEl) statusEl.textContent = 'Rendering page to canvas...';

      ms.domToCanvas(document.documentElement, {
        scale: 1.5,
        filter: _ssFilter,
        timeout: 45000
      }).then(function(fullCanvas) {
        console.log('[ss] ' + _t() + 'Full canvas captured: ' + fullCanvas.width + 'x' + fullCanvas.height);

        var secScale = 1.5;

        // Log final scroll state for diagnostics
        console.log('[ss] Scroll state at capture: window=' + window.scrollY + ', html=' + document.documentElement.scrollTop + ', body=' + document.body.scrollTop);

        var calibOffset = 0;

        // Store full-page canvas as single WebP — used by both report and viewer
        var fullPageDataUri;
        try {
          fullPageDataUri = fullCanvas.toDataURL('image/webp', 0.8);
          console.log('[ss] ' + _t() + 'Full-page WebP: ' + Math.round(fullPageDataUri.length / 1024) + 'KB');
        } catch(e) {
          console.warn('[ss] Full-page WebP failed:', e.message);
          fullPageDataUri = '';
        }

        window.scrollTo(0, _origScrollY);
        if (_overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
        data.screenshots = fullPageDataUri ? [fullPageDataUri] : [];
        data.screenshotFull = fullPageDataUri || null;

        (function finalize() {
            var captureDocH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            document.documentElement.style.scrollBehavior = origScrollBehavior;
            // (transitions restored naturally — no override injected)
            data.screenshotMeta = {
              scale: secScale,
              viewportHeight: vh,
              sectionCount: data.screenshots.length,
              canvasWidth: fullCanvas.width,
              canvasHeight: fullCanvas.height,
              docHeightAtCapture: captureDocH,
              docHeightAtExtraction: data.meta.docHeight || captureDocH,
              captureScrollY: actualScroll,
              calibrationOffsetY: calibOffset,
              calibrationSamples: []
            };
            // --- Pixel contrast verification on the pristine full canvas ---
            // Runs on the raw canvas BEFORE WebP compression, so no artifacts.
            // Inline pixel contrast verification (opt-in via window.__milgPixelVerify).
            // When disabled, the analyzer runs pixel verify post-hoc from screenshots.
            if (!_doPixelVerify) { /* skip inline pixel verify */ } else (function() {
              var pairs = data.colors.contrastPairs || [];
              var pairsWithBbox = pairs.filter(function(p) { return p.bbox; });
              if (pairsWithBbox.length === 0) return;

              var fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
              var FG_DIST_SQ = 8100; // 90^2 — pixels within this RGB distance from CSS fg are excluded as "text"

              function parseRgbStr(str) {
                var m = str.match(/rgb[a]?\((\d+),\s*(\d+),\s*(\d+)/);
                if (!m) m = str.match(/rgb[a]?\((\d+)\s+(\d+)\s+(\d+)/);
                return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
              }
              function lum(c) {
                var rs = c.r / 255, gs = c.g / 255, bs = c.b / 255;
                var r = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
                var g = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
                var b = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
              }
              function cr(c1, c2) {
                var l1 = lum(c1), l2 = lum(c2);
                return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
              }

              var results = [];
              pairsWithBbox.forEach(function(pair) {
                var cssFg = parseRgbStr(pair.fg);
                var cssBg = parseRgbStr(pair.bg);
                if (!cssFg) return;

                // Map bbox to canvas coordinates
                var cx = Math.round(pair.bbox.left * secScale);
                var cy = Math.round(pair.bbox.top * secScale);
                var cw = Math.round(pair.bbox.width * secScale);
                var ch = Math.round(pair.bbox.height * secScale);

                // Clamp to canvas bounds
                if (cx < 0) { cw += cx; cx = 0; }
                if (cy < 0) { ch += cy; cy = 0; }
                if (cx + cw > fullCanvas.width) cw = fullCanvas.width - cx;
                if (cy + ch > fullCanvas.height) ch = fullCanvas.height - cy;
                if (cw < 2 || ch < 2) return;

                // Read all pixels in the bbox at once
                var imgData = fullCtx.getImageData(cx, cy, cw, ch);
                var px = imgData.data;
                var totalPixels = cw * ch;

                // Classify pixels: exclude fg-like pixels, quantize background candidates
                var buckets = {}; // key "r,g,b" quantized to 4-bit → {count, rSum, gSum, bSum}
                var bgCount = 0;
                var worstBg = null, worstRatio = 999;

                for (var i = 0; i < px.length; i += 4) {
                  var r = px[i], g = px[i + 1], b = px[i + 2];
                  // Distance from CSS foreground color
                  var dr = r - cssFg.r, dg = g - cssFg.g, db = b - cssFg.b;
                  var distSq = dr * dr + dg * dg + db * db;
                  if (distSq < FG_DIST_SQ) continue; // Skip — this is a text/anti-aliased pixel

                  bgCount++;
                  // Quantize to 4-bit buckets (16 levels per channel → 4096 buckets)
                  var qr = (r >> 4), qg = (g >> 4), qb = (b >> 4);
                  var key = (qr << 8) | (qg << 4) | qb;
                  if (!buckets[key]) buckets[key] = { count: 0, rSum: 0, gSum: 0, bSum: 0 };
                  buckets[key].count++;
                  buckets[key].rSum += r;
                  buckets[key].gSum += g;
                  buckets[key].bSum += b;
                }

                if (bgCount < 10) return; // Too few bg pixels — skip

                // Find dominant background (largest bucket)
                var maxBucket = null, maxCount = 0;
                for (var bk in buckets) {
                  if (buckets[bk].count > maxCount) { maxCount = buckets[bk].count; maxBucket = buckets[bk]; }
                }
                if (!maxBucket) return;

                var dominantBg = {
                  r: Math.round(maxBucket.rSum / maxBucket.count),
                  g: Math.round(maxBucket.gSum / maxBucket.count),
                  b: Math.round(maxBucket.bSum / maxBucket.count)
                };

                var dominantRatio = cr(cssFg, dominantBg);

                // Also find worst-case ratio (smallest bucket that's significantly different)
                var allBuckets = [];
                for (var bk2 in buckets) {
                  if (buckets[bk2].count < totalPixels * 0.01) continue; // Skip tiny noise buckets
                  var avg = {
                    r: Math.round(buckets[bk2].rSum / buckets[bk2].count),
                    g: Math.round(buckets[bk2].gSum / buckets[bk2].count),
                    b: Math.round(buckets[bk2].bSum / buckets[bk2].count)
                  };
                  allBuckets.push({ bg: avg, count: buckets[bk2].count, ratio: cr(cssFg, avg) });
                }
                allBuckets.sort(function(a, b) { return a.ratio - b.ratio; });
                worstRatio = allBuckets.length > 0 ? allBuckets[0].ratio : dominantRatio;
                worstBg = allBuckets.length > 0 ? allBuckets[0].bg : dominantBg;

                // Check if CSS bg matches pixel bg (confirms CSS is accurate)
                var cssBgConfirmed = false;
                if (cssBg) {
                  var dbr = dominantBg.r - cssBg.r, dbg = dominantBg.g - cssBg.g, dbb = dominantBg.b - cssBg.b;
                  cssBgConfirmed = (dbr * dbr + dbg * dbg + dbb * dbb) < 2500; // within ~50 RGB distance
                }

                // Determine if there's a real gradient/image behind text
                var isVariableBg = allBuckets.length > 3 && maxCount < bgCount * 0.6;

                var cssRatio = pair.ratio || 0;
                var pixelPasses = worstRatio >= 4.5;
                var cssPasses = cssRatio >= 4.5;

                // Store pixel verification data on the pair itself
                pair.pixelVerify = {
                  dominantBg: 'rgb(' + dominantBg.r + ',' + dominantBg.g + ',' + dominantBg.b + ')',
                  dominantRatio: dominantRatio,
                  worstRatio: worstRatio,
                  bgSamples: bgCount,
                  uniqueBuckets: allBuckets.length,
                  cssBgConfirmed: cssBgConfirmed,
                  isVariableBg: isVariableBg,
                  crossesBoundary: cssPasses !== pixelPasses
                };

                if (pair.pixelVerify.crossesBoundary || isVariableBg || Math.abs(dominantRatio - cssRatio) > 1.5) {
                  results.push({
                    selector: pair.selector,
                    text: pair.text,
                    cssRatio: cssRatio,
                    pixelRatio: worstRatio,
                    pixelRatioAvg: dominantRatio,
                    cssPasses: cssPasses,
                    pixelPasses: pixelPasses,
                    crossesBoundary: cssPasses !== pixelPasses,
                    isVariableBg: isVariableBg,
                    significant: true,
                    bgSamples: bgCount,
                    pixelBgDominant: pair.pixelVerify.dominantBg,
                    cssBgConfirmed: pair.pixelVerify.cssBgConfirmed
                  });
                }
              });

              data.pixelVerifyResults = results;
              console.log('[ss] ' + _t() + 'Pixel contrast verified: ' + pairsWithBbox.length + ' pairs, ' + results.length + ' discrepancies');
            })();

            console.log('%c\u2713 Screenshot captured (' + _t().trim() + ')', 'color: #16a34a; font-weight: bold;');
            outputData(data);
        })();

      }).catch(function(err) {
        console.log('[ss] ' + _t() + '\u2717 Full page capture failed: ' + (err && err.message || err));
        window.scrollTo(0, _origScrollY);
        if (_overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
        data.screenshots = [];
        outputData(data);
      });
    }, 1500); // end setTimeout — wait for animations
    }
  }).catch(function() {
    data.screenshots = [];
    outputData(data);
  });

  function outputData(data) {
    var json = JSON.stringify(data);
    var jsonKB = Math.round(json.length / 1024);
    var jsonMB = (json.length / 1024 / 1024).toFixed(1);
    console.log('[clipboard] JSON size: ' + jsonKB + ' KB (' + jsonMB + ' MB)');
    window.__milgData = data;
    window.__milgData_json = json;

    // Show overlay with copy button (user click = real gesture = clipboard works reliably)
    var _copyOverlay = document.createElement('div');
    _copyOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
    _copyOverlay.innerHTML = '<div style="text-align:center;max-width:400px;padding:20px">' +
      '<div style="font-size:32px;margin-bottom:12px">&#10003;</div>' +
      '<div style="color:#fff;font-size:18px;font-weight:600;margin-bottom:6px">Extraction complete!</div>' +
      '<div style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:6px">' + jsonKB + ' KB of design data' + (data.screenshotFull ? ' + full-page screenshot' : '') + '</div>' +
      (jsonKB > 2048 ? '<div style="color:#fbbf24;font-size:12px;margin-bottom:16px">&#9888; Large payload (' + jsonMB + ' MB) \u2014 paste may take a moment</div>' : '<div style="margin-bottom:16px"></div>') +
      '<button id="milg-copy-btn" style="padding:14px 32px;font-size:15px;font-weight:600;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:8px;min-width:200px">Copy to Clipboard</button>' +
      '<button id="milg-download-btn" style="padding:10px 24px;font-size:13px;font-weight:500;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;margin-bottom:12px;min-width:200px">Download JSON</button>' +
      '<div style="color:rgba(255,255,255,0.4);font-size:11px">Then paste or import into the analyzer</div>' +
      '</div>';
    document.body.appendChild(_copyOverlay);

    document.getElementById('milg-copy-btn').addEventListener('click', function() {
      var btn = document.getElementById('milg-copy-btn');
      btn.textContent = 'Copying...';
      btn.disabled = true;

      function onSuccess() {
        btn.textContent = 'Copied!';
        btn.style.background = '#16a34a';
        console.log('%c\u2713 Design data copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
        setTimeout(function() { if (_copyOverlay.parentNode) _copyOverlay.parentNode.removeChild(_copyOverlay); }, 800);
      }
      function onFail() {
        btn.textContent = 'Copy failed \u2014 use console';
        btn.style.background = '#dc2626';
        console.log('%c\u26A0 Clipboard copy failed. Type: copy(window.__milgData_json)', 'color: #b45309; font-weight: bold;');
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(onSuccess).catch(function() {
          // Fallback
          try {
            var ta = document.createElement('textarea'); ta.value = json;
            ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy') ? onSuccess() : onFail();
            document.body.removeChild(ta);
          } catch(e) { onFail(); }
        });
      } else {
        try {
          var ta = document.createElement('textarea'); ta.value = json;
          ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy') ? onSuccess() : onFail();
          document.body.removeChild(ta);
        } catch(e) { onFail(); }
      }
    });

    // Download button (works for any size, no clipboard limit)
    document.getElementById('milg-download-btn').addEventListener('click', function() {
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var siteName = (data.meta && data.meta.url) || location.hostname;
      a.download = 'milg-report-' + siteName.replace(/[^a-z0-9]/gi, '-').substring(0, 40) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      var btn = document.getElementById('milg-download-btn');
      btn.textContent = 'Downloaded!';
      btn.style.background = '#16a34a'; btn.style.color = '#fff'; btn.style.borderColor = '#16a34a';
    });

    console.log('%cmake-it-look-good extraction complete (with screenshots)', 'color: #3b82f6; font-weight: bold;');
    console.log('Elements scanned:', data.structure.totalElements);
    console.log('Screenshots:', (data.screenshots || []).length);
    console.log('Total JSON size:', jsonKB, 'KB');

    // --- Site Crawl Mode (same-origin iframe with src=, full JS execution) ---
    if (window.__milgCrawlSite) {
      var _cm = Math.min(Math.max(window.__milgCrawlMaxPages || 5, 1), 25);
      var _cb = window.__milgCrawlBlacklist || [];
      var _co = location.origin;
      var _seen = {};
      var _curPath = location.pathname.replace(/\/$/, '');
      _seen[_co + _curPath] = true;
      // Also mark index variants as seen to avoid re-crawling the current page
      if (_curPath === '' || _curPath === '/index.html' || _curPath === '/index.htm') {
        _seen[_co] = true; _seen[_co + '/index.html'] = true; _seen[_co + '/index.htm'] = true;
      }
      var _links = [];
      document.querySelectorAll('a[href]').forEach(function(a) {
        var h = a.getAttribute('href');
        if (!h || h.startsWith('#') || h.startsWith('mailto:') || h.startsWith('tel:') || h.startsWith('javascript:')) return;
        try { var u = new URL(h, location.href); if (u.origin !== _co) return; if (/\.(pdf|zip|png|jpg|svg|css|js|json|xml|woff2?)$/i.test(u.pathname)) return; u.hash = ''; var k = u.origin + u.pathname.replace(/\/$/, ''); if (_seen[k]) return; var bl = _cb.some(function(p) { p = p.trim(); if (!p) return false; if (p.endsWith('*')) return u.pathname.startsWith(p.slice(0, -1)); return u.pathname === p; }); if (bl) return; _seen[k] = true; _links.push(u.origin + u.pathname); } catch(e) {}
      });
      _links = _links.slice(0, _cm - 1);
      var _cResults = [{ url: location.href, data: data }];
      console.log('%c\uD83D\uDD77 Site Crawl: discovered ' + _links.length + ' page(s)', 'color: #8b5cf6; font-weight: bold;');

      // Copy full crawl results to clipboard (localStorage doesn't work cross-origin)
      function _copyCrawlResults(results) {
        var crawlJson = JSON.stringify({ _milgCrawl: true, startUrl: location.href, results: results });
        console.log('[crawl] Total crawl JSON: ' + Math.round(crawlJson.length / 1024) + ' KB');
        window.__milgCrawlResults = results;
        window.__milgCrawlJson = crawlJson;
        try { localStorage.setItem('milg-crawl-complete', crawlJson); } catch(e) {}
        // Try clipboard (both methods may fail — console loses focus/gesture context)
        function _crawlCopyFallback() {
          var ta = document.createElement('textarea'); ta.value = crawlJson;
          ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
          document.body.appendChild(ta); ta.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch(e) {}
          document.body.removeChild(ta);
          if (ok) {
            console.log('%c\u2713 Crawl results copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
          } else {
            console.log('%c\u26A0 Auto-copy failed. Type: copy(window.__milgCrawlJson)', 'color: #b45309; font-weight: bold;');
            console.log('%cThen paste into the analyzer.', 'color: #3b82f6;');
          }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(crawlJson).then(function() {
            console.log('%c\u2713 Crawl results copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
          }).catch(_crawlCopyFallback);
        } else {
          _crawlCopyFallback();
        }
      }

      if (_links.length === 0) {
        _copyCrawlResults(_cResults);
        console.log('%c\u2713 Crawl complete (1 page).', 'color: #16a34a; font-weight: bold;');
      } else {
        // Show crawl progress overlay
        var _crawlOverlay = document.createElement('div');
        _crawlOverlay.setAttribute('data-milg-overlay', '1');
        _crawlOverlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
        _crawlOverlay.innerHTML = '<div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:milg-spin 0.8s linear infinite"></div>' +
          '<div id="milg-crawl-status" style="color:#fff;margin-top:16px;font-size:14px;font-weight:500">Crawling site...</div>' +
          '<div id="milg-crawl-detail" style="color:rgba(255,255,255,0.6);margin-top:6px;font-size:12px">Loading extraction snippet...</div>' +
          '<style>@keyframes milg-spin{to{transform:rotate(360deg)}}</style>';
        document.body.appendChild(_crawlOverlay);
        function _updateCrawlOverlay(status, detail) {
          var s = document.getElementById('milg-crawl-status'); if (s) s.textContent = status;
          var d = document.getElementById('milg-crawl-detail'); if (d) d.textContent = detail;
        }
        function _removeCrawlOverlay() { if (_crawlOverlay.parentNode) _crawlOverlay.parentNode.removeChild(_crawlOverlay); }

        var _ssUrl = 'https://jdeworks.github.io/make-it-look-good/analyzer-snippet-screenshots.js?' + _cacheBust;
        fetch(_ssUrl).then(function(r) { return r.text(); }).then(function(snippetSrc) {
          function _next(idx) {
            if (idx >= _links.length) {
              // Prepare data but show copy button (auto-copy fails in async context)
              var crawlJson = JSON.stringify({ _milgCrawl: true, startUrl: location.href, results: _cResults });
              window.__milgCrawlResults = _cResults;
              window.__milgCrawlJson = crawlJson;
              try { localStorage.setItem('milg-crawl-complete', crawlJson); } catch(e) {}
              console.log('%c\u2713 Crawl complete! ' + _cResults.length + ' pages (' + Math.round(crawlJson.length / 1024) + ' KB)', 'color: #16a34a; font-weight: bold; font-size: 14px;');
              // Show copy + download buttons
              var _crawlKB = Math.round(crawlJson.length / 1024);
              _crawlOverlay.innerHTML = '<div style="text-align:center">' +
                '<div style="font-size:28px;margin-bottom:12px">\u2713</div>' +
                '<div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:6px">Crawl complete! ' + _cResults.length + ' pages analyzed.</div>' +
                '<div style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:' + (_crawlKB > 2048 ? '6' : '20') + 'px">' + _crawlKB + ' KB of design data ready</div>' +
                (_crawlKB > 2048 ? '<div style="color:#fbbf24;font-size:12px;margin-bottom:16px">&#9888; Large payload (' + Math.round(_crawlKB / 1024 * 10) / 10 + ' MB) \u2014 download recommended</div>' : '') +
                '<button id="milg-crawl-copy-btn" style="padding:12px 28px;font-size:14px;font-weight:600;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:8px;min-width:220px">Copy to Clipboard</button><br>' +
                '<button id="milg-crawl-dl-btn" style="padding:10px 24px;font-size:13px;font-weight:500;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;margin-bottom:10px;min-width:220px">Download JSON</button>' +
                '<div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:8px">Then paste or import into the analyzer</div>' +
                '</div>';
              document.getElementById('milg-crawl-copy-btn').addEventListener('click', function() {
                navigator.clipboard.writeText(crawlJson).then(function() {
                  document.getElementById('milg-crawl-copy-btn').textContent = 'Copied!';
                  document.getElementById('milg-crawl-copy-btn').style.background = '#16a34a';
                  setTimeout(_removeCrawlOverlay, 800);
                }).catch(function() {
                  // Fallback for older browsers
                  var ta = document.createElement('textarea'); ta.value = crawlJson;
                  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
                  document.body.appendChild(ta); ta.select();
                  try { document.execCommand('copy'); } catch(e) {}
                  document.body.removeChild(ta);
                  document.getElementById('milg-crawl-copy-btn').textContent = 'Copied!';
                  document.getElementById('milg-crawl-copy-btn').style.background = '#16a34a';
                  setTimeout(_removeCrawlOverlay, 800);
                });
              });
              // Download button for crawl
              document.getElementById('milg-crawl-dl-btn').addEventListener('click', function() {
                var blob = new Blob([crawlJson], { type: 'application/json' });
                var dlUrl = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = dlUrl;
                a.download = 'milg-crawl-' + location.hostname.replace(/[^a-z0-9]/gi, '-') + '.json';
                a.click();
                URL.revokeObjectURL(dlUrl);
                var btn = document.getElementById('milg-crawl-dl-btn');
                btn.textContent = 'Downloaded!'; btn.style.background = '#16a34a'; btn.style.color = '#fff';
              });
              return;
            }
            var url = _links[idx];
            var path; try { path = new URL(url).pathname; } catch(e) { path = url; }
            _updateCrawlOverlay('Crawling page ' + (idx + 1) + ' of ' + _links.length, path);
            console.log('%c\u2192 [' + (idx+1) + '/' + _links.length + '] ' + path, 'color: #3b82f6;');

            // Fetch page HTML (same-origin — we're on the site) then load as srcdoc
            fetch(url).then(function(r) {
              if (!r.ok) throw new Error('HTTP ' + r.status);
              return r.text();
            }).then(function(html) {
              // Srcdoc environment patches — same as analyzer's "Try with JS" mode:
              // URL constructor, History API, fetch for relative URLs
              var eu = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              var envPatch = '<script>(function(){' +
                'var _rb="' + eu + '";var _O=URL;' +
                'function _P(u,b){if(b){var bs=typeof b==="string"?b:String(b);if(bs==="about:srcdoc"||bs==="about:blank"||bs==="null"||bs.indexOf("about:")===0)b=_rb;}' +
                'if(!b&&typeof u==="string"&&u.charAt(0)==="/")return new _O(u,_rb);try{return arguments.length===1?new _O(u):new _O(u,b);}catch(e){try{return new _O(u,_rb);}catch(e2){throw e;}}}' +
                '_P.prototype=_O.prototype;_P.createObjectURL=_O.createObjectURL.bind(_O);_P.revokeObjectURL=_O.revokeObjectURL.bind(_O);if(_O.canParse)_P.canParse=_O.canParse.bind(_O);window.URL=_P;' +
                'var _hps=history.pushState.bind(history);var _hrs=history.replaceState.bind(history);' +
                'history.pushState=function(s,t,u){try{_hps(s,t,u);}catch(e){}};history.replaceState=function(s,t,u){try{_hrs(s,t,u);}catch(e){}};' +
                'var _of=window.fetch;window.fetch=function(u,o){if(typeof u==="string"&&u.charAt(0)==="/")u=_rb.replace(/\\/$/,"")+u;return _of.call(this,u,o);};' +
                '})();</' + 'script>';
              var baseTag = '<base href="' + url + '">';
              var headPatch = envPatch + baseTag;
              html = html.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');
              // Inject BEFORE the first <script> tag so patches run before any framework JS
              // (Next.js puts inline scripts immediately after <head>)
              if (/<script[\s>]/i.test(html)) {
                html = html.replace(/<script[\s>]/i, headPatch + '<script ');
              } else if (/<head[\s>]/i.test(html)) {
                html = html.replace(/<head([^>]*)>/i, '<head$1>' + headPatch);
              } else {
                html = headPatch + html;
              }

              var iframe = document.createElement('iframe');
              iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;';
              iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';
              document.body.appendChild(iframe);
              var done = false;
              function cleanup() { if (iframe.parentNode) document.body.removeChild(iframe); }

              iframe.addEventListener('load', function() {
                if (done) return;
                setTimeout(function() {
                  if (done) return;
                  try {
                    var iWin = iframe.contentWindow;
                    var iDoc = iframe.contentDocument || iWin.document;
                    var script = iDoc.createElement('script');
                    script.textContent = 'window.__milgCrawlSite=false;\n' + snippetSrc;
                    iDoc.body.appendChild(script);
                    var polls = 0;
                    var pi = setInterval(function() {
                      if (done) { clearInterval(pi); return; }
                      polls++;
                      try {
                        var d = iWin.__milgData;
                        if (d) { clearInterval(pi); done = true; d.meta.url = url; _cResults.push({ url: url, data: d }); cleanup(); console.log('%c  \u2713 ' + path, 'color: #16a34a;'); setTimeout(function() { _next(idx + 1); }, 500); }
                        else if (polls > 20) { clearInterval(pi); done = true; cleanup(); console.log('%c  \u2717 Timeout: ' + path, 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                      } catch(e) { clearInterval(pi); done = true; cleanup(); console.log('%c  \u2717 Error: ' + path + ' (' + e.message + ')', 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                    }, 500);
                  } catch(e) { done = true; cleanup(); console.log('%c  \u2717 Cannot inject snippet: ' + path + ' (' + e.message + ')', 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                }, 1500);
              });
              iframe.srcdoc = html;
              setTimeout(function() { if (done) return; done = true; cleanup(); console.log('%c  \u2717 Timeout (10s): ' + path, 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }, 10000);
            }).catch(function(e) {
              console.log('%c  \u2717 Fetch failed: ' + path + ' (' + (e.message || e) + ')', 'color: #dc2626;');
              setTimeout(function() { _next(idx + 1); }, 500);
            });
          }
          _next(0);
        }).catch(function() { _removeCrawlOverlay(); console.log('%c\u26A0 Could not fetch snippet for crawl.', 'color: #b45309;'); });
      }
      return; // Skip clipboard copy
    }
  }

    }; // end __milgOnExtractComplete callback

    // Run the extraction
    window.MilgExtract();
  }
})();
