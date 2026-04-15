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
    var cropOX = meta.cropOffsetX || 0, cropOY = meta.cropOffsetY || 0;
    var canvasX = pair.bbox.left * scale - cropOX, canvasY = pair.bbox.top * scale - cropOY;
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
    // Always skip at least 1 worst sample — for small elements (n<10),
    // floor(n*0.1)=0 degrades P10 to worst-case, letting AA fringe pixels dominate.
    var p10Idx = Math.max(1, Math.floor(allPairRatios.length * 0.1));
    var p10Ratio = allPairRatios.length > 0 ? Math.round(allPairRatios[Math.min(p10Idx, allPairRatios.length - 1)] * 100) / 100 : 0;
    var medianRatio = allPairRatios.length > 0 ? Math.round(allPairRatios[Math.floor(allPairRatios.length / 2)] * 100) / 100 : 0;
    var cssNeeded = pair.needed || 4.5;
    var cssPasses = pair.ratio >= cssNeeded;
    var pixelPasses = p10Ratio >= cssNeeded;
    var ratioDiff = Math.abs(p10Ratio - pair.ratio);
    var bgVariance = bestRatio - worstRatio;
    // Distinguish real BG variance (gradient/photo) from FG AA pixel variance on solid BG
    // Measure actual pixel color spread for both FG and BG samples
    var bgColorSpread = 0, fgColorSpread = 0;
    if (bgColors.length > 1) {
      var bgMinR = 255, bgMaxR = 0, bgMinG = 255, bgMaxG = 0, bgMinB = 255, bgMaxB = 0;
      bgColors.forEach(function(c) {
        if (c.r < bgMinR) bgMinR = c.r; if (c.r > bgMaxR) bgMaxR = c.r;
        if (c.g < bgMinG) bgMinG = c.g; if (c.g > bgMaxG) bgMaxG = c.g;
        if (c.b < bgMinB) bgMinB = c.b; if (c.b > bgMaxB) bgMaxB = c.b;
      });
      bgColorSpread = Math.max(bgMaxR - bgMinR, bgMaxG - bgMinG, bgMaxB - bgMinB);
    }
    if (fgColors.length > 1) {
      var fgMinR = 255, fgMaxR = 0, fgMinG = 255, fgMaxG = 0, fgMinB = 255, fgMaxB = 0;
      fgColors.forEach(function(c) {
        if (c.r < fgMinR) fgMinR = c.r; if (c.r > fgMaxR) fgMaxR = c.r;
        if (c.g < fgMinG) fgMinG = c.g; if (c.g > fgMaxG) fgMaxG = c.g;
        if (c.b < fgMinB) fgMinB = c.b; if (c.b > fgMaxB) fgMaxB = c.b;
      });
      fgColorSpread = Math.max(fgMaxR - fgMinR, fgMaxG - fgMinG, fgMaxB - fgMinB);
    }
    // Variable BG: BG pixels actually differ significantly (gradient/photo)
    // FG AA variance: BG is uniform but FG varies from sub-pixel antialiasing
    var isVariableBg = bgVariance > 3.0 && bgColorSpread > 15;
    var isFgAaVariance = bgVariance > 3.0 && bgColorSpread <= 15 && fgColorSpread > 10;
    return {
      cssRatio: pair.ratio, neededRatio: cssNeeded,
      pixelRatio: p10Ratio, pixelRatioWorst: worstRatio, pixelRatioAvg: avgRatio, pixelRatioBest: bestRatio,
      bgVariance: Math.round(bgVariance * 100) / 100,
      bgColorSpread: bgColorSpread, fgColorSpread: fgColorSpread,
      isVariableBg: isVariableBg, isFgAaVariance: isFgAaVariance, ratioDiff: ratioDiff,
      cssPasses: cssPasses, pixelPasses: pixelPasses,
      crossesBoundary: cssPasses !== pixelPasses,
      // Skip flagging high-contrast pairs (P10 > 12.5:1 and CSS > 12.5:1) — excellent regardless of variance
      significant: (p10Ratio > 12.5 && pair.ratio > 12.5) ? false : ((cssPasses !== pixelPasses) || ratioDiff > 1.5 || bgVariance > 3.0),
      pixelFg: rgbStr(fgColor), expectedFg: rgbStr(ctx.expectedFg), effectiveOpacity: ctx.opacity,
      pixelRatioP10: p10Ratio, pixelRatioMedian: medianRatio,
      pixelBgWorst: worstBg ? rgbStr(worstBg) : '', pixelBgAvg: rgbStr(avgBg),
      cssFg: pair.fg, cssBg: pair.bg, selector: pair.selector, text: pair.text,
      bbox: pair.bbox, maskLayer: pair._maskLayer || 0, sectionIdx: ctx.sectionIdx,
      sampleCount: { fg: fgPoints.length, bg: bgPoints.length },
      samplePoints: {
        fg: fgPoints.map(function(p, i) {
          var r = contrastRatio(fgColors[i], bgColors[i]);
          return { x: p.x, y: p.y, r: fgColors[i].r, g: fgColors[i].g, b: fgColors[i].b,
                   bgR: bgColors[i].r, bgG: bgColors[i].g, bgB: bgColors[i].b,
                   bgX: bgPoints[i].x, bgY: bgPoints[i].y,
                   ratio: Math.round(r * 100) / 100 };
        }),
        bg: bgPoints.map(function(p, i) {
          return { x: p.x, y: p.y, r: bgColors[i].r, g: bgColors[i].g, b: bgColors[i].b };
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

    // Unpack base64 bit-packed bitmap if needed
    if (pair._maskPacked && typeof pair._maskBmp === 'string') {
      var _bin = atob(pair._maskBmp);
      var _total = pair._maskW * pair._maskH;
      var _unpacked = new Uint8Array(_total);
      for (var _ui = 0; _ui < _total; _ui++) {
        _unpacked[_ui] = (_bin.charCodeAt(_ui >> 3) >> (_ui & 7)) & 1;
      }
      pair._maskBmp = _unpacked;
      pair._maskPacked = false;
    }
    var mBmpRaw = pair._maskBmp, mW = pair._maskW, mH = pair._maskH;
    var w = Math.min(mW, bw), h = Math.min(mH, bh);
    if (w < 4 || h < 4) return null;

    // Constants — scaled with screenshot resolution (1.5x)
    var FG_IDEAL = 2;      // prefer 2px inside boundary (skip AA fringe)
    var BG_DIST_MIN = 2;   // BG ring: 2-4px outside boundary (was 5-7, too far)
    var BG_DIST_MAX = 4;
    var MAX_DIST = BG_DIST_MAX + 3;
    var FG_CLUSTER_R = 6;  // cluster averaging radius

    // Read expanded area from screenshot for BG sampling outside bbox
    var PAD = BG_DIST_MAX + 2;
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

    // Step 4: Classify FG as a single-pixel inset line + BG ring.
    //
    // Strategy: for each mask pixel, pick it as FG only if it's at
    // exactly the target depth for its location. Target depth =
    // FG_IDEAL (2px) if the stroke is thick enough, else the deepest
    // available (1px, or boundary for very thin strokes like small E/N).
    //
    // For tight spaces (boundary on 3+ cardinal sides), there's no room
    // for inner pixels — use boundary pixels directly as FG.

    var zone = new Uint8Array(w * h);

    // Pass 1: classify BG
    for (var i = 0; i < w * h; i++) {
      if (!mask[i] && dist[i] >= BG_DIST_MIN && dist[i] <= BG_DIST_MAX) zone[i] = 3;
      if (cat[i] === 1) zone[i] = 1; // boundary
    }

    // Pass 2: for each mask pixel, determine if it should be FG.
    // Pick the pixel at exactly the ideal depth. If no pixel at that depth
    // exists locally (thin stroke), pick the deepest available ≥ 1.
    // For very tight spaces, promote boundary to FG.
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var mi = y * w + x;
        if (!mask[mi] || cat[mi] === 1) continue;
        var dd = dist[mi];
        if (dd < 1 || dd > 255) continue;

        // Count boundary pixels on cardinal sides (tight space detection)
        var boundaryCardinals = 0;
        if (y > 0 && cat[(y-1)*w+x] === 1) boundaryCardinals++;
        if (y < h-1 && cat[(y+1)*w+x] === 1) boundaryCardinals++;
        if (x > 0 && cat[mi-1] === 1) boundaryCardinals++;
        if (x < w-1 && cat[mi+1] === 1) boundaryCardinals++;

        if (boundaryCardinals >= 3) {
          // Very tight space — boundary on 3+ sides, use this pixel as FG
          zone[mi] = 2;
        } else if (dd === FG_IDEAL) {
          // At ideal depth — always use
          zone[mi] = 2;
        }
      }
    }

    // Pass 3: fallback for areas with no FG at ideal depth (thin strokes).
    // For each boundary pixel, check if any FG pixel exists within 3px.
    // If not, promote the deepest inside pixel adjacent to that boundary.
    var fgCount = 0;
    for (var i = 0; i < w * h; i++) { if (zone[i] === 2) fgCount++; }

    if (fgCount === 0) {
      // No FG at all — promote deepest inside or boundary
      var maxInnerDist = 0;
      for (var i = 0; i < w * h; i++) {
        if (mask[i] && cat[i] !== 1 && dist[i] < 255 && dist[i] > maxInnerDist) maxInnerDist = dist[i];
      }
      if (maxInnerDist >= 1) {
        for (var i = 0; i < w * h; i++) {
          if (mask[i] && dist[i] === maxInnerDist) zone[i] = 2;
        }
      } else {
        // 1px wide text — boundary is all we have
        for (var i = 0; i < w * h; i++) { if (cat[i] === 1) zone[i] = 2; }
      }
    } else {
      // Check for boundary pixels without nearby FG — promote dist=1 pixels there
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          if (cat[y * w + x] !== 1) continue;
          // Check 3px radius for any FG pixel
          var hasFgNearby = false;
          for (var dy = -3; dy <= 3 && !hasFgNearby; dy++) {
            var ny = y + dy; if (ny < 0 || ny >= h) continue;
            for (var dx = -3; dx <= 3 && !hasFgNearby; dx++) {
              var nx = x + dx; if (nx < 0 || nx >= w) continue;
              if (zone[ny * w + nx] === 2) hasFgNearby = true;
            }
          }
          if (!hasFgNearby) {
            // No FG near this boundary — promote adjacent inside pixels at dist 1
            for (var dy = -1; dy <= 1; dy++) {
              var ny = y + dy; if (ny < 0 || ny >= h) continue;
              for (var dx = -1; dx <= 1; dx++) {
                var nx = x + dx; if (nx < 0 || nx >= w) continue;
                var ni = ny * w + nx;
                if (mask[ni] && dist[ni] >= 1 && zone[ni] === 0) zone[ni] = 2;
              }
            }
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

    // Helper: read pixel color from expanded imgData given bbox-relative coords
    function readPixel(lx, ly) {
      var ix = lx + padL, iy = ly + padT;
      if (ix < 0 || ix >= ew || iy < 0 || iy >= eh) return null;
      var pi = (iy * ew + ix) * 4;
      if (pi + 2 >= imgDataExp.length) return null;
      return { r: imgDataExp[pi], g: imgDataExp[pi+1], b: imgDataExp[pi+2] };
    }

    // Step 5: Collect FG + BG pixels, cluster-average FG, compute contrast

    // Search radius: FG can be at most FG_MAX inside, BG at BG_DIST_MAX outside.
    // Add margin for diagonal paths. Always local to the text edge.
    var BG_SEARCH_R = FG_IDEAL + BG_DIST_MAX + 6; // ~12px

    // Collect all FG pixel positions + raw colors
    var allFg = []; // [{idx, lx, ly, r, g, b}]
    for (var i = 0; i < w * h; i++) {
      if (zone[i] !== 2) continue;
      var fx = i % w, fy = (i - fx) / w;
      var c = readPixel(fx, fy);
      if (c) allFg.push({ idx: i, lx: fx, ly: fy, r: c.r, g: c.g, b: c.b });
    }

    // Collect all BG pixels (inside bbox + expanded)
    var allBgPixels = [];
    for (var i = 0; i < w * h; i++) {
      if (zone[i] === 3) {
        var bpx = i % w, bpy = (i - bpx) / w;
        var bc = readPixel(bpx, bpy);
        if (bc) allBgPixels.push({ lx: bpx, ly: bpy, r: bc.r, g: bc.g, b: bc.b });
      }
    }
    for (var i = 0; i < expBgPixels.length; i++) {
      allBgPixels.push(expBgPixels[i]);
    }

    if (allFg.length === 0 || allBgPixels.length === 0) {
      return null;
    }

    // Step 5a: Cluster-average each FG pixel's color within FG_CLUSTER_R radius.
    // This smooths out AA noise: each pixel's color = average of nearby FG pixels.
    var fgCellSz = FG_CLUSTER_R;
    var fgGCols = Math.ceil(w / fgCellSz), fgGRows = Math.ceil(h / fgCellSz);
    var fgGrid = new Array(fgGCols * fgGRows);
    for (var gi = 0; gi < fgGrid.length; gi++) fgGrid[gi] = [];
    for (var fi = 0; fi < allFg.length; fi++) {
      var gx = Math.floor(allFg[fi].lx / fgCellSz);
      var gy = Math.floor(allFg[fi].ly / fgCellSz);
      if (gx >= 0 && gx < fgGCols && gy >= 0 && gy < fgGRows) fgGrid[gy * fgGCols + gx].push(fi);
    }

    var fgSmoothed = []; // [{lx, ly, r, g, b}] — cluster-averaged colors
    for (var fi = 0; fi < allFg.length; fi++) {
      var fp = allFg[fi];
      var gcx = Math.floor(fp.lx / fgCellSz), gcy = Math.floor(fp.ly / fgCellSz);
      var sR = 0, sG = 0, sB = 0, cnt = 0;
      for (var gdy = -1; gdy <= 1; gdy++) {
        var ry = gcy + gdy; if (ry < 0 || ry >= fgGRows) continue;
        for (var gdx = -1; gdx <= 1; gdx++) {
          var rx = gcx + gdx; if (rx < 0 || rx >= fgGCols) continue;
          var cell = fgGrid[ry * fgGCols + rx];
          for (var ci = 0; ci < cell.length; ci++) {
            var op = allFg[cell[ci]];
            var ddx = op.lx - fp.lx, ddy = op.ly - fp.ly;
            if (ddx * ddx + ddy * ddy <= FG_CLUSTER_R * FG_CLUSTER_R) {
              sR += op.r; sG += op.g; sB += op.b; cnt++;
            }
          }
        }
      }
      cnt = cnt || 1;
      fgSmoothed.push({ lx: fp.lx, ly: fp.ly, r: Math.round(sR / cnt), g: Math.round(sG / cnt), b: Math.round(sB / cnt) });
    }

    // Step 5b: Outlier removal — compute median FG color, reject pixels too far from it
    // Sort by luminance to find median
    var fgLums = fgSmoothed.map(function(p) { return 0.299 * p.r + 0.587 * p.g + 0.114 * p.b; });
    fgLums.sort(function(a, b) { return a - b; });
    var medianLum = fgLums[Math.floor(fgLums.length / 2)];
    var lumThreshold = 40; // reject pixels with luminance > 40 away from median

    var fgClean = [];
    for (var fi = 0; fi < fgSmoothed.length; fi++) {
      var lum = 0.299 * fgSmoothed[fi].r + 0.587 * fgSmoothed[fi].g + 0.114 * fgSmoothed[fi].b;
      if (Math.abs(lum - medianLum) <= lumThreshold) {
        fgClean.push(fgSmoothed[fi]);
      }
    }
    // Fall back to all if too many rejected
    if (fgClean.length < allFg.length * 0.3) fgClean = fgSmoothed;

    // Step 5c: Cluster BG pixels into small 4px grid cells, average each cell.
    // Each cell becomes one BG sample point with an averaged color.
    var BG_CELL = 4; // 4px clusters (~2.7 CSS px at 1.5x scale)
    var bgCellCols = Math.ceil((w + PAD * 2) / BG_CELL);
    var bgCellRows = Math.ceil((h + PAD * 2) / BG_CELL);
    var bgCells = []; // [{cx, cy, r, g, b, n}] — averaged BG clusters
    var bgCellMap = new Array(bgCellCols * bgCellRows);
    for (var gi = 0; gi < bgCellMap.length; gi++) bgCellMap[gi] = null;

    for (var bi = 0; bi < allBgPixels.length; bi++) {
      var bp = allBgPixels[bi];
      var gcx = Math.floor((bp.lx + PAD) / BG_CELL);
      var gcy = Math.floor((bp.ly + PAD) / BG_CELL);
      if (gcx < 0 || gcx >= bgCellCols || gcy < 0 || gcy >= bgCellRows) continue;
      var ci = gcy * bgCellCols + gcx;
      if (!bgCellMap[ci]) {
        bgCellMap[ci] = { sumR: 0, sumG: 0, sumB: 0, sumX: 0, sumY: 0, n: 0, idx: bgCells.length };
        bgCells.push(null); // placeholder
      }
      var cm = bgCellMap[ci];
      cm.sumR += bp.r; cm.sumG += bp.g; cm.sumB += bp.b;
      cm.sumX += bp.lx; cm.sumY += bp.ly; cm.n++;
    }
    // Finalize BG clusters
    for (var gi = 0; gi < bgCellMap.length; gi++) {
      var cm = bgCellMap[gi];
      if (!cm) continue;
      bgCells[cm.idx] = {
        cx: Math.round(cm.sumX / cm.n), cy: Math.round(cm.sumY / cm.n),
        r: Math.round(cm.sumR / cm.n), g: Math.round(cm.sumG / cm.n), b: Math.round(cm.sumB / cm.n),
        n: cm.n
      };
    }
    bgCells = bgCells.filter(function(c) { return c !== null; });

    // Build spatial index for BG clusters (for fast range search)
    var bgClustCellSz = Math.max(BG_SEARCH_R, 10);
    var bgClustCols = Math.ceil((w + PAD * 2) / bgClustCellSz);
    var bgClustRows = Math.ceil((h + PAD * 2) / bgClustCellSz);
    var bgClustGrid = new Array(bgClustCols * bgClustRows);
    for (var gi = 0; gi < bgClustGrid.length; gi++) bgClustGrid[gi] = [];
    for (var ci = 0; ci < bgCells.length; ci++) {
      var gc = bgCells[ci];
      var gx = Math.floor((gc.cx + PAD) / bgClustCellSz);
      var gy = Math.floor((gc.cy + PAD) / bgClustCellSz);
      if (gx >= 0 && gx < bgClustCols && gy >= 0 && gy < bgClustRows) {
        bgClustGrid[gy * bgClustCols + gx].push(ci);
      }
    }

    // Step 5d: Each FG pixel → closest BG cluster → one stored pair.
    // Also compute ratios against all BG clusters in range for stats.
    var fgPoints = [], fgColors = [];
    var bgPoints = [], bgColors = [];
    var allPairRatios = [];
    var worstRatio = 99, bestRatio = 0, worstBg = null, worstBgPt = null;
    var searchR2 = BG_SEARCH_R * BG_SEARCH_R;

    for (var fi = 0; fi < fgClean.length; fi++) {
      var fp = fgClean[fi];
      var gcx = Math.floor((fp.lx + PAD) / bgClustCellSz);
      var gcy = Math.floor((fp.ly + PAD) / bgClustCellSz);

      var closestBc = null, closestD2 = Infinity;

      for (var gdy = -2; gdy <= 2; gdy++) {
        var ry = gcy + gdy; if (ry < 0 || ry >= bgClustRows) continue;
        for (var gdx = -2; gdx <= 2; gdx++) {
          var rx = gcx + gdx; if (rx < 0 || rx >= bgClustCols) continue;
          var cell = bgClustGrid[ry * bgClustCols + rx];
          for (var ki = 0; ki < cell.length; ki++) {
            var bc = bgCells[cell[ki]];
            var ddx = bc.cx - fp.lx, ddy = bc.cy - fp.ly;
            var d2 = ddx * ddx + ddy * ddy;
            if (d2 < closestD2) { closestD2 = d2; closestBc = bc; }
          }
        }
      }
      if (!closestBc) continue;

      // Store the closest BG match for this FG pixel
      var ratio = contrastRatio(fp, closestBc);
      allPairRatios.push(ratio);
      fgPoints.push({ x: bx + fp.lx, y: by + fp.ly });
      fgColors.push(fp);
      bgPoints.push({ x: bx + closestBc.cx, y: by + closestBc.cy });
      bgColors.push(closestBc);

      if (ratio < worstRatio) { worstRatio = ratio; worstBg = closestBc; worstBgPt = { x: bx + closestBc.cx, y: by + closestBc.cy }; }
      if (ratio > bestRatio) bestRatio = ratio;
    }

    if (allPairRatios.length === 0) {
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
        fgCount: allFg.length,
        bgCount: allBgPixels.length,
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
      try { maskData = maskCanvas.ctx.getImageData(bx, by, bw, bh).data; } catch(e) { console.warn('[milg-warn] Mask getImageData failed:', e.message); }
    }

    var step = 2;
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
          // Unpack base64 bit-packed bitmap if needed (snippet stores compressed)
          if (pair._maskPacked && typeof pair._maskBmp === 'string') {
            var _bin = atob(pair._maskBmp);
            var _total = pair._maskW * pair._maskH;
            var _unpacked = new Uint8Array(_total);
            for (var _ui = 0; _ui < _total; _ui++) {
              _unpacked[_ui] = (_bin.charCodeAt(_ui >> 3) >> (_ui & 7)) & 1;
            }
            pair._maskBmp = _unpacked;
            pair._maskPacked = false;
          }
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
          // No mask — use position heuristic + CSS distance. Center region is more
          // likely text, edges are more likely background. This ensures both FG and
          // BG samples when no mask is available (fallback).
          var relX = hx / (hSteps - 1 || 1), relY = vy / (vSteps - 1 || 1);
          inTextArea = (relX > 0.15 && relX < 0.85 && relY > 0.15 && relY < 0.85);
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
    // Always skip at least 1 worst sample (see buildResult comment)
    var p10Idx = Math.max(1, Math.floor(allPairRatios.length * 0.1));
    var p10Ratio = allPairRatios.length > 0 ? Math.round(allPairRatios[Math.min(p10Idx, allPairRatios.length - 1)] * 100) / 100 : 0;
    var medianRatio = allPairRatios.length > 0 ? Math.round(allPairRatios[Math.floor(allPairRatios.length / 2)] * 100) / 100 : 0;

    var pixelRatio = p10Ratio;
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
    // Distinguish real BG variance from FG AA variance — sample both FG and BG spread
    var bgColorSpread = 0, fgColorSpread = 0;
    if (pairedBgColors.length > 1) {
      var bgMinR = 255, bgMaxR = 0, bgMinG = 255, bgMaxG = 0, bgMinB = 255, bgMaxB = 0;
      pairedBgColors.forEach(function(c) {
        if (c.r < bgMinR) bgMinR = c.r; if (c.r > bgMaxR) bgMaxR = c.r;
        if (c.g < bgMinG) bgMinG = c.g; if (c.g > bgMaxG) bgMaxG = c.g;
        if (c.b < bgMinB) bgMinB = c.b; if (c.b > bgMaxB) bgMaxB = c.b;
      });
      bgColorSpread = Math.max(bgMaxR - bgMinR, bgMaxG - bgMinG, bgMaxB - bgMinB);
    }
    if (pairedFgColors.length > 1) {
      var fgMinR = 255, fgMaxR = 0, fgMinG = 255, fgMaxG = 0, fgMinB = 255, fgMaxB = 0;
      pairedFgColors.forEach(function(c) {
        if (c.r < fgMinR) fgMinR = c.r; if (c.r > fgMaxR) fgMaxR = c.r;
        if (c.g < fgMinG) fgMinG = c.g; if (c.g > fgMaxG) fgMaxG = c.g;
        if (c.b < fgMinB) fgMinB = c.b; if (c.b > fgMaxB) fgMaxB = c.b;
      });
      fgColorSpread = Math.max(fgMaxR - fgMinR, fgMaxG - fgMinG, fgMaxB - fgMinB);
    }
    var isVariableBg = bgVariance > 3.0 && bgColorSpread > 15;
    var isFgAaVariance = bgVariance > 3.0 && bgColorSpread <= 15 && fgColorSpread > 10;

    return {
      cssRatio: cssRatio,
      neededRatio: cssNeeded,
      pixelRatio: pixelRatio,         // P10 (10th percentile — robust against AA fringe)
      pixelRatioWorst: worstRatio,    // absolute worst-case
      pixelRatioAvg: avgRatio,        // average background
      pixelRatioBest: bestRatio,      // best-case spot
      bgVariance: Math.round(bgVariance * 100) / 100,
      bgColorSpread: bgColorSpread, fgColorSpread: fgColorSpread,
      isVariableBg: isVariableBg,     // photo/gradient detected
      isFgAaVariance: isFgAaVariance, // ratio spread from FG antialiasing, not BG
      ratioDiff: ratioDiff,
      cssPasses: cssPasses,
      pixelPasses: pixelPasses,
      crossesBoundary: crossesBoundary,
      significant: (p10Ratio > 12.5 && cssRatio > 12.5) ? false : (crossesBoundary || ratioDiff > 1.5 || isVariableBg),
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

  // --- BBox Edge Contrast Verification ---
  // Samples pixels along element bbox edges (inside strip vs outside strip)
  // to check if the element visually stands out from its surroundings.
  // Returns WARNING-level results since border/outline can provide distinction.
  var EDGE_INNER_DIST = 3;   // sample 3px inside bbox edge
  var EDGE_OUTER_DIST = 5;   // sample up to 5px outside bbox edge
  var EDGE_SAMPLE_STEP = 4;  // sample every 4px along edges
  var EDGE_WARN_RATIO = 1.15; // below this ratio = element blends into bg

  function verifyBboxEdge(entry, sectionCanvases, meta) {
    if (!entry.bbox || !meta) return null;
    var scale = meta.scale;
    var sectionH = Math.round(meta.viewportHeight * scale);
    var bx = Math.round(entry.bbox.left * scale);
    var by = Math.round(entry.bbox.top * scale);
    var bw = Math.round(entry.bbox.width * scale);
    var bh = Math.round(entry.bbox.height * scale);
    if (bw < 8 || bh < 8) return null;

    var sectionIdx, yInSection;
    if (sectionCanvases.length === 1) { sectionIdx = 0; yInSection = by; }
    else { sectionIdx = Math.floor(by / sectionH); yInSection = by - (sectionIdx * sectionH); }
    if (sectionIdx >= sectionCanvases.length || !sectionCanvases[sectionIdx]) return null;

    var sec = sectionCanvases[sectionIdx];
    var PAD = EDGE_OUTER_DIST + 2;
    var padL = Math.min(PAD, bx), padT = Math.min(PAD, yInSection);
    var padR = Math.min(PAD, sec.width - bx - bw);
    var padB = Math.min(PAD, sec.height - yInSection - bh);
    var ex = bx - padL, ey = yInSection - padT;
    var ew = bw + padL + padR, eh = bh + padT + padB;
    if (ew < 1 || eh < 1 || ex + ew > sec.width || ey + eh > sec.height) return null;

    var imgData;
    try { imgData = sec.ctx.getImageData(ex, ey, ew, eh).data; }
    catch(e) { return null; }

    function readPx(absX, absY) {
      var lx = absX - ex, ly = absY - ey;
      if (lx < 0 || lx >= ew || ly < 0 || ly >= eh) return null;
      var pi = (ly * ew + lx) * 4;
      return { r: imgData[pi], g: imgData[pi+1], b: imgData[pi+2] };
    }

    // Sample along all 4 edges
    var innerColors = [], outerColors = [];
    // Top edge
    for (var x = bx + EDGE_SAMPLE_STEP; x < bx + bw - EDGE_SAMPLE_STEP; x += EDGE_SAMPLE_STEP) {
      var ic = readPx(x, yInSection + EDGE_INNER_DIST);
      var oc = readPx(x, yInSection - EDGE_OUTER_DIST);
      if (ic && oc) { innerColors.push(ic); outerColors.push(oc); }
    }
    // Bottom edge
    for (var x = bx + EDGE_SAMPLE_STEP; x < bx + bw - EDGE_SAMPLE_STEP; x += EDGE_SAMPLE_STEP) {
      var ic = readPx(x, yInSection + bh - EDGE_INNER_DIST);
      var oc = readPx(x, yInSection + bh + EDGE_OUTER_DIST);
      if (ic && oc) { innerColors.push(ic); outerColors.push(oc); }
    }
    // Left edge
    for (var y = yInSection + EDGE_SAMPLE_STEP; y < yInSection + bh - EDGE_SAMPLE_STEP; y += EDGE_SAMPLE_STEP) {
      var ic = readPx(bx + EDGE_INNER_DIST, y);
      var oc = readPx(bx - EDGE_OUTER_DIST, y);
      if (ic && oc) { innerColors.push(ic); outerColors.push(oc); }
    }
    // Right edge
    for (var y = yInSection + EDGE_SAMPLE_STEP; y < yInSection + bh - EDGE_SAMPLE_STEP; y += EDGE_SAMPLE_STEP) {
      var ic = readPx(bx + bw - EDGE_INNER_DIST, y);
      var oc = readPx(bx + bw + EDGE_OUTER_DIST, y);
      if (ic && oc) { innerColors.push(ic); outerColors.push(oc); }
    }

    if (innerColors.length < 4 || outerColors.length < 4) return null;

    // Average inner and outer colors
    var avgInner = { r: 0, g: 0, b: 0 }, avgOuter = { r: 0, g: 0, b: 0 };
    for (var i = 0; i < innerColors.length; i++) {
      avgInner.r += innerColors[i].r; avgInner.g += innerColors[i].g; avgInner.b += innerColors[i].b;
    }
    avgInner.r = Math.round(avgInner.r / innerColors.length);
    avgInner.g = Math.round(avgInner.g / innerColors.length);
    avgInner.b = Math.round(avgInner.b / innerColors.length);
    for (var i = 0; i < outerColors.length; i++) {
      avgOuter.r += outerColors[i].r; avgOuter.g += outerColors[i].g; avgOuter.b += outerColors[i].b;
    }
    avgOuter.r = Math.round(avgOuter.r / outerColors.length);
    avgOuter.g = Math.round(avgOuter.g / outerColors.length);
    avgOuter.b = Math.round(avgOuter.b / outerColors.length);

    var pixelRatio = contrastRatio(avgInner, avgOuter);

    // Also compute per-edge ratios for more detail
    var edgeRatios = [];
    var edgeLen = Math.floor(innerColors.length / 4);
    for (var e = 0; e < 4; e++) {
      var eInner = { r: 0, g: 0, b: 0 }, eOuter = { r: 0, g: 0, b: 0 }, eCnt = 0;
      for (var i = e * edgeLen; i < Math.min((e + 1) * edgeLen, innerColors.length); i++) {
        eInner.r += innerColors[i].r; eInner.g += innerColors[i].g; eInner.b += innerColors[i].b;
        eOuter.r += outerColors[i].r; eOuter.g += outerColors[i].g; eOuter.b += outerColors[i].b;
        eCnt++;
      }
      if (eCnt > 0) {
        eInner.r = Math.round(eInner.r / eCnt); eInner.g = Math.round(eInner.g / eCnt); eInner.b = Math.round(eInner.b / eCnt);
        eOuter.r = Math.round(eOuter.r / eCnt); eOuter.g = Math.round(eOuter.g / eCnt); eOuter.b = Math.round(eOuter.b / eCnt);
        edgeRatios.push(contrastRatio(eInner, eOuter));
      }
    }
    var worstEdge = edgeRatios.length > 0 ? Math.min.apply(null, edgeRatios) : pixelRatio;

    return {
      type: 'bboxEdge',
      selector: entry.selector,
      element: entry.element,
      text: entry.text,
      pixelRatio: Math.round(pixelRatio * 100) / 100,
      worstEdgeRatio: Math.round(worstEdge * 100) / 100,
      cssBgRatio: entry.cssBgRatio,
      innerColor: rgbStr(avgInner),
      outerColor: rgbStr(avgOuter),
      hasBorder: entry.hasBorder,
      hasOutline: entry.hasOutline,
      hasShadow: entry.hasShadow,
      borderColor: entry.borderColor,
      bbox: entry.bbox,
      sectionIdx: sectionIdx,
      isWarning: pixelRatio < EDGE_WARN_RATIO && !entry.hasBorder && !entry.hasOutline && !entry.hasShadow,
      sampleCount: { inner: innerColors.length, outer: outerColors.length }
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

    var allPairsWithBbox = raw.colors.contrastPairs.filter(function(p) { return p.bbox; });
    if (allPairsWithBbox.length === 0) { callback([]); return; }

    // Separate clipped/region pairs (hidden in overflow containers) — skip pixel verification
    var clippedResults = [];
    var pairs = allPairsWithBbox.filter(function(p) {
      if (p._isClipped || p._regionContainerId) {
        clippedResults.push({
          selector: p.selector,
          text: p.text,
          bbox: p.bbox,
          cssRatio: p.ratio,
          skipped: true,
          reason: 'hidden-region',
          cssPasses: p.ratio >= (p.needed || 4.5),
          neededRatio: p.needed || 4.5
        });
        return false;
      }
      return true;
    });
    if (pairs.length === 0) { callback(clippedResults); return; }

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
      results = results.concat(clippedResults);
      results.sort(function(a, b) {
        if (a.skipped !== b.skipped) return a.skipped ? 1 : -1;
        if (a.crossesBoundary !== b.crossesBoundary) return a.crossesBoundary ? -1 : 1;
        return (b.ratioDiff || 0) - (a.ratioDiff || 0);
      });
      callback(results, []); // no bbox edge results for precomputed path
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
      var _hasMask = !!maskCanvasData;
      var BATCH_SIZE = 8; // yield to event loop every N pairs so spinner animates
      var qi = 0;

      function processBatch() {
        var end = Math.min(qi + BATCH_SIZE, pairs.length);
        for (var i = qi; i < end; i++) {
          var result = verifyPair(pairs[i], sectionCanvases, meta, maskCanvasData);
          if (result) { results.push(result); _vStats.verified++; }
          else _vStats.noFgBg++;
        }
        qi = end;
        if (qi < pairs.length) {
          setTimeout(processBatch, 0);
          return;
        }
        // All pairs done — finish up
        var _maskBmpCount = pairs.filter(function(p) { return !!p._maskBmp; }).length;
        console.log('[milg-verify] Stats: mask=' + _hasMask + ' maskBmp=' + _maskBmpCount + '/' + pairs.length + ' total=' + _vStats.total + ' verified=' + _vStats.verified + ' noFgBg=' + _vStats.noFgBg + ' clippedSkipped=' + clippedResults.length);
        results = results.concat(clippedResults);
        results.sort(function(a, b) {
          if (a.skipped !== b.skipped) return a.skipped ? 1 : -1;
          if (a.crossesBoundary !== b.crossesBoundary) return a.crossesBoundary ? -1 : 1;
          return (b.ratioDiff || 0) - (a.ratioDiff || 0);
        });

        // BBox edge contrast verification
        var bboxEdgeResults = [];
        var bgEdgePairs = (raw.colors && raw.colors.bgEdgePairs) || [];
        bgEdgePairs.forEach(function(entry) {
          if (!entry.bbox) return;
          var r = verifyBboxEdge(entry, sectionCanvases, meta);
          if (r) bboxEdgeResults.push(r);
        });
        bboxEdgeResults.sort(function(a, b) { return a.pixelRatio - b.pixelRatio; });

        callback(results, bboxEdgeResults);
      }
      processBatch();
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
    if (r.skipped && r.reason === 'hidden-region') {
      return '<span style="color:#60a5fa;font-size:11px">Hidden element \u2014 see expanded view below</span>';
    }
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
    if (r.isFgAaVariance) {
      return '<span style="color:var(--text-secondary);font-size:11px">Pixel-verified: ' + r.pixelRatio + ':1 (range ' + r.pixelRatioWorst + ':1–' + r.pixelRatioBest + ':1 from font AA)</span>';
    }
    if (r.significant) {
      return '<span style="color:#f59e0b">Pixel contrast: ' + r.pixelRatio + ':1</span> ' +
        '<span style="color:var(--text-secondary);font-size:11px">(differs from CSS-derived ' + r.cssRatio + ':1 by ' + r.ratioDiff.toFixed(1) + ')</span>' + variableNote;
    }
    return '<span style="color:var(--text-secondary);font-size:11px">Pixel-verified: ' + r.pixelRatio + ':1' +
      (r.bgVariance > 0.5 ? ' (bg range: ' + r.bgVariance + ')' : '') + '</span>';
  }

  // Build a summary of verification results
  function buildSummary(results, bboxEdgeResults) {
    var skippedCount = 0;
    var total = results.length;
    var falsePassCount = 0; // CSS passes but pixels fail
    var falseFailCount = 0; // CSS fails but pixels pass
    var significantDiffs = 0;
    var variableBgCount = 0;
    var fgAaVarianceCount = 0;
    var verified = 0;

    results.forEach(function(r) {
      if (r.skipped) { skippedCount++; return; }
      if (r.isVariableBg) variableBgCount++;
      else if (r.isFgAaVariance) fgAaVarianceCount++;
      if (r.crossesBoundary) {
        if (r.cssPasses && !r.pixelPasses) falsePassCount++;
        else falseFailCount++;
      } else if (r.significant) {
        significantDiffs++;
      } else {
        verified++;
      }
    });

    // BBox edge contrast
    var bboxEdge = bboxEdgeResults || [];
    var bboxEdgeWarnings = bboxEdge.filter(function(r) { return r.isWarning; });
    var bboxEdgeChecked = bboxEdge.length;

    return {
      total: total,
      skippedCount: skippedCount,
      falsePassCount: falsePassCount,
      falseFailCount: falseFailCount,
      significantDiffs: significantDiffs,
      variableBgCount: variableBgCount,
      fgAaVarianceCount: fgAaVarianceCount,
      verified: verified,
      results: results,
      bboxEdgeResults: bboxEdge,
      bboxEdgeWarnings: bboxEdgeWarnings,
      bboxEdgeChecked: bboxEdgeChecked
    };
  }

  // Color swatch helper
  function _swatch(color, isDark) {
    if (!color) return '';
    return '<span style="display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;border:1px solid ' + (isDark ? '#555' : '#ccc') + ';background:' + color + '"></span>';
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
      html += '<p style="margin:4px 0 0;font-size:12px;color:' + (isDark ? '#fca5a5' : '#991b1b') + '">The actual rendered background differs from what CSS reports — contrast drops below the required threshold.</p>';
      summary.results.filter(function(r) { return r.cssPasses && !r.pixelPasses; }).forEach(function(r) {
        html += '<div style="margin-top:6px;padding:6px 8px;background:' + (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)') + ';border-radius:4px;font-size:12px">';
        html += '<strong>' + r.selector + '</strong>: "' + (r.text || '').substring(0, 30) + '"';
        html += '<br>CSS: ' + r.cssRatio + ':1 (pass) &rarr; Pixel: <span style="color:#ef4444;font-weight:600">' + r.pixelRatio + ':1</span> (fail, needs ' + (r.neededRatio || 4.5) + ':1)';
        // Color swatches
        html += '<br><span style="font-size:11px">FG: </span>';
        html += _swatch(r.pixelFg, isDark);
        html += '<span style="font-size:11px;color:var(--text-secondary)"> ' + (r.pixelFg || '?') + '</span>';
        html += '<span style="font-size:11px"> BG: </span>';
        html += _swatch(r.pixelBgWorst || r.pixelBgAvg, isDark);
        html += '<span style="font-size:11px;color:var(--text-secondary)"> ' + (r.pixelBgWorst || r.pixelBgAvg || '?') + '</span>';
        if (r.sampleCount) html += '<span style="font-size:10px;color:var(--text-secondary)"> (' + r.sampleCount.fg + ' FG, ' + r.sampleCount.bg + ' BG samples)</span>';
        if (r.bbox) html += '<br><a class="finding-show-on-screenshot" style="font-size:11px;cursor:pointer;color:var(--accent)" onclick="window.__milgShowVerifyOnScreenshot(\'' + (r.selector || '').replace(/'/g, "\\'") + '\')">Show on screenshot</a>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (summary.falseFailCount > 0) {
      var bg = isDark ? '#0c2d1e' : '#f0fdf4';
      var border = isDark ? '#166534' : '#bbf7d0';
      html += '<div style="padding:10px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:6px;margin-bottom:8px">';
      html += '<strong style="color:#16a34a">' + summary.falseFailCount + ' false positive' + (summary.falseFailCount > 1 ? 's' : '') + ' detected</strong>';
      html += '<p style="margin:4px 0 0;font-size:12px;color:' + (isDark ? '#86efac' : '#166534') + '">These elements fail CSS contrast but actually pass when measured from the screenshot — the real background provides better contrast.</p>';
      summary.results.filter(function(r) { return !r.cssPasses && r.pixelPasses; }).forEach(function(r) {
        html += '<div style="margin-top:6px;padding:6px 8px;background:' + (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)') + ';border-radius:4px;font-size:12px">';
        html += '<strong>' + r.selector + '</strong>: "' + (r.text || '').substring(0, 30) + '"';
        html += '<br>CSS: ' + r.cssRatio + ':1 (fail) &rarr; Pixel: <span style="color:#16a34a;font-weight:600">' + r.pixelRatio + ':1</span> (pass)';
        html += '<br><span style="font-size:11px">FG: </span>';
        html += _swatch(r.pixelFg, isDark);
        html += '<span style="font-size:11px"> BG: </span>';
        html += _swatch(r.pixelBgAvg || r.pixelBgWorst, isDark);
        if (r.bbox) html += '<br><a class="finding-show-on-screenshot" style="font-size:11px;cursor:pointer;color:var(--accent)" onclick="window.__milgShowVerifyOnScreenshot(\'' + (r.selector || '').replace(/'/g, "\\'") + '\')">Show on screenshot</a>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Variable background warning (photos, gradients) — only real BG variance
    if (summary.variableBgCount > 0) {
      var vbResults = summary.results.filter(function(r) { return r.isVariableBg; });
      var bg = isDark ? '#2d2006' : '#fffbeb';
      var border = isDark ? '#92400e' : '#fde68a';
      html += '<div style="padding:10px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:6px;margin-bottom:8px">';
      html += '<strong style="color:#f59e0b">' + summary.variableBgCount + ' element' + (summary.variableBgCount > 1 ? 's' : '') + ' with variable backgrounds (photo/gradient)</strong>';
      html += '<p style="margin:4px 0 0;font-size:12px;color:' + (isDark ? '#fbbf24' : '#92400e') + '">Contrast varies across the element. The worst-case measurement determines the result.</p>';
      vbResults.forEach(function(r) {
        html += '<div style="margin-top:6px;padding:6px 8px;background:' + (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)') + ';border-radius:4px;font-size:12px">';
        html += '<strong>' + r.selector + '</strong>: "' + (r.text || '').substring(0, 30) + '"';
        html += '<br>Contrast range: <span style="color:#ef4444">' + r.pixelRatio + ':1</span> (worst) to <span style="color:#16a34a">' + r.pixelRatioBest + ':1</span> (best), avg ' + r.pixelRatioAvg + ':1';
        html += '<br><span style="font-size:11px">FG: </span>';
        html += _swatch(r.pixelFg, isDark);
        html += '<span style="font-size:11px"> Worst BG: </span>';
        html += _swatch(r.pixelBgWorst, isDark);
        if (r.sampleCount) html += '<span style="font-size:10px;color:var(--text-secondary)"> (' + r.sampleCount.fg + ' FG, ' + r.sampleCount.bg + ' BG samples)</span>';
        if (r.bbox) html += '<br><a class="finding-show-on-screenshot" style="font-size:11px;cursor:pointer;color:var(--accent)" onclick="window.__milgShowVerifyOnScreenshot(\'' + (r.selector || '').replace(/'/g, "\\'") + '\')">Show on screenshot</a>';
        html += '</div>';
      });
      html += '</div>';
    }

    // FG antialiasing variance (info, not warning) — solid BG but ratio spread from AA pixels
    if (summary.fgAaVarianceCount > 0) {
      var aaResults = summary.results.filter(function(r) { return r.isFgAaVariance; });
      html += '<div style="padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:6px;margin-bottom:8px">';
      html += '<span style="color:var(--text-secondary)">' + summary.fgAaVarianceCount + ' element' + (summary.fgAaVarianceCount > 1 ? 's' : '') + ' with contrast range from font antialiasing</span>';
      html += '<p style="margin:4px 0 0;font-size:12px;color:var(--text-secondary)">Background is solid — the contrast range comes from sub-pixel font rendering. The P10 ratio (ignoring the worst 10% of AA fringe pixels) is used for pass/fail.</p>';
      aaResults.forEach(function(r) {
        html += '<div style="margin-top:6px;padding:6px 8px;background:' + (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)') + ';border-radius:4px;font-size:12px;color:var(--text-secondary)">';
        html += '<strong style="color:var(--text-primary)">' + r.selector + '</strong>: "' + (r.text || '').substring(0, 30) + '"';
        html += '<br>P10: ' + r.pixelRatio + ':1, range ' + r.pixelRatioWorst + ':1 to ' + r.pixelRatioBest + ':1';
        if (r.sampleCount) html += ' (' + r.sampleCount.fg + ' FG, ' + r.sampleCount.bg + ' BG samples)';
        html += '</div>';
      });
      html += '</div>';
    }

    // Hidden region elements (skipped from pixel verification)
    if (summary.skippedCount > 0) {
      html += '<div style="padding:10px 14px;background:' + (isDark ? '#0c1d2d' : '#eff6ff') + ';border:1px solid ' + (isDark ? '#1e40af' : '#bfdbfe') + ';border-radius:6px;margin-bottom:8px">';
      html += '<span style="color:#60a5fa">' + summary.skippedCount + ' element' + (summary.skippedCount > 1 ? 's' : '') + ' in hidden overflow regions</span>';
      html += '<p style="margin:4px 0 0;font-size:12px;color:' + (isDark ? '#93c5fd' : '#1e40af') + '">These elements are clipped by overflow:hidden containers (e.g., carousels). See the expanded region sections below the main screenshot for their analysis.</p>';
      html += '</div>';
    }

    if (summary.verified > 0 || summary.significantDiffs > 0) {
      html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">';
      if (summary.verified > 0) html += summary.verified + ' pair' + (summary.verified > 1 ? 's' : '') + ' verified consistent. ';
      if (summary.significantDiffs > 0) html += summary.significantDiffs + ' with notable pixel deviation (>1.5 ratio difference). ';
      html += '</div>';
    }

    // BBox edge contrast warnings
    if (summary.bboxEdgeWarnings && summary.bboxEdgeWarnings.length > 0) {
      var bg = isDark ? '#2d2006' : '#fffbeb';
      var border = isDark ? '#92400e' : '#fde68a';
      html += '<div style="padding:10px 14px;background:' + bg + ';border:1px solid ' + border + ';border-radius:6px;margin-bottom:8px;margin-top:8px">';
      html += '<strong style="color:#f59e0b">' + summary.bboxEdgeWarnings.length + ' element' + (summary.bboxEdgeWarnings.length > 1 ? 's' : '') + ' may blend into background</strong>';
      html += '<p style="margin:4px 0 0;font-size:12px;color:' + (isDark ? '#fbbf24' : '#92400e') + '">These elements have low contrast between their background and their parent\'s background. They may not be visually distinct without additional cues (border, shadow, outline).</p>';
      summary.bboxEdgeWarnings.forEach(function(r) {
        html += '<div style="margin-top:6px;padding:6px 8px;background:' + (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)') + ';border-radius:4px;font-size:12px">';
        html += '<strong>' + r.selector + '</strong> &lt;' + r.element + '&gt;';
        if (r.text) html += ': "' + r.text.substring(0, 30) + '"';
        html += '<br>Edge contrast: <span style="color:#f59e0b">' + r.pixelRatio + ':1</span>';
        if (r.cssBgRatio > 1) html += ' <span style="color:var(--text-secondary)">(CSS: ' + r.cssBgRatio + ':1)</span>';
        // Color swatches
        html += '<br><span style="font-size:11px">Inner: </span>';
        html += '<span style="display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;border:1px solid ' + (isDark ? '#555' : '#ccc') + ';background:' + r.innerColor + '"></span>';
        html += '<span style="font-size:11px"> Outer: </span>';
        html += '<span style="display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;border:1px solid ' + (isDark ? '#555' : '#ccc') + ';background:' + r.outerColor + '"></span>';
        if (r.bbox) html += '<br><a class="finding-show-on-screenshot" style="font-size:11px;cursor:pointer;color:var(--accent)" onclick="window.__milgShowVerifyOnScreenshot(\'' + (r.selector || '').replace(/'/g, "\\'") + '\')">Show on screenshot</a>';
        html += '</div>';
      });
      html += '</div>';
    }
    if (summary.bboxEdgeChecked > 0) {
      html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">';
      html += summary.bboxEdgeChecked + ' element edge' + (summary.bboxEdgeChecked > 1 ? 's' : '') + ' checked for background distinction';
      if (summary.bboxEdgeChecked - (summary.bboxEdgeWarnings ? summary.bboxEdgeWarnings.length : 0) > 0) {
        html += ' (' + (summary.bboxEdgeChecked - summary.bboxEdgeWarnings.length) + ' passed)';
      }
      html += '.</div>';
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
