// make-it-look-good — Full-Page Capture & Mask Module
// Shared logic for the iframe full-page screenshot + multi-layer text mask pipeline.
// Extracted from analyzer-iframe.js buildScreenshotScript (Stage 6b refactor).
// Used by analyzer-iframe.js (URL/paste analysis). Snippet/crawl adoption is a later stage.
//
// Exposes window.MilgCapture
//
// The core capture+mask function is mode-agnostic and serialized via .toString()
// for injection into the analysis iframe (same discipline as MilgRegion.getRegionFn()).
// Mode-specific PRE prep and image preload are passed in as opts.preHook / opts.preloadFn.

window.MilgCapture = (function() {
  "use strict";

  // --- Mode-specific PRE hook (iframe/URL mode) ---
  // Height-unlock → multi-viewport pre-scroll → reset → force-reveal animated
  // elements → fast-forward CSS animations → overflow:visible. Calls done() when
  // the page is settled and ready for capture. Serialized + injected; must be
  // self-contained (no outer-scope refs beyond its args + DOM/window globals).
  // _prog: progress reporter. done: continuation.
  function _iframePreHook(_prog, done) {
    var vh = window.innerHeight || 900;
    // Unlock height to get true scrollHeight (sites with html,body{height:100%} clamp it)
    // Set overflow:auto explicitly so the inner document is scrollable for IntersectionObservers
    document.documentElement.style.cssText += "height:auto !important;overflow-y:auto !important;";
    document.body.style.cssText += "height:auto !important;";
    void document.body.offsetHeight; // force reflow
    var totalH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var captureH = Math.min(totalH, vh * 10);
    _prog("Pre-scrolling page to load content...");
    console.log("[iframe-ss] Phase 1: Pre-scrolling " + captureH + "px (" + Math.ceil(captureH / vh) + " steps, vh=" + vh + ") ...");
    // Phase 1: Pre-scroll to trigger IntersectionObservers, lazy images, fade-in animations
    var _positions = []; for (var p = 0; p < captureH; p += vh) _positions.push(p);
    var _pi = 0;
    function _scrollNext() {
      if (_pi >= _positions.length) {
        console.log("[iframe-ss] Phase 1 done (scrollY=" + window.scrollY + "). Waiting for content...");
        setTimeout(_startCapture, 800); return; // 800ms for lazy content + animations to start
      }
      window.scrollTo(0, _positions[_pi]);
      // Also scroll documentElement directly (some browsers need this in iframes)
      document.documentElement.scrollTop = _positions[_pi];
      try { window.dispatchEvent(new Event("scroll")); } catch (e) {}
      console.log("[iframe-ss] scroll to " + _positions[_pi] + " → actual=" + window.scrollY);
      _pi++; setTimeout(_scrollNext, 200); // 200ms per step (more time for observers)
    }
    _scrollNext();
    // Phase 2: Reset scroll, force-reveal hidden animated content, prep for capture
    function _startCapture() {
      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";
      window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
      document.querySelectorAll("*").forEach(function(el) {
        if (el.scrollTop > 0) {
          var s = getComputedStyle(el);
          if (s.overflow === "auto" || s.overflow === "scroll" || s.overflowY === "auto" || s.overflowY === "scroll") {
            el.style.scrollBehavior = "auto"; el.scrollTop = 0;
          }
        }
      });
      // Force-finalize scroll-triggered animations:
      // IntersectionObserver doesn't fire in offscreen iframes (browser optimization).
      // Find all elements with opacity:0 that have transitions/animations and force them visible.
      var _revealed = 0;
      document.querySelectorAll("*").forEach(function(el) {
        var cs = getComputedStyle(el);
        if (cs.opacity === "0" && el.tagName !== "SCRIPT" && el.tagName !== "STYLE") {
          var hasTrans = cs.transition && cs.transition.indexOf("opacity") !== -1;
          var hasAnim = cs.animationName && cs.animationName !== "none";
          var hasTransform = cs.transform && cs.transform !== "none";
          var cls = (el.className && typeof el.className === "string") ? el.className.toLowerCase() : "";
          var isScrollAnim = hasTrans || hasAnim || /fade|reveal|animate|aos|scroll|slide|appear/.test(cls);
          if (isScrollAnim) {
            el.style.cssText += ";opacity:1 !important;transform:none !important;transition:none !important;animation:none !important;";
            _revealed++;
          }
        }
      });
      if (_revealed > 0) 0 && console.log("[iframe-ss] Force-revealed " + _revealed + " scroll-animated elements (IO disabled in offscreen iframes)");
      // Also inject a style to fast-forward any remaining CSS animations
      var _ffStyle = document.createElement("style");
      _ffStyle.textContent = "*,*::before,*::after{animation-delay:0s !important;animation-duration:0.01s !important;transition-duration:0s !important;transition-delay:0s !important;}";
      document.head.appendChild(_ffStyle);
      void document.body.offsetHeight;
      // Switch to overflow:visible for capture
      document.documentElement.style.cssText += "overflow:visible !important;";
      document.body.style.cssText += "overflow:visible !important;";
      // Overflow expansion for carousels is deferred — happens AFTER clean screenshot capture
      void document.body.offsetHeight;
      _prog("Waiting for animations to settle...");
      0 && console.log("[iframe-ss] Phase 2: Waiting for animations to finalize...");
      setTimeout(function() {
        if (typeof window.__milgReReadBboxes === "function") {
          var res = window.__milgReReadBboxes();
          0 && console.log("[iframe-ss] Re-read bboxes: " + res);
        }
        done();
      }, 1500);
    }
  }

  // --- Mode-specific image preload (iframe/URL mode) ---
  // Preloads cross-origin <img>, <source srcset>, and CSS background-image URLs
  // through the CORS proxy → data URI before capture so domToCanvas can rasterize
  // them. proxyUrl empty → no-op. Serialized + injected.
  function _iframePreloadFn(_prog, proxyUrl, done) {
    var _imgPx = proxyUrl || "";
    function _preloadImages(cb) {
      if (!_imgPx) { cb(); return; }
      var imgs = document.querySelectorAll("img");
      var srcs = document.querySelectorAll("source[srcset]");
      var jobs = [];
      imgs.forEach(function(i) {
        if (!i.src || i.src.indexOf("data:") === 0 || i.src.indexOf("blob:") === 0) return;
        if (i.src.indexOf(location.origin) === 0) return;
        var _rawSrc = i.getAttribute("src");
        if (_rawSrc && _rawSrc.charAt(0) === "#") return;
        var _cleanUrl = i.src.split("#")[0]; if (!_cleanUrl) return;
        jobs.push({ el: i, url: _cleanUrl, attr: "src" });
      });
      srcs.forEach(function(s) {
        var ss = s.getAttribute("srcset"); if (!ss) return;
        if (ss.charAt(0) === "#") return;
        var u = ss.split(",")[0].trim().split(/\s+/)[0];
        if (!u || u.indexOf("data:") === 0 || u.indexOf("blob:") === 0) return;
        if (u.indexOf(location.origin) === 0) return;
        var _cleanU = u.split("#")[0]; if (!_cleanU) return;
        jobs.push({ el: s, url: _cleanU, attr: "srcset" });
      });
      if (jobs.length === 0) { cb(); return; }
      _prog("Preloading " + jobs.length + " images via proxy...");
      console.log("[iframe-ss] Preloading " + jobs.length + " cross-origin images via proxy");
      var done2 = 0;
      jobs.forEach(function(j) {
        var pxUrl = _imgPx + "?url=" + encodeURIComponent(j.url);
        fetch(pxUrl).then(function(r) {
          if (!r.ok) throw new Error(r.status); return r.blob();
        }).then(function(blob) {
          return new Promise(function(res) {
            var fr = new FileReader(); fr.onload = function() { res(fr.result); }; fr.onerror = function() { res(null); }; fr.readAsDataURL(blob);
          });
        }).then(function(dataUri) {
          if (dataUri) {
            if (j.attr === "src") j.el.src = dataUri;
            else if (j.attr === "srcset") j.el.setAttribute("srcset", dataUri);
          }
        }).catch(function(e) {
          console.warn("[iframe-ss] Image preload failed:", j.url, e && e.message || "");
        }).finally(function() {
          done2++; if (done2 >= jobs.length) cb();
        });
      });
    }
    function _preloadBgImages(cb) {
      if (!_imgPx) { cb(); return; }
      var jobs = [];
      document.querySelectorAll("*").forEach(function(el) {
        var bg = getComputedStyle(el).backgroundImage;
        if (!bg || bg === "none") return;
        var m = bg.match(/url\("?(https?:\/\/[^"\)]+)"?\)/);
        if (!m || !m[1] || m[1].indexOf(location.origin) === 0) return;
        var _bgUrl = m[1].split("#")[0]; if (!_bgUrl) return;
        jobs.push({ el: el, url: _bgUrl, fullBg: bg });
      });
      if (jobs.length === 0) { cb(); return; }
      console.log("[iframe-ss] Preloading " + jobs.length + " background images via proxy");
      var done2 = 0;
      jobs.forEach(function(j) {
        fetch(_imgPx + "?url=" + encodeURIComponent(j.url)).then(function(r) {
          if (!r.ok) throw new Error(r.status); return r.blob();
        }).then(function(blob) {
          return new Promise(function(res) { var fr = new FileReader(); fr.onload = function() { res(fr.result); }; fr.onerror = function() { res(null); }; fr.readAsDataURL(blob); });
        }).then(function(d) {
          if (d) j.el.style.backgroundImage = j.fullBg.replace(j.url, d);
        }).catch(function() {}).finally(function() { done2++; if (done2 >= jobs.length) cb(); });
      });
    }
    _preloadImages(function() { _preloadBgImages(function() { done(); }); });
  }

  // --- Serializable capture + mask CORE ---
  // Returned by getCaptureFn(). Injected into the analysis iframe via .toString().
  // MUST be self-contained — no references to outer module scope (the helpers
  // _iframePreHook / _iframePreloadFn are passed in as SOURCE STRINGS via opts and
  // rebuilt inside; the region fn is also passed as a source string via opts).
  //
  // scale, quality: numbers. prog: progress reporter fn. opts: {
  //   msgType:     postMessage type string (used by failure-path postMessages)
  //   cdnUrl:      modern-screenshot CDN script URL
  //   proxyUrl:    CORS proxy URL for image preload (passed to preloadFn)
  //   expand:      bool — do the carousel-expanded second screenshot (iframe: true)
  //   preHookSrc:  source string of preHook(prog, done) — mode-specific PRE prep
  //   preloadSrc:  source string of preloadFn(prog, proxyUrl, done) — image preload
  //   regionFnSrc: source string of MilgRegion.getRegionFn() — region screenshots
  //   sendFn:      OPTIONAL live function sendFn(payload, isFinal) — pluggable output
  //                sink. Used when the core runs in the SAME realm as the caller
  //                (snippet mode: getCaptureFn() is called directly, not serialized),
  //                so the sink may close over caller locals (its `data` object etc.).
  //   sendFnSrc:   OPTIONAL source string of sendFn(payload, isFinal) — same contract,
  //                for callers that serialize the whole core (none today). If neither
  //                sendFn nor sendFnSrc is given the default is parent.postMessage —
  //                i.e. the original iframe behavior.
  //                `payload` always carries `.type` (msgType) so a postMessage sink
  //                is a pass-through; `isFinal` marks the terminal full-result message.
  // }
  function _captureFn(scale, quality, prog, opts) {
    return function(callback) {
      var _sc = scale;
      var _q = quality;
      var _prog = prog;
      var _msgType = opts.msgType;
      var _cdn = opts.cdnUrl;
      var _proxyUrl = opts.proxyUrl || "";
      var _expand = !!opts.expand;
      var _mid = window.__milgIframeId || "";
      var vh = window.innerHeight || 900;
      var fullH = 0;

      // Rebuild mode-specific hooks from source strings (serialization-safe).
      var _preHook = (0, eval)("(" + opts.preHookSrc + ")");
      var _preloadFn = (0, eval)("(" + opts.preloadSrc + ")");
      var _regionFn = (0, eval)("(" + opts.regionFnSrc + ")");

      // Pluggable output sink. Default = original iframe behavior (postMessage to
      // parent). The snippet supplies opts.sendFnSrc to route results into its
      // `data` object + finalize, since it has no parent window to message.
      var _sendFn = (typeof opts.sendFn === "function")
        ? opts.sendFn
        : opts.sendFnSrc
        ? (0, eval)("(" + opts.sendFnSrc + ")")
        : function(payload, isFinal) {
            // Default sink = postMessage to parent (iframe/URL mode). For the final
            // full-result message, keep the 3-tier size-limit retry (drop updatedData,
            // then drop screenshots) that the iframe path has always relied on.
            try { parent.postMessage(payload, "*"); } catch (e) {
              if (!isFinal) return;
              console.warn("[milg-warn] postMessage failed (" + e.message + "), retrying without updatedData");
              payload.updatedData = null;
              try { parent.postMessage(payload, "*"); } catch (e2) {
                console.warn("[milg-warn] Retry failed, dropping screenshots");
                payload.screenshots = []; payload.screenshotFull = null;
                try { parent.postMessage(payload, "*"); } catch (e3) {}
              }
            }
          };

      // Record CSP violations during capture so failure paths can say exactly
      // what the page blocked (img-src data:, connect-src, …).
      var _cspViolations = [];
      try { document.addEventListener("securitypolicyviolation", function(ev) { _cspViolations.push((ev.effectiveDirective || ev.violatedDirective || "?") + " → " + (ev.blockedURI || "?")); }); } catch (e) {}

      // Skip the capture overlay while cloning the DOM, so it can stay visible to
      // the user for the WHOLE capture without being baked into screenshots/masks.
      function _msFilter(n) { return !(n && n.getAttribute && n.getAttribute("data-milg-overlay")); }

      // modern-screenshot rasterizes by loading the cloned DOM as an SVG data: URL
      // in an <img>. If the page's CSP img-src blocks data: URLs, that load can
      // never paint — every capture would come back correctly sized but fully
      // transparent. Probe with a 1x1 data: SVG up front (~5ms when allowed) so we
      // can fall back fast instead of burning 45s+ per layer on hopeless captures.
      function _probeDataUrl(cb) {
        var _pd = false;
        var im = new Image();
        var t = setTimeout(function() { if (!_pd) { _pd = true; cb(false); } }, 2500);
        im.onload = function() { if (!_pd) { _pd = true; clearTimeout(t); cb(true); } };
        im.onerror = function() { if (!_pd) { _pd = true; clearTimeout(t); cb(false); } };
        try { im.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'); } catch (e) { if (!_pd) { _pd = true; clearTimeout(t); cb(false); } }
      }

      // A correctly-sized but fully transparent canvas means the rasterizer's SVG
      // <img> never painted — catch it here instead of shipping a blank image.
      function _isBlank(cv) {
        try {
          var w = Math.max(1, Math.min(cv.width, 64)), h = Math.max(1, Math.min(cv.height, 64));
          var t = document.createElement("canvas"); t.width = w; t.height = h;
          var tx = t.getContext("2d"); tx.drawImage(cv, 0, 0, w, h);
          var d = tx.getImageData(0, 0, w, h).data;
          for (var i = 3; i < d.length; i += 4) if (d[i] > 8) return false;
          return true;
        } catch (e) { return true; } // tainted/unreadable → same as blank for our purposes
      }

      // Last-resort renderer for pages whose CSP makes DOM rasterization impossible:
      // repaint the live layout with plain canvas 2D — background rects + borders,
      // pixel-copied images where readable (hatched placeholders where blocked/tainted),
      // and text via fillText on the real line boxes. Approximate (no z-index, clips,
      // gradients or SVG), but it preserves layout, palette and content, and canvas
      // drawing itself is never subject to CSP.
      function _syntheticRender() {
        var W = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0, 320);
        var H = Math.min(Math.max(fullH, vh), 20000);
        var c = document.createElement("canvas");
        c.width = Math.round(W * _sc); c.height = Math.round(H * _sc);
        var x = c.getContext("2d");
        function _opaque(col) { return col && col !== "transparent" && col.indexOf("rgba(0, 0, 0, 0)") !== 0; }
        var _bodyBg = "", _htmlBg = "";
        try { _bodyBg = getComputedStyle(document.body).backgroundColor; _htmlBg = getComputedStyle(document.documentElement).backgroundColor; } catch (e) {}
        x.fillStyle = _opaque(_bodyBg) ? _bodyBg : _opaque(_htmlBg) ? _htmlBg : "#fff";
        x.fillRect(0, 0, c.width, c.height);
        var _sy = window.scrollY || 0, _sxp = window.scrollX || 0;
        var _imgsDrawn = 0, _imgsPh = 0, _texts = 0;
        function _drawPh(px, py, pw, ph) {
          if (pw < 8 || ph < 8) return;
          x.fillStyle = "#f1f5f9"; x.fillRect(px, py, pw, ph);
          x.strokeStyle = "#cbd5e1"; x.lineWidth = 1;
          x.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
          x.beginPath(); x.moveTo(px, py); x.lineTo(px + pw, py + ph); x.moveTo(px + pw, py); x.lineTo(px, py + ph); x.stroke();
          _imgsPh++;
        }
        // Readability check on a 1x1 scratch canvas so the MAIN canvas never taints.
        function _readable(el, needNatural) {
          if (needNatural && !el.naturalWidth) return false;
          try {
            var t = document.createElement("canvas"); t.width = 1; t.height = 1;
            var tx = t.getContext("2d"); tx.drawImage(el, 0, 0, 1, 1); tx.getImageData(0, 0, 1, 1);
            return true;
          } catch (e) { return false; }
        }
        var els = document.body.getElementsByTagName("*");
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          var tag = el.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "LINK" || tag === "META") continue;
          // SVG content can't be repainted without data: URLs — skip it quietly.
          if (el.namespaceURI && el.namespaceURI.indexOf("svg") !== -1) continue;
          if (el.closest && el.closest("[data-milg-overlay]")) continue;
          var cs; try { cs = getComputedStyle(el); } catch (e) { continue; }
          if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
          var r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          var top = r.top + _sy, left = r.left + _sxp;
          if (top > H || top + r.height < 0) continue;
          var px = left * _sc, py = top * _sc, pw = r.width * _sc, ph = r.height * _sc;
          if (_opaque(cs.backgroundColor)) { x.fillStyle = cs.backgroundColor; x.fillRect(px, py, pw, ph); }
          var _bw = parseFloat(cs.borderTopWidth) || 0;
          if (_bw > 0 && _opaque(cs.borderTopColor)) { x.strokeStyle = cs.borderTopColor; x.lineWidth = Math.max(1, _bw * _sc); x.strokeRect(px, py, pw, ph); }
          if (tag === "IMG") {
            if (_readable(el, true)) { try { x.drawImage(el, px, py, pw, ph); _imgsDrawn++; } catch (e) { _drawPh(px, py, pw, ph); } }
            else { _drawPh(px, py, pw, ph); }
            continue;
          }
          if (tag === "CANVAS" || tag === "VIDEO") {
            if (_readable(el, false)) { try { x.drawImage(el, px, py, pw, ph); _imgsDrawn++; } catch (e) { _drawPh(px, py, pw, ph); } }
            else { _drawPh(px, py, pw, ph); }
            continue;
          }
          if (tag === "IFRAME") { _drawPh(px, py, pw, ph); continue; }
          // Large unrendered background images get a placeholder hatch too (heroes, cards).
          if (cs.backgroundImage && cs.backgroundImage.indexOf("url(") !== -1 && r.width * r.height > 10000) { _drawPh(px, py, pw, ph); }
          if ((tag === "INPUT" || tag === "TEXTAREA") && (el.value || el.placeholder)) {
            x.fillStyle = cs.color; x.textBaseline = "middle";
            x.font = cs.fontStyle + " " + cs.fontWeight + " " + ((parseFloat(cs.fontSize) || 14) * _sc) + "px " + cs.fontFamily;
            x.fillText(el.value || el.placeholder, px + 8 * _sc, py + ph / 2);
            _texts++;
            continue;
          }
          // Text: draw each direct text node onto its real layout line boxes.
          for (var node = el.firstChild; node; node = node.nextSibling) {
            if (node.nodeType !== 3) continue;
            var _txt = node.textContent.replace(/\s+/g, " ").trim();
            if (!_txt) continue;
            var rects;
            try { var rg = document.createRange(); rg.selectNodeContents(node); rects = rg.getClientRects(); } catch (e) { continue; }
            if (!rects || !rects.length) continue;
            x.fillStyle = cs.color;
            x.font = cs.fontStyle + " " + cs.fontWeight + " " + ((parseFloat(cs.fontSize) || 14) * _sc) + "px " + cs.fontFamily;
            x.textBaseline = "middle";
            var _words = _txt.split(" "), _wi = 0;
            for (var _ri = 0; _ri < rects.length && _wi < _words.length; _ri++) {
              var rr = rects[_ri];
              if (!rr.width || !rr.height) continue;
              var _maxW = rr.width * _sc + 2;
              var _line = _words[_wi++];
              while (_wi < _words.length && x.measureText(_line + " " + _words[_wi]).width <= _maxW) { _line += " " + _words[_wi++]; }
              if (_ri === rects.length - 1) { while (_wi < _words.length) _line += " " + _words[_wi++]; }
              x.fillText(_line, (rr.left + _sxp) * _sc, (rr.top + _sy + rr.height / 2) * _sc);
              _texts++;
            }
          }
        }
        return { canvas: c, imgsDrawn: _imgsDrawn, imgsPh: _imgsPh, texts: _texts };
      }

      // Send a synthetic-fallback result. Masks and regions are skipped on purpose:
      // pixel-verify against a repainted approximation would be meaningless.
      function _sendSynthetic(reason) {
        try {
          _prog("CSP blocks rendering — drawing fallback screenshot…");
          console.warn("%c[milg] " + reason + " Building a canvas-drawn fallback instead: layout, colors and text are repainted; readable images are pixel-copied; blocked ones become placeholders. Pixel-level text masks are skipped.", "color:#b45309");
          if (_cspViolations.length) console.warn("[milg] CSP violations seen during capture: " + _cspViolations.slice(0, 8).join(", ") + (_cspViolations.length > 8 ? " … +" + (_cspViolations.length - 8) + " more" : ""));
          var _syn = _syntheticRender();
          var c = _syn.canvas;
          var uri; try { uri = c.toDataURL("image/webp", _q); } catch (e) { uri = ""; }
          console.log("[iframe-ss] Synthetic fallback screenshot: " + c.width + "x" + c.height + " (" + _syn.imgsDrawn + " images copied, " + _syn.imgsPh + " placeholders, " + _syn.texts + " text runs)" + (uri ? "" : " — encode failed"));
          _sendFn({
            type: _msgType, _iframeId: _mid,
            screenshots: uri ? [uri] : [],
            screenshotFull: uri || null,
            screenshotClean: uri || null,
            textMask: null,
            screenshotMeta: { scale: _sc, viewportHeight: vh, sectionCount: 1, canvasWidth: c.width, canvasHeight: c.height, docHeightAtCapture: fullH, calibrationOffsetY: 0, calibrationSamples: [], synthetic: true, syntheticReason: reason },
            screenshotCleanMeta: { canvasWidth: c.width, canvasHeight: c.height, synthetic: true },
            regionScreenshots: [],
            updatedData: null
          }, true);
        } catch (e) {
          console.warn("[iframe-ss] synthetic fallback failed:", e);
          _sendFn({ type: _msgType, screenshots: [], _iframeId: _mid }, true);
        }
      }

      // PRE: mode-specific prep (height-unlock/pre-scroll/force-reveal/anim/overflow).
      _preHook(_prog, function() {
        fullH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        console.log("[iframe-ss] scrollHeight=" + fullH + " vh=" + vh);
        _probeDataUrl(function(_dataOk) {
        window.__milgDataUrlOk = _dataOk;
        if (!_dataOk) {
          _sendSynthetic("This page's CSP blocks data: image URLs, which the screenshot renderer needs internally — it can never rasterize here (that's also why captures came back transparent).");
          return;
        }
        var s = document.createElement("script");
        s.src = _cdn;
        // AMD guard: pages with an AMD loader (Monaco/RequireJS set window.define.amd)
        // make the UMD build register as an anonymous AMD module instead of setting
        // window.modernScreenshot — capture would then bail out silently. Mask
        // define.amd while the library loads and restore it right after.
        var _amdDef = (typeof window.define === "function" && window.define.amd) ? window.define : null;
        var _amdSaved = _amdDef ? _amdDef.amd : null;
        if (_amdDef) { try { _amdDef.amd = undefined; } catch (e) {} }
        function _amdRestore() { if (_amdDef) { try { _amdDef.amd = _amdSaved; } catch (e) {} } }
        s.onload = function() {
          _amdRestore();
          var ms = window.modernScreenshot;
          if (!ms || !ms.domToCanvas) { console.warn("[iframe-ss] screenshot library loaded but window.modernScreenshot is missing (AMD loader conflict?) — skipping screenshots"); _sendFn({ type: _msgType, screenshots: [], _iframeId: _mid }, true); return; }

          // Preload images via proxy → data URI, then capture
          _preloadFn(_prog, _proxyUrl, function() {
            // Phase A: Clean screenshot (page as-rendered, before overflow expansion)
            _prog("Rendering screenshot (0s)…");
            console.log("[iframe-ss] Capturing clean screenshot at " + _sc + "x...");
            // Heartbeat: domToCanvas is one long async call with no internal progress,
            // so tick an elapsed-seconds counter to the overlay — otherwise an
            // image-heavy or CSP-locked page looks frozen for up to 45s.
            var _hbT = Date.now();
            var _hb = setInterval(function() { _prog("Rendering screenshot (" + Math.round((Date.now() - _hbT) / 1000) + "s)… image-heavy or CSP-locked pages take longer"); }, 1500);
            ms.domToCanvas(document.documentElement, { scale: _sc, timeout: 45000, filter: _msFilter }).then(function(_cleanCanvas) {
              if (typeof _hb !== "undefined") clearInterval(_hb);
              if (_isBlank(_cleanCanvas)) {
                console.warn("[iframe-ss] Clean screenshot rendered fully transparent (" + _cleanCanvas.width + "x" + _cleanCanvas.height + ")");
                _sendSynthetic("The rendered screenshot came back empty — the page's CSP (or a rasterizer failure) blocked the internal image load.");
                return;
              }
              var _cleanUri; try { _cleanUri = _cleanCanvas.toDataURL("image/webp", _q); } catch (e) { _cleanUri = ""; }
              var _cleanW = _cleanCanvas.width, _cleanH = _cleanCanvas.height;
              console.log("[iframe-ss] Clean screenshot: " + _cleanW + "x" + _cleanH);

              // Inject and run region screenshot function (serialized to avoid escaping issues).
              var _cp2 = window.__milgData && window.__milgData.colors ? window.__milgData.colors.contrastPairs || [] : [];
              var _buildRegionScreenshots = _regionFn(_sc, _q, _prog, _cp2);
              _buildRegionScreenshots(function(_regionResults) {
                window.__milgRegionScreenshots = _regionResults;

                // Save clean-screenshot bbox coordinates before Phase B expansion.
                var _savedBboxes = [];
                if (window.__milgBboxRefs) {
                  window.__milgBboxRefs.forEach(function(ref) {
                    if (ref.obj && ref.obj[ref.key]) {
                      var b = ref.obj[ref.key];
                      _savedBboxes.push({ obj: ref.obj, key: ref.key, left: b.left, top: b.top, width: b.width, height: b.height, _rcid: b._rcid });
                    }
                  });
                }

                // Phase B: Expand overflow:hidden containers with transformed descendants (carousels/sliders)
                var _expanded = 0;
                if (_expand) {
                  document.querySelectorAll("*").forEach(function(container) {
                    var cs = getComputedStyle(container);
                    var ov = cs.overflow || "", ovx = cs.overflowX || "", ovy = cs.overflowY || "";
                    var isClipping = ov === "hidden" || ov === "clip" || ovx === "hidden" || ovx === "clip" || ovy === "hidden" || ovy === "clip";
                    if (!isClipping) return;
                    var cr = container.getBoundingClientRect();
                    if (cr.width < 100 || cr.height < 30) return;
                    var transEls = [];
                    container.querySelectorAll("*").forEach(function(desc) {
                      var ct = getComputedStyle(desc).transform;
                      if (!ct || ct === "none") return;
                      var _m = ct.match(/matrix\(([^)]+)\)/);
                      if (!_m) return;
                      var _p = _m[1].split(",");
                      var _tx = Math.abs(parseFloat(_p[4]) || 0);
                      var _ty = Math.abs(parseFloat(_p[5]) || 0);
                      if (_tx > 5 || _ty > 5) transEls.push(desc);
                    });
                    if (transEls.length === 0) return;
                    container.style.cssText += ";overflow:visible !important;";
                    transEls.forEach(function(el) { el.style.cssText += ";transform:none !important;"; });
                    _expanded++;
                  });
                  if (_expanded > 0) console.log("[iframe-ss] Expanded " + _expanded + " overflow:hidden containers with transformed descendants");
                  void document.body.offsetHeight;
                  // Re-read bboxes after expansion so they match the expanded layout
                  if (_expanded > 0 && typeof window.__milgReReadBboxes === "function") {
                    var _res2 = window.__milgReReadBboxes();
                    console.log("[iframe-ss] Re-read bboxes after expansion: " + _res2);
                  }
                  // Recalculate doc height after expansion (may have grown)
                  fullH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
                }

                // Phase C: Expanded screenshot (all carousel content visible, bboxes aligned)
                _prog("Capturing expanded screenshot...");
                console.log("[iframe-ss] Capturing expanded screenshot at " + _sc + "x...");
                ms.domToCanvas(document.documentElement, { scale: _sc, timeout: 45000, filter: _msFilter }).then(function(fc) {
                  console.log("[iframe-ss] Expanded screenshot: " + fc.width + "x" + fc.height);
                  var fullUri; try { fullUri = fc.toDataURL("image/webp", _q); } catch (e) { console.warn("[milg-warn] WebP conversion failed:", e.message); fullUri = ""; }
                  var _cw = fc.width, _ch = fc.height;
                  // Restore clean-screenshot bbox coordinates so updatedData matches the displayed image
                  _savedBboxes.forEach(function(s2) { var nb = { left: s2.left, top: s2.top, width: s2.width, height: s2.height }; if (s2._rcid) nb._rcid = s2._rcid; s2.obj[s2.key] = nb; });

                  var _maskResults = {}; // Defined HERE so _sendFinal can access it (same scope)
                  function _sendFinal() {
                    var _raw = window.__milgData || null;
                    // Build a lean updatedData with ONLY re-read bboxes (not full extraction + screenshots).
                    var updatedData = null;
                    if (_raw) {
                      updatedData = {
                        colors: { contrastPairs: _raw.colors ? _raw.colors.contrastPairs : [] },
                        typography: { fontSizes: _raw.typography ? _raw.typography.fontSizes : [], headings: _raw.typography ? _raw.typography.headings : [], maxLineLength: _raw.typography ? _raw.typography.maxLineLength : null },
                        interaction: { touchTargets: _raw.interaction ? _raw.interaction.touchTargets : [] },
                        layout: { offscreenElements: _raw.layout ? _raw.layout.offscreenElements : [], hiddenPanelIssues: _raw.layout ? _raw.layout.hiddenPanelIssues : [], alignmentElements: _raw.layout ? _raw.layout.alignmentElements : [], borderRadii: _raw.layout ? _raw.layout.borderRadii : [] }
                      };
                    }
                    // Explicitly copy mask results onto updatedData pairs (don't rely on object identity)
                    if (updatedData && updatedData.colors && updatedData.colors.contrastPairs && typeof _maskResults !== "undefined") {
                      Object.keys(_maskResults).forEach(function(idx) {
                        var i = parseInt(idx, 10); var mr = _maskResults[idx];
                        if (updatedData.colors.contrastPairs[i] && mr) {
                          updatedData.colors.contrastPairs[i]._maskBmp = mr.bmp;
                          updatedData.colors.contrastPairs[i]._maskPacked = !!mr.packed;
                          updatedData.colors.contrastPairs[i]._maskW = mr.w;
                          updatedData.colors.contrastPairs[i]._maskH = mr.h;
                          updatedData.colors.contrastPairs[i]._maskLayer = mr.layer;
                          updatedData.colors.contrastPairs[i]._maskDark = mr.dark;
                        }
                      });
                    }
                    var msg = {
                      type: _msgType, _iframeId: _mid,
                      screenshots: fullUri ? [fullUri] : [],
                      screenshotFull: fullUri || null,
                      screenshotClean: _cleanUri || null,
                      textMask: null, // legacy combined-mask field; per-pair _maskBmp is the live mask source
                      screenshotMeta: {
                        scale: _sc, viewportHeight: vh, sectionCount: 1,
                        canvasWidth: _cw, canvasHeight: _ch,
                        docHeightAtCapture: fullH,
                        calibrationOffsetY: 0, calibrationSamples: []
                      },
                      screenshotCleanMeta: { canvasWidth: _cleanW, canvasHeight: _cleanH },
                      regionScreenshots: window.__milgRegionScreenshots || [],
                      updatedData: updatedData
                    };
                    var _udPairs = updatedData && updatedData.colors ? updatedData.colors.contrastPairs || [] : [];
                    var _maskCount = _udPairs.filter(function(p) { return !!p._maskBmp; }).length;
                    var _rcidCount = _udPairs.filter(function(p) { return !!p._regionContainerId; }).length;
                    var _clipCount = _udPairs.filter(function(p) { return !!p._isClipped; }).length;
                    console.log("[D] iframe→parent pairs=" + _udPairs.length + " rcid=" + _rcidCount + " clipped=" + _clipCount + " masks=" + _maskCount);
                    _sendFn(msg, true);
                  }

                  // Wait for fonts, then inline them as @font-face data URIs before mask capture.
                  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function() {
                    var _cssFontCount = 0; try { Array.from(document.styleSheets).forEach(function(ss2) { try { Array.from(ss2.cssRules).forEach(function(r) { if (r instanceof CSSFontFaceRule) _cssFontCount++; }); } catch (e) {} }); } catch (e) {}
                    console.log("[iframe-ss] Font prep: " + document.fonts.size + " API fonts, " + _cssFontCount + " CSS @font-face rules");
                    // Step 2: Layered text masks with transition kill
                    _prog("Building text masks...");
                    console.log("[iframe-ss] Step 2: Layered masks (fonts: " + document.fonts.size + " loaded)...");
                    // Phase A: Kill ALL transitions on every element BEFORE any color changes
                    document.querySelectorAll("*").forEach(function(el) { el.style.setProperty("transition-duration", "0s", "important"); el.style.setProperty("transition", "none", "important"); });
                    void document.body.offsetHeight;
                    // Phase A2: Neutralize absolute/fixed overlays that sit on top of text.
                    var _neutralized = 0;
                    document.querySelectorAll("*").forEach(function(el) {
                      var cs = getComputedStyle(el);
                      if (cs.position === "absolute" || cs.position === "fixed") {
                        if (!el.textContent.trim()) {
                          el.style.setProperty("display", "none", "important"); _neutralized++;
                        } else if (cs.pointerEvents === "none") {
                          el.style.setProperty("background", "transparent", "important");
                          el.style.setProperty("background-image", "none", "important"); _neutralized++;
                        }
                      }
                    });
                    if (_neutralized) console.log("[iframe-ss] Neutralized " + _neutralized + " overlays");
                    void document.body.offsetHeight;
                    // Re-read bboxes AFTER neutralization — hiding overlays can shift layout
                    if (_neutralized > 0 && typeof window.__milgReReadBboxes === "function") {
                      var res2 = window.__milgReReadBboxes();
                      console.log("[iframe-ss] Re-read bboxes post-neutralize: " + res2);
                    }
                    // Phase B: Global mask style — white bg, white text, hide media
                    var _maskStyle = document.createElement("style");
                    _maskStyle.setAttribute("data-milg-mask", "1");
                    _maskStyle.textContent = "*,*::before,*::after{color:#fff !important;background-color:transparent !important;background-image:none !important;background:transparent !important;border-color:transparent !important;box-shadow:none !important;text-shadow:none !important;outline-color:transparent !important;-webkit-text-fill-color:#fff !important;opacity:1 !important;transition:none !important;animation:none !important;}html{background:#fff !important;}img,svg,video,canvas,picture,iframe{opacity:0 !important;}" +
                      // Keep the capture overlay legible during mask passes — it is filtered
                      // out of the canvas clone, so exempting it here only affects the user's view.
                      "[data-milg-overlay]{background:rgba(0,0,0,0.6) !important;}[data-milg-overlay] *{color:#fff !important;-webkit-text-fill-color:#fff !important;border-color:rgba(255,255,255,0.3) !important;border-top-color:#fff !important;}";
                    document.head.appendChild(_maskStyle); void document.body.offsetHeight;
                    // Re-read bboxes AFTER mask style — white bg + hidden media can shift layout
                    if (typeof window.__milgReReadBboxes === "function") {
                      var res3 = window.__milgReReadBboxes();
                      console.log("[iframe-ss] Re-read bboxes post-mask-style: " + res3);
                    }
                    // Phase C: Collect pair elements and build overlap layers
                    var _refs = window.__milgBboxRefs || [];
                    var _pairs = (window.__milgData && window.__milgData.colors && window.__milgData.colors.contrastPairs) || [];
                    var _pairEls = [];
                    _refs.forEach(function(ref) {
                      if (!ref.el || !ref.obj || ref.obj.ratio === undefined) return;
                      var idx = _pairs.indexOf(ref.obj);
                      if (idx >= 0) _pairEls.push({ el: ref.el, pair: ref.obj, idx: idx, bbox: ref.obj.bbox });
                    });
                    function _overlaps(a, b) {
                      if (!a.bbox || !b.bbox) return false;
                      return a.bbox.left < b.bbox.left + b.bbox.width && a.bbox.left + a.bbox.width > b.bbox.left &&
                        a.bbox.top < b.bbox.top + b.bbox.height && a.bbox.top + a.bbox.height > b.bbox.top;
                    }
                    var _layers = []; var _remaining = _pairEls.slice();
                    while (_remaining.length > 0) {
                      var layer0 = []; var next = [];
                      _remaining.forEach(function(pe) {
                        if (layer0.some(function(l) { return _overlaps(pe, l); })) { next.push(pe); } else { layer0.push(pe); }
                      });
                      _layers.push(layer0); _remaining = next;
                    }
                    console.log("[iframe-ss] " + _pairEls.length + " elements in " + _layers.length + " layers");
                    // Phase C2: Bake text-transform into actual text content.
                    var _ttFixed = 0;
                    document.querySelectorAll("*").forEach(function(el) {
                      var tt = getComputedStyle(el).textTransform;
                      if (tt === "uppercase" || tt === "lowercase" || tt === "capitalize") {
                        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
                        var tn; while (tn = walker.nextNode()) {
                          var orig = tn.textContent; if (!orig.trim()) continue;
                          if (tt === "uppercase") tn.textContent = orig.toUpperCase();
                          else if (tt === "lowercase") tn.textContent = orig.toLowerCase();
                          else if (tt === "capitalize") tn.textContent = orig.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
                          _ttFixed++;
                        }
                      }
                    });
                    if (_ttFixed) console.log("[iframe-ss] Baked text-transform for " + _ttFixed + " text nodes");
                    // Phase D: Capture one mask per layer — set layer elements to black via inline style
                    var _li = 0;
                    function _nextLayer() {
                      if (_li >= _layers.length) { console.log("[iframe-ss] All " + _layers.length + " mask layers done"); _sendFinal(); return; }
                      var layer = _layers[_li]; _li++;
                      _prog("Text mask layer " + _li + "/" + _layers.length + "...");
                      console.log("[iframe-ss] Layer " + _li + ": " + layer.length + " elements");
                      layer.forEach(function(pe) {
                        pe.el.style.setProperty("color", "#000", "important");
                        pe.el.style.setProperty("-webkit-text-fill-color", "#000", "important");
                        pe.el.querySelectorAll("*").forEach(function(ch) {
                          ch.style.setProperty("color", "#000", "important");
                          ch.style.setProperty("-webkit-text-fill-color", "#000", "important");
                        });
                      });
                      void document.body.offsetHeight;
                      console.log("[iframe-ss] Layer " + _li + ": starting domToCanvas...");
                      var _layerDone = false;
                      var _layerTimer = setTimeout(function() { if (!_layerDone) { _layerDone = true; console.warn("[iframe-ss] Layer " + _li + " domToCanvas timed out (120s)"); setTimeout(_nextLayer, 0); } }, 120000);
                      ms.domToCanvas(document.documentElement, { scale: _sc, timeout: 12000, filter: _msFilter }).then(function(mc) {
                        if (_layerDone) return; _layerDone = true; clearTimeout(_layerTimer);
                        console.log("[iframe-ss] Layer " + _li + " captured: " + mc.width + "x" + mc.height);
                        var mCtx = mc.getContext("2d", { willReadFrequently: true });
                        var _fillTextFallbacks = 0;
                        layer.forEach(function(pe) {
                          if (!pe.bbox) return;
                          var bx = Math.max(0, Math.round(pe.bbox.left * _sc));
                          var by = Math.max(0, Math.round(pe.bbox.top * _sc));
                          var bw = Math.min(Math.round(pe.bbox.width * _sc), mc.width - bx);
                          var bh = Math.min(Math.round(pe.bbox.height * _sc), mc.height - by);
                          if (bw < 2 || bh < 2) return;
                          try {
                            var px = mCtx.getImageData(bx, by, bw, bh).data;
                            var bmp = new Uint8Array(bw * bh);
                            for (var y = 0; y < bh; y++) { for (var x = 0; x < bw; x++) {
                              var i = (y * bw + x) * 4;
                              if ((px[i] + px[i + 1] + px[i + 2]) / 3 < 240) bmp[y * bw + x] = 1;
                            } }
                            var _dk = 0; for (var _b = 0; _b < bmp.length; _b++) if (bmp[_b]) _dk++;
                            // Fallback: if domToCanvas failed to render text, use canvas.fillText
                            if (_dk === 0 && bw > 3 && pe.pair.text) {
                              try {
                                var cs = getComputedStyle(pe.el);
                                var _fc = document.createElement("canvas"); _fc.width = bw; _fc.height = bh;
                                var _fx = _fc.getContext("2d"); _fx.fillStyle = "#fff"; _fx.fillRect(0, 0, bw, bh);
                                var _fs = parseFloat(cs.fontSize) * _sc;
                                _fx.fillStyle = "#000";
                                _fx.font = cs.fontStyle + " " + cs.fontWeight + " " + _fs + "px " + cs.fontFamily;
                                _fx.textBaseline = "top";
                                var _pl = (parseFloat(cs.paddingLeft) || 0) * _sc;
                                var _pt = (parseFloat(cs.paddingTop) || 0) * _sc;
                                var _pr = (parseFloat(cs.paddingRight) || 0) * _sc;
                                var _ta = cs.textAlign;
                                var _txt = pe.pair.text.replace(/\[placeholder\] /, "");
                                var _lh = parseFloat(cs.lineHeight) * _sc || _fs * 1.2;
                                var _contentW = bw - _pl - _pr;
                                var _words = _txt.split(/\s+/); var _lines = []; var _line = "";
                                for (var _w = 0; _w < _words.length; _w++) {
                                  var _test = _line ? _line + " " + _words[_w] : _words[_w];
                                  if (_fx.measureText(_test).width > _contentW && _line) { _lines.push(_line); _line = _words[_w]; }
                                  else { _line = _test; }
                                } _lines.push(_line);
                                var _totalH = _lines.length * _lh;
                                var _tyStart = _pt;
                                var _par = pe.el.parentElement; var _pcs = _par ? getComputedStyle(_par) : null;
                                if (_pcs) {
                                  if (_pcs.display.indexOf("flex") >= 0 && _pcs.alignItems === "center") { _tyStart = Math.max(0, (bh - _totalH) / 2); }
                                  else if (bh > _totalH + _pt * 2) { _tyStart = _pt; }
                                }
                                for (var _li2 = 0; _li2 < _lines.length; _li2++) {
                                  var _lw = _fx.measureText(_lines[_li2]).width;
                                  var _tx = _pl;
                                  if (_ta === "center") _tx = (_contentW - _lw) / 2 + _pl;
                                  else if (_ta === "right" || _ta === "end") _tx = _contentW - _lw + _pl;
                                  _fx.fillText(_lines[_li2], _tx, _tyStart + _li2 * _lh);
                                }
                                var _fpx = _fx.getImageData(0, 0, bw, bh).data;
                                bmp = new Uint8Array(bw * bh);
                                for (var _fy = 0; _fy < bh; _fy++) { for (var _fxx = 0; _fxx < bw; _fxx++) {
                                  var _fi = (_fy * bw + _fxx) * 4; if ((_fpx[_fi] + _fpx[_fi + 1] + _fpx[_fi + 2]) / 3 < 240) bmp[_fy * bw + _fxx] = 1;
                                } }
                                _dk = 0; for (var _fb = 0; _fb < bmp.length; _fb++) if (bmp[_fb]) _dk++;
                                _fillTextFallbacks++;
                              } catch (e) {}
                            }
                            // Bit-pack bitmap: 8 pixels per byte, then base64 encode (~8x smaller for postMessage)
                            var _byteLen = Math.ceil(bmp.length / 8); var _packed = new Uint8Array(_byteLen);
                            for (var _bi = 0; _bi < bmp.length; _bi++) { if (bmp[_bi]) _packed[_bi >> 3] |= (1 << (_bi & 7)); }
                            var _binStr = ""; for (var _bi2 = 0; _bi2 < _packed.length; _bi2++) _binStr += String.fromCharCode(_packed[_bi2]);
                            var _b64 = btoa(_binStr);
                            pe.pair._maskBmp = _b64; pe.pair._maskPacked = true; pe.pair._maskW = bw; pe.pair._maskH = bh; pe.pair._maskLayer = _li; pe.pair._maskDark = _dk;
                            _maskResults[pe.idx] = { bmp: _b64, packed: true, w: bw, h: bh, layer: _li, dark: _dk };
                          } catch (e) {}
                        });
                        if (_fillTextFallbacks > 0) console.log("[iframe-ss] Layer " + _li + ": " + _fillTextFallbacks + " elements used fillText fallback mask");
                        // Reset layer elements to transparent (mask global style takes over)
                        layer.forEach(function(pe) {
                          pe.el.style.removeProperty("color");
                          pe.el.style.removeProperty("-webkit-text-fill-color");
                          pe.el.querySelectorAll("*").forEach(function(ch) {
                            ch.style.removeProperty("color");
                            ch.style.removeProperty("-webkit-text-fill-color");
                          });
                        });
                        setTimeout(_nextLayer, 0);
                      }).catch(function(e) { if (_layerDone) return; _layerDone = true; clearTimeout(_layerTimer); console.warn("[iframe-ss] Layer " + _li + " failed:", e); setTimeout(_nextLayer, 0); });
                    }
                    var _maskDone = false;
                    var _origSendFinal = _sendFinal;
                    var _maskTimer = setTimeout(function() { if (!_maskDone) { _maskDone = true; console.warn("[iframe-ss] Masks timed out (360s)"); _origSendFinal(); } }, 360000);
                    _sendFinal = function() { if (_maskDone) return; _maskDone = true; clearTimeout(_maskTimer); console.log("[iframe-ss] Sending results (maskResults: " + Object.keys(_maskResults).length + " pairs)"); _origSendFinal(); };
                    _nextLayer();
                  }); // end document.fonts.ready.then
                }).catch(function(e) {
                  // Expanded capture failed but the clean screenshot succeeded — ship that
                  // instead of returning nothing.
                  console.warn("[iframe-ss] expanded capture failed:", e, "— falling back to clean screenshot");
                  _sendFn({
                    type: _msgType, _iframeId: _mid,
                    screenshots: _cleanUri ? [_cleanUri] : [],
                    screenshotFull: _cleanUri || null,
                    screenshotClean: _cleanUri || null,
                    textMask: null,
                    screenshotMeta: { scale: _sc, viewportHeight: vh, sectionCount: 1, canvasWidth: _cleanW, canvasHeight: _cleanH, docHeightAtCapture: fullH, calibrationOffsetY: 0, calibrationSamples: [] },
                    screenshotCleanMeta: { canvasWidth: _cleanW, canvasHeight: _cleanH },
                    regionScreenshots: window.__milgRegionScreenshots || [],
                    updatedData: null
                  }, true);
                });
              }); // close _buildRegionScreenshots callback
            }).catch(function(e) {
              if (typeof _hb !== "undefined") clearInterval(_hb);
              console.warn("[iframe-ss] clean capture failed:", e);
              _sendSynthetic("The DOM rasterizer failed on this page (usually the site's Content-Security-Policy — see the 'Refused to connect/load' errors above).");
            });
          }); // close _preloadFn callback
        };
        s.onerror = function() { _amdRestore(); console.warn("[iframe-ss] failed to load screenshot library (" + _cdn + ") — skipping screenshots"); _sendFn({ type: _msgType, screenshots: [], _iframeId: _mid }, true); };
        // If the library is already present (snippet "Embed screenshot library" prepends
        // it into the page realm), skip the CDN <script> entirely — it would be blocked by
        // a strict CSP and never fire onload. Otherwise load it from the CDN as before.
        if (window.modernScreenshot && window.modernScreenshot.domToCanvas) {
          s.onload();
        } else {
          document.head.appendChild(s);
        }
        }); // close _probeDataUrl
      });
    };
  }

  return {
    // Serializable hook sources for iframe/URL mode — pass their .toString() into
    // getCaptureFn()'s opts.preHookSrc / opts.preloadSrc.
    getIframePreHook: function() { return _iframePreHook; },
    getIframePreloadFn: function() { return _iframePreloadFn; },
    // The serializable capture+mask core — use: MilgCapture.getCaptureFn().toString()
    getCaptureFn: function() { return _captureFn; }
  };
})();
