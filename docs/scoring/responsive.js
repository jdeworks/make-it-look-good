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

  var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
  return { score: score, findings: findings, weight: 10, label: 'Responsive Design', icon: 'responsive' };
}


  S.register("responsive", scoreResponsive, 10, "Responsive Design", "responsive");
})();
