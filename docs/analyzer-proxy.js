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
      analyzeWithJs(html, url, {
        onProgress: showJsProgress,
        onDone: function(data) {
          _runAnalysis(data);
        }
      });

    }).catch(function(e) {
      reportContainer.innerHTML = '<div style="padding:20px;color:#dc2626;text-align:center">' +
        'Failed to fetch the page: ' + (e.message || 'proxy error') + '<br>' +
        '<button onclick="window.__milgSwitchToSnippet()" ' + errBtn + '>Use Console Snippet instead</button></div>';
    });
  }

  // --- Sandbox hardening script ---
  // Injected before page scripts to intercept storage, cookies, and other sensitive APIs.
  // Returns safe no-ops and logs all access attempts to window.__milgSandboxLog.
  function buildSandboxScript() {
    return '<script>' +
      '(function(){' +
        'var _log=window.__milgSandboxLog=[];' +
        'var _max=100;' +
        'function _l(api,method,args){' +
          'if(_log.length<_max)_log.push({api:api,method:method,args:String(args||"").substring(0,80),t:Date.now()})' +
        '}' +
        // --- localStorage / sessionStorage ---
        'function _fakeStorage(name){' +
          'var _s={};' +
          'return{' +
            'getItem:function(k){_l(name,"getItem",k);return _s[k]||null},' +
            'setItem:function(k,v){_l(name,"setItem",k+"="+v);_s[k]=String(v)},' +
            'removeItem:function(k){_l(name,"removeItem",k);delete _s[k]},' +
            'clear:function(){_l(name,"clear");_s={}},' +
            'key:function(i){_l(name,"key",i);var ks=Object.keys(_s);return ks[i]||null},' +
            'get length(){return Object.keys(_s).length}' +
          '}' +
        '}' +
        'try{Object.defineProperty(window,"localStorage",{value:_fakeStorage("localStorage"),configurable:true})}catch(e){}' +
        'try{Object.defineProperty(window,"sessionStorage",{value:_fakeStorage("sessionStorage"),configurable:true})}catch(e){}' +
        // --- document.cookie ---
        'try{Object.defineProperty(document,"cookie",{' +
          'get:function(){_l("cookie","get");return""},' +
          'set:function(v){_l("cookie","set",v)},' +
          'configurable:true' +
        '})}catch(e){}' +
        // --- indexedDB ---
        'try{Object.defineProperty(window,"indexedDB",{value:null,configurable:true})}catch(e){}' +
        // --- window.open ---
        'var _wo=window.open;' +
        'window.open=function(){_l("window","open",arguments[0]);return null};' +
        // --- navigator.sendBeacon ---
        'if(navigator.sendBeacon){var _sb=navigator.sendBeacon;navigator.sendBeacon=function(u){_l("navigator","sendBeacon",u);return false}}' +
        // --- navigator.serviceWorker.register ---
        'try{if(navigator.serviceWorker){Object.defineProperty(navigator.serviceWorker,"register",{value:function(u){_l("serviceWorker","register",u);return Promise.reject(new DOMException("Blocked by sandbox"))}})}}catch(e){}' +
        // --- Notification.requestPermission ---
        'try{if(window.Notification){Notification.requestPermission=function(){_l("Notification","requestPermission");return Promise.resolve("denied")}}}catch(e){}' +
        // --- postMessage: filter to only allow milg-* messages to parent ---
        'var _pm=window.parent.postMessage.bind(window.parent);' +
        'window.parent.postMessage=function(msg,origin){' +
          'if(msg&&typeof msg==="object"&&typeof msg.type==="string"&&msg.type.indexOf("milg-")===0){_pm(msg,origin);return}' +
          '_l("postMessage","toParent",msg&&msg.type||"unknown");' +
        '};' +
      '})();' +
      '</' + 'script>';
  }

  // --- Reusable JS-enabled analysis ---
  // Takes already-fetched HTML, injects sandbox + URL patches, runs analysis.
  // opts: { onProgress(pct, label), onDone(data), wantShots, exclude }
  function analyzeWithJs(html, url, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || function() {};
    var onDone = opts.onDone || _runAnalysis;
    var wantShots = opts.wantShots !== undefined ? opts.wantShots : (document.getElementById('screenshotCheck') && document.getElementById('screenshotCheck').checked);
    var exclude = opts.exclude !== undefined ? opts.exclude : (window.__milgCombinedExclude || (document.getElementById('excludeSelector') && document.getElementById('excludeSelector').value || '').trim() || null);

    // Build injection scripts: sandbox first, then URL patch
    var sandboxScript = buildSandboxScript();
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
          'try{return (arguments.length===1||!b)?new _O(u):new _O(u,b);}' +
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
        'var _px="' + (_corsProxyUrl || '').replace(/"/g, '\\"') + '";' +
        // Share font cache across iframes via parent (deep scan reuses fonts across viewports)
        'try{if(!parent.__milgFontCache)parent.__milgFontCache={}}catch(e){}' +
        'var _fc=((typeof parent!=="undefined")&&parent.__milgFontCache)||{};' +
        'window.fetch=function(u,o){' +
          'if(typeof u==="string"&&u.charAt(0)==="/")u=_rb.replace(/\\/$/,"")+u;' +
          'if(_px&&typeof u==="string"&&u.indexOf(_px)===-1&&/\\.(woff2?|ttf|otf|eot)(\\?|$)/i.test(u)){' +
            'if(_fc[u])return _fc[u].then(function(r){return r.clone()});' +
            'var p=_of.call(this,_px+"?url="+encodeURIComponent(u),o).catch(function(){return new Response("",{status:404})});' +
            '_fc[u]=p;return p;' +
          '}' +
          'return _of.call(this,u,o);' +
        '};' +
      '})();' +
      '</' + 'script>';

    var combined = sandboxScript + urlPatch;

    // Inject BEFORE the first <script> tag so patches run before any framework JS
    if (/<script[\s>]/i.test(html)) {
      html = html.replace(/<script[\s>]/i, combined + '<script ');
    } else if (/<head[\s>]/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, '<head$1>' + combined);
    } else {
      html = combined + html;
    }

    onProgress(30, 'Running JavaScript & rendering page...');

    // Animate progress while waiting for JS hydration
    var _jpPct = 30;
    var _jsProgressTimer = setInterval(function() {
      _jpPct = Math.min(_jpPct + 3, 90);
      var label = _jpPct < 50 ? 'Running JavaScript & rendering page...'
        : _jpPct < 70 ? 'Waiting for framework hydration...'
        : 'Extracting design data...';
      onProgress(_jpPct, label);
    }, 600);

    MilgIframe.analyzeHtmlInIframe(html, function(data) {
      clearInterval(_jsProgressTimer);
      data.meta.url = url;
      data.meta._inputMethod = 'url';
      data.meta._jsEnabled = true;
      onDone(data);
    }, url, exclude, wantShots);
  }

  // Wire up the global handler
  window.__milgTryWithJs = function(url) { tryWithJs(url); };

  // Inject sandbox + URL patches into HTML without running analysis.
  // Used by deep scan to pre-process HTML for JS-enabled multi-viewport analysis.
  function prepareJsHtml(html, url) {
    var sandboxScript = buildSandboxScript();
    var escapedUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    var urlPatch = '<script>' +
      '(function(){' +
        'var _rb="' + escapedUrl + '";' +
        'var _O=URL;' +
        'function _P(u,b){' +
          'if(b){var bs=typeof b==="string"?b:String(b);if(bs==="about:srcdoc"||bs==="about:blank"||bs==="null"||bs.indexOf("about:")===0)b=_rb;}' +
          'if(!b&&typeof u==="string"&&u.charAt(0)==="/")return new _O(u,_rb);' +
          'try{return (arguments.length===1||!b)?new _O(u):new _O(u,b);}catch(e){try{return new _O(u,_rb);}catch(e2){throw e;}}' +
        '}' +
        '_P.prototype=_O.prototype;_P.createObjectURL=_O.createObjectURL.bind(_O);_P.revokeObjectURL=_O.revokeObjectURL.bind(_O);' +
        'if(_O.canParse)_P.canParse=_O.canParse.bind(_O);window.URL=_P;' +
        'var _hps=history.pushState.bind(history);var _hrs=history.replaceState.bind(history);' +
        'history.pushState=function(s,t,u){try{_hps(s,t,u);}catch(e){}};history.replaceState=function(s,t,u){try{_hrs(s,t,u);}catch(e){}};' +
        'var _of=window.fetch;var _px="' + (_corsProxyUrl || '').replace(/"/g, '\\"') + '";' +
        'try{if(!parent.__milgFontCache)parent.__milgFontCache={}}catch(e){}' +
        'var _fc=((typeof parent!=="undefined")&&parent.__milgFontCache)||{};' +
        'window.fetch=function(u,o){if(typeof u==="string"&&u.charAt(0)==="/")u=_rb.replace(/\\/$/,"")+u;' +
        'if(_px&&typeof u==="string"&&u.indexOf(_px)===-1&&/\\.(woff2?|ttf|otf|eot)(\\?|$)/i.test(u)){if(_fc[u])return _fc[u].then(function(r){return r.clone()});var p=_of.call(this,_px+"?url="+encodeURIComponent(u),o).catch(function(){return new Response("",{status:404})});_fc[u]=p;return p}' +
        'return _of.call(this,u,o)};' +
      '})();' +
    '</' + 'script>';
    var combined = sandboxScript + urlPatch;
    if (/<script[\s>]/i.test(html)) {
      return html.replace(/<script[\s>]/i, combined + '<script ');
    } else if (/<head[\s>]/i.test(html)) {
      return html.replace(/<head([^>]*)>/i, '<head$1>' + combined);
    }
    return combined + html;
  }

  return {
    init: init,
    fetchWithProxy: fetchWithProxy,
    fetchViaProxy: fetchViaProxy,
    analyzeWithJs: analyzeWithJs,
    prepareJsHtml: prepareJsHtml
  };
})();
