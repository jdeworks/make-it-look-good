// make-it-look-good — Iframe Analysis & Screenshot Pipeline
// Handles iframe creation, extraction injection, screenshot capture, and deep scan.
// Unified HTML preprocessing for all analysis paths (URL, paste, JS, deep scan, crawl).
// Depends on: analyzer-extract.js (MilgExtract)

window.MilgIframe = (function() {
  "use strict";

  var _screenshotCDN = '';
  var _proxyUrl = ''; // CORS proxy for font routing in iframes
  var _getViewport = function() { return { w: 1280, h: 900 }; };
  var _showProgress = function() {};
  // --- Screenshot settings ---
  // Scale 1.5 = text renders at 1.5x resolution via SVG foreignObject rasterization.
  // No DOM modifications needed — the library handles it.
  var SCREENSHOT_SCALE = 1.5;
  var SCREENSHOT_QUALITY = 0.8;

  function init(opts) {
    if (opts.screenshotCDN) _screenshotCDN = opts.screenshotCDN;
    if (opts.proxyUrl) _proxyUrl = opts.proxyUrl;
    if (opts.getViewport) _getViewport = opts.getViewport;
    if (opts.showProgress) _showProgress = opts.showProgress;
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

  // --- Unified HTML preprocessor ---
  // Merges ALL HTML preprocessing into one function. Called by analyzeHtml before iframe creation.
  // opts.baseTag (default: true when url): inject <base href> tag
  // opts.urlPatch (default: true when url): inject URL constructor srcdoc patch
  // opts.fontProxy (default: true when _proxyUrl set): inject font proxy fetch wrapper + font re-registration
  // opts.sandbox (default: false): inject sandbox script that blocks localStorage/cookies/etc.
  // opts.fetchPatch (default: false): inject enhanced fetch wrapper with relative URL fix + font proxy
  //   When fetchPatch is true, it supersedes urlPatch (more comprehensive — handles both URL and fetch).
  function preprocessHtml(html, url, opts) {
    opts = opts || {};
    var wantBase = opts.baseTag !== undefined ? opts.baseTag : !!url;
    var wantUrlPatch = opts.urlPatch !== undefined ? opts.urlPatch : !!url;
    var wantFontProxy = opts.fontProxy !== undefined ? opts.fontProxy : !!_proxyUrl;
    var wantSandbox = !!opts.sandbox;
    var wantFetchPatch = !!opts.fetchPatch;

    // fetchPatch supersedes urlPatch (it's more comprehensive)
    if (wantFetchPatch) wantUrlPatch = false;

    if (!url || url === 'Pasted HTML') {
      wantBase = false;
      wantUrlPatch = false;
      wantFetchPatch = false;
    }

    var scripts = '';

    try {
      var baseHref = '';
      if (url) {
        var base = new URL(url);
        baseHref = base.origin + base.pathname.replace(/\/[^/]*$/, '/');
      }

      // 1. Base tag (MUST come first — relative URLs in subsequent scripts and page
      //    elements resolve against <base href>. Without it, /_next/... resolves to
      //    the iframe origin jdeworks.github.io instead of the target site.)
      if (wantBase && baseHref) {
        scripts += '<base href="' + baseHref + '">';
      }

      // 2. Sandbox (blocks storage/cookies before any page JS)
      if (wantSandbox) {
        scripts += buildSandboxScript();
      }

      // 3a. Enhanced fetch patch (JS mode): URL constructor + fetch relative URL fix + font proxy
      if (wantFetchPatch && url) {
        var escapedUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        scripts += '<script>' +
          '(function(){' +
            'var _rb="' + escapedUrl + '";' +
            'var _ro=(function(){try{return new URL(_rb).origin}catch(e){return _rb.replace(/\\/\\/[^/]+\\/.*$/,"//"+_rb.split("//")[1].split("/")[0])}})();' +
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
            'var _px="' + (_proxyUrl || '').replace(/"/g, '\\"') + '";' +
            // Share font cache across iframes via parent (deep scan reuses fonts across viewports)
            'try{if(!parent.__milgFontCache)parent.__milgFontCache={}}catch(e){}' +
            'var _fc=((typeof parent!=="undefined")&&parent.__milgFontCache)||{};' +
            'if(!window.__milgFontBlobs)window.__milgFontBlobs={};' +
            'window.fetch=function(u,o){' +
              'if(typeof u==="string"&&u.charAt(0)==="/")u=_ro+u;' +
              // Skip fragment-only URLs (e.g. #n encoded as %23n by modernScreenshot)
              'if(typeof u==="string"&&(u.indexOf("%23")!==-1||u.indexOf("#")!==-1)){' +
                'var _uf=u.replace(/%23.*/,"").replace(/#.*/,"");' +
                'if(!_uf||_uf===_ro||_uf===_ro+"/")return Promise.resolve(new Response("",{status:200}))' +
              '}' +
              'if(_px&&typeof u==="string"&&u.indexOf(_px)===-1&&/\\.(woff2?|ttf|otf|eot)(\\?|$)/i.test(u)){' +
                'if(_fc[u])return _fc[u].then(function(r){return r.clone()});' +
                'var p=_of.call(this,_px+"?url="+encodeURIComponent(u),o)' +
                  '.then(function(r){var r2=r.clone();r2.blob().then(function(b){if(b.size>0)window.__milgFontBlobs[u]=URL.createObjectURL(b)}).catch(function(){});return r})' +
                  '.catch(function(e){console.warn("[milg-warn] Font proxy failed:",u,e&&e.message||"");return new Response("",{status:404})});' +
                '_fc[u]=p;return p;' +
              '}' +
              'if(_px&&typeof u==="string"&&u.indexOf(_px)===-1&&/\\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)(\\?|$)/i.test(u)){' +
                'return _of.call(this,_px+"?url="+encodeURIComponent(u),o)' +
                  '.catch(function(){return _of.call(this,u,o)})' +
              '}' +
              'return _of.call(this,u,o);' +
            '};' +
          '})();' +
          '</' + 'script>';
      }

      // 3b. Simple URL patch (non-JS mode): just fix URL constructor for srcdoc
      if (wantUrlPatch && baseHref) {
        scripts += '<script>' +
          '(function(){' +
            'var _OrigURL=URL;' +
            'var _loc=window.location;' +
            'function _isSrcdocLoc(v){' +
              'if(v===_loc||v===_loc.href)return true;' +
              'if(typeof v==="string"&&v.indexOf("about:srcdoc")===0)return true;' +
              'if(v&&typeof v==="object"&&typeof v.href==="string"&&v.href.indexOf("about:srcdoc")===0)return true;' +
              'return false' +
            '}' +
            'window.URL=function URL(u,b){' +
              'if(arguments.length>=2&&_isSrcdocLoc(b)){b=document.baseURI||"' + baseHref + '"}' +
              'return new _OrigURL(u,b)' +
            '};' +
            'window.URL.prototype=_OrigURL.prototype;' +
            'Object.keys(_OrigURL).forEach(function(k){try{window.URL[k]=_OrigURL[k]}catch(e){}});' +
            'window.URL.toString=function(){return _OrigURL.toString()};' +
            'try{Object.defineProperty(_loc,"origin",{get:function(){' +
              'try{var u=new _OrigURL(document.baseURI);return u.origin}catch(e){return"null"}' +
            '},configurable:true})}catch(e){}' +
          '})();' +
        '</' + 'script>';
      }

      // 4. Font proxy (non-fetchPatch mode only — fetchPatch already includes font proxying)
      if (wantFontProxy && _proxyUrl && !wantFetchPatch) {
        scripts += '<script>(function(){' +
          'var _of=window.fetch;' +
          'var _px="' + _proxyUrl.replace(/"/g, '\\"') + '";' +
          'try{if(!parent.__milgFontCache)parent.__milgFontCache={}}catch(e){}' +
          'var _fc=((typeof parent!=="undefined")&&parent.__milgFontCache)||{};' +
          'if(!window.__milgFontBlobs)window.__milgFontBlobs={};' +
          'window.fetch=function(u,o){' +
            // Skip fragment-only URLs
            'if(typeof u==="string"&&(u.indexOf("%23")!==-1||u.indexOf("#")!==-1)){' +
              'var _uf=u.replace(/%23.*/,"").replace(/#.*/,"");' +
              'if(!_uf||/^https?:\\/\\/[^/]+\\/?$/.test(_uf))return Promise.resolve(new Response("",{status:200}))' +
            '}' +
            'if(_px&&typeof u==="string"&&u.indexOf(_px)===-1&&/\\.(woff2?|ttf|otf|eot)(\\?|$)/i.test(u)){' +
              'if(_fc[u])return _fc[u].then(function(r){return r.clone()});' +
              'var p=_of.call(this,_px+"?url="+encodeURIComponent(u),o)' +
                '.then(function(r){' +
                  // Clone response and save blob URL for CSS @font-face export
                  'var r2=r.clone();' +
                  'r2.blob().then(function(b){if(b.size>0)window.__milgFontBlobs[u]=URL.createObjectURL(b)}).catch(function(){});' +
                  'return r' +
                '})' +
                '.catch(function(){return _of.call(this,u,o)});' +
              '_fc[u]=p;return p' +
            '}' +
            'if(_px&&typeof u==="string"&&u.indexOf(_px)===-1&&/\\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)(\\?|$)/i.test(u)){' +
              'return _of.call(this,_px+"?url="+encodeURIComponent(u),o)' +
                '.catch(function(){return _of.call(this,u,o)})' +
            '}' +
            'return _of.call(this,u,o)' +
          '};' +
        '})();</' + 'script>';
      }

      // 5. Font CSS export: convert cached font responses to blob @font-face rules.
      // domToCanvas (SVG foreignObject) can't use cross-origin @font-face fonts.
      // The fonts are ALREADY fetched (prefetchFonts + font proxy cache) — just need
      // to create blob URLs and CSS rules from the cached responses.
      if ((wantFontProxy || wantFetchPatch) && _proxyUrl) {
        var _baseOrigin = '';
        try { _baseOrigin = url ? new URL(url).origin : ''; } catch(e) {}
        scripts += '<script>(function(){' +
          'var _origin="' + _baseOrigin.replace(/"/g, '\\"') + '";' +
          'var _px="' + _proxyUrl.replace(/"/g, '\\"') + '";' +
          'function _fixFontsForCanvas(){' +
            'var _fc;try{_fc=parent.__milgFontCache||{}}catch(e){_fc={}}' +
            // Build set of actually-loaded font families + weights (skip unused subsets)
            'var _loaded={};' +
            'document.fonts.forEach(function(f){' +
              'if(f.status==="loaded"){' +
                'var key=f.family.replace(/["\x27]/g,"")+"|"+(f.weight||"400")+"|"+(f.style||"normal");' +
                '_loaded[key]=true' +
              '}' +
            '});' +
            'var toFix=[];var seen={};' +
            'try{Array.from(document.styleSheets).forEach(function(ss){' +
              'try{Array.from(ss.cssRules).forEach(function(r){' +
                'if(!(r instanceof CSSFontFaceRule))return;' +
                'var fam=(r.style.fontFamily||"").replace(/["\x27]/g,"").trim();' +
                'var weight=r.style.fontWeight||"400";' +
                'var style=r.style.fontStyle||"normal";' +
                // Skip if this family+weight isn't actually loaded (unused subset)
                'var key=fam+"|"+weight+"|"+style;' +
                'if(!_loaded[key])return;' +
                'var src=r.style.getPropertyValue("src")||"";' +
                'if(src.indexOf("data:")>=0)return;' +
                'var m=src.match(/url\\(["\x27]?([^")\x27]+\\.woff2?)["\x27]?\\)/i);' +
                'if(!m)return;' +
                'var fontUrl=m[1];' +
                'if(fontUrl.charAt(0)==="/")fontUrl=_origin+fontUrl;' +
                'else if(fontUrl.indexOf("://")===-1)fontUrl=_origin+"/"+fontUrl;' +
                'if(seen[fontUrl])return;seen[fontUrl]=true;' +
                'var cached=_fc[fontUrl];' +
                'var isWoff2=fontUrl.indexOf(".woff2")>=0;' +
                'if(!cached&&_px){cached=fetch(_px+"?url="+encodeURIComponent(fontUrl)).catch(function(){return new Response("",{status:404})})}' +
                'if(cached)toFix.push({family:fam,url:fontUrl,weight:weight,style:style,promise:cached,woff2:isWoff2})' +
              '})}catch(e){}})}catch(e){}' +
            'if(toFix.length===0){console.log("[milg-iframe] No fonts to inline (loaded: "+Object.keys(_loaded).length+", cache: "+Object.keys(_fc).length+")");return}' +
            'console.log("[milg-iframe] Inlining "+toFix.length+" actually-used fonts as base64 (skipped unused subsets)");' +
            'var _s=document.createElement("style");_s.setAttribute("data-milg-fonts","1");' +
            'var _ok=0;' +
            'Promise.all(toFix.map(function(f){' +
              'return f.promise.then(function(r){return r.clone().arrayBuffer()}).then(function(buf){' +
                'if(!buf||buf.byteLength===0)return;' +
                // Convert to base64 data URI (inline — SVG foreignObject CAN use these)
                'var bytes=new Uint8Array(buf);var bin="";' +
                'for(var i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);' +
                'var b64=btoa(bin);' +
                'var mime=f.woff2?"font/woff2":"font/woff";' +
                '_s.textContent+="@font-face{font-family:\\""+f.family+"\\";src:url(data:"+mime+";base64,"+b64+");font-weight:"+f.weight+";font-style:"+f.style+";font-display:swap;}\\n";' +
                '_ok++' +
              '}).catch(function(){})' +
            '})).then(function(){' +
              'if(_s.textContent)document.head.appendChild(_s);' +
              'console.log("[milg-iframe] Inlined "+_ok+"/"+toFix.length+" fonts as base64 data URI @font-face (0 proxy requests)")' +
            '})' +
          '}' +
          'if(document.readyState==="complete")setTimeout(_fixFontsForCanvas,500);' +
          'else window.addEventListener("load",function(){setTimeout(_fixFontsForCanvas,500)})' +
        '})();</' + 'script>';
      }

      // Rewrite relative URLs to absolute — more reliable than <base> in srcdoc iframes.
      // <base> doesn't always take effect before the browser starts fetching resources.
      if (url && baseHref) {
        var origin = new URL(url).origin;
        // Rewrite src, href, action, srcset, imagesrcset attributes with /path to absolute
        html = html.replace(/((?:src|href|action|srcset|imagesrcset)\s*=\s*["'])(\/[^"']*)/gi, function(m, prefix, path) {
          return prefix + origin + path;
        });
        // Also rewrite srcset entries that have /path (srcset="/_next/image 1x, /_next/image 2x")
        html = html.replace(/(srcset|imagesrcset)\s*=\s*"([^"]*)"/gi, function(m, attr, val) {
          var fixed = val.replace(/(^|,\s*)(\/\S+)/g, function(sm, sep, p) { return sep + origin + p; });
          return attr + '="' + fixed + '"';
        });
      }

      if (!scripts) return html;

      // Injection point: for JS mode (sandbox/fetchPatch), inject BEFORE first <script>
      // so patches run before any framework JS. For non-JS mode, inject after <head>.
      if (wantSandbox || wantFetchPatch) {
        if (/<script[\s>]/i.test(html)) {
          return html.replace(/<script[\s>]/i, scripts + '<script ');
        }
      }
      if (/<head[\s>]/i.test(html)) {
        return html.replace(/<head([^>]*)>/i, '<head$1>' + scripts);
      }
      return scripts + html;
    } catch(e) { return html; }
  }

  // --- Font prefetch ---
  // Prefetch fonts through CORS proxy before launching viewports.
  // Populates parent.__milgFontCache so all iframes get cache hits.
  function prefetchFonts(html, url, cb) {
    var fontUrls = [];
    var preloadRe = /<link[^>]+rel=["']preload["'][^>]+as=["']font["'][^>]+href=["']([^"']+)["']/gi;
    var m; while ((m = preloadRe.exec(html)) !== null) fontUrls.push(m[1]);
    var faceRe = /url\(["']?([^"')]+\.(?:woff2?|ttf|otf|eot)[^"')]*?)["']?\)/gi;
    while ((m = faceRe.exec(html)) !== null) fontUrls.push(m[1]);
    var seen = {};
    var resolved = [];
    var origin; try { origin = new URL(url).origin; } catch(e) { origin = url.replace(/\/[^/]*$/, ''); }
    fontUrls.forEach(function(u) {
      try {
        var abs = u.charAt(0) === '/' ? origin + u : (u.indexOf('://') > 0 ? u : origin + '/' + u);
        if (!seen[abs]) { seen[abs] = true; resolved.push(abs); }
      } catch(e) {}
    });
    if (resolved.length === 0 || !_proxyUrl) { cb(); return; }
    if (!window.__milgFontCache) window.__milgFontCache = {};
    // Filter out already-cached fonts (same-site crawl pages share fonts)
    var toFetch = resolved.filter(function(u) { return !window.__milgFontCache[u]; }).slice(0, 20);
    if (toFetch.length === 0) { console.log('[milg] All ' + resolved.length + ' fonts already cached'); cb(); return; }
    console.log('[milg] Prefetching ' + toFetch.length + ' fonts through proxy (' + (resolved.length - toFetch.length) + ' cached)');
    // Sequential fetch to avoid rate limiting
    var fi = 0;
    function _nextFont() {
      if (fi >= toFetch.length) { cb(); return; }
      var fontUrl = toFetch[fi]; fi++;
      var p = fetch((_proxyUrl || '') + '?url=' + encodeURIComponent(fontUrl)).catch(function(e) { console.warn('[milg-warn] Font prefetch failed:', fontUrl, e && e.message || ''); return new Response('', { status: 404 }); });
      window.__milgFontCache[fontUrl] = p;
      p.then(_nextFont).catch(_nextFont);
    }
    _nextFont();
    setTimeout(function() { if (fi < toFetch.length) { console.log('[milg] Font prefetch timeout, continuing'); fi = toFetch.length; cb(); } }, 15000);
  }

  // Region screenshot function — sourced from MilgRegion shared module
  // (analyzer-region.js loads before this script in analyzer.html, so
  // window.MilgRegion is always defined). Serialized via .toString() and
  // injected into the analysis iframe at the _buildRegionScreenshots site below.
  var _regionScreenshotFn = window.MilgRegion.getRegionFn();

  // --- Screenshot capture script (injected into iframes after extraction) ---
  // Called after extraction via __milgDoScreenshots (once-guard prevents double run).
  // Mirrors console snippet: pre-scroll → reset → wait → re-read bboxes → capture body
  function buildScreenshotScript(msgType) {
    // Full-page capture + multi-layer mask CORE now lives in MilgCapture
    // (analyzer-capture.js). We serialize the capture fn and the iframe-mode
    // PRE hook + image-preload hook + region fn, inject them, and run the core
    // inside the analysis iframe. Behavior is identical to the former inline
    // string body; only the relocation changed. The CORE postMessages results
    // itself (clean/expanded/mask/regions); this wrapper keeps the once-guard,
    // the _prog reporter, and the same milg-progress message shape.
    var _captureFn = window.MilgCapture.getCaptureFn();
    var _preHook = window.MilgCapture.getIframePreHook();
    var _preloadFn = window.MilgCapture.getIframePreloadFn();
    var _opts = {
      msgType: msgType,
      cdnUrl: _screenshotCDN,
      proxyUrl: _proxyUrl || '',
      expand: true,
      preHookSrc: _preHook.toString(),
      preloadSrc: _preloadFn.toString(),
      regionFnSrc: _regionScreenshotFn.toString()
    };
    return '(function(){' +
      // Once-guard: extraction may fire twice (load + fallback timeout)
      'if(window.__milgSsDone)return;window.__milgSsDone=true;' +
      'var _mid=window.__milgIframeId||"";' +
      'function _prog(l){try{parent.postMessage({type:"milg-progress",label:l,_iframeId:_mid},"*")}catch(e){}}' +
      'var _cap=(' + _captureFn.toString() + ')(' + SCREENSHOT_SCALE + ',' + SCREENSHOT_QUALITY + ',_prog,' + JSON.stringify(_opts) + ');' +
      '_cap(function(){})' +
    '})()';
  }

  // --- Unified analysis entry point ---
  // analyzeHtml(html, opts, callback)
  // opts: { url, jsEnabled, screenshots, viewport, exclude, editorDark, editorEffectCSS }
  // Preprocesses HTML (base tag, URL patch, sandbox, font proxy) then creates iframe.
  function analyzeHtml(html, opts, callback) {
    opts = opts || {};
    var sourceUrl = opts.url || null;
    var jsEnabled = !!opts.jsEnabled;
    var captureScreenshots = opts.screenshots !== undefined ? opts.screenshots : false;
    var excludeSelector = opts.exclude || null;
    var viewportOverride = opts.viewport || null;
    var editorDark = !!opts.editorDark;
    var editorEffectCSS = opts.editorEffectCSS || '';

    // Preprocess HTML based on mode
    html = preprocessHtml(html, sourceUrl, {
      baseTag: !!sourceUrl,
      urlPatch: !!sourceUrl && !jsEnabled,
      fontProxy: !!_proxyUrl && !jsEnabled,
      sandbox: jsEnabled,
      fetchPatch: jsEnabled && !!sourceUrl
    });

    _analyzeHtmlInIframe(html, callback, sourceUrl, excludeSelector, captureScreenshots, viewportOverride, editorDark, editorEffectCSS, jsEnabled);
  }

  // Internal implementation: creates iframe, injects extraction, handles messages.
  // HTML must already be preprocessed (base tag, URL patch, etc.) before calling this.
  function _analyzeHtmlInIframe(html, callback, sourceUrl, excludeSelector, captureScreenshots, viewportOverride, editorDark, editorEffectCSS, jsEnabled) {
    var extractFromDocument = window.MilgExtract;
    var iframe = document.createElement('iframe');
    // Unique ID for this iframe — used to match postMessage responses in parallel mode
    var _iframeId = 'milg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
    // Use viewport override if provided, else from selector/default
    var vp = viewportOverride || _getViewport();
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + vp.w + 'px;height:' + vp.h + 'px;border:none;';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    document.body.appendChild(iframe);

    var handled = false;
    function _applyMaskResults(mr) {
      if (!iframe._milgData || !mr) return;
      var cp = iframe._milgData.colors && iframe._milgData.colors.contrastPairs;
      if (!cp) return;
      var applied = 0;
      Object.keys(mr).forEach(function(idx) {
        var i = parseInt(idx, 10);
        if (cp[i]) {
          cp[i]._maskBmp = mr[idx].bmp;
          cp[i]._maskPacked = !!mr[idx].packed;
          cp[i]._maskW = mr[idx].w;
          cp[i]._maskH = mr[idx].h;
          cp[i]._maskLayer = mr[idx].layer;
          cp[i]._maskDark = mr[idx].dark;
          applied++;
        }
      });
    }
    function finish(data) {
      if (handled) return;
      handled = true;
      window.removeEventListener('message', onMsg);
      if (iframe.parentNode) document.body.removeChild(iframe);
      callback(data);
    }

    function onMsg(e) {
      if (!e.data) return;
      // Only process messages from OUR iframe (matched by unique ID)
      if (e.data._iframeId && e.data._iframeId !== _iframeId) return;
      // Progress updates from screenshot capture → drive parent progress bar
      if (e.data.type === 'milg-progress' && e.data.label) {
        var urlStatus = document.getElementById('urlStatus');
        if (urlStatus) { urlStatus.style.display = 'block'; urlStatus.textContent = e.data.label; }
        // Map labels to progress percentages
        var pctMap = {
          'Pre-scrolling page to load content...': 30,
          'Waiting for animations to settle...': 40,
          'Capturing screenshot...': 50,
          'Capturing text mask...': 80
        };
        var pct = pctMap[e.data.label];
        if (pct && typeof _showProgress === 'function') _showProgress(pct, e.data.label);
      }
      if (e.data.type === 'milg-analyzer-result') {
        var data = e.data.data;
        data.meta.url = 'Pasted HTML';
        if (!captureScreenshots) {
          finish(data);
          return;
        }
        // Store data, wait for screenshots (capture auto-triggers via __milgDoScreenshots)
        iframe._milgData = data;
      }
      if (e.data.type === 'milg-screenshots-result' && iframe._milgData) {
        iframe._milgData.screenshots = e.data.screenshots || [];
        iframe._milgData.screenshotFull = e.data.screenshotFull || null;
        iframe._milgData.screenshotClean = e.data.screenshotClean || null;
        iframe._milgData.screenshotCleanMeta = e.data.screenshotCleanMeta || null;
        iframe._milgData.textMask = e.data.textMask || null;
        iframe._milgData.screenshotMeta = e.data.screenshotMeta || null;
        iframe._milgData.regionScreenshots = e.data.regionScreenshots || [];
        // Apply re-read bbox data from the iframe (updated after scroll-reset + getFlowPosition)
        if (e.data.updatedData) {
          var ud = e.data.updatedData;
          // Merge re-read bboxes back into our data
          if (ud.colors && ud.colors.contrastPairs) iframe._milgData.colors.contrastPairs = ud.colors.contrastPairs;
          if (ud.typography) {
            if (ud.typography.fontSizes) iframe._milgData.typography.fontSizes = ud.typography.fontSizes;
            if (ud.typography.headings) iframe._milgData.typography.headings = ud.typography.headings;
            if (ud.typography.maxLineLength) iframe._milgData.typography.maxLineLength = ud.typography.maxLineLength;
          }
          if (ud.interaction && ud.interaction.touchTargets) iframe._milgData.interaction.touchTargets = ud.interaction.touchTargets;
          if (ud.layout) {
            if (ud.layout.offscreenElements) iframe._milgData.layout.offscreenElements = ud.layout.offscreenElements;
            if (ud.layout.hiddenPanelIssues) iframe._milgData.layout.hiddenPanelIssues = ud.layout.hiddenPanelIssues;
            if (ud.layout.alignmentElements) iframe._milgData.layout.alignmentElements = ud.layout.alignmentElements;
            if (ud.layout.borderRadii) iframe._milgData.layout.borderRadii = ud.layout.borderRadii;
          }
          var _dp = iframe._milgData.colors ? iframe._milgData.colors.contrastPairs : [];
          var _dRcid = _dp.filter(function(p) { return !!p._regionContainerId; }).length;
          var _dClip = _dp.filter(function(p) { return !!p._isClipped; }).length;
          var _dMask = _dp.filter(function(p) { return !!p._maskBmp; }).length;
          var _dRgns = (iframe._milgData.regionScreenshots || []).length;
          console.log('[D] parent pairs=' + _dp.length + ' rcid=' + _dRcid + ' clipped=' + _dClip + ' masks=' + _dMask + ' regions=' + _dRgns);
        }
        // If hidden panels were detected, trigger unhidden screenshot pass
        var hpc = iframe._milgData.layout && iframe._milgData.layout.hiddenPanelCount;
        if (hpc > 0 && iframe.contentWindow && iframe.contentWindow.__milgDoUnhiddenScreenshots) {
          try {
            setTimeout(function() { iframe.contentWindow.__milgDoUnhiddenScreenshots(); }, 100);
          } catch(ex) { finish(iframe._milgData); }
        } else {
          finish(iframe._milgData);
        }
      }
      if (e.data.type === 'milg-screenshots-unhidden' && iframe._milgData) {
        iframe._milgData.screenshotsUnhidden = e.data.screenshots || [];
        finish(iframe._milgData);
      }
    }
    window.addEventListener('message', onMsg);

    // If the pasted HTML is a full document (has <html> or <head>), use it as-is
    // and just append the extraction script. Otherwise wrap in a basic document.
    var isFullDoc = /<html[\s>]/i.test(html) || /<!DOCTYPE/i.test(html);
    // HTML preprocessing (base tag, URL patch, font proxy, sandbox) is done by the caller.
    // Pass context to extraction �� include iframe ID for message matching in parallel mode
    var idVar = '<script>window.__milgIframeId="' + _iframeId + '";</' + 'script>';
    var excludeVar = excludeSelector ? '<script>window.__milgExclude=' + JSON.stringify(excludeSelector) + ';</' + 'script>' : '';
    var fragmentVar = !isFullDoc ? '<script>window.__milgIsFragment=true;</' + 'script>' : '';
    // Screenshot capture: script that auto-runs after extraction, loads CDN library, captures page
    // Also includes unhidden-panels screenshot if hidden panels are detected
    var unhiddenScreenshotFn = 'window.__milgDoUnhiddenScreenshots=function(){' +
      'var _mid=window.__milgIframeId||"";' +
      // Unhide all interactive panels using !important overrides
      'var panels=document.querySelectorAll("[role=menu],[role=listbox],[role=dialog],[role=tooltip],[role=alertdialog]");' +
      'var hidden=[];' +
      'panels.forEach(function(p){' +
        'var s=getComputedStyle(p);' +
        'if(s.display==="none"||s.visibility==="hidden"||s.opacity==="0"){' +
          'hidden.push({el:p,css:p.style.cssText,ariaH:p.getAttribute("aria-hidden"),hadHidden:p.hasAttribute("hidden")});' +
          'p.style.cssText=p.style.cssText+";display:block !important;visibility:visible !important;opacity:1 !important;";' +
          'if(p.hasAttribute("hidden"))p.removeAttribute("hidden");' +
          'if(p.getAttribute("aria-hidden")==="true")p.setAttribute("aria-hidden","false")' +
        '}' +
      '});' +
      // Also check aria-haspopup sibling panels
      'document.querySelectorAll("[aria-haspopup]").forEach(function(t){' +
        'var w=t.parentElement;if(!w)return;' +
        'w.querySelectorAll("[role=menu],[role=listbox],[role=dialog]").forEach(function(p){' +
          'var s=getComputedStyle(p);' +
          'if(s.display==="none"||s.visibility==="hidden"||s.opacity==="0"){' +
            'hidden.push({el:p,css:p.style.cssText,ariaH:p.getAttribute("aria-hidden"),hadHidden:p.hasAttribute("hidden")});' +
            'p.style.cssText=p.style.cssText+";display:block !important;visibility:visible !important;opacity:1 !important;";' +
            'if(p.hasAttribute("hidden"))p.removeAttribute("hidden");' +
            'if(p.getAttribute("aria-hidden")==="true")p.setAttribute("aria-hidden","false")' +
          '}' +
        '})' +
      '});' +
      'if(hidden.length===0){parent.postMessage({type:"milg-screenshots-unhidden",screenshots:[],_iframeId:_mid},"*");return}' +
      'void document.body.offsetHeight;' +
      'setTimeout(function(){' +
        // Direct capture (iframe already resized from main screenshot pass)
        'var ms=window.modernScreenshot;' +
        'if(!ms||!ms.domToCanvas){parent.postMessage({type:"milg-screenshots-unhidden",screenshots:[],_iframeId:_mid},"*");return}' +
        'ms.domToCanvas(document.documentElement,{scale:' + SCREENSHOT_SCALE + ',timeout:30000}).then(function(fc){' +
          'var uri;try{uri=fc.toDataURL("image/webp",' + SCREENSHOT_QUALITY + ')}catch(e){uri=""}' +
          'parent.postMessage({type:"milg-screenshots-unhidden",screenshots:uri?[uri]:[],_iframeId:_mid},"*")' +
        '}).catch(function(){parent.postMessage({type:"milg-screenshots-unhidden",screenshots:[],_iframeId:_mid},"*")})' +
      '},300)' +
    '};';
    var screenshotScript = captureScreenshots ? '<script>window.__milgDoScreenshots=function(){' + buildScreenshotScript('milg-screenshots-result') + '};' + unhiddenScreenshotFn + '</' + 'script>' : '';
    var srcdoc;
    var _extractFnSrc = extractFromDocument.toString();
    if (isFullDoc) {
      // Wait for window load (CSS/fonts loaded), then extra delay for rendering
      // JS-enabled mode needs longer delays for React/Vue hydration
      var postLoadDelay = jsEnabled ? 2000 : 1000;
      var fallbackDelay = jsEnabled ? 8000 : 8000;
      var extractScript = idVar + excludeVar + fragmentVar + screenshotScript + '<script>window.MilgExtract=(' + _extractFnSrc + ');window.addEventListener("load",function(){setTimeout(function(){window.MilgExtract()},' + postLoadDelay + ')});setTimeout(function(){window.MilgExtract()},' + fallbackDelay + ');</' + 'script>';
      if (/<\/body>/i.test(html)) {
        srcdoc = html.replace(/<\/body>/i, extractScript + '</body>');
      } else {
        srcdoc = html + extractScript;
      }
    } else {
      var darkClass = editorDark ? ' class="dark"' : '';
      // ALWAYS define the class-based dark variant (matching the editor preview), so
      // `dark:` classes only trigger via the .dark class — never via the OS-level
      // prefers-color-scheme default. Otherwise a light preview is rendered dark on a
      // dark-OS machine. The class itself is still added only when editorDark.
      var darkVariantTag = '<style type="text/tailwindcss">@custom-variant dark (&:where(.dark, .dark *));</style>';
      var effectTag = editorEffectCSS ? '<style>' + editorEffectCSS + '</style>' : '';
      srcdoc = '<!DOCTYPE html><html lang="en"' + darkClass + '><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></' + 'script>' +
        darkVariantTag + effectTag +
        '<style>body{margin:0}</style></head><body>' +
        html + idVar + excludeVar + fragmentVar + screenshotScript +
        '<script>window.MilgExtract=(' + _extractFnSrc + ');setTimeout(function(){window.MilgExtract()}, 1500);</' + 'script>' +
        '</body></html>';
    }
    iframe.srcdoc = srcdoc;

    // Timeout fallback (longer when capturing screenshots)
    setTimeout(function() {
      if (!handled && iframe._milgData) {
        // Extraction succeeded but screenshots timed out — return without screenshots
        iframe._milgData.screenshots = [];
        finish(iframe._milgData);
      } else {
        finish({
          meta: { title: '', url: 'Pasted HTML', viewportWidth: 1280, viewportHeight: 900, timestamp: new Date().toISOString(), version: 1 },
          colors: { textColors: [], bgColors: [], contrastPairs: [] },
          typography: { bodyFontSize: '16px', bodyLineHeight: '24px', bodyFontFamily: 'sans-serif', fontFamilies: [], fontSizes: [], fontWeights: [], headings: [], lineHeights: [], maxLineLength: { chars: 0, element: '', fontSize: 0, textLength: 0 } },
          spacing: { paddings: [], margins: [], gaps: [], maxContentWidth: '', bodyPaddingHorizontal: '' },
          layout: { sectionGaps: [], alignmentEdges: [], visualHierarchy: {} },
          interaction: { touchTargets: [], transitions: [] },
          accessibility: { semanticElements: {}, headingHierarchy: [], imagesWithoutAlt: 0, formLabels: { total: 0, withLabel: 0, withoutLabel: 0 }, focusIndicators: [] },
          structure: { totalElements: 0, darkModeClasses: false, responsiveClasses: false, tailwindDetected: false, cssFramework: 'unknown' }
        });
      }
    }, captureScreenshots ? 480000 : (isFullDoc ? 15000 : 8000));
  }

  return {
    init: init,
    preprocessHtml: preprocessHtml,
    prefetchFonts: prefetchFonts,
    analyzeHtml: analyzeHtml
  };
})();
