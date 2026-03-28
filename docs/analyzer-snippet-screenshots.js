// make-it-look-good — Design Extraction Snippet (with screenshots)
// Run this in the browser console on any page.
// Loads modern-screenshot from CDN to capture page screenshots as WebP.
// Output is larger (~200-800KB extra) but includes visual reference.
// Then paste into the analyzer at: https://yourusername.github.io/make-it-look-good/analyzer.html

(function() {
  'use strict';

  // --- Auto-scroll option ---
  // To scroll the page before extraction (triggers lazy loading + intersection observers):
  // Run: window.__milgScrollFirst = true   then paste the snippet.
  // The snippet will scroll the full page, wait for content to load, then extract.
  if (window.__milgScrollFirst && !window.__milgScrollDone) {
    window.__milgScrollDone = true;
    console.log('%c⏳ Scrolling page to trigger lazy loading and intersection observers...', 'color: #3b82f6; font-weight: bold;');
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
          console.log('%c✓ Scroll complete! Page content should now be fully loaded.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
          console.log('%cRe-run the snippet now for complete analysis.', 'color: #3b82f6;');
          window.__milgScrollFirst = false;
        }, 1500);
      }
    }, 150);
    return; // Exit — re-run snippet after scroll completes
  }

  // --- Color utilities ---
  // Canvas-based color parser: handles rgb, rgba, hsl, oklch, oklab, color() — anything the browser supports
  var _parseCanvas = document.createElement('canvas');
  _parseCanvas.width = 1; _parseCanvas.height = 1;
  var _parseCtx = _parseCanvas.getContext('2d', { willReadFrequently: true });

  // Reusable span for measuring actual character widths
  var _measureSpan = document.createElement('span');
  _measureSpan.style.cssText = 'position:absolute;top:-9999px;left:-9999px;visibility:hidden;white-space:nowrap;';
  _measureSpan.textContent = 'abcdefghijklmnopqrstuvwxyz0123456789';
  document.body.appendChild(_measureSpan);

  function parseColor(str) {
    if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)' || str === 'rgba(0, 0, 0, 0)') return null;
    // Fast path: comma-separated rgb(r, g, b) / rgba(r, g, b, a)
    var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
    // Fast path: space-separated rgb(r g b) / rgb(r g b / a) (modern CSS)
    var m2 = str.match(/rgba?\((\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+%?))?\)/);
    if (m2) { var a = m2[4] !== undefined ? (m2[4].indexOf('%') !== -1 ? parseFloat(m2[4]) / 100 : +m2[4]) : 1; return { r: +m2[1], g: +m2[2], b: +m2[3], a: a }; }
    // Check for explicit zero alpha in any format
    if (/\/\s*0\s*[\)%]/.test(str)) return null;
    // Canvas fallback for oklch, oklab, hsl, color(), etc.
    _parseCtx.clearRect(0, 0, 1, 1);
    _parseCtx.fillStyle = 'rgba(0,0,0,0)';
    _parseCtx.fillStyle = str;
    _parseCtx.fillRect(0, 0, 1, 1);
    var d = _parseCtx.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0) return null;
    return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 };
  }

  // Gradient color sampler: renders a CSS gradient to canvas and samples the center pixel
  var _gradCanvas = document.createElement('canvas');
  var _gradCtx = _gradCanvas.getContext('2d', { willReadFrequently: true });

  function getGradientColor(el) {
    var bgImage = getComputedStyle(el).backgroundImage;
    if (!bgImage || bgImage === 'none' || bgImage.indexOf('gradient') === -1) return null;

    var rect = el.getBoundingClientRect();
    var w = Math.round(rect.width) || 1;
    var h = Math.round(rect.height) || 1;
    // Cap canvas size to avoid performance issues
    var scale = 1;
    if (w > 200 || h > 200) scale = Math.min(200 / w, 200 / h);
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    _gradCanvas.width = cw;
    _gradCanvas.height = ch;

    // Try radial-gradient: just extract the first color stop
    if (bgImage.indexOf('radial-gradient') !== -1) {
      var radialStops = bgImage.match(/(?:rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/g);
      if (radialStops && radialStops.length > 0) {
        var fc = parseColor(radialStops[0]);
        if (fc && fc.a > 0) return { r: fc.r, g: fc.g, b: fc.b, a: fc.a };
      }
      return null;
    }

    // Parse linear-gradient
    // Browsers normalize computed style to: linear-gradient(Xdeg, color stop%, color stop%, ...)
    var angleMatch = bgImage.match(/linear-gradient\(\s*(\d+(?:\.\d+)?)deg/);
    if (!angleMatch) {
      // Try keyword directions or no angle (defaults to 180deg)
      var dirMatch = bgImage.match(/linear-gradient\(\s*to\s+(top|bottom|left|right)/);
      var angleDeg = 180; // default: top to bottom
      if (dirMatch) {
        var dirMap = { 'top': 0, 'bottom': 180, 'left': 270, 'right': 90 };
        angleDeg = dirMap[dirMatch[1]] || 180;
      } else if (!bgImage.match(/linear-gradient\(\s*\d/)) {
        // No angle specified at all, default 180
        angleDeg = 180;
      } else {
        return null;
      }
    } else {
      angleDeg = parseFloat(angleMatch[1]);
    }

    // Extract color stops: match color values followed by optional percentage
    var stopRegex = /(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})\s*([\d.]+%)?/g;
    var stops = [];
    var match;
    while ((match = stopRegex.exec(bgImage)) !== null) {
      var color = parseColor(match[1]);
      if (!color) continue;
      var pos = match[2] ? parseFloat(match[2]) / 100 : null;
      stops.push({ color: color, pos: pos });
    }
    if (stops.length < 2) return null;

    // Fill in missing positions: first=0, last=1, interpolate between
    if (stops[0].pos === null) stops[0].pos = 0;
    if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
    for (var i = 1; i < stops.length - 1; i++) {
      if (stops[i].pos === null) {
        // Find next stop with a position
        var prev = i - 1;
        var next = i + 1;
        while (next < stops.length && stops[next].pos === null) next++;
        stops[i].pos = stops[prev].pos + (stops[next].pos - stops[prev].pos) * ((i - prev) / (next - prev));
      }
    }

    // Convert CSS angle to canvas gradient coordinates
    // CSS angles: 0deg = bottom-to-top, 90deg = left-to-right, 180deg = top-to-bottom
    var rad = (angleDeg - 90) * Math.PI / 180;
    var diagLen = Math.sqrt(cw * cw + ch * ch) / 2;
    var cx = cw / 2, cy = ch / 2;
    var dx = Math.cos(rad) * diagLen;
    var dy = Math.sin(rad) * diagLen;

    try {
      var grad = _gradCtx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      for (var i = 0; i < stops.length; i++) {
        var sc = stops[i].color;
        var rgba = 'rgba(' + sc.r + ',' + sc.g + ',' + sc.b + ',' + sc.a + ')';
        grad.addColorStop(Math.max(0, Math.min(1, stops[i].pos)), rgba);
      }
      _gradCtx.fillStyle = grad;
      _gradCtx.fillRect(0, 0, cw, ch);

      // Sample center pixel
      var px = Math.round(cw / 2);
      var py = Math.round(ch / 2);
      var d = _gradCtx.getImageData(Math.min(px, cw - 1), Math.min(py, ch - 1), 1, 1).data;
      if (d[3] === 0) return null;
      return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 };
    } catch(e) {
      return null;
    }
  }

  function blendOnWhite(c) {
    if (!c) return { r: 255, g: 255, b: 255 };
    var a = c.a;
    return {
      r: Math.round(c.r * a + 255 * (1 - a)),
      g: Math.round(c.g * a + 255 * (1 - a)),
      b: Math.round(c.b * a + 255 * (1 - a))
    };
  }

  function getBgImageColor(el) {
    var bgi = getComputedStyle(el).backgroundImage;
    if (!bgi || bgi === 'none' || bgi.indexOf('url(') === -1 || bgi.indexOf('gradient') !== -1) return null;
    var urlMatch = bgi.match(/url\(["']?([^"')]+)["']?\)/);
    if (!urlMatch) return null;
    try {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = urlMatch[1];
      if (!img.complete || img.naturalWidth === 0) return null;
      var c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var sx = Math.round(img.naturalWidth / 2);
      var sy = Math.round(img.naturalHeight / 2);
      var d = ctx.getImageData(sx, sy, 1, 1).data;
      if (d[3] === 0) return null;
      return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 };
    } catch(e) { return null; }
  }

  function getEffectiveBg(el) {
    var node = el;
    var layers = [];
    while (node && node !== document.documentElement) {
      var bg = getComputedStyle(node).backgroundColor;
      var c = parseColor(bg);
      if (!c || c.a === 0) {
        // backgroundColor is transparent — check for gradient
        c = getGradientColor(node);
      }
      if (!c || c.a === 0) c = getBgImageColor(node);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
      node = node.parentElement;
    }
    var result = { r: 255, g: 255, b: 255 };
    for (var i = layers.length - 1; i >= 0; i--) {
      var l = layers[i];
      var a = l.a;
      result = {
        r: Math.round(l.r * a + result.r * (1 - a)),
        g: Math.round(l.g * a + result.g * (1 - a)),
        b: Math.round(l.b * a + result.b * (1 - a))
      };
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

  function rgbStr(c) {
    return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
  }

  function isVisible(el) {
    var s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function cssSelector(el) {
    if (el.id) return '#' + el.id;
    var tag = el.tagName.toLowerCase();
    var cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    return tag + cls;
  }

  // --- Extraction ---
  var data = {
    meta: {
      title: document.title,
      url: location.href,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      timestamp: new Date().toISOString(),
      version: 1
    },
    colors: { textColors: [], bgColors: [], contrastPairs: [] },
    typography: {
      bodyFontSize: '', bodyLineHeight: '', bodyFontFamily: '',
      fontFamilies: [], fontSizes: [], fontWeights: [],
      headings: [], lineHeights: [], maxLineLength: { chars: 0, element: '' }
    },
    spacing: { paddings: [], margins: [], gaps: [], maxContentWidth: '', bodyPaddingHorizontal: '' },
    layout: { sectionGaps: [], alignmentEdges: [], visualHierarchy: {} },
    interaction: { touchTargets: [], transitions: [] },
    accessibility: {
      semanticElements: {},
      headingHierarchy: [],
      imagesWithoutAlt: 0,
      formLabels: { total: 0, withLabel: 0, withoutLabel: 0 },
      focusIndicators: []
    },
    structure: {
      totalElements: 0, darkModeClasses: false, responsiveClasses: false,
      tailwindDetected: false, cssFramework: 'unknown'
    },
    context: { pageType: 'unknown', decorativeSelectors: [] }
  };

  var allElements = document.body.querySelectorAll('*');
  data.structure.totalElements = allElements.length;

  // --- Page context detection ---
  // Identify decorative/mock elements that shouldn't be scored
  var decorativeSelector = '[aria-hidden="true"], [role="img"], [role="presentation"], .mock, .mock-ui, [class*="mock-"], .demo, .screenshot, .preview, [data-decorative]';
  var decorativeEls = new Set();
  document.querySelectorAll(decorativeSelector).forEach(function(el) {
    decorativeEls.add(el);
    el.querySelectorAll('*').forEach(function(child) { decorativeEls.add(child); });
  });
  // Also detect pointer-events:none containers (visual-only)
  allElements.forEach(function(el) {
    if (getComputedStyle(el).pointerEvents === 'none' && el.querySelectorAll('a,button,input').length > 0) {
      decorativeEls.add(el);
      el.querySelectorAll('*').forEach(function(child) { decorativeEls.add(child); });
    }
  });

  function isDecorative(el) { return decorativeEls.has(el); }

  // Page type heuristics
  var hasHero = !!document.querySelector('.hero, [class*="hero"], section:first-of-type h1');
  var hasPricing = !!document.querySelector('[class*="pricing"], [class*="price"], .plan, .tier');
  var formCount = document.querySelectorAll('form').length;
  var navLinks = document.querySelectorAll('nav a').length;
  var sectionCount = document.querySelectorAll('section').length;
  if (hasPricing) data.context.pageType = 'pricing';
  else if (formCount > 0 && data.structure.totalElements < 80) data.context.pageType = 'form';
  else if (hasHero && sectionCount >= 3) data.context.pageType = 'marketing';
  else if (navLinks > 10) data.context.pageType = 'app';
  else if (sectionCount >= 2) data.context.pageType = 'content';
  else data.context.pageType = 'component';

  // Detect CSS framework
  var htmlStr = document.body.innerHTML;
  if (/class="[^"]*(?:sm:|md:|lg:|xl:)/.test(htmlStr) || /class="[^"]*(?:flex|grid|text-|bg-|p-|m-)/.test(htmlStr)) {
    data.structure.tailwindDetected = true;
    data.structure.cssFramework = 'tailwind';
  } else if (/class="[^"]*(?:col-md|col-sm|btn-primary|container-fluid)/.test(htmlStr)) {
    data.structure.cssFramework = 'bootstrap';
  }
  // Dark mode: check Tailwind dark: classes, .dark-ui/.dark-mode body classes, or prefers-color-scheme in stylesheets
  data.structure.darkModeClasses = /class="[^"]*dark:/.test(htmlStr)
    || document.body.classList.contains('dark-ui') || document.body.classList.contains('dark-mode')
    || document.documentElement.classList.contains('dark')
    || Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r.cssText && r.cssText.indexOf('prefers-color-scheme') !== -1; }); } catch(e) { return false; } });
  // Responsive: check Tailwind responsive classes OR CSS @media queries in stylesheets
  data.structure.responsiveClasses = /class="[^"]*(?:sm:|md:|lg:|xl:)/.test(htmlStr)
    || Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r instanceof CSSMediaRule && /max-width|min-width/.test(r.conditionText || ''); }); } catch(e) { return false; } });

  // --- Typography & Colors ---
  var fontSizeMap = {};
  var fontWeightMap = {};
  var fontFamilySet = new Set();
  var lineHeightMap = {};
  var textColorMap = {};
  var bgColorMap = {};

  // Body defaults
  var bodyStyle = getComputedStyle(document.body);
  data.typography.bodyFontSize = bodyStyle.fontSize;
  data.typography.bodyLineHeight = bodyStyle.lineHeight;
  data.typography.bodyFontFamily = bodyStyle.fontFamily;
  data.spacing.bodyPaddingHorizontal = bodyStyle.paddingLeft;

  // Walk text nodes for contrast
  var contrastPairs = [];
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  var node;
  var seenForContrast = new Set();

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

    // Check for CSS filters on ancestors that affect contrast
    var filterAncestor = el;
    var filterValue = '';
    while (filterAncestor && filterAncestor !== document.documentElement) {
      var f = getComputedStyle(filterAncestor).filter;
      if (f && f !== 'none') { filterValue = f; break; }
      filterAncestor = filterAncestor.parentElement;
    }

    // Collect all pairs up to AAA+buffer (7.5) so profile switching works
    if (ratio < 7.5) {
      contrastPairs.push({
        fg: rgbStr(fgBlended), bg: rgbStr(bg),
        ratio: Math.round(ratio * 100) / 100,
        needed: threshold,
        passes: ratio >= threshold,
        fontSize: Math.round(fontSize), fontWeight: fontWeight, isLarge: isLarge,
        text: node.textContent.trim().substring(0, 50),
        selector: cssSelector(el),
        filter: filterValue
      });
    }

    // Measure line length
    var range = document.createRange();
    range.selectNodeContents(el);
    var textLen = node.textContent.trim().length;
    if (textLen > data.typography.maxLineLength.chars && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.closest('pre') && !el.closest('code')) {
      // Measure actual character width using the hidden span
      var elWidth = el.getBoundingClientRect().width;
      _measureSpan.style.fontSize = style.fontSize;
      _measureSpan.style.fontFamily = style.fontFamily;
      var charWidth = _measureSpan.getBoundingClientRect().width / 36;
      var charsPerLine = Math.round(elWidth / charWidth);
      if (charsPerLine > data.typography.maxLineLength.chars) {
        data.typography.maxLineLength = { chars: charsPerLine, element: cssSelector(el) };
      }
    }
  }

  // Sort contrast pairs by severity, keep worst 50
  contrastPairs.sort(function(a, b) { return a.ratio - b.ratio; });
  data.colors.contrastPairs = contrastPairs.slice(0, 50);

  // Walk all elements for sizing, spacing, colors
  var paddingMap = {};
  var marginMap = {};
  var gapMap = {};
  var maxContentW = 0;

  for (var i = 0; i < allElements.length; i++) {
    var el = allElements[i];
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
    if (!isVisible(el)) continue;

    var s = getComputedStyle(el);

    // Font data
    var fs = s.fontSize;
    fontSizeMap[fs] = (fontSizeMap[fs] || 0) + 1;
    var fw = s.fontWeight;
    fontWeightMap[fw] = (fontWeightMap[fw] || 0) + 1;
    var ff = s.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    fontFamilySet.add(ff);
    var lh = s.lineHeight;
    if (lh !== 'normal') {
      var lhRatio = parseFloat(lh) / parseFloat(fs);
      var lhKey = Math.round(lhRatio * 100) / 100;
      lineHeightMap[lhKey] = (lineHeightMap[lhKey] || 0) + 1;
    }

    // Colors
    var textColor = s.color;
    if (textColor) textColorMap[textColor] = (textColorMap[textColor] || 0) + 1;
    var bgColor = s.backgroundColor;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      bgColorMap[bgColor] = (bgColorMap[bgColor] || 0) + 1;
    }

    // Spacing
    var pad = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].filter(function(v) { return v !== '0px'; });
    pad.forEach(function(v) { paddingMap[v] = (paddingMap[v] || 0) + 1; });
    var mar = [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft].filter(function(v) { return v !== '0px' && v !== 'auto'; });
    mar.forEach(function(v) { marginMap[v] = (marginMap[v] || 0) + 1; });
    if (s.gap && s.gap !== 'normal' && s.gap !== '0px') {
      gapMap[s.gap] = (gapMap[s.gap] || 0) + 1;
    }

    // Content width
    var w = el.getBoundingClientRect().width;
    if (w > maxContentW && w < window.innerWidth * 0.95) maxContentW = w;
  }

  // Convert maps to sorted arrays
  function mapToSorted(map) {
    return Object.keys(map).map(function(k) { return { value: k, count: map[k] }; })
      .sort(function(a, b) { return b.count - a.count; })
      .slice(0, 30);
  }

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

  // --- Headings ---
  var headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach(function(h) {
    var hs = getComputedStyle(h);
    data.typography.headings.push({
      tag: h.tagName.toLowerCase(),
      text: h.textContent.trim().substring(0, 60),
      fontSize: hs.fontSize,
      fontWeight: hs.fontWeight,
      lineHeight: hs.lineHeight,
      fontFamily: hs.fontFamily.split(',')[0].trim().replace(/['"]/g, '')
    });
    data.accessibility.headingHierarchy.push(h.tagName.toLowerCase());
  });

  // --- Layout analysis ---
  // Whitespace rhythm: measure gaps between top-level sections
  var sections = document.querySelectorAll('section, [class*="section"], main > div, main > article');
  var sectionGaps = [];
  var sortedSections = Array.from(sections).filter(function(s) { return isVisible(s) && !isDecorative(s); })
    .sort(function(a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
  for (var si = 1; si < sortedSections.length; si++) {
    var gap = Math.round(sortedSections[si].getBoundingClientRect().top - sortedSections[si - 1].getBoundingClientRect().bottom);
    if (gap >= 0) sectionGaps.push(gap);
  }
  data.layout.sectionGaps = sectionGaps;

  // Alignment consistency: collect left edges of major block elements
  var alignTargets = document.querySelectorAll('h1,h2,h3,h4,p,ul,ol,table,form,img,figure,blockquote');
  var leftEdges = [];
  Array.from(alignTargets).forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var r = el.getBoundingClientRect();
    if (r.width > 50) leftEdges.push(Math.round(r.left));
  });
  data.layout.alignmentEdges = leftEdges;

  // Visual hierarchy: heading size to body size ratios
  var bodyFS = parseFloat(data.typography.bodyFontSize) || 16;
  var h1Sizes = data.typography.headings.filter(function(h) { return h.tag === 'h1'; }).map(function(h) { return parseFloat(h.fontSize); });
  var h2Sizes = data.typography.headings.filter(function(h) { return h.tag === 'h2'; }).map(function(h) { return parseFloat(h.fontSize); });
  data.layout.visualHierarchy = {
    h1ToBody: h1Sizes.length > 0 ? Math.round((h1Sizes[0] / bodyFS) * 100) / 100 : 0,
    h2ToBody: h2Sizes.length > 0 ? Math.round((h2Sizes[0] / bodyFS) * 100) / 100 : 0,
    bodySize: bodyFS
  };

  // --- Touch targets ---
  var interactive = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [tabindex]');
  var touchTargetIssues = [];
  interactive.forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var rect = el.getBoundingClientRect();
    var w = Math.round(rect.width);
    var h = Math.round(rect.height);
    var passes = w >= 44 && h >= 44;
    // If element fails, check if wrapped in a larger clickable parent
    if (!passes) {
      var clickParent = el.closest('label, a');
      if (clickParent && clickParent !== el) {
        var parentRect = clickParent.getBoundingClientRect();
        if (Math.round(parentRect.width) >= 44 && Math.round(parentRect.height) >= 44) {
          passes = true; // Parent provides adequate click area
        }
      }
    }
    if (!passes) {
      touchTargetIssues.push({
        element: el.tagName.toLowerCase(),
        width: w, height: h,
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 40),
        selector: cssSelector(el),
        passes: false
      });
    }
  });
  // Keep worst 40
  touchTargetIssues.sort(function(a, b) { return (a.width * a.height) - (b.width * b.height); });
  data.interaction.touchTargets = touchTargetIssues.slice(0, 40);

  // Adjacent interactive element spacing — siblings only
  // Group interactive elements by parent, then check gaps between adjacent siblings
  var adjacentIssues = [];
  var parentGroups = new Map();
  interactive.forEach(function(el) {
    if (!isVisible(el)) return;
    // Skip decorative/mock elements
    if (el.closest('[aria-hidden="true"]') || el.closest('[role="img"]') || el.closest('.mock, .mock-ui, [class*="mock-"]')) return;
    if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') === '-1') return;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    var parent = el.parentElement;
    if (!parent) return;
    if (!parentGroups.has(parent)) parentGroups.set(parent, []);
    parentGroups.get(parent).push({ el: el, rect: rect });
  });
  parentGroups.forEach(function(children) {
    if (children.length < 2) return;
    // Sort by position (left-to-right, top-to-bottom)
    children.sort(function(a, b) { return a.rect.left - b.rect.left || a.rect.top - b.rect.top; });
    for (var i = 0; i < children.length - 1 && adjacentIssues.length < 15; i++) {
      var a = children[i].rect;
      var b = children[i + 1].rect;
      var sameRow = a.top < b.bottom && b.top < a.bottom;
      var sameCol = a.left < b.right && b.left < a.right;
      if (sameRow) {
        var hGap = Math.round(Math.max(0, b.left - a.right));
        if (hGap < 8) {
          adjacentIssues.push({ gap: hGap, direction: 'horizontal', elementA: cssSelector(children[i].el), elementB: cssSelector(children[i + 1].el), textA: (children[i].el.textContent || '').trim().substring(0, 30), textB: (children[i + 1].el.textContent || '').trim().substring(0, 30) });
        }
      } else if (sameCol) {
        var vGap = Math.round(Math.max(0, b.top - a.bottom));
        if (vGap < 8) {
          adjacentIssues.push({ gap: vGap, direction: 'vertical', elementA: cssSelector(children[i].el), elementB: cssSelector(children[i + 1].el), textA: (children[i].el.textContent || '').trim().substring(0, 30), textB: (children[i + 1].el.textContent || '').trim().substring(0, 30) });
        }
      }
    }
  });
  data.interaction.adjacentIssues = adjacentIssues;

  // Transitions
  var transitionSet = new Set();
  for (var i = 0; i < allElements.length && transitionSet.size < 20; i++) {
    var s = getComputedStyle(allElements[i]);
    var t = s.transitionDuration;
    if (t && t !== '0s') transitionSet.add(t);
  }
  data.interaction.transitions = Array.from(transitionSet);

  // --- Accessibility ---
  data.accessibility.semanticElements = {
    header: document.querySelectorAll('header').length,
    nav: document.querySelectorAll('nav').length,
    main: document.querySelectorAll('main').length,
    footer: document.querySelectorAll('footer').length,
    section: document.querySelectorAll('section').length,
    article: document.querySelectorAll('article').length,
    aside: document.querySelectorAll('aside').length
  };

  // Count top-level nav items (for cognitive load / profile checks)
  var navEls = document.querySelectorAll('nav');
  var navItemCount = 0;
  navEls.forEach(function(nav) {
    var topLinks = nav.querySelectorAll(':scope > a, :scope > ul > li > a, :scope > ol > li > a, :scope > button, :scope > ul > li > button');
    navItemCount += topLinks.length;
  });
  data.accessibility.navItemCount = navItemCount;

  // Images without alt
  var images = document.querySelectorAll('img');
  var noAlt = 0;
  images.forEach(function(img) {
    if (!img.hasAttribute('alt')) noAlt++;
  });
  data.accessibility.imagesWithoutAlt = noAlt;

  // Image sizing issues
  data.performance = { imageSizing: [] };
  images.forEach(function(img) {
    if (!isVisible(img)) return;
    var issues = [];
    // Missing explicit dimensions (causes CLS)
    if (!img.hasAttribute('width') && !img.hasAttribute('height') && !img.style.width && !img.style.height) {
      var s = getComputedStyle(img);
      if (s.width === 'auto' || s.height === 'auto' || (!s.aspectRatio || s.aspectRatio === 'auto')) {
        issues.push('no-dimensions');
      }
    }
    // Lazy loading on likely above-fold image
    if (img.hasAttribute('loading') && img.getAttribute('loading') === 'lazy') {
      var rect = img.getBoundingClientRect();
      if (rect.top < window.innerHeight) issues.push('lazy-above-fold');
    }
    // Oversized: natural size much larger than display size
    if (img.naturalWidth > 0 && img.width > 0) {
      var ratio = img.naturalWidth / img.width;
      if (ratio > 2.5) issues.push('oversized-' + Math.round(ratio) + 'x');
    }
    if (issues.length > 0) {
      data.performance.imageSizing.push({ src: (img.src || '').substring(0, 80), issues: issues, selector: cssSelector(img) });
    }
  });

  // Form labels
  var inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  var labeled = 0;
  inputs.forEach(function(inp) {
    data.accessibility.formLabels.total++;
    var hasLabel = inp.id && document.querySelector('label[for="' + inp.id + '"]');
    var wrapped = inp.closest('label');
    var hasAria = inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby');
    if (hasLabel || wrapped || hasAria) labeled++;
  });
  data.accessibility.formLabels.withLabel = labeled;
  data.accessibility.formLabels.withoutLabel = data.accessibility.formLabels.total - labeled;

  // Focus indicators (sample first 10 interactive elements)
  var focusSample = Array.from(interactive).slice(0, 10);
  focusSample.forEach(function(el) {
    if (!isVisible(el)) return;
    var s = getComputedStyle(el);
    data.accessibility.focusIndicators.push({
      element: cssSelector(el),
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      outlineColor: s.outlineColor,
      outlineOffset: s.outlineOffset
    });
  });
  // Also check if stylesheets contain focus-visible rules (can't detect via getComputedStyle)
  data.accessibility.hasFocusVisibleCSS = Array.from(document.styleSheets).some(function(ss) {
    try { return Array.from(ss.cssRules).some(function(r) { return r.selectorText && r.selectorText.indexOf('focus-visible') !== -1; }); } catch(e) { return false; }
  });

  // --- Font loading analysis ---
  data.performance.fontLoading = [];
  try {
    Array.from(document.styleSheets).forEach(function(ss) {
      try {
        Array.from(ss.cssRules).forEach(function(r) {
          if (r instanceof CSSFontFaceRule) {
            var display = r.style.fontDisplay || 'auto';
            if (display === 'auto' || display === 'block') {
              data.performance.fontLoading.push({ family: r.style.fontFamily, display: display });
            }
          }
        });
      } catch(e) {}
    });
  } catch(e) {}

  // --- Render-blocking resources ---
  data.performance.renderBlocking = {
    cssInHead: document.querySelectorAll('head link[rel="stylesheet"]:not([media="print"])').length,
    jsInHead: document.querySelectorAll('head script:not([async]):not([defer]):not([type="module"])').length
  };

  // --- DOM complexity ---
  data.performance.domSize = allElements.length;
  var maxDepth = 0;
  (function walkDepth(el, d) {
    if (d > maxDepth) maxDepth = d;
    if (d > 50) return;
    Array.from(el.children || []).forEach(function(c) { walkDepth(c, d + 1); });
  })(document.body, 0);
  data.performance.domDepth = maxDepth;

  // --- Animation & scroll-reveal detection ---
  data.animation = { hiddenElements: 0, keyframeCount: 0, hasReducedMotion: false, scrollRevealPatterns: [] };
  // Count elements that appear to be in pre-animation state (opacity:0 + transition/animation)
  var hiddenAnimated = 0;
  for (var ai = 0; ai < allElements.length; ai++) {
    var ael = allElements[ai];
    var as = getComputedStyle(ael);
    if (as.opacity === '0' && (as.transitionProperty !== 'none' || as.animationName !== 'none')) {
      hiddenAnimated++;
    }
    // Also detect off-screen transforms
    if (as.transform && as.transform !== 'none' && as.opacity !== '0') {
      var matrix = as.transform;
      // Check for translateY values > 50px (likely scroll-reveal)
      var translateMatch = matrix.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+)\)/);
      if (translateMatch && Math.abs(parseFloat(translateMatch[1])) > 50) {
        hiddenAnimated++;
      }
    }
  }
  data.animation.hiddenElements = hiddenAnimated;
  // Count @keyframes rules
  try {
    Array.from(document.styleSheets).forEach(function(ss) {
      try {
        Array.from(ss.cssRules).forEach(function(r) {
          if (r instanceof CSSKeyframesRule) data.animation.keyframeCount++;
          if (r instanceof CSSMediaRule && /prefers-reduced-motion/.test(r.conditionText || '')) data.animation.hasReducedMotion = true;
        });
      } catch(e) {}
    });
  } catch(e) {}
  // Detect common scroll-reveal library patterns
  var revealClasses = ['[data-aos]', '.wow', '.reveal', '[class*="animate-on-scroll"]', '[class*="scroll-reveal"]', '.fade-in', '.slide-up'];
  revealClasses.forEach(function(sel) {
    try { var count = document.querySelectorAll(sel).length; if (count > 0) data.animation.scrollRevealPatterns.push({ selector: sel, count: count }); } catch(e) {}
  });
  if (data.animation.scrollRevealPatterns.length > 0 && !window.__milgScrolled) {
    console.log('%c⚠ Scroll-reveal elements detected. For complete analysis, scroll the full page first, then re-run the snippet.', 'color: #b45309; font-weight: bold;');
  }

  // --- Accessibility extras ---
  data.accessibility.langAttribute = document.documentElement.getAttribute('lang') || '';
  data.accessibility.hasSkipLink = !!document.querySelector('a[href^="#main"], a[href^="#content"], a.skip-link, a.skip-nav, [class*="skip"]');

  var badLinkTexts = [];
  document.querySelectorAll('a').forEach(function(a) {
    if (!isVisible(a) || isDecorative(a)) return;
    var text = (a.textContent || '').trim().toLowerCase();
    if (['click here', 'here', 'read more', 'learn more', 'more', 'link'].indexOf(text) !== -1) {
      badLinkTexts.push({ text: text, selector: cssSelector(a) });
    }
  });
  data.accessibility.badLinkTexts = badLinkTexts.slice(0, 10);

  // Detect autocomplete on common form fields
  var formFields = document.querySelectorAll('input[type="email"], input[type="tel"], input[name*="name"], input[name*="address"]');
  var missingAutocomplete = 0;
  formFields.forEach(function(f) { if (!f.getAttribute('autocomplete')) missingAutocomplete++; });
  data.accessibility.missingAutocomplete = missingAutocomplete;

  // --- Responsive extras ---
  // Viewport meta
  var vpMeta = document.querySelector('meta[name="viewport"]');
  data.structure.viewportMeta = vpMeta ? vpMeta.getAttribute('content') : '';
  data.structure.blocksZoom = vpMeta ? /user-scalable\s*=\s*no/i.test(vpMeta.getAttribute('content') || '') : false;
  // Horizontal overflow
  data.structure.hasHorizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;

  // --- Performance extras ---
  // Third-party scripts
  var ownHost = location.hostname;
  var thirdPartyScripts = 0;
  document.querySelectorAll('script[src]').forEach(function(s) {
    try { if (new URL(s.src).hostname !== ownHost) thirdPartyScripts++; } catch(e) {}
  });
  data.performance.thirdPartyScripts = thirdPartyScripts;

  // Image formats
  var imgFormats = { modern: 0, legacy: 0 };
  document.querySelectorAll('img[src]').forEach(function(img) {
    var src = (img.src || '').toLowerCase();
    if (/\.(webp|avif)/.test(src)) imgFormats.modern++;
    else if (/\.(jpg|jpeg|png|gif|bmp)/.test(src)) imgFormats.legacy++;
  });
  data.performance.imageFormats = imgFormats;

  // --- Consistency extras ---
  // Border radius values
  var radiusMap = {};
  for (var ci = 0; ci < allElements.length && ci < 1000; ci++) {
    var cel = allElements[ci];
    if (!isVisible(cel) || isDecorative(cel)) continue;
    var cr = getComputedStyle(cel).borderRadius;
    if (cr && cr !== '0px') radiusMap[cr] = (radiusMap[cr] || 0) + 1;
  }
  data.layout.borderRadii = Object.keys(radiusMap).map(function(k) { return { value: k, count: radiusMap[k] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 15);

  // --- Readability extras ---
  // Paragraph text extraction for readability scoring
  var paragraphs = document.querySelectorAll('main p, article p, section p, .content p');
  if (paragraphs.length === 0) paragraphs = document.querySelectorAll('p');
  var textBlocks = [];
  paragraphs.forEach(function(p) {
    if (!isVisible(p) || isDecorative(p)) return;
    var text = (p.textContent || '').trim();
    if (text.length > 20) textBlocks.push({ text: text, wordCount: text.split(/\s+/).length, charCount: text.length });
  });
  data.readability = {
    textBlocks: textBlocks.slice(0, 30),
    totalWords: textBlocks.reduce(function(s, b) { return s + b.wordCount; }, 0),
    totalChars: textBlocks.reduce(function(s, b) { return s + b.charCount; }, 0),
    paragraphCount: textBlocks.length,
    hasLists: document.querySelectorAll('main ul, main ol, article ul, article ol').length > 0 || document.querySelectorAll('ul, ol').length > 3
  };

  // --- Responsive touch note data ---
  // Check if site has responsive CSS that might adjust touch targets at mobile
  data.interaction.hasResponsiveTargetCSS = false;
  try {
    Array.from(document.styleSheets).some(function(ss) {
      try {
        return Array.from(ss.cssRules).some(function(r) {
          if (r instanceof CSSMediaRule && /max-width|min-width/.test(r.conditionText || '')) {
            var text = r.cssText || '';
            return /min-height|padding|height.*4[4-8]|height.*rem/.test(text);
          }
          return false;
        });
      } catch(e) { return false; }
    });
  } catch(e) {}

  // --- Element overflow detection ---
  data.layout.overflowElements = 0;
  for (var oi = 0; oi < allElements.length && oi < 500; oi++) {
    var oel = allElements[oi];
    if (!isVisible(oel) || isDecorative(oel)) continue;
    if (oel.scrollWidth > oel.clientWidth + 2 && oel.clientWidth > 0) {
      data.layout.overflowElements++;
    }
  }

  // --- Letter spacing issues ---
  data.typography.letterSpacingIssues = 0;
  for (var li = 0; li < allElements.length && li < 500; li++) {
    var lel = allElements[li];
    if (!isVisible(lel) || isDecorative(lel) || lel.tagName === 'SCRIPT' || lel.tagName === 'STYLE') continue;
    var ls = getComputedStyle(lel).letterSpacing;
    if (ls && ls !== 'normal') {
      var lsEm = parseFloat(ls) / parseFloat(getComputedStyle(lel).fontSize);
      if (lsEm < -0.03 || (lsEm > 0.15 && parseFloat(getComputedStyle(lel).fontSize) >= 14)) {
        data.typography.letterSpacingIssues++;
      }
    }
  }

  // --- ARIA audit ---
  data.accessibility.ariaIssues = [];
  // role="button" without keyboard handler
  document.querySelectorAll('[role="button"]:not(button):not(a)').forEach(function(el) {
    if (!el.hasAttribute('tabindex')) {
      data.accessibility.ariaIssues.push({ type: 'button-no-tabindex', selector: cssSelector(el) });
    }
  });
  // aria-hidden on focusable elements
  document.querySelectorAll('[aria-hidden="true"] a, [aria-hidden="true"] button, [aria-hidden="true"] input, [aria-hidden="true"] [tabindex]').forEach(function(el) {
    if (isVisible(el)) {
      data.accessibility.ariaIssues.push({ type: 'hidden-focusable', selector: cssSelector(el) });
    }
  });
  if (data.accessibility.ariaIssues.length > 20) data.accessibility.ariaIssues = data.accessibility.ariaIssues.slice(0, 20);

  // --- Image responsive sizing ---
  data.performance.nonResponsiveImages = 0;
  document.querySelectorAll('img').forEach(function(img) {
    if (!isVisible(img)) return;
    var s = getComputedStyle(img);
    var hasMaxWidth = s.maxWidth === '100%' || s.maxWidth === 'none';
    var hasAutoHeight = s.height === 'auto';
    if (img.naturalWidth > 0 && img.naturalWidth > img.clientWidth + 10) {
      if (s.maxWidth !== '100%' && s.width !== '100%' && !s.width.endsWith('%')) {
        data.performance.nonResponsiveImages++;
      }
    }
  });

  // --- CLS (Chromium only) ---
  data.performance.cls = null;
  try {
    if (window.PerformanceObserver) {
      var clsEntries = performance.getEntriesByType ? performance.getEntriesByType('layout-shift') : [];
      if (clsEntries.length > 0) {
        var clsValue = 0;
        clsEntries.forEach(function(e) { if (!e.hadRecentInput) clsValue += e.value; });
        data.performance.cls = Math.round(clsValue * 1000) / 1000;
      }
    }
  } catch(e) {}

  // --- Paragraph spacing ---
  var pSpacings = [];
  document.querySelectorAll('p').forEach(function(p) {
    if (!isVisible(p) || isDecorative(p)) return;
    var mb = parseFloat(getComputedStyle(p).marginBottom);
    if (mb > 0) pSpacings.push(mb);
  });
  data.typography.paragraphSpacing = pSpacings;

  // --- Negative margins ---
  data.spacing.negativeMargins = 0;
  for (var ni = 0; ni < allElements.length && ni < 500; ni++) {
    var nel = allElements[ni];
    if (!isVisible(nel)) continue;
    var ns = getComputedStyle(nel);
    if (parseFloat(ns.marginTop) < 0 || parseFloat(ns.marginRight) < 0 || parseFloat(ns.marginBottom) < 0 || parseFloat(ns.marginLeft) < 0) {
      data.spacing.negativeMargins++;
    }
  }

  // --- LCP estimation ---
  data.performance.lcp = null;
  try {
    var lcpEntries = performance.getEntriesByType ? performance.getEntriesByType('largest-contentful-paint') : [];
    if (lcpEntries.length > 0) {
      var lastLcp = lcpEntries[lcpEntries.length - 1];
      data.performance.lcp = { time: Math.round(lastLcp.startTime), element: lastLcp.element ? lastLcp.element.tagName.toLowerCase() : 'unknown', size: lastLcp.size || 0 };
    }
  } catch(e) {}
  // Heuristic: find largest visible element above fold
  if (!data.performance.lcp) {
    var largestArea = 0, lcpTag = '';
    document.querySelectorAll('img, h1, h2, video, [class*="hero"]').forEach(function(el) {
      if (!isVisible(el)) return;
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) {
        var area = r.width * r.height;
        if (area > largestArea) { largestArea = area; lcpTag = el.tagName.toLowerCase(); }
      }
    });
    if (lcpTag) {
      data.performance.lcpHeuristic = { element: lcpTag, area: Math.round(largestArea) };
      // Check if LCP image is lazy loaded (bad)
      if (lcpTag === 'img') {
        var lcpImg = document.querySelector('img');
        document.querySelectorAll('img').forEach(function(img) {
          var r = img.getBoundingClientRect();
          if (r.width * r.height >= largestArea * 0.9 && r.top < window.innerHeight) lcpImg = img;
        });
        if (lcpImg && lcpImg.getAttribute('loading') === 'lazy') {
          data.performance.lcpLazyLoaded = true;
        }
      }
    }
  }

  // --- Container padding consistency ---
  var containerPaddings = {};
  document.querySelectorAll('section, article, [class*="card"], [class*="panel"], [class*="box"], .container').forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var s = getComputedStyle(el);
    var pad = s.paddingLeft;
    if (pad && pad !== '0px') containerPaddings[pad] = (containerPaddings[pad] || 0) + 1;
  });
  data.spacing.containerPaddings = Object.keys(containerPaddings).map(function(k) { return { value: k, count: containerPaddings[k] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 10);

  // --- Color-only indicators ---
  data.accessibility.colorOnlyIndicators = 0;
  document.querySelectorAll('[class*="error"], [class*="success"], [class*="warning"], [class*="danger"], [class*="alert"]').forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    // Check if the element has an icon (svg, img, or icon class) or uses text like "Error:"
    var hasIcon = el.querySelector('svg, img, [class*="icon"]');
    var text = (el.textContent || '').trim();
    var hasTextIndicator = /^(error|warning|success|info|danger|alert|note)\s*[:!]/i.test(text);
    if (!hasIcon && !hasTextIndicator && text.length > 0 && text.length < 200) {
      data.accessibility.colorOnlyIndicators++;
    }
  });

  // --- Fixed-width elements ---
  data.structure.fixedWidthElements = 0;
  for (var fi = 0; fi < allElements.length && fi < 500; fi++) {
    var fel = allElements[fi];
    if (!isVisible(fel) || isDecorative(fel) || fel.tagName === 'IMG') continue;
    var fs = getComputedStyle(fel);
    var w = fs.width;
    if (w && w.endsWith('px') && parseFloat(w) > 300 && !fs.maxWidth.endsWith('%') && fs.maxWidth !== '100%') {
      var parentW = fel.parentElement ? fel.parentElement.getBoundingClientRect().width : window.innerWidth;
      if (parseFloat(w) > parentW * 0.8) data.structure.fixedWidthElements++;
    }
  }

  // --- Text truncation ---
  data.structure.truncatedElements = 0;
  for (var ti = 0; ti < allElements.length && ti < 500; ti++) {
    var tel = allElements[ti];
    if (!isVisible(tel) || isDecorative(tel)) continue;
    var ts = getComputedStyle(tel);
    if (ts.textOverflow === 'ellipsis' || ts.overflow === 'hidden' && ts.whiteSpace === 'nowrap') {
      if (tel.scrollWidth > tel.clientWidth + 2) data.structure.truncatedElements++;
    }
  }

  // --- Auto-playing media ---
  data.accessibility.autoPlayMedia = 0;
  document.querySelectorAll('video[autoplay]:not([muted]), audio[autoplay]:not([muted])').forEach(function(el) {
    data.accessibility.autoPlayMedia++;
  });

  // Clean up measurement span
  document.body.removeChild(_measureSpan);

  // --- Screenshot capture ---
  console.log('%c📸 Capturing screenshots...', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
  console.log('Loading modern-screenshot library from CDN...');

  var screenshotScript = document.createElement('script');
  screenshotScript.src = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js';
  screenshotScript.onload = function() {
    var ms = window.modernScreenshot;
    if (!ms || !ms.domToCanvas) {
      console.log('%c⚠ Screenshot library loaded but API not found. Skipping screenshots.', 'color: #b45309;');
      data.screenshots = [];
      outputData(data);
      return;
    }

    var totalH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var vh = window.innerHeight || 900;
    var captureH = Math.min(totalH, 32000);

    if (captureH <= vh * 3) {
      // Single full-page capture
      ms.domToCanvas(document.documentElement, { scale: 0.5 }).then(function(canvas) {
        canvas.toBlob(function(blob) {
          if (!blob) { data.screenshots = []; outputData(data); return; }
          var reader = new FileReader();
          reader.onloadend = function() {
            data.screenshots = [reader.result];
            console.log('%c✓ Screenshot captured (' + Math.round(reader.result.length / 1024) + ' KB)', 'color: #16a34a;');
            outputData(data);
          };
          reader.readAsDataURL(blob);
        }, 'image/webp', 0.7);
      }).catch(function(err) {
        console.log('%c⚠ Screenshot failed: ' + err.message, 'color: #b45309;');
        data.screenshots = [];
        outputData(data);
      });
    } else {
      // Multi-section capture for tall pages
      var shots = [];
      var y = 0;
      var secH = vh;
      function captureNext() {
        if (y >= captureH || shots.length >= 5) {
          data.screenshots = shots;
          console.log('%c✓ ' + shots.length + ' screenshot(s) captured', 'color: #16a34a;');
          outputData(data);
          return;
        }
        window.scrollTo(0, y);
        setTimeout(function() {
          ms.domToCanvas(document.documentElement, { scale: 0.5, width: window.innerWidth, height: Math.min(secH, captureH - y) }).then(function(canvas) {
            canvas.toBlob(function(blob) {
              if (!blob) { y += secH; captureNext(); return; }
              var reader = new FileReader();
              reader.onloadend = function() {
                shots.push(reader.result);
                y += secH;
                captureNext();
              };
              reader.readAsDataURL(blob);
            }, 'image/webp', 0.7);
          }).catch(function() { y += secH; captureNext(); });
        }, 150);
      }
      captureNext();
    }
  };
  screenshotScript.onerror = function() {
    console.log('%c⚠ Could not load screenshot library. Continuing without screenshots.', 'color: #b45309;');
    data.screenshots = [];
    outputData(data);
  };
  document.head.appendChild(screenshotScript);

  function outputData(data) {
    var json = JSON.stringify(data);

    // Copy to clipboard
    function copyFallback() {
      var ta = document.createElement('textarea');
      ta.value = json;
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try {
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          console.log('%c✓ Design data + screenshots copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
          return;
        }
      } catch(e) {
        document.body.removeChild(ta);
      }
      console.log('%c⚠ Could not copy to clipboard. Type: copy(window.__milgData_json)', 'color: #b45309; font-weight: bold;');
      window.__milgData_json = json;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(function() {
        console.log('%c✓ Design data + screenshots copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
      }).catch(copyFallback);
    } else {
      copyFallback();
    }

    console.log('%cmake-it-look-good extraction complete (with screenshots)', 'color: #3b82f6; font-weight: bold;');
    console.log('Elements scanned:', data.structure.totalElements);
    console.log('Screenshots:', (data.screenshots || []).length);
    console.log('Total JSON size:', Math.round(json.length / 1024), 'KB');

    window.__milgData = data;
    window.__milgData_json = json;
  }
})();
