// make-it-look-good — Crawl UI Wiring
// Manages multi-page site crawl progress, tabs, and results display.
// Depends on: analyzer-crawl.js (MilgCrawl), analyzer-report.js (MilgReport),
//             analyzer-iframe.js (MilgIframe), analyzer-proxy.js (MilgProxy)

window.MilgCrawlUI = (function() {
  "use strict";

  var _crawlSession = null;
  var _crawlPageReports = {}; // pageIndex → rendered HTML cache
  var _crawlActivePageTab = 'summary';
  var CRAWL_HARD_MAX = 25;

  // Dependencies injected via setup()
  var _showToast, _runAnalysis, _restoreCachedAnalysis, _analyzeUrlBtn;
  var _showFocusModal, _updateFocusModal, _hideFocusModal;

  // DOM refs queried during setup
  var crawlSiteCheck, crawlOptions, cancelCrawlBtn, crawlMaxPages, crawlBlacklist;
  var crawlProgressArea, crawlProgressLabel, crawlProgressCount, crawlProgressFill, crawlProgressList;
  var crawlResults, crawlPageTabs, crawlPageContent;

  function _esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Use the shared focus modal for crawl progress (same as single-URL deep scan).
  // The modal has a close button so users can dismiss it and browse results.
  var _crawlModalDismissed = false;
  function _crawlModal(msg) {
    if (_crawlModalDismissed) return;
    if (_showFocusModal) _showFocusModal();
    if (_updateFocusModal) _updateFocusModal(msg + '\n');
  }
  function _crawlModalClose() {
    _crawlModalDismissed = false;
    if (_hideFocusModal) _hideFocusModal();
  }

  function getCrawlSession() { return _crawlSession; }
  function setCrawlSession(s) { _crawlSession = s; }
  function getActiveTab() { return _crawlActivePageTab; }

  function isCrawlMode() { return crawlSiteCheck && crawlSiteCheck.checked; }
  function isCrawlActive() { return _crawlSession && _crawlSession.pages.length > 0 && crawlResults && crawlResults.style.display !== 'none'; }
  function crawlStatusIcon(status) {
    if (status === 'done') return '<span class="status-icon done"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>';
    if (status === 'error') return '<span class="status-icon error"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>';
    if (status === 'fetching' || status === 'analyzing') return '<span class="status-icon active"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg></span>';
    return '<span class="status-icon pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="20" stroke-dashoffset="10"/></svg></span>';
  }

  function updateCrawlProgressItem(page) {
    var existing = document.getElementById('crawl-progress-' + encodeURIComponent(page.url));
    var path; try { path = new URL(page.url).pathname; } catch(e) { path = page.url; }
    var scoreText = page.status === 'done' && page.reportData ? ' ' + page.reportData.overall + '/100' : '';
    var errorText = page.status === 'error' ? ' <span style="color:#dc2626;font-size:12px">' + (page.error || 'Failed').substring(0, 40) + '</span>' : '';
    var html = crawlStatusIcon(page.status) +
      '<span class="page-url" title="' + page.url + '">' + path + '</span>' +
      '<span class="page-score">' + scoreText + errorText + '</span>';
    if (existing) {
      existing.innerHTML = html;
    } else {
      var div = document.createElement('div');
      div.className = 'crawl-progress-item';
      div.id = 'crawl-progress-' + encodeURIComponent(page.url);
      div.innerHTML = html;
      crawlProgressList.appendChild(div);
    }
  }

  function renderCrawlTabs() {
    if (!_crawlSession || !crawlPageTabs) return;
    var html = '<button class="crawl-page-tab' + (_crawlActivePageTab === 'summary' ? ' active' : '') + '" data-crawl-page="summary">Summary</button>';
    _crawlSession.pages.forEach(function(page, idx) {
      html += MilgReport.renderCrawlPageTab(page, idx, _crawlActivePageTab === String(idx));
    });
    crawlPageTabs.innerHTML = html;
  }

  var _spinnerHtml = '<div style="padding:60px;text-align:center">' +
    '<div style="width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:milg-spin 0.8s linear infinite;margin:0 auto"></div>' +
    '<div style="color:var(--text-secondary);margin-top:12px;font-size:13px">Loading report\u2026</div>' +
    '<style>@keyframes milg-spin{to{transform:rotate(360deg)}}</style></div>';

  function showCrawlPageContent(key) {
    _crawlActivePageTab = key;
    // Promote this page's verify to front of queue so it completes first
    if (key !== 'summary' && window.MilgQueue) {
      MilgQueue.promote('crawl-verify-' + key);
    }
    renderCrawlTabs();
    var reportContainer = document.getElementById('reportContainer');
    var reportActions = document.getElementById('reportActions');
    // Show export/actions only after crawl is complete (not during progress)
    var crawlDone = _crawlSession && _crawlSession.status === 'complete';
    if (reportActions) reportActions.style.display = crawlDone ? 'flex' : 'none';
    if (crawlDone && window.milgUpdateExportCounts) window.milgUpdateExportCounts();
    if (key === 'summary') {
      var summary = _crawlSession.summary || MilgCrawl.buildSummary(_crawlSession);
      var ephBanner = document.getElementById('ephemeralBanner');
      if (ephBanner && crawlDone) ephBanner.style.display = 'flex';
      crawlPageContent.innerHTML = MilgReport.renderCrawlSummary(summary);
      crawlPageContent.style.display = '';
      crawlPageContent.className = 'report-container visible';
      if (reportContainer) { reportContainer.style.display = 'none'; reportContainer.className = 'report-container'; }
      // Re-inject pixel verify summary if all pages have been verified
      if (crawlDone && _crawlSession.pages.some(function(p) { return p.rawData && p.rawData._contrastVerifyResults; })) {
        var allVerified = _crawlSession.pages.filter(function(p) { return p.status === 'done'; })
          .every(function(p) { return p.rawData && p.rawData._contrastVerifyResults; });
        if (allVerified) _updateVerifySummary(_crawlSession.pages.length, _crawlSession.pages.length, _crawlSession);
      }
    } else {
      var idx = parseInt(key);
      var page = _crawlSession.pages[idx];
      if (!page || page.status !== 'done') {
        crawlPageContent.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">' +
          (page && page.status === 'error' ? 'Error: ' + (page.error || 'Analysis failed') : 'Analyzing\u2026') + '</div>';
        crawlPageContent.style.display = '';
        crawlPageContent.className = 'report-container visible';
        if (reportContainer) { reportContainer.style.display = 'none'; reportContainer.className = 'report-container'; }
        return;
      }

      crawlPageContent.style.display = 'none';
      crawlPageContent.className = 'report-container';
      if (reportContainer) reportContainer.style.display = '';

      // Cache hit: re-run with cached scoring + precomputed verify (fast, preserves overlays)
      if (_crawlPageReports[idx]) {
        var cached = _crawlPageReports[idx];
        _runAnalysis(cached.data || page.rawData, 'crawl-page');
        return;
      }

      // Cache miss: show spinner, defer heavy work so spinner paints
      reportContainer.innerHTML = _spinnerHtml;
      reportContainer.classList.add('visible');
      setTimeout(function() {
        // Guard: user may have switched tabs during the setTimeout
        if (_crawlActivePageTab !== String(idx)) return;
        page.rawData.meta = page.rawData.meta || {};
        var origMethod = page.rawData.meta._inputMethod;
        _runAnalysis(page.rawData, 'crawl-page');
        page.rawData.meta._inputMethod = origMethod;
        // Cache the data for instant restore (runAnalysis uses _cachedReportData + _contrastVerifyResults)
        _crawlPageReports[idx] = {
          data: page.rawData
        };
      }, 0);
    }
  }

  // Load multi-page crawl results into the tabbed view
  function loadCrawlResults(crawlState, source) {
    if (!crawlState || !crawlState.results || crawlState.results.length === 0) return false;
    _showToast('Loaded crawl results' + (source ? ' from ' + source : '') + ' (' + crawlState.results.length + ' pages)');
    // Honor the audience profile the crawl was scored with: prefer a session-level
    // profile, else the first page's data.profile, else the current dropdown. Restore
    // the dropdown so the UI matches, and ensure each page's data carries its profile
    // before re-scoring (getProfile reads data.profile).
    var _curProf = document.getElementById('profileSelect') ? document.getElementById('profileSelect').value : 'general';
    var _impProf = crawlState.profile || (crawlState.results[0].data && crawlState.results[0].data.profile) || _curProf;
    var _profSel = document.getElementById('profileSelect');
    if (_profSel && _impProf) _profSel.value = _impProf;
    _crawlSession = MilgCrawl.createSession(crawlState.startUrl || crawlState.results[0].url, {
      maxPages: crawlState.results.length, profile: _impProf
    });
    crawlState.results.forEach(function(r) {
      if (r.data && !r.data.profile) r.data.profile = _impProf;
      var report = MilgScoring.runScoring(r.data);
      _crawlSession.pages.push({
        url: r.url, status: 'done', title: (r.data.meta && r.data.meta.title) || '',
        rawData: r.data, reportData: report, error: null,
        startedAt: (r.data.meta && r.data.meta.timestamp) || null, completedAt: (r.data.meta && r.data.meta.timestamp) || null
      });
    });
    _crawlSession.status = 'complete';
    _crawlSession.summary = MilgCrawl.buildSummary(_crawlSession);
    // Carry SPA exploration provenance (clicked/skipped/notes/truncated) onto the session
    // + summary so renderCrawlSummary can show the exploration log. (loadCrawlResults
    // otherwise drops crawlState fields beyond results/startUrl/profile.)
    if (crawlState._spaProvenance) {
      _crawlSession._spaProvenance = crawlState._spaProvenance;
      if (_crawlSession.summary) _crawlSession.summary._spaProvenance = crawlState._spaProvenance;
    }
    crawlResults.style.display = '';
    var reportActions = document.getElementById('reportActions');
    if (reportActions) reportActions.style.display = '';
    if (window.milgUpdateExportCounts) window.milgUpdateExportCounts();
    document.getElementById('inputSection').style.display = 'none';
    renderCrawlTabs();
    showCrawlPageContent('summary');

    // Pre-compute pixel verify for each page with screenshots (async, best-effort).
    // Results are cached on rawData._contrastVerifyResults so tab switches use cache.
    _preComputePixelVerify();

    return true;
  }

  // Pixel-verify a page's region sub-screenshots (hidden/clipped content like
  // carousel slides) so they get real verdicts + overlay boxes — single-page parity.
  // Idempotent (guarded by _regionVerifyDone); cb() always called.
  function _verifyPageRegions(page, pageIdx, cb) {
    cb = cb || function() {};
    if (!page || !page.rawData || page.rawData._regionVerifyDone ||
        !window.MilgContrastVerify || !MilgContrastVerify.verifyRegions) { cb(); return; }
    var report = page.reportData || MilgScoring.runScoring(page.rawData);
    var raw = report.raw || {};
    var regions = raw.regionScreenshots || (raw.screenshotMeta && raw.screenshotMeta.regionScreenshots);
    if (!regions || !regions.length) { page.rawData._regionVerifyDone = true; cb(); return; }
    MilgContrastVerify.verifyRegions(report, null, function() {
      page.rawData._regionVerifyDone = true;
      if (pageIdx >= 0) delete _crawlPageReports[pageIdx]; // re-render tab with region verdicts/boxes
      cb();
    });
  }

  // After pixel-verify sets rawData._contrastVerifyResults, the score must be recomputed
  // (contrast.js only consumes verdicts when scoring re-runs) and BOTH the rendered-report
  // cache (_crawlPageReports) and the data-level cache (_cachedReportData) invalidated, or
  // the displayed grade stays pre-verify. Mirrors rescorePages().
  function _rescoreAfterVerify(page, pageIdx) {
    if (!page || !page.rawData) return;
    delete page.rawData._cachedReportData;
    if (pageIdx >= 0) delete _crawlPageReports[pageIdx];
    page.reportData = MilgScoring.runScoring(page.rawData);
  }

  function _spaExpandModal(url) {
    try { var p = String(url).replace(/^https?:\/\/[^/]+/, '') || url; _crawlModal('Exploring SPA views on ' + p + '…'); } catch (e) {}
  }

  // Fold a page's discovered SPA views/panels (from MilgIframe.analyzeSpaViews) into the
  // live crawl session as their own `done` pages. The explorer's first view is the initial
  // baseline (== the crawled page we already have) so it's skipped. Each folded view gets a
  // deterministic synthetic url (sourceUrl#stateKey — never re-fetched, so it bypasses the
  // crawl's hash-stripping dedup), a breadcrumb title, and parent/depth for the tree.
  function _foldSpaViews(session, pageEntry, r, budget) {
    var prov = session._spaProvenance || (session._spaProvenance = { clicked: [], skipped: [], notes: [], truncated: false, counts: { pages: 0, subViews: 0, panels: 0 } });
    // Merge exploration provenance across source pages (clicked/skipped/notes/truncated).
    if (r) {
      if (r.clicked) prov.clicked = prov.clicked.concat(r.clicked);
      if (r.skipped) prov.skipped = prov.skipped.concat(r.skipped);
      if (r.notes) r.notes.forEach(function(n) { prov.notes.push(n); });
      if (r.truncated) prov.truncated = true;
    }
    // Shared mapper (analyzer-spa.js MilgSpaMap): breadcrumb titles + _spa* meta, rooted at
    // this crawled page (skipInitial drops the baseline == the page we already have).
    var sourceTitle = (pageEntry.title || (pageEntry.rawData && pageEntry.rawData.meta && pageEntry.rawData.meta.title) || pageEntry.url || 'App').trim() || 'App';
    var built = MilgSpaMap.build(r, {
      base: pageEntry.url.replace(/#.*$/, ''), rootTitle: sourceTitle,
      inputMethod: 'crawl', skipInitial: true, sourceUrl: pageEntry.url,
      profile: (session.options && session.options.profile) || null
    });
    for (var i = 0; i < built.results.length; i++) {
      if (budget.used >= budget.totalCap) {
        prov.truncated = true;
        if (prov.notes.indexOf('SPA view budget reached — some views dropped') === -1) prov.notes.push('SPA view budget reached — some views dropped');
        break;
      }
      var rr = built.results[i], m = rr.data.meta || {};
      session.pages.push({
        url: rr.url, status: 'done', title: m.title || '',
        rawData: rr.data, reportData: MilgScoring.runScoring(rr.data), error: null,
        startedAt: pageEntry.completedAt, completedAt: pageEntry.completedAt
      });
      budget.used++;
      // Tally per actually-pushed view (budget may truncate before built.counts).
      if (m._spaKind === 'region') prov.counts.panels++;
      else if ((m._spaDepth || 0) >= 2) prov.counts.subViews++;
      else prov.counts.pages++;
    }
  }

  function _preComputePixelVerify() {
    if (!_crawlSession || !window.MilgContrastVerify || !window.MilgQueue) return;
    var pagesToVerify = _crawlSession.pages.filter(function(p) {
      return p.status === 'done' && p.rawData && !p.rawData._contrastVerifyResults &&
        p.rawData.screenshots && p.rawData.screenshots.length && p.rawData.screenshotMeta;
    });
    if (pagesToVerify.length === 0) return;
    var doneCount = 0;
    var totalCount = pagesToVerify.length;

    // Show pixel verify progress on summary page
    _updateVerifySummary(0, totalCount, null);

    // Queue all page verifies — active page tab gets highest priority
    MilgQueue.clear();
    pagesToVerify.forEach(function(page, pi) {
      var pageIdx = _crawlSession.pages.indexOf(page);
      var priority = (_crawlActivePageTab === String(pageIdx)) ? 100 : (totalCount - pi);
      MilgQueue.enqueue('crawl-verify-' + pageIdx, function(done) {
        // Already main-verified by another path — still ensure region sub-screenshots verify.
        if (page.rawData._contrastVerifyResults) { _verifyPageRegions(page, pageIdx, function() { done(null); }); return; }
        var report = page.reportData || MilgScoring.runScoring(page.rawData);
        MilgContrastVerify.verify(report, function(results, bboxEdgeResults) {
          if (!page.rawData._contrastVerifyResults) {
            page.rawData._contrastVerifyResults = results;
            page.rawData._bboxEdgeResults = bboxEdgeResults || [];
            _rescoreAfterVerify(page, pageIdx); // score now reflects pixel verdicts
          }
          _verifyPageRegions(page, pageIdx, function() { done(results); });
        });
      }, function() {
        doneCount++;
        _crawlModal('Pixel verify ' + doneCount + '/' + totalCount + ' pages');
        _updateVerifySummary(doneCount, totalCount, doneCount === totalCount ? _crawlSession : null);
        if (doneCount === totalCount) {
          // Rebuild summary + re-render so verified grades/scores show in the grid + tabs.
          _crawlSession.summary = MilgCrawl.buildSummary(_crawlSession);
          if (_crawlSession.summary && _crawlSession._spaProvenance) _crawlSession.summary._spaProvenance = _crawlSession._spaProvenance;
          renderCrawlTabs();
          showCrawlPageContent(_crawlActivePageTab || 'summary');
          setTimeout(_crawlModalClose, 2000);
        }
      }, priority);
    });
  }

  function _updateVerifySummary(done, total, completedSession) {
    var container = document.getElementById('milg-crawl-verify-summary');
    if (!container && crawlPageContent) {
      // Insert verify section near the top of the summary (after Site Overview stats, before Page Scores)
      container = document.createElement('div');
      container.id = 'milg-crawl-verify-summary';
      container.style.marginTop = '24px';
      var summaryDiv = crawlPageContent.querySelector('.crawl-summary');
      // Anchor to Page Scores so the verify block lands AFTER the Site Consistency
      // section (which is the first h3); fall back to first h3 / append.
      var anchor = summaryDiv ? (summaryDiv.querySelector('#crawl-page-scores') || summaryDiv.querySelector('h3')) : null;
      if (anchor) {
        anchor.parentNode.insertBefore(container, anchor);
      } else if (summaryDiv) {
        summaryDiv.appendChild(container);
      } else {
        crawlPageContent.appendChild(container);
      }
    }
    if (!container) return;

    if (!completedSession) {
      // Still running — show spinner with progress
      container.innerHTML = '<div class="crawl-summary">' +
        '<h3 style="display:flex;align-items:center;gap:8px">' +
        '<span style="display:inline-block;width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:milg-spin 0.8s linear infinite"></span>' +
        'Pixel Contrast Verification (' + done + '/' + total + ' pages)' +
        '<style>@keyframes milg-spin{to{transform:rotate(360deg)}}</style>' +
        '</h3></div>';
      return;
    }

    // All done — build the pixel verify summary across all pages
    var falsePassTotal = 0, falseFailTotal = 0, verifiedTotal = 0;
    var pageIssues = []; // [{url, path, falsePass, results}]
    completedSession.pages.forEach(function(page) {
      if (!page.rawData || !page.rawData._contrastVerifyResults) return;
      var results = page.rawData._contrastVerifyResults;
      var fp = 0, ff = 0, v = 0;
      results.forEach(function(r) {
        if (r.crossesBoundary) {
          if (r.cssPasses && !r.pixelPasses) fp++;
          else ff++;
        } else { v++; }
      });
      falsePassTotal += fp; falseFailTotal += ff; verifiedTotal += v;
      if (fp > 0) {
        var path; try { path = new URL(page.url).pathname; } catch(e) { path = page.url; }
        pageIssues.push({ url: page.url, path: path, falsePass: fp, results: results });
      }
    });

    var isDark = document.body && document.body.classList.contains('dark-ui');
    var html = '<div class="crawl-summary"><h3>Pixel Contrast Verification</h3>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px">';
    html += '<div style="padding:8px 16px;border-radius:8px;background:var(--surface);border:1px solid var(--border);font-size:13px">' +
      '<span style="font-weight:600">' + verifiedTotal + '</span> <span style="color:var(--text-secondary)">verified</span></div>';
    if (falsePassTotal > 0) {
      html += '<div style="padding:8px 16px;border-radius:8px;background:' + (isDark ? '#2d0f0f' : '#fef2f2') + ';border:1px solid ' + (isDark ? '#991b1b' : '#fecaca') + ';font-size:13px">' +
        '<span style="font-weight:700;color:#ef4444">' + falsePassTotal + '</span> <span style="color:#ef4444">hidden failure' + (falsePassTotal > 1 ? 's' : '') + '</span></div>';
    }
    if (falseFailTotal > 0) {
      html += '<div style="padding:8px 16px;border-radius:8px;background:' + (isDark ? '#0c2d1e' : '#f0fdf4') + ';border:1px solid ' + (isDark ? '#166534' : '#bbf7d0') + ';font-size:13px">' +
        '<span style="font-weight:600;color:#16a34a">' + falseFailTotal + '</span> <span style="color:#16a34a">better than CSS</span></div>';
    }
    if (falsePassTotal === 0 && falseFailTotal === 0) {
      html += '<div style="padding:8px 16px;border-radius:8px;background:' + (isDark ? '#0c2d1e' : '#f0fdf4') + ';border:1px solid ' + (isDark ? '#166534' : '#bbf7d0') + ';font-size:13px">' +
        '<span style="color:#16a34a">All pixel checks match CSS — no hidden issues</span></div>';
    }
    html += '</div>';

    // Per-page breakdown of failures
    if (pageIssues.length > 0) {
      html += '<div style="font-size:13px;line-height:1.6">';
      pageIssues.forEach(function(pi) {
        html += '<div style="padding:6px 10px;margin-bottom:4px;border-radius:6px;background:var(--surface);border:1px solid var(--border)">';
        html += '<span style="color:#ef4444;font-weight:600">' + pi.falsePass + ' hidden failure' + (pi.falsePass > 1 ? 's' : '') + '</span>';
        html += ' on <span style="font-weight:500">' + _esc(pi.path) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function startCrawl(url) {
    var maxPages = parseInt(crawlMaxPages.value) || 5;
    maxPages = Math.min(Math.max(maxPages, 1), CRAWL_HARD_MAX);

    var blacklist = (crawlBlacklist.value || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var jsCheck = document.getElementById('jsEnabledCheck');
    var jsAck = document.getElementById('jsRiskAck');
    var wantJs = jsCheck && jsCheck.checked && jsAck && jsAck.checked;
    var profile = document.getElementById('profileSelect');

    _crawlSession = MilgCrawl.createSession(url, {
      maxPages: maxPages,
      blacklist: blacklist,
      jsEnabled: wantJs,
      profile: profile ? profile.value : 'general'
    });
    _crawlPageReports = {};
    _crawlActivePageTab = 'summary';

    // Show progress
    _analyzeUrlBtn.disabled = true;
    _analyzeUrlBtn.textContent = 'Crawling\u2026';
    cancelCrawlBtn.style.display = '';
    crawlProgressArea.style.display = '';
    crawlProgressList.innerHTML = '';
    crawlProgressFill.style.width = '0%';
    crawlProgressLabel.textContent = 'Fetching starting page\u2026';
    crawlProgressCount.textContent = '0 / ' + maxPages;
    _crawlModalDismissed = false;
    window._milgFocusModalDismissed = false;
    _showFocusModal(true); // dismissable
    _crawlModal('Fetching starting page\u2026');

    // Show crawl results area, hide input section
    var inputSection = document.getElementById('inputSection');
    var reportActions = document.getElementById('reportActions');
    var reportContainer = document.getElementById('reportContainer');
    if (inputSection) inputSection.style.display = 'none';
    crawlResults.style.display = '';
    if (reportContainer) reportContainer.className = 'report-container';
    // Hide export bar during crawl — show only when crawl completes
    if (reportActions) reportActions.style.display = 'none';
    // Scroll to results
    crawlResults.scrollIntoView({ behavior: 'smooth', block: 'start' });

    renderCrawlTabs();
    showCrawlPageContent('summary');

    var doneCount = 0;
    var totalPages = 1;

    MilgCrawl.startCrawl(_crawlSession, {
      fetchPage: function(pageUrl, cb) {
        MilgProxy.fetchViaProxy(pageUrl, function(html, err) { cb(html, err); });
      },
      analyzePage: function(html, pageUrl, opts, cb) {
        var wantShots = document.getElementById('screenshotCheck') && document.getElementById('screenshotCheck').checked;
        var jsOn = _crawlSession && _crawlSession.options && _crawlSession.options.jsEnabled;
        function _doCrawlAnalysis() {
          MilgIframe.analyzeHtml(html, {
            url: pageUrl,
            jsEnabled: jsOn,
            screenshots: wantShots,
            exclude: opts.excludeSelector || null
          }, function(data) {
            if (data) {
              data.meta.url = pageUrl;
              data.meta._inputMethod = 'crawl';
              if (jsOn) data.meta._jsEnabled = true;
              if (opts.profile) data.profile = opts.profile;
            }
            cb(data);
          });
        }
        // Prefetch fonts for crawl pages (first page warms cache, subsequent get hits)
        if (wantShots) {
          MilgIframe.prefetchFonts(html, pageUrl, _doCrawlAnalysis);
        } else {
          _doCrawlAnalysis();
        }
      },
      scorePage: function(data) { return MilgScoring.runScoring(data); },
      // SPA expansion: if a crawled page is a single-page app with hidden views, explore
      // them and fold each discovered view/panel into THIS crawl session as its own page
      // (deterministic synthetic url, breadcrumb title, parent/depth), so the summary +
      // cross-page consistency see them. Bounded by a session-wide budget. No-op unless the
      // page is SPA-likely and (Tier-1 routes exist OR the "Explore SPA views" toggle is on).
      expandPage: function(pageEntry, session, done) {
        try {
          var raw = pageEntry.rawData;
          var spa = raw && raw.structure && raw.structure.spa;
          var spaToggle = document.getElementById('spaExploreCheck');
          var stateToggle = document.getElementById('stateCaptureCheck');
          var wantClicks = !!(spaToggle && spaToggle.checked);
          var STATE_THRESHOLD = 6;
          var hpCount = (raw && raw.layout && raw.layout.hiddenPanelCount) || 0;
          var wantState = !!(stateToggle && stateToggle.checked) && hpCount >= STATE_THRESHOLD;
          var wantSpa = (spa && spa.isLikelyHiddenViews && (((spa.routes || []).length >= 1) || wantClicks)) || wantState;
          if (!wantSpa || !pageEntry._html) { done(); return; }
          var budget = session._spa || (session._spa = { perPageCap: 12, totalCap: 40, used: 0 });
          var room = Math.min(budget.perPageCap, budget.totalCap - budget.used);
          if (room <= 1) { // 1 = the initial baseline we'd skip anyway
            var pv0 = session._spaProvenance || (session._spaProvenance = { clicked: [], skipped: [], notes: [], truncated: false, counts: { pages: 0, subViews: 0, panels: 0 } });
            if (pv0.notes.indexOf('SPA view budget reached — some pages not expanded') === -1) pv0.notes.push('SPA view budget reached — some pages not expanded');
            pv0.truncated = true;
            done(); return;
          }
          var wantShots = document.getElementById('screenshotCheck') && document.getElementById('screenshotCheck').checked;
          _spaExpandModal(pageEntry.url);
          MilgIframe.analyzeSpaViews(pageEntry._html, {
            url: pageEntry.url, exploreClicks: wantClicks, maxViews: room,
            screenshots: wantShots, timeBudgetMs: wantShots ? 30000 : 22000,
            stateCapture: !!(stateToggle && stateToggle.checked), stateThreshold: STATE_THRESHOLD
          }, function(r) {
            try { _foldSpaViews(session, pageEntry, r, budget); } catch (e) {}
            renderCrawlTabs();
            if (_crawlActivePageTab === 'summary') showCrawlPageContent('summary');
            done();
          });
        } catch (e) { done(); }
      },
      onDiscovery: function(urls) {
        totalPages = 1 + urls.length;
        crawlProgressCount.textContent = '0 / ' + totalPages;
        crawlProgressLabel.textContent = 'Found ' + urls.length + ' page' + (urls.length !== 1 ? 's' : '') + ' to crawl';
        _crawlModal('Found ' + urls.length + ' pages to crawl');
      },
      onPageStart: function(page) {
        updateCrawlProgressItem(page);
        var path = page.url.replace(/^https?:\/\/[^/]+/, '');
        crawlProgressLabel.textContent = 'Analyzing ' + path + '\u2026';
        _crawlModal('Page ' + (doneCount + 1) + '/' + totalPages + ': ' + path);
        renderCrawlTabs();
      },
      onPageComplete: function(page) {
        doneCount++;
        updateCrawlProgressItem(page);
        crawlProgressCount.textContent = doneCount + ' / ' + totalPages;
        crawlProgressFill.style.width = Math.round(doneCount / totalPages * 100) + '%';
        renderCrawlTabs();
        if (_crawlActivePageTab === 'summary') showCrawlPageContent('summary');
        // Pre-compute pixel verify as soon as page completes (async, best-effort)
        if (page.rawData && page.rawData.screenshots && page.rawData.screenshots.length && page.rawData.screenshotMeta && window.MilgContrastVerify) {
          var report = page.reportData || MilgScoring.runScoring(page.rawData);
          MilgContrastVerify.verify(report, function(results, bboxEdgeResults) {
            page.rawData._contrastVerifyResults = results;
            page.rawData._bboxEdgeResults = bboxEdgeResults || [];
            _rescoreAfterVerify(page, _crawlSession.pages.indexOf(page));
            _verifyPageRegions(page, _crawlSession.pages.indexOf(page), null);
          });
        }
      },
      onPageError: function(page) {
        doneCount++;
        updateCrawlProgressItem(page);
        crawlProgressCount.textContent = doneCount + ' / ' + totalPages;
        crawlProgressFill.style.width = Math.round(doneCount / totalPages * 100) + '%';
        renderCrawlTabs();
      },
      onComplete: function(session) {
        _analyzeUrlBtn.disabled = false;
        _analyzeUrlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Analyze URL';
        cancelCrawlBtn.style.display = 'none';
        crawlProgressLabel.textContent = 'Crawl complete!';
        crawlProgressFill.style.width = '100%';
        _crawlModal('Crawl complete! ' + _crawlSession.pages.length + ' pages analyzed');
        setTimeout(_crawlModalClose, 3000);
        // Carry SPA exploration provenance onto the freshly-built summary so the log shows.
        if (_crawlSession._spaProvenance && _crawlSession.summary) _crawlSession.summary._spaProvenance = _crawlSession._spaProvenance;
        renderCrawlTabs();
        showCrawlPageContent('summary');
        // Pixel-verify any folded SPA-view pages that weren't verified inline (no-op when
        // screenshots are off or everything is already verified).
        _preComputePixelVerify();
      }
    });
  }

  function setupCrawlExports(exportSeverityFilter) {
    var copyMdBtn = document.getElementById('copyMdBtn');
    var markdownBtn = document.getElementById('markdownBtn');
    var exportJsonBtn = document.getElementById('exportJsonBtn');

    if (copyMdBtn) {
      copyMdBtn.addEventListener('click', function(e) {
        if (!isCrawlActive()) return; // let original handler run
        e.stopImmediatePropagation();
        var filter = exportSeverityFilter ? exportSeverityFilter.value : 'all';
        var md = MilgCrawl.renderCrawlMarkdown(_crawlSession, filter);
        navigator.clipboard.writeText(md).then(function() { _showToast('Crawl report copied as Markdown!'); }).catch(function() { _showToast('Copy failed'); });
      });
    }
    if (markdownBtn) {
      markdownBtn.addEventListener('click', function(e) {
        if (!isCrawlActive()) return;
        e.stopImmediatePropagation();
        var filter = exportSeverityFilter ? exportSeverityFilter.value : 'all';
        var md = MilgCrawl.renderCrawlMarkdown(_crawlSession, filter);
        var blob = new Blob([md], { type: 'text/markdown' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'site-crawl-report.md'; a.click();
        URL.revokeObjectURL(a.href);
      });
    }
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', function(e) {
        if (!isCrawlActive()) return;
        e.stopImmediatePropagation();
        var origLabel = exportJsonBtn.innerHTML;
        exportJsonBtn.disabled = true;
        exportJsonBtn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:milg-spin 0.8s linear infinite;vertical-align:middle"></span> <span class="btn-label">Exporting\u2026</span>';
        requestAnimationFrame(function() { setTimeout(function() {
          try {
            var filter = exportSeverityFilter ? exportSeverityFilter.value : 'all';
            var json = MilgCrawl.renderCrawlJSON(_crawlSession, filter);
            // Compress with gzip
            if (typeof CompressionStream !== 'undefined') {
              exportJsonBtn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:milg-spin 0.8s linear infinite;vertical-align:middle"></span> <span class="btn-label">Compressing\u2026</span>';
              var blob = new Blob([json]);
              var cs = new CompressionStream('gzip');
              new Response(blob.stream().pipeThrough(cs)).blob().then(function(compressed) {
                var a = document.createElement('a');
                a.href = URL.createObjectURL(compressed);
                a.download = 'site-crawl-data.milg'; a.click();
                URL.revokeObjectURL(a.href);
                _showToast('Crawl exported (' + Math.round(json.length / 1048576) + ' MB → ' + Math.round(compressed.size / 1024) + ' KB)');
                exportJsonBtn.disabled = false;
                exportJsonBtn.innerHTML = origLabel;
              }).catch(function() {
                var a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
                a.download = 'site-crawl-data.json'; a.click();
                URL.revokeObjectURL(a.href);
                _showToast('Crawl exported (' + Math.round(json.length / 1024) + ' KB)');
                exportJsonBtn.disabled = false;
                exportJsonBtn.innerHTML = origLabel;
              });
            } else {
              var a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
              a.download = 'site-crawl-data.json'; a.click();
              URL.revokeObjectURL(a.href);
              _showToast('Crawl exported (' + Math.round(json.length / 1024) + ' KB)');
              exportJsonBtn.disabled = false;
              exportJsonBtn.innerHTML = origLabel;
            }
          } catch(err) {
            _showToast('Export failed: ' + err.message);
            exportJsonBtn.disabled = false;
            exportJsonBtn.innerHTML = origLabel;
          }
        }, 0); });
      });
    }
  }

  function setup(deps) {
    _showToast = deps.showToast;
    _runAnalysis = deps.runAnalysis;
    _restoreCachedAnalysis = deps.restoreCachedAnalysis;
    _analyzeUrlBtn = deps.analyzeUrlBtn;
    _showFocusModal = deps.showFocusModal;
    _updateFocusModal = deps.updateFocusModal;
    _hideFocusModal = deps.hideFocusModal;

    // Query DOM refs
    crawlSiteCheck = document.getElementById('crawlSiteCheck');
    crawlOptions = document.getElementById('crawlOptions');
    cancelCrawlBtn = document.getElementById('cancelCrawlBtn');
    crawlMaxPages = document.getElementById('crawlMaxPages');
    crawlBlacklist = document.getElementById('crawlBlacklist');
    crawlProgressArea = document.getElementById('crawlProgressArea');
    crawlProgressLabel = document.getElementById('crawlProgressLabel');
    crawlProgressCount = document.getElementById('crawlProgressCount');
    crawlProgressFill = document.getElementById('crawlProgressFill');
    crawlProgressList = document.getElementById('crawlProgressList');
    crawlResults = document.getElementById('crawlResults');
    crawlPageTabs = document.getElementById('crawlPageTabs');
    crawlPageContent = document.getElementById('crawlPageContent');

    // Crawl site toggle — show/hide crawl options
    if (crawlSiteCheck && crawlOptions) {
      crawlSiteCheck.addEventListener('change', function() {
        crawlOptions.style.display = crawlSiteCheck.checked ? '' : 'none';
      });
    }

    // Page limit easter egg — MutationObserver on max attr + input value check
    var _crawlEasterEggShown = false;
    if (crawlMaxPages) {
      var _crawlMaxObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
          if (m.attributeName === 'max') {
            var newMax = parseInt(crawlMaxPages.getAttribute('max'));
            if (newMax > 10 && !_crawlEasterEggShown) {
              _crawlEasterEggShown = true;
              _showToast('Nice try! We see you editing the DOM \uD83D\uDE0F Fine, ' + CRAWL_HARD_MAX + ' is the real limit\u2026 but your proxy rate limit isn\u2019t.');
              crawlMaxPages.setAttribute('max', CRAWL_HARD_MAX);
            }
          }
        });
      });
      _crawlMaxObserver.observe(crawlMaxPages, { attributes: true, attributeFilter: ['max'] });
      // Also catch when someone types >10 directly
      crawlMaxPages.addEventListener('input', function() {
        var val = parseInt(crawlMaxPages.value);
        if (val > 10 && !_crawlEasterEggShown) {
          _crawlEasterEggShown = true;
          _showToast('Going beyond 10? Bold move \uD83D\uDE0F We\u2019ll allow up to ' + CRAWL_HARD_MAX + '. You found the secret ceiling!');
          crawlMaxPages.setAttribute('max', CRAWL_HARD_MAX);
        }
      });
    }

    // Tab click delegation
    if (crawlPageTabs) {
      crawlPageTabs.addEventListener('click', function(e) {
        var tab = e.target.closest('[data-crawl-page]');
        if (!tab) return;
        showCrawlPageContent(tab.getAttribute('data-crawl-page'));
      });
    }

    // Cancel crawl
    if (cancelCrawlBtn) {
      cancelCrawlBtn.addEventListener('click', function() {
        if (_crawlSession) MilgCrawl.abortCrawl(_crawlSession);
        _analyzeUrlBtn.disabled = false;
        _analyzeUrlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Analyze URL';
        cancelCrawlBtn.style.display = 'none';
        crawlProgressLabel.textContent = 'Crawl cancelled';
      });
    }

    // Check for completed snippet crawl on load
    try {
      var snippetCrawlData = localStorage.getItem('milg-crawl-complete');
      if (snippetCrawlData) {
        localStorage.removeItem('milg-crawl-complete');
        var crawlState = JSON.parse(snippetCrawlData);
        if (loadCrawlResults(crawlState, 'console snippet')) {
          if (crawlSiteCheck) crawlSiteCheck.checked = true;
          if (crawlOptions) crawlOptions.style.display = '';
        }
      }
    } catch(e) { console.error('Failed to load snippet crawl data:', e); }

    // Crawl export wiring
    setupCrawlExports(document.getElementById('exportSeverityFilter'));
  }

  function resetCrawlState() {
    _crawlSession = null;
    _crawlPageReports = {};
    if (crawlResults) crawlResults.style.display = 'none';
    if (crawlPageContent) { crawlPageContent.style.display = 'none'; crawlPageContent.innerHTML = ''; }
    if (crawlProgressArea) crawlProgressArea.style.display = 'none';
  }

  // Re-score all crawl pages (e.g. when profile changes)
  function rescorePages() {
    if (!_crawlSession || !_crawlSession.pages || _crawlSession.pages.length === 0) return false;
    // Invalidate caches — profile change means all scores/reports are stale
    _crawlPageReports = {};
    _crawlSession.pages.forEach(function(page) {
      if (page.status === 'done' && page.rawData) {
        page.rawData.profile = document.getElementById('profileSelect').value;
        delete page.rawData._cachedReportData;
        page.reportData = MilgScoring.runScoring(page.rawData);
      }
    });
    _crawlSession.summary = MilgCrawl.buildSummary(_crawlSession);
    renderCrawlTabs();
    showCrawlPageContent(_crawlActivePageTab);
    return true;
  }

  return {
    setup: setup,
    getCrawlSession: getCrawlSession,
    setCrawlSession: setCrawlSession,
    getActiveTab: getActiveTab,
    isCrawlMode: isCrawlMode,
    isCrawlActive: isCrawlActive,
    startCrawl: startCrawl,
    loadCrawlResults: loadCrawlResults,
    renderCrawlTabs: renderCrawlTabs,
    showCrawlPageContent: showCrawlPageContent,
    resetCrawlState: resetCrawlState,
    rescorePages: rescorePages
  };
})();
