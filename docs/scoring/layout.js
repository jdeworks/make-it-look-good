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
        presetRef: null,
        source: 'Gestalt similarity — https://lawsofux.com/law-of-similarity/'
      });
    }
  }

  // Alignment consistency: cluster left edges and find near-misses ("jagged" alignment)
  var edges = layout.alignmentEdges || [];
  if (edges.length >= 5) {
    checks++;
    // Cluster edges within 3px (considered aligned)
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
    // Find near-miss clusters (4-12px apart — elements on same axis but jagged)
    var nearMisses = 0;
    var jaggedExamples = [];
    for (var i = 1; i < clusters.length; i++) {
      var prevAvg = Math.round(clusters[i - 1].reduce(function(s,v){return s+v},0) / clusters[i - 1].length);
      var currAvg = Math.round(clusters[i].reduce(function(s,v){return s+v},0) / clusters[i].length);
      var gap = currAvg - prevAvg;
      if (gap > 3 && gap <= 12) {
        nearMisses++;
        jaggedExamples.push(prevAvg + 'px → ' + currAvg + 'px (' + gap + 'px off)');
      }
    }
    // Also check how many unique clusters there are relative to element count
    var clusterRatio = clusters.length / edges.length;
    if (nearMisses === 0 && clusterRatio < 0.5) {
      passed++;
    } else if (nearMisses > 0) {
      findings.push({
        severity: nearMisses >= 3 ? 'warning' : 'info',
        title: nearMisses + ' jagged alignment(s) — elements on same axis but ' + (nearMisses >= 3 ? 'noticeably' : 'slightly') + ' off',
        detail: clusters.length + ' alignment edges across ' + edges.length + ' elements. ' + (jaggedExamples.length > 0 ? 'Offsets: ' + jaggedExamples.slice(0, 3).join(', ') : ''),
        fix: 'Elements that share a visual axis should be exactly aligned. Check that container padding, margin, and grid column widths are consistent. In Tailwind: use consistent px-4/px-6 and grid/flex alignment.',
        presetRef: null,
        source: 'Gestalt continuity — https://lawsofux.com/law-of-common-region/'
      });
    } else if (clusterRatio >= 0.5) {
      findings.push({
        severity: 'info',
        title: 'Weak alignment grid — ' + clusters.length + ' distinct left edges across ' + edges.length + ' elements',
        detail: 'A well-aligned layout typically has 2-4 dominant alignment edges. High variance suggests inconsistent margins/padding.',
        fix: 'Establish a consistent alignment grid. Use the same container padding and let content flow within columns.',
        presetRef: null,
        source: 'Gestalt continuity — https://lawsofux.com/law-of-common-region/'
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
        presetRef: null,
        source: 'Modular type scales — https://typescale.com/'
      });
    }
  }

  var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
  return { score: score, findings: findings, weight: 5, label: 'Layout Quality', icon: 'spacing' };
}


  S.register("layout", scoreLayout, 5, "Layout Quality", "spacing");
})();
