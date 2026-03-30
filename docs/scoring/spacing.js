// Scoring Module: Spacing & Layout
// Weight: 15%

(function() {
  "use strict";
  var S = window.MilgScoring;

function scoreSpacing(data) {
  var profile = S.getProfile(data);
  var findings = [];
  var checks = 0;
  var passed = 0;

  // 4px grid adherence — check if spacing values are multiples of 4
  checks++;
  var allSpacing = [].concat(data.spacing.paddings || [], data.spacing.margins || [], data.spacing.gaps || []);
  var onGrid = 0;
  var offGrid = 0;
  allSpacing.forEach(function(s) {
    var px = parseFloat(s.value);
    if (isNaN(px) || px === 0) return;
    if (Math.round(px) % 4 === 0) onGrid += s.count;
    else offGrid += s.count;
  });
  var gridRatio = (onGrid + offGrid) > 0 ? onGrid / (onGrid + offGrid) : 1;
  if (gridRatio >= 0.7) {
    passed++;
    if (gridRatio < 0.85) {
      findings.push({
        severity: 'info',
        title: Math.round(gridRatio * 100) + '% of spacing values on 4px grid',
        detail: 'Good adherence — a few values could be rounded to the nearest 4px increment',
        fix: 'Use Tailwind spacing utilities (p-1=4px, p-2=8px, p-3=12px, p-4=16px, ...)',
        presetRef: null
      });
    }
  } else {
    findings.push({
      severity: 'warning',
      title: 'Only ' + Math.round(gridRatio * 100) + '% of spacing is on a 4px grid',
      detail: 'Inconsistent spacing makes layouts feel unpolished',
      fix: 'Align spacing to 4px increments: 4, 8, 12, 16, 24, 32, 48, 64px',
      presetRef: 'All presets use Tailwind spacing scale (4px base unit)', source: 'Material Design spacing — https://m3.material.io/foundations/layout/applying-layout'
    });
  }

  // Content max-width
  checks++;
  var maxW = parseFloat(data.spacing.maxContentWidth);
  if (maxW > 0 && maxW <= 1500) {
    passed++;
  } else if (maxW > 1500) {
    findings.push({
      severity: 'warning',
      title: 'Content width is ' + Math.round(maxW) + 'px (recommended: 1200–1440px)',
      detail: 'Very wide content is harder to scan and looks stretched on large monitors',
      fix: 'Add a max-width container. In Tailwind: max-w-7xl (1280px) or max-w-screen-xl',
      presetRef: 'Dashboard presets use max-w-7xl containers',
      source: 'NNGroup — https://www.nngroup.com/articles/utilize-available-screen-space/'
    });
  } else {
    passed++; // No max width data or narrow — fine
  }

  // Mobile padding >= 16px
  checks++;
  var bodyPad = parseFloat(data.spacing.bodyPaddingHorizontal);
  if (bodyPad >= 14 || isNaN(bodyPad) || bodyPad === 0) {
    passed++; // 0 is OK if inner containers have padding
  } else {
    findings.push({
      severity: 'warning',
      title: 'Body horizontal padding is ' + bodyPad + 'px (minimum: 16px)',
      detail: 'Content touching screen edges feels cramped on mobile',
      fix: 'Add px-4 (16px) padding to the body or main container',
      presetRef: null,
      source: 'Material Design 3 — https://m3.material.io/foundations/layout/applying-layout'
    });
  }

  // Adjacent interactive element spacing (buttons/links too close together)
  var adjacentIssues = (data.interaction && data.interaction.adjacentIssues) || [];
  if (adjacentIssues.length > 0) {
    checks++;
    var minSpacing = profile.targetSpacing;
    var touching = adjacentIssues.filter(function(a) { return a.gap < 2; });
    var tooClose = adjacentIssues.filter(function(a) { return a.gap >= 2 && a.gap < minSpacing; });

    touching.forEach(function(a) {
      var labelA = a.textA || a.selectorA || '?';
      var labelB = a.textB || a.selectorB || '?';
      var selectorHint = (a.selectorA || a.selectorB) ? ' — ' + (a.selectorA || '') : '';
      findings.push({
        severity: 'error',
        title: 'Interactive elements touching (' + a.gap + 'px gap)',
        detail: labelA + ' and ' + labelB + ' (' + a.direction + ')' + selectorHint,
        fix: 'Add at least ' + minSpacing + 'px gap between interactive elements. In Tailwind: gap-' + (minSpacing / 4) + ' on the parent flex/grid container.',
        presetRef: 'Button presets use gap-2 (8px) or gap-3 (12px) between buttons',
        source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum',
        locator: { selector: a.selectorA || a.selectorB || '', text: a.textA || '' }
      });
    });

    tooClose.forEach(function(a) {
      var labelA = a.textA || a.selectorA || '?';
      var labelB = a.textB || a.selectorB || '?';
      var selectorHint = (a.selectorA || a.selectorB) ? ' — ' + (a.selectorA || '') : '';
      findings.push({
        severity: 'warning',
        title: 'Interactive elements only ' + a.gap + 'px apart (recommended: ≥' + minSpacing + 'px)',
        detail: labelA + ' and ' + labelB + ' (' + a.direction + ')' + selectorHint,
        fix: 'Increase gap to at least ' + minSpacing + 'px to prevent mis-taps. In Tailwind: gap-' + (minSpacing / 4) + ' on the parent.',
        presetRef: null,
        source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum',
        locator: { selector: a.selectorA || a.selectorB || '', text: a.textA || '' }
      });
    });

    if (touching.length === 0 && tooClose.length === 0) passed++;
  }

  // Element overflow
  var overflows = (data.layout && data.layout.overflowElements) || 0;
  if (overflows > 0) {
    checks++;
    findings.push({
      severity: overflows > 5 ? 'warning' : 'info',
      title: overflows + ' element(s) with horizontal overflow',
      detail: 'Content extends beyond its container, causing horizontal scroll or clipping',
      fix: 'Add overflow-x: hidden or overflow: auto to the container element. Check for fixed-width children inside flexible containers.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow'
    });
  } else {
    checks++;
    passed++;
  }

  // Negative margins
  var negMargins = (data.spacing && data.spacing.negativeMargins) || 0;
  if (negMargins > 5) {
    findings.push({
      severity: 'info',
      title: negMargins + ' element(s) use negative margins',
      detail: 'Negative margins can cause overlapping content and layout fragility',
      fix: 'Consider using CSS grid/flexbox gap, transform, or absolute positioning instead of negative margins where possible.',
      presetRef: null,
      source: 'CSS best practices'
    });
  }

  // Container padding consistency
  var cPaddings = (data.spacing && data.spacing.containerPaddings) || [];
  if (cPaddings.length >= 4) {
    findings.push({
      severity: 'info',
      title: cPaddings.length + ' distinct container padding values',
      detail: 'Values: ' + cPaddings.slice(0, 5).map(function(p) { return p.value + ' (' + p.count + 'x)'; }).join(', '),
      fix: 'Standardize container padding to 2-3 values. In Tailwind: p-4 (16px), p-6 (24px), p-8 (32px).',
      presetRef: null,
      source: 'Gestalt proximity — https://lawsofux.com/law-of-proximity/'
    });
  }

  var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
  var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
  var score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
  return { score: score, findings: findings, checks: checks, passed: passed, weight: 15, label: 'Spacing & Layout', icon: 'spacing' };
}


  S.register("spacing", scoreSpacing, 15, "Spacing & Layout", "spacing");
})();
