// Scoring Module: Layout Quality
// Weight: 5%

(function() {
  "use strict";
  var S = window.MilgScoring;

function scoreLayout(data) {
  var findings = [];
  var checks = 0;
  var passed = 0;
  var layout = data.layout || {};

  // Whitespace rhythm: check if section gaps are consistent
  var gaps = layout.sectionGaps || [];
  if (gaps.length >= 2) {
    checks++;
    var avg = gaps.reduce(function(s, g) { return s + g; }, 0) / gaps.length;
    var variance = gaps.reduce(function(s, g) { return s + Math.pow(g - avg, 2); }, 0) / gaps.length;
    var stdDev = Math.sqrt(variance);
    var cv = avg > 0 ? stdDev / avg : 0; // coefficient of variation
    if (cv < 0.3) {
      passed++;
    } else {
      findings.push({
        severity: cv > 0.6 ? 'warning' : 'info',
        title: 'Inconsistent spacing between sections (CV: ' + Math.round(cv * 100) + '%)',
        detail: 'Gaps range from ' + Math.min.apply(null, gaps) + 'px to ' + Math.max.apply(null, gaps) + 'px (avg ' + Math.round(avg) + 'px)',
        fix: 'Use consistent spacing between major sections. Pick one value (e.g. 64px or 96px) and use it everywhere.',
        presetRef: null
      });
    }
  }

  // Alignment consistency: cluster left edges and find near-misses
  var edges = layout.alignmentEdges || [];
  if (edges.length >= 5) {
    checks++;
    // Cluster edges within 3px
    var clusters = [];
    var sorted = edges.slice().sort(function(a, b) { return a - b; });
    var current = [sorted[0]];
    for (var i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] <= 3) {
        current.push(sorted[i]);
      } else {
        clusters.push(current);
        current = [sorted[i]];
      }
    }
    clusters.push(current);
    // Find near-miss clusters (4-8px apart — probably misaligned)
    var nearMisses = 0;
    for (var i = 1; i < clusters.length; i++) {
      var gap = clusters[i][0] - clusters[i - 1][clusters[i - 1].length - 1];
      if (gap > 3 && gap <= 8) nearMisses++;
    }
    if (nearMisses === 0) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: nearMisses + ' near-miss alignment(s) detected (elements 4-8px off)',
        detail: clusters.length + ' distinct alignment edges found across ' + edges.length + ' elements',
        fix: 'Elements that are almost aligned should be exactly aligned. Check container padding and margin consistency.',
        presetRef: null
      });
    }
  }

  // Visual hierarchy: heading-to-body ratios
  var vh = layout.visualHierarchy || {};
  if (vh.h1ToBody > 0) {
    checks++;
    if (vh.h1ToBody >= 2 && vh.h1ToBody <= 4) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: 'H1 is ' + vh.h1ToBody + 'x body text (ideal: 2-4x)',
        detail: vh.h1ToBody < 2 ? 'H1 doesn\'t stand out enough from body text' : 'H1 may be too large relative to body text',
        fix: 'H1 should be 2-4x the body font size for clear hierarchy. At 16px body, H1 should be 32-64px.',
        presetRef: null
      });
    }
  }

  var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
  return { score: score, findings: findings, weight: 5, label: 'Layout Quality', icon: 'spacing' };
}


  S.register("layout", scoreLayout, 5, "Layout Quality", "spacing");
})();
