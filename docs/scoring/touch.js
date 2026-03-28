// Scoring Module: Touch & Interaction
// Weight: 15%

(function() {
  "use strict";
  var S = window.MilgScoring;

function scoreTouchTargets(data) {
  var profile = S.getProfile(data);
  var findings = [];
  var targets = data.interaction.touchTargets || [];

  // Viewport-aware thresholds, adjusted by profile:
  var vw = (data.meta && data.meta.viewportWidth) || 1280;
  var isDesktop = vw >= 1024;
  var minSize = isDesktop ? profile.touchTargetDesktop : profile.touchTarget;
  var warnSize = isDesktop ? profile.touchTargetDesktopWarn : profile.touchTarget;
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
          ? 'Click targets need at least ' + minSize + '×' + minSize + 'px. Increase padding or min-height/min-width.'
          : 'Touch targets need ' + minSize + '×' + minSize + 'px minimum. Add min-h-[' + minSize + 'px] min-w-[' + minSize + 'px] or increase padding.',
        presetRef: isDesktop ? null : 'Button presets use py-3 px-6 (48px height)',
        source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum'
      });
    } else if (minDim < warnSize && isDesktop) {
      findings.push({
        severity: 'warning',
        title: t.element + ' is ' + w + '×' + h + 'px (recommended for desktop: ≥' + warnSize + 'px)',
        detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
        fix: 'While ' + minSize + 'px meets minimum, ' + warnSize + 'px+ improves click comfort. Consider adding padding.',
        presetRef: null,
        source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum'
      });
    }
  });

  // Also flag targets that pass the current threshold but would fail on touch
  if (isDesktop && targets.length > 0) {
    var touchMin = profile.touchTarget;
    var touchFails = targets.filter(function(t) { return Math.min(t.width, t.height) < touchMin; });
    if (touchFails.length > 0) {
      findings.push({
        severity: 'info',
        title: touchFails.length + ' element(s) below ' + touchMin + 'px touch target (analyzed at ' + vw + 'px desktop viewport)',
        detail: 'These meet desktop minimums but would fail on touch devices. Consider responsive sizing if the site is also used on mobile.',
        fix: 'For responsive touch support: add touch-target sizing at mobile breakpoints, e.g. sm:min-h-[' + touchMin + 'px]',
        presetRef: null,
        source: 'Material Design 3 — https://m3.material.io/foundations/layout/applying-layout'
      });
    }
  }

  // Note when responsive CSS exists that might fix touch targets on mobile
  if (isDesktop && data.interaction && data.interaction.hasResponsiveTargetCSS) {
    findings.push({
      severity: 'info',
      title: 'Responsive CSS detected that may adjust target sizes at mobile breakpoints',
      detail: 'This site has media queries with height/padding rules. Touch targets may be correctly sized on mobile devices.',
      fix: 'Verify by testing at mobile viewport. Use the viewport selector to re-scan at 375px width.',
      presetRef: null
    });
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
        presetRef: null,
        source: 'NNGroup animation — https://www.nngroup.com/articles/animation-usability/'
      });
    }
  });

  // Score: deduct per error, less per warning
  var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
  var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
  var score = Math.max(0, 100 - (errors * 10) - (warnings * 3));
  return { score: score, findings: findings, weight: 15, label: 'Touch & Interaction', icon: 'touch' };
}


  S.register("touch", scoreTouchTargets, 15, "Touch & Interaction", "touch");
})();
