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

  // Focus indicators — check if any element shows a visible change when focused
  checks++;
  var focusIndicators = a11y.focusIndicators || [];
  var hasAnyFocus = focusIndicators.some(function(f) {
    // Element has visible outline when focused, or showed a change on focus
    return f.hasFocusChange || (f.outlineStyle !== 'none' && f.outlineWidth !== '0px');
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

  // --- Structural completeness hints (info only, full pages via URL/snippet) ---
  // Only for real pages, not pasted fragments or editor previews
  var inputMethod = (data.meta && data.meta._inputMethod) || '';
  var isFullPage = (inputMethod === 'url' || inputMethod === 'console') && !isFragment;
  if (isFullPage && elCount > 50) {
    // Missing <footer>
    if (!semantic.footer) {
      findings.push({
        severity: 'info',
        title: 'No <footer> element found',
        detail: 'Most pages benefit from a footer with copyright, contact info, and secondary navigation. Some pages (SPAs, dashboards, single-purpose tools) legitimately omit it.',
        fix: 'Add a <footer> with site-wide links, copyright, and contact information. It helps users who scroll to the bottom looking for additional navigation.',
        presetRef: null,
        source: 'HTML spec — https://html.spec.whatwg.org/multipage/sections.html#the-footer-element'
      });
    }
    // No dark mode support
    var hasDarkMode = (data.structure && data.structure.darkModeClasses) ||
      (data.structure && data.structure.darkModeMethod && data.structure.darkModeMethod !== 'none');
    if (!hasDarkMode && elCount > 100) {
      findings.push({
        severity: 'info',
        title: 'No dark mode support detected',
        detail: 'No dark: classes, prefers-color-scheme media query, or dark mode toggle found in static analysis. Note: dark mode can also be implemented purely in JavaScript (runtime class toggling, CSS-in-JS, matchMedia listeners) which this check cannot detect.',
        fix: 'If your page doesn\'t have dark mode yet, consider adding it via CSS prefers-color-scheme (automatic), Tailwind dark: classes, or a JS-based toggle. Dark mode reduces eye strain and is increasingly expected by users.',
        presetRef: 'All presets include dark mode variants',
        source: 'MDN — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme'
      });
    }
    // No <main> landmark (upgrade existing semantic check to also hint here)
    if (!hasMain) {
      findings.push({
        severity: 'info',
        title: 'No <main> landmark found',
        detail: 'The <main> element identifies the primary content area. Screen readers use it to let users jump directly to content, skipping navigation.',
        fix: 'Wrap your primary content in <main>. There should be exactly one per page.',
        presetRef: null,
        source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships'
      });
    }
    // No <h1> on the page
    var headings = (data.typography && data.typography.headings) || [];
    var hasH1 = headings.some(function(h) { return h.tag === 'h1'; });
    if (!hasH1 && headings.length > 0) {
      findings.push({
        severity: 'info',
        title: 'No <h1> heading found',
        detail: 'The page has headings (' + headings.map(function(h) { return h.tag; }).join(', ') + ') but no <h1>. Every page should have exactly one <h1> describing its primary purpose.',
        fix: 'Add a single <h1> as the main title. Other headings should follow hierarchically (h2, h3, etc.).',
        presetRef: null,
        source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships'
      });
    }
    // Not responsive (no responsive classes or viewport meta)
    var hasResponsive = data.structure && data.structure.responsiveClasses;
    var hasViewportMeta = data.structure && data.structure.viewportMeta && data.structure.viewportMeta.indexOf('width=device-width') !== -1;
    if (!hasResponsive && !hasViewportMeta) {
      findings.push({
        severity: 'info',
        title: 'No responsive design indicators found',
        detail: 'No responsive CSS classes (sm:, md:, lg:) or proper viewport meta tag detected. Note: responsive behavior can also be implemented purely in JavaScript (resize listeners, dynamic styles) or via CSS media queries in external stylesheets that this static check may not detect.',
        fix: 'If your page isn\'t responsive yet, add <meta name="viewport" content="width=device-width, initial-scale=1.0"> and use responsive breakpoints (CSS media queries, Tailwind sm:/md:/lg: classes, or JS-based approaches) for layout adjustments.',
        presetRef: null,
        source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow'
      });
    }
  }

  // --- Extended checks ---

  // Duplicate IDs
  var dupIds = a11y.duplicateIds || [];
  if (dupIds.length > 0) {
    checks++;
    var ariaIds = dupIds.filter(function(d) { return d.usedInAria; });
    var details = dupIds.slice(0, 5).map(function(d) { return '#' + d.id + ' (' + d.count + 'x' + (d.usedInAria ? ', used in label/ARIA' : '') + ')'; });
    findings.push({
      severity: ariaIds.length > 0 ? 'error' : 'warning',
      title: dupIds.length + ' duplicate ID(s) found',
      detail: details.join('; '),
      fix: 'Each id must be unique on the page. Duplicate IDs break form labels, ARIA references, and anchor links.',
      presetRef: null,
      source: 'WCAG 2.2 §4.1.1 — https://www.w3.org/TR/WCAG22/#parsing'
    });
  }

  // Scrollable regions without keyboard access
  var scrollNoKey = a11y.scrollableNoKeyboard || 0;
  if (scrollNoKey > 0) {
    checks++;
    findings.push({
      severity: 'error',
      title: scrollNoKey + ' scrollable region(s) not keyboard-accessible',
      detail: 'Scrollable containers without focusable content or tabindex cannot be scrolled by keyboard users.',
      fix: 'Add tabindex="0" to scrollable containers, or ensure they contain focusable elements (links, buttons).',
      presetRef: null,
      source: 'WCAG 2.2 §2.1.1 — https://www.w3.org/TR/WCAG22/#keyboard'
    });
  }

  // Nested interactive elements
  var nestedInt = a11y.nestedInteractives || [];
  if (nestedInt.length > 0) {
    checks++;
    findings.push({
      severity: 'error',
      title: nestedInt.length + ' nested interactive element(s) (e.g. link inside link)',
      detail: 'Nested clickable elements create undefined behavior. Elements: ' + nestedInt.slice(0, 3).join(', '),
      fix: 'Never nest interactive elements. Use a single <a> or <button> and handle layout with CSS.',
      presetRef: null,
      source: 'HTML spec §4.5.1 — https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element'
    });
  }

  // Positive tabindex
  var posTabindex = a11y.positiveTabindex || 0;
  if (posTabindex > 0) {
    checks++;
    findings.push({
      severity: 'warning',
      title: posTabindex + ' element(s) with positive tabindex',
      detail: 'Positive tabindex disrupts natural tab order and creates confusing keyboard navigation.',
      fix: 'Remove positive tabindex values. Use DOM order to control tab sequence. tabindex="0" adds to natural order; tabindex="-1" removes from it.',
      presetRef: null,
      source: 'WCAG 2.2 §2.4.3 — https://www.w3.org/TR/WCAG22/#focus-order'
    });
  }

  // Empty buttons/links
  var emptyInt = a11y.emptyInteractives || [];
  if (emptyInt.length > 0) {
    checks++;
    findings.push({
      severity: 'error',
      title: emptyInt.length + ' interactive element(s) with no accessible name',
      detail: 'Buttons/links without text, aria-label, or title are invisible to screen readers: ' + emptyInt.slice(0, 3).join(', '),
      fix: 'Add text content, aria-label="description", or a descriptive title attribute to all interactive elements.',
      presetRef: null,
      source: 'WCAG 2.2 §4.1.2 — https://www.w3.org/TR/WCAG22/#name-role-value'
    });
  }

  // Non-text contrast (input borders)
  var ntContrast = a11y.nonTextContrast || [];
  if (ntContrast.length > 0) {
    checks++;
    var ntDetails = ntContrast.slice(0, 3).map(function(n) { return n.selector + ' border ' + n.ratio + ':1'; });
    findings.push({
      severity: 'warning',
      title: ntContrast.length + ' form element(s) with border contrast below 3:1',
      detail: 'Input borders must have at least 3:1 contrast against their background (WCAG 1.4.11): ' + ntDetails.join('; '),
      fix: 'Increase border color contrast. In dark mode use border-slate-600 or darker. Light mode: border-slate-300 minimum on white.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.11 — https://www.w3.org/TR/WCAG22/#non-text-contrast'
    });
  }

  // Table accessibility
  var tableIssues = a11y.tableIssues || [];
  if (tableIssues.length > 0) {
    checks++;
    var tblDetails = tableIssues.slice(0, 3).map(function(t) { return t.selector + ': ' + t.issues.join(', '); });
    findings.push({
      severity: tableIssues.some(function(t) { return t.issues.indexOf('no-th') !== -1; }) ? 'warning' : 'info',
      title: tableIssues.length + ' table(s) with accessibility issues',
      detail: tblDetails.join('; '),
      fix: 'Data tables need <th> with scope="col" or scope="row". Add <caption> or aria-label for screen reader context.',
      presetRef: null,
      source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships'
    });
  }

  // Missing button type
  var missingBtnType = a11y.missingButtonType || 0;
  if (missingBtnType > 0) {
    findings.push({
      severity: 'info',
      title: missingBtnType + ' button(s) without explicit type attribute',
      detail: 'Buttons default to type="submit" which can cause accidental form submissions.',
      fix: 'Add type="button" to buttons that are not form submit buttons.',
      presetRef: null,
      source: 'HTML spec — https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element'
    });
  }

  // Text clipping without title
  var textClipped = a11y.textClippedNoTitle || 0;
  if (textClipped > 0) {
    findings.push({
      severity: textClipped > 5 ? 'warning' : 'info',
      title: textClipped + ' element(s) truncate text without title attribute',
      detail: 'Text is clipped with ellipsis but has no title or aria-label, so the full text is inaccessible.',
      fix: 'Add title="full text here" to elements with text-overflow: ellipsis so users can see the complete content on hover.',
      presetRef: null,
      source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships'
    });
  }

  // Placeholder-only labels
  var placeholderOnly = a11y.placeholderOnlyInputs || 0;
  if (placeholderOnly > 0) {
    findings.push({
      severity: 'warning',
      title: placeholderOnly + ' input(s) use placeholder as only label',
      detail: 'Placeholders disappear when the user starts typing, leaving no visible label.',
      fix: 'Add a visible <label> element. Placeholders are hints, not labels.',
      presetRef: null,
      source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships'
    });
  }

  // Invisible links (no underline, no color distinction)
  var invisLinks = a11y.invisibleLinks || 0;
  if (invisLinks > 0) {
    findings.push({
      severity: 'warning',
      title: invisLinks + ' link(s) visually indistinguishable from surrounding text',
      detail: 'Links in body text have no underline, no color difference, and no background — users cannot identify them as clickable.',
      fix: 'Add text-decoration: underline or a distinct color to in-content links. Nav and button-styled links are exempt.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.1 — https://www.w3.org/TR/WCAG22/#use-of-color'
    });
  }

  // Required fields without visual indicator
  var reqNoIndicator = a11y.requiredNoIndicator || 0;
  if (reqNoIndicator > 0) {
    findings.push({
      severity: 'warning',
      title: reqNoIndicator + ' required field(s) without visual indicator',
      detail: 'Required inputs have no asterisk (*) or "Required" text in their label.',
      fix: 'Add an asterisk (*) to required field labels or include "Required" text.',
      presetRef: null,
      source: 'WCAG 2.2 §3.3.2 — https://www.w3.org/TR/WCAG22/#labels-or-instructions'
    });
  }

  // Invisible inputs (no border/background/shadow)
  var invisInputs = a11y.invisibleInputs || 0;
  if (invisInputs > 0) {
    findings.push({
      severity: 'warning',
      title: invisInputs + ' input(s) without visible boundary',
      detail: 'Text inputs have no border, no distinct background, and no shadow — users cannot identify where to type.',
      fix: 'Add a border (border-slate-300) or distinct background to input fields. WCAG 1.4.11 requires 3:1 contrast for input boundaries.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.11 — https://www.w3.org/TR/WCAG22/#non-text-contrast'
    });
  }

  // Select without default option
  var selectNoDefault = a11y.selectNoDefault || 0;
  if (selectNoDefault > 0) {
    findings.push({
      severity: 'info',
      title: selectNoDefault + ' select element(s) without meaningful default option',
      detail: 'Select elements have a blank first option. Users see an empty dropdown.',
      fix: 'Add a descriptive prompt like "Select an option..." as the first disabled option.',
      presetRef: null,
      source: 'NNGroup — https://www.nngroup.com/articles/drop-down-menus/'
    });
  }

  // Disabled element contrast
  var disabledLC = a11y.disabledLowContrast || 0;
  if (disabledLC > 0) {
    findings.push({
      severity: 'info',
      title: disabledLC + ' disabled element(s) with very low contrast (< 2:1)',
      detail: 'While WCAG exempts disabled elements from contrast rules, users should still be able to read what is disabled.',
      fix: 'Aim for at least 2:1 contrast on disabled elements so users understand what is unavailable.',
      presetRef: null,
      source: 'Usability research — https://www.nngroup.com/articles/disabled-buttons/'
    });
  }

  var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
  var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
  var score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
  return { score: score, findings: findings, checks: checks, passed: passed, weight: 15, label: 'Accessibility', icon: 'a11y' };
}


  S.register("accessibility", scoreAccessibility, 15, "Accessibility", "a11y");
})();
