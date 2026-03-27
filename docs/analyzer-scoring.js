// make-it-look-good — Scoring Engine
// Pure functions: no DOM access, operates on extracted JSON data

window.MilgScoring = (function() {
  "use strict";

  // --- Color utilities (shared with snippet) ---
  function parseColor(str) {
    if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
    var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
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

  // --- Scoring Engine ---
  // Each category returns { score: 0-100, findings: [...], weight }
  // A finding: { severity: 'error'|'warning'|'info', title, detail, fix, presetRef }

  function scoreContrast(data) {
    var findings = [];
    var pairs = data.colors.contrastPairs || [];
    // Separate uncertain results (1:1 ratio usually means bg couldn't be determined — gradient, SVG, etc.)
    var uncertain = pairs.filter(function(p) { return !p.passes && p.ratio <= 1.01 && p.fg === p.bg; });
    var failures = pairs.filter(function(p) { return !p.passes && !(p.ratio <= 1.01 && p.fg === p.bg); });
    var nearMisses = pairs.filter(function(p) { return p.passes && p.ratio < p.needed + 0.5; });

    failures.forEach(function(p) {
      findings.push({
        severity: 'error',
        title: 'Text fails contrast ' + p.ratio + ':1 (needs ' + p.needed + ':1)',
        detail: '"' + p.text + '" at ' + p.fontSize + 'px — ' + p.selector,
        fix: p.isLarge
          ? 'Large text needs 3:1 minimum. Darken the text or lighten the background.'
          : 'Normal text needs 4.5:1 minimum. Use a darker text color or lighter background.',
        presetRef: 'All presets use text-slate-600+ on white backgrounds (8:1+ ratio)'
      });
    });

    if (uncertain.length > 0) {
      findings.push({
        severity: 'info',
        title: uncertain.length + ' element(s) with undetermined contrast (background could not be resolved)',
        detail: 'These elements may use gradients, images, SVGs, or complex CSS that the analyzer cannot parse. Check manually: ' + uncertain.slice(0, 3).map(function(p) { return '"' + p.text + '"'; }).join(', '),
        fix: 'Verify these elements have sufficient contrast visually. The analyzer reports 1:1 when the effective background cannot be computed.',
        presetRef: null
      });
    }

    nearMisses.forEach(function(p) {
      findings.push({
        severity: 'warning',
        title: 'Text barely passes contrast ' + p.ratio + ':1 (needs ' + p.needed + ':1)',
        detail: '"' + p.text + '" at ' + p.fontSize + 'px — ' + p.selector,
        fix: 'Consider increasing contrast for better readability. Aim for 7:1 (AAA) where possible.',
        presetRef: null
      });
    });

    // Don't count uncertain results as failures in the score
    var total = (pairs.length - uncertain.length) || 1;
    var passing = total - failures.length;
    var score = Math.round((passing / total) * 100);

    return { score: score, findings: findings, weight: 20, label: 'Color & Contrast', icon: 'contrast' };
  }

  function scoreTypography(data) {
    var findings = [];
    var checks = 0;
    var passed = 0;

    // Body font size >= 16px
    checks++;
    var bodySize = parseFloat(data.typography.bodyFontSize);
    if (bodySize >= 16) {
      passed++;
    } else if (bodySize > 0) {
      findings.push({
        severity: 'error',
        title: 'Body font size is ' + bodySize + 'px (minimum: 16px)',
        detail: 'Small body text reduces readability, especially on mobile',
        fix: 'Set body font-size to at least 16px. In Tailwind: text-base',
        presetRef: 'All presets use text-base (16px) or larger for body text'
      });
    }

    // Line height 1.4-1.6
    checks++;
    var bodyLH = data.typography.bodyLineHeight;
    var bodyLHRatio = 0;
    if (bodyLH && bodyLH !== 'normal') {
      bodyLHRatio = parseFloat(bodyLH) / bodySize;
    }
    if (bodyLHRatio >= 1.35 && bodyLHRatio <= 1.7) {
      passed++;
    } else if (bodyLHRatio > 0) {
      findings.push({
        severity: bodyLHRatio < 1.2 || bodyLHRatio > 2 ? 'error' : 'warning',
        title: 'Body line-height is ' + (Math.round(bodyLHRatio * 100) / 100) + ' (ideal: 1.4–1.6)',
        detail: bodyLHRatio < 1.4 ? 'Text feels cramped and hard to read' : 'Text feels too loose and wastes vertical space',
        fix: bodyLHRatio < 1.4 ? 'Increase line-height. In Tailwind: leading-relaxed (1.625) or leading-normal (1.5)' : 'Decrease line-height. In Tailwind: leading-normal (1.5)',
        presetRef: null
      });
    }

    // Line length 45-75 characters
    checks++;
    var maxChars = data.typography.maxLineLength ? data.typography.maxLineLength.chars : 0;
    if (maxChars > 0 && maxChars <= 80) {
      passed++;
    } else if (maxChars > 80) {
      findings.push({
        severity: maxChars > 100 ? 'error' : 'warning',
        title: 'Line length ~' + maxChars + ' characters (ideal: 45–75)',
        detail: 'Long lines make it hard for the eye to track back to the next line',
        fix: 'Constrain content width with max-w-prose (65ch) or max-w-2xl (672px)',
        presetRef: 'Editorial presets use max-w-prose for reading content'
      });
    }

    // Heading scale — check if headings have a consistent ratio
    checks++;
    var headings = data.typography.headings || [];
    if (headings.length >= 2) {
      var sizes = headings.map(function(h) { return parseFloat(h.fontSize); }).filter(function(s) { return s > 0; });
      var uniqueSizes = Array.from(new Set(sizes)).sort(function(a, b) { return b - a; });
      if (uniqueSizes.length >= 2) {
        var ratio = uniqueSizes[0] / uniqueSizes[uniqueSizes.length - 1];
        if (ratio >= 1.5 && ratio <= 4) {
          passed++;
        } else {
          findings.push({
            severity: 'warning',
            title: 'Heading scale ratio is ' + (Math.round(ratio * 100) / 100) + ' (ideal: 1.5–3.5)',
            detail: ratio < 1.5 ? 'Headings are too similar in size — weak hierarchy' : 'Heading sizes vary too wildly — use a modular scale',
            fix: 'Use a modular scale (1.200 minor third or 1.250 major third). In Tailwind: text-4xl > text-2xl > text-xl > text-base',
            presetRef: null
          });
        }
      } else { passed++; } // Only one heading size — acceptable
    } else { passed++; } // No headings to check

    // Max 2-3 font weights
    checks++;
    var weightCount = (data.typography.fontWeights || []).length;
    if (weightCount <= 4) {
      passed++;
    } else {
      findings.push({
        severity: 'warning',
        title: 'Using ' + weightCount + ' font weights (recommended: 2–3)',
        detail: 'Too many weights create visual noise and increase font loading time',
        fix: 'Consolidate to 400 (regular), 500/600 (medium), 700 (bold)',
        presetRef: null
      });
    }

    // Max 2 typefaces
    checks++;
    var familyCount = (data.typography.fontFamilies || []).length;
    if (familyCount <= 3) {
      passed++;
    } else {
      findings.push({
        severity: 'warning',
        title: 'Using ' + familyCount + ' font families (recommended: max 2)',
        detail: 'Too many typefaces make the design feel inconsistent',
        fix: 'Use 1 sans-serif + 1 serif (or monospace for code). In Tailwind: font-sans + font-serif',
        presetRef: null
      });
    }

    var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
    return { score: score, findings: findings, weight: 15, label: 'Typography', icon: 'type' };
  }

  function scoreSpacing(data) {
    var findings = [];
    var checks = 0;
    var passed = 0;

    // 4px grid adherence — check if spacing values are multiples of 4
    checks++;
    var allSpacing = [].concat(data.spacing.paddings || [], data.spacing.margins || [], data.spacing.gaps || []);
    var onGrid = 0;
    var offGrid = 0;
    allSpacing.forEach(function(s) {
      var px = parseFloat(s.value);
      if (isNaN(px) || px === 0) return;
      if (Math.round(px) % 4 === 0) onGrid += s.count;
      else offGrid += s.count;
    });
    var gridRatio = (onGrid + offGrid) > 0 ? onGrid / (onGrid + offGrid) : 1;
    if (gridRatio >= 0.7) {
      passed++;
      if (gridRatio < 0.85) {
        findings.push({
          severity: 'info',
          title: Math.round(gridRatio * 100) + '% of spacing values on 4px grid',
          detail: 'Good adherence — a few values could be rounded to the nearest 4px increment',
          fix: 'Use Tailwind spacing utilities (p-1=4px, p-2=8px, p-3=12px, p-4=16px, ...)',
          presetRef: null
        });
      }
    } else {
      findings.push({
        severity: 'warning',
        title: 'Only ' + Math.round(gridRatio * 100) + '% of spacing is on a 4px grid',
        detail: 'Inconsistent spacing makes layouts feel unpolished',
        fix: 'Align spacing to 4px increments: 4, 8, 12, 16, 24, 32, 48, 64px',
        presetRef: 'All presets use Tailwind spacing scale (4px base unit)'
      });
    }

    // Content max-width
    checks++;
    var maxW = parseFloat(data.spacing.maxContentWidth);
    if (maxW > 0 && maxW <= 1500) {
      passed++;
    } else if (maxW > 1500) {
      findings.push({
        severity: 'warning',
        title: 'Content width is ' + Math.round(maxW) + 'px (recommended: 1200–1440px)',
        detail: 'Very wide content is harder to scan and looks stretched on large monitors',
        fix: 'Add a max-width container. In Tailwind: max-w-7xl (1280px) or max-w-screen-xl',
        presetRef: 'Dashboard presets use max-w-7xl containers'
      });
    } else {
      passed++; // No max width data or narrow — fine
    }

    // Mobile padding >= 16px
    checks++;
    var bodyPad = parseFloat(data.spacing.bodyPaddingHorizontal);
    if (bodyPad >= 14 || isNaN(bodyPad) || bodyPad === 0) {
      passed++; // 0 is OK if inner containers have padding
    } else {
      findings.push({
        severity: 'warning',
        title: 'Body horizontal padding is ' + bodyPad + 'px (minimum: 16px)',
        detail: 'Content touching screen edges feels cramped on mobile',
        fix: 'Add px-4 (16px) padding to the body or main container',
        presetRef: null
      });
    }

    // Adjacent interactive element spacing (buttons/links too close together)
    var adjacentIssues = (data.interaction && data.interaction.adjacentIssues) || [];
    if (adjacentIssues.length > 0) {
      checks++;
      var touching = adjacentIssues.filter(function(a) { return a.gap < 2; });
      var tooClose = adjacentIssues.filter(function(a) { return a.gap >= 2 && a.gap < 8; });

      touching.forEach(function(a) {
        findings.push({
          severity: 'error',
          title: 'Interactive elements touching (' + a.gap + 'px gap)',
          detail: '"' + a.textA + '" and "' + a.textB + '" (' + a.direction + ')',
          fix: 'Add at least 8px gap between interactive elements. In Tailwind: gap-2 on the parent flex/grid container.',
          presetRef: 'Button presets use gap-2 (8px) or gap-3 (12px) between buttons'
        });
      });

      tooClose.forEach(function(a) {
        findings.push({
          severity: 'warning',
          title: 'Interactive elements only ' + a.gap + 'px apart (recommended: ≥8px)',
          detail: '"' + a.textA + '" and "' + a.textB + '" (' + a.direction + ')',
          fix: 'Increase gap to at least 8px to prevent mis-taps. In Tailwind: gap-2 on the parent.',
          presetRef: null
        });
      });

      if (touching.length === 0 && tooClose.length === 0) passed++;
    }

    var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
    return { score: score, findings: findings, weight: 15, label: 'Spacing & Layout', icon: 'spacing' };
  }

  function scoreTouchTargets(data) {
    var findings = [];
    var targets = data.interaction.touchTargets || [];

    // Viewport-aware thresholds:
    // Desktop (>= 1024px): 24×24px minimum click target (WCAG), warn < 32px
    // Touch/mobile (< 1024px): 44×44px minimum tap target (WCAG 2.5.8)
    var vw = (data.meta && data.meta.viewportWidth) || 1280;
    var isDesktop = vw >= 1024;
    var minSize = isDesktop ? 24 : 44;
    var warnSize = isDesktop ? 32 : 44;
    var context = isDesktop ? 'desktop' : 'touch/mobile';
    var issueCount = 0;

    targets.forEach(function(t) {
      var w = t.width, h = t.height;
      var minDim = Math.min(w, h);

      if (minDim < minSize) {
        issueCount++;
        findings.push({
          severity: 'error',
          title: t.element + ' is ' + w + '×' + h + 'px (minimum for ' + context + ': ' + minSize + 'px)',
          detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
          fix: isDesktop
            ? 'Desktop click targets need at least 24×24px. Increase padding or min-height/min-width.'
            : 'Touch targets need 44×44px minimum. Add min-h-[44px] min-w-[44px] or py-3 px-4',
          presetRef: isDesktop ? null : 'Button presets use py-3 px-6 (48px height)'
        });
      } else if (minDim < warnSize && isDesktop) {
        findings.push({
          severity: 'warning',
          title: t.element + ' is ' + w + '×' + h + 'px (recommended for desktop: ≥32px)',
          detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
          fix: 'While 24px meets minimum, 32px+ improves click comfort. Consider adding padding.',
          presetRef: null
        });
      }
    });

    // Also flag targets that pass the current threshold but would fail on touch
    if (isDesktop && targets.length > 0) {
      var touchFails = targets.filter(function(t) { return Math.min(t.width, t.height) < 44; });
      if (touchFails.length > 0) {
        findings.push({
          severity: 'info',
          title: touchFails.length + ' element(s) below 44px touch target (analyzed at ' + vw + 'px desktop viewport)',
          detail: 'These meet desktop minimums but would fail on touch devices. Consider responsive sizing if the site is also used on mobile.',
          fix: 'For responsive touch support: add touch-target sizing at mobile breakpoints, e.g. sm:min-h-[44px]',
          presetRef: null
        });
      }
    }

    // Transitions / animation duration
    var transitions = data.interaction.transitions || [];
    transitions.forEach(function(t) {
      var ms = parseFloat(t) * 1000;
      if (ms > 500) {
        findings.push({
          severity: 'warning',
          title: 'Transition duration ' + ms + 'ms exceeds 500ms maximum',
          detail: 'Users perceive animations longer than 500ms as sluggish',
          fix: 'Keep transitions under 500ms. Enter: 200–300ms, Exit: 150–200ms. In Tailwind: duration-200 or duration-300',
          presetRef: null
        });
      }
    });

    // Score: deduct per error, less per warning
    var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
    var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
    var score = Math.max(0, 100 - (errors * 10) - (warnings * 3));
    return { score: score, findings: findings, weight: 15, label: 'Touch & Interaction', icon: 'touch' };
  }

  function scoreAccessibility(data) {
    var findings = [];
    var checks = 0;
    var passed = 0;
    var a11y = data.accessibility;

    // Semantic elements
    checks++;
    var semantic = a11y.semanticElements || {};
    var hasMain = (semantic.main || 0) > 0;
    var hasNav = (semantic.nav || 0) > 0;
    var hasHeader = (semantic.header || 0) > 0;
    var semanticCount = [hasMain, hasNav, hasHeader].filter(Boolean).length;
    if (semanticCount >= 2) {
      passed++;
    } else {
      findings.push({
        severity: semanticCount === 0 ? 'error' : 'warning',
        title: 'Missing semantic HTML elements',
        detail: 'Found: ' + (hasHeader ? 'header ' : '') + (hasNav ? 'nav ' : '') + (hasMain ? 'main ' : '') + (semantic.footer ? 'footer' : ''),
        fix: 'Use <header>, <nav>, <main>, <footer> for page structure. Screen readers rely on these landmarks.',
        presetRef: 'All presets use semantic HTML landmarks'
      });
    }

    // Heading hierarchy
    checks++;
    var headingOrder = a11y.headingHierarchy || [];
    var hierarchyBroken = false;
    for (var i = 1; i < headingOrder.length; i++) {
      var prev = parseInt(headingOrder[i - 1].charAt(1));
      var curr = parseInt(headingOrder[i].charAt(1));
      if (curr > prev + 1) { hierarchyBroken = true; break; }
    }
    if (!hierarchyBroken) {
      passed++;
    } else {
      findings.push({
        severity: 'warning',
        title: 'Heading hierarchy has gaps (e.g., h1 → h3)',
        detail: 'Heading order: ' + headingOrder.join(' → '),
        fix: 'Use headings in order: h1 → h2 → h3. Never skip levels. Style with classes instead of heading tags.',
        presetRef: null
      });
    }

    // Images with alt
    checks++;
    if (a11y.imagesWithoutAlt === 0) {
      passed++;
    } else {
      findings.push({
        severity: 'error',
        title: a11y.imagesWithoutAlt + ' image(s) missing alt text',
        detail: 'Screen readers cannot describe these images to users',
        fix: 'Add alt="description" to all <img> tags. Use alt="" for decorative images.',
        presetRef: null
      });
    }

    // Form labels
    checks++;
    var forms = a11y.formLabels || {};
    if (forms.total === 0 || forms.withoutLabel === 0) {
      passed++;
    } else {
      findings.push({
        severity: 'error',
        title: forms.withoutLabel + ' of ' + forms.total + ' form inputs missing labels',
        detail: 'Unlabeled inputs are unusable for screen reader users',
        fix: 'Use <label for="id"> or wrap the input in a <label>. Add aria-label for icon-only inputs.',
        presetRef: 'Form presets always pair inputs with visible labels'
      });
    }

    // Focus indicators
    checks++;
    var focusIndicators = a11y.focusIndicators || [];
    var hasAnyFocus = focusIndicators.some(function(f) {
      return f.outlineStyle !== 'none' && f.outlineWidth !== '0px';
    });
    var hasFocusVisibleCSS = a11y.hasFocusVisibleCSS || false;
    if (hasAnyFocus || hasFocusVisibleCSS || focusIndicators.length === 0) {
      passed++;
    } else {
      findings.push({
        severity: 'error',
        title: 'No visible focus indicators found',
        detail: 'Keyboard users cannot see which element is focused',
        fix: 'Ensure focus-visible styles exist. In Tailwind: focus-visible:ring-2 focus-visible:ring-blue-500',
        presetRef: 'All interactive presets include focus-visible ring styles'
      });
    }

    var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
    return { score: score, findings: findings, weight: 15, label: 'Accessibility', icon: 'a11y' };
  }

  function scoreResponsive(data) {
    var findings = [];
    var checks = 0;
    var passed = 0;
    var struct = data.structure;

    // Responsive classes
    checks++;
    if (struct.responsiveClasses) {
      passed++;
    } else {
      findings.push({
        severity: 'warning',
        title: 'No responsive breakpoint classes detected',
        detail: struct.cssFramework === 'tailwind' ? 'No sm:/md:/lg: prefixes found' : 'No responsive utilities detected',
        fix: 'Add responsive variants. In Tailwind: sm:flex, md:grid-cols-2, lg:px-8',
        presetRef: 'All presets include mobile-first responsive design'
      });
    }

    // Dark mode
    checks++;
    if (struct.darkModeClasses) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: 'No dark mode support detected',
        detail: 'dark: class variants not found',
        fix: 'Add dark mode variants. In Tailwind: dark:bg-slate-900 dark:text-slate-100',
        presetRef: 'All presets include dark: variants'
      });
    }

    // Viewport width check — if analyzed on desktop, check if content is flexible
    checks++;
    var vw = data.meta.viewportWidth;
    var maxContent = parseFloat(data.spacing.maxContentWidth);
    if (maxContent > 0 && (maxContent <= vw * 0.95 || struct.responsiveClasses)) {
      passed++;
    } else if (!struct.responsiveClasses && maxContent > vw * 0.95) {
      findings.push({
        severity: 'warning',
        title: 'Content fills entire viewport width without constraints',
        detail: 'Content may not reflow well on smaller screens',
        fix: 'Use responsive containers and flexible layouts',
        presetRef: null
      });
    } else {
      passed++; // Can't determine, give benefit of doubt
    }

    var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
    return { score: score, findings: findings, weight: 10, label: 'Responsive Design', icon: 'responsive' };
  }

  function scoreVisualConsistency(data) {
    var findings = [];
    var checks = 0;
    var passed = 0;

    // Scale thresholds by page complexity
    var pageType = (data.context && data.context.pageType) || 'unknown';
    var elCount = (data.structure && data.structure.totalElements) || 100;
    // Marketing/content pages legitimately use more colors and font sizes
    var colorLimit = elCount > 200 ? 35 : elCount > 100 ? 25 : 20;
    var fontSizeLimit = elCount > 200 ? 12 : elCount > 100 ? 10 : 8;
    if (pageType === 'marketing' || pageType === 'pricing') { colorLimit += 10; fontSizeLimit += 3; }

    // Color palette coherence — how many unique text/bg colors?
    checks++;
    var textColors = (data.colors.textColors || []).length;
    var bgColors = (data.colors.bgColors || []).length;
    var totalUnique = textColors + bgColors;
    if (totalUnique <= colorLimit) {
      passed++;
    } else {
      findings.push({
        severity: 'warning',
        title: totalUnique + ' unique colors detected (recommend < ' + colorLimit + ' for this page type)',
        detail: textColors + ' text colors, ' + bgColors + ' background colors',
        fix: 'Consolidate to a systematic color palette: 1 primary + 1 neutral + 3 semantic (error, warning, success)',
        presetRef: 'Presets use a single primary color with slate neutrals'
      });
    }

    // Font size consistency — too many unique sizes?
    checks++;
    var fontSizes = (data.typography.fontSizes || []).length;
    if (fontSizes <= fontSizeLimit) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: fontSizes + ' unique font sizes (recommend ≤' + fontSizeLimit + ' from a type scale)',
        detail: 'A consistent type scale creates visual rhythm',
        fix: 'Use a modular scale: text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl, text-4xl',
        presetRef: null
      });
    }

    var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
    return { score: score, findings: findings, weight: 5, label: 'Visual Consistency', icon: 'consistency' };
  }

  function scoreCognitiveLoad(data) {
    var findings = [];
    var checks = 0;
    var passed = 0;

    // Navigation items <= 7
    checks++;
    var navs = document.querySelectorAll ? null : null; // We don't have DOM access, infer from data
    // Check heading count as proxy for section complexity
    var headingCount = (data.typography.headings || []).length;
    if (headingCount <= 15) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: headingCount + ' headings on page — consider chunking content',
        detail: 'Hick\'s Law: more choices = slower decisions',
        fix: 'Break content into tabs, accordions, or separate pages. Keep 5–7 top-level sections.',
        presetRef: 'Tab and accordion presets for progressive disclosure'
      });
    }

    // Form fields per step
    checks++;
    var formFields = data.accessibility.formLabels ? data.accessibility.formLabels.total : 0;
    if (formFields <= 7 || formFields === 0) {
      passed++;
    } else {
      findings.push({
        severity: 'warning',
        title: formFields + ' form fields visible (recommended: 5–7 per step)',
        detail: 'Long forms have high abandonment rates',
        fix: 'Break into multi-step form with 3–5 fields per step. Show a progress indicator.',
        presetRef: 'Form presets demonstrate multi-step patterns'
      });
    }

    var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
    return { score: score, findings: findings, weight: 5, label: 'Cognitive Load', icon: 'cognitive' };
  }

  function runScoring(data) {
    var categories = [
      scoreContrast(data),
      scoreTypography(data),
      scoreSpacing(data),
      scoreTouchTargets(data),
      scoreAccessibility(data),
      scoreResponsive(data),
      scoreVisualConsistency(data),
      scoreCognitiveLoad(data)
    ];

    var totalWeight = 0;
    var weightedSum = 0;
    categories.forEach(function(cat) {
      totalWeight += cat.weight;
      weightedSum += cat.score * cat.weight;
    });

    var overall = Math.round(weightedSum / totalWeight);
    var grade = overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 60 ? 'D' : 'F';
    var gradeLabel = { A: 'Excellent', B: 'Good', C: 'Needs Improvement', D: 'Significant Issues', F: 'Major Redesign Needed' };

    return {
      overall: overall,
      grade: grade,
      gradeLabel: gradeLabel[grade],
      categories: categories,
      meta: data.meta,
      raw: data
    };
  }

  return { runScoring: runScoring };
})();
