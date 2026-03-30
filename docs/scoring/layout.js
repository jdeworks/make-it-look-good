// Scoring Module: Layout Quality
// Weight: 5%

(function() {
  "use strict";
  var S = window.MilgScoring;

function scoreLayout(data) {
  var findings = [];
  var checks = 0;
  var passed = 0;
  var layout = data.layout || {};

  // Whitespace rhythm: check if section gaps are consistent
  var gaps = layout.sectionGaps || [];
  if (gaps.length >= 2) {
    checks++;
    var avg = gaps.reduce(function(s, g) { return s + g; }, 0) / gaps.length;
    var variance = gaps.reduce(function(s, g) { return s + Math.pow(g - avg, 2); }, 0) / gaps.length;
    var stdDev = Math.sqrt(variance);
    var cv = avg > 0 ? stdDev / avg : 0; // coefficient of variation
    if (cv < 0.3) {
      passed++;
    } else {
      findings.push({
        severity: cv > 0.6 ? 'warning' : 'info',
        title: 'Inconsistent spacing between sections (CV: ' + Math.round(cv * 100) + '%)',
        detail: 'Gaps range from ' + Math.min.apply(null, gaps) + 'px to ' + Math.max.apply(null, gaps) + 'px (avg ' + Math.round(avg) + 'px)',
        fix: 'Use consistent spacing between major sections. Pick one value (e.g. 64px or 96px) and use it everywhere.',
        presetRef: null,
        source: 'Gestalt similarity — https://lawsofux.com/law-of-similarity/'
      });
    }
  }

  // Alignment consistency: cluster left edges and find near-misses ("jagged" alignment)
  var edges = layout.alignmentEdges || [];
  if (edges.length >= 5) {
    checks++;
    // Cluster edges within 3px (considered aligned)
    var clusters = [];
    var sorted = edges.slice().sort(function(a, b) { return a - b; });
    var current = [sorted[0]];
    for (var i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] <= 3) {
        current.push(sorted[i]);
      } else {
        clusters.push(current);
        current = [sorted[i]];
      }
    }
    clusters.push(current);
    // Find near-miss clusters (4-12px apart — elements on same axis but jagged)
    var nearMisses = 0;
    var jaggedExamples = [];
    var edgeDetails = layout.alignmentEdgeDetails || [];
    for (var i = 1; i < clusters.length; i++) {
      var prevAvg = Math.round(clusters[i - 1].reduce(function(s,v){return s+v},0) / clusters[i - 1].length);
      var currAvg = Math.round(clusters[i].reduce(function(s,v){return s+v},0) / clusters[i].length);
      var gap = currAvg - prevAvg;
      if (gap > 3 && gap <= 12) {
        nearMisses++;
        // Find example elements at each edge for actionable detail
        var prevEl = edgeDetails.find(function(d) { return Math.abs(d.left - prevAvg) <= 3; });
        var currEl = edgeDetails.find(function(d) { return Math.abs(d.left - currAvg) <= 3; });
        var example = prevAvg + 'px → ' + currAvg + 'px (' + gap + 'px off)';
        if (prevEl && currEl) {
          example += ': ' + prevEl.tag + ' "' + (prevEl.text || '').substring(0, 20) + '" vs ' + currEl.tag + ' "' + (currEl.text || '').substring(0, 20) + '"';
        }
        jaggedExamples.push(example);
      }
    }
    // Also check how many unique clusters there are relative to element count
    var clusterRatio = clusters.length / edges.length;
    if (nearMisses === 0 && clusterRatio < 0.5) {
      passed++;
    } else if (nearMisses > 0) {
      findings.push({
        severity: nearMisses >= 3 ? 'warning' : 'info',
        title: nearMisses + ' jagged alignment(s) — elements on same axis but ' + (nearMisses >= 3 ? 'noticeably' : 'slightly') + ' off',
        detail: clusters.length + ' alignment edges across ' + edges.length + ' elements. ' + (jaggedExamples.length > 0 ? 'Offsets: ' + jaggedExamples.slice(0, 3).join(', ') : ''),
        fix: 'Elements that share a visual axis should be exactly aligned. Check that container padding, margin, and grid column widths are consistent. In Tailwind: use consistent px-4/px-6 and grid/flex alignment.',
        presetRef: null,
        source: 'Gestalt continuity — https://lawsofux.com/law-of-common-region/'
      });
    } else if (clusterRatio >= 0.5) {
      findings.push({
        severity: 'info',
        title: 'Weak alignment grid — ' + clusters.length + ' distinct left edges across ' + edges.length + ' elements',
        detail: 'A well-aligned layout typically has 2-4 dominant alignment edges. High variance suggests inconsistent margins/padding.',
        fix: 'Establish a consistent alignment grid. Use the same container padding and let content flow within columns.',
        presetRef: null,
        source: 'Gestalt continuity — https://lawsofux.com/law-of-common-region/'
      });
    }
  }

  // Visual hierarchy: heading-to-body ratios
  var vh = layout.visualHierarchy || {};
  if (vh.h1ToBody > 0) {
    checks++;
    if (vh.h1ToBody >= 2 && vh.h1ToBody <= 4) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: 'H1 is ' + vh.h1ToBody + 'x body text (ideal: 2-4x)',
        detail: vh.h1ToBody < 2 ? 'H1 doesn\'t stand out enough from body text' : 'H1 may be too large relative to body text',
        fix: 'H1 should be 2-4x the body font size for clear hierarchy. At 16px body, H1 should be 32-64px.',
        presetRef: null,
        source: 'Modular type scales — https://typescale.com/'
      });
    }
  }

  // H2-to-body ratio (secondary hierarchy)
  if (vh.h2ToBody > 0) {
    checks++;
    if (vh.h2ToBody >= 1.3 && vh.h2ToBody <= 2.5) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: 'H2 is ' + vh.h2ToBody + 'x body text (ideal: 1.3-2.5x)',
        detail: vh.h2ToBody < 1.3 ? 'H2 is too close to body text size — weak sub-section hierarchy' : 'H2 may be too large, competing with H1',
        fix: 'H2 should be clearly smaller than H1 but distinct from body. At 16px body, H2 should be 20-40px.',
        presetRef: null,
        source: 'Modular type scales — https://typescale.com/'
      });
    }
  }

  // Border radius consistency (moved from consistency to layout)
  // Exclude pill/circle values (9999px, 50%, or anything > 100px) — these are intentional full-round shapes, not part of the design scale
  var radii = (layout.borderRadii || []).filter(function(r) {
    var v = r.value;
    if (v === '50%' || v === '9999px') return false;
    var px = parseFloat(v);
    return !(px > 100);
  });
  if (radii.length > 0) {
    checks++;
    if (radii.length <= 4) {
      passed++;
    } else {
      findings.push({
        severity: 'info',
        title: radii.length + ' distinct border-radius values (recommend 2-4, excluding pill/circle shapes)',
        detail: 'Values: ' + radii.slice(0, 6).map(function(r) { return r.value + ' (' + r.count + 'x)'; }).join(', '),
        fix: 'Standardize border-radius to 2-4 values. In Tailwind: rounded-sm, rounded, rounded-lg, rounded-xl.',
        presetRef: null,
        source: 'Material Design 3 — https://m3.material.io/styles/shape/overview'
      });
    }
  }

  // Content-to-whitespace balance (if we have element count and viewport)
  if (data.structure && data.structure.totalElements > 10) {
    var elCount = data.structure.totalElements;
    checks++;
    // Very sparse or very dense pages
    if (elCount > 3000) {
      findings.push({
        severity: 'info',
        title: 'Dense page (' + elCount + ' elements) — may feel cluttered',
        detail: 'High element density can overwhelm users. Consider progressive disclosure.',
        fix: 'Break content into sections, use collapsible panels, or paginate.',
        presetRef: null,
        source: 'NNGroup — https://www.nngroup.com/articles/how-users-read-on-the-web/'
      });
    } else {
      passed++;
    }
  }

  // Off-screen elements: visible elements positioned outside viewport (x-axis)
  var offscreen = layout.offscreenElements || [];
  if (offscreen.length > 0) {
    checks++;
    var offDetails = offscreen.slice(0, 5).map(function(e) {
      var label = e.element;
      if (e.text) label += ' ("' + e.text.substring(0, 25) + (e.text.length > 25 ? '…' : '') + '")';
      return label + ' at x=' + e.left + 'px';
    });
    findings.push({
      severity: offscreen.length > 3 ? 'error' : 'warning',
      title: offscreen.length + ' element(s) positioned outside viewport',
      detail: offDetails.join('; '),
      fix: 'Check absolute/fixed positioning. On mobile, dropdown menus with right-0 may overflow left. Use left-0 sm:right-0 or max-w-[calc(100vw-2rem)]. For elements extending right, check fixed widths wider than viewport.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow',
      locator: { selector: offscreen[0] ? offscreen[0].selector : '', text: offscreen[0] ? (offscreen[0].text || '') : '' }
    });
  } else {
    checks++;
    passed++;
  }

  // Horizontal scroll on containers — use refined classification
  var hScrollContainers = layout.horizontalScrollContainers || [];
  var bugScrollContainers = hScrollContainers.filter(function(c) { return c.classification === 'bug' || !c.intentional; });
  if (bugScrollContainers.length > 0 || data.structure.hasHorizontalOverflow) {
    checks++;
    var scrollDetails = bugScrollContainers.slice(0, 3).map(function(c) {
      var reasonLabel = c.reason === 'structural-children-in-scroll' ? ' (structural content in scroll container)'
        : c.reason === 'wide-container-scrolls' ? ' (wide container should fill viewport)'
        : c.reason === 'no-overflow-css' ? ' (no overflow CSS — content spills)'
        : '';
      return c.selector + ' overflows by ' + c.overflow + 'px' + reasonLabel;
    });
    if (data.structure.hasHorizontalOverflow) scrollDetails.unshift('Page body has horizontal scroll');
    findings.push({
      severity: 'error',
      title: (data.structure.hasHorizontalOverflow ? 'Page has horizontal scroll' : bugScrollContainers.length + ' container(s) overflow horizontally'),
      detail: scrollDetails.join('; '),
      fix: 'Fix horizontal overflow: add overflow-x-hidden on the outer wrapper, check for elements with fixed widths wider than viewport, or add max-w-full. Common causes: fixed-width tables, absolute positioned elements, images without max-width. If a wide container has overflow-x-auto but contains page sections (nav, forms, headings), remove the overflow and fix the root cause.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow',
      locator: { selector: bugScrollContainers[0] ? bugScrollContainers[0].selector : '', text: '' }
    });
  } else {
    checks++;
    passed++;
  }

  // Nested scrollbars (scroll within scroll — bad UX)
  var nestedScrollbars = layout.nestedScrollbars || 0;
  if (nestedScrollbars > 0) {
    checks++;
    findings.push({
      severity: nestedScrollbars > 2 ? 'error' : 'warning',
      title: nestedScrollbars + ' nested scrollbar(s) detected (scroll within scroll)',
      detail: 'Scrollable elements inside other scrollable elements confuse users — they don\'t know which container will scroll.',
      fix: 'Avoid nested scrollbars. Give inner containers enough height to show content, or use pagination/collapsible sections instead of scroll. If a table must scroll horizontally, ensure the outer container does not also scroll.',
      presetRef: null,
      source: 'NNGroup — https://www.nngroup.com/articles/scrolling-and-scrollbars/'
    });
  }

  // Hidden panel overflow issues (menus, dialogs revealed by hybrid unhide)
  var hiddenPanelIssues = layout.hiddenPanelIssues || [];
  if (hiddenPanelIssues.length > 0) {
    checks++;
    var panelDetails = hiddenPanelIssues.slice(0, 3).map(function(p) {
      var issueTypes = p.issues.map(function(i) {
        return i.type === 'right-overflow' ? 'overflows right by ' + i.overflow + 'px'
          : i.type === 'left-overflow' ? 'overflows left by ' + i.overflow + 'px'
          : i.type === 'internal-overflow' ? 'content overflows internally by ' + i.overflow + 'px'
          : i.type;
      });
      return p.selector + ' (' + p.role + '): ' + issueTypes.join(', ');
    });
    findings.push({
      severity: hiddenPanelIssues.length > 2 ? 'error' : 'warning',
      title: hiddenPanelIssues.length + ' hidden panel(s) overflow when revealed (menus/dialogs)',
      detail: 'These panels are hidden at load time but overflow the viewport when opened: ' + panelDetails.join('; '),
      fix: 'Dropdown menus and dialogs must fit within the viewport when revealed. Use max-w-[calc(100vw-1rem)], or position with left-0 instead of right-0 on narrow viewports. For dialogs: add max-h-[90vh] overflow-y-auto.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow',
      locator: { selector: hiddenPanelIssues[0] ? hiddenPanelIssues[0].selector : '', text: '' }
    });
  } else if (layout.hiddenPanelCount > 0) {
    checks++;
    passed++;
  }

  // Button/CTA hierarchy
  var btnH = layout.buttonHierarchy || {};
  if (btnH.total > 3 && btnH.filled > 0 && btnH.outline === 0 && btnH.text === 0) {
    findings.push({
      severity: 'info',
      title: 'All ' + btnH.total + ' buttons use the same filled style — no visual hierarchy',
      detail: 'Without primary/secondary/tertiary button styles, users can\'t distinguish the main action.',
      fix: 'Designate one primary CTA (filled) and style others as secondary (outline) or tertiary (text-only).',
      presetRef: 'All presets use primary + secondary button styles',
      source: 'Material Design 3 — https://m3.material.io/components/buttons/overview'
    });
  }

  // Fixed elements consuming viewport
  var fixedVp = layout.fixedViewportConsumption || 0;
  if (fixedVp > 30) {
    findings.push({
      severity: 'warning',
      title: 'Fixed elements consume ' + fixedVp + '% of viewport height',
      detail: 'Sticky headers, footers, and toolbars take up more than 30% of the screen, leaving little room for content.',
      fix: 'Collapse fixed elements on scroll, or reduce their height. Consider hiding the header on scroll-down, showing on scroll-up.',
      presetRef: null,
      source: 'NNGroup — https://www.nngroup.com/articles/sticky-headers/'
    });
  } else if (fixedVp > 20) {
    findings.push({
      severity: 'info',
      title: 'Fixed elements consume ' + fixedVp + '% of viewport height',
      detail: 'Fixed elements take significant viewport space. Monitor on smaller screens.',
      fix: 'Consider collapsing or reducing fixed element height on mobile.',
      presetRef: null,
      source: 'NNGroup — https://www.nngroup.com/articles/sticky-headers/'
    });
  }

  // Text overlap — fixed/sticky elements without opaque background overlapping text below
  var textOverlaps = layout.textOverlaps || [];
  if (textOverlaps.length > 0) {
    checks++;
    var overlapDetails = textOverlaps.slice(0, 3).map(function(o) {
      return o.fixed + ' ("' + o.fixedText.substring(0, 20) + '") overlaps ' + o.under + ' ("' + o.underText.substring(0, 20) + '")';
    });
    findings.push({
      severity: textOverlaps.length > 2 ? 'error' : 'warning',
      title: textOverlaps.length + ' fixed element(s) overlap text without opaque background',
      detail: 'Fixed/sticky elements with transparent backgrounds overlap readable text underneath, making both unreadable: ' + overlapDetails.join('; '),
      fix: 'Add an opaque or semi-opaque background (bg-white/90, backdrop-blur) to fixed elements that overlap content. Or hide the element when it scrolls over content sections.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.3 — https://www.w3.org/TR/WCAG22/#contrast-minimum'
    });
  }

  // Child exceeds parent — elements sticking out of their container
  var childExceeds = layout.childExceedsParent || [];
  if (childExceeds.length > 0) {
    // Split: deliberate (parent has explicit overflow:hidden/clip) vs accidental (default visible)
    var accidental = childExceeds.filter(function(c) { return !c.deliberate; });
    var deliberate = childExceeds.filter(function(c) { return c.deliberate; });
    if (accidental.length > 0) {
      checks++;
      var accDetails = accidental.slice(0, 3).map(function(c) {
        return c.childTag + (c.childText ? ' ("' + c.childText.substring(0, 15) + '…")' : '') + ' exceeds ' + c.parent + ' by ' + c.excess + 'px';
      });
      findings.push({
        severity: 'warning',
        title: accidental.length + ' element(s) wider than parent without overflow handling',
        detail: 'These elements extend past their parent with no overflow set (likely unintentional): ' + accDetails.join('; '),
        fix: 'Add max-w-full or overflow-x-auto on the parent. If intentional, set overflow-hidden or overflow-visible explicitly.',
        presetRef: null,
        source: 'CSS Box Model — https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model'
      });
    }
    if (deliberate.length > 0) {
      var delDetails = deliberate.slice(0, 3).map(function(c) {
        return c.childTag + (c.childText ? ' ("' + c.childText.substring(0, 15) + '…")' : '') + ' exceeds ' + c.parent + ' by ' + c.excess + 'px (overflow: ' + c.parentOverflow + ')';
      });
      findings.push({
        severity: 'info',
        title: deliberate.length + ' element(s) wider than parent (overflow explicitly set)',
        detail: 'Parent has explicit overflow handling — likely intentional: ' + delDetails.join('; '),
        fix: 'Verify this overflow is intentional. If content is being clipped unexpectedly, use overflow-x-auto for scroll or constrain child width.',
        presetRef: null,
        source: 'CSS Box Model — https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model'
      });
    }
  }

  // Visual noise density (opt-in, full scan)
  var noiseBands = layout.visualNoiseBands || [];
  var maxNoise = noiseBands.reduce(function(m, b) { return Math.max(m, b.score); }, 0);
  if (maxNoise > 25) {
    findings.push({
      severity: maxNoise > 40 ? 'warning' : 'info',
      title: 'High visual density in viewport band (noise score: ' + maxNoise + ')',
      detail: 'A viewport-height region has many competing visual elements (shadows, colors, borders, bold text, images).',
      fix: 'Reduce competing elements: fewer borders, consolidate backgrounds, or add whitespace between sections.',
      presetRef: null,
      source: 'NNGroup — https://www.nngroup.com/articles/how-users-read-on-the-web/'
    });
  }

  // Empty containers
  var emptyCont = layout.emptyContainers || 0;
  if (emptyCont > 0) {
    findings.push({
      severity: 'info',
      title: emptyCont + ' visible container(s) appear empty',
      detail: 'Lists, sections, or grids are visible but have no text or media content. Could indicate a missing empty state.',
      fix: 'Add an empty state message, illustration, or CTA (e.g., "No items yet").',
      presetRef: null,
      source: 'NNGroup — https://www.nngroup.com/articles/empty-state-ui-design/'
    });
  }

  // Hidden clip — elements with overflow-x:hidden that silently clip content
  var hiddenClips = layout.hiddenClipElements || [];
  if (hiddenClips.length > 0) {
    checks++;
    var clipDetails = hiddenClips.slice(0, 3).map(function(c) {
      return c.selector + ' clips ' + c.clipped + 'px of content';
    });
    findings.push({
      severity: hiddenClips.length > 2 ? 'warning' : 'info',
      title: hiddenClips.length + ' element(s) silently clip overflowing content',
      detail: 'These elements use overflow-x:hidden to hide content that doesn\'t fit, instead of allowing scroll or fixing the layout: ' + clipDetails.join('; '),
      fix: 'Use overflow-x-auto to allow scrolling, or fix the root cause — constrain child widths with max-w-full. overflow-x-hidden masks layout bugs.',
      presetRef: null,
      source: 'WCAG 2.2 §1.4.10 — https://www.w3.org/TR/WCAG22/#reflow'
    });
  }

  // DOM statistics — structural quality indicators (info-only)
  var domStats = (data.structure || {}).domStats;
  if (domStats) {
    checks++;
    if (domStats.divRatio > 60 && domStats.semanticCount < 5) {
      findings.push({
        severity: 'info',
        title: 'Div-heavy markup (' + domStats.divRatio + '% divs, ' + domStats.semanticCount + ' semantic elements)',
        detail: domStats.divCount + ' divs vs ' + domStats.semanticCount + ' semantic elements (nav, header, footer, section, article, etc.). Top tags: ' + domStats.topTags.map(function(t) { return t.tag + '×' + t.count; }).join(', '),
        fix: 'Replace generic divs with semantic HTML where appropriate: <nav>, <header>, <main>, <section>, <article>, <aside>. This improves accessibility and helps screen readers navigate.',
        presetRef: null,
        source: 'HTML Living Standard — https://html.spec.whatwg.org/multipage/dom.html#semantics-2'
      });
    } else {
      passed++;
    }
    if (domStats.displayNoneCount > 50) {
      checks++;
      findings.push({
        severity: 'info',
        title: domStats.displayNoneCount + ' elements with display:none — possible hidden content',
        detail: domStats.ariaHiddenCount + ' have aria-hidden="true". Large numbers of hidden elements may indicate unused markup, off-canvas panels, or JS-toggled content that should be checked.',
        fix: 'Review hidden elements. If they\'re unused, remove them to reduce DOM size. If they\'re interactive panels (menus, modals), ensure they\'re accessible when revealed.',
        presetRef: null,
        source: 'Web Almanac DOM complexity — https://almanac.httparchive.org/en/2022/markup#elements'
      });
    }
  }

  var errors = findings.filter(function(f) { return f.severity === 'error'; }).length;
  var warnings = findings.filter(function(f) { return f.severity === 'warning'; }).length;
  var score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
  return { score: score, findings: findings, checks: checks, passed: passed, weight: 5, label: 'Layout Quality', icon: 'layout' };
}


  S.register("layout", scoreLayout, 5, "Layout Quality", "layout");
})();
