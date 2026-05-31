// make-it-look-good — Design Extraction Snippet
// Version: v1.1
// Run this in the browser console on any page, or use as a bookmarklet.
// Loads extraction engine from CDN (single source of truth), extracts design tokens,
// and copies JSON to your clipboard.
// Then paste into the analyzer at: https://jdeworks.github.io/make-it-look-good/analyzer.html

(function() {
  'use strict';
  var _MILG_VERSION = 'v1.1';
  console.log('%c[milg] Snippet version: ' + _MILG_VERSION, 'color: #64748b;');

  // --- Auto-scroll option ---
  // To scroll the page before extraction (triggers lazy loading + intersection observers):
  // Run: window.__milgScrollFirst = true   then paste the snippet.
  // The snippet will scroll the full page, wait for content to load, then extract.
  if (window.__milgScrollFirst && !window.__milgScrollDone) {
    window.__milgScrollDone = true;
    console.log('%c\u23F3 Scrolling page to trigger lazy loading and intersection observers...', 'color: #3b82f6; font-weight: bold;');
    var _scrollH = document.body.scrollHeight;
    var _pos = 0;
    var _step = Math.max(window.innerHeight * 0.8, 400);
    var _si = setInterval(function() {
      _pos += _step;
      window.scrollTo(0, _pos);
      if (_pos >= _scrollH) {
        clearInterval(_si);
        setTimeout(function() { window.scrollTo(0, 0); }, 300);
        // Wait for newly loaded content, then user must re-run snippet
        setTimeout(function() {
          console.log('%c\u2713 Scroll complete! Page content should now be fully loaded.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
          console.log('%cRe-run the snippet now for complete analysis.', 'color: #3b82f6;');
          window.__milgScrollFirst = false;
        }, 1500);
      }
    }, 150);
    return; // Exit — re-run snippet after scroll completes
  }

  // --- Extraction engine (inlined by analyzer assembler) ---
  // @milg-insert: extract
  _runExtraction();

  function _runExtraction() {
    window.__milgOnExtractComplete = function(data) {
      window.__milgData = data;

  // --- Output ---
  var json = JSON.stringify(data, null, 2);

  // Export data — file download for large payloads, clipboard for small ones
  function downloadAsFile(data, filename) {
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  var jsonSize = json.length;
  var sizeMB = Math.round(jsonSize / 1024 / 1024 * 10) / 10;

  if (jsonSize > 4 * 1024 * 1024) {
    // >4MB: file download (clipboard would freeze)
    var hostname = location.hostname.replace(/[^a-z0-9]/gi, '-');
    downloadAsFile(json, 'milg-' + hostname + '.json');
    console.log('%c\u2B07 Design data downloaded as file (' + sizeMB + ' MB). Import it in the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
    window.__milgData_json = json;
  } else {
    // Small enough for clipboard
    function copyFallback() {
      var ta = document.createElement('textarea');
      ta.value = json;
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try {
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          console.log('%c\u2713 Design data copied to clipboard! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
          return;
        }
      } catch(e) {
        document.body.removeChild(ta);
      }
      // Fallback: file download
      var hostname = location.hostname.replace(/[^a-z0-9]/gi, '-');
      downloadAsFile(json, 'milg-' + hostname + '.json');
      console.log('%c\u2B07 Could not copy \u2014 downloaded as file instead (' + sizeMB + ' MB).', 'color: #b45309; font-weight: bold;');
      window.__milgData_json = json;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(function() {
        console.log('%c\u2713 Design data copied to clipboard (' + sizeMB + ' MB)! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
      }).catch(copyFallback);
    } else {
      copyFallback();
    }
  }

  console.log('%cmake-it-look-good extraction complete', 'color: #3b82f6; font-weight: bold;');
  console.log('Elements scanned:', data.structure.totalElements);
  console.log('Contrast pairs:', data.colors.contrastPairs.length);
  console.log('Touch target issues:', data.interaction.touchTargets.length);

  // --- Site Crawl Mode (same-origin iframe with src=, full JS execution) ---
  // Set window.__milgCrawlSite = true before running.
  // Loads each page in a hidden same-origin iframe (src=url), waits for full JS
  // execution, then injects the extraction snippet. Stays on current page.
  if (window.__milgCrawlSite) {
    var _crawlMax = Math.min(Math.max(window.__milgCrawlMaxPages || 5, 1), 25);
    var _crawlBlacklist = window.__milgCrawlBlacklist || [];
    var _crawlOrigin = location.origin;
    var _crawlSeen = {};
    var _curPath = location.pathname.replace(/\/$/, '');
    _crawlSeen[_crawlOrigin + _curPath] = true;
    // Also mark index variants as seen to avoid re-crawling the current page
    if (_curPath === '' || _curPath === '/index.html' || _curPath === '/index.htm') {
      _crawlSeen[_crawlOrigin] = true; _crawlSeen[_crawlOrigin + '/index.html'] = true; _crawlSeen[_crawlOrigin + '/index.htm'] = true;
    }

    var _crawlLinks = [];
    document.querySelectorAll('a[href]').forEach(function(a) {
      var href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
      try {
        var u = new URL(href, location.href);
        if (u.origin !== _crawlOrigin) return;
        if (/\.(pdf|zip|png|jpg|svg|css|js|json|xml|woff2?)$/i.test(u.pathname)) return;
        u.hash = '';
        var key = u.origin + u.pathname.replace(/\/$/, '');
        if (_crawlSeen[key]) return;
        var blocked = _crawlBlacklist.some(function(pat) { pat = pat.trim(); if (!pat) return false; if (pat.endsWith('*')) return u.pathname.startsWith(pat.slice(0, -1)); return u.pathname === pat; });
        if (blocked) return;
        _crawlSeen[key] = true;
        _crawlLinks.push(u.origin + u.pathname);
      } catch(e) {}
    });
    _crawlLinks = _crawlLinks.slice(0, _crawlMax - 1);

    var _crawlResults = [{ url: location.href, data: data }];
    console.log('%c\uD83D\uDD77 Site Crawl: discovered ' + _crawlLinks.length + ' page(s)', 'color: #8b5cf6; font-weight: bold;');
    _crawlLinks.forEach(function(l, i) { var p; try { p = new URL(l).pathname; } catch(e) { p = l; } console.log('  ' + (i + 1) + '. ' + p); });

    // Export crawl results — file download for large payloads, clipboard for small
    function _copyCrawlResults(results) {
      var crawlJson = JSON.stringify({ _milgCrawl: true, startUrl: location.href, results: results });
      window.__milgCrawlResults = results;
      window.__milgCrawlJson = crawlJson;
      try { localStorage.setItem('milg-crawl-complete', crawlJson); } catch(e) { console.warn('[milg-warn] localStorage save failed:', e.message); }
      var crawlMB = Math.round(crawlJson.length / 1024 / 1024 * 10) / 10;
      if (crawlJson.length > 4 * 1024 * 1024) {
        // Large crawl: file download
        var hostname = location.hostname.replace(/[^a-z0-9]/gi, '-');
        downloadAsFile(crawlJson, 'milg-crawl-' + hostname + '.json');
        console.log('%c\u2B07 Crawl results downloaded as file (' + crawlMB + ' MB). Import in the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(crawlJson).then(function() {
          console.log('%c\u2713 Crawl results copied to clipboard (' + crawlMB + ' MB)! Paste into the analyzer.', 'color: #16a34a; font-weight: bold; font-size: 14px;');
        }).catch(function() {
          var hostname = location.hostname.replace(/[^a-z0-9]/gi, '-');
          downloadAsFile(crawlJson, 'milg-crawl-' + hostname + '.json');
          console.log('%c\u2B07 Could not copy \u2014 downloaded as file instead.', 'color: #b45309; font-weight: bold;');
        });
      } else {
        var hostname = location.hostname.replace(/[^a-z0-9]/gi, '-');
        downloadAsFile(crawlJson, 'milg-crawl-' + hostname + '.json');
        console.log('%c\u2B07 Crawl results downloaded as file. Import in the analyzer.', 'color: #16a34a; font-weight: bold;');
      }
    }

    if (_crawlLinks.length === 0) {
      _copyCrawlResults(_crawlResults);
      console.log('%c\u2713 Crawl complete (1 page). Open the analyzer.', 'color: #16a34a; font-weight: bold;');
    } else {
      // Show crawl progress overlay
      var _crawlOverlay = document.createElement('div');
      _crawlOverlay.setAttribute('data-milg-overlay', '1');
      _crawlOverlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
      _crawlOverlay.innerHTML = '<div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:milg-spin 0.8s linear infinite"></div>' +
        '<div id="milg-crawl-status" style="color:#fff;margin-top:16px;font-size:14px;font-weight:500">Crawling site...</div>' +
        '<div id="milg-crawl-detail" style="color:rgba(255,255,255,0.6);margin-top:6px;font-size:12px">Loading extraction snippet...</div>' +
        '<style>@keyframes milg-spin{to{transform:rotate(360deg)}}</style>';
      document.body.appendChild(_crawlOverlay);
      function _updateCrawlOverlay(status, detail) {
        var s = document.getElementById('milg-crawl-status'); if (s) s.textContent = status;
        var d = document.getElementById('milg-crawl-detail'); if (d) d.textContent = detail;
      }
      function _removeCrawlOverlay() { if (_crawlOverlay.parentNode) _crawlOverlay.parentNode.removeChild(_crawlOverlay); }

      // Build self-contained extraction script (no CDN fetch — inline the function directly)
      var snippetSrc = 'window.MilgExtract = ' + window.MilgExtract.toString() + ';\n' +
        'window.__milgOnExtractComplete = function(data) { window.__milgData = data; };\n' +
        'window.MilgExtract();\n';

      (function() {
        function processNext(idx) {
          if (idx >= _crawlLinks.length) {
            var crawlJson = JSON.stringify({ _milgCrawl: true, startUrl: location.href, results: _crawlResults });
            window.__milgCrawlResults = _crawlResults;
            window.__milgCrawlJson = crawlJson;
            try { localStorage.setItem('milg-crawl-complete', crawlJson); } catch(e) { console.warn('[milg-warn] localStorage save failed:', e.message); }
            console.log('%c\u2713 Crawl complete! ' + _crawlResults.length + ' pages (' + Math.round(crawlJson.length / 1024) + ' KB)', 'color: #16a34a; font-weight: bold; font-size: 14px;');
            var _cKB = Math.round(crawlJson.length / 1024);
            var _cLarge = _cKB > 2048;
            var _priStyle = 'padding:12px 28px;font-size:14px;font-weight:600;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:8px;min-width:220px';
            var _secStyle = 'padding:10px 24px;font-size:13px;font-weight:500;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;margin-bottom:10px;min-width:220px';
            _crawlOverlay.innerHTML = '<div style="text-align:center">' +
              '<div style="font-size:28px;margin-bottom:12px">\u2713</div>' +
              '<div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:6px">Crawl complete! ' + _crawlResults.length + ' pages analyzed.</div>' +
              '<div style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:' + (_cLarge ? '6' : '20') + 'px">' + _cKB + ' KB of design data ready</div>' +
              (_cLarge ? '<div style="color:#fbbf24;font-size:12px;margin-bottom:16px">&#9888; Large payload \u2014 download recommended</div>' : '') +
              (_cLarge
                ? '<button id="milg-crawl-dl-btn" style="' + _priStyle + '">Download JSON</button><br><button id="milg-crawl-copy-btn" style="' + _secStyle + '">Copy to Clipboard</button>'
                : '<button id="milg-crawl-copy-btn" style="' + _priStyle + '">Copy to Clipboard</button><br><button id="milg-crawl-dl-btn" style="' + _secStyle + '">Download JSON</button>') +
              '<div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:8px">Then ' + (_cLarge ? 'import' : 'paste') + ' into the analyzer</div>' +
              '</div>';
            function _crawlDone() { setTimeout(function() { _removeCrawlOverlay(); }, 1500); }
            document.getElementById('milg-crawl-copy-btn').addEventListener('click', function() {
              var btn = document.getElementById('milg-crawl-copy-btn');
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(crawlJson).then(function() {
                  btn.textContent = 'Copied!'; btn.style.background = '#16a34a'; _crawlDone();
                }).catch(function() {
                  downloadAsFile(crawlJson, 'milg-crawl-' + location.hostname.replace(/[^a-z0-9]/gi, '-') + '.json');
                  btn.textContent = 'Downloaded!'; btn.style.background = '#16a34a'; _crawlDone();
                });
              } else {
                downloadAsFile(crawlJson, 'milg-crawl-' + location.hostname.replace(/[^a-z0-9]/gi, '-') + '.json');
                btn.textContent = 'Downloaded!'; btn.style.background = '#16a34a'; _crawlDone();
              }
            });
            document.getElementById('milg-crawl-dl-btn').addEventListener('click', function() {
              downloadAsFile(crawlJson, 'milg-crawl-' + location.hostname.replace(/[^a-z0-9]/gi, '-') + '.json');
              var btn = document.getElementById('milg-crawl-dl-btn');
              btn.textContent = 'Downloaded!'; btn.style.background = '#16a34a'; btn.style.color = '#fff'; _crawlDone();
            });
            return;
          }

          var url = _crawlLinks[idx];
          var path; try { path = new URL(url).pathname; } catch(e) { path = url; }
          _updateCrawlOverlay('Crawling page ' + (idx + 1) + ' of ' + _crawlLinks.length, path);
          console.log('%c\u2192 [' + (idx + 1) + '/' + _crawlLinks.length + '] ' + path, 'color: #3b82f6;');

          // Fetch page HTML (same-origin) then load as srcdoc (bypasses X-Frame-Options)
          fetch(url).then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
          }).then(function(html) {
            // Srcdoc environment patches (URL constructor, History API, fetch)
            var eu = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            var envPatch = '<script>(function(){' +
              'var _rb="' + eu + '";var _O=URL;' +
              'function _P(u,b){if(b){var bs=typeof b==="string"?b:String(b);if(bs==="about:srcdoc"||bs==="about:blank"||bs==="null"||bs.indexOf("about:")===0)b=_rb;}' +
              'if(!b&&typeof u==="string"&&u.charAt(0)==="/")return new _O(u,_rb);try{return (arguments.length===1||!b)?new _O(u):new _O(u,b);}catch(e){try{return new _O(u,_rb);}catch(e2){throw e;}}}' +
              '_P.prototype=_O.prototype;_P.createObjectURL=_O.createObjectURL.bind(_O);_P.revokeObjectURL=_O.revokeObjectURL.bind(_O);if(_O.canParse)_P.canParse=_O.canParse.bind(_O);window.URL=_P;' +
              'var _hps=history.pushState.bind(history);var _hrs=history.replaceState.bind(history);' +
              'history.pushState=function(s,t,u){try{_hps(s,t,u);}catch(e){}};history.replaceState=function(s,t,u){try{_hrs(s,t,u);}catch(e){}};' +
              'var _of=window.fetch;window.fetch=function(u,o){if(typeof u==="string"&&u.charAt(0)==="/")u=_rb.replace(/\\/$/,"")+u;return _of.call(this,u,o);};' +
              '})();</' + 'script>';
            var baseTag = '<base href="' + url + '">';
            var headPatch = envPatch + baseTag;
            // Inject BEFORE the first <script> tag so patches run before any framework JS
            if (/<script[\s>]/i.test(html)) {
              html = html.replace(/<script[\s>]/i, headPatch + '<script ');
            } else if (/<head[\s>]/i.test(html)) {
              html = html.replace(/<head([^>]*)>/i, '<head$1>' + headPatch);
            } else {
              html = headPatch + html;
            }
            html = html.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');

            var iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1280px;height:900px;border:none;';
            iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';
            document.body.appendChild(iframe);

            var done = false;
            function cleanup() { if (iframe.parentNode) document.body.removeChild(iframe); }

            iframe.addEventListener('load', function() {
              if (done) return;
              setTimeout(function() {
                if (done) return;
                try {
                  var iWin = iframe.contentWindow;
                  var iDoc = iframe.contentDocument || iWin.document;
                  var script = iDoc.createElement('script');
                  script.textContent = 'window.__milgCrawlSite=false;\n' + snippetSrc;
                  iDoc.body.appendChild(script);

                  var polls = 0;
                  var poller = setInterval(function() {
                    if (done) { clearInterval(poller); return; }
                    polls++;
                    try {
                      var iData = iWin.__milgData;
                      if (iData) {
                        clearInterval(poller); done = true;
                        iData.meta.url = url;
                        _crawlResults.push({ url: url, data: iData });
                        cleanup();
                        console.log('%c  \u2713 ' + path + ' (' + (iData.structure.totalElements || 0) + ' elements)', 'color: #16a34a;');
                        setTimeout(function() { processNext(idx + 1); }, 500);
                      } else if (polls > 20) {
                        clearInterval(poller); done = true;
                        console.log('%c  \u2717 Timeout: ' + path, 'color: #dc2626;');
                        cleanup();
                        setTimeout(function() { processNext(idx + 1); }, 500);
                      }
                    } catch(e) {
                      clearInterval(poller); done = true;
                      console.log('%c  \u2717 Error: ' + path + ' (' + e.message + ')', 'color: #dc2626;');
                      cleanup();
                      setTimeout(function() { processNext(idx + 1); }, 500);
                    }
                  }, 500);
                } catch(e) {
                  done = true;
                  console.log('%c  \u2717 Cannot inject snippet: ' + path + ' (' + e.message + ')', 'color: #dc2626;');
                  cleanup();
                  setTimeout(function() { processNext(idx + 1); }, 500);
                }
              }, 1500);
            });
            iframe.srcdoc = html;
            setTimeout(function() {
              if (done) return; done = true;
              console.log('%c  \u2717 Timeout (10s): ' + path, 'color: #dc2626;');
              cleanup();
              setTimeout(function() { processNext(idx + 1); }, 500);
            }, 10000);
          }).catch(function(e) {
            console.log('%c  \u2717 Fetch failed: ' + path + ' (' + (e.message || e) + ')', 'color: #dc2626;');
            setTimeout(function() { processNext(idx + 1); }, 500);
          });
        }
        processNext(0);
      })();
    }
    return; // Skip normal clipboard copy
  }

    }; // end __milgOnExtractComplete callback

    // Run the extraction
    window.MilgExtract();
  }
})();
