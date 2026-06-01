// Scoring Module: Motion, Animation & Filters
// Weight: 3%
// Sources: WCAG 2.2 §2.3.3, CSS Filter Effects spec

(function() {
  "use strict";
  var S = window.MilgScoring;

  function scoreFilters(data, profile) {
    var findings = [];
    var checks = 0;
    var passed = 0;
    var anim = data.animation || {};
    profile = profile || {};
    var hasMotion = (anim.keyframeCount > 0) || (anim.autoplayCount > 0) ||
      (data.interaction && data.interaction.transitions && data.interaction.transitions.length > 2);

    // prefers-reduced-motion support — an error for audiences that require it.
    checks++;
    if (anim.hasReducedMotion) {
      passed++;
    } else if (hasMotion) {
      var _needsRM = !!profile.requireReducedMotion;
      findings.push({
        severity: _needsRM ? 'error' : 'warning',
        title: 'No prefers-reduced-motion support detected',
        detail: (anim.keyframeCount || 0) + ' @keyframes rule(s) and ' + (anim.autoplayCount || 0) + ' auto-running animation(s) found' +
          (_needsRM ? ' — this audience profile requires a reduced-motion path.' : '. Users with vestibular disorders need the option to reduce motion.'),
        fix: 'Add @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }',
        presetRef: null,
        source: 'WCAG 2.2 §2.3.3 — https://www.w3.org/TR/WCAG22/#animation-from-interactions'
      });
    } else {
      passed++; // No significant animations, no need for reduced-motion
    }

    // Infinitely-looping animations — vestibular risk, esp. without a reduced-motion path.
    if (anim.infiniteCount > 0) {
      checks++;
      if (anim.hasReducedMotion) {
        passed++;
      } else {
        findings.push({
          severity: profile.requireReducedMotion ? 'error' : 'warning',
          title: anim.infiniteCount + ' infinitely-looping animation(s)',
          detail: 'Continuous motion (spinners, marquees, looping effects) can trigger vestibular discomfort and distract.',
          fix: 'Gate looping animations behind @media (prefers-reduced-motion: no-preference), or stop them after a few iterations.',
          source: 'WCAG 2.2 §2.2.2 — https://www.w3.org/TR/WCAG22/#pause-stop-hide'
        });
      }
    }

    // Sluggish animation durations (> 1s feels slow for UI motion).
    var _longDur = (anim.animationDurations || []).filter(function(d) {
      var n = parseFloat(d); if (/ms$/.test(d)) n = n / 1000; return n > 1;
    });
    if (_longDur.length > 0) {
      checks++;
      findings.push({
        severity: 'info',
        title: _longDur.length + ' long animation duration(s) (> 1s): ' + _longDur.slice(0, 4).join(', '),
        detail: 'UI motion above ~1s feels sluggish; enter transitions read best at 200-300ms.',
        fix: 'Keep functional UI motion at 150-300ms; reserve longer durations for deliberate, infrequent hero motion.',
        source: 'Material Design motion — https://m3.material.io/styles/motion/overview'
      });
    }

    // will-change overuse (each one is a persistent compositing layer).
    if (anim.willChangeCount > 8) {
      checks++;
      findings.push({
        severity: 'info',
        title: anim.willChangeCount + ' elements use will-change (overuse)',
        detail: 'will-change forces persistent GPU layers; overuse increases memory and can hurt performance.',
        fix: 'Apply will-change only to elements about to animate, and remove it after.',
        source: 'MDN — https://developer.mozilla.org/en-US/docs/Web/CSS/will-change'
      });
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

    // Transition count: too many or too few
    var transitions = (data.interaction && data.interaction.transitions) || [];
    if (transitions.length > 0) {
      checks++;
      if (transitions.length <= 8) {
        passed++;
      } else {
        findings.push({
          severity: 'info',
          title: transitions.length + ' unique transition durations (recommend ≤5)',
          detail: 'Using many different durations creates inconsistent motion feel.',
          fix: 'Standardize to 2-3 durations: fast (150ms), normal (300ms), slow (500ms).',
          source: 'Material Design motion — https://m3.material.io/styles/motion/overview'
        });
      }
    }

    // Keyframe animation count
    if (anim.keyframeCount > 0) {
      checks++;
      if (anim.keyframeCount <= 10) {
        passed++;
      } else {
        findings.push({
          severity: 'info',
          title: anim.keyframeCount + ' @keyframes rules (high count)',
          detail: 'Many animations can cause performance issues and visual overwhelm.',
          fix: 'Review if all animations serve a purpose. Remove decorative animations.',
          source: 'NNGroup — https://www.nngroup.com/articles/animation-usability/'
        });
      }
    }

    var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
    var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
    var score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
    return { score: score, findings: findings, checks: checks, passed: passed, weight: 3, label: 'Motion & Animation', icon: 'cognitive' };
  }

  S.register("filters", scoreFilters, 3, "Motion & Animation", "cognitive");
})();
