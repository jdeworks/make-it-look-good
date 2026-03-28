// Scoring Module: Typography
// Weight: 15%

(function() {
  "use strict";
  var S = window.MilgScoring;

function scoreTypography(data) {
  var profile = S.getProfile(data);
  var findings = [];
  var checks = 0;
  var passed = 0;

  // Body font size check against profile minimum
  checks++;
  var bodySize = parseFloat(data.typography.bodyFontSize);
  if (bodySize >= profile.bodyFontMin) {
    passed++;
  } else if (bodySize > 0) {
    findings.push({
      severity: 'error',
      title: 'Body font size is ' + bodySize + 'px (minimum: ' + profile.bodyFontMin + 'px)',
      detail: 'Small body text reduces readability, especially on mobile',
      fix: 'Set body font-size to at least ' + profile.bodyFontMin + 'px. In Tailwind: text-base (16px) or text-lg (18px)',
      presetRef: 'All presets use text-base (16px) or larger for body text', source: 'WCAG 2.2 / NNGroup — https://www.w3.org/TR/WCAG22/#text-spacing'
    });
  }

  // Line height check against profile range
  checks++;
  var bodyLH = data.typography.bodyLineHeight;
  var bodyLHRatio = 0;
  if (bodyLH && bodyLH !== 'normal') {
    bodyLHRatio = parseFloat(bodyLH) / bodySize;
  }
  var lhPassMin = profile.lineHeightMin - 0.05;
  var lhPassMax = profile.lineHeightMax + 0.1;
  if (bodyLHRatio >= lhPassMin && bodyLHRatio <= lhPassMax) {
    passed++;
  } else if (bodyLHRatio > 0) {
    findings.push({
      severity: bodyLHRatio < 1.2 || bodyLHRatio > 2 ? 'error' : 'warning',
      title: 'Body line-height is ' + (Math.round(bodyLHRatio * 100) / 100) + ' (ideal: ' + profile.lineHeightMin + '–' + profile.lineHeightMax + ')',
      detail: bodyLHRatio < profile.lineHeightMin ? 'Text feels cramped and hard to read' : 'Text feels too loose and wastes vertical space',
      fix: bodyLHRatio < profile.lineHeightMin ? 'Increase line-height. In Tailwind: leading-relaxed (1.625) or leading-normal (1.5)' : 'Decrease line-height. In Tailwind: leading-normal (1.5)',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.12 — https://www.w3.org/TR/WCAG22/#text-spacing'
    });
  }

  // Line length (profile-aware: elderly 65, children 55, default 75)
  checks++;
  var maxChars = data.typography.maxLineLength ? data.typography.maxLineLength.chars : 0;
  var lineLimit = profile.maxLineLength || 75;
  if (maxChars > 0 && maxChars <= lineLimit + 5) {
    passed++;
  } else if (maxChars > lineLimit + 5) {
    findings.push({
      severity: maxChars > lineLimit + 25 ? 'error' : 'warning',
      title: 'Line length ~' + maxChars + ' characters (max for this audience: ' + lineLimit + ')',
      detail: lineLimit < 70 ? 'Shorter lines improve readability for this audience.' : 'Long lines make it hard for the eye to track back to the next line.',
      fix: 'Constrain content width with max-w-prose (65ch) or max-w-2xl (672px)',
      presetRef: 'Editorial presets use max-w-prose for reading content',
      source: 'Butterick\'s Practical Typography — https://practicaltypography.com/line-length.html'
    });
  }

  // Heading scale — check if headings have a consistent ratio
  checks++;
  var headings = data.typography.headings || [];
  if (headings.length >= 2) {
    var sizes = headings.map(function(h) { return parseFloat(h.fontSize); }).filter(function(s) { return s > 0; });
    var uniqueSizes = Array.from(new Set(sizes)).sort(function(a, b) { return b - a; });
    if (uniqueSizes.length >= 2) {
      var ratio = uniqueSizes[0] / uniqueSizes[uniqueSizes.length - 1];
      if (ratio >= 1.5 && ratio <= 4) {
        passed++;
      } else {
        findings.push({
          severity: 'warning',
          title: 'Heading scale ratio is ' + (Math.round(ratio * 100) / 100) + ' (ideal: 1.5–3.5)',
          detail: ratio < 1.5 ? 'Headings are too similar in size — weak hierarchy' : 'Heading sizes vary too wildly — use a modular scale',
          fix: 'Use a modular scale (1.200 minor third or 1.250 major third). In Tailwind: text-4xl > text-2xl > text-xl > text-base',
          presetRef: null,
          source: 'Modular type scales — https://typescale.com/'
        });
      }
    } else { passed++; } // Only one heading size — acceptable
  } else { passed++; } // No headings to check

  // Max 2-3 font weights
  checks++;
  var fontWeights = data.typography.fontWeights || [];
  var weightCount = fontWeights.length;
  if (weightCount <= 4) {
    passed++;
  } else {
    findings.push({
      severity: 'warning',
      title: 'Using ' + weightCount + ' font weights (recommended: 2–3)',
      detail: 'Too many weights create visual noise and increase font loading time',
      fix: 'Consolidate to 400 (regular), 500/600 (medium), 700 (bold)',
      presetRef: null,
      source: 'Google Fonts best practices — https://fonts.google.com/knowledge/using_type/choosing_reliable_typefaces'
    });
  }

  // Profile-specific: minimum font weight (e.g., elderly profile forbids light/thin)
  if (profile.fontWeightMin > 0 && fontWeights.length > 0) {
    var lightWeights = fontWeights.filter(function(w) { return parseInt(w) < profile.fontWeightMin; });
    if (lightWeights.length > 0) {
      checks++;
      findings.push({
        severity: 'warning',
        title: 'Font weight(s) ' + lightWeights.join(', ') + ' below minimum ' + profile.fontWeightMin + ' for this audience',
        detail: 'Light and thin font weights reduce readability for users who need higher legibility',
        fix: 'Use font-weight ' + profile.fontWeightMin + ' (regular) or heavier. Avoid font-weight 100–300.',
        presetRef: null,
        source: 'W3C WAI Older Users — https://www.w3.org/WAI/older-users/developing/'
      });
    } else {
      checks++;
      passed++;
    }
  }

  // Letter spacing
  var lsIssues = (data.typography && data.typography.letterSpacingIssues) || 0;
  if (lsIssues > 0) {
    findings.push({
      severity: 'info',
      title: lsIssues + ' element(s) with extreme letter-spacing',
      detail: 'Very tight (< -0.03em) or very loose (> 0.15em) letter spacing reduces readability',
      fix: 'Keep letter-spacing between -0.02em and 0.1em for body text. Tighter spacing is acceptable for large headings.',
      presetRef: null,
      source: 'Butterick\'s Practical Typography — https://practicaltypography.com/letterspacing.html'
    });
  }

  // Paragraph spacing
  var pSpacing = (data.typography && data.typography.paragraphSpacing) || [];
  if (pSpacing.length >= 3) {
    checks++;
    var bodyPx = parseFloat(data.typography.bodyFontSize) || 16;
    var avgSpacing = pSpacing.reduce(function(s,v){return s+v},0) / pSpacing.length;
    var spacingEm = avgSpacing / bodyPx;
    if (spacingEm >= 0.5 && spacingEm <= 1.5) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: 'Paragraph spacing is ' + (Math.round(spacingEm * 100) / 100) + 'em (ideal: 0.75–1em)',
        detail: spacingEm < 0.5 ? 'Paragraphs feel cramped' : 'Paragraph spacing may be too generous',
        fix: 'Set paragraph margin-bottom to 0.75em–1em. In Tailwind: space-y-4 on the container or mb-4 on paragraphs.',
        presetRef: null,
        source: 'Butterick\'s Practical Typography — https://practicaltypography.com/space-between-paragraphs.html'
      });
    }
  }

  // Max 2 typefaces
  checks++;
  var familyCount = (data.typography.fontFamilies || []).length;
  if (familyCount <= 3) {
    passed++;
  } else {
    findings.push({
      severity: 'warning',
      title: 'Using ' + familyCount + ' font families (recommended: max 2)',
      detail: 'Too many typefaces make the design feel inconsistent',
      fix: 'Use 1 sans-serif + 1 serif (or monospace for code). In Tailwind: font-sans + font-serif',
      presetRef: null,
      source: 'Butterick\'s Practical Typography — https://practicaltypography.com/summary-of-key-rules.html'
    });
  }

  var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
  return { score: score, findings: findings, checks: checks, passed: passed, weight: 15, label: 'Typography', icon: 'type' };
}


  S.register("typography", scoreTypography, 15, "Typography", "type");
})();
