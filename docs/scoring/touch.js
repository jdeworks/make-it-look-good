// Scoring Module: Touch & Interaction
// Weight: 15%

(function() {
  "use strict";
  var S = window.MilgScoring;

function scoreTouchTargets(data) {
  var profile = S.getProfile(data);
  var findings = [];
  var targets = data.interaction.touchTargets || [];

  // WCAG 2.2 AA target size is 24x24 CSS px. Larger 44px targets are
  // platform/AAA comfort guidance, and only strict profiles make them hard
  // requirements.
  var vw = (data.meta && data.meta.viewportWidth) || 1280;
  var isDesktop = vw >= 1024;
  var strictProfile = data.profile === 'elderly' || data.profile === 'low_vision' || data.profile === 'motor_impairment' || data.profile === 'children';
  var aaMin = 24;
  var minSize = strictProfile ? (isDesktop ? profile.touchTargetDesktop : profile.touchTarget) : aaMin;
  var comfortSize = isDesktop ? (profile.touchTargetDesktopWarn || 32) : (profile.touchTarget || 44);
  var context = isDesktop ? 'desktop' : 'touch/mobile';
  var issueCount = 0;

  targets.forEach(function(t) {
    var w = t.width, h = t.height;
    var minDim = Math.min(w, h);

    var isInlineLink = t.element === 'a' && !t.isButton;
    var isControl = t.isButton || t.element !== 'a' || t.linkContext === 'nav';
    var isPlainDesktopLink = isDesktop && t.element === 'a' && !t.isButton && t.linkContext !== 'nav';
    if (isInlineLink || t.linkContext === 'inline') return;

    if (minDim < minSize) {
      issueCount++;
      var ctx = t.linkContext || 'button';

      function desktopSeverity(dim) {
        if (!isDesktop) return 'error';
        if (dim >= 20) return 'warning';
        if (dim >= 16) return 'warning';
        return 'error';
      }

      if (ctx === 'footer') {
        // Footer links — relaxed but still error below hard minimum (16px)
        var footerHardMin = 24;
        findings.push({
          severity: minDim < footerHardMin ? 'error' : 'info',
          title: 'Footer link ' + w + '×' + h + 'px' + (minDim < footerHardMin ? ' (below WCAG AA 24px)' : ' (below comfort size)'),
          detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
          fix: minDim < footerHardMin
            ? 'Footer links need at least 24px target size unless an exception applies. Add padding to increase click area.'
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
          title: t.element + ' is ' + w + '×' + h + 'px (WCAG AA min: ' + minSize + 'px)',
          detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
          fix: isDesktop
            ? (sev === 'info'
              ? 'Slightly below the 24px WCAG AA target size. Consider adding padding.'
              : 'Click targets need at least 24×24px unless an exception applies. Increase padding or min-height/min-width.')
            : 'Touch targets need at least 24×24px for WCAG AA. Add padding or min-height/min-width.',
          presetRef: isDesktop ? null : 'Button presets use py-3 px-6 (48px height)',
          source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum',
          locator: { selector: t.selector, text: t.text || '', bboxes: t.bbox ? [t.bbox] : [] }
        });
      }
    } else if (minDim < comfortSize && isControl && !isPlainDesktopLink) {
      findings.push({
        severity: strictProfile ? 'warning' : 'info',
        title: t.element + ' is ' + w + '×' + h + 'px (comfort target: ≥' + comfortSize + 'px)',
        detail: (t.text ? '"' + t.text + '" — ' : '') + t.selector,
        fix: 'This meets WCAG AA 24px minimum. Use a larger target for touch comfort or strict accessibility profiles.',
        presetRef: null,
        source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum',
        locator: { selector: t.selector, text: t.text || '' }
      });
    }
  });

  // Also note controls that meet WCAG AA but fall short of larger touch comfort
  // guidance when analyzed at a desktop viewport.
  if (isDesktop && targets.length > 0) {
    var touchMin = profile.touchTarget || 44;
    var touchFails = targets.filter(function(t) {
      var d = Math.min(t.width, t.height);
      return t.linkContext !== 'inline' && d >= minSize && d < touchMin && (t.isButton || t.element !== 'a' || t.linkContext === 'nav');
    });
    if (touchFails.length > 0) {
      var allBboxes = touchFails.map(function(t) { return t.bbox; }).filter(Boolean);
      var allSelectors = touchFails.map(function(t) { return t.selector; }).filter(Boolean);
      var allTexts = touchFails.map(function(t) { return t.text || ''; });
      findings.push({
        severity: 'info',
        title: touchFails.length + ' element(s) below ' + touchMin + 'px comfort target (analyzed at ' + vw + 'px desktop viewport)',
        detail: 'These meet the WCAG AA 24px minimum but are below larger platform touch guidance. Consider responsive sizing if the site is also used on mobile.',
        fix: 'For responsive touch comfort: add larger mobile target sizing, e.g. sm:min-h-[' + touchMin + 'px]',
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
