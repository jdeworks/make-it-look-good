// make-it-look-good — Design Analyzer (Main UI Controller)
// Depends on: analyzer-report.js (MilgReport), analyzer-crawl.js (MilgCrawl),
//             analyzer-extract.js (MilgExtract), analyzer-iframe.js (MilgIframe),
//             analyzer-proxy.js (MilgProxy), analyzer-crawl-ui.js (MilgCrawlUI)

(function() {
  "use strict";

  // --- Configuration ---
  // Self-hosted CORS proxy (Cloudflare Worker).
  // The placeholder __PROXY_ENCODED__ is replaced at deploy time by GitHub Actions
  // with a base64-encoded URL (kept out of git via repository secrets).
  // Fork users: deploy your own worker (see proxy/README.md) and set the
  // PROXY_URL secret in your repo's Settings > Secrets > Actions.
  var _pe = 'aHR0cHM6Ly9taWxnLWNvcnMtcHJveHkuamRld29ya3Mud29ya2Vycy5kZXY=';
  var CORS_PROXY_URL = (_pe.indexOf('__') === 0) ? '' : (function() {
    try { return atob(_pe); } catch(e) { return ''; }
  })();

  // Screenshot library (loaded inside iframes via script tag)
  var SCREENSHOT_CDN = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js';

  // --- State ---
  var reportData = null;
  var darkMode = localStorage.getItem('milg-dark') === 'true';
  var lastRawData = null;
  var _originalRawData = null;

  // --- Utility functions (shared with modules) ---
  function applyDarkMode() {
    document.body.classList.toggle('dark-ui', darkMode);
    document.getElementById('darkBtn').classList.toggle('active', darkMode);
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.style.cursor = 'pointer';
    t.onclick = function() {
      navigator.clipboard.writeText(msg).then(function() {
        t.textContent = 'Copied!';
        setTimeout(function() { t.classList.remove('show'); }, 500);
      });
    };
    t.classList.add('show');
    console.log('[toast]', msg);
    setTimeout(function() { t.classList.remove('show'); }, 5000);
  }

  var _progressPct = 0;
  function showProgress(pct, label) {
    var el = document.getElementById('analysisProgress');
    var fill = document.getElementById('progressFill');
    var lbl = document.getElementById('progressLabel');
    if (!el) return;
    el.style.display = 'block';
    // Never go backwards — only increase
    if (pct > _progressPct) _progressPct = pct;
    fill.style.width = Math.min(_progressPct, 100) + '%';
    if (label) lbl.textContent = label;
  }

  function hideProgress() {
    var el = document.getElementById('analysisProgress');
    if (el) el.style.display = 'none';
    _progressPct = 0; // reset for next analysis
  }

  function getSelectedViewport() {
    var sel = document.getElementById('viewportSelect');
    if (!sel) return { w: 1280, h: 900 };
    var val = sel.value;
    if (val === 'current') return { w: window.innerWidth, h: window.innerHeight };
    var parts = val.split('x');
    return { w: parseInt(parts[0]) || 1280, h: parseInt(parts[1]) || 900 };
  }

  // --- Snippet loading ---
  var _snippetCache = {};
  function loadSnippet(codeEl, withScreenshots, callback) {
    var file = withScreenshots ? 'analyzer-snippet-screenshots.js' : 'analyzer-snippet.js';
    if (_snippetCache[file]) {
      codeEl.textContent = _snippetCache[file];
      if (callback) callback();
      return;
    }
    fetch(file)
      .then(function(r) { return r.text(); })
      .then(function(text) { _snippetCache[file] = text; codeEl.textContent = text; if (callback) callback(); })
      .catch(function() { codeEl.textContent = '// Failed to load snippet — copy from ' + file; });
  }

  // --- Initialize modules ---
  MilgIframe.init({
    screenshotCDN: SCREENSHOT_CDN,
    getViewport: getSelectedViewport,
    showProgress: showProgress
  });

  MilgProxy.init({
    corsProxyUrl: CORS_PROXY_URL,
    showToast: showToast,
    showProgress: showProgress,
    hideProgress: hideProgress,
    runAnalysis: function(data, skip) { runAnalysis(data, skip); }
  });

  // --- Analysis history (localStorage, max 10) ---
  var HISTORY_KEY = 'milg-analysis-history';
  var HISTORY_MAX = 10;

  function saveToHistory(data, score, grade) {
    try {
      var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      var entryUrl = (data.meta && data.meta.url) || 'Unknown';
      var entryProfile = data.profile || 'general';

      // Dedup: don't add if same URL + profile already exists as the most recent entry
      if (history.length > 0 && history[0].url === entryUrl && history[0].profile === entryProfile) {
        // Update existing entry instead of adding duplicate
        history[0].timestamp = new Date().toISOString();
        history[0].score = score;
        history[0].grade = grade;
      } else {
        var entry = {
          url: entryUrl,
          timestamp: new Date().toISOString(),
          score: score,
          grade: grade,
          profile: entryProfile
        };
        // Store extraction data (without screenshots to save space)
        var stored = JSON.parse(JSON.stringify(data, function(k, v) {
          if (k === 'screenshots' || k === 'viewportData') return undefined;
          return v;
        }));
        entry.data = stored;
        history.unshift(entry);
      }
      if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch(e) { /* quota exceeded or parse error — skip */ }
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch(e) { return []; }
  }

  function renderHistoryList() {
    var history = getHistory();
    if (history.length === 0) return '';
    var html = '<div class="history-section">';
    html += '<h3 style="font-size:14px;font-weight:600;margin-bottom:8px">Recent Analyses <span style="font-size:11px;color:var(--text-secondary);font-weight:400">(max ' + HISTORY_MAX + ', stored locally)</span></h3>';
    history.forEach(function(entry, idx) {
      var date = new Date(entry.timestamp);
      var dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      var urlShort = (entry.url || '').replace(/^https?:\/\//, '').substring(0, 40);
      html += '<div class="history-item">';
      html += '<span class="history-score" style="color:' + (entry.score >= 80 ? '#16a34a' : entry.score >= 60 ? '#ca8a04' : '#dc2626') + '" onclick="window.__milgLoadHistory(' + idx + ')">' + entry.score + '</span>';
      html += '<span class="history-url" onclick="window.__milgLoadHistory(' + idx + ')">' + urlShort + '</span>';
      html += '<span class="history-date">' + dateStr + '</span>';
      html += '<button class="history-delete" onclick="event.stopPropagation();window.__milgDeleteHistory(' + idx + ')" title="Remove from history">&times;</button>';
      html += '</div>';
    });
    html += '<p style="font-size:11px;color:var(--text-secondary);margin-top:6px">Oldest removed after ' + HISTORY_MAX + ' scans. Export JSON to keep permanently.</p>';
    html += '</div>';
    return html;
  }

  window.__milgDeleteHistory = function(idx) {
    try {
      var history = getHistory();
      history.splice(idx, 1);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      // Re-render history
      var containers = document.querySelectorAll('.history-section');
      containers.forEach(function(c) { c.parentNode.removeChild(c); });
      var historyHtml = renderHistoryList();
      if (historyHtml) {
        var container = document.createElement('div');
        container.innerHTML = historyHtml;
        document.getElementById('inputSection').appendChild(container);
      }
    } catch(e) {}
  };

  window.__milgLoadHistory = function(idx) {
    var history = getHistory();
    if (history[idx] && history[idx].data) {
      runAnalysis(history[idx].data);
      showToast('Loaded: ' + (history[idx].url || 'analysis'));
    }
  };

  // --- Exclusion pattern detection ---
  function detectExclusionPatterns(data) {
    var patterns = [];
    var pairs = data.colors.contrastPairs || [];

    // Pattern: clusters of 1:1 contrast (unparseable backgrounds)
    var uncertainCount = pairs.filter(function(p) { return p.ratio <= 1.01 && p.fg === p.bg; }).length;
    if (uncertainCount >= 3) {
      patterns.push({ label: 'Undetermined backgrounds (' + uncertainCount + ' elements)', selector: '', type: 'uncertain', count: uncertainCount });
    }

    // Pattern: elements with mock/demo/preview in class names
    var contrastSelectors = pairs.map(function(p) { return p.selector || ''; });
    var touchSelectors = (data.interaction.touchTargets || []).map(function(t) { return t.selector || ''; });
    var allSelectors = contrastSelectors.concat(touchSelectors);
    var mockCount = allSelectors.filter(function(s) { return /mock|demo|preview|screenshot/i.test(s); }).length;
    if (mockCount >= 2) {
      patterns.push({ label: 'Mock/demo UI (' + mockCount + ' elements)', selector: "[class*='mock'], .demo, .preview, .screenshot", type: 'mock', count: mockCount });
    }

    // Pattern: footer links flagged for touch targets
    var footerTargets = (data.interaction.touchTargets || []).filter(function(t) { return /footer/i.test(t.selector || ''); }).length;
    if (footerTargets >= 3) {
      patterns.push({ label: 'Footer links (' + footerTargets + ' touch targets)', selector: 'footer', type: 'footer', count: footerTargets });
    }

    return patterns;
  }

  function renderExclusionSuggestions(patterns) {
    if (patterns.length === 0) return '';
    var html = '<div class="exclusion-suggestions" id="exclusionSuggestions">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<strong style="font-size:13px">Detected patterns you might want to exclude:</strong>';
    html += '<button onclick="document.getElementById(\'exclusionSuggestions\').style.display=\'none\'" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:16px">&times;</button>';
    html += '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
    patterns.forEach(function(p) {
      html += '<button type="button" class="exclude-tag" data-selector="' + p.selector.replace(/"/g, '&quot;') + '" data-type="' + p.type + '" onclick="window.__milgToggleExclude(this)">' + p.label + '</button>';
    });
    html += '</div>';
    html += '<button class="btn btn-primary" style="font-size:12px;padding:6px 14px;min-height:36px" onclick="window.__milgRerunWithExcludes()">Re-score with exclusions</button>';
    html += '</div>';
    return html;
  }

  // Global handlers for exclusion suggestion buttons
  window.__milgToggleExclude = function(btn) { btn.classList.toggle('active'); };
  window.__milgRerunWithExcludes = function() {
    if (!lastRawData) return;
    var active = document.querySelectorAll('#exclusionSuggestions .exclude-tag.active');
    var selectors = [];
    active.forEach(function(btn) { if (btn.dataset.selector) selectors.push(btn.dataset.selector); });
    if (selectors.length === 0) { showToast('Select patterns to exclude first'); return; }
    // Clone data for re-scoring — break circular refs from deepScan.viewportData
    var filtered = JSON.parse(JSON.stringify(lastRawData, function(key, val) {
      if (key === 'viewportData') return undefined;
      return val;
    }));
    // Restore viewportData reference (not cloned, just re-attached)
    if (lastRawData.deepScan && lastRawData.deepScan.viewportData) {
      if (!filtered.deepScan) filtered.deepScan = {};
      filtered.deepScan.viewportData = lastRawData.deepScan.viewportData;
    }
    filtered.colors.contrastPairs = filtered.colors.contrastPairs.filter(function(p) {
      var sel = p.selector || '';
      for (var i = 0; i < active.length; i++) {
        var type = active[i].dataset.type;
        if (type === 'uncertain' && p.ratio <= 1.01 && p.fg === p.bg) return false;
        if (type === 'mock' && /mock|demo|preview|screenshot/i.test(sel)) return false;
        if (type === 'footer' && /footer/i.test(sel)) return false;
      }
      return true;
    });
    filtered.interaction.touchTargets = filtered.interaction.touchTargets.filter(function(t) {
      var sel = t.selector || '';
      for (var i = 0; i < active.length; i++) {
        var type = active[i].dataset.type;
        if (type === 'mock' && /mock|demo|preview|screenshot/i.test(sel)) return false;
        if (type === 'footer' && /footer/i.test(sel)) return false;
      }
      return true;
    });
    runAnalysis(filtered, true);
    showToast('Re-scored with ' + active.length + ' exclusion(s)');
  };

  window.__milgResetExclusions = function() {
    if (_originalRawData) runAnalysis(_originalRawData);
  };

  // --- Screenshot viewer (with bbox overlays) ---
  window.__milgZoomScreenshot = function(img, sectionIndex) {
    if (window.MilgViewer && reportData) {
      MilgViewer.open(img, sectionIndex || 0, reportData);
    }
  };

  // Open viewer focused on a specific finding
  window.__milgShowFindingOnScreenshot = function(findingIdx) {
    if (window.MilgViewer && reportData) {
      MilgViewer.showFinding(findingIdx, reportData);
    }
  };

  // Viewport switching for deep scan results
  window.__milgSwitchViewport = function(idx) {
    if (!lastRawData || !lastRawData.deepScan || !lastRawData.deepScan.viewportData) return;
    var deepScan = lastRawData.deepScan;
    var vpData = deepScan.viewportData[idx];
    if (!vpData || !vpData.data) { showToast('No data for this viewport'); return; }
    // Deep-clone viewport data, skipping deepScan/viewportData to avoid circular refs
    // (viewportData[0].data IS the primary object which has .deepScan on it)
    var switchedData = JSON.parse(JSON.stringify(vpData.data, function(k, v) {
      return k === 'deepScan' ? undefined : v;
    }));
    switchedData.deepScan = deepScan;
    switchedData.meta.url = lastRawData.meta.url;
    runAnalysis(switchedData);
    showToast('Showing results for ' + vpData.label);
  };

  // Switch to Console Snippet tab (from JS-required warning)
  window.__milgSwitchToSnippet = function() {
    var reportContainer = document.getElementById('reportContainer');
    var inputSection = document.getElementById('inputSection');
    reportContainer.innerHTML = '';
    reportContainer.classList.remove('visible');
    document.getElementById('reportActions').style.display = 'none';
    inputSection.style.display = '';
    // Activate the snippet tab
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    var snippetBtn = document.querySelector('.tab-btn[data-tab="tabSnippet"]');
    if (snippetBtn) snippetBtn.classList.add('active');
    var snippetTab = document.getElementById('tabSnippet');
    if (snippetTab) snippetTab.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Core analysis runner ---
  function runAnalysis(data, skipExclusionDetection) {
    lastRawData = data;
    if (!_originalRawData || !skipExclusionDetection) _originalRawData = data;
    try { sessionStorage.setItem('milg-last-extraction', JSON.stringify(data, function(k, v) { return k === 'viewportData' ? undefined : v; })); } catch(e) {}
    // Apply selected profile
    var profile = document.getElementById('profileSelect');
    if (profile) data.profile = profile.value;
    reportData = MilgScoring.runScoring(data);
    var reportContainer = document.getElementById('reportContainer');
    var inputSection = document.getElementById('inputSection');

    // Detect empty/blocked/JS-dependent pages (skip for console snippet — JS already executed)
    var warningHtml = '';
    var inputMethod = (data.meta && data.meta._inputMethod) || '';
    var isUrlFetch = inputMethod === 'url';
    var elCount = (data.structure && data.structure.totalElements) || 0;
    var contentWidth = parseFloat(data.spacing && data.spacing.maxContentWidth) || 0;
    var contrastPairCount = (data.colors && data.colors.contrastPairs) ? data.colors.contrastPairs.length : 0;
    var headingCount = (data.typography && data.typography.headings) ? data.typography.headings.length : 0;
    var hasLimitedContent = elCount < 20 || contentWidth < 100;
    // JS-dependent pages: have HTML elements but almost no visible text/headings
    var isJsDependent = elCount > 20 && contrastPairCount < 3 && headingCount < 1;
    // Also flag pages with very few text colors (likely unstyled/broken render)
    var textColorCount = (data.colors && data.colors.textColors) ? data.colors.textColors.length : 0;
    var isBareBones = elCount > 5 && elCount < 50 && textColorCount <= 2 && contentWidth < 200;
    // Show success note for JS-enabled analysis (no screenshots available in srcdoc mode)
    var isJsEnabled = data.meta && data.meta._jsEnabled;
    // Build sandbox log summary (shared between JS success and JS limited content banners)
    function buildSandboxNote(sandboxLog, noteColor) {
      if (!sandboxLog || sandboxLog.length === 0) return '';
      var apiCounts = {};
      sandboxLog.forEach(function(e) { var k = e.api + '.' + e.method; apiCounts[k] = (apiCounts[k] || 0) + 1; });
      var apiSummary = Object.keys(apiCounts).map(function(k) { return k + ' \u00d7' + apiCounts[k]; }).join(', ');
      return '<details style="margin-top:6px;font-size:11px;color:' + noteColor + '">' +
        '<summary style="cursor:pointer">Sandbox isolated ' + sandboxLog.length + ' API call' + (sandboxLog.length !== 1 ? 's' : '') + ' (normal for iframed pages)</summary>' +
        '<div style="margin-top:4px;font-size:11px;line-height:1.6">' +
        '<div style="margin-bottom:4px;opacity:0.8">The page tried to use APIs that are disabled in the sandbox. This is expected &mdash; most sites use storage/cookies for normal operation and don\'t expect to be iframed.</div>' +
        '<div style="font-family:var(--mono);font-size:10px;max-height:100px;overflow:auto">' + apiSummary + '</div>' +
        '</div></details>';
    }

    if (isJsEnabled && isUrlFetch) {
      var isDark = document.body.classList.contains('dark-ui');
      var sandboxLog = data._sandboxLog || [];
      if (hasLimitedContent || isJsDependent || isBareBones) {
        // JS-enabled but still limited content — site may block framing or need auth
        var wBg = isDark ? '#2d2006' : '#fffbeb';
        var wBorder = isDark ? '#92400e' : '#f59e0b';
        var wText = isDark ? '#fbbf24' : '#92400e';
        var wStrong = isDark ? '#fcd34d' : '#78350f';
        warningHtml = '<div style="padding:14px 18px;background:' + wBg + ';border:1px solid ' + wBorder + ';border-radius:var(--radius);margin-bottom:14px;font-size:13px;line-height:1.6;color:' + wText + '">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:16px">&#9889;</span>' +
          '<strong style="color:' + wStrong + '">Limited content even with JavaScript (' + elCount + ' elements)</strong></div>' +
          '<p style="margin:4px 0">The site may block framing (X-Frame-Options), require authentication, or use client-side routing that didn\'t resolve in the sandbox.</p>' +
          '<p style="margin:4px 0">The results below reflect what rendered. For the most accurate analysis, use the <strong>Console Snippet</strong> — it runs directly in the page\'s context.</p>' +
          '<div style="margin-top:10px"><button onclick="window.__milgSwitchToSnippet()" style="padding:6px 14px;background:' + (isDark ? '#92400e' : '#f59e0b') + ';color:' + (isDark ? '#fef3c7' : '#78350f') + ';border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Switch to Console Snippet</button></div>' +
          buildSandboxNote(sandboxLog, wText) +
          '</div>';
      } else {
        // JS-enabled and got good content
        var nBg = isDark ? '#0c2d1e' : '#f0fdf4';
        var nBorder = isDark ? '#166534' : '#22c55e';
        var nText = isDark ? '#86efac' : '#166534';
        var hasScreenshots = data.screenshots && data.screenshots.length > 0;
        var ssNote = hasScreenshots ? '' : ' Screenshots may be unavailable if the site blocks cross-origin images.';
        warningHtml = '<div style="padding:12px 16px;background:' + nBg + ';border:1px solid ' + nBorder + ';border-radius:var(--radius);margin-bottom:12px;font-size:13px;color:' + nText + '">' +
          '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:16px">&#9889;</span>' +
          '<span>Analyzed with JavaScript enabled (' + elCount + ' elements).' + ssNote + '</span></div>' +
          buildSandboxNote(sandboxLog, nText) + '</div>';
      }
    }
    // Only show JS-required warning for URL fetch without JS — paste/editor/console modes don't need it
    if (isUrlFetch && !isJsEnabled && (hasLimitedContent || isJsDependent || isBareBones)) {
      var reason = hasLimitedContent
        ? 'Limited content detected (' + elCount + ' elements)'
        : isJsDependent
        ? 'This page requires JavaScript to render (' + elCount + ' elements but almost no visible text)'
        : 'Page appears incomplete or improperly loaded (' + elCount + ' elements, ' + textColorCount + ' text colors)';
      var isDark = document.body.classList.contains('dark-ui');
      var wBg = isDark ? '#2d2006' : '#fffbeb';
      var wBorder = isDark ? '#92400e' : '#f59e0b';
      var wText = isDark ? '#fbbf24' : '#92400e';
      var wStrong = isDark ? '#fcd34d' : '#78350f';
      var wBtnBg = isDark ? '#92400e' : '#f59e0b';
      var wBtnText = isDark ? '#fef3c7' : '#78350f';
      var wBtnSecBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
      var wBtnSecBorder = isDark ? '#92400e' : '#d97706';
      var pageUrl = (data.meta && data.meta.url) || '';
      warningHtml = '<div style="padding:16px 20px;background:' + wBg + ';border:2px solid ' + wBorder + ';border-radius:var(--radius);margin-bottom:16px;font-size:14px;line-height:1.6">' +
        '<strong style="color:' + wStrong + ';font-size:15px">' + reason + '</strong>' +
        '<p style="color:' + wText + ';margin:6px 0">The URL analysis reads only static HTML and CSS. JavaScript is not executed for your security. ' +
        'Sites built with JS frameworks (React, Angular, Vue), or protected by Cloudflare/login, will appear empty.</p>' +
        '<p style="color:' + wText + ';margin:6px 0"><strong>The results below are unreliable</strong> — they score the empty shell, not the actual page.</p>' +
        '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">' +
        '<button onclick="window.__milgSwitchToSnippet()" style="padding:8px 16px;background:' + wBtnBg + ';color:' + wBtnText + ';border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px">' +
        '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' +
        'Use Console Snippet (safe)</button>' +
        (pageUrl ? '<button onclick="window.__milgTryWithJs(\'' + pageUrl.replace(/'/g, "\\'") + '\')" style="padding:8px 16px;background:' + wBtnSecBg + ';color:' + wText + ';border:1px solid ' + wBtnSecBorder + ';border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px">' +
        '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' +
        'Try with JS enabled</button>' : '') +
        '</div>' +
        '<p style="color:' + wText + ';margin:10px 0 0;font-size:12px;opacity:0.8">The console snippet runs in the page\'s own context and captures everything. ' +
        'Trying with JS loads the site in a sandboxed frame — works for most sites but some block framing.</p>' +
        '</div>';
    }

    // Detect exclusion patterns (use original data so they persist after re-scoring)
    var suggestionsHtml = '';
    var isCrawlPage = skipExclusionDetection === 'crawl-page';
    if (isCrawlPage) {
      // No exclusion suggestions for crawl pages
    } else if (!skipExclusionDetection) {
      var patterns = detectExclusionPatterns(data);
      suggestionsHtml = renderExclusionSuggestions(patterns);
    } else {
      suggestionsHtml = '<div class="exclusion-suggestions" style="padding:8px 12px;font-size:12px;display:flex;align-items:center;justify-content:space-between">' +
        '<span style="color:var(--text-secondary)">Showing filtered results (some elements excluded)</span>' +
        '<button class="btn" style="font-size:11px;padding:4px 10px;min-height:28px" onclick="window.__milgResetExclusions()">Reset exclusions</button>' +
        '</div>';
    }

    reportContainer.innerHTML = warningHtml + suggestionsHtml + MilgReport.renderReport(reportData);
    reportContainer.classList.add('visible');
    inputSection.style.display = 'none';
    document.getElementById('reportActions').style.display = 'flex';
    // Hide crawl containers when showing single-page results (unless crawl session is active)
    var _isCrawlDriven = MilgCrawlUI.getCrawlSession() && MilgCrawlUI.getCrawlSession().pages && MilgCrawlUI.getCrawlSession().pages.length > 0;
    if (!_isCrawlDriven) {
      var cr = document.getElementById('crawlResults'); if (cr) cr.style.display = 'none';
      var cpc = document.getElementById('crawlPageContent'); if (cpc) cpc.style.display = 'none';
    }

    // Save to history (skip re-scores from exclusions)
    if (!skipExclusionDetection) {
      saveToHistory(data, reportData.overall, reportData.grade);
    }

    // Run pixel contrast verification asynchronously (if enabled + screenshots + bboxes available)
    var pixelVerifyCheck = document.getElementById('pixelVerifyCheck');
    var wantPixelVerify = pixelVerifyCheck ? pixelVerifyCheck.checked : true;
    if (wantPixelVerify && window.MilgContrastVerify && reportData.raw && reportData.raw.screenshots && reportData.raw.screenshotMeta) {
      MilgContrastVerify.verify(reportData, function(results, bboxEdgeResults) {
        if (results.length === 0 && (!bboxEdgeResults || bboxEdgeResults.length === 0)) return;
        var summary = MilgContrastVerify.buildSummary(results, bboxEdgeResults);
        var summaryHtml = MilgContrastVerify.renderSummaryHtml(summary);
        if (!summaryHtml) return;
        // Inject after the screenshots section in the report
        var screenshotDetails = reportContainer.querySelector('.report-screenshots');
        if (screenshotDetails) {
          var div = document.createElement('div');
          div.innerHTML = summaryHtml;
          screenshotDetails.parentNode.insertBefore(div, screenshotDetails.nextSibling);
        } else {
          // No screenshot section visible — prepend to report
          var div = document.createElement('div');
          div.innerHTML = summaryHtml;
          reportContainer.insertBefore(div, reportContainer.firstChild);
        }
        // Store results for viewer tooltips
        reportData._contrastVerifyResults = results;
        reportData._bboxEdgeResults = bboxEdgeResults || [];
      });
    }
  }

  // --- UI Initialization ---
  function init() {
    applyDarkMode();

    var pasteInput = document.getElementById('pasteInput');
    var analyzeBtn = document.getElementById('analyzeBtn');
    var htmlInput = document.getElementById('htmlInput');
    var analyzeHtmlBtn = document.getElementById('analyzeHtmlBtn');
    var reportContainer = document.getElementById('reportContainer');
    var inputSection = document.getElementById('inputSection');
    var snippetCode = document.getElementById('snippetCode');
    var copySnippetBtn = document.getElementById('copySnippetBtn');
    var newAnalysisBtn = document.getElementById('newAnalysisBtn');
    var printBtn = document.getElementById('printBtn');
    var analyzeUrlBtn = document.getElementById('analyzeUrlBtn');
    var urlInput = document.getElementById('urlInput');
    var urlStatus = document.getElementById('urlStatus');
    // Store original input section HTML so we can restore it after preview analysis
    var _originalInputSectionHTML = inputSection.innerHTML;

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // Snippet loading with crawl + screenshot options
    var sharedScreenshotCheck = document.getElementById('screenshotCheck');
    var snippetCrawlCheck = document.getElementById('snippetCrawlCheck');
    var snippetCrawlMaxPages = document.getElementById('snippetCrawlMaxPages');

    function reloadSnippet() {
      var crawlOn = snippetCrawlCheck && snippetCrawlCheck.checked;
      var withScreenshots = sharedScreenshotCheck && sharedScreenshotCheck.checked;
      var wantInlineVerify = document.getElementById('pixelVerifyCheck') && document.getElementById('pixelVerifyCheck').checked;
      loadSnippet(snippetCode, withScreenshots, function() {
        var prefix = '';
        if (wantInlineVerify) prefix += 'window.__milgPixelVerify=true;\n';
        if (crawlOn) {
          var maxP = (snippetCrawlMaxPages && parseInt(snippetCrawlMaxPages.value)) || 5;
          prefix += 'window.__milgCrawlSite=true; window.__milgCrawlMaxPages=' + maxP + ';\n';
        }
        if (prefix) snippetCode.textContent = prefix + snippetCode.textContent;
      });
    }
    reloadSnippet();

    // Pixel verify requires screenshots — disable when screenshots unchecked
    var pixelVerifyCheck = document.getElementById('pixelVerifyCheck');
    function syncPixelVerify() {
      if (!pixelVerifyCheck || !sharedScreenshotCheck) return;
      if (!sharedScreenshotCheck.checked) {
        pixelVerifyCheck.checked = false;
        pixelVerifyCheck.disabled = true;
        pixelVerifyCheck.parentElement.style.opacity = '0.4';
      } else {
        pixelVerifyCheck.disabled = false;
        pixelVerifyCheck.parentElement.style.opacity = '';
      }
    }
    syncPixelVerify();

    if (sharedScreenshotCheck) {
      sharedScreenshotCheck.addEventListener('change', function() {
        syncPixelVerify();
        reloadSnippet();
      });
    }
    if (pixelVerifyCheck) {
      pixelVerifyCheck.addEventListener('change', reloadSnippet);
    }
    if (snippetCrawlCheck) {
      snippetCrawlCheck.addEventListener('change', function() {
        if (snippetCrawlMaxPages) snippetCrawlMaxPages.style.display = snippetCrawlCheck.checked ? '' : 'none';
        reloadSnippet();
      });
    }
    if (snippetCrawlMaxPages) {
      snippetCrawlMaxPages.addEventListener('change', reloadSnippet);
    }

    // Copy snippet
    copySnippetBtn.addEventListener('click', function() {
      var text = snippetCode.textContent;
      navigator.clipboard.writeText(text).then(function() {
        showToast('Snippet copied to clipboard!');
      });
    });

    // Analyze JSON
    analyzeBtn.addEventListener('click', function() {
      var json = pasteInput.value.trim();
      if (!json) { showToast('Paste the extracted JSON data first'); return; }
      try {
        var data = JSON.parse(json);
        // Detect multi-page crawl format
        if (data._milgCrawl && data.results) {
          MilgCrawlUI.loadCrawlResults(data, 'pasted crawl data');
          return;
        }
        if (!data.meta || !data.colors) throw new Error('Invalid format');
        data.meta._inputMethod = 'console';
        runAnalysis(data);
      } catch(e) {
        showToast('Invalid JSON: ' + e.message);
      }
    });

    // Analyze pasted HTML
    analyzeHtmlBtn.addEventListener('click', function() {
      var html = htmlInput.value.trim();
      if (!html) { showToast('Paste HTML source code first'); return; }
      analyzeHtmlBtn.textContent = 'Analyzing...';
      analyzeHtmlBtn.disabled = true;
      var wantScreenshots = document.getElementById('screenshotCheck') && document.getElementById('screenshotCheck').checked;
      MilgIframe.analyzeHtmlInIframe(html, function(data) {
        analyzeHtmlBtn.textContent = 'Analyze HTML';
        analyzeHtmlBtn.disabled = false;
        data.meta._inputMethod = 'paste';
        runAnalysis(data);
      }, null, null, wantScreenshots);
    });

    // Analyze URL
    analyzeUrlBtn.addEventListener('click', function() {
      var url = (urlInput.value || '').trim();
      if (!url) { showToast('Enter a URL first'); return; }
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      // Normalize: add www. if bare domain
      try {
        var parsed = new URL(url);
        if (!parsed.hostname.startsWith('www.') && parsed.hostname.split('.').length === 2 && !parsed.hostname.includes('localhost')) {
          url = parsed.protocol + '//www.' + parsed.hostname + parsed.pathname + parsed.search + parsed.hash;
        }
      } catch(e) {}
      urlInput.value = url;

      // Crawl mode intercept
      if (MilgCrawlUI.isCrawlMode()) { MilgCrawlUI.startCrawl(url); return; }

      analyzeUrlBtn.disabled = true;
      analyzeUrlBtn.textContent = 'Fetching...';
      urlStatus.style.display = 'block';
      urlStatus.textContent = 'Fetching page via CORS proxy...';
      showProgress(5, 'Fetching page...');

      MilgProxy.fetchViaProxy(url, function(html, err) {
        if (err || !html) {
          analyzeUrlBtn.disabled = false;
          analyzeUrlBtn.textContent = 'Analyze URL';
          urlStatus.innerHTML = '<span style="color:#dc2626">Could not fetch: ' + (err || 'empty response') + '</span><br><span style="font-size:12px">Try the Console Snippet tab for pages behind login, localhost, or sites that block proxies.</span>';
          hideProgress();
          return;
        }
        urlStatus.textContent = 'Rendering and analyzing...';
        showProgress(20, 'Rendering page...');
        var exclude = window.__milgCombinedExclude || (document.getElementById('excludeSelector').value || '').trim();

        // JS-enabled mode: inject sandbox + URL patches, run page's JS
        var jsCheck = document.getElementById('jsEnabledCheck');
        var jsAck = document.getElementById('jsRiskAck');
        var wantJs = jsCheck && jsCheck.checked && jsAck && jsAck.checked;
        if (wantJs) {
          urlStatus.textContent = 'Running with JavaScript enabled...';
          showProgress(25, 'Preparing sandbox...');
          MilgProxy.analyzeWithJs(html, url, {
            onProgress: function(pct, label) { showProgress(pct, label); },
            onDone: function(data) {
              analyzeUrlBtn.disabled = false;
              analyzeUrlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Analyze URL';
              urlStatus.style.display = 'none';
              showProgress(100, 'Done!');
              setTimeout(hideProgress, 500);
              runAnalysis(data);
            },
            exclude: exclude
          });
          return;
        }

        var isDeepScan = document.getElementById('deepScanCheck') && document.getElementById('deepScanCheck').checked;
        if (isDeepScan) {
          // Build viewport list: current + presets, skip duplicates
          var curW = window.innerWidth, curH = window.innerHeight;
          var presets = [{w:1280,h:900,label:'Desktop'},{w:768,h:1024,label:'Tablet'},{w:375,h:812,label:'Phone'}];
          var viewports = [{w:curW,h:curH,label:'Current (' + curW + '×' + curH + ')'}];
          presets.forEach(function(p) {
            if (Math.abs(curW - p.w) < 50 && Math.abs(curH - p.h) < 50) return;
            viewports.push(p);
          });
          var deepRawResults = [];
          var vpIdx = 0;
          var totalSteps = viewports.length + 1;
          (function nextVP() {
            if (vpIdx >= viewports.length) {
              var primary = deepRawResults[0];
              for (var pi = 0; pi < deepRawResults.length && !primary; pi++) primary = deepRawResults[pi];
              if (!primary) {
                analyzeUrlBtn.disabled = false;
                analyzeUrlBtn.textContent = 'Analyze URL';
                urlStatus.innerHTML = '<span style="color:#dc2626">Deep scan failed — no viewport returned data.</span>';
                hideProgress();
                return;
              }
              primary.deepScan = {
                viewports: deepRawResults.map(function(r, i) {
                  return r ? {
                    label: viewports[i].label, width: viewports[i].w,
                    touchTargets: (r.interaction.touchTargets || []).length,
                    contrastFails: (r.colors.contrastPairs || []).filter(function(p) { return !p.passes; }).length,
                    overflow: r.structure.hasHorizontalOverflow || false,
                    hasScreenshots: !!(r.screenshots && r.screenshots.length > 0)
                  } : { label: viewports[i].label, width: viewports[i].w, error: true };
                }),
                viewportData: deepRawResults.map(function(r, i) {
                  return r ? { label: viewports[i].label, width: viewports[i].w, data: r } : null;
                })
              };
              // Dark mode test
              var htmlHasDark = /class="[^"]*dark:/.test(html) || /prefers-color-scheme/.test(html) || /\.dark\s*\{/.test(html) || /data-theme/.test(html);
              if (htmlHasDark) {
                urlStatus.textContent = 'Testing dark mode...';
                showProgress(Math.round(80 + 15 * (vpIdx / totalSteps)), 'Testing dark mode...');
                var darkHtml = html.replace(/<html([^>]*)>/i, '<html$1 class="dark" data-theme="dark" style="color-scheme:dark">');
                darkHtml = darkHtml.replace(/<\/head>/i, '<script>setTimeout(function(){try{Array.from(document.styleSheets).forEach(function(ss){try{var darkRules=[];Array.from(ss.cssRules).forEach(function(r){if(r instanceof CSSMediaRule&&/prefers-color-scheme:\\s*dark/.test(r.conditionText||"")){Array.from(r.cssRules).forEach(function(inner){darkRules.push(inner.cssText)})}});if(darkRules.length>0){var s=document.createElement("style");s.textContent=darkRules.join("\\n");document.head.appendChild(s)}}catch(e){}});}catch(e){}},100);</' + 'script></head>');
                MilgIframe.analyzeHtmlInIframe(darkHtml, function(darkData) {
                  if (darkData) {
                    primary.deepScan.darkMode = {
                      contrastFails: (darkData.colors.contrastPairs || []).filter(function(p) { return !p.passes; }).length,
                      contrastTotal: (darkData.colors.contrastPairs || []).length,
                      tested: true
                    };
                  }
                  analyzeUrlBtn.disabled = false;
                  analyzeUrlBtn.textContent = 'Analyze URL';
                  urlStatus.style.display = 'none';
                  showProgress(100, 'Done!');
                  setTimeout(hideProgress, 500);
                  primary.meta.url = url;
                  primary.meta._inputMethod = 'url';
                  runAnalysis(primary);
                }, url, exclude, false, { w: 1280, h: 900 });
              } else {
                analyzeUrlBtn.disabled = false;
                analyzeUrlBtn.textContent = 'Analyze URL';
                urlStatus.style.display = 'none';
                showProgress(100, 'Done!');
                setTimeout(hideProgress, 500);
                primary.meta.url = url;
                primary.meta._inputMethod = 'url';
                runAnalysis(primary);
              }
              return;
            }
            var vp = viewports[vpIdx];
            var pct = 20 + Math.round(60 * (vpIdx / totalSteps));
            urlStatus.textContent = 'Deep scan: ' + vp.label + ' (' + vp.w + 'px)...';
            showProgress(pct, 'Scanning ' + vp.label + '...');
            var deepWantShots = document.getElementById('screenshotCheck') && document.getElementById('screenshotCheck').checked;
            MilgIframe.analyzeHtmlInIframe(html, function(data) {
              if (data) data.meta.url = url;
              deepRawResults.push(data);
              vpIdx++;
              nextVP();
            }, url, exclude, deepWantShots, { w: vp.w, h: vp.h });
          })();
          return;
        }
        showProgress(40, 'Analyzing styles...');
        var wantShots = document.getElementById('screenshotCheck') && document.getElementById('screenshotCheck').checked;
        MilgIframe.analyzeHtmlInIframe(html, function(data) {
          analyzeUrlBtn.disabled = false;
          analyzeUrlBtn.textContent = 'Analyze URL';
          urlStatus.style.display = 'none';
          showProgress(100, 'Done!');
          setTimeout(hideProgress, 500);
          data.meta.url = url;
          data.meta._inputMethod = 'url';
          runAnalysis(data);
        }, url, exclude, wantShots);
      });
    });

    // Allow Enter key in URL input
    urlInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); analyzeUrlBtn.click(); }
    });

    // JS-enabled checkbox — toggle warning panel + disable analyze until acknowledged
    var jsEnabledCheck = document.getElementById('jsEnabledCheck');
    var jsEnabledOptions = document.getElementById('jsEnabledOptions');
    var jsRiskAck = document.getElementById('jsRiskAck');
    function syncJsGate() {
      if (!jsEnabledCheck) return;
      var needsAck = jsEnabledCheck.checked && (!jsRiskAck || !jsRiskAck.checked);
      analyzeUrlBtn.disabled = needsAck;
      analyzeUrlBtn.title = needsAck ? 'Check "I understand the risk" to enable' : '';
    }
    if (jsEnabledCheck && jsEnabledOptions) {
      jsEnabledCheck.addEventListener('change', function() {
        jsEnabledOptions.style.display = jsEnabledCheck.checked ? '' : 'none';
        if (!jsEnabledCheck.checked && jsRiskAck) jsRiskAck.checked = false;
        syncJsGate();
      });
      // Restore risk ack from session
      if (jsRiskAck && sessionStorage.getItem('milg-js-risk-ack') === 'true') {
        jsRiskAck.checked = true;
      }
      if (jsRiskAck) {
        jsRiskAck.addEventListener('change', function() {
          try { sessionStorage.setItem('milg-js-risk-ack', jsRiskAck.checked ? 'true' : 'false'); } catch(e) {}
          syncJsGate();
        });
      }
      // Initial state (handles restored session ack)
      syncJsGate();
    }
    // JS snippet switch button
    var jsSnippetBtn = document.getElementById('jsSnippetBtn');
    if (jsSnippetBtn) {
      jsSnippetBtn.addEventListener('click', function() {
        if (jsEnabledCheck) jsEnabledCheck.checked = false;
        if (jsEnabledOptions) jsEnabledOptions.style.display = 'none';
        // Switch to snippet tab
        var snippetTab = document.querySelector('[data-tab="tabSnippet"]');
        if (snippetTab) snippetTab.click();
      });
    }

    // Deep scan checkbox — toggle viewport row visibility
    var deepScanCheck = document.getElementById('deepScanCheck');
    var viewportRow = document.getElementById('viewportRow');
    if (deepScanCheck && viewportRow) {
      deepScanCheck.addEventListener('change', function() {
        viewportRow.classList.toggle('hidden', deepScanCheck.checked);
      });
    }

    // Exclude preset tags — toggle on click, build selector
    document.querySelectorAll('.exclude-tag').forEach(function(tag) {
      tag.addEventListener('click', function() {
        tag.classList.toggle('active');
        syncExcludeSelector();
      });
    });

    function syncExcludeSelector() {
      var parts = [];
      document.querySelectorAll('.exclude-tag.active').forEach(function(tag) {
        parts.push(tag.dataset.selector);
      });
      var custom = (document.getElementById('excludeSelector').value || '').trim();
      if (custom) parts.push(custom);
      window.__milgCombinedExclude = parts.join(', ');
    }

    document.getElementById('excludeSelector').addEventListener('input', syncExcludeSelector);

    // Profile selector — re-score when changed
    document.getElementById('profileSelect').addEventListener('change', function() {
      // Re-score crawl pages when profile changes
      if (MilgCrawlUI.rescorePages()) return;
      if (lastRawData) runAnalysis(lastRawData);
    });

    // Profile info toggle
    document.getElementById('profileInfoBtn').addEventListener('click', function() {
      var el = document.getElementById('profileExplanation');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    });

    // New analysis
    newAnalysisBtn.addEventListener('click', function() {
      reportContainer.classList.remove('visible');
      reportContainer.innerHTML = '';
      inputSection.style.display = '';
      // Restore original input form if it was replaced (e.g. by editor preview analysis)
      if (!inputSection.querySelector('.tab-btn')) {
        inputSection.innerHTML = _originalInputSectionHTML;
        // Re-bind tab switching after DOM restoration
        inputSection.querySelectorAll('.tab-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            inputSection.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            inputSection.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            btn.classList.add('active');
            var target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
          });
        });
      }
      document.getElementById('reportActions').style.display = 'none'; document.getElementById('profileExplanation').style.display = 'none';
      var pi = document.getElementById('pasteInput'); if (pi) pi.value = '';
      var hi = document.getElementById('htmlInput'); if (hi) hi.value = '';
      var ui = document.getElementById('urlInput'); if (ui) ui.value = '';
      var us = document.getElementById('urlStatus'); if (us) us.style.display = 'none';
      reportData = null;
      // Reset crawl state
      MilgCrawlUI.setCrawlSession(null);
      MilgCrawlUI.resetCrawlState();
      // Re-check JS gate (button may need to be disabled if JS checkbox is still checked)
      syncJsGate();
      // Clear hash so refreshing doesn't reload old report
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    });

    // Markdown export (download)
    document.getElementById('markdownBtn').addEventListener('click', function() {
      if (!reportData) return;
      var md = MilgReport.renderMarkdown(reportData);
      var blob = new Blob([md], { type: 'text/markdown' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'design-report.md';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Markdown report downloaded');
    });

    // Copy markdown to clipboard (without images for easy pasting)
    document.getElementById('copyMdBtn').addEventListener('click', function() {
      if (!reportData) return;
      var md = MilgReport.renderMarkdown(reportData, { skipImages: true });
      navigator.clipboard.writeText(md).then(function() {
        showToast('Markdown copied (without images)');
      }).catch(function() {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = md;
        ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Markdown copied to clipboard');
      });
    });

    // Print/PDF
    printBtn.addEventListener('click', function() {
      window.print();
    });

    // Export JSON — save analysis data for re-import or sharing
    document.getElementById('exportJsonBtn').addEventListener('click', function() {
      if (!lastRawData) return;
      var exportData = JSON.parse(JSON.stringify(lastRawData, function(k, v) { return k === 'viewportData' ? undefined : v; }));
      // Include pixel verify results if available
      if (reportData && reportData._contrastVerifyResults) {
        exportData._contrastVerifyResults = reportData._contrastVerifyResults.map(function(r) {
          var copy = Object.assign({}, r);
          delete copy._debug; // strip debug data to reduce size
          delete copy.samplePoints; // strip per-pixel data
          return copy;
        });
      }
      if (reportData && reportData._bboxEdgeResults) {
        exportData._bboxEdgeResults = reportData._bboxEdgeResults;
      }
      var json = JSON.stringify(exportData, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var siteName = (exportData.meta && exportData.meta.url) || 'analysis';
      a.download = 'milg-report-' + siteName.replace(/[^a-z0-9]/gi, '-').substring(0, 40) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Analysis JSON exported');
    });

    // Import JSON — load a previously exported analysis (report action bar + drop zone)
    var importFileInput = document.getElementById('importJsonFile');
    function handleImportFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var data = JSON.parse(reader.result);
          if (!data.meta || !data.colors) throw new Error('Invalid format');
          runAnalysis(data);
          showToast('Analysis imported: ' + (data.meta.url || 'unknown'));
        } catch(e) {
          showToast('Invalid JSON: ' + e.message);
        }
      };
      reader.readAsText(file);
    }

    // Drop zone (Import tab)
    var dropzone = document.getElementById('importDropzone');
    var dropFileInput = document.getElementById('importDropFile');
    if (dropzone) {
      dropzone.addEventListener('click', function() { dropFileInput.click(); });
      dropFileInput.addEventListener('change', function() { handleImportFile(dropFileInput.files[0]); dropFileInput.value = ''; });
      dropzone.addEventListener('dragover', function(e) { e.preventDefault(); dropzone.classList.add('dragover'); });
      dropzone.addEventListener('dragleave', function() { dropzone.classList.remove('dragover'); });
      dropzone.addEventListener('drop', function(e) { e.preventDefault(); dropzone.classList.remove('dragover'); if (e.dataTransfer.files.length > 0) handleImportFile(e.dataTransfer.files[0]); });
    }
    document.getElementById('importJsonBtn').addEventListener('click', function() {
      importFileInput.click();
    });
    importFileInput.addEventListener('change', function() {
      handleImportFile(importFileInput.files[0]);
      importFileInput.value = '';
    });

    // Dark mode toggle
    document.getElementById('darkBtn').addEventListener('click', function() {
      darkMode = !darkMode;
      localStorage.setItem('milg-dark', darkMode);
      applyDarkMode();
    });

    // Check for HTML from editor "Analyze preview" button — auto-analyze with screenshots
    if (location.hash === '#analyze-html') {
      try {
        var previewHtml = sessionStorage.getItem('milg-preview-html');
        if (previewHtml) {
          sessionStorage.removeItem('milg-preview-html');
          var previewCtx = {};
          try { previewCtx = JSON.parse(sessionStorage.getItem('milg-preview-context') || '{}'); } catch(e) {}
          sessionStorage.removeItem('milg-preview-context');
          var ctxLabel = (previewCtx.dark ? ' (dark mode)' : '') + (previewCtx.effectName && previewCtx.effectName !== 'None' ? ' + ' + previewCtx.effectName : '');
          inputSection.innerHTML = '<div style="text-align:center;padding:64px 24px"><div class="analysis-progress" style="display:block;max-width:400px;margin:0 auto"><div class="analysis-progress-bar"><div class="analysis-progress-fill" style="width:30%;animation:pulse 1.5s ease infinite"></div></div><div class="analysis-progress-label" style="margin-top:12px;font-size:14px">Analyzing editor preview' + ctxLabel + '...</div></div></div>';
          MilgIframe.analyzeHtmlInIframe(previewHtml, function(data) {
            data.meta.url = 'Editor Preview' + ctxLabel;
            data.meta._inputMethod = 'editor';
            runAnalysis(data);
          }, previewCtx.dark || false, previewCtx.effectCSS || '', true);
        }
      } catch(e) {
        console.error('Failed to analyze preview HTML:', e);
      }
    } else if (location.hash === '#preview') {
      try {
        var previewJson = sessionStorage.getItem('milg-preview-data');
        if (previewJson) {
          sessionStorage.removeItem('milg-preview-data');
          var data = JSON.parse(previewJson);
          data.meta.url = 'Editor Preview';
          runAnalysis(data);
        }
      } catch(e) {
        console.error('Failed to load preview data:', e);
      }
    } else if (location.hash.startsWith('#data=')) {
      try {
        var compressed = location.hash.substring(6);
        var json = decodeURIComponent(atob(compressed));
        var data = JSON.parse(json);
        runAnalysis(data);
      } catch(e) {
        console.error('Failed to load data from hash:', e);
      }
    }

    // Listen for postMessage from editor
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'milg-analyze-data') {
        runAnalysis(e.data.data);
      }
    });

    // Render analysis history
    var historyHtml = renderHistoryList();
    if (historyHtml) {
      var historyContainer = document.createElement('div');
      historyContainer.innerHTML = historyHtml;
      document.getElementById('inputSection').appendChild(historyContainer);
    }

    // Populate URL datalist from history for autocomplete
    var urlDatalist = document.getElementById('urlHistory');
    if (urlDatalist) {
      var history = getHistory();
      var seenUrls = {};
      history.forEach(function(entry) {
        var url = entry.url || '';
        if (url && url !== 'Editor Preview' && url !== 'Pasted HTML' && !seenUrls[url]) {
          seenUrls[url] = true;
          var opt = document.createElement('option');
          opt.value = url;
          urlDatalist.appendChild(opt);
        }
      });
    }

    // --- Initialize Crawl UI module ---
    MilgCrawlUI.setup({
      showToast: showToast,
      runAnalysis: runAnalysis,
      analyzeUrlBtn: analyzeUrlBtn
    });
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
