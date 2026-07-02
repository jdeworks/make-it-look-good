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
        startPage._html = html; // retained so expandPage can re-explore SPA views without re-fetching
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

          // Fold in SPA views (if any) BEFORE the next page, then process remaining queue.
          expandPage(session, pipeline, startPage, function() { processQueue(session, pipeline, 0); });
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
      pageEntry._html = html; // retained so expandPage can re-explore SPA views without re-fetching
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
        // Fold in SPA views (if any) for this page, then continue after a rate-limit delay.
        expandPage(session, pipeline, pageEntry, function() {
          setTimeout(function() { processQueue(session, pipeline, idx + 1); }, 2000);
        });
      });
    });
  }

  // Optional per-page expansion step: after a page is analyzed, let the pipeline discover
  // and fold in extra states (e.g. a SPA's hidden views) BEFORE the crawl moves on, so the
  // final summary/consistency report sees them. The pipeline's expandPage(pageEntry,
  // session, done) MUST call done() exactly once; if absent, this is a no-op. Errors and
  // aborts fall through to `next` so the crawl can never stall here.
  function expandPage(session, pipeline, pageEntry, next) {
    if (session._aborted || pageEntry.status !== 'done' || !pipeline.expandPage) { next(); return; }
    var called = false;
    var done = function() { if (called) return; called = true; next(); };
    try { pipeline.expandPage(pageEntry, session, done); } catch (e) { done(); }
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
  // tol is a number (absolute px) OR {abs, rel}: the cluster's max spread from its MIN
  // anchor is max(abs, min*rel), so allowed drift scales with size — 48 vs 49.5px is not
  // "drift", but 13.6 vs 14px is. Still MIN-anchored (never chained), so a real ramp can't merge.
  function _consNumericNearDups(entries, tol) {
    var abs = typeof tol === 'number' ? tol : (tol && tol.abs) || 0;
    var rel = (tol && typeof tol === 'object' && tol.rel) || 0;
    function bound(anchor) { return Math.max(abs, anchor * rel); }
    var sorted = entries.slice().sort(function(a, b) { return a.value - b.value; });
    var clusters = [], cur = null;
    sorted.forEach(function(e) {
      if (cur && e.value - cur.min <= bound(cur.min)) { cur.values[e.value] = 1; cur.pages[e.page] = 1; cur.members.push(e); }
      else { cur = { min: e.value, values: {}, pages: {}, members: [e] }; cur.values[e.value] = 1; cur.pages[e.page] = 1; clusters.push(cur); }
    });
    return clusters.filter(function(c) { return Object.keys(c.values).length >= 2 && Object.keys(c.pages).length >= 2; });
  }

  // Cross-page prominence: keep only entries whose EXACT value is used >= minTotal times
  // site-wide (counts summed across pages). Catches a token used 2x/page across many pages
  // — a per-page count>=3 filter would wrongly drop it — while still dropping a true 1x
  // one-off. Aggregating by exact value is safe: an identical fractional value repeating
  // across pages is a shared deterministic token, not per-page sub-pixel rendering noise.
  function _consProminentByTotal(entries, minTotal) {
    var totals = {};
    entries.forEach(function(e) { totals[e.value] = (totals[e.value] || 0) + (e.count || 0); });
    return entries.filter(function(e) { return totals[e.value] >= minTotal; });
  }

  // Format up to 4 cluster values as a compact "13.3px/13.6px/14px…" example.
  function _consClusterEx(values, unit) {
    var vs = Object.keys(values).map(parseFloat).sort(function(a, b) { return a - b; });
    return vs.slice(0, 4).map(function(v) { return v + (unit || ''); }).join('/') + (vs.length > 4 ? '…' : '');
  }

  // sRGB (0-255) → CIE-L*a*b* (D65). Equal RGB steps are NOT equally visible, so we cluster
  // colors in LAB where Euclidean distance (ΔE76) tracks PERCEIVED difference.
  function _consRgbToLab(rgb) {
    function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var r = lin(rgb.r), g = lin(rgb.g), b = lin(rgb.b);
    var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047; // → XYZ (D65), white-normalized
    var y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
    var z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116); }
    var fx = f(x), fy = f(y), fz = f(z);
    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }
  // ΔE*76 — Euclidean distance in L*a*b*. ~JND ≈ 2.3; a small ΔE means "same token".
  function _consDeltaE(a, b) {
    var dL = a.L - b.L, da = a.a - b.a, db = a.b - b.b;
    return Math.sqrt(dL * dL + da * da + db * db);
  }

  // Cluster colors by PERCEPTUAL distance (ΔE in CIE-Lab). Same near-duplicate criterion:
  // a cluster spanning 2+ distinct hexes from 2+ pages = a color that should be one token.
  // LAB/ΔE (not raw RGB) so near-white shades still merge while two genuinely distinct
  // accents that happen to land RGB-close are kept apart.
  function _consColorNearDups(entries, threshold) {
    var clusters = [];
    entries.forEach(function(e) {
      var lab = e.lab || (e.lab = _consRgbToLab(e.rgb));
      var found = null;
      for (var i = 0; i < clusters.length; i++) {
        if (_consDeltaE(clusters[i].seedLab, lab) <= threshold) { found = clusters[i]; break; }
      }
      if (found) { found.values[e.hex] = 1; found.pages[e.page] = 1; found.members.push(e); }
      else { var c = { seed: e.rgb, seedLab: lab, values: {}, pages: {}, members: [e] }; c.values[e.hex] = 1; c.pages[e.page] = 1; clusters.push(c); }
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
      // Prominence filter: only sizes used a few times site-wide count toward "scale"
      // drift. This drops rem/em-derived fractional one-offs (a single heading at
      // 14.72px) so we flag drift between REAL scale steps, not rendering artifacts.
      // Counts are aggregated ACROSS pages (_consProminentByTotal) so a step used
      // twice per page on many pages still qualifies.
      var entries = [];
      pages.forEach(function(p) {
        ((p.rawData.typography && p.rawData.typography.fontSizes) || []).slice(0, 12).forEach(function(e) {
          var v = _consPx(e.value); if (v != null) entries.push({ value: v, count: e.count || 0, page: _consPath(p.url), selector: e.sampleSelector || '', text: e.sampleText || '' });
        });
      });
      entries = _consProminentByTotal(entries, 3);
      var dups = _consNumericNearDups(entries, { abs: 1.0, rel: 0.04 });
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
      // Counts are aggregated ACROSS pages so a value used twice per page on many
      // pages still qualifies.
      var entries = [];
      pages.forEach(function(p) {
        var sp = p.rawData.spacing || {};
        [].concat(sp.paddings || [], sp.margins || [], sp.gaps || []).forEach(function(e) {
          var v = _consPx(e.value); if (v != null && v > 0) entries.push({ value: v, count: e.count || 0, page: _consPath(p.url) });
        });
      });
      entries = _consProminentByTotal(entries, 3);
      if (entries.length < 2) return;
      var dups = _consNumericNearDups(entries, { abs: 1.5, rel: 0.05 });
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
      var dups = _consColorNearDups(entries, 4); // ΔE76 (~JND 2.3); 4 = "should be one token"
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

    // Color scheme — a crafted site supports BOTH light and dark. Single-mode in
    // EITHER direction (light-only OR dark-only) is the gap, mirroring per-page
    // Design Polish. We rely only on the genuine implementation signal
    // (darkModeClasses) and deliberately ignore darkModeMethod's 'media-query'
    // (which reflects the ANALYZER machine's own prefers-color-scheme, not the
    // site — the source of the old "all pages support dark mode" false positive)
    // and 'inferred-from-colors' (a dark-by-design page is single-mode, not dual).
    (function() {
      var both = [], single = [], lightOnly = [], darkOnly = [], locs = [];
      pages.forEach(function(p) {
        var st = p.rawData.structure || {};
        var supportsBoth = !!st.darkModeClasses;
        var path = _consPath(p.url);
        var mode = supportsBoth ? 'light+dark' : (st.isDarkPage ? 'dark-only' : 'light-only');
        (supportsBoth ? both : single).push(path);
        if (!supportsBoth) (st.isDarkPage ? darkOnly : lightOnly).push(path);
        locs.push({ path: path, selector: '', value: mode });
      });
      if (both.length + single.length < 2) return;
      if (both.length > 0 && single.length > 0) {
        add('warning', 'Color-scheme support is inconsistent', both.length + ' page(s) support both light and dark, ' + single.length + ' are single-mode (' + single.join(', ') + ').',
          'Support both light and dark on every page (e.g. Tailwind dark: utilities) — or none.', single, locs);
        sub('darkMode', 'Color scheme (light + dark)', Math.round(100 * Math.max(both.length, single.length) / N), both.length + '/' + N + ' support light + dark');
      } else if (single.length === 0) {
        sub('darkMode', 'Color scheme (light + dark)', 100, 'All pages support light + dark');
      } else {
        // No page offers both schemes — a site-wide gap, mirroring per-page Design Polish.
        var dir = darkOnly.length === 0 ? 'all are light-only' : lightOnly.length === 0 ? 'all are dark-only' : 'all are single-mode';
        add('warning', 'No pages support both light and dark', 'None of the ' + N + ' crawled pages offer both color schemes — ' + dir + '.',
          'Add the missing scheme site-wide — light-only pages need dark variants; dark-only pages need a light variant.', single, locs);
        sub('darkMode', 'Color scheme (light + dark)', 70, dir);
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

  // Human-readable identifier for a page row. For SPA views the URL path is the same root for
  // every state (the app never navigated), so distinct views look identical in lists — instead
  // show the click-path breadcrumb (drop the leading site/app title), keeping the ▤/▣ markers
  // MilgSpaMap already baked into the leaf. Falls back to the URL pathname for real pages.
  function spaPathLabel(p) {
    var path; try { path = new URL(p.url).pathname; } catch (e) { path = p.url; }
    var m = (p && p.rawData && p.rawData.meta) || {};
    if (m._spaView && p.title && p.title.indexOf(' › ') !== -1) {
      var segs = p.title.split(' › '); segs.shift();           // drop the root site/app title
      var crumb = segs.join(' › ').trim();
      if (crumb) return crumb;
    }
    return path === '/' ? '/ (home)' : path;
  }

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
      return { url: p.url, path: path, pathLabel: spaPathLabel(p), title: p.title, score: p.reportData.overall, grade: p.reportData.grade };
    });

    var scores = donePages.map(function(p) { return p.reportData.overall; });
    var avgScore = Math.round(scores.reduce(function(a, b) { return a + b; }, 0) / scores.length);

    var worstIdx = scores.indexOf(Math.min.apply(null, scores));
    var bestIdx = scores.indexOf(Math.max.apply(null, scores));

    // Cross-page issue grouping. `count` is the number of DISTINCT elements affected (keyed by
    // finding detail, which embeds element text/size/selector), NOT view-repetitions — a
    // persistent shell element re-found across N SPA views counts once, while genuinely distinct
    // elements sharing a title stay separate. `viewsAffected` records how many views it showed in.
    var issueMap = {};
    donePages.forEach(function(p) {
      if (!p.reportData || !p.reportData.categories) return;
      p.reportData.categories.forEach(function(cat) {
        cat.findings.forEach(function(f) {
          if (f.severity === 'info') return;
          var key = f.severity + '|' + f.title;
          if (!issueMap[key]) {
            issueMap[key] = { title: f.title, severity: f.severity, fix: f.fix, pages: [], count: 0, _seenDetail: {} };
          }
          var e = issueMap[key];
          e.pages.push({ url: p.url, pathLabel: spaPathLabel(p), detail: f.detail || '' });
          var dkey = f.detail || f.title; // element identity within this title group
          if (!e._seenDetail[dkey]) { e._seenDetail[dkey] = true; e.count++; }
        });
      });
    });
    var crossPageIssues = Object.keys(issueMap).map(function(k) {
      var e = issueMap[k];
      var urls = {}; e.pages.forEach(function(pg) { urls[pg.url] = true; });
      e.viewsAffected = Object.keys(urls).length;
      delete e._seenDetail;
      return e;
    });
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


    return {
      pagesAnalyzed: donePages.length,
      pagesFailed: failedPages.length,
      averageScore: avgScore,
      worstPage: { url: donePages[worstIdx].url, score: scores[worstIdx] },
      bestPage: { url: donePages[bestIdx].url, score: scores[bestIdx] },
      scoreGrid: scoreGrid,
      crossPageIssues: crossPageIssues,
      categoryAverages: categoryAverages,
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
      lines.push('| ' + (row.pathLabel || row.path) + ' | ' + row.score + ' | ' + row.grade + ' |');
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
        lines.push('### [' + icon + '] ' + issue.title + ' (' + issue.count + ' distinct on ' + (issue.viewsAffected || issue.pages.length) + ' view' + ((issue.viewsAffected || issue.pages.length) > 1 ? 's' : '') + ')');
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

  // includeViewportData (default true): a page that was itself deep-scanned across multiple
  // viewports carries the full per-viewport raw data on data.deepScan.viewportData — that's
  // what lets a re-imported crawl rebuild the page×viewport matrix LLM pack. Pass false for a
  // lighter export that keeps the viewport labels (data.deepScan.viewports) but drops the
  // heavy per-viewport payload (it multiplies export size by the viewport count).
  function renderCrawlJSON(session, severityFilter, includeViewportData) {
    if (includeViewportData === undefined) includeViewportData = true;
    // Strip transient state — keep ALL analysis data (screenshots, masks, verify) for full reimport.
    var _skipKeys = { _cachedReportData: 1 };
    var _replacer = function(k, v) { return (k === 'viewportData' && !includeViewportData) ? undefined : (_skipKeys[k] ? undefined : v); };
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
        // Pixel verify results are included automatically via the clone.
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
    spaPathLabel: spaPathLabel,
    buildConsistencyReport: buildConsistencyReport,
    filterFindings: filterFindings,
    renderCrawlMarkdown: renderCrawlMarkdown,
    renderCrawlJSON: renderCrawlJSON
  };
})();
