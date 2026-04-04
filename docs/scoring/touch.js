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

    // WCAG 2.5.8 exception: inline text links are exempt from target size requirements.
    // Detect by checking if element is an <a> without button-like styling (no bg, no border, no padding > 4px)
    var isInlineLink = t.element === 'a' && !t.isButton;

    if (minDim < minSize) {
      issueCount++;
      var ctx = t.linkContext || (isInlineLink ? 'inline' : 'button');

      // On desktop, determine severity based on how far below threshold:
      // - ≥20px (just 4px short of 24px) → info (barely noticeable with mouse)
      // - ≥16px → warning (small but usable with mouse)
      // - <16px → error (genuinely too small even for mouse)
      // On mobile, all failures are errors (fingers need the full 44px)
      function desktopSeverity(dim) {
        if (!isDesktop) return 'error';
        if (dim >= 20) return 'info';
        if (dim >= 16) return 'warning';
        return 'error';
      }

      if (ctx === 'inline') {
        // True inline text links (inside <p>, <blockquote>, etc.) — WCAG 2.5.8 exempt
        findings.push({
          severity: 'info',
          title: 'Inline text link ' + w + '×' + h + 'px — exempt from target size',
          detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
          fix: 'Inline text links in paragraphs are exempt per WCAG 2.5.8. Consider adding padding for better usability.',
          source: 'WCAG 2.2 §2.5.8 inline exception — https://www.w3.org/TR/WCAG22/#target-size-minimum',
          locator: { selector: t.selector, text: t.text || '', bboxes: t.bbox ? [t.bbox] : [] }
        });
      } else if (ctx === 'footer') {
        // Footer links — relaxed but still error below hard minimum (16px)
        var footerHardMin = isDesktop ? 16 : 24;
        findings.push({
          severity: minDim < footerHardMin ? 'error' : 'info',
          title: 'Footer link ' + w + '×' + h + 'px' + (minDim < footerHardMin ? ' (too small even for footer — min ' + footerHardMin + 'px)' : ' (below ' + minSize + 'px, relaxed for footer)'),
          detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
          fix: minDim < footerHardMin
            ? 'Even footer links need at least ' + footerHardMin + 'px height. Add padding to increase click area.'
            : 'Footer links have relaxed sizing expectations. Consider padding for touch accessibility.',
          source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum',
          locator: { selector: t.selector, text: t.text || '', bboxes: t.bbox ? [t.bbox] : [] }
        });
      } else if (ctx === 'nav') {
        // Navigation links — should be properly sized
        var navSev = desktopSeverity(minDim);
        findings.push({
          severity: navSev,
          title: 'Nav link ' + w + '×' + h + 'px (minimum: ' + minSize + 'px)',
          detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
          fix: 'Navigation links need adequate sizing. Add padding: py-2 px-4 (min-height ' + minSize + 'px).',
          presetRef: 'Navigation presets use min-height 44px on nav links',
          source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum',
          locator: { selector: t.selector, text: t.text || '', bboxes: t.bbox ? [t.bbox] : [] }
        });
      } else {
        // Buttons, styled links, other interactive elements
        var sev = desktopSeverity(minDim);
        findings.push({
          severity: sev,
          title: t.element + ' is ' + w + '×' + h + 'px (' + (isDesktop ? 'desktop min: ' + minSize + 'px' : 'touch min: ' + minSize + 'px') + ')',
          detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
          fix: isDesktop
            ? (sev === 'info'
              ? 'Slightly below ' + minSize + 'px desktop minimum — usable with mouse but consider adding padding.'
              : 'Click targets need at least ' + minSize + '×' + minSize + 'px. Increase padding or min-height/min-width.')
            : 'Touch targets need ' + minSize + '×' + minSize + 'px minimum. Add min-h-[' + minSize + 'px] min-w-[' + minSize + 'px] or increase padding.',
          presetRef: isDesktop ? null : 'Button presets use py-3 px-6 (48px height)',
          source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum',
          locator: { selector: t.selector, text: t.text || '', bboxes: t.bbox ? [t.bbox] : [] }
        });
      }
    } else if (minDim < warnSize && isDesktop && !isInlineLink) {
      findings.push({
        severity: 'warning',
        title: t.element + ' is ' + w + '×' + h + 'px (recommended for desktop: ≥' + warnSize + 'px)',
        detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
        fix: 'While ' + minSize + 'px meets minimum, ' + warnSize + 'px+ improves click comfort. Consider adding padding.',
        presetRef: null,
        source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum',
        locator: { selector: t.selector, text: t.text || '' }
      });
    }
  });

  // Also flag targets that pass the current threshold but would fail on touch
  if (isDesktop && targets.length > 0) {
    var touchMin = profile.touchTarget;
    var touchFails = targets.filter(function(t) { return Math.min(t.width, t.height) < touchMin; });
    if (touchFails.length > 0) {
      var allBboxes = touchFails.map(function(t) { return t.bbox; }).filter(Boolean);
      var allSelectors = touchFails.map(function(t) { return t.selector; }).filter(Boolean);
      var allTexts = touchFails.map(function(t) { return t.text || ''; });
      findings.push({
        severity: 'info',
        title: touchFails.length + ' element(s) below ' + touchMin + 'px touch target (analyzed at ' + vw + 'px desktop viewport)',
        detail: 'These meet desktop minimums but would fail on touch devices. Consider responsive sizing if the site is also used on mobile.',
        fix: 'For responsive touch support: add touch-target sizing at mobile breakpoints, e.g. sm:min-h-[' + touchMin + 'px]',
        presetRef: null,
        source: 'Material Design 3 — https://m3.material.io/foundations/layout/applying-layout',
        locator: { selector: '', text: '', bboxes: allBboxes, selectors: allSelectors, texts: allTexts }
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

  // Event listener pattern findings
  var lPatterns = (data.interaction && data.interaction.listenerPatterns) || {};
  if (lPatterns.toggleNoAria > 0) {
    findings.push({
      severity: 'warning',
      title: lPatterns.toggleNoAria + ' toggle handler(s) without ARIA state management',
      detail: 'Click handlers toggle CSS classes but don\'t update aria-expanded or other ARIA states. Screen readers won\'t know the element\'s state changed.',
      fix: 'Add setAttribute(\'aria-expanded\', isOpen) alongside classList.toggle() in toggle handlers.',
      presetRef: null,
      source: 'WCAG 2.2 §4.1.2 — https://www.w3.org/TR/WCAG22/#name-role-value'
    });
  }
  if (lPatterns.navigationInButton > 0) {
    findings.push({
      severity: 'info',
      title: lPatterns.navigationInButton + ' button(s) trigger page navigation',
      detail: 'Buttons with click handlers that change location.href should typically be <a> elements for proper semantics and accessibility.',
      fix: 'Use <a href="..."> for navigation instead of <button> with JavaScript location change.',
      presetRef: null,
      source: 'HTML spec — https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element'
    });
  }

  // Score: deduct per error, less per warning
  var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
  var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
  var totalTargets = targets.length || 0;
  var checks = totalTargets;
  var passed = Math.max(0, totalTargets - errors - warnings);
  var score = Math.max(0, 100 - (errors * 10) - (warnings * 3));
  var na = totalTargets === 0 && transitions.length === 0;
  return { score: na ? 100 : score, findings: findings, checks: checks, passed: passed, weight: 15, label: 'Touch & Interaction', icon: 'touch', notApplicable: na };
}


  S.register("touch", scoreTouchTargets, 15, "Touch & Interaction", "touch");
})();
