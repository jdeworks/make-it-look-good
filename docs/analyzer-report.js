// make-it-look-good — Report Renderers
// HTML report, markdown export, gauge SVG, progress bars

window.MilgReport = (function() {
  "use strict";

  // --- Report Rendering ---
  var categoryIcons = {
    contrast: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M12 2a10 10 0 0 1 0 20"/></svg>',
    type: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    spacing: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
    touch: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
    a11y: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M6 8h12"/><path d="M12 8v8"/><path d="M9 20l3-4 3 4"/></svg>',
    responsive: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    consistency: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 4.5v5c0 4.1-3.6 8-9 10.5-5.4-2.5-9-6.4-9-10.5v-5L12 3z"/></svg>',
    cognitive: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20h6v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z"/><line x1="10" y1="22" x2="14" y2="22"/></svg>',
    layout: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="12"/></svg>',
    readability: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
  };

  function isDarkUi() {
    return document.body && document.body.classList.contains('dark-ui');
  }

  function scoreColor(score) {
    var dark = isDarkUi();
    if (score >= 90) return dark ? '#4ade80' : '#16a34a';
    if (score >= 70) return dark ? '#facc15' : '#ca8a04';
    if (score >= 50) return dark ? '#fb923c' : '#ea580c';
    return dark ? '#f87171' : '#dc2626';
  }

  function gradeColor(grade) {
    var dark = isDarkUi();
    var light = { A: '#16a34a', B: '#65a30d', C: '#ca8a04', D: '#ea580c', F: '#dc2626' };
    var darkC = { A: '#4ade80', B: '#a3e635', C: '#facc15', D: '#fb923c', F: '#f87171' };
    return (dark ? darkC : light)[grade] || '#64748b';
  }

  function severityBadge(severity) {
    var cls = 'severity-badge-' + (severity || 'info');
    return '<span class="' + cls + '" style="display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px">' + severity + '</span>';
  }

  function renderReport(report) {
    var html = '';

    // --- Header ---
    html += '<div class="report-header">';
    html += '<div class="report-header-info">';
    html += '<h1>Design Analysis Report</h1>';
    var reportUrl = report.meta.url || 'Pasted HTML';
    if (/^https?:\/\//.test(reportUrl)) {
      html += '<p class="report-url"><a href="' + escapeHtml(reportUrl) + '" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline">' + escapeHtml(reportUrl) + '</a></p>';
    } else {
      html += '<p class="report-url">' + escapeHtml(reportUrl) + '</p>';
    }
    var ctxType = (report.raw.context && report.raw.context.pageType) || 'unknown';
    var ctxLabel = { marketing: 'Marketing / Landing', pricing: 'Pricing Page', form: 'Form Page', app: 'Application', content: 'Content Page', component: 'Component / Snippet', unknown: 'General' }[ctxType] || ctxType;
    html += '<p class="report-timestamp">' + new Date(report.meta.timestamp).toLocaleString() + ' &middot; ' + report.meta.viewportWidth + '&times;' + report.meta.viewportHeight + 'px &middot; Detected: ' + ctxLabel + '</p>';
    html += '</div>';

    // Overall score gauge
    html += '<div class="report-gauge">';
    html += renderGauge(report.overall, report.grade);
    html += '<div class="report-grade-label">' + report.gradeLabel + '</div>';
    html += '</div>';
    html += '</div>';

    // Deep scan viewport info handled by persistent tabs above report — no inline bar needed

    // --- Screenshot preview (small clickable thumbnail → opens full viewer) ---
    var _previewSrc = report.raw.screenshotClean || (report.raw.screenshots && report.raw.screenshots[0]) || null;
    if (_previewSrc) {
      html += '<div class="report-screenshots" style="margin:8px 0 16px">';
      html += '<div style="max-width:240px;border:1px solid var(--border);border-radius:6px;overflow:hidden;cursor:zoom-in;transition:box-shadow 0.2s" ' +
        'onmouseenter="this.style.boxShadow=\'0 0 0 2px var(--primary)\'" onmouseleave="this.style.boxShadow=\'none\'">';
      html += '<img src="' + _previewSrc + '" alt="Page screenshot" style="width:100%;display:block" onclick="window.__milgZoomScreenshot(this,0)" loading="lazy">';
      var _synMeta = report.raw.screenshotMeta && report.raw.screenshotMeta.synthetic;
      html += '<div style="padding:4px 8px;font-size:10px;color:var(--text-secondary);background:var(--bg-alt);text-align:center">' + (_synMeta ? '⚠ Approximate rendering — the page’s CSP blocked real screenshots' : 'Click to open viewer') + '</div>';
      html += '</div>';
      html += '</div>';
    }

    // --- Category cards ---
    html += '<div class="report-categories">';
    report.categories.forEach(function(cat) {
      var catId = 'findings-' + _slug(cat.label);
      var hasFindings = cat.findings.length > 0;
      // All cards are clickable — scroll to findings if present, otherwise to passed checks
      var scrollTarget = hasFindings ? catId : 'passed-checks';
      html += '<div class="report-card report-card-clickable" onclick="var el=document.getElementById(\'' + scrollTarget + '\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'start\'});if(!el.open&&el.tagName===\'DETAILS\')el.open=true;}">';
      html += '<div class="report-card-header">';
      html += '<div class="report-card-icon" style="color:' + scoreColor(cat.score) + '">' + (categoryIcons[cat.icon] || '') + '</div>';
      html += '<div class="report-card-title">';
      html += '<h3>' + cat.label + '</h3>';
      html += '<span class="report-card-weight">' + cat.weight + '% weight</span>';
      html += '</div>';
      if (cat.notApplicable) {
        html += '<div class="report-card-score" style="color:var(--text-secondary);font-size:13px">N/A</div>';
      } else {
        html += '<div class="report-card-score" style="color:' + scoreColor(cat.score) + '">' + cat.score + '</div>';
      }
      html += '</div>';
      html += renderProgressBar(cat.score);

      // Finding count with color-coded badges and tooltips
      var errors = cat.findings.filter(function(f) { return f.severity === 'error'; }).length;
      var warnings = cat.findings.filter(function(f) { return f.severity === 'warning'; }).length;
      var infos = cat.findings.filter(function(f) { return f.severity === 'info'; }).length;
      var passed = (cat.checks || 0) - errors - warnings;
      if (passed < 0) passed = 0;
      // If module didn't report checks, estimate from findings
      var totalChecks = cat.checks || (errors + warnings + infos + (cat.findings.length === 0 ? 1 : 0));
      var notApplicable = Math.max(0, totalChecks - errors - warnings - infos - passed);

      var catId = 'findings-' + _slug(cat.label);
      html += '<div class="report-card-counts">';
      if (totalChecks > 0 || cat.findings.length === 0) {
        if (errors > 0) html += '<span class="count-error" title="' + errors + ' error(s)" onclick="event.stopPropagation();document.getElementById(\'' + catId + '\').scrollIntoView({behavior:\'smooth\',block:\'start\'})">' + errors + '</span>';
        if (warnings > 0) html += '<span class="count-warning" title="' + warnings + ' warning(s)" onclick="event.stopPropagation();document.getElementById(\'' + catId + '\').scrollIntoView({behavior:\'smooth\',block:\'start\'})">' + warnings + '</span>';
        if (infos > 0) html += '<span class="count-info" title="' + infos + ' info" onclick="event.stopPropagation();document.getElementById(\'' + catId + '\').scrollIntoView({behavior:\'smooth\',block:\'start\'})">' + infos + '</span>';
        if (passed > 0 || cat.findings.length === 0) html += '<span class="count-pass" title="' + (passed || totalChecks) + ' passed">' + (passed || totalChecks) + '</span>';
      }
      html += '</div>';

      html += '</div>';
    });
    html += '</div>';

    // --- Detailed findings ---
    html += '<div class="report-findings">';
    html += '<h2>Detailed Findings</h2>';

    var _bboxFindingIdx = 0; // Global finding index for "show on screenshot" links
    var _hasScreenshots = report.raw && report.raw.screenshots && report.raw.screenshots.length > 0 && report.raw.screenshotMeta;
    // Build lookup of clipped bbox positions for annotating findings
    var _clippedBboxSet = {};
    if (report.raw && report.raw.colors && report.raw.colors.contrastPairs) {
      report.raw.colors.contrastPairs.forEach(function(cp) {
        if (cp._isClipped && cp.bbox) {
          _clippedBboxSet[Math.round(cp.bbox.left) + ',' + Math.round(cp.bbox.top) + ',' + Math.round(cp.bbox.width) + ',' + Math.round(cp.bbox.height)] = true;
        }
      });
    }
    report.categories.forEach(function(cat) {
      if (cat.findings.length === 0) return;

      html += '<div class="report-finding-group" id="findings-' + _slug(cat.label) + '">';
      html += '<h3>' + (categoryIcons[cat.icon] || '') + ' ' + cat.label + '</h3>';

      cat.findings.forEach(function(f) {
        if (f.severity === 'pass') return; // pass findings only show in screenshot viewer
        var hasBboxes = f.locator && f.locator.bboxes && f.locator.bboxes.length > 0;
        html += '<div class="report-finding severity-' + f.severity + '"' + (hasBboxes ? ' data-finding-idx="' + _bboxFindingIdx + '"' : '') + '>';
        html += '<div class="finding-header">';
        html += severityBadge(f.severity);
        html += '<span class="finding-title">' + escapeHtml(f.title) + '</span>';
        html += '</div>';
        if (f.detail) html += '<p class="finding-detail">' + escapeHtml(f.detail) + '</p>';
        // Affected elements with selectors + text (collapsible, for machine-readable reports)
        if (f.locator && f.locator.selectors && f.locator.selectors.length > 0) {
          var _texts = f.locator.texts || [];
          var _hasBboxList = f.locator.bboxes && f.locator.bboxes.length > 0 && _hasScreenshots;
          html += '<details class="finding-selectors" style="margin:6px 0;font-size:11px">';
          html += '<summary style="cursor:pointer;color:var(--text-secondary)">' + f.locator.selectors.length + ' affected element' + (f.locator.selectors.length !== 1 ? 's' : '') + '</summary>';
          html += '<div style="margin:4px 0 0;padding:8px;background:var(--bg-alt);border:1px solid var(--border);border-radius:4px;font-size:10px;line-height:1.8;max-height:300px;overflow:auto">';
          f.locator.selectors.forEach(function(sel, si) {
            var txt = _texts[si] || '';
            var canShow = _hasBboxList && si < f.locator.bboxes.length && f.locator.bboxes[si];
            html += '<div style="padding:2px 0;border-bottom:1px solid var(--border);display:flex;align-items:baseline;gap:6px">';
            if (canShow) {
              html += '<a style="cursor:pointer;color:var(--accent);text-decoration:none;flex-shrink:0;font-size:9px" onclick="window.__milgShowBboxOnScreenshot(' + _bboxFindingIdx + ',' + si + ')" title="Show on screenshot">&#128269;</a>';
            }
            html += '<span style="flex:1;min-width:0"><code style="color:var(--text-primary)">' + escapeHtml(sel) + '</code>';
            if (txt) html += ' <span style="color:var(--text-secondary);font-style:italic">&quot;' + escapeHtml(txt.substring(0, 50)) + (txt.length > 50 ? '…' : '') + '&quot;</span>';
            html += '</span></div>';
          });
          html += '</div></details>';
        }
        // Color pair swatches for contrast findings
        if (f._colors) {
          html += '<div class="finding-color-pair" style="display:flex;align-items:center;gap:8px;margin:4px 0 6px;font-size:11px;color:var(--text-secondary)">' +
            '<span style="display:inline-flex;align-items:center;gap:4px">' +
              '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid var(--border);background:' + escapeHtml(f._colors.fg) + '" title="Foreground: ' + escapeHtml(f._colors.fg) + '"></span>' +
              '<code style="font-size:10px">' + escapeHtml(f._colors.fg) + '</code>' +
            '</span>' +
            '<span style="opacity:0.5">on</span>' +
            '<span style="display:inline-flex;align-items:center;gap:4px">' +
              '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid var(--border);background:' + escapeHtml(f._colors.bg) + '" title="Background: ' + escapeHtml(f._colors.bg) + '"></span>' +
              '<code style="font-size:10px">' + escapeHtml(f._colors.bg) + '</code>' +
            '</span>' +
            '<span style="opacity:0.5">=</span> <strong>' + f._colors.ratio + ':1</strong>' +
          '</div>';
        }

        html += '<div class="finding-fix">';
        html += '<strong>Fix:</strong> ' + escapeHtml(f.fix);
        html += '</div>';

        if (f.presetRef) {
          html += '<div class="finding-preset">';
          html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> ';
          html += escapeHtml(f.presetRef);
          html += '</div>';
        }

        if (f.source) {
          var srcParts = f.source.split(' — ');
          var srcLabel = srcParts[0];
          var srcUrl = srcParts[1] || '';
          html += '<div class="finding-source">';
          if (srcUrl) {
            html += '<a href="' + escapeHtml(srcUrl) + '" target="_blank" rel="noopener">' + escapeHtml(srcLabel) + '</a>';
          } else {
            html += escapeHtml(srcLabel);
          }
          html += '</div>';
        }

        if (hasBboxes && _hasScreenshots) {
          html += '<a class="finding-show-on-screenshot" onclick="window.__milgShowFindingOnScreenshot(' + _bboxFindingIdx + ')">Show on screenshot</a>';
        }
        // Check if any bboxes for this finding are in clipped regions
        if (hasBboxes && f.locator && f.locator.bboxes) {
          var clippedCount = 0;
          f.locator.bboxes.forEach(function(bb) {
            if (bb) {
              var key = Math.round(bb.left) + ',' + Math.round(bb.top) + ',' + Math.round(bb.width) + ',' + Math.round(bb.height);
              if (_clippedBboxSet[key]) clippedCount++;
            }
          });
          if (clippedCount > 0) {
            html += '<div style="margin-top:4px;font-size:11px;color:#60a5fa;display:flex;align-items:center;gap:4px">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/><path d="M9 12h6M12 9v6"/></svg>' +
              (clippedCount === f.locator.bboxes.length ? 'Hidden in overflow container' : clippedCount + ' of ' + f.locator.bboxes.length + ' elements hidden in overflow container') +
              ' \u2014 verified in expanded region view</div>';
          }
        }
        if (hasBboxes) _bboxFindingIdx++;

        html += '</div>';
      });

      html += '</div>';
    });

    html += '</div>';

    // --- Passed checks ---
    // Check descriptions per category (what was checked and passed)
    var checkDescriptions = {
      contrast: [
        { title: 'Text contrast ratio meets threshold', detail: 'All text elements have sufficient contrast against their backgrounds.', source: 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum' },
        { title: 'No undetermined contrast issues', detail: 'All background colors could be resolved (no complex gradients or images blocking analysis).', source: 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum' },
        { title: 'Text uses real HTML (not images)', detail: 'Text is rendered as selectable HTML, not embedded in images.', source: 'WCAG 2.2 §1.4.5 — https://www.w3.org/TR/WCAG22/#images-of-text' },
        { title: 'CVD-safe color palette', detail: 'Color pairs remain distinguishable under color vision deficiency simulation.', source: 'Machado et al. 2009 — https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html' }
      ],
      type: [
        { title: 'Body font size adequate', detail: 'Body text meets the minimum font size for this audience.', source: 'NNGroup — https://www.nngroup.com/articles/let-users-control-font-size/' },
        { title: 'Line height within range', detail: 'Body line-height provides comfortable reading spacing.', source: 'WCAG 2.2 §1.4.12 — https://www.w3.org/TR/WCAG22/#text-spacing' },
        { title: 'Line length under limit', detail: 'Content width constrains lines to a readable character count.', source: 'Butterick\'s Practical Typography — https://practicaltypography.com/line-length.html' },
        { title: 'Heading scale consistent', detail: 'Headings follow a logical size progression from H1 down.', source: 'Modular type scales — https://typescale.com/' },
        { title: 'Font weight count reasonable', detail: 'Uses 2-4 font weights, avoiding visual noise.', source: 'Google Fonts — https://fonts.google.com/knowledge/using_type/choosing_reliable_typefaces' },
        { title: 'Font family count under limit', detail: 'Uses 1-3 font families for visual consistency.', source: 'Butterick\'s Practical Typography — https://practicaltypography.com/summary-of-key-rules.html' },
        { title: 'Paragraph spacing appropriate', detail: 'Paragraphs have comfortable spacing between them.', source: 'Butterick\'s Practical Typography — https://practicaltypography.com/space-between-paragraphs.html' },
        { title: 'Font weight meets audience minimum', detail: 'All font weights are heavy enough for the target audience\'s legibility requirements.', source: 'W3C WAI Older Users — https://www.w3.org/WAI/older-users/developing/' }
      ],
      spacing: [
        { title: 'Spacing on 4px grid', detail: 'Spacing values align to a consistent base unit.', source: 'Material Design — https://m3.material.io/foundations/layout/applying-layout' },
        { title: 'Content width constrained', detail: 'Content doesn\'t stretch to excessive widths.', source: 'NNGroup — https://www.nngroup.com/articles/utilize-available-screen-space/' },
        { title: 'Body padding adequate', detail: 'Content has proper edge padding, not touching screen sides.', source: 'Material Design — https://m3.material.io/foundations/layout/applying-layout' },
        { title: 'No element overflow', detail: 'No content extends beyond its container boundaries.', source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow' },
        { title: 'Interactive element spacing adequate', detail: 'Buttons and links have enough gap between them to prevent mis-clicks.', source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum' }
      ],
      touch: [
        { title: 'Interactive targets properly sized', detail: 'Buttons, links, and inputs meet minimum target size.', source: 'WCAG 2.2 §2.5.8 — https://www.w3.org/TR/WCAG22/#target-size-minimum' },
        { title: 'Transition durations appropriate', detail: 'Animations stay under 500ms for responsive feel.', source: 'NNGroup — https://www.nngroup.com/articles/animation-usability/' },
        { title: 'Touch-friendly on mobile', detail: 'Elements would pass touch target requirements on mobile viewports.', source: 'Material Design 3 — https://m3.material.io/foundations/layout/applying-layout' }
      ],
      a11y: [
        { title: 'Semantic HTML landmarks', detail: 'Page uses header, nav, main, and/or footer elements.', source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships' },
        { title: 'Heading hierarchy intact', detail: 'Headings follow sequential order without gaps (h1 → h2 → h3).', source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships' },
        { title: 'Images have alt text', detail: 'All img elements include alt attributes for screen readers.', source: 'WCAG 2.2 §1.1.1 — https://www.w3.org/TR/WCAG22/#non-text-content' },
        { title: 'Form inputs labeled', detail: 'All form fields have associated labels or aria-label.', source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships' },
        { title: 'Focus indicators visible', detail: 'Interactive elements show visible focus styling for keyboard users.', source: 'WCAG 2.2 §2.4.7 — https://www.w3.org/TR/WCAG22/#focus-visible' },
        { title: 'Language attribute set', detail: 'HTML element has a lang attribute for correct pronunciation.', source: 'WCAG 2.2 §3.1.1 — https://www.w3.org/TR/WCAG22/#language-of-page' },
        { title: 'Skip navigation link', detail: 'Keyboard users can skip past navigation to reach main content.', source: 'WCAG 2.2 §2.4.1 — https://www.w3.org/TR/WCAG22/#bypass-blocks' },
        { title: 'Descriptive link text', detail: 'Links use meaningful text instead of "click here" or "read more".', source: 'WCAG 2.2 §2.4.4 — https://www.w3.org/TR/WCAG22/#link-purpose-in-context' },
        { title: 'No color-only indicators', detail: 'Status information uses icons or text in addition to color.', source: 'WCAG 2.2 §1.4.1 — https://www.w3.org/TR/WCAG22/#use-of-color' },
        { title: 'No duplicate IDs', detail: 'All element IDs are unique, preserving correct ARIA label associations and anchor links.', source: 'WCAG 2.2 §4.1.1 — https://www.w3.org/TR/WCAG22/#parsing' },
        { title: 'Scrollable regions keyboard-accessible', detail: 'Scrollable containers are reachable via keyboard, either through focusable children or tabindex.', source: 'WCAG 2.2 §2.1.1 — https://www.w3.org/TR/WCAG22/#keyboard' },
        { title: 'No nested interactive elements', detail: 'Links and buttons are not nested inside other interactive elements.', source: 'HTML spec §4.5.1 — https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element' },
        { title: 'No positive tabindex values', detail: 'Tab order follows natural DOM order without manual overrides.', source: 'WCAG 2.2 §2.4.3 — https://www.w3.org/TR/WCAG22/#focus-order' },
        { title: 'Interactive elements have accessible names', detail: 'All buttons and links have visible text, aria-label, or title so screen readers can announce them.', source: 'WCAG 2.2 §4.1.2 — https://www.w3.org/TR/WCAG22/#name-role-value' },
        { title: 'Form element borders meet contrast threshold', detail: 'Input boundaries have at least 3:1 contrast against their background, meeting WCAG 1.4.11.', source: 'WCAG 2.2 §1.4.11 — https://www.w3.org/TR/WCAG22/#non-text-contrast' },
        { title: 'Tables are accessible', detail: 'Data tables use th elements and appropriate scope attributes for screen reader navigation.', source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships' }
      ],
      responsive: [
        { title: 'Responsive breakpoints detected', detail: 'CSS media queries or responsive utility classes are present.', source: 'NNGroup — https://www.nngroup.com/articles/responsive-web-design-definition/' },
        { title: 'Dark mode support', detail: 'Page supports dark color scheme.', source: 'Apple HIG — https://developer.apple.com/design/human-interface-guidelines/dark-mode' },
        { title: 'Viewport meta tag correct', detail: 'Proper viewport configuration for mobile rendering.', source: 'MDN — https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag' },
        { title: 'User zoom not blocked', detail: 'Viewport doesn\'t prevent pinch-to-zoom.', source: 'WCAG 2.2 §1.4.4 — https://www.w3.org/TR/WCAG22/#resize-text' },
        { title: 'No horizontal overflow', detail: 'Page content fits within viewport width.', source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow' },
        { title: 'No fixed-width elements', detail: 'Elements use flexible widths that adapt to screen size.', source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow' }
      ],
      consistency: [
        { title: 'Color palette coherent', detail: 'Number of unique colors is within expected range.', source: 'Material Design 3 — https://m3.material.io/styles/color/roles' },
        { title: 'Font size scale consistent', detail: 'Uses a limited set of font sizes from a type scale.', source: 'Modular type scales — https://typescale.com/' },
        { title: 'Border radius consistent', detail: 'Uses 2-4 standard border-radius values.', source: 'Material Design 3 — https://m3.material.io/styles/shape/overview' },
        { title: 'Line height consistent', detail: 'Uses a small set of line-height values across the page.', source: 'Butterick\'s Practical Typography — https://practicaltypography.com/line-spacing.html' },
        { title: 'Dark mode supported', detail: 'Page provides a dark color scheme option.', source: 'Apple HIG — https://developer.apple.com/design/human-interface-guidelines/dark-mode' },
        { title: 'Z-index scale manageable', detail: 'Stacking order uses 8 or fewer distinct z-index values, keeping layering predictable.', source: 'Josh Comeau — https://www.joshwcomeau.com/css/stacking-contexts/' },
        { title: 'Shadow system consistent', detail: 'Box-shadow values are limited to 3-5 elevation levels for a coherent depth system.', source: 'Material Design 3 — https://m3.material.io/styles/elevation/overview' }
      ],
      cognitive: [
        { title: 'Content sections well-organized', detail: 'Page sections and headings are within cognitive load limits.', source: 'Hick\'s Law — https://lawsofux.com/hicks-law/' },
        { title: 'Form complexity manageable', detail: 'Visible form fields stay within recommended limits.', source: 'Miller\'s Law — https://lawsofux.com/millers-law/' },
        { title: 'Navigation count appropriate', detail: 'Top-level navigation items are within working memory limits.', source: 'Cowan (2001) — https://doi.org/10.1017/S0140525X01003922' },
        { title: 'Reading level appropriate', detail: 'Content reading level matches the target audience.', source: 'WCAG 2.2 §3.1.5 — https://www.w3.org/TR/WCAG22/#reading-level' },
        { title: 'Visual complexity manageable', detail: 'Number of unique colors doesn\'t overwhelm the user.', source: 'Material Design 3 — https://m3.material.io/styles/color/roles' },
        { title: 'Heading hierarchy supports scanning', detail: 'Headings follow a logical order for easy content navigation.', source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships' },
        { title: 'Interactive element density acceptable', detail: 'The ratio of clickable elements to total content is low enough to avoid overwhelming the user.', source: 'Hick\'s Law — https://lawsofux.com/hicks-law/' },
        { title: 'Reduced motion respected', detail: 'Animations include a prefers-reduced-motion fallback for users who are sensitive to motion.', source: 'WCAG 2.2 §2.3.3 — https://www.w3.org/TR/WCAG22/#animation-from-interactions' }
      ],
      layout: [
        { title: 'Section spacing consistent', detail: 'Gaps between major sections use uniform spacing.', source: 'Gestalt similarity — https://lawsofux.com/law-of-similarity/' },
        { title: 'Alignment grid clean', detail: 'Elements share consistent alignment edges without jagged offsets.', source: 'Gestalt continuity — https://lawsofux.com/law-of-common-region/' },
        { title: 'H1 visual hierarchy clear', detail: 'H1 stands out from body text at 2-4x size.', source: 'Modular type scales — https://typescale.com/' },
        { title: 'H2 visual hierarchy appropriate', detail: 'H2 is clearly distinct from both H1 and body text.', source: 'Modular type scales — https://typescale.com/' },
        { title: 'Border radius standardized', detail: 'Uses a consistent set of border-radius values.', source: 'Material Design 3 — https://m3.material.io/styles/shape/overview' },
        { title: 'Page density manageable', detail: 'Element count is within comfortable range for the page type.', source: 'NNGroup — https://www.nngroup.com/articles/how-users-read-on-the-web/' },
        { title: 'No elements outside viewport', detail: 'All visible elements are positioned within the horizontal bounds of the viewport.', source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow' },
        { title: 'No horizontal scroll', detail: 'No containers overflow horizontally, keeping the page free of accidental horizontal scrollbars.', source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow' },
        { title: 'No nested scrollbars', detail: 'Scrollable containers are not nested inside other scrollable containers.', source: 'NNGroup — https://www.nngroup.com/articles/scrolling-and-scrollbars/' },
        { title: 'Hidden panels fit viewport', detail: 'Dropdown menus and dialogs remain within the viewport when revealed.', source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow' },
        { title: 'DOM uses semantic elements', detail: 'Markup favors semantic HTML over generic div-only structure.', source: 'HTML Living Standard — https://html.spec.whatwg.org/multipage/dom.html#semantics-2' },
        { title: 'No silently clipped content', detail: 'No containers use overflow-x:hidden to hide overflowing content without providing scroll access.', source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow' },
        { title: 'Fixed elements have opaque backgrounds', detail: 'Fixed and sticky headers have backgrounds that prevent text overlap when scrolling.', source: 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum' },
        { title: 'Children fit within parent containers', detail: 'No elements unintentionally overflow their parent without explicit overflow handling.', source: 'CSS Box Model — https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model' },
        { title: 'No flex/grid overflow on mobile', detail: 'Flex and grid containers do not silently overflow on narrow viewports.', source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow' },
        { title: 'Fixed elements maintain contrast when scrolled', detail: 'Fixed headers and toolbars have backgrounds or adaptive color to stay legible over all page sections.', source: 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum' }
      ],
      readability: [
        { title: 'Heading density adequate', detail: 'Headings break content into scannable sections.', source: 'NNGroup — https://www.nngroup.com/articles/how-users-read-on-the-web/' },
        { title: 'Headings are descriptive', detail: 'Heading text is long enough to be meaningful (not just icons/numbers).', source: 'NNGroup — https://www.nngroup.com/articles/headings-pickup-lines/' },
        { title: 'No tiny text', detail: 'All text is at least 12px for readability.', source: 'WCAG 2.2 §1.4.4 — https://www.w3.org/TR/WCAG22/#resize-text' },
        { title: 'Reading level appropriate', detail: 'Coleman-Liau index indicates content matches target audience.', source: 'Coleman-Liau Index — https://en.wikipedia.org/wiki/Coleman%E2%80%93Liau_index' },
        { title: 'Paragraph length manageable', detail: 'No paragraphs exceed 150 words.', source: 'NNGroup — https://www.nngroup.com/articles/how-users-read-on-the-web/' },
        { title: 'Lists used for scanability', detail: 'Content uses lists to break up sequences and improve scanning.', source: 'NNGroup — https://www.nngroup.com/articles/how-users-read-on-the-web/' }
      ],
      performance: [
        { title: 'Web fonts use font-display', detail: 'Font loading doesn\'t block text rendering.', source: 'Web.dev — https://web.dev/articles/font-display' },
        { title: 'Render-blocking resources limited', detail: 'Few CSS/JS files block initial page render.', source: 'Web.dev — https://web.dev/articles/render-blocking-resources' },
        { title: 'DOM size reasonable', detail: 'Page has a manageable number of DOM elements.', source: 'Chrome DevTools — https://developer.chrome.com/docs/lighthouse/performance/dom-size' },
        { title: 'DOM nesting depth OK', detail: 'HTML nesting doesn\'t exceed recommended depth.', source: 'Chrome DevTools — https://developer.chrome.com/docs/lighthouse/performance/dom-size' },
        { title: 'Third-party scripts limited', detail: 'External script count is within reasonable bounds.', source: 'Web.dev — https://web.dev/articles/optimizing-third-party-javascript' },
        { title: 'Modern image formats used', detail: 'Images use WebP or AVIF for smaller file sizes.', source: 'Web.dev — https://web.dev/articles/serve-images-webp' },
        { title: 'CLS within target', detail: 'Cumulative Layout Shift is below 0.1 threshold.', source: 'Web Vitals — https://web.dev/articles/cls' },
        { title: 'LCP within target', detail: 'Largest Contentful Paint is below 2.5s threshold.', source: 'Web Vitals — https://web.dev/articles/lcp' }
      ]
    };

    var passedCategories = report.categories.filter(function(cat) { return cat.passed > 0 || cat.findings.length === 0; });
    if (passedCategories.length > 0) {
      html += '<div class="report-findings" style="margin-top:16px">';
      html += '<details id="passed-checks">';
      html += '<summary style="cursor:pointer;font-size:18px;font-weight:700;padding:8px 0">Passed Checks</summary>';

      passedCategories.forEach(function(cat) {
        var passCount = cat.passed || 0;
        if (cat.findings.length === 0) passCount = cat.checks || 1;
        if (passCount <= 0) return;

        var failedTitles = {};
        cat.findings.forEach(function(f) { failedTitles[f.title.substring(0, 30)] = true; });

        html += '<div class="report-finding-group">';
        html += '<h3>' + (categoryIcons[cat.icon] || '') + ' ' + cat.label + ' <span style="font-size:12px;color:var(--text-secondary);font-weight:400">(' + passCount + ' passed)</span></h3>';

        // Show check descriptions that weren't in the failures
        var descs = checkDescriptions[cat.icon] || [];
        var shown = 0;
        descs.forEach(function(desc) {
          // Skip if a similar title appears in failures
          var isFailure = cat.findings.some(function(f) {
            return f.title.toLowerCase().indexOf(desc.title.toLowerCase().substring(0, 15)) !== -1;
          });
          if (isFailure) return;
          if (shown >= passCount) return;

          html += '<div class="report-finding severity-pass" style="border-left:3px solid #16a34a">';
          html += '<div class="finding-header">';
          html += severityBadge('pass');
          html += '<span class="finding-title">' + escapeHtml(desc.title) + '</span>';
          html += '</div>';
          html += '<p class="finding-detail">' + escapeHtml(desc.detail) + '</p>';
          if (desc.source) {
            var sp = desc.source.split(' — ');
            html += '<div class="finding-source">';
            if (sp[1]) html += '<a href="' + escapeHtml(sp[1]) + '" target="_blank" rel="noopener">' + escapeHtml(sp[0]) + '</a>';
            else html += escapeHtml(sp[0]);
            html += '</div>';
          }
          html += '</div>';
          shown++;
        });

        // If we have more passes than descriptions, show the remaining count
        if (shown < passCount) {
          var remaining = passCount - shown;
          html += '<div class="report-finding severity-pass" style="border-left:3px solid #16a34a;opacity:0.7">';
          html += '<div class="finding-header">';
          html += severityBadge('pass');
          html += '<span class="finding-title">' + remaining + ' additional check' + (remaining > 1 ? 's' : '') + ' passed</span>';
          html += '</div>';
          html += '<p class="finding-detail" style="font-size:11px;color:var(--text-secondary)">These checks passed but don\'t have individual descriptions. The category score reflects all checks.</p>';
          html += '</div>';
        }

        html += '</div>';
      });

      html += '</details>';
      html += '</div>';
    }

    // --- Extracted data summary ---
    html += '<div class="report-summary">';
    html += '<h2>Design Token Summary</h2>';
    html += '<div class="summary-grid">';

    // Color palette — sorted by hue then lightness for visual grouping
    function sortByHue(colors) {
      return colors.slice().sort(function(a, b) {
        var ca = parseColorToHSL(a.value);
        var cb = parseColorToHSL(b.value);
        if (!ca || !cb) return 0;
        // Achromatic (grays) first, sorted dark → light
        if (ca.s < 8 && cb.s < 8) return ca.l - cb.l;
        if (ca.s < 8) return -1;
        if (cb.s < 8) return 1;
        // Chromatic: group by 30° hue band, then lightness within each band
        var hueA = Math.floor(ca.h / 30), hueB = Math.floor(cb.h / 30);
        if (hueA !== hueB) return hueA - hueB;
        return ca.l - cb.l;
      });
    }
    function parseColorToHSL(str) {
      if (!str) return null;
      // Parse rgb/rgba
      var m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (!m) return null;
      var r = parseInt(m[1]) / 255, g = parseInt(m[2]) / 255, b = parseInt(m[3]) / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
      }
      return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }
    html += '<div class="summary-section">';
    html += '<h4>Color Palette</h4>';
    html += '<div class="color-swatches">';
    function swatchTitle(c, label) {
      var t = c.value + '\n' + c.count + '× ' + label;
      if (c.sample) t += '\n' + c.sample;
      return t.replace(/"/g, '&quot;');
    }
    var bgColors = sortByHue((report.raw.colors.bgColors || []).slice(0, 12));
    bgColors.forEach(function(c) {
      html += '<div class="color-swatch" style="background:' + c.value + '" title="' + swatchTitle(c, 'background') + '"></div>';
    });
    html += '</div>';
    html += '<div class="color-swatches" style="margin-top:4px">';
    var textColors = sortByHue((report.raw.colors.textColors || []).slice(0, 12));
    textColors.forEach(function(c) {
      html += '<div class="color-swatch" style="background:' + c.value + '" title="' + swatchTitle(c, 'text') + '"></div>';
    });
    html += '</div>';
    html += '</div>';

    // Typography
    html += '<div class="summary-section">';
    html += '<h4>Typography</h4>';
    html += '<div class="summary-list">';
    html += '<div>Body: ' + escapeHtml(report.raw.typography.bodyFontSize) + ' / ' + escapeHtml(report.raw.typography.bodyLineHeight) + '</div>';
    html += '<div>Families: ' + escapeHtml((report.raw.typography.fontFamilies || []).join(', ')) + '</div>';
    var headings = report.raw.typography.headings || [];
    if (headings.length > 0) {
      html += '<div>Headings: ' + headings.map(function(h) { return h.tag + '=' + h.fontSize; }).join(', ') + '</div>';
    }
    html += '</div>';
    html += '</div>';

    // Spacing
    html += '<div class="summary-section">';
    html += '<h4>Spacing</h4>';
    html += '<div class="summary-list">';
    html += '<div>Max content width: ' + escapeHtml(report.raw.spacing.maxContentWidth) + '</div>';
    var topPaddings = (report.raw.spacing.paddings || []).slice(0, 5);
    html += '<div>Common paddings: ' + topPaddings.map(function(p) { return p.value; }).join(', ') + '</div>';
    html += '</div>';
    html += '</div>';

    // Structure
    html += '<div class="summary-section">';
    html += '<h4>Structure</h4>';
    html += '<div class="summary-list">';
    html += '<div>Elements: ' + report.raw.structure.totalElements + '</div>';
    html += '<div>Framework: ' + report.raw.structure.cssFramework + '</div>';
    html += '<div>Responsive: ' + (report.raw.structure.responsiveClasses ? 'Yes' : 'No') + '</div>';
    html += '<div>Dark mode: ' + (report.raw.structure.darkModeClasses ? 'Yes' : 'No') + '</div>';
    var ds = report.raw.structure.domStats;
    if (ds) {
      html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">';
      html += '<div style="font-weight:600;margin-bottom:4px">Element Distribution</div>';
      if (ds.topTags && ds.topTags.length > 0) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px">';
        ds.topTags.forEach(function(t) {
          html += '<span>&lt;' + t.tag + '&gt; <strong>' + t.count + '</strong></span>';
        });
        html += '</div>';
      }
      html += '<div style="font-size:12px;margin-top:4px;color:var(--text-secondary)">';
      html += 'Semantic: ' + ds.semanticCount + ' · Divs: ' + ds.divCount + ' (' + ds.divRatio + '%)';
      if (ds.displayNoneCount > 0) html += ' · Hidden (display:none): ' + ds.displayNoneCount;
      if (ds.ariaHiddenCount > 0) html += ' · aria-hidden: ' + ds.ariaHiddenCount;
      html += '</div>';
      html += '</div>';
    }
    var hpc = report.raw.layout && report.raw.layout.hiddenPanelCount;
    var hpi = report.raw.layout && report.raw.layout.hiddenPanelIssues;
    if (hpc > 0) {
      html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">';
      html += '<div style="font-weight:600;margin-bottom:4px">Hidden Panels Detected: ' + hpc + '</div>';
      if (hpi && hpi.length > 0) {
        html += '<div style="font-size:12px;color:var(--text-error,#ef4444)">' + hpi.length + ' panel(s) overflow when revealed:</div>';
        hpi.forEach(function(p) {
          var issueStr = p.issues.map(function(i) {
            return i.type === 'right-overflow' ? 'right +' + i.overflow + 'px'
              : i.type === 'left-overflow' ? 'left -' + i.overflow + 'px'
              : i.type === 'internal-overflow' ? 'internal +' + i.overflow + 'px'
              : i.type;
          }).join(', ');
          html += '<div style="font-size:12px;margin-top:2px"><code style="font-size:11px">' + p.selector + '</code> (' + p.role + '): ' + issueStr + '</div>';
        });
      } else {
        html += '<div style="font-size:12px;color:var(--text-secondary)">All panels fit within viewport when revealed</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // --- Methodology note ---
    html += '<div class="report-methodology">';
    html += '<h2>About this Report</h2>';
    html += '<p>This report checks <strong>computed styles</strong> against concrete, evidence-based rules from WCAG 2.2, Material Design, and typography research. ';
    html += 'It does not use AI — every finding is a deterministic comparison of measured values against documented thresholds.</p>';
    html += '<p><strong>What it catches well:</strong> contrast ratios, font sizes, touch targets, spacing grid adherence, semantic HTML, heading hierarchy — anything with a hard number.</p>';
    html += '<p><strong>What it cannot judge:</strong> visual balance, color harmony, whether a layout "feels right", design personality, or context-dependent choices (e.g., a 14px caption is fine but 14px body text is not).</p>';
    html += '<p>For a full design review with context-aware judgment, use this report as input for a <a href="index.html" style="color:var(--primary)">design consultation</a> — the findings give an AI or human reviewer concrete data to work from.</p>';
    html += '</div>';

    // Deep scan: dark mode test results (viewport data now shown via tabs above)
    if (report.raw.deepScan) {
      var ds = report.raw.deepScan;
      if (ds.darkMode && ds.darkMode.tested) {
        html += '<div class="report-summary" style="margin-top:16px">';
        html += '<h4 style="font-size:13px;margin-bottom:8px">Dark Mode Test</h4>';
        var dmFails = ds.darkMode.contrastFails;
        if (dmFails === 0) {
          html += '<p style="font-size:13px"><span style="color:#16a34a">No contrast failures in dark mode</span></p>';
        } else {
          html += '<p style="font-size:13px"><span style="color:#dc2626">' + dmFails + ' contrast failure(s) in dark mode (' + ds.darkMode.contrastTotal + ' pairs checked)</span></p>';
        }
        html += '</div>';
      }
    }

    return html;
  }

  // --- Markdown Export ---
  function renderMarkdown(report, options) {
    var opts = options || {};
    var skipImages = opts.skipImages || false;
    var severityFilter = opts.severityFilter || 'all';
    var _passSev = function(sev) {
      if (severityFilter === 'all') return true;
      if (severityFilter === 'error') return sev === 'error';
      if (severityFilter === 'warning') return sev === 'error' || sev === 'warning';
      return true;
    };
    var lines = [];
    lines.push('# Design Analysis Report');
    lines.push('');
    lines.push('**URL:** ' + (report.meta.url || 'Pasted HTML'));
    lines.push('**Date:** ' + new Date(report.meta.timestamp).toLocaleString());
    lines.push('**Viewport:** ' + report.meta.viewportWidth + '×' + report.meta.viewportHeight + 'px');
    lines.push('**Overall Score:** ' + report.overall + '/100 (' + report.grade + ' — ' + report.gradeLabel + ')');
    lines.push('');

    lines.push('## Category Scores');
    lines.push('');
    lines.push('| Category | Score | Weight | Issues |');
    lines.push('|----------|-------|--------|--------|');
    report.categories.forEach(function(cat) {
      var errors = cat.findings.filter(function(f) { return f.severity === 'error'; }).length;
      var warnings = cat.findings.filter(function(f) { return f.severity === 'warning'; }).length;
      var issues = [];
      if (errors > 0) issues.push(errors + ' error' + (errors > 1 ? 's' : ''));
      if (warnings > 0) issues.push(warnings + ' warning' + (warnings > 1 ? 's' : ''));
      lines.push('| ' + cat.label + ' | ' + cat.score + '/100 | ' + cat.weight + '% | ' + (issues.length > 0 ? issues.join(', ') : 'All passed') + ' |');
    });
    lines.push('');

    lines.push('## Detailed Findings');
    lines.push('');
    report.categories.forEach(function(cat) {
      var filtered = cat.findings.filter(function(f) { return _passSev(f.severity); });
      if (filtered.length === 0) return;
      lines.push('### ' + cat.label);
      lines.push('');
      filtered.forEach(function(f) {
        var icon = f.severity === 'error' ? '❌' : f.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push('- ' + icon + ' **[' + f.severity + ']** ' + f.title);
        if (f.detail) lines.push('  - ' + f.detail);
        lines.push('  - **Fix:** ' + f.fix);
        if (f.presetRef) lines.push('  - **Example:** ' + f.presetRef);
        if (f.source) {
          var sp = f.source.split(' — ');
          lines.push('  - **Source:** [' + sp[0] + '](' + (sp[1] || '') + ')');
        }
        lines.push('');
      });
    });

    lines.push('## Design Token Summary');
    lines.push('');
    lines.push('- **Body font:** ' + report.raw.typography.bodyFontSize + ' / ' + report.raw.typography.bodyLineHeight);
    lines.push('- **Font families:** ' + (report.raw.typography.fontFamilies || []).join(', '));
    var headings = report.raw.typography.headings || [];
    if (headings.length > 0) {
      lines.push('- **Headings:** ' + headings.map(function(h) { return h.tag + '=' + h.fontSize; }).join(', '));
    }
    lines.push('- **Max content width:** ' + report.raw.spacing.maxContentWidth);
    lines.push('- **Elements:** ' + report.raw.structure.totalElements);
    lines.push('- **Framework:** ' + report.raw.structure.cssFramework);
    lines.push('- **Responsive:** ' + (report.raw.structure.responsiveClasses ? 'Yes' : 'No'));
    lines.push('- **Dark mode:** ' + (report.raw.structure.darkModeClasses ? 'Yes' : 'No'));
    var mds = report.raw.structure.domStats;
    if (mds) {
      lines.push('- **Element distribution:** ' + (mds.topTags || []).map(function(t) { return '<' + t.tag + '> ×' + t.count; }).join(', '));
      lines.push('- **Semantic elements:** ' + mds.semanticCount + ' · Divs: ' + mds.divCount + ' (' + mds.divRatio + '%)');
      if (mds.displayNoneCount > 0) lines.push('- **Hidden (display:none):** ' + mds.displayNoneCount);
    }
    var mhpc = report.raw.layout && report.raw.layout.hiddenPanelCount;
    var mhpi = report.raw.layout && report.raw.layout.hiddenPanelIssues;
    if (mhpc > 0) {
      lines.push('- **Hidden panels:** ' + mhpc + ' detected' + (mhpi && mhpi.length > 0 ? ', ' + mhpi.length + ' overflow when revealed' : ', all fit viewport'));
    }
    lines.push('');

    // Deep scan: viewport results
    if (report.raw.deepScan && report.raw.deepScan.viewports) {
      var dsVps = report.raw.deepScan.viewports;
      var dsVpData = report.raw.deepScan.viewportData;
      lines.push('## Multi-Viewport Analysis');
      lines.push('');
      lines.push('Analyzed across ' + dsVps.length + ' viewports:');
      lines.push('');
      lines.push('| Viewport | Width | Contrast Fails | Touch Targets | Overflow |');
      lines.push('|----------|-------|---------------|---------------|----------|');
      dsVps.forEach(function(vp, vi) {
        lines.push('| ' + vp.label + ' | ' + vp.width + 'px | ' + (vp.contrastFails || 0) + ' | ' + (vp.touchTargets || 0) + ' | ' + (vp.overflow ? 'Yes' : 'No') + ' |');
      });
      lines.push('');
      // Per-viewport detailed findings
      if (dsVpData) {
        dsVpData.forEach(function(vd, vi) {
          if (!vd || !vd.data) return;
          var vpData = vd.data;
          var contrastFails = (vpData.colors && vpData.colors.contrastPairs || []).filter(function(p) { return !p.passes; });
          var touchIssues = vpData.interaction && vpData.interaction.touchTargets || [];
          if (contrastFails.length === 0 && touchIssues.length === 0) return;
          lines.push('### ' + vd.label + ' (' + vd.width + 'px)');
          lines.push('');
          if (contrastFails.length > 0) {
            lines.push('**Contrast failures (' + contrastFails.length + '):**');
            contrastFails.slice(0, 10).forEach(function(cf) {
              lines.push('- `' + (cf.selector || 'unknown') + '` — ratio ' + cf.ratio + ':1 (needs ' + (cf.neededRatio || 4.5) + ':1)');
            });
            if (contrastFails.length > 10) lines.push('- ...and ' + (contrastFails.length - 10) + ' more');
            lines.push('');
          }
          if (touchIssues.length > 0) {
            lines.push('**Touch target issues (' + touchIssues.length + '):**');
            touchIssues.slice(0, 10).forEach(function(tt) {
              lines.push('- `' + (tt.selector || tt.element || 'unknown') + '` — ' + tt.width + '×' + tt.height + 'px');
            });
            if (touchIssues.length > 10) lines.push('- ...and ' + (touchIssues.length - 10) + ' more');
            lines.push('');
          }
          // Pixel verify results
          if (vpData._contrastVerifyResults && vpData._contrastVerifyResults.length > 0) {
            var fp = vpData._contrastVerifyResults.filter(function(r) { return r.cssPasses && !r.pixelPasses && !r.demoted; });
            var dem = vpData._contrastVerifyResults.filter(function(r) { return !!r.demoted; });
            var ff = vpData._contrastVerifyResults.filter(function(r) { return !r.cssPasses && r.pixelPasses; });
            if (fp.length > 0 || ff.length > 0 || dem.length > 0) {
              lines.push('**Pixel verification:**');
              if (fp.length > 0) lines.push('- ' + fp.length + ' hidden failure(s) — pass CSS but fail in pixels');
              if (dem.length > 0) lines.push('- ' + dem.length + ' small-text failure(s) demoted to warning/info (anti-aliasing)');
              if (ff.length > 0) lines.push('- ' + ff.length + ' false positive(s) — fail CSS but pass in pixels');
              lines.push('');
            }
          }
        });
      }
    }

    // Deep scan: dark mode test results
    if (report.raw.deepScan && report.raw.deepScan.darkMode && report.raw.deepScan.darkMode.tested) {
      var dsDm = report.raw.deepScan.darkMode;
      lines.push('## Dark Mode Test');
      lines.push('');
      var dmFails = dsDm.contrastFails;
      if (dmFails === 0) {
        lines.push('No contrast failures in dark mode.');
      } else {
        lines.push(dmFails + ' contrast failure(s) in dark mode (' + dsDm.contrastTotal + ' pairs checked).');
      }
      lines.push('');
    }

    // Pixel contrast verification results (top-level, for single-URL reports)
    if (report._contrastVerifyResults && report._contrastVerifyResults.length > 0) {
      var pvr = report._contrastVerifyResults;
      var pvFp = pvr.filter(function(r) { return r.cssPasses && !r.pixelPasses && !r.demoted; });
      var pvDem = pvr.filter(function(r) { return !!r.demoted; });
      var pvFf = pvr.filter(function(r) { return !r.cssPasses && r.pixelPasses; });
      var pvOk = pvr.length - pvFp.length - pvDem.length - pvFf.length;
      lines.push('## Pixel Contrast Verification');
      lines.push('');
      lines.push('- **' + pvr.length + '** pairs checked');
      if (pvOk > 0) lines.push('- **' + pvOk + '** verified consistent');
      if (pvFp.length > 0) {
        lines.push('- **' + pvFp.length + '** hidden failure(s) — pass CSS but fail in pixels:');
        pvFp.forEach(function(r) {
          lines.push('  - `' + (r.selector || 'unknown') + '` CSS ' + r.cssRatio + ':1 → Pixel ' + r.pixelRatio + ':1');
        });
      }
      if (pvDem.length > 0) {
        lines.push('- **' + pvDem.length + '** small-text pixel failure(s) demoted (anti-aliasing makes pixel checks unreliable ≤16px):');
        pvDem.forEach(function(r) {
          lines.push('  - `' + (r.selector || 'unknown') + '` CSS ' + r.cssRatio + ':1 → Pixel ' + r.pixelRatio + ':1 — ' + (r.demoted === 'warning' ? 'warning' : 'info') + ': ' + (r.demotionReason || ''));
        });
      }
      if (pvFf.length > 0) {
        lines.push('- **' + pvFf.length + '** false positive(s) — fail CSS but pass in pixels:');
        pvFf.forEach(function(r) {
          lines.push('  - `' + (r.selector || 'unknown') + '` CSS ' + r.cssRatio + ':1 → Pixel ' + r.pixelRatio + ':1');
        });
      }
      lines.push('');
    }

    // Screenshots (as inline base64 images in markdown) — skip when copying for paste
    if (!skipImages && report.raw.screenshots && report.raw.screenshots.length > 0) {
      lines.push('## Page Screenshots');
      lines.push('');
      report.raw.screenshots.forEach(function(src, idx) {
        lines.push('### Screenshot ' + (idx + 1));
        lines.push('');
        lines.push('![Page screenshot ' + (idx + 1) + '](' + src + ')');
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('*Generated by [make-it-look-good](https://github.com/jdeworks/make-it-look-good) Design Analyzer — rule-based scoring, no AI.*');

    return lines.join('\n');
  }

  function renderGauge(score, grade) {
    var color = gradeColor(grade);
    var circumference = 2 * Math.PI * 54;
    var offset = circumference - (score / 100) * circumference;
    return '<svg width="120" height="120" viewBox="0 0 120 120">' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" stroke-width="8"/>' +
      '<circle cx="60" cy="60" r="54" fill="none" stroke="' + color + '" stroke-width="8" ' +
      'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" ' +
      'stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 0.8s ease"/>' +
      '<text x="60" y="55" text-anchor="middle" font-size="32" font-weight="700" fill="' + color + '">' + score + '</text>' +
      '<text x="60" y="75" text-anchor="middle" font-size="14" font-weight="600" fill="' + color + '">' + grade + '</text>' +
      '</svg>';
  }

  function renderProgressBar(score) {
    var color = scoreColor(score);
    return '<div class="progress-bar"><div class="progress-fill" style="width:' + score + '%;background:' + color + '"></div></div>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Visible log of the SPA/region exploration: which controls were clicked, which were
  // skipped (and why), notes, and whether discovery was capped.
  function renderSpaExplorationLog(prov) {
    var REASONS = {
      destructive: 'unsafe — destructive control', submit: 'form submit', input: 'form input',
      'in-form': 'inside a form', external: 'external link', 'click-error': 'click failed',
      'change-too-small': 'change too small', 'duplicate-content': 'duplicate content', 'empty-region': 'empty panel',
      'too-deep': 'nesting limit reached', 'nested-filter': 'filter/setting inside a sub-view'
    };
    var clicked = prov.clicked || [], skipped = prov.skipped || [], notes = prov.notes || [];
    var changedN = clicked.filter(function(c) { return c.changed; }).length;
    var h = '<details style="margin:0 0 20px;border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:0 14px">';
    h += '<summary style="cursor:pointer;user-select:none;font-weight:600;padding:12px 0">SPA exploration log';
    h += ' <span style="font-weight:400;color:var(--text-secondary);font-size:12px">— ' + clicked.length + ' control' + (clicked.length !== 1 ? 's' : '') + ' clicked, ' + changedN + ' changed a view; ' + skipped.length + ' skipped' + (prov.truncated ? ' · capped' : '') + '</span></summary>';
    h += '<div style="padding:4px 0 14px;font-size:12px;color:var(--text-secondary);line-height:1.7">';
    // Hierarchy count: pages > tabs (sub-views) > panels.
    var ct = prov.counts;
    if (ct) {
      var total = (ct.pages || 0) + (ct.subViews || 0) + (ct.panels || 0);
      var bits = [ (ct.pages || 0) + ' page' + (ct.pages !== 1 ? 's' : '') ];
      if (ct.subViews) bits.push(ct.subViews + ' sub-view' + (ct.subViews !== 1 ? 's' : ''));
      if (ct.panels) bits.push(ct.panels + ' panel' + (ct.panels !== 1 ? 's' : ''));
      h += '<div style="margin-bottom:8px;color:var(--text)"><strong>' + total + ' view' + (total !== 1 ? 's' : '') + '</strong> = ' + bits.join(' + ') + '</div>';
    }
    if (clicked.length) {
      h += '<div style="margin-bottom:6px"><strong style="color:var(--text)">Clicked:</strong> ' +
        clicked.map(function(c) { return escapeHtml(c.label || '?') + (c.changed ? ' <span style="color:#16a34a">✓</span>' : ' <span style="opacity:.5">(no change)</span>'); }).join(', ') + '</div>';
    }
    if (skipped.length) {
      var byReason = {};
      skipped.forEach(function(s) { (byReason[s.reason] = byReason[s.reason] || []).push(s.label || '?'); });
      h += '<div style="margin-bottom:6px"><strong style="color:var(--text)">Skipped:</strong><ul style="margin:4px 0 0;padding-left:18px">';
      Object.keys(byReason).forEach(function(r) {
        h += '<li>' + escapeHtml(REASONS[r] || r) + ' <span style="opacity:.7">(' + byReason[r].length + ')</span>: ' + byReason[r].slice(0, 6).map(escapeHtml).join(', ') + (byReason[r].length > 6 ? '…' : '') + '</li>';
      });
      h += '</ul></div>';
    }
    if (notes.length) h += '<div><strong style="color:var(--text)">Notes:</strong> ' + notes.map(escapeHtml).join('; ') + '</div>';
    if (prov.truncated) h += '<div style="color:#ca8a04;margin-top:4px">Discovery was capped (max views / time budget) — more states may exist.</div>';
    h += '</div></details>';
    return h;
  }

  function renderCrawlSummary(summary) {
    if (!summary || summary.pagesAnalyzed === 0) {
      return '<div class="crawl-summary"><p style="color:var(--text-secondary)">No pages analyzed yet.</p></div>';
    }

    var html = '<div class="crawl-summary">';

    // Overall stats
    html += '<h2>Site Overview</h2>';
    if (summary.viewportSummary) {
      html += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Analyzed across ' + summary.viewportSummary.viewportCount + ' viewports: ' + summary.viewportSummary.viewportLabels.map(function(l) { return escapeHtml(l); }).join(', ') + '</div>';
    }
    html += '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:24px">';
    html += '<div style="padding:12px 20px;border-radius:10px;background:var(--surface);border:1px solid var(--border);text-align:center">';
    html += '<div style="font-size:32px;font-weight:700;font-variant-numeric:tabular-nums">' + summary.averageScore + '</div>';
    html += '<div style="font-size:12px;color:var(--text-secondary)">Average Score</div></div>';
    html += '<div style="padding:12px 20px;border-radius:10px;background:var(--surface);border:1px solid var(--border);text-align:center">';
    html += '<div style="font-size:32px;font-weight:700">' + summary.pagesAnalyzed + '</div>';
    html += '<div style="font-size:12px;color:var(--text-secondary)">Pages Analyzed</div></div>';
    if (summary.viewportSummary) {
      html += '<div style="padding:12px 20px;border-radius:10px;background:var(--surface);border:1px solid var(--border);text-align:center">';
      html += '<div style="font-size:32px;font-weight:700">' + summary.viewportSummary.viewportCount + '</div>';
      html += '<div style="font-size:12px;color:var(--text-secondary)">Viewports</div></div>';
    }
    if (summary.pagesFailed > 0) {
      html += '<div style="padding:12px 20px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;text-align:center">';
      html += '<div style="font-size:32px;font-weight:700;color:#dc2626">' + summary.pagesFailed + '</div>';
      html += '<div style="font-size:12px;color:#dc2626">Failed</div></div>';
    }
    html += '</div>';

    // SPA exploration log — what the interaction-driven explorer clicked, skipped, and why.
    if (summary._spaProvenance) html += renderSpaExplorationLog(summary._spaProvenance);

    // Cross-page consistency — directly under Site Overview (pixel-verify summary
    // injects after this, before Page Scores).
    var cons = summary.consistency;
    if (cons) {
      var cColor = cons.overall >= 90 ? '#16a34a' : cons.overall >= 80 ? '#ca8a04' : cons.overall >= 70 ? '#ea580c' : '#dc2626';
      html += '<h3>Site Consistency</h3>';
      html += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">';
      html += '<div style="padding:12px 20px;border-radius:10px;background:var(--surface);border:1px solid var(--border);text-align:center;min-width:84px">';
      html += '<div style="font-size:32px;font-weight:700;color:' + cColor + ';font-variant-numeric:tabular-nums">' + cons.overall + '</div>';
      html += '<div style="font-size:12px;color:var(--text-secondary)">' + cons.grade + ' · cross-page</div></div>';
      html += '<div style="flex:1;font-size:12px;color:var(--text-secondary)">How consistently design tokens (fonts, type scale, spacing, color, radius) are applied across the ' + summary.pagesAnalyzed + ' analyzed pages. Independent of each page\'s own grade.</div>';
      html += '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-bottom:14px">';
      cons.subScores.forEach(function(s) {
        var barColor = s.score >= 90 ? '#16a34a' : s.score >= 80 ? '#ca8a04' : s.score >= 70 ? '#ea580c' : '#dc2626';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:var(--surface);border:1px solid var(--border)">';
        html += '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">' + escapeHtml(s.label) + '</div>';
        if (s.note) html += '<div style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(s.note) + '">' + escapeHtml(s.note) + '</div>';
        html += '</div>';
        html += '<div style="width:50px;height:6px;border-radius:3px;background:var(--border);overflow:hidden"><div style="height:100%;width:' + s.score + '%;background:' + barColor + ';border-radius:3px"></div></div>';
        html += '<div style="font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;width:28px;text-align:right">' + s.score + '</div>';
        html += '</div>';
      });
      html += '</div>';
      cons.findings.forEach(function(f) {
        html += '<div class="crawl-issue-group">';
        html += '<div class="issue-header"><div class="issue-title"><span class="severity-badge ' + f.severity + '">' + f.severity + '</span>' + escapeHtml(f.title) + '</div>';
        if (f.pages && f.pages.length) html += '<div class="issue-count">' + f.pages.length + ' page' + (f.pages.length > 1 ? 's' : '') + '</div>';
        html += '</div>';
        html += '<div class="issue-pages"><div>' + escapeHtml(f.detail) + '</div>';
        if (f.fix) html += '<div style="margin-top:4px;color:var(--text-secondary)">Fix: ' + escapeHtml(f.fix) + '</div>';
        if (f.locations && f.locations.length) {
          html += '<details class="finding-selectors" style="margin:6px 0 0;font-size:11px">';
          html += '<summary style="cursor:pointer;color:var(--text-secondary)">' + f.locations.length + ' location' + (f.locations.length !== 1 ? 's' : '') + '</summary>';
          html += '<div style="margin:4px 0 0;padding:8px;background:var(--bg-alt);border:1px solid var(--border);border-radius:4px;font-size:10px;line-height:1.8;max-height:300px;overflow:auto">';
          f.locations.forEach(function(l) {
            html += '<div style="padding:2px 0;border-bottom:1px solid var(--border)">';
            html += '<code style="color:var(--text-secondary)">' + escapeHtml(l.path) + '</code>';
            if (l.selector) html += ' <code style="color:var(--text-primary)">' + escapeHtml(l.selector) + '</code>';
            if (l.value) html += ' <strong>' + escapeHtml(l.value) + '</strong>';
            if (l.text) html += ' <span style="color:var(--text-secondary);font-style:italic">&quot;' + escapeHtml(String(l.text).substring(0, 40)) + (String(l.text).length > 40 ? '…' : '') + '&quot;</span>';
            html += '</div>';
          });
          html += '</div></details>';
        }
        html += '</div></div>';
      });
    }

    // Score grid
    html += '<h3 id="crawl-page-scores">Page Scores</h3>';
    html += '<div class="crawl-score-grid">';
    summary.scoreGrid.forEach(function(row) {
      var gradeClass = 'grade-' + row.grade.toLowerCase();
      html += '<div class="crawl-score-card">';
      html += '<div class="score ' + gradeClass + '">' + row.score + '</div>';
      html += '<div class="grade ' + gradeClass + '">' + row.grade + '</div>';
      html += '<div class="page-path" title="' + escapeHtml(row.url) + '">' + escapeHtml(row.path || '/') + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Cross-page issues
    var issues = summary.crossPageIssues;
    if (issues.length > 0) {
      html += '<h3>Issues Across Pages</h3>';
      issues.slice(0, 30).forEach(function(issue) {
        html += '<div class="crawl-issue-group">';
        html += '<div class="issue-header">';
        html += '<div class="issue-title"><span class="severity-badge ' + issue.severity + '">' + issue.severity + '</span>' + escapeHtml(issue.title) + '</div>';
        var uniquePages = []; issue.pages.forEach(function(p) { if (uniquePages.indexOf(p.url) === -1) uniquePages.push(p.url); });
        html += '<div class="issue-count">' + issue.count + '&times; on ' + uniquePages.length + ' page' + (uniquePages.length > 1 ? 's' : '') + '</div>';
        html += '</div>';
        html += '<div class="issue-pages">';
        issue.pages.forEach(function(p) {
          var path; try { path = new URL(p.url).pathname; } catch(e) { path = p.url; }
          html += '<div>' + escapeHtml(path) + (p.detail ? ' — ' + escapeHtml(p.detail.substring(0, 80)) : '') + '</div>';
        });
        html += '</div>';
        html += '</div>';
      });
    }

    // Category averages
    if (summary.categoryAverages.length > 0) {
      html += '<h3>Category Averages</h3>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">';
      summary.categoryAverages.forEach(function(cat) {
        var barColor = cat.avgScore >= 90 ? '#16a34a' : cat.avgScore >= 80 ? '#ca8a04' : cat.avgScore >= 70 ? '#ea580c' : '#dc2626';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:var(--surface);border:1px solid var(--border)">';
        html += '<div style="flex:1;font-size:13px;font-weight:500">' + escapeHtml(cat.label) + '</div>';
        html += '<div style="width:50px;height:6px;border-radius:3px;background:var(--border);overflow:hidden"><div style="height:100%;width:' + cat.avgScore + '%;background:' + barColor + ';border-radius:3px"></div></div>';
        html += '<div style="font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;width:28px;text-align:right">' + cat.avgScore + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Viewport breakdown (deep scan)
    var vs = summary.viewportSummary;
    if (vs) {
      html += '<h3>Viewport Breakdown</h3>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:16px">';
      vs.viewportStats.forEach(function(vp) {
        html += '<div style="padding:10px 14px;border-radius:8px;background:var(--surface);border:1px solid var(--border);font-size:13px">';
        html += '<div style="font-weight:600;margin-bottom:4px">' + escapeHtml(vp.label) + ' <span style="color:var(--text-secondary);font-weight:400">(' + vp.width + 'px)</span></div>';
        if (vp.contrastFails > 0) html += '<div style="color:#ef4444">Contrast fails: ' + vp.contrastFails + '</div>';
        if (vp.touchTargets > 0) html += '<div style="color:#f59e0b">Touch targets: ' + vp.touchTargets + '</div>';
        if (vp.overflowPages > 0) html += '<div style="color:#ef4444">Overflow on ' + vp.overflowPages + ' page' + (vp.overflowPages > 1 ? 's' : '') + '</div>';
        if (vp.contrastFails === 0 && vp.touchTargets === 0 && vp.overflowPages === 0) {
          html += '<div style="color:#16a34a">No issues found</div>';
        }
        html += '</div>';
      });
      html += '</div>';

      // Universal issues (appear in ALL viewports)
      if (vs.universalIssues.length > 0) {
        html += '<h3>Universal Issues <span style="font-size:12px;color:var(--text-secondary);font-weight:400">(all viewports)</span></h3>';
        html += '<div style="font-size:13px;line-height:1.6">';
        vs.universalIssues.slice(0, 10).forEach(function(issue) {
          html += '<div style="padding:6px 10px;margin-bottom:4px;border-radius:6px;background:var(--surface);border:1px solid var(--border)">';
          html += '<span style="font-weight:500">' + escapeHtml(issue.title) + '</span>';
          html += ' <span style="color:var(--text-secondary);font-size:12px">' + issue.pageCount + ' page' + (issue.pageCount > 1 ? 's' : '') + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      // Viewport-specific issues (only some viewports)
      if (vs.viewportSpecific.length > 0) {
        html += '<h3>Viewport-Specific Issues</h3>';
        html += '<div style="font-size:13px;line-height:1.6">';
        vs.viewportSpecific.slice(0, 10).forEach(function(issue) {
          html += '<div style="padding:6px 10px;margin-bottom:4px;border-radius:6px;background:var(--surface);border:1px solid var(--border)">';
          html += '<span style="font-weight:500">' + escapeHtml(issue.title) + '</span>';
          html += ' <span style="font-size:12px;padding:1px 6px;border-radius:4px;background:var(--bg-alt);color:var(--text-secondary)">' + issue.viewports.map(function(v) { return escapeHtml(v); }).join(', ') + ' only</span>';
          html += ' <span style="color:var(--text-secondary);font-size:12px">' + issue.pageCount + ' page' + (issue.pageCount > 1 ? 's' : '') + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }
    }

    html += '</div>';
    return html;
  }

  function renderCrawlPageTab(page, index, isActive) {
    var path;
    try { path = new URL(page.url).pathname; } catch(e) { path = page.url; }
    if (path === '/') path = '/ (home)';
    var _m = page.rawData && page.rawData.meta;
    var label, _indent = '';
    if (_m && _m._spaView && page.title) {
      // Breadcrumb title (e.g. "App › Live demo › Summary") → show the leaf, indent by depth
      // so the tab strip reads as a tree (pages > tabs > sub-tabs).
      var segs = page.title.split(' › ');
      label = (segs[segs.length - 1] || page.title).substring(0, 25);
      var _d = _m._spaDepth || 0;
      if (_d >= 2) _indent = '└' + (_d > 2 ? '─'.repeat(_d - 2) : '') + ' ';
    } else {
      label = page.title ? page.title.substring(0, 25) : path;
    }

    // SPA region/view provenance in the tab tooltip (how this state was reached).
    var _tip = page.url;
    if (_m && _m._spaView) {
      _tip += (_m._spaTrigger ? '\nvia ' + _m._spaTrigger : '') + (_m._spaRegionAnchor ? ' → ' + _m._spaRegionAnchor : '') + (_m._spaKind === 'region' ? '\n(mid-page panel — scoped analysis)' : '');
    }

    var dotClass = 'pending';
    if (page.status === 'done' && page.reportData) {
      dotClass = 'grade-' + page.reportData.grade.toLowerCase();
    } else if (page.status === 'error') {
      dotClass = 'error';
    }

    return '<button class="crawl-page-tab' + (isActive ? ' active' : '') + '" data-crawl-page="' + index + '" title="' + escapeHtml(_tip) + '">' +
      '<span class="score-dot ' + dotClass + '"></span>' +
      (_indent ? '<span style="opacity:.5">' + escapeHtml(_indent) + '</span>' : '') +
      escapeHtml(label) +
      (page.status === 'done' && page.reportData ? ' <span style="font-size:11px;color:var(--text-secondary)">' + page.reportData.overall + '</span>' : '') +
      '</button>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LLM instruction pack — a structured, agent-oriented bundle of the analysis.
  // Returns a manifest { folder, files:[{path,text}], assets:[{path,b64}] } that
  // analyzer.js zips with JSZip. Unlike the flat "Copy for LLM" markdown, this
  // splits findings into per-category docs, ships an agent prompt + guidelines,
  // and surfaces the per-finding selectors/bboxes that renderMarkdown drops.
  // ─────────────────────────────────────────────────────────────────────────
  function _slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 48) || 'item';
  }
  function _sevIcon(sev) { return sev === 'error' ? '❌' : sev === 'warning' ? '⚠️' : sev === 'pass' ? '✅' : 'ℹ️'; }
  function _passSevFn(filter) {
    // 'pass' findings are never actionable instructions — exclude them from every filter.
    return function(sev) {
      if (sev === 'pass') return false;
      if (filter === 'error') return sev === 'error';
      if (filter === 'warning') return sev === 'error' || sev === 'warning';
      return true; // 'all' = errors + warnings + info
    };
  }
  // Collect unique, non-empty CSS selectors from a finding's locator.
  function _findingSelectors(f) {
    var loc = f.locator; if (!loc) return [];
    var out = [];
    if (loc.selector) out.push(loc.selector);
    (loc.selectors || []).forEach(function(s) { if (s) out.push(s); });
    var seen = {}, uniq = [];
    out.forEach(function(s) { if (!seen[s]) { seen[s] = 1; uniq.push(s); } });
    return uniq.slice(0, 12);
  }
  function _findingBboxCount(f) {
    var loc = f.locator; if (!loc || !loc.bboxes) return 0;
    return loc.bboxes.length;
  }
  function _sevRank(sev) { return sev === 'error' ? 0 : sev === 'warning' ? 1 : sev === 'info' ? 2 : 3; }
  // Stable identity for deduping a finding across viewports/pages. Prefer the
  // element's primary selector (groups the same element across units); else fall
  // back to a number-stripped title template (merges "contrast 3.2:1" and "4:1").
  function _normTitle(t) { return String(t || '').replace(/\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ').trim(); }
  function _findingDedupKey(catLabel, f) {
    var primarySel = (f.locator && f.locator.selector) ? f.locator.selector : null;
    return catLabel + (primarySel ? ' :: sel :: ' + primarySel : ' :: ttl :: ' + _normTitle(f.title));
  }
  // Markdown lines for a finding's selector block (or affected-element count).
  function _selectorBlockLines(f) {
    var sels = _findingSelectors(f);
    if (sels.length) {
      var out = ['**Selector(s):**'];
      sels.forEach(function(s) { out.push('- `' + s + '`'); });
      var extra = _findingBboxCount(f) - sels.length;
      if (extra > 0) out.push('- _…and ' + extra + ' more matched element(s)_');
      return out;
    }
    var bc = _findingBboxCount(f);
    return bc > 0 ? ['**Affected elements:** ' + bc + ' location(s).'] : [];
  }
  function _sourceMd(f) {
    if (!f.source) return null;
    var sp = String(f.source).split(' — ');
    return '**Source:** ' + (sp[1] ? '[' + sp[0] + '](' + sp[1] + ')' : sp[0]);
  }
  // Concrete, reusable design-token snapshot (shared by single + multi packs).
  function _tokenLinesFor(raw) {
    var L = [];
    var ty = raw.typography || {}, sp = raw.spacing || {}, st = raw.structure || {};
    L.push('- **Body type:** ' + (ty.bodyFontSize || '?') + ' / line-height ' + (ty.bodyLineHeight || '?'));
    if (ty.fontFamilies && ty.fontFamilies.length) L.push('- **Font families:** ' + ty.fontFamilies.join(', '));
    if (ty.headings && ty.headings.length) {
      var _hseen = {}, _hscale = [];
      ty.headings.forEach(function(h) { var k = h.tag + ' ' + h.fontSize; if (!_hseen[k]) { _hseen[k] = 1; _hscale.push(k); } });
      L.push('- **Heading scale:** ' + _hscale.join(' · '));
    }
    if (ty.fontWeights && ty.fontWeights.length) L.push('- **Weights in use:** ' + ty.fontWeights.map(function(w) { return w.value; }).filter(Boolean).join(', '));
    if (sp.maxContentWidth) L.push('- **Max content width:** ' + sp.maxContentWidth);
    var topPad = (sp.paddings || [])[0]; if (topPad) L.push('- **Common padding:** ' + topPad.value);
    var topGap = (sp.gaps || [])[0]; if (topGap) L.push('- **Common gap:** ' + topGap.value);
    var textC = (raw.colors && raw.colors.textColors || []).map(function(c) { return c.value; }).filter(Boolean).slice(0, 6);
    var bgC = (raw.colors && raw.colors.bgColors || []).map(function(c) { return c.value; }).filter(Boolean).slice(0, 6);
    if (textC.length) L.push('- **Text colors:** ' + textC.join(', '));
    if (bgC.length) L.push('- **Background colors:** ' + bgC.join(', '));
    L.push('- **CSS framework:** ' + (st.cssFramework || 'unknown'));
    L.push('- **Responsive utilities:** ' + (st.responsiveClasses ? 'yes' : 'no') + ' · **Dark mode:** ' + (st.darkModeClasses ? 'yes' : 'no'));
    if (st.totalElements) L.push('- **DOM size:** ' + st.totalElements + ' elements');
    return L;
  }
  // General design principles (shared). Responsive/dark-mode lines are conditional.
  function _generalPrincipleLines(raw) {
    var L = [];
    L.push('- **Contrast:** body/normal text needs a contrast ratio ≥ 4.5:1; large text (≥ 24px, or ≥ 19px bold) needs ≥ 3:1. UI/graphical boundaries need ≥ 3:1. (WCAG 2.2 §1.4.3 / §1.4.11)');
    L.push('- **Touch targets:** interactive controls should be ≥ 44×44px with adequate spacing. (WCAG 2.2 §2.5.8, Apple HIG)');
    L.push('- **Type:** keep a consistent modular scale; body ≥ 16px; line-height ~1.4–1.6 for body; line length ~45–75 characters.');
    L.push('- **Spacing:** use a consistent spacing rhythm (e.g. 4/8px base); align elements to a shared grid; avoid arbitrary one-off margins.');
    L.push('- **Hierarchy:** one h1 per page; never skip heading levels; use size, weight, and spacing to signal importance.');
    L.push('- **Semantics & a11y:** prefer landmark elements (header/nav/main/footer), label all form controls, give every meaningful image alt text, ensure visible focus indicators.');
    L.push('- **Consistency:** limit the palette and type set; reuse component patterns; keep interaction (hover/focus/active) states consistent.');
    if (raw.structure && raw.structure.responsiveClasses) L.push('- **Responsive:** the page uses responsive utilities — verify fixes hold across breakpoints, not just the analyzed width.');
    if (raw.structure && raw.structure.darkModeClasses) L.push('- **Dark mode:** the page supports dark mode — re-check contrast and color choices in both themes.');
    return L;
  }

  function buildLlmPack(report, options) {
    var opts = options || {};
    var severityFilter = opts.severityFilter || 'all';
    var passSev = _passSevFn(severityFilter);
    var meta = report.meta || {};
    var raw = report.raw || {};
    var profile = raw.profile || report.profile || 'general';
    var host = 'site';
    try { host = new URL(meta.url).hostname.replace(/^www\./, ''); } catch (e) { if (meta.url) host = _slug(meta.url); }
    var folder = 'milg-llm-pack-' + _slug(host);
    var files = [];
    var assets = [];

    // Per-category counts (independent of the severity filter, for the index).
    var cats = (report.categories || []).map(function(cat, i) {
      var fnd = cat.findings || [];
      return {
        idx: i,
        label: cat.label,
        score: cat.score,
        weight: cat.weight,
        findings: fnd,
        errors: fnd.filter(function(f) { return f.severity === 'error'; }).length,
        warnings: fnd.filter(function(f) { return f.severity === 'warning'; }).length,
        infos: fnd.filter(function(f) { return f.severity === 'info'; }).length,
        slug: _slug(cat.label)
      };
    });
    // Stable doc number per category (1-based, in report order).
    cats.forEach(function(c, i) { c.docNum = String(i + 1).padStart(2, '0'); c.docPath = 'findings/' + c.docNum + '-' + c.slug + '.md'; });
    // Categories with nothing actionable at the current filter are pruned from
    // the pack — no placeholder docs, the zip only carries real findings.
    cats.forEach(function(c) {
      c.shown = (c.findings || []).filter(function(f) { return passSev(f.severity); });
      c.included = c.shown.some(function(f) { return f.severity !== 'pass'; });
    });

    var tokenLines = function() { return _tokenLinesFor(raw); };

    // ---- README.md (overview + index) -------------------------------------
    var R = [];
    R.push('# Design analysis pack — ' + host);
    R.push('');
    R.push('> Generated by the [make-it-look-good](https://github.com/jdeworks/make-it-look-good) Design Analyzer (rule-based scoring, no AI). This pack is meant to be handed to a coding/design agent — start with **AGENT_PROMPT.md**.');
    R.push('');
    R.push('- **URL:** ' + (meta.url || 'n/a'));
    if (meta.title) R.push('- **Title:** ' + meta.title);
    R.push('- **Analyzed:** ' + (meta.timestamp ? new Date(meta.timestamp).toLocaleString() : 'n/a'));
    R.push('- **Viewport:** ' + (meta.viewportWidth || '?') + '×' + (meta.viewportHeight || '?') + 'px');
    R.push('- **Audience profile:** ' + profile);
    R.push('- **Overall score:** ' + report.overall + '/100 (' + report.grade + ' — ' + report.gradeLabel + ')');
    R.push('- **Severity filter for this pack:** ' + severityFilter);
    R.push('');
    R.push('## Contents');
    R.push('');
    R.push('| File | Purpose |');
    R.push('|------|---------|');
    R.push('| `AGENT_PROMPT.md` | Base prompt — give this to the agent first |');
    R.push('| `GUIDELINES.md` | Design tokens to honor + priorities from this analysis + general principles |');
    R.push('| `findings/00-index.md` | Index of every finding, grouped by category |');
    R.push('| `findings/NN-<category>.md` | One document per category, each finding with fix + selectors |');
    if (assets.length || (raw.screenshotClean || (raw.screenshots && raw.screenshots[0]))) R.push('| `assets/clean-screenshot.png` | Full-page clean screenshot for visual context |');
    R.push('');
    R.push('## Category scores');
    R.push('');
    R.push('| Category | Score | Weight | Issues | Document |');
    R.push('|----------|-------|--------|--------|----------|');
    cats.forEach(function(c) {
      var iss = [];
      if (c.errors) iss.push(c.errors + ' error' + (c.errors > 1 ? 's' : ''));
      if (c.warnings) iss.push(c.warnings + ' warning' + (c.warnings > 1 ? 's' : ''));
      R.push('| ' + c.label + ' | ' + c.score + '/100 | ' + c.weight + '% | ' + (iss.length ? iss.join(', ') : 'all passed') + ' | ' + (c.included ? '`' + c.docPath + '`' : '—') + ' |');
    });
    R.push('');
    R.push('## Design tokens (snapshot)');
    R.push('');
    tokenLines().forEach(function(l) { R.push(l); });
    R.push('');
    files.push({ path: 'README.md', text: R.join('\n') });

    // ---- AGENT_PROMPT.md --------------------------------------------------
    var totalErr = cats.reduce(function(a, c) { return a + c.errors; }, 0);
    var totalWarn = cats.reduce(function(a, c) { return a + c.warnings; }, 0);
    var _fwRaw = raw.structure && raw.structure.cssFramework;
    var fw = (_fwRaw && _fwRaw !== 'unknown') ? _fwRaw : 'the existing CSS framework';
    var A = [];
    A.push('# Agent prompt');
    A.push('');
    A.push('You are a senior frontend / UX engineer. You have been given a design-analysis pack for **' + (meta.url || host) + '**, produced by a rule-based analyzer (deterministic checks against WCAG and common design heuristics — there is no AI judgement in the findings, so each one is a concrete, measurable issue).');
    A.push('');
    A.push('## Objective');
    A.push('');
    A.push('Raise the design quality of this page from its current **' + report.overall + '/100 (' + report.grade + ')** by resolving the findings in this pack, without changing the page\'s content, copy, or intent, and while staying consistent with its existing design tokens and ' + fw + '.');
    A.push('');
    A.push('## What you have');
    A.push('');
    A.push('- `GUIDELINES.md` — the design tokens you must reuse, the priorities from this analysis, and the general principles to apply. **Read this before editing.**');
    A.push('- `findings/00-index.md` — every finding, grouped by category, with severity counts.');
    A.push('- `findings/NN-<category>.md` — one document per category. Each finding has: a severity, a description, a recommended **Fix**, the **Selector(s)** the issue was found on, and (where relevant) a source spec link.');
    if (raw.screenshotClean || (raw.screenshots && raw.screenshots[0])) A.push('- `assets/clean-screenshot.png` — a full-page screenshot of the analyzed state for visual reference.');
    A.push('');
    A.push('## How to work');
    A.push('');
    A.push('1. Read `GUIDELINES.md` so every change you make is consistent with the existing tokens and the general principles.');
    A.push('2. Work category-by-category, **errors first, then warnings, then info** (this pack contains ' + totalErr + ' error(s) and ' + totalWarn + ' warning(s)).');
    A.push('3. For each finding: locate the element(s) using the listed **Selector(s)**, apply the recommended **Fix**, and prefer the design tokens in `GUIDELINES.md` over inventing new values.');
    A.push('4. Do not regress passing checks. Keep semantic HTML, responsive behavior, and (if present) dark-mode support intact.');
    A.push('5. When a fix is ambiguous, choose the option that best satisfies the cited spec (e.g. contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text; touch targets ≥ 44×44px).');
    A.push('');
    A.push('## Definition of done');
    A.push('');
    A.push('- Every error- and warning-level finding is addressed or has a documented reason it cannot be.');
    A.push('- Changes reuse existing design tokens; no new ad-hoc colors/sizes unless a finding requires it.');
    A.push('- A short summary maps each change back to the finding it resolves (category + title).');
    A.push('');
    files.push({ path: 'AGENT_PROMPT.md', text: A.join('\n') });

    // ---- GUIDELINES.md ----------------------------------------------------
    var G = [];
    G.push('# Guidelines');
    G.push('');
    G.push('Derived from the analysis of **' + (meta.url || host) + '** plus general design/accessibility best practice. Apply these whenever you resolve a finding.');
    G.push('');
    G.push('## 1. Design tokens to honor');
    G.push('');
    G.push('Reuse these existing values instead of introducing new ones:');
    G.push('');
    tokenLines().forEach(function(l) { G.push(l); });
    G.push('');
    G.push('## 2. Priorities from this analysis');
    G.push('');
    var prio = cats.slice().filter(function(c) { return c.errors + c.warnings > 0; })
      .sort(function(a, b) { return (b.errors * 10 + b.warnings) - (a.errors * 10 + a.warnings); });
    if (prio.length === 0) {
      G.push('No error- or warning-level issues were found. Focus on the info-level suggestions in the per-category documents.');
    } else {
      prio.forEach(function(c) {
        var bits = [];
        if (c.errors) bits.push(c.errors + ' error' + (c.errors > 1 ? 's' : ''));
        if (c.warnings) bits.push(c.warnings + ' warning' + (c.warnings > 1 ? 's' : ''));
        G.push('- **' + c.label + '** (' + c.score + '/100, ' + bits.join(' + ') + ')' + (c.included ? ' → see `' + c.docPath + '`.' : ' — below the current severity filter.'));
      });
    }
    G.push('');
    G.push('## 3. General principles');
    G.push('');
    _generalPrincipleLines(raw).forEach(function(l) { G.push(l); });
    G.push('');
    files.push({ path: 'GUIDELINES.md', text: G.join('\n') });

    // ---- findings/00-index.md --------------------------------------------
    var IX = [];
    IX.push('# Findings index');
    IX.push('');
    IX.push('Severity filter applied to this pack: **' + severityFilter + '**.');
    IX.push('');
    IX.push('| # | Category | Score | Errors | Warnings | Info | Document |');
    IX.push('|---|----------|-------|--------|----------|------|----------|');
    cats.forEach(function(c) {
      IX.push('| ' + c.docNum + ' | ' + c.label + ' | ' + c.score + '/100 | ' + c.errors + ' | ' + c.warnings + ' | ' + c.infos + ' | ' + (c.included ? '`' + c.docNum + '-' + c.slug + '.md`' : '—') + ' |');
    });
    IX.push('');
    files.push({ path: 'findings/00-index.md', text: IX.join('\n') });

    // ---- findings/NN-<category>.md (pruned: only categories with findings) --
    cats.forEach(function(c) {
      if (!c.included) return;
      var D = [];
      D.push('# ' + c.label);
      D.push('');
      D.push('**Score:** ' + c.score + '/100 · **Weight:** ' + c.weight + '% · **Errors:** ' + c.errors + ' · **Warnings:** ' + c.warnings + ' · **Info:** ' + c.infos);
      D.push('');
      var shown = c.shown;
      {
        // error → warning → info → pass
        var order = { error: 0, warning: 1, info: 2, pass: 3 };
        shown.slice().sort(function(a, b) { return (order[a.severity] || 9) - (order[b.severity] || 9); }).forEach(function(f) {
          D.push('## ' + _sevIcon(f.severity) + ' [' + f.severity + '] ' + f.title);
          D.push('');
          if (f.detail) { D.push(f.detail); D.push(''); }
          if (f.fix) { D.push('**Fix:** ' + f.fix); D.push(''); }
          if (f.presetRef) { D.push('**Example:** ' + f.presetRef); D.push(''); }
          var selLines = _selectorBlockLines(f);
          if (selLines.length) { selLines.forEach(function(l) { D.push(l); }); D.push(''); }
          var src = _sourceMd(f);
          if (src) { D.push(src); D.push(''); }
        });
      }
      files.push({ path: c.docPath, text: D.join('\n') });
    });

    // ---- assets/clean-screenshot.png -------------------------------------
    var shot = raw.screenshotClean || (raw.screenshots && raw.screenshots[0]) || null;
    if (shot && /^data:image\//.test(shot)) {
      var comma = shot.indexOf(',');
      var b64 = comma >= 0 ? shot.substring(comma + 1) : '';
      var ext = /^data:image\/jpe?g/.test(shot) ? 'jpg' : /^data:image\/webp/.test(shot) ? 'webp' : 'png';
      if (b64) assets.push({ path: 'assets/clean-screenshot.' + ext, b64: b64 });
    }

    // ---- THIRD_PARTY.md (JSZip attribution) ------------------------------
    var T = [];
    T.push('# Third-party software');
    T.push('');
    T.push('This .zip was assembled in the browser with **JSZip**.');
    T.push('');
    T.push('JSZip — © Stuart Knightley and JSZip contributors. Dual-licensed under the MIT license or GPLv3; used here under the **MIT license**.');
    T.push('Project: https://github.com/Stuk/jszip — License: https://github.com/Stuk/jszip/blob/main/LICENSE.markdown');
    T.push('');
    files.push({ path: 'THIRD_PARTY.md', text: T.join('\n') });

    return { folder: folder, files: files, assets: assets };
  }

  function _thirdPartyLines() {
    return ['# Third-party software', '',
      'This .zip was assembled in the browser with **JSZip**.', '',
      'JSZip — © Stuart Knightley and JSZip contributors. Dual-licensed under the MIT license or GPLv3; used here under the **MIT license**.',
      'Project: https://github.com/Stuk/jszip — License: https://github.com/Stuk/jszip/blob/main/LICENSE.markdown', ''];
  }

  // Multi-unit LLM pack — deep-scan viewports, crawl pages, or the full page×viewport
  // matrix. input.units = [{ id, label, report }], each report a FULL scored report
  // (the caller re-scores every viewport/page). Findings are deduped across units via
  // _findingDedupKey (selector → normalized title) and annotated "affects N/M", so the
  // broadest "worst offenders" sort to the top. Also emits per-unit docs.
  function buildLlmPackMulti(input) {
    var opts = input || {};
    var severityFilter = opts.severityFilter || 'all';
    var passSev = _passSevFn(severityFilter);
    var units = (opts.units || []).filter(function(u) { return u && u.report; });
    var M = units.length;
    var mode = opts.mode || 'viewport';                       // 'viewport' | 'crawl' | 'matrix'
    var unitWord = mode === 'crawl' ? 'page' : mode === 'matrix' ? 'page×viewport combination' : 'viewport';
    var unitWordShort = mode === 'crawl' ? 'page' : mode === 'matrix' ? 'combo' : 'viewport';
    var primary = opts.primaryReport || (units[0] && units[0].report) || {};
    var raw = primary.raw || {};
    var meta = primary.meta || {};
    var profile = raw.profile || primary.profile || 'general';
    var _fwRaw = raw.structure && raw.structure.cssFramework;
    var fw = (_fwRaw && _fwRaw !== 'unknown') ? _fwRaw : 'the existing CSS framework';
    var host = opts.host || 'site';
    if (!opts.host) { try { host = new URL(meta.url).hostname.replace(/^www\./, ''); } catch (e) {} }
    var folder = 'milg-llm-pack-' + _slug(host) + (mode === 'crawl' ? '-site' : mode === 'matrix' ? '-site-viewports' : '-viewports');
    var dims = opts.dims || {};
    var files = [], assets = [];
    var shot = raw.screenshotClean || (raw.screenshots && raw.screenshots[0]) || null;
    var hasShot = !!(shot && /^data:image\//.test(shot));
    // Unique per-unit doc slug (labels can collide, e.g. same page title twice).
    var _slugCount = {};
    units.forEach(function(u) {
      var base = _slug(u.label) || 'unit', s = base, n = 1;
      while (_slugCount[s]) { s = base + '-' + (n++); }
      _slugCount[s] = 1; u._docSlug = s;
    });

    // ---- Aggregate findings across units → per category, deduped groups ----
    var catOrder = [], catMap = {};
    function ensureCat(label, weight, score) {
      if (!catMap[label]) { catMap[label] = { label: label, weight: weight, score: score, groups: {} }; catOrder.push(label); }
      return catMap[label];
    }
    (primary.categories || []).forEach(function(c) { ensureCat(c.label, c.weight, c.score); });
    units.forEach(function(u) {
      (u.report.categories || []).forEach(function(c) {
        var cm = ensureCat(c.label, c.weight, c.score);
        (c.findings || []).forEach(function(f) {
          if (!passSev(f.severity)) return;
          var key = _findingDedupKey(c.label, f);
          var g = cm.groups[key];
          if (!g) { g = cm.groups[key] = { title: f.title, fix: f.fix, presetRef: f.presetRef, source: f.source, severity: f.severity, ref: f, units: {}, occ: [] }; }
          if (_sevRank(f.severity) < _sevRank(g.severity)) { g.severity = f.severity; g.title = f.title; g.fix = f.fix; g.source = f.source; g.presetRef = f.presetRef; g.ref = f; }
          g.units[u.id] = u.label;
          g.occ.push({ label: u.label, detail: f.detail || '', title: f.title });
        });
      });
    });
    var cats = catOrder.map(function(label, i) {
      var cm = catMap[label];
      var groups = Object.keys(cm.groups).map(function(k) { var g = cm.groups[k]; g.n = Object.keys(g.units).length; return g; });
      groups.sort(function(a, b) { return (b.n - a.n) || (_sevRank(a.severity) - _sevRank(b.severity)) || (b.occ.length - a.occ.length); });
      return { label: label, weight: cm.weight, slug: _slug(label), docNum: String(i + 1).padStart(2, '0'), groups: groups,
        errors: groups.filter(function(g) { return g.severity === 'error'; }).length,
        warnings: groups.filter(function(g) { return g.severity === 'warning'; }).length,
        infos: groups.filter(function(g) { return g.severity === 'info'; }).length };
    });
    cats.forEach(function(c) { c.docPath = 'findings/' + c.docNum + '-' + c.slug + '.md'; c.included = c.groups.length > 0; });
    // Units with nothing actionable at the filter get no doc — the pack only
    // carries real findings.
    units.forEach(function(u) {
      u._hasFindings = (u.report.categories || []).some(function(c) {
        return (c.findings || []).some(function(f) { return passSev(f.severity) && f.severity !== 'pass'; });
      });
    });
    var allGroups = [];
    cats.forEach(function(c) { c.groups.forEach(function(g) { allGroups.push({ cat: c, g: g }); }); });
    allGroups.sort(function(a, b) { return (b.g.n - a.g.n) || (_sevRank(a.g.severity) - _sevRank(b.g.severity)) || (b.g.occ.length - a.g.occ.length); });

    function scopeBadge(g) {
      if (g.n >= M) return 'all ' + M + ' ' + unitWordShort + (M !== 1 ? 's' : '');
      var labels = Object.keys(g.units).map(function(id) { return g.units[id]; });
      return g.n + '/' + M + ' ' + unitWordShort + (M !== 1 ? 's' : '') + ' — ' + labels.join(', ');
    }
    function breakdownLines(g) {
      var seen = {}, rows = [];
      g.occ.forEach(function(o) {
        var txt = o.detail || o.title;
        var line = '- ' + o.label + (txt ? ': ' + txt : '');
        if (!seen[line]) { seen[line] = 1; rows.push(line); }
      });
      return rows;
    }
    var scopeSentence = mode === 'crawl' ? (M + ' page' + (M !== 1 ? 's' : ''))
      : mode === 'matrix' ? ((dims.pages || '?') + ' pages × ' + (dims.viewports || '?') + ' viewports = ' + M + ' scored combinations')
      : (M + ' viewport' + (M !== 1 ? 's' : ''));

    // ---- README.md --------------------------------------------------------
    var R = [];
    R.push('# Design analysis pack — ' + host + (mode === 'crawl' ? ' (site crawl)' : mode === 'matrix' ? ' (site × viewports)' : ' (multi-viewport)'));
    R.push('');
    R.push('> Generated by the [make-it-look-good](https://github.com/jdeworks/make-it-look-good) Design Analyzer (rule-based scoring, no AI). Hand this to a coding/design agent — start with **AGENT_PROMPT.md**.');
    R.push('');
    R.push('- **' + (mode === 'crawl' ? 'Start URL' : 'URL') + ':** ' + (opts.startUrl || meta.url || 'n/a'));
    R.push('- **Checked across:** ' + scopeSentence + ' (each scored independently)');
    R.push('- **Audience profile:** ' + profile);
    if (opts.aggregateScore != null) R.push('- **Average score:** ' + opts.aggregateScore + '/100');
    R.push('- **Severity filter for this pack:** ' + severityFilter);
    R.push('- **Distinct issues after dedup:** ' + allGroups.length);
    R.push('');
    R.push('## Contents');
    R.push('');
    R.push('| File | Purpose |');
    R.push('|------|---------|');
    R.push('| `AGENT_PROMPT.md` | Base prompt — give this to the agent first |');
    R.push('| `GUIDELINES.md` | Tokens to honor + cross-cutting priorities + how to solve by scope |');
    R.push('| `findings/00-index.md` | Every distinct issue, worst-offenders first, with "affects N/M" |');
    R.push('| `findings/NN-<category>.md` | Per category: each issue + scope badge + per-' + unitWordShort + ' breakdown + fix |');
    R.push('| `units/<' + unitWordShort + '>.md` | Per-' + unitWordShort + ' findings (the individual ' + unitWord + ' view) |');
    if (hasShot) R.push('| `assets/clean-screenshot.*` | Clean full-page screenshot for visual context |');
    R.push('');
    R.push('## ' + (mode === 'crawl' ? 'Pages' : mode === 'matrix' ? 'Units (page × viewport)' : 'Viewports') + ' analyzed');
    R.push('');
    R.push('| Unit | Score | Doc |');
    R.push('|------|-------|-----|');
    units.forEach(function(u) { R.push('| ' + u.label + ' | ' + u.report.overall + '/100 (' + u.report.grade + ') | ' + (u._hasFindings ? '`units/' + u._docSlug + '.md`' : '— (no findings at this filter)') + ' |'); });
    R.push('');
    files.push({ path: 'README.md', text: R.join('\n') });

    // ---- AGENT_PROMPT.md --------------------------------------------------
    var A = [];
    A.push('# Agent prompt');
    A.push('');
    A.push('You are a senior frontend / UX engineer. You have a design-analysis pack for **' + (opts.startUrl || meta.url || host) + '**, produced by a rule-based analyzer (deterministic WCAG / design-heuristic checks — no AI judgement, so every finding is a concrete, measurable issue).');
    A.push('');
    A.push('## What was checked');
    A.push('');
    A.push('The design was analyzed across **' + scopeSentence + '**, and **each ' + unitWord + ' was scored independently**. Findings were then **deduplicated across ' + unitWordShort + 's** — every issue in `findings/` carries an "Affects: N/M" badge plus a per-' + unitWordShort + ' breakdown, so you can see whether a problem is universal or only shows up in one place.');
    A.push('');
    A.push('## Objective');
    A.push('');
    A.push('Raise the design quality across ' + (mode === 'crawl' ? 'the whole site' : 'all ' + unitWordShort + 's') + ' by resolving the findings, without changing content/copy/intent, and staying consistent with the existing design tokens and ' + fw + '.');
    A.push('');
    A.push('## What you have');
    A.push('');
    A.push('- `GUIDELINES.md` — design tokens to reuse, the cross-cutting priorities, and how to solve issues by scope. **Read this first.**');
    A.push('- `findings/00-index.md` — every distinct issue, ordered worst-offenders-first (broadest reach, then severity).');
    A.push('- `findings/NN-<category>.md` — per category; each issue has an **Affects** badge, a per-' + unitWordShort + ' breakdown, a recommended **Fix**, **Selector(s)**, and a source link.');
    A.push('- `units/<' + unitWordShort + '>.md` — the individual findings for each ' + unitWord + ', if you need to drill into one.');
    if (hasShot) A.push('- `assets/clean-screenshot.*` — a full-page screenshot for visual reference.');
    A.push('');
    A.push('## How to work');
    A.push('');
    A.push('1. Read `GUIDELINES.md` so every change is consistent with the existing tokens.');
    A.push('2. Start at the top of `findings/00-index.md`. An issue that **affects all ' + unitWordShort + 's** is the highest-leverage fix — resolving it once clears it everywhere.');
    A.push('3. Solve each issue according to its scope:');
    A.push('   - **Cross-cutting** (affects all/most ' + unitWordShort + 's): fix once at the shared layer — ' + (mode === 'crawl' ? 'the shared component, template, or global stylesheet' : 'base styles that hold at every breakpoint') + '.');
    if (mode === 'viewport' || mode === 'matrix') A.push('   - **Viewport-specific** (affects only some viewports, e.g. Phone): use a responsive / conditional rule (media query or responsive utility) so you do **not** regress the viewports where it already passes.');
    if (mode === 'crawl' || mode === 'matrix') A.push('   - **Page-specific** (affects only some pages): fix it in those pages or their template, not globally.');
    A.push('4. Use the per-' + unitWordShort + ' breakdown under each issue to see exactly where — and at what magnitude — it occurs.');
    A.push('5. Do not regress passing checks. Keep semantic HTML, responsive behavior, and (if present) dark-mode support intact.');
    A.push('');
    A.push('## Definition of done');
    A.push('');
    A.push('- Every error- and warning-level issue is addressed or has a documented reason it cannot be.');
    A.push('- Cross-cutting issues are fixed at the shared layer; ' + unitWordShort + '-specific ones are fixed without regressing the ' + unitWordShort + 's that already pass.');
    A.push('- A short summary maps each change back to the issue it resolves (category + title + which ' + unitWordShort + 's).');
    A.push('');
    files.push({ path: 'AGENT_PROMPT.md', text: A.join('\n') });

    // ---- GUIDELINES.md ----------------------------------------------------
    var G = [];
    G.push('# Guidelines');
    G.push('');
    G.push('Derived from analyzing **' + (opts.startUrl || meta.url || host) + '** across ' + scopeSentence + ', plus general best practice.');
    G.push('');
    G.push('## 1. Design tokens to honor');
    G.push('');
    G.push('Reuse these existing values instead of introducing new ones (snapshot from the primary ' + unitWordShort + '):');
    G.push('');
    _tokenLinesFor(raw).forEach(function(l) { G.push(l); });
    G.push('');
    G.push('## 2. Priorities — worst offenders across ' + unitWordShort + 's');
    G.push('');
    if (allGroups.length === 0) {
      G.push('No issues at the current severity filter (' + severityFilter + ').');
    } else {
      allGroups.slice(0, 12).forEach(function(ag) {
        G.push('- ' + _sevIcon(ag.g.severity) + ' **[' + ag.cat.label + ']** ' + ag.g.title + ' — affects ' + scopeBadge(ag.g) + ' (`' + ag.cat.docPath + '`)');
      });
      if (allGroups.length > 12) G.push('- _…and ' + (allGroups.length - 12) + ' more in the per-category documents._');
    }
    G.push('');
    G.push('## 3. How to solve by scope');
    G.push('');
    G.push('- **Affects all/most ' + unitWordShort + 's** → fix once at the shared layer (' + (mode === 'crawl' ? 'shared component / template / global CSS' : 'base styles that hold at every breakpoint') + ').');
    if (mode === 'viewport' || mode === 'matrix') G.push('- **Affects only some viewports** → responsive / conditional fix (media query or responsive utility); never regress a passing viewport.');
    if (mode === 'crawl' || mode === 'matrix') G.push('- **Affects only some pages** → fix in those pages / their template, not globally.');
    G.push('');
    G.push('## 4. General principles');
    G.push('');
    _generalPrincipleLines(raw).forEach(function(l) { G.push(l); });
    G.push('');
    files.push({ path: 'GUIDELINES.md', text: G.join('\n') });

    // ---- findings/00-index.md (worst-offenders ranking) -------------------
    var IX = [];
    IX.push('# Findings index — worst offenders first');
    IX.push('');
    IX.push('Severity filter: **' + severityFilter + '** · checked across ' + scopeSentence + ' · ' + allGroups.length + ' distinct issues.');
    IX.push('');
    IX.push('| Affects | Sev | Category | Issue | Doc |');
    IX.push('|---------|-----|----------|-------|-----|');
    allGroups.forEach(function(ag) {
      var t = ag.g.title.length > 70 ? ag.g.title.substring(0, 67) + '…' : ag.g.title;
      IX.push('| ' + ag.g.n + '/' + M + ' | ' + _sevIcon(ag.g.severity) + ' | ' + ag.cat.label + ' | ' + t.replace(/\|/g, '\\|') + ' | `' + ag.cat.docNum + '-' + ag.cat.slug + '.md` |');
    });
    if (allGroups.length === 0) IX.push('| — | — | — | _no issues at this filter_ | — |');
    IX.push('');
    // Cross-page consistency is a SITE-level report (not per-page), so it sits
    // alongside the per-category findings rather than inside them.
    var _cons = opts.crawlSummary && opts.crawlSummary.consistency;
    if (_cons) {
      IX.push('> **Site-level:** see `00-site-consistency.md` — cross-page design-token consistency (Site Consistency ' + _cons.overall + '/100, ' + _cons.grade + '), independent of each page\'s grade.');
      IX.push('');
    }
    files.push({ path: 'findings/00-index.md', text: IX.join('\n') });

    if (_cons) {
      var SC = [];
      SC.push('# Site Consistency — cross-page design-token drift');
      SC.push('');
      SC.push('How consistently design tokens (fonts, type scale, spacing, color, radius, dark mode, framework) are applied across the crawled pages. This is a SITE-level score, independent of each page\'s own grade. Each finding lists `locations` — page path + element selector + value — so you can navigate to the divergence.');
      SC.push('');
      SC.push(consistencyMarkdown(_cons, severityFilter));
      files.push({ path: 'findings/00-site-consistency.md', text: SC.join('\n') });
    }

    // ---- findings/NN-<category>.md (pruned: only categories with findings) --
    cats.forEach(function(c) {
      if (!c.included) return;
      var D = [];
      D.push('# ' + c.label);
      D.push('');
      D.push('**Distinct issues:** ' + c.groups.length + ' · **Errors:** ' + c.errors + ' · **Warnings:** ' + c.warnings + ' · **Info:** ' + c.infos + ' · checked across ' + scopeSentence);
      D.push('');
      {
        c.groups.forEach(function(g) {
          D.push('## ' + _sevIcon(g.severity) + ' [' + g.severity + '] ' + g.title);
          D.push('');
          D.push('**Affects:** ' + scopeBadge(g));
          D.push('');
          if (g.n > 1) {
            var rows = breakdownLines(g);
            if (rows.length > 1) {
              D.push('**Per-' + unitWordShort + ':**');
              rows.forEach(function(r) { D.push(r); });
              D.push('');
            }
          }
          if (g.fix) { D.push('**Fix:** ' + g.fix); D.push(''); }
          if (g.presetRef) { D.push('**Example:** ' + g.presetRef); D.push(''); }
          var selLines = _selectorBlockLines(g.ref);
          if (selLines.length) { selLines.forEach(function(l) { D.push(l); }); D.push(''); }
          var src = _sourceMd(g.ref);
          if (src) { D.push(src); D.push(''); }
        });
      }
      files.push({ path: c.docPath, text: D.join('\n') });
    });

    // ---- units/<unit>.md (per-unit findings; clean units are pruned) ------
    units.forEach(function(u) {
      if (!u._hasFindings) return;
      var U = [];
      U.push('# ' + u.label);
      U.push('');
      U.push('**Score:** ' + u.report.overall + '/100 (' + u.report.grade + ')');
      U.push('');
      var any = false;
      (u.report.categories || []).forEach(function(c) {
        var shown = (c.findings || []).filter(function(f) { return passSev(f.severity); });
        if (!shown.length) return;
        any = true;
        U.push('## ' + c.label + ' — ' + c.score + '/100');
        U.push('');
        var order = { error: 0, warning: 1, info: 2, pass: 3 };
        shown.slice().sort(function(a, b) { return (order[a.severity] || 9) - (order[b.severity] || 9); }).forEach(function(f) {
          U.push('### ' + _sevIcon(f.severity) + ' [' + f.severity + '] ' + f.title);
          U.push('');
          if (f.detail) { U.push(f.detail); U.push(''); }
          if (f.fix) { U.push('**Fix:** ' + f.fix); U.push(''); }
          var sl = _selectorBlockLines(f);
          if (sl.length) { sl.forEach(function(l) { U.push(l); }); U.push(''); }
          var sr = _sourceMd(f);
          if (sr) { U.push(sr); U.push(''); }
        });
      });
      if (!any) U.push('_No issues at the current severity filter — all checks passed._');
      files.push({ path: 'units/' + u._docSlug + '.md', text: U.join('\n') });
    });

    // ---- assets + THIRD_PARTY --------------------------------------------
    if (hasShot) {
      var comma = shot.indexOf(',');
      var b64 = comma >= 0 ? shot.substring(comma + 1) : '';
      var ext = /^data:image\/jpe?g/.test(shot) ? 'jpg' : /^data:image\/webp/.test(shot) ? 'webp' : 'png';
      if (b64) assets.push({ path: 'assets/clean-screenshot.' + ext, b64: b64 });
    }
    files.push({ path: 'THIRD_PARTY.md', text: _thirdPartyLines().join('\n') });

    return { folder: folder, files: files, assets: assets };
  }

  // Shared markdown for the cross-page Site Consistency report — used by both the
  // crawl markdown export (analyzer-crawl.js) and the LLM instruction pack. Includes
  // per-finding `locations` (page + selector + value) so an agent can navigate to them.
  function consistencyMarkdown(c, severityFilter) {
    if (!c) return '';
    var lines = [];
    lines.push('**Site Consistency:** ' + c.overall + '/100 (' + c.grade + ')');
    lines.push('');
    lines.push('| Dimension | Score | Notes |');
    lines.push('|-----------|-------|-------|');
    (c.subScores || []).forEach(function(s) { lines.push('| ' + s.label + ' | ' + s.score + ' | ' + (s.note || '') + ' |'); });
    lines.push('');
    (c.findings || []).filter(function(f) {
      if (severityFilter === 'error') return f.severity === 'error';
      if (severityFilter === 'warning') return f.severity === 'error' || f.severity === 'warning';
      return true;
    }).forEach(function(f) {
      var icon = f.severity === 'error' ? 'x' : '!';
      lines.push('- [' + icon + '] **' + f.title + '** — ' + f.detail);
      if (f.fix) lines.push('  - **Fix:** ' + f.fix);
      (f.locations || []).slice(0, 12).forEach(function(l) {
        lines.push('  - `' + l.path + '`' + (l.selector ? ' `' + l.selector + '`' : '') + (l.value ? ' → ' + l.value : '') + (l.text ? ' "' + String(l.text).substring(0, 40) + '"' : ''));
      });
    });
    return lines.join('\n');
  }

  return { renderReport: renderReport, renderMarkdown: renderMarkdown, renderCrawlSummary: renderCrawlSummary, renderCrawlPageTab: renderCrawlPageTab, buildLlmPack: buildLlmPack, buildLlmPackMulti: buildLlmPackMulti, renderGauge: renderGauge, consistencyMarkdown: consistencyMarkdown };
})();
