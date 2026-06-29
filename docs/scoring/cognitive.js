// Scoring Module: Cognitive Load
// Weight: 5%

(function() {
  "use strict";
  var S = window.MilgScoring;

function scoreCognitiveLoad(data) {
  var profile = S.getProfile(data);
  var findings = [];
  var checks = 0;
  var passed = 0;

  // Heading count as proxy for section complexity
  checks++;
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

  // Navigation item count (profile-aware)
  if (profile.maxNavItems > 0 && data.accessibility && data.accessibility.semanticElements) {
    var navCount = data.accessibility.navItemCount || 0;
    if (navCount > 0) {
      checks++;
      if (navCount <= profile.maxNavItems) {
        passed++;
      } else {
        findings.push({
          severity: 'warning',
          title: navCount + ' top-level navigation items (recommended: ≤' + profile.maxNavItems + ' for this audience)',
          detail: 'Working memory holds 4±1 items. More nav items increase cognitive load and decision time.',
          fix: 'Reduce to ' + profile.maxNavItems + ' top-level items. Group less-used links under "More" or a hamburger menu.',
          source: 'Cowan (2001) working memory — https://doi.org/10.1017/S0140525X01003922'
        });
      }
    }
  }

  // Reading level (profile-aware)
  if (profile.readingGradeLevel > 0 && data.readability && data.readability.gradeLevel > 0) {
    checks++;
    var grade = data.readability.gradeLevel;
    if (grade <= profile.readingGradeLevel) {
      passed++;
    } else {
      findings.push({
        severity: grade > profile.readingGradeLevel + 3 ? 'error' : 'warning',
        title: 'Reading level is grade ' + Math.round(grade) + ' (maximum for this audience: grade ' + profile.readingGradeLevel + ')',
        detail: 'Content may be too complex for the target audience. Lower grade level = more accessible.',
        fix: 'Use shorter sentences, simpler words, and active voice. Aim for grade ' + profile.readingGradeLevel + ' or lower.',
        source: 'WCAG 2.2 §3.1.5 — https://www.w3.org/TR/WCAG22/#reading-level'
      });
    }
  }

  // Reduced motion requirement (profile-aware)
  if (profile.requireReducedMotion) {
    var anim = data.animation || {};
    if (anim.keyframeCount > 0 || (data.interaction && data.interaction.transitions && data.interaction.transitions.length > 2)) {
      checks++;
      if (anim.hasReducedMotion) {
        passed++;
      } else {
        findings.push({
          severity: 'warning',
          title: 'Animations present without prefers-reduced-motion support',
          detail: 'This audience profile requires motion reduction options. ' + (anim.keyframeCount || 0) + ' keyframe rules found.',
          fix: 'Add @media (prefers-reduced-motion: reduce) to disable or reduce animations.',
          source: 'WCAG 2.2 §2.3.3 — https://www.w3.org/TR/WCAG22/#animation-from-interactions'
        });
      }
    }
  }

  // Unique color count as cognitive noise indicator
  var textColors = (data.colors && data.colors.textColors) || [];
  var bgColors = (data.colors && data.colors.bgColors) || [];
  if (textColors.length + bgColors.length > 0) {
    checks++;
    var uniqueColors = textColors.length + bgColors.length;
    if (uniqueColors <= 30) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: uniqueColors + ' unique colors — high visual complexity',
        detail: 'Many distinct colors increase cognitive load and make the page harder to parse.',
        fix: 'Consolidate to a systematic palette: primary + neutral + 3 semantic colors.',
        source: 'Material Design 3 — https://m3.material.io/styles/color/roles'
      });
    }
  }

  // Interactive element density
  var touchTargets = (data.interaction && data.interaction.touchTargets) || [];
  var totalElements = (data.structure && data.structure.totalElements) || 100;
  if (totalElements > 30) {
    checks++;
    // Count all interactive elements (touch issues + those that passed)
    var interactiveCount = touchTargets.length + Math.round(totalElements * 0.1); // rough estimate
    var density = interactiveCount / totalElements;
    if (density < 0.4) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: 'High interactive element density',
        detail: 'Many clickable elements relative to content can overwhelm users.',
        fix: 'Group related actions. Use progressive disclosure to hide secondary actions.',
        source: 'Hick\'s Law — https://lawsofux.com/hicks-law/'
      });
    }
  }

  // Consistent heading hierarchy (cognitive predictability)
  var headingHierarchy = (data.accessibility && data.accessibility.headingHierarchy) || [];
  if (headingHierarchy.length >= 2) {
    checks++;
    var hierarchyBroken = false;
    for (var hi = 1; hi < headingHierarchy.length; hi++) {
      var prevLevel = parseInt(headingHierarchy[hi - 1].charAt(1));
      var currLevel = parseInt(headingHierarchy[hi].charAt(1));
      if (currLevel > prevLevel + 1) { hierarchyBroken = true; break; }
    }
    if (!hierarchyBroken) {
      passed++;
    } else {
      // App/SPA fragment views often omit the shell <h1>; a level skip here isn't a
      // reliable "broken mental model" signal. Demote to info for app-like views.
      var cogAppLike = !!(data.context && data.context.appLike);
      findings.push({
        severity: cogAppLike ? 'info' : 'warning',
        title: cogAppLike ? 'Heading levels skip within this app view' : 'Heading hierarchy gaps break mental model',
        detail: 'Skipped heading levels (e.g., h1 → h3) make it harder for users to understand content structure.',
        fix: 'Use headings in order: h1 → h2 → h3. Don\'t skip levels.',
        source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships'
      });
      if (cogAppLike) passed++;
    }
  }

  var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
  var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
  var score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
  return { score: score, findings: findings, checks: checks, passed: passed, weight: 5, label: 'Cognitive Load', icon: 'cognitive' };
}


  S.register("cognitive", scoreCognitiveLoad, 5, "Cognitive Load", "cognitive");
})();
