// Scoring Module Registry
// Each module calls MilgScoring.register() to add its scoring function.
// The main scoring engine calls all registered modules in order.

window.MilgScoring = (function() {
  'use strict';

  var modules = [];

  // --- User Persona Profiles ---
  var PROFILES = {
    general: { contrast: 4.5, contrastLarge: 3, bodyFontMin: 16, lineHeightMin: 1.4, lineHeightMax: 1.6, touchTarget: 44, touchTargetDesktop: 24, touchTargetDesktopWarn: 32, targetSpacing: 8, fontWeightMin: 0 },
    elderly: { contrast: 7, contrastLarge: 4.5, bodyFontMin: 18, lineHeightMin: 1.6, lineHeightMax: 1.8, touchTarget: 48, touchTargetDesktop: 48, touchTargetDesktopWarn: 48, targetSpacing: 8, fontWeightMin: 400 },
    low_vision: { contrast: 7, contrastLarge: 4.5, bodyFontMin: 18, lineHeightMin: 1.5, lineHeightMax: 1.7, touchTarget: 44, touchTargetDesktop: 44, touchTargetDesktopWarn: 44, targetSpacing: 8, fontWeightMin: 0 },
    motor_impairment: { contrast: 4.5, contrastLarge: 3, bodyFontMin: 16, lineHeightMin: 1.4, lineHeightMax: 1.6, touchTarget: 48, touchTargetDesktop: 48, touchTargetDesktopWarn: 48, targetSpacing: 12, fontWeightMin: 0 },
    wcag_aaa: { contrast: 7, contrastLarge: 4.5, bodyFontMin: 16, lineHeightMin: 1.4, lineHeightMax: 1.6, touchTarget: 44, touchTargetDesktop: 24, touchTargetDesktopWarn: 32, targetSpacing: 8, fontWeightMin: 0 }
  };

  function getProfile(data) {
    var name = (data && data.profile) || 'general';
    return PROFILES[name] || PROFILES.general;
  }

  // --- Color utilities (shared by contrast module) ---
  function parseColor(str) {
    if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
    var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
    var m2 = str.match(/rgba?\((\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+%?))?\)/);
    if (m2) { var a = m2[4] !== undefined ? (m2[4].indexOf('%') !== -1 ? parseFloat(m2[4]) / 100 : +m2[4]) : 1; return { r: +m2[1], g: +m2[2], b: +m2[3], a: a }; }
    return null;
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
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  // --- Public API ---
  function register(name, scoreFn, weight, label, icon) {
    modules.push({ name: name, score: scoreFn, weight: weight, label: label, icon: icon });
  }

  function runScoring(data) {
    var categories = modules.map(function(mod) {
      var result = mod.score(data, getProfile(data));
      result.weight = result.weight || mod.weight;
      result.label = result.label || mod.label;
      result.icon = result.icon || mod.icon;
      return result;
    });

    var totalWeight = 0;
    var weightedSum = 0;
    categories.forEach(function(cat) {
      totalWeight += cat.weight;
      weightedSum += cat.score * cat.weight;
    });

    var overall = Math.round(weightedSum / totalWeight);
    var grade = overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 60 ? 'D' : 'F';
    var gradeLabel = { A: 'Excellent', B: 'Good', C: 'Needs Improvement', D: 'Significant Issues', F: 'Major Redesign Needed' };

    return {
      overall: overall,
      grade: grade,
      gradeLabel: gradeLabel[grade],
      categories: categories,
      meta: data.meta,
      raw: data
    };
  }

  return {
    register: register,
    runScoring: runScoring,
    getProfile: getProfile,
    parseColor: parseColor,
    luminance: luminance,
    contrastRatio: contrastRatio,
    PROFILES: PROFILES
  };
})();
