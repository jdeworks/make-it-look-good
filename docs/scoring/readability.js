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

    // Coleman-Liau readability index
    var rd = data.readability || {};
    if (rd.totalWords >= 50 && rd.paragraphCount >= 2) {
      checks++;
      // Coleman-Liau: 0.0588 * L - 0.296 * S - 15.8
      // L = avg letters per 100 words, S = avg sentences per 100 words
      var L = (rd.totalChars / rd.totalWords) * 100;
      var sentenceCount = 0;
      (rd.textBlocks || []).forEach(function(b) {
        sentenceCount += (b.text.match(/[.!?]+/g) || []).length;
      });
      var S_val = (sentenceCount / rd.totalWords) * 100;
      var cli = Math.round(0.0588 * L - 0.296 * S_val - 15.8);
      if (cli >= 6 && cli <= 12) {
        passed++;
      } else {
        findings.push({
          severity: cli > 14 ? 'warning' : 'info',
          title: 'Reading level: grade ' + cli + ' (Coleman-Liau Index)',
          detail: cli > 12 ? 'Content may be too complex for a general audience' : 'Content may be overly simple for the target audience',
          fix: cli > 12 ? 'Shorten sentences, use simpler words, break complex ideas into steps. Aim for grade 8-10 for general audiences.' : 'This reading level is appropriate for broad accessibility.',
          presetRef: null,
          source: 'Coleman-Liau Index — https://en.wikipedia.org/wiki/Coleman%E2%80%93Liau_index'
        });
      }
    }

    // Paragraph length audit
    var longParagraphs = (rd.textBlocks || []).filter(function(b) { return b.wordCount > 150; });
    if (longParagraphs.length > 0) {
      findings.push({
        severity: 'warning',
        title: longParagraphs.length + ' paragraph(s) exceed 150 words',
        detail: 'Long paragraphs reduce scanability. Ideal: 40-80 words per paragraph.',
        fix: 'Break long paragraphs into shorter ones. Use subheadings, bullet lists, or callout boxes to chunk content.',
        presetRef: null,
        source: 'NNGroup — https://www.nngroup.com/articles/how-users-read-on-the-web/'
      });
    }

    // List usage for scanability
    if (rd.totalWords >= 100 && !rd.hasLists) {
      findings.push({
        severity: 'info',
        title: 'No lists found in content area',
        detail: 'Lists improve scanability by 47% compared to wall-of-text (NNGroup)',
        fix: 'Convert sequences, features, or steps into <ul>/<ol> lists where appropriate.',
        presetRef: null,
        source: 'NNGroup — https://www.nngroup.com/articles/how-users-read-on-the-web/'
      });
    }

    var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
    return { score: score, findings: findings, weight: 5, label: 'Readability', icon: 'type' };
  }

  S.register("readability", scoreReadability, 5, "Readability", "type");
})();
