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
      presetRef: null
    });
  }

  // Line length 45-75 characters
  checks++;
  var maxChars = data.typography.maxLineLength ? data.typography.maxLineLength.chars : 0;
  if (maxChars > 0 && maxChars <= 80) {
    passed++;
  } else if (maxChars > 80) {
    findings.push({
      severity: maxChars > 100 ? 'error' : 'warning',
      title: 'Line length ~' + maxChars + ' characters (ideal: 45–75)',
      detail: 'Long lines make it hard for the eye to track back to the next line',
      fix: 'Constrain content width with max-w-prose (65ch) or max-w-2xl (672px)',
      presetRef: 'Editorial presets use max-w-prose for reading content'
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
          presetRef: null
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
      presetRef: null
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
        presetRef: null
      });
    } else {
      checks++;
      passed++;
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
      presetRef: null
    });
  }

  var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
  return { score: score, findings: findings, weight: 15, label: 'Typography', icon: 'type' };
}


  S.register("typography", scoreTypography, 15, "Typography", "type");
})();
