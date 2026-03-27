// make-it-look-good — Design Extraction Snippet
// Run this in the browser console on any page, or use as a bookmarklet.
// It extracts design tokens and copies JSON to your clipboard.
// Then paste into the analyzer at: https://yourusername.github.io/make-it-look-good/analyzer.html

(function() {
  'use strict';

  // --- Color utilities ---
  // Canvas-based color parser: handles rgb, rgba, hsl, oklch, oklab, color() — anything the browser supports
  var _parseCanvas = document.createElement('canvas');
  _parseCanvas.width = 1; _parseCanvas.height = 1;
  var _parseCtx = _parseCanvas.getContext('2d', { willReadFrequently: true });

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

    // Collect all pairs up to AAA+buffer (7.5) so profile switching works
    if (ratio < 7.5) {
      contrastPairs.push({
        fg: rgbStr(fgBlended), bg: rgbStr(bg),
        ratio: Math.round(ratio * 100) / 100,
        needed: threshold,
        passes: ratio >= threshold,
        fontSize: Math.round(fontSize), fontWeight: fontWeight, isLarge: isLarge,
        text: node.textContent.trim().substring(0, 50),
        selector: cssSelector(el)
      });
    }

    // Measure line length
    var range = document.createRange();
    range.selectNodeContents(el);
    var textLen = node.textContent.trim().length;
    if (textLen > data.typography.maxLineLength.chars && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.closest('pre') && !el.closest('code')) {
      // Approximate character count per line using element width and font metrics
      var elWidth = el.getBoundingClientRect().width;
      var charWidth = fontSize * 0.5; // rough average
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
