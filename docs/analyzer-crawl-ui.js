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
  var _showToast, _runAnalysis, _analyzeUrlBtn, _runDeepScanLoop;

  // DOM refs queried during setup
  var crawlSiteCheck, crawlOptions, cancelCrawlBtn, crawlMaxPages, crawlBlacklist;
  var crawlProgressArea, crawlProgressLabel, crawlProgressCount, crawlProgressFill, crawlProgressList;
  var crawlResults, crawlPageTabs, crawlPageContent;

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

  function showCrawlPageContent(key) {
    _crawlActivePageTab = key;
    renderCrawlTabs();
    var reportContainer = document.getElementById('reportContainer');
    var reportActions = document.getElementById('reportActions');
    // Show export/actions only after crawl is complete (not during progress)
    var crawlDone = _crawlSession && _crawlSession.status === 'complete';
    if (reportActions) reportActions.style.display = crawlDone ? 'flex' : 'none';
    if (key === 'summary') {
      var summary = _crawlSession.summary || MilgCrawl.buildSummary(_crawlSession);
      crawlPageContent.innerHTML = MilgReport.renderCrawlSummary(summary);
      crawlPageContent.style.display = '';
      crawlPageContent.className = 'report-container visible';
      if (reportContainer) { reportContainer.style.display = 'none'; reportContainer.className = 'report-container'; }
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
      // Show page report — use runAnalysis but skip exclusion detection
      // (exclusion patterns are per-page noise that doesn't apply in crawl context)
      crawlPageContent.style.display = 'none';
      crawlPageContent.className = 'report-container';
      if (reportContainer) reportContainer.style.display = '';
      // Temporarily mark as crawl-driven so runAnalysis doesn't hide tabs
      page.rawData.meta = page.rawData.meta || {};
      var origMethod = page.rawData.meta._inputMethod;
      _runAnalysis(page.rawData, 'crawl-page');
      page.rawData.meta._inputMethod = origMethod;
    }
  }

  // Load multi-page crawl results into the tabbed view
  function loadCrawlResults(crawlState, source) {
    if (!crawlState || !crawlState.results || crawlState.results.length === 0) return false;
    _showToast('Loaded crawl results' + (source ? ' from ' + source : '') + ' (' + crawlState.results.length + ' pages)');
    _crawlSession = MilgCrawl.createSession(crawlState.startUrl || crawlState.results[0].url, {
      maxPages: crawlState.results.length,
      profile: document.getElementById('profileSelect') ? document.getElementById('profileSelect').value : 'general'
    });
    crawlState.results.forEach(function(r) {
      var report = MilgScoring.runScoring(r.data);
      _crawlSession.pages.push({
        url: r.url, status: 'done', title: (r.data.meta && r.data.meta.title) || '',
        rawData: r.data, reportData: report, error: null,
        startedAt: r.data.meta.timestamp, completedAt: r.data.meta.timestamp
      });
    });
    _crawlSession.status = 'complete';
    _crawlSession.summary = MilgCrawl.buildSummary(_crawlSession);
    crawlResults.style.display = '';
    var reportActions = document.getElementById('reportActions');
    if (reportActions) reportActions.style.display = '';
    document.getElementById('inputSection').style.display = 'none';
    renderCrawlTabs();
    showCrawlPageContent('summary');
    return true;
  }

  function startCrawl(url) {
    var maxPages = parseInt(crawlMaxPages.value) || 5;
    maxPages = Math.min(Math.max(maxPages, 1), CRAWL_HARD_MAX);

    var blacklist = (crawlBlacklist.value || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var deepScan = document.getElementById('deepScanCheck') && document.getElementById('deepScanCheck').checked;
    var profile = document.getElementById('profileSelect');

    _crawlSession = MilgCrawl.createSession(url, {
      maxPages: maxPages,
      blacklist: blacklist,
      deepScan: deepScan,
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
        var isDeep = _crawlSession && _crawlSession.options && _crawlSession.options.deepScan && _runDeepScanLoop;
        if (isDeep) {
          _runDeepScanLoop(html, pageUrl, opts.excludeSelector || null, wantShots, null, function(primary) {
            if (primary) {
              primary.meta.url = pageUrl;
              primary.meta._inputMethod = 'crawl';
              if (opts.profile) primary.profile = opts.profile;
            }
            cb(primary);
          });
        } else {
          MilgIframe.analyzeHtmlInIframe(html, function(data) {
            if (data) {
              data.meta.url = pageUrl;
              data.meta._inputMethod = 'crawl';
              if (opts.profile) data.profile = opts.profile;
            }
            cb(data);
          }, pageUrl, opts.excludeSelector || null, wantShots);
        }
      },
      scorePage: function(data) { return MilgScoring.runScoring(data); },
      onDiscovery: function(urls) {
        totalPages = 1 + urls.length;
        crawlProgressCount.textContent = '0 / ' + totalPages;
        crawlProgressLabel.textContent = 'Found ' + urls.length + ' page' + (urls.length !== 1 ? 's' : '') + ' to crawl';
      },
      onPageStart: function(page) {
        updateCrawlProgressItem(page);
        crawlProgressLabel.textContent = 'Analyzing ' + page.url.replace(/^https?:\/\/[^/]+/, '') + '\u2026';
        renderCrawlTabs();
      },
      onPageComplete: function(page) {
        doneCount++;
        updateCrawlProgressItem(page);
        crawlProgressCount.textContent = doneCount + ' / ' + totalPages;
        crawlProgressFill.style.width = Math.round(doneCount / totalPages * 100) + '%';
        renderCrawlTabs();
        if (_crawlActivePageTab === 'summary') showCrawlPageContent('summary');
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
        renderCrawlTabs();
        showCrawlPageContent('summary');
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
      });
    }
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', function(e) {
        if (!isCrawlActive()) return;
        e.stopImmediatePropagation();
        var filter = exportSeverityFilter ? exportSeverityFilter.value : 'all';
        var json = MilgCrawl.renderCrawlJSON(_crawlSession, filter);
        var blob = new Blob([json], { type: 'application/json' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'site-crawl-data.json'; a.click();
      });
    }
  }

  function setup(deps) {
    _showToast = deps.showToast;
    _runAnalysis = deps.runAnalysis;
    _analyzeUrlBtn = deps.analyzeUrlBtn;
    _runDeepScanLoop = deps.runDeepScanLoop;

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
    _crawlSession.pages.forEach(function(page) {
      if (page.status === 'done' && page.rawData) {
        page.rawData.profile = document.getElementById('profileSelect').value;
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
