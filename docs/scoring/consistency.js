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

  // Border radius consistency
  var radii = (data.layout && data.layout.borderRadii) || [];
  if (radii.length > 0) {
    checks++;
    if (radii.length <= 4) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: radii.length + ' distinct border-radius values (recommend 2-4)',
        detail: 'Values: ' + radii.slice(0, 6).map(function(r) { return r.value + ' (' + r.count + 'x)'; }).join(', '),
        fix: 'Standardize border-radius to 2-4 values in your design tokens. In Tailwind: rounded-sm (2px), rounded (4px), rounded-lg (8px), rounded-xl (12px).',
        presetRef: null,
        source: 'Material Design 3 — https://m3.material.io/styles/shape/overview'
      });
    }
  }

  var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
  return { score: score, findings: findings, weight: 5, label: 'Visual Consistency', icon: 'consistency' };
}


  S.register("consistency", scoreVisualConsistency, 5, "Visual Consistency", "consistency");
})();
