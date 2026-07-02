// make-it-look-good — Design Extraction Snippet (with screenshots)
// Version: v3.11.148
// Run this in the browser console on any page.
// Loads extraction engine from CDN (single source of truth), then captures screenshots.
// Output is larger (~200-800KB extra) but includes visual reference.
// Then paste into the analyzer at: https://jdeworks.github.io/make-it-look-good/analyzer.html

(function() {
  'use strict';
  var _MILG_VERSION = 'v3.11.148';
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
  // --- SPA view explorer + mapper (inlined by analyzer assembler) ---
  // Defines window.MilgSpaExplore + window.MilgSpaMap. Must come AFTER MilgExtract.
  // @milg-insert: spa
  _runExtraction();

  // SPA view discovery output — runs the inlined explorer in the live page (already booted)
  // and copies/downloads the {_milgCrawl:true, results, _spaProvenance} payload the analyzer
  // ingests (same shape as URL-mode SPA discovery). Clicks the page's nav/tabs in place;
  // safe controls only (submit/delete/logout/external skipped). wantCapture waits briefly for
  // the screenshot lib so per-view screenshots are captured.
  function _milgRunSpaExplore(wantCapture) {
    console.log('%c🔍 Exploring SPA views (clicking nav/tabs in place)…', 'color:#8b5cf6;font-weight:bold;');
    function _libReady() { return !!(window.modernScreenshot && window.modernScreenshot.domToCanvas); }
    function _go() {
      window.MilgSpaExplore({
        exploreClicks: true,
        maxViews: (window.__milgSpaMaxViews || 30),
        perPageStateThreshold: (window.__milgSpaPerPageThreshold || 3),
        maxStatePasses: (window.__milgSpaMaxStatePasses != null ? window.__milgSpaMaxStatePasses : 8),
        capture: _libReady(),
        captureScale: (window.__milgSpaCaptureScale || 1),
        // Holistic All-expanded/Collapsed state passes — baked from the analyzer's
        // "Capture disclosure states" toggle (URL-route parity; was silently never on).
        stateCapture: !!window.__milgSpaStateCapture,
        timeBudgetMs: (window.__milgSpaTimeBudgetMs || 90000), pageEnterGraceMs: 1500
      }).then(function(r) {
        var built = window.MilgSpaMap.build(r, {
          base: location.href.replace(/#.*$/, ''),
          rootTitle: document.title || 'App', inputMethod: 'console'
        });
        var payload = JSON.stringify({ _milgCrawl: true, startUrl: location.href, results: built.results, _spaProvenance: built.provenance });
        window.__milgCrawlJson = payload; window.__milgCrawlResults = built.results;
        try { localStorage.setItem('milg-crawl-complete', payload); } catch (e) {}
        var mb = Math.round(payload.length / 1024 / 1024 * 10) / 10, c = built.counts;
        var host = location.hostname.replace(/[^a-z0-9]/gi, '-');
        function _dl() {
          var b = new Blob([payload], { type: 'application/json' }), u = URL.createObjectURL(b), a = document.createElement('a');
          a.href = u; a.download = 'milg-spa-' + host + '.json'; a.style.display = 'none';
          document.body.appendChild(a); a.click();
          setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(u); }, 100);
        }
        function _ok() { console.log('%c✓ ' + built.results.length + ' SPA view(s) copied (' + c.pages + ' pages + ' + c.subViews + ' sub-views + ' + c.panels + ' panels). Paste into the analyzer.', 'color:#16a34a;font-weight:bold;font-size:14px;'); }
        if (payload.length > 4 * 1024 * 1024) { _dl(); console.log('%c⬇ SPA views downloaded as file (' + mb + ' MB). Import in the analyzer.', 'color:#16a34a;font-weight:bold;'); }
        else if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(payload).then(_ok).catch(_dl); }
        else { _dl(); }
      }).catch(function(e) { console.error('[milg] SPA explore failed:', (e && e.message) || e); });
    }
    if (wantCapture && !_libReady()) {
      var w = 0, t = setInterval(function() { w += 200; if (_libReady() || w >= 6000) { clearInterval(t); _go(); } }, 200);
    } else { _go(); }
  }

  function _runExtraction() {
    window.__milgOnExtractComplete = function(data) {
      window.__milgData = data;
      // SPA view discovery (in-place): explore the current app's hidden views by clicking
      // nav/tabs, emit a multi-view crawl payload. Opt-in via the "Explore SPA views" toggle.
      // Replaces the single-page capture path; the explorer does its own per-view capture.
      if (window.__milgSpaExplore && !window.__milgCrawlSite && window.MilgSpaExplore && window.MilgSpaMap) {
        _milgRunSpaExplore(true); // screenshot snippet: wait for the lib → per-view captures
        return;
      }
      console.log('%c[milg] Extraction complete, starting screenshot capture...', 'color: #3b82f6;');
      window.__milgSnippetSent = false;

  // --- Screenshot capture ---
  // The modern-screenshot library is loaded inline to bypass CSP restrictions.
  // Console-pasted code is executed directly by the engine, not subject to CSP script-src.
  console.log('%c\uD83D\uDCF8 Capturing screenshots...', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
  function _milgErrMsg(e) {
    if (!e) return '';
    try { return e.message || String(e); } catch (x) { return ''; }
  }
  function _recordScreenshotError(stage, reason, err, extra) {
    data.screenshotError = {
      stage: stage || 'snippet-unknown',
      reason: reason || 'Screenshot capture failed before the shared capture core reported a reason.',
      error: _milgErrMsg(err),
      snippetVersion: _MILG_VERSION
    };
    if (extra) Object.keys(extra).forEach(function(k) { data.screenshotError[k] = extra[k]; });
    console.warn('[milg] screenshotError:', data.screenshotError);
  }

  // Inline modern-screenshot library (loaded from separate file at build time)
  // This block is replaced by scripts/build-screenshot-snippet.sh
  // __INLINE_MODERN_SCREENSHOT_START__
  if (window.modernScreenshot && window.modernScreenshot.domToCanvas) {
    // Library already present — inlined by the analyzer's "Embed screenshot library"
    // option, which prepends the lib so screenshots work on sites that block the CDN (strict CSP).
    console.log('%cUsing embedded screenshot library (no CDN needed).', 'color: #16a34a;');
    var _msLoaded = Promise.resolve();
  } else {
  try {
    // AMD guard: sites with an AMD loader (Monaco/RequireJS set window.define.amd)
    // make the UMD build register as an anonymous AMD module instead of setting
    // window.modernScreenshot. Mask define.amd while the library loads.
    var _msAmdDef = (typeof window.define === 'function' && window.define.amd) ? window.define : null;
    var _msAmdSaved = _msAmdDef ? _msAmdDef.amd : null;
    if (_msAmdDef) { try { _msAmdDef.amd = undefined; } catch (e) {} }
    var _msAmdRestore = function() { if (_msAmdDef) { try { _msAmdDef.amd = _msAmdSaved; } catch (e) {} } };
    var _msScript = document.createElement('script');
    _msScript.src = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js';
    var _msLoaded = new Promise(function(resolve, reject) {
      _msScript.onload = function() { _msAmdRestore(); resolve(); };
      _msScript.onerror = function() {
        // CDN blocked by CSP — try inline fallback via fetch + eval (works if unsafe-eval allowed)
        // Otherwise fall back gracefully
        console.log('%c\u26A0 CDN blocked by CSP. Trying fetch fallback...', 'color: #b45309;');
        fetch('https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js')
          .then(function(r) { return r.text(); })
          .then(function(code) { (new Function(code))(); _msAmdRestore(); resolve(); })
          .catch(function() {
            _msAmdRestore();
            console.log('%c→ Tip: re-generate the snippet with "Embed screenshot library" checked in the analyzer to capture screenshots on CSP-locked sites like this one.', 'color: #2563eb; font-weight: bold;');
            console.log('%c\u26A0 Screenshot library unavailable on this site (CSP blocks external scripts and eval).', 'color: #b45309;');
            console.log('%cScreenshots skipped. The design data extraction still works \u2014 just paste into the analyzer.', 'color: #64748b;');
            reject();
          });
      };
    });
    document.head.appendChild(_msScript);
  } catch(e) { var _msLoaded = Promise.reject(); }
  }

  _msLoaded.then(function() {
    var ms = window.modernScreenshot;
    if (!ms || !ms.domToCanvas) {
      console.log('%c\u26A0 Screenshot API not found. Skipping.', 'color: #b45309;');
      _recordScreenshotError('snippet-screenshot-api-missing', 'modernScreenshot.domToCanvas was not available after the screenshot library loader completed.', null, { hasModernScreenshot: !!ms });
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
      '<div style="color:rgba(255,255,255,0.6);margin-top:6px;font-size:12px">Scrolling to load content, then capturing — can take up to a minute on large or image-heavy pages</div>' +
      '<div style="color:rgba(255,255,255,0.4);margin-top:4px;font-size:11px">Content-Security-Policy errors in the console are expected here and are harmless</div>' +
      '<style>@keyframes milg-spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(_overlay);
    var _origScrollY = window.scrollY;

    // --- Unified capture via window.MilgCapture (shared with URL/iframe mode) ---
    // The full-page screenshot + multi-layer text mask + carousel-expanded screenshot
    // + region screenshots all run inside the SAME capture core that iframe mode
    // uses. We supply:
    //   - a live-page PRE hook (pre-scroll -> reset scroll containers -> settle), which
    //     replaces the snippet's old Phase 1 + _startCapture prep,
    //   - a no-op preloadFn (live pages have no CORS proxy; images are already loaded),
    //   - expand:true to get the carousel-expanded screenshot upgrade,
    //   - regionFn=MilgRegion so regions run THROUGH the core (no separate call),
    //   - a sendFn that merges the unified result into `data` and calls outputData.
    if (!window.MilgCapture || !window.MilgCapture.getCaptureFn) {
      console.warn('[ss] MilgCapture not available - skipping screenshots');
      if (_overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
      _recordScreenshotError('snippet-capture-module-missing', 'MilgCapture.getCaptureFn was not available in the assembled console snippet.', null, { hasMilgCapture: !!window.MilgCapture });
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
          // The overlay STAYS visible through the whole capture — the capture core
          // excludes [data-milg-overlay] from every DOM clone via modern-screenshot's
          // filter option, so it never appears in screenshots or masks.
          done();
        }, 1500);
      }
    }

    // No-op preload: live pages render their own images; there's no CORS proxy here.
    function _noopPreload(_p, _proxyUrl, done) { done(); }

    // DOM preload: inline images from the pixels the browser ALREADY rendered, via
    // canvas → data-URI. No network fetch, so it bypasses the site's CSP connect-src
    // (the wall modern-screenshot hits). Subject only to canvas-taint: same-origin and
    // CORS-enabled images are rescued; truly cross-origin (no CORS) images can't be read
    // by any JS and become a placeholder. Mutations are hidden behind the capture overlay
    // and restored afterwards by _snippetSend. Self-contained (serialized via toString()).
    function _domPreload(_p, _proxyUrl, done) {
      var PH = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="#f1f5f9"/><text x="60" y="49" font-size="11" fill="#94a3b8" text-anchor="middle" font-family="system-ui">image</text></svg>');
      window.__milgImgRestore = [];
      function isCross(u) { try { return new URL(u, location.href).origin !== location.origin; } catch (e) { return true; } }
      function firstUrl(v) { if (!v || v.indexOf('url(') === -1) return null; var m = v.match(/url\(["']?([^"')]+)["']?\)/); return m && m[1] ? m[1] : null; }
      // Upfront check: a SINGLE cross-origin image without CORS taints the whole
      // screenshot canvas (toDataURL throws). So we count them, then below inline every
      // readable source and replace every unreadable one with a placeholder — guaranteeing
      // nothing cross-origin is left to taint the render.
      var _xo = 0;
      Array.prototype.slice.call(document.querySelectorAll('img')).forEach(function(i) {
        var s = i.currentSrc || i.src; if (s && s.indexOf('data:') !== 0 && s.indexOf('blob:') !== 0 && isCross(s)) _xo++;
      });
      if (_xo) console.log('%c[milg] ' + _xo + ' cross-origin image(s) on this page — inlining the readable ones, placeholdering the rest so none can taint the screenshot.', 'color:#2563eb');
      // Extract at ~2x the ON-SCREEN size, not full natural resolution. A page with
      // hundreds of full-res images makes the capture snapshot enormous → minutes of
      // rasterization or out-of-memory. The screenshot only needs display-size pixels.
      function toData(el, boxW, boxH) {
        try {
          var nw = el.naturalWidth || el.width, nh = el.naturalHeight || el.height;
          if (!nw || !nh) return null;
          var capW = boxW > 0 ? Math.ceil(boxW * 2) : nw;
          var capH = boxH > 0 ? Math.ceil(boxH * 2) : nh;
          var s = Math.min(capW / nw, capH / nh, 1); // only ever downscale
          var cw = Math.max(1, Math.round(nw * s)), ch = Math.max(1, Math.round(nh * s));
          var c = document.createElement('canvas'); c.width = cw; c.height = ch;
          c.getContext('2d').drawImage(el, 0, 0, cw, ch);
          return c.toDataURL('image/webp', 0.82); // throws (tainted) → null
        } catch (e) { return null; }
      }
      function corsReload(url, boxW, boxH) {
        return new Promise(function(res) {
          var im = new Image(); im.crossOrigin = 'anonymous';
          var t = setTimeout(function() { res(null); }, 6000);
          im.onload = function() { clearTimeout(t); res(toData(im, boxW, boxH)); };
          im.onerror = function() { clearTimeout(t); res(null); };
          try { im.src = url; } catch (e) { clearTimeout(t); res(null); }
        });
      }
      var inlined = 0, blocked = 0, total = 0, pending = [];
      function setImg(img, d) {
        window.__milgImgRestore.push({ t: 'img', el: img, src: img.getAttribute('src'), srcset: img.getAttribute('srcset') });
        if (img.hasAttribute('srcset')) img.removeAttribute('srcset');
        img.src = d;
      }
      Array.prototype.slice.call(document.querySelectorAll('img')).forEach(function(img) {
        var src = img.currentSrc || img.src;
        if (!src || src.indexOf('data:') === 0 || src.indexOf('blob:') === 0) return;
        total++;
        var _r = img.getBoundingClientRect();
        var d = toData(img, _r.width, _r.height);
        if (d) { setImg(img, d); inlined++; return; }
        pending.push(corsReload(src, _r.width, _r.height).then(function(d2) {
          if (d2) { setImg(img, d2); inlined++; } else { setImg(img, PH); blocked++; }
        }));
      });
      // Neutralize <picture>/<video> <source> elements: when the rasterizer re-renders,
      // it could re-pick an external <source> over the <img> we just inlined and taint
      // the whole canvas. We've inlined the <img>, so dropping the sources is safe.
      Array.prototype.slice.call(document.querySelectorAll('source[srcset],source[src]')).forEach(function(s) {
        window.__milgImgRestore.push({ t: 'src', el: s, srcset: s.getAttribute('srcset'), src: s.getAttribute('src') });
        s.removeAttribute('srcset'); s.removeAttribute('src');
      });
      // SVG <image>: a single cross-origin one taints the canvas. Same-origin can be read;
      // cross-origin (no CORS) → blank it. (Rare, but one is enough to kill the screenshot.)
      Array.prototype.slice.call(document.querySelectorAll('image')).forEach(function(im) {
        var href = im.getAttribute('href') || im.getAttribute('xlink:href');
        if (!href || href.indexOf('data:') === 0) return;
        var cross = false;
        try { cross = new URL(href, location.href).origin !== location.origin; } catch (e) { cross = true; }
        if (!cross) return;
        total++; blocked++;
        window.__milgImgRestore.push({ t: 'href', el: im, href: im.getAttribute('href'), xhref: im.getAttribute('xlink:href') });
        im.removeAttribute('href'); im.removeAttribute('xlink:href');
      });
      Array.prototype.slice.call(document.querySelectorAll('*')).forEach(function(el) {
        var cs; try { cs = getComputedStyle(el); } catch (e) { return; }
        // background-image: inline from rendered pixels; unreadable → drop (no taint).
        var bgUrl = firstUrl(cs.backgroundImage);
        if (bgUrl && bgUrl.indexOf('data:') !== 0 && bgUrl.indexOf('blob:') !== 0) {
          var bg = cs.backgroundImage;
          total++;
          var _br = el.getBoundingClientRect();
          pending.push(corsReload(bgUrl, _br.width, _br.height).then(function(d2) {
            window.__milgImgRestore.push({ t: 'bg', el: el, bg: el.style.backgroundImage });
            if (d2) { el.style.backgroundImage = bg.replace(bgUrl, d2); inlined++; } else { el.style.backgroundImage = 'none'; blocked++; }
          }));
        }
        // mask / border-image / list-style-image: only a CROSS-ORIGIN one can taint, and
        // inlining them is rarely worth it — just blank those so they can't poison capture.
        ['maskImage', 'webkitMaskImage', 'borderImageSource', 'listStyleImage'].forEach(function(prop) {
          var u = firstUrl(cs[prop]);
          if (!u || u.indexOf('data:') === 0 || u.indexOf('blob:') === 0 || !isCross(u)) return;
          window.__milgImgRestore.push({ t: 'style', el: el, prop: prop, val: el.style[prop] });
          el.style[prop] = 'none'; total++; blocked++;
        });
      });
      // <video> posters: a cross-origin poster taints the canvas too.
      Array.prototype.slice.call(document.querySelectorAll('video[poster]')).forEach(function(v) {
        var p = v.getAttribute('poster');
        if (!p || p.indexOf('data:') === 0 || !isCross(p)) return;
        window.__milgImgRestore.push({ t: 'attr', el: v, name: 'poster', val: p });
        v.removeAttribute('poster'); total++; blocked++;
      });
      function finish() {
        if (total) console.log('%c[milg] Inlined ' + inlined + '/' + total + ' images from rendered pixels (no network)' + (blocked ? ' — ' + blocked + ' blocked: cross-origin without CORS → placeholder' : ''), blocked ? 'color:#b45309' : 'color:#16a34a');
        done();
      }
      if (total) _p('Inlining ' + total + ' images from rendered pixels…');
      if (pending.length) Promise.all(pending).then(finish, finish); else finish();
    }

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
        data.screenshotError = payload.screenshotError || (payload.screenshotMeta && payload.screenshotMeta.screenshotError) || null;
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
      // Restore any image src/srcset/background we swapped to data-URIs for capture.
      try {
        if (window.__milgImgRestore) {
          window.__milgImgRestore.forEach(function(r) {
            if (r.t === 'img' || r.t === 'src') {
              if (r.srcset == null) r.el.removeAttribute('srcset'); else r.el.setAttribute('srcset', r.srcset);
              if (r.src == null) r.el.removeAttribute('src'); else r.el.setAttribute('src', r.src);
            } else if (r.t === 'bg') { r.el.style.backgroundImage = r.bg; }
            else if (r.t === 'style') { r.el.style[r.prop] = r.val; }
            else if (r.t === 'attr') { if (r.val == null) r.el.removeAttribute(r.name); else r.el.setAttribute(r.name, r.val); }
            else if (r.t === 'href') {
              if (r.href == null) r.el.removeAttribute('href'); else r.el.setAttribute('href', r.href);
              if (r.xhref == null) r.el.removeAttribute('xlink:href'); else r.el.setAttribute('xlink:href', r.xhref);
            }
          });
          window.__milgImgRestore = null;
        }
      } catch (e) {}
      // Remove the inaccessible-iframe capture placeholders (live page cleanup).
      try {
        Array.prototype.slice.call(document.querySelectorAll('[data-milg-iframe-ph]')).forEach(function(n) {
          if (n.parentNode) n.parentNode.removeChild(n);
        });
      } catch (e) {}
      // Restore scroll + remove overlay (mask/expand mutated the DOM -- the
      // outputData copy/download handlers reload the page to fully restore styles).
      try { window.scrollTo(0, _origScrollY); } catch (e) {}
      if (_overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
      var _pairs = (data.colors && data.colors.contrastPairs) || [];
      var _masks = _pairs.filter(function(p) { return !!p._maskBmp; }).length;
      console.log('%c✓ Screenshot + mask captured (' + _t().trim() + ', ' + _masks + ' masks, ' + (data.regionScreenshots || []).length + ' regions)', 'color: #16a34a; font-weight: bold;');
      outputData(data);
    }

    try {
      function _noopRegionFn(_s, _q, _p, _cp) { return function(cb) { cb([]); }; }
      var _regionFn = (window.MilgRegion && window.MilgRegion.getRegionFn)
        ? window.MilgRegion.getRegionFn()
        : _noopRegionFn;
      if (!window.MilgRegion || !window.MilgRegion.getRegionFn) {
        console.warn('[ss] MilgRegion not available - capturing main screenshot without hidden regions');
      }
      var _captureOpts = {
        msgType: 'milg-screenshots-result',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js',
        proxyUrl: '',
        expand: true,
        preHook: _snippetPreHook,
        preloadFn: _domPreload,
        regionFn: _regionFn,
        preHookSrc: _snippetPreHook.toString(),
        preloadSrc: _domPreload.toString(),
        regionFnSrc: _regionFn.toString(),
        sendFn: _snippetSend
      };
      // Scale 1.5 / quality 0.8 -- same as the snippet has always used (and iframe mode).
      window.MilgCapture.getCaptureFn()(1.5, 0.8, _prog, _captureOpts)(function() {});
    } catch (e) {
      if (_overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
      _recordScreenshotError('snippet-capture-start-error', 'The snippet failed while building capture options or starting MilgCapture.', e, {
        hasMilgCapture: !!window.MilgCapture,
        hasMilgRegion: !!window.MilgRegion
      });
      data.screenshots = [];
      outputData(data);
    }
  }).catch(function(e) {
    _recordScreenshotError('snippet-library-promise-rejected', 'The screenshot library loader promise rejected before capture could start.', e);
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
    function _stopDownloadClick(e) { try { e.stopPropagation(); } catch (_e) {} }
    try { a.addEventListener('click', _stopDownloadClick, true); a.addEventListener('click', _stopDownloadClick, false); } catch (e) {}
    document.body.appendChild(a);
    try {
      a.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true, view: window }));
    } catch (e) { a.click(); }
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
    // Diagnostic: exactly what's in the payload you copy (so a missing screenshot is obvious).
    var _ssN = (data.screenshots || []).length;
    var _fullKB = data.screenshotFull ? Math.round(data.screenshotFull.length / 1024) : 0;
    var _cleanKB = data.screenshotClean ? Math.round(data.screenshotClean.length / 1024) : 0;
    var _regN = (data.regionScreenshots || []).length;
    if (window.__milgCrawlSite) {
      console.log('%c[milg] Baseline page captured for crawl — screenshots:' + _ssN
        + ', full:' + (_fullKB ? _fullKB + 'KB' : 'MISSING')
        + ', clean:' + (_cleanKB ? _cleanKB + 'KB' : 'MISSING')
        + ', regions:' + _regN
        + '. Waiting for final crawl payload...',
        data.screenshotFull ? 'color:#16a34a;font-weight:bold' : 'color:#b45309;font-weight:bold');
    } else {
      console.log('%c[milg] Copied payload — screenshots:' + _ssN
        + ', full:' + (_fullKB ? _fullKB + 'KB' : 'MISSING')
        + ', clean:' + (_cleanKB ? _cleanKB + 'KB' : 'MISSING')
        + ', regions:' + _regN
        + ', total:' + jsonKB + 'KB. Access via window.__milgData_json',
        data.screenshotFull ? 'color:#16a34a;font-weight:bold' : 'color:#b45309;font-weight:bold');
    }
    if (!data.screenshotFull) {
      var _se = data.screenshotError || (data.screenshotMeta && data.screenshotMeta.screenshotError) || null;
      if (_se) {
        console.log('%c[milg] No screenshot in payload — capture failed at stage "' + (_se.stage || 'unknown') + '": ' + (_se.reason || 'unknown failure'), 'color:#b45309;font-weight:bold');
        if (_se.error) console.log('%c[milg] Browser error: ' + _se.error, 'color:#b45309');
        if (_se.cspViolations && _se.cspViolations.length) console.log('%c[milg] CSP violations observed: ' + _se.cspViolations.join(' | '), 'color:#b45309');
        console.log('[milg] screenshotError:', _se);
      } else {
        console.log('%c[milg] No screenshot in payload — capture returned empty output without a recorded failure stage. Check earlier [iframe-ss] logs; this is a bug if no capture error appears above.', 'color:#b45309;font-weight:bold');
      }
      console.log('%c[milg] The design data above is still valid.', 'color:#64748b');
    } else if (data.screenshotMeta && data.screenshotMeta.synthetic) {
      var _synErr = data.screenshotError || data.screenshotMeta.screenshotError || null;
      console.log('%c[milg] Screenshot uses fallback renderer — original DOM rasterizer failed at stage "' + ((_synErr && _synErr.stage) || 'unknown') + '". Pixel masks/region screenshots may be skipped.', 'color:#b45309;font-weight:bold');
      if (_synErr) console.log('[milg] screenshot fallback detail:', _synErr);
    }
    window.__milgData = data;
    if (window.__milgCrawlSite) window.__milgData_json = null;
    else window.__milgData_json = json;

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
      '<div style="color:rgba(255,255,255,0.35);font-size:10px;margin-top:10px;line-height:1.45;max-width:360px">Captured at this window’s width. To analyze another viewport, pick it in the analyzer’s viewport selector and re-run.</div>' +
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
      // The crawl callback runs INSIDE each crawl iframe and delegates to
      // window.MilgCapture. MilgCapture lives in THIS realm (inlined by the
      // assembler) but its module source is gone after the IIFE ran, so we can't
      // re-run it directly. Instead rebuild a minimal MilgCapture in the iframe
      // from the two serializable members the crawl path needs: the iframe PRE
      // hook and the capture+mask core. Both are self-contained functions, so
      // their .toString() re-defines an equivalent module in the iframe realm.
      var __milgCaptureSrc = '';
      if (window.MilgCapture && window.MilgCapture.getCaptureFn && window.MilgCapture.getIframePreHook) {
        __milgCaptureSrc =
          'window.MilgCapture = { ' +
          'getIframePreHook: function() { return (' + window.MilgCapture.getIframePreHook().toString() + '); }, ' +
          'getCaptureFn: function() { return (' + window.MilgCapture.getCaptureFn().toString() + '); } ' +
          '};';
      }
      // Pre-serialize the REAL region fn in THIS (parent) realm, where window.MilgRegion
      // is defined. The serialized getRegionFn() output is self-contained (it only
      // references window.MilgExtract, which IS injected into the crawl iframe), so it
      // works inside the iframe even though MilgRegion itself is not injected there —
      // exactly how the single-page _captureOpts uses it. Guard: if MilgRegion is
      // unavailable, leave it empty so the crawl callback falls back to its no-op.
      var __milgCrawlRegionFnSrc = '';
      if (window.MilgRegion && window.MilgRegion.getRegionFn) {
        try {
          __milgCrawlRegionFnSrc =
            'window.__milgCrawlRegionFnSrc = ' +
            JSON.stringify(window.MilgRegion.getRegionFn().toString()) + ';';
        } catch (e) { __milgCrawlRegionFnSrc = ''; }
      }
      var __milgSpaSrc = '';
      if (window.__milgSpaExplore && window.MilgSpaExplore && window.MilgSpaMap && window.MilgSpaMap.build) {
        try {
          __milgSpaSrc =
            'window.MilgSpaExplore = ' + window.MilgSpaExplore.toString() + ';\n' +
            'window.MilgSpaMap = { build: ' + window.MilgSpaMap.build.toString() + ' };\n' +
            'window.__milgSpaExplore = true;\n' +
            'window.__milgSpaMaxViews = ' + JSON.stringify(window.__milgSpaMaxViews || 30) + ';\n' +
            'window.__milgSpaTimeBudgetMs = ' + JSON.stringify(window.__milgSpaTimeBudgetMs || 90000) + ';\n' +
            'window.__milgSpaPerPageThreshold = ' + JSON.stringify(window.__milgSpaPerPageThreshold || 3) + ';\n' +
            'window.__milgSpaMaxStatePasses = ' + JSON.stringify(window.__milgSpaMaxStatePasses != null ? window.__milgSpaMaxStatePasses : 8) + ';\n' +
            'window.__milgSpaCaptureScale = ' + JSON.stringify(window.__milgSpaCaptureScale || 1) + ';\n' +
            'window.__milgSpaStateCapture = ' + JSON.stringify(!!window.__milgSpaStateCapture) + ';\n';
        } catch (e) { __milgSpaSrc = ''; }
      }
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
      if (window.__milgSpaExplore && window.MilgSpaExplore && window.MilgSpaMap) {
        _links = [location.href.replace(/#.*$/, '')].concat(_links).slice(0, _cm);
      } else {
        _links = _links.slice(0, _cm - 1);
      }
      var _cResults = (window.__milgSpaExplore && window.MilgSpaExplore && window.MilgSpaMap) ? [] : [{ url: location.href, data: data }];
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
        _crawlOverlay.innerHTML = '<div id="milg-crawl-spinner" style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;will-change:transform"></div>' +
          '<div id="milg-crawl-status" style="color:#fff;margin-top:16px;font-size:14px;font-weight:500">Crawling site...</div>' +
          '<div id="milg-crawl-detail" style="color:rgba(255,255,255,0.6);margin-top:6px;font-size:12px">Loading extraction snippet...</div>' +
          '<style>@keyframes milg-spin{to{transform:rotate(360deg)}}</style>';
        document.body.appendChild(_crawlOverlay);
        function _shieldCrawlEvent(e) { try { e.stopPropagation(); } catch (_e) {} }
        ['click','mousedown','mouseup','pointerdown','pointerup','touchstart','touchend'].forEach(function(t) {
          try { _crawlOverlay.addEventListener(t, _shieldCrawlEvent, false); } catch (e) {}
        });
        var _crawlSpinTimer = null;
        function _startCrawlSpinner() {
          var sp = document.getElementById('milg-crawl-spinner');
          if (!sp || _crawlSpinTimer) return;
          var deg = 0;
          _crawlSpinTimer = setInterval(function() {
            if (!sp.isConnected) { clearInterval(_crawlSpinTimer); _crawlSpinTimer = null; return; }
            deg = (deg + 24) % 360;
            sp.style.transform = 'rotate(' + deg + 'deg)';
          }, 60);
        }
        function _updateCrawlOverlay(status, detail) {
          var s = document.getElementById('milg-crawl-status'); if (s) s.textContent = status;
          var d = document.getElementById('milg-crawl-detail'); if (d) d.textContent = detail;
        }
        function _removeCrawlOverlay() { if (_crawlSpinTimer) { clearInterval(_crawlSpinTimer); _crawlSpinTimer = null; } if (_crawlOverlay.parentNode) _crawlOverlay.parentNode.removeChild(_crawlOverlay); }
        _startCrawlSpinner();

        // Build a self-contained extraction + screenshot + mask script for crawl iframes.
        // _crawlScreenshotCallback is serialized via .toString() into the iframe.
        // It runs INSIDE the crawl iframe's realm (operating on the iframe's own
        // document/window globals) and delegates the full capture+mask pipeline to
        // the shared window.MilgCapture core (injected into the iframe alongside it).
        //
        // Crawl differs from snippet/iframe mode only in its inputs:
        //   - PRE: the iframe pre-hook (MilgCapture.getIframePreHook) — height-unlock,
        //     pre-scroll, force-reveal animated, fast-forward CSS anims, overflow:visible
        //     (exactly what the old hand-rolled crawl PRE did).
        //   - preload: no-op (same-origin iframe; no CORS proxy, images already load).
        //   - expand: true (carousel-expanded second screenshot, same as single-page).
        //   - regions: the REAL region fn (window.MilgRegion.getRegionFn), pre-serialized
        //     in the parent realm and injected as window.__milgCrawlRegionFnSrc, with a
        //     no-op fallback if MilgRegion is unavailable. Crawled pages now get the same
        //     capture treatment as single-page snippet mode.
        //   - sink: a LIVE function (sendFn) closing over `data` + `_finalize`. The core
        //     runs in this same realm (getCaptureFn() called directly, not re-serialized),
        //     so the sink may close over these locals — same discipline as the snippet's
        //     _snippetSend. It merges the unified payload (screenshots, clean, mask,
        //     per-pair mask fields, re-read bboxes) onto `data`, then finalizes.
        function _crawlScreenshotCallback(data) {
          // The extraction engine sets window.__milgData before calling this callback.
          // The capture+mask CORE READS window.__milgData (+ __milgBboxRefs) to build
          // per-pair masks and updatedData, so we must NOT null it. Instead gate the
          // parent poller on window.__milgCrawlPageDone \u2014 the poller waits for that flag
          // (not __milgData truthiness) so it can't grab data before the pipeline finishes.
          window.__milgCrawlPageDone = false;
          window.__milgCrawlPageResults = null;
          window.__milgProgress = 'Loading screenshot library\u2026';
          function _pageUrl() { return window.__milgCrawlPageUrl || location.href; }
          function _baseResult() { return { url: _pageUrl(), data: data }; }
          function _finalize(results) {
            window.__milgProgress = null;
            window.__milgData = data;
            window.__milgCrawlPageResults = results && results.length ? results : [_baseResult()];
            window.__milgCrawlPageDone = true;
          }
          function _finalizeWithSpa() {
            if (!window.__milgSpaExplore || !window.MilgSpaExplore || !window.MilgSpaMap || !window.MilgSpaMap.build) {
              _finalize([_baseResult()]);
              return;
            }
            try { console.log('[milg-crawl-spa] exploring ' + _pageUrl()); } catch (e) {}
            window.__milgProgress = 'Exploring SPA views\u2026';
            window.MilgSpaExplore({
              exploreClicks: true,
              maxViews: (window.__milgSpaMaxViews || 30),
              perPageStateThreshold: (window.__milgSpaPerPageThreshold || 3),
              maxStatePasses: (window.__milgSpaMaxStatePasses != null ? window.__milgSpaMaxStatePasses : 8),
              capture: !!(window.modernScreenshot && window.modernScreenshot.domToCanvas),
              captureScale: (window.__milgSpaCaptureScale || 1),
              stateCapture: !!window.__milgSpaStateCapture,
              timeBudgetMs: (window.__milgSpaTimeBudgetMs || 90000),
              pageEnterGraceMs: 1500
            }).then(function(r) {
              var built = window.MilgSpaMap.build(r, {
                base: _pageUrl().replace(/#.*$/, ''),
                rootTitle: document.title || 'Page',
                inputMethod: 'console-crawl',
                skipInitial: true,
                sourceUrl: _pageUrl()
              });
              window.__milgSpaProvenance = built.provenance;
              try { console.log('[milg-crawl-spa] ' + ((built.results || []).length) + ' SPA view(s) from ' + _pageUrl()); } catch (e) {}
              _finalize([_baseResult()].concat(built.results || []));
            }).catch(function(e) {
              data.meta = data.meta || {};
              data.meta._spaError = (e && e.message) || String(e || 'SPA explore failed');
              try { console.log('[milg-crawl-spa] failed for ' + _pageUrl() + ': ' + data.meta._spaError); } catch (x) {}
              _finalize([_baseResult()]);
            });
          }

          if (!window.MilgCapture || !window.MilgCapture.getCaptureFn) {
            data.screenshots = []; _finalizeWithSpa(); return;
          }

          // Progress reporter \u2014 the crawl overlay polls window.__milgProgress.
          function _crawlProg(label) { window.__milgProgress = label; }

          // No-op preload (same-origin; no proxy). Serialized via opts.preloadSrc.
          function _crawlNoopPreload(_p, _proxyUrl, done) { done(); }

          // No-op region fn (crawl captures no region screenshots). Matches the
          // MilgRegion.getRegionFn() contract: (scale,quality,prog,pairs) -> fn(cb)
          // that yields region results. Serialized via opts.regionFnSrc.
          function _crawlNoopRegionFn(_s, _q, _p, _cp) { return function(rgnCb) { rgnCb([]); }; }

          // Live sink (sendFn): merge the unified capture payload onto `data`, then
          // finalize so the parent poller (iWin.__milgData) picks it up. Runs in this
          // same realm, so it can close over `data` + `_finalize` (same discipline as
          // the snippet's _snippetSend).
          function _crawlSend(payload, isFinal) {
            try {
              data.screenshots = payload.screenshots || [];
              data.screenshotFull = payload.screenshotFull || null;
              data.screenshotClean = payload.screenshotClean || null;
              data.screenshotCleanMeta = payload.screenshotCleanMeta || null;
              data.textMask = payload.textMask || null;
              data.screenshotMeta = payload.screenshotMeta || null;
              data.screenshotError = payload.screenshotError || (payload.screenshotMeta && payload.screenshotMeta.screenshotError) || null;
              data.regionScreenshots = payload.regionScreenshots || [];
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
            } catch (e) {}
            _finalizeWithSpa();
          }

          // Region fn: prefer the REAL region fn pre-serialized in the parent realm
          // (window.__milgCrawlRegionFnSrc, injected alongside MilgCapture). It's
          // self-contained and only references window.MilgExtract (which is injected),
          // so it runs in this iframe even though window.MilgRegion is not present here.
          // Fall back to the no-op if the parent couldn't serialize it (MilgRegion
          // undefined at crawl time) so crawl never hard-crashes. This mirrors the
          // single-page _captureOpts, which uses the same getRegionFn() source.
          var _crawlRegionFnSrc = (typeof window.__milgCrawlRegionFnSrc === 'string' && window.__milgCrawlRegionFnSrc)
            ? window.__milgCrawlRegionFnSrc
            : _crawlNoopRegionFn.toString();

          var _crawlOpts = {
            msgType: 'milg-screenshots-result',
            cdnUrl: 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js',
            proxyUrl: '',
            expand: true,
            preHookSrc: window.MilgCapture.getIframePreHook().toString(),
            preloadSrc: _crawlNoopPreload.toString(),
            regionFnSrc: _crawlRegionFnSrc,
            sendFn: _crawlSend
          };
          // Scale 1.5 / quality 0.8 \u2014 same as crawl has always used (and iframe mode).
          window.MilgCapture.getCaptureFn()(1.5, 0.8, _crawlProg, _crawlOpts)(function() {});
        }
        // The crawl callback delegates to window.MilgCapture, so MilgCapture must be
        // present INSIDE the crawl iframe. It's defined in the snippet's own realm
        // (inlined by the assembler) but its module source is gone, so __milgCaptureSrc
        // (built above) rebuilds an equivalent minimal MilgCapture in the iframe.
        var snippetSrc = 'window.__milgProgress = "Extracting design data\\u2026";\n' +
          'window.MilgExtract = ' + window.MilgExtract.toString() + ';\n' +
          __milgCaptureSrc + '\n' +
          __milgCrawlRegionFnSrc + '\n' +
          __milgSpaSrc + '\n' +
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
                '<button id="milg-crawl-copy-btn" style="padding:12px 28px;font-size:14px;font-weight:600;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:8px;min-width:220px">Copy to Clipboard</button><br>' +
                '<button id="milg-crawl-dl-btn" style="padding:10px 24px;font-size:13px;font-weight:500;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;margin-bottom:10px;min-width:220px">Download JSON</button>' +
                '<div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:8px">Then ' + (_crawlKB > 2048 ? 'import' : 'paste') + ' into the analyzer</div>' +
                '<div style="color:rgba(255,255,255,0.35);font-size:10px;margin-top:8px;line-height:1.45;max-width:380px">Each page captured at one viewport. To analyze another viewport, set it in the analyzer’s viewport selector and re-run.</div>' +
                '</div>';
              function _crawlDoneAction() {
                // Close overlay and reload page to restore styles corrupted by mask capture
                setTimeout(function() {
                  _removeCrawlOverlay();
                  console.log('%c\u21BB Reloading page in 8s to restore styles...', 'color: #64748b;');
                  setTimeout(function() { location.reload(); }, 8000);
                }, 2000);
              }
              document.getElementById('milg-crawl-copy-btn').addEventListener('click', function(e) {
                if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_e) {} }
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
              document.getElementById('milg-crawl-dl-btn').addEventListener('click', function(e) {
                if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_e) {} }
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
                    script.textContent = 'window.__milgCrawlSite=false;\nwindow.__milgCrawlPageUrl=' + JSON.stringify(url) + ';\n' + snippetSrc;
                    iDoc.body.appendChild(script);
                    var polls = 0;
                    var pi = setInterval(function() {
                      if (done) { clearInterval(pi); return; }
                      polls++;
                      try {
                        // Show progress from inside the iframe (extraction → screenshot → mask phases)
                        var prog = iWin.__milgProgress;
                        if (prog) _updateCrawlOverlay('Page ' + (idx + 1) + '/' + _links.length + ': ' + prog, path);
                        // Gate on the explicit completion flag: the crawl callback keeps
                        // __milgData populated for the capture core, so flag (not truthiness)
                        // marks "screenshot + mask pipeline finished".
                        var pageResults = iWin.__milgCrawlPageDone ? (iWin.__milgCrawlPageResults || null) : null;
                        if (pageResults && pageResults.length) {
                          clearInterval(pi); done = true;
                          for (var _pri = 0; _pri < pageResults.length; _pri++) {
                            var pr = pageResults[_pri];
                            if (!pr || !pr.data) continue;
                            pr.data.meta = pr.data.meta || {};
                            if (_pri === 0) pr.data.meta.url = url;
                            _cResults.push({ url: (_pri === 0 ? url : (pr.url || pr.data.meta.url || url)), data: pr.data });
                          }
                          cleanup();
                          var firstData = pageResults[0] && pageResults[0].data;
                          var hasShots = firstData && firstData.screenshots && firstData.screenshots.length > 0;
                          var extraViews = pageResults.length > 1 ? ' + ' + (pageResults.length - 1) + ' SPA view(s)' : '';
                          console.log('%c  \u2713 ' + path + (hasShots ? ' (with screenshots)' : '') + extraViews, 'color: #16a34a;');
                          setTimeout(function() { _next(idx + 1); }, 500);
                        }
                        else if (polls > 160) { clearInterval(pi); done = true; cleanup(); console.log('%c  \u2717 Timeout: ' + path, 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                      } catch(e) { clearInterval(pi); done = true; cleanup(); console.log('%c  \u2717 Error: ' + path + ' (' + e.message + ')', 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                    }, 500);
                  } catch(e) { done = true; cleanup(); console.log('%c  \u2717 Cannot inject snippet: ' + path + ' (' + e.message + ')', 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                }, 1500);
              });
              iframe.srcdoc = html;
              setTimeout(function() { if (done) return; done = true; cleanup(); console.log('%c  \u2717 Timeout (90s): ' + path, 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }, 90000);
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
