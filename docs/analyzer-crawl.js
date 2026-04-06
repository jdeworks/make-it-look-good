// Site Crawl Module — multi-page analysis with progressive results
// Provides: link discovery, session management, summary building, export helpers
// Pipeline orchestration lives in analyzer.js (has access to fetchViaProxy, MilgIframe.analyzeHtml)

window.MilgCrawl = (function() {
  "use strict";

  // --- URL utilities ---

  function normalizeUrl(url) {
    try {
      var u = new URL(url);
      u.hash = '';
      u.search = ''; // ignore query params for dedup (configurable later)
      if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.slice(0, -1);
      }
      return u.href;
    } catch(e) { return url; }
  }

  function matchesBlacklist(url, patterns) {
    if (!patterns || patterns.length === 0) return false;
    var path;
    try { path = new URL(url).pathname; } catch(e) { return false; }
    return patterns.some(function(pattern) {
      pattern = pattern.trim();
      if (!pattern) return false;
      if (pattern.endsWith('*')) {
        return path.startsWith(pattern.slice(0, -1));
      }
      return path === pattern || url.includes(pattern);
    });
  }

  var SKIP_EXTENSIONS = /\.(pdf|zip|tar|gz|png|jpg|jpeg|gif|svg|webp|ico|css|js|json|xml|woff|woff2|ttf|eot|mp3|mp4|avi|mov)$/i;

  function discoverLinks(html, baseUrl, blacklist, maxPages) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var origin;
    try { origin = new URL(baseUrl).origin; } catch(e) { return []; }
    var seen = new Set();
    seen.add(normalizeUrl(baseUrl));
    // Mark index variants as seen to avoid re-crawling the start page
    try {
      var baseP = new URL(baseUrl).pathname;
      if (baseP === '/' || baseP === '/index.html' || baseP === '/index.htm') {
        var o = new URL(baseUrl).origin;
        seen.add(normalizeUrl(o + '/')); seen.add(normalizeUrl(o + '/index.html')); seen.add(normalizeUrl(o + '/index.htm'));
      }
    } catch(e) {}

    var links = [];
    var anchors = doc.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
      var resolved;
      try { resolved = new URL(href, baseUrl).href; } catch(e) { continue; }
      var u;
      try { u = new URL(resolved); } catch(e) { continue; }
      if (u.origin !== origin) continue;
      if (SKIP_EXTENSIONS.test(u.pathname)) continue;
      var norm = normalizeUrl(resolved);
      if (seen.has(norm)) continue;
      if (matchesBlacklist(norm, blacklist)) continue;
      seen.add(norm);
      links.push(resolved);
      if (links.length >= maxPages - 1) break; // -1 because starting page is counted
    }
    return links;
  }

  // --- Session management ---

  var _sessionCounter = 0;

  function createSession(startUrl, options) {
    var opts = options || {};
    return {
      id: 'crawl-' + (++_sessionCounter) + '-' + Date.now(),
      startUrl: startUrl,
      startedAt: new Date().toISOString(),
      status: 'crawling',
      options: {
        maxPages: Math.min(Math.max(opts.maxPages || 5, 1), 25),
        blacklist: opts.blacklist || [],
        deepScan: !!opts.deepScan,
        jsEnabled: !!opts.jsEnabled,
        screenshots: !!opts.screenshots,
        excludeSelector: opts.excludeSelector || '',
        profile: opts.profile || 'general'
      },
      discoveredUrls: [],
      queue: [],
      pages: [],
      summary: null,
      _aborted: false
    };
  }

  // Start crawl — pipeline is an object with:
  //   fetchPage(url, callback(html, error))
  //   analyzePage(html, url, options, callback(data))
  //   scorePage(data) → reportData
  //   onPageStart(pageEntry)
  //   onPageComplete(pageEntry)
  //   onPageError(pageEntry)
  //   onDiscovery(urls)
  //   onComplete(session)
  function startCrawl(session, pipeline) {
    var startUrl = session.startUrl;
    var opts = session.options;

    // Step 1: fetch starting page to discover links
    var startPage = {
      url: startUrl,
      status: 'fetching',
      title: '',
      rawData: null,
      reportData: null,
      error: null,
      startedAt: new Date().toISOString(),
      completedAt: null
    };
    session.pages.push(startPage);
    if (pipeline.onPageStart) pipeline.onPageStart(startPage);

    pipeline.fetchPage(startUrl, function(html, err) {
      if (session._aborted) return;
      if (err || !html) {
        startPage.status = 'error';
        startPage.error = err || 'Empty response';
        startPage.completedAt = new Date().toISOString();
        if (pipeline.onPageError) pipeline.onPageError(startPage);
        session.status = 'complete';
        session.summary = buildSummary(session);
        if (pipeline.onComplete) pipeline.onComplete(session);
        return;
      }

      // Discover links from starting page HTML
      var discovered = discoverLinks(html, startUrl, opts.blacklist, opts.maxPages);
      session.discoveredUrls = discovered;
      session.queue = discovered.slice();
      if (pipeline.onDiscovery) pipeline.onDiscovery(discovered);

      // Analyze starting page
      startPage.status = 'analyzing';
      pipeline.analyzePage(html, startUrl, opts, function(data) {
        if (session._aborted) return;
        if (data) {
          startPage.rawData = data;
          startPage.title = (data.meta && data.meta.title) || '';
          startPage.reportData = pipeline.scorePage(data);
          startPage.status = 'done';
        } else {
          startPage.status = 'error';
          startPage.error = 'Analysis failed';
        }
        startPage.completedAt = new Date().toISOString();
        if (startPage.status === 'done') {
          if (pipeline.onPageComplete) pipeline.onPageComplete(startPage);
        } else {
          if (pipeline.onPageError) pipeline.onPageError(startPage);
        }

        // Process remaining queue
        processQueue(session, pipeline, 0);
      });
    });
  }

  function processQueue(session, pipeline, idx) {
    if (session._aborted) {
      session.status = 'aborted';
      session.summary = buildSummary(session);
      if (pipeline.onComplete) pipeline.onComplete(session);
      return;
    }
    if (idx >= session.queue.length) {
      session.status = 'complete';
      session.summary = buildSummary(session);
      if (pipeline.onComplete) pipeline.onComplete(session);
      return;
    }

    var url = session.queue[idx];
    var pageEntry = {
      url: url,
      status: 'fetching',
      title: '',
      rawData: null,
      reportData: null,
      error: null,
      startedAt: new Date().toISOString(),
      completedAt: null
    };
    session.pages.push(pageEntry);
    if (pipeline.onPageStart) pipeline.onPageStart(pageEntry);

    pipeline.fetchPage(url, function(html, err) {
      if (session._aborted) { processQueue(session, pipeline, idx + 1); return; }
      if (err || !html) {
        pageEntry.status = 'error';
        pageEntry.error = err || 'Empty response';
        pageEntry.completedAt = new Date().toISOString();
        if (pipeline.onPageError) pipeline.onPageError(pageEntry);
        // Continue after delay
        setTimeout(function() { processQueue(session, pipeline, idx + 1); }, 2000);
        return;
      }

      pageEntry.status = 'analyzing';
      pipeline.analyzePage(html, url, session.options, function(data) {
        if (session._aborted) { processQueue(session, pipeline, idx + 1); return; }
        if (data) {
          pageEntry.rawData = data;
          pageEntry.title = (data.meta && data.meta.title) || '';
          pageEntry.reportData = pipeline.scorePage(data);
          pageEntry.status = 'done';
        } else {
          pageEntry.status = 'error';
          pageEntry.error = 'Analysis failed';
        }
        pageEntry.completedAt = new Date().toISOString();
        if (pageEntry.status === 'done') {
          if (pipeline.onPageComplete) pipeline.onPageComplete(pageEntry);
        } else {
          if (pipeline.onPageError) pipeline.onPageError(pageEntry);
        }
        // Delay between pages to respect rate limits
        setTimeout(function() { processQueue(session, pipeline, idx + 1); }, 2000);
      });
    });
  }

  function abortCrawl(session) {
    session._aborted = true;
  }

  // --- Summary builder ---

  function buildSummary(session) {
    var donePages = session.pages.filter(function(p) { return p.status === 'done' && p.reportData; });
    var failedPages = session.pages.filter(function(p) { return p.status === 'error'; });

    if (donePages.length === 0) {
      return {
        pagesAnalyzed: 0, pagesFailed: failedPages.length,
        averageScore: 0, worstPage: null, bestPage: null,
        scoreGrid: [], crossPageIssues: [], categoryAverages: []
      };
    }

    // Score grid
    var scoreGrid = donePages.map(function(p) {
      var path;
      try { path = new URL(p.url).pathname; } catch(e) { path = p.url; }
      return { url: p.url, path: path, title: p.title, score: p.reportData.overall, grade: p.reportData.grade };
    });

    var scores = donePages.map(function(p) { return p.reportData.overall; });
    var avgScore = Math.round(scores.reduce(function(a, b) { return a + b; }, 0) / scores.length);

    var worstIdx = scores.indexOf(Math.min.apply(null, scores));
    var bestIdx = scores.indexOf(Math.max.apply(null, scores));

    // Cross-page issue grouping
    var issueMap = {};
    donePages.forEach(function(p) {
      if (!p.reportData || !p.reportData.categories) return;
      p.reportData.categories.forEach(function(cat) {
        cat.findings.forEach(function(f) {
          if (f.severity === 'info') return;
          var key = f.severity + '|' + f.title;
          if (!issueMap[key]) {
            issueMap[key] = { title: f.title, severity: f.severity, fix: f.fix, pages: [], count: 0 };
          }
          issueMap[key].pages.push({ url: p.url, detail: f.detail || '' });
          issueMap[key].count++;
        });
      });
    });
    var crossPageIssues = Object.keys(issueMap).map(function(k) { return issueMap[k]; });
    crossPageIssues.sort(function(a, b) {
      // Errors first, then by count
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
      return b.count - a.count;
    });

    // Category averages
    var catMap = {};
    donePages.forEach(function(p) {
      if (!p.reportData || !p.reportData.categories) return;
      p.reportData.categories.forEach(function(cat) {
        if (!catMap[cat.label]) catMap[cat.label] = { scores: [], worstScore: 100, worstPage: '' };
        catMap[cat.label].scores.push(cat.score);
        if (cat.score < catMap[cat.label].worstScore) {
          catMap[cat.label].worstScore = cat.score;
          catMap[cat.label].worstPage = p.url;
        }
      });
    });
    var categoryAverages = Object.keys(catMap).map(function(label) {
      var scores = catMap[label].scores;
      return {
        label: label,
        avgScore: Math.round(scores.reduce(function(a, b) { return a + b; }, 0) / scores.length),
        worstPage: catMap[label].worstPage
      };
    });

    // Deep scan viewport aggregation
    var viewportSummary = null;
    var deepPages = donePages.filter(function(p) { return p.rawData && p.rawData.deepScan && p.rawData.deepScan.viewports; });
    if (deepPages.length > 0) {
      var vpLabels = deepPages[0].rawData.deepScan.viewports.map(function(v) { return v.label; });
      var vpCount = vpLabels.length;
      // Per-viewport aggregated findings
      var vpStats = vpLabels.map(function(label, vi) {
        var touchTotal = 0, contrastTotal = 0, overflowCount = 0;
        deepPages.forEach(function(p) {
          var vp = p.rawData.deepScan.viewports[vi];
          if (!vp || vp.error) return;
          touchTotal += vp.touchTargets || 0;
          contrastTotal += vp.contrastFails || 0;
          if (vp.overflow) overflowCount++;
        });
        return { label: label, width: deepPages[0].rawData.deepScan.viewports[vi].width, touchTargets: touchTotal, contrastFails: contrastTotal, overflowPages: overflowCount };
      });

      // Cross-viewport issue matching: identify universal vs viewport-specific issues
      var vpIssueMap = {}; // issueKey → Set of viewport labels where it appears
      deepPages.forEach(function(p) {
        var vds = p.rawData.deepScan.viewportData;
        if (!vds) return;
        vds.forEach(function(vd, vi) {
          if (!vd || !vd.data) return;
          var scored = p.reportData; // primary viewport scoring
          // Use per-viewport data to find issues
          var vpData = vd.data;
          // Touch target fails per viewport
          var touches = (vpData.interaction && vpData.interaction.touchTargets) || [];
          touches.forEach(function(t) {
            var key = 'touch|' + (t.selector || t.element || 'unknown');
            if (!vpIssueMap[key]) vpIssueMap[key] = { title: 'Touch target: ' + (t.selector || t.element || '').substring(0, 60), type: 'touch', viewports: [], pages: [] };
            if (vpIssueMap[key].viewports.indexOf(vpLabels[vi]) === -1) vpIssueMap[key].viewports.push(vpLabels[vi]);
            vpIssueMap[key].pages.push(p.url);
          });
          // Contrast fails per viewport
          var pairs = (vpData.colors && vpData.colors.contrastPairs) || [];
          pairs.forEach(function(cp) {
            if (cp.passes) return;
            var key = 'contrast|' + (cp.selector || '') + '|' + (cp.text || '').substring(0, 20);
            if (!vpIssueMap[key]) vpIssueMap[key] = { title: 'Contrast: ' + (cp.selector || '').substring(0, 40) + ' "' + (cp.text || '').substring(0, 20) + '"', type: 'contrast', viewports: [], pages: [] };
            if (vpIssueMap[key].viewports.indexOf(vpLabels[vi]) === -1) vpIssueMap[key].viewports.push(vpLabels[vi]);
            vpIssueMap[key].pages.push(p.url);
          });
        });
      });

      // Classify issues: universal (all viewports) vs viewport-specific
      var universalIssues = [];
      var viewportSpecific = [];
      Object.keys(vpIssueMap).forEach(function(k) {
        var issue = vpIssueMap[k];
        var uniquePages = []; issue.pages.forEach(function(u) { if (uniquePages.indexOf(u) === -1) uniquePages.push(u); });
        issue.pageCount = uniquePages.length;
        if (issue.viewports.length >= vpCount) {
          universalIssues.push(issue);
        } else {
          viewportSpecific.push(issue);
        }
      });
      // Sort by page count desc
      universalIssues.sort(function(a, b) { return b.pageCount - a.pageCount; });
      viewportSpecific.sort(function(a, b) { return b.pageCount - a.pageCount; });

      viewportSummary = {
        viewportCount: vpCount,
        viewportLabels: vpLabels,
        viewportStats: vpStats,
        universalIssues: universalIssues.slice(0, 20),
        viewportSpecific: viewportSpecific.slice(0, 20),
        deepPageCount: deepPages.length
      };
    }

    return {
      pagesAnalyzed: donePages.length,
      pagesFailed: failedPages.length,
      averageScore: avgScore,
      worstPage: { url: donePages[worstIdx].url, score: scores[worstIdx] },
      bestPage: { url: donePages[bestIdx].url, score: scores[bestIdx] },
      scoreGrid: scoreGrid,
      crossPageIssues: crossPageIssues,
      categoryAverages: categoryAverages,
      viewportSummary: viewportSummary
    };
  }

  // --- Export helpers ---

  function filterFindings(categories, minSeverity) {
    if (!minSeverity || minSeverity === 'all') return categories;
    return categories.map(function(cat) {
      return Object.assign({}, cat, {
        findings: cat.findings.filter(function(f) {
          if (minSeverity === 'error') return f.severity === 'error';
          if (minSeverity === 'warning') return f.severity === 'error' || f.severity === 'warning';
          return true;
        })
      });
    });
  }

  function renderCrawlMarkdown(session, severityFilter) {
    var summary = session.summary || buildSummary(session);
    var lines = [];
    lines.push('# Site Crawl Report');
    lines.push('');
    lines.push('**Starting URL:** ' + session.startUrl);
    lines.push('**Date:** ' + new Date(session.startedAt).toLocaleString());
    lines.push('**Pages analyzed:** ' + summary.pagesAnalyzed + ' (failed: ' + summary.pagesFailed + ')');
    lines.push('**Average score:** ' + summary.averageScore + '/100');
    if (summary.viewportSummary) {
      lines.push('**Viewports:** ' + summary.viewportSummary.viewportCount + ' (' + summary.viewportSummary.viewportLabels.join(', ') + ')');
    }
    if (severityFilter && severityFilter !== 'all') {
      lines.push('**Filter:** ' + (severityFilter === 'error' ? 'Errors only' : 'Warnings + Errors'));
    }
    lines.push('');

    // Score grid
    lines.push('## Score Summary');
    lines.push('');
    lines.push('| Page | Score | Grade |');
    lines.push('|------|-------|-------|');
    summary.scoreGrid.forEach(function(row) {
      lines.push('| ' + row.path + ' | ' + row.score + ' | ' + row.grade + ' |');
    });
    lines.push('');

    // Cross-page issues
    var filteredIssues = summary.crossPageIssues.filter(function(issue) {
      if (severityFilter === 'error') return issue.severity === 'error';
      if (severityFilter === 'warning') return issue.severity === 'error' || issue.severity === 'warning';
      return true;
    });
    if (filteredIssues.length > 0) {
      lines.push('## Cross-Page Issues');
      lines.push('');
      filteredIssues.forEach(function(issue) {
        var icon = issue.severity === 'error' ? 'x' : '!';
        lines.push('### [' + icon + '] ' + issue.title + ' (' + issue.count + ' page' + (issue.count > 1 ? 's' : '') + ')');
        issue.pages.forEach(function(p) {
          var path; try { path = new URL(p.url).pathname; } catch(e) { path = p.url; }
          lines.push('- ' + path + (p.detail ? ': ' + p.detail : ''));
        });
        if (issue.fix) lines.push('- **Fix:** ' + issue.fix);
        lines.push('');
      });
    }

    // Viewport breakdown (deep scan)
    if (summary.viewportSummary) {
      var vs = summary.viewportSummary;
      lines.push('## Viewport Breakdown');
      lines.push('');
      lines.push('| Viewport | Width | Contrast Fails | Touch Targets | Overflow Pages |');
      lines.push('|----------|-------|---------------|---------------|----------------|');
      vs.viewportStats.forEach(function(vp) {
        lines.push('| ' + vp.label + ' | ' + vp.width + 'px | ' + vp.contrastFails + ' | ' + vp.touchTargets + ' | ' + vp.overflowPages + ' |');
      });
      lines.push('');
      if (vs.universalIssues.length > 0) {
        lines.push('### Universal Issues (all viewports)');
        lines.push('');
        vs.universalIssues.forEach(function(issue) {
          lines.push('- ' + issue.title + ' (' + issue.pageCount + ' page' + (issue.pageCount > 1 ? 's' : '') + ')');
        });
        lines.push('');
      }
      if (vs.viewportSpecific.length > 0) {
        lines.push('### Viewport-Specific Issues');
        lines.push('');
        vs.viewportSpecific.forEach(function(issue) {
          lines.push('- ' + issue.title + ' — *' + issue.viewports.join(', ') + ' only* (' + issue.pageCount + ' page' + (issue.pageCount > 1 ? 's' : '') + ')');
        });
        lines.push('');
      }
    }

    // Per-page reports
    lines.push('## Per-Page Reports');
    lines.push('');
    session.pages.forEach(function(page) {
      if (page.status !== 'done' || !page.reportData) return;
      var path; try { path = new URL(page.url).pathname; } catch(e) { path = page.url; }
      lines.push('---');
      lines.push('### ' + path + ' (' + page.reportData.overall + '/100 — ' + page.reportData.grade + ')');
      lines.push('');
      var cats = filterFindings(page.reportData.categories, severityFilter);
      cats.forEach(function(cat) {
        var relevant = cat.findings.length;
        if (relevant === 0) return;
        lines.push('#### ' + cat.label);
        cat.findings.forEach(function(f) {
          var icon = f.severity === 'error' ? 'x' : f.severity === 'warning' ? '!' : 'i';
          lines.push('- [' + icon + '] ' + f.title);
          if (f.detail) lines.push('  - ' + f.detail);
          if (f.fix) lines.push('  - **Fix:** ' + f.fix);
        });
        lines.push('');
      });
      // Per-page pixel verify summary
      if (page.rawData && page.rawData._contrastVerifyResults && page.rawData._contrastVerifyResults.length > 0) {
        var pvr = page.rawData._contrastVerifyResults;
        var pvFp = pvr.filter(function(r) { return r.cssPasses && !r.pixelPasses; });
        var pvFf = pvr.filter(function(r) { return !r.cssPasses && r.pixelPasses; });
        if (pvFp.length > 0 || pvFf.length > 0) {
          lines.push('#### Pixel Verification');
          if (pvFp.length > 0) lines.push('- ' + pvFp.length + ' hidden failure(s)');
          if (pvFf.length > 0) lines.push('- ' + pvFf.length + ' false positive(s)');
          lines.push('');
        }
      }
    });

    return lines.join('\n');
  }

  function renderCrawlJSON(session, severityFilter) {
    // Break circular refs and strip debug data — keep screenshots, masks, verify for full export
    var _skipKeys = { deepScan: 1, _cachedReportData: 1, _vpCacheIdx: 1, _maskBmp: 1, _debug: 1 };
    var _replacer = function(k, v) { return _skipKeys[k] ? undefined : v; };
    var out = {
      _milgCrawl: true,
      startUrl: session.startUrl,
      startedAt: session.startedAt,
      options: session.options,
      summary: session.summary,
      // results: re-importable raw extraction data (loadCrawlResults compatible)
      results: session.pages.filter(function(p) { return p.status === 'done' && p.rawData; }).map(function(p) {
        var rawClone = JSON.parse(JSON.stringify(p.rawData, _replacer));
        // Include deep scan summary (without full viewport data)
        if (p.rawData.deepScan) {
          rawClone.deepScan = { viewports: p.rawData.deepScan.viewports, darkMode: p.rawData.deepScan.darkMode || null };
        }
        // Pixel verify results are included automatically via the clone
        // (samplePoints and _debug already stripped by replacer)
        return { url: p.url, data: rawClone };
      }),
      pages: session.pages.map(function(p) {
        if (p.status !== 'done' || !p.reportData) {
          return { url: p.url, status: p.status, error: p.error };
        }
        var cats = filterFindings(p.reportData.categories, severityFilter);
        var pageOut = {
          url: p.url,
          title: p.title,
          score: p.reportData.overall,
          grade: p.reportData.grade,
          categories: cats.map(function(c) {
            return { label: c.label, score: c.score, findings: c.findings };
          })
        };
        // Include deep scan viewport data if available
        if (p.rawData && p.rawData.deepScan && p.rawData.deepScan.viewports) {
          pageOut.deepScan = {
            viewports: p.rawData.deepScan.viewports,
            darkMode: p.rawData.deepScan.darkMode || null
          };
          if (p.rawData.deepScan.viewportData) {
            pageOut.deepScan.viewportData = p.rawData.deepScan.viewportData.map(function(vd) {
              if (!vd || !vd.data) return null;
              var vpOut = { label: vd.label, width: vd.width };
              var d = vd.data;
              vpOut.contrastFails = (d.colors && d.colors.contrastPairs || []).filter(function(cp) { return !cp.passes; }).length;
              vpOut.touchTargets = (d.interaction && d.interaction.touchTargets || []).length;
              vpOut.overflow = (d.structure && d.structure.hasHorizontalOverflow) || false;
              if (d._contrastVerifyResults) {
                vpOut.pixelVerify = {
                  total: d._contrastVerifyResults.length,
                  falsePass: d._contrastVerifyResults.filter(function(r) { return r.cssPasses && !r.pixelPasses; }).length,
                  falseFail: d._contrastVerifyResults.filter(function(r) { return !r.cssPasses && r.pixelPasses; }).length
                };
              }
              return vpOut;
            });
          }
        }
        // Include pixel verify if available
        if (p.rawData && p.rawData._contrastVerifyResults) {
          pageOut.pixelVerify = {
            total: p.rawData._contrastVerifyResults.length,
            falsePass: p.rawData._contrastVerifyResults.filter(function(r) { return r.cssPasses && !r.pixelPasses; }).length,
            falseFail: p.rawData._contrastVerifyResults.filter(function(r) { return !r.cssPasses && r.pixelPasses; }).length
          };
        }
        return pageOut;
      })
    };
    return JSON.stringify(out, null, 2);
  }

  // --- Public API ---

  return {
    normalizeUrl: normalizeUrl,
    matchesBlacklist: matchesBlacklist,
    discoverLinks: discoverLinks,
    createSession: createSession,
    startCrawl: startCrawl,
    abortCrawl: abortCrawl,
    buildSummary: buildSummary,
    filterFindings: filterFindings,
    renderCrawlMarkdown: renderCrawlMarkdown,
    renderCrawlJSON: renderCrawlJSON
  };
})();
