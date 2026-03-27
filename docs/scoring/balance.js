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

      // Count elements in left half vs right half
      var leftCount = 0;
      var rightCount = 0;
      var midpoint = vw / 2;

      edges.forEach(function(edge) {
        if (edge < midpoint) leftCount++;
        else rightCount++;
      });

      var total = leftCount + rightCount;
      var ratio = total > 0 ? Math.max(leftCount, rightCount) / Math.min(leftCount || 1, rightCount || 1) : 1;

      if (ratio <= 2) {
        passed++;
      } else if (ratio <= 3) {
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
          severity: 'warning',
          title: 'Content heavily weighted to one side (' + Math.round(leftCount / total * 100) + '% / ' + Math.round(rightCount / total * 100) + '%)',
          detail: 'Strong left-right imbalance can feel visually unstable unless intentional',
          fix: 'Consider centering the main content or balancing sections with complementary elements on the lighter side.',
          presetRef: null,
          source: 'Ngo et al. 2003 — Visual balance and aesthetic preference'
        });
      }
    }

    var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
    return { score: score, findings: findings, weight: 3, label: 'Visual Balance', icon: 'consistency' };
  }

  S.register("balance", scoreBalance, 3, "Visual Balance", "consistency");
})();
