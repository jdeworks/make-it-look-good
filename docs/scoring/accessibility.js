// Scoring Module: Accessibility
// Weight: 15%

(function() {
  "use strict";
  var S = window.MilgScoring;

function scoreAccessibility(data) {
  var profile = S.getProfile(data);
  var findings = [];
  var checks = 0;
  var passed = 0;
  var a11y = data.accessibility;

  // Semantic elements (relaxed for small components/fragments)
  var elCount = (data.structure && data.structure.totalElements) || 0;
  checks++;
  var semantic = a11y.semanticElements || {};
  var hasMain = (semantic.main || 0) > 0;
  var hasNav = (semantic.nav || 0) > 0;
  var hasHeader = (semantic.header || 0) > 0;
  var semanticCount = [hasMain, hasNav, hasHeader].filter(Boolean).length;
  if (semanticCount >= 2 || elCount < 50) {
    passed++; // Small components don't need full page landmarks
  } else {
    findings.push({
      severity: semanticCount === 0 ? 'error' : 'warning',
      title: 'Missing semantic HTML elements',
      detail: 'Found: ' + (hasHeader ? 'header ' : '') + (hasNav ? 'nav ' : '') + (hasMain ? 'main ' : '') + (semantic.footer ? 'footer' : ''),
      fix: 'Use <header>, <nav>, <main>, <footer> for page structure. Screen readers rely on these landmarks.', source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships',
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
      fix: 'Use headings in order: h1 → h2 → h3. Never skip levels. Style with classes instead of heading tags.', source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships',
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
      fix: 'Add alt="description" to all <img> tags. Use alt="" for decorative images.', source: 'WCAG 2.2 §1.1.1 — https://www.w3.org/TR/WCAG22/#non-text-content',
      presetRef: null
    });
  }

  // Image sizing (performance impact)
  var imgIssues = (data.performance && data.performance.imageSizing) || [];
  var noDimensions = imgIssues.filter(function(i) { return i.issues.indexOf('no-dimensions') !== -1; });
  var lazyAbove = imgIssues.filter(function(i) { return i.issues.indexOf('lazy-above-fold') !== -1; });
  var oversized = imgIssues.filter(function(i) { return i.issues.some(function(x) { return x.indexOf('oversized') === 0; }); });
  if (noDimensions.length > 0) {
    findings.push({ severity: 'warning', title: noDimensions.length + ' image(s) without explicit dimensions', detail: 'Missing width/height causes layout shift (CLS) when images load', fix: 'Add width and height attributes to all <img> tags, or use CSS aspect-ratio.', presetRef: null, source: 'Web Vitals — https://web.dev/articles/cls' });
  }
  if (lazyAbove.length > 0) {
    findings.push({ severity: 'error', title: lazyAbove.length + ' above-fold image(s) with lazy loading', detail: 'lazy loading on visible images delays LCP (Largest Contentful Paint)', fix: 'Remove loading="lazy" from images visible in the initial viewport. Use it only for below-fold images.', presetRef: null, source: 'Web Vitals — https://web.dev/articles/lcp' });
  }
  if (oversized.length > 0) {
    findings.push({ severity: 'info', title: oversized.length + ' image(s) may be oversized for their display size', detail: 'Serving images much larger than their display size wastes bandwidth', fix: 'Resize images to 2x their display size (for retina). Use srcset for responsive images.', presetRef: null, source: 'MDN — https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images' });
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
      presetRef: 'Form presets always pair inputs with visible labels',
      source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships'
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
      fix: 'Ensure focus-visible styles exist. In Tailwind: focus-visible:ring-2 focus-visible:ring-blue-500', source: 'WCAG 2.2 §2.4.7 — https://www.w3.org/TR/WCAG22/#focus-visible',
      presetRef: 'All interactive presets include focus-visible ring styles'
    });
  }

  // Language attribute (skip for HTML fragments — pasted snippets, presets)
  var isFragment = data.meta && (data.meta.url === 'Pasted HTML' || data.meta.url === 'Editor Preview' || data.meta.isFragment);
  if (!isFragment) {
    checks++;
    if (data.accessibility.langAttribute) {
      passed++;
    } else {
      findings.push({
        severity: 'error',
        title: 'Missing lang attribute on <html>',
        detail: 'Screen readers need the language to pronounce content correctly',
        fix: 'Add lang="en" (or appropriate language) to the <html> element.',
        presetRef: null,
        source: 'WCAG 2.2 §3.1.1 — https://www.w3.org/TR/WCAG22/#language-of-page'
      });
    }
  }

  // Skip navigation link (skip for fragments)
  if (!isFragment && data.structure && data.structure.totalElements > 50) {
    checks++;
    if (data.accessibility.hasSkipLink) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: 'No skip navigation link found',
        detail: 'Keyboard users must tab through all navigation before reaching main content',
        fix: 'Add a visually hidden skip link as the first focusable element: <a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>',
        presetRef: null,
        source: 'WCAG 2.2 §2.4.1 — https://www.w3.org/TR/WCAG22/#bypass-blocks'
      });
    }
  }

  // Bad link texts
  var badLinks = data.accessibility.badLinkTexts || [];
  if (badLinks.length > 0) {
    findings.push({
      severity: 'warning',
      title: badLinks.length + ' link(s) with non-descriptive text',
      detail: 'Found: ' + badLinks.slice(0, 5).map(function(l) { return '"' + l.text + '"'; }).join(', '),
      fix: 'Replace generic text like "click here" or "read more" with descriptive link text that makes sense out of context.',
      presetRef: null,
      source: 'WCAG 2.2 §2.4.4 — https://www.w3.org/TR/WCAG22/#link-purpose-in-context'
    });
  }

  // Missing autocomplete on common fields
  var missingAC = data.accessibility.missingAutocomplete || 0;
  if (missingAC > 0) {
    findings.push({
      severity: 'info',
      title: missingAC + ' form field(s) missing autocomplete attribute',
      detail: 'Autocomplete helps users fill forms faster and reduces errors',
      fix: 'Add autocomplete="name", autocomplete="email", etc. to common input fields.',
      presetRef: null,
      source: 'WCAG 2.2 §1.3.5 — https://www.w3.org/TR/WCAG22/#identify-input-purpose'
    });
  }

  // ARIA audit
  var ariaIssues = data.accessibility.ariaIssues || [];
  var btnNoTabindex = ariaIssues.filter(function(a) { return a.type === 'button-no-tabindex'; });
  var hiddenFocusable = ariaIssues.filter(function(a) { return a.type === 'hidden-focusable'; });
  if (btnNoTabindex.length > 0) {
    findings.push({
      severity: 'error',
      title: btnNoTabindex.length + ' element(s) with role="button" but no tabindex',
      detail: 'Non-button elements with role="button" must be keyboard-focusable',
      fix: 'Add tabindex="0" and a keydown handler for Enter/Space to elements with role="button", or use a real <button> element.',
      presetRef: null,
      source: 'WCAG 2.2 §4.1.2 — https://www.w3.org/TR/WCAG22/#name-role-value'
    });
  }
  if (hiddenFocusable.length > 0) {
    findings.push({
      severity: 'error',
      title: hiddenFocusable.length + ' focusable element(s) inside aria-hidden containers',
      detail: 'Screen readers skip aria-hidden content, but keyboard focus can still reach these elements — creating a confusing experience',
      fix: 'Add tabindex="-1" to focusable elements inside aria-hidden containers, or restructure to keep them outside.',
      presetRef: null,
      source: 'WCAG 2.2 §4.1.2 — https://www.w3.org/TR/WCAG22/#name-role-value'
    });
  }

  // Color-only indicators
  var colorOnly = data.accessibility.colorOnlyIndicators || 0;
  if (colorOnly > 0) {
    findings.push({
      severity: 'warning',
      title: colorOnly + ' status element(s) may rely on color alone',
      detail: 'Elements with error/success/warning classes but no icon or text prefix',
      fix: 'Add an icon (✓, ✗, ⚠) or text label ("Error:", "Success:") alongside color to convey status. Color-blind users cannot distinguish red from green.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.1 — https://www.w3.org/TR/WCAG22/#use-of-color'
    });
  }

  // Auto-playing media
  var autoPlay = data.accessibility.autoPlayMedia || 0;
  if (autoPlay > 0) {
    findings.push({
      severity: 'error',
      title: autoPlay + ' auto-playing media element(s) without muted attribute',
      detail: 'Unexpected audio disrupts users, especially those using screen readers',
      fix: 'Add the muted attribute to auto-playing videos, or remove autoplay entirely. Let users choose to play media.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.2 — https://www.w3.org/TR/WCAG22/#audio-control'
    });
  }

  // Profile-specific: font smoothing warning (low_vision)
  if (profile.warnFontSmoothing && data.typography && data.typography.fontSmoothingAntialiased) {
    checks++;
    findings.push({
      severity: 'warning',
      title: '-webkit-font-smoothing: antialiased detected',
      detail: 'Antialiased font smoothing thins fonts on macOS, reducing legibility for low-vision users.',
      fix: 'Remove -webkit-font-smoothing: antialiased or use auto instead.',
      source: 'Low Vision TF — https://www.w3.org/WAI/GL/low-vision-a11y-tf/'
    });
  }

  // Profile-specific: background images behind text (low_vision)
  if (profile.warnBackgroundImage && data.accessibility && data.accessibility.bgImageBehindText) {
    checks++;
    findings.push({
      severity: 'warning',
      title: data.accessibility.bgImageBehindText + ' element(s) with background images behind text',
      detail: 'Background textures/patterns reduce text legibility for low-vision users.',
      fix: 'Use solid backgrounds behind text, or add a semi-transparent overlay.',
      source: 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum'
    });
  }

  // Profile-specific: outline:none without focus replacement (motor_impairment)
  if (profile.warnOutlineNone && a11y.focusIndicators) {
    var outlineNone = a11y.focusIndicators.filter(function(f) {
      return f.outlineStyle === 'none' && !a11y.hasFocusVisibleCSS;
    }).length;
    if (outlineNone > 0) {
      checks++;
      findings.push({
        severity: 'error',
        title: outlineNone + ' element(s) with outline:none and no :focus-visible replacement',
        detail: 'Removing focus outlines without providing alternative styling makes keyboard navigation impossible.',
        fix: 'Never use outline:none without a :focus-visible replacement. Use focus-visible:ring-2 in Tailwind.',
        source: 'WCAG 2.2 §2.4.7 — https://www.w3.org/TR/WCAG22/#focus-visible'
      });
    }
  }

  var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
  var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
  var score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
  return { score: score, findings: findings, checks: checks, passed: passed, weight: 15, label: 'Accessibility', icon: 'a11y' };
}


  S.register("accessibility", scoreAccessibility, 15, "Accessibility", "a11y");
})();
