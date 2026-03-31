// make-it-look-good — Design Extraction Snippet (with screenshots)
// Version: 2025-03-31-v13
// Run this in the browser console on any page.
// Loads modern-screenshot from CDN to capture page screenshots as WebP.
// Output is larger (~200-800KB extra) but includes visual reference.
// Then paste into the analyzer at: https://yourusername.github.io/make-it-look-good/analyzer.html

(function() {
  'use strict';
  var _MILG_VERSION = '2025-03-31-v13';
  console.log('%c[milg] Snippet version: ' + _MILG_VERSION, 'color: #64748b;');

  // --- Scan mode ---
  var _scanMode = window.__milgScanMode || 'full';
  var _doExpensive = _scanMode === 'full';

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

  // Split backgroundImage into individual gradient layers (CSS order: first = topmost)
  function splitGradients(bgImage) {
    var layers = [];
    var depth = 0, start = 0;
    for (var i = 0; i < bgImage.length; i++) {
      if (bgImage[i] === '(') depth++;
      else if (bgImage[i] === ')') depth--;
      else if (bgImage[i] === ',' && depth === 0) {
        layers.push(bgImage.substring(start, i).trim());
        start = i + 1;
      }
    }
    layers.push(bgImage.substring(start).trim());
    return layers.filter(function(l) { return l.indexOf('gradient') !== -1; });
  }

  function getGradientColor(el) {
    var bgImage = getComputedStyle(el).backgroundImage;
    if (!bgImage || bgImage === 'none' || bgImage.indexOf('gradient') === -1) return null;

    var gradientLayers = splitGradients(bgImage);
    if (gradientLayers.length === 0) return null;

    var rect = el.getBoundingClientRect();
    var w = Math.round(rect.width) || 1;
    var h = Math.round(rect.height) || 1;
    var scale = 1;
    if (w > 200 || h > 200) scale = Math.min(200 / w, 200 / h);
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    _gradCanvas.width = cw;
    _gradCanvas.height = ch;
    _gradCtx.clearRect(0, 0, cw, ch);

    for (var li = gradientLayers.length - 1; li >= 0; li--) {
      renderGradientLayer(gradientLayers[li], cw, ch);
    }

    var px = Math.round(cw / 2);
    var py = Math.round(ch / 2);
    var d = _gradCtx.getImageData(Math.min(px, cw - 1), Math.min(py, ch - 1), 1, 1).data;
    if (d[3] === 0) return null;
    return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 };
  }

  function renderGradientLayer(layer, cw, ch) {
    if (layer.indexOf('radial-gradient') !== -1) {
      var radialStops = layer.match(/(?:rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/g);
      if (radialStops && radialStops.length > 0) {
        var fc = parseColor(radialStops[0]);
        if (fc && fc.a > 0) { _gradCtx.fillStyle = 'rgba(' + fc.r + ',' + fc.g + ',' + fc.b + ',' + fc.a + ')'; _gradCtx.fillRect(0, 0, cw, ch); return true; }
      }
      return false;
    }
    var angleMatch = layer.match(/linear-gradient\(\s*(\d+(?:\.\d+)?)deg/);
    var angleDeg = 180;
    if (angleMatch) { angleDeg = parseFloat(angleMatch[1]); }
    else { var dirMatch = layer.match(/linear-gradient\(\s*to\s+(top|bottom|left|right)/); if (dirMatch) { angleDeg = { 'top': 0, 'bottom': 180, 'left': 270, 'right': 90 }[dirMatch[1]] || 180; } }
    var stopRegex = /(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})\s*([\d.]+%)?/g;
    var stops = [], match;
    while ((match = stopRegex.exec(layer)) !== null) { var color = parseColor(match[1]); if (color) stops.push({ color: color, pos: match[2] ? parseFloat(match[2]) / 100 : null }); }
    if (stops.length < 2) { if (stops.length === 1) { _gradCtx.fillStyle = 'rgba(' + stops[0].color.r + ',' + stops[0].color.g + ',' + stops[0].color.b + ',' + stops[0].color.a + ')'; _gradCtx.fillRect(0, 0, cw, ch); return true; } return false; }
    if (stops[0].pos === null) stops[0].pos = 0;
    if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
    for (var i = 1; i < stops.length - 1; i++) { if (stops[i].pos === null) { var prev = i - 1, next = i + 1; while (next < stops.length && stops[next].pos === null) next++; stops[i].pos = stops[prev].pos + (stops[next].pos - stops[prev].pos) * ((i - prev) / (next - prev)); } }
    var rad = (angleDeg - 90) * Math.PI / 180;
    var diagLen = Math.sqrt(cw * cw + ch * ch) / 2;
    var cx = cw / 2, cy = ch / 2, dx = Math.cos(rad) * diagLen, dy = Math.sin(rad) * diagLen;
    try {
      var grad = _gradCtx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      for (var i = 0; i < stops.length; i++) { var sc = stops[i].color; grad.addColorStop(Math.max(0, Math.min(1, stops[i].pos)), 'rgba(' + sc.r + ',' + sc.g + ',' + sc.b + ',' + sc.a + ')'); }
      _gradCtx.fillStyle = grad; _gradCtx.fillRect(0, 0, cw, ch); return true;
    } catch(e) { return false; }
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
    if (urlMatch[1].charAt(0) === '#') return null; // SVG reference, not an image
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
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      docHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
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
    || document.body.classList.contains('dark-ui') || document.body.classList.contains('dark-mode') || document.body.classList.contains('dark-theme')
    || document.documentElement.classList.contains('dark')
    || document.documentElement.getAttribute('data-theme') === 'dark' || document.body.getAttribute('data-theme') === 'dark'
    || document.querySelector('[data-bs-theme="dark"]') !== null
    || Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r.cssText && r.cssText.indexOf('prefers-color-scheme') !== -1; }); } catch(e) { return false; } });
  // Responsive: check Tailwind responsive classes OR CSS @media queries in stylesheets
  data.structure.responsiveClasses = /class="[^"]*(?:sm:|md:|lg:|xl:)/.test(htmlStr)
    || Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r instanceof CSSMediaRule && /max-width|min-width/.test(r.conditionText || ''); }); } catch(e) { return false; } });

  // --- Typography & Colors ---
  var fontSizeMap = {};
  var fontSizeSamples = {}; // fontSize → {selector, bbox}
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

    // Check for CSS filters and backdrop-filter on ancestors that affect contrast
    var filterAncestor = el;
    var filterValue = '';
    var hasBackdropFilter = false;
    var minBgAlpha = 1;
    while (filterAncestor && filterAncestor !== document.documentElement) {
      var ancestorStyle = getComputedStyle(filterAncestor);
      var f = ancestorStyle.filter;
      if (f && f !== 'none' && !filterValue) { filterValue = f; }
      var bf = ancestorStyle.backdropFilter || ancestorStyle.webkitBackdropFilter || '';
      if (bf && bf !== 'none') hasBackdropFilter = true;
      var ancestorBg = parseColor(ancestorStyle.backgroundColor);
      if (ancestorBg && ancestorBg.a > 0 && ancestorBg.a < 1 && ancestorBg.a < minBgAlpha) {
        minBgAlpha = ancestorBg.a;
      }
      filterAncestor = filterAncestor.parentElement;
    }

    // Collect all pairs up to AAA+buffer (7.5) so profile switching works
    var elRect = el.getBoundingClientRect();
    if (ratio < 7.5) {
      contrastPairs.push({
        fg: rgbStr(fgBlended), bg: rgbStr(bg),
        ratio: Math.round(ratio * 100) / 100,
        needed: threshold,
        passes: ratio >= threshold,
        fontSize: Math.round(fontSize), fontWeight: fontWeight, isLarge: isLarge,
        text: node.textContent.trim().substring(0, 50),
        selector: cssSelector(el),
        filter: filterValue,
        backdropFilter: hasBackdropFilter,
        minBgAlpha: Math.round(minBgAlpha * 100) / 100,
        bbox: { left: Math.round(elRect.left + window.scrollX), top: Math.round(elRect.top + window.scrollY), width: Math.round(elRect.width), height: Math.round(elRect.height) }
      });
    }

    // Measure line length
    var range = document.createRange();
    range.selectNodeContents(el);
    var textLen = node.textContent.trim().length;
    if (textLen > data.typography.maxLineLength.chars && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.closest('pre') && !el.closest('code')) {
      // Measure actual character width using the hidden span
      var elWidth = elRect.width;
      _measureSpan.style.fontSize = style.fontSize;
      _measureSpan.style.fontFamily = style.fontFamily;
      var charWidth = _measureSpan.getBoundingClientRect().width / 36;
      var charsPerLine = Math.round(elWidth / charWidth);
      if (charsPerLine > data.typography.maxLineLength.chars) {
        var _mlRect = el.getBoundingClientRect();
        data.typography.maxLineLength = { chars: charsPerLine, element: cssSelector(el), fontSize: Math.round(parseFloat(style.fontSize)), textLength: textLen, bbox: { left: Math.round(_mlRect.left + window.scrollX), top: Math.round(_mlRect.top + window.scrollY), width: Math.round(_mlRect.width), height: Math.round(_mlRect.height) } };
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
  var darknessAreas = [];

  function parseGradientColors(bgImage) {
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

    // Font data
    var fs = s.fontSize;
    fontSizeMap[fs] = (fontSizeMap[fs] || 0) + 1;
    if (!fontSizeSamples[fs]) {
      var _fsRect = el.getBoundingClientRect();
      fontSizeSamples[fs] = { selector: cssSelector(el), bbox: { left: Math.round(_fsRect.left + window.scrollX), top: Math.round(_fsRect.top + window.scrollY), width: Math.round(_fsRect.width), height: Math.round(_fsRect.height) } };
    }
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

    // Track area-weighted darkness (element size + gradients)
    var rect = el.getBoundingClientRect();
    var area = rect.width * rect.height;
    if (area > 100) {
      var bgM = bgColor && bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (bgM) {
        var bgLum = (parseInt(bgM[1]) * 0.299 + parseInt(bgM[2]) * 0.587 + parseInt(bgM[3]) * 0.114) / 255;
        var bgAlpha = 1;
        var alphaM = bgColor.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)/);
        if (alphaM) bgAlpha = parseFloat(alphaM[1]);
        if (bgAlpha > 0.3) darknessAreas.push({ darkness: 1 - bgLum, area: area * bgAlpha });
      }
      var bgImg = s.backgroundImage;
      if (bgImg && bgImg !== 'none' && /gradient/.test(bgImg)) {
        var gradColors = parseGradientColors(bgImg);
        if (gradColors.length > 0) {
          var avgGradLum = gradColors.reduce(function(sum, c) { return sum + (c.r * 0.299 + c.g * 0.587 + c.b * 0.114) / 255; }, 0) / gradColors.length;
          darknessAreas.push({ darkness: 1 - avgGradLum, area: area });
        }
      }
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
    var w = rect.width;
    if (w > maxContentW && w < window.innerWidth * 0.95) maxContentW = w;
  }

  // Convert maps to sorted arrays
  function mapToSorted(map) {
    return Object.keys(map).map(function(k) { return { value: k, count: map[k] }; })
      .sort(function(a, b) { return b.count - a.count; })
      .slice(0, 30);
  }

  data.typography.fontSizes = mapToSorted(fontSizeMap).map(function(entry) {
    var sample = fontSizeSamples[entry.value];
    if (sample) { entry.sampleSelector = sample.selector; entry.bbox = sample.bbox; }
    return entry;
  });
  data.typography.fontWeights = mapToSorted(fontWeightMap);
  data.typography.fontFamilies = Array.from(fontFamilySet).slice(0, 10);
  data.typography.lineHeights = mapToSorted(lineHeightMap);
  data.colors.textColors = mapToSorted(textColorMap);
  data.colors.bgColors = mapToSorted(bgColorMap);

  // Darkness level: 1 = white page, 10 = black page (area-weighted, includes gradients)
  var totalPixelWeight = 0;
  var totalDarkness = 0;
  if (darknessAreas.length > 0) {
    for (var da = 0; da < darknessAreas.length; da++) {
      totalDarkness += darknessAreas[da].darkness * darknessAreas[da].area;
      totalPixelWeight += darknessAreas[da].area;
    }
  } else {
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

  // --- Headings ---
  var headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach(function(h) {
    var hs = getComputedStyle(h);
    var hRect = h.getBoundingClientRect();
    data.typography.headings.push({
      tag: h.tagName.toLowerCase(),
      text: h.textContent.trim().substring(0, 60),
      fontSize: hs.fontSize,
      fontWeight: hs.fontWeight,
      lineHeight: hs.lineHeight,
      fontFamily: hs.fontFamily.split(',')[0].trim().replace(/['"]/g, ''),
      selector: cssSelector(h),
      bbox: { left: Math.round(hRect.left + window.scrollX), top: Math.round(hRect.top + window.scrollY), width: Math.round(hRect.width), height: Math.round(hRect.height) }
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
      var linkContext = 'button';
      if (el.tagName === 'A') {
        var inNav = !!el.closest('nav');
        var inFooter = !!el.closest('footer');
        var inParagraph = !!el.closest('p, blockquote, figcaption, caption, td, th, dd');
        if (inNav) linkContext = 'nav';
        else if (inFooter) linkContext = 'footer';
        else if (inParagraph) linkContext = 'inline';
        else {
          var ls = getComputedStyle(el);
          var hasBg = ls.backgroundColor !== 'rgba(0, 0, 0, 0)' && ls.backgroundColor !== 'transparent';
          var hasBorder = ls.borderStyle !== 'none' && ls.borderWidth !== '0px';
          var hasPad = parseFloat(ls.paddingTop) > 4 || parseFloat(ls.paddingBottom) > 4;
          if (hasBg || hasBorder || hasPad) linkContext = 'button';
          else linkContext = 'standalone';
        }
      }
      touchTargetIssues.push({
        element: el.tagName.toLowerCase(),
        width: w, height: h,
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 40),
        selector: cssSelector(el),
        passes: false,
        isButton: el.tagName !== 'A' || linkContext === 'button' || linkContext === 'nav',
        linkContext: linkContext,
        bbox: { left: Math.round(rect.left + window.scrollX), top: Math.round(rect.top + window.scrollY), width: w, height: h }
      });
    }
  });
  // Keep worst 40
  touchTargetIssues.sort(function(a, b) { return (a.width * a.height) - (b.width * b.height); });
  data.interaction.touchTargets = touchTargetIssues.slice(0, 40);

  // Adjacent interactive element spacing — siblings only
  // Helper: get a human-readable label for an interactive element
  function _adjLabel(el) {
    var txt = (el.textContent || '').trim().substring(0, 30);
    if (txt) return txt;
    var label = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || '';
    if (label) return '[' + label.substring(0, 30) + ']';
    var tag = el.tagName.toLowerCase();
    var cls = (el.className || '').toString().split(/\s+/).filter(function(c) { return c.length > 0 && c.length < 30; }).slice(0, 2).join('.');
    return '<' + tag + (cls ? '.' + cls : '') + '>';
  }
  // Group interactive elements by parent, then check gaps between adjacent siblings
  var adjacentIssues = [];
  var parentGroups = new Map();
  interactive.forEach(function(el) {
    if (!isVisible(el)) return;
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
    children.sort(function(a, b) { return a.rect.left - b.rect.left || a.rect.top - b.rect.top; });
    for (var i = 0; i < children.length - 1 && adjacentIssues.length < 15; i++) {
      var a = children[i].rect;
      var b = children[i + 1].rect;
      var sameRow = a.top < b.bottom && b.top < a.bottom;
      var sameCol = a.left < b.right && b.left < a.right;
      if (sameRow) {
        var hGap = Math.round(Math.max(0, b.left - a.right));
        if (hGap < 8) {
          adjacentIssues.push({ gap: hGap, direction: 'horizontal', selectorA: cssSelector(children[i].el), selectorB: cssSelector(children[i + 1].el), textA: _adjLabel(children[i].el), textB: _adjLabel(children[i + 1].el) });
        }
      } else if (sameCol) {
        var vGap = Math.round(Math.max(0, b.top - a.bottom));
        if (vGap < 8) {
          adjacentIssues.push({ gap: vGap, direction: 'vertical', selectorA: cssSelector(children[i].el), selectorB: cssSelector(children[i + 1].el), textA: _adjLabel(children[i].el), textB: _adjLabel(children[i + 1].el) });
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

  // Focus indicators — actually focus elements to detect browser defaults and CSS :focus styles
  var focusSample = Array.from(interactive).slice(0, 10);
  var _prevFocused = document.activeElement;
  focusSample.forEach(function(el) {
    if (!isVisible(el)) return;
    var restStyle = getComputedStyle(el);
    var restOutline = restStyle.outlineStyle;
    var restOutlineW = restStyle.outlineWidth;
    try { el.focus({ preventScroll: true }); } catch(e) {}
    var focusStyle = getComputedStyle(el);
    var hasFocusChange = focusStyle.outlineStyle !== restOutline ||
      focusStyle.outlineWidth !== restOutlineW ||
      (focusStyle.boxShadow !== 'none' && focusStyle.boxShadow !== restStyle.boxShadow);
    data.accessibility.focusIndicators.push({
      element: cssSelector(el),
      outlineStyle: focusStyle.outlineStyle,
      outlineWidth: focusStyle.outlineWidth,
      outlineColor: focusStyle.outlineColor,
      outlineOffset: focusStyle.outlineOffset,
      hasFocusChange: hasFocusChange
    });
  });
  try { if (_prevFocused && _prevFocused.focus) _prevFocused.focus({ preventScroll: true }); else document.body.focus(); } catch(e) {}
  // Also check if stylesheets contain focus-visible rules (can't detect via getComputedStyle)
  var hasFocusVisibleCSS = Array.from(document.styleSheets).some(function(ss) {
    try { return Array.from(ss.cssRules).some(function(r) { return r.selectorText && r.selectorText.indexOf('focus-visible') !== -1; }); } catch(e) { return false; }
  });
  // Also check HTML class attributes for focus-visible (Tailwind v4 classes may not be in accessible stylesheets due to CDN cross-origin)
  var hasFocusVisibleClasses = Array.from(interactive).slice(0, 20).some(function(el) {
    var cls = el.getAttribute('class') || '';
    return cls.indexOf('focus-visible') !== -1 || cls.indexOf('focus:ring') !== -1 || cls.indexOf('focus:outline') !== -1;
  });
  data.accessibility.hasFocusVisibleCSS = hasFocusVisibleCSS || hasFocusVisibleClasses;

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

  // Hidden overflow clips — elements with overflow-x:hidden that silently clip content
  data.layout.hiddenClipElements = [];
  for (var hci = 0; hci < allElements.length && hci < 300; hci++) {
    var hcEl = allElements[hci];
    if (!isVisible(hcEl) || isDecorative(hcEl)) continue;
    var hcStyle = getComputedStyle(hcEl);
    var hcRadius = hcStyle.borderRadius;
    var hcHasRadius = hcRadius && hcRadius !== '0px' && hcRadius !== '0%';
    var hcHasText = hcEl.textContent && hcEl.textContent.trim().length > 10;
    if (hcStyle.overflowX === 'hidden' && hcEl.scrollWidth > hcEl.clientWidth + 4 && hcEl.clientWidth > 50
        && !hcHasRadius && hcHasText
        && hcStyle.pointerEvents !== 'none'
        && hcStyle.position !== 'fixed') {
      data.layout.hiddenClipElements.push({
        selector: cssSelector(hcEl),
        clientWidth: hcEl.clientWidth,
        scrollWidth: hcEl.scrollWidth,
        clipped: Math.round(hcEl.scrollWidth - hcEl.clientWidth)
      });
    }
  }
  data.layout.hiddenClipElements = data.layout.hiddenClipElements.slice(0, 10);

  // --- Child exceeds parent detection ---
  data.layout.childExceedsParent = [];
  for (var cei = 0; cei < allElements.length && cei < 400; cei++) {
    var ceEl = allElements[cei];
    if (!isVisible(ceEl) || isDecorative(ceEl)) continue;
    if (ceEl.tagName === 'SCRIPT' || ceEl.tagName === 'STYLE' || ceEl.tagName === 'SVG' || ceEl.tagName === 'IMG') continue;
    var ceStyle = getComputedStyle(ceEl);
    if (ceStyle.position === 'absolute' || ceStyle.position === 'fixed' || ceStyle.position === 'sticky') continue;
    var ceParent = ceEl.parentElement;
    if (!ceParent || ceParent === document.body || ceParent === document.documentElement) continue;
    var ceRect = ceEl.getBoundingClientRect();
    var cpRect = ceParent.getBoundingClientRect();
    if (ceRect.width < 20 || cpRect.width < 20) continue;
    var excessRight = ceRect.right - cpRect.right;
    var excessLeft = cpRect.left - ceRect.left;
    var excess = Math.max(excessRight, excessLeft);
    if (excess <= 4) continue;
    var cpStyle = getComputedStyle(ceParent);
    var cpOx = cpStyle.overflowX;
    if (cpOx === 'auto' || cpOx === 'scroll') continue;
    var hasScrollAncestor = false;
    var anc = ceParent.parentElement;
    for (var ancI = 0; ancI < 3 && anc && anc !== document.body; ancI++) {
      var ancOx = getComputedStyle(anc).overflowX;
      if (ancOx === 'auto' || ancOx === 'scroll' || ancOx === 'hidden') { hasScrollAncestor = true; break; }
      anc = anc.parentElement;
    }
    if (hasScrollAncestor) continue;
    var parentOverflowExplicit = cpOx === 'hidden' || cpOx === 'clip';
    data.layout.childExceedsParent.push({
      child: cssSelector(ceEl),
      childTag: ceEl.tagName.toLowerCase(),
      childText: (ceEl.textContent || '').trim().substring(0, 30),
      parent: cssSelector(ceParent),
      excess: Math.round(excess),
      childWidth: Math.round(ceRect.width),
      parentWidth: Math.round(cpRect.width),
      parentOverflow: cpOx,
      deliberate: parentOverflowExplicit
    });
  }
  data.layout.childExceedsParent = data.layout.childExceedsParent.slice(0, 15);

  // --- Text overlap detection ---
  data.layout.textOverlaps = [];
  var _fixedTextEls = [];
  for (var ovi = 0; ovi < allElements.length && ovi < 200; ovi++) {
    var ovEl = allElements[ovi];
    if (!isVisible(ovEl) || isDecorative(ovEl)) continue;
    var ovStyle = getComputedStyle(ovEl);
    var ovPos = ovStyle.position;
    if (ovPos !== 'fixed' && ovPos !== 'sticky') continue;
    var ovText = (ovEl.textContent || '').trim();
    if (ovText.length < 2) continue;
    var ovBg = parseColor(ovStyle.backgroundColor);
    var ovHasBg = ovBg && ovBg.a > 0.5;
    var ovRect = ovEl.getBoundingClientRect();
    if (ovRect.width < 10 || ovRect.height < 10) continue;
    _fixedTextEls.push({ el: ovEl, rect: ovRect, hasBg: ovHasBg, text: ovText.substring(0, 40), selector: cssSelector(ovEl) });
  }
  _fixedTextEls.forEach(function(fixed) {
    if (fixed.hasBg) return;
    var testPoints = [
      { x: fixed.rect.left + 10, y: fixed.rect.top + fixed.rect.height / 2 },
      { x: fixed.rect.left + fixed.rect.width / 2, y: fixed.rect.top + fixed.rect.height / 2 },
      { x: fixed.rect.right - 10, y: fixed.rect.top + fixed.rect.height / 2 }
    ];
    for (var tpi = 0; tpi < testPoints.length; tpi++) {
      var pt = testPoints[tpi];
      var origVis = fixed.el.style.visibility;
      fixed.el.style.visibility = 'hidden';
      var under = document.elementFromPoint(pt.x, pt.y);
      fixed.el.style.visibility = origVis;
      if (under && under !== document.body && under !== document.documentElement) {
        var underText = (under.textContent || '').trim();
        if (underText.length > 5) {
          data.layout.textOverlaps.push({
            fixed: fixed.selector,
            fixedText: fixed.text,
            under: cssSelector(under),
            underText: underText.substring(0, 40),
            hasBackground: fixed.hasBg
          });
          break;
        }
      }
    }
  });
  data.layout.textOverlaps = data.layout.textOverlaps.slice(0, 10);

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
  data.layout.horizontalScrollContainers = [];
  data.layout.nestedScrollbars = 0;
  var _vpW = window.innerWidth;

  // Content that is expected to scroll horizontally
  var _dataContentTags = { table: 1, pre: 1, code: 1 };
  // Structural children — if a scroll container holds these, it's masking a layout bug
  var _structuralSel = 'nav,form,section,header,footer,article,aside,main,h1,h2,h3,h4,h5,h6';

  for (var oi = 0; oi < allElements.length && oi < 500; oi++) {
    var oel = allElements[oi];
    if (!isVisible(oel) || isDecorative(oel)) continue;
    if (oel.scrollWidth > oel.clientWidth + 2 && oel.clientWidth > 0) {
      data.layout.overflowElements++;
      var oelTag = oel.tagName.toLowerCase();
      var oelStyle = getComputedStyle(oel);
      var hasOverflowCSS = oelStyle.overflowX === 'auto' || oelStyle.overflowX === 'scroll';
      var isDataContent = !!_dataContentTags[oelTag] || !!oel.closest('table,pre,code');
      var hasStructuralChildren = !isDataContent && oel.querySelector(_structuralSel);
      var isWideContainer = oel.clientWidth >= _vpW * 0.8;

      var classification = 'bug';
      if (hasOverflowCSS && isDataContent && !hasStructuralChildren) {
        classification = 'intentional';
      } else if (hasOverflowCSS && !isDataContent && !hasStructuralChildren && !isWideContainer) {
        classification = 'intentional';
      }
      if (!hasOverflowCSS) classification = 'bug';
      if (isWideContainer && hasOverflowCSS && !isDataContent) classification = 'bug';

      if (oel.clientWidth > 200) {
        data.layout.horizontalScrollContainers.push({
          selector: cssSelector(oel),
          width: oel.clientWidth,
          scrollWidth: oel.scrollWidth,
          overflow: Math.round(oel.scrollWidth - oel.clientWidth),
          intentional: classification === 'intentional',
          classification: classification,
          reason: !hasOverflowCSS ? 'no-overflow-css' :
                  hasStructuralChildren ? 'structural-children-in-scroll' :
                  isWideContainer ? 'wide-container-scrolls' :
                  isDataContent ? 'data-content' : 'unknown'
        });
      }
      if (hasOverflowCSS) {
        var scrollParent = oel.parentElement;
        while (scrollParent && scrollParent !== document.documentElement) {
          var spStyle = getComputedStyle(scrollParent);
          if ((spStyle.overflowX === 'auto' || spStyle.overflowX === 'scroll' || spStyle.overflowY === 'auto' || spStyle.overflowY === 'scroll') &&
              scrollParent.scrollHeight > scrollParent.clientHeight + 10) {
            data.layout.nestedScrollbars++;
            break;
          }
          scrollParent = scrollParent.parentElement;
        }
      }
    }
  }

  // --- Viewport visibility: elements positioned off-screen on x-axis ---
  data.layout.offscreenElements = [];
  var _meaningfulSel = 'button,a,[role="menuitem"],[role="menu"],li,p,h1,h2,h3,h4,h5,h6,img,input,select,textarea,td,th,label,span,div';
  document.querySelectorAll(_meaningfulSel).forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    var fullyOff = r.right < 0 || r.left >= _vpW;
    var majorClip = r.left < _vpW && r.right > _vpW && (r.right - _vpW) > r.width * 0.5;
    if (!fullyOff && !majorClip) return;
    var anc = el.parentElement;
    var inIntentionalScroll = false;
    while (anc && anc !== document.body && anc !== document.documentElement) {
      var ox = getComputedStyle(anc).overflowX;
      if (ox === 'auto' || ox === 'scroll') {
        var ancTag = anc.tagName.toLowerCase();
        var isData = !!_dataContentTags[ancTag] || !!anc.closest('table,pre,code');
        var isWide = anc.clientWidth >= _vpW * 0.8;
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
      vpWidth: _vpW,
      reason: r.right < 0 ? 'left-overflow' : r.left >= _vpW ? 'right-overflow' : 'major-clip',
      bbox: { left: Math.round(r.left + window.scrollX), top: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) }
    });
  });
  data.layout.offscreenElements = data.layout.offscreenElements.slice(0, 20);

  // --- Hidden panel detection (hybrid unhide) ---
  data.layout.hiddenPanelIssues = [];
  var _hiddenPanels = [];
  document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"], [role="tooltip"], [role="alertdialog"]').forEach(function(el) {
    if (!isVisible(el) && _hiddenPanels.indexOf(el) === -1) _hiddenPanels.push(el);
  });
  var _inlineRoles = { region: 1, tabpanel: 1, tab: 1 };
  document.querySelectorAll('[aria-controls]').forEach(function(trigger) {
    var targetId = trigger.getAttribute('aria-controls');
    if (targetId) {
      var target = document.getElementById(targetId);
      if (target && !isVisible(target) && _hiddenPanels.indexOf(target) === -1) {
        var targetRole = (target.getAttribute('role') || '').toLowerCase();
        if (!_inlineRoles[targetRole]) _hiddenPanels.push(target);
      }
    }
  });
  document.querySelectorAll('[aria-haspopup="true"], [aria-haspopup="menu"], [aria-haspopup="dialog"], [aria-haspopup="listbox"]').forEach(function(trigger) {
    var ctrlId = trigger.getAttribute('aria-controls');
    if (ctrlId) {
      var t = document.getElementById(ctrlId);
      if (t && !isVisible(t) && _hiddenPanels.indexOf(t) === -1) _hiddenPanels.push(t);
      return;
    }
    var wrapper = trigger.parentElement;
    if (!wrapper) return;
    wrapper.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]').forEach(function(c) {
      if (!isVisible(c) && _hiddenPanels.indexOf(c) === -1) _hiddenPanels.push(c);
    });
  });
  if (typeof getEventListeners === 'function') {
    document.querySelectorAll('button, [role="button"]').forEach(function(btn) {
      try {
        var listeners = getEventListeners(btn);
        if (!listeners.click || listeners.click.length === 0) return;
        var wrapper = btn.parentElement;
        if (!wrapper) return;
        wrapper.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"], .dropdown-menu, .popover, [class*="dropdown"], [class*="popover"]').forEach(function(p) {
          if (!isVisible(p) && _hiddenPanels.indexOf(p) === -1) _hiddenPanels.push(p);
        });
      } catch(e) {}
    });
  }
  _hiddenPanels.slice(0, 15).forEach(function(panel) {
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
      if (pr.right > _vpW + 2) issues.push({ type: 'right-overflow', overflow: Math.round(pr.right - _vpW) });
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
        vpWidth: _vpW,
        issues: issues,
        bbox: { left: Math.round(pr.left + window.scrollX), top: Math.round(pr.top + window.scrollY), width: Math.round(pr.width), height: Math.round(pr.height) }
      });
    }
  });
  data.layout.hiddenPanelCount = _hiddenPanels.length;

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

  // --- Extended checks (synced from analyzer-snippet.js) ---

  // Duplicate IDs
  var idMap = {};
  document.querySelectorAll('[id]').forEach(function(el) { var id = el.id; if (id) idMap[id] = (idMap[id] || 0) + 1; });
  data.accessibility.duplicateIds = Object.keys(idMap).filter(function(id) { return idMap[id] > 1; }).map(function(id) {
    var usedInLabel = !!document.querySelector('label[for="' + CSS.escape(id) + '"], [aria-labelledby~="' + CSS.escape(id) + '"], [aria-describedby~="' + CSS.escape(id) + '"], [aria-controls="' + CSS.escape(id) + '"]');
    return { id: id, count: idMap[id], usedInAria: usedInLabel };
  }).slice(0, 15);

  // Scrollable regions without keyboard access
  data.accessibility.scrollableNoKeyboard = 0;
  document.querySelectorAll('*').forEach(function(el) {
    if (el.tagName === 'BODY' || el.tagName === 'HTML') return;
    var s = getComputedStyle(el);
    var isScrollable = (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 10;
    if (!isScrollable) isScrollable = (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 10;
    if (!isScrollable) return;
    if (!el.querySelector('a, button, input, select, textarea, [tabindex]') && !el.hasAttribute('tabindex')) data.accessibility.scrollableNoKeyboard++;
  });

  // Nested interactive elements
  data.accessibility.nestedInteractives = [];
  document.querySelectorAll('a a, a button, button a, button button').forEach(function(el) { if (isVisible(el)) data.accessibility.nestedInteractives.push(cssSelector(el)); });
  data.accessibility.nestedInteractives = data.accessibility.nestedInteractives.slice(0, 10);

  // Positive tabindex
  data.accessibility.positiveTabindex = 0;
  document.querySelectorAll('[tabindex]').forEach(function(el) { if (parseInt(el.getAttribute('tabindex')) > 0) data.accessibility.positiveTabindex++; });

  // Empty buttons/links
  data.accessibility.emptyInteractives = [];
  document.querySelectorAll('a, button, [role="button"], [role="link"]').forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var text = (el.textContent || '').trim();
    if (!text && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title') && !el.querySelector('img[alt]:not([alt=""])') && !el.querySelector('svg title')) {
      data.accessibility.emptyInteractives.push(cssSelector(el));
    }
  });
  data.accessibility.emptyInteractives = data.accessibility.emptyInteractives.slice(0, 10);

  // Non-text contrast (input borders)
  data.accessibility.nonTextContrast = [];
  document.querySelectorAll('input, select, textarea').forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var s = getComputedStyle(el);
    var borderColor = parseColor(s.borderColor || s.borderTopColor);
    if (!borderColor || borderColor.a < 0.3) return;
    var bg = getEffectiveBg(el);
    var ratio = contrastRatio(blendOnWhite(borderColor), bg);
    if (ratio < 3) data.accessibility.nonTextContrast.push({ selector: cssSelector(el), ratio: Math.round(ratio * 100) / 100, borderColor: rgbStr(blendOnWhite(borderColor)), bg: rgbStr(bg) });
  });
  data.accessibility.nonTextContrast = data.accessibility.nonTextContrast.slice(0, 10);

  // Z-index sprawl
  var zIndexValues = {};
  for (var zi = 0; zi < allElements.length && zi < 500; zi++) { var zVal = getComputedStyle(allElements[zi]).zIndex; if (zVal !== 'auto') zIndexValues[zVal] = (zIndexValues[zVal] || 0) + 1; }
  data.layout.zIndexSprawl = { distinct: Object.keys(zIndexValues).length, max: Object.keys(zIndexValues).length > 0 ? Math.max.apply(null, Object.keys(zIndexValues).map(Number)) : 0, values: Object.keys(zIndexValues).map(function(z) { return { value: +z, count: zIndexValues[z] }; }).sort(function(a, b) { return b.value - a.value; }).slice(0, 10) };

  // Shadow consistency
  var shadowValues = {};
  for (var si = 0; si < allElements.length && si < 500; si++) { if (!isVisible(allElements[si])) continue; var shadow = getComputedStyle(allElements[si]).boxShadow; if (shadow && shadow !== 'none') shadowValues[shadow] = (shadowValues[shadow] || 0) + 1; }
  data.layout.shadowSprawl = Object.keys(shadowValues).length;

  // Dark mode halation
  data.colors.darkModeHalation = false;
  if (data.structure.isDarkPage) { data.colors.contrastPairs.forEach(function(p) { var fg = parseColor(p.fg); var bg = parseColor(p.bg); if (fg && bg && bg.r < 10 && bg.g < 10 && bg.b < 10 && fg.r > 245 && fg.g > 245 && fg.b > 245) data.colors.darkModeHalation = true; }); }

  // Table accessibility
  data.accessibility.tableIssues = [];
  document.querySelectorAll('table').forEach(function(table) { if (!isVisible(table) || isDecorative(table)) return; var issues = []; if (!table.querySelector('th')) issues.push('no-th'); var ths = table.querySelectorAll('th'); var noScope = 0; ths.forEach(function(th) { if (!th.getAttribute('scope')) noScope++; }); if (noScope > 0 && ths.length > 0) issues.push('no-scope'); if (!table.querySelector('caption') && !table.getAttribute('aria-label') && !table.getAttribute('aria-labelledby')) issues.push('no-caption'); if (issues.length > 0) data.accessibility.tableIssues.push({ selector: cssSelector(table), issues: issues }); });

  // Missing button type, all-caps, justified text
  data.accessibility.missingButtonType = document.querySelectorAll('button:not([type])').length;
  data.typography.allCapsLongText = 0;
  data.typography.justifiedText = 0;
  for (var aci = 0; aci < allElements.length && aci < 300; aci++) { var acEl = allElements[aci]; if (!isVisible(acEl) || isDecorative(acEl)) continue; var acStyle = getComputedStyle(acEl); if (acStyle.textTransform === 'uppercase' && (acEl.textContent || '').trim().length > 50) data.typography.allCapsLongText++; if (acStyle.textAlign === 'justify' && (acEl.textContent || '').trim().length > 30) data.typography.justifiedText++; }

  // Tier 1 remaining
  data.performance.upscaledImages = [];
  document.querySelectorAll('img').forEach(function(img) { if (!img.naturalWidth || !img.complete || !isVisible(img)) return; var r = img.getBoundingClientRect(); if (r.width < 24) return; var dpr = window.devicePixelRatio || 1; if (r.width * dpr > img.naturalWidth * 1.1) data.performance.upscaledImages.push({ selector: cssSelector(img), rendered: Math.round(r.width) + 'x' + Math.round(r.height), natural: img.naturalWidth + 'x' + img.naturalHeight, upscale: Math.round(r.width * dpr / img.naturalWidth * 100) }); });
  data.performance.upscaledImages = data.performance.upscaledImages.slice(0, 10);
  data.accessibility.textClippedNoTitle = 0;
  for (var tci = 0; tci < allElements.length && tci < 300; tci++) { var tcEl = allElements[tci]; if (!isVisible(tcEl) || isDecorative(tcEl)) continue; var tcS = getComputedStyle(tcEl); if ((tcS.textOverflow === 'ellipsis' || (tcS.overflow === 'hidden' && tcS.whiteSpace === 'nowrap' && tcEl.scrollWidth > tcEl.clientWidth + 2)) && !tcEl.getAttribute('title') && !tcEl.getAttribute('aria-label')) data.accessibility.textClippedNoTitle++; }
  data.accessibility.placeholderOnlyInputs = 0;
  document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(function(el) { if (!isVisible(el)) return; if (!(el.labels && el.labels.length > 0) && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) data.accessibility.placeholderOnlyInputs++; });
  data.accessibility.invisibleLinks = 0;
  document.querySelectorAll('a[href]').forEach(function(a) { if (!isVisible(a) || isDecorative(a) || a.closest('nav, header, footer, [role="navigation"]')) return; var aS = getComputedStyle(a); var pS = a.parentElement ? getComputedStyle(a.parentElement) : null; if (!pS) return; if (!(aS.textDecorationLine && aS.textDecorationLine.indexOf('underline') !== -1) && aS.color === pS.color && (aS.backgroundColor === 'rgba(0, 0, 0, 0)' || aS.backgroundColor === 'transparent')) data.accessibility.invisibleLinks++; });
  data.accessibility.requiredNoIndicator = 0;
  document.querySelectorAll('[required]').forEach(function(el) { if (!isVisible(el)) return; var label = (el.labels && el.labels[0]) || (el.id && document.querySelector('label[for="' + el.id + '"]')); if (!label) return; var lt = label.textContent || ''; if (!/\*/.test(lt) && !/required/i.test(lt)) data.accessibility.requiredNoIndicator++; });
  data.accessibility.invisibleInputs = 0;
  document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea').forEach(function(el) { if (!isVisible(el) || isDecorative(el)) return; var s = getComputedStyle(el); if (!(parseFloat(s.borderWidth) > 0 && s.borderStyle !== 'none') && s.boxShadow === 'none') { var bg = parseColor(s.backgroundColor); var pBg = getEffectiveBg(el.parentElement || el); if (!bg || !pBg || contrastRatio(blendOnWhite(bg), pBg) <= 1.15) data.accessibility.invisibleInputs++; } });
  data.performance.willChangeCount = 0;
  for (var wci = 0; wci < allElements.length && wci < 300; wci++) { var wc = getComputedStyle(allElements[wci]).willChange; if (wc && wc !== 'auto') data.performance.willChangeCount++; }
  data.accessibility.disabledLowContrast = 0;
  document.querySelectorAll('[disabled], [aria-disabled="true"]').forEach(function(el) { if (!isVisible(el)) return; var fg = parseColor(getComputedStyle(el).color); if (!fg) return; var bg = getEffectiveBg(el); if (contrastRatio(blendOnWhite(fg), bg) < 2.0) data.accessibility.disabledLowContrast++; });
  data.accessibility.selectNoDefault = 0;
  document.querySelectorAll('select').forEach(function(sel) { if (!isVisible(sel)) return; var opts = sel.querySelectorAll('option'); if (opts.length === 0 || (opts[0].textContent.trim() === '' && !opts[0].disabled)) data.accessibility.selectNoDefault++; });
  data.layout.fixedViewportConsumption = 0;
  var fixedTotalH = 0;
  for (var fvi = 0; fvi < allElements.length && fvi < 200; fvi++) { var fvS = getComputedStyle(allElements[fvi]); if (fvS.position === 'fixed' || fvS.position === 'sticky') { var fvR = allElements[fvi].getBoundingClientRect(); if (fvR.height > 10 && fvR.width > _vpW * 0.5) fixedTotalH += fvR.height; } }
  data.layout.fixedViewportConsumption = Math.round(fixedTotalH / window.innerHeight * 100);
  data.performance.complexFilters = 0;
  for (var cfi = 0; cfi < allElements.length && cfi < 300; cfi++) { if (!isVisible(allElements[cfi])) continue; var cfFilter = getComputedStyle(allElements[cfi]).filter; if (cfFilter && cfFilter !== 'none' && (cfFilter.match(/\(/g) || []).length >= 3) data.performance.complexFilters++; }
  data.layout.buttonHierarchy = { total: 0, filled: 0, outline: 0, text: 0 };
  document.querySelectorAll('button, [role="button"], a').forEach(function(btn) { if (!isVisible(btn) || isDecorative(btn)) return; var bs = getComputedStyle(btn); var hasBg = bs.backgroundColor !== 'rgba(0, 0, 0, 0)' && bs.backgroundColor !== 'transparent'; var hasPad = parseFloat(bs.paddingLeft) > 8 && parseFloat(bs.paddingTop) > 4; var hasBorder = parseFloat(bs.borderWidth) > 0 && bs.borderStyle !== 'none'; if (!hasPad) return; data.layout.buttonHierarchy.total++; if (hasBg) data.layout.buttonHierarchy.filled++; else if (hasBorder) data.layout.buttonHierarchy.outline++; else data.layout.buttonHierarchy.text++; });
  data.consistency = data.consistency || {};
  data.consistency.borderWidthInconsistencies = 0;
  data.consistency.fontWeightInconsistencies = 0;
  data.consistency.gradientDirections = 0;
  var hwByLevel = {};
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h) { if (!isVisible(h)) return; var tag = h.tagName.toLowerCase(); if (!hwByLevel[tag]) hwByLevel[tag] = new Set(); hwByLevel[tag].add(getComputedStyle(h).fontWeight); });
  Object.keys(hwByLevel).forEach(function(tag) { if (hwByLevel[tag].size > 1) data.consistency.fontWeightInconsistencies++; });
  var gradDirs = {};
  for (var gdi = 0; gdi < allElements.length && gdi < 200; gdi++) { if (!isVisible(allElements[gdi]) || isDecorative(allElements[gdi])) continue; var bgImg = getComputedStyle(allElements[gdi]).backgroundImage; if (bgImg && bgImg.indexOf('linear-gradient') !== -1) { var dirMatch = bgImg.match(/linear-gradient\((\d+deg|to \w+)/); if (dirMatch) gradDirs[dirMatch[1]] = 1; } }
  data.consistency.gradientDirections = Object.keys(gradDirs).length;
  data.performance.forcedLayers = 0;
  for (var fli = 0; fli < allElements.length && fli < 300; fli++) { var flT = getComputedStyle(allElements[fli]).transform; if (flT && flT !== 'none' && /matrix3d/.test(flT)) data.performance.forcedLayers++; }

  // --- Tier 4: Opt-in expensive checks ---
  if (_doExpensive) {
    data.layout.visualNoiseBands = [];
    var vpBands = Math.ceil(Math.max(document.body.scrollHeight, window.innerHeight) / window.innerHeight);
    for (var vbi = 0; vbi < Math.min(vpBands, 5); vbi++) { var bandTop = vbi * window.innerHeight; var bandBottom = bandTop + window.innerHeight; var noiseScore = 0; for (var vni = 0; vni < allElements.length && vni < 500; vni++) { var vnEl = allElements[vni]; if (!isVisible(vnEl) || isDecorative(vnEl)) continue; var vnR = vnEl.getBoundingClientRect(); var absTop = vnR.top + window.scrollY; if (absTop + vnR.height < bandTop || absTop > bandBottom) continue; var vnS = getComputedStyle(vnEl); if (vnS.boxShadow !== 'none') noiseScore += 1; if (vnS.backgroundColor !== 'rgba(0, 0, 0, 0)' && vnS.backgroundColor !== 'transparent') noiseScore += 0.5; if (parseFloat(vnS.borderWidth) > 0 && vnS.borderStyle !== 'none') noiseScore += 0.5; if (parseInt(vnS.fontWeight) >= 700) noiseScore += 0.3; if (vnEl.tagName === 'IMG') noiseScore += 1; } data.layout.visualNoiseBands.push({ band: vbi, score: Math.round(noiseScore * 10) / 10 }); }
    data.layout.emptyContainers = 0;
    document.querySelectorAll('ul, ol, tbody, [role="list"], main, section').forEach(function(el) { if (!isVisible(el)) return; var r = el.getBoundingClientRect(); if (r.height > 50 && el.textContent.trim() === '' && el.querySelectorAll('img, svg, canvas, video').length === 0) data.layout.emptyContainers++; });
    data.consistency.iconSizeVariance = 0;
    var iconRatios = []; document.querySelectorAll('svg').forEach(function(svg) { if (!isVisible(svg) || isDecorative(svg)) return; var r = svg.getBoundingClientRect(); if (r.height < 8 || r.height > 100) return; var parentFS = parseFloat(getComputedStyle(svg.parentElement || svg).fontSize) || 16; iconRatios.push(r.height / parentFS); });
    if (iconRatios.length >= 3) { var iconAvg = iconRatios.reduce(function(s, r) { return s + r; }, 0) / iconRatios.length; var iconVar = iconRatios.reduce(function(s, r) { return s + Math.pow(r - iconAvg, 2); }, 0) / iconRatios.length; data.consistency.iconSizeVariance = Math.round((iconAvg > 0 ? Math.sqrt(iconVar) / iconAvg : 0) * 100); }
    data.consistency.paddingAsymmetry = 0;
    document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(function(el) { if (!isVisible(el) || isDecorative(el)) return; var s = getComputedStyle(el); var pl = parseFloat(s.paddingLeft) || 0; var pr = parseFloat(s.paddingRight) || 0; if (Math.abs(pl - pr) > 4 && pl > 0 && pr > 0) data.consistency.paddingAsymmetry++; });
    data.colors.temperatureMixing = false;
    var warmCount = 0, coolCount = 0;
    (data.colors.textColors || []).concat(data.colors.bgColors || []).forEach(function(c) { var rgb = parseColor(c.value || c); if (!rgb) return; var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255; var max = Math.max(r, g, b), min = Math.min(r, g, b); var sat = max > 0 ? (max - min) / max : 0; if (sat < 0.15) return; var hue = 0; if (max === r) hue = 60 * ((g - b) / (max - min)); else if (max === g) hue = 60 * (2 + (b - r) / (max - min)); else hue = 60 * (4 + (r - g) / (max - min)); if (hue < 0) hue += 360; if ((hue >= 0 && hue <= 60) || hue >= 300) warmCount++; else if (hue >= 150 && hue <= 270) coolCount++; });
    if (warmCount >= 3 && coolCount >= 3) data.colors.temperatureMixing = true;
  }

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

  // --- Font smoothing detection (for low-vision profile) ---
  data.typography.fontSmoothingAntialiased = false;
  try {
    var bodySmooth = getComputedStyle(document.body).webkitFontSmoothing || '';
    if (bodySmooth === 'antialiased') data.typography.fontSmoothingAntialiased = true;
    if (!data.typography.fontSmoothingAntialiased) {
      Array.from(document.styleSheets).some(function(ss) {
        try { return Array.from(ss.cssRules).some(function(r) { return r.cssText && r.cssText.indexOf('font-smoothing') !== -1 && r.cssText.indexOf('antialiased') !== -1; }); } catch(e) { return false; }
      }) && (data.typography.fontSmoothingAntialiased = true);
    }
  } catch(e) {}

  // --- Background images behind text (for low-vision profile) ---
  data.accessibility.bgImageBehindText = 0;
  document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, span, a, label').forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var bgi = getComputedStyle(el).backgroundImage;
    if (bgi && bgi !== 'none' && bgi.indexOf('url(') !== -1 && el.textContent.trim().length > 10) {
      data.accessibility.bgImageBehindText++;
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

  // --- DOM statistics ---
  data.structure.domStats = {};
  var _tagCounts = {};
  var _hiddenCount = 0;
  var _displayNoneCount = 0;
  var _ariaHiddenCount = 0;
  for (var dsi = 0; dsi < allElements.length; dsi++) {
    var dsel = allElements[dsi];
    var dsTag = dsel.tagName.toLowerCase();
    _tagCounts[dsTag] = (_tagCounts[dsTag] || 0) + 1;
    if (dsel.tagName === 'SCRIPT' || dsel.tagName === 'STYLE' || dsel.tagName === 'LINK') continue;
    var dss = getComputedStyle(dsel);
    if (dss.display === 'none') _displayNoneCount++;
    if (dss.visibility === 'hidden' || dss.opacity === '0') _hiddenCount++;
    if (dsel.getAttribute('aria-hidden') === 'true') _ariaHiddenCount++;
  }
  var _semanticTags = ['nav', 'header', 'footer', 'main', 'article', 'section', 'aside', 'figure', 'figcaption', 'details', 'summary', 'dialog', 'ul', 'ol', 'li', 'table', 'form', 'fieldset', 'label'];
  var semanticCount = 0;
  _semanticTags.forEach(function(t) { semanticCount += (_tagCounts[t] || 0); });
  data.structure.domStats = {
    divCount: _tagCounts['div'] || 0,
    spanCount: _tagCounts['span'] || 0,
    semanticCount: semanticCount,
    hiddenCount: _hiddenCount,
    displayNoneCount: _displayNoneCount,
    ariaHiddenCount: _ariaHiddenCount,
    divRatio: allElements.length > 0 ? Math.round((_tagCounts['div'] || 0) / allElements.length * 100) : 0,
    topTags: Object.keys(_tagCounts).filter(function(t) { return t !== 'script' && t !== 'style' && t !== 'link'; }).sort(function(a, b) { return _tagCounts[b] - _tagCounts[a]; }).slice(0, 5).map(function(t) { return { tag: t, count: _tagCounts[t] }; })
  };

  // Clean up measurement span
  document.body.removeChild(_measureSpan);

  // --- Screenshot capture ---
  // The modern-screenshot library is loaded inline to bypass CSP restrictions.
  // Console-pasted code is executed directly by the engine, not subject to CSP script-src.
  console.log('%c📸 Capturing screenshots...', 'color: #3b82f6; font-weight: bold; font-size: 14px;');

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
        console.log('%c⚠ CDN blocked by CSP. Trying fetch fallback...', 'color: #b45309;');
        fetch('https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js')
          .then(function(r) { return r.text(); })
          .then(function(code) { (new Function(code))(); resolve(); })
          .catch(function() {
            console.log('%c⚠ Screenshot library unavailable on this site (CSP blocks external scripts and eval).', 'color: #b45309;');
            console.log('%cScreenshots skipped. The design data extraction still works — just paste into the analyzer.', 'color: #64748b;');
            reject();
          });
      };
    });
    document.head.appendChild(_msScript);
  } catch(e) { var _msLoaded = Promise.reject(); }

  _msLoaded.then(function() {
    var ms = window.modernScreenshot;
    if (!ms || !ms.domToCanvas) {
      console.log('%c⚠ Screenshot API not found. Skipping.', 'color: #b45309;');
      data.screenshots = [];
      outputData(data);
      return;
    }

    var totalH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var vh = window.innerHeight || 900;
    var captureH = Math.min(totalH, 32000);

    var _ssStart = Date.now();
    function _t() { return '[' + ((Date.now() - _ssStart) / 1000).toFixed(1) + 's] '; }
    // Cap at 10 viewports for the full capture (avoid huge canvases on very long pages)
    captureH = Math.min(captureH, vh * 10);
    var numSections = Math.ceil(captureH / vh);
    console.log('[ss] ' + _t() + 'totalH=' + totalH + ' vh=' + vh + ' captureH=' + captureH + ' sections=' + numSections);

    // Show overlay so users aren't confused during capture
    var _overlay = document.createElement('div');
    _overlay.setAttribute('data-milg-overlay', '1');
    _overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
    _overlay.innerHTML = '<div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:milg-spin 0.8s linear infinite"></div>' +
      '<div id="milg-ss-status" style="color:#fff;margin-top:16px;font-size:14px;font-weight:500">Preparing screenshots...</div>' +
      '<div style="color:rgba(255,255,255,0.6);margin-top:6px;font-size:12px">Scrolling page to load all content, then capturing</div>' +
      '<style>@keyframes milg-spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(_overlay);
    var _ssFilter = function(el) { return !el.getAttribute || !el.getAttribute('data-milg-overlay'); };
    var _origScrollY = window.scrollY;

    // Phase 1: Pre-scroll the entire page to trigger ALL lazy content, IntersectionObservers, etc.
    console.log('[ss] ' + _t() + 'Phase 1: Pre-scrolling page to trigger lazy content...');
    var _preScrollPositions = [];
    for (var _ps = 0; _ps < captureH; _ps += vh) _preScrollPositions.push(_ps);
    var _psIdx = 0;
    function _preScrollNext() {
      if (_psIdx >= _preScrollPositions.length) {
        // All positions scrolled — wait for content to finish loading
        console.log('[ss] ' + _t() + 'Phase 1 complete. Waiting for lazy content to finish loading...');
        var statusEl = document.getElementById('milg-ss-status');
        if (statusEl) statusEl.textContent = 'Waiting for images to load...';
        setTimeout(function() { _startCapture(); }, 500);
        return;
      }
      var scrollY = _preScrollPositions[_psIdx];
      window.scrollTo(0, scrollY);
      try { window.dispatchEvent(new Event('scroll')); } catch(e) {}
      var statusEl = document.getElementById('milg-ss-status');
      if (statusEl) statusEl.textContent = 'Loading content... (section ' + (_psIdx + 1) + '/' + _preScrollPositions.length + ')';
      _psIdx++;
      setTimeout(_preScrollNext, 200); // 200ms per scroll position
    }
    _preScrollNext();

    // Phase 2: Capture the full page as one big canvas, then split into sections
    function _startCapture() {
      // Force instant scroll to 0 on ALL scroll containers
      // Some pages use a div with overflow:auto as the main scroll container,
      // so window.scrollTo(0,0) alone doesn't reset scroll position.
      var origScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      document.body.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      // Reset any overflow scroll containers
      document.querySelectorAll('*').forEach(function(el) {
        if (el.scrollTop > 0) {
          var s = getComputedStyle(el);
          if (s.overflow === 'auto' || s.overflow === 'scroll' || s.overflowY === 'auto' || s.overflowY === 'scroll') {
            el.style.scrollBehavior = 'auto';
            el.scrollTop = 0;
          }
        }
      });
      var actualScroll = Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop);

      console.log('[ss] ' + _t() + 'Phase 2: Capturing full page (' + captureH + 'px), scrollY=' + actualScroll + '...');
      var statusEl = document.getElementById('milg-ss-status');
      if (statusEl) statusEl.textContent = 'Rendering page to canvas...';

      ms.domToCanvas(document.documentElement, {
        scale: 0.5,
        filter: _ssFilter,
        timeout: 8000
      }).then(function(fullCanvas) {
        console.log('[ss] ' + _t() + 'Full canvas captured: ' + fullCanvas.width + 'x' + fullCanvas.height);

        var secScale = 0.5;

        // Log final scroll state for diagnostics
        var finalScroll = Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop);
        console.log('[ss] Scroll state at capture: window=' + window.scrollY + ', html=' + document.documentElement.scrollTop + ', body=' + document.body.scrollTop);
        var calibOffset = 0;

        // Store full-page canvas as single WebP — used by both report and viewer
        var fullPageDataUri;
        try {
          fullPageDataUri = fullCanvas.toDataURL('image/webp', 0.8);
          console.log('[ss] ' + _t() + 'Full-page WebP: ' + Math.round(fullPageDataUri.length / 1024) + 'KB');
        } catch(e) {
          console.warn('[ss] Full-page WebP failed:', e.message);
          fullPageDataUri = '';
        }

        window.scrollTo(0, _origScrollY);
        if (_overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
        data.screenshots = fullPageDataUri ? [fullPageDataUri] : [];
        data.screenshotFull = fullPageDataUri || null;

        (function finalize() {
            var captureDocH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            document.documentElement.style.scrollBehavior = origScrollBehavior;
            data.screenshotMeta = {
              scale: secScale,
              viewportHeight: vh,
              sectionCount: data.screenshots.length,
              canvasWidth: fullCanvas.width,
              canvasHeight: fullCanvas.height,
              docHeightAtCapture: captureDocH,
              docHeightAtExtraction: data.meta.docHeight || captureDocH,
              captureScrollY: actualScroll,
              calibrationOffsetY: calibOffset,
              calibrationSamples: _calibOffsets
            };
            // --- Pixel contrast verification on the pristine full canvas ---
            // Runs on the raw canvas BEFORE WebP compression, so no artifacts.
            // Uses fg-exclusion: CSS fg color is known, exclude fg-like pixels,
            // find the dominant background color from remaining pixels.
            (function() {
              var pairs = data.colors.contrastPairs || [];
              var pairsWithBbox = pairs.filter(function(p) { return p.bbox; });
              if (pairsWithBbox.length === 0) return;

              var fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
              var FG_DIST_SQ = 8100; // 90^2 — pixels within this RGB distance from CSS fg are excluded as "text"

              function parseRgbStr(str) {
                var m = str.match(/rgb[a]?\((\d+),\s*(\d+),\s*(\d+)/);
                if (!m) m = str.match(/rgb[a]?\((\d+)\s+(\d+)\s+(\d+)/);
                return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
              }
              function lum(c) {
                var rs = c.r / 255, gs = c.g / 255, bs = c.b / 255;
                var r = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
                var g = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
                var b = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
              }
              function cr(c1, c2) {
                var l1 = lum(c1), l2 = lum(c2);
                return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
              }

              var results = [];
              pairsWithBbox.forEach(function(pair) {
                var cssFg = parseRgbStr(pair.fg);
                var cssBg = parseRgbStr(pair.bg);
                if (!cssFg) return;

                // Map bbox to canvas coordinates
                var cx = Math.round(pair.bbox.left * secScale);
                var cy = Math.round(pair.bbox.top * secScale);
                var cw = Math.round(pair.bbox.width * secScale);
                var ch = Math.round(pair.bbox.height * secScale);

                // Clamp to canvas bounds
                if (cx < 0) { cw += cx; cx = 0; }
                if (cy < 0) { ch += cy; cy = 0; }
                if (cx + cw > fullCanvas.width) cw = fullCanvas.width - cx;
                if (cy + ch > fullCanvas.height) ch = fullCanvas.height - cy;
                if (cw < 2 || ch < 2) return;

                // Read all pixels in the bbox at once
                var imgData = fullCtx.getImageData(cx, cy, cw, ch);
                var px = imgData.data;
                var totalPixels = cw * ch;

                // Classify pixels: exclude fg-like pixels, quantize background candidates
                var buckets = {}; // key "r,g,b" quantized to 4-bit → {count, rSum, gSum, bSum}
                var bgCount = 0;
                var worstBg = null, worstRatio = 999;

                for (var i = 0; i < px.length; i += 4) {
                  var r = px[i], g = px[i + 1], b = px[i + 2];
                  // Distance from CSS foreground color
                  var dr = r - cssFg.r, dg = g - cssFg.g, db = b - cssFg.b;
                  var distSq = dr * dr + dg * dg + db * db;
                  if (distSq < FG_DIST_SQ) continue; // Skip — this is a text/anti-aliased pixel

                  bgCount++;
                  // Quantize to 4-bit buckets (16 levels per channel → 4096 buckets)
                  var qr = (r >> 4), qg = (g >> 4), qb = (b >> 4);
                  var key = (qr << 8) | (qg << 4) | qb;
                  if (!buckets[key]) buckets[key] = { count: 0, rSum: 0, gSum: 0, bSum: 0 };
                  buckets[key].count++;
                  buckets[key].rSum += r;
                  buckets[key].gSum += g;
                  buckets[key].bSum += b;

                  // Track worst contrast pixel
                  var pxColor = { r: r, g: g, b: b };
                  var pxRatio = cr(cssFg, pxColor);
                  if (pxRatio < worstRatio) { worstRatio = pxRatio; worstBg = pxColor; }
                }

                // If too few bg pixels (>80% was text), sample outside the bbox (padding area)
                if (bgCount < totalPixels * 0.15) {
                  var margin = Math.max(4, Math.round(Math.min(cw, ch) * 0.3));
                  var outerRegions = [
                    [cx - margin, cy, margin, ch],          // left
                    [cx + cw, cy, margin, ch],               // right
                    [cx - margin, cy - margin, cw + margin * 2, margin], // top
                    [cx - margin, cy + ch, cw + margin * 2, margin]      // bottom
                  ];
                  outerRegions.forEach(function(reg) {
                    var ox = Math.max(0, reg[0]), oy = Math.max(0, reg[1]);
                    var ow = Math.min(reg[2], fullCanvas.width - ox);
                    var oh = Math.min(reg[3], fullCanvas.height - oy);
                    if (ow < 1 || oh < 1) return;
                    var outer = fullCtx.getImageData(ox, oy, ow, oh);
                    var op = outer.data;
                    for (var j = 0; j < op.length; j += 4) {
                      var r = op[j], g = op[j + 1], b = op[j + 2];
                      bgCount++;
                      var qr = (r >> 4), qg = (g >> 4), qb = (b >> 4);
                      var key = (qr << 8) | (qg << 4) | qb;
                      if (!buckets[key]) buckets[key] = { count: 0, rSum: 0, gSum: 0, bSum: 0 };
                      buckets[key].count++;
                      buckets[key].rSum += r; buckets[key].gSum += g; buckets[key].bSum += b;
                      var pxColor = { r: r, g: g, b: b };
                      var pxRatio = cr(cssFg, pxColor);
                      if (pxRatio < worstRatio) { worstRatio = pxRatio; worstBg = pxColor; }
                    }
                  });
                }

                if (bgCount < 3) return; // Not enough data

                // Find dominant background (most populated bucket)
                var bestBucket = null, bestCount = 0;
                var occupiedBuckets = 0;
                var keys = Object.keys(buckets);
                for (var ki = 0; ki < keys.length; ki++) {
                  var b = buckets[keys[ki]];
                  occupiedBuckets++;
                  if (b.count > bestCount) { bestCount = b.count; bestBucket = b; }
                }

                var dominantBg = {
                  r: Math.round(bestBucket.rSum / bestBucket.count),
                  g: Math.round(bestBucket.gSum / bestBucket.count),
                  b: Math.round(bestBucket.bSum / bestBucket.count)
                };

                var dominantRatio = cr(cssFg, dominantBg);
                var cssRatio = pair.ratio;
                var needed = pair.needed || 4.5;
                var cssPasses = cssRatio >= needed;
                var pixelPasses = worstRatio >= needed;
                var dominantPasses = dominantRatio >= needed;
                var isVariableBg = occupiedBuckets > 5 && (worstRatio / (dominantRatio || 1)) < 0.6;

                // Store result on the contrast pair itself
                pair.pixelVerify = {
                  dominantBg: 'rgb(' + dominantBg.r + ',' + dominantBg.g + ',' + dominantBg.b + ')',
                  dominantRatio: dominantRatio,
                  worstRatio: worstRatio,
                  worstBg: worstBg ? 'rgb(' + worstBg.r + ',' + worstBg.g + ',' + worstBg.b + ')' : null,
                  bgSamples: bgCount,
                  isVariableBg: isVariableBg,
                  cssBgConfirmed: cssBg ? (Math.abs(dominantBg.r - cssBg.r) + Math.abs(dominantBg.g - cssBg.g) + Math.abs(dominantBg.b - cssBg.b) < 60) : false,
                  crossesBoundary: cssPasses !== pixelPasses,
                  dominantPasses: dominantPasses
                };

                if (pair.pixelVerify.crossesBoundary || isVariableBg || Math.abs(dominantRatio - cssRatio) > 1.5) {
                  results.push({
                    selector: pair.selector,
                    text: pair.text,
                    cssRatio: cssRatio,
                    pixelRatio: worstRatio,
                    pixelRatioAvg: dominantRatio,
                    cssPasses: cssPasses,
                    pixelPasses: pixelPasses,
                    crossesBoundary: cssPasses !== pixelPasses,
                    isVariableBg: isVariableBg,
                    significant: true,
                    bgSamples: bgCount,
                    pixelBgDominant: pair.pixelVerify.dominantBg,
                    cssBgConfirmed: pair.pixelVerify.cssBgConfirmed
                  });
                }
              });

              data.pixelVerifyResults = results;
              console.log('[ss] ' + _t() + 'Pixel contrast verified: ' + pairsWithBbox.length + ' pairs, ' + results.length + ' discrepancies');
            })();

            console.log('%c✓ Screenshot captured (' + _t().trim() + ')', 'color: #16a34a; font-weight: bold;');
            outputData(data);
        })();

      }).catch(function(err) {
        console.log('[ss] ' + _t() + '✗ Full page capture failed: ' + (err && err.message || err));
        window.scrollTo(0, _origScrollY);
        if (_overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
        data.screenshots = [];
        outputData(data);
      });
    }
  }).catch(function() {
    data.screenshots = [];
    outputData(data);
  });

  function outputData(data) {
    var json = JSON.stringify(data);
    var jsonKB = Math.round(json.length / 1024);
    var jsonMB = (json.length / 1024 / 1024).toFixed(1);
    console.log('[clipboard] JSON size: ' + jsonKB + ' KB (' + jsonMB + ' MB)');
    window.__milgData = data;
    window.__milgData_json = json;

    // Show overlay with copy button (user click = real gesture = clipboard works reliably)
    var _copyOverlay = document.createElement('div');
    _copyOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
    _copyOverlay.innerHTML = '<div style="text-align:center;max-width:400px;padding:20px">' +
      '<div style="font-size:32px;margin-bottom:12px">&#10003;</div>' +
      '<div style="color:#fff;font-size:18px;font-weight:600;margin-bottom:6px">Extraction complete!</div>' +
      '<div style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:6px">' + jsonKB + ' KB of design data' + (data.screenshotFull ? ' + full-page screenshot' : '') + '</div>' +
      (jsonKB > 2048 ? '<div style="color:#fbbf24;font-size:12px;margin-bottom:16px">&#9888; Large payload (' + jsonMB + ' MB) — paste may take a moment</div>' : '<div style="margin-bottom:16px"></div>') +
      '<button id="milg-copy-btn" style="padding:14px 32px;font-size:15px;font-weight:600;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:12px;min-width:200px">Copy to Clipboard</button>' +
      '<div style="color:rgba(255,255,255,0.4);font-size:11px">Then paste into the analyzer</div>' +
      '</div>';
    document.body.appendChild(_copyOverlay);

    document.getElementById('milg-copy-btn').addEventListener('click', function() {
      var btn = document.getElementById('milg-copy-btn');
      btn.textContent = 'Copying...';
      btn.disabled = true;

      function onSuccess() {
        btn.textContent = 'Copied!';
        btn.style.background = '#16a34a';
        console.log('%c✓ Design data copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
        setTimeout(function() { if (_copyOverlay.parentNode) _copyOverlay.parentNode.removeChild(_copyOverlay); }, 800);
      }
      function onFail() {
        btn.textContent = 'Copy failed — use console';
        btn.style.background = '#dc2626';
        console.log('%c⚠ Clipboard copy failed. Type: copy(window.__milgData_json)', 'color: #b45309; font-weight: bold;');
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(onSuccess).catch(function() {
          // Fallback
          try {
            var ta = document.createElement('textarea'); ta.value = json;
            ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy') ? onSuccess() : onFail();
            document.body.removeChild(ta);
          } catch(e) { onFail(); }
        });
      } else {
        try {
          var ta = document.createElement('textarea'); ta.value = json;
          ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy') ? onSuccess() : onFail();
          document.body.removeChild(ta);
        } catch(e) { onFail(); }
      }
    });

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
        try { localStorage.setItem('milg-crawl-complete', crawlJson); } catch(e) {}
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

        var _ssUrl = 'https://jdeworks.github.io/make-it-look-good/analyzer-snippet-screenshots.js';
        fetch(_ssUrl).then(function(r) { return r.text(); }).then(function(snippetSrc) {
          function _next(idx) {
            if (idx >= _links.length) {
              // Prepare data but show copy button (auto-copy fails in async context)
              var crawlJson = JSON.stringify({ _milgCrawl: true, startUrl: location.href, results: _cResults });
              window.__milgCrawlResults = _cResults;
              window.__milgCrawlJson = crawlJson;
              try { localStorage.setItem('milg-crawl-complete', crawlJson); } catch(e) {}
              console.log('%c\u2713 Crawl complete! ' + _cResults.length + ' pages (' + Math.round(crawlJson.length / 1024) + ' KB)', 'color: #16a34a; font-weight: bold; font-size: 14px;');
              // Show copy button in overlay (user click = real gesture = clipboard works)
              _crawlOverlay.innerHTML = '<div style="text-align:center">' +
                '<div style="font-size:28px;margin-bottom:12px">\u2713</div>' +
                '<div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:6px">Crawl complete! ' + _cResults.length + ' pages analyzed.</div>' +
                '<div style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:20px">' + Math.round(crawlJson.length / 1024) + ' KB of design data ready</div>' +
                '<button id="milg-crawl-copy-btn" style="padding:12px 28px;font-size:14px;font-weight:600;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:10px">Copy to Clipboard</button>' +
                '<div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:8px">Then paste into the analyzer</div>' +
                '</div>';
              document.getElementById('milg-crawl-copy-btn').addEventListener('click', function() {
                navigator.clipboard.writeText(crawlJson).then(function() {
                  document.getElementById('milg-crawl-copy-btn').textContent = 'Copied!';
                  document.getElementById('milg-crawl-copy-btn').style.background = '#16a34a';
                  setTimeout(_removeCrawlOverlay, 800);
                }).catch(function() {
                  // Fallback for older browsers
                  var ta = document.createElement('textarea'); ta.value = crawlJson;
                  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
                  document.body.appendChild(ta); ta.select();
                  try { document.execCommand('copy'); } catch(e) {}
                  document.body.removeChild(ta);
                  document.getElementById('milg-crawl-copy-btn').textContent = 'Copied!';
                  document.getElementById('milg-crawl-copy-btn').style.background = '#16a34a';
                  setTimeout(_removeCrawlOverlay, 800);
                });
              });
              return;
            }
            var url = _links[idx];
            var path; try { path = new URL(url).pathname; } catch(e) { path = url; }
            _updateCrawlOverlay('Crawling page ' + (idx + 1) + ' of ' + _links.length, path);
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
                'if(!b&&typeof u==="string"&&u.charAt(0)==="/")return new _O(u,_rb);try{return arguments.length===1?new _O(u):new _O(u,b);}catch(e){try{return new _O(u,_rb);}catch(e2){throw e;}}}' +
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
                        var d = iWin.__milgData;
                        if (d) { clearInterval(pi); done = true; d.meta.url = url; _cResults.push({ url: url, data: d }); cleanup(); console.log('%c  \u2713 ' + path, 'color: #16a34a;'); setTimeout(function() { _next(idx + 1); }, 500); }
                        else if (polls > 20) { clearInterval(pi); done = true; cleanup(); console.log('%c  \u2717 Timeout: ' + path, 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                      } catch(e) { clearInterval(pi); done = true; cleanup(); console.log('%c  \u2717 Error: ' + path + ' (' + e.message + ')', 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                    }, 500);
                  } catch(e) { done = true; cleanup(); console.log('%c  \u2717 Cannot inject snippet: ' + path + ' (' + e.message + ')', 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }
                }, 1500);
              });
              iframe.srcdoc = html;
              setTimeout(function() { if (done) return; done = true; cleanup(); console.log('%c  \u2717 Timeout (10s): ' + path, 'color: #dc2626;'); setTimeout(function() { _next(idx + 1); }, 500); }, 10000);
            }).catch(function(e) {
              console.log('%c  \u2717 Fetch failed: ' + path + ' (' + (e.message || e) + ')', 'color: #dc2626;');
              setTimeout(function() { _next(idx + 1); }, 500);
            });
          }
          _next(0);
        }).catch(function() { _removeCrawlOverlay(); console.log('%c\u26A0 Could not fetch snippet for crawl.', 'color: #b45309;'); });
      }
      return; // Skip clipboard copy
    }
  }
})();
