// make-it-look-good — Iframe Analysis & Screenshot Pipeline
// Handles iframe creation, extraction injection, screenshot capture, and deep scan.
// Depends on: analyzer-extract.js (MilgExtract)

window.MilgIframe = (function() {
  "use strict";

  var _screenshotCDN = '';
  var _getViewport = function() { return { w: 1280, h: 900 }; };
  var _showProgress = function() {};
  // TODO: revert to 0.5 after pixel density testing
  var SCREENSHOT_SCALE = 0.75;
  var SCREENSHOT_QUALITY = 0.85;

  function init(opts) {
    if (opts.screenshotCDN) _screenshotCDN = opts.screenshotCDN;
    if (opts.getViewport) _getViewport = opts.getViewport;
    if (opts.showProgress) _showProgress = opts.showProgress;
  }

  // Inject a <base> tag so relative URLs (CSS, images, fonts) resolve to the original domain
  function injectBaseTag(html, url) {
    if (!url || url === 'Pasted HTML') return html;
    try {
      var base = new URL(url);
      var baseHref = base.origin + base.pathname.replace(/\/[^/]*$/, '/');
      var baseTag = '<base href="' + baseHref + '">';
      // Insert after <head> if present
      if (/<head[\s>]/i.test(html)) {
        return html.replace(/<head([^>]*)>/i, '<head$1>' + baseTag);
      }
      // Otherwise prepend
      return baseTag + html;
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
      'function _prog(l){try{parent.postMessage({type:"milg-progress",label:l},"*")}catch(e){}}' +
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
            'if(!ms||!ms.domToCanvas){parent.postMessage({type:"' + msgType + '",screenshots:[]},"*");return}' +
            'document.querySelectorAll("img").forEach(function(i){if(i.src&&i.src.indexOf("data:")!==0)i.crossOrigin="anonymous"});' +
            'var _sc=' + ss.scale + ';' +
            // Helper: send results to parent
            'function _send(fullUri,maskUri){' +
              'var updatedData=window.__milgData||null;' +
              'parent.postMessage({type:"' + msgType + '",' +
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
            'console.log("[iframe-ss] Step 1/2: Capturing screenshot...");' +
            'ms.domToCanvas(document.documentElement,{scale:_sc,timeout:15000}).then(function(fc){' +
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
                'var msg={type:"' + msgType + '",' +
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
              // Step 2: Layered text masks
              '_prog("Building text masks...");' +
              'console.log("[iframe-ss] Step 2: Layered masks...");' +
              // Phase A: NUKE all stylesheets to eliminate any CSS interference
              'var _removedSheets=[];' +
              'document.querySelectorAll("link[rel=stylesheet],style:not([data-milg-mask])").forEach(function(s){' +
                'if(!s.hasAttribute("data-milg-mask")){_removedSheets.push({el:s,parent:s.parentNode,next:s.nextSibling});s.parentNode.removeChild(s)}' +
              '});' +
              'console.log("[iframe-ss] Removed "+_removedSheets.length+" stylesheets");' +
              // Phase A2: Strip all class attributes and existing inline styles
              'document.querySelectorAll("*").forEach(function(el){' +
                'el.removeAttribute("class");' +
                'el.style.cssText=""' +
              '});' +
              'void document.body.offsetHeight;' +
              // Phase B: Add our own minimal mask style — white bg, hide media
              'var _maskStyle=document.createElement("style");' +
              '_maskStyle.setAttribute("data-milg-mask","1");' +
              '_maskStyle.textContent="*,*::before,*::after{color:#fff;background:#fff;background-image:none;border-color:transparent;box-shadow:none;text-shadow:none;outline:none;-webkit-text-fill-color:#fff;opacity:1;transition:none;animation:none;text-decoration:none;}img,svg,video,canvas,picture,iframe{opacity:0;}";' +
              'document.head.appendChild(_maskStyle);void document.body.offsetHeight;' +
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
              'var _maskResults={};' + // idx → {bmp, w, h, layer, dark}
              // Phase D: Capture one mask per layer — set layer elements to black via inline style
              'var _li=0;' +
              'function _nextLayer(){' +
                'if(_li>=_layers.length){console.log("[iframe-ss] All "+_layers.length+" mask layers done");_sendFinal(null);return}' +
                'var layer=_layers[_li];_li++;' +
                '_prog("Text mask layer "+_li+"/"+_layers.length+"...");' +
                'console.log("[iframe-ss] Layer "+_li+": "+layer.length+" elements");' +
                // Set layer elements to black (all stylesheets removed, no !important needed)
                'layer.forEach(function(pe){' +
                  'pe.el.style.color="#000";' +
                  'pe.el.style.webkitTextFillColor="#000";' +
                  'pe.el.querySelectorAll("*").forEach(function(ch){' +
                    'ch.style.color="#000";ch.style.webkitTextFillColor="#000"})' +
                '});' +
                'void document.body.offsetHeight;' +
                // DEBUG: Log computed style of first few elements to verify override took effect
                'layer.slice(0,5).forEach(function(pe){' +
                  'var cs=getComputedStyle(pe.el);' +
                  'console.log("[mask-dbg] \\""+pe.pair.text.substring(0,20)+"\\" computed: color="+cs.color+" fill="+cs.webkitTextFillColor+" tag="+pe.el.tagName+" cls="+(pe.el.getAttribute("class")||"none"))' +
                '});' +
                'console.log("[iframe-ss] Layer "+_li+": starting domToCanvas (capture 1)...");' +
                // Race domToCanvas against our own 15s timeout (library timeout may not fire)
                'var _layerDone=false;' +
                'var _layerTimer=setTimeout(function(){if(!_layerDone){_layerDone=true;console.warn("[iframe-ss] Layer "+_li+" domToCanvas timed out (15s)");setTimeout(_nextLayer,0)}},15000);' +
                'ms.domToCanvas(document.documentElement,{scale:_sc,timeout:12000}).then(function(mc){' +
                  'if(_layerDone)return;_layerDone=true;clearTimeout(_layerTimer);' +
                  'console.log("[iframe-ss] Layer "+_li+" capture 1: "+mc.width+"x"+mc.height);' +
                  'var mCtx=mc.getContext("2d",{willReadFrequently:true});' +
                  // For elements that show no dark pixels, log the center pixel from capture 1
                  'var _c1Fails=[];' +
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
                        'var i=(y*bw+x)*4;if((px[i]+px[i+1]+px[i+2])/3<240)bmp[y*bw+x]=1}}' +
                      'var _dk=0;for(var _b=0;_b<bmp.length;_b++)if(bmp[_b])_dk++;' +
                      'if(_dk===0&&bw>5){' +
                        'var _ci=(Math.floor(bh/2)*bw+Math.floor(bw/2))*4;' +
                        '_c1Fails.push({pe:pe,bx:bx,by:by,bw:bw,bh:bh,c1:"rgb("+px[_ci]+","+px[_ci+1]+","+px[_ci+2]+")"});' +
                        'console.log("[mask] C1 no dark: \\""+pe.pair.text.substring(0,25)+"\\" "+bw+"x"+bh+" center=rgb("+px[_ci]+","+px[_ci+1]+","+px[_ci+2]+")")' +
                      '}' +
                      'var _arr=Array.from(bmp);' +
                      'pe.pair._maskBmp=_arr;pe.pair._maskW=bw;pe.pair._maskH=bh;pe.pair._maskLayer=_li;pe.pair._maskDark=_dk;' +
                      '_maskResults[pe.idx]={bmp:_arr,w:bw,h:bh,layer:_li,dark:_dk}' +
                    '}catch(e){}' +
                  '});' +
                  // DEBUG: If any elements failed, wait 1s and capture again to check for animation drift
                  'if(_c1Fails.length>0){' +
                    'console.log("[mask-dbg] "+_c1Fails.length+" elements failed capture 1, re-checking computed styles...");' +
                    '_c1Fails.forEach(function(f){' +
                      'var cs=getComputedStyle(f.pe.el);' +
                      'console.log("[mask-dbg] \\""+f.pe.pair.text.substring(0,20)+"\\" computed: color="+cs.color+" fill="+cs.webkitTextFillColor+" display="+cs.display+" visibility="+cs.visibility+" opacity="+cs.opacity+" position="+cs.position+" tag="+f.pe.el.tagName)' +
                    '});' +
                    'console.log("[mask-dbg] Waiting 1s then capture 2...");' +
                    'setTimeout(function(){' +
                      'ms.domToCanvas(document.documentElement,{scale:_sc,timeout:12000}).then(function(mc2){' +
                        'console.log("[mask-dbg] Capture 2: "+mc2.width+"x"+mc2.height);' +
                        'var ctx2=mc2.getContext("2d",{willReadFrequently:true});' +
                        '_c1Fails.forEach(function(f){' +
                          'try{var px2=ctx2.getImageData(f.bx,f.by,f.bw,f.bh).data;' +
                            'var ci2=(Math.floor(f.bh/2)*f.bw+Math.floor(f.bw/2))*4;' +
                            'var c2="rgb("+px2[ci2]+","+px2[ci2+1]+","+px2[ci2+2]+")";' +
                            'var dk2=0;for(var b=0;b<f.bw*f.bh;b++){var ii=b*4;if((px2[ii]+px2[ii+1]+px2[ii+2])/3<240)dk2++}' +
                            'console.log("[mask-dbg] C2 \\""+f.pe.pair.text.substring(0,25)+"\\" center="+c2+" dark="+dk2+" (C1 was "+f.c1+")")' +
                          '}catch(e){console.warn("[mask-dbg] C2 read failed:",e)}' +
                        '});' +
                        // Reset and continue
                        'layer.forEach(function(pe){' +
                          'pe.el.style.color="#fff";pe.el.style.webkitTextFillColor="#fff";' +
                          'pe.el.querySelectorAll("*").forEach(function(ch){ch.style.color="#fff";ch.style.webkitTextFillColor="#fff"})' +
                        '});' +
                        'setTimeout(_nextLayer,0)' +
                      '}).catch(function(e){console.warn("[mask-dbg] C2 failed:",e);' +
                        'layer.forEach(function(pe){pe.el.style.color="#fff";pe.el.style.webkitTextFillColor="#fff";pe.el.querySelectorAll("*").forEach(function(ch){ch.style.color="#fff";ch.style.webkitTextFillColor="#fff"})});' +
                        'setTimeout(_nextLayer,0)})' +
                    '},1000)' +
                  '}else{' +
                    // No failures — reset and move on
                    'layer.forEach(function(pe){' +
                      'pe.el.style.color="#fff";pe.el.style.webkitTextFillColor="#fff";' +
                      'pe.el.querySelectorAll("*").forEach(function(ch){ch.style.color="#fff";ch.style.webkitTextFillColor="#fff"})' +
                    '});' +
                    'setTimeout(_nextLayer,0)' +
                  '}' +
                '}).catch(function(e){if(_layerDone)return;_layerDone=true;clearTimeout(_layerTimer);console.warn("[iframe-ss] Layer "+_li+" failed:",e);setTimeout(_nextLayer,0)})' +
              '}' +
              'var _maskDone=false;' +
              'var _origSendFinal=_sendFinal;' +
              'var _maskTimer=setTimeout(function(){if(!_maskDone){_maskDone=true;console.warn("[iframe-ss] Masks timed out (30s)");_origSendFinal(null)}},30000);' +
              '_sendFinal=function(m){if(_maskDone)return;_maskDone=true;clearTimeout(_maskTimer);console.log("[iframe-ss] Sending results (maskResults: "+Object.keys(_maskResults).length+" pairs)");_origSendFinal(m)};' +
              '_nextLayer()' +
            '}).catch(function(e){console.warn("[iframe-ss] capture failed:",e);parent.postMessage({type:"' + msgType + '",screenshots:[]},"*")})' +
          '};' +
          's.onerror=function(){parent.postMessage({type:"' + msgType + '",screenshots:[]},"*")};' +
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

  function analyzeHtmlInIframe(html, callback, sourceUrlOrDark, excludeSelectorOrEffectCSS, captureScreenshots) {
    var extractFromDocument = window.MilgExtract;
    // Support both signatures:
    // analyzeHtmlInIframe(html, cb, sourceUrl, excludeSelector, screenshots) — URL mode
    // analyzeHtmlInIframe(html, cb, dark, effectCSS, screenshots) — editor preview mode
    var sourceUrl = typeof sourceUrlOrDark === 'string' ? sourceUrlOrDark : null;
    var excludeSelector = typeof excludeSelectorOrEffectCSS === 'string' && !sourceUrl ? null : excludeSelectorOrEffectCSS;
    var editorDark = typeof sourceUrlOrDark === 'boolean' ? sourceUrlOrDark : false;
    var editorEffectCSS = (!sourceUrl && typeof excludeSelectorOrEffectCSS === 'string') ? excludeSelectorOrEffectCSS : '';
    var iframe = document.createElement('iframe');
    // Use viewport from selector or default
    var vp = _getViewport();
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
            console.log('[iframe] Applied mask results: ' + applied + '/' + Object.keys(mr).length + ' pairs');
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
    // Pass context to extraction
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
      'if(hidden.length===0){parent.postMessage({type:"milg-screenshots-unhidden",screenshots:[]},"*");return}' +
      'void document.body.offsetHeight;' +
      'setTimeout(function(){' +
        // Direct capture (iframe already resized from main screenshot pass)
        'var ms=window.modernScreenshot;' +
        'if(!ms||!ms.domToCanvas){parent.postMessage({type:"milg-screenshots-unhidden",screenshots:[]},"*");return}' +
        'ms.domToCanvas(document.documentElement,{scale:' + SCREENSHOT_SCALE + ',timeout:8000}).then(function(fc){' +
          'var uri;try{uri=fc.toDataURL("image/webp",' + SCREENSHOT_QUALITY + ')}catch(e){uri=""}' +
          'parent.postMessage({type:"milg-screenshots-unhidden",screenshots:uri?[uri]:[]},"*")' +
        '}).catch(function(){parent.postMessage({type:"milg-screenshots-unhidden",screenshots:[]},"*")})' +
      '},300)' +
    '};';
    var screenshotScript = captureScreenshots ? '<script>window.__milgDoScreenshots=function(){' + buildScreenshotScript('milg-screenshots-result') + '};' + unhiddenScreenshotFn + '</' + 'script>' : '';
    var srcdoc;
    if (isFullDoc) {
      // Wait for window load (CSS/fonts loaded), then extra delay for rendering
      // JS-enabled mode (URL patch present) needs longer delays for React/Vue hydration
      var hasJsPatch = html.indexOf('about:srcdoc') !== -1;
      var postLoadDelay = hasJsPatch ? 2000 : 1000;
      var fallbackDelay = hasJsPatch ? 8000 : 8000;
      var extractScript = excludeVar + fragmentVar + screenshotScript + '<script>window.addEventListener("load",function(){setTimeout(function(){(' + extractFromDocument.toString() + ')()},' + postLoadDelay + ')});setTimeout(function(){(' + extractFromDocument.toString() + ')()},' + fallbackDelay + ');</' + 'script>';
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
        html + excludeVar + fragmentVar + screenshotScript +
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
    }, captureScreenshots ? 70000 : (isFullDoc ? 15000 : 8000));
  }

  return {
    init: init,
    injectBaseTag: injectBaseTag,
    analyzeHtmlInIframe: analyzeHtmlInIframe,
    deepScanInIframe: deepScanInIframe,
    buildScreenshotScript: buildScreenshotScript
  };
})();
