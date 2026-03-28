// make-it-look-good — Design Analyzer (UI + Extraction)
// Depends on: analyzer-scoring.js (MilgScoring), analyzer-report.js (MilgReport)

(function() {
  "use strict";

  // --- Configuration ---
  // Self-hosted CORS proxy (Cloudflare Worker).
  // The placeholder __PROXY_ENCODED__ is replaced at deploy time by GitHub Actions
  // with a base64-encoded URL (kept out of git via repository secrets).
  // Fork users: deploy your own worker (see proxy/README.md) and set the
  // PROXY_URL secret in your repo's Settings > Secrets > Actions.
  var _pe = 'aHR0cHM6Ly9taWxnLWNvcnMtcHJveHkuamRld29ya3Mud29ya2Vycy5kZXY=';
  var CORS_PROXY_URL = (_pe.indexOf('__') === 0) ? '' : (function() {
    try { return atob(_pe); } catch(e) { return ''; }
  })();

  // Screenshot library (loaded inside iframes via script tag)
  var SCREENSHOT_CDN = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js';

  // --- State ---
  var reportData = null;
  var darkMode = localStorage.getItem('milg-dark') === 'true';

  // --- Snippet for iframe extraction (same-origin, used for "Analyze preview" and paste-HTML) ---
  function getIframeExtractionScript() {
    // Load the snippet source and adapt for iframe postMessage
    return '(' + extractFromDocument.toString() + ')()';
  }

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
    function getGradientBg(el) {
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
      // Sample center pixel from composited result
      var d = _gx.getImageData(50, 50, 1, 1).data;
      if (d[3] === 0) return null;
      return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 };
    }
    function getEffectiveBg(el) {
      var node = el, layers = [];
      while (node && node !== document.documentElement) {
        var bg = getComputedStyle(node).backgroundColor;
        var c = parseColor(bg);
        if (!c || c.a === 0) c = getGradientBg(node);
        if (c && c.a > 0) layers.push(c);
        if (c && c.a >= 1) break;
        node = node.parentElement;
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
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }
    function cssSelector(el) {
      if (el.id) return '#' + el.id;
      var tag = el.tagName.toLowerCase();
      var cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      return tag + cls;
    }

    var data = {
      meta: { title: document.title, url: location.href, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, timestamp: new Date().toISOString(), version: 1 },
      colors: { textColors: [], bgColors: [], contrastPairs: [] },
      typography: { bodyFontSize: '', bodyLineHeight: '', bodyFontFamily: '', fontFamilies: [], fontSizes: [], fontWeights: [], headings: [], lineHeights: [], maxLineLength: { chars: 0, element: '' } },
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
    data.structure.darkModeClasses = /class="[^"]*dark:/.test(htmlStr) || document.body.classList.contains('dark-ui') || document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark') || Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r.cssText && r.cssText.indexOf('prefers-color-scheme') !== -1; }); } catch(e) { return false; } });
    data.structure.responsiveClasses = /class="[^"]*(?:sm:|md:|lg:|xl:)/.test(htmlStr) || Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r instanceof CSSMediaRule && /max-width|min-width/.test(r.conditionText || ''); }); } catch(e) { return false; } });

    // Decorative element detection
    var decorativeEls = new Set();
    var defaultExclude = '[aria-hidden="true"], [role="img"], [role="presentation"], [data-decorative]';
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
    var maxContentW = 0;
    var contrastPairs = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var node, seenForContrast = new Set();

    while (node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      var el = node.parentElement;
      if (!el || !isVisible(el) || isDecorative(el)) continue;
      if (seenForContrast.has(el)) continue;
      seenForContrast.add(el);
      var style = getComputedStyle(el);
      var fg = parseColor(style.color);
      if (!fg) continue;
      var fgBlended = blendOnWhite(fg);
      var bg = getEffectiveBg(el);
      var ratio = contrastRatio(fgBlended, bg);
      var fontSize = parseFloat(style.fontSize);
      var fontWeight = parseInt(style.fontWeight) || 400;
      var isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      var threshold = isLarge ? 3 : 4.5;
      var filterAncestor = el;
      var filterValue = '';
      while (filterAncestor && filterAncestor !== document.documentElement) {
        var f = getComputedStyle(filterAncestor).filter;
        if (f && f !== 'none') { filterValue = f; break; }
        filterAncestor = filterAncestor.parentElement;
      }
      if (ratio < 7.5) {
        contrastPairs.push({ fg: rgbStr(fgBlended), bg: rgbStr(bg), ratio: Math.round(ratio * 100) / 100, needed: threshold, passes: ratio >= threshold, fontSize: Math.round(fontSize), fontWeight: fontWeight, isLarge: isLarge, text: node.textContent.trim().substring(0, 50), selector: cssSelector(el), filter: filterValue });
      }
      var elWidth = el.getBoundingClientRect().width;
      var charWidth = fontSize * 0.5;
      var charsPerLine = Math.round(elWidth / charWidth);
      if (charsPerLine > data.typography.maxLineLength.chars && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.closest('pre') && !el.closest('code')) {
        data.typography.maxLineLength = { chars: charsPerLine, element: cssSelector(el) };
      }
    }
    contrastPairs.sort(function(a, b) { return a.ratio - b.ratio; });
    data.colors.contrastPairs = contrastPairs.slice(0, 50);

    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
      if (!isVisible(el)) continue;
      var s = getComputedStyle(el);
      fontSizeMap[s.fontSize] = (fontSizeMap[s.fontSize] || 0) + 1;
      fontWeightMap[s.fontWeight] = (fontWeightMap[s.fontWeight] || 0) + 1;
      fontFamilySet.add(s.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
      var lh = s.lineHeight;
      if (lh !== 'normal') { var lhR = parseFloat(lh) / parseFloat(s.fontSize); lineHeightMap[Math.round(lhR * 100) / 100] = (lineHeightMap[Math.round(lhR * 100) / 100] || 0) + 1; }
      if (s.color) textColorMap[s.color] = (textColorMap[s.color] || 0) + 1;
      var bgColor = s.backgroundColor;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') bgColorMap[bgColor] = (bgColorMap[bgColor] || 0) + 1;
      [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].filter(function(v) { return v !== '0px'; }).forEach(function(v) { paddingMap[v] = (paddingMap[v] || 0) + 1; });
      [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft].filter(function(v) { return v !== '0px' && v !== 'auto'; }).forEach(function(v) { marginMap[v] = (marginMap[v] || 0) + 1; });
      if (s.gap && s.gap !== 'normal' && s.gap !== '0px') gapMap[s.gap] = (gapMap[s.gap] || 0) + 1;
      var w = el.getBoundingClientRect().width;
      if (w > maxContentW && w < window.innerWidth * 0.95) maxContentW = w;
    }
    function mapToSorted(map) { return Object.keys(map).map(function(k) { return { value: k, count: map[k] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 30); }
    data.typography.fontSizes = mapToSorted(fontSizeMap);
    data.typography.fontWeights = mapToSorted(fontWeightMap);
    data.typography.fontFamilies = Array.from(fontFamilySet).slice(0, 10);
    data.typography.lineHeights = mapToSorted(lineHeightMap);
    data.colors.textColors = mapToSorted(textColorMap);
    data.colors.bgColors = mapToSorted(bgColorMap);
    data.spacing.paddings = mapToSorted(paddingMap);
    data.spacing.margins = mapToSorted(marginMap);
    data.spacing.gaps = mapToSorted(gapMap);
    data.spacing.maxContentWidth = Math.round(maxContentW) + 'px';

    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h) {
      var hs = getComputedStyle(h);
      data.typography.headings.push({ tag: h.tagName.toLowerCase(), text: h.textContent.trim().substring(0, 60), fontSize: hs.fontSize, fontWeight: hs.fontWeight, lineHeight: hs.lineHeight, fontFamily: hs.fontFamily.split(',')[0].trim().replace(/['"]/g, '') });
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
    Array.from(alignTargets).forEach(function(el) {
      if (!isVisible(el) || isDecorative(el)) return;
      var r = el.getBoundingClientRect();
      if (r.width > 50) leftEdges.push(Math.round(r.left));
    });
    data.layout.alignmentEdges = leftEdges;

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
      if (!isVisible(el) || isDecorative(el)) return;
      var rect = el.getBoundingClientRect();
      var w = Math.round(rect.width), h = Math.round(rect.height);
      if (w < 44 || h < 44) {
        var linkCtx = 'button';
        if (el.tagName === 'A') {
          if (el.closest('nav')) linkCtx = 'nav';
          else if (el.closest('footer')) linkCtx = 'footer';
          else if (el.closest('p, blockquote, figcaption, td, th, dd')) linkCtx = 'inline';
          else { var ls = getComputedStyle(el); if ((ls.backgroundColor !== 'rgba(0, 0, 0, 0)' && ls.backgroundColor !== 'transparent') || (ls.borderStyle !== 'none' && ls.borderWidth !== '0px') || parseFloat(ls.paddingTop) > 4 || parseFloat(ls.paddingBottom) > 4) linkCtx = 'button'; else linkCtx = 'standalone'; }
        }
        touchIssues.push({ element: el.tagName.toLowerCase(), width: w, height: h, text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 40), selector: cssSelector(el), passes: false, isButton: el.tagName !== 'A' || linkCtx === 'button' || linkCtx === 'nav', linkContext: linkCtx });
      }
    });
    touchIssues.sort(function(a, b) { return (a.width * a.height) - (b.width * b.height); });
    data.interaction.touchTargets = touchIssues.slice(0, 40);

    var transitionSet = new Set();
    for (var i = 0; i < allElements.length && transitionSet.size < 20; i++) { var t = getComputedStyle(allElements[i]).transitionDuration; if (t && t !== '0s') transitionSet.add(t); }
    data.interaction.transitions = Array.from(transitionSet);

    data.accessibility.semanticElements = { header: document.querySelectorAll('header').length, nav: document.querySelectorAll('nav').length, main: document.querySelectorAll('main').length, footer: document.querySelectorAll('footer').length, section: document.querySelectorAll('section').length, article: document.querySelectorAll('article').length, aside: document.querySelectorAll('aside').length };
    var navEls = document.querySelectorAll('nav'); var navItemCount = 0;
    navEls.forEach(function(nav) { var topLinks = nav.querySelectorAll(':scope > a, :scope > ul > li > a, :scope > ol > li > a, :scope > button, :scope > ul > li > button'); navItemCount += topLinks.length; });
    data.accessibility.navItemCount = navItemCount;
    var noAlt = 0; document.querySelectorAll('img').forEach(function(img) { if (!img.hasAttribute('alt')) noAlt++; }); data.accessibility.imagesWithoutAlt = noAlt;
    var inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]),select,textarea');
    var labeled = 0;
    inputs.forEach(function(inp) { data.accessibility.formLabels.total++; if ((inp.id && document.querySelector('label[for="' + inp.id + '"]')) || inp.closest('label') || inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby')) labeled++; });
    data.accessibility.formLabels.withLabel = labeled;
    data.accessibility.formLabels.withoutLabel = data.accessibility.formLabels.total - labeled;
    Array.from(interactive).slice(0, 10).forEach(function(el) { if (!isVisible(el)) return; var s = getComputedStyle(el); data.accessibility.focusIndicators.push({ element: cssSelector(el), outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, outlineOffset: s.outlineOffset }); });
    data.accessibility.hasFocusVisibleCSS = Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r.selectorText && r.selectorText.indexOf('focus-visible') !== -1; }); } catch(e) { return false; } });
    // Font smoothing + bg image behind text (profile-specific)
    data.typography.fontSmoothingAntialiased = false;
    try { var bs = getComputedStyle(document.body).webkitFontSmoothing; if (bs === 'antialiased') data.typography.fontSmoothingAntialiased = true; } catch(e) {}
    data.accessibility.bgImageBehindText = 0;
    document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,span').forEach(function(el) { if (!isVisible(el)) return; var bgi = getComputedStyle(el).backgroundImage; if (bgi && bgi !== 'none' && bgi.indexOf('url(') !== -1 && el.textContent.trim().length > 10) data.accessibility.bgImageBehindText++; });

    parent.postMessage({ type: 'milg-analyzer-result', data: data }, '*');
    // Trigger screenshot capture if configured (function injected by parent)
    if (typeof window.__milgDoScreenshots === 'function') {
      setTimeout(window.__milgDoScreenshots, 200);
    }
  }

  // --- UI Logic ---
  function init() {
    applyDarkMode();

    var pasteInput = document.getElementById('pasteInput');
    var analyzeBtn = document.getElementById('analyzeBtn');
    var htmlInput = document.getElementById('htmlInput');
    var analyzeHtmlBtn = document.getElementById('analyzeHtmlBtn');
    var reportContainer = document.getElementById('reportContainer');
    var inputSection = document.getElementById('inputSection');
    var snippetCode = document.getElementById('snippetCode');
    var copySnippetBtn = document.getElementById('copySnippetBtn');
    var newAnalysisBtn = document.getElementById('newAnalysisBtn');
    var printBtn = document.getElementById('printBtn');

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // Load snippet for display
    loadSnippet(snippetCode);

    // Toggle snippet variant (with/without screenshots)
    var snippetScreenshotCheck = document.getElementById('snippetScreenshotCheck');
    if (snippetScreenshotCheck) {
      snippetScreenshotCheck.addEventListener('change', function() {
        loadSnippet(snippetCode, snippetScreenshotCheck.checked);
      });
    }

    // Copy snippet
    copySnippetBtn.addEventListener('click', function() {
      var text = snippetCode.textContent;
      navigator.clipboard.writeText(text).then(function() {
        showToast('Snippet copied to clipboard!');
      });
    });

    // Analyze JSON
    analyzeBtn.addEventListener('click', function() {
      var json = pasteInput.value.trim();
      if (!json) { showToast('Paste the extracted JSON data first'); return; }
      try {
        var data = JSON.parse(json);
        if (!data.meta || !data.colors) throw new Error('Invalid format');
        runAnalysis(data);
      } catch(e) {
        showToast('Invalid JSON: ' + e.message);
      }
    });

    // Analyze pasted HTML
    analyzeHtmlBtn.addEventListener('click', function() {
      var html = htmlInput.value.trim();
      if (!html) { showToast('Paste HTML source code first'); return; }
      analyzeHtmlBtn.textContent = 'Analyzing...';
      analyzeHtmlBtn.disabled = true;
      var wantScreenshots = document.getElementById('htmlScreenshotCheck') && document.getElementById('htmlScreenshotCheck').checked;
      analyzeHtmlInIframe(html, function(data) {
        analyzeHtmlBtn.textContent = 'Analyze HTML';
        analyzeHtmlBtn.disabled = false;
        runAnalysis(data);
      }, null, null, wantScreenshots);
    });

    // Analyze URL
    var analyzeUrlBtn = document.getElementById('analyzeUrlBtn');
    var urlInput = document.getElementById('urlInput');
    var urlStatus = document.getElementById('urlStatus');

    analyzeUrlBtn.addEventListener('click', function() {
      var url = (urlInput.value || '').trim();
      if (!url) { showToast('Enter a URL first'); return; }
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

      analyzeUrlBtn.disabled = true;
      analyzeUrlBtn.textContent = 'Fetching...';
      urlStatus.style.display = 'block';
      urlStatus.textContent = 'Fetching page via CORS proxy...';
      showProgress(5, 'Fetching page...');

      fetchViaProxy(url, function(html, err) {
        if (err || !html) {
          analyzeUrlBtn.disabled = false;
          analyzeUrlBtn.textContent = 'Analyze URL';
          urlStatus.innerHTML = '<span style="color:#dc2626">Could not fetch: ' + (err || 'empty response') + '</span><br><span style="font-size:12px">Try the Console Snippet tab for pages behind login, localhost, or sites that block proxies.</span>';
          hideProgress();
          return;
        }
        urlStatus.textContent = 'Rendering and analyzing...';
        showProgress(20, 'Rendering page...');
        var exclude = window.__milgCombinedExclude || (document.getElementById('excludeSelector').value || '').trim();
        var isDeepScan = document.getElementById('deepScanCheck') && document.getElementById('deepScanCheck').checked;
        if (isDeepScan) {
          // Build viewport list: current + presets, skip duplicates
          var curW = window.innerWidth, curH = window.innerHeight;
          var presets = [{w:1280,h:900,label:'Desktop'},{w:768,h:1024,label:'Tablet'},{w:375,h:812,label:'Phone'}];
          var viewports = [{w:curW,h:curH,label:'Current (' + curW + '×' + curH + ')'}];
          presets.forEach(function(p) {
            // Skip if current window is within 50px of a preset
            if (Math.abs(curW - p.w) < 50 && Math.abs(curH - p.h) < 50) return;
            viewports.push(p);
          });
          var deepResults = [];
          var deepRawResults = []; // Store full data per viewport for switching
          var vpIdx = 0;
          var totalSteps = viewports.length + 1; // +1 for dark mode test
          (function nextVP() {
            if (vpIdx >= viewports.length) {
              // Find primary: use current viewport (index 0)
              var primary = deepRawResults[0];
              for (var pi = 0; pi < deepRawResults.length && !primary; pi++) primary = deepRawResults[pi];
              if (!primary) {
                analyzeUrlBtn.disabled = false;
                analyzeUrlBtn.textContent = 'Analyze URL';
                urlStatus.innerHTML = '<span style="color:#dc2626">Deep scan failed — no viewport returned data.</span>';
                hideProgress();
                return;
              }
              primary.deepScan = {
                viewports: deepRawResults.map(function(r, i) {
                  return r ? {
                    label: viewports[i].label, width: viewports[i].w,
                    touchTargets: (r.interaction.touchTargets || []).length,
                    contrastFails: (r.colors.contrastPairs || []).filter(function(p) { return !p.passes; }).length,
                    overflow: r.structure.hasHorizontalOverflow || false
                  } : { label: viewports[i].label, width: viewports[i].w, error: true };
                }),
                viewportData: deepRawResults.map(function(r, i) {
                  return r ? { label: viewports[i].label, width: viewports[i].w, data: r } : null;
                }).filter(Boolean)
              };
              // Dark mode test
              var htmlHasDark = /class="[^"]*dark:/.test(html) || /prefers-color-scheme/.test(html) || /\.dark\s*\{/.test(html) || /data-theme/.test(html);
              if (htmlHasDark) {
                urlStatus.textContent = 'Testing dark mode...';
                showProgress(Math.round(80 + 15 * (vpIdx / totalSteps)), 'Testing dark mode...');
                var darkHtml = html.replace(/<html([^>]*)>/i, '<html$1 class="dark" data-theme="dark" style="color-scheme:dark">');
                darkHtml = darkHtml.replace(/<\/head>/i, '<script>setTimeout(function(){try{Array.from(document.styleSheets).forEach(function(ss){try{var darkRules=[];Array.from(ss.cssRules).forEach(function(r){if(r instanceof CSSMediaRule&&/prefers-color-scheme:\\s*dark/.test(r.conditionText||"")){Array.from(r.cssRules).forEach(function(inner){darkRules.push(inner.cssText)})}});if(darkRules.length>0){var s=document.createElement("style");s.textContent=darkRules.join("\\n");document.head.appendChild(s)}}catch(e){}});}catch(e){}},100);</' + 'script></head>');
                deepScanInIframe(darkHtml, url, exclude, 1280, 900, function(darkData) {
                  if (darkData) {
                    primary.deepScan.darkMode = {
                      contrastFails: (darkData.colors.contrastPairs || []).filter(function(p) { return !p.passes; }).length,
                      contrastTotal: (darkData.colors.contrastPairs || []).length,
                      tested: true
                    };
                  }
                  analyzeUrlBtn.disabled = false;
                  analyzeUrlBtn.textContent = 'Analyze URL';
                  urlStatus.style.display = 'none';
                  showProgress(100, 'Done!');
                  setTimeout(hideProgress, 500);
                  primary.meta.url = url;
                  runAnalysis(primary);
                });
              } else {
                analyzeUrlBtn.disabled = false;
                analyzeUrlBtn.textContent = 'Analyze URL';
                urlStatus.style.display = 'none';
                showProgress(100, 'Done!');
                setTimeout(hideProgress, 500);
                primary.meta.url = url;
                runAnalysis(primary);
              }
              return;
            }
            var vp = viewports[vpIdx];
            var pct = 20 + Math.round(60 * (vpIdx / totalSteps));
            urlStatus.textContent = 'Deep scan: ' + vp.label + ' (' + vp.w + 'px)...';
            showProgress(pct, 'Scanning ' + vp.label + '...');
            deepScanInIframe(html, url, exclude, vp.w, vp.h, function(data) {
              deepRawResults.push(data);
              vpIdx++;
              nextVP();
            });
          })();
          return;
        }
        showProgress(40, 'Analyzing styles...');
        var wantShots = document.getElementById('screenshotCheck') && document.getElementById('screenshotCheck').checked;
        analyzeHtmlInIframe(html, function(data) {
          analyzeUrlBtn.disabled = false;
          analyzeUrlBtn.textContent = 'Analyze URL';
          urlStatus.style.display = 'none';
          showProgress(100, 'Done!');
          setTimeout(hideProgress, 500);
          data.meta.url = url;
          runAnalysis(data);
        }, url, exclude, wantShots);
      });
    });

    // Allow Enter key in URL input
    urlInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); analyzeUrlBtn.click(); }
    });

    // Deep scan checkbox — toggle viewport row visibility
    var deepScanCheck = document.getElementById('deepScanCheck');
    var viewportRow = document.getElementById('viewportRow');
    if (deepScanCheck && viewportRow) {
      deepScanCheck.addEventListener('change', function() {
        viewportRow.classList.toggle('hidden', deepScanCheck.checked);
      });
    }

    // Exclude preset tags — toggle on click, build selector
    document.querySelectorAll('.exclude-tag').forEach(function(tag) {
      tag.addEventListener('click', function() {
        tag.classList.toggle('active');
        syncExcludeSelector();
      });
    });

    function syncExcludeSelector() {
      var parts = [];
      document.querySelectorAll('.exclude-tag.active').forEach(function(tag) {
        parts.push(tag.dataset.selector);
      });
      var custom = (document.getElementById('excludeSelector').value || '').trim();
      if (custom) parts.push(custom);
      // Store combined selector for use by analyze handlers
      window.__milgCombinedExclude = parts.join(', ');
    }

    document.getElementById('excludeSelector').addEventListener('input', syncExcludeSelector);

    // Profile selector — re-score when changed
    document.getElementById('profileSelect').addEventListener('change', function() {
      if (lastRawData) runAnalysis(lastRawData);
    });

    // Profile info toggle
    document.getElementById('profileInfoBtn').addEventListener('click', function() {
      var el = document.getElementById('profileExplanation');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    });

    // New analysis
    newAnalysisBtn.addEventListener('click', function() {
      reportContainer.classList.remove('visible');
      reportContainer.innerHTML = '';
      inputSection.style.display = '';
      document.getElementById('reportActions').style.display = 'none'; document.getElementById('profileExplanation').style.display = 'none';
      pasteInput.value = '';
      htmlInput.value = '';
      urlInput.value = '';
      urlStatus.style.display = 'none';
      reportData = null;
      // Clear hash so refreshing doesn't reload old report
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    });

    // Markdown export (download)
    document.getElementById('markdownBtn').addEventListener('click', function() {
      if (!reportData) return;
      var md = MilgReport.renderMarkdown(reportData);
      var blob = new Blob([md], { type: 'text/markdown' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'design-report.md';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Markdown report downloaded');
    });

    // Copy markdown to clipboard
    document.getElementById('copyMdBtn').addEventListener('click', function() {
      if (!reportData) return;
      var md = MilgReport.renderMarkdown(reportData);
      navigator.clipboard.writeText(md).then(function() {
        showToast('Markdown copied to clipboard');
      }).catch(function() {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = md;
        ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Markdown copied to clipboard');
      });
    });

    // Print/PDF
    printBtn.addEventListener('click', function() {
      window.print();
    });

    // Export JSON — save analysis data for re-import or sharing
    document.getElementById('exportJsonBtn').addEventListener('click', function() {
      if (!lastRawData) return;
      var exportData = JSON.parse(JSON.stringify(lastRawData, function(k, v) { return k === 'viewportData' ? undefined : v; }));
      var json = JSON.stringify(exportData, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var siteName = (exportData.meta && exportData.meta.url) || 'analysis';
      a.download = 'milg-report-' + siteName.replace(/[^a-z0-9]/gi, '-').substring(0, 40) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Analysis JSON exported');
    });

    // Import JSON — load a previously exported analysis (report action bar + drop zone)
    var importFileInput = document.getElementById('importJsonFile');
    function handleImportFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var data = JSON.parse(reader.result);
          if (!data.meta || !data.colors) throw new Error('Invalid format');
          runAnalysis(data);
          showToast('Analysis imported: ' + (data.meta.url || 'unknown'));
        } catch(e) {
          showToast('Invalid JSON: ' + e.message);
        }
      };
      reader.readAsText(file);
    }

    // Drop zone (Import tab)
    var dropzone = document.getElementById('importDropzone');
    var dropFileInput = document.getElementById('importDropFile');
    if (dropzone) {
      dropzone.addEventListener('click', function() { dropFileInput.click(); });
      dropFileInput.addEventListener('change', function() { handleImportFile(dropFileInput.files[0]); dropFileInput.value = ''; });
      dropzone.addEventListener('dragover', function(e) { e.preventDefault(); dropzone.classList.add('dragover'); });
      dropzone.addEventListener('dragleave', function() { dropzone.classList.remove('dragover'); });
      dropzone.addEventListener('drop', function(e) { e.preventDefault(); dropzone.classList.remove('dragover'); if (e.dataTransfer.files.length > 0) handleImportFile(e.dataTransfer.files[0]); });
    }
    document.getElementById('importJsonBtn').addEventListener('click', function() {
      importFileInput.click();
    });
    importFileInput.addEventListener('change', function() {
      handleImportFile(importFileInput.files[0]);
      reader.readAsText(file);
      importFileInput.value = '';
    });

    // Dark mode toggle
    document.getElementById('darkBtn').addEventListener('click', function() {
      darkMode = !darkMode;
      localStorage.setItem('milg-dark', darkMode);
      applyDarkMode();
    });

    // Check for HTML from editor "Analyze preview" button — auto-analyze with screenshots
    if (location.hash === '#analyze-html') {
      try {
        var previewHtml = sessionStorage.getItem('milg-preview-html');
        if (previewHtml) {
          sessionStorage.removeItem('milg-preview-html');
          // Show loading state
          var inputSection = document.getElementById('inputSection');
          inputSection.innerHTML = '<div style="text-align:center;padding:64px 24px"><div class="analysis-progress" style="display:block;max-width:400px;margin:0 auto"><div class="analysis-progress-bar"><div class="analysis-progress-fill" style="width:30%;animation:pulse 1.5s ease infinite"></div></div><div class="analysis-progress-label" style="margin-top:12px;font-size:14px">Analyzing editor preview...</div></div></div>';
          analyzeHtmlInIframe(previewHtml, function(data) {
            data.meta.url = 'Editor Preview';
            runAnalysis(data);
          }, null, null, true);
        }
      } catch(e) {
        console.error('Failed to analyze preview HTML:', e);
      }
    } else if (location.hash === '#preview') {
      try {
        var previewJson = sessionStorage.getItem('milg-preview-data');
        if (previewJson) {
          sessionStorage.removeItem('milg-preview-data');
          var data = JSON.parse(previewJson);
          data.meta.url = 'Editor Preview';
          runAnalysis(data);
        }
      } catch(e) {
        console.error('Failed to load preview data:', e);
      }
    } else if (location.hash.startsWith('#data=')) {
      try {
        var compressed = location.hash.substring(6);
        var json = decodeURIComponent(atob(compressed));
        var data = JSON.parse(json);
        runAnalysis(data);
      } catch(e) {
        console.error('Failed to load data from hash:', e);
      }
    }

    // Listen for postMessage from editor
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'milg-analyze-data') {
        runAnalysis(e.data.data);
      }
    });

    // Render analysis history (replaces old "resume previous" banner)
    var historyHtml = renderHistoryList();
    if (historyHtml) {
      var historyContainer = document.createElement('div');
      historyContainer.innerHTML = historyHtml;
      document.getElementById('inputSection').appendChild(historyContainer);
    }

    // Populate URL datalist from history for autocomplete
    var urlDatalist = document.getElementById('urlHistory');
    if (urlDatalist) {
      var history = getHistory();
      var seenUrls = {};
      history.forEach(function(entry) {
        var url = entry.url || '';
        if (url && url !== 'Editor Preview' && url !== 'Pasted HTML' && !seenUrls[url]) {
          seenUrls[url] = true;
          var opt = document.createElement('option');
          opt.value = url;
          urlDatalist.appendChild(opt);
        }
      });
    }
  }

  var lastRawData = null; // Store raw data for re-scoring with different profiles

  function getSelectedViewport() {
    var sel = document.getElementById('viewportSelect');
    if (!sel) return { w: 1280, h: 900 };
    var val = sel.value;
    if (val === 'current') return { w: window.innerWidth, h: window.innerHeight };
    var parts = val.split('x');
    return { w: parseInt(parts[0]) || 1280, h: parseInt(parts[1]) || 900 };
  }

  function detectExclusionPatterns(data) {
    // Analyze extracted data for patterns that suggest decorative/non-functional elements
    var patterns = [];
    var pairs = data.colors.contrastPairs || [];

    // Pattern: clusters of 1:1 contrast (unparseable backgrounds)
    var uncertainCount = pairs.filter(function(p) { return p.ratio <= 1.01 && p.fg === p.bg; }).length;
    if (uncertainCount >= 3) {
      patterns.push({ label: 'Undetermined backgrounds (' + uncertainCount + ' elements)', selector: '', type: 'uncertain', count: uncertainCount });
    }

    // Pattern: elements with mock/demo/preview in class names
    var contrastSelectors = pairs.map(function(p) { return p.selector || ''; });
    var touchSelectors = (data.interaction.touchTargets || []).map(function(t) { return t.selector || ''; });
    var allSelectors = contrastSelectors.concat(touchSelectors);
    var mockCount = allSelectors.filter(function(s) { return /mock|demo|preview|screenshot/i.test(s); }).length;
    if (mockCount >= 2) {
      patterns.push({ label: 'Mock/demo UI (' + mockCount + ' elements)', selector: "[class*='mock'], .demo, .preview, .screenshot", type: 'mock', count: mockCount });
    }

    // Pattern: footer links flagged for touch targets
    var footerTargets = (data.interaction.touchTargets || []).filter(function(t) { return /footer/i.test(t.selector || ''); }).length;
    if (footerTargets >= 3) {
      patterns.push({ label: 'Footer links (' + footerTargets + ' touch targets)', selector: 'footer', type: 'footer', count: footerTargets });
    }

    return patterns;
  }

  function renderExclusionSuggestions(patterns) {
    if (patterns.length === 0) return '';
    var html = '<div class="exclusion-suggestions" id="exclusionSuggestions">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<strong style="font-size:13px">Detected patterns you might want to exclude:</strong>';
    html += '<button onclick="document.getElementById(\'exclusionSuggestions\').style.display=\'none\'" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:16px">&times;</button>';
    html += '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
    patterns.forEach(function(p) {
      html += '<button type="button" class="exclude-tag" data-selector="' + p.selector.replace(/"/g, '&quot;') + '" data-type="' + p.type + '" onclick="window.__milgToggleExclude(this)">' + p.label + '</button>';
    });
    html += '</div>';
    html += '<button class="btn btn-primary" style="font-size:12px;padding:6px 14px;min-height:36px" onclick="window.__milgRerunWithExcludes()">Re-score with exclusions</button>';
    html += '</div>';
    return html;
  }

  // Global handlers for exclusion suggestion buttons
  window.__milgToggleExclude = function(btn) { btn.classList.toggle('active'); };
  window.__milgRerunWithExcludes = function() {
    if (!lastRawData) return;
    var active = document.querySelectorAll('#exclusionSuggestions .exclude-tag.active');
    var selectors = [];
    active.forEach(function(btn) { if (btn.dataset.selector) selectors.push(btn.dataset.selector); });
    if (selectors.length === 0) { showToast('Select patterns to exclude first'); return; }
    // Store exclude selector and re-run via iframe if URL mode, or re-score if snippet
    // For now, mark matched contrast pairs as excluded and re-score
    var exclude = selectors.join(', ');
    // Re-filter contrast pairs by checking selectors
    // Clone data for re-scoring — break circular refs from deepScan.viewportData
    var filtered = JSON.parse(JSON.stringify(lastRawData, function(key, val) {
      if (key === 'viewportData') return undefined; // skip circular viewport refs
      return val;
    }));
    // Restore viewportData reference (not cloned, just re-attached)
    if (lastRawData.deepScan && lastRawData.deepScan.viewportData) {
      if (!filtered.deepScan) filtered.deepScan = {};
      filtered.deepScan.viewportData = lastRawData.deepScan.viewportData;
    }
    filtered.colors.contrastPairs = filtered.colors.contrastPairs.filter(function(p) {
      // Remove pairs matching excluded types
      var sel = p.selector || '';
      for (var i = 0; i < active.length; i++) {
        var type = active[i].dataset.type;
        if (type === 'uncertain' && p.ratio <= 1.01 && p.fg === p.bg) return false;
        if (type === 'mock' && /mock|demo|preview|screenshot/i.test(sel)) return false;
        if (type === 'footer' && /footer/i.test(sel)) return false;
      }
      return true;
    });
    filtered.interaction.touchTargets = filtered.interaction.touchTargets.filter(function(t) {
      var sel = t.selector || '';
      for (var i = 0; i < active.length; i++) {
        var type = active[i].dataset.type;
        if (type === 'mock' && /mock|demo|preview|screenshot/i.test(sel)) return false;
        if (type === 'footer' && /footer/i.test(sel)) return false;
      }
      return true;
    });
    runAnalysis(filtered, true);
    showToast('Re-scored with ' + active.length + ' exclusion(s)');
  };

  // Screenshot zoom lightbox
  window.__milgZoomScreenshot = function(img) {
    var isMobile = window.innerWidth <= 640;
    var rect = img.getBoundingClientRect();
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0);z-index:9999;cursor:zoom-out;display:flex;align-items:center;justify-content:center;transition:background 200ms ease;overflow:auto;-webkit-overflow-scrolling:touch';

    var zoomed = document.createElement('img');
    zoomed.src = img.src;
    zoomed.alt = img.alt;

    if (isMobile) {
      // Mobile: no position animation (causes jank), just fade in and allow scroll
      zoomed.style.cssText = 'width:100vw;height:auto;object-fit:contain;opacity:0;transition:opacity 200ms ease';
      overlay.style.alignItems = 'flex-start';
    } else {
      zoomed.style.cssText = 'position:fixed;top:' + rect.top + 'px;left:' + rect.left + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;object-fit:contain;transition:all 250ms ease;border-radius:4px;box-shadow:0 8px 32px rgba(0,0,0,0.3)';
    }

    overlay.appendChild(zoomed);
    document.body.appendChild(overlay);

    requestAnimationFrame(function() {
      overlay.style.background = 'rgba(0,0,0,0.92)';
      if (isMobile) {
        zoomed.style.opacity = '1';
      } else {
        zoomed.style.top = '0';
        zoomed.style.left = '0';
        zoomed.style.width = '100vw';
        zoomed.style.height = '100vh';
      }
    });

    function close() {
      if (isMobile) {
        zoomed.style.opacity = '0';
      } else {
        zoomed.style.top = rect.top + 'px';
        zoomed.style.left = rect.left + 'px';
        zoomed.style.width = rect.width + 'px';
        zoomed.style.height = rect.height + 'px';
      }
      overlay.style.background = 'rgba(0,0,0,0)';
      setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
    }
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
  };

  // Viewport switching for deep scan results
  window.__milgSwitchViewport = function(idx) {
    if (!lastRawData || !lastRawData.deepScan || !lastRawData.deepScan.viewportData) return;
    var vpData = lastRawData.deepScan.viewportData[idx];
    if (!vpData || !vpData.data) { showToast('No data for this viewport'); return; }
    // Re-run analysis with this viewport's data, preserving deep scan metadata
    var switchedData = JSON.parse(JSON.stringify(vpData.data));
    switchedData.deepScan = lastRawData.deepScan;
    switchedData.meta.url = lastRawData.meta.url;
    runAnalysis(switchedData);
    showToast('Showing results for ' + vpData.label);
  };

  function deepScanInIframe(html, url, exclude, vpWidth, vpHeight, callback) {
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + vpWidth + 'px;height:' + vpHeight + 'px;border:none;';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    document.body.appendChild(iframe);

    var msgType = 'milg-deep-' + vpWidth;
    var handled = false;
    function onResult(e) {
      if (!e.data || e.data.type !== msgType) return;
      if (handled) return;
      handled = true;
      window.removeEventListener('message', onResult);
      if (iframe.parentNode) document.body.removeChild(iframe);
      callback(e.data.data);
    }
    window.addEventListener('message', onResult);

    var processed = url ? injectBaseTag(html, url) : html;
    var excludeVar = exclude ? '<script>window.__milgExclude=' + JSON.stringify(exclude) + ';</' + 'script>' : '';
    var isFullDoc = /<html[\s>]/i.test(processed) || /<!DOCTYPE/i.test(processed);

    var extractStr = extractFromDocument.toString().replace(/milg-analyzer-result/g, msgType);
    // Auto-scroll inside iframe to trigger intersection observers before extracting
    var scrollScript = 'window.scrollTo(0,document.body.scrollHeight);setTimeout(function(){window.scrollTo(0,0)},300);';
    var extractScript = excludeVar + '<script>window.addEventListener("load",function(){' + scrollScript + 'setTimeout(function(){(' + extractStr + ')()},1500)});setTimeout(function(){(' + extractStr + ')()},8000);</' + 'script>';

    var srcdoc;
    if (isFullDoc) {
      if (/<\/body>/i.test(processed)) {
        srcdoc = processed.replace(/<\/body>/i, extractScript + '</body>');
      } else {
        srcdoc = processed + extractScript;
      }
    } else {
      srcdoc = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></' + 'script><style>body{margin:0}</style></head><body>' + processed + extractScript + '</body></html>';
    }
    iframe.srcdoc = srcdoc;

    setTimeout(function() {
      if (handled) return;
      handled = true;
      window.removeEventListener('message', onResult);
      if (iframe.parentNode) document.body.removeChild(iframe);
      callback(null);
    }, 15000);
  }

  var _originalRawData = null; // Original data before exclusions

  // --- Analysis history (localStorage, max 10) ---
  var HISTORY_KEY = 'milg-analysis-history';
  var HISTORY_MAX = 10;

  function saveToHistory(data, score, grade) {
    try {
      var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      var entryUrl = (data.meta && data.meta.url) || 'Unknown';
      var entryProfile = data.profile || 'general';

      // Dedup: don't add if same URL + profile already exists as the most recent entry
      if (history.length > 0 && history[0].url === entryUrl && history[0].profile === entryProfile) {
        // Update existing entry instead of adding duplicate
        history[0].timestamp = new Date().toISOString();
        history[0].score = score;
        history[0].grade = grade;
      } else {
        var entry = {
          url: entryUrl,
          timestamp: new Date().toISOString(),
          score: score,
          grade: grade,
          profile: entryProfile
        };
        // Store extraction data (without screenshots to save space)
        var stored = JSON.parse(JSON.stringify(data, function(k, v) {
          if (k === 'screenshots' || k === 'viewportData') return undefined;
          return v;
        }));
        entry.data = stored;
        history.unshift(entry);
      }
      if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch(e) { /* quota exceeded or parse error — skip */ }
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch(e) { return []; }
  }

  function renderHistoryList() {
    var history = getHistory();
    if (history.length === 0) return '';
    var html = '<div class="history-section">';
    html += '<h3 style="font-size:14px;font-weight:600;margin-bottom:8px">Recent Analyses <span style="font-size:11px;color:var(--text-secondary);font-weight:400">(max ' + HISTORY_MAX + ', stored locally)</span></h3>';
    history.forEach(function(entry, idx) {
      var date = new Date(entry.timestamp);
      var dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      var urlShort = (entry.url || '').replace(/^https?:\/\//, '').substring(0, 40);
      html += '<div class="history-item">';
      html += '<span class="history-score" style="color:' + (entry.score >= 80 ? '#16a34a' : entry.score >= 60 ? '#ca8a04' : '#dc2626') + '" onclick="window.__milgLoadHistory(' + idx + ')">' + entry.score + '</span>';
      html += '<span class="history-url" onclick="window.__milgLoadHistory(' + idx + ')">' + urlShort + '</span>';
      html += '<span class="history-date">' + dateStr + '</span>';
      html += '<button class="history-delete" onclick="event.stopPropagation();window.__milgDeleteHistory(' + idx + ')" title="Remove from history">&times;</button>';
      html += '</div>';
    });
    html += '<p style="font-size:11px;color:var(--text-secondary);margin-top:6px">Oldest removed after ' + HISTORY_MAX + ' scans. Export JSON to keep permanently.</p>';
    html += '</div>';
    return html;
  }

  window.__milgDeleteHistory = function(idx) {
    try {
      var history = getHistory();
      history.splice(idx, 1);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      // Re-render history
      var containers = document.querySelectorAll('.history-section');
      containers.forEach(function(c) { c.parentNode.removeChild(c); });
      var historyHtml = renderHistoryList();
      if (historyHtml) {
        var container = document.createElement('div');
        container.innerHTML = historyHtml;
        document.getElementById('inputSection').appendChild(container);
      }
    } catch(e) {}
  };

  window.__milgLoadHistory = function(idx) {
    var history = getHistory();
    if (history[idx] && history[idx].data) {
      runAnalysis(history[idx].data);
      showToast('Loaded: ' + (history[idx].url || 'analysis'));
    }
  };

  function runAnalysis(data, skipExclusionDetection) {
    lastRawData = data;
    if (!_originalRawData || !skipExclusionDetection) _originalRawData = data;
    try { sessionStorage.setItem('milg-last-extraction', JSON.stringify(data, function(k, v) { return k === 'viewportData' ? undefined : v; })); } catch(e) {}
    // Apply selected profile
    var profile = document.getElementById('profileSelect');
    if (profile) data.profile = profile.value;
    reportData = MilgScoring.runScoring(data);
    var reportContainer = document.getElementById('reportContainer');
    var inputSection = document.getElementById('inputSection');

    // Detect empty/blocked pages (Cloudflare challenge, JS-only apps, etc.)
    var warningHtml = '';
    var elCount = (data.structure && data.structure.totalElements) || 0;
    var contentWidth = parseFloat(data.spacing && data.spacing.maxContentWidth) || 0;
    if (elCount < 20 || contentWidth < 100) {
      warningHtml = '<div style="padding:12px 16px;background:#fffbeb;border:1px solid #fed7aa;border-radius:var(--radius);margin-bottom:12px;font-size:13px;line-height:1.5">' +
        '<strong style="color:#b45309">Limited content detected (' + elCount + ' elements)</strong><br>' +
        '<span style="color:#92400e">This page may be blocked by Cloudflare, require JavaScript to render, or need authentication. ' +
        'The high scores above reflect the lack of content to check, not the quality of the design.</span><br>' +
        '<span style="color:#92400e">For accurate results, use the <strong>Console Snippet</strong> tab — it runs in your browser with the fully rendered page.</span>' +
        '</div>';
    }

    // Detect exclusion patterns (use original data so they persist after re-scoring)
    var suggestionsHtml = '';
    if (!skipExclusionDetection) {
      var patterns = detectExclusionPatterns(data);
      suggestionsHtml = renderExclusionSuggestions(patterns);
    } else {
      // Show a "reset exclusions" option when viewing filtered results
      suggestionsHtml = '<div class="exclusion-suggestions" style="padding:8px 12px;font-size:12px;display:flex;align-items:center;justify-content:space-between">' +
        '<span style="color:var(--text-secondary)">Showing filtered results (some elements excluded)</span>' +
        '<button class="btn" style="font-size:11px;padding:4px 10px;min-height:28px" onclick="window.__milgResetExclusions()">Reset exclusions</button>' +
        '</div>';
    }

    reportContainer.innerHTML = warningHtml + suggestionsHtml + MilgReport.renderReport(reportData);
    reportContainer.classList.add('visible');
    inputSection.style.display = 'none';
    document.getElementById('reportActions').style.display = 'flex';

    // Save to history (skip re-scores from exclusions)
    if (!skipExclusionDetection) {
      saveToHistory(data, reportData.overall, reportData.grade);
    }
  }

  window.__milgResetExclusions = function() {
    if (_originalRawData) runAnalysis(_originalRawData);
  };

  // --- URL Fetch via CORS proxy ---
  // Remembers which proxy worked so subsequent requests (CSS files etc.) skip failed ones
  var _lastWorkingProxy = -1; // -1 = direct, 0+ = proxy index

  function buildProxyList() {
    var proxies = [];
    if (CORS_PROXY_URL) proxies.push(CORS_PROXY_URL + '?url=');
    proxies.push(
      'https://api.allorigins.win/raw?url=',
      'https://api.codetabs.com/v1/proxy?quest=',
      'https://corsproxy.io/?'
    );
    return proxies;
  }

  function fetchWithProxy(url) {
    var proxies = buildProxyList();

    // If we already know which proxy works, try it first
    if (_lastWorkingProxy >= 0 && _lastWorkingProxy < proxies.length) {
      return fetch(proxies[_lastWorkingProxy] + encodeURIComponent(url))
        .then(function(r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function(t) { if (!t || t.length < 50) throw new Error('empty'); return t; })
        .catch(function() {
          // Last working proxy failed — reset and try full chain
          _lastWorkingProxy = -1;
          return fetchWithProxyFull(url, proxies);
        });
    }

    return fetchWithProxyFull(url, proxies);
  }

  function fetchWithProxyFull(url, proxies) {
    // Try direct fetch first
    return fetch(url, { mode: 'cors', redirect: 'follow' })
      .then(function(r) { if (r.ok) return r.text(); throw new Error(r.status); })
      .then(function(t) { _lastWorkingProxy = -1; return t; })
      .catch(function() {
        // Try proxies in order, remember which one works
        var chain = Promise.reject();
        proxies.forEach(function(proxyBase, idx) {
          chain = chain.catch(function() {
            return fetch(proxyBase + encodeURIComponent(url)).then(function(r) {
              if (!r.ok) throw new Error(r.status);
              return r.text();
            }).then(function(t) {
              if (!t || t.length < 50) throw new Error('empty');
              _lastWorkingProxy = idx;
              return t;
            });
          });
        });
        return chain;
      });
  }

  function fetchViaProxy(url, callback) {
    fetchWithProxy(url)
      .then(function(html) {
        // Detect proxy error pages (Cloudflare challenges, 4xx/5xx error pages)
        if (html && (
          /class="no-js.*oldie"/i.test(html.substring(0, 500)) || // Cloudflare error template
          /cf-error-details|cf-wrapper|cloudflare/i.test(html.substring(0, 2000)) ||
          /Access Denied|403 Forbidden|Just a moment/i.test(html.substring(0, 1000))
        )) {
          callback(null, 'The site returned an error/challenge page (likely blocking proxy access). Use the Console Snippet tab instead.');
          return;
        }

        // Resolve base URL for relative paths
        var baseUrl;
        try { var u = new URL(url); baseUrl = u.origin + u.pathname.replace(/\/[^/]*$/, '/'); } catch(e) { baseUrl = url; }

        // Find and inline linked stylesheets so CSS works inside srcdoc iframe
        var cssLinks = [];
        var linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
        var altRegex = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
        var m;
        while (m = linkRegex.exec(html)) cssLinks.push(m[1]);
        while (m = altRegex.exec(html)) { if (cssLinks.indexOf(m[1]) === -1) cssLinks.push(m[1]); }

        if (cssLinks.length === 0) { callback(html, null); return; }

        // Fetch all CSS files and inline them
        Promise.all(cssLinks.map(function(href) {
          var cssUrl = href.startsWith('http') ? href : (href.startsWith('/') ? new URL(url).origin + href : baseUrl + href);
          return fetchWithProxy(cssUrl).catch(function() { return '/* failed: ' + href + ' */'; });
        })).then(function(cssTexts) {
          // Remove original link tags and inject inlined styles
          var processed = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, '');
          processed = processed.replace(/<link[^>]+href=["'][^"']+\.css[^"']*["'][^>]*rel=["']stylesheet["'][^>]*>/gi, '');
          var styleBlock = '<style>' + cssTexts.join('\n') + '</style>';
          if (/<\/head>/i.test(processed)) {
            processed = processed.replace(/<\/head>/i, styleBlock + '</head>');
          } else {
            processed = styleBlock + processed;
          }
          callback(processed, null);
        });
      })
      .catch(function(e) {
        callback(null, e.message || 'All CORS proxies failed');
      });
  }

  // Inject a <base> tag so relative URLs (CSS, images, fonts) resolve to the original domain
  function injectBaseTag(html, url) {
    if (!url || url === 'Pasted HTML') return html;
    try {
      var base = new URL(url);
      var baseHref = base.origin + base.pathname.replace(/\/[^/]*$/, '/');
      var baseTag = '<base href="' + baseHref + '">';
      // Insert after <head> if present
      if (/<head[\s>]/i.test(html)) {
        return html.replace(/<head([^>]*)>/i, '<head$1>' + baseTag);
      }
      // Otherwise prepend
      return baseTag + html;
    } catch(e) { return html; }
  }

  function analyzeHtmlInIframe(html, callback, sourceUrl, excludeSelector, captureScreenshots) {
    var iframe = document.createElement('iframe');
    // Use viewport from selector or default
    var vp = getSelectedViewport();
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + vp.w + 'px;height:' + vp.h + 'px;border:none;';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    document.body.appendChild(iframe);

    var handled = false;
    function finish(data) {
      if (handled) return;
      handled = true;
      window.removeEventListener('message', onMsg);
      if (iframe.parentNode) document.body.removeChild(iframe);
      callback(data);
    }

    function onMsg(e) {
      if (!e.data) return;
      if (e.data.type === 'milg-analyzer-result') {
        var data = e.data.data;
        data.meta.url = 'Pasted HTML';
        if (!captureScreenshots) {
          finish(data);
          return;
        }
        // Screenshot capture auto-triggers inside the iframe after extraction
        // Store data, wait for screenshots
        iframe._milgData = data;
      }
      if (e.data.type === 'milg-screenshots-result' && iframe._milgData) {
        iframe._milgData.screenshots = e.data.screenshots || [];
        finish(iframe._milgData);
      }
    }
    window.addEventListener('message', onMsg);

    // If the pasted HTML is a full document (has <html> or <head>), use it as-is
    // and just append the extraction script. Otherwise wrap in a basic document.
    var isFullDoc = /<html[\s>]/i.test(html) || /<!DOCTYPE/i.test(html);
    // Inject <base> tag so relative CSS/image/font URLs resolve to the original domain
    if (sourceUrl) html = injectBaseTag(html, sourceUrl);
    // Pass exclude selector to extraction context
    var excludeVar = excludeSelector ? '<script>window.__milgExclude=' + JSON.stringify(excludeSelector) + ';</' + 'script>' : '';
    // Screenshot capture: script that auto-runs after extraction, loads CDN library, captures page
    var screenshotScript = captureScreenshots ? '<script>window.__milgDoScreenshots=function(){' + buildScreenshotScript('milg-screenshots-result') + '};</' + 'script>' : '';
    var srcdoc;
    if (isFullDoc) {
      // Wait for window load (CSS/fonts loaded), then extra delay for rendering
      var extractScript = excludeVar + screenshotScript + '<script>window.addEventListener("load",function(){setTimeout(function(){(' + extractFromDocument.toString() + ')()},1000)});setTimeout(function(){(' + extractFromDocument.toString() + ')()},8000);</' + 'script>';
      if (/<\/body>/i.test(html)) {
        srcdoc = html.replace(/<\/body>/i, extractScript + '</body>');
      } else {
        srcdoc = html + extractScript;
      }
    } else {
      srcdoc = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></' + 'script>' +
        '<style>body{margin:0}</style></head><body>' +
        html + excludeVar + screenshotScript +
        '<script>setTimeout(function(){(' + extractFromDocument.toString() + ')()}, 1500);</' + 'script>' +
        '</body></html>';
    }
    iframe.srcdoc = srcdoc;

    // Timeout fallback (longer when capturing screenshots)
    setTimeout(function() {
      if (!handled && iframe._milgData) {
        // Extraction succeeded but screenshots timed out — return without screenshots
        iframe._milgData.screenshots = [];
        finish(iframe._milgData);
      } else {
        finish({
          meta: { title: '', url: 'Pasted HTML', viewportWidth: 1280, viewportHeight: 900, timestamp: new Date().toISOString(), version: 1 },
          colors: { textColors: [], bgColors: [], contrastPairs: [] },
          typography: { bodyFontSize: '16px', bodyLineHeight: '24px', bodyFontFamily: 'sans-serif', fontFamilies: [], fontSizes: [], fontWeights: [], headings: [], lineHeights: [], maxLineLength: { chars: 0, element: '' } },
          spacing: { paddings: [], margins: [], gaps: [], maxContentWidth: '', bodyPaddingHorizontal: '' },
          layout: { sectionGaps: [], alignmentEdges: [], visualHierarchy: {} },
          interaction: { touchTargets: [], transitions: [] },
          accessibility: { semanticElements: {}, headingHierarchy: [], imagesWithoutAlt: 0, formLabels: { total: 0, withLabel: 0, withoutLabel: 0 }, focusIndicators: [] },
          structure: { totalElements: 0, darkModeClasses: false, responsiveClasses: false, tailwindDetected: false, cssFramework: 'unknown' }
        });
      }
    }, captureScreenshots ? 25000 : (isFullDoc ? 15000 : 8000));
  }

  // --- Screenshot capture script (injected into iframes after extraction) ---
  function buildScreenshotScript(msgType) {
    // Runs inside iframe. Loads modern-screenshot, captures page as viewport-height
    // sections at 0.5x scale as WebP. Always multi-section for reliability.
    return '(function(){' +
      'var s=document.createElement("script");' +
      's.src="' + SCREENSHOT_CDN + '";' +
      's.onload=function(){' +
        'var ms=window.modernScreenshot;' +
        'if(!ms||!ms.domToCanvas){parent.postMessage({type:"' + msgType + '",screenshots:[]},"*");return}' +
        'var totalH=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);' +
        'var vh=window.innerHeight||900;' +
        'var captureH=Math.min(totalH,vh*5);' + // max 5 viewports
        'var shots=[];var y=0;' +
        'function next(){' +
          'if(y>=captureH||shots.length>=5){parent.postMessage({type:"' + msgType + '",screenshots:shots},"*");return}' +
          'window.scrollTo(0,y);' +
          'setTimeout(function(){' +
            'ms.domToCanvas(document.documentElement,{scale:0.5}).then(function(c){' +
              'c.toBlob(function(b){' +
                'if(!b){y+=vh;next();return}' +
                'var r=new FileReader();' +
                'r.onloadend=function(){shots.push(r.result);y+=vh;next()};' +
                'r.readAsDataURL(b)' +
              '},"image/webp",0.7)' +
            '}).catch(function(){y+=vh;next()})' +
          '},200)' +
        '}' +
        'next()' +
      '};' +
      's.onerror=function(){parent.postMessage({type:"' + msgType + '",screenshots:[]},"*")};' +
      'document.head.appendChild(s)' +
    '})()';
  }

  // --- Progress bar helpers ---
  function showProgress(pct, label) {
    var el = document.getElementById('analysisProgress');
    var fill = document.getElementById('progressFill');
    var lbl = document.getElementById('progressLabel');
    if (!el) return;
    el.style.display = 'block';
    fill.style.width = Math.min(pct, 100) + '%';
    if (label) lbl.textContent = label;
  }

  function hideProgress() {
    var el = document.getElementById('analysisProgress');
    if (el) el.style.display = 'none';
  }

  var _snippetCache = {};
  function loadSnippet(codeEl, withScreenshots) {
    var file = withScreenshots ? 'analyzer-snippet-screenshots.js' : 'analyzer-snippet.js';
    if (_snippetCache[file]) {
      codeEl.textContent = _snippetCache[file];
      return;
    }
    fetch(file)
      .then(function(r) { return r.text(); })
      .then(function(text) { _snippetCache[file] = text; codeEl.textContent = text; })
      .catch(function() { codeEl.textContent = '// Failed to load snippet — copy from ' + file; });
  }

  function applyDarkMode() {
    document.body.classList.toggle('dark-ui', darkMode);
    document.getElementById('darkBtn').classList.toggle('active', darkMode);
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 3000);
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
