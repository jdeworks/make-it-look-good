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
  var _showExpanded = false; // always false — clean screenshot with region sections below
  var _regionData = []; // [{findings, svg, img, frame, meta, cropOffset}] per region

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
    _regionData = [];

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
    // Passing headings (skip region content — analyzed in region section)
    (raw.typography && raw.typography.headings || []).forEach(function(h) {
      if (!h.bbox || h._regionContainerId) return;
      _allFindings.push({ severity: 'pass', title: h.tag.toUpperCase() + ': "' + (h.text || '').substring(0, 40) + '"', detail: h.fontSize + ' ' + h.fontWeight, category: 'Typography', icon: 'type', bboxes: [h.bbox] });
    });
    // Passing touch targets (skip region content, those NOT in the findings = they passed)
    var failSelectors = {};
    _allFindings.forEach(function(f) { if (f.icon === 'touch' && f.severity !== 'pass') failSelectors[f.title] = true; });
    (raw.interaction && raw.interaction.touchTargets || []).forEach(function(t) {
      if (!t.bbox || t._regionContainerId || Math.min(t.width, t.height) < 24) return;
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
        renderRegionOverlays();
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
        applyRegionZoom();
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
      applyRegionZoom();
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

    // Screenshot source: always show clean (page as-rendered). Expanded content is
    // shown via region screenshots below, not a full-page toggle.
    var cleanSrc = (reportData.raw && reportData.raw.screenshotClean) || null;
    var cleanMeta = (reportData.raw && reportData.raw.screenshotCleanMeta) || null;
    var expandedSrc = (reportData.raw && reportData.raw.screenshotFull) || null;
    _showExpanded = false;

    function onImageReady(imgSrc, canvasW, canvasH) {
      frame.innerHTML = '';
      var viewImg = document.createElement('img');
      viewImg.className = 'milg-viewer-img';
      viewImg.src = imgSrc;
      viewImg.alt = 'Full page screenshot';

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'milg-viewer-svg');
      svg.setAttribute('viewBox', '0 0 ' + canvasW + ' ' + canvasH);
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');

      frame.appendChild(viewImg);
      frame.appendChild(svg);

      viewImg.addEventListener('load', function() {
        _calibrationOffsetY = (_meta && _meta.calibrationOffsetY) || 0;

        // Render permanent container indicators for hidden overflow regions.
        // These are always visible (not gated behind a filter).
        var _regions = (reportData.raw && reportData.raw.regionScreenshots) || [];
        if (_regions.length > 0 && _meta) {
          var _s = _meta.scale || 1.5;
          var _sw = Math.max(2, Math.round(2 * _s));
          var _dOn = Math.round(8 * _s); var _dOff = Math.round(4 * _s);
          var _fs = Math.max(14, Math.round(14 * _s));
          _regions.forEach(function(rgn, ri) {
            if (!rgn.containerRect) return;
            var cr = rgn.containerRect;
            var cx = Math.round(cr.left * _s);
            var cy = Math.round(cr.top * _s) - _calibrationOffsetY;
            var cw = Math.max(Math.round(cr.width * _s), 40);
            var ch = Math.max(Math.round(cr.height * _s), 40);
            var ind = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            ind.setAttribute('class', 'milg-region-indicator-' + ri);
            ind.setAttribute('x', cx); ind.setAttribute('y', cy);
            ind.setAttribute('width', cw); ind.setAttribute('height', ch);
            ind.setAttribute('fill', 'rgba(59,130,246,0.12)');
            ind.setAttribute('stroke', '#3b82f6');
            ind.setAttribute('stroke-width', _sw);
            ind.setAttribute('stroke-dasharray', _dOn + ' ' + _dOff);
            ind.setAttribute('rx', '4');
            ind.setAttribute('data-region', ri);
            ind.style.cursor = 'pointer';
            ind.setAttribute('data-permanent', '1');
            svg.appendChild(ind);
            var pCount = (rgn.pairIndices || []).length;
            var lblText = 'Hidden content' + (pCount ? ' — ' + pCount + ' contrast pairs' : '') + ' ↓';
            var lx = cx + Math.round(4 * _s);
            var ly = cy + Math.round(4 * _s);
            var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', lx); bg.setAttribute('y', ly);
            bg.setAttribute('width', Math.min(cw - Math.round(8 * _s), Math.round(lblText.length * _fs * 0.55)));
            bg.setAttribute('height', Math.round(_fs * 1.6));
            bg.setAttribute('fill', 'rgba(30,58,138,0.85)'); bg.setAttribute('rx', '3');
            bg.setAttribute('pointer-events', 'none');
            bg.setAttribute('data-permanent', '1');
            svg.appendChild(bg);
            var lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            lbl.setAttribute('x', lx + Math.round(4 * _s));
            lbl.setAttribute('y', ly + Math.round(_fs * 1.15));
            lbl.setAttribute('fill', '#93c5fd'); lbl.setAttribute('font-size', _fs);
            lbl.setAttribute('font-weight', '600');
            lbl.setAttribute('font-family', 'system-ui, sans-serif');
            lbl.setAttribute('pointer-events', 'none');
            lbl.setAttribute('data-permanent', '1');
            lbl.textContent = lblText;
            svg.appendChild(lbl);
            ind.addEventListener('click', (function(idx) {
              return function(e) {
                e.stopPropagation();
                var el = document.getElementById('milg-region-' + idx);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              };
            })(ri));
          });
        }

        updateFilterButtons();
        renderOverlays();

        if (sectionIndex > 0 && _meta) {
          var scale = _meta.scale || 0.5;
          content.scrollTop = Math.round(sectionIndex * Math.round(_meta.viewportHeight * scale) - _calibrationOffsetY);
        }
      });
    }

    // Show clean screenshot, fall back to expanded, fall back to stitched sections
    if (cleanSrc && cleanMeta) {
      _stitchedCanvas = { width: cleanMeta.canvasWidth, height: cleanMeta.canvasHeight };
      onImageReady(cleanSrc, cleanMeta.canvasWidth, cleanMeta.canvasHeight);
    } else if (expandedSrc) {
      _stitchedCanvas = { width: _meta.canvasWidth, height: _meta.canvasHeight };
      onImageReady(expandedSrc, _meta.canvasWidth, _meta.canvasHeight);
    } else {
      stitchScreenshots(_screenshots, function(stitched) {
        _stitchedCanvas = stitched;
        onImageReady(stitched.canvas.toDataURL('image/png'), stitched.width, stitched.height);
      });
    }

    // Render region screenshots as interactive sections below main screenshot
    _regionData = [];
    var regions = (reportData.raw && reportData.raw.regionScreenshots) || [];
    if (regions.length > 0) {
      var regionSection = document.createElement('div');
      regionSection.className = 'milg-viewer-regions';
      regionSection.style.cssText = 'padding:16px 0 8px;width:100%;max-width:95vw;';

      regions.forEach(function(rgn, rIdx) {
        if (!rgn.screenshot || !rgn.screenshotMeta) return;

        // Build flat findings list from region report (same format as _allFindings)
        var rgnFindings = [];
        if (rgn.regionReport && rgn.regionReport.categories) {
          rgn.regionReport.categories.forEach(function(cat) {
            (cat.findings || []).forEach(function(f) {
              if (!f.locator || !f.locator.bboxes || f.locator.bboxes.length === 0) return;
              rgnFindings.push({
                severity: f.severity || 'info',
                title: f.title || '',
                detail: f.detail || '',
                category: cat.label || '',
                icon: cat.icon || '',
                bboxes: f.locator.bboxes
              });
            });
          });
        }

        var rgnSection = document.createElement('div');
        rgnSection.className = 'milg-viewer-region-section';
        rgnSection.id = 'milg-region-' + rIdx;
        rgnSection.style.cssText = 'margin:0 0 20px;border:1px solid rgba(59,130,246,0.3);border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.3);';

        // Region header with label and back-to-main link
        var rgnHeader = document.createElement('div');
        rgnHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(59,130,246,0.15);border-bottom:1px solid rgba(59,130,246,0.3);';
        var rgnTitle = document.createElement('span');
        rgnTitle.style.cssText = 'font-size:12px;font-weight:600;color:#93c5fd;';
        rgnTitle.textContent = 'Hidden content region ' + (rIdx + 1);
        var findingCount = rgnFindings.length;
        if (findingCount > 0) {
          rgnTitle.textContent += ' \u2014 ' + findingCount + ' finding' + (findingCount !== 1 ? 's' : '');
        }
        var backLink = document.createElement('a');
        backLink.style.cssText = 'font-size:11px;color:#60a5fa;cursor:pointer;text-decoration:none;';
        backLink.textContent = '\u2191 Back to main screenshot';
        backLink.addEventListener('click', function() {
          var mainFrame = _overlay && _overlay.querySelector('.milg-viewer-frame');
          if (mainFrame) {
            mainFrame.scrollIntoView({ behavior: 'smooth' });
            var indicator = _overlay && _overlay.querySelector('.milg-region-indicator-' + rIdx);
            if (indicator) {
              var origStroke = indicator.getAttribute('stroke');
              var origWidth = indicator.getAttribute('stroke-width');
              var flash = 0;
              (function pulse() {
                var on = flash % 2 === 0;
                indicator.setAttribute('stroke', on ? '#fbbf24' : origStroke);
                indicator.setAttribute('stroke-width', on ? '3' : origWidth);
                flash++;
                if (flash < 6) setTimeout(pulse, 250);
                else { indicator.setAttribute('stroke', origStroke); indicator.setAttribute('stroke-width', origWidth); }
              })();
            }
          }
        });
        rgnHeader.appendChild(rgnTitle);
        rgnHeader.appendChild(backLink);
        rgnSection.appendChild(rgnHeader);

        // Region frame: screenshot with dynamic SVG overlay
        var rgnFrame = document.createElement('div');
        rgnFrame.style.cssText = 'position:relative;overflow:auto;max-height:600px;';

        var rgnImg = document.createElement('img');
        rgnImg.src = rgn.screenshot;
        rgnImg.alt = 'Hidden content region ' + (rIdx + 1);
        rgnImg.style.cssText = 'display:block;max-width:100%;height:auto;';
        rgnFrame.appendChild(rgnImg);

        // SVG overlay — rects are rendered dynamically by renderRegionOverlays()
        var rgnSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        rgnSvg.setAttribute('viewBox', '0 0 ' + rgn.screenshotMeta.canvasWidth + ' ' + rgn.screenshotMeta.canvasHeight);
        rgnSvg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
        rgnSvg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
        rgnFrame.appendChild(rgnSvg);

        rgnSection.appendChild(rgnFrame);

        // Findings summary bar — only count findings with bboxes (those are the ones rendered as overlays)
        if (rgn.regionReport) {
          var errCount = 0, warnCount = 0, infoCount = 0;
          (rgn.regionReport.categories || []).forEach(function(cat) {
            (cat.findings || []).forEach(function(f) {
              if (!f.locator || !f.locator.bboxes || f.locator.bboxes.length === 0) return;
              if (f.severity === 'error') errCount++;
              else if (f.severity === 'warning') warnCount++;
              else if (f.severity === 'info') infoCount++;
            });
          });
          var summaryBar = document.createElement('div');
          summaryBar.style.cssText = 'padding:6px 12px;font-size:11px;color:rgba(255,255,255,0.8);background:rgba(0,0,0,0.4);border-top:1px solid rgba(59,130,246,0.2);display:flex;gap:12px;align-items:center;';
          summaryBar.innerHTML = '<span style="font-weight:600;color:#93c5fd">Score: ' + (rgn.regionReport.overall || 0) + '/100 (' + (rgn.regionReport.grade || '?') + ')</span>' +
            (errCount ? '<span style="color:#ef4444">' + errCount + ' error' + (errCount !== 1 ? 's' : '') + '</span>' : '') +
            (warnCount ? '<span style="color:#eab308">' + warnCount + ' warning' + (warnCount !== 1 ? 's' : '') + '</span>' : '') +
            (infoCount ? '<span style="color:#3b82f6">' + infoCount + ' info</span>' : '');
          rgnSection.appendChild(summaryBar);
        }
        regionSection.appendChild(rgnSection);

        // Store region state for dynamic rendering
        _regionData.push({
          findings: rgnFindings,
          svg: rgnSvg,
          img: rgnImg,
          frame: rgnFrame,
          meta: rgn.screenshotMeta,
          regionRef: rgn  // live reference for async verify results (rgn.regionVerifyResults)
        });
      });

      content.appendChild(regionSection);
      // Initial render of region overlays
      renderRegionOverlays();
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
    var content = frame.parentElement;
    var img = frame.querySelector('.milg-viewer-img');
    var svg = frame.querySelector('.milg-viewer-svg');
    if (!img) return;

    // Capture the normalized center point before zoom (0-1 range in content space)
    var oldW = img.offsetWidth || 1, oldH = img.offsetHeight || 1;
    var cx = 0.5, cy = 0.5;
    if (content && oldW > 0) {
      cx = (content.scrollLeft + content.clientWidth / 2) / oldW;
      cy = (content.scrollTop + content.clientHeight / 2) / oldH;
    }

    // At high zoom, left-align so the whole image is scrollable (center clips left edge)
    if (content) content.style.alignItems = _zoomLevel > 1 ? 'flex-start' : 'center';
    if (_zoomLevel === 1) {
      img.style.width = '';
      img.style.maxWidth = '95vw';
      if (svg) { svg.style.width = ''; svg.style.height = ''; }
    } else {
      var baseWidth = _meta ? _meta.canvasWidth : 640;
      var zoomedWidth = Math.round(baseWidth * _zoomLevel);
      img.style.maxWidth = 'none';
      img.style.width = zoomedWidth + 'px';
      if (svg) {
        svg.style.width = zoomedWidth + 'px';
        var vb = svg.getAttribute('viewBox');
        if (vb && _stitchedCanvas) {
          var ratio = _stitchedCanvas.height / _stitchedCanvas.width;
          svg.style.height = Math.round(zoomedWidth * ratio) + 'px';
        }
      }
    }

    // Restore scroll so the same content point stays at viewport center
    if (content) {
      var newW = img.offsetWidth || 1, newH = img.offsetHeight || 1;
      content.scrollLeft = cx * newW - content.clientWidth / 2;
      content.scrollTop = cy * newH - content.clientHeight / 2;
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

    // Clear non-permanent SVG children (keep region indicators which are always visible)
    var _toRemove = [];
    for (var ci = 0; ci < svg.childNodes.length; ci++) {
      if (!svg.childNodes[ci].getAttribute || !svg.childNodes[ci].getAttribute('data-permanent')) _toRemove.push(svg.childNodes[ci]);
    }
    _toRemove.forEach(function(n) { svg.removeChild(n); });

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

    // Build set of bboxes that belong to region containers — hidden from main overlay.
    // Primary: _regionContainerId (DOM hierarchy-based, set during clip detection).
    // Fallback: WeakSet (object identity), string-key, _isClipped flag.
    // Additional: container-rect overlap (catches alignment/consistency findings in hidden areas).
    var _regionalBboxes = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    var _regionalBboxKeys = {};
    var regions = (_reportData && _reportData.raw && _reportData.raw.regionScreenshots) || [];
    var _regionContainerRects = regions.map(function(r) { return r.containerRect; }).filter(Boolean);
    console.log('[D] exclusion containerRects=' + _regionContainerRects.length + ' ' + JSON.stringify(_regionContainerRects));
    if (!_showExpanded && _reportData && _reportData.raw && _reportData.raw.colors) {
      var _contrastPairs = _reportData.raw.colors.contrastPairs || [];
      regions.forEach(function(rgn) {
        (rgn.pairIndices || []).forEach(function(pi) {
          var pair = _contrastPairs[pi];
          if (pair && pair.bbox) {
            if (_regionalBboxes) _regionalBboxes.add(pair.bbox);
            _regionalBboxKeys[Math.round(pair.bbox.left) + ',' + Math.round(pair.bbox.top) + ',' + Math.round(pair.bbox.width) + ',' + Math.round(pair.bbox.height)] = true;
          }
        });
      });
      _contrastPairs.forEach(function(cp) {
        if ((cp._isClipped || cp._regionContainerId) && cp.bbox) {
          if (_regionalBboxes) _regionalBboxes.add(cp.bbox);
          _regionalBboxKeys[Math.round(cp.bbox.left) + ',' + Math.round(cp.bbox.top) + ',' + Math.round(cp.bbox.width) + ',' + Math.round(cp.bbox.height)] = true;
        }
      });
      // Also exclude non-contrast items inside region containers (headings, touch targets, alignment, border-radius)
      function _addRegionalBbox(item) {
        if ((item._isClipped || item._regionContainerId) && item.bbox) {
          if (_regionalBboxes) _regionalBboxes.add(item.bbox);
          _regionalBboxKeys[Math.round(item.bbox.left) + ',' + Math.round(item.bbox.top) + ',' + Math.round(item.bbox.width) + ',' + Math.round(item.bbox.height)] = true;
        }
      }
      // borderRadii entries have bboxes[] array instead of single bbox
      function _addRegionalRadii(item) {
        if (item.bboxes) item.bboxes.forEach(function(b) {
          if (b && b._rcid) {
            if (_regionalBboxes) _regionalBboxes.add(b);
            _regionalBboxKeys[Math.round(b.left) + ',' + Math.round(b.top) + ',' + Math.round(b.width) + ',' + Math.round(b.height)] = true;
          }
        });
      }
      var _raw = _reportData.raw || {};
      (_raw.typography && _raw.typography.headings || []).forEach(_addRegionalBbox);
      (_raw.interaction && _raw.interaction.touchTargets || []).forEach(_addRegionalBbox);
      (_raw.layout && _raw.layout.alignmentElements || []).forEach(_addRegionalBbox);
      (_raw.layout && _raw.layout.borderRadii || []).forEach(_addRegionalRadii);
      // Build bounding rect from ALL clipped/region bboxes — covers the full hidden area
      var _regionBounds = [];
      _contrastPairs.forEach(function(cp) {
        if ((cp._isClipped || cp._regionContainerId) && cp.bbox) {
          var found = false;
          _regionBounds.forEach(function(rb) {
            // Merge into existing bound if overlapping Y range (±50px tolerance)
            if (Math.abs(cp.bbox.top - rb.top) < rb.height + 50 || (cp.bbox.top >= rb.top && cp.bbox.top <= rb.top + rb.height + 50)) {
              var newTop = Math.min(rb.top, cp.bbox.top);
              var newLeft = Math.min(rb.left, cp.bbox.left);
              var newBottom = Math.max(rb.top + rb.height, cp.bbox.top + cp.bbox.height);
              var newRight = Math.max(rb.left + rb.width, cp.bbox.left + cp.bbox.width);
              rb.top = newTop; rb.left = newLeft;
              rb.width = newRight - newLeft; rb.height = newBottom - newTop;
              found = true;
            }
          });
          if (!found) _regionBounds.push({ left: cp.bbox.left, top: cp.bbox.top, width: cp.bbox.width, height: cp.bbox.height });
        }
      });
      console.log('[D] viewer exclusion keys=' + Object.keys(_regionalBboxKeys).length + ' regionBounds=' + _regionBounds.length + ' ' + JSON.stringify(_regionBounds.map(function(b) { return Math.round(b.left) + ',' + Math.round(b.top) + ',' + Math.round(b.width) + ',' + Math.round(b.height); })) + ' findings=' + _allFindings.length);
    }

    // Build pixel verification lookups: by selector AND by bbox position+size
    var verifyBySelector = {};
    var verifyByPos = {}; // "left,top,width,height" → verify result
    if (_reportData && _reportData._contrastVerifyResults) {
      _reportData._contrastVerifyResults.forEach(function(vr) {
        if (vr.selector) verifyBySelector[vr.selector] = vr;
        if (vr.bbox) verifyByPos[Math.round(vr.bbox.left) + ',' + Math.round(vr.bbox.top) + ',' + Math.round(vr.bbox.width) + ',' + Math.round(vr.bbox.height)] = vr;
      });
    }

    _allFindings.forEach(function(finding, fIdx) {
      if (_activeFilter.type === 'finding' && fIdx !== _activeFilter.value) return;
      if (_activeFilter.type === 'findingBbox' && fIdx !== _activeFilter.value) return;
      if (_activeFilter.type === 'category' && finding.icon !== _activeFilter.value) return;
      if (_activeFilter.type === 'severity' && _activeFilter.value !== 'all' && finding.severity !== _activeFilter.value) return;

      var color = COLORS[finding.severity] || COLORS.info;

      finding.bboxes.forEach(function(bbox, bbIdx) {
        // For single-bbox filter (magnifying glass), skip other bboxes in this finding
        if (_activeFilter.type === 'findingBbox' && bbIdx !== _activeFilter.bboxIdx) return;
        // Skip bboxes that belong to region containers — shown in region section, not main overlay.
        // Primary: _rcid on the bbox itself (set on ALL tracked types during extraction).
        // Fallback: WeakSet/string-key from contrastPairs/headings/touchTargets.
        if (!_showExpanded && bbox) {
          if (bbox._rcid) return;
          var _isRegional = (_regionalBboxes && _regionalBboxes.has(bbox)) ||
            _regionalBboxKeys[Math.round(bbox.left) + ',' + Math.round(bbox.top) + ',' + Math.round(bbox.width) + ',' + Math.round(bbox.height)];
          if (_isRegional) return;
          // Region-bounds fallback: exclude bboxes whose center falls within merged region bounds
          var _bcx = bbox.left + bbox.width / 2, _bcy = bbox.top + bbox.height / 2;
          for (var _ri = 0; _ri < _regionBounds.length; _ri++) {
            var _rb = _regionBounds[_ri];
            if (_bcx >= _rb.left && _bcx <= _rb.left + _rb.width && _bcy >= _rb.top && _bcy <= _rb.top + _rb.height) return;
          }
          // Also check container rects (original geometry from getBoundingClientRect)
          for (var _ri2 = 0; _ri2 < _regionContainerRects.length; _ri2++) {
            var _rc = _regionContainerRects[_ri2];
            if (_bcx >= _rc.left && _bcx <= _rc.left + _rc.width && _bcy >= _rc.top && _bcy <= _rc.top + _rc.height) return;
          }
        }
        var x = Math.round(bbox.left * scaleX);
        var y = Math.round(bbox.top * scaleY) - _calibrationOffsetY;
        var w = Math.round(bbox.width * scaleX);
        var h = Math.round(bbox.height * scaleY);

        // Match pixel verify result for THIS specific bbox (by position+size or selector)
        var bboxKey = Math.round(bbox.left) + ',' + Math.round(bbox.top) + ',' + Math.round(bbox.width) + ',' + Math.round(bbox.height);
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

    // Container indicators are rendered permanently in onImageReady() — no need to re-render here.

    // Event handlers on rects — tooltip hides with delay so user can hover it
    svg.querySelectorAll('rect').forEach(function(rect) {
      rect.addEventListener('mouseenter', function(e) { showFindingTooltip(e, parseInt(rect.getAttribute('data-finding'))); });
      rect.addEventListener('mouseleave', function() { scheduleHideTooltip(); });
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
      rect.addEventListener('contextmenu', function(e) {
        showDebugMenu(e, svg, { findings: _allFindings, verifyResults: null, scale: scaleX, cropOX: 0, cropOY: 0, meta: _meta, context: 'main', calibrationOffsetY: _calibrationOffsetY });
      });
    });
  }

  // Render bbox overlays on all region screenshots — same filter behavior as main overlay
  function renderRegionOverlays() {
    console.log('[D] renderRegionOverlays regions=' + _regionData.length + ' filter=' + (_activeFilter ? _activeFilter.type + ':' + _activeFilter.value : 'none'));
    _regionData.forEach(function(rd, rIdx) {
      if (!rd.svg || !rd.findings) { console.log('[D] region ' + rIdx + ' skip: svg=' + !!rd.svg + ' findings=' + (rd.findings ? rd.findings.length : 'null')); return; }
      while (rd.svg.firstChild) rd.svg.removeChild(rd.svg.firstChild);
      // No filter active → no overlays (matches main renderOverlays behavior)
      if (!_activeFilter) return;
      // Verify filters → delegate to region verify renderer
      if (_activeFilter.type === 'verify' || _activeFilter.type === 'verifySelector') {
        renderRegionVerifyOverlays(rd);
        return;
      }
      // finding/findingBbox are main-screenshot-specific (indices into _allFindings)
      if (_activeFilter.type === 'finding' || _activeFilter.type === 'findingBbox') return;

      var scale = rd.meta.scale || 1.5;
      var cox = rd.meta.cropOffsetX || 0;
      var coy = rd.meta.cropOffsetY || 0;

      var bboxCount = 0;
      rd.findings.forEach(function(finding, fIdx) {
        if (_activeFilter.type === 'category' && finding.icon !== _activeFilter.value) return;
        if (_activeFilter.type === 'severity' && _activeFilter.value !== 'all' && finding.severity !== _activeFilter.value) return;
        var color = COLORS[finding.severity] || COLORS.info;
        finding.bboxes.forEach(function(bbox) {
          if (!bbox) return;
          var x = Math.round(bbox.left * scale) - cox;
          var y = Math.round(bbox.top * scale) - coy;
          var w = Math.max(Math.round(bbox.width * scale), 4);
          var h = Math.max(Math.round(bbox.height * scale), 4);

          var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', x);
          rect.setAttribute('y', y);
          rect.setAttribute('width', w);
          rect.setAttribute('height', h);
          rect.setAttribute('fill', color.fill);
          rect.setAttribute('stroke', color.stroke);
          rect.setAttribute('stroke-width', '1.5');
          rect.setAttribute('rx', '2');
          rect.setAttribute('data-finding', fIdx);
          rd.svg.appendChild(rect);
          bboxCount++;
        });
      });
      console.log('[D] region ' + rIdx + ' rects=' + bboxCount + ' findings=' + rd.findings.length + ' filter=' + _activeFilter.type + ':' + _activeFilter.value);

      // Interactive handlers — full parity with main overlay (tooltip, click overlap picker, shift+click debug)
      var rdFindings = rd.findings;
      var rdSvg = rd.svg;
      var rdScale = scale;
      var rdScaleInfo = { scale: scale, offsetY: 0, cropOffsetX: cox, cropOffsetY: coy, svg: rdSvg };
      rd.svg.querySelectorAll('rect[data-finding]').forEach(function(rect) {
        rect.style.cursor = 'pointer';
        rect.addEventListener('mouseenter', function(e) {
          showFindingTooltip(e, parseInt(rect.getAttribute('data-finding')), rdFindings, rdScaleInfo);
        });
        rect.addEventListener('mouseleave', function() { scheduleHideTooltip(); });
        rect.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var fIdx = parseInt(rect.getAttribute('data-finding'));
          if (e.shiftKey) {
            // Shift+click: copy debug info (region context)
            window.getSelection().removeAllRanges();
            var f = rdFindings[fIdx];
            if (f) {
              var rx = parseInt(rect.getAttribute('x')), ry = parseInt(rect.getAttribute('y'));
              var bboxIdx = 0;
              f.bboxes.forEach(function(bb, bi) {
                if (Math.round(bb.left * rdScale) - cox === rx && Math.round(bb.top * rdScale) - coy === ry) bboxIdx = bi;
              });
              var bb = f.bboxes[bboxIdx];
              var info = {
                context: 'region',
                finding: f.title.substring(0, 60),
                severity: f.severity,
                category: f.category,
                bbox_dom: bb,
                bbox_canvas: { x: Math.round(bb.left * rdScale) - cox, y: Math.round(bb.top * rdScale) - coy, w: Math.round(bb.width * rdScale), h: Math.round(bb.height * rdScale) },
                scale: rdScale,
                cropOffset: { x: cox, y: coy },
                rect_attrs: { x: rect.getAttribute('x'), y: rect.getAttribute('y'), width: rect.getAttribute('width'), height: rect.getAttribute('height') },
                meta: rd.meta
              };
              navigator.clipboard.writeText(JSON.stringify(info, null, 2)).then(function() {
                alert('Region element debug info copied!');
              });
            }
          } else {
            // Check for overlapping rects at click point
            var _svgR = rdSvg.getBoundingClientRect();
            var _cx = (e.clientX - _svgR.left) * (rdSvg.viewBox.baseVal.width / _svgR.width);
            var _cy = (e.clientY - _svgR.top) * (rdSvg.viewBox.baseVal.height / _svgR.height);
            var overlapping = [];
            rdSvg.querySelectorAll('rect[data-finding]').forEach(function(r) {
              var rrx = parseFloat(r.getAttribute('x')), rry = parseFloat(r.getAttribute('y'));
              var rrw = parseFloat(r.getAttribute('width')), rrh = parseFloat(r.getAttribute('height'));
              if (_cx >= rrx && _cx <= rrx + rrw && _cy >= rry && _cy <= rry + rrh) {
                var fi = parseInt(r.getAttribute('data-finding'));
                if (overlapping.indexOf(fi) === -1) overlapping.push(fi);
              }
            });
            if (overlapping.length > 1) {
              showOverlapPicker(e, overlapping, rdFindings, rdSvg);
            } else {
              flashRectsInSvg(rdSvg, fIdx);
            }
          }
        });
        rect.addEventListener('contextmenu', function(e) {
          showDebugMenu(e, rdSvg, { findings: rdFindings, verifyResults: null, scale: rdScale, cropOX: cox, cropOY: coy, meta: rd.meta, context: 'region' });
        });
      });
    });
  }

  // Apply zoom level to region frames — matches main screenshot zoom behavior
  function applyRegionZoom() {
    _regionData.forEach(function(rd) {
      if (!rd.img || !rd.svg) return;
      if (_zoomLevel === 1) {
        rd.img.style.width = '';
        rd.img.style.maxWidth = '100%';
        rd.svg.style.width = '';
        rd.svg.style.height = '';
        if (rd.frame) rd.frame.style.maxHeight = '600px';
      } else {
        var baseWidth = rd.meta.canvasWidth || 640;
        var zoomedWidth = Math.round(baseWidth * _zoomLevel);
        rd.img.style.maxWidth = 'none';
        rd.img.style.width = zoomedWidth + 'px';
        rd.svg.style.width = zoomedWidth + 'px';
        var aspect = (rd.meta.canvasHeight || 400) / (rd.meta.canvasWidth || 640);
        rd.svg.style.height = Math.round(zoomedWidth * aspect) + 'px';
        if (rd.frame) rd.frame.style.maxHeight = 'none';
      }
    });
  }

  function renderVerifyOverlays(svg) {
    if (!_reportData || !_reportData._contrastVerifyResults || !_meta) {
      console.warn('[milg-viewer] renderVerifyOverlays: missing data', { hasReport: !!_reportData, hasResults: !!(_reportData && _reportData._contrastVerifyResults), hasMeta: !!_meta });
      return;
    }
    var results = _reportData._contrastVerifyResults;
    console.log('[milg-viewer] renderVerifyOverlays:', results.length, 'results, scale:', _meta.scale, 'canvas:', _meta.canvasWidth + 'x' + _meta.canvasHeight);
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

    var _vrNoBbox = 0;
    results.forEach(function(vr, vIdx) {
      if (vr.skipped) return; // Hidden region elements — shown in region sections
      if (filterSelector && vr.selector !== filterSelector) return;
      if (!filterSelector && showFails && !vr.crossesBoundary) return;
      if (!filterSelector && filterLayer !== null && (vr.maskLayer || 0) !== filterLayer) return;
      var bbox = vr.bbox;
      if (!bbox) { _vrNoBbox++; return; }

      var x = Math.round(bbox.left * vScaleX);
      var y = Math.round(bbox.top * vScaleY) - _calibrationOffsetY;
      var w = Math.round(bbox.width * vScaleX);
      var h = Math.round(bbox.height * vScaleY);

      // Check if any finding at this EXACT bbox (same position + size) has error/warning severity
      var worstSevAtPos = 'pass';
      var SEV_R = { error: 3, warning: 2, info: 1, pass: 0 };
      if (vr.bbox) {
        var bL = Math.round(vr.bbox.left), bT = Math.round(vr.bbox.top);
        var bW = Math.round(vr.bbox.width), bH = Math.round(vr.bbox.height);
        _allFindings.forEach(function(f) {
          f.bboxes.forEach(function(bb) {
            // Match same element: position AND size must match within 3px
            if (Math.abs(Math.round(bb.left) - bL) <= 3 && Math.abs(Math.round(bb.top) - bT) <= 3 &&
                Math.abs(Math.round(bb.width) - bW) <= 3 && Math.abs(Math.round(bb.height) - bH) <= 3) {
              if ((SEV_R[f.severity] || 0) > (SEV_R[worstSevAtPos] || 0)) worstSevAtPos = f.severity;
            }
          });
        });
      }

      var fill, stroke, dash;
      // Worst-severity-wins: if any finding at this position is error, show red regardless of pixel result
      if (worstSevAtPos === 'error' || (vr.crossesBoundary && vr.cssPasses && !vr.pixelPasses)) {
        fill = 'rgba(239,68,68,0.25)'; stroke = '#ef4444'; dash = '6 2';
      } else if (worstSevAtPos === 'warning' || vr.isVariableBg) {
        fill = 'rgba(234,179,8,0.15)'; stroke = '#eab308'; dash = '4 2';
      } else if (vr.crossesBoundary && !vr.cssPasses && vr.pixelPasses) {
        fill = 'rgba(34,197,94,0.2)'; stroke = '#22c55e'; dash = '4 3';
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
    console.log('[milg-viewer] Verify rects created:', svg.querySelectorAll('rect[data-verify]').length, 'noBbox:', _vrNoBbox);

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
      rect.addEventListener('contextmenu', function(e) {
        showDebugMenu(e, svg, { findings: _allFindings, verifyResults: results, scale: _meta.scale, cropOX: 0, cropOY: 0, meta: _meta, context: 'main', calibrationOffsetY: _calibrationOffsetY });
      });
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

    // Click-cycle modes: all dots (no labels) → worst → P10 → median → P90 → best → off
    var _dotModes = ['all', 'worst', 'P10', 'median', 'P90', 'best', 'off'];
    var _dotState = {}; // owner → mode index

    function _toggleDots(rect, svg) {
      var owner = rect.getAttribute('data-verify');
      var sp = rect._samplePoints; if (!sp) return;
      var secOff = rect._sectionOffset || 0;

      // Advance cycle
      var modeIdx = (_dotState[owner] !== undefined) ? (_dotState[owner] + 1) % _dotModes.length : 0;
      _dotState[owner] = modeIdx;
      var mode = _dotModes[modeIdx];

      // Clear existing dots
      svg.querySelectorAll('.milg-sample-dot[data-owner="' + owner + '"]').forEach(function(d) { d.remove(); });
      if (mode === 'off') { delete _dotState[owner]; return; }

      var fgPairs = (sp.fg || []).slice();
      if (fgPairs.length === 0) return;

      // Deduplicate by FG position (keep worst ratio per unique pixel)
      var byPos = {};
      fgPairs.forEach(function(p) {
        var key = p.x + ',' + p.y;
        if (!byPos[key] || p.ratio < byPos[key].ratio) byPos[key] = p;
      });
      var unique = [];
      for (var k in byPos) unique.push(byPos[k]);
      if (unique.length === 0) return;
      unique.sort(function(a, b) { return (a.ratio || 0) - (b.ratio || 0); });

      // Build the named percentile points
      var namedPts = {};
      namedPts.worst = unique[0];
      var p10i = Math.max(1, Math.floor(unique.length * 0.1));
      namedPts.P10 = unique[Math.min(p10i, unique.length - 1)];
      namedPts.median = unique[Math.floor(unique.length * 0.5)];
      var p90i = Math.floor(unique.length * 0.9);
      namedPts.P90 = unique[Math.min(p90i, unique.length - 1)];
      namedPts.best = unique[unique.length - 1];

      var dotR = _zoomLevel >= 2 ? 3 : 2;
      var colors = { worst: '#ef4444', P10: '#f97316', median: '#eab308', P90: '#22c55e', best: '#06b6d4' };
      var sw = 'display:inline-block;width:18px;height:18px;border-radius:3px;border:1px solid rgba(128,128,128,0.3);vertical-align:middle;';

      if (mode === 'all') {
        // Show all percentile dots without labels
        var allLabels = ['worst', 'P10', 'median', 'P90', 'best'];
        var seen = {};
        allLabels.forEach(function(lbl) {
          var pt = namedPts[lbl]; if (!pt) return;
          var key = pt.x + ',' + pt.y;
          if (seen[key]) return; seen[key] = true;
          _renderDot(svg, pt, lbl, colors[lbl], dotR, secOff, owner, false, sw);
        });
      } else {
        // Single highlighted point with label + dim others
        var allLabels = ['worst', 'P10', 'median', 'P90', 'best'];
        var seen = {};
        allLabels.forEach(function(lbl) {
          var pt = namedPts[lbl]; if (!pt) return;
          var key = pt.x + ',' + pt.y;
          if (seen[key] && lbl !== mode) return;
          seen[key] = true;
          var isActive = (lbl === mode);
          _renderDot(svg, pt, lbl, colors[lbl], dotR, secOff, owner, isActive, sw, !isActive);
        });
      }
    }

    function _renderDot(svg, pt, label, col, dotR, secOff, owner, showLabel, sw, dimmed) {
      var fgCol = pt.r !== undefined ? 'rgb(' + pt.r + ',' + pt.g + ',' + pt.b + ')' : '#000';
      var bgCol = pt.bgR !== undefined ? 'rgb(' + pt.bgR + ',' + pt.bgG + ',' + pt.bgB + ')' : '#fff';
      var ratio = pt.ratio || '?';
      var opacity = dimmed ? '0.25' : '1';

      var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'milg-sample-dot');
      group.setAttribute('data-owner', owner);
      group.style.cursor = 'pointer';
      group.style.opacity = opacity;

      // Hit area + visible line to BG
      if (pt.bgX !== undefined && pt.bgY !== undefined) {
        var hitLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hitLine.setAttribute('x1', pt.x); hitLine.setAttribute('y1', pt.y + secOff);
        hitLine.setAttribute('x2', pt.bgX); hitLine.setAttribute('y2', pt.bgY + secOff);
        hitLine.setAttribute('stroke', 'transparent'); hitLine.setAttribute('stroke-width', '8');
        group.appendChild(hitLine);

        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', pt.x); line.setAttribute('y1', pt.y + secOff);
        line.setAttribute('x2', pt.bgX); line.setAttribute('y2', pt.bgY + secOff);
        line.setAttribute('stroke', col);
        line.setAttribute('stroke-width', showLabel ? '1.5' : '0.5');
        if (!showLabel) { line.setAttribute('stroke-dasharray', '2 1'); line.setAttribute('opacity', '0.6'); }
        line.setAttribute('pointer-events', 'none');
        group.appendChild(line);

        // BG dot — larger ring when highlighted, always category color
        var bd = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bd.setAttribute('cx', pt.bgX); bd.setAttribute('cy', pt.bgY + secOff);
        bd.setAttribute('r', showLabel ? dotR * 1.3 : dotR * 0.7);
        bd.setAttribute('fill', 'none');
        bd.setAttribute('stroke', col);
        bd.setAttribute('stroke-width', showLabel ? '1.5' : '0.5');
        bd.setAttribute('pointer-events', 'none');
        group.appendChild(bd);
      }

      // FG dot — always category color for scannability (swatches show actual colors)
      var d = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      d.setAttribute('cx', pt.x); d.setAttribute('cy', pt.y + secOff);
      d.setAttribute('r', showLabel ? dotR * 1.5 : dotR);
      d.setAttribute('fill', col);
      d.setAttribute('stroke', '#fff');
      d.setAttribute('stroke-width', showLabel ? '1' : '0.5');
      d.setAttribute('pointer-events', 'none');
      group.appendChild(d);

      // Label + color swatches (only when actively highlighted)
      if (showLabel) {
        var passColor = ratio >= 4.5 ? '#22c55e' : ratio >= 3 ? '#eab308' : '#ef4444';
        var lx = pt.x + dotR + 5, ly = pt.y + secOff;
        var swSz = 7; // swatch size

        // Background panel for readability
        var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', lx - 2); bg.setAttribute('y', ly - 12);
        bg.setAttribute('width', 64); bg.setAttribute('height', 24);
        bg.setAttribute('rx', 3); bg.setAttribute('fill', 'rgba(0,0,0,0.75)');
        bg.setAttribute('pointer-events', 'none');
        group.appendChild(bg);

        // Label text (e.g. "P10 4.8:1")
        var lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lbl.setAttribute('x', lx); lbl.setAttribute('y', ly - 3);
        lbl.setAttribute('font-size', '7'); lbl.setAttribute('fill', col);
        lbl.setAttribute('font-family', 'system-ui'); lbl.setAttribute('font-weight', '700');
        lbl.setAttribute('pointer-events', 'none');
        lbl.textContent = label + ' ' + ratio + ':1';
        group.appendChild(lbl);

        // FG swatch
        var fgSw = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        fgSw.setAttribute('x', lx); fgSw.setAttribute('y', ly + 1);
        fgSw.setAttribute('width', swSz); fgSw.setAttribute('height', swSz);
        fgSw.setAttribute('rx', 1); fgSw.setAttribute('fill', fgCol);
        fgSw.setAttribute('stroke', 'rgba(255,255,255,0.5)'); fgSw.setAttribute('stroke-width', '0.5');
        fgSw.setAttribute('pointer-events', 'none');
        group.appendChild(fgSw);

        // Arrow
        var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        arrow.setAttribute('x', lx + swSz + 1.5); arrow.setAttribute('y', ly + swSz);
        arrow.setAttribute('font-size', '6'); arrow.setAttribute('fill', 'rgba(255,255,255,0.6)');
        arrow.setAttribute('font-family', 'system-ui'); arrow.setAttribute('pointer-events', 'none');
        arrow.textContent = '\u2192';
        group.appendChild(arrow);

        // BG swatch
        var bgSw = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgSw.setAttribute('x', lx + swSz + 8); bgSw.setAttribute('y', ly + 1);
        bgSw.setAttribute('width', swSz); bgSw.setAttribute('height', swSz);
        bgSw.setAttribute('rx', 1); bgSw.setAttribute('fill', bgCol);
        bgSw.setAttribute('stroke', 'rgba(255,255,255,0.5)'); bgSw.setAttribute('stroke-width', '0.5');
        bgSw.setAttribute('pointer-events', 'none');
        group.appendChild(bgSw);

        // Pass/fail badge
        var badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        badge.setAttribute('x', lx + swSz * 2 + 11); badge.setAttribute('y', ly + swSz);
        badge.setAttribute('font-size', '6'); badge.setAttribute('fill', passColor);
        badge.setAttribute('font-family', 'system-ui'); badge.setAttribute('font-weight', '700');
        badge.setAttribute('pointer-events', 'none');
        badge.textContent = ratio >= 4.5 ? 'PASS' : ratio >= 3 ? 'AA-lg' : 'FAIL';
        group.appendChild(badge);
      }

      // Hover tooltip
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

  // Render pixel verify overlays on a region screenshot
  function renderRegionVerifyOverlays(rd) {
    if (!rd.svg || !rd.regionRef) {
      console.log('[D] renderRegionVerifyOverlays bail: svg=' + !!rd.svg + ' regionRef=' + !!rd.regionRef);
      return;
    }
    var results = rd.regionRef.regionVerifyResults;
    if (!results || results.length === 0) {
      console.log('[D] renderRegionVerifyOverlays bail: results=' + (results ? results.length : 'null') + ' keys=' + Object.keys(rd.regionRef).join(','));
      return;
    }
    while (rd.svg.firstChild) rd.svg.removeChild(rd.svg.firstChild);

    var scale = rd.meta.scale || 1.5;
    var cox = rd.meta.cropOffsetX || 0;
    var coy = rd.meta.cropOffsetY || 0;
    var showFails = _activeFilter.value === 'fails';
    var filterLayer = null;
    if (_activeFilter.value && _activeFilter.value.indexOf('layer') === 0) {
      filterLayer = parseInt(_activeFilter.value.substring(5));
    }
    var filterSelector = _activeFilter.type === 'verifySelector' ? _activeFilter.value : null;

    var SEV_R = { error: 3, warning: 2, info: 1, pass: 0 };
    results.forEach(function(vr, vIdx) {
      if (vr.skipped) return;
      if (filterSelector && vr.selector !== filterSelector) return;
      if (!filterSelector && showFails && !vr.crossesBoundary) return;
      if (!filterSelector && filterLayer !== null && (vr.maskLayer || 0) !== filterLayer) return;
      var bbox = vr.bbox;
      if (!bbox) return;

      var x = Math.round(bbox.left * scale) - cox;
      var y = Math.round(bbox.top * scale) - coy;
      var w = Math.round(bbox.width * scale);
      var h = Math.round(bbox.height * scale);

      var worstSevAtPos = 'pass';
      if (vr.bbox) {
        var bL = Math.round(vr.bbox.left), bT = Math.round(vr.bbox.top);
        var bW = Math.round(vr.bbox.width), bH = Math.round(vr.bbox.height);
        rd.findings.forEach(function(f) {
          f.bboxes.forEach(function(bb) {
            if (Math.abs(Math.round(bb.left) - bL) <= 3 && Math.abs(Math.round(bb.top) - bT) <= 3 &&
                Math.abs(Math.round(bb.width) - bW) <= 3 && Math.abs(Math.round(bb.height) - bH) <= 3) {
              if ((SEV_R[f.severity] || 0) > (SEV_R[worstSevAtPos] || 0)) worstSevAtPos = f.severity;
            }
          });
        });
      }

      var fill, stroke, dash;
      if (worstSevAtPos === 'error' || (vr.crossesBoundary && vr.cssPasses && !vr.pixelPasses)) {
        fill = 'rgba(239,68,68,0.25)'; stroke = '#ef4444'; dash = '6 2';
      } else if (worstSevAtPos === 'warning' || vr.isVariableBg) {
        fill = 'rgba(234,179,8,0.15)'; stroke = '#eab308'; dash = '4 2';
      } else if (vr.crossesBoundary && !vr.cssPasses && vr.pixelPasses) {
        fill = 'rgba(34,197,94,0.2)'; stroke = '#22c55e'; dash = '4 3';
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
      rd.svg.appendChild(rect);

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
        rd.svg.appendChild(label);
      }
    });
    console.log('[milg-viewer] Region verify overlays: ' + results.length + ' results, ' + rd.svg.querySelectorAll('rect[data-verify]').length + ' rects');
    // Context menu on region verify rects
    var _rvSvg = rd.svg, _rvResults = results, _rvScale = scale, _rvCox = cox, _rvCoy = coy, _rvMeta = rd.meta, _rvFindings = rd.findings;
    rd.svg.querySelectorAll('rect[data-verify]').forEach(function(rect) {
      rect.style.cursor = 'pointer';
      rect.addEventListener('contextmenu', function(e) {
        showDebugMenu(e, _rvSvg, { findings: _rvFindings, verifyResults: _rvResults, scale: _rvScale, cropOX: _rvCox, cropOY: _rvCoy, meta: _rvMeta, context: 'region' });
      });
    });
  }

  var _tooltipHideTimer = null;
  function scheduleHideTooltip() {
    clearTimeout(_tooltipHideTimer);
    _tooltipHideTimer = setTimeout(function() { hideTooltip(); }, 300);
  }

  // Show tooltip for a finding rect. Accepts optional findingsArr and scaleInfo for region parity.
  // scaleInfo: { scale, offsetY, cropOffsetX, cropOffsetY, svg } — defaults to main overlay values.
  function showFindingTooltip(e, findingIdx, findingsArr, scaleInfo) {
    var findings = findingsArr || _allFindings;
    var isRegion = !!findingsArr;
    var scale = (scaleInfo && scaleInfo.scale) || (_meta ? _meta.scale : 1);
    var offsetY = (scaleInfo && scaleInfo.offsetY !== undefined) ? scaleInfo.offsetY : _calibrationOffsetY;
    var cropOX = (scaleInfo && scaleInfo.cropOffsetX) || 0;
    var cropOY = (scaleInfo && scaleInfo.cropOffsetY) || 0;
    var svgEl = (scaleInfo && scaleInfo.svg) || null;

    clearTimeout(_tooltipHideTimer);
    hideTooltip();
    var finding = findings[findingIdx];
    if (!finding) return;

    // Find ALL findings that overlap this bbox position
    var rect = e.target;
    var rx = parseFloat(rect.getAttribute('x')), ry = parseFloat(rect.getAttribute('y'));
    var rw = parseFloat(rect.getAttribute('width')), rh = parseFloat(rect.getAttribute('height'));
    var overlapping = [{ f: finding, viewerIdx: findingIdx }];
    findings.forEach(function(f, fi) {
      if (fi === findingIdx) return;
      var matched = false;
      f.bboxes.forEach(function(bb) {
        if (matched) return;
        var bx = Math.round(bb.left * scale) - cropOX;
        var by = Math.round(bb.top * scale) - offsetY - cropOY;
        if (bx < rx + rw && bx + Math.round(bb.width * scale) > rx &&
            by < ry + rh && by + Math.round(bb.height * scale) > ry) {
          overlapping.push({ f: f, viewerIdx: fi });
          matched = true;
        }
      });
    });

    _tooltip = document.createElement('div');
    _tooltip.className = 'milg-viewer-tooltip';
    _tooltip.addEventListener('mouseenter', function() { clearTimeout(_tooltipHideTimer); });
    _tooltip.addEventListener('mouseleave', function() { scheduleHideTooltip(); });

    var html = '';
    overlapping.forEach(function(entry, oi) {
      var f = entry.f;
      var sevClass = 'milg-viewer-sev-' + f.severity;
      var shortTitle = f.title.length > 60 ? f.title.substring(0, 57) + '...' : f.title;
      html += '<div class="milg-tt-row" data-tt-idx="' + oi + '" style="padding:3px 0;cursor:pointer;display:flex;align-items:baseline;gap:6px' + (oi > 0 ? ';border-top:1px solid rgba(255,255,255,0.1)' : '') + '">';
      html += '<span class="milg-viewer-tooltip-badge ' + sevClass + '" style="flex-shrink:0;font-size:9px;padding:1px 5px">' + f.severity + '</span>';
      html += '<span style="font-size:11px;color:#e2e8f0;line-height:1.3;flex:1">' + shortTitle + '</span>';
      html += '<span class="milg-tt-showgroup" data-viewer-idx="' + entry.viewerIdx + '" title="Show all elements in this group" style="flex-shrink:0;cursor:pointer;font-size:12px;opacity:0.5;padding:0 2px">&#9678;</span>';
      html += '</div>';
      html += '<div class="milg-tt-detail" data-tt-idx="' + oi + '" style="display:none;padding:4px 0 4px 36px;font-size:10px;color:rgba(255,255,255,0.6);line-height:1.5">';
      if (f.detail) html += '<div style="color:rgba(255,255,255,0.5)">' + f.detail.substring(0, 300) + '</div>';
      html += '<div style="margin-top:2px;color:rgba(255,255,255,0.35)">' + f.category + '</div>';
      html += '</div>';
    });
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.1)">';
    if (overlapping.length > 1) html += '<span style="font-size:9px;color:rgba(255,255,255,0.3)">' + overlapping.length + ' findings</span>';
    else html += '<span></span>';
    html += '<button class="milg-tt-copy" style="font-size:9px;color:rgba(255,255,255,0.5);background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:2px 8px;cursor:pointer">Copy</button>';
    html += '</div>';
    _tooltip.innerHTML = html;

    var _tooltipEvent = e;
    _tooltip.querySelectorAll('.milg-tt-row').forEach(function(row) {
      row.addEventListener('click', function(ev) {
        ev.stopPropagation();
        var idx = row.getAttribute('data-tt-idx');
        var detail = _tooltip.querySelector('.milg-tt-detail[data-tt-idx="' + idx + '"]');
        if (detail) {
          detail.style.display = detail.style.display === 'none' ? '' : 'none';
          setTimeout(function() { if (_tooltip && _tooltip.parentNode) positionTooltip(_tooltipEvent); }, 10);
        }
      });
    });
    var copyBtn = _tooltip.querySelector('.milg-tt-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function(ev) {
        ev.stopPropagation();
        var text = overlapping.map(function(entry) {
          var f = entry.f;
          return '[' + f.severity + '] ' + f.title + (f.detail ? '\n  ' + f.detail : '') + '\n  Category: ' + f.category;
        }).join('\n\n');
        navigator.clipboard.writeText(text).then(function() { copyBtn.textContent = 'Copied!'; setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500); });
      });
    }
    // "Show group" buttons — for main: filter globally; for region: flash rects in region SVG
    _tooltip.querySelectorAll('.milg-tt-showgroup').forEach(function(btn) {
      btn.addEventListener('click', function(ev) {
        ev.stopPropagation();
        var vIdx = parseInt(btn.getAttribute('data-viewer-idx'));
        hideTooltip();
        if (isRegion && svgEl) {
          flashRectsInSvg(svgEl, vIdx);
        } else {
          _activeFilter = { type: 'finding', value: vIdx };
          updateFilterButtons();
          renderOverlays();
          renderRegionOverlays();
        }
      });
    });

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

    // Pixel measurement summary: P10 (used for pass/fail) + worst-case + best
    var worstBlock = '';
    if (vr.pixelRatio && vr.pixelFg) {
      var needed = vr.neededRatio || 4.5;
      var p10Ratio = vr.pixelRatio;
      var p10Color = p10Ratio >= needed ? '#22c55e' : p10Ratio >= (needed * 0.67) ? '#eab308' : '#ef4444';
      var p10Label = p10Ratio >= needed ? 'PASS' : 'FAIL';
      worstBlock = '<div style="margin-top:4px;font-size:10px;color:#64748b">' +
        'P10: <span style="' + swSm + 'background:' + vr.pixelFg + '"></span> on ' +
        '<span style="' + swSm + 'background:' + (vr.pixelBgWorst || '') + '"></span> ' +
        '<span style="color:' + p10Color + ';font-weight:600">' + p10Ratio + ':1 ' + p10Label + '</span>' +
        ' <span style="color:#94a3b8">(needs ' + needed + ':1)</span>' +
        (vr.pixelRatioWorst && vr.pixelRatioWorst !== p10Ratio ? '<br>Worst: <span style="font-weight:600">' + vr.pixelRatioWorst + ':1</span>' : '') +
        (vr.pixelRatioBest && vr.pixelRatioBest !== p10Ratio ? ' &middot; Best: ' + vr.pixelRatioBest + ':1' : '') +
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
    var tw = _tooltip.offsetWidth, th = _tooltip.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;
    var mx = e.clientX, my = e.clientY;
    var gap = 12, pad = 8;

    // Pick horizontal side with more space
    var x;
    if (mx + gap + tw + pad <= vw) {
      x = mx + gap; // right of cursor
    } else if (mx - gap - tw >= pad) {
      x = mx - gap - tw; // left of cursor
    } else {
      x = Math.max(pad, Math.min(vw - tw - pad, mx - tw / 2)); // center, clamped
    }

    // Pick vertical side with more space
    var y;
    var spaceBelow = vh - my;
    var spaceAbove = my;
    if (spaceBelow >= th + gap + pad) {
      y = my + gap; // below cursor
    } else if (spaceAbove >= th + gap + pad) {
      y = my - gap - th; // above cursor
    } else if (spaceBelow >= spaceAbove) {
      y = Math.max(pad, vh - th - pad); // pin to bottom
    } else {
      y = pad; // pin to top
    }

    _tooltip.style.left = x + 'px';
    _tooltip.style.top = y + 'px';
  }

  // Flash all rects in a given SVG that match findingIdx
  function flashRectsInSvg(svg, findingIdx) {
    if (!svg) return;
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

  function scrollToFinding(findingIdx) {
    _activeFilter = { type: 'finding', value: findingIdx };
    updateFilterButtons();
    renderOverlays();
    renderRegionOverlays();
    flashRectsInSvg(_overlay && _overlay.querySelector('.milg-viewer-svg'), findingIdx);
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

  // Overlap picker. Accepts optional findingsArr and svgEl for region parity.
  function showOverlapPicker(e, findingIndices, findingsArr, svgEl) {
    var findings = findingsArr || _allFindings;
    var isRegion = !!findingsArr;
    var targetSvg = svgEl || (_overlay && _overlay.querySelector('.milg-viewer-svg'));
    hideOverlapPicker();
    hideTooltip();
    _overlapPicker = document.createElement('div');
    _overlapPicker.className = 'milg-viewer-overlap-picker';
    _overlapPicker.innerHTML = '<div class="milg-viewer-overlap-header">' + findingIndices.length + ' overlapping findings</div>';
    findingIndices.forEach(function(fIdx) {
      var f = findings[fIdx];
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
        if (isRegion) {
          flashRectsInSvg(targetSvg, fIdx);
        } else {
          scrollToFinding(fIdx);
        }
      });
      item.addEventListener('mouseenter', function() {
        if (targetSvg) targetSvg.querySelectorAll('rect[data-finding="' + fIdx + '"]').forEach(function(r) { r.setAttribute('stroke-width', '3'); });
      });
      item.addEventListener('mouseleave', function() {
        if (targetSvg) targetSvg.querySelectorAll('rect[data-finding="' + fIdx + '"]').forEach(function(r) { r.setAttribute('stroke-width', '1.5'); });
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

    setTimeout(function() {
      document.addEventListener('click', function onClickAway(ev) {
        if (_overlapPicker && !_overlapPicker.contains(ev.target)) {
          hideOverlapPicker();
          document.removeEventListener('click', onClickAway);
        }
      });
    }, 0);
  }

  // --- Debug context menu (right-click on any overlay rect) ---
  // Reusable for all overlay types: findings, verify, region findings, region verify.
  // opts: { findings, verifyResults, scale, cropOX, cropOY, meta, context, calibrationOffsetY }
  function showDebugMenu(e, svgEl, opts) {
    e.preventDefault();
    e.stopPropagation();
    hideOverlapPicker();
    hideTooltip();

    // Hit-test: find all rects at click point (SVG coords)
    var svgR = svgEl.getBoundingClientRect();
    var cx = (e.clientX - svgR.left) * (svgEl.viewBox.baseVal.width / svgR.width);
    var cy = (e.clientY - svgR.top) * (svgEl.viewBox.baseVal.height / svgR.height);
    var scale = opts.scale || 1.5;
    var cropOX = opts.cropOX || 0;
    var cropOY = opts.cropOY || 0;
    var ctxLabel = opts.context || 'main';

    var items = [];
    svgEl.querySelectorAll('rect[data-finding], rect[data-verify]').forEach(function(r) {
      var rx = parseFloat(r.getAttribute('x')), ry = parseFloat(r.getAttribute('y'));
      var rw = parseFloat(r.getAttribute('width')), rh = parseFloat(r.getAttribute('height'));
      if (cx < rx || cx > rx + rw || cy < ry || cy > ry + rh) return;

      var rectAttrs = { x: r.getAttribute('x'), y: r.getAttribute('y'), width: r.getAttribute('width'), height: r.getAttribute('height') };

      if (r.hasAttribute('data-finding') && opts.findings) {
        var fi = parseInt(r.getAttribute('data-finding'));
        var f = opts.findings[fi];
        if (!f) return;
        var bboxIdx = 0;
        f.bboxes.forEach(function(bb, bi) {
          if (Math.round(bb.left * scale) - cropOX === rx && Math.round(bb.top * scale) - cropOY === ry) bboxIdx = bi;
        });
        var bb = f.bboxes[bboxIdx];
        items.push({
          type: 'finding',
          label: f.title.substring(0, 55),
          severity: f.severity,
          color: (COLORS[f.severity] || COLORS.info).stroke,
          data: {
            context: ctxLabel, type: 'finding',
            finding: f.title.substring(0, 80), severity: f.severity, category: f.category,
            bbox_dom: bb,
            bbox_canvas: bb ? { x: Math.round(bb.left * scale) - cropOX, y: Math.round(bb.top * scale) - cropOY, w: Math.round(bb.width * scale), h: Math.round(bb.height * scale) } : null,
            scale: scale, cropOffset: { x: cropOX, y: cropOY },
            rect_attrs: rectAttrs, meta: opts.meta
          }
        });
      } else if (r.hasAttribute('data-verify') && opts.verifyResults) {
        var vi = parseInt(r.getAttribute('data-verify'));
        var vr = opts.verifyResults[vi];
        if (!vr) return;
        items.push({
          type: 'verify',
          label: (vr.text || vr.selector || '').substring(0, 40) + ' ' + (vr.pixelRatio || '?') + ':1',
          severity: vr.pixelPasses ? 'pass' : 'error',
          color: vr.pixelPasses ? '#22c55e' : '#ef4444',
          data: {
            context: ctxLabel, type: 'verify',
            selector: vr.selector, text: (vr.text || '').substring(0, 60),
            cssRatio: vr.cssRatio, pixelRatio: vr.pixelRatio, pixelRatioP10: vr.pixelRatioP10,
            pixelPasses: vr.pixelPasses, cssPasses: vr.cssPasses,
            crossesBoundary: vr.crossesBoundary, isVariableBg: vr.isVariableBg,
            maskBmp: !!vr.maskBmp, maskDark: vr.maskDark, maskLayer: vr.maskLayer,
            fgSamples: vr.sampleCount ? vr.sampleCount.fg : undefined,
            bgSamples: vr.sampleCount ? vr.sampleCount.bg : undefined,
            bbox_dom: vr.bbox,
            bbox_canvas: vr.bbox ? { x: Math.round(vr.bbox.left * scale) - cropOX, y: Math.round(vr.bbox.top * scale) - cropOY, w: Math.round(vr.bbox.width * scale), h: Math.round(vr.bbox.height * scale) } : null,
            scale: scale, cropOffset: { x: cropOX, y: cropOY },
            rect_attrs: rectAttrs
          }
        });
      }
    });
    if (items.length === 0) return;

    // Build picker popup (reuse overlap picker styling)
    var picker = document.createElement('div');
    picker.className = 'milg-viewer-overlap-picker';
    picker.innerHTML = '<div class="milg-viewer-overlap-header">' + items.length + ' overlay' + (items.length !== 1 ? 's' : '') + ' \u2014 click to copy debug</div>';
    items.forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'milg-viewer-overlap-item';
      row.innerHTML = '<span class="milg-viewer-overlap-dot" style="background:' + item.color + '"></span>' +
        '<span class="milg-viewer-overlap-text">' + item.label + '</span>' +
        '<span class="milg-viewer-overlap-cat">' + item.type + '</span>';
      row.addEventListener('click', function(ev) {
        ev.stopPropagation();
        navigator.clipboard.writeText(JSON.stringify(item.data, null, 2)).then(function() {
          row.style.background = 'rgba(34,197,94,0.3)';
          row.querySelector('.milg-viewer-overlap-cat').textContent = 'copied!';
          setTimeout(function() { hideOverlapPicker(); }, 600);
        });
      });
      picker.appendChild(row);
    });
    document.body.appendChild(picker);
    var px = Math.min(e.clientX + 8, window.innerWidth - 340);
    var py = Math.min(e.clientY + 8, window.innerHeight - 200);
    picker.style.left = px + 'px';
    picker.style.top = py + 'px';
    _overlapPicker = picker;
    setTimeout(function() {
      document.addEventListener('click', function _dbgAway(ev) {
        if (_overlapPicker && !_overlapPicker.contains(ev.target)) { hideOverlapPicker(); document.removeEventListener('click', _dbgAway); }
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

  // Open viewer and zoom to a specific bbox within a finding
  function showFindingBbox(findingIdx, bboxIdx, reportData) {
    if (!reportData || !reportData.raw || !reportData.raw.screenshots || !reportData.raw.screenshotMeta) return;
    if (!reportData.raw.screenshots.length) return;

    // Open viewer to build _allFindings
    var dummyImg = document.createElement('img');
    dummyImg.src = reportData.raw.screenshots[0];
    open(dummyImg, 0, reportData);

    // Map findingIdx → viewerIdx (same as showFinding)
    var viewerIdx = -1;
    var reportCounter = 0;
    for (var ai = 0; ai < _allFindings.length; ai++) {
      if (_allFindings[ai].severity === 'pass') continue;
      if (reportCounter === findingIdx) { viewerIdx = ai; break; }
      reportCounter++;
    }
    if (viewerIdx === -1 || !_allFindings[viewerIdx]) return;
    var target = _allFindings[viewerIdx];
    var bbox = target.bboxes[bboxIdx] || target.bboxes[0];
    if (!bbox) return;

    // Filter to show only this specific bbox (not the whole finding group)
    var meta = reportData.raw.screenshotMeta;
    _activeFilter = { type: 'findingBbox', value: viewerIdx, bboxIdx: bboxIdx };
    updateFilterButtons();
    renderOverlays();

    // Auto-zoom for the specific bbox
    var dim = Math.max(bbox.width || 0, bbox.height || 0);
    var frame = _overlay && _overlay.querySelector('.milg-viewer-frame');
    var zoomSelect = _overlay && _overlay.querySelector('.milg-viewer-zoom-select');
    _zoomLevel = dim < 50 ? 3 : dim < 100 ? 2 : 1;
    if (zoomSelect) {
      for (var zi = 0; zi < zoomSelect.options.length; zi++) {
        if (parseFloat(zoomSelect.options[zi].value) === _zoomLevel) { zoomSelect.selectedIndex = zi; break; }
      }
    }
    if (frame) applyZoom(frame);

    // Scroll to this specific bbox and flash it
    var scale = meta.scale;
    var targetY = Math.round(bbox.top * scale) - _calibrationOffsetY;
    var targetX = Math.round(bbox.left * scale);
    setTimeout(function() {
      var content = _overlay && _overlay.querySelector('.milg-viewer-content');
      if (content) {
        var frameEl = _overlay.querySelector('.milg-viewer-frame');
        var imgEl = frameEl && frameEl.querySelector('.milg-viewer-img');
        if (imgEl && imgEl.naturalWidth > 0) {
          var displayScale = imgEl.offsetWidth / imgEl.naturalWidth;
          content.scrollTop = Math.max(0, (targetY * displayScale) - content.clientHeight / 2);
          content.scrollLeft = Math.max(0, (targetX * displayScale) - content.clientWidth / 2);
        }
      }
      // Flash the matching rects
      var svg = _overlay && _overlay.querySelector('.milg-viewer-svg');
      if (svg) {
        svg.querySelectorAll('rect[data-finding]').forEach(function(rect) {
          var rfi = parseInt(rect.getAttribute('data-finding'));
          var ry = parseFloat(rect.getAttribute('y'));
          var rx = parseFloat(rect.getAttribute('x'));
          if (rfi === viewerIdx && Math.abs(ry - targetY) < 5 && Math.abs(rx - targetX) < 5) {
            var origFill = rect.getAttribute('fill');
            var origStroke = rect.getAttribute('stroke');
            var flash = 0;
            (function pulse() {
              var on = flash % 2 === 0;
              rect.setAttribute('fill', on ? 'rgba(245,158,11,0.5)' : origFill);
              rect.setAttribute('stroke', on ? '#f59e0b' : origStroke);
              rect.setAttribute('stroke-width', on ? '3' : '1.5');
              flash++;
              if (flash < 8) setTimeout(pulse, 200);
              else { rect.setAttribute('fill', origFill); rect.setAttribute('stroke', origStroke); rect.setAttribute('stroke-width', '1.5'); }
            })();
          }
        });
      }
    }, 500);
  }

  return {
    open: open,
    close: close,
    showFinding: showFinding,
    showFindingBbox: showFindingBbox,
    showVerifyResult: showVerifyResult,
    refreshRegionOverlays: renderRegionOverlays
  };
})();
