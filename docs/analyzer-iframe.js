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
    var ss = { scale: SCREENSHOT_SCALE, quality: SCREENSHOT_QUALITY };
    return '(function(){' +
      // Once-guard: extraction may fire twice (load + fallback timeout)
      'if(window.__milgSsDone)return;window.__milgSsDone=true;' +
      'var vh=window.innerHeight||900;' +
      'var _mid=window.__milgIframeId||"";' +
      'function _prog(l){try{parent.postMessage({type:"milg-progress",label:l,_iframeId:_mid},"*")}catch(e){}}' +
      // Unlock height to get true scrollHeight (sites with html,body{height:100%} clamp it)
      // Set overflow:auto explicitly so the inner document is scrollable for IntersectionObservers
      'document.documentElement.style.cssText+="height:auto !important;overflow-y:auto !important;";' +
      'document.body.style.cssText+="height:auto !important;";' +
      'void document.body.offsetHeight;' + // force reflow
      'var totalH=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);' +
      'var captureH=Math.min(totalH,vh*10);' +
      '_prog("Pre-scrolling page to load content...");' +
      'console.log("[iframe-ss] Phase 1: Pre-scrolling "+captureH+"px ("+Math.ceil(captureH/vh)+" steps, vh="+vh+") ...");' +
      // Phase 1: Pre-scroll to trigger IntersectionObservers, lazy images, fade-in animations
      'var _positions=[];for(var p=0;p<captureH;p+=vh)_positions.push(p);' +
      'var _pi=0;' +
      'function _scrollNext(){' +
        'if(_pi>=_positions.length){' +
          'console.log("[iframe-ss] Phase 1 done (scrollY="+window.scrollY+"). Waiting for content...");' +
          'setTimeout(_startCapture,800);return' + // 800ms for lazy content + animations to start
        '}' +
        'window.scrollTo(0,_positions[_pi]);' +
        // Also scroll documentElement directly (some browsers need this in iframes)
        'document.documentElement.scrollTop=_positions[_pi];' +
        'try{window.dispatchEvent(new Event("scroll"))}catch(e){}' +
        'console.log("[iframe-ss] scroll to "+_positions[_pi]+" → actual="+window.scrollY);' +
        '_pi++;setTimeout(_scrollNext,200)' + // 200ms per step (more time for observers)
      '}' +
      '_scrollNext();' +
      // Phase 2: Reset scroll, force-reveal hidden animated content, capture
      'function _startCapture(){' +
        'document.documentElement.style.scrollBehavior="auto";' +
        'document.body.style.scrollBehavior="auto";' +
        'window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;' +
        'document.querySelectorAll("*").forEach(function(el){' +
          'if(el.scrollTop>0){var s=getComputedStyle(el);' +
          'if(s.overflow==="auto"||s.overflow==="scroll"||s.overflowY==="auto"||s.overflowY==="scroll"){' +
          'el.style.scrollBehavior="auto";el.scrollTop=0}}' +
        '});' +
        // Force-finalize scroll-triggered animations:
        // IntersectionObserver doesn't fire in offscreen iframes (browser optimization).
        // Find all elements with opacity:0 that have transitions/animations and force them visible.
        'var _revealed=0;' +
        'document.querySelectorAll("*").forEach(function(el){' +
          'var cs=getComputedStyle(el);' +
          'if(cs.opacity==="0"&&el.tagName!=="SCRIPT"&&el.tagName!=="STYLE"){' +
            // Check if this is an animation-hidden element (has transition on opacity or a CSS animation)
            'var hasTrans=cs.transition&&cs.transition.indexOf("opacity")!==-1;' +
            'var hasAnim=cs.animationName&&cs.animationName!=="none";' +
            'var hasTransform=cs.transform&&cs.transform!=="none";' +
            // Also check for common scroll-reveal patterns (classes containing fade, reveal, animate, aos)
            'var cls=(el.className&&typeof el.className==="string")?el.className.toLowerCase():"";' +
            'var isScrollAnim=hasTrans||hasAnim||/fade|reveal|animate|aos|scroll|slide|appear/.test(cls);' +
            'if(isScrollAnim){' +
              'el.style.cssText+=";opacity:1 !important;transform:none !important;transition:none !important;animation:none !important;";' +
              '_revealed++' +
            '}' +
          '}' +
        '});' +
        'if(_revealed>0)0&&console.log("[iframe-ss] Force-revealed "+_revealed+" scroll-animated elements (IO disabled in offscreen iframes)");' +
        // Also inject a style to fast-forward any remaining CSS animations
        'var _ffStyle=document.createElement("style");' +
        '_ffStyle.textContent="*,*::before,*::after{animation-delay:0s !important;animation-duration:0.01s !important;transition-duration:0s !important;transition-delay:0s !important;}";' +
        'document.head.appendChild(_ffStyle);' +
        'void document.body.offsetHeight;' +
        // Switch to overflow:visible for capture
        'document.documentElement.style.cssText+="overflow:visible !important;";' +
        'document.body.style.cssText+="overflow:visible !important;";' +
        // Overflow expansion for carousels is deferred — happens AFTER clean screenshot capture
        'void document.body.offsetHeight;' +
        '_prog("Waiting for animations to settle...");' +
        '0&&console.log("[iframe-ss] Phase 2: Waiting for animations to finalize...");' +
        'setTimeout(function(){' +
          'if(typeof window.__milgReReadBboxes==="function"){' +
            'var res=window.__milgReReadBboxes();' +
            '0&&console.log("[iframe-ss] Re-read bboxes: "+res)' +
          '}' +
          'var fullH=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);' +
          'console.log("[iframe-ss] scrollHeight="+fullH+" vh="+vh);' +
          'var s=document.createElement("script");' +
          's.src="' + _screenshotCDN + '";' +
          's.onload=function(){' +
            'var ms=window.modernScreenshot;' +
            'if(!ms||!ms.domToCanvas){parent.postMessage({type:"' + msgType + '",screenshots:[],_iframeId:_mid},"*");return}' +
            'var _imgPx="' + (_proxyUrl || '').replace(/"/g, '\\"') + '";' +
            // Preload cross-origin images via proxy → data URI before capture
            'function _preloadImages(cb){' +
              'if(!_imgPx){cb();return}' +
              'var imgs=document.querySelectorAll("img");' +
              'var srcs=document.querySelectorAll("source[srcset]");' +
              'var jobs=[];' +
              // Collect cross-origin img elements
              'imgs.forEach(function(i){' +
                'if(!i.src||i.src.indexOf("data:")===0||i.src.indexOf("blob:")===0)return;' +
                'if(i.src.indexOf(location.origin)===0)return;' +
                // Skip fragment-only src (e.g. src="#n") and strip hash before proxying
                'var _rawSrc=i.getAttribute("src");' +
                'if(_rawSrc&&_rawSrc.charAt(0)==="#")return;' +
                'var _cleanUrl=i.src.split("#")[0];if(!_cleanUrl)return;' +
                'jobs.push({el:i,url:_cleanUrl,attr:"src"})' +
              '});' +
              // Collect cross-origin source[srcset] (picture elements)
              'srcs.forEach(function(s){' +
                'var ss=s.getAttribute("srcset");if(!ss)return;' +
                'if(ss.charAt(0)==="#")return;' +
                'var u=ss.split(",")[0].trim().split(/\\s+/)[0];' +
                'if(!u||u.indexOf("data:")===0||u.indexOf("blob:")===0)return;' +
                'if(u.indexOf(location.origin)===0)return;' +
                'var _cleanU=u.split("#")[0];if(!_cleanU)return;' +
                'jobs.push({el:s,url:_cleanU,attr:"srcset"})' +
              '});' +
              'if(jobs.length===0){cb();return}' +
              '_prog("Preloading "+jobs.length+" images via proxy...");' +
              'console.log("[iframe-ss] Preloading "+jobs.length+" cross-origin images via proxy");' +
              'var done=0;' +
              'jobs.forEach(function(j){' +
                'var pxUrl=_imgPx+"?url="+encodeURIComponent(j.url);' +
                'fetch(pxUrl).then(function(r){' +
                  'if(!r.ok)throw new Error(r.status);return r.blob()' +
                '}).then(function(blob){' +
                  'return new Promise(function(res){' +
                    'var fr=new FileReader();fr.onload=function(){res(fr.result)};fr.onerror=function(){res(null)};fr.readAsDataURL(blob)' +
                  '})' +
                '}).then(function(dataUri){' +
                  'if(dataUri){' +
                    'if(j.attr==="src")j.el.src=dataUri;' +
                    'else if(j.attr==="srcset")j.el.setAttribute("srcset",dataUri)' +
                  '}' +
                '}).catch(function(e){' +
                  'console.warn("[iframe-ss] Image preload failed:",j.url,e&&e.message||"")' +
                '}).finally(function(){' +
                  'done++;if(done>=jobs.length)cb()' +
                '})' +
              '})' +
            '}' +
            // Also inline CSS background-image URLs
            'function _preloadBgImages(cb){' +
              'if(!_imgPx){cb();return}' +
              'var jobs=[];' +
              'document.querySelectorAll("*").forEach(function(el){' +
                'var bg=getComputedStyle(el).backgroundImage;' +
                'if(!bg||bg==="none")return;' +
                'var m=bg.match(/url\\("?(https?:\\/\\/[^"\\)]+)"?\\)/);' +
                'if(!m||!m[1]||m[1].indexOf(location.origin)===0)return;' +
                'var _bgUrl=m[1].split("#")[0];if(!_bgUrl)return;' +
                'jobs.push({el:el,url:_bgUrl,fullBg:bg})' +
              '});' +
              'if(jobs.length===0){cb();return}' +
              'console.log("[iframe-ss] Preloading "+jobs.length+" background images via proxy");' +
              'var done=0;' +
              'jobs.forEach(function(j){' +
                'fetch(_imgPx+"?url="+encodeURIComponent(j.url)).then(function(r){' +
                  'if(!r.ok)throw new Error(r.status);return r.blob()' +
                '}).then(function(blob){' +
                  'return new Promise(function(res){var fr=new FileReader();fr.onload=function(){res(fr.result)};fr.onerror=function(){res(null)};fr.readAsDataURL(blob)})' +
                '}).then(function(d){' +
                  'if(d)j.el.style.backgroundImage=j.fullBg.replace(j.url,d)' +
                '}).catch(function(){}).finally(function(){done++;if(done>=jobs.length)cb()})' +
              '})' +
            '}' +
            'var _sc=' + ss.scale + ';' +
            // Helper: send results to parent
            'function _send(fullUri,maskUri){' +
              'var updatedData=window.__milgData||null;' +
              'parent.postMessage({type:"' + msgType + '",_iframeId:_mid,' +
                'screenshots:fullUri?[fullUri]:[],' +
                'screenshotFull:fullUri||null,' +
                'textMask:maskUri||null,' +
                'screenshotMeta:{scale:_sc,viewportHeight:vh,sectionCount:1,' +
                  'canvasWidth:0,canvasHeight:0,' +
                  'docHeightAtCapture:fullH,' +
                  'calibrationOffsetY:0,calibrationSamples:[]},' +
                'updatedData:updatedData' +
              '},"*")' +
            '}' +
            // Preload images via proxy → data URI, then capture
            '_preloadImages(function(){_preloadBgImages(function(){' +
            // Phase A: Clean screenshot (page as-rendered, before overflow expansion)
            '_prog("Capturing clean screenshot...");' +
            'console.log("[iframe-ss] Capturing clean screenshot at "+_sc+"x...");' +
            'ms.domToCanvas(document.documentElement,{scale:_sc,timeout:45000}).then(function(_cleanCanvas){' +
              'var _cleanUri;try{_cleanUri=_cleanCanvas.toDataURL("image/webp",' + ss.quality + ')}catch(e){_cleanUri=""}' +
              'var _cleanW=_cleanCanvas.width,_cleanH=_cleanCanvas.height;' +
              'console.log("[iframe-ss] Clean screenshot: "+_cleanW+"x"+_cleanH);' +
              // Inject and run region screenshot function (serialized to avoid escaping issues).
              // The marking pre-pass (pair._isClipped, container._mrc, _regionContainerId/_rcid)
              // now lives inside MilgRegion.getRegionFn() and runs at its start — shared with snippet mode.
              'var _cp2=window.__milgData&&window.__milgData.colors?window.__milgData.colors.contrastPairs||[]:[];' +
              'var _buildRegionScreenshots=(' + _regionScreenshotFn.toString() + ')(_sc,' + ss.quality + ',_prog,_cp2);' +
              '_buildRegionScreenshots(function(_regionResults){' +
              'window.__milgRegionScreenshots=_regionResults;' +
              // Save clean-screenshot bbox coordinates before Phase B expansion.
              // The viewer displays the clean screenshot, so bboxes must match pre-expansion layout.
              'var _savedBboxes=[];' +
              'if(window.__milgBboxRefs){window.__milgBboxRefs.forEach(function(ref){' +
                'if(ref.obj&&ref.obj[ref.key]){var b=ref.obj[ref.key];' +
                '_savedBboxes.push({obj:ref.obj,key:ref.key,left:b.left,top:b.top,width:b.width,height:b.height,_rcid:b._rcid})}' +
              '})}' +
              // Phase B: Expand overflow:hidden containers with transformed descendants (carousels/sliders)
              'var _expanded=0;' +
              'document.querySelectorAll("*").forEach(function(container){' +
                'var cs=getComputedStyle(container);' +
                'var ov=cs.overflow||"";var ovx=cs.overflowX||"";var ovy=cs.overflowY||"";' +
                'var isClipping=ov==="hidden"||ov==="clip"||ovx==="hidden"||ovx==="clip"||ovy==="hidden"||ovy==="clip";' +
                'if(!isClipping)return;' +
                'var cr=container.getBoundingClientRect();' +
                'if(cr.width<100||cr.height<30)return;' +
                'var transEls=[];' +
                'container.querySelectorAll("*").forEach(function(desc){' +
                  'var ct=getComputedStyle(desc).transform;' +
                  'if(!ct||ct==="none")return;' +
                  'var _m=ct.match(/matrix\\(([^)]+)\\)/);' +
                  'if(!_m)return;' +
                  'var _p=_m[1].split(",");' +
                  'var _tx=Math.abs(parseFloat(_p[4])||0);' +
                  'var _ty=Math.abs(parseFloat(_p[5])||0);' +
                  'if(_tx>5||_ty>5)transEls.push(desc)' +
                '});' +
                'if(transEls.length===0)return;' +
                'container.style.cssText+=";overflow:visible !important;";' +
                'transEls.forEach(function(el){el.style.cssText+=";transform:none !important;"});' +
                '_expanded++' +
              '});' +
              'if(_expanded>0)console.log("[iframe-ss] Expanded "+_expanded+" overflow:hidden containers with transformed descendants");' +
              'void document.body.offsetHeight;' +
              // Re-read bboxes after expansion so they match the expanded layout
              'if(_expanded>0&&typeof window.__milgReReadBboxes==="function"){' +
                'var _res2=window.__milgReReadBboxes();' +
                'console.log("[iframe-ss] Re-read bboxes after expansion: "+_res2)' +
              '}' +
              // Recalculate doc height after expansion (may have grown)
              'fullH=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);' +
              // Phase C: Expanded screenshot (all carousel content visible, bboxes aligned)
              '_prog("Capturing expanded screenshot...");' +
              'console.log("[iframe-ss] Capturing expanded screenshot at "+_sc+"x...");' +
              'ms.domToCanvas(document.documentElement,{scale:_sc,timeout:45000}).then(function(fc){' +
              'console.log("[iframe-ss] Expanded screenshot: "+fc.width+"x"+fc.height);' +
              'var fullUri;try{fullUri=fc.toDataURL("image/webp",' + ss.quality + ')}catch(e){console.warn("[milg-warn] WebP conversion failed:",e.message);fullUri=""}' +
              // Update send helper with actual canvas dimensions
              'var _cw=fc.width,_ch=fc.height;' +
              // Restore clean-screenshot bbox coordinates so updatedData matches the displayed image
              '_savedBboxes.forEach(function(s){var nb={left:s.left,top:s.top,width:s.width,height:s.height};if(s._rcid)nb._rcid=s._rcid;s.obj[s.key]=nb});' +
              'var _maskResults={};' + // Defined HERE so _sendFinal can access it (same scope)
              'function _sendFinal(maskUri){' +
                'var _raw=window.__milgData||null;' +
                // Build a lean updatedData with ONLY re-read bboxes (not full extraction + screenshots).
                'var updatedData=null;' +
                'if(_raw){updatedData={colors:{contrastPairs:_raw.colors?_raw.colors.contrastPairs:[]},typography:{fontSizes:_raw.typography?_raw.typography.fontSizes:[],headings:_raw.typography?_raw.typography.headings:[],maxLineLength:_raw.typography?_raw.typography.maxLineLength:null},interaction:{touchTargets:_raw.interaction?_raw.interaction.touchTargets:[]},layout:{offscreenElements:_raw.layout?_raw.layout.offscreenElements:[],hiddenPanelIssues:_raw.layout?_raw.layout.hiddenPanelIssues:[],alignmentElements:_raw.layout?_raw.layout.alignmentElements:[],borderRadii:_raw.layout?_raw.layout.borderRadii:[]}}}' +
                // Explicitly copy mask results onto updatedData pairs (don't rely on object identity)
                'if(updatedData&&updatedData.colors&&updatedData.colors.contrastPairs&&typeof _maskResults!=="undefined"){' +
                  'Object.keys(_maskResults).forEach(function(idx){' +
                    'var i=parseInt(idx,10);var mr=_maskResults[idx];' +
                    'if(updatedData.colors.contrastPairs[i]&&mr){' +
                      'updatedData.colors.contrastPairs[i]._maskBmp=mr.bmp;' +
                      'updatedData.colors.contrastPairs[i]._maskPacked=!!mr.packed;' +
                      'updatedData.colors.contrastPairs[i]._maskW=mr.w;' +
                      'updatedData.colors.contrastPairs[i]._maskH=mr.h;' +
                      'updatedData.colors.contrastPairs[i]._maskLayer=mr.layer;' +
                      'updatedData.colors.contrastPairs[i]._maskDark=mr.dark' +
                    '}' +
                  '})' +
                '}' +
                'var msg={type:"' + msgType + '",_iframeId:_mid,' +
                  'screenshots:fullUri?[fullUri]:[],' +
                  'screenshotFull:fullUri||null,' +
                  'screenshotClean:_cleanUri||null,' +
                  'textMask:maskUri||null,' +
                  'screenshotMeta:{scale:_sc,viewportHeight:vh,sectionCount:1,' +
                    'canvasWidth:_cw,canvasHeight:_ch,' +
                    'docHeightAtCapture:fullH,' +
                    'calibrationOffsetY:0,calibrationSamples:[]},' +
                  'screenshotCleanMeta:{canvasWidth:_cleanW,canvasHeight:_cleanH},' +
                  'regionScreenshots:window.__milgRegionScreenshots||[],' +
                  'updatedData:updatedData};' +
                'var _udPairs=updatedData&&updatedData.colors?updatedData.colors.contrastPairs||[]:[];' +
                'var _maskCount=_udPairs.filter(function(p){return !!p._maskBmp}).length;' +
                'var _rcidCount=_udPairs.filter(function(p){return !!p._regionContainerId}).length;' +
                'var _clipCount=_udPairs.filter(function(p){return !!p._isClipped}).length;' +
                'console.log("[D] iframe→parent pairs="+_udPairs.length+" rcid="+_rcidCount+" clipped="+_clipCount+" masks="+_maskCount);' +
                'try{parent.postMessage(msg,"*")}catch(e){' +
                  'console.warn("[milg-warn] postMessage failed ("+e.message+"), retrying without updatedData");' +
                  'msg.updatedData=null;' +
                  'try{parent.postMessage(msg,"*")}catch(e2){' +
                    'console.warn("[milg-warn] Retry failed, dropping screenshots");' +
                    'msg.screenshots=[];msg.screenshotFull=null;' +
                    'try{parent.postMessage(msg,"*")}catch(e3){}' +
                  '}' +
                '}' +
              '}' +
              // Wait for fonts, then inline them as @font-face data URIs before mask capture.
              // domToCanvas (SVG foreignObject) can't access fonts loaded via FontFace API —
              // it only sees fonts declared in stylesheets with accessible src URLs.
              '(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){' +
              // Count fonts available via @font-face CSS (the ones domToCanvas can use)
              'var _cssFontCount=0;try{Array.from(document.styleSheets).forEach(function(ss){try{Array.from(ss.cssRules).forEach(function(r){if(r instanceof CSSFontFaceRule)_cssFontCount++})}catch(e){}})}catch(e){}' +
              'console.log("[iframe-ss] Font prep: "+document.fonts.size+" API fonts, "+_cssFontCount+" CSS @font-face rules");' +
              // Step 2: Layered text masks with transition kill
              '_prog("Building text masks...");' +
              'console.log("[iframe-ss] Step 2: Layered masks (fonts: "+document.fonts.size+" loaded)...");' +
              // Phase A: Kill ALL transitions on every element BEFORE any color changes
              'document.querySelectorAll("*").forEach(function(el){el.style.setProperty("transition-duration","0s","important");el.style.setProperty("transition","none","important")});' +
              'void document.body.offsetHeight;' +
              // Phase A2: Neutralize absolute/fixed overlays that sit on top of text.
              // When bg becomes white, transparent gradient overlays become solid white,
              // covering the black text beneath. Fix: make overlay backgrounds fully
              // transparent BEFORE the mask, so they stay invisible after white override.
              // Also hide empty absolute elements entirely (decorative shapes/borders).
              'var _neutralized=0;' +
              'document.querySelectorAll("*").forEach(function(el){' +
                'var cs=getComputedStyle(el);' +
                'if(cs.position==="absolute"||cs.position==="fixed"){' +
                  'if(!el.textContent.trim()){' +
                    // No text: fully hide (gradient overlays, decorative shapes, spacers)
                    'el.style.setProperty("display","none","important");_neutralized++' +
                  '}else if(cs.pointerEvents==="none"){' +
                    // Has text but pointer-events:none — decorative text overlay, make bg transparent
                    'el.style.setProperty("background","transparent","important");' +
                    'el.style.setProperty("background-image","none","important");_neutralized++' +
                  '}' +
                '}' +
              '});' +
              'if(_neutralized)console.log("[iframe-ss] Neutralized "+_neutralized+" overlays");' +
              'void document.body.offsetHeight;' +
              // Re-read bboxes AFTER neutralization — hiding overlays can shift layout
              'if(_neutralized>0&&typeof window.__milgReReadBboxes==="function"){' +
                'var res2=window.__milgReReadBboxes();' +
                'console.log("[iframe-ss] Re-read bboxes post-neutralize: "+res2)' +
              '}' +
              // Phase B: Global mask style — white bg, white text, hide media
              'var _maskStyle=document.createElement("style");' +
              '_maskStyle.setAttribute("data-milg-mask","1");' +
              '_maskStyle.textContent="*,*::before,*::after{color:#fff !important;background-color:transparent !important;background-image:none !important;background:transparent !important;border-color:transparent !important;box-shadow:none !important;text-shadow:none !important;outline-color:transparent !important;-webkit-text-fill-color:#fff !important;opacity:1 !important;transition:none !important;animation:none !important;}html{background:#fff !important;}img,svg,video,canvas,picture,iframe{opacity:0 !important;}";' +
              'document.head.appendChild(_maskStyle);void document.body.offsetHeight;' +
              // Re-read bboxes AFTER mask style — white bg + hidden media can shift layout
              'if(typeof window.__milgReReadBboxes==="function"){' +
                'var res3=window.__milgReReadBboxes();' +
                'console.log("[iframe-ss] Re-read bboxes post-mask-style: "+res3)' +
              '}' +
              // Phase C: Collect pair elements and build overlap layers
              'var _refs=window.__milgBboxRefs||[];' +
              'var _pairs=(window.__milgData&&window.__milgData.colors&&window.__milgData.colors.contrastPairs)||[];' +
              'var _pairEls=[];' +
              '_refs.forEach(function(ref){' +
                'if(!ref.el||!ref.obj||ref.obj.ratio===undefined)return;' +
                'var idx=_pairs.indexOf(ref.obj);' +
                'if(idx>=0)_pairEls.push({el:ref.el,pair:ref.obj,idx:idx,bbox:ref.obj.bbox})' +
              '});' +
              'function _overlaps(a,b){' +
                'if(!a.bbox||!b.bbox)return false;' +
                'return a.bbox.left<b.bbox.left+b.bbox.width&&a.bbox.left+a.bbox.width>b.bbox.left&&' +
                       'a.bbox.top<b.bbox.top+b.bbox.height&&a.bbox.top+a.bbox.height>b.bbox.top}' +
              'var _layers=[];var _remaining=_pairEls.slice();' +
              'while(_remaining.length>0){' +
                'var layer=[];var next=[];' +
                '_remaining.forEach(function(pe){' +
                  'if(layer.some(function(l){return _overlaps(pe,l)})){next.push(pe)}else{layer.push(pe)}' +
                '});_layers.push(layer);_remaining=next}' +
              'console.log("[iframe-ss] "+_pairEls.length+" elements in "+_layers.length+" layers");' +
              // Phase C2: Bake text-transform into actual text content.
              // domToCanvas (modern-screenshot SVG foreignObject) doesn't always
              // preserve CSS text-transform, so uppercase/lowercase text renders wrong.
              // Fix: walk all text nodes and apply the transform to the actual content.
              'var _ttFixed=0;' +
              'document.querySelectorAll("*").forEach(function(el){' +
                'var tt=getComputedStyle(el).textTransform;' +
                'if(tt==="uppercase"||tt==="lowercase"||tt==="capitalize"){' +
                  'var walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null,false);' +
                  'var tn;while(tn=walker.nextNode()){' +
                    'var orig=tn.textContent;if(!orig.trim())continue;' +
                    'if(tt==="uppercase")tn.textContent=orig.toUpperCase();' +
                    'else if(tt==="lowercase")tn.textContent=orig.toLowerCase();' +
                    'else if(tt==="capitalize")tn.textContent=orig.replace(/\\b\\w/g,function(c){return c.toUpperCase()});' +
                    '_ttFixed++' +
                  '}' +
                '}' +
              '});' +
              'if(_ttFixed)console.log("[iframe-ss] Baked text-transform for "+_ttFixed+" text nodes");' +
              // _maskResults already declared in domToCanvas.then scope (shared with _sendFinal)
              // Phase D: Capture one mask per layer — set layer elements to black via inline style
              'var _li=0;' +
              'function _nextLayer(){' +
                'if(_li>=_layers.length){console.log("[iframe-ss] All "+_layers.length+" mask layers done");_sendFinal(null);return}' +
                'var layer=_layers[_li];_li++;' +
                '_prog("Text mask layer "+_li+"/"+_layers.length+"...");' +
                'console.log("[iframe-ss] Layer "+_li+": "+layer.length+" elements");' +
                // Set layer elements to black via INLINE style (transitions already killed)
                'layer.forEach(function(pe){' +
                  'pe.el.style.setProperty("color","#000","important");' +
                  'pe.el.style.setProperty("-webkit-text-fill-color","#000","important");' +
                  'pe.el.querySelectorAll("*").forEach(function(ch){' +
                    'ch.style.setProperty("color","#000","important");' +
                    'ch.style.setProperty("-webkit-text-fill-color","#000","important")})' +
                '});' +
                'void document.body.offsetHeight;' +
                'console.log("[iframe-ss] Layer "+_li+": starting domToCanvas...");' +
                // Race domToCanvas against our own 15s timeout (library timeout may not fire)
                'var _layerDone=false;' +
                'var _layerTimer=setTimeout(function(){if(!_layerDone){_layerDone=true;console.warn("[iframe-ss] Layer "+_li+" domToCanvas timed out (120s)");setTimeout(_nextLayer,0)}},120000);' +
                'ms.domToCanvas(document.documentElement,{scale:_sc,timeout:12000}).then(function(mc){' +
                  'if(_layerDone)return;_layerDone=true;clearTimeout(_layerTimer);' +
                  'console.log("[iframe-ss] Layer "+_li+" captured: "+mc.width+"x"+mc.height);' +
                  'var mCtx=mc.getContext("2d",{willReadFrequently:true});' +
                  'var _fillTextFallbacks=0;' +
                  'layer.forEach(function(pe){' +
                    'if(!pe.bbox)return;' +
                    'var bx=Math.max(0,Math.round(pe.bbox.left*_sc));' +
                    'var by=Math.max(0,Math.round(pe.bbox.top*_sc));' +
                    'var bw=Math.min(Math.round(pe.bbox.width*_sc),mc.width-bx);' +
                    'var bh=Math.min(Math.round(pe.bbox.height*_sc),mc.height-by);' +
                    'if(bw<2||bh<2)return;' +
                    'try{var px=mCtx.getImageData(bx,by,bw,bh).data;' +
                      'var bmp=new Uint8Array(bw*bh);' +
                      'for(var y=0;y<bh;y++){for(var x=0;x<bw;x++){' +
                        'var i=(y*bw+x)*4;' +
                        // Detect text: dark pixels on white background = text
                        'if((px[i]+px[i+1]+px[i+2])/3<240)bmp[y*bw+x]=1' +
                      '}}' +
                      'var _dk=0;for(var _b=0;_b<bmp.length;_b++)if(bmp[_b])_dk++;' +
                      // Fallback: if domToCanvas failed to render text, use canvas.fillText
                      'if(_dk===0&&bw>3&&pe.pair.text){' +
                        'try{var cs=getComputedStyle(pe.el);' +
                          'var _fc=document.createElement("canvas");_fc.width=bw;_fc.height=bh;' +
                          'var _fx=_fc.getContext("2d");_fx.fillStyle="#fff";_fx.fillRect(0,0,bw,bh);' +
                          'var _fs=parseFloat(cs.fontSize)*_sc;' +
                          '_fx.fillStyle="#000";' +
                          '_fx.font=cs.fontStyle+" "+cs.fontWeight+" "+_fs+"px "+cs.fontFamily;' +
                          '_fx.textBaseline="top";' +
                          // Account for padding and alignment within bbox
                          'var _pl=(parseFloat(cs.paddingLeft)||0)*_sc;' +
                          'var _pt=(parseFloat(cs.paddingTop)||0)*_sc;' +
                          'var _pr=(parseFloat(cs.paddingRight)||0)*_sc;' +
                          'var _ta=cs.textAlign;' +
                          // Render text — handle multi-line by splitting on natural wrapping
                          'var _txt=pe.pair.text.replace(/\\[placeholder\\] /,"");' +
                          'var _lh=parseFloat(cs.lineHeight)*_sc||_fs*1.2;' +
                          'var _contentW=bw-_pl-_pr;' +
                          'var _words=_txt.split(/\\s+/);var _lines=[];var _line="";' +
                          'for(var _w=0;_w<_words.length;_w++){' +
                            'var _test=_line?_line+" "+_words[_w]:_words[_w];' +
                            'if(_fx.measureText(_test).width>_contentW&&_line){' +
                              '_lines.push(_line);_line=_words[_w]' +
                            '}else{_line=_test}' +
                          '}_lines.push(_line);' +
                          // Calculate vertical offset — check flex centering on parent
                          'var _totalH=_lines.length*_lh;' +
                          'var _tyStart=_pt;' +
                          'var _par=pe.el.parentElement;var _pcs=_par?getComputedStyle(_par):null;' +
                          'if(_pcs){' +
                            'if(_pcs.display.indexOf("flex")>=0&&_pcs.alignItems==="center"){' +
                              '_tyStart=Math.max(0,(bh-_totalH)/2)' +
                            '}else if(bh>_totalH+_pt*2){' +
                              '_tyStart=_pt' +
                            '}' +
                          '}' +
                          // Draw each line with proper alignment
                          'for(var _li2=0;_li2<_lines.length;_li2++){' +
                            'var _lw=_fx.measureText(_lines[_li2]).width;' +
                            'var _tx=_pl;' +
                            'if(_ta==="center")_tx=(_contentW-_lw)/2+_pl;' +
                            'else if(_ta==="right"||_ta==="end")_tx=_contentW-_lw+_pl;' +
                            '_fx.fillText(_lines[_li2],_tx,_tyStart+_li2*_lh)' +
                          '};' +
                          // Re-read as bitmap
                          'var _fpx=_fx.getImageData(0,0,bw,bh).data;' +
                          'bmp=new Uint8Array(bw*bh);' +
                          'for(var _fy=0;_fy<bh;_fy++){for(var _fxx=0;_fxx<bw;_fxx++){' +
                            'var _fi=(_fy*bw+_fxx)*4;if((_fpx[_fi]+_fpx[_fi+1]+_fpx[_fi+2])/3<240)bmp[_fy*bw+_fxx]=1}}' +
                          '_dk=0;for(var _fb=0;_fb<bmp.length;_fb++)if(bmp[_fb])_dk++;' +
                          '_fillTextFallbacks++' +
                        '}catch(e){}' +
                      '}' +
                      // Bit-pack bitmap: 8 pixels per byte, then base64 encode (~8x smaller for postMessage)
                      'var _byteLen=Math.ceil(bmp.length/8);var _packed=new Uint8Array(_byteLen);' +
                      'for(var _bi=0;_bi<bmp.length;_bi++){if(bmp[_bi])_packed[_bi>>3]|=(1<<(_bi&7))}' +
                      'var _binStr="";for(var _bi2=0;_bi2<_packed.length;_bi2++)_binStr+=String.fromCharCode(_packed[_bi2]);' +
                      'var _b64=btoa(_binStr);' +
                      'pe.pair._maskBmp=_b64;pe.pair._maskPacked=true;pe.pair._maskW=bw;pe.pair._maskH=bh;pe.pair._maskLayer=_li;pe.pair._maskDark=_dk;' +
                      '_maskResults[pe.idx]={bmp:_b64,packed:true,w:bw,h:bh,layer:_li,dark:_dk}' +
                    '}catch(e){}' +
                  '});' +
                  'if(_fillTextFallbacks>0)console.log("[iframe-ss] Layer "+_li+": "+_fillTextFallbacks+" elements used fillText fallback mask");' +
                  // Reset layer elements to transparent (mask global style takes over)
                  'layer.forEach(function(pe){' +
                    'pe.el.style.removeProperty("color");' +
                    'pe.el.style.removeProperty("-webkit-text-fill-color");' +
                    'pe.el.querySelectorAll("*").forEach(function(ch){' +
                      'ch.style.removeProperty("color");' +
                      'ch.style.removeProperty("-webkit-text-fill-color")})' +
                  '});' +
                  'setTimeout(_nextLayer,0)' +
                '}).catch(function(e){if(_layerDone)return;_layerDone=true;clearTimeout(_layerTimer);console.warn("[iframe-ss] Layer "+_li+" failed:",e);setTimeout(_nextLayer,0)})' +
              '}' +
              'var _maskDone=false;' +
              'var _origSendFinal=_sendFinal;' +
              'var _maskTimer=setTimeout(function(){if(!_maskDone){_maskDone=true;console.warn("[iframe-ss] Masks timed out (360s)");_origSendFinal(null)}},360000);' +
              '_sendFinal=function(m){if(_maskDone)return;_maskDone=true;clearTimeout(_maskTimer);console.log("[iframe-ss] Sending results (maskResults: "+Object.keys(_maskResults).length+" pairs)");_origSendFinal(m)};' +
              '_nextLayer()' +
            '})' + // end document.fonts.ready.then
            '}).catch(function(e){console.warn("[iframe-ss] expanded capture failed:",e);parent.postMessage({type:"' + msgType + '",screenshots:[],_iframeId:_mid},"*")})' +
            '})' + // close _buildRegionScreenshots callback
            '}).catch(function(e){console.warn("[iframe-ss] clean capture failed:",e);parent.postMessage({type:"' + msgType + '",screenshots:[],_iframeId:_mid},"*")})' +
          '})})' + // close _preloadBgImages + _preloadImages callbacks
          '};' +
          's.onerror=function(){parent.postMessage({type:"' + msgType + '",screenshots:[],_iframeId:_mid},"*")};' +
          'document.head.appendChild(s)' +
        '},1500)' +
      '}' +
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
      var darkVariantTag = editorDark ? '<style type="text/tailwindcss">@custom-variant dark (&:where(.dark, .dark *));</style>' : '';
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
