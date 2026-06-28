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

  // --- Sitemap discovery ---
  // Best-effort: fetches /sitemap.xml (and robots.txt Sitemap: hints), parses <loc>
  // entries, follows one level of sitemap-index nesting, returns same-origin URLs.
  // fetchText(url, cb(text, err)) is injected so this is unit-testable in node and
  // routes through the proxy in the browser. NEVER throws — returns [] on any failure.

  function _extractLocs(xml) {
    var locs = [];
    if (!xml || typeof xml !== 'string') return locs;
    var re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
    var m;
    while ((m = re.exec(xml)) !== null) {
      var val = m[1]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
        .trim();
      if (val) locs.push(val);
    }
    return locs;
  }

  function _isSitemapIndex(xml) {
    return /<sitemapindex[\s>]/i.test(xml || '');
  }

  // Parse robots.txt for `Sitemap:` directives → array of sitemap URLs.
  function _parseRobotsSitemaps(robotsText) {
    var out = [];
    if (!robotsText || typeof robotsText !== 'string') return out;
    var lines = robotsText.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var mm = /^\s*sitemap\s*:\s*(\S+)/i.exec(lines[i]);
      if (mm && mm[1]) out.push(mm[1].trim());
    }
    return out;
  }

  // Wrap a callback-style fetchText into a promise; resolve to '' on error so
  // discovery never rejects.
  function _fetchTextP(fetchText, url) {
    return new Promise(function(resolve) {
      try {
        var ret = fetchText(url, function(text, err) {
          resolve(err || !text ? '' : String(text));
        });
        // Support fetchText returning a promise/value too (test convenience)
        if (ret && typeof ret.then === 'function') {
          ret.then(function(text) { resolve(text == null ? '' : String(text)); },
                   function() { resolve(''); });
        }
      } catch (e) { resolve(''); }
    });
  }

  // discoverSitemap(origin, fetchText) → Promise<string[]> of same-origin page URLs.
  // origin: e.g. 'https://example.com' (origin or full URL — origin is derived).
  function discoverSitemap(origin, fetchText) {
    var org;
    try { org = new URL(origin).origin; } catch (e) { return Promise.resolve([]); }

    // Candidate sitemap URLs: robots.txt hints first, then the conventional default.
    return _fetchTextP(fetchText, org + '/robots.txt').then(function(robots) {
      var candidates = _parseRobotsSitemaps(robots).filter(function(u) {
        try { return new URL(u).origin === org; } catch (e) { return false; }
      });
      if (candidates.indexOf(org + '/sitemap.xml') === -1) candidates.push(org + '/sitemap.xml');

      // Fetch each candidate. If it's a sitemap-index, follow one level of children.
      var seenSitemaps = {};
      function fetchSitemap(url, allowNest) {
        if (seenSitemaps[url]) return Promise.resolve([]);
        seenSitemaps[url] = true;
        return _fetchTextP(fetchText, url).then(function(xml) {
          if (!xml) return [];
          var locs = _extractLocs(xml);
          if (_isSitemapIndex(xml) && allowNest) {
            // locs point to child sitemaps — fetch each (one level deep, same origin).
            var children = locs.filter(function(u) {
              try { return new URL(u).origin === org; } catch (e) { return false; }
            }).slice(0, 50);
            return Promise.all(children.map(function(c) { return fetchSitemap(c, false); }))
              .then(function(arrs) {
                return arrs.reduce(function(a, b) { return a.concat(b); }, []);
              });
          }
          return locs;
        });
      }

      return Promise.all(candidates.map(function(c) { return fetchSitemap(c, true); }))
        .then(function(arrs) {
          var all = arrs.reduce(function(a, b) { return a.concat(b); }, []);
          var seen = new Set();
          var out = [];
          for (var i = 0; i < all.length; i++) {
            var raw = all[i];
            var u;
            try { u = new URL(raw); } catch (e) { continue; }
            if (u.origin !== org) continue;
            if (SKIP_EXTENSIONS.test(u.pathname)) continue;
            var norm = normalizeUrl(raw);
            if (seen.has(norm)) continue;
            seen.add(norm);
            out.push(raw);
          }
          return out;
        });
    }).catch(function() { return []; });
  }

  // mergeDiscovered(domLinks, sitemapUrls, blacklist, maxPages) — union by
  // normalizeUrl, drop blacklisted, cap at maxPages-1 (start page counts as 1).
  function mergeDiscovered(domLinks, sitemapUrls, blacklist, maxPages) {
    var seen = new Set();
    var out = [];
    var cap = Math.max((maxPages || 1) - 1, 0);
    var sources = [domLinks || [], sitemapUrls || []];
    for (var s = 0; s < sources.length; s++) {
      var list = sources[s];
      for (var i = 0; i < list.length; i++) {
        if (out.length >= cap) return out;
        var url = list[i];
        if (!url) continue;
        var norm = normalizeUrl(url);
        if (seen.has(norm)) continue;
        if (matchesBlacklist(norm, blacklist)) continue;
        seen.add(norm);
        out.push(url);
      }
    }
    return out;
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
      var domLinks = discoverLinks(html, startUrl, opts.blacklist, opts.maxPages);

      // Helper: merge DOM links + sitemap URLs, exclude the start page (and its index
      // variants), apply blacklist, cap at maxPages-1, then queue + analyze.
      function _finishDiscovery(sitemapUrls) {
        var startNorms = {};
        startNorms[normalizeUrl(startUrl)] = 1;
        try {
          var bP = new URL(startUrl).pathname, bO = new URL(startUrl).origin;
          if (bP === '/' || bP === '/index.html' || bP === '/index.htm') {
            startNorms[normalizeUrl(bO + '/')] = 1;
            startNorms[normalizeUrl(bO + '/index.html')] = 1;
            startNorms[normalizeUrl(bO + '/index.htm')] = 1;
          }
        } catch (e) {}
        var cleanSitemap = (sitemapUrls || []).filter(function(u) {
          return !startNorms[normalizeUrl(u)];
        });
        var discovered = mergeDiscovered(domLinks, cleanSitemap, opts.blacklist, opts.maxPages);
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
      }

      // Best-effort sitemap discovery: reuse the crawl's proxy fetch (pipeline.fetchPage)
      // as fetchText so CORS works. Never blocks/breaks the crawl on failure.
      var origin;
      try { origin = new URL(startUrl).origin; } catch (e) { origin = null; }
      if (origin && pipeline.fetchPage) {
        var sitemapFetch = function(url, cb) { pipeline.fetchPage(url, cb); };
        var done = false;
        var finalize = function(urls) {
          if (done) return; done = true;
          if (session._aborted) return;
          _finishDiscovery(urls || []);
        };
        try {
          discoverSitemap(origin, sitemapFetch).then(function(urls) { finalize(urls); },
                                                      function() { finalize([]); });
        } catch (e) { finalize([]); }
      } else {
        _finishDiscovery([]);
      }
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

  // --- Cross-page design consistency ---
  // Operates on the per-page rawData already retained in session.pages[]. Compares
  // design tokens (fonts, type scale, spacing, radius, palette, dark mode, framework)
  // ACROSS pages to surface drift that per-page scoring can't see. Session-level on
  // purpose — the scoring registry is strictly per-page, so this can't be a dimension.

  function _consPath(url) { try { return new URL(url).pathname || '/'; } catch(e) { return url; } }
  function _consGrade(s) { return s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F'; }
  function _consPx(v) { var m = String(v == null ? '' : v).match(/^(-?[\d.]+)px$/); return m ? parseFloat(m[1]) : null; }
  function _consFirstFont(str) { return str ? String(str).split(',')[0].trim().replace(/['"]/g, '').toLowerCase() : ''; }
  function _consParseColor(str) {
    if (!str) return null;
    var m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    var h = String(str).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!h) return null;
    var x = h[1];
    if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2];
    return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16) };
  }
  function _consHex(c) { function h(n) { return ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2); } return '#' + h(c.r) + h(c.g) + h(c.b); }

  // Cluster numeric px values across pages. Anchored to the cluster's MIN (not the
  // previous value) so a continuous ramp of rem-derived fractional sizes can't chain
  // 10px→16px into one bogus "near-duplicate" — total spread within a cluster is
  // bounded by tol. Returns only clusters holding >=2 distinct values from >=2 pages
  // (pages using slightly different values instead of one shared scale step).
  function _consNumericNearDups(entries, tol) {
    var sorted = entries.slice().sort(function(a, b) { return a.value - b.value; });
    var clusters = [], cur = null;
    sorted.forEach(function(e) {
      if (cur && e.value - cur.min <= tol) { cur.values[e.value] = 1; cur.pages[e.page] = 1; cur.members.push(e); }
      else { cur = { min: e.value, values: {}, pages: {}, members: [e] }; cur.values[e.value] = 1; cur.pages[e.page] = 1; clusters.push(cur); }
    });
    return clusters.filter(function(c) { return Object.keys(c.values).length >= 2 && Object.keys(c.pages).length >= 2; });
  }

  // Format up to 4 cluster values as a compact "13.3px/13.6px/14px…" example.
  function _consClusterEx(values, unit) {
    var vs = Object.keys(values).map(parseFloat).sort(function(a, b) { return a - b; });
    return vs.slice(0, 4).map(function(v) { return v + (unit || ''); }).join('/') + (vs.length > 4 ? '…' : '');
  }

  // Cluster colors by Euclidean RGB distance. Same near-duplicate criterion: a cluster
  // spanning 2+ distinct hexes from 2+ pages = a color that should be one token.
  function _consColorNearDups(entries, threshold) {
    var clusters = [];
    entries.forEach(function(e) {
      var found = null;
      for (var i = 0; i < clusters.length; i++) {
        var s = clusters[i].seed, dr = s.r - e.rgb.r, dg = s.g - e.rgb.g, db = s.b - e.rgb.b;
        if (Math.sqrt(dr * dr + dg * dg + db * db) <= threshold) { found = clusters[i]; break; }
      }
      if (found) { found.values[e.hex] = 1; found.pages[e.page] = 1; found.members.push(e); }
      else { var c = { seed: e.rgb, values: {}, pages: {}, members: [e] }; c.values[e.hex] = 1; c.pages[e.page] = 1; clusters.push(c); }
    });
    return clusters.filter(function(c) { return Object.keys(c.values).length >= 2 && Object.keys(c.pages).length >= 2; });
  }

  // Flatten cluster members into finding `locations` — one representative row per
  // (page, value) so the report can point at WHERE the inconsistency lives. Caps
  // total rows; dedups by page+value so a heavily-used size doesn't flood the list.
  function _consLocsFromClusters(clusters, unit) {
    var seen = {}, locs = [];
    clusters.forEach(function(c) {
      (c.members || []).forEach(function(m) {
        var k = m.page + '|' + m.value;
        if (seen[k]) return; seen[k] = 1;
        if (locs.length >= 12) return;
        locs.push({ path: m.page, selector: m.selector || '', value: m.value + (unit || ''), text: m.text || '' });
      });
    });
    return locs;
  }

  function buildConsistencyReport(donePages) {
    var pages = (donePages || []).filter(function(p) { return p.rawData; });
    if (pages.length < 2) return null; // no cross-page claim from a single page
    var N = pages.length;
    var findings = [], subs = [];
    function add(sev, title, detail, fix, pagePaths, locations) { findings.push({ severity: sev, title: title, detail: detail, fix: fix, pages: pagePaths || [], locations: locations || [] }); }
    function sub(key, label, score, note) { subs.push({ key: key, label: label, score: Math.max(0, Math.min(100, Math.round(score))), note: note || '' }); }

    // Font families — body typeface should be shared site-wide.
    (function() {
      var byFont = {};
      pages.forEach(function(p) {
        var f = _consFirstFont(p.rawData.typography && p.rawData.typography.bodyFontFamily);
        if (f) (byFont[f] = byFont[f] || []).push(_consPath(p.url));
      });
      var fonts = Object.keys(byFont);
      if (fonts.length === 0) return;
      var score = 100, note = 'All pages use "' + fonts[0] + '"';
      if (fonts.length > 1) {
        fonts.sort(function(a, b) { return byFont[b].length - byFont[a].length; });
        score -= (fonts.length - 1) * 15;
        note = fonts.length + ' different body fonts';
        fonts.slice(1).forEach(function(f) {
          var sev = byFont[f].length <= Math.max(1, Math.floor(N * 0.3)) ? 'warning' : 'error';
          add(sev, 'Body font differs across pages', '"' + f + '" on ' + byFont[f].join(', ') + ' — most pages use "' + fonts[0] + '"',
            'Standardize one base font-family (and shared fallback stack) site-wide.', byFont[f],
            byFont[f].map(function(pp) { return { path: pp, selector: 'body', value: f }; }));
        });
      }
      sub('fonts', 'Font families', score, note);
    })();

    // Type scale — body size + near-duplicate font sizes (no shared scale).
    (function() {
      var bySize = {};
      pages.forEach(function(p) {
        var v = _consPx(p.rawData.typography && p.rawData.typography.bodyFontSize);
        if (v != null) (bySize[v] = bySize[v] || []).push(_consPath(p.url));
      });
      if (Object.keys(bySize).length === 0) return;
      var score = 100, notes = [];
      var sizes = Object.keys(bySize);
      if (sizes.length > 1) {
        score -= (sizes.length - 1) * 10;
        var bodyLocs = [];
        Object.keys(bySize).forEach(function(s) { bySize[s].forEach(function(pp) { bodyLocs.push({ path: pp, selector: 'body', value: s + 'px' }); }); });
        add('warning', 'Body text size varies across pages', 'Body font-size differs: ' + sizes.map(function(s) { return s + 'px (' + bySize[s].length + ' page' + (bySize[s].length > 1 ? 's' : '') + ')'; }).join(', '),
          'Set one base font-size on body and let pages inherit it.', [], bodyLocs);
        notes.push(sizes.length + ' body sizes');
      }
      // Prominence filter: only sizes actually used a few times count toward "scale"
      // drift. This drops rem/em-derived fractional one-offs (a single heading at
      // 14.72px) so we flag drift between REAL scale steps, not rendering artifacts.
      var entries = [];
      pages.forEach(function(p) {
        ((p.rawData.typography && p.rawData.typography.fontSizes) || []).slice(0, 12).forEach(function(e) {
          var v = _consPx(e.value); if (v != null && (e.count || 0) >= 3) entries.push({ value: v, page: _consPath(p.url), selector: e.sampleSelector || '', text: e.sampleText || '' });
        });
      });
      var dups = _consNumericNearDups(entries, 1.0);
      if (dups.length > 0) {
        score -= Math.min(20, dups.length * 4);
        var ex = dups.slice(0, 3).map(function(c) { return _consClusterEx(c.values, 'px'); });
        add('warning', 'No shared type scale', dups.length + ' near-duplicate font size cluster' + (dups.length > 1 ? 's' : '') + ' across pages (e.g. ' + ex.join(', ') + ') — pages use slightly different sizes instead of one scale.',
          'Define a shared type scale (e.g. 12/14/16/20/24/32) and use only those steps.', [], _consLocsFromClusters(dups, 'px'));
        notes.push(dups.length + ' near-dup sizes');
      }
      sub('type', 'Type scale', score, notes.join(', ') || 'Consistent');
    })();

    // Spacing scale — near-duplicate padding/margin/gap values (no shared unit).
    (function() {
      // Prominence filter (same rationale as type): ignore rarely-used fractional
      // values so we compare the real spacing grid, not rem-derived padding noise.
      var entries = [];
      pages.forEach(function(p) {
        var sp = p.rawData.spacing || {};
        [].concat(sp.paddings || [], sp.margins || [], sp.gaps || []).forEach(function(e) {
          var v = _consPx(e.value); if (v != null && v > 0 && (e.count || 0) >= 3) entries.push({ value: v, page: _consPath(p.url) });
        });
      });
      if (entries.length < 2) return;
      var dups = _consNumericNearDups(entries, 1.5);
      var score = 100, note = 'Consistent';
      if (dups.length > 0) {
        score -= Math.min(24, dups.length * 4);
        var ex = dups.slice(0, 3).map(function(c) { return _consClusterEx(c.values, 'px'); });
        add('warning', 'Inconsistent spacing scale', dups.length + ' near-duplicate spacing cluster' + (dups.length > 1 ? 's' : '') + ' across pages (e.g. ' + ex.join(', ') + ') — suggests no shared spacing unit.',
          'Adopt one spacing scale (e.g. 4/8/16/24/32) and snap padding/margin/gap to it.', [], _consLocsFromClusters(dups, 'px'));
        note = dups.length + ' near-dup values';
      }
      sub('spacing', 'Spacing scale', score, note);
    })();

    // Corner radius — rounded vs sharp split + near-duplicate radii.
    (function() {
      var rounded = [], sharp = [], entries = [], radiusLocs = [];
      pages.forEach(function(p) {
        var path = _consPath(p.url);
        var br = (p.rawData.layout && p.rawData.layout.borderRadii) || [];
        var nz = br.filter(function(e) { var v = _consPx(e.value); return v != null && v > 0; });
        if (nz.length > 0) {
          rounded.push(path);
          radiusLocs.push({ path: path, selector: (nz[0].selectors && nz[0].selectors[0]) || '', value: nz[0].value });
        } else {
          sharp.push(path);
          radiusLocs.push({ path: path, selector: '', value: 'sharp (0px)' });
        }
        nz.slice(0, 8).forEach(function(e) { var v = _consPx(e.value); if (v != null) entries.push({ value: v, page: path, selector: (e.selectors && e.selectors[0]) || '' }); });
      });
      if (rounded.length + sharp.length < 2) return;
      var score = 100, notes = [];
      if (rounded.length > 0 && sharp.length > 0) {
        score -= 20;
        add('warning', 'Corner radius style splits across pages', 'Rounded corners on ' + rounded.join(', ') + '; sharp (no radius) on ' + sharp.join(', ') + '.',
          'Pick one corner treatment (e.g. rounded-lg) for cards/buttons site-wide.', sharp.concat(rounded), radiusLocs);
        notes.push('rounded/sharp split');
      }
      var dups = _consNumericNearDups(entries, 2);
      if (dups.length > 0) { score -= Math.min(16, dups.length * 4); notes.push(dups.length + ' near-dup radii'); }
      sub('radius', 'Corner radius', score, notes.join(', ') || 'Consistent');
    })();

    // Palette — near-duplicate colors that should collapse to one token.
    (function() {
      var entries = [];
      pages.forEach(function(p) {
        var cols = p.rawData.colors || {};
        var path = _consPath(p.url);
        [].concat((cols.textColors || []).slice(0, 8), (cols.bgColors || []).slice(0, 8)).forEach(function(e) {
          var rgb = _consParseColor(e.value); if (rgb) { var hex = _consHex(rgb); entries.push({ hex: hex, value: hex, rgb: rgb, page: path, selector: e.sample || '' }); }
        });
      });
      if (entries.length < 2) return;
      var dups = _consColorNearDups(entries, 18);
      var score = 100, note = 'Consistent';
      if (dups.length > 0) {
        score -= Math.min(30, dups.length * 5);
        var ex = dups.slice(0, 3).map(function(c) { return Object.keys(c.values).slice(0, 4).join(' ≈ '); });
        add('warning', 'Near-duplicate colors across pages', dups.length + ' color' + (dups.length > 1 ? 's appear' : ' appears') + ' in slightly different shades across pages (e.g. ' + ex.join(', ') + ').',
          'Unify each near-duplicate to a single palette token.', [], _consLocsFromClusters(dups, ''));
        note = dups.length + ' near-dup colors';
      }
      sub('palette', 'Palette', score, note);
    })();

    // Dark mode — coverage should be all-or-nothing.
    (function() {
      var withDark = [], without = [], darkLocs = [];
      pages.forEach(function(p) {
        var st = p.rawData.structure || {};
        var has = (st.darkModeMethod && st.darkModeMethod !== 'none') || st.darkModeClasses;
        var path = _consPath(p.url);
        (has ? withDark : without).push(path);
        darkLocs.push({ path: path, selector: '', value: has ? (st.darkModeMethod || 'dark') : 'none' });
      });
      if (withDark.length + without.length < 2) return;
      if (withDark.length > 0 && without.length > 0) {
        add('warning', 'Dark mode coverage is inconsistent', withDark.length + ' page(s) support dark mode, ' + without.length + ' do not (' + without.join(', ') + ').',
          'Either add dark-mode variants to all pages or none.', without, darkLocs);
        sub('darkMode', 'Dark mode', Math.round(100 * Math.max(withDark.length, without.length) / N), withDark.length + '/' + N + ' support dark mode');
      } else if (withDark.length > 0) {
        sub('darkMode', 'Dark mode', 100, 'All support dark mode');
      } else {
        // No page offers a dark scheme — a site-wide gap, mirroring per-page Design Polish.
        add('warning', 'No pages support dark mode', 'None of the ' + N + ' crawled pages offer a dark color scheme.',
          'Add dark-mode variants site-wide (e.g. Tailwind dark: utilities).', without, darkLocs);
        sub('darkMode', 'Dark mode', 70, 'None use dark mode');
      }
    })();

    // CSS framework — only flag when two KNOWN frameworks are mixed (unknown is sparse, not a conflict).
    (function() {
      var fw = {};
      pages.forEach(function(p) {
        var f = (p.rawData.structure && p.rawData.structure.cssFramework) || 'unknown';
        (fw[f] = fw[f] || []).push(_consPath(p.url));
      });
      var known = Object.keys(fw).filter(function(f) { return f !== 'unknown'; });
      if (known.length >= 2) {
        var fwLocs = [];
        Object.keys(fw).forEach(function(f) { fw[f].forEach(function(pp) { fwLocs.push({ path: pp, selector: '', value: f }); }); });
        add('error', 'Mixed CSS frameworks across pages', known.map(function(f) { return f + ' on ' + fw[f].join(', '); }).join('; ') + '.',
          'Standardize on one CSS framework across the site.', [], fwLocs);
        sub('framework', 'CSS framework', 100 - (known.length - 1) * 25, known.join(' + '));
      } else if (known.length === 1) {
        sub('framework', 'CSS framework', 100, known[0]);
      }
    })();

    if (subs.length === 0) return null;
    var weights = { palette: 20, type: 20, fonts: 18, spacing: 15, radius: 12, darkMode: 8, framework: 7 };
    var tw = 0, ws = 0;
    subs.forEach(function(s) { var w = weights[s.key] || 10; tw += w; ws += s.score * w; });
    var overall = tw > 0 ? Math.round(ws / tw) : 100;
    findings.sort(function(a, b) { if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1; return 0; });
    return { overall: overall, grade: _consGrade(overall), subScores: subs, findings: findings };
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
      viewportSummary: viewportSummary,
      consistency: buildConsistencyReport(donePages)
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

    // Cross-page consistency (shared markdown helper, also used by the LLM pack)
    if (summary.consistency && window.MilgReport && window.MilgReport.consistencyMarkdown) {
      lines.push('## Cross-Page Consistency');
      lines.push('');
      lines.push(window.MilgReport.consistencyMarkdown(summary.consistency, severityFilter));
      lines.push('');
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
      // Per-page screenshots
      if (page.rawData && page.rawData.screenshots && page.rawData.screenshots.length > 0) {
        lines.push('#### Screenshots');
        page.rawData.screenshots.forEach(function(src, si) {
          lines.push('![' + path + ' screenshot ' + (si + 1) + '](' + src + ')');
          lines.push('');
        });
      }
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

  function renderCrawlJSON(session, severityFilter, includeViewportData) {
    // Break circular refs and strip debug data — keep screenshots, masks, verify for full export
    // Only strip circular refs and transient state — keep ALL analysis data for full reimport
    var _skipKeys = { deepScan: 1, _cachedReportData: 1, _vpCacheIdx: 1 };
    var _replacer = function(k, v) { return _skipKeys[k] ? undefined : v; };
    var out = {
      _milgCrawl: true,
      _milgVersion: window.MILG_EXPORT_VERSION || '1.6',
      startUrl: session.startUrl,
      startedAt: session.startedAt,
      options: session.options,
      summary: session.summary,
      // results: re-importable raw extraction data (loadCrawlResults compatible)
      results: session.pages.filter(function(p) { return p.status === 'done' && p.rawData; }).map(function(p) {
        var rawClone = JSON.parse(JSON.stringify(p.rawData, _replacer));
        // Include deep scan summary. Full per-viewport extraction (viewportData) is
        // large, so it's only kept when includeViewportData is set — that's what lets a
        // re-imported crawl reconstruct the page×viewport matrix in the LLM pack.
        if (p.rawData.deepScan) {
          rawClone.deepScan = { viewports: p.rawData.deepScan.viewports, darkMode: p.rawData.deepScan.darkMode || null };
          if (includeViewportData && p.rawData.deepScan.viewportData) {
            rawClone.deepScan.viewportData = JSON.parse(JSON.stringify(p.rawData.deepScan.viewportData, _replacer));
          }
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
    return JSON.stringify(out);
  }

  // --- Public API ---

  return {
    normalizeUrl: normalizeUrl,
    matchesBlacklist: matchesBlacklist,
    discoverLinks: discoverLinks,
    discoverSitemap: discoverSitemap,
    mergeDiscovered: mergeDiscovered,
    createSession: createSession,
    startCrawl: startCrawl,
    abortCrawl: abortCrawl,
    buildSummary: buildSummary,
    buildConsistencyReport: buildConsistencyReport,
    filterFindings: filterFindings,
    renderCrawlMarkdown: renderCrawlMarkdown,
    renderCrawlJSON: renderCrawlJSON
  };
})();
