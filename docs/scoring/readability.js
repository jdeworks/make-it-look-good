// Scoring Module: Readability & Scanability
// Weight: 5%
// Sources: Coleman-Liau Index, NNGroup scanning research

(function() {
  "use strict";
  var S = window.MilgScoring;

  function scoreReadability(data) {
    var findings = [];
    var checks = 0;
    var passed = 0;

    // Extract text content from the raw data
    // We use heading count and element count as proxies since we don't have raw text in extracted data
    var headings = (data.typography && data.typography.headings) || [];
    var totalElements = (data.structure && data.structure.totalElements) || 0;

    // Scanability: heading frequency
    // Good rule: 1 heading per ~100-150 elements of content
    if (totalElements > 50) {
      checks++;
      var headingRatio = headings.length / (totalElements / 100);
      if (headingRatio >= 0.5 && headingRatio <= 5) {
        passed++;
      } else if (headingRatio < 0.5) {
        findings.push({
          severity: 'warning',
          title: 'Low heading density: ' + headings.length + ' headings for ' + totalElements + ' elements',
          detail: 'Content without headings is harder to scan. 79% of users scan rather than read (NNGroup)',
          fix: 'Add descriptive headings to break content into scannable sections. Aim for a heading every 2-3 paragraphs.',
          presetRef: null,
          source: 'NNGroup scanning research — https://www.nngroup.com/articles/how-users-read-on-the-web/'
        });
      }
    }

    // Heading descriptiveness: check if headings are too short (likely generic)
    if (headings.length > 0) {
      checks++;
      var shortHeadings = headings.filter(function(h) {
        return h.text && h.text.length < 3;
      });
      if (shortHeadings.length === 0) {
        passed++;
      } else {
        findings.push({
          severity: 'info',
          title: shortHeadings.length + ' heading(s) with very short text (< 3 chars)',
          detail: 'Short headings like numbers or icons don\'t help users scan. Use descriptive text.',
          fix: 'Replace generic headings with descriptive ones that summarize the section content.',
          presetRef: null,
          source: 'NNGroup — https://www.nngroup.com/articles/headings-pickup-lines/'
        });
      }
    }

    // Font size variety as readability signal
    // Too many sizes = visual noise, harder to establish reading rhythm
    var fontSizes = (data.typography && data.typography.fontSizes) || [];
    var smallTextCount = fontSizes.filter(function(f) {
      return parseFloat(f.value) < 12;
    }).reduce(function(sum, f) { return sum + f.count; }, 0);

    if (smallTextCount > 0 && totalElements > 20) {
      checks++;
      var smallRatio = smallTextCount / totalElements;
      if (smallRatio < 0.05) {
        passed++;
      } else {
        findings.push({
          severity: 'warning',
          title: smallTextCount + ' element(s) with text smaller than 12px',
          detail: 'Text below 12px is difficult to read for most users and nearly impossible for elderly or low-vision users',
          fix: 'Increase small text to at least 12px. Consider if the information is important enough to display — if not, remove it.',
          presetRef: null,
          source: 'WCAG 2.2 §1.4.4 — https://www.w3.org/TR/WCAG22/#resize-text'
        });
      }
    }

    var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
    return { score: score, findings: findings, weight: 5, label: 'Readability', icon: 'type' };
  }

  S.register("readability", scoreReadability, 5, "Readability", "type");
})();
