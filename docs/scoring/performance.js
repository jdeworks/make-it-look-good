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
      presetRef: null
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
      presetRef: null
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
      presetRef: null
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
      presetRef: null
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

  var score = checks > 0 ? Math.round((passed / checks) * 100) : 100;
  return { score: score, findings: findings, weight: 5, label: 'Performance', icon: 'cognitive' };
}


  S.register("performance", scorePerformance, 5, "Performance", "cognitive");
})();
