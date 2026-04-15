// make-it-look-good — Region Screenshot Module
// Shared logic for detecting overflow:hidden containers with hidden content,
// creating mini-page iframes, force-revealing content, and capturing screenshots.
// Used by analyzer-iframe.js (URL analysis) and the console snippet (assembled at runtime).
//
// Exposes window.MilgRegion

window.MilgRegion = (function() {
  "use strict";

  // --- Force-reveal CSS ---
  // Injected into mini-page <style> to override CSS class rules that hide carousel slides.
  // High specificity needed because original stylesheets are included in the mini-page.
  var FORCE_REVEAL_CSS =
    '*,*::before,*::after{transition:none !important;animation:none !important;}' +
    'body *{visibility:visible !important;opacity:1 !important;' +
    'transform:none !important;overflow:visible !important;' +
    'clip-path:none !important;max-height:none !important;}' +
    '[aria-hidden="true"],[hidden],.hidden,.d-none,.hide,' +
    '.carousel-item,.swiper-slide,.slick-slide,' +
    '[class*="slide"],[class*="panel"],[class*="tab-pane"]{' +
    'display:block !important;visibility:visible !important;' +
    'opacity:1 !important;position:relative !important;' +
    'transform:none !important;left:auto !important;right:auto !important;}';

  // --- Force-reveal script ---
  // Runs inside the mini-page on DOMContentLoaded. Catches computed display:none
  // from CSS classes that the static CSS above can't target generically.
  var FORCE_REVEAL_SCRIPT =
    'document.addEventListener("DOMContentLoaded",function(){' +
    'document.querySelectorAll("*").forEach(function(el){' +
    'var cs=getComputedStyle(el);' +
    'if(cs.display==="none")el.style.setProperty("display","block","important");' +
    'if(cs.visibility==="hidden")el.style.setProperty("visibility","visible","important");' +
    'if(parseFloat(cs.opacity)<0.1)el.style.setProperty("opacity","1","important");' +
    'if(cs.position==="absolute"||cs.position==="fixed")el.style.setProperty("position","relative","important");' +
    '});' +
    '});';

  // --- DOM cleanup ---
  // Runs from parent context after mini-page loads. Resets height constraints and
  // removes spacer elements that cause massive whitespace in the region screenshot.
  function cleanupMiniPageDom(mDoc) {
    try {
      var dv = mDoc.defaultView;
      // Force-reveal pass (redundant with script, but covers sandbox/CSP failures)
      mDoc.querySelectorAll('*').forEach(function(el) {
        var cs = dv.getComputedStyle(el);
        if (cs.display === 'none') el.style.setProperty('display', 'block', 'important');
        if (cs.visibility === 'hidden') el.style.setProperty('visibility', 'visible', 'important');
        if (parseFloat(cs.opacity) < 0.1) el.style.setProperty('opacity', '1', 'important');
        if (cs.position === 'absolute' || cs.position === 'fixed') el.style.setProperty('position', 'relative', 'important');
      });
      // Height cleanup on container + direct children only (deeper reset causes inflation).
      // Horizontal flex/grid layouts are preserved — canvas crop trims whitespace post-capture.
      var container = mDoc.body.firstElementChild;
      if (container) {
        container.style.setProperty('height', 'auto', 'important');
        container.style.setProperty('max-height', 'none', 'important');
        container.style.setProperty('min-height', '0', 'important');
        container.style.setProperty('overflow', 'visible', 'important');
        for (var ci = 0; ci < container.children.length; ci++) {
          var child = container.children[ci];
          child.style.setProperty('height', 'auto', 'important');
          child.style.setProperty('max-height', 'none', 'important');
          child.style.setProperty('min-height', '0', 'important');
          child.style.setProperty('position', 'relative', 'important');
        }
      }
    } catch (_e) {
      console.warn('[milg-region] DOM cleanup failed:', _e.message);
    }
  }

  // --- Build mini-page HTML ---
  // Assembles HTML for the mini-page iframe with force-reveal CSS/JS and optional extraction.
  function buildMiniPageHtml(cloneOuterHtml, baseHref, allLinks, allStyles, opts) {
    opts = opts || {};
    var scripts = '<script>' + FORCE_REVEAL_SCRIPT + '</' + 'script>';
    // Optional: inject extraction engine to run after force-reveal
    if (opts.extractFnSrc) {
      scripts += '<script>setTimeout(function(){try{(' + opts.extractFnSrc + ')()}catch(e){console.warn("[milg-region] Extraction failed:",e.message)}},100);</' + 'script>';
    }
    return '<!DOCTYPE html><html><head><meta charset=UTF-8>' +
      (baseHref ? '<base href="' + baseHref.replace(/"/g, '&quot;') + '">' : '') +
      allLinks + allStyles +
      '<style>' + FORCE_REVEAL_CSS + '</style>' +
      scripts +
      '</head><body style="margin:0;padding:0;overflow:visible">' + cloneOuterHtml + '</body></html>';
  }

  // --- Build region clone ---
  // Deep-clones the container element and applies inline style overrides.
  function buildRegionClone(container, containerRect) {
    var clone = container.cloneNode(true);
    clone.style.cssText += ';overflow:visible !important;max-height:none !important;height:auto !important;clip-path:none !important;width:' + Math.round(containerRect.width) + 'px !important;';
    return clone;
  }

  // --- Detect clipped pairs ---
  // Marks contrast pairs as _isClipped if their element bbox is outside an overflow:hidden ancestor.
  // Returns as a string for injection into iframe scripts.
  function getClipDetectionScript() {
    return 'if(window.__milgBboxRefs&&window.__milgData&&window.__milgData.colors){' +
      'var _cp=window.__milgData.colors.contrastPairs||[];' +
      'window.__milgBboxRefs.forEach(function(ref){' +
        'if(!ref.el||!ref.obj||ref.key!=="bbox")return;' +
        'var el=ref.el;var pair=ref.obj;' +
        'var er=el.getBoundingClientRect();' +
        'var anc=el.parentElement;' +
        'while(anc&&anc!==document.documentElement){' +
          'var as=getComputedStyle(anc);' +
          'var aov=as.overflow||"";var aovx=as.overflowX||"";var aovy=as.overflowY||"";' +
          'if(aov==="hidden"||aov==="clip"||aovx==="hidden"||aovx==="clip"||aovy==="hidden"||aovy==="clip"){' +
            'var ar=anc.getBoundingClientRect();' +
            'if(er.right<ar.left+1||er.left>ar.right-1||er.bottom<ar.top+1||er.top>ar.bottom-1){' +
              'pair._isClipped=true;break' +
            '}' +
          '}' +
          'anc=anc.parentElement' +
        '}' +
      '})' +
    '}';
  }

  // --- Serializable region screenshot function ---
  // This function is serialized via .toString() and injected into the analysis iframe.
  // It MUST be self-contained — no references to outer scope variables.
  // Parameters are bound at serialization time by the caller.
  function _regionScreenshotFn(_sc, _quality, _prog, _cp2) {
    return function _buildRegionScreenshots(rgnCb) {
      // Detect clipping containers from tracked bbox refs
      var _rgnCounter = 0, _clipContainerList = [], _clipContainers = {};
      if (window.__milgBboxRefs) {
        window.__milgBboxRefs.forEach(function(ref) {
          if (!ref.el || !ref.obj || ref.key !== 'bbox' || !ref.obj._isClipped) return;
          var clipAnc = null, anc = ref.el.parentElement;
          while (anc && anc !== document.documentElement) {
            var as = getComputedStyle(anc);
            var aov = as.overflow || '', aovx = as.overflowX || '', aovy = as.overflowY || '';
            if (aov === 'hidden' || aov === 'clip' || aovx === 'hidden' || aovx === 'clip' || aovy === 'hidden' || aovy === 'clip') {
              var ar = anc.getBoundingClientRect();
              if (ar.width >= 100 && ar.height >= 30) clipAnc = anc;
            }
            anc = anc.parentElement;
          }
          if (!clipAnc) return;
          var cid = clipAnc._milgRegionId;
          if (!cid) {
            cid = 'rgn-' + (++_rgnCounter); clipAnc._milgRegionId = cid;
            _clipContainerList.push({ el: clipAnc, id: cid, pairIndices: [] });
            _clipContainers[cid] = _clipContainerList[_clipContainerList.length - 1];
          }
          var pi = _cp2.indexOf(ref.obj);
          if (pi >= 0 && _clipContainers[cid].pairIndices.indexOf(pi) < 0)
            _clipContainers[cid].pairIndices.push(pi);
        });
      }
      _clipContainerList.sort(function(a, b) {
        var ar = a.el.getBoundingClientRect(), br = b.el.getBoundingClientRect();
        return (br.width * br.height) - (ar.width * ar.height);
      });
      _clipContainerList = _clipContainerList.slice(0, 5);
      console.log('[milg-region] Found ' + _clipContainerList.length + ' clipping regions');
      if (_clipContainerList.length === 0) { rgnCb([]); return; }

      var _rgnResults = [], _rgnDone = 0, _rgnTotal = _clipContainerList.length;
      var _rgnOverall = setTimeout(function() {
        console.warn('[milg-region] Overall timeout (30s)');
        rgnCb(_rgnResults);
      }, 30000);

      // Collect styles for mini-pages
      var allStyles = ''; document.querySelectorAll('style').forEach(function(s) { allStyles += s.outerHTML; });
      var allLinks = ''; document.querySelectorAll('link[rel=stylesheet]').forEach(function(l) { allLinks += l.outerHTML; });
      var baseHref = (document.querySelector('base') || {}).href || '';

      // Force-reveal CSS (inlined — can't reference MilgRegion from inside serialized fn)
      var _revealCss =
        '*,*::before,*::after{transition:none !important;animation:none !important;}' +
        'body *{visibility:visible !important;opacity:1 !important;transform:none !important;overflow:visible !important;clip-path:none !important;max-height:none !important;}' +
        '[aria-hidden="true"],[hidden],.hidden,.d-none,.hide,.carousel-item,.swiper-slide,.slick-slide,' +
        '[class*="slide"],[class*="panel"],[class*="tab-pane"]{display:block !important;visibility:visible !important;opacity:1 !important;position:relative !important;transform:none !important;left:auto !important;right:auto !important;}';

      var _revealScript =
        '<script>document.addEventListener("DOMContentLoaded",function(){' +
        'document.querySelectorAll("*").forEach(function(el){var cs=getComputedStyle(el);' +
        'if(cs.display==="none")el.style.setProperty("display","block","important");' +
        'if(cs.visibility==="hidden")el.style.setProperty("visibility","visible","important");' +
        'if(parseFloat(cs.opacity)<0.1)el.style.setProperty("opacity","1","important");' +
        'if(cs.position==="absolute"||cs.position==="fixed")el.style.setProperty("position","relative","important");' +
        '});});</' + 'script>';

      // Optional extraction: inject MilgExtract if available
      var _extractScript = '';
      if (typeof window.MilgExtract === 'function') {
        _extractScript = '<script>setTimeout(function(){try{(' + window.MilgExtract.toString() + ')()}catch(e){console.warn("[milg-region] Extraction failed:",e)}},100);</' + 'script>';
      }

      _prog('Capturing ' + _rgnTotal + ' region screenshots...');

      _clipContainerList.forEach(function(rgn, rIdx) {
        var container = rgn.el, cr = container.getBoundingClientRect();
        var clone = container.cloneNode(true);
        clone.style.cssText += ';overflow:visible !important;max-height:none !important;height:auto !important;clip-path:none !important;width:' + Math.round(cr.width) + 'px !important;';

        var miniHtml = '<!DOCTYPE html><html><head><meta charset=UTF-8>' +
          (baseHref ? '<base href="' + baseHref.replace(/"/g, '&quot;') + '">' : '') +
          allLinks + allStyles +
          '<style>' + _revealCss + '</style>' + _revealScript + _extractScript +
          '</head><body style="margin:0;padding:0;overflow:visible">' + clone.outerHTML + '</body></html>';

        var iframeW = Math.max(Math.round(cr.width), 320);
        var mf = document.createElement('iframe');
        mf.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + iframeW + 'px;height:3000px;border:none;visibility:hidden;';
        mf.setAttribute('sandbox', 'allow-same-origin allow-scripts');
        document.body.appendChild(mf);

        var rgnTimer = setTimeout(function() {
          console.warn('[milg-region] Region ' + rIdx + ' timed out');
          _rgnFinish(rIdx, mf, null);
        }, 15000);

        mf.srcdoc = miniHtml;
        mf.addEventListener('load', function() {
          setTimeout(function() {
            try {
              var mDoc = mf.contentDocument;
              if (!mDoc) { _rgnFinish(rIdx, mf, null); return; }

              // DOM cleanup: force-reveal + targeted height reset on container/children only
              try {
                var dv = mDoc.defaultView;
                mDoc.querySelectorAll('*').forEach(function(el) {
                  var cs = dv.getComputedStyle(el);
                  if (cs.display === 'none') el.style.setProperty('display', 'block', 'important');
                  if (cs.visibility === 'hidden') el.style.setProperty('visibility', 'visible', 'important');
                  if (parseFloat(cs.opacity) < 0.1) el.style.setProperty('opacity', '1', 'important');
                  if (cs.position === 'absolute' || cs.position === 'fixed') el.style.setProperty('position', 'relative', 'important');
                });
                var _cont = mDoc.body.firstElementChild;
                if (_cont) {
                  _cont.style.setProperty('height', 'auto', 'important');
                  _cont.style.setProperty('max-height', 'none', 'important');
                  _cont.style.setProperty('overflow', 'visible', 'important');
                  for (var _ci = 0; _ci < _cont.children.length; _ci++) {
                    var _ch = _cont.children[_ci];
                    _ch.style.setProperty('height', 'auto', 'important');
                    _ch.style.setProperty('max-height', 'none', 'important');
                    _ch.style.setProperty('position', 'relative', 'important');
                  }
                }
              } catch (_e) {}

              void mDoc.body.offsetHeight; // reflow

              // Harvest extraction data if available
              var extractedData = null;
              try { extractedData = mf.contentWindow.__milgData || null; } catch (_e) {}

              // Size iframe to full document first so getBoundingClientRect gives correct coords
              var cW = Math.max(mDoc.body.scrollWidth, mDoc.documentElement.scrollWidth);
              var cH = Math.max(mDoc.body.scrollHeight, mDoc.documentElement.scrollHeight);
              mf.style.width = Math.max(cW, iframeW) + 'px'; mf.style.height = cH + 'px';
              void mDoc.body.offsetHeight;

              // Compute content bounds from text nodes + replaced elements.
              // Spacer divs from the absolute→relative conversion have no visual content
              // and are excluded, so the bounds cover only actual carousel slides.
              var _cTop = 1e9, _cBot = 0, _cLeft = 1e9, _cRight = 0;
              var _cropOX = 0, _cropOY = 0;
              try {
                mDoc.body.querySelectorAll('*').forEach(function(el) {
                  var r = el.getBoundingClientRect();
                  if (r.height <= 0 || r.width <= 0) return;
                  if (el.tagName === 'IMG' || el.tagName === 'SVG' || el.tagName === 'VIDEO' || el.tagName === 'CANVAS') {
                    // replaced element — always counts
                  } else {
                    var ht = false;
                    for (var _n = el.firstChild; _n; _n = _n.nextSibling) {
                      if (_n.nodeType === 3 && _n.textContent.trim()) { ht = true; break; }
                    }
                    if (!ht) return;
                  }
                  if (r.top < _cTop) _cTop = r.top;
                  if (r.bottom > _cBot) _cBot = r.bottom;
                  if (r.left < _cLeft) _cLeft = r.left;
                  if (r.right > _cRight) _cRight = r.right;
                });
              } catch (_e2) {}
              var _cPad = 20;
              var _doCrop = _cTop < 1e9 && _cBot > _cTop + 10 && (_cBot - _cTop + _cPad * 2) < cH * 0.8;
              if (_doCrop) {
                console.log('[milg-region] Content bounds: ' + Math.round(_cLeft) + ',' + Math.round(_cTop) + ' → ' + Math.round(_cRight) + ',' + Math.round(_cBot) + ' (doc: ' + cW + 'x' + cH + ')');
                _cropOX = Math.round(Math.max(0, _cLeft - _cPad) * _sc);
                _cropOY = Math.round(Math.max(0, _cTop - _cPad) * _sc);
              }

              var pms = window.modernScreenshot;
              if (!pms || !pms.domToCanvas) { _rgnFinish(rIdx, mf, null); return; }
              pms.domToCanvas(mDoc.documentElement, { scale: _sc, timeout: 12000 }).then(function(rc) {
                // Crop canvas to DOM-computed content bounds (avoids pixel scanning)
                var finalCanvas = rc;
                if (_doCrop) {
                  try {
                    var _cx = Math.round(Math.max(0, _cLeft - _cPad) * _sc);
                    var _cy = Math.round(Math.max(0, _cTop - _cPad) * _sc);
                    var _cw = Math.min(Math.round((_cRight - _cLeft + _cPad * 2) * _sc), rc.width - _cx);
                    var _ch3 = Math.min(Math.round((_cBot - _cTop + _cPad * 2) * _sc), rc.height - _cy);
                    if (_cw > 10 && _ch3 > 10) {
                      finalCanvas = document.createElement('canvas');
                      finalCanvas.width = _cw; finalCanvas.height = _ch3;
                      finalCanvas.getContext('2d').drawImage(rc, _cx, _cy, _cw, _ch3, 0, 0, _cw, _ch3);
                      console.log('[milg-region] Cropped ' + rc.width + 'x' + rc.height + ' → ' + _cw + 'x' + _ch3);
                    }
                  } catch (_ce) { console.warn('[milg-region] Crop failed:', _ce.message); finalCanvas = rc; }
                }
                var rUri; try { rUri = finalCanvas.toDataURL('image/webp', _quality); } catch (e) { rUri = ''; }
                clearTimeout(rgnTimer);
                _rgnFinish(rIdx, mf, {
                  screenshot: rUri,
                  screenshotMeta: { scale: _sc, canvasWidth: finalCanvas.width, canvasHeight: finalCanvas.height, cropOffsetX: _cropOX, cropOffsetY: _cropOY },
                  pairIndices: rgn.pairIndices,
                  containerRect: { left: Math.round(cr.left), top: Math.round(cr.top), width: Math.round(cr.width), height: Math.round(cr.height) },
                  extractedData: extractedData
                });
              }).catch(function(e) { clearTimeout(rgnTimer); _rgnFinish(rIdx, mf, null); });
            } catch (e) { clearTimeout(rgnTimer); _rgnFinish(rIdx, mf, null); }
          }, 800); // 800ms: allow DOMContentLoaded + extraction to complete
        });
      });

      function _rgnFinish(idx, mf, result) {
        if (result) _rgnResults.push(result);
        try { if (mf && mf.parentNode) mf.parentNode.removeChild(mf); } catch (e) {}
        _rgnDone++;
        if (_rgnDone >= _rgnTotal) {
          clearTimeout(_rgnOverall);
          console.log('[milg-region] Region screenshots done: ' + _rgnResults.length + '/' + _rgnTotal);
          rgnCb(_rgnResults);
        }
      }
    };
  }

  return {
    FORCE_REVEAL_CSS: FORCE_REVEAL_CSS,
    FORCE_REVEAL_SCRIPT: FORCE_REVEAL_SCRIPT,
    cleanupMiniPageDom: cleanupMiniPageDom,
    buildMiniPageHtml: buildMiniPageHtml,
    buildRegionClone: buildRegionClone,
    getClipDetectionScript: getClipDetectionScript,
    // The serializable function — use: MilgRegion.getRegionFn().toString()
    getRegionFn: function() { return _regionScreenshotFn; }
  };
})();
