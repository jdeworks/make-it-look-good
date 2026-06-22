// make-it-look-good — Extraction Engine
// Runs inside iframes to extract design data from rendered pages.
// Exposed as window.MilgExtract for use by analyzer.js and test harnesses.

window.MilgExtract = (function() {
  "use strict";

  // This runs inside an iframe to extract data — mirrors analyzer-snippet.js logic
  function extractFromDocument() {
    var _parseCanvas = document.createElement('canvas');
    _parseCanvas.width = 1; _parseCanvas.height = 1;
    var _parseCtx = _parseCanvas.getContext('2d', { willReadFrequently: true });
    function parseColor(str) {
      if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
      var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
      var m2 = str.match(/rgba?\((\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+%?))?\)/);
      if (m2) { var a = m2[4] !== undefined ? (m2[4].indexOf('%') !== -1 ? parseFloat(m2[4]) / 100 : +m2[4]) : 1; return { r: +m2[1], g: +m2[2], b: +m2[3], a: a }; }
      if (/\/\s*0\s*[\)%]/.test(str)) return null;
      _parseCtx.clearRect(0, 0, 1, 1);
      _parseCtx.fillStyle = 'rgba(0,0,0,0)';
      _parseCtx.fillStyle = str;
      _parseCtx.fillRect(0, 0, 1, 1);
      var d = _parseCtx.getImageData(0, 0, 1, 1).data;
      if (d[3] === 0) return null;
      return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 };
    }
    function blendOnWhite(c) {
      if (!c) return { r: 255, g: 255, b: 255 };
      var a = c.a;
      return { r: Math.round(c.r * a + 255 * (1 - a)), g: Math.round(c.g * a + 255 * (1 - a)), b: Math.round(c.b * a + 255 * (1 - a)) };
    }
    // Composite a foreground color onto its ACTUAL background (not white), then apply
    // the element's effective opacity (CSS `opacity` dims the whole subtree toward its
    // backdrop). This yields the visible perceived fg color for contrast. Fixes the
    // frosted/translucent and opacity-dimmed (Hushed) false positives where fg was
    // previously flattened against white and `effectiveOpacity` was ignored.
    function blendFgOverBg(fg, bg, effOpacity) {
      if (!fg) return bg || { r: 255, g: 255, b: 255 };
      var base = bg || { r: 255, g: 255, b: 255 };
      var a = fg.a !== undefined ? fg.a : 1;
      var r1 = fg.r * a + base.r * (1 - a);
      var g1 = fg.g * a + base.g * (1 - a);
      var b1 = fg.b * a + base.b * (1 - a);
      var k = (effOpacity !== undefined && effOpacity < 1) ? effOpacity : 1;
      return {
        r: Math.round(r1 * k + base.r * (1 - k)),
        g: Math.round(g1 * k + base.g * (1 - k)),
        b: Math.round(b1 * k + base.b * (1 - k))
      };
    }
    // Gradient sampler for iframe extractor — handles multiple backgrounds + alpha
    var _gc = document.createElement('canvas'); _gc.width = 100; _gc.height = 100;
    var _gx = _gc.getContext('2d', { willReadFrequently: true });
    function splitGrads(bgi) {
      var layers = [], depth = 0, start = 0;
      for (var i = 0; i < bgi.length; i++) {
        if (bgi[i] === '(') depth++;
        else if (bgi[i] === ')') depth--;
        else if (bgi[i] === ',' && depth === 0) { layers.push(bgi.substring(start, i).trim()); start = i + 1; }
      }
      layers.push(bgi.substring(start).trim());
      return layers.filter(function(l) { return l.indexOf('gradient') !== -1; });
    }
    // samplePos: {x: 0-1, y: 0-1} relative position within the gradient element to sample
    // If not provided, samples at center (0.5, 0.5)
    function getGradientBg(el, samplePos) {
      var bgi = getComputedStyle(el).backgroundImage;
      if (!bgi || bgi === 'none' || bgi.indexOf('gradient') === -1) return null;
      var layers = splitGrads(bgi);
      if (layers.length === 0) return null;
      _gc.width = 100; _gc.height = 100;
      _gx.clearRect(0, 0, 100, 100);
      // Render bottom-to-top (CSS: first = top)
      for (var li = layers.length - 1; li >= 0; li--) {
        var layer = layers[li];
        if (layer.indexOf('radial') !== -1) {
          var rs = layer.match(/(?:rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/g);
          if (rs && rs.length > 0) { var fc = parseColor(rs[0]); if (fc && fc.a > 0) { _gx.fillStyle = 'rgba(' + fc.r + ',' + fc.g + ',' + fc.b + ',' + fc.a + ')'; _gx.fillRect(0, 0, 100, 100); } }
          continue;
        }
        // Linear gradient — extract stops from THIS layer only
        var sr = /(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})\s*([\d.]+%)?/g;
        var stops = [], m;
        while ((m = sr.exec(layer)) !== null) { var sc = parseColor(m[1]); if (sc) stops.push({ c: sc, p: m[2] ? parseFloat(m[2]) / 100 : null }); }
        if (stops.length === 0) continue;
        if (stops.length === 1) { _gx.fillStyle = 'rgba(' + stops[0].c.r + ',' + stops[0].c.g + ',' + stops[0].c.b + ',' + stops[0].c.a + ')'; _gx.fillRect(0, 0, 100, 100); continue; }
        if (stops[0].p === null) stops[0].p = 0;
        if (stops[stops.length - 1].p === null) stops[stops.length - 1].p = 1;
        var angleMatch = layer.match(/linear-gradient\(\s*(\d+(?:\.\d+)?)deg/);
        var deg = angleMatch ? parseFloat(angleMatch[1]) : 180;
        var rad = (deg - 90) * Math.PI / 180;
        var diag = Math.sqrt(100 * 100 + 100 * 100) / 2;
        var dx = Math.cos(rad) * diag, dy = Math.sin(rad) * diag;
        try {
          var grad = _gx.createLinearGradient(50 - dx, 50 - dy, 50 + dx, 50 + dy);
          for (var si = 0; si < stops.length; si++) { var c = stops[si].c; grad.addColorStop(Math.max(0, Math.min(1, stops[si].p || 0)), 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + c.a + ')'); }
          _gx.fillStyle = grad;
          _gx.fillRect(0, 0, 100, 100);
        } catch(e) {}
      }
      // Sample at the text element's position within the gradient container
      var sx = samplePos ? Math.round(samplePos.x * 99) : 50;
      var sy = samplePos ? Math.round(samplePos.y * 99) : 50;
      var d = _gx.getImageData(sx, sy, 1, 1).data;
      if (d[3] === 0) return null;
      return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 };
    }
    function getEffectiveBg(el) {
      var elRect = el.getBoundingClientRect();
      var elCenterX = elRect.left + elRect.width / 2;
      var elCenterY = elRect.top + elRect.height / 2;
      var node = el, layers = [];
      while (node && node !== document.documentElement) {
        var bg = getComputedStyle(node).backgroundColor;
        var c = parseColor(bg);
        if (!c || c.a === 0) {
          // Sample gradient at the text element's position relative to this ancestor
          var nodeRect = node.getBoundingClientRect();
          var relX = nodeRect.width > 0 ? (elCenterX - nodeRect.left) / nodeRect.width : 0.5;
          var relY = nodeRect.height > 0 ? (elCenterY - nodeRect.top) / nodeRect.height : 0.5;
          c = getGradientBg(node, { x: Math.max(0, Math.min(1, relX)), y: Math.max(0, Math.min(1, relY)) });
        }
        if (c && c.a > 0) layers.push(c);
        if (c && c.a >= 1) break;
        node = node.parentElement;
      }
      // If no opaque layer was reached (the walk excludes <html>), the real backdrop is
      // the document element's background — sample its color/gradient instead of assuming
      // white. The Frosted effect paints its gradient on <body>, but some presets/effects
      // place it on <html>; either way this prevents compositing translucent surfaces over
      // a phantom white base.
      if (!(layers.length && layers[layers.length - 1].a >= 1)) {
        var htmlEl = document.documentElement;
        var hc = parseColor(getComputedStyle(htmlEl).backgroundColor);
        if (!hc || hc.a === 0) {
          var hRect = htmlEl.getBoundingClientRect();
          var hRelX = hRect.width > 0 ? (elCenterX - hRect.left) / hRect.width : 0.5;
          var hRelY = hRect.height > 0 ? (elCenterY - hRect.top) / hRect.height : 0.5;
          hc = getGradientBg(htmlEl, { x: Math.max(0, Math.min(1, hRelX)), y: Math.max(0, Math.min(1, hRelY)) });
        }
        if (hc && hc.a > 0) layers.push(hc);
      }
      var result = { r: 255, g: 255, b: 255 };
      for (var i = layers.length - 1; i >= 0; i--) {
        var l = layers[i], a = l.a;
        result = { r: Math.round(l.r * a + result.r * (1 - a)), g: Math.round(l.g * a + result.g * (1 - a)), b: Math.round(l.b * a + result.b * (1 - a)) };
      }
      return result;
    }
    function luminance(c) {
      var rs = c.r / 255, gs = c.g / 255, bs = c.b / 255;
      var r = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
      var g = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
      var b = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function contrastRatio(c1, c2) {
      var l1 = luminance(c1), l2 = luminance(c2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }
    function rgbStr(c) { return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'; }
    function isVisible(el) {
      var s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      if (s.opacity === '0') {
        // Check if this is a scroll-animated element (has transition/animation) — treat as visible
        // These will be force-revealed during the screenshot phase
        var hasTrans = s.transition && s.transition.indexOf('opacity') !== -1;
        var hasAnim = s.animationName && s.animationName !== 'none';
        var cls = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
        if (!hasTrans && !hasAnim && !/fade|reveal|animate|aos|slide|appear/.test(cls)) return false;
      }
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }
    // Detect elements hidden at capture time due to closed <details> or content-visibility:hidden.
    // Chrome 131+ returns real geometry for content inside closed <details> (content-visibility:hidden),
    // so isVisible() passes but the content is not visible to the user.
    function _isHiddenAtCapture(el) {
      try {
        if (typeof el.checkVisibility === 'function') {
          return !el.checkVisibility();
        }
        // Fallback: closed <details> ancestor (but not the <summary> itself)
        if (el.closest && el.closest('details:not([open])') && !el.closest('summary')) return true;
      } catch (e) {}
      return false;
    }
    // Detect sr-only / visually-hidden elements (visible to screen readers but not to users).
    // These use clip, tiny dimensions, or specific class names to hide visually.
    function _isScreenReaderOnly(el) {
      var r = el.getBoundingClientRect();
      if (r.width <= 1 && r.height <= 1) {
        var s = getComputedStyle(el);
        if (s.overflow === 'hidden' || s.clip !== 'auto' || s.clipPath === 'inset(50%)') return true;
      }
      var cls = (el.className && typeof el.className === 'string') ? el.className : '';
      if (/\b(sr-only|visually-hidden|screen-reader|clip-hide|offscreen)\b/.test(cls)) return true;
      return false;
    }
    function cssSelector(el) {
      if (el.id) return '#' + el.id;
      var tag = el.tagName.toLowerCase();
      var cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      // Add nth-child to disambiguate siblings with same tag+class
      var nth = '';
      if (el.parentElement) {
        var siblings = el.parentElement.children;
        var sameCount = 0, pos = 0;
        for (var i = 0; i < siblings.length; i++) {
          if (siblings[i].tagName === el.tagName) { sameCount++; if (siblings[i] === el) pos = sameCount; }
        }
        if (sameCount > 1) nth = ':nth-of-type(' + pos + ')';
      }
      return tag + cls + nth;
    }

    var data = {
      meta: { title: document.title, url: location.href, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, docHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight), scrollX: window.scrollX, scrollY: window.scrollY, timestamp: new Date().toISOString(), version: 1, isFragment: !!window.__milgIsFragment },
      colors: { textColors: [], bgColors: [], contrastPairs: [], bgEdgePairs: [] },
      typography: { bodyFontSize: '', bodyLineHeight: '', bodyFontFamily: '', fontFamilies: [], fontSizes: [], fontWeights: [], headings: [], lineHeights: [], maxLineLength: { chars: 0, element: '', fontSize: 0, textLength: 0 } },
      spacing: { paddings: [], margins: [], gaps: [], maxContentWidth: '', bodyPaddingHorizontal: '' },
      layout: { sectionGaps: [], alignmentEdges: [], visualHierarchy: {} },
      interaction: { touchTargets: [], transitions: [] },
      accessibility: { semanticElements: {}, headingHierarchy: [], imagesWithoutAlt: 0, formLabels: { total: 0, withLabel: 0, withoutLabel: 0 }, focusIndicators: [] },
      structure: { totalElements: 0, darkModeClasses: false, responsiveClasses: false, tailwindDetected: false, cssFramework: 'unknown' }
    };

    var allElements = document.body.querySelectorAll('*');
    data.structure.totalElements = allElements.length;
    var htmlStr = document.body.innerHTML;
    if (/class="[^"]*(?:sm:|md:|lg:|xl:)/.test(htmlStr) || /class="[^"]*(?:flex|grid|text-|bg-|p-|m-)/.test(htmlStr)) { data.structure.tailwindDetected = true; data.structure.cssFramework = 'tailwind'; }
    else if (/class="[^"]*(?:col-md|col-sm|btn-primary|container-fluid)/.test(htmlStr)) { data.structure.cssFramework = 'bootstrap'; }
    data.structure.darkModeClasses = /class="[^"]*dark:/.test(htmlStr) || document.body.classList.contains('dark-ui') || document.body.classList.contains('dark-mode') || document.body.classList.contains('dark-theme') || document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark' || document.body.getAttribute('data-theme') === 'dark' || document.querySelector('[data-bs-theme="dark"]') !== null || Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r.cssText && r.cssText.indexOf('prefers-color-scheme') !== -1; }); } catch(e) { return false; } });
    // JS-toggle heuristic: a dark/theme toggle control means dark mode EXISTS even
    // when the page is currently in light mode (class-based toggles leave no static
    // trace). Without this, pages like our own analyzer got "no dark mode" while
    // sporting a moon button in the header.
    if (!data.structure.darkModeClasses) {
      try {
        data.structure.darkModeClasses = !!document.querySelector('button[title*="dark" i],button[aria-label*="dark" i],[role="switch"][aria-label*="dark" i],[id*="darkmode" i],[id*="dark-mode" i],[id="darkBtn"],[class*="dark-toggle" i],[class*="theme-toggle" i]');
      } catch (e) {}
    }
    data.structure.responsiveClasses = /class="[^"]*(?:sm:|md:|lg:|xl:)/.test(htmlStr) || Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r instanceof CSSMediaRule && /max-width|min-width/.test(r.conditionText || ''); }); } catch(e) { return false; } });

    // Decorative element detection — only skip aria-hidden if actually hidden
    var decorativeEls = new Set();
    // Includes the analyzer's own capture artifacts (iframe placeholders, capture
    // overlay) — region re-extraction runs while they're in the DOM, and they must
    // never appear as findings about the analyzed page.
    var defaultExclude = '[role="img"], [role="presentation"], [data-decorative], [data-milg-iframe-ph], [data-milg-overlay]';
    // User-defined exclude selector (passed via window.__milgExclude)
    var userExclude = window.__milgExclude || '';
    var fullExclude = userExclude ? defaultExclude + ', ' + userExclude : defaultExclude;
    try {
      document.querySelectorAll(fullExclude).forEach(function(el) {
        decorativeEls.add(el);
        el.querySelectorAll('*').forEach(function(child) { decorativeEls.add(child); });
      });
    } catch(e) { /* invalid selector — ignore */ }
    function isDecorative(el) { return decorativeEls.has(el); }

    // Universal bbox tracker: captures bbox AND stores element ref for re-reading
    // after scroll-reset (which triggers layout shifts from lazy content/animations).
    // When screenshots are enabled, the screenshot script re-reads all bboxes using
    // getFlowPosition() which subtracts CSS transforms to get flow position.
    var _bboxRefs = []; // [{el, obj, key}] — will update obj[key] = newBbox
    function captureBbox(el) {
      var r = el.getBoundingClientRect();
      return { left: Math.round(r.left + window.scrollX), top: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) };
    }
    function trackBbox(el, obj, key) {
      obj[key] = captureBbox(el);
      _bboxRefs.push({ el: el, obj: obj, key: key });
    }

    // Page context
    data.context = { pageType: 'unknown' };
    var hasHero = !!document.querySelector('.hero, [class*="hero"], section:first-of-type h1');
    var hasPricing = !!document.querySelector('[class*="pricing"], [class*="price"], .plan, .tier');
    var formCount = document.querySelectorAll('form').length;
    var sectionCount = document.querySelectorAll('section').length;
    if (hasPricing) data.context.pageType = 'pricing';
    else if (formCount > 0 && data.structure.totalElements < 80) data.context.pageType = 'form';
    else if (hasHero && sectionCount >= 3) data.context.pageType = 'marketing';
    else if (sectionCount >= 2) data.context.pageType = 'content';

    var bodyStyle = getComputedStyle(document.body);
    data.typography.bodyFontSize = bodyStyle.fontSize;
    data.typography.bodyLineHeight = bodyStyle.lineHeight;
    data.typography.bodyFontFamily = bodyStyle.fontFamily;
    data.spacing.bodyPaddingHorizontal = bodyStyle.paddingLeft;

    var fontSizeMap = {}, fontWeightMap = {}, fontFamilySet = new Set(), lineHeightMap = {};
    var textColorMap = {}, bgColorMap = {}, paddingMap = {}, marginMap = {}, gapMap = {};
    var textColorSample = {}, bgColorSample = {}; // Store one sample selector per color
    var fontSizeSamples = {}; // fontSize → {selector, bbox, extraBboxes?} for sample elements
    var maxContentW = 0;
    var contrastPairs = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var node, seenForContrast = new Set();
    var _contrastStats = { textNodes: 0, empty: 0, noParent: 0, invisible: 0, decorative: 0, seen: 0, noFg: 0, gradientText: 0, captured: 0 };

    while (node = walker.nextNode()) {
      _contrastStats.textNodes++;
      if (!node.textContent.trim()) { _contrastStats.empty++; continue; }
      var el = node.parentElement;
      if (!el) { _contrastStats.invisible++; continue; }
      // Check visibility including ancestors — an ancestor with opacity:0 hides children
      var _elVisible = true;
      var _checkNode = el;
      while (_checkNode && _checkNode !== document.documentElement) {
        var _cs = getComputedStyle(_checkNode);
        if (_cs.display === 'none' || _cs.visibility === 'hidden') { _elVisible = false; break; }
        if (_cs.opacity === '0') {
          // Allow scroll-animated ancestors
          var _hasTr = _cs.transition && _cs.transition.indexOf('opacity') !== -1;
          var _hasAn = _cs.animationName && _cs.animationName !== 'none';
          var _cls2 = (_checkNode.className && typeof _checkNode.className === 'string') ? _checkNode.className.toLowerCase() : '';
          if (!_hasTr && !_hasAn && !/fade|reveal|animate|aos|slide|appear/.test(_cls2)) { _elVisible = false; break; }
        }
        _checkNode = _checkNode.parentElement;
      }
      var _rect = el.getBoundingClientRect();
      if (!_elVisible || _rect.width <= 0 || _rect.height <= 0) {
        _contrastStats.invisible++;
        continue;
      }
      if (isDecorative(el)) { _contrastStats.decorative++; continue; }
      // WCAG 1.4.3 exempts text in INACTIVE/disabled UI components (a disabled control is
      // meant to look muted). Skip elements that are, or are inside, a disabled control.
      if (el.closest && el.closest('[disabled],[aria-disabled="true"],fieldset[disabled]')) { _contrastStats.disabled = (_contrastStats.disabled || 0) + 1; continue; }
      if (seenForContrast.has(el)) { _contrastStats.seen++; continue; }
      seenForContrast.add(el);
      var style = getComputedStyle(el);
      var textFillColor = style.webkitTextFillColor || style.getPropertyValue('-webkit-text-fill-color') || '';
      var bgClip = style.webkitBackgroundClip || style.getPropertyValue('-webkit-background-clip') || style.backgroundClip || '';
      var isGradientText = bgClip === 'text' && textFillColor === 'transparent';
      // For gradient text: CSS fg is meaningless (transparent), use a placeholder
      // The pixel verification pipeline will measure actual rendered colors from the screenshot
      var fg;
      if (isGradientText) {
        // Sample the gradient at center to get an approximate fg color for CSS-level reporting
        var gradBg = getGradientBg(el, { x: 0.5, y: 0.5 });
        fg = gradBg || { r: 128, g: 128, b: 128, a: 1 }; // fallback grey
      } else {
        fg = textFillColor && textFillColor !== 'transparent' ? parseColor(textFillColor) : parseColor(style.color);
      }
      if (!fg) {
        _contrastStats.noFg++;
        continue;
      }
      // Skip emoji-only elements (picture emoji can't be contrast-checked)
      var _textContent = (el.textContent || '').trim();
      var _noEmoji = _textContent.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA9F}\u{200D}]/gu, '').trim();
      if (_noEmoji.length === 0 && _textContent.length > 0) continue;
      var bg = getEffectiveBg(el);
      // Effective opacity (element × ancestors) — CSS `opacity` dims the whole subtree
      // toward its backdrop. Computed before the fg blend so it factors into the ratio.
      var _effOpacity = 1;
      var _opNode = el;
      while (_opNode && _opNode !== document.documentElement) {
        var _opVal = parseFloat(getComputedStyle(_opNode).opacity);
        if (!isNaN(_opVal) && _opVal < 1) _effOpacity *= _opVal;
        _opNode = _opNode.parentElement;
      }
      // Composite fg over the ACTUAL bg (not white) and apply opacity → visible color.
      var fgBlended = blendFgOverBg(fg, bg, _effOpacity);
      var ratio = contrastRatio(fgBlended, bg);
      var fontSize = parseFloat(style.fontSize);
      var fontWeight = parseInt(style.fontWeight) || 400;
      var isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      var threshold = isLarge ? 3 : 4.5;
      var filterAncestor = el;
      var filterValue = '';
      var hasBackdropFilter = false;
      var minBgAlpha = 1;
      while (filterAncestor && filterAncestor !== document.documentElement) {
        var aStyle = getComputedStyle(filterAncestor);
        var f = aStyle.filter;
        if (f && f !== 'none' && !filterValue) { filterValue = f; }
        var bf = aStyle.backdropFilter || aStyle.webkitBackdropFilter || '';
        if (bf && bf !== 'none') hasBackdropFilter = true;
        var aBg = parseColor(aStyle.backgroundColor);
        if (aBg && aBg.a >= 0.95) break; // opaque bg — frosted layers above cannot bleed through
        if (aBg && aBg.a > 0 && aBg.a < 1 && aBg.a < minBgAlpha) minBgAlpha = aBg.a;
        filterAncestor = filterAncestor.parentElement;
      }
      var elRect = el.getBoundingClientRect();
      // (_effOpacity computed above, before the fg blend)
      // Does any ancestor up to the first opaque background paint an IMAGE behind
      // this text? (url(...) backgrounds only — gradients are detected pixel-side
      // via bg variance.) Used by the small-text demotion in pixel verify.
      var _bgImgNode = el, _bgHasImage = false;
      while (_bgImgNode && _bgImgNode.nodeType === 1 && _bgImgNode !== document.documentElement) {
        var _bgiStyle = _bgImgNode === el ? style : getComputedStyle(_bgImgNode);
        if ((_bgiStyle.backgroundImage || '').indexOf('url(') !== -1) { _bgHasImage = true; break; }
        var _bgiColor = parseColor(_bgiStyle.backgroundColor);
        if (_bgiColor && _bgiColor.a >= 0.95) break; // opaque bg — nothing behind shows through
        _bgImgNode = _bgImgNode.parentElement;
      }
      if (ratio < 22) { // capture all pairs including AAA passes for pixel verification
        var _cpEntry = { fg: rgbStr(fgBlended), bg: rgbStr(bg), ratio: Math.round(ratio * 100) / 100, needed: threshold, passes: ratio >= threshold, fontSize: Math.round(fontSize), fontWeight: fontWeight, isLarge: isLarge, bgHasImage: _bgHasImage, text: (el.textContent || '').trim().substring(0, 200), selector: cssSelector(el), filter: filterValue, backdropFilter: hasBackdropFilter, minBgAlpha: Math.round(minBgAlpha * 100) / 100, effectiveOpacity: Math.round(_effOpacity * 100) / 100, isGradientText: isGradientText, fontFamily: style.fontFamily, fontStyle: style.fontStyle, letterSpacing: style.letterSpacing, textTransform: style.textTransform, lineHeight: style.lineHeight, bbox: null };
        var _hac = _isHiddenAtCapture(el);
        if (_hac) _cpEntry._hiddenAtCapture = true;
        trackBbox(el, _cpEntry, 'bbox');
        contrastPairs.push(_cpEntry);
        _contrastStats.captured++;
      }
      var elWidth = elRect.width;
      var charWidth = fontSize * 0.5;
      var charsPerLine = Math.round(elWidth / charWidth);
      // Only count lines the text can actually FILL: a wide single-line control
      // ("Analyze" on a full-width button, a <summary> row) has no long line to
      // read — its text ends long before the container edge.
      if (charsPerLine > data.typography.maxLineLength.chars && node.textContent.trim().length >= charsPerLine && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.closest('pre') && !el.closest('code')) {
        data.typography.maxLineLength = { chars: charsPerLine, element: cssSelector(el), fontSize: Math.round(fontSize), textLength: node.textContent.trim().length, bbox: null };
        trackBbox(el, data.typography.maxLineLength, 'bbox');
      }
    }
    // Placeholder text contrast — inputs/textareas with placeholder attribute
    document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(function(inp) {
      var ph = inp.getAttribute('placeholder');
      if (!ph || !ph.trim()) return;
      var inpRect = inp.getBoundingClientRect();
      if (inpRect.width <= 0 || inpRect.height <= 0) return;
      // Read ::placeholder color (browser-rendered pseudo-element)
      var phStyle = getComputedStyle(inp, '::placeholder');
      var phColor = phStyle ? parseColor(phStyle.color) : null;
      if (!phColor) {
        // Fallback: many browsers report placeholder as lighter version of input color
        var inpColor = parseColor(getComputedStyle(inp).color);
        if (inpColor) phColor = { r: inpColor.r, g: inpColor.g, b: inpColor.b, a: Math.min(inpColor.a, 0.5) };
      }
      if (!phColor) return;
      var phBg = getEffectiveBg(inp);
      var phBlended = blendFgOverBg(phColor, phBg);
      var phRatio = contrastRatio(phBlended, phBg);
      var inpStyle = getComputedStyle(inp);
      var phFontSize = parseFloat(inpStyle.fontSize);
      var phFontWeight = parseInt(inpStyle.fontWeight) || 400;
      var phIsLarge = phFontSize >= 24 || (phFontSize >= 18.66 && phFontWeight >= 700);
      var _phEntry = {
        fg: rgbStr(phBlended), bg: rgbStr(phBg),
        ratio: Math.round(phRatio * 100) / 100,
        needed: phIsLarge ? 3 : 4.5, passes: phRatio >= (phIsLarge ? 3 : 4.5),
        fontSize: Math.round(phFontSize), fontWeight: phFontWeight, isLarge: phIsLarge,
        text: '[placeholder] ' + ph.substring(0, 150),
        selector: cssSelector(inp), filter: '', backdropFilter: false, minBgAlpha: 1,
        fontFamily: inpStyle.fontFamily, fontStyle: inpStyle.fontStyle,
        letterSpacing: inpStyle.letterSpacing, textTransform: inpStyle.textTransform,
        lineHeight: inpStyle.lineHeight, isPlaceholder: true, bbox: null
      };
      if (_isHiddenAtCapture(inp)) _phEntry._hiddenAtCapture = true;
      trackBbox(inp, _phEntry, 'bbox');
      contrastPairs.push(_phEntry);
      _contrastStats.captured++;
    });

    contrastPairs.sort(function(a, b) { return a.ratio - b.ratio; });
    data.colors.contrastPairs = contrastPairs;
    data.colors._contrastStats = _contrastStats;

    // Area-weighted darkness tracking for accurate page brightness measurement
    var darknessAreas = []; // { darkness: 0-1, area: px² }
    function parseGradientColors(bgImage) {
      // Extract color stops from linear-gradient, radial-gradient
      var colors = [];
      var re = /(?:rgb|rgba)\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\s*\)|#([0-9a-fA-F]{3,8})/g;
      var m;
      while ((m = re.exec(bgImage)) !== null) {
        if (m[4]) {
          var hex = m[4];
          if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
          colors.push({ r: parseInt(hex.substr(0,2),16), g: parseInt(hex.substr(2,2),16), b: parseInt(hex.substr(4,2),16) });
        } else {
          colors.push({ r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) });
        }
      }
      return colors;
    }

    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
      if (!isVisible(el)) continue;
      var s = getComputedStyle(el);
      fontSizeMap[s.fontSize] = (fontSizeMap[s.fontSize] || 0) + 1;
      if (!fontSizeSamples[s.fontSize]) {
        var _fsText = (el.textContent || '').trim().substring(0, 60);
        fontSizeSamples[s.fontSize] = { selector: cssSelector(el), text: _fsText, bbox: null, extraBboxes: [] };
        trackBbox(el, fontSizeSamples[s.fontSize], 'bbox');
      } else if (fontSizeSamples[s.fontSize].extraBboxes) {
        // Collect ALL additional bboxes + selectors + text for findings that show every instance
        var _fsText = (el.textContent || '').trim().substring(0, 60);
        var _extra = { bbox: null, selector: cssSelector(el), text: _fsText };
        trackBbox(el, _extra, 'bbox');
        fontSizeSamples[s.fontSize].extraBboxes.push(_extra);
      }
      fontWeightMap[s.fontWeight] = (fontWeightMap[s.fontWeight] || 0) + 1;
      fontFamilySet.add(s.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
      var lh = s.lineHeight;
      if (lh !== 'normal') { var lhR = parseFloat(lh) / parseFloat(s.fontSize); lineHeightMap[Math.round(lhR * 100) / 100] = (lineHeightMap[Math.round(lhR * 100) / 100] || 0) + 1; }
      if (s.color) { textColorMap[s.color] = (textColorMap[s.color] || 0) + 1; if (!textColorSample[s.color]) textColorSample[s.color] = cssSelector(el); }
      var bgColor = s.backgroundColor;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') { bgColorMap[bgColor] = (bgColorMap[bgColor] || 0) + 1; if (!bgColorSample[bgColor]) bgColorSample[bgColor] = cssSelector(el); }

      // Track area-weighted darkness for bg-color and gradients
      var rect = el.getBoundingClientRect();
      var area = rect.width * rect.height;
      if (area > 100) { // skip tiny elements
        var bgM = bgColor && bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (bgM) {
          var bgLum = (parseInt(bgM[1]) * 0.299 + parseInt(bgM[2]) * 0.587 + parseInt(bgM[3]) * 0.114) / 255;
          var bgAlpha = 1;
          var alphaM = bgColor.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)/);
          if (alphaM) bgAlpha = parseFloat(alphaM[1]);
          if (bgAlpha > 0.3) darknessAreas.push({ darkness: 1 - bgLum, area: area * bgAlpha });
        }
        // Also check background-image for gradients
        var bgImg = s.backgroundImage;
        if (bgImg && bgImg !== 'none' && /gradient/.test(bgImg)) {
          var gradColors = parseGradientColors(bgImg);
          if (gradColors.length > 0) {
            var avgGradLum = gradColors.reduce(function(sum, c) { return sum + (c.r * 0.299 + c.g * 0.587 + c.b * 0.114) / 255; }, 0) / gradColors.length;
            darknessAreas.push({ darkness: 1 - avgGradLum, area: area });
          }
        }
      }

      [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].filter(function(v) { return v !== '0px'; }).forEach(function(v) { paddingMap[v] = (paddingMap[v] || 0) + 1; });
      [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft].filter(function(v) { return v !== '0px' && v !== 'auto'; }).forEach(function(v) { marginMap[v] = (marginMap[v] || 0) + 1; });
      if (s.gap && s.gap !== 'normal' && s.gap !== '0px') gapMap[s.gap] = (gapMap[s.gap] || 0) + 1;
      var w = rect.width;
      if (w > maxContentW && w < window.innerWidth * 0.95) maxContentW = w;
    }
    function mapToSorted(map, sampleMap, bboxMap) { return Object.keys(map).map(function(k) { var entry = { value: k, count: map[k], sample: sampleMap ? (sampleMap[k] || '') : '' }; if (bboxMap && bboxMap[k]) { entry.sampleSelector = bboxMap[k].selector; entry.sampleText = bboxMap[k].text || ''; entry.bbox = bboxMap[k].bbox; entry._sampleRef = bboxMap[k]; if (bboxMap[k].extraBboxes) { entry.extraBboxes = bboxMap[k].extraBboxes.map(function(eb) { return eb.bbox; }).filter(Boolean); entry.extraSelectors = bboxMap[k].extraBboxes.map(function(eb) { return eb.selector; }).filter(Boolean); entry.extraTexts = bboxMap[k].extraBboxes.map(function(eb) { return eb.text || ''; }); } } return entry; }).sort(function(a, b) { return b.count - a.count; }); }
    data.typography.fontSizes = mapToSorted(fontSizeMap, null, fontSizeSamples);
    data.typography.fontWeights = mapToSorted(fontWeightMap);
    data.typography.fontFamilies = Array.from(fontFamilySet);
    data.typography.lineHeights = mapToSorted(lineHeightMap);
    data.colors.textColors = mapToSorted(textColorMap, textColorSample);
    data.colors.bgColors = mapToSorted(bgColorMap, bgColorSample);

    // Darkness level: 1 = white page, 10 = black page (area-weighted, includes gradients)
    var totalPixelWeight = 0;
    var totalDarkness = 0;
    if (darknessAreas.length > 0) {
      // Use area-weighted calculation (accounts for element size and gradients)
      for (var da = 0; da < darknessAreas.length; da++) {
        totalDarkness += darknessAreas[da].darkness * darknessAreas[da].area;
        totalPixelWeight += darknessAreas[da].area;
      }
    } else {
      // Fallback: simple element-count weighting
      for (var bgC in bgColorMap) {
        var count = bgColorMap[bgC] || 1;
        var m = bgC.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
          var lum = (parseInt(m[1]) * 0.299 + parseInt(m[2]) * 0.587 + parseInt(m[3]) * 0.114) / 255;
          totalDarkness += (1 - lum) * count;
          totalPixelWeight += count;
        }
      }
    }
    data.colors.darknessLevel = totalPixelWeight > 0 ? Math.max(1, Math.min(10, Math.round((totalDarkness / totalPixelWeight) * 9 + 1))) : 5;

    // Smart dark mode detection: check multiple signals
    var isDarkPage = data.colors.darknessLevel >= 6;
    data.structure.isDarkPage = isDarkPage;
    data.structure.darkModeMethod = 'none';
    if (document.documentElement.classList.contains('dark')) data.structure.darkModeMethod = 'tailwind-class';
    else if (document.body.classList.contains('dark-ui') || document.body.classList.contains('dark-mode') || document.body.classList.contains('dark-theme')) data.structure.darkModeMethod = 'body-class';
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) data.structure.darkModeMethod = 'media-query';
    else if (document.querySelector('[data-theme="dark"]') || document.documentElement.getAttribute('data-theme') === 'dark' || document.body.getAttribute('data-theme') === 'dark') data.structure.darkModeMethod = 'data-attribute';
    else if (function() { try { return !!document.querySelector('button[title*="dark" i],button[aria-label*="dark" i],[id*="darkmode" i],[id*="dark-mode" i],[id="darkBtn"],[class*="dark-toggle" i],[class*="theme-toggle" i]'); } catch (e) { return false; } }()) data.structure.darkModeMethod = 'toggle-control';
    else if (isDarkPage) data.structure.darkModeMethod = 'inferred-from-colors';

    data.spacing.paddings = mapToSorted(paddingMap);
    data.spacing.margins = mapToSorted(marginMap);
    data.spacing.gaps = mapToSorted(gapMap);
    data.spacing.maxContentWidth = Math.round(maxContentW) + 'px';

    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h) {
      var hs = getComputedStyle(h);
      var _hEntry = { tag: h.tagName.toLowerCase(), text: h.textContent.trim().substring(0, 60), fontSize: hs.fontSize, fontWeight: hs.fontWeight, lineHeight: hs.lineHeight, fontFamily: hs.fontFamily.split(',')[0].trim().replace(/['"]/g, ''), selector: cssSelector(h), bbox: null };
      trackBbox(h, _hEntry, 'bbox');
      data.typography.headings.push(_hEntry);
      data.accessibility.headingHierarchy.push(h.tagName.toLowerCase());
    });

    // Layout: section gaps, alignment edges, visual hierarchy
    var sections = document.querySelectorAll('section, [class*="section"], main > div, article');
    var sortedSections = Array.from(sections).filter(function(el) { return isVisible(el); }).sort(function(a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
    var sectionGaps = [];
    for (var si = 1; si < sortedSections.length; si++) {
      var gapVal = Math.round(sortedSections[si].getBoundingClientRect().top - sortedSections[si - 1].getBoundingClientRect().bottom);
      if (gapVal >= 0) sectionGaps.push(gapVal);
    }
    data.layout.sectionGaps = sectionGaps;

    var alignTargets = document.querySelectorAll('h1,h2,h3,h4,p,ul,ol,table,form,img,figure,blockquote');
    var leftEdges = [];
    var alignmentElements = []; // elements with their edges for bbox tracking
    Array.from(alignTargets).forEach(function(el) {
      if (!isVisible(el) || isDecorative(el)) return;
      var r = el.getBoundingClientRect();
      if (r.width > 50) {
        leftEdges.push(Math.round(r.left));
        if (alignmentElements.length < 50) {
          var _ae = { selector: cssSelector(el), left: Math.round(r.left), bbox: null };
          trackBbox(el, _ae, 'bbox');
          alignmentElements.push(_ae);
        }
      }
    });
    data.layout.alignmentEdges = leftEdges;
    data.layout.alignmentElements = alignmentElements;

    var bodyFS = parseFloat(data.typography.bodyFontSize) || 16;
    var h1Sizes = data.typography.headings.filter(function(h) { return h.tag === 'h1'; }).map(function(h) { return parseFloat(h.fontSize); });
    var h2Sizes = data.typography.headings.filter(function(h) { return h.tag === 'h2'; }).map(function(h) { return parseFloat(h.fontSize); });
    data.layout.visualHierarchy = {
      h1ToBody: h1Sizes.length > 0 ? Math.round((h1Sizes[0] / bodyFS) * 100) / 100 : 0,
      h2ToBody: h2Sizes.length > 0 ? Math.round((h2Sizes[0] / bodyFS) * 100) / 100 : 0,
      bodySize: bodyFS
    };

    var interactive = document.querySelectorAll('a,button,input,select,textarea,[role="button"],[tabindex]');
    var touchIssues = [];
    interactive.forEach(function(el) {
      if (!isVisible(el) || isDecorative(el) || _isScreenReaderOnly(el) || _isHiddenAtCapture(el)) return;
      var rect = el.getBoundingClientRect();
      var w = Math.round(rect.width), h = Math.round(rect.height);
      // Sub-2px inputs are implementation plumbing (Monaco's hidden textarea,
      // visually-hidden native checkboxes behind styled labels) — the real
      // interactive surface is elsewhere, so flagging them is noise.
      if (w < 2 || h < 2) return;
      if (w < 44 || h < 44) {
        var linkCtx = 'button';
        var _ttStyle = getComputedStyle(el);
        var _ttDisplay = _ttStyle.display || '';
        var _ttLineHeight = parseFloat(_ttStyle.lineHeight) || parseFloat(_ttStyle.fontSize) * 1.2 || 16;
        var _ttHasBg = _ttStyle.backgroundColor && _ttStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && _ttStyle.backgroundColor !== 'transparent';
        var _ttHasBorder = _ttStyle.borderStyle !== 'none' && parseFloat(_ttStyle.borderWidth) > 0;
        var _ttHasControlPadding = parseFloat(_ttStyle.paddingTop) > 4 || parseFloat(_ttStyle.paddingBottom) > 4 || parseFloat(_ttStyle.paddingLeft) > 6 || parseFloat(_ttStyle.paddingRight) > 6;
        var _ttIsButtonLike = el.tagName !== 'A' || _ttHasBg || _ttHasBorder || _ttHasControlPadding || el.getAttribute('role') === 'button' || /\b(btn|button|cta|nav-link|menu-item|tab)\b/i.test(el.className || '');
        if (el.tagName === 'A') {
          if (el.closest('nav,[role="navigation"],[role="menubar"],[role="tablist"]')) linkCtx = 'nav';
          else if (el.closest('footer')) linkCtx = 'footer';
          else if (el.closest('p, blockquote, figcaption, td, th, dd, li') && !_ttIsButtonLike) linkCtx = 'inline';
          else linkCtx = _ttIsButtonLike ? 'button' : 'standalone';
        }
        // WCAG 2.5.8 exempts inline text links. A line-height-constrained
        // unstyled anchor inside prose is not a touch-control failure.
        if (linkCtx === 'inline' && (_ttDisplay === 'inline' || h <= Math.ceil(_ttLineHeight + 4))) return;

        // Checkbox/radio: check if label provides adequate touch target
        if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
          var label = el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]'));
          if (label) {
            var lr = label.getBoundingClientRect();
            // If label is reasonably sized, use label dimensions as touch target
            if (lr.width >= 24 && lr.height >= 24) { w = Math.round(lr.width); h = Math.round(lr.height); }
            // If label makes it pass the 44px threshold, skip entirely
            if (w >= 44 && h >= 44) return;
          }
        }
        var _ttEntry = { element: el.tagName.toLowerCase(), width: w, height: h, text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 40), selector: cssSelector(el), passes: false, isButton: el.tagName !== 'A' || linkCtx === 'button' || linkCtx === 'nav', linkContext: linkCtx, display: _ttDisplay, lineHeight: Math.round(_ttLineHeight), bbox: null };
        trackBbox(el, _ttEntry, 'bbox');
        touchIssues.push(_ttEntry);
      }
    });
    touchIssues.sort(function(a, b) { return (a.width * a.height) - (b.width * b.height); });
    data.interaction.touchTargets = touchIssues.slice(0, 40);

    // --- BBox edge contrast pairs: elements with own bg vs parent bg ---
    // Checks whether buttons, cards, inputs, etc. visually stand out from surroundings
    var bgEdgePairs = [];
    var bgEdgeSeen = new Set();
    var bgEdgeCandidates = document.querySelectorAll('button,a,[role="button"],input:not([type="hidden"]),select,textarea,details,summary,.card,[class*="card"],[class*="btn"],[class*="button"],[class*="chip"],[class*="badge"],[class*="tag"],[class*="alert"],[class*="toast"],[class*="banner"]');
    bgEdgeCandidates.forEach(function(el) {
      if (!isVisible(el) || isDecorative(el)) return;
      var rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 16) return; // skip tiny
      var sel = cssSelector(el);
      if (bgEdgeSeen.has(sel)) return;
      bgEdgeSeen.add(sel);
      var s = getComputedStyle(el);
      var elBg = s.backgroundColor;
      var hasBg = elBg && elBg !== 'rgba(0, 0, 0, 0)' && elBg !== 'transparent';
      var hasBorder = s.borderStyle !== 'none' && parseFloat(s.borderWidth) >= 1;
      var hasOutline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1;
      var hasShadow = s.boxShadow && s.boxShadow !== 'none';
      // Skip elements with no visual boundary — edge test only makes sense
      // when the element has its own background, border, or shadow
      if (!hasBg && !hasBorder && !hasOutline && !hasShadow) return;
      // Get parent effective bg
      var parentBg = { r: 255, g: 255, b: 255 };
      var pNode = el.parentElement;
      while (pNode && pNode !== document.documentElement) {
        var pBgStr = getComputedStyle(pNode).backgroundColor;
        var pC = parseColor(pBgStr);
        if (pC && pC.a >= 0.5) { parentBg = { r: pC.r, g: pC.g, b: pC.b }; break; }
        pNode = pNode.parentElement;
      }
      var elBgParsed = parseColor(elBg);
      var cssBgRatio = 1;
      if (hasBg && elBgParsed && elBgParsed.a > 0.1) {
        var blended = { r: Math.round(elBgParsed.r * elBgParsed.a + parentBg.r * (1 - elBgParsed.a)), g: Math.round(elBgParsed.g * elBgParsed.a + parentBg.g * (1 - elBgParsed.a)), b: Math.round(elBgParsed.b * elBgParsed.a + parentBg.b * (1 - elBgParsed.a)) };
        cssBgRatio = Math.round(contrastRatio(blended, parentBg) * 100) / 100;
      }
      var _beEntry = {
        selector: sel,
        element: el.tagName.toLowerCase(),
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 40),
        elBg: hasBg ? rgbStr(elBgParsed && elBgParsed.a > 0.1 ? { r: Math.round(elBgParsed.r * (elBgParsed.a || 1) + parentBg.r * (1 - (elBgParsed.a || 1))), g: Math.round(elBgParsed.g * (elBgParsed.a || 1) + parentBg.g * (1 - (elBgParsed.a || 1))), b: Math.round(elBgParsed.b * (elBgParsed.a || 1) + parentBg.b * (1 - (elBgParsed.a || 1))) } : parentBg) : rgbStr(parentBg),
        parentBg: rgbStr(parentBg),
        cssBgRatio: cssBgRatio,
        hasBorder: hasBorder,
        hasOutline: hasOutline,
        hasShadow: hasShadow,
        borderColor: hasBorder ? s.borderColor : '',
        bbox: null
      };
      trackBbox(el, _beEntry, 'bbox');
      bgEdgePairs.push(_beEntry);
    });
    // Also check container elements with distinct backgrounds (cards, sections, etc.)
    for (var _bei = 0; _bei < allElements.length && bgEdgePairs.length < 80; _bei++) {
      var _bel = allElements[_bei];
      if (!isVisible(_bel) || isDecorative(_bel)) continue;
      var _bRect = _bel.getBoundingClientRect();
      if (_bRect.width < 40 || _bRect.height < 30) continue;
      var _bSel = cssSelector(_bel);
      if (bgEdgeSeen.has(_bSel)) continue;
      var _bS = getComputedStyle(_bel);
      var _bBg = _bS.backgroundColor;
      if (!_bBg || _bBg === 'rgba(0, 0, 0, 0)' || _bBg === 'transparent') continue;
      var _bC = parseColor(_bBg);
      if (!_bC || _bC.a < 0.3) continue;
      // Must have padding or border-radius (signals a visual container, not just a wrapper)
      var _hasPad = parseFloat(_bS.paddingTop) > 4 || parseFloat(_bS.paddingLeft) > 4;
      var _hasRadius = parseFloat(_bS.borderRadius) > 0;
      if (!_hasPad && !_hasRadius) continue;
      bgEdgeSeen.add(_bSel);
      var _pBg2 = { r: 255, g: 255, b: 255 };
      var _pn2 = _bel.parentElement;
      while (_pn2 && _pn2 !== document.documentElement) {
        var _pBgStr2 = getComputedStyle(_pn2).backgroundColor;
        var _pC2 = parseColor(_pBgStr2);
        if (_pC2 && _pC2.a >= 0.5) { _pBg2 = { r: _pC2.r, g: _pC2.g, b: _pC2.b }; break; }
        _pn2 = _pn2.parentElement;
      }
      var _blended2 = { r: Math.round(_bC.r * _bC.a + _pBg2.r * (1 - _bC.a)), g: Math.round(_bC.g * _bC.a + _pBg2.g * (1 - _bC.a)), b: Math.round(_bC.b * _bC.a + _pBg2.b * (1 - _bC.a)) };
      var _ratio2 = Math.round(contrastRatio(_blended2, _pBg2) * 100) / 100;
      bgEdgePairs.push({
        selector: _bSel, element: _bel.tagName.toLowerCase(),
        text: (_bel.textContent || '').trim().substring(0, 40),
        elBg: rgbStr(_blended2), parentBg: rgbStr(_pBg2),
        cssBgRatio: _ratio2,
        hasBorder: _bS.borderStyle !== 'none' && parseFloat(_bS.borderWidth) >= 1,
        hasOutline: false,
        hasShadow: _bS.boxShadow && _bS.boxShadow !== 'none',
        borderColor: _bS.borderStyle !== 'none' ? _bS.borderColor : '',
        bbox: null
      });
      trackBbox(_bel, bgEdgePairs[bgEdgePairs.length - 1], 'bbox');
    }
    data.colors.bgEdgePairs = bgEdgePairs;

    var transitionSet = new Set();
    for (var i = 0; i < allElements.length && transitionSet.size < 20; i++) { var t = getComputedStyle(allElements[i]).transitionDuration; if (t && t !== '0s') transitionSet.add(t); }
    data.interaction.transitions = Array.from(transitionSet);

    // Motion & animation signals (best-effort; fully guarded — the extractor is injected
    // into arbitrary pages and must never throw). Powers the "Motion & Animation" module.
    var _anim = { hasReducedMotion: false, keyframeCount: 0, hiddenElements: 0,
      scrollRevealPatterns: [], animationDurations: [], infiniteCount: 0, willChangeCount: 0, autoplayCount: 0 };
    try {
      var _scanRules = function(rules) {
        for (var r = 0; r < rules.length; r++) {
          var rule = rules[r];
          try {
            if (rule.type === 7) { _anim.keyframeCount++; }
            else if (rule.type === 4) { // CSSMediaRule
              var ct = rule.conditionText || (rule.media && rule.media.mediaText) || '';
              if (ct.indexOf('prefers-reduced-motion') !== -1) _anim.hasReducedMotion = true;
              if (rule.cssRules) _scanRules(rule.cssRules);
            } else if (rule.cssRules) { _scanRules(rule.cssRules); }
          } catch (e) {}
        }
      };
      var _sheets = document.styleSheets || [];
      for (var _si = 0; _si < _sheets.length; _si++) {
        try { var _cr = _sheets[_si].cssRules; if (_cr) _scanRules(_cr); } catch (e) { /* cross-origin sheet */ }
      }
    } catch (e) {}
    try {
      var _animDur = new Set();
      for (var _ai = 0; _ai < allElements.length && _ai < 5000; _ai++) {
        var _as; try { _as = getComputedStyle(allElements[_ai]); } catch (e) { continue; }
        var _hasTrans = _as.transitionDuration && _as.transitionDuration !== '0s';
        var _hasAnim = _as.animationName && _as.animationName !== 'none';
        if (parseFloat(_as.opacity) === 0 && (_hasTrans || _hasAnim)) _anim.hiddenElements++;
        if (_hasAnim) {
          _anim.autoplayCount++; // a non-none animationName at load ≈ auto-playing (no user trigger)
          if (_as.animationDuration && _as.animationDuration !== '0s' && _animDur.size < 20) _animDur.add(_as.animationDuration);
          if ((_as.animationIterationCount || '').indexOf('infinite') !== -1) _anim.infiniteCount++;
        }
        if (_as.willChange && _as.willChange !== 'auto') _anim.willChangeCount++;
      }
      _anim.animationDurations = Array.from(_animDur);
    } catch (e) {}
    try {
      var _srSel = ['[data-aos]', '.wow', '[data-sr]', '.reveal', '.scroll-reveal', '.animate-on-scroll', '[data-scroll]', '[data-animate]'];
      for (var _ssi = 0; _ssi < _srSel.length; _ssi++) {
        var _n = 0; try { _n = document.querySelectorAll(_srSel[_ssi]).length; } catch (e) {}
        if (_n > 0) _anim.scrollRevealPatterns.push({ selector: _srSel[_ssi], count: _n });
      }
    } catch (e) {}
    data.animation = _anim;

    var _semTags = ['header','nav','main','footer','section','article','aside'];
    var _semEls = {};
    _semTags.forEach(function(tag) { _semEls[tag] = 0; });
    for (var _si = 0; _si < allElements.length; _si++) {
      var _tn = allElements[_si].tagName.toLowerCase();
      if (_semEls.hasOwnProperty(_tn)) _semEls[_tn]++;
    }
    data.accessibility.semanticElements = _semEls;
    // lang attribute — scoring (accessibility.js) reads this; it was never set
    // before, so EVERY page got a false "Missing lang attribute" error.
    data.accessibility.langAttribute = (document.documentElement.getAttribute('lang') || '').trim();
    var navEls = document.querySelectorAll('nav'); var navItemCount = 0;
    navEls.forEach(function(nav) { var topLinks = nav.querySelectorAll(':scope > a, :scope > ul > li > a, :scope > ol > li > a, :scope > button, :scope > ul > li > button'); navItemCount += topLinks.length; });
    data.accessibility.navItemCount = navItemCount;
    var noAlt = 0; var noAltElements = [];
    document.querySelectorAll('img').forEach(function(img) {
      if (!img.hasAttribute('alt')) {
        noAlt++;
        if (isVisible(img) && noAltElements.length < 10) {
          var _naEntry = { selector: cssSelector(img), src: (img.src || '').substring(0, 80), bbox: null };
          trackBbox(img, _naEntry, 'bbox');
          noAltElements.push(_naEntry);
        }
      }
    });
    data.accessibility.imagesWithoutAlt = noAlt;
    data.accessibility.imagesWithoutAltElements = noAltElements;
    var inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]),select,textarea');
    var labeled = 0; var unlabeledElements = [];
    inputs.forEach(function(inp) {
      data.accessibility.formLabels.total++;
      if ((inp.id && document.querySelector('label[for="' + inp.id + '"]')) || inp.closest('label') || inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby')) {
        labeled++;
      } else if (isVisible(inp) && unlabeledElements.length < 10) {
        var _ulEntry = { selector: cssSelector(inp), type: inp.type || inp.tagName.toLowerCase(), bbox: null };
        trackBbox(inp, _ulEntry, 'bbox');
        unlabeledElements.push(_ulEntry);
      }
    });
    data.accessibility.formLabels.withLabel = labeled;
    data.accessibility.formLabels.withoutLabel = data.accessibility.formLabels.total - labeled;
    data.accessibility.formLabels.unlabeledElements = unlabeledElements;
    Array.from(interactive).slice(0, 10).forEach(function(el) { if (!isVisible(el)) return; var s = getComputedStyle(el); data.accessibility.focusIndicators.push({ element: cssSelector(el), outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, outlineOffset: s.outlineOffset }); });
    var _hasFvCSS = Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r.selectorText && r.selectorText.indexOf('focus-visible') !== -1; }); } catch(e) { return false; } });
    var _hasFvClasses = Array.from(interactive).slice(0, 20).some(function(el) { var cls = el.getAttribute('class') || ''; return cls.indexOf('focus-visible') !== -1 || cls.indexOf('focus:ring') !== -1 || cls.indexOf('focus:outline') !== -1; });
    data.accessibility.hasFocusVisibleCSS = _hasFvCSS || _hasFvClasses;
    // Skip link detection: an <a href="#..."> among the first focusable elements.
    // Detected by structure (internal anchor link early in tab order), not by text content (multilingual).
    data.accessibility.hasSkipLink = false;
    var _firstFocusable = document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]');
    for (var _fi = 0; _fi < Math.min(_firstFocusable.length, 5); _fi++) {
      var _fe = _firstFocusable[_fi];
      if (_fe.tagName === 'A' && _fe.getAttribute('href') && /^#\w/.test(_fe.getAttribute('href'))) {
        data.accessibility.hasSkipLink = true;
        break;
      }
    }
    // Font smoothing + bg image behind text (profile-specific)
    data.typography.fontSmoothingAntialiased = false;
    try { var bs = getComputedStyle(document.body).webkitFontSmoothing; if (bs === 'antialiased') data.typography.fontSmoothingAntialiased = true; } catch(e) {}
    data.accessibility.bgImageBehindText = 0;
    document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,span').forEach(function(el) { if (!isVisible(el)) return; var bgi = getComputedStyle(el).backgroundImage; if (bgi && bgi !== 'none' && bgi.indexOf('url(') !== -1 && el.textContent.trim().length > 10) data.accessibility.bgImageBehindText++; });

    // --- Viewport visibility: detect elements positioned off-screen on x-axis ---
    var vpW = window.innerWidth;
    var _iframeDataContentTags = { table: 1, pre: 1, code: 1 };
    data.layout.offscreenElements = [];
    var meaningfulSel = 'button,a,[role="menuitem"],[role="menu"],li,p,h1,h2,h3,h4,h5,h6,img,input,select,textarea,td,th,label,span,div';
    document.querySelectorAll(meaningfulSel).forEach(function(el) {
      if (!isVisible(el) || isDecorative(el)) return;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      var fullyOff = r.right < 0 || r.left >= vpW;
      var majorClip = r.left < vpW && r.right > vpW && (r.right - vpW) > r.width * 0.5;
      if (!fullyOff && !majorClip) return;
      // Only skip if inside a genuinely intentional scroll container (data content)
      var anc = el.parentElement;
      var inIntentionalScroll = false;
      while (anc && anc !== document.body && anc !== document.documentElement) {
        var ox = getComputedStyle(anc).overflowX;
        if (ox === 'auto' || ox === 'scroll') {
          var ancTag = anc.tagName.toLowerCase();
          var isData = !!_iframeDataContentTags[ancTag] || !!anc.closest('table,pre,code');
          var isWide = anc.clientWidth >= vpW * 0.8;
          // A short horizontal STRIP (toolbar, chip row, carousel) that scrolls
          // sideways is intentional UI — its content is reachable by design.
          // Only tall, page-wide scrollers indicate accidental horizontal scroll.
          var isStrip = anc.clientHeight > 0 && anc.clientHeight <= 200;
          if ((isData && !isWide) || isStrip) { inIntentionalScroll = true; break; }
          break;
        }
        anc = anc.parentElement;
      }
      if (inIntentionalScroll) return;
      var parentAlready = data.layout.offscreenElements.some(function(rec) {
        try { var pel = document.querySelector(rec.selector); return pel && pel.contains(el) && pel !== el; } catch(e) { return false; }
      });
      if (parentAlready) return;
      var _oeEntry = {
        element: el.tagName.toLowerCase(),
        selector: cssSelector(el),
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 50),
        left: Math.round(r.left),
        right: Math.round(r.right),
        vpWidth: vpW,
        reason: r.right < 0 ? 'left-overflow' : r.left >= vpW ? 'right-overflow' : 'major-clip',
        bbox: null
      };
      trackBbox(el, _oeEntry, 'bbox');
      data.layout.offscreenElements.push(_oeEntry);
    });
    data.layout.offscreenElements = data.layout.offscreenElements.slice(0, 20);

    // --- Second pass: check hidden fixed/sticky elements for potential overflow ---
    // Elements like scroll-triggered headers may be hidden (opacity:0) at extraction time
    // but overflow the viewport when they become visible after scrolling
    document.querySelectorAll('*').forEach(function(el) {
      var s = getComputedStyle(el);
      if (s.position !== 'fixed' && s.position !== 'sticky') return;
      // Only check elements that are currently hidden
      if (s.opacity !== '0' && s.display !== 'none' && s.visibility !== 'hidden') return;
      // Temporarily reveal to measure
      var origOpacity = el.style.opacity;
      var origVisibility = el.style.visibility;
      var origPointerEvents = el.style.pointerEvents;
      el.style.opacity = '0.001';
      el.style.visibility = 'visible';
      el.style.pointerEvents = 'none';
      // Force reflow
      void el.offsetWidth;
      // Check children for overflow
      var children = el.querySelectorAll(meaningfulSel);
      children.forEach(function(child) {
        var cs = getComputedStyle(child);
        if (cs.display === 'none') return;
        var cr = child.getBoundingClientRect();
        if (cr.width < 4 || cr.height < 4) return;
        var fullyOff = cr.right < 0 || cr.left >= vpW;
        var majorClip = cr.left < vpW && cr.right > vpW && (cr.right - vpW) > cr.width * 0.5;
        if (!fullyOff && !majorClip) return;
        // Skip if already reported
        var sel = cssSelector(child);
        var alreadyReported = data.layout.offscreenElements.some(function(rec) { return rec.selector === sel; });
        if (alreadyReported) return;
        var _hfEntry = {
          element: child.tagName.toLowerCase(),
          selector: sel,
          text: (child.textContent || child.getAttribute('aria-label') || '').trim().substring(0, 50),
          left: Math.round(cr.left),
          right: Math.round(cr.right),
          vpWidth: vpW,
          reason: 'hidden-fixed-overflow',
          bbox: null
        };
        trackBbox(child, _hfEntry, 'bbox');
        data.layout.offscreenElements.push(_hfEntry);
      });
      // Restore
      el.style.opacity = origOpacity;
      el.style.visibility = origVisibility;
      el.style.pointerEvents = origPointerEvents;
    });
    data.layout.offscreenElements = data.layout.offscreenElements.slice(0, 20);

    // --- Table cell readability on narrow viewports ---
    data.layout.tableCellIssues = [];
    if (vpW < 768) {
      document.querySelectorAll('table').forEach(function(table) {
        var cells = table.querySelectorAll('td, th');
        var cramped = 0, wrappedCells = 0;
        cells.forEach(function(cell) {
          if (!isVisible(cell)) return;
          var cs = getComputedStyle(cell);
          var r = cell.getBoundingClientRect();
          var hPad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
          // Check for very tight horizontal padding (<8px total)
          if (hPad < 8 && r.width > 0) cramped++;
          // Check for wrapped content: (cell height - padding) > 1.8x line height = multi-line
          var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
          // Skip flex/grid cells — they use intentional min-height for touch targets, not text wrapping
          var isFlex = cs.display === 'flex' || cs.display === 'inline-flex' || cs.display === 'grid';
          var vPad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
          if (!isFlex && (r.height - vPad) > lh * 1.8 && cell.textContent.trim().length > 0) wrappedCells++;
        });
        if (cramped > 2 || wrappedCells > 2) {
          data.layout.tableCellIssues.push({
            selector: cssSelector(table),
            totalCells: cells.length,
            crampedCells: cramped,
            wrappedCells: wrappedCells,
            tableWidth: Math.round(table.getBoundingClientRect().width),
            vpWidth: vpW
          });
        }
      });
    }

    // --- Fixed element scroll-contrast risk detection ---
    // Detect fixed/sticky elements with static colors that may lose contrast
    // when scrolled over sections with different background luminance
    data.layout.fixedContrastRisks = [];
    (function() {
      function luminance(r, g, b) { var a = [r,g,b].map(function(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
      function parseColor(str) { var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? { r: +m[1], g: +m[2], b: +m[3] } : null; }

      // Sample section background colors at different scroll positions
      var sections = document.querySelectorAll('section,main>div,[class*="bg-"]');
      var sectionBgs = [];
      sections.forEach(function(sec) {
        var bg = getComputedStyle(sec).backgroundColor;
        var c = parseColor(bg);
        if (c) sectionBgs.push({ lum: luminance(c.r, c.g, c.b), element: cssSelector(sec) });
      });
      var hasLightSections = sectionBgs.some(function(s) { return s.lum > 0.4; });
      var hasDarkSections = sectionBgs.some(function(s) { return s.lum < 0.15; });

      // Check visible fixed elements for contrast risk (report per container, not per child)
      // Only position:fixed — sticky elements are anchored within their section context
      document.querySelectorAll('header,nav,[class*="fixed"]').forEach(function(el) {
        var s = getComputedStyle(el);
        if (s.position !== 'fixed') return;
        // If the element has a solid (non-transparent) background, its children
        // are always on a consistent backdrop — no scroll-contrast risk
        var bgAlphaMatch = s.backgroundColor.match(/rgba\([\d.,\s]+,\s*([\d.]+)\)/);
        var bgAlpha = bgAlphaMatch ? parseFloat(bgAlphaMatch[1]) : 1;
        if (bgAlpha >= 0.85) return;
        var lightCount = 0, darkCount = 0, firstLight = null, firstDark = null;
        var coloredChildren = el.querySelectorAll('a,button,span,svg,h1,h2,h3,p');
        coloredChildren.forEach(function(child) {
          if (!isVisible(child)) return; // skip display:none / hidden children
          var cs = getComputedStyle(child);
          var color = parseColor(cs.color);
          if (!color) return;
          var colorLum = luminance(color.r, color.g, color.b);
          if (colorLum > 0.6 && hasLightSections) { lightCount++; if (!firstLight) firstLight = child; }
          if (colorLum < 0.15 && hasDarkSections) { darkCount++; if (!firstDark) firstDark = child; }
        });
        if (lightCount > 0 && firstLight) {
          data.layout.fixedContrastRisks.push({
            selector: cssSelector(el),
            text: (firstLight.textContent || firstLight.getAttribute('aria-label') || '').trim().substring(0, 30),
            color: getComputedStyle(firstLight).color,
            risk: 'light-on-light',
            element: el.tagName.toLowerCase(),
            childCount: lightCount
          });
        }
        if (darkCount > 0 && firstDark) {
          data.layout.fixedContrastRisks.push({
            selector: cssSelector(el),
            text: (firstDark.textContent || firstDark.getAttribute('aria-label') || '').trim().substring(0, 30),
            color: getComputedStyle(firstDark).color,
            risk: 'dark-on-dark',
            element: el.tagName.toLowerCase(),
            childCount: darkCount
          });
        }
      });
      data.layout.fixedContrastRisks = data.layout.fixedContrastRisks.slice(0, 10);
    })();

    // --- Missing data points expected by scoring modules ---
    data.structure.hasHorizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    // Find the widest element causing page-level overflow
    // Skip absolutely/fixed positioned elements inside overflow:hidden containers
    // — they extend beyond the viewport visually but are clipped, not scrollable
    if (data.structure.hasHorizontalOverflow) {
      var _pageOverflowCulprits = [];
      var _docW = document.documentElement.clientWidth;
      function _isClippedByParent(el) {
        var s = getComputedStyle(el);
        if (s.position !== 'absolute' && s.position !== 'fixed') return false;
        var p = el.offsetParent || el.parentElement;
        while (p && p !== document.documentElement) {
          var ps = getComputedStyle(p);
          if (ps.overflow === 'hidden' || ps.overflowX === 'hidden') return true;
          p = p.parentElement;
        }
        return false;
      }
      Array.from(allElements).slice(0, 1000).forEach(function(el) {
        if (!isVisible(el) || el === document.documentElement || el === document.body) return;
        if (_isClippedByParent(el)) return;
        var r = el.getBoundingClientRect();
        if (r.right > _docW + 5 || r.width > _docW + 5) {
          _pageOverflowCulprits.push({ selector: cssSelector(el), element: el.tagName.toLowerCase(), width: Math.round(r.width), right: Math.round(r.right), overflow: Math.round(r.right - _docW), bbox: null });
          if (_pageOverflowCulprits.length <= 10) trackBbox(el, _pageOverflowCulprits[_pageOverflowCulprits.length - 1], 'bbox');
        }
      });
      _pageOverflowCulprits.sort(function(a, b) { return b.overflow - a.overflow; });
      data.structure.overflowCulprits = _pageOverflowCulprits.slice(0, 10);
      // If all culprits were clipped, the overflow might be a false positive
      if (_pageOverflowCulprits.length === 0) data.structure.hasHorizontalOverflow = false;
    }

    // Border radii (for layout/consistency scoring) — track sample elements per value
    var radiusMap = {};
    var radiusSamples = {}; // value → [{selector, bbox}]
    Array.from(allElements).slice(0, 500).forEach(function(el) {
      if (!isVisible(el)) return;
      var br = getComputedStyle(el).borderRadius;
      if (br && br !== '0px') {
        radiusMap[br] = (radiusMap[br] || 0) + 1;
        if (!radiusSamples[br]) radiusSamples[br] = [];
        if (radiusSamples[br].length < 5) {
          var _rs = { selector: cssSelector(el), bbox: null };
          trackBbox(el, _rs, 'bbox');
          radiusSamples[br].push(_rs);
        }
      }
    });
    data.layout.borderRadii = Object.keys(radiusMap).map(function(k) {
      var samples = (radiusSamples[k] || []);
      return { value: k, count: radiusMap[k], bboxes: samples.map(function(s) { return s.bbox; }).filter(Boolean), selectors: samples.map(function(s) { return s.selector; }).filter(Boolean) };
    }).sort(function(a, b) { return b.count - a.count; }).slice(0, 15);

    // Horizontal scroll containers — refined classification
    var _iframeStructuralSel = 'nav,form,section,header,footer,article,aside,main,h1,h2,h3,h4,h5,h6';
    data.layout.horizontalScrollContainers = [];
    data.layout.nestedScrollbars = 0;
    var overflowEls = document.querySelectorAll('[style*="overflow"],[class*="overflow"]');
    overflowEls.forEach(function(oel) {
      // Virtual scrollers (Monaco, canvas-based editors/grids) report absurd
      // scrollWidth (millions of px) as an implementation trick — no real
      // layout spills that far. Skip them; genuine spills are a few thousand px.
      if (oel.scrollWidth - oel.clientWidth > 50000) return;
      if (oel.scrollWidth > oel.clientWidth + 2 && oel.clientWidth > 0) {
        var tag = oel.tagName.toLowerCase();
        var oelStyle = getComputedStyle(oel);
        // overflow:hidden clips content intentionally — it is not a scroll container.
        // scrollWidth > clientWidth on a clip-only element is expected and harmless.
        if (oelStyle.overflowX === 'hidden') return;
        var hasOverflowCSS = oelStyle.overflowX === 'auto' || oelStyle.overflowX === 'scroll' ||
          /overflow-x-(auto|scroll)/.test(oel.className || '');
        var isDataContent = !!_iframeDataContentTags[tag] || !!oel.closest('table,pre,code');
        var hasStructuralChildren = !isDataContent && oel.querySelector(_iframeStructuralSel);
        var isWideContainer = oel.clientWidth >= vpW * 0.8;

        var classification = 'bug';
        if (hasOverflowCSS && isDataContent && !hasStructuralChildren) {
          classification = 'intentional';
        } else if (hasOverflowCSS && !isDataContent && !hasStructuralChildren && !isWideContainer) {
          classification = 'intentional';
        }
        if (!hasOverflowCSS) classification = 'bug';
        if (isWideContainer && hasOverflowCSS && !isDataContent) classification = 'bug';

        // Find the widest child causing the overflow
        var _widestChild = null, _widestW = oel.clientWidth;
        Array.from(oel.children).forEach(function(ch) {
          var cr = ch.getBoundingClientRect();
          if (cr.width > _widestW) { _widestW = cr.width; _widestChild = ch; }
        });
        var _hscEntry = {
          selector: cssSelector(oel),
          intentional: classification === 'intentional',
          classification: classification,
          reason: !hasOverflowCSS ? 'no-overflow-css' :
                  hasStructuralChildren ? 'structural-children-in-scroll' :
                  isWideContainer ? 'wide-container-scrolls' :
                  isDataContent ? 'data-content' : 'unknown',
          scrollWidth: oel.scrollWidth,
          overflow: Math.round(oel.scrollWidth - oel.clientWidth),
          element: tag,
          bbox: null,
          culprit: _widestChild ? cssSelector(_widestChild) : null,
          culpritWidth: _widestChild ? Math.round(_widestW) : null
        };
        trackBbox(oel, _hscEntry, 'bbox');
        data.layout.horizontalScrollContainers.push(_hscEntry);
        // Nested scrollbar check
        var scrollParent = oel.parentElement;
        while (scrollParent && scrollParent !== document.body) {
          var ps = getComputedStyle(scrollParent);
          if (ps.overflowY === 'auto' || ps.overflowY === 'scroll') {
            data.layout.nestedScrollbars++;
            break;
          }
          scrollParent = scrollParent.parentElement;
        }
      }
    });

    // --- Silently clipped content: flex/grid containers where content overflows without scroll ---
    // These won't cause page-level scrollbar in Chromium but can on iOS Safari
    data.layout.clippedOverflow = [];
    if (vpW < 768) {
      document.querySelectorAll('div,section,nav,footer,header').forEach(function(el) {
        if (!isVisible(el)) return;
        if (el.scrollWidth <= el.clientWidth + 4 || el.clientWidth < 50) return;
        var s = getComputedStyle(el);
        // Only check flex/grid rows (not block elements which wrap naturally)
        var isFlex = s.display === 'flex' || s.display === 'inline-flex';
        var isGrid = s.display === 'grid' || s.display === 'inline-grid';
        if (!isFlex && !isGrid) return;
        // Skip if already has overflow handling
        if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') return;
        // Skip if flex-wrap is enabled (content wraps instead of overflowing)
        if (isFlex && s.flexWrap !== 'nowrap') return;
        var overflowPx = el.scrollWidth - el.clientWidth;
        if (overflowPx > 8) {
          data.layout.clippedOverflow.push({
            selector: cssSelector(el),
            overflow: overflowPx,
            containerWidth: el.clientWidth,
            contentWidth: el.scrollWidth,
            vpWidth: vpW,
            display: s.display
          });
        }
      });
      data.layout.clippedOverflow = data.layout.clippedOverflow.slice(0, 10);
    }

    // Hidden panel detection — find all invisible interactive panels
    // _iframeHiddenPanels: raw element list (kept for existing issues-loop below)
    // _iframeHiddenPanelMeta: parallel array with {kind, label, triggerEl} per panel
    data.layout.hiddenPanelIssues = [];
    var _iframeHiddenPanels = [];
    var _iframeHiddenPanelMeta = [];
    function _hpAddPanel(el, kind, triggerEl) {
      if (_iframeHiddenPanels.indexOf(el) !== -1) return;
      _iframeHiddenPanels.push(el);
      // Build a human label: summary text for details, trigger text for aria, else id/class
      var label = '';
      try {
        if (kind === 'details') {
          var sumEl = el.querySelector('summary');
          label = sumEl ? (sumEl.textContent || '').trim() : '';
        } else if ((kind === 'aria-expanded' || kind === 'aria-controls') && triggerEl) {
          label = (triggerEl.getAttribute('aria-label') || triggerEl.textContent || '').trim();
        }
        if (!label) {
          label = el.id ? '#' + el.id : (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase());
        }
        if (label.length > 40) label = label.slice(0, 40);
      } catch (_le) { label = el.tagName ? el.tagName.toLowerCase() : 'panel'; }
      _iframeHiddenPanelMeta.push({ kind: kind, label: label, triggerEl: triggerEl || null });
    }
    document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"], [role="tooltip"], [role="alertdialog"]').forEach(function(el) {
      if (!isVisible(el)) _hpAddPanel(el, 'aria-role', null);
    });
    var _iframeInlineRoles = { region: 1, tabpanel: 1, tab: 1 };
    document.querySelectorAll('[aria-controls]').forEach(function(trigger) {
      var targetId = trigger.getAttribute('aria-controls');
      if (targetId) {
        var target = document.getElementById(targetId);
        if (target && !isVisible(target)) {
          var targetRole = (target.getAttribute('role') || '').toLowerCase();
          if (!_iframeInlineRoles[targetRole]) _hpAddPanel(target, 'aria-controls', trigger);
        }
      }
    });
    document.querySelectorAll('[aria-haspopup="true"], [aria-haspopup="menu"], [aria-haspopup="dialog"], [aria-haspopup="listbox"]').forEach(function(trigger) {
      var ctrlId = trigger.getAttribute('aria-controls');
      if (ctrlId) {
        var t = document.getElementById(ctrlId);
        if (t && !isVisible(t)) _hpAddPanel(t, 'aria-controls', trigger);
        return;
      }
      var wrapper = trigger.parentElement;
      if (!wrapper) return;
      wrapper.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]').forEach(function(c) {
        if (!isVisible(c)) _hpAddPanel(c, 'aria-controls', trigger);
      });
    });
    // Comprehensive hidden-panel detection: closed <details>, [hidden], aria-expanded=false targets,
    // and Tailwind-collapsed containers (max-h-0 + overflow-hidden, .hidden class).
    // Closed <details>: the <details> element itself is the "panel" container.
    document.querySelectorAll('details:not([open])').forEach(function(el) {
      _hpAddPanel(el, 'details', null);
    });
    // Elements with [hidden] attribute (not already caught above)
    document.querySelectorAll('[hidden]').forEach(function(el) {
      _hpAddPanel(el, 'hidden-attr', null);
    });
    // aria-expanded=false targets via aria-controls
    document.querySelectorAll('[aria-expanded="false"][aria-controls]').forEach(function(trigger) {
      var tid = trigger.getAttribute('aria-controls');
      if (!tid) return;
      var tgt = document.getElementById(tid);
      if (tgt) _hpAddPanel(tgt, 'aria-expanded', trigger);
    });
    // Tailwind-collapsed: max-h-0 + overflow-hidden with clientHeight === 0,
    // or elements with literal class "hidden" (Tailwind utility).
    // Note: overflow-hidden-only (carousels) is handled by region pipeline — skip those here.
    document.querySelectorAll('[class]').forEach(function(el) {
      if (_iframeHiddenPanels.indexOf(el) !== -1) return;
      // Decorative elements (aria-hidden) are never interactive panels — skip them
      if (el.getAttribute('aria-hidden') === 'true') return;
      // Table cells are structural layout elements, not interactive panels (e.g. hidden sm:table-cell)
      if (el.tagName === 'TH' || el.tagName === 'TD') return;
      var cls = typeof el.className === 'string' ? el.className : '';
      var isTwHidden = /\bhidden\b/.test(cls);
      var isTwCollapsed = /\bmax-h-0\b/.test(cls) && el.clientHeight === 0;
      if (isTwHidden || isTwCollapsed) {
        try {
          var _elS = getComputedStyle(el);
          if (_elS.overflow === 'hidden' && el.clientHeight === 0) {
            _hpAddPanel(el, 'collapsed', null);
          } else if (isTwHidden && (_elS.display === 'none' || el.clientHeight === 0)) {
            _hpAddPanel(el, 'collapsed', null);
          }
        } catch (e) {}
      }
    });
    data.layout.hiddenPanelCount = _iframeHiddenPanels.length;
    // Stash element references for the region pipeline (runs later in the same iframe window)
    window.__milgHiddenPanels = _iframeHiddenPanels.map(function(el, i) {
      var m = _iframeHiddenPanelMeta[i] || { kind: 'unknown', label: '', triggerEl: null };
      return { el: el, kind: m.kind, label: m.label, triggerEl: m.triggerEl };
    });
    _iframeHiddenPanels.slice(0, 15).forEach(function(panel) {
      var origCssText = panel.style.cssText;
      var origAriaHidden = panel.getAttribute('aria-hidden');
      var origHidden = panel.hasAttribute('hidden');
      var isDetailsEl = panel.tagName && panel.tagName.toLowerCase() === 'details';
      var origDetailsOpen = isDetailsEl ? panel.open : false;
      if (isDetailsEl) {
        panel.open = true;
      } else {
        panel.style.cssText = origCssText + '; display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: none !important;';
        if (origHidden) panel.removeAttribute('hidden');
        if (origAriaHidden) panel.setAttribute('aria-hidden', 'false');
      }
      void panel.offsetHeight;
      var pr = panel.getBoundingClientRect();
      var issues = [];
      if (pr.width > 0 && pr.height > 0) {
        if (pr.right > vpW + 2) issues.push({ type: 'right-overflow', overflow: Math.round(pr.right - vpW) });
        if (pr.left < -2) issues.push({ type: 'left-overflow', overflow: Math.round(Math.abs(pr.left)) });
        if (pr.bottom > window.innerHeight * 2) issues.push({ type: 'extreme-bottom', bottom: Math.round(pr.bottom) });
        if (panel.scrollWidth > panel.clientWidth + 2) issues.push({ type: 'internal-overflow', overflow: Math.round(panel.scrollWidth - panel.clientWidth) });
      }
      if (isDetailsEl) {
        panel.open = origDetailsOpen;
      } else {
        panel.style.cssText = origCssText;
        if (origHidden) panel.setAttribute('hidden', '');
        if (origAriaHidden) panel.setAttribute('aria-hidden', origAriaHidden);
        else if (panel.hasAttribute('aria-hidden')) panel.removeAttribute('aria-hidden');
      }
      if (issues.length > 0) {
        var _hpEntry = {
          selector: cssSelector(panel),
          role: panel.getAttribute('role') || 'unknown',
          width: Math.round(pr.width),
          height: Math.round(pr.height),
          left: Math.round(pr.left),
          right: Math.round(pr.right),
          vpWidth: vpW,
          issues: issues,
          bbox: null
        };
        trackBbox(panel, _hpEntry, 'bbox');
        data.layout.hiddenPanelIssues.push(_hpEntry);
      }
    });

    // DOM statistics
    var _iframeTagCounts = {};
    var _iframeDisplayNone = 0;
    var _iframeAriaHidden = 0;
    Array.from(allElements).forEach(function(el) {
      var t = el.tagName.toLowerCase();
      _iframeTagCounts[t] = (_iframeTagCounts[t] || 0) + 1;
      if (t === 'script' || t === 'style' || t === 'link') return;
      if (getComputedStyle(el).display === 'none') _iframeDisplayNone++;
      if (el.getAttribute('aria-hidden') === 'true') _iframeAriaHidden++;
    });
    var _iframeSemTags = ['nav','header','footer','main','article','section','aside','figure','figcaption','details','summary','dialog','ul','ol','li','table','form','fieldset','label'];
    var _iframeSemCount = 0;
    _iframeSemTags.forEach(function(t) { _iframeSemCount += (_iframeTagCounts[t] || 0); });
    data.structure.domStats = {
      divCount: _iframeTagCounts['div'] || 0,
      spanCount: _iframeTagCounts['span'] || 0,
      semanticCount: _iframeSemCount,
      displayNoneCount: _iframeDisplayNone,
      ariaHiddenCount: _iframeAriaHidden,
      divRatio: allElements.length > 0 ? Math.round((_iframeTagCounts['div'] || 0) / allElements.length * 100) : 0,
      topTags: Object.keys(_iframeTagCounts).filter(function(t) { return t !== 'script' && t !== 'style' && t !== 'link'; }).sort(function(a, b) { return _iframeTagCounts[b] - _iframeTagCounts[a]; }).slice(0, 5).map(function(t) { return { tag: t, count: _iframeTagCounts[t] }; })
    };

    // Fixed-width and truncated elements
    data.structure.fixedWidthElements = 0;
    document.querySelectorAll('[style*="width"]').forEach(function(el) {
      if (!isVisible(el)) return;
      var w = el.style.width;
      if (w && /^\d+(px)?$/.test(w) && parseFloat(w) > 300) {
        var parentW = el.parentElement ? el.parentElement.getBoundingClientRect().width : vpW;
        if (parseFloat(w) > parentW * 0.8) data.structure.fixedWidthElements++;
      }
    });
    data.structure.truncatedElements = 0;
    document.querySelectorAll('[class*="truncate"],[class*="ellipsis"],[style*="text-overflow"]').forEach(function(tel) {
      if (!isVisible(tel)) return;
      if (tel.scrollWidth > tel.clientWidth + 2) data.structure.truncatedElements++;
    });

    // Export bbox tracking for screenshot pipeline to re-read after scroll-reset
    window.__milgBboxRefs = _bboxRefs;
    window.__milgData = data;
    window.__milgGetFlowPosition = function(el) {
      var r = el.getBoundingClientRect();
      var top = r.top, left = r.left;
      var node = el;
      while (node && node !== document.documentElement) {
        var transform = getComputedStyle(node).transform;
        if (transform && transform !== 'none') {
          var m = transform.match(/matrix\(([^)]+)\)/);
          if (m) {
            var parts = m[1].split(',');
            if (parts.length >= 6) {
              left -= parseFloat(parts[4]) || 0;
              top -= parseFloat(parts[5]) || 0;
            }
          }
        }
        node = node.parentElement;
      }
      return { left: Math.round(left), top: Math.round(top), width: Math.round(r.width), height: Math.round(r.height) };
    };
    window.__milgReReadBboxes = function() {
      var updated = 0;
      _bboxRefs.forEach(function(ref) {
        if (!ref.el || !ref.obj) return;
        try {
          var oldBbox = ref.obj[ref.key];
          ref.obj[ref.key] = window.__milgGetFlowPosition(ref.el);
          updated++;
        } catch(e) {}
      });
      // Propagate re-read bboxes to exported fontSizes entries
      (data.typography.fontSizes || []).forEach(function(entry) {
        if (entry._sampleRef) {
          entry.bbox = entry._sampleRef.bbox;
          if (entry._sampleRef.extraBboxes) {
            entry.extraBboxes = entry._sampleRef.extraBboxes.map(function(eb) { return eb.bbox; }).filter(Boolean);
            entry.extraSelectors = entry._sampleRef.extraBboxes.map(function(eb) { return eb.selector; }).filter(Boolean);
          }
        }
      });
      return updated + '/' + _bboxRefs.length;
    };

    // Attach sandbox log if present (JS-enabled mode intercepts)
    data._sandboxLog = window.__milgSandboxLog || [];

    // Store data globally for snippet access
    window.__milgData = data;

    // Output: callback (snippet mode) or postMessage (iframe mode)
    if (typeof window.__milgOnExtractComplete === 'function') {
      window.__milgOnExtractComplete(data);
    } else {
      parent.postMessage({ type: 'milg-analyzer-result', data: data, _iframeId: window.__milgIframeId || '' }, '*');
    }
    // Screenshot capture: triggered by parent via milg-start-capture message
    // Legacy fallback for old screenshot script that uses __milgDoScreenshots
    if (typeof window.__milgDoScreenshots === 'function') {
      setTimeout(window.__milgDoScreenshots, 300);
    }
  }

  return extractFromDocument;
})();
