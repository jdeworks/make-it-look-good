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
  // Tag names to skip during force-reveal (non-rendered head/meta elements that must not be made visible)
  var _REVEAL_SKIP = {HEAD:1,STYLE:1,SCRIPT:1,LINK:1,META:1,BASE:1,TITLE:1,NOSCRIPT:1,TEMPLATE:1};
  var FORCE_REVEAL_SCRIPT =
    'document.addEventListener("DOMContentLoaded",function(){' +
    'var _skip={HEAD:1,STYLE:1,SCRIPT:1,LINK:1,META:1,BASE:1,TITLE:1,NOSCRIPT:1,TEMPLATE:1};' +
    'document.body.querySelectorAll("*").forEach(function(el){' +
    'if(_skip[el.tagName])return;' +
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
      // Force-reveal pass (redundant with script, but covers sandbox/CSP failures).
      // Scoped to body content only — head elements (style/script/link/meta) must NOT be made visible.
      mDoc.body.querySelectorAll('*').forEach(function(el) {
        if (_REVEAL_SKIP[el.tagName]) return;
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
      // Pass 1: Mark _isClipped pairs (element completely outside overflow:hidden ancestor)
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
      '});' +
      // Pass 2: Identify containers with clipped content and tag ALL their descendant pairs
      'var _rcc=0;' +
      'window.__milgBboxRefs.forEach(function(ref){' +
        'if(!ref.el||!ref.obj||ref.key!=="bbox"||!ref.obj._isClipped)return;' +
        'var anc=ref.el.parentElement;' +
        'while(anc&&anc!==document.documentElement){' +
          'var as=getComputedStyle(anc);' +
          'var aov=as.overflow||"";var aovx=as.overflowX||"";var aovy=as.overflowY||"";' +
          'if(aov==="hidden"||aov==="clip"||aovx==="hidden"||aovx==="clip"||aovy==="hidden"||aovy==="clip"){' +
            'var ar=anc.getBoundingClientRect();' +
            'if(ar.width>=100&&ar.height>=30&&!anc._mrc){anc._mrc="rgn-"+(++_rcc)}' +
            'break' +
          '}' +
          'anc=anc.parentElement' +
        '}' +
      '});' +
      'window.__milgBboxRefs.forEach(function(ref){' +
        'if(!ref.el||!ref.obj||ref.key!=="bbox")return;' +
        'var anc=ref.el;' +
        'while(anc){' +
          'if(anc._mrc){ref.obj._regionContainerId=anc._mrc;break}' +
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
      // --- Marking pre-pass (shared by both URL/iframe mode and snippet mode) ---
      // The clip-container detection below consumes pair._isClipped, and the viewer
      // consumes container._mrc / pair._regionContainerId / bbox._rcid to exclude
      // region content from the main overlay. Set all of those here so callers don't
      // have to duplicate it. Operates on window.__milgBboxRefs + the live DOM.
      if (window.__milgBboxRefs) {
        // Pass 1: Mark _isClipped pairs (element bbox completely outside an overflow:hidden ancestor)
        window.__milgBboxRefs.forEach(function(ref) {
          if (!ref.el || !ref.obj || ref.key !== 'bbox') return;
          var el = ref.el, pair = ref.obj;
          var er = el.getBoundingClientRect();
          var anc = el.parentElement;
          while (anc && anc !== document.documentElement) {
            var as = getComputedStyle(anc);
            var aov = as.overflow || '', aovx = as.overflowX || '', aovy = as.overflowY || '';
            if (aov === 'hidden' || aov === 'clip' || aovx === 'hidden' || aovx === 'clip' || aovy === 'hidden' || aovy === 'clip') {
              var ar = anc.getBoundingClientRect();
              if (er.right < ar.left + 1 || er.left > ar.right - 1 || er.bottom < ar.top + 1 || er.top > ar.bottom - 1) { pair._isClipped = true; break; }
            }
            anc = anc.parentElement;
          }
        });
        // Pass 2: Identify clipping containers that have at least one _isClipped pair
        var _rcc = 0;
        window.__milgBboxRefs.forEach(function(ref) {
          if (!ref.el || !ref.obj || ref.key !== 'bbox' || !ref.obj._isClipped) return;
          var anc = ref.el.parentElement;
          while (anc && anc !== document.documentElement) {
            var as = getComputedStyle(anc);
            var aov = as.overflow || '', aovx = as.overflowX || '', aovy = as.overflowY || '';
            if (aov === 'hidden' || aov === 'clip' || aovx === 'hidden' || aovx === 'clip' || aovy === 'hidden' || aovy === 'clip') {
              var ar = anc.getBoundingClientRect();
              if (ar.width >= 100 && ar.height >= 30 && !anc._mrc) { anc._mrc = 'rgn-' + (++_rcc); }
              break;
            }
            anc = anc.parentElement;
          }
        });
        // Pass 3: Tag ALL pairs whose element descends from an identified clip container
        // Also tag descendant pairs of hidden-panel containers (kind != 'clipped')
        window.__milgBboxRefs.forEach(function(ref) {
          if (!ref.el || !ref.obj || ref.key !== 'bbox') return;
          var anc = ref.el;
          while (anc) {
            if (anc._mrc) { ref.obj._regionContainerId = anc._mrc; if (ref.obj[ref.key]) ref.obj[ref.key]._rcid = anc._mrc; break; }
            anc = anc.parentElement;
          }
        });
        // Pass 4: Tag descendant pairs of hidden-panel containers
        if (window.__milgHiddenPanels) {
          window.__milgHiddenPanels.forEach(function(hp) {
            if (!hp || !hp.el) return;
            var hpId = hp.el._mrc;
            if (!hpId) { hpId = 'hp-' + (++_rcc); hp.el._mrc = hpId; }
            window.__milgBboxRefs.forEach(function(ref) {
              if (!ref.el || !ref.obj || ref.key !== 'bbox') return;
              if (ref.obj._regionContainerId) return; // already tagged
              var anc = ref.el;
              while (anc) {
                if (anc === hp.el) { ref.obj._regionContainerId = hpId; if (ref.obj[ref.key]) ref.obj[ref.key]._rcid = hpId; break; }
                anc = anc.parentElement;
              }
            });
          });
        }
        console.log('[milg-region] mark: tagged ' + _rcc + ' clip containers, clipped=' + window.__milgBboxRefs.filter(function(r) { return r.obj && r.obj._isClipped; }).length + '/' + window.__milgBboxRefs.length);
      }

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
            _clipContainerList.push({ el: clipAnc, id: cid, pairIndices: [], kind: 'clipped', label: '' });
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
      // Cap clips at 5 (same as before), then append hidden panels up to total cap of 8
      _clipContainerList = _clipContainerList.slice(0, 5);
      console.log('[milg-region] Found ' + _clipContainerList.length + ' clipping regions');

      // Append hidden-panel entries from window.__milgHiddenPanels
      var _panelList = [];
      if (window.__milgHiddenPanels) {
        window.__milgHiddenPanels.forEach(function(hp) {
          if (!hp || !hp.el) return;
          var hpEl = hp.el;
          // Skip trivial content
          if ((hpEl.textContent || '').trim().length < 20) return;
          // Dedupe: skip if the element (or ancestor/descendant) is already in the clip list
          var dup = false;
          for (var _di = 0; _di < _clipContainerList.length; _di++) {
            var existing = _clipContainerList[_di].el;
            if (existing === hpEl) { dup = true; break; }
            try { if (existing.contains(hpEl) || hpEl.contains(existing)) { dup = true; break; } } catch (_de) {}
          }
          if (dup) return;
          // Also dedupe within panel list
          for (var _pi = 0; _pi < _panelList.length; _pi++) {
            var pe = _panelList[_pi].el;
            if (pe === hpEl) { dup = true; break; }
            try { if (pe.contains(hpEl) || hpEl.contains(pe)) { dup = true; break; } } catch (_pe2) {}
          }
          if (dup) return;
          _panelList.push({ el: hpEl, id: 'hp-' + (_rgnCounter + _panelList.length + 1), pairIndices: [], kind: hp.kind || 'collapsed', label: hp.label || '', triggerEl: hp.triggerEl || null, _domOrder: _panelList.length });
        });
        // Sort panels by textContent length desc (richer panels first)
        _panelList.sort(function(a, b) {
          return (b.el.textContent || '').trim().length - (a.el.textContent || '').trim().length;
        });
      }
      var _slotsLeft = 8 - _clipContainerList.length;
      if (_panelList.length > _slotsLeft) {
        console.log('[milg-region] Dropping ' + (_panelList.length - _slotsLeft) + ' hidden panels (cap 8 total)');
        _panelList = _panelList.slice(0, _slotsLeft);
      }
      _panelList.sort(function(a, b) {
        if (!a.el || !b.el || a.el === b.el) return 0;
        var pos = a.el.compareDocumentPosition(b.el);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });
      _panelList.forEach(function(p, i) { p._domOrder = i; });
      console.log('[milg-region] Adding ' + _panelList.length + ' hidden-panel regions');
      var _allRegions = _clipContainerList.concat(_panelList);
      if (_allRegions.length === 0) { rgnCb([]); return; }

      var _rgnResults = [], _rgnDone = 0, _rgnTotal = _allRegions.length;
      var _rgnOverall = setTimeout(function() {
        console.warn('[milg-region] Overall timeout (90s)');
        rgnCb(_rgnResults);
      }, 90000);

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
        'var _sk={HEAD:1,STYLE:1,SCRIPT:1,LINK:1,META:1,BASE:1,TITLE:1,NOSCRIPT:1,TEMPLATE:1};' +
        'document.body.querySelectorAll("*").forEach(function(el){if(_sk[el.tagName])return;var cs=getComputedStyle(el);' +
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

      _allRegions.forEach(function(rgn, rIdx) {
        var container = rgn.el;
        var _rgnKind = rgn.kind || 'clipped';

        // For hidden-panel kinds, compute containerRect from the panel or its trigger
        // (the panel may have no box when collapsed, so fall back to trigger or parent)
        var cr;
        if (_rgnKind !== 'clipped') {
          var _tryRect = function(el) {
            try { var r = el.getBoundingClientRect(); return (r.width >= 40 && r.height >= 20) ? r : null; } catch (_) { return null; }
          };
          cr = _tryRect(container);
          if (!cr && rgn.triggerEl) cr = _tryRect(rgn.triggerEl);
          // For details, try the summary child as a visible anchor
          if (!cr && _rgnKind === 'details') {
            var _sum = container.querySelector('summary');
            if (_sum) cr = _tryRect(_sum);
          }
          if (!cr && container.parentElement) cr = _tryRect(container.parentElement);
          if (!cr) { cr = { left: 0, top: 0, width: 320, height: 40 }; rgn._noAnchor = true; } // no visible anchor on the main page
        } else {
          cr = container.getBoundingClientRect();
        }

        var clone = container.cloneNode(true);
        // Per-kind clone prep: force-reveal CSS handles class-based hiding, but
        // UA-internal states (details[open], hidden attribute) need explicit DOM mutation.
        if (_rgnKind === 'details') {
          clone.setAttribute('open', '');
        } else if (_rgnKind === 'hidden-attr') {
          clone.removeAttribute('hidden');
        }
        clone.style.cssText += ';overflow:visible !important;max-height:none !important;height:auto !important;clip-path:none !important;width:' + Math.round(cr.width || 320) + 'px !important;';

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
        }, 45000);

        mf.srcdoc = miniHtml;
        mf.addEventListener('load', function() {
          setTimeout(function() {
            try {
              var mDoc = mf.contentDocument;
              if (!mDoc) { _rgnFinish(rIdx, mf, null); return; }

              // DOM cleanup: force-reveal + targeted height reset on container/children only.
              // Scoped to body content only — head elements must NOT be made visible.
              try {
                var dv = mDoc.defaultView;
                var _rvSkip = {HEAD:1,STYLE:1,SCRIPT:1,LINK:1,META:1,BASE:1,TITLE:1,NOSCRIPT:1,TEMPLATE:1};
                mDoc.body.querySelectorAll('*').forEach(function(el) {
                  if (_rvSkip[el.tagName]) return;
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

              // WP-D: Invisible text recolor.
              // After force-reveal, any text-bearing element whose color nearly matches its
              // effective background (contrast < 1.3) gets recolored to black or white so
              // the region screenshot is legible.
              var _recoloredCount = 0;
              try {
                var _rcDv = mDoc.defaultView;
                function _rgbToLum(r, g, b) {
                  function _lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
                  return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b);
                }
                function _parseRgba(s) {
                  var m = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/.exec(s);
                  if (!m) return null;
                  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
                }
                function _effectiveBg(el) {
                  var cur = el.parentElement;
                  while (cur && cur !== mDoc.documentElement) {
                    var bg = _rcDv.getComputedStyle(cur).backgroundColor;
                    var c = _parseRgba(bg);
                    if (c && c.a > 0.05) return c;
                    cur = cur.parentElement;
                  }
                  return { r: 255, g: 255, b: 255, a: 1 }; // default white
                }
                mDoc.body.querySelectorAll('*').forEach(function(el) {
                  if (_rvSkip[el.tagName]) return;
                  // Only elements with direct text content
                  var hasText = false;
                  for (var _tn = el.firstChild; _tn; _tn = _tn.nextSibling) {
                    if (_tn.nodeType === 3 && _tn.textContent.trim()) { hasText = true; break; }
                  }
                  if (!hasText) return;
                  var cs = _rcDv.getComputedStyle(el);
                  var fgC = _parseRgba(cs.color);
                  if (!fgC) return;
                  var bgC = _effectiveBg(el);
                  var fgL = _rgbToLum(fgC.r, fgC.g, fgC.b);
                  var bgL = _rgbToLum(bgC.r, bgC.g, bgC.b);
                  var lHi = Math.max(fgL, bgL), lLo = Math.min(fgL, bgL);
                  var ratio = (lHi + 0.05) / (lLo + 0.05);
                  if (ratio < 1.3) {
                    var newColor = bgL > 0.5 ? '#000000' : '#ffffff';
                    el.style.setProperty('color', newColor, 'important');
                    el.style.setProperty('-webkit-text-fill-color', newColor, 'important');
                    _recoloredCount++;
                  }
                });
              } catch (_rcE) { console.warn('[milg-region] recolor pass failed:', _rcE.message); }
              if (_recoloredCount) console.log('[milg-region] Recolored ' + _recoloredCount + ' invisible-text elements');

              // Harvest extraction data if available
              var extractedData = null;
              try { extractedData = mf.contentWindow.__milgData || null; } catch (_e) {}

              // Bug 1 fix: mark contrast pairs whose elements were recolored so
              // isUncertain() in contrast.js does not exempt them from failure.
              if (_recoloredCount && extractedData && extractedData.colors) {
                var _rcPairs = extractedData.colors.contrastPairs || [];
                var _rcRefs = [];
                try { _rcRefs = mf.contentWindow.__milgBboxRefs || []; } catch (_e2) {}
                var _rcRecoloredEls = new Set();
                mDoc.body.querySelectorAll('*').forEach(function(el) {
                  if (el.style && el.style.getPropertyValue('color')) _rcRecoloredEls.add(el);
                });
                _rcRefs.forEach(function(ref) {
                  if (!ref.el || !ref.obj) return;
                  if (_rcRecoloredEls.has(ref.el)) ref.obj._wasRecolored = true;
                });
              }

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
              // Compute crop offset from DOM content bounds (same coordinates used to crop the canvas).
              // NOTE: extraction bboxes get mutated by __milgReReadBboxes during mask capture,
              // so the crop offset MUST use the DOM bounds that match the actual canvas crop.
              if (_doCrop) {
                console.log('[milg-region] Content bounds: ' + Math.round(_cLeft) + ',' + Math.round(_cTop) + ' → ' + Math.round(_cRight) + ',' + Math.round(_cBot) + ' (doc: ' + cW + 'x' + cH + ')');
                _cropOX = Math.round(Math.max(0, _cLeft - _cPad) * _sc);
                _cropOY = Math.round(Math.max(0, _cTop - _cPad) * _sc);
              }

              var pms = window.modernScreenshot;
              if (!pms || !pms.domToCanvas) { _rgnFinish(rIdx, mf, null); return; }
              pms.domToCanvas(mDoc.documentElement, { scale: _sc, timeout: 12000, filter: function(n) { return !(n && n.getAttribute && n.getAttribute('data-milg-overlay')); } }).then(function(rc) {
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
                var _mMaskResults = {}; // pair index → {bmp, packed, w, h, layer, dark}
                var _rgnResult = {
                  screenshot: rUri,
                  screenshotMeta: { scale: _sc, canvasWidth: finalCanvas.width, canvasHeight: finalCanvas.height, cropOffsetX: _cropOX, cropOffsetY: _cropOY, isRegion: true },
                  pairIndices: rgn.pairIndices,
                  containerRect: rgn._noAnchor ? null : { left: Math.round(cr.left), top: Math.round(cr.top), width: Math.round(cr.width), height: Math.round(cr.height) },
                  kind: _rgnKind,
                  noAnchor: !!rgn._noAnchor,
                  label: rgn.label || '',
                  recoloredCount: _recoloredCount,
                  extractedData: extractedData,
                  maskResults: _mMaskResults,
                  _domOrder: rgn._domOrder || 0
                };

                // --- Mask capture pipeline (same as main page Phase A-D) ---
                var _mRefs; try { _mRefs = mf.contentWindow.__milgBboxRefs || []; } catch (_e) { _mRefs = []; }
                var _mPairs = extractedData && extractedData.colors ? extractedData.colors.contrastPairs || [] : [];

                // Build pair-element list (contrast pairs with DOM elements)
                var _mPairEls = [];
                _mRefs.forEach(function(ref) {
                  if (!ref.el || !ref.obj || ref.obj.ratio === undefined) return;
                  var idx = _mPairs.indexOf(ref.obj);
                  if (idx >= 0) _mPairEls.push({ el: ref.el, pair: ref.obj, idx: idx });
                });
                console.log('[milg-region] Mask: ' + _mPairEls.length + '/' + _mRefs.length + ' pair elements');

                if (_mPairEls.length === 0) {
                  clearTimeout(rgnTimer);
                  _rgnFinish(rIdx, mf, _rgnResult);
                  return;
                }

                // Phase A: Kill ALL transitions before color changes
                var _mDv = mDoc.defaultView;
                mDoc.querySelectorAll('*').forEach(function(el) {
                  el.style.setProperty('transition-duration', '0s', 'important');
                  el.style.setProperty('transition', 'none', 'important');
                });
                void mDoc.body.offsetHeight;

                // Neutralize absolute/fixed overlays (same logic as main pipeline)
                var _mNeutralized = 0;
                mDoc.querySelectorAll('*').forEach(function(el) {
                  var cs = _mDv.getComputedStyle(el);
                  if (cs.position === 'absolute' || cs.position === 'fixed') {
                    if (!el.textContent.trim()) {
                      el.style.setProperty('display', 'none', 'important'); _mNeutralized++;
                    } else if (cs.pointerEvents === 'none') {
                      el.style.setProperty('background', 'transparent', 'important');
                      el.style.setProperty('background-image', 'none', 'important'); _mNeutralized++;
                    }
                  }
                });
                if (_mNeutralized) console.log('[milg-region] Neutralized ' + _mNeutralized + ' overlays');
                void mDoc.body.offsetHeight;

                // Re-read bboxes after neutralization (hiding overlays can shift layout)
                if (typeof mf.contentWindow.__milgReReadBboxes === 'function') {
                  try { mf.contentWindow.__milgReReadBboxes(); } catch (_e) {}
                }

                // Phase B: Global mask style — white bg, white text, hide media
                var _mMask = mDoc.createElement('style');
                _mMask.setAttribute('data-milg-mask', '1');
                _mMask.textContent = '*,*::before,*::after{color:#fff !important;background-color:transparent !important;background-image:none !important;background:transparent !important;border-color:transparent !important;box-shadow:none !important;text-shadow:none !important;outline-color:transparent !important;-webkit-text-fill-color:#fff !important;opacity:1 !important;transition:none !important;animation:none !important;}html{background:#fff !important;}img,svg,video,canvas,picture,iframe{opacity:0 !important;}';
                mDoc.head.appendChild(_mMask);
                void mDoc.body.offsetHeight;

                // Re-read bboxes after mask style (layout may shift)
                if (typeof mf.contentWindow.__milgReReadBboxes === 'function') {
                  try { mf.contentWindow.__milgReReadBboxes(); } catch (_e) {}
                }

                // Build overlap layers (use pair.bbox which __milgReReadBboxes keeps current)
                function _mOverlaps(a, b) {
                  var ab = a.pair.bbox, bb = b.pair.bbox;
                  if (!ab || !bb) return false;
                  return ab.left < bb.left + bb.width && ab.left + ab.width > bb.left &&
                    ab.top < bb.top + bb.height && ab.top + ab.height > bb.top;
                }
                var _mLayers = [], _mRemaining = _mPairEls.slice();
                while (_mRemaining.length > 0) {
                  var _mLayer = [], _mNext = [];
                  _mRemaining.forEach(function(pe) {
                    if (_mLayer.some(function(l) { return _mOverlaps(pe, l); })) _mNext.push(pe);
                    else _mLayer.push(pe);
                  });
                  _mLayers.push(_mLayer); _mRemaining = _mNext;
                }
                console.log('[milg-region] ' + _mPairEls.length + ' elements in ' + _mLayers.length + ' mask layers');

                // Bake text-transform into actual text (domToCanvas doesn't always preserve it)
                var _mTtFixed = 0;
                mDoc.querySelectorAll('*').forEach(function(el) {
                  var tt = _mDv.getComputedStyle(el).textTransform;
                  if (tt === 'uppercase' || tt === 'lowercase' || tt === 'capitalize') {
                    var walker = mDoc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
                    var tn; while (tn = walker.nextNode()) {
                      var orig = tn.textContent; if (!orig.trim()) continue;
                      if (tt === 'uppercase') tn.textContent = orig.toUpperCase();
                      else if (tt === 'lowercase') tn.textContent = orig.toLowerCase();
                      else if (tt === 'capitalize') tn.textContent = orig.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
                      _mTtFixed++;
                    }
                  }
                });
                if (_mTtFixed) console.log('[milg-region] Baked text-transform for ' + _mTtFixed + ' text nodes');

                // Phase D: Capture one mask per layer
                var _mLi = 0;
                function _mNextLayer() {
                  if (_mLi >= _mLayers.length) {
                    var _maskCount = Object.keys(_mMaskResults).length;
                    console.log('[milg-region] All ' + _mLayers.length + ' mask layers done, maskResults=' + _maskCount + '/' + _mPairs.length);
                    clearTimeout(rgnTimer);
                    _rgnFinish(rIdx, mf, _rgnResult);
                    return;
                  }
                  var layer = _mLayers[_mLi]; _mLi++;
                  _prog('Region ' + (rIdx + 1) + ': mask layer ' + _mLi + '/' + _mLayers.length + '...');

                  // Set layer elements to black via inline style
                  layer.forEach(function(pe) {
                    pe.el.style.setProperty('color', '#000', 'important');
                    pe.el.style.setProperty('-webkit-text-fill-color', '#000', 'important');
                    pe.el.querySelectorAll('*').forEach(function(ch) {
                      ch.style.setProperty('color', '#000', 'important');
                      ch.style.setProperty('-webkit-text-fill-color', '#000', 'important');
                    });
                  });
                  void mDoc.body.offsetHeight;

                  var _mLayerDone = false;
                  var _mLayerTimer = setTimeout(function() {
                    if (!_mLayerDone) { _mLayerDone = true; console.warn('[milg-region] Mask layer ' + _mLi + ' timed out'); setTimeout(_mNextLayer, 0); }
                  }, 15000);

                  pms.domToCanvas(mDoc.documentElement, { scale: _sc, timeout: 12000, filter: function(n) { return !(n && n.getAttribute && n.getAttribute('data-milg-overlay')); } }).then(function(mc) {
                    if (_mLayerDone) return; _mLayerDone = true; clearTimeout(_mLayerTimer);
                    var mCtx = mc.getContext('2d', { willReadFrequently: true });
                    var _fillFallbacks = 0;
                    layer.forEach(function(pe) {
                      var bbox = pe.pair.bbox;
                      if (!bbox) return;
                      var bx = Math.max(0, Math.round(bbox.left * _sc));
                      var by = Math.max(0, Math.round(bbox.top * _sc));
                      var bw = Math.min(Math.round(bbox.width * _sc), mc.width - bx);
                      var bh = Math.min(Math.round(bbox.height * _sc), mc.height - by);
                      if (bw < 2 || bh < 2) return;
                      try {
                        var px = mCtx.getImageData(bx, by, bw, bh).data;
                        var bmp = new Uint8Array(bw * bh);
                        for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
                          var i = (y * bw + x) * 4;
                          if ((px[i] + px[i + 1] + px[i + 2]) / 3 < 240) bmp[y * bw + x] = 1;
                        }
                        var _dk = 0; for (var _b = 0; _b < bmp.length; _b++) if (bmp[_b]) _dk++;

                        // fillText fallback when domToCanvas didn't render text
                        if (_dk === 0 && bw > 3 && pe.pair.text) {
                          try {
                            var cs = _mDv.getComputedStyle(pe.el);
                            var _fc = document.createElement('canvas'); _fc.width = bw; _fc.height = bh;
                            var _fx = _fc.getContext('2d'); _fx.fillStyle = '#fff'; _fx.fillRect(0, 0, bw, bh);
                            var _fs = parseFloat(cs.fontSize) * _sc;
                            _fx.fillStyle = '#000';
                            _fx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + _fs + 'px ' + cs.fontFamily;
                            _fx.textBaseline = 'top';
                            var _pl = (parseFloat(cs.paddingLeft) || 0) * _sc;
                            var _pt2 = (parseFloat(cs.paddingTop) || 0) * _sc;
                            var _pr = (parseFloat(cs.paddingRight) || 0) * _sc;
                            var _ta = cs.textAlign;
                            var _txt = pe.pair.text.replace(/\[placeholder\] /, '');
                            var _lh = parseFloat(cs.lineHeight) * _sc || _fs * 1.2;
                            var _contentW = bw - _pl - _pr;
                            var _words = _txt.split(/\s+/); var _lines = []; var _line = '';
                            for (var _w = 0; _w < _words.length; _w++) {
                              var _test = _line ? _line + ' ' + _words[_w] : _words[_w];
                              if (_fx.measureText(_test).width > _contentW && _line) { _lines.push(_line); _line = _words[_w]; }
                              else _line = _test;
                            }
                            _lines.push(_line);
                            var _totalH = _lines.length * _lh;
                            var _tyStart = _pt2;
                            var _par = pe.el.parentElement; var _pcs = _par ? _mDv.getComputedStyle(_par) : null;
                            if (_pcs) {
                              if (_pcs.display.indexOf('flex') >= 0 && _pcs.alignItems === 'center') _tyStart = Math.max(0, (bh - _totalH) / 2);
                              else if (bh > _totalH + _pt2 * 2) _tyStart = _pt2;
                            }
                            for (var _li2 = 0; _li2 < _lines.length; _li2++) {
                              var _lw = _fx.measureText(_lines[_li2]).width;
                              var _tx = _pl;
                              if (_ta === 'center') _tx = (_contentW - _lw) / 2 + _pl;
                              else if (_ta === 'right' || _ta === 'end') _tx = _contentW - _lw + _pl;
                              _fx.fillText(_lines[_li2], _tx, _tyStart + _li2 * _lh);
                            }
                            var _fpx = _fx.getImageData(0, 0, bw, bh).data;
                            bmp = new Uint8Array(bw * bh);
                            for (var _fy = 0; _fy < bh; _fy++) for (var _fxx = 0; _fxx < bw; _fxx++) {
                              var _fi = (_fy * bw + _fxx) * 4;
                              if ((_fpx[_fi] + _fpx[_fi + 1] + _fpx[_fi + 2]) / 3 < 240) bmp[_fy * bw + _fxx] = 1;
                            }
                            _dk = 0; for (var _fb = 0; _fb < bmp.length; _fb++) if (bmp[_fb]) _dk++;
                            _fillFallbacks++;
                          } catch (_fe) {}
                        }

                        // Bit-pack bitmap: 8 pixels per byte, then base64 encode
                        var _byteLen = Math.ceil(bmp.length / 8);
                        var _packed = new Uint8Array(_byteLen);
                        for (var _bi = 0; _bi < bmp.length; _bi++) if (bmp[_bi]) _packed[_bi >> 3] |= (1 << (_bi & 7));
                        var _binStr = ''; for (var _bi2 = 0; _bi2 < _packed.length; _bi2++) _binStr += String.fromCharCode(_packed[_bi2]);
                        var _b64 = btoa(_binStr);
                        // Store on pair (cross-frame) AND in dict (same-frame, survives iframe removal)
                        pe.pair._maskBmp = _b64;
                        pe.pair._maskPacked = true;
                        pe.pair._maskW = bw;
                        pe.pair._maskH = bh;
                        pe.pair._maskLayer = _mLi;
                        pe.pair._maskDark = _dk;
                        _mMaskResults[pe.idx] = { bmp: _b64, packed: true, w: bw, h: bh, layer: _mLi, dark: _dk };
                      } catch (_me) {}
                    });
                    if (_fillFallbacks > 0) console.log('[milg-region] Mask layer ' + _mLi + ': ' + _fillFallbacks + ' fillText fallbacks');
                    // Reset layer elements
                    layer.forEach(function(pe) {
                      pe.el.style.removeProperty('color');
                      pe.el.style.removeProperty('-webkit-text-fill-color');
                      pe.el.querySelectorAll('*').forEach(function(ch) {
                        ch.style.removeProperty('color');
                        ch.style.removeProperty('-webkit-text-fill-color');
                      });
                    });
                    setTimeout(_mNextLayer, 0);
                  }).catch(function(e) {
                    if (_mLayerDone) return; _mLayerDone = true; clearTimeout(_mLayerTimer);
                    console.warn('[milg-region] Mask layer ' + _mLi + ' failed:', e);
                    setTimeout(_mNextLayer, 0);
                  });
                }
                _mNextLayer();
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
          // Sort by DOM order (primary) so viewer order matches document order;
          // noAnchor entries (no visible position on main page) go last.
          // containerRect.top is fallback only when domOrder ties.
          _rgnResults.sort(function(a, b) {
            var aNA = a.noAnchor ? 1 : 0, bNA = b.noAnchor ? 1 : 0;
            if (aNA !== bNA) return aNA - bNA;
            var aD = (a._domOrder != null) ? a._domOrder : 1e9;
            var bD = (b._domOrder != null) ? b._domOrder : 1e9;
            if (aD !== bD) return aD - bD;
            var aTop = (a.containerRect && a.containerRect.top) || 0;
            var bTop = (b.containerRect && b.containerRect.top) || 0;
            return aTop - bTop;
          });
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
