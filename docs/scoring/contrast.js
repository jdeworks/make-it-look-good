// Scoring Module: Color & Contrast
// Weight: 20%

(function() {
  "use strict";
  var S = window.MilgScoring;

function scoreContrast(data) {
  var profile = S.getProfile(data);
  var findings = [];
  var pairs = data.colors.contrastPairs || [];

  // Re-evaluate each pair against profile thresholds
  var profilePairs = pairs.map(function(p) {
    var needed = p.isLarge ? profile.contrastLarge : profile.contrast;
    var passes = p.ratio >= needed;
    return { ratio: p.ratio, needed: needed, passes: passes, isLarge: p.isLarge, text: p.text, fontSize: p.fontSize, selector: p.selector, fg: p.fg, bg: p.bg };
  });

  // Separate uncertain results (1:1 ratio usually means bg couldn't be determined — gradient, SVG, etc.)
  var uncertain = profilePairs.filter(function(p) { return !p.passes && p.ratio <= 1.01 && p.fg === p.bg; });
  var failures = profilePairs.filter(function(p) { return !p.passes && !(p.ratio <= 1.01 && p.fg === p.bg); });
  var nearMisses = profilePairs.filter(function(p) { return p.passes && p.ratio < p.needed + 0.5; });

  failures.forEach(function(p) {
    findings.push({
      severity: 'error',
      title: 'Text fails contrast ' + p.ratio + ':1 (needs ' + p.needed + ':1)',
      detail: '"' + p.text + '" at ' + p.fontSize + 'px — ' + p.selector,
      fix: p.isLarge
        ? 'Large text needs ' + profile.contrastLarge + ':1 minimum. Darken the text or lighten the background.'
        : 'Normal text needs ' + profile.contrast + ':1 minimum. Use a darker text color or lighter background.',
      presetRef: 'All presets use text-slate-600+ on white backgrounds (8:1+ ratio)'
    });
  });

  if (uncertain.length > 0) {
    findings.push({
      severity: 'info',
      title: uncertain.length + ' element(s) with undetermined contrast (background could not be resolved)',
      detail: 'These elements may use gradients, images, SVGs, or complex CSS that the analyzer cannot parse. Check manually: ' + uncertain.slice(0, 3).map(function(p) { return '"' + p.text + '"'; }).join(', '),
      fix: 'Verify these elements have sufficient contrast visually. The analyzer reports 1:1 when the effective background cannot be computed.',
      presetRef: null
    });
  }

  nearMisses.forEach(function(p) {
    findings.push({
      severity: 'warning',
      title: 'Text barely passes contrast ' + p.ratio + ':1 (needs ' + p.needed + ':1)',
      detail: '"' + p.text + '" at ' + p.fontSize + 'px — ' + p.selector,
      fix: 'Consider increasing contrast for better readability. Aim for 7:1 (AAA) where possible.',
      presetRef: null
    });
  });

  // Don't count uncertain results as failures in the score
  var total = (profilePairs.length - uncertain.length) || 1;
  var passing = total - failures.length;
  var score = Math.round((passing / total) * 100);

  return { score: score, findings: findings, weight: 20, label: 'Color & Contrast', icon: 'contrast' };
}


  S.register("contrast", scoreContrast, 20, "Color & Contrast", "contrast");
})();
