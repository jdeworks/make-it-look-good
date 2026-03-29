// Scoring Module: Performance
// Weight: 5%

(function() {
  "use strict";
  var S = window.MilgScoring;

function scorePerformance(data) {
  var findings = [];
  var checks = 0;
  var passed = 0;
  var perf = data.performance || {};

  // Font loading
  var fontIssues = perf.fontLoading || [];
  if (fontIssues.length > 0) {
    checks++;
    findings.push({
      severity: 'warning',
      title: fontIssues.length + ' web font(s) without font-display: swap',
      detail: 'Fonts with display:auto or display:block cause invisible text (FOIT) while loading',
      fix: 'Add font-display: swap (or optional) to @font-face rules. This shows fallback text immediately.',
      presetRef: null,
      source: 'Web.dev — https://web.dev/articles/font-display'
    });
  } else {
    checks++;
    passed++;
  }

  // Render-blocking resources
  var rb = perf.renderBlocking || {};
  checks++;
  var blockingCount = (rb.cssInHead || 0) + (rb.jsInHead || 0);
  if (blockingCount <= 3) {
    passed++;
  } else {
    findings.push({
      severity: 'warning',
      title: blockingCount + ' render-blocking resources in <head>',
      detail: (rb.cssInHead || 0) + ' CSS files, ' + (rb.jsInHead || 0) + ' sync JS scripts',
      fix: 'Defer non-critical CSS with media="print" onload hack. Add async/defer to scripts.',
      presetRef: null,
      source: 'Web.dev — https://web.dev/articles/render-blocking-resources'
    });
  }

  // DOM complexity
  checks++;
  var domSize = perf.domSize || 0;
  if (domSize <= 1500) {
    passed++;
  } else {
    findings.push({
      severity: domSize > 3000 ? 'warning' : 'info',
      title: domSize + ' DOM elements (' + (domSize > 3000 ? 'excessive' : 'large') + ')',
      detail: 'Large DOMs slow rendering, increase memory, and hurt interaction responsiveness',
      fix: 'Consider lazy loading sections, virtualizing long lists, or simplifying markup.',
      presetRef: null,
      source: 'Chrome DevTools — https://developer.chrome.com/docs/lighthouse/performance/dom-size'
    });
  }

  // DOM depth
  checks++;
  var depth = perf.domDepth || 0;
  if (depth <= 32) {
    passed++;
  } else {
    findings.push({
      severity: 'info',
      title: 'DOM nesting depth: ' + depth + ' levels (recommended: ≤32)',
      detail: 'Deep nesting increases CSS selector matching time and layout complexity',
      fix: 'Flatten nested containers where possible. Avoid wrapping divs that serve no purpose.',
      presetRef: null,
      source: 'Chrome DevTools — https://developer.chrome.com/docs/lighthouse/performance/dom-size'
    });
  }

  // Third-party scripts
  if (data.performance && data.performance.thirdPartyScripts !== undefined) {
    checks++;
    var tpCount = data.performance.thirdPartyScripts;
    if (tpCount <= 5) {
      passed++;
    } else {
      findings.push({
        severity: tpCount > 10 ? 'warning' : 'info',
        title: tpCount + ' third-party scripts loaded',
        detail: 'Each third-party script adds latency, potential blocking, and privacy concerns',
        fix: 'Audit third-party scripts. Remove unused ones, defer non-critical ones, consider self-hosting critical libraries.',
        presetRef: null,
        source: 'Web Vitals — https://web.dev/articles/optimizing-third-party-javascript'
      });
    }
  }

  // Image format audit
  var imgFmt = (data.performance && data.performance.imageFormats) || {};
  if (imgFmt.legacy > 0) {
    checks++;
    if (imgFmt.modern >= imgFmt.legacy) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: imgFmt.legacy + ' image(s) use legacy formats (JPEG/PNG)',
        detail: imgFmt.modern + ' use modern formats (WebP/AVIF). Modern formats are 25-50% smaller.',
        fix: 'Convert images to WebP or AVIF. Use <picture> with format fallbacks for broad browser support.',
        presetRef: null,
        source: 'Web.dev — https://web.dev/articles/serve-images-webp'
      });
    }
  }

  // CLS (Cumulative Layout Shift)
  if (data.performance && data.performance.cls !== null && data.performance.cls !== undefined) {
    checks++;
    var cls = data.performance.cls;
    if (cls <= 0.1) {
      passed++;
    } else {
      findings.push({
        severity: cls > 0.25 ? 'error' : 'warning',
        title: 'CLS (Cumulative Layout Shift): ' + cls + ' (' + (cls > 0.25 ? 'poor' : 'needs improvement') + ')',
        detail: 'Layout shifts disrupt user reading and cause mis-clicks. Target: < 0.1.',
        fix: 'Add explicit width/height to images and ads. Use min-height on dynamic content areas. Avoid inserting content above existing content.',
        presetRef: null,
        source: 'Web Vitals — https://web.dev/articles/cls'
      });
    }
  }

  // LCP
  var lcp = data.performance && data.performance.lcp;
  if (lcp) {
    checks++;
    if (lcp.time <= 2500) {
      passed++;
    } else {
      findings.push({
        severity: lcp.time > 4000 ? 'error' : 'warning',
        title: 'LCP: ' + (lcp.time / 1000).toFixed(1) + 's (' + (lcp.time > 4000 ? 'poor' : 'needs improvement') + ')',
        detail: 'Largest element: <' + lcp.element + '>. Target: < 2.5s.',
        fix: 'Optimize the largest visible element. For images: preload, use WebP, set fetchpriority="high". For text: ensure fonts load with font-display:swap.',
        presetRef: null,
        source: 'Web Vitals — https://web.dev/articles/lcp'
      });
    }
  }

  // LCP lazy loading (heuristic)
  if (data.performance && data.performance.lcpLazyLoaded) {
    findings.push({
      severity: 'error',
      title: 'LCP image uses loading="lazy"',
      detail: 'Lazy loading the largest visible image delays LCP significantly',
      fix: 'Remove loading="lazy" from the hero/LCP image. Only lazy-load below-fold images.',
      presetRef: null,
      source: 'Web Vitals — https://web.dev/articles/lcp'
    });
  }

  // Non-responsive images
  var nri = (data.performance && data.performance.nonResponsiveImages) || 0;
  if (nri > 0) {
    findings.push({
      severity: 'warning',
      title: nri + ' image(s) without responsive sizing',
      detail: 'Images without max-width: 100% can overflow their containers on small screens',
      fix: 'Add max-width: 100% and height: auto to all images. In Tailwind: class="max-w-full h-auto".',
      presetRef: null,
      source: 'MDN — https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images'
    });
  }

  // Upscaled images
  var upscaled = (data.performance && data.performance.upscaledImages) || [];
  if (upscaled.length > 0) {
    var upDetails = upscaled.slice(0, 3).map(function(u) { return u.selector + ' ' + u.natural + ' → ' + u.rendered + ' (' + u.upscale + '%)'; });
    findings.push({
      severity: upscaled.some(function(u) { return u.upscale > 150; }) ? 'warning' : 'info',
      title: upscaled.length + ' image(s) rendered larger than natural size',
      detail: 'Images are upscaled, causing visible pixelation: ' + upDetails.join('; '),
      fix: 'Provide higher-resolution source images or use srcset for retina displays.',
      presetRef: null,
      source: 'MDN — https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images'
    });
  }

  // will-change overuse
  var willChange = (data.performance && data.performance.willChangeCount) || 0;
  if (willChange > 10) {
    findings.push({
      severity: 'warning',
      title: willChange + ' elements use will-change (recommend < 10)',
      detail: 'Excessive will-change creates GPU compositor layers, increasing memory usage.',
      fix: 'Remove will-change from elements that don\'t animate frequently. Apply only during animation, then remove.',
      presetRef: null,
      source: 'MDN — https://developer.mozilla.org/en-US/docs/Web/CSS/will-change'
    });
  } else if (willChange > 5) {
    findings.push({
      severity: 'info',
      title: willChange + ' elements use will-change',
      detail: 'Monitor GPU memory if adding more will-change hints.',
      fix: 'will-change is fine for elements that animate frequently. Avoid on static elements.',
      presetRef: null,
      source: 'MDN — https://developer.mozilla.org/en-US/docs/Web/CSS/will-change'
    });
  }

  // Non-passive scroll listeners
  var lStats = (data.interaction && data.interaction.listenerStats) || {};
  if (lStats.nonPassiveScroll > 0) {
    findings.push({
      severity: 'warning',
      title: lStats.nonPassiveScroll + ' non-passive scroll listener(s)',
      detail: 'Non-passive scroll listeners block smooth scrolling. The browser must wait for the handler to decide if it calls preventDefault().',
      fix: 'Add { passive: true } to scroll event listeners that don\'t call preventDefault().',
      presetRef: null,
      source: 'web.dev — https://web.dev/articles/passive-listeners'
    });
  }

  var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
  var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
  var score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
  return { score: score, findings: findings, checks: checks, passed: passed, weight: 5, label: 'Performance', icon: 'cognitive' };
}


  S.register("performance", scorePerformance, 5, "Performance", "cognitive");
})();
