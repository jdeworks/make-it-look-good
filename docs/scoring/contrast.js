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

  // Separate uncertain results (1:1 ratio usually means bg couldn't be determined — gradient, SVG, etc.)
  var uncertain = profilePairs.filter(function(p) { return !p.passes && p.ratio <= 1.01 && p.fg === p.bg; });
  var failures = profilePairs.filter(function(p) { return !p.passes && !(p.ratio <= 1.01 && p.fg === p.bg); });
  var nearMisses = profilePairs.filter(function(p) { return p.passes && p.ratio < p.needed + 0.5; });

  failures.forEach(function(p) {
    var apcaVal = '';
    var fgP = parseRgb(p.fg);
    var bgP = parseRgb(p.bg);
    if (fgP && bgP) { apcaVal = ' (APCA: Lc ' + apcaContrast(fgP, bgP) + ')'; }
    findings.push({
      severity: 'error',
      title: 'Text fails contrast ' + p.ratio + ':1 (needs ' + p.needed + ':1)',
      detail: '"' + p.text + '" at ' + p.fontSize + 'px — ' + p.selector + apcaVal,
      fix: p.isLarge
        ? 'Large text needs ' + profile.contrastLarge + ':1 minimum. Darken the text or lighten the background.'
        : 'Normal text needs ' + profile.contrast + ':1 minimum. Use a darker text color or lighter background.',
      presetRef: 'All presets use text-slate-600+ on white backgrounds (8:1+ ratio)',
      source: p.isLarge ? 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum' : 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum'
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

  nearMisses.forEach(function(p) {
    findings.push({
      severity: 'info',
      title: 'Text passes contrast but close to threshold: ' + p.ratio + ':1 (needs ' + p.needed + ':1)',
      detail: '"' + p.text + '" at ' + p.fontSize + 'px — ' + p.selector,
      fix: 'Passes AA but consider increasing for AAA (7:1). Slight changes in background could cause failure.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.6 — https://www.w3.org/TR/WCAG22/#contrast-enhanced'
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

  // Don't count uncertain results as failures in the score
  var total = (profilePairs.length - uncertain.length) || 1;
  var passing = total - failures.length;
  var score = Math.max(0, 100 - (failures.length * 10) - (nearMisses.length * 3));

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
  return { score: score, findings: findings, checks: checks, passed: passed, weight: 20, label: 'Color & Contrast', icon: 'contrast' };
}


  S.register("contrast", scoreContrast, 20, "Color & Contrast", "contrast");
})();
