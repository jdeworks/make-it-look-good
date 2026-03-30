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

    // --- Deep scan viewport bar (at top) ---
    if (report.raw.deepScan && report.raw.deepScan.viewports && report.raw.deepScan.viewports.length > 0) {
      html += '<div class="report-viewport-bar">';
      html += '<span style="font-size:12px;color:var(--text-secondary);font-weight:600">Viewports analyzed:</span> ';
      report.raw.deepScan.viewports.forEach(function(vp, idx) {
        var status = vp.error ? '✗' : '✓';
        html += '<span class="viewport-tag' + (vp.error ? ' viewport-error' : '') + '" title="' + escapeHtml(vp.label) + '">' + status + ' ' + vp.width + 'px</span>';
      });
      html += '</div>';
    }

    // --- Screenshots (collapsible, before scores) ---
    if (report.raw.screenshots && report.raw.screenshots.length > 0) {
      html += '<details class="report-screenshots">';
      html += '<summary style="cursor:pointer;font-size:14px;font-weight:600;padding:8px 0;color:var(--text-secondary)">Page Screenshots (' + report.raw.screenshots.length + ')</summary>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;margin-bottom:16px">';
      report.raw.screenshots.forEach(function(src, idx) {
        html += '<div class="screenshot-thumb" style="flex:1;min-width:200px;max-width:400px">';
        if (report.raw.screenshots.length > 1) {
          html += '<div style="padding:4px 8px;font-size:10px;color:var(--text-secondary);border-bottom:1px solid var(--border);background:var(--bg-alt)">Section ' + (idx + 1) + '</div>';
        }
        html += '<img src="' + src + '" alt="Page screenshot ' + (idx + 1) + '" class="screenshot-img" style="width:100%;display:block;cursor:zoom-in" onclick="window.__milgZoomScreenshot(this)" loading="lazy">';
        html += '</div>';
      });
      html += '</div>';
      // Unhidden panels screenshots (shown when hidden panels were detected)
      if (report.raw.screenshotsUnhidden && report.raw.screenshotsUnhidden.length > 0) {
        html += '<div style="margin-top:12px;padding:12px;border:2px dashed var(--border);border-radius:8px;background:var(--bg-alt)">';
        html += '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-error,#ef4444)">With hidden panels revealed (' + (report.raw.layout.hiddenPanelCount || '?') + ' panels unhidden)</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:12px">';
        report.raw.screenshotsUnhidden.forEach(function(src, idx) {
          html += '<div class="screenshot-thumb" style="flex:1;min-width:200px;max-width:400px">';
          if (report.raw.screenshotsUnhidden.length > 1) {
            html += '<div style="padding:4px 8px;font-size:10px;color:var(--text-secondary);border-bottom:1px solid var(--border);background:var(--bg-alt)">Section ' + (idx + 1) + '</div>';
          }
          html += '<img src="' + src + '" alt="Page with panels revealed ' + (idx + 1) + '" class="screenshot-img" style="width:100%;display:block;cursor:zoom-in" onclick="window.__milgZoomScreenshot(this)" loading="lazy">';
          html += '</div>';
        });
        html += '</div>';
        html += '</div>';
      }
      html += '</details>';
    }

    // --- Category cards ---
    html += '<div class="report-categories">';
    report.categories.forEach(function(cat) {
      var catId = 'findings-' + cat.icon;
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

      var catId = 'findings-' + cat.icon;
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

    report.categories.forEach(function(cat) {
      if (cat.findings.length === 0) return;

      html += '<div class="report-finding-group" id="findings-' + cat.icon + '">';
      html += '<h3>' + (categoryIcons[cat.icon] || '') + ' ' + cat.label + '</h3>';

      cat.findings.forEach(function(f) {
        html += '<div class="report-finding severity-' + f.severity + '">';
        html += '<div class="finding-header">';
        html += severityBadge(f.severity);
        html += '<span class="finding-title">' + escapeHtml(f.title) + '</span>';
        html += '</div>';
        if (f.detail) html += '<p class="finding-detail">' + escapeHtml(f.detail) + '</p>';

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
        { title: 'Paragraph spacing appropriate', detail: 'Paragraphs have comfortable spacing between them.', source: 'Butterick\'s Practical Typography — https://practicaltypography.com/space-between-paragraphs.html' }
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
        { title: 'No color-only indicators', detail: 'Status information uses icons or text in addition to color.', source: 'WCAG 2.2 §1.4.1 — https://www.w3.org/TR/WCAG22/#use-of-color' }
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
        { title: 'Dark mode supported', detail: 'Page provides a dark color scheme option.', source: 'Apple HIG — https://developer.apple.com/design/human-interface-guidelines/dark-mode' }
      ],
      cognitive: [
        { title: 'Content sections well-organized', detail: 'Page sections and headings are within cognitive load limits.', source: 'Hick\'s Law — https://lawsofux.com/hicks-law/' },
        { title: 'Form complexity manageable', detail: 'Visible form fields stay within recommended limits.', source: 'Miller\'s Law — https://lawsofux.com/millers-law/' },
        { title: 'Navigation count appropriate', detail: 'Top-level navigation items are within working memory limits.', source: 'Cowan (2001) — https://doi.org/10.1017/S0140525X01003922' },
        { title: 'Reading level appropriate', detail: 'Content reading level matches the target audience.', source: 'WCAG 2.2 §3.1.5 — https://www.w3.org/TR/WCAG22/#reading-level' },
        { title: 'Visual complexity manageable', detail: 'Number of unique colors doesn\'t overwhelm the user.', source: 'Material Design 3 — https://m3.material.io/styles/color/roles' },
        { title: 'Heading hierarchy supports scanning', detail: 'Headings follow a logical order for easy content navigation.', source: 'WCAG 2.2 §1.3.1 — https://www.w3.org/TR/WCAG22/#info-and-relationships' }
      ],
      layout: [
        { title: 'Section spacing consistent', detail: 'Gaps between major sections use uniform spacing.', source: 'Gestalt similarity — https://lawsofux.com/law-of-similarity/' },
        { title: 'Alignment grid clean', detail: 'Elements share consistent alignment edges without jagged offsets.', source: 'Gestalt continuity — https://lawsofux.com/law-of-common-region/' },
        { title: 'H1 visual hierarchy clear', detail: 'H1 stands out from body text at 2-4x size.', source: 'Modular type scales — https://typescale.com/' },
        { title: 'H2 visual hierarchy appropriate', detail: 'H2 is clearly distinct from both H1 and body text.', source: 'Modular type scales — https://typescale.com/' },
        { title: 'Border radius standardized', detail: 'Uses a consistent set of border-radius values.', source: 'Material Design 3 — https://m3.material.io/styles/shape/overview' },
        { title: 'Page density manageable', detail: 'Element count is within comfortable range for the page type.', source: 'NNGroup — https://www.nngroup.com/articles/how-users-read-on-the-web/' }
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

        // If we have more passes than descriptions, show a summary
        if (shown < passCount) {
          html += '<div class="report-finding severity-pass" style="border-left:3px solid #16a34a">';
          html += '<div class="finding-header">';
          html += severityBadge('pass');
          html += '<span class="finding-title">' + (passCount - shown) + ' additional check(s) passed</span>';
          html += '</div>';
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

    // Color palette
    html += '<div class="summary-section">';
    html += '<h4>Color Palette</h4>';
    html += '<div class="color-swatches">';
    var bgColors = (report.raw.colors.bgColors || []).slice(0, 8);
    bgColors.forEach(function(c) {
      html += '<div class="color-swatch" style="background:' + c.value + '" title="' + c.value + ' (' + c.count + ' uses)"></div>';
    });
    html += '</div>';
    html += '<div class="color-swatches" style="margin-top:4px">';
    var textColors = (report.raw.colors.textColors || []).slice(0, 8);
    textColors.forEach(function(c) {
      html += '<div class="color-swatch" style="background:' + c.value + '" title="' + c.value + ' (' + c.count + ' uses)"></div>';
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

    // Deep scan results
    if (report.raw.deepScan) {
      var ds = report.raw.deepScan;
      html += '<div class="report-summary" style="margin-top:16px">';
      html += '<h2>Deep Scan Results</h2>';

      if (ds.viewports && ds.viewports.length > 0) {
        html += '<h4 style="font-size:13px;margin-bottom:8px">Multi-Viewport Comparison</h4>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">';
        html += '<tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border)">Viewport</th><th style="padding:4px 8px;border-bottom:1px solid var(--border)">Touch Issues</th><th style="padding:4px 8px;border-bottom:1px solid var(--border)">Contrast Fails</th><th style="padding:4px 8px;border-bottom:1px solid var(--border)">Overflow</th><th style="padding:4px 8px;border-bottom:1px solid var(--border)"></th></tr>';
        ds.viewports.forEach(function(vp, idx) {
          if (vp.error) {
            html += '<tr><td style="padding:4px 8px">' + escapeHtml(vp.label) + ' (' + vp.width + 'px)</td><td colspan="4" style="padding:4px 8px;color:#dc2626">Extraction failed</td></tr>';
          } else {
            html += '<tr><td style="padding:4px 8px">' + escapeHtml(vp.label) + ' (' + vp.width + 'px)</td>';
            html += '<td style="padding:4px 8px;text-align:center">' + (vp.touchTargets || 0) + '</td>';
            html += '<td style="padding:4px 8px;text-align:center">' + (vp.contrastFails || 0) + '</td>';
            html += '<td style="padding:4px 8px;text-align:center">' + (vp.overflow ? 'Yes' : 'No') + '</td>';
            html += '<td style="padding:4px 8px;text-align:center"><button class="btn" style="font-size:11px;padding:3px 10px;min-height:28px" onclick="window.__milgSwitchViewport(' + idx + ')">View report</button></td></tr>';
          }
        });
        html += '</table>';
      }

      if (ds.darkMode && ds.darkMode.tested) {
        html += '<h4 style="font-size:13px;margin-bottom:8px">Dark Mode Test</h4>';
        var dmFails = ds.darkMode.contrastFails;
        if (dmFails === 0) {
          html += '<p style="font-size:13px"><span style="color:#16a34a">No contrast failures in dark mode</span></p>';
        } else {
          html += '<p style="font-size:13px"><span style="color:#dc2626">' + dmFails + ' contrast failure(s) in dark mode (' + ds.darkMode.contrastTotal + ' pairs checked)</span></p>';
        }
      }

      html += '</div>';
    }

    return html;
  }

  // --- Markdown Export ---
  function renderMarkdown(report, options) {
    var opts = options || {};
    var skipImages = opts.skipImages || false;
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
      if (cat.findings.length === 0) return;
      lines.push('### ' + cat.label);
      lines.push('');
      cat.findings.forEach(function(f) {
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

    // Deep scan results
    if (report.raw.deepScan) {
      var ds = report.raw.deepScan;
      lines.push('## Deep Scan Results');
      lines.push('');
      if (ds.viewports && ds.viewports.length > 0) {
        lines.push('### Multi-Viewport Comparison');
        lines.push('');
        lines.push('| Viewport | Touch Issues | Contrast Fails | Overflow |');
        lines.push('|----------|-------------|----------------|----------|');
        ds.viewports.forEach(function(vp) {
          if (vp.error) {
            lines.push('| ' + vp.label + ' (' + vp.width + 'px) | — | — | Extraction failed |');
          } else {
            lines.push('| ' + vp.label + ' (' + vp.width + 'px) | ' + (vp.touchTargets || 0) + ' | ' + (vp.contrastFails || 0) + ' | ' + (vp.overflow ? 'Yes' : 'No') + ' |');
          }
        });
        lines.push('');
      }
      if (ds.darkMode && ds.darkMode.tested) {
        lines.push('### Dark Mode Test');
        lines.push('');
        var dmFails = ds.darkMode.contrastFails;
        if (dmFails === 0) {
          lines.push('No contrast failures in dark mode.');
        } else {
          lines.push(dmFails + ' contrast failure(s) in dark mode (' + ds.darkMode.contrastTotal + ' pairs checked).');
        }
        lines.push('');
      }
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

  function renderCrawlSummary(summary) {
    if (!summary || summary.pagesAnalyzed === 0) {
      return '<div class="crawl-summary"><p style="color:var(--text-secondary)">No pages analyzed yet.</p></div>';
    }

    var html = '<div class="crawl-summary">';

    // Overall stats
    html += '<h2>Site Overview</h2>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:24px">';
    html += '<div style="padding:12px 20px;border-radius:10px;background:var(--surface);border:1px solid var(--border);text-align:center">';
    html += '<div style="font-size:32px;font-weight:700;font-variant-numeric:tabular-nums">' + summary.averageScore + '</div>';
    html += '<div style="font-size:12px;color:var(--text-secondary)">Average Score</div></div>';
    html += '<div style="padding:12px 20px;border-radius:10px;background:var(--surface);border:1px solid var(--border);text-align:center">';
    html += '<div style="font-size:32px;font-weight:700">' + summary.pagesAnalyzed + '</div>';
    html += '<div style="font-size:12px;color:var(--text-secondary)">Pages Analyzed</div></div>';
    if (summary.pagesFailed > 0) {
      html += '<div style="padding:12px 20px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;text-align:center">';
      html += '<div style="font-size:32px;font-weight:700;color:#dc2626">' + summary.pagesFailed + '</div>';
      html += '<div style="font-size:12px;color:#dc2626">Failed</div></div>';
    }
    html += '</div>';

    // Score grid
    html += '<h3>Page Scores</h3>';
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
        html += '<div class="issue-count">' + issue.count + ' page' + (issue.count > 1 ? 's' : '') + '</div>';
        html += '</div>';
        html += '<div class="issue-pages">';
        issue.pages.slice(0, 5).forEach(function(p) {
          var path; try { path = new URL(p.url).pathname; } catch(e) { path = p.url; }
          html += '<div>' + escapeHtml(path) + (p.detail ? ' — ' + escapeHtml(p.detail.substring(0, 80)) : '') + '</div>';
        });
        if (issue.pages.length > 5) html += '<div style="color:var(--text-secondary)">...and ' + (issue.pages.length - 5) + ' more</div>';
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

    html += '</div>';
    return html;
  }

  function renderCrawlPageTab(page, index, isActive) {
    var path;
    try { path = new URL(page.url).pathname; } catch(e) { path = page.url; }
    if (path === '/') path = '/ (home)';
    var label = page.title ? page.title.substring(0, 25) : path;

    var dotClass = 'pending';
    if (page.status === 'done' && page.reportData) {
      dotClass = 'grade-' + page.reportData.grade.toLowerCase();
    } else if (page.status === 'error') {
      dotClass = 'error';
    }

    return '<button class="crawl-page-tab' + (isActive ? ' active' : '') + '" data-crawl-page="' + index + '" title="' + escapeHtml(page.url) + '">' +
      '<span class="score-dot ' + dotClass + '"></span>' +
      escapeHtml(label) +
      (page.status === 'done' && page.reportData ? ' <span style="font-size:11px;color:var(--text-secondary)">' + page.reportData.overall + '</span>' : '') +
      '</button>';
  }

  return { renderReport: renderReport, renderMarkdown: renderMarkdown, renderCrawlSummary: renderCrawlSummary, renderCrawlPageTab: renderCrawlPageTab };
})();
