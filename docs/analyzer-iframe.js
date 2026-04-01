// make-it-look-good — Iframe Analysis & Screenshot Pipeline
// Handles iframe creation, extraction injection, screenshot capture, and deep scan.
// Depends on: analyzer-extract.js (MilgExtract)

window.MilgIframe = (function() {
  "use strict";

  var _screenshotCDN = '';
  var _getViewport = function() { return { w: 1280, h: 900 }; };
  var SCREENSHOT_SCALE = 0.5;
  var SCREENSHOT_QUALITY = 0.8;

  function init(opts) {
    if (opts.screenshotCDN) _screenshotCDN = opts.screenshotCDN;
    if (opts.getViewport) _getViewport = opts.getViewport;
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
      // Unlock height to get true scrollHeight (sites with html,body{height:100%} clamp it)
      // Set overflow:auto explicitly so the inner document is scrollable for IntersectionObservers
      'document.documentElement.style.cssText+="height:auto !important;overflow-y:auto !important;";' +
      'document.body.style.cssText+="height:auto !important;";' +
      'void document.body.offsetHeight;' + // force reflow
      'var totalH=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);' +
      'var captureH=Math.min(totalH,vh*10);' +
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
        'console.log("[iframe-ss] Phase 2: Waiting for animations to finalize...");' +
        'setTimeout(function(){' +
          // Get body offset — bboxes are in document coords but canvas starts at body's top-left
          'var bodyRect=document.body.getBoundingClientRect();' +
          'var bodyOffX=Math.round(bodyRect.left+window.scrollX);' +
          'var bodyOffY=Math.round(bodyRect.top+window.scrollY);' +
          'console.log("[iframe-ss] Body offset: "+bodyOffX+","+bodyOffY);' +
          'if(typeof window.__milgReReadBboxes==="function"){' +
            'var res=window.__milgReReadBboxes();' +
            'console.log("[iframe-ss] Re-read bboxes: "+res)' +
          '}' +
          // Subtract body offset from all bboxes so they're body-relative (matching canvas origin)
          'if((bodyOffX!==0||bodyOffY!==0)&&window.__milgBboxRefs){' +
            'window.__milgBboxRefs.forEach(function(ref){' +
              'if(ref.obj&&ref.obj[ref.key]){ref.obj[ref.key].left-=bodyOffX;ref.obj[ref.key].top-=bodyOffY}' +
            '});' +
            'console.log("[iframe-ss] Shifted "+window.__milgBboxRefs.length+" bboxes by -"+bodyOffX+",-"+bodyOffY)' +
          '}' +
          'var fullH=document.body.scrollHeight;' +
          'console.log("[iframe-ss] body.scrollHeight="+fullH+" vh="+vh);' +
          'var s=document.createElement("script");' +
          's.src="' + _screenshotCDN + '";' +
          's.onload=function(){' +
            'var ms=window.modernScreenshot;' +
            'if(!ms||!ms.domToCanvas){parent.postMessage({type:"' + msgType + '",screenshots:[]},"*");return}' +
            'document.querySelectorAll("img").forEach(function(i){if(i.src&&i.src.indexOf("data:")!==0)i.crossOrigin="anonymous"});' +
            'ms.domToCanvas(document.body,{scale:' + ss.scale + ',timeout:12000}).then(function(fc){' +
              'console.log("[iframe-ss] Canvas: "+fc.width+"x"+fc.height);' +
              'var fullUri;try{fullUri=fc.toDataURL("image/webp",' + ss.quality + ')}catch(e){fullUri=""}' +
              'var updatedData=window.__milgData||null;' +
              'parent.postMessage({type:"' + msgType + '",' +
                'screenshots:fullUri?[fullUri]:[],' +
                'screenshotFull:fullUri||null,' +
                'screenshotMeta:{scale:' + ss.scale + ',viewportHeight:vh,sectionCount:1,' +
                  'canvasWidth:fc.width,canvasHeight:fc.height,' +
                  'docHeightAtCapture:fullH,' +
                  'bodyOffsetX:bodyOffX,bodyOffsetY:bodyOffY,' +
                  'calibrationOffsetY:0,calibrationSamples:[]},' +
                'updatedData:updatedData' +
              '},"*")' +
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
    }, captureScreenshots ? 25000 : (isFullDoc ? 15000 : 8000));
  }

  return {
    init: init,
    injectBaseTag: injectBaseTag,
    analyzeHtmlInIframe: analyzeHtmlInIframe,
    deepScanInIframe: deepScanInIframe,
    buildScreenshotScript: buildScreenshotScript
  };
})();
