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
      meta: { title: document.title, url: location.href, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, timestamp: new Date().toISOString(), version: 1, isFragment: !!window.__milgIsFragment },
      colors: { textColors: [], bgColors: [], contrastPairs: [] },
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
      // Skip gradient text (uses -webkit-background-clip: text with transparent fill)
      var textFillColor = style.webkitTextFillColor || style.getPropertyValue('-webkit-text-fill-color') || '';
      var bgClip = style.webkitBackgroundClip || style.getPropertyValue('-webkit-background-clip') || style.backgroundClip || '';
      if (textFillColor === 'transparent' || bgClip === 'text') continue;
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
      var hasBackdropFilter = false;
      var minBgAlpha = 1;
      while (filterAncestor && filterAncestor !== document.documentElement) {
        var aStyle = getComputedStyle(filterAncestor);
        var f = aStyle.filter;
        if (f && f !== 'none' && !filterValue) { filterValue = f; }
        var bf = aStyle.backdropFilter || aStyle.webkitBackdropFilter || '';
        if (bf && bf !== 'none') hasBackdropFilter = true;
        var aBg = parseColor(aStyle.backgroundColor);
        if (aBg && aBg.a > 0 && aBg.a < 1 && aBg.a < minBgAlpha) minBgAlpha = aBg.a;
        filterAncestor = filterAncestor.parentElement;
      }
      if (ratio < 7.5) {
        contrastPairs.push({ fg: rgbStr(fgBlended), bg: rgbStr(bg), ratio: Math.round(ratio * 100) / 100, needed: threshold, passes: ratio >= threshold, fontSize: Math.round(fontSize), fontWeight: fontWeight, isLarge: isLarge, text: node.textContent.trim().substring(0, 50), selector: cssSelector(el), filter: filterValue, backdropFilter: hasBackdropFilter, minBgAlpha: Math.round(minBgAlpha * 100) / 100 });
      }
      var elWidth = el.getBoundingClientRect().width;
      var charWidth = fontSize * 0.5;
      var charsPerLine = Math.round(elWidth / charWidth);
      if (charsPerLine > data.typography.maxLineLength.chars && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.closest('pre') && !el.closest('code')) {
        data.typography.maxLineLength = { chars: charsPerLine, element: cssSelector(el), fontSize: Math.round(fontSize), textLength: node.textContent.trim().length };
      }
    }
    contrastPairs.sort(function(a, b) { return a.ratio - b.ratio; });
    data.colors.contrastPairs = contrastPairs.slice(0, 50);

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
      fontWeightMap[s.fontWeight] = (fontWeightMap[s.fontWeight] || 0) + 1;
      fontFamilySet.add(s.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
      var lh = s.lineHeight;
      if (lh !== 'normal') { var lhR = parseFloat(lh) / parseFloat(s.fontSize); lineHeightMap[Math.round(lhR * 100) / 100] = (lineHeightMap[Math.round(lhR * 100) / 100] || 0) + 1; }
      if (s.color) textColorMap[s.color] = (textColorMap[s.color] || 0) + 1;
      var bgColor = s.backgroundColor;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') bgColorMap[bgColor] = (bgColorMap[bgColor] || 0) + 1;

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
    function mapToSorted(map) { return Object.keys(map).map(function(k) { return { value: k, count: map[k] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 30); }
    data.typography.fontSizes = mapToSorted(fontSizeMap);
    data.typography.fontWeights = mapToSorted(fontWeightMap);
    data.typography.fontFamilies = Array.from(fontFamilySet).slice(0, 10);
    data.typography.lineHeights = mapToSorted(lineHeightMap);
    data.colors.textColors = mapToSorted(textColorMap);
    data.colors.bgColors = mapToSorted(bgColorMap);

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
    else if (isDarkPage) data.structure.darkModeMethod = 'inferred-from-colors';

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
    var _hasFvCSS = Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r.selectorText && r.selectorText.indexOf('focus-visible') !== -1; }); } catch(e) { return false; } });
    var _hasFvClasses = Array.from(interactive).slice(0, 20).some(function(el) { var cls = el.getAttribute('class') || ''; return cls.indexOf('focus-visible') !== -1 || cls.indexOf('focus:ring') !== -1 || cls.indexOf('focus:outline') !== -1; });
    data.accessibility.hasFocusVisibleCSS = _hasFvCSS || _hasFvClasses;
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
          if (isData && !isWide) { inIntentionalScroll = true; break; }
          break;
        }
        anc = anc.parentElement;
      }
      if (inIntentionalScroll) return;
      var parentAlready = data.layout.offscreenElements.some(function(rec) {
        try { var pel = document.querySelector(rec.selector); return pel && pel.contains(el) && pel !== el; } catch(e) { return false; }
      });
      if (parentAlready) return;
      data.layout.offscreenElements.push({
        element: el.tagName.toLowerCase(),
        selector: cssSelector(el),
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 50),
        left: Math.round(r.left),
        right: Math.round(r.right),
        vpWidth: vpW,
        reason: r.right < 0 ? 'left-overflow' : r.left >= vpW ? 'right-overflow' : 'major-clip'
      });
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
        data.layout.offscreenElements.push({
          element: child.tagName.toLowerCase(),
          selector: sel,
          text: (child.textContent || child.getAttribute('aria-label') || '').trim().substring(0, 50),
          left: Math.round(cr.left),
          right: Math.round(cr.right),
          vpWidth: vpW,
          reason: 'hidden-fixed-overflow'
        });
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
          // Check for wrapped content (cell height > 1.8x line height = multi-line)
          var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
          if (r.height > lh * 1.8 && cell.textContent.trim().length > 0) wrappedCells++;
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

    // Border radii (for layout/consistency scoring)
    var radiusMap = {};
    Array.from(allElements).slice(0, 500).forEach(function(el) {
      if (!isVisible(el)) return;
      var br = getComputedStyle(el).borderRadius;
      if (br && br !== '0px') { radiusMap[br] = (radiusMap[br] || 0) + 1; }
    });
    data.layout.borderRadii = Object.keys(radiusMap).map(function(k) { return { value: k, count: radiusMap[k] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 15);

    // Horizontal scroll containers — refined classification
    var _iframeStructuralSel = 'nav,form,section,header,footer,article,aside,main,h1,h2,h3,h4,h5,h6';
    data.layout.horizontalScrollContainers = [];
    data.layout.nestedScrollbars = 0;
    var overflowEls = document.querySelectorAll('[style*="overflow"],[class*="overflow"]');
    overflowEls.forEach(function(oel) {
      if (oel.scrollWidth > oel.clientWidth + 2 && oel.clientWidth > 0) {
        var tag = oel.tagName.toLowerCase();
        var oelStyle = getComputedStyle(oel);
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

        data.layout.horizontalScrollContainers.push({
          selector: cssSelector(oel),
          intentional: classification === 'intentional',
          classification: classification,
          reason: !hasOverflowCSS ? 'no-overflow-css' :
                  hasStructuralChildren ? 'structural-children-in-scroll' :
                  isWideContainer ? 'wide-container-scrolls' :
                  isDataContent ? 'data-content' : 'unknown',
          scrollWidth: oel.scrollWidth,
          overflow: Math.round(oel.scrollWidth - oel.clientWidth),
          element: tag
        });
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
    data.layout.hiddenPanelIssues = [];
    var _iframeHiddenPanels = [];
    document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"], [role="tooltip"], [role="alertdialog"]').forEach(function(el) {
      if (!isVisible(el) && _iframeHiddenPanels.indexOf(el) === -1) _iframeHiddenPanels.push(el);
    });
    var _iframeInlineRoles = { region: 1, tabpanel: 1, tab: 1 };
    document.querySelectorAll('[aria-controls]').forEach(function(trigger) {
      var targetId = trigger.getAttribute('aria-controls');
      if (targetId) {
        var target = document.getElementById(targetId);
        if (target && !isVisible(target) && _iframeHiddenPanels.indexOf(target) === -1) {
          var targetRole = (target.getAttribute('role') || '').toLowerCase();
          if (!_iframeInlineRoles[targetRole]) _iframeHiddenPanels.push(target);
        }
      }
    });
    document.querySelectorAll('[aria-haspopup="true"], [aria-haspopup="menu"], [aria-haspopup="dialog"], [aria-haspopup="listbox"]').forEach(function(trigger) {
      var ctrlId = trigger.getAttribute('aria-controls');
      if (ctrlId) {
        var t = document.getElementById(ctrlId);
        if (t && !isVisible(t) && _iframeHiddenPanels.indexOf(t) === -1) _iframeHiddenPanels.push(t);
        return;
      }
      var wrapper = trigger.parentElement;
      if (!wrapper) return;
      wrapper.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]').forEach(function(c) {
        if (!isVisible(c) && _iframeHiddenPanels.indexOf(c) === -1) _iframeHiddenPanels.push(c);
      });
    });
    data.layout.hiddenPanelCount = _iframeHiddenPanels.length;
    _iframeHiddenPanels.slice(0, 15).forEach(function(panel) {
      var origCssText = panel.style.cssText;
      var origAriaHidden = panel.getAttribute('aria-hidden');
      var origHidden = panel.hasAttribute('hidden');
      panel.style.cssText = origCssText + '; display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: none !important;';
      if (origHidden) panel.removeAttribute('hidden');
      if (origAriaHidden) panel.setAttribute('aria-hidden', 'false');
      void panel.offsetHeight;
      var pr = panel.getBoundingClientRect();
      var issues = [];
      if (pr.width > 0 && pr.height > 0) {
        if (pr.right > vpW + 2) issues.push({ type: 'right-overflow', overflow: Math.round(pr.right - vpW) });
        if (pr.left < -2) issues.push({ type: 'left-overflow', overflow: Math.round(Math.abs(pr.left)) });
        if (pr.bottom > window.innerHeight * 2) issues.push({ type: 'extreme-bottom', bottom: Math.round(pr.bottom) });
        if (panel.scrollWidth > panel.clientWidth + 2) issues.push({ type: 'internal-overflow', overflow: Math.round(panel.scrollWidth - panel.clientWidth) });
      }
      panel.style.cssText = origCssText;
      if (origHidden) panel.setAttribute('hidden', '');
      if (origAriaHidden) panel.setAttribute('aria-hidden', origAriaHidden);
      else if (panel.hasAttribute('aria-hidden')) panel.removeAttribute('aria-hidden');
      if (issues.length > 0) {
        data.layout.hiddenPanelIssues.push({
          selector: cssSelector(panel),
          role: panel.getAttribute('role') || 'unknown',
          width: Math.round(pr.width),
          height: Math.round(pr.height),
          left: Math.round(pr.left),
          right: Math.round(pr.right),
          vpWidth: vpW,
          issues: issues
        });
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
    // Store original input section HTML so we can restore it after preview analysis
    var _originalInputSectionHTML = inputSection.innerHTML;

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // Load snippet for display (respect screenshot checkbox initial state)
    var _initScreenshots = document.getElementById('screenshotCheck');
    loadSnippet(snippetCode, _initScreenshots && _initScreenshots.checked);

    // Toggle snippet variant based on shared screenshot checkbox
    var sharedScreenshotCheck = document.getElementById('screenshotCheck');
    if (sharedScreenshotCheck) {
      sharedScreenshotCheck.addEventListener('change', function() {
        loadSnippet(snippetCode, sharedScreenshotCheck.checked);
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
        data.meta._inputMethod = 'console';
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
      var wantScreenshots = document.getElementById('screenshotCheck') && document.getElementById('screenshotCheck').checked;
      analyzeHtmlInIframe(html, function(data) {
        analyzeHtmlBtn.textContent = 'Analyze HTML';
        analyzeHtmlBtn.disabled = false;
        data.meta._inputMethod = 'paste';
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
      // Normalize: add www. if bare domain (many sites redirect or block without it)
      try {
        var parsed = new URL(url);
        if (!parsed.hostname.startsWith('www.') && parsed.hostname.split('.').length === 2 && !parsed.hostname.includes('localhost')) {
          url = parsed.protocol + '//www.' + parsed.hostname + parsed.pathname + parsed.search + parsed.hash;
        }
      } catch(e) {}
      urlInput.value = url; // Show normalized URL to user

      // Crawl mode intercept
      if (isCrawlMode()) { startCrawl(url); return; }

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
                  primary.meta._inputMethod = 'url';
                  runAnalysis(primary);
                });
              } else {
                analyzeUrlBtn.disabled = false;
                analyzeUrlBtn.textContent = 'Analyze URL';
                urlStatus.style.display = 'none';
                showProgress(100, 'Done!');
                setTimeout(hideProgress, 500);
                primary.meta.url = url;
                primary.meta._inputMethod = 'url';
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
          data.meta._inputMethod = 'url';
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
      // Restore original input form if it was replaced (e.g. by editor preview analysis)
      if (!inputSection.querySelector('.tab-btn')) {
        inputSection.innerHTML = _originalInputSectionHTML;
        // Re-bind tab switching after DOM restoration
        inputSection.querySelectorAll('.tab-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            inputSection.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            inputSection.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            btn.classList.add('active');
            var target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
          });
        });
      }
      document.getElementById('reportActions').style.display = 'none'; document.getElementById('profileExplanation').style.display = 'none';
      var pi = document.getElementById('pasteInput'); if (pi) pi.value = '';
      var hi = document.getElementById('htmlInput'); if (hi) hi.value = '';
      var ui = document.getElementById('urlInput'); if (ui) ui.value = '';
      var us = document.getElementById('urlStatus'); if (us) us.style.display = 'none';
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

    // Copy markdown to clipboard (without images for easy pasting)
    document.getElementById('copyMdBtn').addEventListener('click', function() {
      if (!reportData) return;
      var md = MilgReport.renderMarkdown(reportData, { skipImages: true });
      navigator.clipboard.writeText(md).then(function() {
        showToast('Markdown copied (without images)');
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
          // Read rendering context (dark mode, effect CSS) from editor
          var previewCtx = {};
          try { previewCtx = JSON.parse(sessionStorage.getItem('milg-preview-context') || '{}'); } catch(e) {}
          sessionStorage.removeItem('milg-preview-context');
          // Show loading state
          var inputSection = document.getElementById('inputSection');
          var ctxLabel = (previewCtx.dark ? ' (dark mode)' : '') + (previewCtx.effectName && previewCtx.effectName !== 'None' ? ' + ' + previewCtx.effectName : '');
          inputSection.innerHTML = '<div style="text-align:center;padding:64px 24px"><div class="analysis-progress" style="display:block;max-width:400px;margin:0 auto"><div class="analysis-progress-bar"><div class="analysis-progress-fill" style="width:30%;animation:pulse 1.5s ease infinite"></div></div><div class="analysis-progress-label" style="margin-top:12px;font-size:14px">Analyzing editor preview' + ctxLabel + '...</div></div></div>';
          analyzeHtmlInIframe(previewHtml, function(data) {
            data.meta.url = 'Editor Preview' + ctxLabel;
            data.meta._inputMethod = 'editor';
            runAnalysis(data);
          }, previewCtx.dark || false, previewCtx.effectCSS || '', true);
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

    // --- Site Crawl wiring ---
    var _crawlSession = null;
    var _crawlPageReports = {}; // pageIndex → rendered HTML cache
    var _crawlActivePageTab = 'summary';
    var CRAWL_HARD_MAX = 25;

    var crawlSiteCheck = document.getElementById('crawlSiteCheck');
    var crawlOptions = document.getElementById('crawlOptions');
    var cancelCrawlBtn = document.getElementById('cancelCrawlBtn');
    var crawlMaxPages = document.getElementById('crawlMaxPages');
    var crawlBlacklist = document.getElementById('crawlBlacklist');
    var crawlProgressArea = document.getElementById('crawlProgressArea');
    var crawlProgressLabel = document.getElementById('crawlProgressLabel');
    var crawlProgressCount = document.getElementById('crawlProgressCount');
    var crawlProgressFill = document.getElementById('crawlProgressFill');
    var crawlProgressList = document.getElementById('crawlProgressList');
    var crawlResults = document.getElementById('crawlResults');
    var crawlPageTabs = document.getElementById('crawlPageTabs');
    var crawlPageContent = document.getElementById('crawlPageContent');

    // Crawl site toggle — show/hide crawl options
    if (crawlSiteCheck && crawlOptions) {
      crawlSiteCheck.addEventListener('change', function() {
        crawlOptions.style.display = crawlSiteCheck.checked ? '' : 'none';
      });
    }

    // Page limit easter egg — MutationObserver
    if (crawlMaxPages) {
      var _crawlMaxObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
          if (m.attributeName === 'max') {
            var newMax = parseInt(crawlMaxPages.getAttribute('max'));
            if (newMax > 10) {
              showToast('Nice try! We see you editing the DOM \uD83D\uDE0F Fine, ' + CRAWL_HARD_MAX + ' is the real limit\u2026 but your proxy rate limit isn\u2019t.');
              crawlMaxPages.setAttribute('max', CRAWL_HARD_MAX);
            }
          }
        });
      });
      _crawlMaxObserver.observe(crawlMaxPages, { attributes: true, attributeFilter: ['max'] });
    }

    // isCrawlMode helper
    function isCrawlMode() { return crawlSiteCheck && crawlSiteCheck.checked; }

    function crawlStatusIcon(status) {
      if (status === 'done') return '<span class="status-icon done"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>';
      if (status === 'error') return '<span class="status-icon error"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>';
      if (status === 'fetching' || status === 'analyzing') return '<span class="status-icon active"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg></span>';
      return '<span class="status-icon pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="20" stroke-dashoffset="10"/></svg></span>';
    }

    function updateCrawlProgressItem(page) {
      var existing = document.getElementById('crawl-progress-' + encodeURIComponent(page.url));
      var path; try { path = new URL(page.url).pathname; } catch(e) { path = page.url; }
      var scoreText = page.status === 'done' && page.reportData ? ' ' + page.reportData.overall + '/100' : '';
      var errorText = page.status === 'error' ? ' <span style="color:#dc2626;font-size:12px">' + (page.error || 'Failed').substring(0, 40) + '</span>' : '';
      var html = crawlStatusIcon(page.status) +
        '<span class="page-url" title="' + page.url + '">' + path + '</span>' +
        '<span class="page-score">' + scoreText + errorText + '</span>';
      if (existing) {
        existing.innerHTML = html;
      } else {
        var div = document.createElement('div');
        div.className = 'crawl-progress-item';
        div.id = 'crawl-progress-' + encodeURIComponent(page.url);
        div.innerHTML = html;
        crawlProgressList.appendChild(div);
      }
    }

    function renderCrawlTabs() {
      if (!_crawlSession || !crawlPageTabs) return;
      var html = '<button class="crawl-page-tab' + (_crawlActivePageTab === 'summary' ? ' active' : '') + '" data-crawl-page="summary">Summary</button>';
      _crawlSession.pages.forEach(function(page, idx) {
        html += MilgReport.renderCrawlPageTab(page, idx, _crawlActivePageTab === String(idx));
      });
      crawlPageTabs.innerHTML = html;
    }

    function showCrawlPageContent(key) {
      _crawlActivePageTab = key;
      renderCrawlTabs();
      if (key === 'summary') {
        var summary = _crawlSession.summary || MilgCrawl.buildSummary(_crawlSession);
        crawlPageContent.innerHTML = MilgReport.renderCrawlSummary(summary);
        var vpSubtabs = document.getElementById('crawlViewportSubtabs');
        if (vpSubtabs) vpSubtabs.style.display = 'none';
      } else {
        var idx = parseInt(key);
        var page = _crawlSession.pages[idx];
        if (!page || page.status !== 'done') {
          crawlPageContent.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">' +
            (page && page.status === 'error' ? 'Error: ' + (page.error || 'Analysis failed') : 'Analyzing\u2026') + '</div>';
          return;
        }
        // Use cached report HTML or render fresh
        if (!_crawlPageReports[idx]) {
          var profile = document.getElementById('profileSelect');
          if (profile) page.rawData.profile = profile.value;
          page.reportData = MilgScoring.runScoring(page.rawData);
          _crawlPageReports[idx] = MilgReport.renderReport(page.reportData);
        }
        crawlPageContent.innerHTML = _crawlPageReports[idx];
      }
    }

    // Tab click delegation
    if (crawlPageTabs) {
      crawlPageTabs.addEventListener('click', function(e) {
        var tab = e.target.closest('[data-crawl-page]');
        if (!tab) return;
        showCrawlPageContent(tab.getAttribute('data-crawl-page'));
      });
    }

    // Crawl intercept — when crawl mode is on, analyzeUrlBtn triggers a crawl instead
    function startCrawl(url) {
      var maxPages = parseInt(crawlMaxPages.value) || 5;
      maxPages = Math.min(Math.max(maxPages, 1), CRAWL_HARD_MAX);

      var blacklist = (crawlBlacklist.value || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      var deepScan = document.getElementById('deepScanCheck') && document.getElementById('deepScanCheck').checked;
      var profile = document.getElementById('profileSelect');

      _crawlSession = MilgCrawl.createSession(url, {
        maxPages: maxPages,
        blacklist: blacklist,
        deepScan: deepScan,
        profile: profile ? profile.value : 'general'
      });
      _crawlPageReports = {};
      _crawlActivePageTab = 'summary';

      // Show progress
      analyzeUrlBtn.disabled = true;
      analyzeUrlBtn.textContent = 'Crawling\u2026';
      cancelCrawlBtn.style.display = '';
      crawlProgressArea.style.display = '';
      crawlProgressList.innerHTML = '';
      crawlProgressFill.style.width = '0%';
      crawlProgressLabel.textContent = 'Fetching starting page\u2026';
      crawlProgressCount.textContent = '0 / ' + maxPages;

      // Show crawl results area
      var reportActions = document.getElementById('reportActions');
      var reportContainer = document.getElementById('reportContainer');
      crawlResults.style.display = '';
      if (reportContainer) reportContainer.className = 'report-container';
      if (reportActions) reportActions.style.display = '';

      renderCrawlTabs();
      showCrawlPageContent('summary');

      var doneCount = 0;
      var totalPages = 1;

      MilgCrawl.startCrawl(_crawlSession, {
        fetchPage: function(pageUrl, cb) {
          fetchViaProxy(pageUrl, function(html, err) { cb(html, err); });
        },
        analyzePage: function(html, pageUrl, opts, cb) {
          analyzeHtmlInIframe(html, function(data) {
            if (data) {
              data.meta.url = pageUrl;
              data.meta._inputMethod = 'crawl';
              if (opts.profile) data.profile = opts.profile;
            }
            cb(data);
          }, pageUrl, opts.excludeSelector || null, false);
        },
        scorePage: function(data) { return MilgScoring.runScoring(data); },
        onDiscovery: function(urls) {
          totalPages = 1 + urls.length;
          crawlProgressCount.textContent = '0 / ' + totalPages;
          crawlProgressLabel.textContent = 'Found ' + urls.length + ' page' + (urls.length !== 1 ? 's' : '') + ' to crawl';
        },
        onPageStart: function(page) {
          updateCrawlProgressItem(page);
          crawlProgressLabel.textContent = 'Analyzing ' + page.url.replace(/^https?:\/\/[^/]+/, '') + '\u2026';
          renderCrawlTabs();
        },
        onPageComplete: function(page) {
          doneCount++;
          updateCrawlProgressItem(page);
          crawlProgressCount.textContent = doneCount + ' / ' + totalPages;
          crawlProgressFill.style.width = Math.round(doneCount / totalPages * 100) + '%';
          renderCrawlTabs();
          if (_crawlActivePageTab === 'summary') showCrawlPageContent('summary');
        },
        onPageError: function(page) {
          doneCount++;
          updateCrawlProgressItem(page);
          crawlProgressCount.textContent = doneCount + ' / ' + totalPages;
          crawlProgressFill.style.width = Math.round(doneCount / totalPages * 100) + '%';
          renderCrawlTabs();
        },
        onComplete: function(session) {
          analyzeUrlBtn.disabled = false;
          analyzeUrlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Analyze URL';
          cancelCrawlBtn.style.display = 'none';
          crawlProgressLabel.textContent = 'Crawl complete!';
          crawlProgressFill.style.width = '100%';
          renderCrawlTabs();
          showCrawlPageContent('summary');
        }
      });
    }

    if (cancelCrawlBtn) {
      cancelCrawlBtn.addEventListener('click', function() {
        if (_crawlSession) MilgCrawl.abortCrawl(_crawlSession);
        analyzeUrlBtn.disabled = false;
        analyzeUrlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Analyze URL';
        cancelCrawlBtn.style.display = 'none';
        crawlProgressLabel.textContent = 'Crawl cancelled';
      });
    }

    // Check for completed snippet crawl on load
    try {
      var snippetCrawlData = localStorage.getItem('milg-crawl-complete');
      if (snippetCrawlData) {
        localStorage.removeItem('milg-crawl-complete');
        var crawlState = JSON.parse(snippetCrawlData);
        if (crawlState && crawlState.results && crawlState.results.length > 0) {
          showToast('Loaded crawl results from console snippet (' + crawlState.results.length + ' pages)');
          // Build session from snippet results
          _crawlSession = MilgCrawl.createSession(crawlState.startUrl || crawlState.results[0].url, {
            maxPages: crawlState.results.length,
            profile: document.getElementById('profileSelect') ? document.getElementById('profileSelect').value : 'general'
          });
          crawlState.results.forEach(function(r) {
            var report = MilgScoring.runScoring(r.data);
            _crawlSession.pages.push({
              url: r.url, status: 'done', title: (r.data.meta && r.data.meta.title) || '',
              rawData: r.data, reportData: report, error: null,
              startedAt: r.data.meta.timestamp, completedAt: r.data.meta.timestamp
            });
          });
          _crawlSession.status = 'complete';
          _crawlSession.summary = MilgCrawl.buildSummary(_crawlSession);
          // Show results
          crawlResults.style.display = '';
          var reportActions = document.getElementById('reportActions');
          if (reportActions) reportActions.style.display = '';
          renderCrawlTabs();
          showCrawlPageContent('summary');
          // Switch to URL tab and enable crawl mode
          document.querySelectorAll('.tab-btn').forEach(function(t) { t.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
          var urlTab = document.querySelector('[data-tab="tabUrl"]');
          if (urlTab) urlTab.classList.add('active');
          var tabUrl = document.getElementById('tabUrl');
          if (tabUrl) tabUrl.classList.add('active');
          if (crawlSiteCheck) crawlSiteCheck.checked = true;
          if (crawlOptions) crawlOptions.style.display = '';
        }
      }
    } catch(e) { console.error('Failed to load snippet crawl data:', e); }

    // Crawl export wiring — override export buttons when crawl is active
    var exportSeverityFilter = document.getElementById('exportSeverityFilter');
    var copyMdBtn = document.getElementById('copyMdBtn');
    var markdownBtn = document.getElementById('markdownBtn');
    var exportJsonBtn = document.getElementById('exportJsonBtn');

    function isCrawlActive() { return _crawlSession && _crawlSession.pages.length > 0 && crawlResults.style.display !== 'none'; }

    // Wrap export handlers — add crawl check before each
    if (copyMdBtn) {
      var _origCopyMd = copyMdBtn.onclick;
      copyMdBtn.addEventListener('click', function(e) {
        if (!isCrawlActive()) return; // let original handler run
        e.stopImmediatePropagation();
        var filter = exportSeverityFilter ? exportSeverityFilter.value : 'all';
        var md = MilgCrawl.renderCrawlMarkdown(_crawlSession, filter);
        navigator.clipboard.writeText(md).then(function() { showToast('Crawl report copied as Markdown!'); }).catch(function() { showToast('Copy failed'); });
      });
    }
    if (markdownBtn) {
      markdownBtn.addEventListener('click', function(e) {
        if (!isCrawlActive()) return;
        e.stopImmediatePropagation();
        var filter = exportSeverityFilter ? exportSeverityFilter.value : 'all';
        var md = MilgCrawl.renderCrawlMarkdown(_crawlSession, filter);
        var blob = new Blob([md], { type: 'text/markdown' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'site-crawl-report.md'; a.click();
      });
    }
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', function(e) {
        if (!isCrawlActive()) return;
        e.stopImmediatePropagation();
        var filter = exportSeverityFilter ? exportSeverityFilter.value : 'all';
        var json = MilgCrawl.renderCrawlJSON(_crawlSession, filter);
        var blob = new Blob([json], { type: 'application/json' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'site-crawl-data.json'; a.click();
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

    // Detect empty/blocked/JS-dependent pages (skip for console snippet — JS already executed)
    var warningHtml = '';
    var inputMethod = (data.meta && data.meta._inputMethod) || '';
    var isUrlFetch = inputMethod === 'url';
    var elCount = (data.structure && data.structure.totalElements) || 0;
    var contentWidth = parseFloat(data.spacing && data.spacing.maxContentWidth) || 0;
    var contrastPairCount = (data.colors && data.colors.contrastPairs) ? data.colors.contrastPairs.length : 0;
    var headingCount = (data.typography && data.typography.headings) ? data.typography.headings.length : 0;
    var hasLimitedContent = elCount < 20 || contentWidth < 100;
    // JS-dependent pages: have HTML elements but almost no visible text/headings
    var isJsDependent = elCount > 20 && contrastPairCount < 3 && headingCount < 1;
    // Also flag pages with very few text colors (likely unstyled/broken render)
    var textColorCount = (data.colors && data.colors.textColors) ? data.colors.textColors.length : 0;
    var isBareBones = elCount > 5 && elCount < 50 && textColorCount <= 2 && contentWidth < 200;
    // Only show JS-required warning for URL fetch — paste/editor/console modes don't need it
    if (isUrlFetch && (hasLimitedContent || isJsDependent || isBareBones)) {
      var reason = hasLimitedContent
        ? 'Limited content detected (' + elCount + ' elements)'
        : isJsDependent
        ? 'This page requires JavaScript to render (' + elCount + ' elements but almost no visible text)'
        : 'Page appears incomplete or improperly loaded (' + elCount + ' elements, ' + textColorCount + ' text colors)';
      var isDark = document.body.classList.contains('dark-ui');
      var wBg = isDark ? '#2d2006' : '#fffbeb';
      var wBorder = isDark ? '#92400e' : '#f59e0b';
      var wText = isDark ? '#fbbf24' : '#92400e';
      var wStrong = isDark ? '#fcd34d' : '#78350f';
      var wTipBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)';
      var wTipBorder = isDark ? '#92400e' : '#fbbf24';
      var wCodeBg = isDark ? '#451a03' : '#fef3c7';
      warningHtml = '<div style="padding:16px 20px;background:' + wBg + ';border:2px solid ' + wBorder + ';border-radius:var(--radius);margin-bottom:16px;font-size:14px;line-height:1.6">' +
        '<strong style="color:' + wStrong + ';font-size:15px">' + reason + '</strong>' +
        '<p style="color:' + wText + ';margin:6px 0">The URL analysis reads only static HTML and CSS. JavaScript is not executed for your security — running unknown scripts in your browser is dangerous. ' +
        'Sites built with JS frameworks (React, Angular, Vue), or protected by Cloudflare/login, will appear empty.</p>' +
        '<p style="color:' + wText + ';margin:6px 0"><strong>The results below are unreliable</strong> — they score the empty shell, not the actual page.</p>' +
        '<div style="margin-top:12px;padding:12px 16px;background:' + wTipBg + ';border-radius:8px;border:1px solid ' + wTipBorder + '">' +
        '<strong style="color:' + wStrong + ';font-size:14px">How to analyze this page accurately:</strong>' +
        '<ol style="color:' + wText + ';margin:8px 0 0;padding-left:20px;font-size:13px">' +
        '<li>Open the page in your browser and navigate to it normally</li>' +
        '<li>Click <strong>New Analysis</strong> above, then switch to the <strong>Console Snippet</strong> tab</li>' +
        '<li>Copy the snippet, open DevTools (<code style="background:' + wCodeBg + ';padding:1px 4px;border-radius:3px">F12</code>), paste into Console, press Enter</li>' +
        '<li>Come back here and paste the result — you\'ll get a full, accurate analysis</li>' +
        '</ol>' +
        '</div>' +
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
        // Detect proxy error pages (Cloudflare challenges, 4xx/5xx error pages, consent walls)
        var htmlStart = (html || '').substring(0, 3000);
        if (html && (
          /class="no-js.*oldie"/i.test(htmlStart) || // Cloudflare error template
          /cf-error-details|cf-wrapper/i.test(htmlStart) ||
          /Access Denied|403 Forbidden/i.test(htmlStart) ||
          /Just a moment|Checking your browser/i.test(htmlStart) || // Cloudflare challenge
          /consent\.google|accounts\.google.*ServiceLogin/i.test(htmlStart) // Google consent/login redirect
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

  function analyzeHtmlInIframe(html, callback, sourceUrlOrDark, excludeSelectorOrEffectCSS, captureScreenshots) {
    // Support both signatures:
    // analyzeHtmlInIframe(html, cb, sourceUrl, excludeSelector, screenshots) — URL mode
    // analyzeHtmlInIframe(html, cb, dark, effectCSS, screenshots) — editor preview mode
    var sourceUrl = typeof sourceUrlOrDark === 'string' ? sourceUrlOrDark : null;
    var excludeSelector = typeof excludeSelectorOrEffectCSS === 'string' && !sourceUrl ? null : excludeSelectorOrEffectCSS;
    var editorDark = typeof sourceUrlOrDark === 'boolean' ? sourceUrlOrDark : false;
    var editorEffectCSS = (!sourceUrl && typeof excludeSelectorOrEffectCSS === 'string') ? excludeSelectorOrEffectCSS : '';
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
        // If hidden panels were detected, trigger unhidden screenshot pass
        var hpc = iframe._milgData.layout && iframe._milgData.layout.hiddenPanelCount;
        if (hpc > 0 && iframe.contentWindow && iframe.contentWindow.__milgDoUnhiddenScreenshots) {
          try {
            setTimeout(function() { iframe.contentWindow.__milgDoUnhiddenScreenshots(); }, 100);
          } catch(ex) { finish(iframe._milgData); }
        } else {
          finish(iframe._milgData);
        }
      }
      if (e.data.type === 'milg-screenshots-unhidden' && iframe._milgData) {
        iframe._milgData.screenshotsUnhidden = e.data.screenshots || [];
        finish(iframe._milgData);
      }
    }
    window.addEventListener('message', onMsg);

    // If the pasted HTML is a full document (has <html> or <head>), use it as-is
    // and just append the extraction script. Otherwise wrap in a basic document.
    var isFullDoc = /<html[\s>]/i.test(html) || /<!DOCTYPE/i.test(html);
    // Inject <base> tag so relative CSS/image/font URLs resolve to the original domain
    if (sourceUrl) html = injectBaseTag(html, sourceUrl);
    // Pass context to extraction
    var excludeVar = excludeSelector ? '<script>window.__milgExclude=' + JSON.stringify(excludeSelector) + ';</' + 'script>' : '';
    var fragmentVar = !isFullDoc ? '<script>window.__milgIsFragment=true;</' + 'script>' : '';
    // Screenshot capture: script that auto-runs after extraction, loads CDN library, captures page
    // Also includes unhidden-panels screenshot if hidden panels are detected
    var unhiddenScreenshotFn = 'window.__milgDoUnhiddenScreenshots=function(){' +
      // Unhide all interactive panels using !important overrides
      'var panels=document.querySelectorAll("[role=menu],[role=listbox],[role=dialog],[role=tooltip],[role=alertdialog]");' +
      'var hidden=[];' +
      'panels.forEach(function(p){' +
        'var s=getComputedStyle(p);' +
        'if(s.display==="none"||s.visibility==="hidden"||s.opacity==="0"){' +
          'hidden.push({el:p,css:p.style.cssText,ariaH:p.getAttribute("aria-hidden"),hadHidden:p.hasAttribute("hidden")});' +
          'p.style.cssText=p.style.cssText+";display:block !important;visibility:visible !important;opacity:1 !important;";' +
          'if(p.hasAttribute("hidden"))p.removeAttribute("hidden");' +
          'if(p.getAttribute("aria-hidden")==="true")p.setAttribute("aria-hidden","false")' +
        '}' +
      '});' +
      // Also check aria-haspopup sibling panels
      'document.querySelectorAll("[aria-haspopup]").forEach(function(t){' +
        'var w=t.parentElement;if(!w)return;' +
        'w.querySelectorAll("[role=menu],[role=listbox],[role=dialog]").forEach(function(p){' +
          'var s=getComputedStyle(p);' +
          'if(s.display==="none"||s.visibility==="hidden"||s.opacity==="0"){' +
            'hidden.push({el:p,css:p.style.cssText,ariaH:p.getAttribute("aria-hidden"),hadHidden:p.hasAttribute("hidden")});' +
            'p.style.cssText=p.style.cssText+";display:block !important;visibility:visible !important;opacity:1 !important;";' +
            'if(p.hasAttribute("hidden"))p.removeAttribute("hidden");' +
            'if(p.getAttribute("aria-hidden")==="true")p.setAttribute("aria-hidden","false")' +
          '}' +
        '})' +
      '});' +
      'if(hidden.length===0){parent.postMessage({type:"milg-screenshots-unhidden",screenshots:[]},"*");return}' +
      // Force reflow then capture
      'void document.body.offsetHeight;' +
      'setTimeout(function(){' + buildScreenshotScript('milg-screenshots-unhidden') +
      // Restore will happen after screenshots are taken — we don't need to restore in iframe since it's destroyed
      '},300)' +
    '};';
    var screenshotScript = captureScreenshots ? '<script>window.__milgDoScreenshots=function(){' + buildScreenshotScript('milg-screenshots-result') + '};' + unhiddenScreenshotFn + '</' + 'script>' : '';
    var srcdoc;
    if (isFullDoc) {
      // Wait for window load (CSS/fonts loaded), then extra delay for rendering
      var extractScript = excludeVar + fragmentVar + screenshotScript + '<script>window.addEventListener("load",function(){setTimeout(function(){(' + extractFromDocument.toString() + ')()},1000)});setTimeout(function(){(' + extractFromDocument.toString() + ')()},8000);</' + 'script>';
      if (/<\/body>/i.test(html)) {
        srcdoc = html.replace(/<\/body>/i, extractScript + '</body>');
      } else {
        srcdoc = html + extractScript;
      }
    } else {
      var darkClass = editorDark ? ' class="dark"' : '';
      var darkVariantTag = editorDark ? '<style type="text/tailwindcss">@custom-variant dark (&:where(.dark, .dark *));</style>' : '';
      var effectTag = editorEffectCSS ? '<style>' + editorEffectCSS + '</style>' : '';
      srcdoc = '<!DOCTYPE html><html lang="en"' + darkClass + '><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></' + 'script>' +
        darkVariantTag + effectTag +
        '<style>body{margin:0}</style></head><body>' +
        html + excludeVar + fragmentVar + screenshotScript +
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
          typography: { bodyFontSize: '16px', bodyLineHeight: '24px', bodyFontFamily: 'sans-serif', fontFamilies: [], fontSizes: [], fontWeights: [], headings: [], lineHeights: [], maxLineLength: { chars: 0, element: '', fontSize: 0, textLength: 0 } },
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
  function getScreenshotSettings() {
    var sel = document.getElementById('screenshotQuality');
    if (!sel) return { scale: 0.5, quality: 0.7 };
    var parts = sel.value.split('|');
    return { scale: parseFloat(parts[0]) || 0.5, quality: parseFloat(parts[1]) || 0.7 };
  }

  function buildScreenshotScript(msgType) {
    // Runs inside iframe. Loads modern-screenshot, captures page as viewport-height
    // sections as WebP. Scale and quality come from UI selector.
    var ss = getScreenshotSettings();
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
            'ms.domToCanvas(document.documentElement,{scale:' + ss.scale + '}).then(function(c){' +
              'c.toBlob(function(b){' +
                'if(!b){y+=vh;next();return}' +
                'var r=new FileReader();' +
                'r.onloadend=function(){shots.push(r.result);y+=vh;next()};' +
                'r.readAsDataURL(b)' +
              '},"image/webp",' + ss.quality + ')' +
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
