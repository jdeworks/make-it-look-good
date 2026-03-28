// Scoring Module: Motion, Animation & Filters
// Weight: 3%
// Sources: WCAG 2.2 §2.3.3, CSS Filter Effects spec

(function() {
  "use strict";
  var S = window.MilgScoring;

  function scoreFilters(data) {
    var findings = [];
    var checks = 0;
    var passed = 0;
    var anim = data.animation || {};

    // prefers-reduced-motion support
    checks++;
    if (anim.hasReducedMotion) {
      passed++;
    } else if (anim.keyframeCount > 0 || (data.interaction && data.interaction.transitions && data.interaction.transitions.length > 2)) {
      findings.push({
        severity: 'warning',
        title: 'No prefers-reduced-motion support detected',
        detail: (anim.keyframeCount || 0) + ' @keyframes rules found. Users with vestibular disorders need the option to reduce motion.',
        fix: 'Add @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }',
        presetRef: null,
        source: 'WCAG 2.2 §2.3.3 — https://www.w3.org/TR/WCAG22/#animation-from-interactions'
      });
    } else {
      passed++; // No significant animations, no need for reduced-motion
    }

    // Hidden elements waiting for scroll-reveal
    if (anim.hiddenElements > 0) {
      checks++;
      if (anim.hiddenElements <= 5) {
        passed++;
        findings.push({
          severity: 'info',
          title: anim.hiddenElements + ' element(s) with opacity:0 + transition (pre-animation state)',
          detail: 'These elements are invisible at scan time (pre-animation state). Their contrast/sizing was not checked.',
          fix: 'This is normal for scroll-reveal animations. Run the snippet after scrolling the full page for complete analysis.',
          presetRef: null,
          preAnimationState: true
        });
      } else {
        findings.push({
          severity: 'warning',
          title: anim.hiddenElements + ' hidden elements waiting for animation trigger (pre-animation state)',
          detail: 'A large portion of the page is invisible at load time (pre-animation state). This may affect perceived loading speed and SEO.',
          fix: 'Consider showing initial content without animation, then enhancing with scroll effects. Ensure content is accessible without JS.',
          presetRef: null,
          preAnimationState: true,
          source: 'WCAG 2.2 §2.3.3 — https://www.w3.org/TR/WCAG22/#animation-from-interactions'
        });
      }
    }

    // Scroll-reveal library detection
    var patterns = anim.scrollRevealPatterns || [];
    if (patterns.length > 0) {
      var totalReveal = patterns.reduce(function(s, p) { return s + p.count; }, 0);
      findings.push({
        severity: 'info',
        title: 'Scroll-reveal library detected: ' + totalReveal + ' animated element(s)',
        detail: 'Libraries found: ' + patterns.map(function(p) { return p.selector + ' (' + p.count + ')'; }).join(', '),
        fix: 'Ensure scroll-reveal animations respect prefers-reduced-motion and that content is visible without JavaScript.',
        presetRef: null,
        source: 'WCAG 2.2 §2.3.3 — https://www.w3.org/TR/WCAG22/#animation-from-interactions'
      });
    }

    var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
    return { score: score, findings: findings, weight: 3, label: 'Motion & Animation', icon: 'cognitive' };
  }

  S.register("filters", scoreFilters, 3, "Motion & Animation", "cognitive");
})();
