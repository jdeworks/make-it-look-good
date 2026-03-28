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
    cognitive: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20h6v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z"/><line x1="10" y1="22" x2="14" y2="22"/></svg>'
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

    // --- Category cards ---
    html += '<div class="report-categories">';
    report.categories.forEach(function(cat) {
      var catId = 'findings-' + cat.icon;
      var hasFindings = cat.findings.length > 0;
      html += '<div class="report-card' + (hasFindings ? ' report-card-clickable' : '') + '"' + (hasFindings ? ' onclick="document.getElementById(\'' + catId + '\').scrollIntoView({behavior:\'smooth\',block:\'start\'})"' : '') + '>';
      html += '<div class="report-card-header">';
      html += '<div class="report-card-icon" style="color:' + scoreColor(cat.score) + '">' + (categoryIcons[cat.icon] || '') + '</div>';
      html += '<div class="report-card-title">';
      html += '<h3>' + cat.label + '</h3>';
      html += '<span class="report-card-weight">' + cat.weight + '% weight</span>';
      html += '</div>';
      html += '<div class="report-card-score" style="color:' + scoreColor(cat.score) + '">' + cat.score + '</div>';
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

      html += '<div class="report-card-counts">';
      if (totalChecks > 0 || cat.findings.length === 0) {
        if (passed > 0 || cat.findings.length === 0) html += '<span class="count-pass" title="Passed">' + (passed || totalChecks) + '</span>';
        if (errors > 0) html += '<span class="count-error" title="Errors">' + errors + '</span>';
        if (warnings > 0) html += '<span class="count-warning" title="Warnings">' + warnings + '</span>';
        if (infos > 0) html += '<span class="count-info" title="Info">' + infos + '</span>';
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
    html += '</div>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // --- Screenshots ---
    if (report.raw.screenshots && report.raw.screenshots.length > 0) {
      html += '<div class="report-summary" style="margin-top:16px">';
      html += '<details open>';
      html += '<summary style="cursor:pointer;font-size:18px;font-weight:700;padding:8px 0">Page Screenshots</summary>';
      html += '<div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">';
      report.raw.screenshots.forEach(function(src, idx) {
        html += '<div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">';
        if (report.raw.screenshots.length > 1) {
          html += '<div style="padding:6px 12px;font-size:11px;color:var(--text-secondary);border-bottom:1px solid var(--border);background:var(--bg-alt)">Section ' + (idx + 1) + ' of ' + report.raw.screenshots.length + '</div>';
        }
        html += '<img src="' + src + '" alt="Page screenshot ' + (idx + 1) + '" style="width:100%;display:block" loading="lazy">';
        html += '</div>';
      });
      html += '</div>';
      html += '</details>';
      html += '</div>';
    }

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
  function renderMarkdown(report) {
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

  return { renderReport: renderReport, renderMarkdown: renderMarkdown };
})();
