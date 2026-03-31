// make-it-look-good — Screenshot Viewer with Bbox Overlays
// Displays zoomed screenshots with filterable SVG bounding box overlays for findings.
// Depends on: analyzer-report.js (MilgReport) for category metadata

window.MilgViewer = (function() {
  "use strict";

  var _overlay = null;
  var _activeFilter = null; // { type: 'category'|'severity', value: string } or null
  var _allFindings = [];    // [{ severity, title, detail, category, icon, bboxes: [{left,top,width,height}] }]
  var _meta = null;         // screenshotMeta
  var _screenshots = [];    // data URI references
  var _currentSection = 0;
  var _tooltip = null;
  var _reportData = null;   // full report data (for pixel verification lookup)
  var _zoomLevel = 1;

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
    _currentSection = sectionIndex || 0;
    _activeFilter = null;

    if (!_meta || _screenshots.length === 0) {
      // No screenshot metadata — fall back to simple lightbox
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

    // Build overlay
    _overlay = document.createElement('div');
    _overlay.className = 'milg-viewer-overlay';

    // Toolbar
    var toolbar = document.createElement('div');
    toolbar.className = 'milg-viewer-toolbar';

    // Section nav
    var navHtml = '';
    if (_screenshots.length > 1) {
      navHtml = '<div class="milg-viewer-nav">' +
        '<button class="milg-viewer-nav-btn" data-dir="-1" title="Previous section">&lsaquo;</button>' +
        '<span class="milg-viewer-nav-label">Section <span class="milg-viewer-nav-idx">' + (_currentSection + 1) + '</span> / ' + _screenshots.length + '</span>' +
        '<button class="milg-viewer-nav-btn" data-dir="1" title="Next section">&rsaquo;</button>' +
        '</div>';
    }

    // Count findings per category, severity, and section
    var catCounts = {};  // icon → count
    var sevCounts = { error: 0, warning: 0, info: 0 };
    var catSet = {};
    _allFindings.forEach(function(f) {
      catSet[f.icon] = f.category;
      catCounts[f.icon] = (catCounts[f.icon] || 0) + 1;
      if (sevCounts[f.severity] !== undefined) sevCounts[f.severity]++;
    });

    // Category filter pills — only for categories that have bbox findings
    var catPills = '';
    Object.keys(catSet).forEach(function(icon) {
      var count = catCounts[icon] || 0;
      catPills += '<button class="milg-viewer-filter-btn" data-filter-type="category" data-filter-value="' + icon + '" title="' + catSet[icon] + '">' + catSet[icon] + ' <span class="milg-viewer-count">' + count + '</span></button>';
    });

    // Severity pills with counts
    function sevPill(sev, label) {
      var c = sevCounts[sev] || 0;
      if (c === 0) return '';
      return '<button class="milg-viewer-filter-btn milg-viewer-sev-' + sev + '" data-filter-type="severity" data-filter-value="' + sev + '">' + label + ' <span class="milg-viewer-count">' + c + '</span></button>';
    }
    var sevPills = sevPill('error', 'Errors') + sevPill('warning', 'Warnings') + sevPill('info', 'Info');

    // Pixel verification filter pill (only if verification results exist)
    var verifyPill = '';
    if (reportData._contrastVerifyResults && reportData._contrastVerifyResults.length > 0) {
      var vCount = reportData._contrastVerifyResults.length;
      verifyPill = '<span class="milg-viewer-sep"></span>' +
        '<button class="milg-viewer-filter-btn milg-viewer-sev-verify" data-filter-type="verify" data-filter-value="all" title="Show pixel-verified contrast">Pixel Verified <span class="milg-viewer-count">' + vCount + '</span></button>' +
        '<button class="milg-viewer-filter-btn milg-viewer-sev-error" data-filter-type="verify" data-filter-value="fails" title="Pixel verification failures only">Pixel Fails <span class="milg-viewer-count">0</span></button>';
    }

    toolbar.innerHTML = navHtml +
      '<div class="milg-viewer-filters">' + catPills + '<span class="milg-viewer-sep"></span>' + sevPills + verifyPill + '</div>' +
      '<select class="milg-viewer-zoom-select" title="Zoom level">' +
        '<option value="0.75">75%</option>' +
        '<option value="1" selected>100%</option>' +
        '<option value="1.5">150%</option>' +
        '<option value="2">200%</option>' +
        '<option value="2.5">250%</option>' +
        '<option value="3">300%</option>' +
      '</select>' +
      '<button class="milg-viewer-close" title="Close (Esc)">&times;</button>';

    _overlay.appendChild(toolbar);

    // Content area
    var content = document.createElement('div');
    content.className = 'milg-viewer-content';

    var frame = document.createElement('div');
    frame.className = 'milg-viewer-frame';

    var viewImg = document.createElement('img');
    viewImg.className = 'milg-viewer-img';
    viewImg.src = _screenshots[_currentSection];
    viewImg.alt = 'Screenshot section ' + (_currentSection + 1);

    // SVG overlay — viewBox updated to match actual image dimensions once loaded
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'milg-viewer-svg');
    svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    // Set initial viewBox from metadata, will be corrected when image loads
    var initSectionH = Math.min(Math.round(_meta.viewportHeight * _meta.scale), _meta.canvasHeight - _currentSection * Math.round(_meta.viewportHeight * _meta.scale));
    svg.setAttribute('viewBox', '0 0 ' + _meta.canvasWidth + ' ' + initSectionH);
    viewImg.addEventListener('load', function() {
      // Use the actual image natural dimensions for perfect alignment
      svg.setAttribute('viewBox', '0 0 ' + viewImg.naturalWidth + ' ' + viewImg.naturalHeight);
    });

    frame.appendChild(viewImg);
    frame.appendChild(svg);
    content.appendChild(frame);
    _overlay.appendChild(content);
    document.body.appendChild(_overlay);

    // Animate in
    requestAnimationFrame(function() { _overlay.classList.add('visible'); });

    // Event handlers
    toolbar.addEventListener('click', function(e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.classList.contains('milg-viewer-close')) { close(); return; }
      if (btn.classList.contains('milg-viewer-nav-btn')) {
        var dir = parseInt(btn.getAttribute('data-dir'));
        navigateSection(dir);
        return;
      }
      if (btn.classList.contains('milg-viewer-filter-btn')) {
        var type = btn.getAttribute('data-filter-type');
        var value = btn.getAttribute('data-filter-value');
        // Toggle — if already active, clear
        if (_activeFilter && _activeFilter.type === type && _activeFilter.value === value) {
          _activeFilter = null;
        } else {
          _activeFilter = { type: type, value: value };
        }
        updateFilterButtons();
        renderOverlays();
        return;
      }
    });

    // Close on background click
    content.addEventListener('click', function(e) {
      if (e.target === content) close();
    });

    // Close on Escape
    document.addEventListener('keydown', _onKeyDown);

    // --- Zoom via dropdown ---
    _zoomLevel = 1;
    var zoomSelect = toolbar.querySelector('.milg-viewer-zoom-select');
    if (zoomSelect) {
      zoomSelect.addEventListener('change', function() {
        _zoomLevel = parseFloat(zoomSelect.value) || 1;
        applyZoom(frame);
      });
    }

    updateFilterButtons();
    renderOverlays();
  }

  function applyZoom(frame) {
    if (!frame) return;
    frame.style.transform = _zoomLevel === 1 ? '' : 'scale(' + _zoomLevel + ')';
    frame.style.transformOrigin = 'center top';
  }

  function _onKeyDown(e) {
    if (!_overlay) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowLeft') { navigateSection(-1); return; }
    if (e.key === 'ArrowRight') { navigateSection(1); return; }
  }

  function navigateSection(dir) {
    var next = _currentSection + dir;
    if (next < 0 || next >= _screenshots.length) return;
    _currentSection = next;

    // Reset zoom on section change
    _zoomLevel = 1;
    var frame = _overlay.querySelector('.milg-viewer-frame');
    if (frame) frame.style.transform = '';
    var zoomSel = _overlay.querySelector('.milg-viewer-zoom-select');
    if (zoomSel) zoomSel.value = '1';

    var img = _overlay.querySelector('.milg-viewer-img');
    var svg = _overlay.querySelector('.milg-viewer-svg');
    if (img) {
      img.src = _screenshots[_currentSection];
      // Update viewBox when new image loads to match its exact dimensions
      img.addEventListener('load', function onLoad() {
        img.removeEventListener('load', onLoad);
        if (svg) svg.setAttribute('viewBox', '0 0 ' + img.naturalWidth + ' ' + img.naturalHeight);
      });
    }

    // Update nav label
    var label = _overlay.querySelector('.milg-viewer-nav-idx');
    if (label) label.textContent = _currentSection + 1;

    updateFilterButtons();
    renderOverlays();
  }

  // Count findings visible in the current section
  function countInSection() {
    if (!_meta) return { cat: {}, sev: { error: 0, warning: 0, info: 0 } };
    var scale = _meta.scale;
    var sectionH = Math.round(_meta.viewportHeight * scale);
    var sectionTop = _currentSection * sectionH;
    var sectionBottom = sectionTop + sectionH;
    var cat = {}, sev = { error: 0, warning: 0, info: 0 };
    _allFindings.forEach(function(f) {
      var inSection = f.bboxes.some(function(bbox) {
        var cy = bbox.top * scale;
        var cb = cy + bbox.height * scale;
        return cb >= sectionTop && cy <= sectionBottom;
      });
      if (!inSection) return;
      cat[f.icon] = (cat[f.icon] || 0) + 1;
      if (sev[f.severity] !== undefined) sev[f.severity]++;
    });
    return { cat: cat, sev: sev };
  }

  function updateFilterButtons() {
    if (!_overlay) return;
    var counts = countInSection();

    // Count verify results in this section
    var verifyInSection = 0, verifyFailsInSection = 0;
    if (_reportData && _reportData._contrastVerifyResults && _reportData.raw && _reportData.raw.colors && _meta) {
      var scale = _meta.scale;
      var sectionH = Math.round(_meta.viewportHeight * scale);
      var sectionTop = _currentSection * sectionH;
      var sectionBottom = sectionTop + sectionH;
      var pairsBySelector = {};
      _reportData.raw.colors.contrastPairs.forEach(function(p) { if (p.bbox) pairsBySelector[p.selector] = p; });
      _reportData._contrastVerifyResults.forEach(function(vr) {
        var pair = pairsBySelector[vr.selector];
        if (!pair || !pair.bbox) return;
        var cy = pair.bbox.top * scale;
        var cb = cy + pair.bbox.height * scale;
        if (cb >= sectionTop && cy <= sectionBottom) {
          verifyInSection++;
          if (vr.crossesBoundary) verifyFailsInSection++;
        }
      });
    }

    var btns = _overlay.querySelectorAll('.milg-viewer-filter-btn');
    btns.forEach(function(btn) {
      var type = btn.getAttribute('data-filter-type');
      var value = btn.getAttribute('data-filter-value');
      var isActive = _activeFilter && _activeFilter.type === type && _activeFilter.value === value;
      btn.classList.toggle('active', isActive);
      // Update count badge and visibility for this section
      var count;
      if (type === 'verify') {
        count = value === 'fails' ? verifyFailsInSection : verifyInSection;
      } else {
        count = type === 'category' ? (counts.cat[value] || 0) : (counts.sev[value] || 0);
      }
      var badge = btn.querySelector('.milg-viewer-count');
      if (badge) badge.textContent = count;
      btn.style.display = count > 0 ? '' : 'none';
    });
  }

  function renderOverlays() {
    var svg = _overlay && _overlay.querySelector('.milg-viewer-svg');
    if (!svg || !_meta) return;

    // Clear existing rects
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Show hint when no filter is active
    var hint = _overlay && _overlay.querySelector('.milg-viewer-hint');
    if (!_activeFilter) {
      if (_allFindings.length > 0 && !hint) {
        var hintEl = document.createElement('div');
        hintEl.className = 'milg-viewer-hint';
        hintEl.textContent = 'Select a filter above to highlight findings on this screenshot';
        var content = _overlay.querySelector('.milg-viewer-content');
        if (content) content.appendChild(hintEl);
      }
      return;
    }
    if (hint) hint.parentNode.removeChild(hint);

    // Handle pixel verification filter — renders from verification results, not findings
    if (_activeFilter.type === 'verify') {
      renderVerifyOverlays(svg);
      return;
    }

    var scale = _meta.scale;
    var sectionH = Math.round(_meta.viewportHeight * scale);
    var sectionTop = _currentSection * sectionH;
    var sectionBottom = sectionTop + sectionH;

    // Build pixel verification lookup by selector (if available)
    var verifyMap = {}; // selector → verification result
    if (_reportData && _reportData._contrastVerifyResults) {
      _reportData._contrastVerifyResults.forEach(function(vr) {
        if (vr.selector) verifyMap[vr.selector] = vr;
      });
    }

    var count = 0;
    _allFindings.forEach(function(finding, fIdx) {
      // Apply filter
      if (_activeFilter.type === 'category' && finding.icon !== _activeFilter.value) return;
      if (_activeFilter.type === 'severity' && finding.severity !== _activeFilter.value) return;

      var color = COLORS[finding.severity] || COLORS.info;

      // Check pixel verification for this finding (match by selector in detail)
      var verifyResult = null;
      if (finding.detail) {
        Object.keys(verifyMap).forEach(function(sel) {
          if (finding.detail.indexOf(sel) !== -1) verifyResult = verifyMap[sel];
        });
      }

      finding.bboxes.forEach(function(bbox) {
        var canvasY = bbox.top * scale;
        var canvasBottom = canvasY + bbox.height * scale;

        // Skip if bbox not in this section
        if (canvasBottom < sectionTop || canvasY > sectionBottom) return;

        var x = Math.round(bbox.left * scale);
        var y = Math.round(canvasY - sectionTop);
        var w = Math.round(bbox.width * scale);
        var h = Math.round(bbox.height * scale);

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
            // Hidden failure — CSS says pass but pixels fail: thick red double-stroke
            rect.setAttribute('stroke', '#ef4444');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('stroke-dasharray', '6 2');
            rect.setAttribute('fill', 'rgba(239,68,68,0.25)');
          } else if (verifyResult.crossesBoundary && !verifyResult.cssPasses && verifyResult.pixelPasses) {
            // False positive — CSS says fail but pixels pass: green dashed
            rect.setAttribute('stroke', '#22c55e');
            rect.setAttribute('stroke-width', '1.5');
            rect.setAttribute('stroke-dasharray', '4 3');
            rect.setAttribute('fill', 'rgba(34,197,94,0.15)');
          } else if (verifyResult.significant) {
            // Notable deviation
            rect.setAttribute('stroke-dasharray', '4 2');
          }
          // Else: verified consistent — keep default styling
        }

        svg.appendChild(rect);
        count++;
      });
    });

    // Tooltip + click handlers on rects
    svg.querySelectorAll('rect').forEach(function(rect) {
      rect.addEventListener('mouseenter', function(e) { showTooltip(e, parseInt(rect.getAttribute('data-finding'))); });
      rect.addEventListener('mouseleave', hideTooltip);
      rect.addEventListener('click', function() {
        var fIdx = parseInt(rect.getAttribute('data-finding'));
        scrollToFinding(fIdx);
      });
    });
  }

  function showTooltip(e, findingIdx) {
    hideTooltip();
    var finding = _allFindings[findingIdx];
    if (!finding) return;

    _tooltip = document.createElement('div');
    _tooltip.className = 'milg-viewer-tooltip';

    var sevClass = 'milg-viewer-sev-' + finding.severity;
    // Check for pixel verification data
    var verifyNote = '';
    if (_reportData && _reportData._contrastVerifyResults && window.MilgContrastVerify) {
      var vResults = _reportData._contrastVerifyResults;
      // Match by finding title (contains ratio + selector info)
      for (var vi = 0; vi < vResults.length; vi++) {
        var vr = vResults[vi];
        if (finding.detail && finding.detail.indexOf(vr.selector) !== -1) {
          verifyNote = '<div class="milg-viewer-tooltip-verify">' + MilgContrastVerify.formatResult(vr) + '</div>';
          break;
        }
      }
    }
    _tooltip.innerHTML = '<div class="milg-viewer-tooltip-header">' +
      '<span class="milg-viewer-tooltip-badge ' + sevClass + '">' + finding.severity + '</span>' +
      '<span class="milg-viewer-tooltip-cat">' + finding.category + '</span>' +
      '</div>' +
      '<div class="milg-viewer-tooltip-title">' + finding.title + '</div>' +
      (finding.detail ? '<div class="milg-viewer-tooltip-detail">' + finding.detail.substring(0, 120) + '</div>' : '') +
      verifyNote;

    document.body.appendChild(_tooltip);

    // Position near cursor
    var x = e.clientX + 12;
    var y = e.clientY + 12;
    // Keep on screen
    var tw = _tooltip.offsetWidth;
    var th = _tooltip.offsetHeight;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 12;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - 12;
    _tooltip.style.left = x + 'px';
    _tooltip.style.top = y + 'px';
  }

  // Render pixel verification results as bbox overlays
  function renderVerifyOverlays(svg) {
    if (!_reportData || !_reportData._contrastVerifyResults || !_meta) return;
    var results = _reportData._contrastVerifyResults;
    var scale = _meta.scale;
    var sectionH = Math.round(_meta.viewportHeight * scale);
    var sectionTop = _currentSection * sectionH;
    var sectionBottom = sectionTop + sectionH;
    var showFails = _activeFilter.value === 'fails';

    // Also need original contrast pairs to get bboxes (verify results have selector but not bbox directly)
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

      var canvasY = pair.bbox.top * scale;
      var canvasBottom = canvasY + pair.bbox.height * scale;
      if (canvasBottom < sectionTop || canvasY > sectionBottom) return;

      var x = Math.round(pair.bbox.left * scale);
      var y = Math.round(canvasY - sectionTop);
      var w = Math.round(pair.bbox.width * scale);
      var h = Math.round(pair.bbox.height * scale);

      // Color based on verification status
      var fill, stroke, dash;
      if (vr.crossesBoundary && vr.cssPasses && !vr.pixelPasses) {
        // Hidden failure: red
        fill = 'rgba(239,68,68,0.25)'; stroke = '#ef4444'; dash = '6 2';
      } else if (vr.crossesBoundary && !vr.cssPasses && vr.pixelPasses) {
        // False positive: green
        fill = 'rgba(34,197,94,0.2)'; stroke = '#22c55e'; dash = '4 3';
      } else if (vr.isVariableBg) {
        // Variable background: amber
        fill = 'rgba(234,179,8,0.15)'; stroke = '#eab308'; dash = '4 2';
      } else {
        // Verified consistent: subtle green
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

      // Add ratio label inside the rect
      if (w > 30 && h > 12) {
        var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', x + 3);
        label.setAttribute('y', y + 11);
        label.setAttribute('font-size', '10');
        label.setAttribute('fill', stroke);
        label.setAttribute('font-family', 'system-ui, sans-serif');
        label.setAttribute('font-weight', '600');
        label.setAttribute('pointer-events', 'none');
        label.textContent = vr.pixelRatio + ':1';
        svg.appendChild(label);
      }
    });

    // Tooltip handlers for verify rects
    svg.querySelectorAll('rect[data-verify]').forEach(function(rect) {
      rect.addEventListener('mouseenter', function(e) {
        var vIdx = parseInt(rect.getAttribute('data-verify'));
        var vr = results[vIdx];
        if (!vr) return;
        hideTooltip();
        _tooltip = document.createElement('div');
        _tooltip.className = 'milg-viewer-tooltip';
        _tooltip.innerHTML = '<div class="milg-viewer-tooltip-title">' + vr.selector + '</div>' +
          '<div class="milg-viewer-tooltip-detail">"' + (vr.text || '').substring(0, 40) + '"</div>' +
          '<div style="margin-top:4px;font-size:11px">' +
          'CSS: ' + vr.cssRatio + ':1 ' + (vr.cssPasses ? '<span style="color:#22c55e">pass</span>' : '<span style="color:#ef4444">fail</span>') +
          '<br>Pixel worst: ' + vr.pixelRatio + ':1 ' + (vr.pixelPasses ? '<span style="color:#22c55e">pass</span>' : '<span style="color:#ef4444">fail</span>') +
          '<br>Pixel avg: ' + vr.pixelRatioAvg + ':1, best: ' + vr.pixelRatioBest + ':1' +
          (vr.isVariableBg ? '<br><span style="color:#eab308">Variable background (variance: ' + vr.bgVariance + ')</span>' : '') +
          '</div>';
        document.body.appendChild(_tooltip);
        var tx = e.clientX + 12, ty = e.clientY + 12;
        var tw = _tooltip.offsetWidth, th = _tooltip.offsetHeight;
        if (tx + tw > window.innerWidth - 8) tx = e.clientX - tw - 12;
        if (ty + th > window.innerHeight - 8) ty = e.clientY - th - 12;
        _tooltip.style.left = tx + 'px'; _tooltip.style.top = ty + 'px';
      });
      rect.addEventListener('mouseleave', hideTooltip);
      rect.addEventListener('click', function() { scrollToFinding(-1); }); // close viewer on click
    });
  }

  function scrollToFinding(findingIdx) {
    // Close viewer and scroll to the finding card in the report
    close();
    // findingIdx matches data-finding-idx on .report-finding elements
    var el = document.querySelector('[data-finding-idx="' + findingIdx + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight pulse
      el.style.transition = 'box-shadow 300ms ease';
      el.style.boxShadow = '0 0 0 3px var(--primary, #2563eb)';
      setTimeout(function() { el.style.boxShadow = ''; }, 1500);
    }
  }

  function hideTooltip() {
    if (_tooltip && _tooltip.parentNode) {
      _tooltip.parentNode.removeChild(_tooltip);
    }
    _tooltip = null;
  }

  function close() {
    hideTooltip();
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
    _zoomLevel = 1;
    document.removeEventListener('keydown', _onKeyDown);
  }

  // Simple lightbox fallback (for data without screenshotMeta)
  function simpleLightbox(img) {
    var isMobile = window.innerWidth <= 640;
    var rect = img.getBoundingClientRect();
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0);z-index:9999;cursor:zoom-out;display:flex;align-items:center;justify-content:center;transition:background 200ms ease;overflow:auto;-webkit-overflow-scrolling:touch';

    var zoomed = document.createElement('img');
    zoomed.src = img.src;
    zoomed.alt = img.alt;

    if (isMobile) {
      zoomed.style.cssText = 'width:100vw;height:auto;object-fit:contain;opacity:0;transition:opacity 200ms ease';
      overlay.style.alignItems = 'flex-start';
    } else {
      zoomed.style.cssText = 'position:fixed;top:' + rect.top + 'px;left:' + rect.left + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;object-fit:contain;transition:all 250ms ease;border-radius:4px;box-shadow:0 8px 32px rgba(0,0,0,0.3)';
    }

    overlay.appendChild(zoomed);
    document.body.appendChild(overlay);

    requestAnimationFrame(function() {
      overlay.style.background = 'rgba(0,0,0,0.92)';
      if (isMobile) {
        zoomed.style.opacity = '1';
      } else {
        zoomed.style.top = '0';
        zoomed.style.left = '0';
        zoomed.style.width = '100vw';
        zoomed.style.height = '100vh';
      }
    });

    function closeSimple() {
      if (isMobile) {
        zoomed.style.opacity = '0';
      } else {
        zoomed.style.top = rect.top + 'px';
        zoomed.style.left = rect.left + 'px';
        zoomed.style.width = rect.width + 'px';
        zoomed.style.height = rect.height + 'px';
      }
      overlay.style.background = 'rgba(0,0,0,0)';
      setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
    }
    overlay.addEventListener('click', closeSimple);
    document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { closeSimple(); document.removeEventListener('keydown', onKey); } });
  }

  // Open viewer to a specific finding (navigates to correct section, sets filter)
  function showFinding(findingIdx, reportData) {
    if (!reportData || !reportData.raw || !reportData.raw.screenshots || !reportData.raw.screenshotMeta) return;

    // Collect findings to find the target
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

    // Determine section from first bbox
    var meta = reportData.raw.screenshotMeta;
    var sectionIdx = Math.floor(target.bboxes[0].top / meta.viewportHeight);
    sectionIdx = Math.min(sectionIdx, reportData.raw.screenshots.length - 1);

    // Create a dummy img (viewer needs initial img for fallback path)
    var dummyImg = document.createElement('img');
    dummyImg.src = reportData.raw.screenshots[sectionIdx];

    open(dummyImg, sectionIdx, reportData);

    // Set filter to this finding's category
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
