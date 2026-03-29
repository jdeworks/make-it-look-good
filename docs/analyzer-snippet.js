// make-it-look-good — Design Extraction Snippet
// Run this in the browser console on any page, or use as a bookmarklet.
// It extracts design tokens and copies JSON to your clipboard.
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
})();
