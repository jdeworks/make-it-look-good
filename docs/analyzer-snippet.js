// make-it-look-good — Design Extraction Snippet
// Run this in the browser console on any page, or use as a bookmarklet.
// It extracts design tokens and copies JSON to your clipboard.
// Then paste into the analyzer at: https://yourusername.github.io/make-it-look-good/analyzer.html

(function() {
  'use strict';

  // --- Scan mode option ---
  // Set window.__milgScanMode before running:
  //   'full'     — All checks (default)
  //   'quick'    — Fast checks only (skip expensive DOM walks)
  //   'a11y'     — Accessibility checks only
  //   'visual'   — Visual/layout checks only
  var _scanMode = window.__milgScanMode || 'full';
  var _doA11y = _scanMode === 'full' || _scanMode === 'a11y';
  var _doVisual = _scanMode === 'full' || _scanMode === 'visual';
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

    // Split multiple backgrounds — CSS stacks them: first = topmost layer
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

    // Render layers bottom-to-top (last = bottom, first = top) so they composite correctly
    for (var li = gradientLayers.length - 1; li >= 0; li--) {
      var layer = gradientLayers[li];
      if (!renderGradientLayer(layer, cw, ch)) continue;
    }

    // Sample center pixel from composited result
    var px = Math.round(cw / 2);
    var py = Math.round(ch / 2);
    var d = _gradCtx.getImageData(Math.min(px, cw - 1), Math.min(py, ch - 1), 1, 1).data;
    if (d[3] === 0) return null;
    return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 };
  }

  function renderGradientLayer(layer, cw, ch) {
    // Radial gradient: extract first color stop only
    if (layer.indexOf('radial-gradient') !== -1) {
      var radialStops = layer.match(/(?:rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/g);
      if (radialStops && radialStops.length > 0) {
        var fc = parseColor(radialStops[0]);
        if (fc && fc.a > 0) {
          _gradCtx.fillStyle = 'rgba(' + fc.r + ',' + fc.g + ',' + fc.b + ',' + fc.a + ')';
          _gradCtx.fillRect(0, 0, cw, ch);
          return true;
        }
      }
      return false;
    }

    // Linear gradient
    var angleMatch = layer.match(/linear-gradient\(\s*(\d+(?:\.\d+)?)deg/);
    var angleDeg = 180;
    if (angleMatch) {
      angleDeg = parseFloat(angleMatch[1]);
    } else {
      var dirMatch = layer.match(/linear-gradient\(\s*to\s+(top|bottom|left|right)/);
      if (dirMatch) {
        var dirMap = { 'top': 0, 'bottom': 180, 'left': 270, 'right': 90 };
        angleDeg = dirMap[dirMatch[1]] || 180;
      }
    }

    // Extract color stops from THIS layer only
    var stopRegex = /(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})\s*([\d.]+%)?/g;
    var stops = [];
    var match;
    while ((match = stopRegex.exec(layer)) !== null) {
      var color = parseColor(match[1]);
      if (!color) continue;
      var pos = match[2] ? parseFloat(match[2]) / 100 : null;
      stops.push({ color: color, pos: pos });
    }
    if (stops.length < 2) {
      // Solid color gradient (same color for all stops)
      if (stops.length === 1) {
        _gradCtx.fillStyle = 'rgba(' + stops[0].color.r + ',' + stops[0].color.g + ',' + stops[0].color.b + ',' + stops[0].color.a + ')';
        _gradCtx.fillRect(0, 0, cw, ch);
        return true;
      }
      return false;
    }

    // Fill in missing positions
    if (stops[0].pos === null) stops[0].pos = 0;
    if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
    for (var i = 1; i < stops.length - 1; i++) {
      if (stops[i].pos === null) {
        var prev = i - 1, next = i + 1;
        while (next < stops.length && stops[next].pos === null) next++;
        stops[i].pos = stops[prev].pos + (stops[next].pos - stops[prev].pos) * ((i - prev) / (next - prev));
      }
    }

    var rad = (angleDeg - 90) * Math.PI / 180;
    var diagLen = Math.sqrt(cw * cw + ch * ch) / 2;
    var cx = cw / 2, cy = ch / 2;
    var dx = Math.cos(rad) * diagLen;
    var dy = Math.sin(rad) * diagLen;

    try {
      var grad = _gradCtx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      for (var i = 0; i < stops.length; i++) {
        var sc = stops[i].color;
        grad.addColorStop(Math.max(0, Math.min(1, stops[i].pos)), 'rgba(' + sc.r + ',' + sc.g + ',' + sc.b + ',' + sc.a + ')');
      }
      _gradCtx.fillStyle = grad;
      _gradCtx.fillRect(0, 0, cw, ch);
      return true;
    } catch(e) {
      return false;
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
      timestamp: new Date().toISOString(),
      version: 1,
      scanMode: _scanMode
    },
    colors: { textColors: [], bgColors: [], contrastPairs: [] },
    typography: {
      bodyFontSize: '', bodyLineHeight: '', bodyFontFamily: '',
      fontFamilies: [], fontSizes: [], fontWeights: [],
      headings: [], lineHeights: [], maxLineLength: { chars: 0, element: '', fontSize: 0, textLength: 0 }
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
      // Detect backdrop-filter (frosted glass, blur effects)
      var bf = ancestorStyle.backdropFilter || ancestorStyle.webkitBackdropFilter || '';
      if (bf && bf !== 'none') hasBackdropFilter = true;
      // Track minimum background alpha in the compositing chain
      var ancestorBg = parseColor(ancestorStyle.backgroundColor);
      if (ancestorBg && ancestorBg.a > 0 && ancestorBg.a < 1 && ancestorBg.a < minBgAlpha) {
        minBgAlpha = ancestorBg.a;
      }
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
        filter: filterValue,
        backdropFilter: hasBackdropFilter,
        minBgAlpha: Math.round(minBgAlpha * 100) / 100
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
        data.typography.maxLineLength = { chars: charsPerLine, element: cssSelector(el), fontSize: Math.round(fontSize), textLength: node.textContent.trim().length };
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

    // Track area-weighted darkness (accounts for element size and gradients)
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

  // Smart dark mode detection
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

  // Alignment consistency: collect left edges of major block elements with selectors
  var alignTargets = document.querySelectorAll('h1,h2,h3,h4,p,ul,ol,table,form,img,figure,blockquote');
  var leftEdges = [];
  var leftEdgeDetails = [];
  Array.from(alignTargets).forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var r = el.getBoundingClientRect();
    if (r.width > 50) {
      var edge = Math.round(r.left);
      leftEdges.push(edge);
      leftEdgeDetails.push({ left: edge, selector: cssSelector(el), tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().substring(0, 30) });
    }
  });
  data.layout.alignmentEdges = leftEdges;
  data.layout.alignmentEdgeDetails = leftEdgeDetails;

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
      // Detect if link looks like a button (has bg, border, or padding — not just inline text)
      // Determine link context: nav links are functional buttons, footer links are relaxed,
      // only paragraph-inline links get the WCAG 2.5.8 inline exemption
      var linkContext = 'button'; // default: treat as button
      if (el.tagName === 'A') {
        var inNav = !!el.closest('nav');
        var inFooter = !!el.closest('footer');
        var inParagraph = !!el.closest('p, blockquote, figcaption, caption, td, th, dd');
        if (inNav) {
          linkContext = 'nav'; // navigation links — always need proper sizing
        } else if (inFooter) {
          linkContext = 'footer'; // footer links — relaxed expectations
        } else if (inParagraph) {
          linkContext = 'inline'; // true inline links — WCAG exempt
        } else {
          // Check CSS for button-like styling
          var ls = getComputedStyle(el);
          var hasBg = ls.backgroundColor !== 'rgba(0, 0, 0, 0)' && ls.backgroundColor !== 'transparent';
          var hasBorder = ls.borderStyle !== 'none' && ls.borderWidth !== '0px';
          var hasPad = parseFloat(ls.paddingTop) > 4 || parseFloat(ls.paddingBottom) > 4;
          if (hasBg || hasBorder || hasPad) linkContext = 'button';
          else linkContext = 'standalone'; // standalone link, not clearly inline
        }
      }
      touchTargetIssues.push({
        element: el.tagName.toLowerCase(),
        width: w, height: h,
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 40),
        selector: cssSelector(el),
        passes: false,
        isButton: el.tagName !== 'A' || linkContext === 'button' || linkContext === 'nav',
        linkContext: linkContext
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
    // Fallback for icon-only elements
    var label = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || '';
    if (label) return '[' + label.substring(0, 30) + ']';
    // Last resort: tag + key class
    var tag = el.tagName.toLowerCase();
    var cls = (el.className || '').toString().split(/\s+/).filter(function(c) { return c.length > 0 && c.length < 30; }).slice(0, 2).join('.');
    return '<' + tag + (cls ? '.' + cls : '') + '>';
  }
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
    // Count direct child links/buttons (top-level nav items)
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
    // Get resting outline
    var restStyle = getComputedStyle(el);
    var restOutline = restStyle.outlineStyle;
    var restOutlineW = restStyle.outlineWidth;
    // Actually focus the element to see if outline changes
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
  // Restore previous focus
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

  // --- Table cell readability on narrow viewports ---
  data.layout.tableCellIssues = [];
  if (_vpW < 768) {
    document.querySelectorAll('table').forEach(function(table) {
      var cells = table.querySelectorAll('td, th');
      var cramped = 0, wrappedCells = 0;
      cells.forEach(function(cell) {
        if (!isVisible(cell)) return;
        var cs = getComputedStyle(cell);
        var r = cell.getBoundingClientRect();
        var hPad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        if (hPad < 8 && r.width > 0) cramped++;
        var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
        if (r.height > lh * 1.8 && cell.textContent.trim().length > 0) wrappedCells++;
      });
      if (cramped > 2 || wrappedCells > 2) {
        data.layout.tableCellIssues.push({ selector: cssSelector(table), totalCells: cells.length, crampedCells: cramped, wrappedCells: wrappedCells, tableWidth: Math.round(table.getBoundingClientRect().width), vpWidth: _vpW });
      }
    });
  }

  // --- Silently clipped content: flex/grid rows overflowing without scroll ---
  data.layout.clippedOverflow = [];
  if (_vpW < 768) {
    document.querySelectorAll('div,section,nav,footer,header').forEach(function(el) {
      if (!isVisible(el)) return;
      if (el.scrollWidth <= el.clientWidth + 4 || el.clientWidth < 50) return;
      var s = getComputedStyle(el);
      var isFlex = s.display === 'flex' || s.display === 'inline-flex';
      var isGrid = s.display === 'grid' || s.display === 'inline-grid';
      if (!isFlex && !isGrid) return;
      if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') return;
      if (isFlex && s.flexWrap !== 'nowrap') return;
      var overflowPx = el.scrollWidth - el.clientWidth;
      if (overflowPx > 8) {
        data.layout.clippedOverflow.push({ selector: cssSelector(el), overflow: overflowPx, containerWidth: el.clientWidth, contentWidth: el.scrollWidth, vpWidth: _vpW, display: s.display });
      }
    });
    data.layout.clippedOverflow = data.layout.clippedOverflow.slice(0, 10);
  }

  // --- Fixed element scroll-contrast risk detection ---
  data.layout.fixedContrastRisks = [];
  (function() {
    function _lum(r, g, b) { var a = [r,g,b].map(function(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
    function _pc(str) { var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? { r: +m[1], g: +m[2], b: +m[3] } : null; }
    var sections = document.querySelectorAll('section,main>div,[class*="bg-"]');
    var hasLight = false, hasDark = false;
    sections.forEach(function(sec) { var c = _pc(getComputedStyle(sec).backgroundColor); if (c) { var l = _lum(c.r, c.g, c.b); if (l > 0.4) hasLight = true; if (l < 0.15) hasDark = true; } });
    document.querySelectorAll('header,nav,[class*="fixed"]').forEach(function(el) {
      var s = getComputedStyle(el);
      if (s.position !== 'fixed') return;
      var lc = 0, dc = 0, fL = null, fD = null;
      el.querySelectorAll('a,button,span,svg,h1,h2,h3,p').forEach(function(child) {
        if (!isVisible(child)) return;
        var c = _pc(getComputedStyle(child).color);
        if (!c) return;
        var cl = _lum(c.r, c.g, c.b);
        if (cl > 0.6 && hasLight) { lc++; if (!fL) fL = child; }
        if (cl < 0.15 && hasDark) { dc++; if (!fD) fD = child; }
      });
      if (lc > 0 && fL) data.layout.fixedContrastRisks.push({ selector: cssSelector(el), text: (fL.textContent || fL.getAttribute('aria-label') || '').trim().substring(0, 30), color: getComputedStyle(fL).color, risk: 'light-on-light', element: el.tagName.toLowerCase(), childCount: lc });
      if (dc > 0 && fD) data.layout.fixedContrastRisks.push({ selector: cssSelector(el), text: (fD.textContent || fD.getAttribute('aria-label') || '').trim().substring(0, 30), color: getComputedStyle(fD).color, risk: 'dark-on-dark', element: el.tagName.toLowerCase(), childCount: dc });
    });
    data.layout.fixedContrastRisks = data.layout.fixedContrastRisks.slice(0, 10);
  })();

  // Hidden overflow clips — elements with overflow-x:hidden that silently clip content
  // This detects elements wider than their container but hidden instead of scrollable
  data.layout.hiddenClipElements = [];
  for (var hci = 0; hci < allElements.length && hci < 300; hci++) {
    var hcEl = allElements[hci];
    if (!isVisible(hcEl) || isDecorative(hcEl)) continue;
    var hcStyle = getComputedStyle(hcEl);
    var hcRadius = hcStyle.borderRadius;
    var hcHasRadius = hcRadius && hcRadius !== '0px' && hcRadius !== '0%';
    // Skip: rounded-corner clip (computed border-radius > 0), decorative overlays, fixed viewport elements
    // Also skip if the element itself or parent has no meaningful text (decorative containers)
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
  // Elements wider/taller than their parent without scroll/auto overflow
  // Skips: absolutely positioned, fixed, decorative, tiny elements, and elements
  // inside scroll containers (which handle overflow intentionally)
  data.layout.childExceedsParent = [];
  for (var cei = 0; cei < allElements.length && cei < 400; cei++) {
    var ceEl = allElements[cei];
    if (!isVisible(ceEl) || isDecorative(ceEl)) continue;
    if (ceEl.tagName === 'SCRIPT' || ceEl.tagName === 'STYLE' || ceEl.tagName === 'SVG' || ceEl.tagName === 'IMG') continue;
    var ceStyle = getComputedStyle(ceEl);
    // Skip positioned elements — they intentionally escape parent bounds
    if (ceStyle.position === 'absolute' || ceStyle.position === 'fixed' || ceStyle.position === 'sticky') continue;
    var ceParent = ceEl.parentElement;
    if (!ceParent || ceParent === document.body || ceParent === document.documentElement) continue;
    var ceRect = ceEl.getBoundingClientRect();
    var cpRect = ceParent.getBoundingClientRect();
    if (ceRect.width < 20 || cpRect.width < 20) continue;
    // Child wider than parent by more than 4px
    var excessRight = ceRect.right - cpRect.right;
    var excessLeft = cpRect.left - ceRect.left;
    var excess = Math.max(excessRight, excessLeft);
    if (excess <= 4) continue;
    // Check parent overflow
    var cpStyle = getComputedStyle(ceParent);
    var cpOx = cpStyle.overflowX;
    // scroll/auto = parent handles it, skip
    if (cpOx === 'auto' || cpOx === 'scroll') continue;
    // Skip if any ancestor has scroll/auto/hidden — walk up max 3 levels
    var hasScrollAncestor = false;
    var anc = ceParent.parentElement;
    for (var ancI = 0; ancI < 3 && anc && anc !== document.body; ancI++) {
      var ancOx = getComputedStyle(anc).overflowX;
      if (ancOx === 'auto' || ancOx === 'scroll' || ancOx === 'hidden') { hasScrollAncestor = true; break; }
      anc = anc.parentElement;
    }
    if (hasScrollAncestor) continue;
    // Track whether parent has explicit overflow set (hidden/visible = deliberate choice)
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
  // Find fixed/sticky elements with text that overlap other text content
  // Only flag when the overlapping element has a transparent background (text-on-text = unreadable)
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
  // Check each fixed element against visible text below it
  _fixedTextEls.forEach(function(fixed) {
    if (fixed.hasBg) return; // opaque background = intentional overlay (sticky header)
    // Sample a few points under the fixed element to see if text content is there
    var testPoints = [
      { x: fixed.rect.left + 10, y: fixed.rect.top + fixed.rect.height / 2 },
      { x: fixed.rect.left + fixed.rect.width / 2, y: fixed.rect.top + fixed.rect.height / 2 },
      { x: fixed.rect.right - 10, y: fixed.rect.top + fixed.rect.height / 2 }
    ];
    for (var tpi = 0; tpi < testPoints.length; tpi++) {
      var pt = testPoints[tpi];
      // Temporarily hide the fixed element to see what's under it
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
      // Wide container heuristic: if container is >= 80% viewport width, it should
      // fill the viewport, not scroll — this is a layout bug, not a data widget
      var isWideContainer = oel.clientWidth >= _vpW * 0.8;

      // Classification: intentional only if it has overflow CSS, contains data content,
      // does NOT contain structural children, and is NOT a wide layout container
      var classification = 'bug';
      if (hasOverflowCSS && isDataContent && !hasStructuralChildren) {
        classification = 'intentional';
      } else if (hasOverflowCSS && !isDataContent && !hasStructuralChildren && !isWideContainer) {
        // Small widget with overflow CSS and no structural children — give benefit of the doubt
        classification = 'intentional';
      }
      // No explicit overflow CSS but content spills = always a bug
      if (!hasOverflowCSS) classification = 'bug';
      // Wide containers that scroll = always a bug (should fill width)
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
      // Detect nested scrollbars (scrollable element inside another scrollable element)
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
    // Only skip if inside a genuinely intentional scroll container (data content)
    var anc = el.parentElement;
    var inIntentionalScroll = false;
    while (anc && anc !== document.body && anc !== document.documentElement) {
      var ox = getComputedStyle(anc).overflowX;
      if (ox === 'auto' || ox === 'scroll') {
        // Check if this scroll container holds data content (table/pre/code)
        var ancTag = anc.tagName.toLowerCase();
        var isData = !!_dataContentTags[ancTag] || !!anc.closest('table,pre,code');
        var isWide = anc.clientWidth >= _vpW * 0.8;
        if (isData && !isWide) { inIntentionalScroll = true; break; }
        // Wide or structural scroll container — NOT intentional, don't skip
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
      reason: r.right < 0 ? 'left-overflow' : r.left >= _vpW ? 'right-overflow' : 'major-clip'
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
    var children = el.querySelectorAll(_meaningfulSel);
    children.forEach(function(child) {
      var cs = getComputedStyle(child);
      if (cs.display === 'none') return;
      var cr = child.getBoundingClientRect();
      if (cr.width < 4 || cr.height < 4) return;
      var fullyOff = cr.right < 0 || cr.left >= _vpW;
      var majorClip = cr.left < _vpW && cr.right > _vpW && (cr.right - _vpW) > cr.width * 0.5;
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
        vpWidth: _vpW,
        reason: 'hidden-fixed-overflow'
      });
    });
    // Restore
    el.style.opacity = origOpacity;
    el.style.visibility = origVisibility;
    el.style.pointerEvents = origPointerEvents;
  });
  data.layout.offscreenElements = data.layout.offscreenElements.slice(0, 20);

  // --- Hidden panel detection (hybrid unhide) ---
  // Find ALL interactive panels (menus, dialogs, listboxes) that are currently invisible,
  // regardless of HOW they're hidden (CSS class, aria-hidden, [hidden] attr, inline style).
  // Temporarily reveal each one to check for overflow/offscreen issues.
  data.layout.hiddenPanelIssues = [];
  var _hiddenPanels = [];
  // 1. Any element with interactive role that's not visible
  document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"], [role="tooltip"], [role="alertdialog"]').forEach(function(el) {
    if (!isVisible(el) && _hiddenPanels.indexOf(el) === -1) _hiddenPanels.push(el);
  });
  // 2. Panels referenced by aria-controls on triggers (only overlay-type panels, not inline content)
  // Skip accordion panels (role="region") and tab panels (role="tabpanel") — they expand inline, not as overlays
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
  // 3. Panels referenced by aria-haspopup triggers (find sibling/child panels)
  document.querySelectorAll('[aria-haspopup="true"], [aria-haspopup="menu"], [aria-haspopup="dialog"], [aria-haspopup="listbox"]').forEach(function(trigger) {
    // Check aria-controls first
    var ctrlId = trigger.getAttribute('aria-controls');
    if (ctrlId) {
      var t = document.getElementById(ctrlId);
      if (t && !isVisible(t) && _hiddenPanels.indexOf(t) === -1) _hiddenPanels.push(t);
      return;
    }
    // Otherwise look for adjacent/sibling panel or panel inside the same wrapper
    var wrapper = trigger.parentElement;
    if (!wrapper) return;
    var candidates = wrapper.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]');
    candidates.forEach(function(c) {
      if (!isVisible(c) && _hiddenPanels.indexOf(c) === -1) _hiddenPanels.push(c);
    });
  });
  // 4. Event listener inspection (Chrome DevTools only — getEventListeners)
  if (typeof getEventListeners === 'function') {
    document.querySelectorAll('button, [role="button"]').forEach(function(btn) {
      try {
        var listeners = getEventListeners(btn);
        if (!listeners.click || listeners.click.length === 0) return;
        // Look for sibling/adjacent hidden panels
        var wrapper = btn.parentElement;
        if (!wrapper) return;
        var panels = wrapper.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"], .dropdown-menu, .popover, [class*="dropdown"], [class*="popover"]');
        panels.forEach(function(p) {
          if (!isVisible(p) && _hiddenPanels.indexOf(p) === -1) _hiddenPanels.push(p);
        });
      } catch(e) {}
    });
  }

  // Temporarily unhide each panel, measure, re-hide
  _hiddenPanels.slice(0, 15).forEach(function(panel) {
    // Save original state
    var origStyles = {
      display: panel.style.display,
      visibility: panel.style.visibility,
      opacity: panel.style.opacity,
      pointerEvents: panel.style.pointerEvents,
      position: panel.style.position,
      className: panel.className
    };
    var origAriaHidden = panel.getAttribute('aria-hidden');
    var origHidden = panel.hasAttribute('hidden');
    // Force visible — use !important via style.cssText to override CSS classes like Tailwind's .hidden
    var origCssText = panel.style.cssText;
    panel.style.cssText = origCssText + '; display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: none !important;';
    if (origHidden) panel.removeAttribute('hidden');
    if (origAriaHidden) panel.setAttribute('aria-hidden', 'false');
    // Force a reflow
    void panel.offsetHeight;
    // Measure for offscreen/overflow issues
    var pr = panel.getBoundingClientRect();
    var issues = [];
    if (pr.width > 0 && pr.height > 0) {
      if (pr.right > _vpW + 2) {
        issues.push({ type: 'right-overflow', overflow: Math.round(pr.right - _vpW) });
      }
      if (pr.left < -2) {
        issues.push({ type: 'left-overflow', overflow: Math.round(Math.abs(pr.left)) });
      }
      if (pr.bottom > window.innerHeight * 2) {
        issues.push({ type: 'extreme-bottom', bottom: Math.round(pr.bottom) });
      }
      // Check children for overflow too
      if (panel.scrollWidth > panel.clientWidth + 2) {
        issues.push({ type: 'internal-overflow', overflow: Math.round(panel.scrollWidth - panel.clientWidth) });
      }
    }
    // Restore original state
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
        issues: issues
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

  // --- Extended checks (high + medium priority) ---

  // 1. Duplicate IDs
  var idMap = {};
  document.querySelectorAll('[id]').forEach(function(el) {
    var id = el.id;
    if (id) idMap[id] = (idMap[id] || 0) + 1;
  });
  data.accessibility.duplicateIds = Object.keys(idMap).filter(function(id) { return idMap[id] > 1; }).map(function(id) {
    // Check if used in label/ARIA (higher severity)
    var usedInLabel = !!document.querySelector('label[for="' + CSS.escape(id) + '"], [aria-labelledby~="' + CSS.escape(id) + '"], [aria-describedby~="' + CSS.escape(id) + '"], [aria-controls="' + CSS.escape(id) + '"]');
    return { id: id, count: idMap[id], usedInAria: usedInLabel };
  }).slice(0, 15);

  // 2. Scrollable regions without keyboard access
  data.accessibility.scrollableNoKeyboard = 0;
  document.querySelectorAll('*').forEach(function(el) {
    if (el.tagName === 'BODY' || el.tagName === 'HTML') return;
    var s = getComputedStyle(el);
    var isScrollable = (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 10;
    if (!isScrollable) isScrollable = (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 10;
    if (!isScrollable) return;
    var hasFocusable = el.querySelector('a, button, input, select, textarea, [tabindex]');
    var hasTabindex = el.hasAttribute('tabindex');
    if (!hasFocusable && !hasTabindex) data.accessibility.scrollableNoKeyboard++;
  });

  // 3. Nested interactive elements
  data.accessibility.nestedInteractives = [];
  document.querySelectorAll('a a, a button, button a, button button').forEach(function(el) {
    if (!isVisible(el)) return;
    data.accessibility.nestedInteractives.push(cssSelector(el));
  });
  data.accessibility.nestedInteractives = data.accessibility.nestedInteractives.slice(0, 10);

  // 4. Positive tabindex
  data.accessibility.positiveTabindex = 0;
  document.querySelectorAll('[tabindex]').forEach(function(el) {
    if (parseInt(el.getAttribute('tabindex')) > 0) data.accessibility.positiveTabindex++;
  });

  // 5. Empty buttons/links (no accessible name)
  data.accessibility.emptyInteractives = [];
  document.querySelectorAll('a, button, [role="button"], [role="link"]').forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var text = (el.textContent || '').trim();
    var ariaLabel = el.getAttribute('aria-label') || '';
    var ariaLabelledBy = el.getAttribute('aria-labelledby');
    var title = el.getAttribute('title') || '';
    var hasImg = el.querySelector('img[alt]:not([alt=""])');
    var hasSvgTitle = el.querySelector('svg title');
    if (!text && !ariaLabel && !ariaLabelledBy && !title && !hasImg && !hasSvgTitle) {
      data.accessibility.emptyInteractives.push(cssSelector(el));
    }
  });
  data.accessibility.emptyInteractives = data.accessibility.emptyInteractives.slice(0, 10);

  // 6. Non-text contrast (WCAG 1.4.11) — input borders, button borders
  data.accessibility.nonTextContrast = [];
  document.querySelectorAll('input, select, textarea').forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var s = getComputedStyle(el);
    var borderColor = parseColor(s.borderColor || s.borderTopColor);
    if (!borderColor || borderColor.a < 0.3) return; // no visible border
    var bg = getEffectiveBg(el);
    var borderBlended = blendOnWhite(borderColor);
    var ratio = contrastRatio(borderBlended, bg);
    if (ratio < 3) {
      data.accessibility.nonTextContrast.push({
        selector: cssSelector(el),
        ratio: Math.round(ratio * 100) / 100,
        borderColor: rgbStr(borderBlended),
        bg: rgbStr(bg)
      });
    }
  });
  data.accessibility.nonTextContrast = data.accessibility.nonTextContrast.slice(0, 10);

  // 7. Z-index sprawl
  var zIndexValues = {};
  for (var zi = 0; zi < allElements.length && zi < 500; zi++) {
    var zEl = allElements[zi];
    var zVal = getComputedStyle(zEl).zIndex;
    if (zVal !== 'auto') zIndexValues[zVal] = (zIndexValues[zVal] || 0) + 1;
  }
  data.layout.zIndexSprawl = {
    distinct: Object.keys(zIndexValues).length,
    max: Object.keys(zIndexValues).length > 0 ? Math.max.apply(null, Object.keys(zIndexValues).map(Number)) : 0,
    values: Object.keys(zIndexValues).map(function(z) { return { value: +z, count: zIndexValues[z] }; }).sort(function(a, b) { return b.value - a.value; }).slice(0, 10)
  };

  // 8. Shadow consistency
  var shadowValues = {};
  for (var si = 0; si < allElements.length && si < 500; si++) {
    var sEl = allElements[si];
    if (!isVisible(sEl)) continue;
    var shadow = getComputedStyle(sEl).boxShadow;
    if (shadow && shadow !== 'none') shadowValues[shadow] = (shadowValues[shadow] || 0) + 1;
  }
  data.layout.shadowSprawl = Object.keys(shadowValues).length;

  // 9. Pure black/white in dark mode (halation)
  data.colors.darkModeHalation = false;
  if (data.structure.isDarkPage) {
    data.colors.contrastPairs.forEach(function(p) {
      var fg = parseColor(p.fg);
      var bg = parseColor(p.bg);
      if (!fg || !bg) return;
      // Near-black bg (< 10) with near-white fg (> 245)
      if (bg.r < 10 && bg.g < 10 && bg.b < 10 && fg.r > 245 && fg.g > 245 && fg.b > 245) {
        data.colors.darkModeHalation = true;
      }
    });
  }

  // 10. Table accessibility
  data.accessibility.tableIssues = [];
  document.querySelectorAll('table').forEach(function(table) {
    if (!isVisible(table) || isDecorative(table)) return;
    var issues = [];
    if (!table.querySelector('th')) issues.push('no-th');
    var ths = table.querySelectorAll('th');
    var noScope = 0;
    ths.forEach(function(th) { if (!th.getAttribute('scope')) noScope++; });
    if (noScope > 0 && ths.length > 0) issues.push('no-scope');
    if (!table.querySelector('caption') && !table.getAttribute('aria-label') && !table.getAttribute('aria-labelledby')) issues.push('no-caption');
    if (issues.length > 0) data.accessibility.tableIssues.push({ selector: cssSelector(table), issues: issues });
  });

  // 11. Missing button type
  data.accessibility.missingButtonType = document.querySelectorAll('button:not([type])').length;

  // 12. All-caps long text
  data.typography.allCapsLongText = 0;
  for (var aci = 0; aci < allElements.length && aci < 300; aci++) {
    var acEl = allElements[aci];
    if (!isVisible(acEl) || isDecorative(acEl)) continue;
    var acStyle = getComputedStyle(acEl);
    if (acStyle.textTransform === 'uppercase') {
      var acText = (acEl.textContent || '').trim();
      if (acText.length > 50) data.typography.allCapsLongText++;
    }
  }

  // 13. Justified text
  data.typography.justifiedText = 0;
  for (var jti = 0; jti < allElements.length && jti < 300; jti++) {
    var jtEl = allElements[jti];
    if (!isVisible(jtEl) || isDecorative(jtEl)) continue;
    if (getComputedStyle(jtEl).textAlign === 'justify') {
      var jtText = (jtEl.textContent || '').trim();
      if (jtText.length > 30) data.typography.justifiedText++;
    }
  }

  // --- Tier 1: Quick win checks ---

  // Image upscale detection (rendered larger than natural size)
  data.performance.upscaledImages = [];
  document.querySelectorAll('img').forEach(function(img) {
    if (!img.naturalWidth || !img.complete || !isVisible(img)) return;
    var r = img.getBoundingClientRect();
    if (r.width < 24) return; // skip tiny icons
    var dpr = window.devicePixelRatio || 1;
    var renderedW = r.width * dpr;
    if (renderedW > img.naturalWidth * 1.1) {
      var upscale = Math.round(renderedW / img.naturalWidth * 100);
      data.performance.upscaledImages.push({ selector: cssSelector(img), rendered: Math.round(r.width) + 'x' + Math.round(r.height), natural: img.naturalWidth + 'x' + img.naturalHeight, upscale: upscale });
    }
  });
  data.performance.upscaledImages = data.performance.upscaledImages.slice(0, 10);

  // Text clipping without title
  data.accessibility.textClippedNoTitle = 0;
  for (var tci = 0; tci < allElements.length && tci < 300; tci++) {
    var tcEl = allElements[tci];
    if (!isVisible(tcEl) || isDecorative(tcEl)) continue;
    var tcS = getComputedStyle(tcEl);
    var isClipped = tcS.textOverflow === 'ellipsis' || (tcS.overflow === 'hidden' && tcS.whiteSpace === 'nowrap' && tcEl.scrollWidth > tcEl.clientWidth + 2);
    if (isClipped && !tcEl.getAttribute('title') && !tcEl.getAttribute('aria-label')) {
      data.accessibility.textClippedNoTitle++;
    }
  }

  // Placeholder-only labels
  data.accessibility.placeholderOnlyInputs = 0;
  document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(function(el) {
    if (!isVisible(el)) return;
    var hasLabel = el.labels && el.labels.length > 0;
    var hasAriaLabel = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
    if (!hasLabel && !hasAriaLabel) data.accessibility.placeholderOnlyInputs++;
  });

  // Links without underline or color distinction (in body text, not nav)
  data.accessibility.invisibleLinks = 0;
  document.querySelectorAll('a[href]').forEach(function(a) {
    if (!isVisible(a) || isDecorative(a) || a.closest('nav, header, footer, [role="navigation"]')) return;
    var aS = getComputedStyle(a);
    var pS = a.parentElement ? getComputedStyle(a.parentElement) : null;
    if (!pS) return;
    var hasUnderline = aS.textDecorationLine && aS.textDecorationLine.indexOf('underline') !== -1;
    var hasColorDiff = aS.color !== pS.color;
    var hasBgDiff = aS.backgroundColor !== 'rgba(0, 0, 0, 0)' && aS.backgroundColor !== 'transparent';
    if (!hasUnderline && !hasColorDiff && !hasBgDiff) data.accessibility.invisibleLinks++;
  });

  // Required fields without visual indicator
  data.accessibility.requiredNoIndicator = 0;
  document.querySelectorAll('[required]').forEach(function(el) {
    if (!isVisible(el)) return;
    var label = (el.labels && el.labels[0]) || (el.id && document.querySelector('label[for="' + el.id + '"]'));
    if (!label) return;
    var labelText = label.textContent || '';
    if (!/\*/.test(labelText) && !/required/i.test(labelText) && !label.querySelector('.required, [class*="required"]')) {
      data.accessibility.requiredNoIndicator++;
    }
  });

  // Input without visible boundary
  data.accessibility.invisibleInputs = 0;
  document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea').forEach(function(el) {
    if (!isVisible(el) || isDecorative(el)) return;
    var s = getComputedStyle(el);
    var hasBorder = parseFloat(s.borderWidth) > 0 && s.borderStyle !== 'none';
    var hasShadow = s.boxShadow !== 'none';
    var bg = parseColor(s.backgroundColor);
    var parentBg = getEffectiveBg(el.parentElement || el);
    var hasDistinctBg = bg && parentBg && contrastRatio(blendOnWhite(bg), parentBg) > 1.15;
    if (!hasBorder && !hasShadow && !hasDistinctBg) data.accessibility.invisibleInputs++;
  });

  // will-change overuse
  data.performance.willChangeCount = 0;
  for (var wci = 0; wci < allElements.length && wci < 300; wci++) {
    var wcEl = allElements[wci];
    var wc = getComputedStyle(wcEl).willChange;
    if (wc && wc !== 'auto') data.performance.willChangeCount++;
  }

  // Disabled element contrast
  data.accessibility.disabledLowContrast = 0;
  document.querySelectorAll('[disabled], [aria-disabled="true"]').forEach(function(el) {
    if (!isVisible(el)) return;
    var fg = parseColor(getComputedStyle(el).color);
    if (!fg) return;
    var bg = getEffectiveBg(el);
    var ratio = contrastRatio(blendOnWhite(fg), bg);
    if (ratio < 2.0) data.accessibility.disabledLowContrast++;
  });

  // --- Tier 1 remaining + Tier 2 checks ---

  // Select without meaningful default option
  data.accessibility.selectNoDefault = 0;
  document.querySelectorAll('select').forEach(function(sel) {
    if (!isVisible(sel)) return;
    var opts = sel.querySelectorAll('option');
    if (opts.length === 0) { data.accessibility.selectNoDefault++; return; }
    if (opts[0].textContent.trim() === '' && !opts[0].disabled) data.accessibility.selectNoDefault++;
  });

  // Large fixed elements consuming viewport (> 25% height)
  data.layout.fixedViewportConsumption = 0;
  var fixedTotalH = 0;
  for (var fvi = 0; fvi < allElements.length && fvi < 200; fvi++) {
    var fvEl = allElements[fvi];
    var fvS = getComputedStyle(fvEl);
    if (fvS.position === 'fixed' || fvS.position === 'sticky') {
      var fvR = fvEl.getBoundingClientRect();
      if (fvR.height > 10 && fvR.width > _vpW * 0.5) fixedTotalH += fvR.height;
    }
  }
  data.layout.fixedViewportConsumption = Math.round(fixedTotalH / window.innerHeight * 100);

  // CSS filter complexity
  data.performance.complexFilters = 0;
  for (var cfi = 0; cfi < allElements.length && cfi < 300; cfi++) {
    var cfEl = allElements[cfi];
    if (!isVisible(cfEl)) continue;
    var cfFilter = getComputedStyle(cfEl).filter;
    if (cfFilter && cfFilter !== 'none') {
      var filterCount = (cfFilter.match(/\(/g) || []).length;
      if (filterCount >= 3) data.performance.complexFilters++;
    }
  }

  // Button/CTA hierarchy — detect if all buttons look the same
  data.layout.buttonHierarchy = { total: 0, filled: 0, outline: 0, text: 0 };
  document.querySelectorAll('button, [role="button"], a').forEach(function(btn) {
    if (!isVisible(btn) || isDecorative(btn)) return;
    var bs = getComputedStyle(btn);
    var hasBg = bs.backgroundColor !== 'rgba(0, 0, 0, 0)' && bs.backgroundColor !== 'transparent';
    var hasPad = parseFloat(bs.paddingLeft) > 8 && parseFloat(bs.paddingTop) > 4;
    var hasBorder = parseFloat(bs.borderWidth) > 0 && bs.borderStyle !== 'none';
    if (!hasPad) return; // not styled as a button
    data.layout.buttonHierarchy.total++;
    if (hasBg && !hasBorder) data.layout.buttonHierarchy.filled++;
    else if (!hasBg && hasBorder) data.layout.buttonHierarchy.outline++;
    else if (hasBg && hasBorder) data.layout.buttonHierarchy.filled++;
    else data.layout.buttonHierarchy.text++;
  });

  // Border width consistency in sibling groups
  data.consistency = data.consistency || {};
  data.consistency.borderWidthInconsistencies = 0;
  document.querySelectorAll('[style*="display:flex"], [style*="display: flex"], .flex, .grid').forEach(function(container) {
    if (!isVisible(container) || container.children.length < 3) return;
    var widths = {};
    Array.from(container.children).slice(0, 10).forEach(function(child) {
      var bw = getComputedStyle(child).borderTopWidth;
      if (bw !== '0px') widths[bw] = (widths[bw] || 0) + 1;
    });
    if (Object.keys(widths).length > 1) data.consistency.borderWidthInconsistencies++;
  });

  // Font weight role consistency (same heading level with different weights)
  data.consistency.fontWeightInconsistencies = 0;
  var hwByLevel = {};
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h) {
    if (!isVisible(h)) return;
    var tag = h.tagName.toLowerCase();
    var w = getComputedStyle(h).fontWeight;
    if (!hwByLevel[tag]) hwByLevel[tag] = new Set();
    hwByLevel[tag].add(w);
  });
  Object.keys(hwByLevel).forEach(function(tag) {
    if (hwByLevel[tag].size > 1) data.consistency.fontWeightInconsistencies++;
  });

  // Gradient direction consistency
  data.consistency.gradientDirections = 0;
  var gradDirs = {};
  for (var gdi = 0; gdi < allElements.length && gdi < 200; gdi++) {
    var gdEl = allElements[gdi];
    if (!isVisible(gdEl) || isDecorative(gdEl)) continue;
    var bgImg = getComputedStyle(gdEl).backgroundImage;
    if (bgImg && bgImg.indexOf('linear-gradient') !== -1) {
      var dirMatch = bgImg.match(/linear-gradient\((\d+deg|to \w+)/);
      if (dirMatch) gradDirs[dirMatch[1]] = (gradDirs[dirMatch[1]] || 0) + 1;
    }
  }
  data.consistency.gradientDirections = Object.keys(gradDirs).length;

  // Forced compositor layers (translateZ(0) hack)
  data.performance.forcedLayers = 0;
  for (var fli = 0; fli < allElements.length && fli < 300; fli++) {
    var flEl = allElements[fli];
    var flT = getComputedStyle(flEl).transform;
    if (flT && flT !== 'none' && /matrix3d/.test(flT)) data.performance.forcedLayers++;
  }

  // --- Tier 4: Opt-in expensive checks (only in 'full' scan mode) ---
  if (_doExpensive) {

    // Visual noise density per viewport band
    data.layout.visualNoiseBands = [];
    var vpBands = Math.ceil(Math.max(document.body.scrollHeight, window.innerHeight) / window.innerHeight);
    for (var vbi = 0; vbi < Math.min(vpBands, 5); vbi++) {
      var bandTop = vbi * window.innerHeight;
      var bandBottom = bandTop + window.innerHeight;
      var noiseScore = 0;
      for (var vni = 0; vni < allElements.length && vni < 500; vni++) {
        var vnEl = allElements[vni];
        if (!isVisible(vnEl) || isDecorative(vnEl)) continue;
        var vnR = vnEl.getBoundingClientRect();
        var absTop = vnR.top + window.scrollY;
        if (absTop + vnR.height < bandTop || absTop > bandBottom) continue;
        var vnS = getComputedStyle(vnEl);
        if (vnS.boxShadow !== 'none') noiseScore += 1;
        if (vnS.backgroundColor !== 'rgba(0, 0, 0, 0)' && vnS.backgroundColor !== 'transparent') noiseScore += 0.5;
        if (parseFloat(vnS.borderWidth) > 0 && vnS.borderStyle !== 'none') noiseScore += 0.5;
        if (parseInt(vnS.fontWeight) >= 700) noiseScore += 0.3;
        if (vnEl.tagName === 'IMG') noiseScore += 1;
      }
      data.layout.visualNoiseBands.push({ band: vbi, score: Math.round(noiseScore * 10) / 10 });
    }

    // Empty containers (visible but no content)
    data.layout.emptyContainers = 0;
    document.querySelectorAll('ul, ol, tbody, [role="list"], [role="grid"], main, section').forEach(function(el) {
      if (!isVisible(el)) return;
      var r = el.getBoundingClientRect();
      if (r.height > 50 && el.textContent.trim() === '' && el.querySelectorAll('img, svg, canvas, video').length === 0) {
        data.layout.emptyContainers++;
      }
    });

    // Icon size consistency (SVGs relative to parent text)
    data.consistency.iconSizeVariance = 0;
    var iconRatios = [];
    document.querySelectorAll('svg').forEach(function(svg) {
      if (!isVisible(svg) || isDecorative(svg)) return;
      var r = svg.getBoundingClientRect();
      if (r.height < 8 || r.height > 100) return;
      var parentFS = parseFloat(getComputedStyle(svg.parentElement || svg).fontSize) || 16;
      iconRatios.push(r.height / parentFS);
    });
    if (iconRatios.length >= 3) {
      var iconAvg = iconRatios.reduce(function(s, r) { return s + r; }, 0) / iconRatios.length;
      var iconVar = iconRatios.reduce(function(s, r) { return s + Math.pow(r - iconAvg, 2); }, 0) / iconRatios.length;
      var iconCV = iconAvg > 0 ? Math.sqrt(iconVar) / iconAvg : 0;
      data.consistency.iconSizeVariance = Math.round(iconCV * 100);
    }

    // Padding asymmetry in buttons/cards
    data.consistency.paddingAsymmetry = 0;
    document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(function(el) {
      if (!isVisible(el) || isDecorative(el)) return;
      var s = getComputedStyle(el);
      var pl = parseFloat(s.paddingLeft) || 0;
      var pr = parseFloat(s.paddingRight) || 0;
      if (Math.abs(pl - pr) > 4 && pl > 0 && pr > 0) data.consistency.paddingAsymmetry++;
    });

    // Color temperature mixing (warm vs cool accents)
    data.colors.temperatureMixing = false;
    var warmCount = 0, coolCount = 0;
    (data.colors.textColors || []).concat(data.colors.bgColors || []).forEach(function(c) {
      var rgb = parseColor(c.value || c);
      if (!rgb) return;
      // Convert to hue
      var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var sat = max > 0 ? (max - min) / max : 0;
      if (sat < 0.15) return; // neutral, skip
      var hue = 0;
      if (max === r) hue = 60 * ((g - b) / (max - min));
      else if (max === g) hue = 60 * (2 + (b - r) / (max - min));
      else hue = 60 * (4 + (r - g) / (max - min));
      if (hue < 0) hue += 360;
      if ((hue >= 0 && hue <= 60) || hue >= 300) warmCount++;
      else if (hue >= 150 && hue <= 270) coolCount++;
    });
    if (warmCount >= 3 && coolCount >= 3) data.colors.temperatureMixing = true;

  } // end _doExpensive

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
    var bodySmooth = getComputedStyle(document.body).webkitFontSmoothing || getComputedStyle(document.body)['-webkit-font-smoothing'] || '';
    if (bodySmooth === 'antialiased') data.typography.fontSmoothingAntialiased = true;
    if (!data.typography.fontSmoothingAntialiased) {
      // Check via stylesheets
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
  // Element type distribution and hidden element counts to surface structural issues
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
  // Semantic element counts
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
    // Div ratio: high values indicate "div soup"
    divRatio: allElements.length > 0 ? Math.round((_tagCounts['div'] || 0) / allElements.length * 100) : 0,
    // Top 5 most-used tags (excluding script/style/link)
    topTags: Object.keys(_tagCounts).filter(function(t) { return t !== 'script' && t !== 'style' && t !== 'link'; }).sort(function(a, b) { return _tagCounts[b] - _tagCounts[a]; }).slice(0, 5).map(function(t) { return { tag: t, count: _tagCounts[t] }; })
  };

  // --- Event listener extraction (Chrome DevTools API only) ---
  // Collects handler source code as TEXT for display — NEVER executed
  data.interaction.eventListeners = [];
  data.interaction.listenerPatterns = { toggleNoAria: 0, navigationInButton: 0, fetchNoLoading: 0 };
  data.interaction.listenerStats = { total: 0, elementsWithListeners: 0, nonPassiveScroll: 0 };
  if (typeof getEventListeners === 'function') {
    function _safeSrc(fn) {
      try {
        var src = Function.prototype.toString.call(fn);
        if (src.indexOf('[native code]') !== -1) return '[native]';
        return src.length > 500 ? src.substring(0, 500) + '...' : src;
      } catch(e) { return '[unreadable]'; }
    }
    // Element listeners
    var _elSample = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick], input, select')).slice(0, 50);
    _elSample.forEach(function(el) {
      try {
        var listeners = getEventListeners(el);
        if (!listeners) return;
        var types = Object.keys(listeners);
        if (types.length === 0) return;
        data.interaction.listenerStats.elementsWithListeners++;
        var entry = { selector: cssSelector(el), tag: el.tagName.toLowerCase(), handlers: [] };
        types.forEach(function(type) {
          listeners[type].forEach(function(l) {
            data.interaction.listenerStats.total++;
            var src = _safeSrc(l.listener);
            // Pattern analysis on source text (never executed)
            if (type === 'click' && src !== '[native]' && src !== '[unreadable]') {
              var hasToggle = /classList\.(toggle|add|remove)/.test(src);
              var hasAriaExpanded = /aria-expanded|setAttribute.*aria/.test(src);
              if (hasToggle && !hasAriaExpanded) data.interaction.listenerPatterns.toggleNoAria++;
              if (/location\.(href|assign)|window\.location|router\.push/.test(src) && el.tagName === 'BUTTON') {
                data.interaction.listenerPatterns.navigationInButton++;
              }
              if (/fetch\(|XMLHttpRequest|\.ajax\(|axios/.test(src)) {
                data.interaction.listenerPatterns.fetchNoLoading++;
              }
            }
            entry.handlers.push({ type: type, source: src, once: !!l.once, passive: !!l.passive });
          });
        });
        if (entry.handlers.length > 0) data.interaction.eventListeners.push(entry);
      } catch(e) {}
    });
    data.interaction.eventListeners = data.interaction.eventListeners.slice(0, 20);
    // Window/document listener stats
    try {
      var _winL = getEventListeners(window);
      Object.keys(_winL).forEach(function(type) {
        data.interaction.listenerStats.total += _winL[type].length;
        if (type === 'scroll') _winL[type].forEach(function(l) { if (!l.passive) data.interaction.listenerStats.nonPassiveScroll++; });
      });
    } catch(e) {}
  }

  // Clean up measurement span
  document.body.removeChild(_measureSpan);

  // --- Output ---
  var json = JSON.stringify(data, null, 2);

  // Copy to clipboard — multiple fallback strategies
  function copyFallback() {
    // Fallback 1: execCommand with temporary textarea
    var ta = document.createElement('textarea');
    ta.value = json;
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try {
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        console.log('%c✓ Design data copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
        return;
      }
    } catch(e) {
      document.body.removeChild(ta);
    }
    // Fallback 2: log the full JSON to console so user can right-click → Copy string
    console.log('%c⚠ Could not copy to clipboard automatically. Right-click the JSON below → "Copy string contents":', 'color: #b45309; font-weight: bold;');
    console.log(json);
    // Also store for easy access
    console.log('%cOr type: copy(window.__milgData_json)', 'color: #64748b;');
    window.__milgData_json = json;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(json).then(function() {
      console.log('%c✓ Design data copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
    }).catch(copyFallback);
  } else {
    copyFallback();
  }

  console.log('%cmake-it-look-good extraction complete', 'color: #3b82f6; font-weight: bold;');
  console.log('Elements scanned:', data.structure.totalElements);
  console.log('Contrast pairs:', data.colors.contrastPairs.length);
  console.log('Touch target issues:', data.interaction.touchTargets.length);

  // Also store on window for debugging
  window.__milgData = data;

  // --- Site Crawl Mode (same-origin iframe with src=, full JS execution) ---
  // Set window.__milgCrawlSite = true before running.
  // Loads each page in a hidden same-origin iframe (src=url), waits for full JS
  // execution, then injects the extraction snippet. Stays on current page.
  if (window.__milgCrawlSite) {
    var _crawlMax = Math.min(Math.max(window.__milgCrawlMaxPages || 5, 1), 25);
    var _crawlBlacklist = window.__milgCrawlBlacklist || [];
    var _crawlOrigin = location.origin;
    var _crawlSeen = {};
    var _curPath = location.pathname.replace(/\/$/, '');
    _crawlSeen[_crawlOrigin + _curPath] = true;
    // Also mark index variants as seen to avoid re-crawling the current page
    if (_curPath === '' || _curPath === '/index.html' || _curPath === '/index.htm') {
      _crawlSeen[_crawlOrigin] = true; _crawlSeen[_crawlOrigin + '/index.html'] = true; _crawlSeen[_crawlOrigin + '/index.htm'] = true;
    }

    var _crawlLinks = [];
    document.querySelectorAll('a[href]').forEach(function(a) {
      var href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
      try {
        var u = new URL(href, location.href);
        if (u.origin !== _crawlOrigin) return;
        if (/\.(pdf|zip|png|jpg|svg|css|js|json|xml|woff2?)$/i.test(u.pathname)) return;
        u.hash = '';
        var key = u.origin + u.pathname.replace(/\/$/, '');
        if (_crawlSeen[key]) return;
        var blocked = _crawlBlacklist.some(function(pat) { pat = pat.trim(); if (!pat) return false; if (pat.endsWith('*')) return u.pathname.startsWith(pat.slice(0, -1)); return u.pathname === pat; });
        if (blocked) return;
        _crawlSeen[key] = true;
        _crawlLinks.push(u.origin + u.pathname);
      } catch(e) {}
    });
    _crawlLinks = _crawlLinks.slice(0, _crawlMax - 1);

    var _crawlResults = [{ url: location.href, data: data }];
    console.log('%c\uD83D\uDD77 Site Crawl: discovered ' + _crawlLinks.length + ' page(s)', 'color: #8b5cf6; font-weight: bold;');
    _crawlLinks.forEach(function(l, i) { var p; try { p = new URL(l).pathname; } catch(e) { p = l; } console.log('  ' + (i + 1) + '. ' + p); });

    // Copy full crawl results to clipboard (localStorage doesn't work cross-origin)
    function _copyCrawlResults(results) {
      var crawlJson = JSON.stringify({ _milgCrawl: true, startUrl: location.href, results: results });
      window.__milgCrawlResults = results;
      window.__milgCrawlJson = crawlJson;
      try { localStorage.setItem('milg-crawl-complete', crawlJson); } catch(e) {}
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(crawlJson).then(function() {
          console.log('%c\u2713 Crawl results copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
        }).catch(function() {
          var ta = document.createElement('textarea'); ta.value = crawlJson;
          ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch(e) {}
          document.body.removeChild(ta);
          console.log('%c\u26A0 Type: copy(window.__milgCrawlJson) — then paste into the analyzer.', 'color: #b45309; font-weight: bold;');
        });
      } else {
        console.log('%c\u26A0 Type: copy(window.__milgCrawlJson) — then paste into the analyzer.', 'color: #b45309; font-weight: bold;');
      }
    }

    if (_crawlLinks.length === 0) {
      _copyCrawlResults(_crawlResults);
      console.log('%c\u2713 Crawl complete (1 page). Open the analyzer.', 'color: #16a34a; font-weight: bold;');
    } else {
      // Crawl: fetch page HTML (same-origin), load as srcdoc (bypasses X-Frame-Options),
      // inject snippet, poll for results.
      var _snippetUrl = 'https://jdeworks.github.io/make-it-look-good/analyzer-snippet.js';
      console.log('%cLoading extraction snippet for injection\u2026', 'color: #64748b;');

      fetch(_snippetUrl).then(function(r) { return r.text(); }).then(function(snippetSrc) {
        console.log('%c\u2713 Snippet loaded. Starting crawl.', 'color: #16a34a;');

        function processNext(idx) {
          if (idx >= _crawlLinks.length) {
            _copyCrawlResults(_crawlResults);
            console.log('%c\u2713 Crawl complete! ' + _crawlResults.length + ' pages analyzed.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
            return;
          }

          var url = _crawlLinks[idx];
          var path; try { path = new URL(url).pathname; } catch(e) { path = url; }
          console.log('%c\u2192 [' + (idx + 1) + '/' + _crawlLinks.length + '] ' + path, 'color: #3b82f6;');

          // Fetch page HTML (same-origin) then load as srcdoc (bypasses X-Frame-Options)
          fetch(url).then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
          }).then(function(html) {
            // Srcdoc environment patches (URL constructor, History API, fetch)
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
            // Inject BEFORE the first <script> tag so patches run before any framework JS
            if (/<script[\s>]/i.test(html)) {
              html = html.replace(/<script[\s>]/i, headPatch + '<script ');
            } else if (/<head[\s>]/i.test(html)) {
              html = html.replace(/<head([^>]*)>/i, '<head$1>' + headPatch);
            } else {
              html = headPatch + html;
            }
            html = html.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');

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
                  var poller = setInterval(function() {
                    if (done) { clearInterval(poller); return; }
                    polls++;
                    try {
                      var iData = iWin.__milgData;
                      if (iData) {
                        clearInterval(poller); done = true;
                        iData.meta.url = url;
                        _crawlResults.push({ url: url, data: iData });
                        cleanup();
                        console.log('%c  \u2713 ' + path + ' (' + (iData.structure.totalElements || 0) + ' elements)', 'color: #16a34a;');
                        setTimeout(function() { processNext(idx + 1); }, 500);
                      } else if (polls > 20) {
                        clearInterval(poller); done = true;
                        console.log('%c  \u2717 Timeout: ' + path, 'color: #dc2626;');
                        cleanup();
                        setTimeout(function() { processNext(idx + 1); }, 500);
                      }
                    } catch(e) {
                      clearInterval(poller); done = true;
                      console.log('%c  \u2717 Error: ' + path + ' (' + e.message + ')', 'color: #dc2626;');
                      cleanup();
                      setTimeout(function() { processNext(idx + 1); }, 500);
                    }
                  }, 500);
                } catch(e) {
                  done = true;
                  console.log('%c  \u2717 Cannot inject snippet: ' + path + ' (' + e.message + ')', 'color: #dc2626;');
                  cleanup();
                  setTimeout(function() { processNext(idx + 1); }, 500);
                }
              }, 1500);
            });
            iframe.srcdoc = html;
            setTimeout(function() {
              if (done) return; done = true;
              console.log('%c  \u2717 Timeout (10s): ' + path, 'color: #dc2626;');
              cleanup();
              setTimeout(function() { processNext(idx + 1); }, 500);
            }, 10000);
          }).catch(function(e) {
            console.log('%c  \u2717 Fetch failed: ' + path + ' (' + (e.message || e) + ')', 'color: #dc2626;');
            setTimeout(function() { processNext(idx + 1); }, 500);
          });
        }
        processNext(0);

      }).catch(function(e) {
        console.log('%c\u26A0 Could not fetch snippet source: ' + e.message, 'color: #b45309;');
        console.log('%cCrawl requires the snippet source from GitHub Pages.', 'color: #64748b;');
      });
    }
    return; // Skip normal clipboard copy
  }
})();
