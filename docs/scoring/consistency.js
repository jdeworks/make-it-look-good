// Scoring Module: Visual Consistency
// Weight: 5%

(function() {
  "use strict";
  var S = window.MilgScoring;

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
      presetRef: 'Presets use a single primary color with slate neutrals',
      source: 'Material Design 3 — https://m3.material.io/styles/color/roles'
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
      presetRef: null,
      source: 'Modular type scales — https://typescale.com/'
    });
  }

  // Border radius consistency — exclude pill/circle shapes (9999px, 50%, >100px)
  var radii = ((data.layout && data.layout.borderRadii) || []).filter(function(r) {
    var v = r.value;
    if (v === '50%' || v === '9999px') return false;
    var px = parseFloat(v);
    return !(px > 100);
  });
  if (radii.length > 0) {
    checks++;
    if (radii.length <= 4) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: radii.length + ' distinct border-radius values (recommend 2-4, excluding pill/circle shapes)',
        detail: 'Values: ' + radii.slice(0, 6).map(function(r) { return r.value + ' (' + r.count + 'x)'; }).join(', '),
        fix: 'Standardize border-radius to 2-4 values in your design tokens. In Tailwind: rounded-sm (2px), rounded (4px), rounded-lg (8px), rounded-xl (12px).',
        presetRef: null,
        source: 'Material Design 3 — https://m3.material.io/styles/shape/overview'
      });
    }
  }

  // Line height consistency
  var lineHeights = (data.typography && data.typography.lineHeights) || [];
  if (lineHeights.length > 0) {
    checks++;
    if (lineHeights.length <= 5) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: lineHeights.length + ' distinct line-height values (recommend 2-4)',
        detail: 'Consistent line-height creates visual rhythm across the page.',
        fix: 'Standardize to 2-3 line-heights: tight (1.25), normal (1.5), relaxed (1.75).',
        source: 'Butterick\'s Practical Typography — https://practicaltypography.com/line-spacing.html'
      });
    }
  }

  // Dark mode support consistency
  if (data.structure) {
    checks++;
    if (data.structure.darkModeClasses) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: 'No dark mode support detected',
        detail: 'Dark mode is expected by ~80% of users (Android settings data).',
        fix: 'Add dark mode with dark: variants in Tailwind or prefers-color-scheme media query.',
        source: 'Apple HIG — https://developer.apple.com/design/human-interface-guidelines/dark-mode'
      });
    }
  }

  // Border width inconsistencies in sibling groups
  var borderInc = (data.consistency && data.consistency.borderWidthInconsistencies) || 0;
  if (borderInc > 0) {
    findings.push({
      severity: 'info',
      title: borderInc + ' sibling group(s) with inconsistent border widths',
      detail: 'Children in the same flex/grid container use different border widths.',
      fix: 'Unify border widths within component groups. Use a consistent border-width token.',
      source: 'Material Design 3 — https://m3.material.io/styles/shape/overview'
    });
  }

  // Font weight role consistency
  var fwInc = (data.consistency && data.consistency.fontWeightInconsistencies) || 0;
  if (fwInc > 0) {
    findings.push({
      severity: 'info',
      title: fwInc + ' heading level(s) with inconsistent font-weights',
      detail: 'Same-level headings (e.g. multiple h3s) use different font-weights.',
      fix: 'Standardize heading weights per level. All h2s should share the same weight.',
      source: 'Modular type scales — https://typescale.com/'
    });
  }

  // Gradient direction consistency
  var gradDirs = (data.consistency && data.consistency.gradientDirections) || 0;
  if (gradDirs > 3) {
    findings.push({
      severity: 'info',
      title: gradDirs + ' distinct gradient directions (recommend 1-2)',
      detail: 'Multiple gradient directions create visual incoherence.',
      fix: 'Limit to 1-2 gradient directions for visual coherence.',
      source: 'Design Systems — https://www.designsystems.com/'
    });
  }

  // Z-index sprawl
  var zSprawl = (data.layout && data.layout.zIndexSprawl) || {};
  if (zSprawl.distinct > 0) {
    checks++;
    if (zSprawl.distinct <= 8) {
      passed++;
    } else {
      findings.push({
        severity: zSprawl.distinct > 15 ? 'warning' : 'info',
        title: zSprawl.distinct + ' distinct z-index values (recommend ≤8)',
        detail: 'Max z-index: ' + zSprawl.max + '. Many z-index values indicate ad-hoc stacking that becomes unmaintainable.',
        fix: 'Consolidate to a z-index scale: --z-dropdown: 10, --z-sticky: 20, --z-modal: 30, --z-toast: 40.',
        source: 'Josh Comeau Stacking Contexts — https://www.joshwcomeau.com/css/stacking-contexts/'
      });
    }
  }

  // Shadow consistency
  var shadowSprawl = (data.layout && data.layout.shadowSprawl) || 0;
  if (shadowSprawl > 0) {
    checks++;
    if (shadowSprawl <= 5) {
      passed++;
    } else {
      findings.push({
        severity: shadowSprawl > 10 ? 'warning' : 'info',
        title: shadowSprawl + ' distinct box-shadow values (recommend 3-5)',
        detail: 'Too many unique shadow styles suggest an inconsistent elevation system.',
        fix: 'Standardize to 3-5 elevation levels: shadow-sm, shadow, shadow-md, shadow-lg, shadow-xl.',
        source: 'Material Design 3 — https://m3.material.io/styles/elevation/overview'
      });
    }
  }

  // Dark mode halation (pure black on pure white)
  if (data.colors && data.colors.darkModeHalation) {
    checks++;
    findings.push({
      severity: 'warning',
      title: 'Pure black (#000) with pure white (#fff) text detected in dark mode',
      detail: 'Pure black backgrounds with pure white text causes halation (glowing text effect) for users with astigmatism (~33% of population).',
      fix: 'Use off-black backgrounds (slate-900 / #0f172a) and off-white text (slate-100 / #f1f5f9) in dark mode.',
      source: 'Apple HIG Dark Mode — https://developer.apple.com/design/human-interface-guidelines/dark-mode'
    });
  }

  var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
  var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
  var score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
  return { score: score, findings: findings, checks: checks, passed: passed, weight: 5, label: 'Visual Consistency', icon: 'consistency' };
}


  S.register("consistency", scoreVisualConsistency, 5, "Visual Consistency", "consistency");
})();
