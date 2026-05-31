// make-it-look-good — Design Analyzer (Main UI Controller) v1.1
// Depends on: analyzer-report.js (MilgReport), analyzer-crawl.js (MilgCrawl),
//             analyzer-extract.js (MilgExtract), analyzer-iframe.js (MilgIframe),
//             analyzer-proxy.js (MilgProxy), analyzer-crawl-ui.js (MilgCrawlUI)
console.log('[milg] analyzer.js v3.11.13 loaded');

(function() {
  "use strict";

  var MILG_EXPORT_VERSION = '1.6';
  window.MILG_EXPORT_VERSION = MILG_EXPORT_VERSION;

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

  // --- Debug ---
  var _debug = (location.search.indexOf('debug') !== -1) || localStorage.getItem('milg-debug') === 'true';
  function _log() { if (_debug) console.log.apply(console, arguments); }

  // --- Diagnostic log capture (filtered, for copy-to-clipboard) ---
  var _diagLogs = [];
  var _diagPrefixes = ['[D]', '[milg-verify]', '[milg-region]', '[milg]'];
  (function() {
    var _origLog = console.log;
    var _origWarn = console.warn;
    console.log = function() {
      _origLog.apply(console, arguments);
      var msg = Array.prototype.join.call(arguments, ' ');
      for (var i = 0; i < _diagPrefixes.length; i++) {
        if (msg.indexOf(_diagPrefixes[i]) !== -1) { _diagLogs.push(msg); break; }
      }
    };
    console.warn = function() {
      _origWarn.apply(console, arguments);
      var msg = Array.prototype.join.call(arguments, ' ');
      if (msg.indexOf('[milg') !== -1) _diagLogs.push('WARN: ' + msg);
    };
  })();
  window._milgCopyDiag = function() {
    var text = document.querySelector('h1 span').textContent.trim() + '\n' + _diagLogs.join('\n');
    navigator.clipboard.writeText(text).then(function() { alert('Copied ' + _diagLogs.length + ' diagnostic lines'); });
    return text;
  };

  // --- State ---
  var reportData = null;
  var darkMode = localStorage.getItem('milg-dark') === 'true';
  var lastRawData = null;
  var _originalRawData = null;
  var _activeViewportIdx = 0;
  var _verifyInProgress = false; // guard against concurrent verify runs
  var _verifyGeneration = 0; // incremented each runAnalysis to invalidate stale verify callbacks

  // --- Utility functions (shared with modules) ---
  function applyDarkMode() {
    document.body.classList.toggle('dark-ui', darkMode);
    document.getElementById('darkBtn').classList.toggle('active', darkMode);
  }

  function _showEphemeralBanner() {
    var b = document.getElementById('ephemeralBanner');
    if (b) b.style.display = 'flex';
  }
  function _hideEphemeralBanner() {
    var b = document.getElementById('ephemeralBanner');
    if (b) b.style.display = 'none';
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

  // --- Focus modal: warns users that Chrome throttles background tabs ---
  // --- Focus modal with live progress log ---
  var _focusModal = null;
  var _focusModalLog = null;
  function showFocusModal(dismissable) {
    if (_focusModal) return;
    var isDark = document.body.classList.contains('dark-ui');
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:' + (isDark ? '#1e293b' : '#fff') + ';border-radius:12px;padding:24px 32px;max-width:500px;width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.3);color:' + (isDark ? '#e2e8f0' : '#1e293b') + ';position:relative;';
    box.innerHTML = (dismissable ? '<button onclick="this.closest(\'div[style*=fixed]\').remove();window._milgFocusModalDismissed=true" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:22px;cursor:pointer;color:' + (isDark ? '#94a3b8' : '#64748b') + ';line-height:1" title="Dismiss and browse results">&times;</button>' : '') +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
        '<div class="milg-spinner" style="width:20px;height:20px;border:2px solid ' + (isDark ? '#475569' : '#e2e8f0') + ';border-top-color:' + (isDark ? '#60a5fa' : '#2563eb') + ';border-radius:50%;animation:milg-spin 0.8s linear infinite"></div>' +
        '<div style="font-size:16px;font-weight:700">Deep analysis in progress</div>' +
      '</div>' +
      '<div style="font-size:12px;color:' + (isDark ? '#fbbf24' : '#d97706') + ';margin-bottom:12px">' +
        'Keep this tab in the foreground — Chrome throttles background tabs.' +
      '</div>' +
      '<pre id="focusModalLog" style="font-family:var(--mono,monospace);font-size:11px;line-height:1.6;' +
        'background:' + (isDark ? '#0f172a' : '#f8fafc') + ';border:1px solid ' + (isDark ? '#334155' : '#e2e8f0') + ';' +
        'border-radius:6px;padding:8px 12px;max-height:200px;overflow-y:auto;color:' + (isDark ? '#94a3b8' : '#64748b') + ';' +
        'margin:0;white-space:pre-wrap;word-break:break-word">' +
        'Starting...</pre>' +
      '<style>' +
        '@keyframes milg-spin{to{transform:rotate(360deg)}}' +
        '#focusModalLog::-webkit-scrollbar{width:6px}' +
        '#focusModalLog::-webkit-scrollbar-track{background:' + (isDark ? '#1e293b' : '#f1f5f9') + ';border-radius:3px}' +
        '#focusModalLog::-webkit-scrollbar-thumb{background:' + (isDark ? '#475569' : '#cbd5e1') + ';border-radius:3px}' +
        '#focusModalLog::-webkit-scrollbar-thumb:hover{background:' + (isDark ? '#64748b' : '#94a3b8') + '}' +
        '#focusModalLog{scrollbar-width:thin;scrollbar-color:' + (isDark ? '#475569 #1e293b' : '#cbd5e1 #f1f5f9') + '}' +
      '</style>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    _focusModal = overlay;
    _focusModalLog = box.querySelector('#focusModalLog');
  }
  var _lastModalMsg = '';
  var _lastModalStart = 0;
  var _modalTimer = null;
  function updateFocusModal(msg) {
    if (window._milgFocusModalDismissed) { _focusModal = null; _focusModalLog = null; return; }
    if (!_focusModalLog) return;
    if (msg === _lastModalMsg) return; // same message, timer handles it
    // Finalize previous step with elapsed time
    _finalizeModalStep();
    _lastModalMsg = msg;
    _lastModalStart = Date.now();
    _focusModalLog.textContent += msg;
    // Start a live timer that updates the current line every second
    clearInterval(_modalTimer);
    _modalTimer = setInterval(function() {
      if (!_focusModalLog) { clearInterval(_modalTimer); return; }
      var elapsed = Math.round((Date.now() - _lastModalStart) / 1000);
      if (elapsed < 2) return; // don't show for quick steps
      var lines = _focusModalLog.textContent.split('\n');
      if (lines.length > 0) {
        var lastLine = lines[lines.length - 1];
        // Strip old timer suffix
        var base = lastLine.replace(/ \(\d+s\)$/, '');
        lines[lines.length - 1] = base + ' (' + elapsed + 's)';
        _focusModalLog.textContent = lines.join('\n');
      }
      _focusModalLog.scrollTop = _focusModalLog.scrollHeight;
    }, 1000);
    _focusModalLog.scrollTop = _focusModalLog.scrollHeight;
  }
  function _finalizeModalStep() {
    if (!_focusModalLog || !_lastModalMsg) return;
    clearInterval(_modalTimer);
    var elapsed = Math.round((Date.now() - _lastModalStart) / 1000);
    var lines = _focusModalLog.textContent.split('\n');
    if (lines.length > 0) {
      var base = lines[lines.length - 1].replace(/ \(\d+s\)$/, '');
      lines[lines.length - 1] = base + (elapsed >= 2 ? ' (' + elapsed + 's)' : '');
      _focusModalLog.textContent = lines.join('\n') + '\n';
    }
  }
  function hideFocusModal() {
    _finalizeModalStep();
    clearInterval(_modalTimer);
    _lastModalMsg = '';
    if (_focusModal && _focusModal.parentNode) _focusModal.parentNode.removeChild(_focusModal);
    _focusModal = null;
    _focusModalLog = null;
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
  // Manifest: the single place where snippet assembly order is declared.
  // Each variant has a shell file and an ordered list of parts. Each part has a
  // marker name and a source file. The assembler replaces the line-anchored
  // marker `// @milg-insert: <marker>` in the shell with the part's source
  // wrapped in an IIFE. To add a new part (e.g. region/capture) later, add one
  // entry to the relevant `parts` array AND a matching marker line in the shell.
  var SNIPPET_MANIFEST = {
    screenshots: { shell: 'analyzer-snippet-screenshots.js', parts: [ { marker: 'extract', file: 'analyzer-extract.js' }, { marker: 'region', file: 'analyzer-region.js' } ] },
    plain:       { shell: 'analyzer-snippet.js',             parts: [ { marker: 'extract', file: 'analyzer-extract.js' } ] }
  };
  var _snippetCache = {};
  function loadSnippet(codeEl, withScreenshots, callback) {
    var entry = withScreenshots ? SNIPPET_MANIFEST.screenshots : SNIPPET_MANIFEST.plain;
    var file = entry.shell;
    if (_snippetCache[file]) {
      codeEl.textContent = _snippetCache[file];
      if (callback) callback();
      return;
    }
    // Fetch the shell + every part declared in the manifest, then inline each
    // part by replacing its marker line. Keeps the per-fetch hourly cache-bust.
    var cacheBust = '?v=' + Math.floor(Date.now() / 3600000);
    var fetches = [ fetch(file + cacheBust).then(function(r) { return r.text(); }) ];
    entry.parts.forEach(function(part) {
      fetches.push(fetch(part.file + cacheBust).then(function(r) { return r.text(); }));
    });
    Promise.all(fetches).then(function(results) {
      var assembled = results[0];
      entry.parts.forEach(function(part, i) {
        var partText = results[i + 1];
        var marker = '// @milg-insert: ' + part.marker + '\n';
        var replacement = ';(function(){\n' + partText + '\n})();\n';
        // Use a replacer FUNCTION so $-sequences in part source aren't interpreted.
        assembled = assembled.replace(marker, function() { return replacement; });
      });
      _snippetCache[file] = assembled;
      codeEl.textContent = assembled;
      if (callback) callback();
    }).catch(function() {
      codeEl.textContent = '// Failed to load snippet — copy from ' + file;
    });
  }

  // --- Initialize modules ---
  MilgIframe.init({
    screenshotCDN: SCREENSHOT_CDN,
    proxyUrl: CORS_PROXY_URL,
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

  function _settingsKey() {
    var parts = [];
    var profile = document.getElementById('profileSelect');
    if (profile) parts.push(profile.value);
    var deep = document.getElementById('deepScanCheck');
    if (deep && deep.checked) parts.push('deep');
    var vp = document.getElementById('viewportSelect');
    if (vp) parts.push(vp.value);
    var pv = document.getElementById('pixelVerifyCheck');
    if (pv && pv.checked) parts.push('pxv');
    return parts.join('|');
  }

  function saveToHistory(data, score, grade) {
    try {
      var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      var entryUrl = (data.meta && data.meta.url) || 'Unknown';
      var entryProfile = data.profile || 'general';
      var settingsHash = _settingsKey();

      // Dedup: find existing entry with same URL + settings, update it instead of adding duplicate
      var existingIdx = -1;
      for (var i = 0; i < history.length; i++) {
        if (history[i].url === entryUrl && (history[i].settings || '') === settingsHash) {
          existingIdx = i; break;
        }
      }
      if (existingIdx >= 0) {
        // Update existing entry and move to top
        var existing = history.splice(existingIdx, 1)[0];
        existing.timestamp = new Date().toISOString();
        existing.score = score;
        existing.grade = grade;
        existing.title = (data.meta && data.meta.title) || existing.title;
        history.unshift(existing);
      } else {
        var entry = {
          url: entryUrl,
          title: (data.meta && data.meta.title) || '',
          timestamp: new Date().toISOString(),
          score: score,
          grade: grade,
          profile: entryProfile,
          settings: settingsHash,
          elements: (data.structure && data.structure.totalElements) || 0,
          contrastPairs: (data.colors && data.colors.contrastPairs) ? data.colors.contrastPairs.length : 0,
          inputMethod: (data.meta && data.meta._inputMethod) || ''
        };
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
    html += '<h3 style="font-size:14px;font-weight:600;margin-bottom:8px">Recent Analyses</h3>';
    history.forEach(function(entry, idx) {
      var date = new Date(entry.timestamp);
      var dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      var urlShort = (entry.url || '').replace(/^https?:\/\//, '').substring(0, 40);
      var label = entry.title ? entry.title.substring(0, 30) : urlShort;
      var settingsBadges = '';
      if (entry.settings) {
        var parts = entry.settings.split('|');
        parts.forEach(function(p) {
          if (p === 'deep') settingsBadges += '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:var(--accent);color:#fff;margin-left:3px">deep</span>';
          else if (p === 'pxv') settingsBadges += '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#8b5cf6;color:#fff;margin-left:3px">verify</span>';
        });
      }
      html += '<div class="history-item" title="' + (entry.url || '').replace(/"/g, '&quot;') + (entry.elements ? '\n' + entry.elements + ' elements, ' + (entry.contrastPairs || 0) + ' contrast pairs' : '') + (entry.settings ? '\nSettings: ' + entry.settings : '') + '">';
      html += '<span class="history-score" style="color:' + (entry.score >= 80 ? '#16a34a' : entry.score >= 60 ? '#ca8a04' : '#dc2626') + '">' + entry.score + '</span>';
      html += '<span class="history-url">' + label + settingsBadges + '</span>';
      html += '<span class="history-date">' + dateStr + '</span>';
      html += '<button class="history-delete" onclick="event.stopPropagation();window.__milgDeleteHistory(' + idx + ')" title="Remove from history">&times;</button>';
      html += '</div>';
    });
    html += '<p style="font-size:11px;color:var(--text-secondary);margin-top:6px">Score and settings only &mdash; export JSON to keep the full analysis.</p>';
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
    if (history[idx]) {
      showToast('To re-analyze, use Export JSON to save and Load Saved to restore');
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
    var _cloneReplacer = function(key, val) { return key === 'viewportData' ? undefined : val; };
    var filtered = typeof structuredClone === 'function'
      ? (function() { var tmp = lastRawData.deepScan && lastRawData.deepScan.viewportData; if (tmp) lastRawData.deepScan.viewportData = undefined; var c = structuredClone(lastRawData); if (tmp) lastRawData.deepScan.viewportData = tmp; return c; })()
      : JSON.parse(JSON.stringify(lastRawData, _cloneReplacer));
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

  // Open viewer focused on a specific bbox within a finding (from affected elements list)
  window.__milgShowBboxOnScreenshot = function(findingIdx, bboxIdx) {
    if (window.MilgViewer && reportData) {
      MilgViewer.showFindingBbox(findingIdx, bboxIdx, reportData);
    }
  };

  // Open viewer in verify mode focused on a specific selector
  window.__milgShowVerifyOnScreenshot = function(selector) {
    if (!window.MilgViewer || !reportData || !reportData.raw || !reportData.raw.screenshots || !reportData.raw.screenshotMeta) return;
    // Find the verify result matching this selector
    var verifyResults = reportData._contrastVerifyResults || [];
    var match = null;
    verifyResults.forEach(function(vr) { if (vr.selector === selector) match = vr; });
    // Also check bbox edge results
    var bboxEdgeResults = reportData._bboxEdgeResults || [];
    if (!match) bboxEdgeResults.forEach(function(ber) { if (ber.selector === selector) match = ber; });
    if (!match || !match.bbox) return;
    // Open viewer on the correct section
    var meta = reportData.raw.screenshotMeta;
    var sectionIdx = Math.floor(match.bbox.top / meta.viewportHeight);
    sectionIdx = Math.min(sectionIdx, reportData.raw.screenshots.length - 1);
    var dummyImg = document.createElement('img');
    dummyImg.src = reportData.raw.screenshots[0];
    MilgViewer.open(dummyImg, sectionIdx, reportData);
    MilgViewer.showVerifyResult(selector);
  };

  // Viewport switching for deep scan results — cached per viewport index
  var _viewportCache = {}; // idx → { data, reportData }
  window.__milgClearViewportCache = function() { _viewportCache = {}; };
  window.__milgSwitchViewport = function(idx) {
    // Promote this viewport's verify to front of queue
    if (window.MilgQueue) MilgQueue.promote('vp-verify-' + idx);
    if (!lastRawData || !lastRawData.deepScan || !lastRawData.deepScan.viewportData) return;
    var deepScan = lastRawData.deepScan;
    var vpData = deepScan.viewportData[idx];
    if (!vpData || !vpData.data) { showToast('No data for this viewport'); return; }
    _activeViewportIdx = idx;

    var reportContainer = document.getElementById('reportContainer');

    // Cache hit: fast restore (scoring cached, verify precomputed, just re-render)
    if (_viewportCache[idx]) {
      var cached = _viewportCache[idx];
      // runAnalysis with cached scoring + precomputed verify = fast render with overlays
      runAnalysis(cached.data, 'viewport');
      renderViewportTabs(cached.data);
      return;
    }

    // Cache miss: show spinner immediately, defer all heavy work
    renderViewportTabs(lastRawData);
    if (reportContainer) {
      reportContainer.innerHTML = '<div style="padding:60px;text-align:center">' +
        '<div style="width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:milg-spin 0.8s linear infinite;margin:0 auto"></div>' +
        '<div style="color:var(--text-secondary);margin-top:12px;font-size:13px">Loading viewport report\u2026</div>' +
        '<style>@keyframes milg-spin{to{transform:rotate(360deg)}}</style></div>';
      reportContainer.classList.add('visible');
    }
    setTimeout(function() {
      if (_activeViewportIdx !== idx) return; // user switched again
      // Reuse the original data object directly (no deep copy needed — we cache it)
      var srcData = vpData.data;
      // Build a shallow wrapper that has deepScan + correct URL but shares all extraction data
      var switchedData = Object.assign({}, srcData);
      switchedData.deepScan = deepScan;
      switchedData.meta = Object.assign({}, srcData.meta, { url: lastRawData.meta.url });
      // Remove stale scoring cache (force fresh scoring) but preserve pixel verify
      delete switchedData._cachedReportData;
      // Keep _contrastVerifyResults so runAnalysis sees them as precomputed (no re-verify)
      runAnalysis(switchedData, 'viewport');
      // Don't cache yet — verify may run async and update the DOM. Cache after verify completes.
      // For precomputed verify: results are rendered synchronously inside runAnalysis, cache now.
      // For async verify: the verify callback will update the cache (see runAnalysis verify callback).
      if (switchedData._contrastVerifyResults) {
        _viewportCache[idx] = { data: switchedData, reportData: reportData, html: reportContainer ? reportContainer.innerHTML : '' };
      } else {
        // Mark that this viewport needs cache update after verify completes
        switchedData._vpCacheIdx = idx;
      }
    }, 0);
  };

  // Render viewport tab bar (called from runAnalysis when deepScan data present)
  function renderViewportTabs(data) {
    var container = document.getElementById('viewportTabs');
    if (!container) { console.warn('[milg] viewportTabs container not found'); return; }
    if (!data || !data.deepScan || !data.deepScan.viewports || !data.deepScan.viewportData) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    var ds = data.deepScan;
    var isDark = document.body.classList.contains('dark-ui');
    var html = '<div style="display:flex;gap:4px;padding:8px 0;flex-wrap:wrap;align-items:center">';
    html += '<span style="font-size:11px;color:var(--text-secondary);margin-right:4px">Viewport:</span>';
    ds.viewports.forEach(function(vp, idx) {
      var isActive = idx === _activeViewportIdx;
      var isError = vp.error;
      var bg = isActive ? (isDark ? '#334155' : '#e2e8f0') : 'transparent';
      var border = isActive ? 'var(--accent)' : (isDark ? '#475569' : '#cbd5e1');
      var color = isError ? '#ef4444' : (isActive ? 'var(--text-primary)' : 'var(--text-secondary)');
      var cursor = isError ? 'not-allowed' : 'pointer';
      html += '<button onclick="window.__milgSwitchViewport(' + idx + ')" style="';
      html += 'padding:5px 12px;font-size:12px;border-radius:6px;border:1px solid ' + border + ';';
      html += 'background:' + bg + ';color:' + color + ';cursor:' + cursor + ';font-weight:' + (isActive ? '600' : '400') + ';';
      html += 'transition:all 0.15s"' + (isError ? ' disabled' : '') + '>';
      html += vp.label + ' (' + vp.width + 'px)';
      if (vp.error) html += ' ✗';
      if (vp.hasScreenshots) html += ' <span style="font-size:9px;opacity:0.6">📷</span>';
      html += '</button>';
    });
    html += '</div>';
    container.innerHTML = html;
    container.style.display = '';
  }

  // --- Deep scan viewport loop (shared between URL mode and crawl mode) ---
  // Analyzes HTML at ALL viewports IN PARALLEL, assembles deepScan summary, tests dark mode.
  // opts: { jsEnabled, screenshots, exclude } — passed through to analyzeHtml per viewport
  // onProgress(label, done, total) — optional progress callback
  // callback(primaryData) — called with primary result (deepScan attached) or null on failure
  function runDeepScanLoop(html, url, opts, onProgress, callback) {
    var wantShots = opts.screenshots || false;
    var exclude = opts.exclude || null;
    var jsEnabled = opts.jsEnabled || false;

    // No manual preprocessing — analyzeHtml handles it per viewport

    var viewports = [{w:1280, h:900, label:'Desktop'}, {w:768, h:1024, label:'Tablet'}, {w:375, h:812, label:'Phone'}];
    // Add current viewport if different from presets
    var curW = window.innerWidth, curH = window.innerHeight;
    var isDupe = viewports.some(function(p) { return Math.abs(curW - p.w) < 50 && Math.abs(curH - p.h) < 50; });
    if (!isDupe) viewports.unshift({w:curW, h:curH, label:'Current (' + curW + '\u00d7' + curH + ')'});

    var results = new Array(viewports.length);
    var doneCount = 0;
    var totalSteps = viewports.length + 1; // +1 for dark mode test

    function onAllDone() {
      var primary = results[0];
      for (var pi = 0; pi < results.length && !primary; pi++) primary = results[pi];
      if (!primary) { callback(null); return; }
      primary.deepScan = {
        viewports: results.map(function(r, i) {
          return r ? {
            label: viewports[i].label, width: viewports[i].w,
            touchTargets: (r.interaction.touchTargets || []).length,
            contrastFails: (r.colors.contrastPairs || []).filter(function(p) { return !p.passes; }).length,
            overflow: r.structure.hasHorizontalOverflow || false,
            hasScreenshots: !!(r.screenshots && r.screenshots.length > 0)
          } : { label: viewports[i].label, width: viewports[i].w, error: true };
        }),
        viewportData: results.map(function(r, i) {
          return r ? { label: viewports[i].label, width: viewports[i].w, data: r } : null;
        })
      };
      // primary IS results[0] — it already has screenshots, masks, and verify results
      // from the analyzeHtml pipeline. No need to copy from viewportData[0].

      // Dark mode test
      var htmlHasDark = /class="[^"]*dark:/.test(html) || /prefers-color-scheme/.test(html) || /\.dark\s*\{/.test(html) || /data-theme/.test(html);
      if (htmlHasDark) {
        if (onProgress) onProgress('Dark mode', viewports.length, totalSteps);
        var darkHtml = html.replace(/<html([^>]*)>/i, '<html$1 class="dark" data-theme="dark" style="color-scheme:dark">');
        darkHtml = darkHtml.replace(/<\/head>/i, '<script>setTimeout(function(){try{Array.from(document.styleSheets).forEach(function(ss){try{var darkRules=[];Array.from(ss.cssRules).forEach(function(r){if(r instanceof CSSMediaRule&&/prefers-color-scheme:\\s*dark/.test(r.conditionText||"")){Array.from(r.cssRules).forEach(function(inner){darkRules.push(inner.cssText)})}});if(darkRules.length>0){var s=document.createElement("style");s.textContent=darkRules.join("\\n");document.head.appendChild(s)}}catch(e){}});}catch(e){}},100);</' + 'script></head>');
        // Dark mode test: HTML already preprocessed, pass directly to legacy API
        MilgIframe.analyzeHtml(darkHtml, {
          url: url,
          jsEnabled: jsEnabled,
          screenshots: false,
          exclude: exclude,
          viewport: { w: 1280, h: 900 }
        }, function(darkData) {
          if (darkData) {
            primary.deepScan.darkMode = {
              contrastFails: (darkData.colors.contrastPairs || []).filter(function(p) { return !p.passes; }).length,
              contrastTotal: (darkData.colors.contrastPairs || []).length,
              tested: true
            };
          }
          callback(primary);
        });
      } else {
        callback(primary);
      }
    }

    // Prefetch fonts, then launch viewports
    updateFocusModal('Prefetching fonts\u2026');
    MilgIframe.prefetchFonts(html, url || '', function() {
    // Launch ALL viewports in parallel — maximum speed when tab is in foreground.
    // Chrome throttles background tabs (timers → 1/sec, rAF paused), so the focus
    // modal warns users to stay on this tab during analysis.
    _log('[milg] Deep scan: launching', viewports.length, 'viewports', wantShots ? '(with screenshots)' : '');
    updateFocusModal('Scanning ' + viewports.length + ' viewports' + (wantShots ? ' with screenshots' : ''));
    if (onProgress) onProgress('Starting viewports...', 0, totalSteps);
    viewports.forEach(function(vp, i) {
      _log('[milg] Starting viewport', i, vp.label, vp.w + 'x' + vp.h);
      // Same unified analyzeHtml for every path — no legacy wrapper
      MilgIframe.analyzeHtml(html, {
        url: url,
        jsEnabled: jsEnabled,
        screenshots: wantShots,
        exclude: exclude,
        viewport: { w: vp.w, h: vp.h }
      }, function(data) {
        if (data) data.meta.url = url;
        results[i] = data;
        doneCount++;
        var elCount = data ? (data.structure && data.structure.totalElements || 0) : 0;
        var ssCount = data && data.screenshots ? data.screenshots.length : 0;
        _log('[milg] Viewport', i, vp.label, 'complete (' + doneCount + '/' + viewports.length + ') elements=' + elCount + ' screenshots=' + ssCount);
        updateFocusModal(vp.label + ' (' + vp.w + 'px) — ' + elCount + ' elements' + (ssCount ? ', screenshot captured' : ''));
        if (onProgress) onProgress(vp.label + ' done', doneCount, totalSteps);
        if (doneCount === viewports.length) {
          _log('[milg] All viewports done, assembling deepScan');
          updateFocusModal('Assembling multi-viewport results');
          onAllDone();
        }
      });
    });
    }); // end prefetchFonts callback
  }

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

  // Lightweight restore for cached crawl pages — sets globals without re-scoring/re-rendering.
  // The crawl UI calls this on cache hit so viewer interactions and exports work.
  function restoreCachedAnalysis(data, cachedReportData) {
    lastRawData = data;
    reportData = cachedReportData;
  }

  // --- Core analysis runner ---
  function runAnalysis(data, skipExclusionDetection) {
    _verifyGeneration++;
    _verifyInProgress = false; // cancel any in-flight verify from previous analysis
    lastRawData = data;
    if (!_originalRawData || (!skipExclusionDetection && skipExclusionDetection !== 'viewport')) { _originalRawData = data; _viewportCache = {}; }
    // Analysis data saved/restored via Export JSON + Import — no sessionStorage (too large with screenshots/fonts)
    // Apply selected profile
    var profile = document.getElementById('profileSelect');
    if (profile) data.profile = profile.value;
    // Reuse cached scoring for crawl page tabs and viewport switches
    var _isTabSwitch = (skipExclusionDetection === 'crawl-page' || skipExclusionDetection === 'viewport');
    if (_isTabSwitch && data._cachedReportData) {
      reportData = data._cachedReportData;
    } else {
      // Filter out carousel/region content before main scoring so findings only contain main-page elements.
      // Region content gets its own independent scoring below via rgn.regionReport.
      var _origPairs = data.colors ? data.colors.contrastPairs : null;
      var _origTouch = data.interaction ? data.interaction.touchTargets : null;
      var _origHeadings = data.typography ? data.typography.headings : null;
      var _origAlign = data.layout ? data.layout.alignmentElements : null;
      var _origRadii = data.layout ? data.layout.borderRadii : null;
      if (_origPairs) data.colors.contrastPairs = _origPairs.filter(function(cp) { return !cp._regionContainerId; });
      if (_origTouch) data.interaction.touchTargets = _origTouch.filter(function(t) { return !t._regionContainerId; });
      if (_origHeadings) data.typography.headings = _origHeadings.filter(function(h) { return !h._regionContainerId; });
      if (_origAlign) data.layout.alignmentElements = _origAlign.filter(function(a) { return !a._regionContainerId; });
      if (_origRadii) data.layout.borderRadii = _origRadii.filter(function(r) {
        // borderRadii entries have bboxes[] array — exclude if ALL sample bboxes have _rcid
        if (!r.bboxes || r.bboxes.length === 0) return true;
        return r.bboxes.some(function(b) { return !b._rcid; });
      });
      var _filteredCount = (_origPairs ? _origPairs.length - data.colors.contrastPairs.length : 0);
      var _filteredAlign = (_origAlign ? _origAlign.length - data.layout.alignmentElements.length : 0);
      console.log('[D] scoring filter: ' + (_origPairs ? _origPairs.length : 0) + '→' + (data.colors ? data.colors.contrastPairs.length : 0) + ' pairs (removed ' + _filteredCount + ' rcid) align removed=' + _filteredAlign);

      reportData = MilgScoring.runScoring(data);
      if (_isTabSwitch) data._cachedReportData = reportData;

      // Restore originals (region pairIndices reference the full array)
      if (_origPairs) data.colors.contrastPairs = _origPairs;
      if (_origTouch) data.interaction.touchTargets = _origTouch;
      if (_origHeadings) data.typography.headings = _origHeadings;
      if (_origAlign) data.layout.alignmentElements = _origAlign;
      if (_origRadii) data.layout.borderRadii = _origRadii;
    }
    // Score region sub-pages independently
    var _regionScreenshots = reportData.raw && reportData.raw.regionScreenshots || [];
    _regionScreenshots.forEach(function(rgn, ri) {
      if (!rgn.extractedData) return;
      try {
        // Sanitize: force-reveal artifacts are not real layout issues
        var _ed = rgn.extractedData;
        if (_ed.structure) {
          _ed.structure.hasHorizontalOverflow = false;
          _ed.structure.overflowCulprits = [];
        }
        if (_ed.layout) {
          _ed.layout.horizontalScrollContainers = [];
          _ed.layout.offscreenElements = [];
          _ed.layout.hiddenPanelIssues = [];
        }
        rgn.regionReport = MilgScoring.runScoring(rgn.extractedData);
        var _rgnFindings = 0;
        (rgn.regionReport.categories || []).forEach(function(c) { (c.findings || []).forEach(function(f) { if (f.locator && f.locator.bboxes && f.locator.bboxes.length) _rgnFindings++; }); });
        console.log('[D] region ' + ri + ' scored ' + rgn.regionReport.overall + '/100 findings_with_bbox=' + _rgnFindings);
      } catch (e) {
        console.log('[D] region ' + ri + ' scoring failed: ' + e.message);
      }
    });

    window.__milgLastReport = reportData; // Expose for diagnostics/testing
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

    _showEphemeralBanner();
    reportContainer.innerHTML = warningHtml + suggestionsHtml + MilgReport.renderReport(reportData);
    reportContainer.classList.add('visible');
    inputSection.style.display = 'none';
    // Render viewport tabs for deep scan results
    renderViewportTabs(data);
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

    // Pixel contrast verification — respects checkbox for all modes
    var pixelVerifyCheck = document.getElementById('pixelVerifyCheck');
    var wantPixelVerify = pixelVerifyCheck ? pixelVerifyCheck.checked : false;
    _log('[milg] Pixel verify check — want:', wantPixelVerify,
      'hasPrecomputed:', !!data._contrastVerifyResults,
      'hasScreenshots:', !!(reportData.raw && reportData.raw.screenshots && reportData.raw.screenshots.length),
      'hasMeta:', !!(reportData.raw && reportData.raw.screenshotMeta),
      'hasMilgCV:', !!window.MilgContrastVerify);
    // Use pre-computed results if available (from deep scan pre-computation)
    if (data._contrastVerifyResults) {
      reportData._contrastVerifyResults = data._contrastVerifyResults;
      reportData._bboxEdgeResults = data._bboxEdgeResults || [];
      var summary = MilgContrastVerify.buildSummary(data._contrastVerifyResults, data._bboxEdgeResults);
      var summaryHtml = MilgContrastVerify.renderSummaryHtml(summary);
      if (summaryHtml) {
        var screenshotDetails = reportContainer.querySelector('.report-screenshots');
        var div = document.createElement('div');
        div.innerHTML = summaryHtml;
        if (screenshotDetails) screenshotDetails.parentNode.insertBefore(div, screenshotDetails.nextSibling);
        else reportContainer.insertBefore(div, reportContainer.firstChild);
      }
    } else if (!_verifyInProgress && wantPixelVerify && window.MilgContrastVerify && reportData.raw && reportData.raw.screenshots && reportData.raw.screenshotMeta) {
      // Strip snippet's inline pixel verify data so MilgContrastVerify runs the full
      // canvas-based pipeline (with bbox, samplePoints, P10 etc.) instead of using
      // the snippet's simplified pre-computed results which lack bbox data.
      if (reportData.raw.pixelVerifyResults) delete reportData.raw.pixelVerifyResults;
      if (reportData.raw.colors && reportData.raw.colors.contrastPairs) {
        reportData.raw.colors.contrastPairs.forEach(function(p) { delete p.pixelVerify; });
      }
      // Run async verification (non-deep-scan path)
      _log('[milg] Running pixel verify — screenshots:', reportData.raw.screenshots.length,
        'meta:', JSON.stringify(reportData.raw.screenshotMeta).substring(0, 100),
        'pairs with bbox:', (reportData.raw.colors && reportData.raw.colors.contrastPairs || []).filter(function(p) { return !!p.bbox; }).length);
      // Show spinner while verify runs
      var _verifySpinner = document.createElement('div');
      _verifySpinner.id = 'milg-verify-spinner';
      _verifySpinner.innerHTML = '<details class="contrast-verify-summary" open>' +
        '<summary style="cursor:pointer;font-size:13px;font-weight:600;padding:8px 0;display:flex;align-items:center;gap:8px">' +
        '<span style="display:inline-block;width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:milg-spin 0.8s linear infinite;flex-shrink:0"></span>' +
        'Pixel Contrast Verification\u2026' +
        '</summary>' +
        '<div style="padding:8px 0;font-size:12px;color:var(--text-secondary)">Sampling pixel colors from screenshots to verify CSS contrast ratios\u2026</div>' +
        '</details>';
      var _spinnerAnchor = reportContainer.querySelector('.report-screenshots');
      if (_spinnerAnchor) _spinnerAnchor.parentNode.insertBefore(_verifySpinner, _spinnerAnchor.nextSibling);
      else reportContainer.insertBefore(_verifySpinner, reportContainer.firstChild);
      // Yield a frame so the spinner paints and animates before verify starts
      _verifyInProgress = true;
      var _verifyData = data;
      var _verifyReportData = reportData;
      var _verifyContainer = reportContainer;
      var _verifyGen = _verifyGeneration;
      requestAnimationFrame(function() { setTimeout(function() {
        // Bail if a newer runAnalysis has started since we queued this verify
        if (_verifyGen !== _verifyGeneration) return;
        MilgContrastVerify.verify(_verifyReportData, function(results, bboxEdgeResults) {
          _verifyInProgress = false;
          // Always cache results on the data object (even if stale — saves re-computation)
          _verifyData._contrastVerifyResults = results || [];
          _verifyData._bboxEdgeResults = bboxEdgeResults || [];
          _verifyReportData._contrastVerifyResults = results || [];
          _verifyReportData._bboxEdgeResults = bboxEdgeResults || [];
          _log('[milg] Pixel verify complete:', results.length, 'results,', (bboxEdgeResults || []).length, 'edge results');
          // Remove spinner regardless
          var spinner = document.getElementById('milg-verify-spinner');
          if (spinner) spinner.parentNode.removeChild(spinner);
          // Only inject into DOM if this is still the active analysis
          if (_verifyGen !== _verifyGeneration) return;
          if (results.length === 0 && (!bboxEdgeResults || bboxEdgeResults.length === 0)) return;
          var summary = MilgContrastVerify.buildSummary(results, bboxEdgeResults);
          var summaryHtml = MilgContrastVerify.renderSummaryHtml(summary);
          if (!summaryHtml) return;
          var screenshotDetails = _verifyContainer.querySelector('.report-screenshots');
          var div = document.createElement('div');
          div.innerHTML = summaryHtml;
          if (screenshotDetails) screenshotDetails.parentNode.insertBefore(div, screenshotDetails.nextSibling);
          else _verifyContainer.insertBefore(div, _verifyContainer.firstChild);
          // Run pixel verification on region sub-pages sequentially
          var _rgnList = (_verifyReportData.raw && _verifyReportData.raw.regionScreenshots || []).filter(function(r) { return r.extractedData && r.screenshot; });
          (function _verifyNextRegion(idx) {
            if (idx >= _rgnList.length) return;
            var rgn = _rgnList[idx];
            // Apply mask results from the region's maskResults dict (avoids cross-frame issues)
            var _rgnPairs = rgn.extractedData.colors ? rgn.extractedData.colors.contrastPairs || [] : [];
            var _mr = rgn.maskResults || {};
            var _mrKeys = Object.keys(_mr);
            if (_mrKeys.length > 0) {
              _mrKeys.forEach(function(k) {
                var i = parseInt(k, 10);
                var mr = _mr[k];
                if (_rgnPairs[i] && mr) {
                  _rgnPairs[i]._maskBmp = mr.bmp;
                  _rgnPairs[i]._maskPacked = !!mr.packed;
                  _rgnPairs[i]._maskW = mr.w;
                  _rgnPairs[i]._maskH = mr.h;
                  _rgnPairs[i]._maskLayer = mr.layer;
                  _rgnPairs[i]._maskDark = mr.dark;
                }
              });
            }
            var _rgnMaskCount = _rgnPairs.filter(function(p) { return !!p._maskBmp; }).length;
            console.log('[D] region ' + idx + ' verify: pairs=' + _rgnPairs.length + ' maskResults=' + _mrKeys.length + ' maskBmp=' + _rgnMaskCount);
            var miniReport = {
              raw: {
                screenshots: [rgn.screenshot],
                screenshotMeta: rgn.screenshotMeta,
                colors: rgn.extractedData.colors || { contrastPairs: [] }
              },
              categories: rgn.regionReport ? rgn.regionReport.categories : []
            };
            MilgContrastVerify.verify(miniReport, function(rgnResults) {
              rgn.regionVerifyResults = rgnResults || [];
              _log('[milg] Region pixel verify:', rgnResults ? rgnResults.length : 0, 'results');
              // Re-render region overlays if verify filter is active (results arrived async)
              if (typeof MilgViewer !== 'undefined' && MilgViewer.refreshRegionOverlays) {
                MilgViewer.refreshRegionOverlays();
              }
              _verifyNextRegion(idx + 1);
            });
          })(0);

          // Update viewport cache if this was a viewport switch
          if (_verifyData._vpCacheIdx !== undefined) {
            _viewportCache[_verifyData._vpCacheIdx] = {
              data: _verifyData, reportData: _verifyReportData,
              html: _verifyContainer ? _verifyContainer.innerHTML : ''
            };
          }
        });
      }, 0); });
    }
  }

  // --- UI Initialization ---
  function init() {
    applyDarkMode();

    var pasteInput = document.getElementById('pasteInput');
    var analyzeBtn = document.getElementById('analyzeBtn');
    var reportContainer = document.getElementById('reportContainer');
    var inputSection = document.getElementById('inputSection');
    var snippetCode = document.getElementById('snippetCode');
    var copySnippetBtn = document.getElementById('copySnippetBtn');
    var newAnalysisBtn = document.getElementById('newAnalysisBtn');
    var analyzeUrlBtn = document.getElementById('analyzeUrlBtn');
    var urlInput = document.getElementById('urlInput');
    var urlStatus = document.getElementById('urlStatus');
    // Store original input section HTML so we can restore it after preview analysis
    var _originalInputSectionHTML = inputSection.innerHTML;

    // Tab switching
    var _analysisOptions = document.getElementById('analysisOptions');
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        // Hide analysis options on Import tab — imported data has its own settings
        if (_analysisOptions) _analysisOptions.style.display = (btn.dataset.tab === 'tabImport') ? 'none' : 'flex';
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

    // Decompress gzipped clipboard data (MILG_GZ: header)
    function decompressPaste(text, callback) {
      if (!text.startsWith('MILG_GZ:')) { callback(text); return; }
      if (typeof DecompressionStream === 'undefined') {
        showToast('Browser does not support DecompressionStream — paste raw JSON instead');
        callback(null); return;
      }
      try {
        var b64 = text.substring(8);
        var binStr = atob(b64);
        var bytes = new Uint8Array(binStr.length);
        for (var i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        var blob = new Blob([bytes]);
        var ds = new DecompressionStream('gzip');
        var stream = blob.stream().pipeThrough(ds);
        new Response(stream).text().then(function(json) {
          _log('[milg] Decompressed: ' + Math.round(text.length / 1024) + ' KB → ' + Math.round(json.length / 1024) + ' KB');
          callback(json);
        }).catch(function(e) {
          showToast('Decompression failed: ' + e.message);
          callback(null);
        });
      } catch(e) { showToast('Decompression failed: ' + e.message); callback(null); }
    }

    // Analyze JSON (supports both raw JSON and MILG_GZ: compressed format)
    analyzeBtn.addEventListener('click', function() {
      var raw = pasteInput.value.trim();
      if (!raw) { showToast('Paste the extracted JSON data first'); return; }
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Processing...';
      decompressPaste(raw, function(json) {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze';
        if (!json) return;
        try {
          var data = JSON.parse(json);
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

        // Check settings
        var jsCheck = document.getElementById('jsEnabledCheck');
        var jsAck = document.getElementById('jsRiskAck');
        var wantJs = jsCheck && jsCheck.checked && jsAck && jsAck.checked;
        var isDeepScan = document.getElementById('deepScanCheck') && document.getElementById('deepScanCheck').checked;
        var wantShots = document.getElementById('screenshotCheck') && document.getElementById('screenshotCheck').checked;
        var analysisOpts = { jsEnabled: wantJs, screenshots: wantShots, exclude: exclude };

        // Helper: finish single-page URL analysis
        var _analyzeUrlIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Analyze URL';
        function _finishUrl(data) {
          analyzeUrlBtn.disabled = false;
          analyzeUrlBtn.innerHTML = _analyzeUrlIcon;
          urlStatus.style.display = 'none';
          showProgress(100, 'Done!');
          setTimeout(hideProgress, 500);
          data.meta.url = url;
          data.meta._inputMethod = 'url';
          if (wantJs) data.meta._jsEnabled = true;
          hideFocusModal();
          runAnalysis(data);
        }

        // --- Deep scan: multi-viewport analysis ---
        if (isDeepScan) {
          _activeViewportIdx = 0;
          if (wantShots) showFocusModal();
          urlStatus.textContent = 'Deep scan: preparing viewports...';
          showProgress(15, 'Launching multi-viewport scan...');
          runDeepScanLoop(html, url, analysisOpts,
            function(label, done, total) {
              urlStatus.textContent = 'Deep scan: ' + label + ' (' + done + '/' + total + ')';
              showProgress(15 + Math.round(70 * done / total), label);
            },
            function(primary) {
              if (!primary) {
                hideFocusModal();
                analyzeUrlBtn.disabled = false;
                analyzeUrlBtn.innerHTML = _analyzeUrlIcon;
                urlStatus.innerHTML = '<span style="color:#dc2626">Deep scan failed — no viewport returned data.</span>';
                hideProgress();
                return;
              }
              primary.meta.url = url;
              primary.meta._inputMethod = 'url';
              if (wantJs) primary.meta._jsEnabled = true;
              // Pre-compute pixel verify for all viewports before showing results
              var pvCheck = document.getElementById('pixelVerifyCheck');
              var wantPV = pvCheck ? pvCheck.checked : false;
              if (wantPV && wantShots && window.MilgContrastVerify && window.MilgQueue && primary.deepScan && primary.deepScan.viewportData) {
                urlStatus.textContent = 'Running pixel verification...';
                urlStatus.style.display = 'block';
                showProgress(88, 'Pixel verification...');
                updateFocusModal('Verifying contrast at pixel level');
                var vpToVerify = primary.deepScan.viewportData.filter(function(v) { return v && v.data && v.data.screenshots && v.data.screenshots.length > 0; });
                var verifyDone = 0;
                if (vpToVerify.length === 0) { _finishUrl(primary); return; }
                // Queue all viewport verifies — active viewport gets highest priority
                MilgQueue.clear();
                vpToVerify.forEach(function(vp, vi) {
                  var priority = (vi === _activeViewportIdx) ? 100 : (vpToVerify.length - vi);
                  MilgQueue.enqueue('vp-verify-' + vi, function(done) {
                    var scored = MilgScoring.runScoring(vp.data);
                    MilgContrastVerify.verify(scored, function(results, bboxEdge) {
                      vp.data._contrastVerifyResults = results || [];
                      vp.data._bboxEdgeResults = bboxEdge || [];
                      done({ vp: vp, results: results, bboxEdge: bboxEdge });
                    });
                  }, function(result) {
                    verifyDone++;
                    updateFocusModal('Pixel verified ' + result.vp.label + ' — ' + (result.results ? result.results.length : 0) + ' pairs checked');
                    showProgress(88 + Math.round(10 * verifyDone / vpToVerify.length), 'Verified ' + verifyDone + '/' + vpToVerify.length);
                    if (verifyDone === vpToVerify.length) {
                      updateFocusModal('Rendering report');
                      _finishUrl(primary);
                    }
                  }, priority);
                });
              } else {
                updateFocusModal('Rendering report');
                _finishUrl(primary);
              }
            }
          );
          return;
        }

        // --- Single viewport analysis (basic or JS-enabled) ---
        if (wantShots) { showFocusModal(); updateFocusModal(wantJs ? 'Preparing JavaScript sandbox' : 'Rendering page and capturing screenshot'); }
        showProgress(wantJs ? 25 : 40, wantJs ? 'Preparing sandbox...' : 'Analyzing styles...');
        if (wantJs) urlStatus.textContent = 'Running with JavaScript enabled...';

        // Prefetch fonts for single-viewport paths too (same as deep scan).
        // Without this, mask capture falls back to system fonts → misaligned masks.
        function _launchSingleAnalysis() {
          MilgIframe.analyzeHtml(html, {
            url: url,
            jsEnabled: wantJs,
            screenshots: wantShots,
            exclude: exclude
          }, function(data) {
            _finishUrl(data);
          });
        }
        if (wantShots && CORS_PROXY_URL) {
          MilgIframe.prefetchFonts(html, url, _launchSingleAnalysis);
        } else {
          _launchSingleAnalysis();
        }
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

    // Help modal
    document.getElementById('helpBtn').addEventListener('click', function() {
      document.getElementById('helpModal').style.display = '';
    });
    document.getElementById('helpModal').addEventListener('click', function(e) {
      if (e.target === this) this.style.display = 'none';
    });

    // New analysis
    newAnalysisBtn.addEventListener('click', function() {
      _hideEphemeralBanner();
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
            var ao = document.getElementById('analysisOptions');
            if (ao) ao.style.display = (btn.dataset.tab === 'tabImport') ? 'none' : 'flex';
          });
        });
      }
      document.getElementById('reportActions').style.display = 'none'; document.getElementById('profileExplanation').style.display = 'none';
      var pi = document.getElementById('pasteInput'); if (pi) pi.value = '';
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

    // Markdown export (download) — single-URL only, crawl-ui handles crawl
    document.getElementById('markdownBtn').addEventListener('click', function() {
      if (MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession()) return;
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

    // Copy for LLM — filtered findings only, no images/masks (single-URL; crawl-ui handles crawl)
    document.getElementById('copyMdBtn').addEventListener('click', function() {
      if (MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession()) return;
      if (!reportData) return;
      var filter = document.getElementById('exportSeverityFilter');
      var severity = filter ? filter.value : 'all';
      var md = MilgReport.renderMarkdown(reportData, { skipImages: true, severityFilter: severity });
      navigator.clipboard.writeText(md).then(function() {
        showToast('Findings copied for LLM (' + severity + ')');
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

    // Export .milg — compressed dump with full analysis data (screenshots, masks, verify)
    var _exportJsonBtn = document.getElementById('exportJsonBtn');
    // Shared: build export data object (breaks circular refs, keeps all content)
    function _buildExportData() {
      // Only strip circular refs and transient state — keep ALL analysis data for full reimport
      var _replacer = function(k, v) { return (k === 'deepScan' || k === '_cachedReportData' || k === '_vpCacheIdx') ? undefined : v; };
      var exportData;
      if (typeof structuredClone === 'function') {
        var _tmpDs = lastRawData.deepScan, _tmpCached = lastRawData._cachedReportData;
        if (_tmpDs) lastRawData.deepScan = undefined;
        if (_tmpCached) lastRawData._cachedReportData = undefined;
        exportData = structuredClone(lastRawData);
        if (_tmpDs) lastRawData.deepScan = _tmpDs;
        if (_tmpCached) lastRawData._cachedReportData = _tmpCached;
      } else {
        exportData = JSON.parse(JSON.stringify(lastRawData, _replacer));
      }
      // Re-attach deepScan with viewportData (break circular deepScan refs but keep all data)
      if (lastRawData.deepScan) {
        var ds = lastRawData.deepScan;
        var exportDs = { viewports: ds.viewports, darkMode: ds.darkMode };
        if (ds.viewportData) {
          exportDs.viewportData = ds.viewportData.map(function(vd) {
            if (!vd || !vd.data) return null;
            var vpClone = JSON.parse(JSON.stringify(vd.data, _replacer));
            // Include verify results
            if (vd.data._contrastVerifyResults) {
              vpClone._contrastVerifyResults = vd.data._contrastVerifyResults;
              vpClone._bboxEdgeResults = vd.data._bboxEdgeResults || [];
            }
            return { label: vd.label, width: vd.width, data: vpClone };
          });
        }
        exportData.deepScan = exportDs;
      }
      if (reportData && reportData._contrastVerifyResults) {
        exportData._contrastVerifyResults = reportData._contrastVerifyResults;
      }
      if (reportData && reportData._bboxEdgeResults) {
        exportData._bboxEdgeResults = reportData._bboxEdgeResults;
      }
      exportData._milgVersion = MILG_EXPORT_VERSION;
      return exportData;
    }

    // Compress JSON to gzip blob
    function _compressToBlob(json, callback) {
      if (typeof CompressionStream === 'undefined') {
        // Fallback: save as uncompressed JSON
        callback(new Blob([json], { type: 'application/json' }), json.length, false);
        return;
      }
      var blob = new Blob([json]);
      var cs = new CompressionStream('gzip');
      var stream = blob.stream().pipeThrough(cs);
      new Response(stream).blob().then(function(compressed) {
        callback(compressed, json.length, true);
      }).catch(function() {
        callback(new Blob([json], { type: 'application/json' }), json.length, false);
      });
    }

    _exportJsonBtn.addEventListener('click', function() {
      // Skip if crawl is active — crawl-ui handles its own export
      if (MilgCrawlUI.getCrawlSession && MilgCrawlUI.getCrawlSession()) return;
      if (!lastRawData) return;
      var origLabel = _exportJsonBtn.innerHTML;
      _exportJsonBtn.disabled = true;
      _exportJsonBtn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:milg-spin 0.8s linear infinite;vertical-align:middle"></span> <span class="btn-label">Exporting\u2026</span>';
      requestAnimationFrame(function() { setTimeout(function() {
        try {
          var exportData = _buildExportData();
          var json = JSON.stringify(exportData);
          _compressToBlob(json, function(blob, rawSize, compressed) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            var siteName = (exportData.meta && exportData.meta.url) || 'analysis';
            a.download = 'milg-report-' + siteName.replace(/[^a-z0-9]/gi, '-').substring(0, 40) + (compressed ? '.milg' : '.json');
            a.click();
            URL.revokeObjectURL(url);
            var sizeKB = Math.round(blob.size / 1024);
            var ratio = compressed ? ' (' + Math.round(rawSize / 1024) + ' KB → ' + sizeKB + ' KB)' : '';
            showToast('Exported ' + sizeKB + ' KB' + ratio);
            _exportJsonBtn.disabled = false;
            _exportJsonBtn.innerHTML = origLabel;
          });
        } catch(err) {
          showToast('Export failed: ' + err.message);
          _exportJsonBtn.disabled = false;
          _exportJsonBtn.innerHTML = origLabel;
        }
      }, 0); });
    });

    // Import JSON — load a previously exported analysis (report action bar + drop zone)
    var importFileInput = document.getElementById('importJsonFile');
    function _processImportedData(data) {
      // Version compatibility check
      var importVersion = data._milgVersion || null;
      if (!importVersion) {
        showToast('Warning: This export has no version tag — it may be from an older analyzer version. Some features (pixel verify, viewport data) may not display correctly.');
      } else if (importVersion !== MILG_EXPORT_VERSION) {
        showToast('Note: This export is from v' + importVersion + ' (current: v' + MILG_EXPORT_VERSION + '). Results may differ slightly due to scoring changes.');
      }
      if (data._milgCrawl && data.results) {
        MilgCrawlUI.loadCrawlResults(data, 'imported file');
        return;
      }
      if (!data.meta || !data.colors) throw new Error('Invalid format');
      var ssCheck = document.getElementById('screenshotCheck');
      var pvCheck = document.getElementById('pixelVerifyCheck');
      var dsCheck = document.getElementById('deepScanCheck');
      if (ssCheck) ssCheck.checked = !!(data.screenshots && data.screenshots.length);
      if (pvCheck) pvCheck.checked = !!data._contrastVerifyResults;
      if (dsCheck) dsCheck.checked = !!(data.deepScan && data.deepScan.viewportData);
      runAnalysis(data);
      showToast('Analysis imported: ' + (data.meta.url || 'unknown'));
    }
    function handleImportFile(file) {
      if (!file) return;
      // Try JSON first (quick check of first bytes), then gzip decompress
      var reader = new FileReader();
      reader.onload = function() {
        var buf = reader.result;
        var firstBytes = new Uint8Array(buf, 0, 2);
        var isGzip = (firstBytes[0] === 0x1f && firstBytes[1] === 0x8b);
        if (isGzip) {
          if (typeof DecompressionStream === 'undefined') {
            showToast('Browser does not support DecompressionStream for .milg files');
            return;
          }
          var ds = new DecompressionStream('gzip');
          var stream = new Blob([buf]).stream().pipeThrough(ds);
          new Response(stream).text().then(function(json) {
            try { _processImportedData(JSON.parse(json)); }
            catch(e) { showToast('Invalid .milg file: ' + e.message); }
          }).catch(function(e) { showToast('Decompression failed: ' + e.message); });
        } else {
          try {
            var text = new TextDecoder().decode(buf);
            _processImportedData(JSON.parse(text));
          } catch(e) {
            showToast('Invalid file: ' + e.message);
          }
        }
      };
      reader.readAsArrayBuffer(file);
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
    var importJsonBtn = document.getElementById('importJsonBtn');
    if (importJsonBtn) importJsonBtn.addEventListener('click', function() {
      importFileInput.click();
    });
    importFileInput.addEventListener('change', function() {
      handleImportFile(importFileInput.files[0]);
      importFileInput.value = '';
    });

    // Snippet tab file import (for crawl downloads and snippet file exports)
    var snippetFileBtn = document.getElementById('importSnippetFileBtn');
    var snippetFileInput = document.getElementById('importSnippetFile');
    if (snippetFileBtn && snippetFileInput) {
      snippetFileBtn.addEventListener('click', function() { snippetFileInput.click(); });
      snippetFileInput.addEventListener('change', function() {
        handleImportFile(snippetFileInput.files[0]);
        snippetFileInput.value = '';
      });
    }

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
          MilgIframe.analyzeHtml(previewHtml, {
            screenshots: true,
            editorDark: previewCtx.dark || false,
            editorEffectCSS: previewCtx.effectCSS || ''
          }, function(data) {
            data.meta.url = 'Editor Preview' + ctxLabel;
            data.meta._inputMethod = 'editor';
            runAnalysis(data);
          });
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
      restoreCachedAnalysis: restoreCachedAnalysis,
      analyzeUrlBtn: analyzeUrlBtn,
      runDeepScanLoop: runDeepScanLoop,
      showFocusModal: showFocusModal,
      updateFocusModal: updateFocusModal,
      hideFocusModal: hideFocusModal
    });
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
