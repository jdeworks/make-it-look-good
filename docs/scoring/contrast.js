// Scoring Module: Color & Contrast
// Weight: 20%

(function() {
  "use strict";
  var S = window.MilgScoring;

function parseRgb(str) {
  var m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) m = str.match(/rgb\((\d+)\s+(\d+)\s+(\d+)\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function applyFilterToColor(c, filterStr) {
  if (!c || !filterStr) return c;
  var r = c.r, g = c.g, b = c.b;
  var re = /brightness\(([\d.]+)\)|contrast\(([\d.]+)\)|opacity\(([\d.]+)\)/g;
  var m;
  while ((m = re.exec(filterStr)) !== null) {
    if (m[1] !== undefined) {
      var br = parseFloat(m[1]);
      r = Math.min(255, Math.round(r * br));
      g = Math.min(255, Math.round(g * br));
      b = Math.min(255, Math.round(b * br));
    } else if (m[2] !== undefined) {
      var ct = parseFloat(m[2]);
      r = Math.min(255, Math.max(0, Math.round(((r - 128) * ct) + 128)));
      g = Math.min(255, Math.max(0, Math.round(((g - 128) * ct) + 128)));
      b = Math.min(255, Math.max(0, Math.round(((b - 128) * ct) + 128)));
    }
    // opacity affects alpha, not RGB channels for contrast purposes
  }
  return { r: r, g: g, b: b };
}

function luminance(c) {
  var rs = c.r / 255, gs = c.g / 255, bs = c.b / 255;
  var r = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  var g = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  var b = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(c1, c2) {
  var l1 = luminance(c1), l2 = luminance(c2);
  return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
}

// APCA contrast (Lc value)
// Simplified APCA-W3 calculation
function sRGBtoY(rgb) {
  // Linearize sRGB
  function lin(v) { v = v / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return 0.2126729 * lin(rgb.r) + 0.7151522 * lin(rgb.g) + 0.0721750 * lin(rgb.b);
}

function apcaContrast(txtRgb, bgRgb) {
  var txtY = sRGBtoY(txtRgb);
  var bgY = sRGBtoY(bgRgb);
  // Clamp
  if (txtY < 0) txtY = 0;
  if (bgY < 0) bgY = 0;
  // SAPC power curve
  var normBG = Math.pow(bgY, 0.56);
  var normTXT = Math.pow(txtY, 0.57);
  var rawContrast;
  if (bgY > txtY) {
    rawContrast = (normBG - normTXT) * 1.14;
  } else {
    rawContrast = (normBG - normTXT) * 1.14;
  }
  // Scale and clamp
  if (Math.abs(rawContrast) < 0.1) return 0;
  return Math.round(rawContrast * 100);
}

function scoreContrast(data) {
  var profile = S.getProfile(data);
  var findings = [];
  var pairs = data.colors.contrastPairs || [];

  // Re-evaluate each pair against profile thresholds
  var profilePairs = pairs.map(function(p) {
    var needed = p.isLarge ? profile.contrastLarge : profile.contrast;
    var ratio = p.ratio;

    // If a CSS filter is present, re-compute contrast with adjusted bg
    if (p.filter) {
      var bgParsed = parseRgb(p.bg);
      if (bgParsed) {
        var adjustedBg = applyFilterToColor(bgParsed, p.filter);
        var fgParsed = parseRgb(p.fg);
        if (fgParsed) {
          ratio = contrastRatio(fgParsed, adjustedBg);
        }
      }
    }

    var passes = ratio >= needed;
    return { ratio: ratio, needed: needed, passes: passes, isLarge: p.isLarge, text: p.text, fontSize: p.fontSize, selector: p.selector, fg: p.fg, bg: p.bg, filter: p.filter || '' };
  });

  // Separate uncertain results (very low ratio usually means bg couldn't be determined — gradient, SVG, image, etc.)
  // Cases: fg===bg (exact 1:1), or ratio < 1.5 with light text on light bg (white text on gradient that resolved to white)
  function isUncertain(p) {
    if (p.passes) return false;
    if (p.ratio <= 1.01 && p.fg === p.bg) return true;
    // Very low ratio with light fg+bg suggests unresolved gradient background
    if (p.ratio < 1.5) {
      var fgC = parseRgb(p.fg);
      var bgC = parseRgb(p.bg);
      if (fgC && bgC) {
        var fgBright = (fgC.r + fgC.g + fgC.b) / 3;
        var bgBright = (bgC.r + bgC.g + bgC.b) / 3;
        // Both very light (white text on resolved-to-white bg) or both very dark
        if ((fgBright > 200 && bgBright > 200) || (fgBright < 55 && bgBright < 55)) return true;
      }
    }
    return false;
  }
  var uncertain = profilePairs.filter(function(p) { return isUncertain(p); });
  var failures = profilePairs.filter(function(p) { return !p.passes && !isUncertain(p); });
  var nearMisses = profilePairs.filter(function(p) { return p.passes && p.ratio < p.needed + 0.5; });

  // Deduplicate failures with identical ratio + selector
  var failSeen = {};
  failures.forEach(function(p) {
    var dedup = p.ratio + '|' + p.selector;
    if (failSeen[dedup]) { failSeen[dedup].count++; return; }
    failSeen[dedup] = { p: p, count: 1 };
  });
  Object.keys(failSeen).forEach(function(key) {
    var entry = failSeen[key];
    var p = entry.p;
    var apcaVal = '';
    var fgP = parseRgb(p.fg);
    var bgP = parseRgb(p.bg);
    if (fgP && bgP) { apcaVal = ' (APCA: Lc ' + apcaContrast(fgP, bgP) + ')'; }
    var countNote = entry.count > 1 ? ' (' + entry.count + ' instances)' : '';
    // Detect if the bg is likely white fallback (image/gradient bg we couldn't resolve)
    var bgIsWhite = p.bg === 'rgb(255, 255, 255)' || p.bg === 'rgba(255, 255, 255, 1)';
    var bgNote = bgIsWhite ? ' The detected background is white — if the actual background is an image or gradient, the real contrast may differ.' : '';
    findings.push({
      severity: 'error',
      title: 'Text fails contrast ' + p.ratio + ':1 (needs ' + p.needed + ':1)' + countNote,
      detail: '"' + p.text + '" at ' + p.fontSize + 'px — ' + p.selector + apcaVal,
      fix: (p.isLarge
        ? 'Large text needs ' + profile.contrastLarge + ':1 minimum. Darken the text or lighten the background.'
        : 'Normal text needs ' + profile.contrast + ':1 minimum. Use a darker text color or lighter background.') + bgNote,
      presetRef: null,
      source: p.isLarge ? 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum' : 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum',
      locator: { selector: p.selector, text: p.text }
    });
  });

  if (uncertain.length > 0) {
    findings.push({
      severity: 'info',
      title: uncertain.length + ' element(s) with undetermined contrast (background could not be resolved)',
      detail: 'These elements may use gradients, images, SVGs, or complex CSS that the analyzer cannot parse. Check manually: ' + uncertain.slice(0, 3).map(function(p) { return '"' + p.text + '"'; }).join(', '),
      fix: 'Verify these elements have sufficient contrast visually. The analyzer reports 1:1 when the effective background cannot be computed.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum'
    });
  }

  // Deduplicate near-misses with identical ratio + selector
  var nearSeen = {};
  nearMisses.forEach(function(p) {
    var dedup = p.ratio + '|' + p.selector;
    if (nearSeen[dedup]) { nearSeen[dedup].count++; return; }
    nearSeen[dedup] = { p: p, count: 1 };
  });
  Object.keys(nearSeen).forEach(function(key) {
    var entry = nearSeen[key];
    var p = entry.p;
    var countNote = entry.count > 1 ? ' (' + entry.count + ' instances)' : '';
    findings.push({
      severity: 'info',
      title: 'Text passes contrast but close to threshold: ' + p.ratio + ':1 (needs ' + p.needed + ':1)' + countNote,
      detail: '"' + p.text + '" at ' + p.fontSize + 'px — ' + p.selector,
      fix: 'Passes AA but consider increasing for AAA (7:1). Slight changes in background could cause failure.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.6 — https://www.w3.org/TR/WCAG22/#contrast-enhanced',
      locator: { selector: p.selector, text: p.text }
    });
  });

  // CVD palette safety check (color_blind profile)
  if (profile.checkCVD && pairs.length > 0) {
    var uniqueColors = {};
    pairs.forEach(function(p) {
      if (p.fg) uniqueColors[p.fg] = true;
      if (p.bg) uniqueColors[p.bg] = true;
    });
    var colorList = Object.keys(uniqueColors).map(function(c) { return parseRgb(c); }).filter(Boolean);
    var cvdTypes = ['protanopia', 'deuteranopia', 'tritanopia'];
    var cvdIssues = {};
    cvdTypes.forEach(function(type) { cvdIssues[type] = 0; });

    // Check all color pairs through CVD simulation
    for (var ci = 0; ci < colorList.length && ci < 20; ci++) {
      for (var cj = ci + 1; cj < colorList.length && cj < 20; cj++) {
        var origRatio = contrastRatio(colorList[ci], colorList[cj]);
        if (origRatio < 2) continue; // Skip colors already too similar
        cvdTypes.forEach(function(type) {
          var matrix = S.CVD_MATRICES[type];
          var simA = S.simulateCVD(colorList[ci], matrix);
          var simB = S.simulateCVD(colorList[cj], matrix);
          var simRatio = contrastRatio(simA, simB);
          if (simRatio < 1.5 && origRatio >= 2) cvdIssues[type]++;
        });
      }
    }

    var totalCvdIssues = cvdIssues.protanopia + cvdIssues.deuteranopia + cvdIssues.tritanopia;
    if (totalCvdIssues > 0) {
      var cvdDetails = cvdTypes.filter(function(t) { return cvdIssues[t] > 0; }).map(function(t) { return t + ': ' + cvdIssues[t] + ' pair(s)'; }).join(', ');
      findings.push({
        severity: totalCvdIssues > 3 ? 'error' : 'warning',
        title: totalCvdIssues + ' color pair(s) become indistinguishable under color vision deficiency',
        detail: cvdDetails + '. These colors look distinct to typical vision but collapse for ~8% of men.',
        fix: 'Add non-color indicators (icons, patterns, text labels) alongside color. Avoid red-green as the only differentiator.',
        source: 'WCAG 2.2 §1.4.1 — https://www.w3.org/TR/WCAG22/#use-of-color'
      });
    } else if (colorList.length >= 3) {
      findings.push({
        severity: 'info',
        title: 'Color palette passes CVD simulation (' + colorList.length + ' colors checked)',
        detail: 'All color pairs remain distinguishable under protanopia, deuteranopia, and tritanopia simulation.',
        fix: 'No action needed. This palette is CVD-safe.',
        source: 'Machado et al. 2009 — https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html'
      });
    }
  }

  // Backdrop-filter + translucent backgrounds — contrast ratio may be unreliable
  var backdropPairs = profilePairs.filter(function(p) { return p.backdropFilter && p.minBgAlpha < 0.7; });
  if (backdropPairs.length > 0) {
    var bdSamples = backdropPairs.slice(0, 3).map(function(p) {
      return '"' + p.text + '" (bg alpha: ' + p.minBgAlpha + ')';
    });
    findings.push({
      severity: 'warning',
      title: backdropPairs.length + ' text element(s) on translucent backdrop-filter surfaces',
      detail: 'These elements sit on semi-transparent backgrounds with backdrop-filter (frosted glass effect). The computed contrast ratio assumes the blended background color, but the actual perceived contrast depends on what is visible through the translucent surface, which varies across the page. Elements: ' + bdSamples.join('; '),
      fix: 'Increase background opacity to at least 0.75 for text containers, or add a solid fallback background. For frosted glass effects, use a minimum alpha of 0.7-0.8 to ensure text remains readable regardless of what shows through.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum'
    });
  }

  // Don't count uncertain results as failures in the score
  var total = (profilePairs.length - uncertain.length) || 1;
  var passing = total - failures.length;
  // Scale deduction by total pairs: more pairs = less impact per failure (large pages shouldn't be punished more)
  var failPenalty = total > 10 ? Math.max(3, Math.round(100 / total)) : 10;
  var score = Math.max(0, 100 - (failures.length * failPenalty) - (nearMisses.length * 1));

  // Add baseline checks
  var checks = Math.max(total, 1);
  var passed = Math.max(passing, 0);
  // Text existence check
  if (pairs.length === 0 && (data.structure && data.structure.totalElements > 20)) {
    findings.push({
      severity: 'info',
      title: 'No text contrast pairs found to check',
      detail: 'The page may use images for text, or text may not be visible at scan time.',
      fix: 'Ensure text is rendered as real HTML text, not embedded in images.',
      source: 'WCAG 2.2 §1.4.5 — https://www.w3.org/TR/WCAG22/#images-of-text'
    });
  }
  var na = pairs.length === 0;
  return { score: score, findings: findings, checks: checks, passed: passed, weight: 20, label: 'Color & Contrast', icon: 'contrast', notApplicable: na };
}


  S.register("contrast", scoreContrast, 20, "Color & Contrast", "contrast");
})();
