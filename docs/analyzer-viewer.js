// make-it-look-good — Screenshot Viewer with Bbox Overlays
// Stitches screenshot sections into one continuous scrollable image
// with a single SVG overlay for all bounding boxes.

window.MilgViewer = (function() {
  "use strict";

  // Local contrast ratio for pixel debug clicks
  function _lum(c) { var rs=c.r/255,gs=c.g/255,bs=c.b/255; var r=rs<=0.03928?rs/12.92:Math.pow((rs+0.055)/1.055,2.4); var g=gs<=0.03928?gs/12.92:Math.pow((gs+0.055)/1.055,2.4); var b=bs<=0.03928?bs/12.92:Math.pow((bs+0.055)/1.055,2.4); return 0.2126*r+0.7152*g+0.0722*b; }
  function contrastRatio(c1,c2) { var l1=_lum(c1),l2=_lum(c2); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); }

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

  // Severity colors: red / yellow / blue / green
  var COLORS = {
    error:   { fill: 'rgba(239,68,68,0.22)', stroke: '#ef4444' },
    warning: { fill: 'rgba(234,179,8,0.22)', stroke: '#eab308' },
    info:    { fill: 'rgba(59,130,246,0.22)', stroke: '#3b82f6' },
    pass:    { fill: 'rgba(34,197,94,0.12)', stroke: '#22c55e' }
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

    // Collect findings with bboxes from all categories (including pass)
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

    // Add passing elements from raw data that have bboxes (headings, touch targets that passed)
    var raw = reportData.raw || {};
    // Passing headings
    (raw.typography && raw.typography.headings || []).forEach(function(h) {
      if (!h.bbox) return;
      _allFindings.push({ severity: 'pass', title: h.tag.toUpperCase() + ': "' + (h.text || '').substring(0, 40) + '"', detail: h.fontSize + ' ' + h.fontWeight, category: 'Typography', icon: 'type', bboxes: [h.bbox] });
    });
    // Passing touch targets (those NOT in the findings = they passed)
    var failSelectors = {};
    _allFindings.forEach(function(f) { if (f.icon === 'touch' && f.severity !== 'pass') failSelectors[f.title] = true; });
    (raw.interaction && raw.interaction.touchTargets || []).forEach(function(t) {
      if (!t.bbox || Math.min(t.width, t.height) < 24) return; // only show reasonably-sized passing ones
      _allFindings.push({ severity: 'pass', title: t.element + ' ' + t.width + '\u00d7' + t.height + 'px', detail: (t.text || '') + ' — ' + t.selector, category: 'Touch Targets', icon: 'touch', bboxes: [t.bbox] });
    });

    // Build overlay shell (image will be inserted after stitching)
    _overlay = document.createElement('div');
    _overlay.className = 'milg-viewer-overlay';

    // Toolbar
    var toolbar = document.createElement('div');
    toolbar.className = 'milg-viewer-toolbar';

    // Count findings per category and severity
    var catCounts = {}, sevCounts = { error: 0, warning: 0, info: 0, pass: 0 }, catSet = {};
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
    var totalFindings = _allFindings.length;
    var allPill = totalFindings > 0 ? '<button class="milg-viewer-filter-btn" data-filter-type="severity" data-filter-value="all">All <span class="milg-viewer-count">' + totalFindings + '</span></button>' : '';
    var sevPills = allPill + sevPill('error', 'Errors') + sevPill('warning', 'Warnings') + sevPill('info', 'Info') + sevPill('pass', 'Passed');

    // Pixel verification pills
    var verifyPill = '';
    var vResults = reportData._contrastVerifyResults || [];
    if (vResults.length > 0) {
      var vFails = vResults.filter(function(r) { return r.crossesBoundary; }).length;
      // Count layers
      var layerCounts = {};
      vResults.forEach(function(r) { var l = r.maskLayer || 0; layerCounts[l] = (layerCounts[l] || 0) + 1; });
      var layerPills = '';
      var layerKeys = Object.keys(layerCounts).sort(function(a, b) { return a - b; });
      if (layerKeys.length > 1) {
        layerKeys.forEach(function(l) {
          layerPills += '<button class="milg-viewer-filter-btn" data-filter-type="verify" data-filter-value="layer' + l + '">L' + l + ' <span class="milg-viewer-count">' + layerCounts[l] + '</span></button>';
        });
      }
      verifyPill = '<span class="milg-viewer-sep"></span>' +
        '<button class="milg-viewer-filter-btn milg-viewer-sev-verify" data-filter-type="verify" data-filter-value="all">Pixel Verified <span class="milg-viewer-count">' + vResults.length + '</span></button>' +
        (vFails > 0 ? '<button class="milg-viewer-filter-btn milg-viewer-sev-error" data-filter-type="verify" data-filter-value="fails">Pixel Fails <span class="milg-viewer-count">' + vFails + '</span></button>' : '') +
        layerPills;
    }

    toolbar.innerHTML =
      '<div class="milg-viewer-filters">' + catPills + '<span class="milg-viewer-sep"></span>' + sevPills + verifyPill + '</div>' +
      '<select class="milg-viewer-zoom-select" title="Zoom level">' +
        '<option value="0.75">75%</option><option value="1" selected>100%</option><option value="1.5">150%</option><option value="2">200%</option><option value="2.5">250%</option><option value="3">300%</option>' +
      '</select>' +
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
          // calibration offset applied silently
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
    // At high zoom, left-align so the whole image is scrollable (center clips left edge)
    var content = frame.parentElement;
    if (content) content.style.justifyContent = _zoomLevel > 1 ? 'flex-start' : 'center';
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

    // Handle pixel verification filter (including single-selector mode)
    if (_activeFilter.type === 'verify' || _activeFilter.type === 'verifySelector') {
      renderVerifyOverlays(svg);
      return;
    }

    // Compute actual scale from canvas dimensions vs document dimensions.
    // The document may have grown between extraction (bboxes) and capture (screenshots)
    // due to lazy-loaded content. Use docHeightAtCapture for Y mapping.
    var scaleX = _meta.scale;
    var scaleY = _meta.scale;

    // Build pixel verification lookups: by selector AND by bbox position
    var verifyBySelector = {};
    var verifyByPos = {}; // "left,top" → verify result (for bbox-based matching)
    if (_reportData && _reportData._contrastVerifyResults) {
      _reportData._contrastVerifyResults.forEach(function(vr) {
        if (vr.selector) verifyBySelector[vr.selector] = vr;
        if (vr.bbox) verifyByPos[Math.round(vr.bbox.left) + ',' + Math.round(vr.bbox.top)] = vr;
      });
    }

    _allFindings.forEach(function(finding, fIdx) {
      if (_activeFilter.type === 'finding' && fIdx !== _activeFilter.value) return;
      if (_activeFilter.type === 'category' && finding.icon !== _activeFilter.value) return;
      if (_activeFilter.type === 'severity' && _activeFilter.value !== 'all' && finding.severity !== _activeFilter.value) return;

      var color = COLORS[finding.severity] || COLORS.info;

      finding.bboxes.forEach(function(bbox) {
        var x = Math.round(bbox.left * scaleX);
        var y = Math.round(bbox.top * scaleY) - _calibrationOffsetY;
        var w = Math.round(bbox.width * scaleX);
        var h = Math.round(bbox.height * scaleY);

        // Match pixel verify result for THIS specific bbox (by position or selector)
        var bboxKey = Math.round(bbox.left) + ',' + Math.round(bbox.top);
        var vr = verifyByPos[bboxKey] || null;
        // Fallback: match by selector in finding detail
        if (!vr && finding.detail) {
          Object.keys(verifyBySelector).forEach(function(sel) {
            if (finding.detail.indexOf(sel) !== -1) vr = verifyBySelector[sel];
          });
        }

        // Override color: always use the WORST (most severe) of CSS and pixel verify
        // Severity rank: error > warning > info > pass
        var SEV_RANK = { error: 3, warning: 2, info: 1, pass: 0 };
        var cssSev = finding.severity || 'info';
        var pixelSev = null;
        if (vr) {
          if (vr.pixelRatioP10) {
            var p10 = parseFloat(vr.pixelRatioP10);
            var needed = vr.neededRatio || 4.5;
            if (p10 < needed) pixelSev = 'error';
            else if (p10 < needed * 1.2) pixelSev = 'warning';
            else pixelSev = 'pass';
          } else if (vr.crossesBoundary) {
            pixelSev = (vr.cssPasses && !vr.pixelPasses) ? 'error' : (!vr.cssPasses && vr.pixelPasses) ? 'pass' : null;
          }
        }
        // Take the worst of CSS severity and pixel severity
        var finalSev = cssSev;
        if (pixelSev && (SEV_RANK[pixelSev] || 0) > (SEV_RANK[finalSev] || 0)) {
          finalSev = pixelSev;
        }
        var bboxColor = COLORS[finalSev] || color;

        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', Math.max(w, 4));
        rect.setAttribute('height', Math.max(h, 4));
        rect.setAttribute('fill', bboxColor.fill);
        rect.setAttribute('stroke', bboxColor.stroke);
        rect.setAttribute('stroke-width', '1.5');
        rect.setAttribute('rx', '2');
        rect.setAttribute('data-finding', fIdx);

        // Dashed indicator when pixel verification disagrees with CSS
        if (vr) {
          if (vr.crossesBoundary) {
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('stroke-dasharray', '6 2');
          } else if (vr.significant) {
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
          // Check for overlapping rects at click point (SVG coords)
          var _svgR = svg.getBoundingClientRect();
          var _cx = (e.clientX - _svgR.left) * (svg.viewBox.baseVal.width / _svgR.width);
          var _cy = (e.clientY - _svgR.top) * (svg.viewBox.baseVal.height / _svgR.height);
          var overlapping = [];
          svg.querySelectorAll('rect[data-finding]').forEach(function(r) {
            var rx = parseFloat(r.getAttribute('x')), ry = parseFloat(r.getAttribute('y'));
            var rw = parseFloat(r.getAttribute('width')), rh = parseFloat(r.getAttribute('height'));
            if (_cx >= rx && _cx <= rx + rw && _cy >= ry && _cy <= ry + rh) {
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

    // Layer filter: "layerN" shows only that layer
    var filterLayer = null;
    if (_activeFilter.value && _activeFilter.value.indexOf('layer') === 0) {
      filterLayer = parseInt(_activeFilter.value.substring(5));
    }

    // Single-selector filter: only show the matching element
    var filterSelector = _activeFilter.type === 'verifySelector' ? _activeFilter.value : null;

    results.forEach(function(vr, vIdx) {
      if (filterSelector && vr.selector !== filterSelector) return;
      if (!filterSelector && showFails && !vr.crossesBoundary) return;
      if (!filterSelector && filterLayer !== null && (vr.maskLayer || 0) !== filterLayer) return;
      var bbox = vr.bbox;
      if (!bbox) return;

      var x = Math.round(bbox.left * vScaleX);
      var y = Math.round(bbox.top * vScaleY) - _calibrationOffsetY;
      var w = Math.round(bbox.width * vScaleX);
      var h = Math.round(bbox.height * vScaleY);

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
        label.textContent = (vr.pixelRatioP10 || vr.pixelRatio || '?') + ':1';
        svg.appendChild(label);
      }

      // Selector + sample points + debug layers + group data stored for interaction
      rect._selector = vr.selector || null;
      rect._samplePoints = vr.samplePoints || null;
      rect._worstPoint = vr.worstPoint || null;
      rect._debug = vr._debug || null;
      rect._bgKeyMap = vr._bgKeyMap || null;
      rect._sectionOffset = (vr.sectionIdx && _meta.viewportHeight) ? vr.sectionIdx * Math.round(_meta.viewportHeight * vScaleX) : 0;
    });

    // BBox edge contrast results — render as dashed yellow rects
    var bboxEdgeResults = (_reportData && _reportData._bboxEdgeResults) || [];
    if (bboxEdgeResults.length > 0 && (!showFails || filterSelector)) {
      bboxEdgeResults.forEach(function(ber) {
        if (!ber.bbox || !ber.isWarning) return;
        if (filterSelector && ber.selector !== filterSelector) return;
        var bx = Math.round(ber.bbox.left * vScaleX);
        var by = Math.round(ber.bbox.top * vScaleY) - _calibrationOffsetY;
        var bw = Math.round(ber.bbox.width * vScaleX);
        var bh = Math.round(ber.bbox.height * vScaleY);
        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', bx);
        rect.setAttribute('y', by);
        rect.setAttribute('width', Math.max(bw, 4));
        rect.setAttribute('height', Math.max(bh, 4));
        rect.setAttribute('fill', 'rgba(234,179,8,0.12)');
        rect.setAttribute('stroke', '#eab308');
        rect.setAttribute('stroke-width', '1.5');
        rect.setAttribute('stroke-dasharray', '4 3');
        rect.setAttribute('rx', '2');
        rect._selector = ber.selector || null;
        svg.appendChild(rect);
        // Label
        if (bw > 40 && bh > 12) {
          var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('x', bx + 3);
          label.setAttribute('y', by + 11);
          label.setAttribute('font-size', '10');
          label.setAttribute('fill', '#eab308');
          label.setAttribute('font-family', 'system-ui, sans-serif');
          label.setAttribute('font-weight', '600');
          label.setAttribute('pointer-events', 'none');
          label.textContent = 'edge ' + ber.pixelRatio + ':1';
          svg.appendChild(label);
        }
      });
    }

    // Hover: show tooltip + worst-point red ring
    // Click: toggle sample dots (with overlap picker for nested elements)
    // Hover highlight: on mouseenter activate mousemove tracker,
    // find closest sample point to cursor, highlight it + its comparison pair
    var _hoverCleanup = null;
    svg.querySelectorAll('rect[data-verify]').forEach(function(rect) {
      var _viIdx = parseInt(rect.getAttribute('data-verify'));
      rect.addEventListener('mouseenter', function(e) {
        var vi = _viIdx;
        showVerifyTooltip(e, vi);
        var sp = rect._samplePoints;
        if (!sp || (!sp.fg.length && !sp.bg.length)) return;
        var secOff = rect._sectionOffset || 0;
        var vr = (_reportData && _reportData._contrastVerifyResults) ? _reportData._contrastVerifyResults[vi] : null;
        var allFg = (sp.fg || []).map(function(p) { return { x: p.x, y: p.y + secOff, r: p.r, g: p.g, b: p.b, groupBg: p.groupBg }; });
        var allBg = (sp.bg || []).map(function(p) { return { x: p.x, y: p.y + secOff, r: p.r, g: p.g, b: p.b }; });

        // Create persistent highlight elements
        var hlGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        hlGroup.setAttribute('class', 'milg-hover-highlight');
        hlGroup.setAttribute('pointer-events', 'none');
        svg.appendChild(hlGroup);

        function onMove(ev) {
          // Convert mouse to SVG coords
          var sr = svg.getBoundingClientRect();
          var vb = svg.viewBox.baseVal;
          var mx = (ev.clientX - sr.left) * (vb.width / sr.width);
          var my = (ev.clientY - sr.top) * (vb.height / sr.height);

          // Find closest FG point to mouse
          var closestFg = null, closestFgDist = Infinity, closestFgIdx = -1;
          allFg.forEach(function(p, i) {
            var d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
            if (d < closestFgDist) { closestFgDist = d; closestFg = p; closestFgIdx = i; }
          });

          // Also find closest BG to mouse
          var closestBgMouse = null, closestBgMouseDist = Infinity;
          allBg.forEach(function(p) {
            var d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
            if (d < closestBgMouseDist) { closestBgMouseDist = d; closestBgMouse = p; }
          });

          // Clear previous highlights
          while (hlGroup.firstChild) hlGroup.removeChild(hlGroup.firstChild);

          var dotR = _zoomLevel >= 1.5 ? 4 : 2.5;

          // Get the group's BG keys from the FG point (if group data available)
          var groupBgKeys = (closestFg && closestFg.groupBg) ? closestFg.groupBg : null;
          var bgKeyMap = (vr && vr._bgKeyMap) ? vr._bgKeyMap : null;

          if (closestFg && groupBgKeys && bgKeyMap && groupBgKeys.length > 0) {
            // === GROUP HOVER: show FG pixel + ALL its BG group members ===
            // FG ring
            var fgRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            fgRing.setAttribute('cx', closestFg.x); fgRing.setAttribute('cy', closestFg.y);
            fgRing.setAttribute('r', dotR); fgRing.setAttribute('fill', 'none');
            fgRing.setAttribute('stroke', '#06b6d4'); fgRing.setAttribute('stroke-width', '2');
            hlGroup.appendChild(fgRing);

            // All BG in this FG's group
            var bgSumR = 0, bgSumG = 0, bgSumB = 0, bgCnt = 0;
            groupBgKeys.forEach(function(k) {
              var bg = bgKeyMap[k];
              if (!bg) return;
              bgSumR += bg.r; bgSumG += bg.g; bgSumB += bg.b; bgCnt++;
              var bgDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
              bgDot.setAttribute('cx', bg.x); bgDot.setAttribute('cy', bg.y + secOff);
              bgDot.setAttribute('r', dotR * 0.7); bgDot.setAttribute('fill', 'none');
              bgDot.setAttribute('stroke', '#f97316'); bgDot.setAttribute('stroke-width', '1.5');
              hlGroup.appendChild(bgDot);
              // Line from FG to each BG
              var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', closestFg.x); line.setAttribute('y1', closestFg.y);
              line.setAttribute('x2', bg.x); line.setAttribute('y2', bg.y + secOff);
              line.setAttribute('stroke', 'rgba(255,255,255,0.4)'); line.setAttribute('stroke-width', '0.5');
              hlGroup.appendChild(line);
            });

            // Contrast label: FG color vs avg BG of group
            if (bgCnt > 0 && closestFg.r !== undefined) {
              var avgBg = { r: Math.round(bgSumR/bgCnt), g: Math.round(bgSumG/bgCnt), b: Math.round(bgSumB/bgCnt) };
              var pairRatio = contrastRatio(closestFg, avgBg);
              var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
              label.setAttribute('x', closestFg.x + dotR + 3); label.setAttribute('y', closestFg.y - 3);
              label.setAttribute('font-size', _zoomLevel >= 1.5 ? '11' : '8');
              label.setAttribute('fill', pairRatio >= 4.5 ? '#22c55e' : pairRatio >= 3 ? '#eab308' : '#ef4444');
              label.setAttribute('font-family', 'system-ui'); label.setAttribute('font-weight', '700');
              label.textContent = Math.round(pairRatio * 10) / 10 + ':1 (' + bgCnt + ' bg)';
              hlGroup.appendChild(label);
              // Color swatches: FG color + avg BG color
              var swY = closestFg.y + dotR + 2;
              var fgSw = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              fgSw.setAttribute('x', closestFg.x + dotR + 3); fgSw.setAttribute('y', swY);
              fgSw.setAttribute('width', 10); fgSw.setAttribute('height', 10); fgSw.setAttribute('rx', 1);
              fgSw.setAttribute('fill', 'rgb('+closestFg.r+','+closestFg.g+','+closestFg.b+')');
              fgSw.setAttribute('stroke', '#fff'); fgSw.setAttribute('stroke-width', '0.5');
              hlGroup.appendChild(fgSw);
              var bgSw = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              bgSw.setAttribute('x', closestFg.x + dotR + 15); bgSw.setAttribute('y', swY);
              bgSw.setAttribute('width', 10); bgSw.setAttribute('height', 10); bgSw.setAttribute('rx', 1);
              bgSw.setAttribute('fill', 'rgb('+avgBg.r+','+avgBg.g+','+avgBg.b+')');
              bgSw.setAttribute('stroke', '#fff'); bgSw.setAttribute('stroke-width', '0.5');
              hlGroup.appendChild(bgSw);
            }
          } else if (closestFg) {
            // === FALLBACK: no group data, show nearest pair ===
            var closestBg = null, closestBgDist = Infinity;
            allBg.forEach(function(p) {
              var d = (p.x - closestFg.x)*(p.x - closestFg.x) + (p.y - closestFg.y)*(p.y - closestFg.y);
              if (d < closestBgDist) { closestBgDist = d; closestBg = p; }
            });
            var fgRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            fgRing.setAttribute('cx', closestFg.x); fgRing.setAttribute('cy', closestFg.y);
            fgRing.setAttribute('r', dotR); fgRing.setAttribute('fill', 'none');
            fgRing.setAttribute('stroke', '#06b6d4'); fgRing.setAttribute('stroke-width', '2');
            hlGroup.appendChild(fgRing);
            if (closestBg) {
              var bgRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
              bgRing.setAttribute('cx', closestBg.x); bgRing.setAttribute('cy', closestBg.y);
              bgRing.setAttribute('r', dotR); bgRing.setAttribute('fill', 'none');
              bgRing.setAttribute('stroke', '#f97316'); bgRing.setAttribute('stroke-width', '2');
              hlGroup.appendChild(bgRing);
              var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', closestFg.x); line.setAttribute('y1', closestFg.y);
              line.setAttribute('x2', closestBg.x); line.setAttribute('y2', closestBg.y);
              line.setAttribute('stroke', 'rgba(255,255,255,0.7)'); line.setAttribute('stroke-width', '1');
              line.setAttribute('stroke-dasharray', '3 2');
              hlGroup.appendChild(line);
              if (closestFg.r !== undefined && closestBg.r !== undefined) {
                var pr = contrastRatio(closestFg, closestBg);
                var lb = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                lb.setAttribute('x', (closestFg.x+closestBg.x)/2 + 4); lb.setAttribute('y', (closestFg.y+closestBg.y)/2 - 3);
                lb.setAttribute('font-size', _zoomLevel >= 1.5 ? '11' : '8');
                lb.setAttribute('fill', pr >= 4.5 ? '#22c55e' : pr >= 3 ? '#eab308' : '#ef4444');
                lb.setAttribute('font-family', 'system-ui'); lb.setAttribute('font-weight', '700');
                lb.textContent = Math.round(pr * 10) / 10 + ':1';
                hlGroup.appendChild(lb);
              }
            }
          }
        }

        function onMoveWithTooltip(ev) {
          onMove(ev);
          // Update tooltip with nearest sample point's colors
          showVerifyTooltip(ev, _viIdx);
        }
        rect.addEventListener('mousemove', onMoveWithTooltip);
        _hoverCleanup = function() {
          rect.removeEventListener('mousemove', onMoveWithTooltip);
          if (hlGroup.parentNode) hlGroup.parentNode.removeChild(hlGroup);
          _hoverCleanup = null;
        };
      });
      rect.addEventListener('mouseleave', function() {
        hideTooltip();
        if (_hoverCleanup) _hoverCleanup();
      });
      // Double-click or right-click: cycle debug layers
      function _cycleDebug(e) {
        e.preventDefault(); e.stopPropagation();
        if (!rect._debug) return;
        var modes = ['none', 'mask', 'zones'];
        var current = rect._debugMode || 'none';
        var idx = modes.indexOf(current);
        var next = modes[(idx + 1) % modes.length];
        rect._debugMode = next;
        if (next === 'none') {
          svg.querySelectorAll('.milg-debug-overlay').forEach(function(el) { el.remove(); });
        } else if (next === 'mask') {
          showDebugLayer(rect, svg, 'mask', null);
        } else if (next === 'zones') {
          showDebugLayer(rect, svg, 'zones', null);
        }
      }
      rect.addEventListener('contextmenu', _cycleDebug);
      rect.addEventListener('dblclick', _cycleDebug);
      rect.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        // Check overlapping verify rects — use click point (SVG coords) for precision
        var svgRect = svg.getBoundingClientRect();
        var clickSvgX = (e.clientX - svgRect.left) * (svg.viewBox.baseVal.width / svgRect.width);
        var clickSvgY = (e.clientY - svgRect.top) * (svg.viewBox.baseVal.height / svgRect.height);
        var overlapping = [];
        svg.querySelectorAll('rect[data-verify]').forEach(function(r) {
          var ox = parseFloat(r.getAttribute('x')), oy = parseFloat(r.getAttribute('y'));
          var ow = parseFloat(r.getAttribute('width')), oh = parseFloat(r.getAttribute('height'));
          // Click point must be inside this rect
          if (clickSvgX >= ox && clickSvgX <= ox + ow && clickSvgY >= oy && clickSvgY <= oy + oh) overlapping.push(r);
        });
        if (overlapping.length > 1) {
          hideOverlapPicker();
          var picker = document.createElement('div');
          picker.className = 'milg-viewer-overlap-picker';
          picker.innerHTML = '<div class="milg-viewer-overlap-header">' + overlapping.length + ' overlapping</div>';
          overlapping.forEach(function(or) {
            var vi = parseInt(or.getAttribute('data-verify'));
            var vr = (_reportData && _reportData._contrastVerifyResults) ? _reportData._contrastVerifyResults[vi] : null;
            if (!vr) return;
            var item = document.createElement('div');
            item.className = 'milg-viewer-overlap-item';
            item.innerHTML = '<span class="milg-viewer-overlap-dot" style="background:' + (vr.pixelPasses ? '#22c55e' : '#ef4444') + '"></span>' +
              '<span class="milg-viewer-overlap-text">' + (vr.text || vr.selector || '').substring(0, 40) + '</span>' +
              '<span class="milg-viewer-overlap-cat">' + (vr.pixelRatio || '?') + ':1</span>';
            item.addEventListener('click', function(ev) { ev.stopPropagation(); hideOverlapPicker(); _toggleDots(or, svg); });
            picker.appendChild(item);
          });
          document.body.appendChild(picker);
          picker.style.left = Math.min(e.clientX + 8, window.innerWidth - 320) + 'px';
          picker.style.top = Math.min(e.clientY + 8, window.innerHeight - 200) + 'px';
          _overlapPicker = picker;
          setTimeout(function() { document.addEventListener('click', function _oa(ev) { if (_overlapPicker && !_overlapPicker.contains(ev.target)) { hideOverlapPicker(); document.removeEventListener('click', _oa); } }); }, 0);
          return;
        }
        _toggleDots(rect, svg);
      });
    });

    function _toggleDots(rect, svg) {
      var owner = rect.getAttribute('data-verify');
      var existing = svg.querySelectorAll('.milg-sample-dot[data-owner="' + owner + '"]');
      if (existing.length > 0) { existing.forEach(function(d) { d.parentNode.removeChild(d); }); return; }
      var sp = rect._samplePoints; if (!sp) return;
      var secOff = rect._sectionOffset || 0;
      var vi = parseInt(rect.getAttribute('data-verify'));
      var vr = (_reportData && _reportData._contrastVerifyResults) ? _reportData._contrastVerifyResults[vi] : null;

      // Only show key percentile points at distinct FG positions.
      // Deduplicate by FG position first (keep worst ratio per unique FG pixel),
      // then pick percentiles from the deduplicated list.
      var fgPairs = (sp.fg || []).slice();
      if (fgPairs.length === 0) return;

      // Deduplicate: for each unique FG position, keep the entry with worst ratio
      var byPos = {};
      fgPairs.forEach(function(p) {
        var key = p.x + ',' + p.y;
        if (!byPos[key] || p.ratio < byPos[key].ratio) byPos[key] = p;
      });
      var unique = [];
      for (var k in byPos) unique.push(byPos[k]);
      if (unique.length === 0) return;

      unique.sort(function(a, b) { return (a.ratio || 0) - (b.ratio || 0); });

      var picks = [];
      var labels = [];
      picks.push(unique[0]); labels.push('worst');
      var p10i = Math.floor(unique.length * 0.1);
      if (p10i > 0) { picks.push(unique[p10i]); labels.push('P10'); }
      var medI = Math.floor(unique.length * 0.5);
      if (medI > p10i) { picks.push(unique[medI]); labels.push('median'); }
      var p90i = Math.floor(unique.length * 0.9);
      if (p90i > medI) { picks.push(unique[p90i]); labels.push('P90'); }
      if (unique.length > 1) { picks.push(unique[unique.length - 1]); labels.push('best'); }

      var dotR = _zoomLevel >= 2 ? 3 : 2;
      var colors = { worst: '#ef4444', P10: '#f97316', median: '#eab308', P90: '#22c55e', best: '#06b6d4' };

      var sw = 'display:inline-block;width:18px;height:18px;border-radius:3px;border:1px solid rgba(128,128,128,0.3);vertical-align:middle;';

      picks.forEach(function(pt, idx) {
        var label = labels[idx];
        var col = colors[label] || '#94a3b8';
        var fgCol = pt.r !== undefined ? 'rgb(' + pt.r + ',' + pt.g + ',' + pt.b + ')' : '#000';
        var bgCol = pt.bgR !== undefined ? 'rgb(' + pt.bgR + ',' + pt.bgG + ',' + pt.bgB + ')' : '#fff';
        var ratio = pt.ratio || '?';

        // Hover group — wraps FG dot, BG dot, line so any part is hoverable
        var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'milg-sample-dot'); group.setAttribute('data-owner', owner);
        group.style.cursor = 'pointer';

        // Hit area (invisible wider line for easier hover)
        if (pt.bgX !== undefined && pt.bgY !== undefined) {
          var hitLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          hitLine.setAttribute('x1', pt.x); hitLine.setAttribute('y1', pt.y + secOff);
          hitLine.setAttribute('x2', pt.bgX); hitLine.setAttribute('y2', pt.bgY + secOff);
          hitLine.setAttribute('stroke', 'transparent'); hitLine.setAttribute('stroke-width', '8');
          group.appendChild(hitLine);

          // Visible line
          var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', pt.x); line.setAttribute('y1', pt.y + secOff);
          line.setAttribute('x2', pt.bgX); line.setAttribute('y2', pt.bgY + secOff);
          line.setAttribute('stroke', col); line.setAttribute('stroke-width', '0.5');
          line.setAttribute('stroke-dasharray', '2 1'); line.setAttribute('opacity', '0.6');
          line.setAttribute('pointer-events', 'none');
          group.appendChild(line);

          // BG dot
          var bd = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          bd.setAttribute('cx', pt.bgX); bd.setAttribute('cy', pt.bgY + secOff);
          bd.setAttribute('r', dotR * 0.7); bd.setAttribute('fill', 'none');
          bd.setAttribute('stroke', col); bd.setAttribute('stroke-width', '1');
          bd.setAttribute('pointer-events', 'none');
          group.appendChild(bd);
        }

        // FG dot
        var d = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        d.setAttribute('cx', pt.x); d.setAttribute('cy', pt.y + secOff);
        d.setAttribute('r', dotR); d.setAttribute('fill', col);
        d.setAttribute('stroke', '#fff'); d.setAttribute('stroke-width', '0.5');
        d.setAttribute('pointer-events', 'none');
        group.appendChild(d);

        // Label
        var lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lbl.setAttribute('x', pt.x + dotR + 2); lbl.setAttribute('y', pt.y + secOff - 2);
        lbl.setAttribute('font-size', '7'); lbl.setAttribute('fill', col);
        lbl.setAttribute('font-family', 'system-ui'); lbl.setAttribute('font-weight', '700');
        lbl.setAttribute('pointer-events', 'none');
        lbl.textContent = label + ' ' + ratio + ':1';
        group.appendChild(lbl);

        // Hover tooltip on this specific pair
        group.addEventListener('mouseenter', function(e) {
          hideTooltip();
          var passColor = ratio >= 4.5 ? '#22c55e' : ratio >= 3 ? '#eab308' : '#ef4444';
          var passLabel = ratio >= 4.5 ? 'PASS' : ratio >= 3 ? 'AA-lg' : 'FAIL';
          _tooltip = document.createElement('div');
          _tooltip.className = 'milg-viewer-tooltip';
          _tooltip.innerHTML =
            '<div style="font-size:10px;color:#64748b;margin-bottom:4px;font-weight:600">' + label.toUpperCase() + ' pair</div>' +
            '<div style="display:flex;align-items:center;gap:8px">' +
              '<div style="text-align:center"><span style="' + sw + 'background:' + fgCol + '"></span><div style="font-size:8px;color:#94a3b8;margin-top:2px">FG</div></div>' +
              '<div style="text-align:center"><span style="' + sw + 'background:' + bgCol + '"></span><div style="font-size:8px;color:#94a3b8;margin-top:2px">BG</div></div>' +
              '<div style="font-size:16px;font-weight:700;color:' + passColor + '">' + ratio + ':1</div>' +
              '<div style="font-size:10px;font-weight:600;color:' + passColor + '">' + passLabel + '</div>' +
            '</div>' +
            '<div style="font-size:9px;color:#94a3b8;margin-top:4px">' + fgCol + ' on ' + bgCol + '</div>';
          positionTooltip(e);
        });
        group.addEventListener('mouseleave', function() { hideTooltip(); });

        svg.appendChild(group);
      });
    }
  }

  function showDebugLayer(rect, svg, mode, edgeMethod) {
    svg.querySelectorAll('.milg-debug-overlay').forEach(function(el) { el.remove(); });
    var debug = rect._debug;
    if (!debug || !debug.mask) return;
    var bw = debug.bw, bh = debug.bh, bx = debug.bx, by = debug.by;
    var secOff = rect._sectionOffset || 0;
    var mask = debug.mask;
    var dc = document.createElement('canvas');
    dc.width = bw; dc.height = bh;
    var dctx = dc.getContext('2d');
    var imgd = dctx.createImageData(bw, bh);
    var d = imgd.data;
    var edgeCount = 0, insideCount = 0;
    if (mode === 'mask') {
      for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
        var pi = (y * bw + x) * 4; var mv = mask[y * bw + x] || 0;
        d[pi] = d[pi+1] = d[pi+2] = mv ? 0 : 255; d[pi+3] = 200;
        if (mv) insideCount++;
      }
      edgeCount = insideCount;
    } else if (mode === 'zones' && debug.zone) {
      var zoneData = debug.zone;
      for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
        var pi = (y * bw + x) * 4; var z = zoneData[y * bw + x] || 0;
        if (z === 1) { d[pi]=255;d[pi+1]=30;d[pi+2]=30;d[pi+3]=230;edgeCount++; }
        else if (z === 2) { d[pi]=255;d[pi+1]=160;d[pi+2]=0;d[pi+3]=180;insideCount++; }
        else if (z === 3) { d[pi]=30;d[pi+1]=200;d[pi+2]=80;d[pi+3]=140; }
        else { d[pi]=d[pi+1]=d[pi+2]=d[pi+3]=0; }
      }
    } else if (mode === 'zones' && window.MilgContrastVerify) {
      var MCV = window.MilgContrastVerify;
      var cat = MCV._findBoundary(mask, bw, bh);
      var bdist = MCV._bfsBoundaryDist(cat, bw, bh, 6);
      for (var y = 0; y < bh; y++) for (var x = 0; x < bw; x++) {
        var pi = (y * bw + x) * 4; var dd = bdist[y * bw + x];
        if (cat[y*bw+x]===1) { d[pi]=255;d[pi+1]=30;d[pi+2]=30;d[pi+3]=230;edgeCount++; }
        else if (mask[y*bw+x]&&dd>=1&&dd<=2) { d[pi]=255;d[pi+1]=160;d[pi+2]=0;d[pi+3]=180;insideCount++; }
        else if (!mask[y*bw+x]&&dd>=3&&dd<=4) { d[pi]=30;d[pi+1]=200;d[pi+2]=80;d[pi+3]=140; }
        else { d[pi]=d[pi+1]=d[pi+2]=d[pi+3]=0; }
      }
    }
    dctx.putImageData(imgd, 0, 0);
    var img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttribute('x', bx); img.setAttribute('y', by + secOff);
    img.setAttribute('width', bw); img.setAttribute('height', bh);
    img.setAttribute('href', dc.toDataURL());
    img.setAttribute('class', 'milg-debug-overlay');
    img.setAttribute('pointer-events', 'none'); img.setAttribute('opacity', '0.85');
    svg.appendChild(img);
    if (mode === 'zones' && debug.expBg && debug.expBg.length > 0) {
      for (var ebi = 0; ebi < debug.expBg.length; ebi++) {
        var ep = debug.expBg[ebi];
        var r2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r2.setAttribute('x', bx+ep.x); r2.setAttribute('y', by+secOff+ep.y);
        r2.setAttribute('width', 1); r2.setAttribute('height', 1);
        r2.setAttribute('fill', 'rgba(30,200,80,0.55)');
        r2.setAttribute('class', 'milg-debug-overlay'); r2.setAttribute('pointer-events', 'none');
        svg.appendChild(r2);
      }
    }
    var lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lbl.setAttribute('x', bx+2); lbl.setAttribute('y', by+secOff-3);
    lbl.setAttribute('font-size', '9'); lbl.setAttribute('fill', '#ef4444');
    lbl.setAttribute('font-family', 'monospace'); lbl.setAttribute('font-weight', '700');
    lbl.setAttribute('pointer-events', 'none'); lbl.setAttribute('class', 'milg-debug-overlay');
    lbl.textContent = mode === 'mask' ? 'MASK | dark:'+insideCount : 'ZONES | boundary:'+edgeCount+' FG:'+insideCount;
    svg.appendChild(lbl);
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

    var sw = 'display:inline-block;width:24px;height:24px;border-radius:4px;border:1px solid rgba(128,128,128,0.3);vertical-align:middle;';
    var swSm = 'display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid rgba(128,128,128,0.3);vertical-align:middle;';

    // Find nearest FG sample point to cursor — each stores its worst BG match
    var localBlock = '';
    if (vr.samplePoints && vr.samplePoints.fg && vr.samplePoints.fg.length > 0) {
      var svg = e.target.closest ? e.target.closest('svg') : null;
      var svgRect = svg ? svg.getBoundingClientRect() : null;
      var scale = (svg && svg.viewBox && svg.viewBox.baseVal) ? svg.viewBox.baseVal.width / (svgRect ? svgRect.width : 1) : 1;
      var mx = svgRect ? (e.clientX - svgRect.left) * scale : 0;
      var my = svgRect ? (e.clientY - svgRect.top) * scale : 0;

      var nearest = null, nearestD = Infinity;
      for (var i = 0; i < vr.samplePoints.fg.length; i++) {
        var sp = vr.samplePoints.fg[i];
        var d2 = (sp.x - mx) * (sp.x - mx) + (sp.y - my) * (sp.y - my);
        if (d2 < nearestD) { nearestD = d2; nearest = sp; }
      }

      if (nearest && nearest.bgR !== undefined) {
        var fgCol = 'rgb(' + nearest.r + ',' + nearest.g + ',' + nearest.b + ')';
        var bgCol = 'rgb(' + nearest.bgR + ',' + nearest.bgG + ',' + nearest.bgB + ')';
        var ratio = nearest.ratio || '?';
        var passColor = ratio >= 4.5 ? '#22c55e' : ratio >= 3 ? '#eab308' : '#ef4444';
        var passLabel = ratio >= 4.5 ? 'PASS' : ratio >= 3 ? 'AA-lg' : 'FAIL';

        localBlock = '<div style="margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.04);border-radius:4px">' +
          '<div style="font-size:10px;color:#64748b;margin-bottom:4px">Hovered pair</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<div style="text-align:center"><span style="' + sw + 'background:' + fgCol + '"></span><div style="font-size:8px;color:#94a3b8;margin-top:2px">FG</div></div>' +
            '<div style="text-align:center"><span style="' + sw + 'background:' + bgCol + '"></span><div style="font-size:8px;color:#94a3b8;margin-top:2px">BG</div></div>' +
            '<div style="font-size:14px;font-weight:700;color:' + passColor + '">' + ratio + ':1</div>' +
            '<div style="font-size:10px;font-weight:600;color:' + passColor + '">' + passLabel + '</div>' +
          '</div>' +
          '<div style="font-size:9px;color:#94a3b8;margin-top:3px">' + fgCol + ' on ' + bgCol + '</div>' +
        '</div>';
      }
    }

    // Worst offender
    var worstBlock = '';
    if (vr.pixelRatio && vr.pixelFg) {
      var wRatio = vr.pixelRatio;
      var wPassColor = wRatio >= 4.5 ? '#22c55e' : wRatio >= 3 ? '#eab308' : '#ef4444';
      worstBlock = '<div style="margin-top:4px;font-size:10px;color:#64748b">' +
        'Worst: <span style="' + swSm + 'background:' + vr.pixelFg + '"></span> on ' +
        '<span style="' + swSm + 'background:' + (vr.pixelBgWorst || '') + '"></span> ' +
        '<span style="color:' + wPassColor + ';font-weight:600">' + wRatio + ':1</span>' +
        (vr.pixelRatioP10 ? ' &middot; P10: ' + vr.pixelRatioP10 + ':1' : '') +
        (vr.pixelRatioBest && vr.pixelRatioBest !== vr.pixelRatio ? ' &middot; Best: ' + vr.pixelRatioBest + ':1' : '') +
      '</div>';
    }

    // CSS comparison
    var cssBlock = '<div style="display:flex;align-items:center;gap:6px;margin-top:4px">' +
      '<span style="font-size:10px;color:#94a3b8;width:24px">CSS</span>' +
      '<span style="' + swSm + 'background:' + (vr.cssFg || '') + '"></span>' +
      '<span style="font-size:10px;color:#94a3b8">on</span>' +
      '<span style="' + swSm + 'background:' + (vr.cssBg || '') + '"></span>' +
      '<span style="font-size:11px">' + vr.cssRatio + ':1 ' +
        (vr.cssPasses ? '<span style="color:#22c55e">pass</span>' : '<span style="color:#ef4444">fail</span>') +
      '</span></div>';

    // Flags
    var flagsBlock = '';
    if (vr.sampleCount) {
      flagsBlock = '<div style="font-size:9px;color:#94a3b8;margin-top:4px">' +
        vr.sampleCount.fg + ' FG &middot; ' + vr.sampleCount.bg + ' BG samples';
      if (vr.isVariableBg) flagsBlock += ' &middot; <span style="color:#eab308">variable bg</span>';
      flagsBlock += '</div>';
    }
    if (vr.crossesBoundary) {
      flagsBlock += '<div style="font-size:10px;color:#ef4444;font-weight:600;margin-top:2px">' +
        (vr.cssPasses && !vr.pixelPasses ? 'CSS passes but pixels fail' : 'CSS fails but pixels pass') + '</div>';
    }

    _tooltip.innerHTML = '<div class="milg-viewer-tooltip-title">' + vr.selector + '</div>' +
      '<div class="milg-viewer-tooltip-detail">"' + (vr.text || '').substring(0, 40) + '"</div>' +
      cssBlock + localBlock + worstBlock + flagsBlock;

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
    // Don't close the viewer — just filter to show only this finding
    _activeFilter = { type: 'finding', value: findingIdx };
    updateFilterButtons();
    renderOverlays();
    // Flash the finding's rects
    var svg = _overlay && _overlay.querySelector('.milg-viewer-svg');
    if (svg) {
      svg.querySelectorAll('rect[data-finding]').forEach(function(rect) {
        if (parseInt(rect.getAttribute('data-finding')) === findingIdx) {
          var origFill = rect.getAttribute('fill');
          var origStroke = rect.getAttribute('stroke');
          var flash = 0;
          (function pulse() {
            var on = flash % 2 === 0;
            rect.setAttribute('fill', on ? 'rgba(245,158,11,0.4)' : origFill);
            rect.setAttribute('stroke', on ? '#f59e0b' : origStroke);
            flash++;
            if (flash < 6) setTimeout(pulse, 250);
            else { rect.setAttribute('fill', origFill); rect.setAttribute('stroke', origStroke); }
          })();
        }
      });
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

  // Open viewer focused on a specific finding — shows ONLY that finding's bboxes
  function showFinding(findingIdx, reportData) {
    if (!reportData || !reportData.raw || !reportData.raw.screenshots || !reportData.raw.screenshotMeta) {
      console.warn('[milg-viewer] showFinding: missing screenshots or meta');
      return;
    }
    if (!reportData.raw.screenshots.length) { console.warn('[milg-viewer] showFinding: screenshots array empty'); return; }

    // Open the viewer first — this builds _allFindings from reportData
    var dummyImg = document.createElement('img');
    dummyImg.src = reportData.raw.screenshots[0];
    open(dummyImg, 0, reportData);

    // Now map report findingIdx → _allFindings index
    // Report counts non-pass findings with bboxes. _allFindings includes pass too.
    var viewerIdx = -1;
    var reportCounter = 0;
    for (var ai = 0; ai < _allFindings.length; ai++) {
      if (_allFindings[ai].severity === 'pass') continue;
      if (reportCounter === findingIdx) { viewerIdx = ai; break; }
      reportCounter++;
    }
    if (viewerIdx === -1 || !_allFindings[viewerIdx]) {
      console.warn('[milg-viewer] showFinding: could not map index', findingIdx, '(counted', reportCounter, 'non-pass in', _allFindings.length, ')');
      return;
    }
    var target = _allFindings[viewerIdx];
    if (!target.bboxes || !target.bboxes[0]) return;

    // Show ONLY this finding's bboxes (not the whole category)
    var meta = reportData.raw.screenshotMeta;
    _activeFilter = { type: 'finding', value: viewerIdx };
    updateFilterButtons();
    renderOverlays();

    // Auto-zoom for small elements
    var maxDim = 0;
    target.bboxes.forEach(function(bb) {
      var dim = Math.max(bb.width || 0, bb.height || 0);
      if (dim > maxDim) maxDim = dim;
    });
    var frame = _overlay && _overlay.querySelector('.milg-viewer-frame');
    var zoomSelect = _overlay && _overlay.querySelector('.milg-viewer-zoom-select');
    if (maxDim > 0 && maxDim < 50) {
      _zoomLevel = 3;
    } else if (maxDim > 0 && maxDim < 100) {
      _zoomLevel = 2;
    } else {
      _zoomLevel = 1;
    }
    if (zoomSelect) {
      for (var zi = 0; zi < zoomSelect.options.length; zi++) {
        if (parseFloat(zoomSelect.options[zi].value) === _zoomLevel) { zoomSelect.selectedIndex = zi; break; }
      }
    }
    if (frame) applyZoom(frame);

    // Scroll to the finding's first bbox and highlight ALL its rects
    var bbox = target.bboxes[0];
    var scale = meta.scale;
    setTimeout(function() {
      var content = _overlay && _overlay.querySelector('.milg-viewer-content');
      var svg = _overlay && _overlay.querySelector('.milg-viewer-svg');
      if (!content || !svg) return;

      var targetY = Math.round(bbox.top * scale) - _calibrationOffsetY;

      // Scroll to center the first bbox
      var frameEl = _overlay.querySelector('.milg-viewer-frame');
      if (frameEl) {
        var imgEl = frameEl.querySelector('.milg-viewer-img');
        if (imgEl && imgEl.naturalWidth > 0) {
          var displayScale = imgEl.offsetWidth / imgEl.naturalWidth;
          var scrollY = (targetY * displayScale) - content.clientHeight / 2;
          content.scrollTop = Math.max(0, scrollY);
        }
      }

      // Flash ALL rects for this finding with pulsing highlight
      svg.querySelectorAll('rect[data-finding]').forEach(function(rect) {
        var rfi = parseInt(rect.getAttribute('data-finding'));
        if (rfi === viewerIdx) {
          var origFill = rect.getAttribute('fill');
          var origStroke = rect.getAttribute('stroke');
          var origWidth = rect.getAttribute('stroke-width');
          // Flash 3 times
          var flash = 0;
          (function pulse() {
            var on = flash % 2 === 0;
            rect.setAttribute('fill', on ? 'rgba(245,158,11,0.4)' : origFill);
            rect.setAttribute('stroke', on ? '#f59e0b' : origStroke);
            rect.setAttribute('stroke-width', on ? '3' : origWidth);
            flash++;
            if (flash < 6) setTimeout(pulse, 300);
            else { rect.setAttribute('fill', origFill); rect.setAttribute('stroke', origStroke); rect.setAttribute('stroke-width', origWidth); }
          })();
        }
      });

      // If this finding has pixel verify data, activate verify overlay
      var verifyResults = (_reportData && _reportData._contrastVerifyResults) || [];
      if (verifyResults.length > 0 && target.detail) {
        var matchedVerify = null;
        verifyResults.forEach(function(vr) {
          if (vr.selector && target.detail.indexOf(vr.selector) !== -1) matchedVerify = vr;
        });
        if (matchedVerify) {
          _activeFilter = { type: 'verify', value: 'all' };
          updateFilterButtons();
          renderOverlays();
        }
      }
    }, 500);
  }

  // Open viewer in verify mode focused on a specific selector's bbox
  function showVerifyResult(selector) {
    if (!_overlay || !_reportData || !_meta) return;
    _activeFilter = { type: 'verifySelector', value: selector };
    updateFilterButtons();
    renderOverlays();
    // Find the matching verify result to get bbox
    var verifyResults = (_reportData._contrastVerifyResults || []);
    var bboxEdgeResults = (_reportData._bboxEdgeResults || []);
    var match = null;
    verifyResults.forEach(function(vr) { if (vr.selector === selector) match = vr; });
    if (!match) bboxEdgeResults.forEach(function(ber) { if (ber.selector === selector) match = ber; });
    if (!match || !match.bbox) return;
    var scale = _meta.scale;
    var targetY = Math.round(match.bbox.top * scale) - _calibrationOffsetY;
    // Scroll to the element
    setTimeout(function() {
      var content = _overlay && _overlay.querySelector('.milg-viewer-content');
      var frame = _overlay && _overlay.querySelector('.milg-viewer-frame');
      if (!content || !frame) return;
      var imgEl = frame.querySelector('.milg-viewer-img');
      if (imgEl && imgEl.naturalWidth > 0) {
        var displayScale = imgEl.offsetWidth / imgEl.naturalWidth;
        content.scrollTop = Math.max(0, (targetY * displayScale) - content.clientHeight / 2);
      }
      // Flash matching rect
      var svg = _overlay.querySelector('.milg-viewer-svg');
      if (svg) {
        svg.querySelectorAll('rect').forEach(function(rect) {
          if (rect._selector === selector) {
            var origFill = rect.getAttribute('fill');
            var origStroke = rect.getAttribute('stroke');
            var origWidth = rect.getAttribute('stroke-width');
            var flash = 0;
            (function pulse() {
              var on = flash % 2 === 0;
              rect.setAttribute('fill', on ? 'rgba(245,158,11,0.4)' : origFill);
              rect.setAttribute('stroke', on ? '#f59e0b' : origStroke);
              rect.setAttribute('stroke-width', on ? '3' : origWidth);
              flash++;
              if (flash < 6) setTimeout(pulse, 300);
              else { rect.setAttribute('fill', origFill); rect.setAttribute('stroke', origStroke); rect.setAttribute('stroke-width', origWidth); }
            })();
          }
        });
      }
    }, 300);
  }

  return {
    open: open,
    close: close,
    showFinding: showFinding,
    showVerifyResult: showVerifyResult
  };
})();
