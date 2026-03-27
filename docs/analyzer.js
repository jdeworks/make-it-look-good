// make-it-look-good — Design Analyzer
// Scoring engine, report renderer, auto-fix suggestions, PDF export

(function() {
  'use strict';

  // --- State ---
  var reportData = null;
  var darkMode = localStorage.getItem('milg-dark') === 'true';

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
    var failures = pairs.filter(function(p) { return !p.passes; });
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

    nearMisses.forEach(function(p) {
      findings.push({
        severity: 'warning',
        title: 'Text barely passes contrast ' + p.ratio + ':1 (needs ' + p.needed + ':1)',
        detail: '"' + p.text + '" at ' + p.fontSize + 'px — ' + p.selector,
        fix: 'Consider increasing contrast for better readability. Aim for 7:1 (AAA) where possible.',
        presetRef: null
      });
    });

    var total = pairs.length || 1;
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

    // Color palette coherence — how many unique text/bg colors?
    checks++;
    var textColors = (data.colors.textColors || []).length;
    var bgColors = (data.colors.bgColors || []).length;
    var totalUnique = textColors + bgColors;
    if (totalUnique <= 20) {
      passed++;
    } else {
      findings.push({
        severity: 'warning',
        title: totalUnique + ' unique colors detected (recommend < 20)',
        detail: textColors + ' text colors, ' + bgColors + ' background colors',
        fix: 'Consolidate to a systematic color palette: 1 primary + 1 neutral + 3 semantic (error, warning, success)',
        presetRef: 'Presets use a single primary color with slate neutrals'
      });
    }

    // Font size consistency — too many unique sizes?
    checks++;
    var fontSizes = (data.typography.fontSizes || []).length;
    if (fontSizes <= 8) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: fontSizes + ' unique font sizes (recommend 5–8 from a type scale)',
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

  // --- Report Rendering ---
  var categoryIcons = {
    contrast: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M12 2a10 10 0 0 1 0 20"/></svg>',
    type: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    spacing: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
    touch: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
    a11y: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M6 8h12"/><path d="M12 8v8"/><path d="M9 20l3-4 3 4"/></svg>',
    responsive: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    consistency: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 4.5v5c0 4.1-3.6 8-9 10.5-5.4-2.5-9-6.4-9-10.5v-5L12 3z"/></svg>',
    cognitive: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20h6v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z"/><line x1="10" y1="22" x2="14" y2="22"/></svg>'
  };

  function scoreColor(score) {
    if (score >= 90) return '#16a34a';
    if (score >= 70) return '#ca8a04';
    if (score >= 50) return '#ea580c';
    return '#dc2626';
  }

  function gradeColor(grade) {
    return { A: '#16a34a', B: '#65a30d', C: '#ca8a04', D: '#ea580c', F: '#dc2626' }[grade] || '#64748b';
  }

  function severityBadge(severity) {
    var colors = {
      error: 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca',
      warning: 'background:#fffbeb;color:#b45309;border:1px solid #fed7aa',
      info: 'background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe'
    };
    return '<span style="display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;' + (colors[severity] || colors.info) + '">' + severity + '</span>';
  }

  function renderReport(report) {
    var html = '';

    // --- Header ---
    html += '<div class="report-header">';
    html += '<div class="report-header-info">';
    html += '<h1>Design Analysis Report</h1>';
    html += '<p class="report-url">' + escapeHtml(report.meta.url || 'Pasted HTML') + '</p>';
    html += '<p class="report-timestamp">' + new Date(report.meta.timestamp).toLocaleString() + ' &middot; ' + report.meta.viewportWidth + '&times;' + report.meta.viewportHeight + 'px</p>';
    html += '</div>';

    // Overall score gauge
    html += '<div class="report-gauge">';
    html += renderGauge(report.overall, report.grade);
    html += '<div class="report-grade-label">' + report.gradeLabel + '</div>';
    html += '</div>';
    html += '</div>';

    // --- Category cards ---
    html += '<div class="report-categories">';
    report.categories.forEach(function(cat) {
      html += '<div class="report-card">';
      html += '<div class="report-card-header">';
      html += '<div class="report-card-icon" style="color:' + scoreColor(cat.score) + '">' + (categoryIcons[cat.icon] || '') + '</div>';
      html += '<div class="report-card-title">';
      html += '<h3>' + cat.label + '</h3>';
      html += '<span class="report-card-weight">' + cat.weight + '% weight</span>';
      html += '</div>';
      html += '<div class="report-card-score" style="color:' + scoreColor(cat.score) + '">' + cat.score + '</div>';
      html += '</div>';
      html += renderProgressBar(cat.score);

      // Finding count
      var errors = cat.findings.filter(function(f) { return f.severity === 'error'; }).length;
      var warnings = cat.findings.filter(function(f) { return f.severity === 'warning'; }).length;
      var infos = cat.findings.filter(function(f) { return f.severity === 'info'; }).length;

      if (cat.findings.length > 0) {
        html += '<div class="report-card-counts">';
        if (errors > 0) html += '<span class="count-error">' + errors + ' error' + (errors > 1 ? 's' : '') + '</span>';
        if (warnings > 0) html += '<span class="count-warning">' + warnings + ' warning' + (warnings > 1 ? 's' : '') + '</span>';
        if (infos > 0) html += '<span class="count-info">' + infos + ' info</span>';
        html += '</div>';
      } else {
        html += '<div class="report-card-counts"><span class="count-pass">All checks passed</span></div>';
      }

      html += '</div>';
    });
    html += '</div>';

    // --- Detailed findings ---
    html += '<div class="report-findings">';
    html += '<h2>Detailed Findings</h2>';

    report.categories.forEach(function(cat) {
      if (cat.findings.length === 0) return;

      html += '<div class="report-finding-group">';
      html += '<h3>' + (categoryIcons[cat.icon] || '') + ' ' + cat.label + '</h3>';

      cat.findings.forEach(function(f) {
        html += '<div class="report-finding severity-' + f.severity + '">';
        html += '<div class="finding-header">';
        html += severityBadge(f.severity);
        html += '<span class="finding-title">' + escapeHtml(f.title) + '</span>';
        html += '</div>';
        if (f.detail) html += '<p class="finding-detail">' + escapeHtml(f.detail) + '</p>';

        html += '<div class="finding-fix">';
        html += '<strong>Fix:</strong> ' + escapeHtml(f.fix);
        html += '</div>';

        if (f.presetRef) {
          html += '<div class="finding-preset">';
          html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> ';
          html += escapeHtml(f.presetRef);
          html += '</div>';
        }

        html += '</div>';
      });

      html += '</div>';
    });

    html += '</div>';

    // --- Extracted data summary ---
    html += '<div class="report-summary">';
    html += '<h2>Design Token Summary</h2>';
    html += '<div class="summary-grid">';

    // Color palette
    html += '<div class="summary-section">';
    html += '<h4>Color Palette</h4>';
    html += '<div class="color-swatches">';
    var bgColors = (report.raw.colors.bgColors || []).slice(0, 8);
    bgColors.forEach(function(c) {
      html += '<div class="color-swatch" style="background:' + c.value + '" title="' + c.value + ' (' + c.count + ' uses)"></div>';
    });
    html += '</div>';
    html += '<div class="color-swatches" style="margin-top:4px">';
    var textColors = (report.raw.colors.textColors || []).slice(0, 8);
    textColors.forEach(function(c) {
      html += '<div class="color-swatch" style="background:' + c.value + '" title="' + c.value + ' (' + c.count + ' uses)"></div>';
    });
    html += '</div>';
    html += '</div>';

    // Typography
    html += '<div class="summary-section">';
    html += '<h4>Typography</h4>';
    html += '<div class="summary-list">';
    html += '<div>Body: ' + escapeHtml(report.raw.typography.bodyFontSize) + ' / ' + escapeHtml(report.raw.typography.bodyLineHeight) + '</div>';
    html += '<div>Families: ' + escapeHtml((report.raw.typography.fontFamilies || []).join(', ')) + '</div>';
    var headings = report.raw.typography.headings || [];
    if (headings.length > 0) {
      html += '<div>Headings: ' + headings.map(function(h) { return h.tag + '=' + h.fontSize; }).join(', ') + '</div>';
    }
    html += '</div>';
    html += '</div>';

    // Spacing
    html += '<div class="summary-section">';
    html += '<h4>Spacing</h4>';
    html += '<div class="summary-list">';
    html += '<div>Max content width: ' + escapeHtml(report.raw.spacing.maxContentWidth) + '</div>';
    var topPaddings = (report.raw.spacing.paddings || []).slice(0, 5);
    html += '<div>Common paddings: ' + topPaddings.map(function(p) { return p.value; }).join(', ') + '</div>';
    html += '</div>';
    html += '</div>';

    // Structure
    html += '<div class="summary-section">';
    html += '<h4>Structure</h4>';
    html += '<div class="summary-list">';
    html += '<div>Elements: ' + report.raw.structure.totalElements + '</div>';
    html += '<div>Framework: ' + report.raw.structure.cssFramework + '</div>';
    html += '<div>Responsive: ' + (report.raw.structure.responsiveClasses ? 'Yes' : 'No') + '</div>';
    html += '<div>Dark mode: ' + (report.raw.structure.darkModeClasses ? 'Yes' : 'No') + '</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // --- Methodology note ---
    html += '<div class="report-methodology">';
    html += '<h2>About this Report</h2>';
    html += '<p>This report checks <strong>computed styles</strong> against concrete, evidence-based rules from WCAG 2.2, Material Design, and typography research. ';
    html += 'It does not use AI — every finding is a deterministic comparison of measured values against documented thresholds.</p>';
    html += '<p><strong>What it catches well:</strong> contrast ratios, font sizes, touch targets, spacing grid adherence, semantic HTML, heading hierarchy — anything with a hard number.</p>';
    html += '<p><strong>What it cannot judge:</strong> visual balance, color harmony, whether a layout "feels right", design personality, or context-dependent choices (e.g., a 14px caption is fine but 14px body text is not).</p>';
    html += '<p>For a full design review with context-aware judgment, use this report as input for a <a href="index.html" style="color:var(--primary)">design consultation</a> — the findings give an AI or human reviewer concrete data to work from.</p>';
    html += '</div>';

    return html;
  }

  // --- Markdown Export ---
  function renderMarkdown(report) {
    var lines = [];
    lines.push('# Design Analysis Report');
    lines.push('');
    lines.push('**URL:** ' + (report.meta.url || 'Pasted HTML'));
    lines.push('**Date:** ' + new Date(report.meta.timestamp).toLocaleString());
    lines.push('**Viewport:** ' + report.meta.viewportWidth + '×' + report.meta.viewportHeight + 'px');
    lines.push('**Overall Score:** ' + report.overall + '/100 (' + report.grade + ' — ' + report.gradeLabel + ')');
    lines.push('');

    lines.push('## Category Scores');
    lines.push('');
    lines.push('| Category | Score | Weight | Issues |');
    lines.push('|----------|-------|--------|--------|');
    report.categories.forEach(function(cat) {
      var errors = cat.findings.filter(function(f) { return f.severity === 'error'; }).length;
      var warnings = cat.findings.filter(function(f) { return f.severity === 'warning'; }).length;
      var issues = [];
      if (errors > 0) issues.push(errors + ' error' + (errors > 1 ? 's' : ''));
      if (warnings > 0) issues.push(warnings + ' warning' + (warnings > 1 ? 's' : ''));
      lines.push('| ' + cat.label + ' | ' + cat.score + '/100 | ' + cat.weight + '% | ' + (issues.length > 0 ? issues.join(', ') : 'All passed') + ' |');
    });
    lines.push('');

    lines.push('## Detailed Findings');
    lines.push('');
    report.categories.forEach(function(cat) {
      if (cat.findings.length === 0) return;
      lines.push('### ' + cat.label);
      lines.push('');
      cat.findings.forEach(function(f) {
        var icon = f.severity === 'error' ? '❌' : f.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push('- ' + icon + ' **[' + f.severity + ']** ' + f.title);
        if (f.detail) lines.push('  - ' + f.detail);
        lines.push('  - **Fix:** ' + f.fix);
        if (f.presetRef) lines.push('  - **Example:** ' + f.presetRef);
        lines.push('');
      });
    });

    lines.push('## Design Token Summary');
    lines.push('');
    lines.push('- **Body font:** ' + report.raw.typography.bodyFontSize + ' / ' + report.raw.typography.bodyLineHeight);
    lines.push('- **Font families:** ' + (report.raw.typography.fontFamilies || []).join(', '));
    var headings = report.raw.typography.headings || [];
    if (headings.length > 0) {
      lines.push('- **Headings:** ' + headings.map(function(h) { return h.tag + '=' + h.fontSize; }).join(', '));
    }
    lines.push('- **Max content width:** ' + report.raw.spacing.maxContentWidth);
    lines.push('- **Elements:** ' + report.raw.structure.totalElements);
    lines.push('- **Framework:** ' + report.raw.structure.cssFramework);
    lines.push('- **Responsive:** ' + (report.raw.structure.responsiveClasses ? 'Yes' : 'No'));
    lines.push('- **Dark mode:** ' + (report.raw.structure.darkModeClasses ? 'Yes' : 'No'));
    lines.push('');

    lines.push('---');
    lines.push('*Generated by [make-it-look-good](https://github.com/jdeworks/make-it-look-good) Design Analyzer — rule-based scoring, no AI.*');

    return lines.join('\n');
  }

  function renderGauge(score, grade) {
    var color = gradeColor(grade);
    var circumference = 2 * Math.PI * 54;
    var offset = circumference - (score / 100) * circumference;
    return '<svg width="120" height="120" viewBox="0 0 120 120">' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" stroke-width="8"/>' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="' + color + '" stroke-width="8" ' +
      'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" ' +
      'stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 0.8s ease"/>' +
      '<text x="60" y="55" text-anchor="middle" font-size="32" font-weight="700" fill="' + color + '">' + score + '</text>' +
      '<text x="60" y="75" text-anchor="middle" font-size="14" font-weight="600" fill="' + color + '">' + grade + '</text>' +
      '</svg>';
  }

  function renderProgressBar(score) {
    var color = scoreColor(score);
    return '<div class="progress-bar"><div class="progress-fill" style="width:' + score + '%;background:' + color + '"></div></div>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

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
      if (/\/\s*0\s*\)/.test(str)) return null;
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
    function getEffectiveBg(el) {
      var node = el, layers = [];
      while (node && node !== document.documentElement) {
        var bg = getComputedStyle(node).backgroundColor;
        var c = parseColor(bg);
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
      if (!el || !isVisible(el)) continue;
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
      if (ratio < threshold + 1) {
        contrastPairs.push({ fg: rgbStr(fgBlended), bg: rgbStr(bg), ratio: Math.round(ratio * 100) / 100, needed: threshold, passes: ratio >= threshold, fontSize: Math.round(fontSize), fontWeight: fontWeight, isLarge: isLarge, text: node.textContent.trim().substring(0, 50), selector: cssSelector(el) });
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

    var interactive = document.querySelectorAll('a,button,input,select,textarea,[role="button"],[tabindex]');
    var touchIssues = [];
    interactive.forEach(function(el) {
      if (!isVisible(el)) return;
      var rect = el.getBoundingClientRect();
      var w = Math.round(rect.width), h = Math.round(rect.height);
      if (w < 44 || h < 44) touchIssues.push({ element: el.tagName.toLowerCase(), width: w, height: h, text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 40), selector: cssSelector(el), passes: false });
    });
    touchIssues.sort(function(a, b) { return (a.width * a.height) - (b.width * b.height); });
    data.interaction.touchTargets = touchIssues.slice(0, 40);

    var transitionSet = new Set();
    for (var i = 0; i < allElements.length && transitionSet.size < 20; i++) { var t = getComputedStyle(allElements[i]).transitionDuration; if (t && t !== '0s') transitionSet.add(t); }
    data.interaction.transitions = Array.from(transitionSet);

    data.accessibility.semanticElements = { header: document.querySelectorAll('header').length, nav: document.querySelectorAll('nav').length, main: document.querySelectorAll('main').length, footer: document.querySelectorAll('footer').length, section: document.querySelectorAll('section').length, article: document.querySelectorAll('article').length, aside: document.querySelectorAll('aside').length };
    var noAlt = 0; document.querySelectorAll('img').forEach(function(img) { if (!img.hasAttribute('alt')) noAlt++; }); data.accessibility.imagesWithoutAlt = noAlt;
    var inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]),select,textarea');
    var labeled = 0;
    inputs.forEach(function(inp) { data.accessibility.formLabels.total++; if ((inp.id && document.querySelector('label[for="' + inp.id + '"]')) || inp.closest('label') || inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby')) labeled++; });
    data.accessibility.formLabels.withLabel = labeled;
    data.accessibility.formLabels.withoutLabel = data.accessibility.formLabels.total - labeled;
    Array.from(interactive).slice(0, 10).forEach(function(el) { if (!isVisible(el)) return; var s = getComputedStyle(el); data.accessibility.focusIndicators.push({ element: cssSelector(el), outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, outlineOffset: s.outlineOffset }); });
    data.accessibility.hasFocusVisibleCSS = Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r.selectorText && r.selectorText.indexOf('focus-visible') !== -1; }); } catch(e) { return false; } });

    parent.postMessage({ type: 'milg-analyzer-result', data: data }, '*');
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
      analyzeHtmlInIframe(html, function(data) {
        analyzeHtmlBtn.textContent = 'Analyze HTML';
        analyzeHtmlBtn.disabled = false;
        runAnalysis(data);
      });
    });

    // New analysis
    newAnalysisBtn.addEventListener('click', function() {
      reportContainer.classList.remove('visible');
      reportContainer.innerHTML = '';
      inputSection.style.display = '';
      document.getElementById('reportActions').style.display = 'none';
      pasteInput.value = '';
      htmlInput.value = '';
      reportData = null;
      // Clear hash so refreshing doesn't reload old report
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    });

    // Markdown export (download)
    document.getElementById('markdownBtn').addEventListener('click', function() {
      if (!reportData) return;
      var md = renderMarkdown(reportData);
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
      var md = renderMarkdown(reportData);
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

    // Dark mode toggle
    document.getElementById('darkBtn').addEventListener('click', function() {
      darkMode = !darkMode;
      localStorage.setItem('milg-dark', darkMode);
      applyDarkMode();
    });

    // Check for data in hash (from editor "Analyze preview" button)
    if (location.hash.startsWith('#data=')) {
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
  }

  function runAnalysis(data) {
    reportData = runScoring(data);
    var reportContainer = document.getElementById('reportContainer');
    var inputSection = document.getElementById('inputSection');

    reportContainer.innerHTML = renderReport(reportData);
    reportContainer.classList.add('visible');
    inputSection.style.display = 'none';
    document.getElementById('reportActions').style.display = 'flex';
  }

  function analyzeHtmlInIframe(html, callback) {
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    document.body.appendChild(iframe);

    function onResult(e) {
      if (!e.data || e.data.type !== 'milg-analyzer-result') return;
      window.removeEventListener('message', onResult);
      document.body.removeChild(iframe);
      var data = e.data.data;
      data.meta.url = 'Pasted HTML';
      callback(data);
    }
    window.addEventListener('message', onResult);

    // If the pasted HTML is a full document (has <html> or <head>), use it as-is
    // and just append the extraction script. Otherwise wrap in a basic document.
    var isFullDoc = /<html[\s>]/i.test(html) || /<!DOCTYPE/i.test(html);
    var srcdoc;
    if (isFullDoc) {
      // Inject extraction script before </body>
      var extractScript = '<script>setTimeout(function(){(' + extractFromDocument.toString() + ')()}, 1500);</' + 'script>';
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
        html +
        '<script>setTimeout(function(){(' + extractFromDocument.toString() + ')()}, 1500);</' + 'script>' +
        '</body></html>';
    }
    iframe.srcdoc = srcdoc;

    // Timeout fallback
    setTimeout(function() {
      window.removeEventListener('message', onResult);
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
        callback({
          meta: { title: '', url: 'Pasted HTML', viewportWidth: 1280, viewportHeight: 900, timestamp: new Date().toISOString(), version: 1 },
          colors: { textColors: [], bgColors: [], contrastPairs: [] },
          typography: { bodyFontSize: '16px', bodyLineHeight: '24px', bodyFontFamily: 'sans-serif', fontFamilies: [], fontSizes: [], fontWeights: [], headings: [], lineHeights: [], maxLineLength: { chars: 0, element: '' } },
          spacing: { paddings: [], margins: [], gaps: [], maxContentWidth: '', bodyPaddingHorizontal: '' },
          interaction: { touchTargets: [], transitions: [] },
          accessibility: { semanticElements: {}, headingHierarchy: [], imagesWithoutAlt: 0, formLabels: { total: 0, withLabel: 0, withoutLabel: 0 }, focusIndicators: [] },
          structure: { totalElements: 0, darkModeClasses: false, responsiveClasses: false, tailwindDetected: false, cssFramework: 'unknown' }
        });
      }
    }, 8000);
  }

  function loadSnippet(codeEl) {
    fetch('analyzer-snippet.js')
      .then(function(r) { return r.text(); })
      .then(function(text) { codeEl.textContent = text; })
      .catch(function() { codeEl.textContent = '// Failed to load snippet — copy from analyzer-snippet.js'; });
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
