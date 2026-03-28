// Scoring Module: Cognitive Load
// Weight: 5%

(function() {
  "use strict";
  var S = window.MilgScoring;

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
      presetRef: 'Tab and accordion presets for progressive disclosure',
      source: 'Hick\'s Law — https://lawsofux.com/hicks-law/'
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
      presetRef: 'Form presets demonstrate multi-step patterns',
      source: 'Miller\'s Law / Baymard Institute — https://lawsofux.com/millers-law/'
    });
  }

  var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
  return { score: score, findings: findings, weight: 5, label: 'Cognitive Load', icon: 'cognitive' };
}


  S.register("cognitive", scoreCognitiveLoad, 5, "Cognitive Load", "cognitive");
})();
