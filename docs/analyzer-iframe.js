// make-it-look-good — Iframe Analysis & Screenshot Pipeline
// Handles iframe creation, extraction injection, screenshot capture, and deep scan.
// Depends on: analyzer-extract.js (MilgExtract)

window.MilgIframe = (function() {
  "use strict";

  var _screenshotCDN = '';
  var _getViewport = function() { return { w: 1280, h: 900 }; };
  var _getScreenshotSettings = function() { return { scale: 0.5, quality: 0.7 }; };

  function init(opts) {
    if (opts.screenshotCDN) _screenshotCDN = opts.screenshotCDN;
    if (opts.getViewport) _getViewport = opts.getViewport;
    if (opts.getScreenshotSettings) _getScreenshotSettings = opts.getScreenshotSettings;
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
  function buildScreenshotScript(msgType) {
    // Runs inside iframe. Loads modern-screenshot, captures page as viewport-height
    // sections as WebP. Scale and quality come from UI selector.
    // For srcdoc iframes (JS-enabled mode), images are cross-origin to the iframe's
    // origin, so we set crossOrigin="anonymous" on all images before capture.
    var ss = _getScreenshotSettings();
    return '(function(){' +
      'var s=document.createElement("script");' +
      's.src="' + _screenshotCDN + '";' +
      's.onload=function(){' +
        'var ms=window.modernScreenshot;' +
        'if(!ms||!ms.domToCanvas){parent.postMessage({type:"' + msgType + '",screenshots:[]},"*");return}' +
        // Mark all images as CORS-eligible so canvas isn't tainted in srcdoc iframes
        'document.querySelectorAll("img").forEach(function(i){if(i.src&&i.src.indexOf("data:")!==0)i.crossOrigin="anonymous"});' +
        'var totalH=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);' +
        'var vh=window.innerHeight||900;' +
        'var captureH=Math.min(totalH,vh*5);' + // max 5 viewports
        // Full page capture then split into sections
        'captureH=Math.min(captureH,vh*5);' +
        'ms.domToCanvas(document.documentElement,{scale:' + ss.scale + ',timeout:8000}).then(function(fc){' +
          'var sH=Math.round(vh*' + ss.scale + ');var shots=[];var si=0;var tot=Math.min(Math.ceil(fc.height/sH),5);' +
          'function sp(){' +
            'if(si>=tot){parent.postMessage({type:"' + msgType + '",screenshots:shots,screenshotMeta:{scale:' + ss.scale + ',viewportHeight:vh,sectionCount:tot,canvasWidth:fc.width,canvasHeight:fc.height}},"*");return}' +
            'var sy=si*sH;var sh=Math.min(sH,fc.height-sy);if(sh<=0){si++;sp();return}' +
            'var sc=document.createElement("canvas");sc.width=fc.width;sc.height=sh;' +
            'sc.getContext("2d").drawImage(fc,0,sy,fc.width,sh,0,0,fc.width,sh);' +
            'sc.toBlob(function(b){' +
              'if(!b){si++;sp();return}' +
              'var r=new FileReader();r.onloadend=function(){shots.push(r.result);si++;sp()};r.readAsDataURL(b)' +
            '},"image/webp",' + ss.quality + ')' +
          '}sp()' +
        '}).catch(function(){parent.postMessage({type:"' + msgType + '",screenshots:[]},"*")})' +
      '};' +
      's.onerror=function(){parent.postMessage({type:"' + msgType + '",screenshots:[]},"*")};' +
      'document.head.appendChild(s)' +
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
        // Screenshot capture auto-triggers inside the iframe after extraction
        // Store data, wait for screenshots
        iframe._milgData = data;
      }
      if (e.data.type === 'milg-screenshots-result' && iframe._milgData) {
        iframe._milgData.screenshots = e.data.screenshots || [];
        iframe._milgData.screenshotMeta = e.data.screenshotMeta || null;
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
      // Force reflow then capture
      'void document.body.offsetHeight;' +
      'setTimeout(function(){' + buildScreenshotScript('milg-screenshots-unhidden') +
      // Restore will happen after screenshots are taken — we don't need to restore in iframe since it's destroyed
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
