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
    var textColorSample = {}, bgColorSample = {}; // Store one sample selector per color
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
      var elRect = el.getBoundingClientRect();
      if (ratio < 7.5) {
        contrastPairs.push({ fg: rgbStr(fgBlended), bg: rgbStr(bg), ratio: Math.round(ratio * 100) / 100, needed: threshold, passes: ratio >= threshold, fontSize: Math.round(fontSize), fontWeight: fontWeight, isLarge: isLarge, text: node.textContent.trim().substring(0, 50), selector: cssSelector(el), filter: filterValue, backdropFilter: hasBackdropFilter, minBgAlpha: Math.round(minBgAlpha * 100) / 100, bbox: { left: Math.round(elRect.left + window.scrollX), top: Math.round(elRect.top + window.scrollY), width: Math.round(elRect.width), height: Math.round(elRect.height) } });
      }
      var elWidth = elRect.width;
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
    function mapToSorted(map, sampleMap) { return Object.keys(map).map(function(k) { return { value: k, count: map[k], sample: sampleMap ? (sampleMap[k] || '') : '' }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 30); }
    data.typography.fontSizes = mapToSorted(fontSizeMap);
    data.typography.fontWeights = mapToSorted(fontWeightMap);
    data.typography.fontFamilies = Array.from(fontFamilySet).slice(0, 10);
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
        touchIssues.push({ element: el.tagName.toLowerCase(), width: w, height: h, text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 40), selector: cssSelector(el), passes: false, isButton: el.tagName !== 'A' || linkCtx === 'button' || linkCtx === 'nav', linkContext: linkCtx, bbox: { left: Math.round(rect.left + window.scrollX), top: Math.round(rect.top + window.scrollY), width: w, height: h } });
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

  return extractFromDocument;
})();
