// make-it-look-good — Pixel-Sampled Contrast Verification
// Samples actual pixel colors from screenshots at text element locations,
// compares with CSS-derived contrast ratios, and flags discrepancies.
// Depends on: screenshotMeta + screenshots + contrast pairs with bbox data

window.MilgContrastVerify = (function() {
  "use strict";

  // --- Density presets ---
  // Each defines max grid dimensions for FG [hMax, vMax] and BG [hMax, vMax]
  // Actual count scales with box size (1 sample per 3px), clamped to these maxima
  var DENSITY = {
    fast:     { fgH: 10, fgV: 3,  bgH: 12, bgV: 8  },  // ~109 samples/pair avg, ~22ms total
    common:   { fgH: 40, fgV: 10, bgH: 50, bgV: 40 },  // ~1269 samples/pair avg, ~250ms total
    accurate: { fgH: 80, fgV: 20, bgH: 100, bgV: 80 }   // ~3291 samples/pair avg, ~658ms total
  };
  var _density = DENSITY.common;

  function setDensity(name) {
    _density = DENSITY[name] || DENSITY.common;
  }

  // --- Color math (same as scoring/contrast.js) ---
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

  function parseRgb(str) {
    var m = str.match(/rgb[a]?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) m = str.match(/rgb[a]?\((\d+)\s+(\d+)\s+(\d+)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  function rgbStr(c) { return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'; }

  // --- Canvas management ---
  // Load screenshot data URI into a canvas, return {canvas, ctx, width, height}
  function loadScreenshotToCanvas(dataUri, callback) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      callback({ canvas: canvas, ctx: ctx, width: img.width, height: img.height });
    };
    img.onerror = function() { callback(null); };
    img.src = dataUri;
  }

  // Sample pixel color at a point, returns {r, g, b} or null
  function samplePixel(ctx, x, y, width, height) {
    // Clamp to canvas bounds
    x = Math.max(0, Math.min(Math.round(x), width - 1));
    y = Math.max(0, Math.min(Math.round(y), height - 1));
    var d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }

  // Sample a small area and return the dominant/average color
  // This is more robust than a single pixel (handles anti-aliasing, subpixel rendering)
  function sampleArea(ctx, cx, cy, radius, width, height) {
    var x0 = Math.max(0, Math.round(cx - radius));
    var y0 = Math.max(0, Math.round(cy - radius));
    var size = radius * 2 + 1;
    var x1 = Math.min(x0 + size, width);
    var y1 = Math.min(y0 + size, height);
    var w = x1 - x0;
    var h = y1 - y0;
    if (w <= 0 || h <= 0) return samplePixel(ctx, cx, cy, width, height);

    var data = ctx.getImageData(x0, y0, w, h).data;
    var rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (var i = 0; i < data.length; i += 4) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
      count++;
    }
    if (count === 0) return samplePixel(ctx, cx, cy, width, height);
    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count)
    };
  }

  // --- Verification logic ---

  // --- Multi-point sampling strategy ---
  // Photos, gradients, and dashed patterns need many sample points.
  // FG: horizontal sweep across text baseline band, take darkest (most likely text)
  // BG: grid across bbox excluding text band, find worst-case contrast
  function verifyPair(pair, sectionCanvases, meta) {
    if (!pair.bbox || !meta) return null;

    var scale = meta.scale;
    var sectionH = Math.round(meta.viewportHeight * scale);

    // Map bbox to canvas coordinates
    var canvasX = pair.bbox.left * scale;
    var canvasY = pair.bbox.top * scale;
    var canvasW = pair.bbox.width * scale;
    var canvasH = pair.bbox.height * scale;

    // Skip tiny boxes (less than 4px in either dimension at scale)
    if (canvasW < 4 || canvasH < 4) return null;

    // Determine which section this bbox falls in
    // For full-page screenshots (1 section), use section 0 directly
    var sectionIdx, yInSection;
    if (sectionCanvases.length === 1) {
      sectionIdx = 0;
      yInSection = canvasY;
    } else {
      sectionIdx = Math.floor(canvasY / sectionH);
      yInSection = canvasY - (sectionIdx * sectionH);
    }
    if (sectionIdx >= sectionCanvases.length || !sectionCanvases[sectionIdx]) return null;

    var sec = sectionCanvases[sectionIdx];
    // Clamp to section bounds
    if (yInSection + canvasH > sec.height) canvasH = sec.height - yInSection;
    if (canvasX + canvasW > sec.width) canvasW = sec.width - canvasX;

    // --- FG sampling: horizontal sweep across the text baseline area ---
    // Text typically sits in the middle 40% band of the bbox height.
    // Sample density scales with box size: ~1 sample per 3px, clamped to [3, 40].
    var textBandTop = yInSection + canvasH * 0.3;
    var textBandBottom = yInSection + canvasH * 0.7;
    var textBandMid = yInSection + canvasH * 0.5;
    var fgSamples = [];
    var fgPoints = []; // canvas coordinates for visualization
    var fgHSteps = Math.max(3, Math.min(_density.fgH, Math.floor(canvasW / 3)));
    var fgVSteps = Math.max(2, Math.min(_density.fgV, Math.floor(canvasH * 0.4 / 3)));
    for (var fvi = 0; fvi < fgVSteps; fvi++) {
      var fy = textBandTop + ((textBandBottom - textBandTop) * fvi / (fgVSteps - 1 || 1));
      for (var fhi = 0; fhi < fgHSteps; fhi++) {
        var sx = canvasX + (canvasW * (fhi + 0.5) / fgHSteps);
        fgSamples.push(samplePixel(sec.ctx, sx, fy, sec.width, sec.height));
        fgPoints.push({ x: Math.round(sx), y: Math.round(fy) });
      }
    }
    // Text color = the darkest sample in the text band (for dark-on-light)
    // or lightest (for light-on-dark). Determine from CSS fg color.
    var cssFg = parseRgb(pair.fg);
    var cssFgIsDark = cssFg ? (luminance(cssFg) < 0.5) : true;
    fgSamples.sort(function(a, b) {
      var la = luminance(a), lb = luminance(b);
      return cssFgIsDark ? (la - lb) : (lb - la); // darkest first if fg is dark
    });
    // Take median of the darkest/lightest third as FG (avoids outlier anti-aliased pixels)
    var fgSlice = fgSamples.slice(0, Math.max(3, Math.ceil(fgSamples.length / 3)));
    var fgColor = { r: 0, g: 0, b: 0 };
    fgSlice.forEach(function(s) { fgColor.r += s.r; fgColor.g += s.g; fgColor.b += s.b; });
    fgColor.r = Math.round(fgColor.r / fgSlice.length);
    fgColor.g = Math.round(fgColor.g / fgSlice.length);
    fgColor.b = Math.round(fgColor.b / fgSlice.length);

    // --- BG sampling: edges and margins ONLY, excluding text band ---
    // The text band (middle 30-70% of height) contains text pixels that would
    // contaminate BG readings. Sample from:
    //   1. Top strip (0% - 20% height)
    //   2. Bottom strip (80% - 100% height)
    //   3. Left edge strip (0% - 10% width, full height)
    //   4. Right edge strip (90% - 100% width, full height)
    //   5. Between-line gaps: horizontal sweeps at 25% and 75% height
    // This catches the actual background even with dense text.
    var bgSamples = [];
    var bgPoints = []; // canvas coordinates for visualization
    function _bgSample(px, py) {
      bgSamples.push(samplePixel(sec.ctx, px, py, sec.width, sec.height));
      bgPoints.push({ x: Math.round(px), y: Math.round(py) });
    }
    var bgHSteps = Math.max(3, Math.min(_density.bgH, Math.floor(canvasW / 3)));
    var bgVSteps = Math.max(3, Math.min(_density.bgV, Math.floor(canvasH / 3)));
    var insetX = Math.max(1, canvasW * 0.02);
    var insetY = Math.max(1, canvasH * 0.02);

    // Top strip (above text)
    var topStripBottom = yInSection + canvasH * 0.2;
    var topVSteps = Math.max(2, Math.ceil(bgVSteps * 0.2));
    for (var tx = 0; tx < bgHSteps; tx++) {
      for (var ty = 0; ty < topVSteps; ty++) {
        var px = canvasX + insetX + ((canvasW - insetX * 2) * tx / (bgHSteps - 1));
        var py = yInSection + insetY + ((topStripBottom - yInSection - insetY) * ty / (topVSteps - 1 || 1));
        _bgSample(px, py);
      }
    }

    // Bottom strip (below text)
    var bottomStripTop = yInSection + canvasH * 0.8;
    var bottomStripEnd = yInSection + canvasH - insetY;
    var botVSteps = Math.max(2, Math.ceil(bgVSteps * 0.2));
    for (var bxb = 0; bxb < bgHSteps; bxb++) {
      for (var byb = 0; byb < botVSteps; byb++) {
        var px = canvasX + insetX + ((canvasW - insetX * 2) * bxb / (bgHSteps - 1));
        var py = bottomStripTop + ((bottomStripEnd - bottomStripTop) * byb / (botVSteps - 1 || 1));
        _bgSample(px, py);
      }
    }

    // Left edge strip (avoid text, sample full height at left margin)
    var leftEdge = canvasX + insetX;
    var leftEdgeEnd = canvasX + canvasW * 0.08;
    var edgeVSteps = Math.max(3, Math.ceil(bgVSteps * 0.4));
    if (leftEdgeEnd > leftEdge + 1) {
      for (var ly = 0; ly < edgeVSteps; ly++) {
        var py = yInSection + insetY + ((canvasH - insetY * 2) * ly / (edgeVSteps - 1));
        _bgSample(leftEdge, py);
        _bgSample(leftEdgeEnd, py);
      }
    }

    // Right edge strip
    var rightEdge = canvasX + canvasW - insetX;
    var rightEdgeStart = canvasX + canvasW * 0.92;
    if (rightEdge > rightEdgeStart + 1) {
      for (var ry = 0; ry < edgeVSteps; ry++) {
        var py = yInSection + insetY + ((canvasH - insetY * 2) * ry / (edgeVSteps - 1));
        _bgSample(rightEdge, py);
        _bgSample(rightEdgeStart, py);
      }
    }

    // Between-line gap sweeps (25% and 75% of height — between top/text and text/bottom)
    var gapYs = [yInSection + canvasH * 0.22, yInSection + canvasH * 0.78];
    for (var gi = 0; gi < gapYs.length; gi++) {
      for (var gx = 0; gx < bgHSteps; gx++) {
        var px = canvasX + insetX + ((canvasW - insetX * 2) * gx / (bgHSteps - 1));
        _bgSample(px, gapYs[gi]);
      }
    }

    // Safety: if we got very few samples (tiny box), fall back to corners
    if (bgSamples.length < 4) {
      _bgSample(canvasX + 1, yInSection + 1);
      _bgSample(canvasX + canvasW - 1, yInSection + 1);
      _bgSample(canvasX + 1, yInSection + canvasH - 1);
      _bgSample(canvasX + canvasW - 1, yInSection + canvasH - 1);
    }

    // Find worst-case BG (the one that gives lowest contrast with FG)
    var worstBg = bgSamples[0];
    var worstRatio = 99;
    var bestBg = bgSamples[0];
    var bestRatio = 0;
    bgSamples.forEach(function(bg) {
      var r = contrastRatio(fgColor, bg);
      if (r < worstRatio) { worstRatio = r; worstBg = bg; }
      if (r > bestRatio) { bestRatio = r; bestBg = bg; }
    });

    // Also compute average BG contrast for overall picture
    var avgBg = { r: 0, g: 0, b: 0 };
    bgSamples.forEach(function(s) { avgBg.r += s.r; avgBg.g += s.g; avgBg.b += s.b; });
    avgBg.r = Math.round(avgBg.r / bgSamples.length);
    avgBg.g = Math.round(avgBg.g / bgSamples.length);
    avgBg.b = Math.round(avgBg.b / bgSamples.length);
    var avgRatio = contrastRatio(fgColor, avgBg);

    // Use worst-case ratio as the primary "pixel ratio" — conservative approach
    var pixelRatio = worstRatio;
    var cssRatio = pair.ratio;

    var cssNeeded = pair.needed || 4.5;
    var cssPasses = cssRatio >= cssNeeded;
    var pixelPasses = pixelRatio >= cssNeeded;
    var ratioDiff = Math.abs(pixelRatio - cssRatio);
    var crossesBoundary = cssPasses !== pixelPasses;

    // Flag high BG variance as a signal for photo/gradient backgrounds
    var bgVariance = bestRatio - worstRatio;
    var isVariableBg = bgVariance > 2.0;

    return {
      cssRatio: cssRatio,
      pixelRatio: pixelRatio,         // worst-case (conservative)
      pixelRatioAvg: avgRatio,        // average background
      pixelRatioBest: bestRatio,      // best-case spot
      bgVariance: Math.round(bgVariance * 100) / 100,
      isVariableBg: isVariableBg,     // photo/gradient detected
      ratioDiff: ratioDiff,
      cssPasses: cssPasses,
      pixelPasses: pixelPasses,
      crossesBoundary: crossesBoundary,
      significant: crossesBoundary || ratioDiff > 1.5 || isVariableBg,
      pixelFg: rgbStr(fgColor),
      pixelBgWorst: rgbStr(worstBg),
      pixelBgAvg: rgbStr(avgBg),
      cssFg: pair.fg,
      cssBg: pair.bg,
      selector: pair.selector,
      text: pair.text,
      sectionIdx: sectionIdx,
      sampleCount: { fg: fgSamples.length, bg: bgSamples.length },
      samplePoints: { fg: fgPoints, bg: bgPoints }
    };
  }

  // Run verification on all contrast pairs with bboxes
  // Prefers pre-computed pixelVerify data from extraction (pristine canvas).
  // Falls back to post-hoc screenshot canvas sampling when not available.
  // callback(results) where results is array of verification objects
  function verify(reportData, callback) {
    var raw = reportData && reportData.raw;
    if (!raw || !raw.colors || !raw.colors.contrastPairs) {
      callback([]); return;
    }

    var pairs = raw.colors.contrastPairs.filter(function(p) { return p.bbox; });
    if (pairs.length === 0) { callback([]); return; }

    // Check if extraction already computed pixel verification (snippet-screenshots path)
    var hasPrecomputed = raw.pixelVerifyResults || pairs.some(function(p) { return p.pixelVerify; });
    if (hasPrecomputed) {
      // Use pre-computed results — these were done on the pristine full-res canvas
      var results = (raw.pixelVerifyResults || []).slice();
      // Also collect per-pair results that weren't flagged as discrepancies
      pairs.forEach(function(pair) {
        if (!pair.pixelVerify) return;
        var pv = pair.pixelVerify;
        // Check if already in results array
        var alreadyIn = results.some(function(r) { return r.selector === pair.selector; });
        if (!alreadyIn) {
          results.push({
            selector: pair.selector,
            text: pair.text,
            cssRatio: pair.ratio,
            pixelRatio: pv.worstRatio,
            pixelRatioAvg: pv.dominantRatio,
            pixelRatioBest: pv.dominantRatio,
            cssPasses: pair.ratio >= (pair.needed || 4.5),
            pixelPasses: pv.worstRatio >= (pair.needed || 4.5),
            crossesBoundary: pv.crossesBoundary,
            isVariableBg: pv.isVariableBg,
            significant: false,
            bgSamples: pv.bgSamples,
            pixelBgDominant: pv.dominantBg,
            pixelBgWorst: pv.worstBg,
            cssBgConfirmed: pv.cssBgConfirmed,
            ratioDiff: Math.abs(pv.dominantRatio - pair.ratio),
            bgVariance: 0,
            sampleCount: { fg: 0, bg: pv.bgSamples }
          });
        }
      });
      results.sort(function(a, b) {
        if (a.crossesBoundary !== b.crossesBoundary) return a.crossesBoundary ? -1 : 1;
        return (b.ratioDiff || 0) - (a.ratioDiff || 0);
      });
      callback(results);
      return;
    }

    // Fallback: post-hoc verification from screenshot canvases (iframe path)
    if (!raw.screenshots || !raw.screenshotMeta) { callback([]); return; }
    var meta = raw.screenshotMeta;

    var sectionCanvases = new Array(raw.screenshots.length);
    var loaded = 0;
    var total = raw.screenshots.length;

    raw.screenshots.forEach(function(dataUri, idx) {
      loadScreenshotToCanvas(dataUri, function(sec) {
        sectionCanvases[idx] = sec;
        loaded++;
        if (loaded === total) {
          var results = [];
          pairs.forEach(function(pair) {
            var result = verifyPair(pair, sectionCanvases, meta);
            if (result) results.push(result);
          });

          results.sort(function(a, b) {
            if (a.crossesBoundary !== b.crossesBoundary) return a.crossesBoundary ? -1 : 1;
            return b.ratioDiff - a.ratioDiff;
          });

          callback(results);
        }
      });
    });
  }

  // Format a single verification result as HTML for display in findings
  function formatResult(r) {
    var variableNote = r.isVariableBg
      ? '<br><span style="font-size:10px;color:var(--text-secondary)">Variable background detected (contrast range: ' + r.pixelRatio + ':1 to ' + r.pixelRatioBest + ':1, variance: ' + r.bgVariance + ')</span>'
      : '';
    if (r.crossesBoundary) {
      if (r.cssPasses && !r.pixelPasses) {
        return '<span style="color:#ef4444;font-weight:600">Pixel check: FAILS ' + r.pixelRatio + ':1 worst-case</span> ' +
          '<span style="color:var(--text-secondary);font-size:11px">(CSS reported ' + r.cssRatio + ':1 pass' +
          (r.isVariableBg ? ' — photo/gradient background' : ' — actual background may differ') + ')</span>' + variableNote;
      } else {
        return '<span style="color:#16a34a;font-weight:600">Pixel check: PASSES ' + r.pixelRatio + ':1</span> ' +
          '<span style="color:var(--text-secondary);font-size:11px">(CSS reported ' + r.cssRatio + ':1 — actual background provides better contrast)</span>' + variableNote;
      }
    }
    if (r.isVariableBg) {
      return '<span style="color:#f59e0b">Variable background: worst ' + r.pixelRatio + ':1, avg ' + r.pixelRatioAvg + ':1, best ' + r.pixelRatioBest + ':1</span>' +
        '<br><span style="color:var(--text-secondary);font-size:11px">Photo or gradient background — contrast varies across element' + (r.sampleCount ? ' (' + r.sampleCount.bg + ' points sampled)' : '') + '</span>';
    }
    if (r.significant) {
      return '<span style="color:#f59e0b">Pixel contrast: ' + r.pixelRatio + ':1</span> ' +
        '<span style="color:var(--text-secondary);font-size:11px">(differs from CSS-derived ' + r.cssRatio + ':1 by ' + r.ratioDiff.toFixed(1) + ')</span>' + variableNote;
    }
    return '<span style="color:var(--text-secondary);font-size:11px">Pixel-verified: ' + r.pixelRatio + ':1' +
      (r.bgVariance > 0.5 ? ' (bg range: ' + r.bgVariance + ')' : '') + '</span>';
  }

  // Build a summary of verification results
  function buildSummary(results) {
    var total = results.length;
    var falsePassCount = 0; // CSS passes but pixels fail
    var falseFailCount = 0; // CSS fails but pixels pass
    var significantDiffs = 0;
    var variableBgCount = 0;
    var verified = 0;

    results.forEach(function(r) {
      if (r.isVariableBg) variableBgCount++;
      if (r.crossesBoundary) {
        if (r.cssPasses && !r.pixelPasses) falsePassCount++;
        else falseFailCount++;
      } else if (r.significant) {
        significantDiffs++;
      } else {
        verified++;
      }
    });

    return {
      total: total,
      falsePassCount: falsePassCount,
      falseFailCount: falseFailCount,
      significantDiffs: significantDiffs,
      variableBgCount: variableBgCount,
      verified: verified,
      results: results
    };
  }

  // Render verification summary as HTML block
  function renderSummaryHtml(summary) {
    if (summary.total === 0) return '';
    var isDark = document.body && document.body.classList.contains('dark-ui');

    var html = '<details class="contrast-verify-summary">';
    html += '<summary style="cursor:pointer;font-size:13px;font-weight:600;padding:8px 0">';
    html += 'Pixel Contrast Verification (' + summary.total + ' pairs checked)';
    if (summary.falsePassCount > 0) {
      html += ' <span style="color:#ef4444;font-weight:700">' + summary.falsePassCount + ' hidden failure' + (summary.falsePassCount > 1 ? 's' : '') + '</span>';
    }
    html += '</summary>';

    html += '<div style="padding:8px 0;font-size:13px;line-height:1.6">';

    if (summary.falsePassCount > 0) {
      var bg = isDark ? '#2d0f0f' : '#fef2f2';
      var border = isDark ? '#991b1b' : '#fecaca';
      html += '<div style="padding:10px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:6px;margin-bottom:8px">';
      html += '<strong style="color:#ef4444">' + summary.falsePassCount + ' element' + (summary.falsePassCount > 1 ? 's' : '') + ' pass CSS contrast but fail in pixels</strong>';
      html += '<p style="margin:4px 0 0;font-size:12px;color:' + (isDark ? '#fca5a5' : '#991b1b') + '">These elements have backgrounds (gradients, images, overlapping elements) that reduce contrast below what CSS inspection reports.</p>';
      summary.results.filter(function(r) { return r.cssPasses && !r.pixelPasses; }).forEach(function(r) {
        html += '<div style="margin-top:6px;padding:6px 8px;background:' + (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)') + ';border-radius:4px;font-size:12px">';
        html += '<strong>' + r.selector + '</strong>: "' + (r.text || '').substring(0, 30) + '"';
        html += '<br>CSS: ' + r.cssRatio + ':1 (pass) &rarr; Pixels: ' + r.pixelRatio + ':1 (fail)';
        html += '<br><span style="color:var(--text-secondary)">Pixel FG: ' + (r.pixelFg || '?') + ' / BG worst: ' + (r.pixelBgWorst || r.pixelBgDominant || '?') + (r.isVariableBg && r.sampleCount ? ' (variable bg, ' + r.sampleCount.bg + ' points)' : '') + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (summary.falseFailCount > 0) {
      var bg = isDark ? '#0c2d1e' : '#f0fdf4';
      var border = isDark ? '#166534' : '#bbf7d0';
      html += '<div style="padding:10px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:6px;margin-bottom:8px">';
      html += '<strong style="color:#16a34a">' + summary.falseFailCount + ' false positive' + (summary.falseFailCount > 1 ? 's' : '') + ' detected</strong>';
      html += '<p style="margin:4px 0 0;font-size:12px;color:' + (isDark ? '#86efac' : '#166534') + '">These elements fail CSS contrast but actually pass when measured from the screenshot. The real background provides better contrast.</p>';
      summary.results.filter(function(r) { return !r.cssPasses && r.pixelPasses; }).forEach(function(r) {
        html += '<div style="margin-top:6px;padding:6px 8px;background:' + (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)') + ';border-radius:4px;font-size:12px">';
        html += '<strong>' + r.selector + '</strong>: "' + (r.text || '').substring(0, 30) + '"';
        html += '<br>CSS: ' + r.cssRatio + ':1 (fail) &rarr; Pixels: ' + r.pixelRatio + ':1 (pass)';
        html += '</div>';
      });
      html += '</div>';
    }

    // Variable background warning (photos, gradients)
    if (summary.variableBgCount > 0) {
      var vbResults = summary.results.filter(function(r) { return r.isVariableBg; });
      var bg = isDark ? '#2d2006' : '#fffbeb';
      var border = isDark ? '#92400e' : '#fde68a';
      html += '<div style="padding:10px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:6px;margin-bottom:8px">';
      html += '<strong style="color:#f59e0b">' + summary.variableBgCount + ' element' + (summary.variableBgCount > 1 ? 's' : '') + ' with variable backgrounds (photo/gradient)</strong>';
      html += '<p style="margin:4px 0 0;font-size:12px;color:' + (isDark ? '#fbbf24' : '#92400e') + '">These elements have backgrounds that vary significantly across their area. Contrast depends on where text is positioned relative to the background.</p>';
      vbResults.slice(0, 5).forEach(function(r) {
        html += '<div style="margin-top:6px;padding:6px 8px;background:' + (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)') + ';border-radius:4px;font-size:12px">';
        html += '<strong>' + r.selector + '</strong>: "' + (r.text || '').substring(0, 30) + '"';
        html += '<br>Contrast range: <span style="color:#ef4444">' + r.pixelRatio + ':1</span> (worst) to <span style="color:#16a34a">' + r.pixelRatioBest + ':1</span> (best), avg ' + r.pixelRatioAvg + ':1';
        html += '<br><span style="color:var(--text-secondary)">' + (r.sampleCount ? r.sampleCount.bg + ' background points sampled, ' : '') + 'variance: ' + (r.bgVariance || '?') + '</span>';
        html += '</div>';
      });
      if (vbResults.length > 5) html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">...and ' + (vbResults.length - 5) + ' more</div>';
      html += '</div>';
    }

    if (summary.verified > 0 || summary.significantDiffs > 0) {
      html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">';
      if (summary.verified > 0) html += summary.verified + ' pair' + (summary.verified > 1 ? 's' : '') + ' verified consistent. ';
      if (summary.significantDiffs > 0) html += summary.significantDiffs + ' with notable pixel deviation (>1.5 ratio difference). ';
      html += '</div>';
    }

    html += '</div></details>';
    return html;
  }

  return {
    verify: verify,
    setDensity: setDensity,
    formatResult: formatResult,
    buildSummary: buildSummary,
    renderSummaryHtml: renderSummaryHtml,
    contrastRatio: contrastRatio,
    parseRgb: parseRgb
  };
})();
