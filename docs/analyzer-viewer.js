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

  // Severity colors
  var COLORS = {
    error:   { fill: 'rgba(239,68,68,0.18)', stroke: '#ef4444' },
    warning: { fill: 'rgba(245,158,11,0.18)', stroke: '#f59e0b' },
    info:    { fill: 'rgba(59,130,246,0.18)', stroke: '#3b82f6' }
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

    toolbar.innerHTML = navHtml +
      '<div class="milg-viewer-filters">' + catPills + '<span class="milg-viewer-sep"></span>' + sevPills + '</div>' +
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

    // SVG overlay — viewBox matches the canvas section pixel dimensions
    var sectionHeight = Math.round(_meta.viewportHeight * _meta.scale);
    // Last section may be shorter
    var lastSectionH = _meta.canvasHeight - (_currentSection * sectionHeight);
    var thisSectionH = Math.min(sectionHeight, lastSectionH);

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'milg-viewer-svg');
    svg.setAttribute('viewBox', '0 0 ' + _meta.canvasWidth + ' ' + thisSectionH);
    svg.setAttribute('preserveAspectRatio', 'none');

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

    // Left/right arrow keys for section nav
    // (handled in _onKeyDown)

    updateFilterButtons();
    renderOverlays();
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

    var img = _overlay.querySelector('.milg-viewer-img');
    if (img) img.src = _screenshots[_currentSection];

    // Update viewBox for new section height
    var svg = _overlay.querySelector('.milg-viewer-svg');
    if (svg && _meta) {
      var sectionHeight = Math.round(_meta.viewportHeight * _meta.scale);
      var lastSectionH = _meta.canvasHeight - (_currentSection * sectionHeight);
      var thisSectionH = Math.min(sectionHeight, lastSectionH);
      svg.setAttribute('viewBox', '0 0 ' + _meta.canvasWidth + ' ' + thisSectionH);
    }

    // Update nav label
    var label = _overlay.querySelector('.milg-viewer-nav-idx');
    if (label) label.textContent = _currentSection + 1;

    renderOverlays();
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
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('rx', '2');
        rect.setAttribute('data-finding', fIdx);

        // Pixel verification indicators
        if (verifyResult) {
          if (verifyResult.crossesBoundary && verifyResult.cssPasses && !verifyResult.pixelPasses) {
            // Hidden failure — CSS says pass but pixels fail: thick red double-stroke
            rect.setAttribute('stroke', '#ef4444');
            rect.setAttribute('stroke-width', '3');
            rect.setAttribute('stroke-dasharray', '6 2');
            rect.setAttribute('fill', 'rgba(239,68,68,0.25)');
          } else if (verifyResult.crossesBoundary && !verifyResult.cssPasses && verifyResult.pixelPasses) {
            // False positive — CSS says fail but pixels pass: green dashed
            rect.setAttribute('stroke', '#22c55e');
            rect.setAttribute('stroke-width', '2');
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
