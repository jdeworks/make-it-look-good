// make-it-look-good — Iframe Analysis & Screenshot Pipeline
// Handles iframe creation, extraction injection, screenshot capture, and deep scan.
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

  // Inject a <base> tag so relative URLs (CSS, images, fonts) resolve to the original domain.
  // Also patches the URL constructor so page JS that does new URL(path, window.location)
  // works in srcdoc context (where window.location is about:srcdoc, not a valid base).
  function injectBaseTag(html, url) {
    if (!url || url === 'Pasted HTML') return html;
    try {
      var base = new URL(url);
      var baseHref = base.origin + base.pathname.replace(/\/[^/]*$/, '/');
      var baseTag = '<base href="' + baseHref + '">';
      // Patch URL constructor: in srcdoc iframes window.location.href is "about:srcdoc"
      // which is not a valid base URL. Intercept and use document.baseURI (set by <base>) instead.
      var urlPatch = '<script>' +
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
          // Preserve static methods (createObjectURL, revokeObjectURL, etc.)
          'Object.keys(_OrigURL).forEach(function(k){try{window.URL[k]=_OrigURL[k]}catch(e){}});' +
          'window.URL.toString=function(){return _OrigURL.toString()};' +
          // Also handle location.origin / location.protocol for libraries that read them directly
          'try{Object.defineProperty(_loc,"origin",{get:function(){' +
            'try{var u=new _OrigURL(document.baseURI);return u.origin}catch(e){return"null"}' +
          '},configurable:true})}catch(e){}' +
        '})();' +
      '</' + 'script>';
      // Font proxy: route font requests through CORS proxy (all iframe paths)
      var fontProxyScript = '';
      if (_proxyUrl) {
        fontProxyScript = '<script>(function(){' +
          'var _of=window.fetch;' +
          'var _px="' + _proxyUrl.replace(/"/g, '\\"') + '";' +
          'try{if(!parent.__milgFontCache)parent.__milgFontCache={}}catch(e){}' +
          'var _fc=((typeof parent!=="undefined")&&parent.__milgFontCache)||{};' +
          'window.fetch=function(u,o){' +
            'if(_px&&typeof u==="string"&&u.indexOf(_px)===-1&&/\\.(woff2?|ttf|otf|eot)(\\?|$)/i.test(u)){' +
              'if(_fc[u])return _fc[u].then(function(r){return r.clone()});' +
              'var p=_of.call(this,_px+"?url="+encodeURIComponent(u),o).catch(function(){return _of.call(this,u,o)});' +
              '_fc[u]=p;return p' +
            '}' +
            'return _of.call(this,u,o)' +
          '};' +
        '})();</' + 'script>';
        // After page loads, re-register failed CSS @font-face via proxy + FontFace API.
        // CSS @font-face doesn't use fetch(), so CORS blocks them even with our proxy.
        // This script scans stylesheets, finds font URLs, fetches through proxy, registers as blobs.
        fontProxyScript += '<script>(function(){' +
          'var _px="' + _proxyUrl.replace(/"/g, '\\"') + '";' +
          'if(!_px||typeof FontFace==="undefined")return;' +
          'function _fixFonts(){' +
            'var loaded={};' +
            'document.fonts.forEach(function(f){if(f.status==="loaded")loaded[f.family.replace(/["\x27]/g,"")]=true});' +
            'var toFix=[];' +
            'try{Array.from(document.styleSheets).forEach(function(ss){' +
              'try{Array.from(ss.cssRules).forEach(function(r){' +
                'if(!(r instanceof CSSFontFaceRule))return;' +
                'var fam=(r.style.fontFamily||"").replace(/["\x27]/g,"").trim();' +
                'if(!fam||loaded[fam])return;' +
                'var src=r.style.getPropertyValue("src")||"";' +
                'var m=src.match(/url\\(["\x27]?([^")\x27]+\\.woff2?)["\x27]?\\)/i);' +
                'if(m)toFix.push({family:fam,url:m[1],weight:r.style.fontWeight||"400",style:r.style.fontStyle||"normal"})' +
              '})}catch(e){}})}catch(e){}' +
            'if(toFix.length===0)return;' +
            'console.log("[milg-iframe] Fixing "+toFix.length+" CSS fonts via proxy");' +
            'toFix.forEach(function(f){' +
              'fetch(_px+"?url="+encodeURIComponent(f.url)).then(function(r){' +
                'if(!r.ok)return;return r.blob()' +
              '}).then(function(blob){' +
                'if(!blob)return;' +
                'var burl=URL.createObjectURL(blob);' +
                'var ff=new FontFace(f.family,"url("+burl+")",{weight:f.weight,style:f.style});' +
                'return ff.load().then(function(){document.fonts.add(ff)})' +
              '}).catch(function(){})' +
            '})' +
          '}' +
          'if(document.readyState==="complete")setTimeout(_fixFonts,500);' +
          'else window.addEventListener("load",function(){setTimeout(_fixFonts,500)})' +
        '})();</' + 'script>';
      }
      var combined = baseTag + urlPatch + fontProxyScript;
      // Insert after <head> if present
      if (/<head[\s>]/i.test(html)) {
        return html.replace(/<head([^>]*)>/i, '<head$1>' + combined);
      }
      // Otherwise prepend
      return combined + html;
    } catch(e) { return html; }
  }

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
        'if(_revealed>0)console.log("[iframe-ss] Force-revealed "+_revealed+" scroll-animated elements (IO disabled in offscreen iframes)");' +
        // Also inject a style to fast-forward any remaining CSS animations
        'var _ffStyle=document.createElement("style");' +
        '_ffStyle.textContent="*,*::before,*::after{animation-delay:0s !important;animation-duration:0.01s !important;}";' +
        'document.head.appendChild(_ffStyle);' +
        'void document.body.offsetHeight;' +
        // Switch to overflow:visible for capture
        'document.documentElement.style.cssText+="overflow:visible !important;";' +
        'document.body.style.cssText+="overflow:visible !important;";' +
        'void document.body.offsetHeight;' +
        '_prog("Waiting for animations to settle...");' +
        'console.log("[iframe-ss] Phase 2: Waiting for animations to finalize...");' +
        'setTimeout(function(){' +
          'if(typeof window.__milgReReadBboxes==="function"){' +
            'var res=window.__milgReReadBboxes();' +
            'console.log("[iframe-ss] Re-read bboxes: "+res)' +
          '}' +
          'var fullH=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);' +
          'console.log("[iframe-ss] scrollHeight="+fullH+" vh="+vh);' +
          'var s=document.createElement("script");' +
          's.src="' + _screenshotCDN + '";' +
          's.onload=function(){' +
            'var ms=window.modernScreenshot;' +
            'if(!ms||!ms.domToCanvas){parent.postMessage({type:"' + msgType + '",screenshots:[],_iframeId:_mid},"*");return}' +
            'document.querySelectorAll("img").forEach(function(i){if(i.src&&i.src.indexOf("data:")!==0)i.crossOrigin="anonymous"});' +
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
            // Step 1: Capture real screenshot FIRST (safe — no DOM modifications)
            '_prog("Capturing screenshot...");' +
            'console.log("[iframe-ss] Step 1/2: Capturing screenshot at "+_sc+"x...");' +
            'ms.domToCanvas(document.documentElement,{scale:_sc,timeout:45000}).then(function(fc){' +
              'console.log("[iframe-ss] Screenshot: "+fc.width+"x"+fc.height);' +
              'var fullUri;try{fullUri=fc.toDataURL("image/webp",' + ss.quality + ')}catch(e){fullUri=""}' +
              // Update send helper with actual canvas dimensions
              'var _cw=fc.width,_ch=fc.height;' +
              'function _sendFinal(maskUri){' +
                'var updatedData=window.__milgData||null;' +
                // Strip mask bitmap data from pair objects to keep updatedData lean
                // (masks are sent separately via maskResults)
                'if(updatedData&&updatedData.colors&&updatedData.colors.contrastPairs){' +
                  'updatedData.colors.contrastPairs.forEach(function(p){delete p._maskBmp;delete p._maskPts})}' +
                'var mr=typeof _maskResults!=="undefined"?_maskResults:null;' +
                'var msg={type:"' + msgType + '",_iframeId:_mid,' +
                  'screenshots:fullUri?[fullUri]:[],' +
                  'screenshotFull:fullUri||null,' +
                  'textMask:maskUri||null,' +
                  'screenshotMeta:{scale:_sc,viewportHeight:vh,sectionCount:1,' +
                    'canvasWidth:_cw,canvasHeight:_ch,' +
                    'docHeightAtCapture:fullH,' +
                    'calibrationOffsetY:0,calibrationSamples:[]},' +
                  'updatedData:updatedData,' +
                  'maskResults:mr};' +
                'try{parent.postMessage(msg,"*")}catch(e){' +
                  'console.warn("[iframe-ss] postMessage failed ("+e.message+"), retrying without masks");' +
                  'msg.maskResults=null;msg.updatedData=null;' +
                  'try{parent.postMessage(msg,"*")}catch(e2){console.error("[iframe-ss] postMessage retry failed:",e2)}' +
                '}' +
              '}' +
              // Wait for fonts to be fully loaded before mask capture (avoids fallback font mismatch)
              '(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){' +
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
              'var _maskResults={};' + // idx → {bmp, w, h, layer, dark}
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
                      'var _arr=Array.from(bmp);' +
                      'pe.pair._maskBmp=_arr;pe.pair._maskW=bw;pe.pair._maskH=bh;pe.pair._maskLayer=_li;pe.pair._maskDark=_dk;' +
                      '_maskResults[pe.idx]={bmp:_arr,w:bw,h:bh,layer:_li,dark:_dk}' +
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
            '}).catch(function(e){console.warn("[iframe-ss] capture failed:",e);parent.postMessage({type:"' + msgType + '",screenshots:[],_iframeId:_mid},"*")})' +
          '};' +
          's.onerror=function(){parent.postMessage({type:"' + msgType + '",screenshots:[],_iframeId:_mid},"*")};' +
          'document.head.appendChild(s)' +
        '},1500)' +
      '}' +
    '})()';
  }

  function deepScanInIframe(html, url, exclude, vpWidth, vpHeight, callback) {
    var extractFromDocument = window.MilgExtract;
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + vpWidth + 'px;height:' + vpHeight + 'px;border:none;';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    document.body.appendChild(iframe);

    var msgType = 'milg-deep-' + vpWidth;
    var handled = false;
    function onResult(e) {
      if (!e.data || e.data.type !== msgType) return;
      if (handled) return;
      handled = true;
      window.removeEventListener('message', onResult);
      if (iframe.parentNode) document.body.removeChild(iframe);
      callback(e.data.data);
    }
    window.addEventListener('message', onResult);

    var processed = url ? injectBaseTag(html, url) : html;
    var excludeVar = exclude ? '<script>window.__milgExclude=' + JSON.stringify(exclude) + ';</' + 'script>' : '';
    var isFullDoc = /<html[\s>]/i.test(processed) || /<!DOCTYPE/i.test(processed);

    var extractStr = extractFromDocument.toString().replace(/milg-analyzer-result/g, msgType);
    // Auto-scroll inside iframe to trigger intersection observers before extracting
    var scrollScript = 'window.scrollTo(0,document.body.scrollHeight);setTimeout(function(){window.scrollTo(0,0)},300);';
    var extractScript = excludeVar + '<script>window.addEventListener("load",function(){' + scrollScript + 'setTimeout(function(){(' + extractStr + ')()},1500)});setTimeout(function(){(' + extractStr + ')()},8000);</' + 'script>';

    var srcdoc;
    if (isFullDoc) {
      if (/<\/body>/i.test(processed)) {
        srcdoc = processed.replace(/<\/body>/i, extractScript + '</body>');
      } else {
        srcdoc = processed + extractScript;
      }
    } else {
      srcdoc = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></' + 'script><style>body{margin:0}</style></head><body>' + processed + extractScript + '</body></html>';
    }
    iframe.srcdoc = srcdoc;

    setTimeout(function() {
      if (handled) return;
      handled = true;
      window.removeEventListener('message', onResult);
      if (iframe.parentNode) document.body.removeChild(iframe);
      callback(null);
    }, 15000);
  }

  function analyzeHtmlInIframe(html, callback, sourceUrlOrDark, excludeSelectorOrEffectCSS, captureScreenshots, viewportOverride) {
    var extractFromDocument = window.MilgExtract;
    // Support both signatures:
    // analyzeHtmlInIframe(html, cb, sourceUrl, excludeSelector, screenshots) — URL mode
    // analyzeHtmlInIframe(html, cb, dark, effectCSS, screenshots) — editor preview mode
    // Optional 6th param: { w, h } viewport override for deep scan
    var sourceUrl = typeof sourceUrlOrDark === 'string' ? sourceUrlOrDark : null;
    var excludeSelector = typeof excludeSelectorOrEffectCSS === 'string' && !sourceUrl ? null : excludeSelectorOrEffectCSS;
    var editorDark = typeof sourceUrlOrDark === 'boolean' ? sourceUrlOrDark : false;
    var editorEffectCSS = (!sourceUrl && typeof excludeSelectorOrEffectCSS === 'string') ? excludeSelectorOrEffectCSS : '';
    var iframe = document.createElement('iframe');
    // Unique ID for this iframe — used to match postMessage responses in parallel mode
    var _iframeId = 'milg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
    // Use viewport override if provided, else from selector/default
    var vp = viewportOverride || _getViewport();
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + vp.w + 'px;height:' + vp.h + 'px;border:none;';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    document.body.appendChild(iframe);

    var handled = false;
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
        iframe._milgData.textMask = e.data.textMask || null;
        iframe._milgData.screenshotMeta = e.data.screenshotMeta || null;
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
          }
        }
        // Apply mask results from separate channel (survives postMessage reliably)
        if (e.data.maskResults) {
          var mr = e.data.maskResults;
          var cp = iframe._milgData.colors && iframe._milgData.colors.contrastPairs;
          if (cp) {
            var applied = 0;
            Object.keys(mr).forEach(function(idx) {
              var i = parseInt(idx, 10);
              if (cp[i]) {
                cp[i]._maskBmp = mr[idx].bmp;
                cp[i]._maskW = mr[idx].w;
                cp[i]._maskH = mr[idx].h;
                cp[i]._maskLayer = mr[idx].layer;
                cp[i]._maskDark = mr[idx].dark;
                applied++;
              }
            });
            // mask results applied
          }
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
    // Inject <base> tag so relative CSS/image/font URLs resolve to the original domain
    if (sourceUrl) html = injectBaseTag(html, sourceUrl);
    // Pass context to extraction — include iframe ID for message matching in parallel mode
    var idVar = '<script>window.__milgIframeId="' + _iframeId + '";</' + 'script>';
    var excludeVar = excludeSelector ? '<script>window.__milgExclude=' + JSON.stringify(excludeSelector) + ';</' + 'script>' : '';
    var fragmentVar = !isFullDoc ? '<script>window.__milgIsFragment=true;</' + 'script>' : '';
    // Screenshot capture: script that auto-runs after extraction, loads CDN library, captures page
    // Also includes unhidden-panels screenshot if hidden panels are detected
    var unhiddenScreenshotFn = 'window.__milgDoUnhiddenScreenshots=function(){' +
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
    if (isFullDoc) {
      // Wait for window load (CSS/fonts loaded), then extra delay for rendering
      // JS-enabled mode (URL patch present) needs longer delays for React/Vue hydration
      var hasJsPatch = html.indexOf('__milgSandboxLog') !== -1;
      var postLoadDelay = hasJsPatch ? 2000 : 1000;
      var fallbackDelay = hasJsPatch ? 8000 : 8000;
      var extractScript = idVar + excludeVar + fragmentVar + screenshotScript + '<script>window.addEventListener("load",function(){setTimeout(function(){(' + extractFromDocument.toString() + ')()},' + postLoadDelay + ')});setTimeout(function(){(' + extractFromDocument.toString() + ')()},' + fallbackDelay + ');</' + 'script>';
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
        '<script>setTimeout(function(){(' + extractFromDocument.toString() + ')()}, 1500);</' + 'script>' +
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
    injectBaseTag: injectBaseTag,
    analyzeHtmlInIframe: analyzeHtmlInIframe,
    deepScanInIframe: deepScanInIframe,
    buildScreenshotScript: buildScreenshotScript
  };
})();
