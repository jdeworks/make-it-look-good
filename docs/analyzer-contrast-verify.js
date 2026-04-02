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
  var EDGE_METHODS = ['combined', 'sobel', 'prewitt', 'canny', 'roberts', 'laplacian', 'grid'];
  var _edgeMethod = 'combined'; // roberts + laplacian union
  function setEdgeMethod(name) {
    if (EDGE_METHODS.indexOf(name) !== -1) _edgeMethod = name;
  }

  // --- 3x3 convolution helper ---
  // Applies a 3x3 kernel to a binary mask, returns Float32Array of results
  function convolve3x3(mask, w, h, kernel) {
    var out = new Float32Array(w * h);
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var sum = 0;
        for (var ky = -1; ky <= 1; ky++) {
          for (var kx = -1; kx <= 1; kx++) {
            sum += mask[(y + ky) * w + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        out[y * w + x] = sum;
      }
    }
    return out;
  }

  // --- Sobel edge detection ---
  // Returns: Uint8Array(w*h) with 0=OUTSIDE, 1=EDGE, 2=INSIDE
  function edgeSobel(mask, w, h) {
    var gx = convolve3x3(mask, w, h, [-1,0,1, -2,0,2, -1,0,1]);
    var gy = convolve3x3(mask, w, h, [1,2,1, 0,0,0, -1,-2,-1]);
    var cat = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) {
      if (!mask[i]) { cat[i] = 0; continue; }
      var mag = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
      cat[i] = mag > 1.5 ? 1 : 2; // edge threshold for binary input
    }
    // Border pixels: just classify by mask value
    for (var x = 0; x < w; x++) { cat[x] = mask[x] ? 2 : 0; cat[(h-1)*w+x] = mask[(h-1)*w+x] ? 2 : 0; }
    for (var y = 0; y < h; y++) { cat[y*w] = mask[y*w] ? 2 : 0; cat[y*w+w-1] = mask[y*w+w-1] ? 2 : 0; }
    return cat;
  }

  // --- Prewitt edge detection ---
  function edgePrewitt(mask, w, h) {
    var gx = convolve3x3(mask, w, h, [-1,0,1, -1,0,1, -1,0,1]);
    var gy = convolve3x3(mask, w, h, [1,1,1, 0,0,0, -1,-1,-1]);
    var cat = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) {
      if (!mask[i]) { cat[i] = 0; continue; }
      var mag = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
      cat[i] = mag > 1.0 ? 1 : 2; // lower threshold — Prewitt has smaller magnitudes
    }
    for (var x = 0; x < w; x++) { cat[x] = mask[x] ? 2 : 0; cat[(h-1)*w+x] = mask[(h-1)*w+x] ? 2 : 0; }
    for (var y = 0; y < h; y++) { cat[y*w] = mask[y*w] ? 2 : 0; cat[y*w+w-1] = mask[y*w+w-1] ? 2 : 0; }
    return cat;
  }

  // --- Canny edge detection ---
  // Full pipeline: Gaussian blur → Sobel gradients → non-max suppression → hysteresis
  function edgeCanny(mask, w, h) {
    // Stage 1: Gaussian blur (3x3, sigma ≈ 0.85)
    var blurred = new Float32Array(w * h);
    var gk = [1,2,1, 2,4,2, 1,2,1]; // /16
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var sum = 0;
        for (var ky = -1; ky <= 1; ky++)
          for (var kx = -1; kx <= 1; kx++)
            sum += mask[(y+ky)*w+(x+kx)] * gk[(ky+1)*3+(kx+1)];
        blurred[y*w+x] = sum / 16;
      }
    }

    // Stage 2: Sobel gradient magnitude + direction on blurred data
    var mag = new Float32Array(w * h);
    var dir = new Uint8Array(w * h); // quantized: 0=horiz, 1=diag45, 2=vert, 3=diag135
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var gx = 0, gy = 0;
        var skx = [-1,0,1,-2,0,2,-1,0,1], sky = [1,2,1,0,0,0,-1,-2,-1];
        for (var ky = -1; ky <= 1; ky++)
          for (var kx = -1; kx <= 1; kx++) {
            var v = blurred[(y+ky)*w+(x+kx)];
            gx += v * skx[(ky+1)*3+(kx+1)];
            gy += v * sky[(ky+1)*3+(kx+1)];
          }
        var m = Math.sqrt(gx*gx + gy*gy);
        mag[y*w+x] = m;
        // Quantize direction to 4 bins
        var angle = Math.atan2(gy, gx); // -PI to PI
        if (angle < 0) angle += Math.PI; // 0 to PI
        if (angle < Math.PI/8 || angle >= 7*Math.PI/8) dir[y*w+x] = 0; // horizontal
        else if (angle < 3*Math.PI/8) dir[y*w+x] = 1; // 45°
        else if (angle < 5*Math.PI/8) dir[y*w+x] = 2; // vertical
        else dir[y*w+x] = 3; // 135°
      }
    }

    // Stage 3: Non-maximum suppression — thin edges to 1px
    var nms = new Float32Array(w * h);
    // Direction → neighbor offsets: [dx1,dy1, dx2,dy2]
    var dirOff = [[1,0,-1,0], [1,1,-1,-1], [0,1,0,-1], [-1,1,1,-1]];
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i = y*w+x;
        var m = mag[i];
        if (m < 0.3) continue;
        var d = dirOff[dir[i]];
        var m1 = mag[(y+d[1])*w+(x+d[0])];
        var m2 = mag[(y+d[3])*w+(x+d[2])];
        if (m >= m1 && m >= m2) nms[i] = m;
      }
    }

    // Stage 4: Hysteresis thresholding — connect edges
    var HIGH = 0.8, LOW = 0.3;
    var cat = new Uint8Array(w * h);
    // First pass: mark strong edges
    var queue = [];
    for (var i = 0; i < w * h; i++) {
      if (nms[i] >= HIGH && mask[i]) { cat[i] = 1; queue.push(i); }
      else if (mask[i]) cat[i] = 2; // inside for now
      // outside stays 0
    }
    // BFS: connect weak edges to strong edges
    var head = 0;
    while (head < queue.length) {
      var ci = queue[head++];
      var cx = ci % w, cy = (ci - cx) / w;
      for (var dy = -1; dy <= 1; dy++) {
        var ny = cy + dy;
        if (ny < 0 || ny >= h) continue;
        for (var dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          var nx = cx + dx;
          if (nx < 0 || nx >= w) continue;
          var ni = ny * w + nx;
          if (cat[ni] === 2 && nms[ni] >= LOW) {
            cat[ni] = 1; // promote weak edge connected to strong edge
            queue.push(ni);
          }
        }
      }
    }
    return cat;
  }

  // --- Roberts Cross edge detection ---
  // 2x2 diagonal kernels — high sensitivity, catches ~85% of boundary pixels
  // Checks both the 2x2 diagonal gradients AND the 4-connected neighbors
  function edgeRoberts(mask, w, h) {
    var cat = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        if (!mask[i]) continue;
        var isEdge = false;
        // Roberts 2x2 diagonal check
        if (x < w - 1 && y < h - 1) {
          var gx = mask[i] - mask[(y+1)*w+(x+1)];
          var gy = mask[y*w+(x+1)] - mask[(y+1)*w+x];
          if (gx !== 0 || gy !== 0) isEdge = true;
        }
        // Also check 4-connected neighbors for high coverage (~85-90%)
        if (!isEdge) {
          if (x > 0 && !mask[i-1]) isEdge = true;
          else if (x < w-1 && !mask[i+1]) isEdge = true;
          else if (y > 0 && !mask[(y-1)*w+x]) isEdge = true;
          else if (y < h-1 && !mask[(y+1)*w+x]) isEdge = true;
        }
        cat[i] = isEdge ? 1 : 2;
      }
    }
    return cat;
  }

  // --- Laplacian edge detection ---
  // 3x3 second-derivative with diagonal sensitivity: [1,1,1, 1,-8,1, 1,1,1]
  // Catches ALL boundary pixels where the mask transitions (high coverage)
  function edgeLaplacian(mask, w, h) {
    var cat = new Uint8Array(w * h);
    var kernel = [1,1,1, 1,-8,1, 1,1,1]; // 8-connected Laplacian
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i = y * w + x;
        if (!mask[i]) continue;
        var sum = 0;
        for (var ky = -1; ky <= 1; ky++)
          for (var kx = -1; kx <= 1; kx++)
            sum += mask[(y+ky)*w+(x+kx)] * kernel[(ky+1)*3+(kx+1)];
        cat[i] = Math.abs(sum) > 0.5 ? 1 : 2;
      }
    }
    for (var x = 0; x < w; x++) { cat[x] = mask[x] ? 2 : 0; cat[(h-1)*w+x] = mask[(h-1)*w+x] ? 2 : 0; }
    for (var y = 0; y < h; y++) { cat[y*w] = mask[y*w] ? 2 : 0; cat[y*w+w-1] = mask[y*w+w-1] ? 2 : 0; }
    return cat;
  }

  // Dispatcher for edge detection methods
  function detectEdges(mask, w, h, method) {
    switch (method || _edgeMethod) {
      case 'prewitt':   return edgePrewitt(mask, w, h);
      case 'canny':     return edgeCanny(mask, w, h);
      case 'roberts':   return edgeRoberts(mask, w, h);
      case 'laplacian': return edgeLaplacian(mask, w, h);
      case 'sobel':
      default:          return edgeSobel(mask, w, h);
    }
  }

  // BFS distance from all EDGE pixels, capped at maxDist
  function bfsEdgeDist(cat, w, h, maxDist) {
    var dist = new Uint8Array(w * h);
    var queue = [];
    for (var i = 0; i < cat.length; i++) {
      if (cat[i] === 1) { dist[i] = 0; queue.push(i); }
      else dist[i] = 255; // unvisited
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
          if (dist[ni] <= cd + 1) continue; // already visited at same or shorter dist
          dist[ni] = cd + 1;
          queue.push(ni);
        }
      }
    }
    return dist;
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

  // --- Edge-based verification (fast, precise) ---
  function verifyPairEdge(pair, sectionCanvases, meta, maskCanvas) {
    var ctx = prepareContext(pair, sectionCanvases, meta);
    if (!ctx) return null;
    var bx = ctx.bx, by = ctx.by, bw = ctx.bw, bh = ctx.bh;
    var imgData = ctx.sec.ctx.getImageData(bx, by, bw, bh).data;

    var mBmpRaw = pair._maskBmp, mW = pair._maskW, mH = pair._maskH;
    var w = Math.min(mW, bw), h = Math.min(mH, bh);
    if (w < 4 || h < 4) return null;

    // Step 0: Clean mask — threshold to crisp 0/1
    var mask = new Uint8Array(mW * mH);
    for (var i = 0; i < mW * mH; i++) mask[i] = mBmpRaw[i] ? 1 : 0;

    // Step 1: Combined edge detection (Roberts ∪ Laplacian)
    var method = _edgeMethod;
    var cat;
    if (method === 'grid') return verifyPairGrid(pair, sectionCanvases, meta, maskCanvas);
    if (method === 'combined' || method === 'canny') {
      var catR = edgeRoberts(mask, mW, mH);
      var catL = edgeLaplacian(mask, mW, mH);
      cat = new Uint8Array(mW * mH);
      for (var i = 0; i < mW * mH; i++) {
        if (catR[i] === 1 || catL[i] === 1) cat[i] = 1;
        else if (mask[i]) cat[i] = 2;
        else cat[i] = 0;
      }
    } else {
      cat = detectEdges(mask, mW, mH, method);
    }

    // Step 2: BFS from edges → distance + Voronoi owner per pixel
    // Each non-edge pixel gets assigned to its nearest edge pixel (by BFS order).
    // This replaces the expensive O(pixels × edges) search.
    var edgeIdx = [];
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++)
        if (cat[y * mW + x] === 1) edgeIdx.push(y * mW + x);

    if (edgeIdx.length === 0) {
      if (pair.text) console.log('[verify-edge] No edges for "' + pair.text.substring(0, 25) + '" ' + w + 'x' + h);
      return null;
    }

    // BFS: propagate distance + owner from all edge pixels simultaneously
    var edgeDist = new Uint8Array(mW * mH);
    var edgeOwner = new Int32Array(mW * mH); // index into edgeIdx, -1 = unassigned
    for (var i = 0; i < mW * mH; i++) { edgeDist[i] = 255; edgeOwner[i] = -1; }
    var queue = [];
    for (var ei = 0; ei < edgeIdx.length; ei++) {
      edgeDist[edgeIdx[ei]] = 0;
      edgeOwner[edgeIdx[ei]] = ei;
      queue.push(edgeIdx[ei]);
    }
    // Scale BG search radius with text size: small text (h<15) → 2px, larger → 3px
    var BG_R = Math.min(h, w) < 15 ? 2 : 3;
    var FG_R = 2, MAX_DIST = BG_R + 2;
    var head = 0;
    while (head < queue.length) {
      var ci = queue[head++];
      var cd = edgeDist[ci];
      if (cd >= MAX_DIST) continue;
      var cx = ci % mW, cy = (ci - cx) / mW;
      for (var dy = -1; dy <= 1; dy++) {
        var ny = cy + dy; if (ny < 0 || ny >= h) continue;
        for (var dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          var nx = cx + dx; if (nx < 0 || nx >= w) continue;
          var ni = ny * mW + nx;
          if (edgeDist[ni] <= cd + 1) continue;
          edgeDist[ni] = cd + 1;
          edgeOwner[ni] = edgeOwner[ci]; // inherit owner from parent
          queue.push(ni);
        }
      }
    }

    // Step 3: Collect all FG and BG pixels
    var allFg = []; // [{lx, ly, r, g, b}]
    var allBgArr = []; // [{lx, ly, r, g, b}]

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var mi = y * mW + x;
        var d = edgeDist[mi];
        var c = cat[mi];
        var pi = (y * bw + x) * 4;
        if (pi + 2 >= imgData.length) continue;

        if ((c === 1 || c === 2) && d <= FG_R) {
          allFg.push({ lx: x, ly: y, r: imgData[pi], g: imgData[pi+1], b: imgData[pi+2] });
        } else if (c === 0 && d >= 1 && d <= BG_R) {
          // Include edgeDist=1 (was excluded as AA zone, but needed for continuous outline)
          allBgArr.push({ lx: x, ly: y, r: imgData[pi], g: imgData[pi+1], b: imgData[pi+2] });
        }
      }
    }

    // Step 4: For each BG pixel, pre-compute which FG pixel is closest.
    // Then for each FG pixel, its relevant BG = those within 5px where THIS FG is the closest.
    //
    // Use a grid-based spatial index for FG pixels to make nearest-FG lookup fast.
    // Grid cell size = BG_R (5px), so we only need to check 9 cells.
    var cellSize = BG_R;
    var gridW = Math.ceil(w / cellSize), gridH = Math.ceil(h / cellSize);
    var fgGrid = new Array(gridW * gridH);
    for (var gi = 0; gi < fgGrid.length; gi++) fgGrid[gi] = [];
    for (var fi = 0; fi < allFg.length; fi++) {
      var gx = Math.floor(allFg[fi].lx / cellSize);
      var gy = Math.floor(allFg[fi].ly / cellSize);
      fgGrid[gy * gridW + gx].push(fi);
    }

    // For each BG pixel, find the nearest FG pixel index (using grid)
    var bgNearestFg = new Int32Array(allBgArr.length);
    var bgNearestDist = new Float32Array(allBgArr.length);
    for (var bi = 0; bi < allBgArr.length; bi++) {
      var bg = allBgArr[bi];
      var gcx = Math.floor(bg.lx / cellSize), gcy = Math.floor(bg.ly / cellSize);
      var bestFi = -1, bestD = Infinity;
      for (var gdy = -1; gdy <= 1; gdy++) {
        var ry = gcy + gdy; if (ry < 0 || ry >= gridH) continue;
        for (var gdx = -1; gdx <= 1; gdx++) {
          var rx = gcx + gdx; if (rx < 0 || rx >= gridW) continue;
          var cell = fgGrid[ry * gridW + rx];
          for (var ci = 0; ci < cell.length; ci++) {
            var fg = allFg[cell[ci]];
            var dx = fg.lx - bg.lx, dy = fg.ly - bg.ly;
            var dd = dx * dx + dy * dy;
            if (dd < bestD) { bestD = dd; bestFi = cell[ci]; }
          }
        }
      }
      bgNearestFg[bi] = bestFi;
      bgNearestDist[bi] = bestD;
    }

    // Step 5: For each FG pixel, collect its BG group:
    //   a) BG within 3px where this FG is the closest FG
    //   b) Remove any BG that has a DIFFERENT FG within 3px (contested zone)
    //   c) Keep only the OUTERMOST BG pixels (max distance ring, not fill)
    var fgPoints = [], fgColors = [];
    var allBgUsed = {};
    var allPairRatios = [];
    var worstRatio = 99, bestRatio = 0, worstBg = null, worstBgPt = null;
    var fgGroups = [];
    for (var fi = 0; fi < allFg.length; fi++) {
      var fg = allFg[fi];

      // Collect candidate BG: within 3px Chebyshev (square), this FG is closest
      var candidates = [];
      for (var bi = 0; bi < allBgArr.length; bi++) {
        if (bgNearestFg[bi] !== fi) continue;
        var bg = allBgArr[bi];
        var adx = Math.abs(fg.lx - bg.lx), ady = Math.abs(fg.ly - bg.ly);
        var cheb = Math.max(adx, ady); // Chebyshev = square distance (no diagonal gaps)
        if (cheb > BG_R) continue;
        candidates.push({ bi: bi, cheb: cheb, bg: bg });
      }
      if (candidates.length === 0) continue;

      // Build a lookup set for fast neighbor check
      var candSet = {};
      for (var ci = 0; ci < candidates.length; ci++) {
        candSet[candidates[ci].bg.lx + ',' + candidates[ci].bg.ly] = ci;
      }

      // Step A: Thin to 1px outline — keep BG where at least one 8-neighbor
      // is NOT in the candidate set (outer boundary of BG region)
      var thinned = [];
      for (var ci = 0; ci < candidates.length; ci++) {
        var bg = candidates[ci].bg;
        var isOuter = false;
        for (var dy = -1; dy <= 1 && !isOuter; dy++) {
          for (var dx = -1; dx <= 1 && !isOuter; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (!((bg.lx + dx) + ',' + (bg.ly + dy) in candSet)) isOuter = true;
          }
        }
        if (isOuter) thinned.push(candidates[ci]);
      }
      if (thinned.length === 0) thinned = candidates;

      // Step B: Remove BG pixels where a DIFFERENT FG pixel is closer than this FG.
      // These are on the inward side (facing another text stroke), not outward.
      var outerRing = [];
      for (var ti = 0; ti < thinned.length; ti++) {
        var bg = thinned[ti].bg;
        var myDist = thinned[ti].cheb; // Chebyshev dist from this FG
        // Check spatial grid for a closer FG
        var gcx = Math.floor(bg.lx / cellSize), gcy = Math.floor(bg.ly / cellSize);
        var closerExists = false;
        for (var gdy = -1; gdy <= 1 && !closerExists; gdy++) {
          var ry = gcy + gdy; if (ry < 0 || ry >= gridH) continue;
          for (var gdx = -1; gdx <= 1 && !closerExists; gdx++) {
            var rx = gcx + gdx; if (rx < 0 || rx >= gridW) continue;
            var cell = fgGrid[ry * gridW + rx];
            for (var cci = 0; cci < cell.length; cci++) {
              if (cell[cci] === fi) continue; // skip self
              var otherFg = allFg[cell[cci]];
              var ocheb = Math.max(Math.abs(otherFg.lx - bg.lx), Math.abs(otherFg.ly - bg.ly));
              if (ocheb < myDist) { closerExists = true; break; }
            }
          }
        }
        if (!closerExists) outerRing.push(thinned[ti]);
      }
      if (outerRing.length === 0) outerRing = thinned; // fallback

      // Step C: Remove shadowed BG — a BG pixel is redundant if another BG
      // in the group is further from the NEAREST FG pixel along the same axis.
      // We check against ALL nearby FG (not just the owner) so vertical strokes
      // correctly keep horizontally-stacked BG.
      if (outerRing.length > 1) {
        // For each BG pixel, find its nearest FG (any FG, using the grid)
        var bgNearFg = [];
        for (var ri = 0; ri < outerRing.length; ri++) {
          var bg = outerRing[ri].bg;
          var bestFx = fg.lx, bestFy = fg.ly, bestD = Infinity;
          var gcx = Math.floor(bg.lx / cellSize), gcy = Math.floor(bg.ly / cellSize);
          for (var gdy = -1; gdy <= 1; gdy++) {
            var ry = gcy + gdy; if (ry < 0 || ry >= gridH) continue;
            for (var gdx = -1; gdx <= 1; gdx++) {
              var rx = gcx + gdx; if (rx < 0 || rx >= gridW) continue;
              var cell = fgGrid[ry * gridW + rx];
              for (var cci = 0; cci < cell.length; cci++) {
                var nfg = allFg[cell[cci]];
                var nd = Math.max(Math.abs(nfg.lx - bg.lx), Math.abs(nfg.ly - bg.ly));
                if (nd < bestD) { bestD = nd; bestFx = nfg.lx; bestFy = nfg.ly; }
              }
            }
          }
          bgNearFg.push({ fx: bestFx, fy: bestFy });
        }

        var final = [];
        for (var ri = 0; ri < outerRing.length; ri++) {
          var bg = outerRing[ri].bg;
          var nfx = bgNearFg[ri].fx, nfy = bgNearFg[ri].fy;
          var dx = bg.lx - nfx, dy = bg.ly - nfy;
          var shadowed = false;

          for (var rj = 0; rj < outerRing.length; rj++) {
            if (ri === rj) continue;
            var obg = outerRing[rj].bg;
            // Direction from the SAME nearest-FG to the other BG
            var odx = obg.lx - nfx, ody = obg.ly - nfy;

            // Same axis + same direction + other is strictly further out
            if (dx === 0 && odx === 0 && ((dy > 0 && ody > dy) || (dy < 0 && ody < dy))) {
              shadowed = true; break; // same column, other further
            }
            if (dy === 0 && ody === 0 && ((dx > 0 && odx > dx) || (dx < 0 && odx < dx))) {
              shadowed = true; break; // same row, other further
            }
            // Diagonal: same signs, other strictly further on both axes
            if (dx !== 0 && dy !== 0 && odx !== 0 && ody !== 0 &&
                ((dx > 0) === (odx > 0)) && ((dy > 0) === (ody > 0)) &&
                Math.abs(odx) >= Math.abs(dx) && Math.abs(ody) >= Math.abs(dy) &&
                (Math.abs(odx) > Math.abs(dx) || Math.abs(ody) > Math.abs(dy))) {
              shadowed = true; break;
            }
          }
          if (!shadowed) final.push(outerRing[ri]);
        }
        if (final.length > 0) outerRing = final;
      }

      // Average the outer ring BG colors
      var sumR = 0, sumG = 0, sumB = 0;
      var myBgKeys = [];
      for (var oi = 0; oi < outerRing.length; oi++) {
        var bg = outerRing[oi].bg;
        sumR += bg.r; sumG += bg.g; sumB += bg.b;
        var k = bg.lx + ',' + bg.ly;
        myBgKeys.push(k);
        allBgUsed[k] = { x: bx + bg.lx, y: by + bg.ly, r: bg.r, g: bg.g, b: bg.b };
      }

      var avgBg = { r: Math.round(sumR / outerRing.length), g: Math.round(sumG / outerRing.length), b: Math.round(sumB / outerRing.length) };
      var fgC = { r: fg.r, g: fg.g, b: fg.b };
      var ratio = contrastRatio(fgC, avgBg);

      fgPoints.push({ x: bx + fg.lx, y: by + fg.ly, groupBg: myBgKeys });
      fgColors.push(fgC);
      fgGroups.push(myBgKeys);
      allPairRatios.push(ratio);
      if (ratio < worstRatio) { worstRatio = ratio; worstBg = avgBg; }
      if (ratio > bestRatio) bestRatio = ratio;
    }

    if (allPairRatios.length === 0) {
      if (pair.text) console.log('[verify-edge] No pairs for "' + pair.text.substring(0, 25) + '" edges=' + edgeIdx.length + ' fg=' + allFg.length + ' bg=' + allBgArr.length + ' method=' + method);
      return null;
    }

    // Collect all used BG for visualization
    var finalBgPoints = [], finalBgColors = [];
    Object.keys(allBgUsed).forEach(function(k) {
      var b = allBgUsed[k];
      finalBgPoints.push({ x: b.x, y: b.y });
      finalBgColors.push({ r: b.r, g: b.g, b: b.b });
    });

    // Find worst BG point
    var fgColor = { r: 0, g: 0, b: 0 };
    fgColors.forEach(function(c) { fgColor.r += c.r; fgColor.g += c.g; fgColor.b += c.b; });
    fgColor.r = Math.round(fgColor.r / fgColors.length);
    fgColor.g = Math.round(fgColor.g / fgColors.length);
    fgColor.b = Math.round(fgColor.b / fgColors.length);
    worstBgPt = null;
    var wbr = 99;
    finalBgPoints.forEach(function(bp, bi) {
      var r = contrastRatio(fgColor, finalBgColors[bi]);
      if (r < wbr) { wbr = r; worstBgPt = bp; worstBg = finalBgColors[bi]; }
    });

    var result = buildResult(pair, ctx, fgPoints, fgColors, finalBgPoints, finalBgColors,
      allPairRatios, worstRatio, bestRatio, worstBg, worstBgPt);

    if (result) {
      var edgeCoords = edgeIdx.map(function(idx) { return { x: idx % mW, y: (idx - idx % mW) / mW }; });
      result._debug = {
        bx: bx, by: by, bw: w, bh: h,
        mask: Array.from(mask.slice(0, w * h)),
        edge: edgeCoords,
        edgeCount: edgeIdx.length,
        fgCount: fgPoints.length,
        bgCount: finalBgPoints.length,
        method: method === 'combined' || method === 'canny' ? 'roberts+laplacian' : method
      };
      if (result.samplePoints && result.samplePoints.fg) {
        result.samplePoints.fg.forEach(function(fp, i) { fp.groupBg = fgGroups[i] || []; });
      }
      result._bgKeyMap = allBgUsed;
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
    _detectEdges: detectEdges, // exposed for debug layer viewer
    formatResult: formatResult,
    buildSummary: buildSummary,
    renderSummaryHtml: renderSummaryHtml,
    contrastRatio: contrastRatio,
    parseRgb: parseRgb
  };
})();
