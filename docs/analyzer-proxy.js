// make-it-look-good — CORS Proxy & JS-Enabled Analysis
// Handles URL fetching via proxy chain and "Try with JS" mode.
// Depends on: analyzer-iframe.js (MilgIframe)

window.MilgProxy = (function() {
  "use strict";

  var _corsProxyUrl = '';
  var _showToast = function() {};
  var _showProgress = function() {};
  var _hideProgress = function() {};
  var _runAnalysis = function() {};

  function init(opts) {
    if (opts.corsProxyUrl) _corsProxyUrl = opts.corsProxyUrl;
    if (opts.showToast) _showToast = opts.showToast;
    if (opts.showProgress) _showProgress = opts.showProgress;
    if (opts.hideProgress) _hideProgress = opts.hideProgress;
    if (opts.runAnalysis) _runAnalysis = opts.runAnalysis;
  }

  // --- URL Fetch via CORS proxy ---
  // Remembers which proxy worked so subsequent requests (CSS files etc.) skip failed ones
  var _lastWorkingProxy = -1; // -1 = direct, 0+ = proxy index

  function buildProxyList() {
    var proxies = [];
    if (_corsProxyUrl) proxies.push(_corsProxyUrl + '?url=');
    proxies.push(
      'https://api.allorigins.win/raw?url=',
      'https://api.codetabs.com/v1/proxy?quest=',
      'https://corsproxy.io/?'
    );
    return proxies;
  }

  function fetchWithProxy(url) {
    var proxies = buildProxyList();

    // If we already know which proxy works, try it first
    if (_lastWorkingProxy >= 0 && _lastWorkingProxy < proxies.length) {
      return fetch(proxies[_lastWorkingProxy] + encodeURIComponent(url))
        .then(function(r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function(t) { if (!t || t.length < 50) throw new Error('empty'); return t; })
        .catch(function() {
          // Last working proxy failed — reset and try full chain
          _lastWorkingProxy = -1;
          return fetchWithProxyFull(url, proxies);
        });
    }

    return fetchWithProxyFull(url, proxies);
  }

  function fetchWithProxyFull(url, proxies) {
    // Try direct fetch first
    return fetch(url, { mode: 'cors', redirect: 'follow' })
      .then(function(r) { if (r.ok) return r.text(); throw new Error(r.status); })
      .then(function(t) { _lastWorkingProxy = -1; return t; })
      .catch(function() {
        // Try proxies in order, remember which one works
        var chain = Promise.reject();
        proxies.forEach(function(proxyBase, idx) {
          chain = chain.catch(function() {
            return fetch(proxyBase + encodeURIComponent(url)).then(function(r) {
              if (!r.ok) throw new Error(r.status);
              return r.text();
            }).then(function(t) {
              if (!t || t.length < 50) throw new Error('empty');
              _lastWorkingProxy = idx;
              return t;
            });
          });
        });
        return chain;
      });
  }

  function fetchViaProxy(url, callback) {
    fetchWithProxy(url)
      .then(function(html) {
        // Detect proxy error pages (Cloudflare challenges, 4xx/5xx error pages, consent walls)
        var htmlStart = (html || '').substring(0, 3000);
        if (html && (
          /class="no-js.*oldie"/i.test(htmlStart) || // Cloudflare error template
          /cf-error-details|cf-wrapper/i.test(htmlStart) ||
          /Access Denied|403 Forbidden/i.test(htmlStart) ||
          /Just a moment|Checking your browser/i.test(htmlStart) || // Cloudflare challenge
          /consent\.google|accounts\.google.*ServiceLogin/i.test(htmlStart) // Google consent/login redirect
        )) {
          callback(null, 'The site returned an error/challenge page (likely blocking proxy access). Use the Console Snippet tab instead.');
          return;
        }

        // Resolve base URL for relative paths
        var baseUrl;
        try { var u = new URL(url); baseUrl = u.origin + u.pathname.replace(/\/[^/]*$/, '/'); } catch(e) { baseUrl = url; }

        // Find and inline linked stylesheets so CSS works inside srcdoc iframe
        var cssLinks = [];
        var linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
        var altRegex = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
        var m;
        while (m = linkRegex.exec(html)) cssLinks.push(m[1]);
        while (m = altRegex.exec(html)) { if (cssLinks.indexOf(m[1]) === -1) cssLinks.push(m[1]); }

        if (cssLinks.length === 0) { callback(html, null); return; }

        // Fetch all CSS files and inline them
        Promise.all(cssLinks.map(function(href) {
          var cssUrl = href.startsWith('http') ? href : (href.startsWith('/') ? new URL(url).origin + href : baseUrl + href);
          return fetchWithProxy(cssUrl).catch(function() { return '/* failed: ' + href + ' */'; });
        })).then(function(cssTexts) {
          // Remove original link tags and inject inlined styles
          var processed = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, '');
          processed = processed.replace(/<link[^>]+href=["'][^"']+\.css[^"']*["'][^>]*rel=["']stylesheet["'][^>]*>/gi, '');
          var styleBlock = '<style>' + cssTexts.join('\n') + '</style>';
          if (/<\/head>/i.test(processed)) {
            processed = processed.replace(/<\/head>/i, styleBlock + '</head>');
          } else {
            processed = styleBlock + processed;
          }
          callback(processed, null);
        });
      })
      .catch(function(e) {
        callback(null, e.message || 'All CORS proxies failed');
      });
  }

  // Try analyzing with JS enabled — fetches raw HTML via proxy, patches URL constructor
  // (srcdoc has about:srcdoc as location which breaks new URL(path, location.href)),
  // then delegates to analyzeHtmlInIframe which handles extraction, screenshots, and timeouts.
  function tryWithJs(url) {
    var ok = confirm(
      'This will fetch the page via proxy and run its JavaScript in a sandboxed frame on this page.\n\n' +
      'Only do this if you trust the site — its scripts will execute with access to this page\'s origin (XSS risk).\n\n' +
      'Some sites may not work if they rely on cookies, auth, or same-origin API calls.\n\n' +
      'Continue?'
    );
    if (!ok) return;

    var reportContainer = document.getElementById('reportContainer');
    var errBtn = 'style="margin-top:12px;padding:8px 16px;border-radius:6px;border:1px solid currentColor;background:none;color:inherit;cursor:pointer;font-size:13px"';

    // Show progress directly in reportContainer (the input section with the
    // normal progress bar is hidden at this point since the warning is showing)
    var isDark = document.body.classList.contains('dark-ui');
    var progBg = isDark ? '#1e293b' : '#f1f5f9';
    var progText = isDark ? '#94a3b8' : '#475569';
    var progAccent = isDark ? '#3b82f6' : '#2563eb';
    function showJsProgress(pct, label) {
      reportContainer.innerHTML = '<div style="padding:30px 40px;background:' + progBg + ';border-radius:var(--radius);text-align:center">' +
        '<div style="font-size:13px;color:' + progText + ';margin-bottom:12px;font-weight:500">' + label + '</div>' +
        '<div style="height:6px;background:' + (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') + ';border-radius:3px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + progAccent + ';border-radius:3px;transition:width 0.6s ease"></div></div>' +
        '</div>';
      reportContainer.classList.add('visible');
    }

    showJsProgress(5, 'Fetching page via proxy...');

    // Fetch raw HTML via proxy (don't use fetchViaProxy which inlines CSS — let JS handle it)
    fetchWithProxy(url).then(function(html) {
      if (!html || html.length < 50) {
        reportContainer.innerHTML = '<div style="padding:20px;color:#dc2626;text-align:center">' +
          'Could not fetch the page (empty response).<br>' +
          '<button onclick="window.__milgSwitchToSnippet()" ' + errBtn + '>Use Console Snippet instead</button></div>';
        return;
      }

      showJsProgress(20, 'Preparing JavaScript environment...');

      // Comprehensive srcdoc environment patches:
      // Inside srcdoc iframes, many Web APIs break because the document origin is the
      // parent's origin (jdeworks.github.io) while the page's JS expects the real site.
      // We patch: URL constructor, History API, and provide error-resilient wrappers.
      var escapedUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      var urlPatch = '<script>' +
        '(function(){' +
          'var _rb="' + escapedUrl + '";' +
          'var _O=URL;' +
          'function _P(u,b){' +
            'if(b){' +
              'var bs=typeof b==="string"?b:String(b);' +
              'if(bs==="about:srcdoc"||bs==="about:blank"||bs==="null"||bs.indexOf("about:")===0)b=_rb;' +
            '}' +
            'if(!b&&typeof u==="string"&&u.charAt(0)==="/")return new _O(u,_rb);' +
            'try{return arguments.length===1?new _O(u):new _O(u,b);}' +
            'catch(e){try{return new _O(u,_rb);}catch(e2){throw e;}}' +
          '}' +
          '_P.prototype=_O.prototype;' +
          '_P.createObjectURL=_O.createObjectURL.bind(_O);' +
          '_P.revokeObjectURL=_O.revokeObjectURL.bind(_O);' +
          'if(_O.canParse)_P.canParse=_O.canParse.bind(_O);' +
          'window.URL=_P;' +
          'var _hps=history.pushState.bind(history);' +
          'var _hrs=history.replaceState.bind(history);' +
          'history.pushState=function(s,t,u){try{_hps(s,t,u);}catch(e){}};' +
          'history.replaceState=function(s,t,u){try{_hrs(s,t,u);}catch(e){}};' +
          'var _of=window.fetch;' +
          'window.fetch=function(u,o){' +
            'if(typeof u==="string"&&u.charAt(0)==="/")u=_rb.replace(/\\/$/,"")+u;' +
            'return _of.call(this,u,o);' +
          '};' +
        '})();' +
        '</' + 'script>';

      // Inject BEFORE the first <script> tag so patches run before any framework JS
      // (Next.js puts inline scripts immediately after <head>)
      if (/<script[\s>]/i.test(html)) {
        html = html.replace(/<script[\s>]/i, urlPatch + '<script ');
      } else if (/<head[\s>]/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, '<head$1>' + urlPatch);
      } else {
        html = urlPatch + html;
      }

      showJsProgress(30, 'Running JavaScript & rendering page...');

      // Animate progress while waiting for JS hydration
      var _jpPct = 30;
      var _jsProgressTimer = setInterval(function() {
        _jpPct = Math.min(_jpPct + 3, 90);
        var label = _jpPct < 50 ? 'Running JavaScript & rendering page...'
          : _jpPct < 70 ? 'Waiting for framework hydration...'
          : 'Extracting design data...';
        showJsProgress(_jpPct, label);
      }, 600);

      // Delegate to the standard analysis pipeline — handles base tag, extraction,
      // screenshots, unhidden panels, and timeouts.
      // Skip screenshots for JS-enabled mode — cross-origin images in srcdoc taint
      // the canvas, making domToCanvas fail. Screenshots work via Console Snippet.
      var exclude = window.__milgCombinedExclude || (document.getElementById('excludeSelector') && document.getElementById('excludeSelector').value || '').trim() || null;
      MilgIframe.analyzeHtmlInIframe(html, function(data) {
        clearInterval(_jsProgressTimer);
        data.meta.url = url;
        data.meta._inputMethod = 'url';
        data.meta._jsEnabled = true;
        _runAnalysis(data);
      }, url, exclude, false); // false = skip screenshots (CORS issues in srcdoc)

    }).catch(function(e) {
      reportContainer.innerHTML = '<div style="padding:20px;color:#dc2626;text-align:center">' +
        'Failed to fetch the page: ' + (e.message || 'proxy error') + '<br>' +
        '<button onclick="window.__milgSwitchToSnippet()" ' + errBtn + '>Use Console Snippet instead</button></div>';
    });
  }

  // Wire up the global handler
  window.__milgTryWithJs = function(url) { tryWithJs(url); };

  return {
    init: init,
    fetchWithProxy: fetchWithProxy,
    fetchViaProxy: fetchViaProxy
  };
})();
