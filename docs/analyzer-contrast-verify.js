// make-it-look-good — Pixel-Sampled Contrast Verification
// Samples actual pixel colors from screenshots at text element locations,
// compares with CSS-derived contrast ratios, and flags discrepancies.
// Depends on: screenshotMeta + screenshots + contrast pairs with bbox data

window.MilgContrastVerify = (function() {
  "use strict";

  // Reusable mask canvas (avoids creating a new one per pair)
  var _maskCanvas = document.createElement('canvas');
  var _maskCtx = _maskCanvas.getContext('2d', { willReadFrequently: true });

  // --- Density presets (for grid fallback) ---
  var DENSITY = {
    fast:     { fgH: 10, fgV: 3,  bgH: 12, bgV: 8  },
    common:   { fgH: 40, fgV: 10, bgH: 50, bgV: 40 },
    accurate: { fgH: 80, fgV: 20, bgH: 100, bgV: 80 }
  };
  var _density = DENSITY.common;
  function setDensity(name) { _density = DENSITY[name] || DENSITY.common; }

  // --- Edge detection method ---
  var EDGE_METHODS = ['boundary', 'grid'];
  var _edgeMethod = 'boundary';
  function setEdgeMethod(name) {
    if (EDGE_METHODS.indexOf(name) !== -1) _edgeMethod = name;
  }

  // --- Boundary detection (4-connected) ---
  // Returns Uint8Array: 0=background, 1=boundary, 2=inside
  // A foreground pixel adjacent to a background pixel is a boundary pixel.
  // No convolution, no smudging — exact pixel boundary.
  function findBoundary(mask, w, h) {
    var cat = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        if (!mask[i]) continue;
        if (x === 0 || x === w - 1 || y === 0 || y === h - 1 ||
            !mask[i - 1] || !mask[i + 1] || !mask[(y - 1) * w + x] || !mask[(y + 1) * w + x]) {
          cat[i] = 1;
        } else {
          cat[i] = 2;
        }
      }
    }
    return cat;
  }

  // --- BFS distance from boundary pixels ---
  // Returns Uint8Array with distance from nearest boundary pixel (0 = boundary, 255 = unreached)
  function bfsBoundaryDist(cat, w, h, maxDist) {
    var dist = new Uint8Array(w * h);
    var queue = [];
    for (var i = 0; i < w * h; i++) {
      if (cat[i] === 1) { dist[i] = 0; queue.push(i); }
      else dist[i] = 255;
    }
    var head = 0;
    while (head < queue.length) {
      var ci = queue[head++];
      var cd = dist[ci];
      if (cd >= maxDist) continue;
      var cx = ci % w, cy = (ci - cx) / w;
      for (var dy = -1; dy <= 1; dy++) {
        var ny = cy + dy;
        if (ny < 0 || ny >= h) continue;
        for (var dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          var nx = cx + dx;
          if (nx < 0 || nx >= w) continue;
          var ni = ny * w + nx;
          if (dist[ni] <= cd + 1) continue;
          dist[ni] = cd + 1;
          queue.push(ni);
        }
      }
    }
    return dist;
  }

  // --- Connected component labeling (8-connected flood fill) ---
  // Labels pixels matching a zone value, returns { groupId: Int32Array, count: number, pixels: [[idx,...], ...] }
  function labelComponents(zone, w, h, zoneVal) {
    var groupId = new Int32Array(w * h);
    var nextGroup = 1;
    var groupPixels = [null]; // groupPixels[gid] = [idx, ...]

    function flood(startIdx) {
      var gid = nextGroup++;
      groupPixels.push([]);
      var stack = [startIdx];
      groupId[startIdx] = gid;
      while (stack.length > 0) {
        var ci = stack.pop();
        groupPixels[gid].push(ci);
        var cx = ci % w, cy = (ci - cx) / w;
        for (var dy = -1; dy <= 1; dy++) {
          var ny = cy + dy;
          if (ny < 0 || ny >= h) continue;
          for (var dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            var nx = cx + dx;
            if (nx < 0 || nx >= w) continue;
            var ni = ny * w + nx;
            if (groupId[ni] === 0 && zone[ni] === zoneVal) {
              groupId[ni] = gid;
              stack.push(ni);
            }
          }
        }
      }
      return gid;
    }

    for (var i = 0; i < w * h; i++) {
      if (groupId[i] === 0 && zone[i] === zoneVal) flood(i);
    }
    return { groupId: groupId, count: nextGroup - 1, pixels: groupPixels };
  }

  // [old edge detection functions removed — replaced by findBoundary + bfsBoundaryDist above]

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

  // Dispatcher: use edge-based when mask bitmap available, else fall back to grid
  function verifyPair(pair, sectionCanvases, meta, maskCanvas) {
    if (_edgeMethod !== 'grid' && pair._maskBmp && pair._maskW && pair._maskDark > 0) {
      return verifyPairEdge(pair, sectionCanvases, meta, maskCanvas);
    }
    return verifyPairGrid(pair, sectionCanvases, meta, maskCanvas);
  }

  // --- Shared preamble: map bbox to canvas, read pixels ---
  function prepareContext(pair, sectionCanvases, meta) {
    if (!pair.bbox || !meta) return null;
    var scale = meta.scale;
    var sectionH = Math.round(meta.viewportHeight * scale);
    var canvasX = pair.bbox.left * scale, canvasY = pair.bbox.top * scale;
    var canvasW = pair.bbox.width * scale, canvasH = pair.bbox.height * scale;
    if (canvasW < 4 || canvasH < 4) return null;
    var sectionIdx, yInSection;
    if (sectionCanvases.length === 1) { sectionIdx = 0; yInSection = canvasY; }
    else { sectionIdx = Math.floor(canvasY / sectionH); yInSection = canvasY - (sectionIdx * sectionH); }
    if (sectionIdx >= sectionCanvases.length || !sectionCanvases[sectionIdx]) return null;
    var sec = sectionCanvases[sectionIdx];
    if (yInSection + canvasH > sec.height) canvasH = sec.height - yInSection;
    if (canvasX + canvasW > sec.width) canvasW = sec.width - canvasX;
    var bx = Math.max(0, Math.round(canvasX));
    var by = Math.max(0, Math.round(yInSection));
    var bw = Math.min(Math.round(canvasW), sec.width - bx);
    var bh = Math.min(Math.round(canvasH), sec.height - by);
    if (bw < 4 || bh < 4) return null;
    var cssFg = parseRgb(pair.fg);
    if (!cssFg) return null;
    var cssBg = parseRgb(pair.bg);
    var opacity = pair.effectiveOpacity !== undefined ? pair.effectiveOpacity : 1;
    var expectedFg = cssFg;
    if (opacity < 0.95 && cssBg) {
      expectedFg = {
        r: Math.round(cssFg.r * opacity + cssBg.r * (1 - opacity)),
        g: Math.round(cssFg.g * opacity + cssBg.g * (1 - opacity)),
        b: Math.round(cssFg.b * opacity + cssBg.b * (1 - opacity))
      };
    }
    return { sec: sec, bx: bx, by: by, bw: bw, bh: bh, cssFg: cssFg, cssBg: cssBg,
             expectedFg: expectedFg, opacity: opacity, sectionIdx: sectionIdx, scale: scale };
  }

  // --- Build result object (shared shape) ---
  function buildResult(pair, ctx, fgPoints, fgColors, bgPoints, bgColors, allPairRatios, worstRatio, bestRatio, worstBg, worstBgPt) {
    var fgColor = { r: 0, g: 0, b: 0 };
    fgColors.forEach(function(c) { fgColor.r += c.r; fgColor.g += c.g; fgColor.b += c.b; });
    if (fgColors.length > 0) {
      fgColor.r = Math.round(fgColor.r / fgColors.length);
      fgColor.g = Math.round(fgColor.g / fgColors.length);
      fgColor.b = Math.round(fgColor.b / fgColors.length);
    }
    var avgBg = { r: 0, g: 0, b: 0 };
    bgColors.forEach(function(c) { avgBg.r += c.r; avgBg.g += c.g; avgBg.b += c.b; });
    if (bgColors.length > 0) {
      avgBg.r = Math.round(avgBg.r / bgColors.length); avgBg.g = Math.round(avgBg.g / bgColors.length); avgBg.b = Math.round(avgBg.b / bgColors.length);
    }
    var avgRatio = contrastRatio(fgColor, avgBg);
    allPairRatios.sort(function(a, b) { return a - b; });
    var p10Idx = Math.floor(allPairRatios.length * 0.1);
    var p10Ratio = allPairRatios.length > 0 ? Math.round(allPairRatios[Math.min(p10Idx, allPairRatios.length - 1)] * 100) / 100 : 0;
    var medianRatio = allPairRatios.length > 0 ? Math.round(allPairRatios[Math.floor(allPairRatios.length / 2)] * 100) / 100 : 0;
    var cssNeeded = pair.needed || 4.5;
    var cssPasses = pair.ratio >= cssNeeded;
    var pixelPasses = p10Ratio >= cssNeeded;
    var ratioDiff = Math.abs(p10Ratio - pair.ratio);
    var bgVariance = bestRatio - worstRatio;
    return {
      cssRatio: pair.ratio, neededRatio: cssNeeded,
      pixelRatio: worstRatio, pixelRatioAvg: avgRatio, pixelRatioBest: bestRatio,
      bgVariance: Math.round(bgVariance * 100) / 100,
      isVariableBg: bgVariance > 2.0, ratioDiff: ratioDiff,
      cssPasses: cssPasses, pixelPasses: pixelPasses,
      crossesBoundary: cssPasses !== pixelPasses,
      significant: (cssPasses !== pixelPasses) || ratioDiff > 1.5 || bgVariance > 2.0,
      pixelFg: rgbStr(fgColor), expectedFg: rgbStr(ctx.expectedFg), effectiveOpacity: ctx.opacity,
      pixelRatioP10: p10Ratio, pixelRatioMedian: medianRatio,
      pixelBgWorst: worstBg ? rgbStr(worstBg) : '', pixelBgAvg: rgbStr(avgBg),
      cssFg: pair.fg, cssBg: pair.bg, selector: pair.selector, text: pair.text,
      bbox: pair.bbox, maskLayer: pair._maskLayer || 0, sectionIdx: ctx.sectionIdx,
      sampleCount: { fg: fgPoints.length, bg: bgPoints.length },
      samplePoints: {
        fg: fgPoints.map(function(p, i) { return { x: p.x, y: p.y, r: fgColors[i].r, g: fgColors[i].g, b: fgColors[i].b }; }),
        bg: bgPoints.map(function(p, i) {
          var ratio = contrastRatio(fgColor, bgColors[i]);
          return { x: p.x, y: p.y, r: bgColors[i].r, g: bgColors[i].g, b: bgColors[i].b, ratio: Math.round(ratio * 100) / 100 };
        })
      },
      avgFg: fgColor, worstPoint: worstBgPt || null
    };
  }

  // --- Boundary-based verification ---
  // Uses 4-connected boundary detection + BFS distance for FG/BG zone classification.
  // Connected component grouping matches FG groups to nearest BG groups.
  // FG sampled inside bbox, BG can extend outside.
  function verifyPairEdge(pair, sectionCanvases, meta, maskCanvas) {
    var ctx = prepareContext(pair, sectionCanvases, meta);
    if (!ctx) return null;
    var bx = ctx.bx, by = ctx.by, bw = ctx.bw, bh = ctx.bh;

    var mBmpRaw = pair._maskBmp, mW = pair._maskW, mH = pair._maskH;
    var w = Math.min(mW, bw), h = Math.min(mH, bh);
    if (w < 4 || h < 4) return null;

    // Constants (in mask pixel space — mask is at screenshot scale)
    var FG_INNER = 2;  // FG sample: 1-2px inside boundary
    var BG_DIST_MIN = 3; // BG sample ring: 3-4px outside boundary
    var BG_DIST_MAX = 4;
    var MAX_DIST = BG_DIST_MAX + 2;

    // Read expanded area from screenshot for BG sampling outside bbox
    var PAD = BG_DIST_MAX + 1;
    var padL = Math.min(PAD, bx);
    var padT = Math.min(PAD, by);
    var padR = Math.min(PAD, ctx.sec.width - bx - bw);
    var padB = Math.min(PAD, ctx.sec.height - by - bh);
    var ex = bx - padL, ey = by - padT;
    var ew = bw + padL + padR, eh = bh + padT + padB;
    var imgDataExp = ctx.sec.ctx.getImageData(ex, ey, ew, eh).data;

    // Step 1: Clean mask
    var mask = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) mask[i] = mBmpRaw[i] ? 1 : 0;

    // Step 2: Boundary detection (4-connected)
    var cat = findBoundary(mask, w, h);

    // Step 3: BFS distance from boundary
    var dist = bfsBoundaryDist(cat, w, h, MAX_DIST);

    // Step 4: Classify into zones
    // zone: 0=none, 2=FG sample (inside, dist 1-FG_INNER), 3=BG sample (outside, dist BG_MIN-BG_MAX)
    var zone = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var mi = y * w + x;
        var dd = dist[mi];
        if (cat[mi] === 1) zone[mi] = 1; // boundary
        else if (mask[mi] && dd >= 1 && dd <= FG_INNER) zone[mi] = 2; // FG
        else if (!mask[mi] && dd >= BG_DIST_MIN && dd <= BG_DIST_MAX) zone[mi] = 3; // BG
      }
    }

    // Step 4b: Small text FG fallback — when text strokes are too thin (1-2px),
    // the FG zone (dist 1-2 inside) may be empty. In any 2x2 window that has
    // boundary pixels but no FG pixels, promote the boundary pixels to FG.
    var fgCount = 0, boundaryCount = 0;
    for (var i = 0; i < w * h; i++) {
      if (zone[i] === 2) fgCount++;
      if (zone[i] === 1) boundaryCount++;
    }
    if (fgCount === 0 && boundaryCount > 0) {
      // No FG at all — promote ALL boundary pixels to FG
      for (var i = 0; i < w * h; i++) {
        if (zone[i] === 1) zone[i] = 2;
      }
    } else if (boundaryCount > 0) {
      // Scan 2x2 windows: if boundary pixels exist but no FG in the window, promote
      for (var y = 0; y < h - 1; y++) {
        for (var x = 0; x < w - 1; x++) {
          var z00 = zone[y * w + x], z10 = zone[y * w + x + 1];
          var z01 = zone[(y + 1) * w + x], z11 = zone[(y + 1) * w + x + 1];
          var hasBoundary = (z00 === 1 || z10 === 1 || z01 === 1 || z11 === 1);
          var hasFg = (z00 === 2 || z10 === 2 || z01 === 2 || z11 === 2);
          if (hasBoundary && !hasFg) {
            // Promote boundary pixels in this window to FG
            if (z00 === 1) zone[y * w + x] = 2;
            if (z10 === 1) zone[y * w + x + 1] = 2;
            if (z01 === 1) zone[(y + 1) * w + x] = 2;
            if (z11 === 1) zone[(y + 1) * w + x + 1] = 2;
          }
        }
      }
    }

    // Also classify BG pixels in the padding area (outside bbox)
    // Build a set of boundary pixel positions for distance checks
    var boundaryPts = [];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (cat[y * w + x] === 1) boundaryPts.push({ x: x, y: y });
      }
    }
    if (boundaryPts.length === 0) return null;

    // Expanded BG zone: pixels in padding area at BG distance from boundary
    var expBgPixels = []; // [{lx, ly, r, g, b}] in bbox-relative coords (can be negative)
    if (padL > 0 || padT > 0 || padR > 0 || padB > 0) {
      var padRanges = [
        { x0: -padL, x1: w + padR, y0: -padT, y1: 0 },
        { x0: -padL, x1: w + padR, y0: h, y1: h + padB },
        { x0: -padL, x1: 0, y0: 0, y1: h },
        { x0: w, x1: w + padR, y0: 0, y1: h }
      ];
      for (var ri = 0; ri < padRanges.length; ri++) {
        var rng = padRanges[ri];
        for (var py = rng.y0; py < rng.y1; py++) {
          for (var ppx = rng.x0; ppx < rng.x1; ppx++) {
            // Find distance to nearest boundary pixel
            var minD = Infinity;
            for (var bi = 0; bi < boundaryPts.length; bi++) {
              var bdx = boundaryPts[bi].x - ppx, bdy = boundaryPts[bi].y - py;
              var d = Math.sqrt(bdx * bdx + bdy * bdy);
              if (d < minD) { minD = d; if (d <= BG_DIST_MIN) break; }
            }
            if (minD >= BG_DIST_MIN && minD <= BG_DIST_MAX) {
              var ix = ppx + padL, iy = py + padT;
              if (ix >= 0 && ix < ew && iy >= 0 && iy < eh) {
                var pi = (iy * ew + ix) * 4;
                expBgPixels.push({ lx: ppx, ly: py, r: imgDataExp[pi], g: imgDataExp[pi+1], b: imgDataExp[pi+2] });
              }
            }
          }
        }
      }
    }

    // Step 5: Group BG zones, keep FG pixels individual
    // BG: connected component grouping — each isolated BG region gets one average color
    // FG: each pixel matched individually to nearest BG group — more pairs, better coverage
    var bgLabel = labelComponents(zone, w, h, 3);

    // Helper: read pixel color from expanded imgData given bbox-relative coords
    function readPixel(lx, ly) {
      var ix = lx + padL, iy = ly + padT;
      if (ix < 0 || ix >= ew || iy < 0 || iy >= eh) return null;
      var pi = (iy * ew + ix) * 4;
      if (pi + 2 >= imgDataExp.length) return null;
      return { r: imgDataExp[pi], g: imgDataExp[pi+1], b: imgDataExp[pi+2] };
    }

    // Step 6: Compute BG group average colors + centroids
    var bgGroupColors = [null];
    var bgGroupCentroids = [null];
    for (var gid = 1; gid <= bgLabel.count; gid++) {
      var pxls = bgLabel.pixels[gid];
      var sumR = 0, sumG = 0, sumB = 0, sumX = 0, sumY = 0, n = 0;
      for (var p = 0; p < pxls.length; p++) {
        var idx = pxls[p];
        var px = idx % w, py2 = (idx - px) / w;
        var c = readPixel(px, py2);
        if (c) { sumR += c.r; sumG += c.g; sumB += c.b; n++; }
        sumX += px; sumY += py2;
      }
      n = n || 1;
      bgGroupColors.push({ r: Math.round(sumR / n), g: Math.round(sumG / n), b: Math.round(sumB / n) });
      bgGroupCentroids.push({ x: sumX / pxls.length, y: sumY / pxls.length });
    }

    // Merge expanded BG pixels into nearest BG group
    if (expBgPixels.length > 0 && bgLabel.count > 0) {
      var expByGroup = {};
      for (var i = 0; i < expBgPixels.length; i++) {
        var ep = expBgPixels[i];
        var bestGid = 1, bestD = Infinity;
        for (var gid = 1; gid <= bgLabel.count; gid++) {
          var cx = bgGroupCentroids[gid].x, cy = bgGroupCentroids[gid].y;
          var d2 = (ep.lx - cx) * (ep.lx - cx) + (ep.ly - cy) * (ep.ly - cy);
          if (d2 < bestD) { bestD = d2; bestGid = gid; }
        }
        if (!expByGroup[bestGid]) expByGroup[bestGid] = [];
        expByGroup[bestGid].push(ep);
      }
      for (var gid in expByGroup) {
        var extras = expByGroup[gid];
        var orig = bgGroupColors[gid];
        var origCount = bgLabel.pixels[gid] ? bgLabel.pixels[gid].length : 1;
        var totalN = origCount + extras.length;
        var sumR = orig.r * origCount, sumG = orig.g * origCount, sumB = orig.b * origCount;
        for (var i = 0; i < extras.length; i++) {
          sumR += extras[i].r; sumG += extras[i].g; sumB += extras[i].b;
        }
        bgGroupColors[gid] = { r: Math.round(sumR / totalN), g: Math.round(sumG / totalN), b: Math.round(sumB / totalN) };
      }
    }

    // Step 7: Each FG pixel → nearest BG group → contrast ratio
    // This gives many more pairs than group-vs-group, catching local contrast variations.
    var fgPoints = [], fgColors = [];
    var bgPoints = [], bgColors = [];
    var allPairRatios = [];
    var worstRatio = 99, bestRatio = 0, worstBg = null, worstBgPt = null;

    // Collect all FG pixel positions
    var allFgIdx = [];
    for (var i = 0; i < w * h; i++) { if (zone[i] === 2) allFgIdx.push(i); }

    if (allFgIdx.length === 0 || bgLabel.count === 0) {
      if (pair.text) console.log('[verify-boundary] No FG/BG for "' + pair.text.substring(0, 25) + '" boundary=' + boundaryPts.length + ' fg=' + allFgIdx.length + ' bgGroups=' + bgLabel.count);
      return null;
    }

    for (var fi = 0; fi < allFgIdx.length; fi++) {
      var fgIdx = allFgIdx[fi];
      var fx = fgIdx % w, fy = (fgIdx - fx) / w;
      var fgC = readPixel(fx, fy);
      if (!fgC) continue;

      // Find nearest BG group by pixel distance to centroid
      var bestBgGid = -1, bestD = Infinity;
      for (var bgGid = 1; bgGid <= bgLabel.count; bgGid++) {
        if (!bgGroupCentroids[bgGid]) continue;
        var dx = fx - bgGroupCentroids[bgGid].x, dy = fy - bgGroupCentroids[bgGid].y;
        var d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; bestBgGid = bgGid; }
      }
      if (bestBgGid < 1) continue;

      var bgC = bgGroupColors[bestBgGid];
      var ratio = contrastRatio(fgC, bgC);
      allPairRatios.push(ratio);

      var fgPt = { x: bx + fx, y: by + fy };
      fgPoints.push(fgPt);
      fgColors.push(fgC);

      var bgCx = bgGroupCentroids[bestBgGid].x, bgCy = bgGroupCentroids[bestBgGid].y;
      var bgPt = { x: bx + Math.round(bgCx), y: by + Math.round(bgCy) };
      bgPoints.push(bgPt);
      bgColors.push(bgC);

      if (ratio < worstRatio) { worstRatio = ratio; worstBg = bgC; worstBgPt = bgPt; }
      if (ratio > bestRatio) bestRatio = ratio;
    }

    if (allPairRatios.length === 0) {
      if (pair.text) console.log('[verify-boundary] No pairs for "' + pair.text.substring(0, 25) + '"');
      return null;
    }

    var result = buildResult(pair, ctx, fgPoints, fgColors, bgPoints, bgColors,
      allPairRatios, worstRatio, bestRatio, worstBg, worstBgPt);

    if (result) {
      // Debug data for viewer overlay
      // Include expanded BG pixel positions (outside bbox) for full BG visualization
      var expBgZone = [];
      for (var i = 0; i < expBgPixels.length; i++) {
        expBgZone.push({ x: expBgPixels[i].lx, y: expBgPixels[i].ly });
      }
      result._debug = {
        bx: bx, by: by, bw: w, bh: h,
        mask: Array.from(mask.slice(0, w * h)),
        boundary: boundaryPts.length,
        fgGroups: fgLabel.count,
        bgGroups: bgLabel.count,
        zone: Array.from(zone.slice(0, w * h)),
        expBg: expBgZone, // BG pixels outside bbox (bbox-relative coords, can be negative)
        method: 'boundary'
      };
    }
    return result;
  }

  // --- Grid-based verification (legacy fallback) ---
  function verifyPairGrid(pair, sectionCanvases, meta, maskCanvas) {
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

    // --- Pixel classification ---
    // Primary: use text mask (DOM-rendered magenta-on-white) for exact text positions
    // Fallback: CSS fg distance with anti-alias exclusion zone
    var cssFg = parseRgb(pair.fg);
    if (!cssFg) return null;
    var cssBg = parseRgb(pair.bg);
    // Account for element opacity: compute expected blended pixel color
    // opacity < 1 means the rendered text = fg*opacity + bg*(1-opacity)
    var opacity = pair.effectiveOpacity !== undefined ? pair.effectiveOpacity : 1;
    var expectedFg = cssFg;
    if (opacity < 0.95 && cssBg) {
      expectedFg = {
        r: Math.round(cssFg.r * opacity + cssBg.r * (1 - opacity)),
        g: Math.round(cssFg.g * opacity + cssBg.g * (1 - opacity)),
        b: Math.round(cssFg.b * opacity + cssBg.b * (1 - opacity))
      };
    }

    var bx = Math.max(0, Math.round(canvasX));
    var by = Math.max(0, Math.round(yInSection));
    var bw = Math.min(Math.round(canvasW), sec.width - bx);
    var bh = Math.min(Math.round(canvasH), sec.height - by);
    if (bw < 4 || bh < 4) return null;

    // Read screenshot pixels for this bbox
    var imgData = sec.ctx.getImageData(bx, by, bw, bh).data;
    // Read mask pixels if available (magenta=#FF00FF = text, white=#FFFFFF = bg)
    var maskData = null;
    if (maskCanvas && maskCanvas.ctx && bx + bw <= maskCanvas.width && by + bh <= maskCanvas.height) {
      try { maskData = maskCanvas.ctx.getImageData(bx, by, bw, bh).data; } catch(e) {}
    }

    // Grid: every 1px for precise testing (TODO: revert to 2-3px after confirmation)
    var step = 1;
    var hSteps = Math.max(3, Math.min(500, Math.floor(bw / step)));
    var vSteps = Math.max(3, Math.min(500, Math.floor(bh / step)));
    var EXCL_RADIUS = 5; // pixels within this radius of text are excluded (AA/shadow zone)
    var FG_INNER_SQ = 10000; // 100^2 — catches AA text edges (purple at 73 dist from CSS FG)
    var FG_OUTER_SQ = 22500; // 150^2 — generous match for mask+color dual check

    // Pass 1: classify each grid point using mask or CSS distance
    // Store classification in a 2D array for efficient radius lookup
    var isTextGrid = new Uint8Array(hSteps * vSteps); // 0=unknown, 1=text, 2=bg
    var gridData = []; // parallel array: {r,g,b,absX,absY}

    for (var vy = 0; vy < vSteps; vy++) {
      var iy = Math.min(Math.round(bh * vy / (vSteps - 1 || 1)), bh - 1);
      for (var hx = 0; hx < hSteps; hx++) {
        var ix = Math.min(Math.round(bw * hx / (hSteps - 1 || 1)), bw - 1);
        var idx = (iy * bw + ix) * 4;
        var r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2];
        // Classify text vs background using mask as spatial guide + CSS distance
        var inTextArea = false;
        // Check if this grid point is in a text area (mask)
        // Skip bitmap mask if it captured 0 dark pixels (domToCanvas didn't render text)
        if (pair._maskBmp && pair._maskW && pair._maskDark > 0) {
          // Bitmap lookup with 1px dilation: check pixel + 8 neighbors
          // Catches AA edges that render 1px outside the mask boundary
          var mW = pair._maskW, mH = pair._maskH, mBmp = pair._maskBmp;
          if (ix >= 0 && ix < mW && iy >= 0 && iy < mH) {
            if (mBmp[iy * mW + ix] === 1) { inTextArea = true; }
            else {
              for (var dy = -1; dy <= 1 && !inTextArea; dy++) {
                for (var dx = -1; dx <= 1 && !inTextArea; dx++) {
                  var nx = ix + dx, ny = iy + dy;
                  if (nx >= 0 && nx < mW && ny >= 0 && ny < mH && mBmp[ny * mW + nx] === 1) inTextArea = true;
                }
              }
            }
          }
        } else if (pair._maskPts && pair._maskW) {
          // Legacy point list fallback
          var mkX = ix, mkY = iy, mStep = 1;
          var pts = pair._maskPts;
          for (var mp = 0; mp < pts.length; mp += 2) {
            var mdx = mkX - pts[mp], mdy = mkY - pts[mp + 1];
            if (mdx * mdx + mdy * mdy <= mStep * mStep) { inTextArea = true; break; }
          }
        } else if (maskData) {
          var mr = maskData[idx], mg = maskData[idx + 1], mb = maskData[idx + 2];
          inTextArea = (mr + mg + mb) / 3 < 220; // any non-white pixel in mask = text/AA
        } else {
          inTextArea = true; // no mask — treat entire bbox as potential text area
        }
        // Per-element mask: trust it completely (it only has THIS element's text)
        // Full-page mask or no mask: use CSS distance as classifier
        var isText = false;
        if (inTextArea) {
          if (pair.isGradientText) {
            isText = true;
          } else {
            // Closer-to-FG-or-BG: handles mixed colors in bbox + opacity mismatch
            var drF = r - expectedFg.r, dgF = g - expectedFg.g, dbF = b - expectedFg.b;
            var distFg = drF * drF + dgF * dgF + dbF * dbF;
            if (cssBg) {
              var drB = r - cssBg.r, dgB = g - cssBg.g, dbB = b - cssBg.b;
              var distBg = drB * drB + dgB * dgB + dbB * dbB;
              isText = distFg < distBg;
            } else {
              isText = true;
            }
          }
        } else if (inTextArea) {
          // Full-page mask or no mask — need CSS distance to separate mixed texts
          var dr2 = r - expectedFg.r, dg2 = g - expectedFg.g, db2 = b - expectedFg.b;
          isText = dr2 * dr2 + dg2 * dg2 + db2 * db2 < FG_INNER_SQ;
        }
        isTextGrid[vy * hSteps + hx] = isText ? 1 : 0;
        gridData.push({ r: r, g: g, b: b, absX: bx + ix, absY: by + iy });
      }
    }

    // Pass 2: for each non-text pixel, check distance to nearest text pixel
    // and mask magenta percentage in the exclusion zone
    var fgPoints = [], bgPoints = [];
    var fgColors = [], bgColors = [];

    for (var gi = 0; gi < gridData.length; gi++) {
      var gx = gi % hSteps, gy = Math.floor(gi / hSteps);
      var p = gridData[gi];

      if (isTextGrid[gi] === 1) {
        fgColors.push({ r: p.r, g: p.g, b: p.b });
        fgPoints.push({ x: p.absX, y: p.absY });
        continue;
      }

      // Check if within EXCL_RADIUS of any text pixel
      var nearText = false;
      var rSq = EXCL_RADIUS * EXCL_RADIUS;
      for (var dy = -EXCL_RADIUS; dy <= EXCL_RADIUS && !nearText; dy++) {
        var ny = gy + dy;
        if (ny < 0 || ny >= vSteps) continue;
        for (var dx = -EXCL_RADIUS; dx <= EXCL_RADIUS && !nearText; dx++) {
          var nx = gx + dx;
          if (nx < 0 || nx >= hSteps) continue;
          if (dx * dx + dy * dy > rSq) continue; // circular radius
          if (isTextGrid[ny * hSteps + nx] === 1) nearText = true;
        }
      }
      if (nearText) continue; // AA/shadow zone — skip

      // If mask available, also check magenta % at this pixel
      if (maskData) {
        var mIdx = ((Math.min(Math.round(bh * gy / (vSteps - 1 || 1)), bh - 1)) * bw + Math.min(Math.round(bw * gx / (hSteps - 1 || 1)), bw - 1)) * 4;
        var mmr = maskData[mIdx], mmg = maskData[mIdx + 1], mmb = maskData[mIdx + 2];
        // Pure white = background (R>250, G>250, B>250)
        var isPureWhite = mmr > 250 && mmg > 250 && mmb > 250;
        if (!isPureWhite) {
          // Has some magenta tint — likely shadow/AA. Calculate magenta %
          var magentaStrength = (mmr + mmb) / 2 - mmg; // high = more magenta
          if (magentaStrength > 30) continue; // >15% magenta influence — skip
        }
      }

      bgColors.push({ r: p.r, g: p.g, b: p.b });
      bgPoints.push({ x: p.absX, y: p.absY });
    }

    if (fgColors.length === 0 || bgColors.length === 0) {
      if (fgColors.length === 0 && pair.text) console.log('[verify] No FG pixels for "' + pair.text.substring(0, 30) + '" mask:' + !!(pair._maskBmp) + ' dark:' + (pair._maskDark || 0) + ' bw:' + bw + ' bh:' + bh);
      return null;
    }

    // Cluster-max FG pixels: replace each FG pixel's color with the one furthest
    // from the BG in its 3px neighborhood. This picks the "strongest" text color,
    // filtering out AA edge blending that pulls colors toward the background.
    var CLUSTER_R = 3;
    var clusteredFgColors = fgColors.map(function(c, i) {
      var fp = fgPoints[i];
      var bestColor = c, bestDist = 0;
      if (cssBg) {
        fgPoints.forEach(function(op, oi) {
          var dx = fp.x - op.x, dy = fp.y - op.y;
          if (dx * dx + dy * dy <= CLUSTER_R * CLUSTER_R) {
            var nc = fgColors[oi];
            var dr = nc.r - cssBg.r, dg = nc.g - cssBg.g, db = nc.b - cssBg.b;
            var dist = dr * dr + dg * dg + db * db;
            if (dist > bestDist) { bestDist = dist; bestColor = nc; }
          }
        });
      }
      return bestColor;
    });

    // Global average FG color
    var fgColor = { r: 0, g: 0, b: 0 };
    clusteredFgColors.forEach(function(c) { fgColor.r += c.r; fgColor.g += c.g; fgColor.b += c.b; });
    fgColor.r = Math.round(fgColor.r / clusteredFgColors.length);
    fgColor.g = Math.round(fgColor.g / clusteredFgColors.length);
    fgColor.b = Math.round(fgColor.b / clusteredFgColors.length);

    // Pair each FG pixel with its nearest BG pixel using CLUSTERED fg colors
    var worstRatio = 99, bestRatio = 0, worstBg = null, worstBgPt = null;
    var allPairRatios = [];
    var pairedFg = [], pairedFgColors = [];
    var pairedBg = [], pairedBgColors = [];
    var usedBgSet = {};

    fgPoints.forEach(function(fp, fi) {
      var nearDist = Infinity, nearIdx = -1;
      bgPoints.forEach(function(bp, bi) {
        var dx = fp.x - bp.x, dy = fp.y - bp.y;
        var d = dx * dx + dy * dy;
        if (d < nearDist) { nearDist = d; nearIdx = bi; }
      });
      if (nearIdx < 0) return;
      pairedFg.push(fp);
      pairedFgColors.push(clusteredFgColors[fi]);
      if (!usedBgSet[nearIdx]) {
        usedBgSet[nearIdx] = true;
        pairedBg.push(bgPoints[nearIdx]);
        pairedBgColors.push(bgColors[nearIdx]);
      }
      var ratio = contrastRatio(clusteredFgColors[fi], bgColors[nearIdx]);
      allPairRatios.push(ratio);
      if (ratio < worstRatio) { worstRatio = ratio; worstBg = bgColors[nearIdx]; worstBgPt = bgPoints[nearIdx]; }
      if (ratio > bestRatio) bestRatio = ratio;
    });

    // Replace arrays with only paired data
    fgPoints = pairedFg; fgColors = pairedFgColors;

    var avgBg = { r: 0, g: 0, b: 0 };
    pairedBgColors.forEach(function(c) { avgBg.r += c.r; avgBg.g += c.g; avgBg.b += c.b; });
    if (pairedBgColors.length > 0) {
      avgBg.r = Math.round(avgBg.r / pairedBgColors.length);
      avgBg.g = Math.round(avgBg.g / pairedBgColors.length);
      avgBg.b = Math.round(avgBg.b / pairedBgColors.length);
    }
    var avgRatio = contrastRatio(fgColor, avgBg);

    // Percentile contrast: P10 = ratio that 90% of pairs meet or exceed
    allPairRatios.sort(function(a, b) { return a - b; });
    var p10Idx = Math.floor(allPairRatios.length * 0.1);
    var p10Ratio = allPairRatios.length > 0 ? Math.round(allPairRatios[Math.min(p10Idx, allPairRatios.length - 1)] * 100) / 100 : 0;
    var medianRatio = allPairRatios.length > 0 ? Math.round(allPairRatios[Math.floor(allPairRatios.length / 2)] * 100) / 100 : 0;

    var pixelRatio = worstRatio;
    var cssRatio = pair.ratio;

    var cssNeeded = pair.needed || 4.5;
    var cssPasses = cssRatio >= cssNeeded;
    // Use P10 (not worst) for pass/fail — a few AA edge pixels failing doesn't
    // mean the text fails. P10 = "90% of text-bg pairs meet this ratio"
    var pixelPasses = p10Ratio >= cssNeeded;
    var ratioDiff = Math.abs(p10Ratio - cssRatio);
    var crossesBoundary = cssPasses !== pixelPasses;

    // Flag high BG variance as a signal for photo/gradient backgrounds
    var bgVariance = bestRatio - worstRatio;
    var isVariableBg = bgVariance > 2.0;

    return {
      cssRatio: cssRatio,
      neededRatio: cssNeeded,
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
      expectedFg: rgbStr(expectedFg),
      effectiveOpacity: opacity,
      pixelRatioP10: p10Ratio,       // 10th percentile: 90% of pairs meet this
      pixelRatioMedian: medianRatio,  // median: typical pair contrast
      pixelBgWorst: rgbStr(worstBg),
      pixelBgAvg: rgbStr(avgBg),
      cssFg: pair.fg,
      cssBg: pair.bg,
      selector: pair.selector,
      text: pair.text,
      bbox: pair.bbox,
      maskLayer: pair._maskLayer || 0,
      sectionIdx: sectionIdx,
      sampleCount: { fg: fgPoints.length, bg: pairedBg.length },
      samplePoints: {
        fg: fgPoints.map(function(p, i) { return { x: p.x, y: p.y, r: fgColors[i].r, g: fgColors[i].g, b: fgColors[i].b }; }),
        bg: pairedBg.map(function(p, i) {
          var ratio = contrastRatio(fgColor, pairedBgColors[i]);
          return { x: p.x, y: p.y, r: pairedBgColors[i].r, g: pairedBgColors[i].g, b: pairedBgColors[i].b, ratio: Math.round(ratio * 100) / 100 };
        })
      },
      avgFg: fgColor,
      worstPoint: worstBgPt || null
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

    // Load screenshot + optional text mask in parallel
    var sectionCanvases = new Array(raw.screenshots.length);
    var maskCanvasData = null;
    var loaded = 0;
    var toLoad = raw.screenshots.length + (raw.textMask ? 1 : 0);

    function onAllLoaded() {
      var results = [];
      var _vStats = { total: pairs.length, verified: 0, noFgBg: 0, tooSmall: 0, outOfBounds: 0 };
      // Find pair index in the full contrastPairs array (mask uses this index for encoding)
      var allPairs = (raw.colors && raw.colors.contrastPairs) || [];
      pairs.forEach(function(pair) {
        var result = verifyPair(pair, sectionCanvases, meta, maskCanvasData);
        if (result) { results.push(result); _vStats.verified++; }
        else _vStats.noFgBg++;
      });
      console.log('[verify] Stats:', JSON.stringify(_vStats), 'mask:', !!maskCanvasData, 'totalPairs:', allPairs.length, 'withBbox:', pairs.length);
      results.sort(function(a, b) {
        if (a.crossesBoundary !== b.crossesBoundary) return a.crossesBoundary ? -1 : 1;
        return b.ratioDiff - a.ratioDiff;
      });
      callback(results);
    }

    raw.screenshots.forEach(function(dataUri, idx) {
      loadScreenshotToCanvas(dataUri, function(sec) {
        sectionCanvases[idx] = sec;
        loaded++;
        if (loaded === toLoad) onAllLoaded();
      });
    });

    if (raw.textMask) {
      loadScreenshotToCanvas(raw.textMask, function(mc) {
        maskCanvasData = mc;
        loaded++;
        if (loaded === toLoad) onAllLoaded();
      });
    }
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
    setEdgeMethod: setEdgeMethod,
    edgeMethods: EDGE_METHODS,
    _findBoundary: findBoundary, // exposed for debug layer viewer
    _bfsBoundaryDist: bfsBoundaryDist,
    formatResult: formatResult,
    buildSummary: buildSummary,
    renderSummaryHtml: renderSummaryHtml,
    contrastRatio: contrastRatio,
    parseRgb: parseRgb
  };
})();
