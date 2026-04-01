// make-it-look-good — Screenshot Viewer with Bbox Overlays
// Stitches screenshot sections into one continuous scrollable image
// with a single SVG overlay for all bounding boxes.

window.MilgViewer = (function() {
  "use strict";

  var _overlay = null;
  var _activeFilter = null;
  var _allFindings = [];
  var _meta = null;
  var _screenshots = [];
  var _tooltip = null;
  var _reportData = null;
  var _zoomLevel = 1;
  var _stitchedCanvas = null;
  var _calibrationOffsetY = 0; // detected offset between DOM positions and canvas positions

  // Severity colors: red / yellow / blue
  var COLORS = {
    error:   { fill: 'rgba(239,68,68,0.22)', stroke: '#ef4444' },
    warning: { fill: 'rgba(234,179,8,0.22)', stroke: '#eab308' },
    info:    { fill: 'rgba(59,130,246,0.22)', stroke: '#3b82f6' }
  };

  function open(img, sectionIndex, reportData) {
    if (_overlay) close();

    _reportData = reportData;
    _screenshots = (reportData.raw && reportData.raw.screenshots) || [];
    _meta = (reportData.raw && reportData.raw.screenshotMeta) || null;
    _activeFilter = null;
    _zoomLevel = 1;

    if (!_meta || _screenshots.length === 0) {
      simpleLightbox(img);
      return;
    }

    // Collect findings with bboxes from all categories
    _allFindings = [];
    var cats = reportData.categories || [];
    cats.forEach(function(cat) {
      (cat.findings || []).forEach(function(f) {
        if (!f.locator || !f.locator.bboxes || f.locator.bboxes.length === 0) return;
        _allFindings.push({
          severity: f.severity || 'info',
          title: f.title || '',
          detail: f.detail || '',
          category: cat.label || '',
          icon: cat.icon || '',
          bboxes: f.locator.bboxes
        });
      });
    });

    // Build overlay shell (image will be inserted after stitching)
    _overlay = document.createElement('div');
    _overlay.className = 'milg-viewer-overlay';

    // Toolbar
    var toolbar = document.createElement('div');
    toolbar.className = 'milg-viewer-toolbar';

    // Count findings per category and severity
    var catCounts = {}, sevCounts = { error: 0, warning: 0, info: 0 }, catSet = {};
    _allFindings.forEach(function(f) {
      catSet[f.icon] = f.category;
      catCounts[f.icon] = (catCounts[f.icon] || 0) + 1;
      if (sevCounts[f.severity] !== undefined) sevCounts[f.severity]++;
    });

    var catPills = '';
    Object.keys(catSet).forEach(function(icon) {
      catPills += '<button class="milg-viewer-filter-btn" data-filter-type="category" data-filter-value="' + icon + '">' + catSet[icon] + ' <span class="milg-viewer-count">' + (catCounts[icon] || 0) + '</span></button>';
    });

    function sevPill(sev, label) {
      var c = sevCounts[sev] || 0;
      return c > 0 ? '<button class="milg-viewer-filter-btn milg-viewer-sev-' + sev + '" data-filter-type="severity" data-filter-value="' + sev + '">' + label + ' <span class="milg-viewer-count">' + c + '</span></button>' : '';
    }
    var sevPills = sevPill('error', 'Errors') + sevPill('warning', 'Warnings') + sevPill('info', 'Info');

    // Pixel verification pills
    var verifyPill = '';
    var vResults = reportData._contrastVerifyResults || [];
    if (vResults.length > 0) {
      var vFails = vResults.filter(function(r) { return r.crossesBoundary; }).length;
      verifyPill = '<span class="milg-viewer-sep"></span>' +
        '<button class="milg-viewer-filter-btn milg-viewer-sev-verify" data-filter-type="verify" data-filter-value="all">Pixel Verified <span class="milg-viewer-count">' + vResults.length + '</span></button>' +
        (vFails > 0 ? '<button class="milg-viewer-filter-btn milg-viewer-sev-error" data-filter-type="verify" data-filter-value="fails">Pixel Fails <span class="milg-viewer-count">' + vFails + '</span></button>' : '');
    }

    toolbar.innerHTML =
      '<div class="milg-viewer-filters">' + catPills + '<span class="milg-viewer-sep"></span>' + sevPills + verifyPill + '</div>' +
      '<select class="milg-viewer-zoom-select" title="Zoom level">' +
        '<option value="0.75">75%</option><option value="1" selected>100%</option><option value="1.5">150%</option><option value="2">200%</option><option value="2.5">250%</option><option value="3">300%</option>' +
      '</select>' +
      '<button class="milg-viewer-debug-btn" title="Copy debug info to clipboard">Debug</button>' +
      '<button class="milg-viewer-close" title="Close (Esc)">&times;</button>';

    _overlay.appendChild(toolbar);

    var content = document.createElement('div');
    content.className = 'milg-viewer-content';

    var frame = document.createElement('div');
    frame.className = 'milg-viewer-frame';

    // Loading indicator
    frame.innerHTML = '<div class="milg-viewer-loading">Stitching screenshots...</div>';
    content.appendChild(frame);
    _overlay.appendChild(content);
    document.body.appendChild(_overlay);
    requestAnimationFrame(function() { _overlay.classList.add('visible'); });

    // Event handlers
    toolbar.addEventListener('click', function(e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.classList.contains('milg-viewer-close')) { close(); return; }
      if (btn.classList.contains('milg-viewer-filter-btn')) {
        var type = btn.getAttribute('data-filter-type');
        var value = btn.getAttribute('data-filter-value');
        if (_activeFilter && _activeFilter.type === type && _activeFilter.value === value) {
          _activeFilter = null;
        } else {
          _activeFilter = { type: type, value: value };
        }
        updateFilterButtons();
        renderOverlays();
      }
    });

    content.addEventListener('click', function(e) {
      if (e.target === content) close();
    });
    document.addEventListener('keydown', _onKeyDown);

    // Zoom dropdown
    var zoomSelect = toolbar.querySelector('.milg-viewer-zoom-select');
    if (zoomSelect) {
      zoomSelect.addEventListener('change', function() {
        _zoomLevel = parseFloat(zoomSelect.value) || 1;
        applyZoom(frame);
      });
    }

    // Double-click to step zoom up (or reset if at max)
    content.addEventListener('dblclick', function(e) {
      if (e.target.closest('.milg-viewer-toolbar')) return;
      if (!zoomSelect) return;
      var options = zoomSelect.options;
      var curIdx = zoomSelect.selectedIndex;
      // Step up one level, or reset to 100% if at max
      var nextIdx = curIdx < options.length - 1 ? curIdx + 1 : 1; // index 1 = 100%
      zoomSelect.selectedIndex = nextIdx;
      _zoomLevel = parseFloat(zoomSelect.value) || 1;
      applyZoom(frame);
    });

    // Drag-to-pan (mouse + touch)
    var _dragStart = null;
    var _scrollStart = null;
    content.addEventListener('mousedown', function(e) {
      if (e.target.closest('.milg-viewer-toolbar') || e.target.closest('rect')) return;
      _dragStart = { x: e.clientX, y: e.clientY };
      _scrollStart = { x: content.scrollLeft, y: content.scrollTop };
      content.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!_dragStart) return;
      content.scrollLeft = _scrollStart.x - (e.clientX - _dragStart.x);
      content.scrollTop = _scrollStart.y - (e.clientY - _dragStart.y);
    });
    document.addEventListener('mouseup', function() {
      _dragStart = null;
      if (content) content.style.cursor = '';
    });
    content.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      if (e.target.closest('.milg-viewer-toolbar') || e.target.closest('rect')) return;
      _dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      _scrollStart = { x: content.scrollLeft, y: content.scrollTop };
    }, { passive: true });
    content.addEventListener('touchmove', function(e) {
      if (!_dragStart || e.touches.length !== 1) return;
      content.scrollLeft = _scrollStart.x - (e.touches[0].clientX - _dragStart.x);
      content.scrollTop = _scrollStart.y - (e.touches[0].clientY - _dragStart.y);
      e.preventDefault();
    }, { passive: false });
    content.addEventListener('touchend', function() { _dragStart = null; }, { passive: true });

    // Debug info button
    toolbar.querySelector('.milg-viewer-debug-btn').addEventListener('click', function() {
      var debugData = buildDebugInfo();
      navigator.clipboard.writeText(debugData).then(function() {
        alert('Debug info copied to clipboard! Paste it to share.');
      }).catch(function() {
        // Fallback: show in a prompt
        prompt('Copy this debug info:', debugData);
      });
    });

    // Use full-page screenshot if available (pixel-perfect, no section stitching)
    // Fall back to stitching sections only when screenshotFull is missing
    var fullPageSrc = (reportData.raw && reportData.raw.screenshotFull) || null;

    function onImageReady(imgSrc, canvasW, canvasH) {
      frame.innerHTML = '';
      var viewImg = document.createElement('img');
      viewImg.className = 'milg-viewer-img';
      viewImg.src = imgSrc;
      viewImg.alt = 'Full page screenshot';

      // SVG viewBox = original canvas dimensions (matches dom * scale exactly)
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'milg-viewer-svg');
      svg.setAttribute('viewBox', '0 0 ' + canvasW + ' ' + canvasH);
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');

      frame.appendChild(viewImg);
      frame.appendChild(svg);

      // Use pre-computed calibration offset from extraction (red marker probing on pristine canvas)
      viewImg.addEventListener('load', function() {
        _calibrationOffsetY = (_meta && _meta.calibrationOffsetY) || 0;
        if (_calibrationOffsetY) {
          console.log('[viewer] Using calibration offset: ' + _calibrationOffsetY + 'px canvas (' + (_calibrationOffsetY * 2) + 'px DOM), samples: ' + JSON.stringify(_meta.calibrationSamples || []));
        }

        updateFilterButtons();
        renderOverlays();

        if (sectionIndex > 0 && _meta) {
          var scale = _meta.scale || 0.5;
          content.scrollTop = Math.round(sectionIndex * Math.round(_meta.viewportHeight * scale) - _calibrationOffsetY);
        }
      });
    }

    if (fullPageSrc) {
      // Direct full-page image — no stitching needed
      _stitchedCanvas = { width: _meta.canvasWidth, height: _meta.canvasHeight };
      onImageReady(fullPageSrc, _meta.canvasWidth, _meta.canvasHeight);
    } else {
      // Stitch sections as fallback
      stitchScreenshots(_screenshots, function(stitched) {
        _stitchedCanvas = stitched;
        onImageReady(stitched.canvas.toDataURL('image/png'), stitched.width, stitched.height);
      });
    }
  }

  // Build debug info with pixel probing for alignment diagnostics
  function buildDebugInfo() {
    var rawMeta = _reportData && _reportData.raw && _reportData.raw.meta ? _reportData.raw.meta : {};
    var info = { meta: _meta, extractionScroll: { scrollX: rawMeta.scrollX, scrollY: rawMeta.scrollY, docHeight: rawMeta.docHeight }, zoomLevel: _zoomLevel, activeFilter: _activeFilter, findings: [] };

    if (_stitchedCanvas) {
      info.stitched = { width: _stitchedCanvas.width, height: _stitchedCanvas.height };
    }
    info.screenshotCount = _screenshots.length;
    var imgEl = _overlay && _overlay.querySelector('.milg-viewer-img');
    if (imgEl) {
      info.displayedImg = { naturalWidth: imgEl.naturalWidth, naturalHeight: imgEl.naturalHeight, offsetWidth: imgEl.offsetWidth, offsetHeight: imgEl.offsetHeight };
    }
    var svgEl = _overlay && _overlay.querySelector('.milg-viewer-svg');
    if (svgEl) {
      info.svgViewBox = svgEl.getAttribute('viewBox');
      info.svgSize = { offsetWidth: svgEl.clientWidth, offsetHeight: svgEl.clientHeight };
    }

    // Pixel probe: draw the viewer image to a temp canvas and sample at bbox positions
    // This tells us WHERE elements actually appear vs where we think they are
    var probeCtx = null;
    if (imgEl && imgEl.naturalWidth > 0) {
      try {
        var probeCanvas = document.createElement('canvas');
        probeCanvas.width = imgEl.naturalWidth;
        probeCanvas.height = imgEl.naturalHeight;
        probeCtx = probeCanvas.getContext('2d', { willReadFrequently: true });
        probeCtx.drawImage(imgEl, 0, 0);
      } catch(e) { probeCtx = null; }
    }

    var scale = _meta ? _meta.scale : 0.5;

    // Pick 5 findings spread across the page (top, 25%, 50%, 75%, bottom)
    var bboxFindings = _allFindings.filter(function(f) { return f.bboxes.length > 0; });
    var probeIndices = [];
    if (bboxFindings.length > 0) {
      var step = Math.max(1, Math.floor(bboxFindings.length / 5));
      for (var pi = 0; pi < bboxFindings.length && probeIndices.length < 5; pi += step) {
        probeIndices.push(pi);
      }
      if (probeIndices.indexOf(bboxFindings.length - 1) === -1) probeIndices.push(bboxFindings.length - 1);
    }

    probeIndices.forEach(function(fi) {
      var f = bboxFindings[fi];
      var bbox = f.bboxes[0];
      var entry = { idx: fi, severity: f.severity, title: f.title.substring(0, 60), category: f.category };
      entry.dom = bbox;
      entry.canvas = { x: Math.round(bbox.left * scale), y: Math.round(bbox.top * scale), w: Math.round(bbox.width * scale), h: Math.round(bbox.height * scale) };

      // Pixel probe: sample a column of pixels at the center X of the bbox
      // Look for a color change (non-background) within ±80px of expected Y
      if (probeCtx) {
        var cx = Math.round((bbox.left + bbox.width / 2) * scale);
        var expectedY = Math.round(bbox.top * scale);
        // Sample the background color at the top of the page for reference
        var bgSample = probeCtx.getImageData(cx, 2, 1, 1).data;
        var bgKey = bgSample[0] + ',' + bgSample[1] + ',' + bgSample[2];

        // Scan ±80px around expected position
        var scanStart = Math.max(0, expectedY - 80);
        var scanEnd = Math.min(imgEl.naturalHeight, expectedY + 80);
        var nonBgPositions = [];
        for (var sy = scanStart; sy < scanEnd; sy++) {
          var px = probeCtx.getImageData(cx, sy, 1, 1).data;
          var pxKey = px[0] + ',' + px[1] + ',' + px[2];
          // Check if this pixel differs significantly from background
          var dr = Math.abs(px[0] - bgSample[0]), dg = Math.abs(px[1] - bgSample[1]), db = Math.abs(px[2] - bgSample[2]);
          if (dr + dg + db > 30) {
            nonBgPositions.push(sy);
          }
        }

        if (nonBgPositions.length > 0) {
          var firstContent = nonBgPositions[0];
          var lastContent = nonBgPositions[nonBgPositions.length - 1];
          entry.probe = {
            scannedRange: [scanStart, scanEnd],
            expectedY: expectedY,
            firstContentY: firstContent,
            lastContentY: lastContent,
            offsetFromExpected: expectedY - firstContent,
            contentSpan: lastContent - firstContent,
            bgColor: 'rgb(' + bgSample[0] + ',' + bgSample[1] + ',' + bgSample[2] + ')',
            sampleX: cx
          };
        } else {
          entry.probe = { scannedRange: [scanStart, scanEnd], expectedY: expectedY, noContentFound: true, sampleX: cx };
        }
      }

      info.findings.push(entry);
    });

    // Also add raw pairs for reference
    if (_reportData && _reportData.raw && _reportData.raw.colors && _reportData.raw.colors.contrastPairs) {
      info.rawPairs = _reportData.raw.colors.contrastPairs.slice(0, 3).map(function(p) {
        return { selector: p.selector, text: (p.text || '').substring(0, 30), bbox: p.bbox };
      });
    }

    // Legacy format for remaining findings
    _allFindings.slice(0, 10).forEach(function(f, idx) {
      var entry = { idx: idx, severity: f.severity, title: f.title.substring(0, 60), category: f.category, bboxes: [] };
      f.bboxes.forEach(function(bbox) {
        entry.bboxes.push({
          dom: bbox,
          canvas: { x: Math.round(bbox.left * scale), y: Math.round(bbox.top * scale), w: Math.round(bbox.width * scale), h: Math.round(bbox.height * scale) }
        });
      });
      info.findings.push(entry);
    });

    // Raw contrast pair bboxes (first 5)
    if (_reportData && _reportData.raw && _reportData.raw.colors && _reportData.raw.colors.contrastPairs) {
      info.rawPairs = _reportData.raw.colors.contrastPairs.slice(0, 5).map(function(p) {
        return { selector: p.selector, text: (p.text || '').substring(0, 30), bbox: p.bbox, fg: p.fg, bg: p.bg, ratio: p.ratio };
      });
    }

    return JSON.stringify(info, null, 2);
  }

  // Load all screenshot data URIs and stitch into one tall canvas
  function stitchScreenshots(dataUris, callback) {
    var images = [];
    var loaded = 0;
    dataUris.forEach(function(uri, idx) {
      var img = new Image();
      img.onload = function() {
        images[idx] = img;
        loaded++;
        if (loaded === dataUris.length) {
          // All loaded — stitch vertically
          var totalWidth = 0, totalHeight = 0;
          var sectionSizes = [];
          images.forEach(function(im, i) {
            if (im) {
              if (im.width > totalWidth) totalWidth = im.width;
              totalHeight += im.height;
              sectionSizes.push({ idx: i, width: im.width, height: im.height });
            }
          });
          var canvas = document.createElement('canvas');
          canvas.width = totalWidth;
          canvas.height = totalHeight;
          var ctx = canvas.getContext('2d');
          var y = 0;
          images.forEach(function(im) {
            if (im) { ctx.drawImage(im, 0, y); y += im.height; }
          });
          callback({ canvas: canvas, ctx: ctx, width: totalWidth, height: totalHeight, sectionSizes: sectionSizes });
        }
      };
      img.onerror = function() {
        images[idx] = null;
        loaded++;
        if (loaded === dataUris.length) callback(null);
      };
      img.src = uri;
    });
  }

  function applyZoom(frame) {
    if (!frame) return;
    var img = frame.querySelector('.milg-viewer-img');
    var svg = frame.querySelector('.milg-viewer-svg');
    if (!img) return;
    if (_zoomLevel === 1) {
      img.style.width = '';
      img.style.maxWidth = '95vw';
      if (svg) { svg.style.width = ''; svg.style.height = ''; }
    } else {
      var baseWidth = _meta ? _meta.canvasWidth : 640;
      var zoomedWidth = Math.round(baseWidth * _zoomLevel);
      img.style.maxWidth = 'none';
      img.style.width = zoomedWidth + 'px';
      // Force SVG to match image dimensions exactly
      if (svg) {
        svg.style.width = zoomedWidth + 'px';
        // Height follows aspect ratio from viewBox automatically, but set explicitly
        var vb = svg.getAttribute('viewBox');
        if (vb && _stitchedCanvas) {
          var ratio = _stitchedCanvas.height / _stitchedCanvas.width;
          svg.style.height = Math.round(zoomedWidth * ratio) + 'px';
        }
      }
    }
  }

  function _onKeyDown(e) {
    if (!_overlay) return;
    if (e.key === 'Escape') close();
  }

  function updateFilterButtons() {
    if (!_overlay) return;
    var btns = _overlay.querySelectorAll('.milg-viewer-filter-btn');
    btns.forEach(function(btn) {
      var type = btn.getAttribute('data-filter-type');
      var value = btn.getAttribute('data-filter-value');
      var isActive = _activeFilter && _activeFilter.type === type && _activeFilter.value === value;
      btn.classList.toggle('active', isActive);
    });
  }

  function renderOverlays() {
    var svg = _overlay && _overlay.querySelector('.milg-viewer-svg');
    if (!svg || !_meta) return;

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Show hint when no filter is active
    var hint = _overlay.querySelector('.milg-viewer-hint');
    if (!_activeFilter) {
      if (_allFindings.length > 0 && !hint) {
        var hintEl = document.createElement('div');
        hintEl.className = 'milg-viewer-hint';
        hintEl.textContent = 'Select a filter above to highlight findings';
        var content = _overlay.querySelector('.milg-viewer-content');
        if (content) content.appendChild(hintEl);
      }
      return;
    }
    if (hint) hint.parentNode.removeChild(hint);

    // Handle pixel verification filter
    if (_activeFilter.type === 'verify') {
      renderVerifyOverlays(svg);
      return;
    }

    // Compute actual scale from canvas dimensions vs document dimensions.
    // The document may have grown between extraction (bboxes) and capture (screenshots)
    // due to lazy-loaded content. Use docHeightAtCapture for Y mapping.
    var scaleX = _meta.scale;
    var scaleY = _meta.scale;

    // Build pixel verification lookup
    var verifyMap = {};
    if (_reportData && _reportData._contrastVerifyResults) {
      _reportData._contrastVerifyResults.forEach(function(vr) {
        if (vr.selector) verifyMap[vr.selector] = vr;
      });
    }

    _allFindings.forEach(function(finding, fIdx) {
      if (_activeFilter.type === 'category' && finding.icon !== _activeFilter.value) return;
      if (_activeFilter.type === 'severity' && finding.severity !== _activeFilter.value) return;

      var color = COLORS[finding.severity] || COLORS.info;

      // Check pixel verification
      var verifyResult = null;
      if (finding.detail) {
        Object.keys(verifyMap).forEach(function(sel) {
          if (finding.detail.indexOf(sel) !== -1) verifyResult = verifyMap[sel];
        });
      }

      finding.bboxes.forEach(function(bbox) {
        var x = Math.round(bbox.left * scaleX);
        var y = Math.round(bbox.top * scaleY) - _calibrationOffsetY;
        var w = Math.round(bbox.width * scaleX);
        var h = Math.round(bbox.height * scaleY);

        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', Math.max(w, 4));
        rect.setAttribute('height', Math.max(h, 4));
        rect.setAttribute('fill', color.fill);
        rect.setAttribute('stroke', color.stroke);
        rect.setAttribute('stroke-width', '1.5');
        rect.setAttribute('rx', '2');
        rect.setAttribute('data-finding', fIdx);

        // Pixel verification indicators
        if (verifyResult) {
          if (verifyResult.crossesBoundary && verifyResult.cssPasses && !verifyResult.pixelPasses) {
            rect.setAttribute('stroke', '#ef4444');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('stroke-dasharray', '6 2');
            rect.setAttribute('fill', 'rgba(239,68,68,0.25)');
          } else if (verifyResult.crossesBoundary && !verifyResult.cssPasses && verifyResult.pixelPasses) {
            rect.setAttribute('stroke', '#22c55e');
            rect.setAttribute('stroke-width', '1.5');
            rect.setAttribute('stroke-dasharray', '4 3');
            rect.setAttribute('fill', 'rgba(34,197,94,0.15)');
          } else if (verifyResult.significant) {
            rect.setAttribute('stroke-dasharray', '4 2');
          }
        }

        svg.appendChild(rect);
      });
    });

    // Event handlers on rects
    svg.querySelectorAll('rect').forEach(function(rect) {
      rect.addEventListener('mouseenter', function(e) { showFindingTooltip(e, parseInt(rect.getAttribute('data-finding'))); });
      rect.addEventListener('mouseleave', hideTooltip);
      rect.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          // Shift+click: copy element debug info
          window.getSelection().removeAllRanges();
          var fIdx = parseInt(rect.getAttribute('data-finding'));
          var f = _allFindings[fIdx];
          if (f) {
            var rx = parseInt(rect.getAttribute('x')), ry = parseInt(rect.getAttribute('y'));
            var bboxIdx = 0;
            f.bboxes.forEach(function(bb, bi) {
              if (Math.round(bb.left * scaleX) === rx && Math.round(bb.top * scaleY) === ry) bboxIdx = bi;
            });
            var bb = f.bboxes[bboxIdx];
            var info = {
              finding: f.title.substring(0, 60),
              severity: f.severity,
              category: f.category,
              bbox_dom: bb,
              bbox_canvas: { x: Math.round(bb.left * scaleX), y: Math.round(bb.top * scaleY), w: Math.round(bb.width * scaleX), h: Math.round(bb.height * scaleY) },
              actual_scales: { scaleX: scaleX, scaleY: scaleY, nominal: _meta.scale, calibrationOffsetY: _calibrationOffsetY },
              rect_attrs: { x: rect.getAttribute('x'), y: rect.getAttribute('y'), width: rect.getAttribute('width'), height: rect.getAttribute('height') },
              meta: _meta,
              extractionScroll: _reportData && _reportData.raw && _reportData.raw.meta ? { scrollX: _reportData.raw.meta.scrollX, scrollY: _reportData.raw.meta.scrollY, docHeight: _reportData.raw.meta.docHeight } : null,
              captureScrollY: _meta.captureScrollY
            };
            navigator.clipboard.writeText(JSON.stringify(info, null, 2)).then(function() {
              alert('Element debug info copied!');
            });
          }
        } else {
          // Check for overlapping rects at this position
          var clickX = parseFloat(rect.getAttribute('x'));
          var clickY = parseFloat(rect.getAttribute('y'));
          var clickW = parseFloat(rect.getAttribute('width'));
          var clickH = parseFloat(rect.getAttribute('height'));
          var overlapping = [];
          svg.querySelectorAll('rect[data-finding]').forEach(function(r) {
            var rx = parseFloat(r.getAttribute('x')), ry = parseFloat(r.getAttribute('y'));
            var rw = parseFloat(r.getAttribute('width')), rh = parseFloat(r.getAttribute('height'));
            // Check if rects overlap (not just same position)
            if (rx < clickX + clickW && rx + rw > clickX && ry < clickY + clickH && ry + rh > clickY) {
              var fi = parseInt(r.getAttribute('data-finding'));
              if (overlapping.indexOf(fi) === -1) overlapping.push(fi);
            }
          });
          if (overlapping.length > 1) {
            showOverlapPicker(e, overlapping);
          } else {
            scrollToFinding(parseInt(rect.getAttribute('data-finding')));
          }
        }
      });
    });
  }

  function renderVerifyOverlays(svg) {
    if (!_reportData || !_reportData._contrastVerifyResults || !_meta) return;
    var results = _reportData._contrastVerifyResults;
    var showFails = _activeFilter.value === 'fails';

    var vScaleX = _meta.scale;
    var vScaleY = _meta.scale;

    var pairsBySelector = {};
    if (_reportData.raw && _reportData.raw.colors && _reportData.raw.colors.contrastPairs) {
      _reportData.raw.colors.contrastPairs.forEach(function(p) {
        if (p.bbox) pairsBySelector[p.selector] = p;
      });
    }

    results.forEach(function(vr, vIdx) {
      if (showFails && !vr.crossesBoundary) return;
      var pair = pairsBySelector[vr.selector];
      if (!pair || !pair.bbox) return;

      var x = Math.round(pair.bbox.left * vScaleX);
      var y = Math.round(pair.bbox.top * vScaleY) - _calibrationOffsetY;
      var w = Math.round(pair.bbox.width * vScaleX);
      var h = Math.round(pair.bbox.height * vScaleY);

      var fill, stroke, dash;
      if (vr.crossesBoundary && vr.cssPasses && !vr.pixelPasses) {
        fill = 'rgba(239,68,68,0.25)'; stroke = '#ef4444'; dash = '6 2';
      } else if (vr.crossesBoundary && !vr.cssPasses && vr.pixelPasses) {
        fill = 'rgba(34,197,94,0.2)'; stroke = '#22c55e'; dash = '4 3';
      } else if (vr.isVariableBg) {
        fill = 'rgba(234,179,8,0.15)'; stroke = '#eab308'; dash = '4 2';
      } else {
        fill = 'rgba(34,197,94,0.08)'; stroke = '#86efac'; dash = '';
      }

      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', Math.max(w, 4));
      rect.setAttribute('height', Math.max(h, 4));
      rect.setAttribute('fill', fill);
      rect.setAttribute('stroke', stroke);
      rect.setAttribute('stroke-width', '1.5');
      rect.setAttribute('rx', '2');
      if (dash) rect.setAttribute('stroke-dasharray', dash);
      rect.setAttribute('data-verify', vIdx);
      svg.appendChild(rect);

      // Ratio label
      if (w > 30 && h > 12) {
        var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', x + 3);
        label.setAttribute('y', y + 11);
        label.setAttribute('font-size', '10');
        label.setAttribute('fill', stroke);
        label.setAttribute('font-family', 'system-ui, sans-serif');
        label.setAttribute('font-weight', '600');
        label.setAttribute('pointer-events', 'none');
        label.textContent = (vr.pixelRatio || vr.pixelRatioAvg || '?') + ':1';
        svg.appendChild(label);
      }
    });

    // Tooltips for verify rects
    svg.querySelectorAll('rect[data-verify]').forEach(function(rect) {
      rect.addEventListener('mouseenter', function(e) { showVerifyTooltip(e, parseInt(rect.getAttribute('data-verify'))); });
      rect.addEventListener('mouseleave', hideTooltip);
      rect.addEventListener('click', function() { close(); });
    });
  }

  function showFindingTooltip(e, findingIdx) {
    hideTooltip();
    var finding = _allFindings[findingIdx];
    if (!finding) return;

    var sevClass = 'milg-viewer-sev-' + finding.severity;
    var verifyNote = '';
    if (_reportData && _reportData._contrastVerifyResults && window.MilgContrastVerify) {
      var vResults = _reportData._contrastVerifyResults;
      for (var vi = 0; vi < vResults.length; vi++) {
        if (finding.detail && finding.detail.indexOf(vResults[vi].selector) !== -1) {
          verifyNote = '<div class="milg-viewer-tooltip-verify">' + MilgContrastVerify.formatResult(vResults[vi]) + '</div>';
          break;
        }
      }
    }

    _tooltip = document.createElement('div');
    _tooltip.className = 'milg-viewer-tooltip';
    _tooltip.innerHTML = '<div class="milg-viewer-tooltip-header">' +
      '<span class="milg-viewer-tooltip-badge ' + sevClass + '">' + finding.severity + '</span>' +
      '<span class="milg-viewer-tooltip-cat">' + finding.category + '</span>' +
      '</div>' +
      '<div class="milg-viewer-tooltip-title">' + finding.title + '</div>' +
      (finding.detail ? '<div class="milg-viewer-tooltip-detail">' + finding.detail.substring(0, 120) + '</div>' : '') +
      verifyNote;

    positionTooltip(e);
  }

  function showVerifyTooltip(e, vIdx) {
    hideTooltip();
    var vr = (_reportData && _reportData._contrastVerifyResults) ? _reportData._contrastVerifyResults[vIdx] : null;
    if (!vr) return;

    _tooltip = document.createElement('div');
    _tooltip.className = 'milg-viewer-tooltip';
    _tooltip.innerHTML = '<div class="milg-viewer-tooltip-title">' + vr.selector + '</div>' +
      '<div class="milg-viewer-tooltip-detail">"' + (vr.text || '').substring(0, 40) + '"</div>' +
      '<div style="margin-top:4px;font-size:11px">' +
      'CSS: ' + vr.cssRatio + ':1 ' + (vr.cssPasses ? '<span style="color:#22c55e">pass</span>' : '<span style="color:#ef4444">fail</span>') +
      '<br>Pixel: ' + (vr.pixelRatio || vr.pixelRatioAvg || '?') + ':1 ' + (vr.pixelPasses ? '<span style="color:#22c55e">pass</span>' : '<span style="color:#ef4444">fail</span>') +
      (vr.isVariableBg ? '<br><span style="color:#eab308">Variable background</span>' : '') +
      (vr.cssBgConfirmed === false ? '<br><span style="color:#f59e0b">CSS bg differs from actual</span>' : '') +
      '</div>';

    positionTooltip(e);
  }

  function positionTooltip(e) {
    document.body.appendChild(_tooltip);
    var x = e.clientX + 12, y = e.clientY + 12;
    var tw = _tooltip.offsetWidth, th = _tooltip.offsetHeight;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 12;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - 12;
    _tooltip.style.left = x + 'px';
    _tooltip.style.top = y + 'px';
  }

  function scrollToFinding(findingIdx) {
    close();
    var el = document.querySelector('[data-finding-idx="' + findingIdx + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow 300ms ease';
      el.style.boxShadow = '0 0 0 3px var(--primary, #2563eb)';
      setTimeout(function() { el.style.boxShadow = ''; }, 1500);
    }
  }

  function hideTooltip() {
    if (_tooltip && _tooltip.parentNode) _tooltip.parentNode.removeChild(_tooltip);
    _tooltip = null;
  }

  // Overlap picker: shows a popup list when multiple findings overlap at the click position
  var _overlapPicker = null;
  function hideOverlapPicker() {
    if (_overlapPicker && _overlapPicker.parentNode) _overlapPicker.parentNode.removeChild(_overlapPicker);
    _overlapPicker = null;
  }

  function showOverlapPicker(e, findingIndices) {
    hideOverlapPicker();
    hideTooltip();
    _overlapPicker = document.createElement('div');
    _overlapPicker.className = 'milg-viewer-overlap-picker';
    _overlapPicker.innerHTML = '<div class="milg-viewer-overlap-header">' + findingIndices.length + ' overlapping findings</div>';
    findingIndices.forEach(function(fIdx) {
      var f = _allFindings[fIdx];
      if (!f) return;
      var sevColor = COLORS[f.severity] || COLORS.info;
      var item = document.createElement('div');
      item.className = 'milg-viewer-overlap-item';
      item.innerHTML = '<span class="milg-viewer-overlap-dot" style="background:' + sevColor.stroke + '"></span>' +
        '<span class="milg-viewer-overlap-text">' + f.title.substring(0, 60) + '</span>' +
        '<span class="milg-viewer-overlap-cat">' + f.category + '</span>';
      item.addEventListener('click', function(ev) {
        ev.stopPropagation();
        hideOverlapPicker();
        scrollToFinding(fIdx);
      });
      item.addEventListener('mouseenter', function() {
        // Highlight the corresponding rect(s)
        var svg = _overlay && _overlay.querySelector('.milg-viewer-svg');
        if (svg) svg.querySelectorAll('rect[data-finding="' + fIdx + '"]').forEach(function(r) { r.setAttribute('stroke-width', '3'); });
      });
      item.addEventListener('mouseleave', function() {
        var svg = _overlay && _overlay.querySelector('.milg-viewer-svg');
        if (svg) svg.querySelectorAll('rect[data-finding="' + fIdx + '"]').forEach(function(r) { r.setAttribute('stroke-width', '1.5'); });
      });
      _overlapPicker.appendChild(item);
    });

    document.body.appendChild(_overlapPicker);
    var x = e.clientX + 8, y = e.clientY + 8;
    var pw = _overlapPicker.offsetWidth, ph = _overlapPicker.offsetHeight;
    if (x + pw > window.innerWidth - 8) x = e.clientX - pw - 8;
    if (y + ph > window.innerHeight - 8) y = e.clientY - ph - 8;
    _overlapPicker.style.left = x + 'px';
    _overlapPicker.style.top = y + 'px';

    // Close picker on outside click
    setTimeout(function() {
      document.addEventListener('click', function onClickAway(ev) {
        if (_overlapPicker && !_overlapPicker.contains(ev.target)) {
          hideOverlapPicker();
          document.removeEventListener('click', onClickAway);
        }
      });
    }, 0);
  }

  function close() {
    hideTooltip();
    hideOverlapPicker();
    if (_overlay) {
      _overlay.classList.remove('visible');
      var el = _overlay;
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    }
    _overlay = null;
    _allFindings = [];
    _screenshots = [];
    _meta = null;
    _reportData = null;
    _stitchedCanvas = null;
    _zoomLevel = 1;
    _calibrationOffsetY = 0;
    document.removeEventListener('keydown', _onKeyDown);
  }

  // Simple lightbox fallback
  function simpleLightbox(img) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.92);z-index:9999;cursor:zoom-out;display:flex;align-items:flex-start;justify-content:center;overflow:auto;-webkit-overflow-scrolling:touch';
    var zoomed = document.createElement('img');
    zoomed.src = img.src;
    zoomed.alt = img.alt;
    zoomed.style.cssText = 'max-width:95vw;max-height:none;display:block;margin:16px auto';
    overlay.appendChild(zoomed);
    document.body.appendChild(overlay);
    function closeSimple() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeSimple(); });
    document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { closeSimple(); document.removeEventListener('keydown', onKey); } });
  }

  // Open viewer focused on a specific finding
  function showFinding(findingIdx, reportData) {
    if (!reportData || !reportData.raw || !reportData.raw.screenshots || !reportData.raw.screenshotMeta) return;

    var findings = [];
    var cats = reportData.categories || [];
    cats.forEach(function(cat) {
      (cat.findings || []).forEach(function(f) {
        if (!f.locator || !f.locator.bboxes || f.locator.bboxes.length === 0) return;
        findings.push({ icon: cat.icon, bboxes: f.locator.bboxes });
      });
    });

    var target = findings[findingIdx];
    if (!target || !target.bboxes[0]) return;

    var meta = reportData.raw.screenshotMeta;
    var sectionIdx = Math.floor(target.bboxes[0].top / meta.viewportHeight);
    sectionIdx = Math.min(sectionIdx, reportData.raw.screenshots.length - 1);

    var dummyImg = document.createElement('img');
    dummyImg.src = reportData.raw.screenshots[0];
    open(dummyImg, sectionIdx, reportData);

    _activeFilter = { type: 'category', value: target.icon };
    updateFilterButtons();
    renderOverlays();
  }

  return {
    open: open,
    close: close,
    showFinding: showFinding
  };
})();
