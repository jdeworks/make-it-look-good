// Scoring Module: Visual Weight Balance
// Weight: 3%
// Source: Ngo et al. 2003 — balance correlates with preference (r=0.67)

(function() {
  "use strict";
  var S = window.MilgScoring;

  function scoreBalance(data) {
    var findings = [];
    var checks = 0;
    var passed = 0;

    // We use alignment edges as a proxy for content distribution
    var edges = (data.layout && data.layout.alignmentEdges) || [];
    var vw = (data.meta && data.meta.viewportWidth) || 1280;

    if (edges.length >= 10) {
      checks++;

      // Estimate content center points from left edges:
      // For each left-edge, estimate center as edge + avgWidth/2
      // where avgWidth is derived from the spread of edges
      var sortedEdges = edges.slice().sort(function(a, b) { return a - b; });
      var minEdge = sortedEdges[0];
      var maxEdge = sortedEdges[sortedEdges.length - 1];
      // Estimate average element width from the content span
      var contentSpan = maxEdge - minEdge;
      var estWidth = contentSpan > 0 ? Math.min(contentSpan / 2, vw * 0.4) : vw * 0.3;

      var leftCount = 0;
      var rightCount = 0;
      var midpoint = vw / 2;

      edges.forEach(function(edge) {
        // Use estimated center of element, not left edge
        var center = edge + estWidth / 2;
        if (center < midpoint) leftCount++;
        else rightCount++;
      });

      var total = leftCount + rightCount;
      var ratio = total > 0 ? Math.max(leftCount, rightCount) / Math.min(leftCount || 1, rightCount || 1) : 1;

      if (ratio <= 2) {
        passed++;
      } else if (ratio <= 3) {
        passed++; // Info findings don't reduce score
        findings.push({
          severity: 'info',
          title: 'Content distribution is ' + Math.round(leftCount / total * 100) + '% left / ' + Math.round(rightCount / total * 100) + '% right',
          detail: 'Moderate imbalance — may be intentional (sidebar layout) or indicate uneven content distribution',
          fix: 'If using a sidebar layout, this is expected. Otherwise, distribute content more evenly or use a centered layout.',
          presetRef: null,
          source: 'Ngo et al. 2003 — Visual balance and aesthetic preference'
        });
      } else {
        findings.push({
          severity: 'info',
          title: 'Content heavily weighted to one side (' + Math.round(leftCount / total * 100) + '% / ' + Math.round(rightCount / total * 100) + '%)',
          detail: 'Strong left-right imbalance — often intentional in sidebar or marketing layouts',
          fix: 'If using a sidebar or asymmetric layout, this is expected. Otherwise, distribute content more evenly.',
          presetRef: null,
          source: 'Ngo et al. 2003 — Visual balance and aesthetic preference'
        });
      }
    }

    // Content centering: is the primary content centered or justified?
    if (edges.length >= 5) {
      checks++;
      var meanEdge = edges.reduce(function(s,v){return s+v},0) / edges.length;
      var centered = Math.abs(meanEdge - vw * 0.1) < vw * 0.15; // within 15% of typical left margin
      if (centered || meanEdge > 10) {
        passed++;
      } else {
        findings.push({
          severity: 'info',
          title: 'Content appears flush to the left edge (mean position: ' + Math.round(meanEdge) + 'px)',
          detail: 'Content without proper margins can feel unbalanced.',
          fix: 'Add container padding or centering. In Tailwind: mx-auto px-4.',
          source: 'Gestalt proximity — https://lawsofux.com/law-of-proximity/'
        });
      }
    }

    // Vertical rhythm: check if section gaps are present
    var sectionGaps = (data.layout && data.layout.sectionGaps) || [];
    if (sectionGaps.length >= 2) {
      checks++;
      var minGap = Math.min.apply(null, sectionGaps);
      var maxGap = Math.max.apply(null, sectionGaps);
      if (minGap >= 16 && maxGap / (minGap || 1) <= 3) {
        passed++;
      } else if (minGap < 4) {
        findings.push({
          severity: 'info',
          title: 'Sections have very tight spacing (minimum gap: ' + minGap + 'px)',
          detail: 'Sections need breathing room. Tight spacing makes content feel cramped.',
          fix: 'Use consistent section spacing: 48-96px between major sections.',
          source: 'Gestalt similarity — https://lawsofux.com/law-of-similarity/'
        });
      } else {
        passed++;
      }
    }

    var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
    var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
    var score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
    return { score: score, findings: findings, checks: checks, passed: passed, weight: 3, label: 'Visual Balance', icon: 'consistency' };
  }

  S.register("balance", scoreBalance, 3, "Visual Balance", "consistency");
})();
