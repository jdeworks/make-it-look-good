// Scoring Module: Responsive Design
// Weight: 10%

(function() {
  "use strict";
  var S = window.MilgScoring;

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

  // Viewport meta audit
  if (data.structure && data.structure.viewportMeta !== undefined) {
    checks++;
    var vpContent = data.structure.viewportMeta;
    if (!vpContent) {
      findings.push({
        severity: 'error',
        title: 'Missing viewport meta tag',
        detail: 'Without a viewport meta tag, mobile browsers render at desktop width',
        fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> to <head>.',
        presetRef: null,
        source: 'MDN — https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag'
      });
    } else if (data.structure.blocksZoom) {
      findings.push({
        severity: 'error',
        title: 'Viewport blocks user zoom (user-scalable=no)',
        detail: 'Preventing zoom is an accessibility barrier for low-vision users',
        fix: 'Remove user-scalable=no from the viewport meta tag.',
        presetRef: null,
        source: 'WCAG 2.2 §1.4.4 — https://www.w3.org/TR/WCAG22/#resize-text'
      });
    } else {
      passed++;
    }
  }

  // Horizontal overflow
  if (data.structure && data.structure.hasHorizontalOverflow) {
    checks++;
    findings.push({
      severity: 'warning',
      title: 'Page has horizontal overflow (horizontal scrollbar)',
      detail: 'Content extends beyond viewport width — common responsive design failure',
      fix: 'Find elements with fixed widths wider than the viewport. Add overflow-x: hidden to body or fix the overflowing element.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow'
    });
  } else if (data.structure && data.structure.hasHorizontalOverflow === false) {
    checks++;
    passed++;
  }

  // Fixed-width elements
  var fixedW = (data.structure && data.structure.fixedWidthElements) || 0;
  if (fixedW > 0) {
    findings.push({
      severity: fixedW > 3 ? 'warning' : 'info',
      title: fixedW + ' element(s) with fixed pixel widths > 300px',
      detail: 'Fixed-width elements may overflow on smaller screens',
      fix: 'Use max-width instead of width, or percentage/viewport units. In Tailwind: max-w-full or w-full.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow'
    });
  }

  // Text truncation
  var truncated = (data.structure && data.structure.truncatedElements) || 0;
  if (truncated > 3) {
    findings.push({
      severity: 'info',
      title: truncated + ' element(s) with truncated text (ellipsis)',
      detail: 'Content is being cut off — may hide important information on smaller screens',
      fix: 'Consider allowing text to wrap, expanding the container, or using a tooltip to show full content.',
      presetRef: null
    });
  }

  var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
  return { score: score, findings: findings, weight: 10, label: 'Responsive Design', icon: 'responsive' };
}


  S.register("responsive", scoreResponsive, 10, "Responsive Design", "responsive");
})();
