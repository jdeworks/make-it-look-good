// make-it-look-good — Design Extraction Snippet (with screenshots)
// Version: v1.1
// Run this in the browser console on any page.
// Loads extraction engine from CDN (single source of truth), then captures screenshots.
// Output is larger (~200-800KB extra) but includes visual reference.
// Then paste into the analyzer at: https://jdeworks.github.io/make-it-look-good/analyzer.html

(function() {
  'use strict';
  var _MILG_VERSION = 'v1.1';
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

  // Cache-bust for CDN fetches (hourly bucket)
  var _cacheBust = 'v=' + Math.floor(Date.now() / 3600000);

  // --- Extraction engine (inlined by analyzer assembler) ---
  // @milg-insert: extract
  // --- Region screenshot module (inlined by analyzer assembler) ---
  // Defines window.MilgRegion (shared with URL/iframe mode). Must come AFTER
  // MilgExtract is defined so MilgRegion can self-inject it into mini-pages.
  // @milg-insert: region
  // --- Full-page capture + multi-layer mask core (inlined by analyzer assembler) ---
  // Defines window.MilgCapture (shared with URL/iframe mode). Must come BEFORE
  // capture runs so the snippet can call MilgCapture.getCaptureFn().
  // @milg-insert: capture
  _runExtraction();

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

    var _ssStart = Date.now();
    function _t() { return '[' + ((Date.now() - _ssStart) / 1000).toFixed(1) + 's] '; }

    // Show overlay so users aren't confused during capture
    var _overlay = document.createElement('div');
    _overlay.setAttribute('data-milg-overlay', '1');
    _overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
    _overlay.innerHTML = '<div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:milg-spin 0.8s linear infinite"></div>' +
      '<div id="milg-ss-status" style="color:#fff;margin-top:16px;font-size:14px;font-weight:500">Preparing screenshots...</div>' +
      '<div style="color:rgba(255,255,255,0.6);margin-top:6px;font-size:12px">Scrolling page to load all content, then capturing</div>' +
      '<style>@keyframes milg-spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(_overlay);
    var _origScrollY = window.scrollY;

    // --- Unified capture via window.MilgCapture (shared with URL/iframe mode) ---
    // The full-page screenshot + multi-layer text mask + carousel-expanded screenshot
    // + region screenshots all run inside the SAME serializable core that iframe mode
    // uses. We supply:
    //   - a live-page PRE hook (pre-scroll -> reset scroll containers -> settle), which
    //     replaces the snippet's old Phase 1 + _startCapture prep,
    //   - a no-op preloadFn (live pages have no CORS proxy; images are already loaded),
    //   - expand:true to get the carousel-expanded screenshot upgrade,
    //   - regionFnSrc=MilgRegion so regions run THROUGH the core (no separate call),
    //   - a sendFn that merges the unified result into `data` and calls outputData.
    if (!window.MilgCapture || !window.MilgCapture.getCaptureFn) {
      console.warn('[ss] MilgCapture not available - skipping screenshots');
      if (_overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
      data.screenshots = [];
      outputData(data);
      return;
    }

    // Progress reporter -> overlay status text + console.
    function _prog(label) {
      var se = document.getElementById('milg-ss-status');
      if (se) se.textContent = label;
      console.log('[ss] ' + _t() + label);
    }

    // Live-page PRE hook: pre-scroll to trigger lazy content + IntersectionObservers,
    // then reset scroll on window + overflow scroll containers, re-read bboxes, settle.
    // Self-contained (serialized via .toString()) -- only DOM/window globals + args.
    // Hides the snippet's capture overlay just before done() so it isn't captured.
    function _snippetPreHook(_p, done) {
      var vh = window.innerHeight || 900;
      var totalH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      var captureH = Math.min(totalH, vh * 10);
      _p('Pre-scrolling page to load content...');
      var positions = []; for (var i = 0; i < captureH; i += vh) positions.push(i);
      var pi = 0;
      function scrollNext() {
        if (pi >= positions.length) {
          _p('Waiting for images to load...');
          setTimeout(reset, 500);
          return;
        }
        window.scrollTo(0, positions[pi]);
        try { window.dispatchEvent(new Event('scroll')); } catch (e) {}
        _p('Loading content... (section ' + (pi + 1) + '/' + positions.length + ')');
        pi++; setTimeout(scrollNext, 200);
      }
      scrollNext();
      function reset() {
        document.documentElement.style.scrollBehavior = 'auto';
        document.body.style.scrollBehavior = 'auto';
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        document.querySelectorAll('*').forEach(function(el) {
          if (el.scrollTop > 0) {
            var s = getComputedStyle(el);
            if (s.overflow === 'auto' || s.overflow === 'scroll' || s.overflowY === 'auto' || s.overflowY === 'scroll') {
              el.style.scrollBehavior = 'auto'; el.scrollTop = 0;
            }
          }
        });
        _p('Waiting for animations to settle...');
        setTimeout(function() {
          if (typeof window.__milgReReadBboxes === 'function') window.__milgReReadBboxes();
          // Hide the snippet capture overlay so it isn't baked into screenshots.
          var ov = document.querySelector('[data-milg-overlay]');
          if (ov) ov.style.display = 'none';
          done();
        }, 1500);
      }
    }

    // No-op preload: live pages render their own images; there's no CORS proxy here.
    function _noopPreload(_p, _proxyUrl, done) { done(); }

    // Output sink: merge the unified capture payload into `data`, restore the page,
    // and finalize. The core calls this with (payload, isFinal). The terminal full
    // result (isFinal) carries screenshots/clean/mask/maskResults/regionScreenshots
    // + updatedData (re-read bboxes + per-pair mask fields). Non-final/failure
    // payloads only carry `screenshots` (empty) -- we still finalize.
    // Passed as a LIVE function (opts.sendFn): in snippet mode the capture core runs
    // in this same realm (getCaptureFn() is called directly, not serialized), so this
    // can legitimately close over `data`, `_overlay`, `_origScrollY`, `outputData`.
    function _snippetSend(payload, isFinal) {
      if (window.__milgSnippetSent) return;
      window.__milgSnippetSent = true;
      try {
        data.screenshots = payload.screenshots || [];
        data.screenshotFull = payload.screenshotFull || null;
        data.screenshotClean = payload.screenshotClean || null;
        data.screenshotCleanMeta = payload.screenshotCleanMeta || null;
        data.textMask = payload.textMask || null;
        data.screenshotMeta = payload.screenshotMeta || null;
        data.regionScreenshots = payload.regionScreenshots || [];
        // Merge re-read bboxes + per-pair mask fields back onto data (the core
        // builds a lean updatedData with masks attached to contrastPairs).
        var ud = payload.updatedData;
        if (ud) {
          if (ud.colors && ud.colors.contrastPairs && data.colors) data.colors.contrastPairs = ud.colors.contrastPairs;
          if (ud.typography && data.typography) {
            if (ud.typography.fontSizes) data.typography.fontSizes = ud.typography.fontSizes;
            if (ud.typography.headings) data.typography.headings = ud.typography.headings;
            if (ud.typography.maxLineLength) data.typography.maxLineLength = ud.typography.maxLineLength;
          }
          if (ud.interaction && ud.interaction.touchTargets && data.interaction) data.interaction.touchTargets = ud.interaction.touchTargets;
          if (ud.layout && data.layout) {
            if (ud.layout.offscreenElements) data.layout.offscreenElements = ud.layout.offscreenElements;
            if (ud.layout.hiddenPanelIssues) data.layout.hiddenPanelIssues = ud.layout.hiddenPanelIssues;
            if (ud.layout.alignmentElements) data.layout.alignmentElements = ud.layout.alignmentElements;
            if (ud.layout.borderRadii) data.layout.borderRadii = ud.layout.borderRadii;
          }
        }
      } catch (e) { console.warn('[ss] Failed to merge capture payload:', e && e.message || e); }
      // Restore scroll + remove overlay (mask/expand mutated the DOM -- the
      // outputData copy/download handlers reload the page to fully restore styles).
      try { window.scrollTo(0, _origScrollY); } catch (e) {}
      if (_overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
      var _pairs = (data.colors && data.colors.contrastPairs) || [];
      var _masks = _pairs.filter(function(p) { return !!p._maskBmp; }).length;
      console.log('%c✓ Screenshot + mask captured (' + _t().trim() + ', ' + _masks + ' masks, ' + (data.regionScreenshots || []).length + ' regions)', 'color: #16a34a; font-weight: bold;');
      outputData(data);
    }

    var _captureOpts = {
      msgType: 'milg-screenshots-result',
      cdnUrl: 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js',
      proxyUrl: '',
      expand: true,
      preHookSrc: _snippetPreHook.toString(),
      preloadSrc: _noopPreload.toString(),
      regionFnSrc: window.MilgRegion.getRegionFn().toString(),
      sendFn: _snippetSend
    };
    // Scale 1.5 / quality 0.8 -- same as the snippet has always used (and iframe mode).
    window.MilgCapture.getCaptureFn()(1.5, 0.8, _prog, _captureOpts)(function() {});
  }).catch(function() {
    data.screenshots = [];
    outputData(data);
  });

  // Reliable file download — appends to DOM and delays revoke so all browsers work
  function downloadFile(content, filename) {
    var blob = new Blob([content], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  // Gzip compress + base64 encode for clipboard (CompressionStream API)
  function compressForClipboard(jsonStr, callback) {
    if (typeof CompressionStream === 'undefined') { callback(null); return; }
    try {
      var blob = new Blob([jsonStr]);
      var cs = new CompressionStream('gzip');
      var stream = blob.stream().pipeThrough(cs);
      new Response(stream).arrayBuffer().then(function(buf) {
        var bytes = new Uint8Array(buf);
        var binStr = '';
        for (var i = 0; i < bytes.length; i++) binStr += String.fromCharCode(bytes[i]);
        var b64 = btoa(binStr);
        callback('MILG_GZ:' + b64);
      }).catch(function() { callback(null); });
    } catch(e) { callback(null); }
  }

  function outputData(data) {
    var json = JSON.stringify(data);
    var jsonKB = Math.round(json.length / 1024);
    var jsonMB = (json.length / 1024 / 1024).toFixed(1);
    console.log('[clipboard] JSON size: ' + jsonKB + ' KB (' + jsonMB + ' MB)');
    window.__milgData = data;
    window.__milgData_json = json;

    // In crawl mode, skip the copy overlay — crawl has its own UI
    if (window.__milgCrawlSite) {
      // Jump straight to crawl section below
    } else {
    // Show overlay with copy button (user click = real gesture = clipboard works reliably)
    var _copyOverlay = document.createElement('div');
    _copyOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
    _copyOverlay.innerHTML = '<div style="text-align:center;max-width:400px;padding:20px">' +
      '<div style="font-size:32px;margin-bottom:12px">&#10003;</div>' +
      '<div style="color:#fff;font-size:18px;font-weight:600;margin-bottom:6px">Extraction complete!</div>' +
      '<div style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:6px">' + jsonKB + ' KB of design data' + (data.screenshotFull ? ' + full-page screenshot' : '') + '</div>' +
      (jsonKB > 2048 ? '<div style="color:#fbbf24;font-size:12px;margin-bottom:16px">&#9888; Large payload (' + jsonMB + ' MB) \u2014 download recommended</div>' : '<div style="margin-bottom:16px"></div>') +
      (jsonKB > 2048
        ? '<button id="milg-download-btn" style="padding:14px 32px;font-size:15px;font-weight:600;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:8px;min-width:200px">Download JSON</button>' +
          '<button id="milg-copy-btn" style="padding:10px 24px;font-size:13px;font-weight:500;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;margin-bottom:12px;min-width:200px">Copy to Clipboard</button>'
        : '<button id="milg-copy-btn" style="padding:14px 32px;font-size:15px;font-weight:600;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:8px;min-width:200px">Copy to Clipboard</button>' +
          '<button id="milg-download-btn" style="padding:10px 24px;font-size:13px;font-weight:500;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;margin-bottom:12px;min-width:200px">Download JSON</button>') +
      '<div style="color:rgba(255,255,255,0.4);font-size:11px">Then ' + (jsonKB > 2048 ? 'import' : 'paste') + ' into the analyzer</div>' +
      '</div>';
    document.body.appendChild(_copyOverlay);

    document.getElementById('milg-copy-btn').addEventListener('click', function() {
      var btn = document.getElementById('milg-copy-btn');
      btn.textContent = 'Compressing...';
      btn.disabled = true;

      function onSuccess(size) {
        btn.textContent = 'Copied!' + (size ? ' (' + size + ')' : '');
        btn.style.background = '#16a34a';
        console.log('%c\u2713 Design data copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
        // Reload page after delay to restore styles corrupted by mask capture
        setTimeout(function() {
          if (_copyOverlay.parentNode) _copyOverlay.parentNode.removeChild(_copyOverlay);
          console.log('%c\u21BB Reloading page in 8s to restore styles...', 'color: #64748b;');
          setTimeout(function() { location.reload(); }, 8000);
        }, 2000);
      }
      function onFail() {
        btn.textContent = 'Copy failed \u2014 use console';
        btn.style.background = '#dc2626';
        console.log('%c\u26A0 Clipboard copy failed. Type: copy(window.__milgData_json)', 'color: #b45309; font-weight: bold;');
      }
      function doCopy(text, sizeLabel) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function() { onSuccess(sizeLabel); }).catch(function() {
            try {
              var ta = document.createElement('textarea'); ta.value = text;
              ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
              document.body.appendChild(ta); ta.select();
              document.execCommand('copy') ? onSuccess(sizeLabel) : onFail();
              document.body.removeChild(ta);
            } catch(e) { onFail(); }
          });
        } else { onFail(); }
      }

      // Try gzip compression for clipboard (typically 60-80% smaller)
      compressForClipboard(json, function(compressed) {
        if (compressed) {
          var compKB = Math.round(compressed.length / 1024);
          var ratio = Math.round((1 - compressed.length / json.length) * 100);
          console.log('[clipboard] Compressed: ' + compKB + ' KB (' + ratio + '% smaller)');
          btn.textContent = 'Copying ' + compKB + ' KB...';
          doCopy(compressed, compKB + ' KB, ' + ratio + '% compressed');
        } else {
          console.log('[clipboard] CompressionStream not available, copying raw JSON');
          btn.textContent = 'Copying ' + jsonKB + ' KB...';
          doCopy(json, jsonKB + ' KB');
        }
      });
    });

    // Download button (works for any size, no clipboard limit)
    document.getElementById('milg-download-btn').addEventListener('click', function() {
      var siteName = (data.meta && data.meta.url) || location.hostname;
      downloadFile(json, 'milg-report-' + siteName.replace(/[^a-z0-9]/gi, '-').substring(0, 40) + '.json');
      var btn = document.getElementById('milg-download-btn');
      btn.textContent = 'Downloaded!';
      btn.style.background = '#16a34a'; btn.style.color = '#fff'; btn.style.borderColor = '#16a34a';
      setTimeout(function() {
        if (_copyOverlay.parentNode) _copyOverlay.parentNode.removeChild(_copyOverlay);
        console.log('%c\u21BB Reloading page in 8s to restore styles...', 'color: #64748b;');
        setTimeout(function() { location.reload(); }, 8000);
      }, 2000);
    });

    } // end if !crawl (copy overlay block)

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
        try { localStorage.setItem('milg-crawl-complete', crawlJson); } catch(e) { console.warn('[milg-warn] localStorage save failed:', e.message); }
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

        // Build a self-contained extraction + screenshot + mask script for crawl iframes.
        // _crawlScreenshotCallback is serialized via .toString() into the iframe —
        // it must be fully self-contained (no closure references).
        function _crawlScreenshotCallback(data) {
          // The extraction engine sets __milgData before calling this callback.
          // Clear it immediately so the parent poller doesn't grab data before
          // the screenshot + mask pipeline completes.
          window.__milgData = null;
          window.__milgProgress = 'Loading screenshot library\u2026';
          function _finalize() { window.__milgProgress = null; window.__milgData = data; }

          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js';
          s.onload = function() {
            var ms = window.modernScreenshot;
            if (!ms || !ms.domToCanvas) { data.screenshots = []; _finalize(); return; }

            // Unlock height (sites with html,body{height:100%} clamp scrollHeight)
            document.documentElement.style.cssText += 'height:auto !important;overflow-y:auto !important;';
            document.body.style.cssText += 'height:auto !important;';
            void document.body.offsetHeight;

            var vh = window.innerHeight || 900;
            var totalH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            var captureH = Math.min(totalH, vh * 10);
            var secScale = 1.5;

            // Phase 1: Pre-scroll to trigger lazy content + IntersectionObservers
            window.__milgProgress = 'Pre-scrolling page\u2026';
            var positions = []; for (var p = 0; p < captureH; p += vh) positions.push(p);
            var pi = 0;
            function scrollNext() {
              if (pi >= positions.length) { setTimeout(startCapture, 800); return; }
              window.scrollTo(0, positions[pi]);
              document.documentElement.scrollTop = positions[pi];
              try { window.dispatchEvent(new Event('scroll')); } catch(e) {}
              pi++; setTimeout(scrollNext, 200);
            }
            scrollNext();

            function startCapture() {
              // Reset scroll
              document.documentElement.style.scrollBehavior = 'auto';
              document.body.style.scrollBehavior = 'auto';
              window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
              document.querySelectorAll('*').forEach(function(el) {
                if (el.scrollTop > 0) {
                  var cs = getComputedStyle(el);
                  if (cs.overflow === 'auto' || cs.overflow === 'scroll' || cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
                    el.style.scrollBehavior = 'auto'; el.scrollTop = 0;
                  }
                }
              });

              // Force-reveal hidden animated elements (IO disabled in offscreen iframes)
              var revealed = 0;
              document.querySelectorAll('*').forEach(function(el) {
                var cs = getComputedStyle(el);
                if (cs.opacity === '0' && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') {
                  var hasTrans = cs.transition && cs.transition.indexOf('opacity') !== -1;
                  var hasAnim = cs.animationName && cs.animationName !== 'none';
                  var cls = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
                  var isScrollAnim = hasTrans || hasAnim || /fade|reveal|animate|aos|scroll|slide|appear/.test(cls);
                  if (isScrollAnim) {
                    el.style.cssText += ';opacity:1 !important;transform:none !important;transition:none !important;animation:none !important;';
                    revealed++;
                  }
                }
              });

              // Fast-forward remaining CSS animations
              var ffStyle = document.createElement('style');
              ffStyle.textContent = '*,*::before,*::after{animation-delay:0s !important;animation-duration:0.01s !important;}';
              document.head.appendChild(ffStyle);
              void document.body.offsetHeight;

              // Switch to overflow:visible for capture
              document.documentElement.style.cssText += 'overflow:visible !important;';
              document.body.style.cssText += 'overflow:visible !important;';
              void document.body.offsetHeight;

              setTimeout(function() {
                // Re-read bboxes after scroll reset + reveal
                if (typeof window.__milgReReadBboxes === 'function') window.__milgReReadBboxes();

                // Step 1: Capture screenshot
                window.__milgProgress = 'Capturing screenshot\u2026';
                ms.domToCanvas(document.documentElement, { scale: secScale, timeout: 45000 }).then(function(fullCanvas) {
                  var fullUri;
                  try { fullUri = fullCanvas.toDataURL('image/webp', 0.8); } catch(e) { fullUri = ''; }

                  data.screenshots = fullUri ? [fullUri] : [];
                  data.screenshotFull = fullUri || null;
                  data.screenshotMeta = {
                    scale: secScale, viewportHeight: vh,
                    sectionCount: data.screenshots.length,
                    canvasWidth: fullCanvas.width, canvasHeight: fullCanvas.height,
                    docHeightAtCapture: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
                    docHeightAtExtraction: (data.meta && data.meta.docHeight) || 0,
                    captureScrollY: 0, calibrationOffsetY: 0, calibrationSamples: []
                  };

                  // Step 2: Text mask capture (single-layer: all text black, all bg white)
                  window.__milgProgress = 'Building text mask\u2026';
                  // Kill transitions
                  document.querySelectorAll('*').forEach(function(el) {
                    el.style.setProperty('transition-duration', '0s', 'important');
                    el.style.setProperty('transition', 'none', 'important');
                  });
                  void document.body.offsetHeight;

                  // Neutralize absolute/fixed overlays
                  document.querySelectorAll('*').forEach(function(el) {
                    var cs = getComputedStyle(el);
                    if (cs.position === 'absolute' || cs.position === 'fixed') {
                      if (!el.textContent.trim()) {
                        el.style.setProperty('display', 'none', 'important');
                      } else if (cs.pointerEvents === 'none') {
                        el.style.setProperty('background', 'transparent', 'important');
                        el.style.setProperty('background-image', 'none', 'important');
                      }
                    }
                  });
                  void document.body.offsetHeight;

                  // Set all backgrounds white, all text black
                  document.querySelectorAll('*').forEach(function(el) {
                    el.style.setProperty('background', '#fff', 'important');
                    el.style.setProperty('background-image', 'none', 'important');
                    el.style.setProperty('color', '#000', 'important');
                    el.style.setProperty('text-shadow', 'none', 'important');
                    el.style.setProperty('box-shadow', 'none', 'important');
                    el.style.setProperty('border-color', 'transparent', 'important');
                  });
                  document.body.style.setProperty('background', '#fff', 'important');
                  document.documentElement.style.setProperty('background', '#fff', 'important');
                  void document.body.offsetHeight;

                  ms.domToCanvas(document.documentElement, { scale: secScale, timeout: 30000 }).then(function(maskCanvas) {
                    var maskUri;
                    try { maskUri = maskCanvas.toDataURL('image/webp', 0.8); } catch(e) { maskUri = null; }
                    data.textMask = maskUri;

                    // Build per-pair mask bitmaps (bit-packed base64)
                    var maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
                    var pairs = (data.colors && data.colors.contrastPairs) || [];
                    pairs.forEach(function(pair) {
                      if (!pair.bbox) return;
                      var bx = Math.round(pair.bbox.left * secScale);
                      var by = Math.round(pair.bbox.top * secScale);
                      var bw = Math.round(pair.bbox.width * secScale);
                      var bh = Math.round(pair.bbox.height * secScale);
                      if (bw < 2 || bh < 2 || bx + bw > maskCanvas.width || by + bh > maskCanvas.height) return;
                      var mData = maskCtx.getImageData(bx, by, bw, bh).data;
                      var bmp = new Uint8Array(bw * bh);
                      var darkCount = 0;
                      for (var j = 0; j < mData.length; j += 4) {
                        if ((mData[j] + mData[j+1] + mData[j+2]) / 3 < 240) { bmp[j/4] = 1; darkCount++; }
                      }
                      if (darkCount > 0) {
                        var byteLen = Math.ceil(bmp.length / 8);
                        var packed = new Uint8Array(byteLen);
                        for (var bi = 0; bi < bmp.length; bi++) {
                          if (bmp[bi]) packed[bi >> 3] |= (1 << (bi & 7));
                        }
                        var binStr = '';
                        for (var bi2 = 0; bi2 < packed.length; bi2++) binStr += String.fromCharCode(packed[bi2]);
                        pair._maskBmp = btoa(binStr);
                        pair._maskPacked = true;
                        pair._maskW = bw; pair._maskH = bh; pair._maskLayer = 1; pair._maskDark = darkCount;
                      }
                    });
                    _finalize();
                  }).catch(function() { _finalize(); });
                }).catch(function() { data.screenshots = []; _finalize(); });
              }, 1500);
            }
          };
          s.onerror = function() {
            // modern-screenshot unavailable — finalize without screenshots
            data.screenshots = [];
            _finalize();
          };
          document.head.appendChild(s);
        }
        var snippetSrc = 'window.__milgProgress = "Extracting design data\\u2026";\n' +
          'window.MilgExtract = ' + window.MilgExtract.toString() + ';\n' +
          'window.__milgOnExtractComplete = ' + _crawlScreenshotCallback.toString() + ';\n' +
          'window.MilgExtract();\n';
        (function() {
          function _next(idx) {
            if (idx >= _links.length) {
              // Prepare data but show copy button (auto-copy fails in async context)
              var crawlJson = JSON.stringify({ _milgCrawl: true, startUrl: location.href, results: _cResults });
              window.__milgCrawlResults = _cResults;
              window.__milgCrawlJson = crawlJson;
              try { localStorage.setItem('milg-crawl-complete', crawlJson); } catch(e) { console.warn('[milg-warn] localStorage save failed:', e.message); }
              console.log('%c\u2713 Crawl complete! ' + _cResults.length + ' pages (' + Math.round(crawlJson.length / 1024) + ' KB)', 'color: #16a34a; font-weight: bold; font-size: 14px;');
              // Show copy + download buttons
              var _crawlKB = Math.round(crawlJson.length / 1024);
              _crawlOverlay.innerHTML = '<div style="text-align:center">' +
                '<div style="font-size:28px;margin-bottom:12px">\u2713</div>' +
                '<div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:6px">Crawl complete! ' + _cResults.length + ' pages analyzed.</div>' +
                '<div style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:' + (_crawlKB > 2048 ? '6' : '20') + 'px">' + _crawlKB + ' KB of design data ready</div>' +
                (_crawlKB > 2048 ? '<div style="color:#fbbf24;font-size:12px;margin-bottom:16px">&#9888; Large payload (' + Math.round(_crawlKB / 1024 * 10) / 10 + ' MB) \u2014 download recommended</div>' : '') +
                (_crawlKB > 2048
                  ? '<button id="milg-crawl-dl-btn" style="padding:12px 28px;font-size:14px;font-weight:600;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:8px;min-width:220px">Download JSON</button><br>' +
                    '<button id="milg-crawl-copy-btn" style="padding:10px 24px;font-size:13px;font-weight:500;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;margin-bottom:10px;min-width:220px">Copy to Clipboard</button>'
                  : '<button id="milg-crawl-copy-btn" style="padding:12px 28px;font-size:14px;font-weight:600;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:8px;min-width:220px">Copy to Clipboard</button><br>' +
                    '<button id="milg-crawl-dl-btn" style="padding:10px 24px;font-size:13px;font-weight:500;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;margin-bottom:10px;min-width:220px">Download JSON</button>') +
                '<div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:8px">Then ' + (_crawlKB > 2048 ? 'import' : 'paste') + ' into the analyzer</div>' +
                '</div>';
              function _crawlDoneAction() {
                // Close overlay and reload page to restore styles corrupted by mask capture
                setTimeout(function() {
                  _removeCrawlOverlay();
                  console.log('%c\u21BB Reloading page in 8s to restore styles...', 'color: #64748b;');
                  setTimeout(function() { location.reload(); }, 8000);
                }, 2000);
              }
              document.getElementById('milg-crawl-copy-btn').addEventListener('click', function() {
                var btn = document.getElementById('milg-crawl-copy-btn');
                navigator.clipboard.writeText(crawlJson).then(function() {
                  btn.textContent = 'Copied!'; btn.style.background = '#16a34a';
                  _crawlDoneAction();
                }).catch(function() {
                  var ta = document.createElement('textarea'); ta.value = crawlJson;
                  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
                  document.body.appendChild(ta); ta.select();
                  try { document.execCommand('copy'); } catch(e) {}
                  document.body.removeChild(ta);
                  btn.textContent = 'Copied!'; btn.style.background = '#16a34a';
                  _crawlDoneAction();
                });
              });
              document.getElementById('milg-crawl-dl-btn').addEventListener('click', function() {
                downloadFile(crawlJson, 'milg-crawl-' + location.hostname.replace(/[^a-z0-9]/gi, '-') + '.json');
                var btn = document.getElementById('milg-crawl-dl-btn');
                btn.textContent = 'Downloaded!'; btn.style.background = '#16a34a'; btn.style.color = '#fff';
                _crawlDoneAction();
              });
              return;
            }
            var url = _links[idx];
            var path; try { path = new URL(url).pathname; } catch(e) { path = url; }
            _updateCrawlOverlay('Crawling page ' + (idx + 1) + ' of ' + _links.length + ' (with screenshots)', path);
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
                'if(!b&&typeof u==="string"&&u.charAt(0)==="/")return new _O(u,_rb);try{return (arguments.length===1||!b)?new _O(u):new _O(u,b);}catch(e){try{return new _O(u,_rb);}catch(e2){throw e;}}}' +
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
                        // Show progress from inside the iframe (extraction → screenshot → mask phases)
                        var prog = iWin.__milgProgress;
                        if (prog) _updateCrawlOverlay('Page ' + (idx + 1) + '/' + _links.length + ': ' + prog, path);
                        var d = iWin.__milgData;
                        if (d) { clearInterval(pi); done = true; d.meta.url = url; _cResults.push({ url: url, data: d }); cleanup(); var hasShots = d.screenshots && d.screenshots.length > 0; console.log('%c  \u2713 ' + path + (hasShots ? ' (with screenshots)' : ''), 'color: #16a34a;'); setTimeout(function() { _next(idx + 1); }, 500); }
                        else if (polls > 80) { clearInterval(pi); done = true; cleanup(); console.log('%c  \u2717 Timeout: ' + path, 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                      } catch(e) { clearInterval(pi); done = true; cleanup(); console.log('%c  \u2717 Error: ' + path + ' (' + e.message + ')', 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                    }, 500);
                  } catch(e) { done = true; cleanup(); console.log('%c  \u2717 Cannot inject snippet: ' + path + ' (' + e.message + ')', 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                }, 1500);
              });
              iframe.srcdoc = html;
              setTimeout(function() { if (done) return; done = true; cleanup(); console.log('%c  \u2717 Timeout (45s): ' + path, 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }, 45000);
            }).catch(function(e) {
              console.log('%c  \u2717 Fetch failed: ' + path + ' (' + (e.message || e) + ')', 'color: #dc2626;');
              setTimeout(function() { _next(idx + 1); }, 500);
            });
          }
          _next(0);
        })();
      }
      return; // Skip clipboard copy
    }
  }

    }; // end __milgOnExtractComplete callback

    // Run the extraction
    window.MilgExtract();
  }
})();
