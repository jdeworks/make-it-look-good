// Scoring Module: Design Polish
// Weight: 24
//
// Rewards design CRAFT, not accessibility correctness. The other 13 modules already
// detect every craft deficiency in an unpolished layout (flat type hierarchy, no dark
// mode, no responsive design, no interaction feedback) — but they rate those as `info`
// (zero score impact) or only penalize EXCESS ("too many colors/radii"), never ABSENCE.
// So a careless browser-default page scores ~96 A. This dimension scores the ABSENCE of
// craft, so an unpolished `before` lands in a visibly lower band than its polished twin.
//
// Design principle: penalize INCONSISTENCY and ABSENCE-OF-ADAPTATION, never
// ABSENCE-OF-DECORATION. Intentional minimalism (few colors, no gradients, no shadows)
// is GOOD craft and must keep scoring high — so we never penalize "no gradient" / "no
// shadow". We penalize: flat hierarchy, no responsive design, no dark mode, no
// interaction feedback, inconsistent sibling spacing, and inline-style sloppiness — all
// signals on which a crafted minimalist design still passes.
//
// GATING: the score matrix sets window.__milgIsFragment=true for EVERY preset, so
// isFragment can't tell a component from a full page. We gate on totalElements +
// structure instead. Dark-design pages (isDarkPage) are exempt from the dark-mode check
// (they are single-mode-dark by intent). Static components (no interactive elements) are
// exempt from the interaction check.

(function() {
  "use strict";
  var S = window.MilgScoring;

  function scoreDesignPolish(data) {
    var findings = [];
    var deduct = 0;

    var struct = data.structure || {};
    var craft = data.craft || {};
    var totalEls = struct.totalElements || 0;
    var responsive = !!struct.responsiveClasses;
    var darkMode = !!struct.darkModeClasses;
    var isDarkPage = !!struct.isDarkPage;

    // Substantial = a real page/layout, not a trivial snippet. The heavy "should-adapt"
    // checks (responsive, dark mode) only apply here; tiny components are exempt.
    var isSubstantial = totalEls >= 30;

    // Truly trivial fragments (a lone button/badge) get no Polish score at all.
    if (totalEls < 12) {
      return { score: 100, findings: [], checks: 0, passed: 0, notApplicable: true, weight: 24, label: 'Design Polish', icon: 'consistency' };
    }

    var checks = 0, passed = 0;

    // --- S1. Type-hierarchy strength --------------------------------------------------
    // A crafted page has a clear size jump from headings to body. before/* tops out at
    // text-lg (18px) over a 16px body → ratio ~1.13 = no hierarchy. Crafted pages use
    // text-2xl/3xl/4xl heroes → ratio >= 1.5. Minimalism still has a hero, so it passes.
    var headings = (data.typography && data.typography.headings) || [];
    var bodyFS = (data.layout && data.layout.visualHierarchy && data.layout.visualHierarchy.bodySize) ||
                 parseFloat(data.typography && data.typography.bodyFontSize) || 16;
    if (isSubstantial && headings.length >= 1 && bodyFS > 0) {
      checks++;
      var maxH = 0;
      headings.forEach(function(h) { var s = parseFloat(h.fontSize); if (s > maxH) maxH = s; });
      var ratio = maxH > 0 ? maxH / bodyFS : 0;
      // App / data-dense views (dashboards, data tools) legitimately use a compact
      // heading scale — a big marketing hero would be wrong there. Demote to an
      // info note and don't penalize. Real marketing/content pages keep the warning.
      var appLike = !!(data.context && data.context.appLike);
      if (ratio > 0 && ratio < 1.2) {
        if (appLike) {
          findings.push({
            severity: 'info',
            title: 'Compact type hierarchy — largest heading is ' + (Math.round(ratio * 100) / 100) + 'x body text',
            detail: 'A flat heading scale is normal for a data-dense app/dashboard view. Flagged for awareness only.',
            fix: 'If this is a content page rather than an app surface, give the main heading a larger scale (≈2–3x body).',
            presetRef: null,
            source: 'Modular type scales — https://typescale.com/'
          });
          passed++;
        } else {
          deduct += 25;
          findings.push({
            severity: 'warning',
            title: 'Flat type hierarchy — largest heading is only ' + (Math.round(ratio * 100) / 100) + 'x body text',
            detail: 'No clear visual hierarchy: headings and body are nearly the same size, so the eye has nothing to anchor to.',
            fix: 'Establish a type scale. In Tailwind give the main heading text-3xl/4xl over a text-base body (≈2–3x).',
            presetRef: 'Polished presets use a clear modular scale (hero ≥ 2x body).',
            source: 'Modular type scales — https://typescale.com/'
          });
        }
      } else if (ratio > 0 && ratio < 1.4) {
        if (appLike) {
          passed++;
        } else {
          deduct += 12;
          findings.push({
            severity: 'warning',
            title: 'Weak type hierarchy — largest heading is ' + (Math.round(ratio * 100) / 100) + 'x body text',
            detail: 'Hierarchy is present but shallow; the page reads flat.',
            fix: 'Increase the heading scale. In Tailwind: text-2xl/3xl headings over a text-base body.',
            presetRef: null,
            source: 'Modular type scales — https://typescale.com/'
          });
        }
      } else { passed++; }
    }

    // --- S3. Responsive design --------------------------------------------------------
    // A substantial layout with ZERO breakpoint variants was never adapted for any
    // screen but the one it was built on. Every good preset ships responsive variants.
    if (isSubstantial) {
      checks++;
      if (responsive) { passed++; }
      else {
        deduct += 35;
        findings.push({
          severity: 'warning',
          title: 'No responsive design — zero breakpoint variants',
          detail: 'The layout uses no sm:/md:/lg: variants or media queries, so it cannot adapt between phone, tablet and desktop.',
          fix: 'Add responsive variants: a single-column mobile layout that expands with sm:grid-cols-2 lg:grid-cols-3, responsive padding (px-4 sm:px-8), etc.',
          presetRef: 'Every polished preset is mobile-first responsive.',
          source: 'NNGroup — https://www.nngroup.com/articles/responsive-web-design-definition/'
        });
      }
    }

    // --- S4. Light/dark support -------------------------------------------------------
    // Modern crafted UIs support BOTH color schemes. Single-mode in either direction is
    // the gap: a light-only page lacks a dark variant, and a dark-by-design page
    // (isDarkPage) lacks a light variant — both are penalized symmetrically. The genuine
    // dual-scheme signal is darkModeClasses (dark: utilities / theme toggle / a
    // prefers-color-scheme rule). Gate to larger pages to spare small components.
    if (isSubstantial && totalEls >= 40) {
      checks++;
      if (darkMode) { passed++; }
      else {
        deduct += 30;
        findings.push({
          severity: 'warning',
          title: isDarkPage ? 'No light mode support' : 'No dark mode support',
          detail: 'The design offers only one color scheme. Polished UIs adapt to the user\'s system preference.',
          fix: isDarkPage
            ? 'Add a light variant. In Tailwind, give every dark surface/text a light default (e.g. bg-white dark:bg-slate-900, text-slate-900 dark:text-slate-100) rather than hard-coding dark.'
            : 'Add a dark variant. In Tailwind, pair backgrounds/text with dark: utilities (bg-white dark:bg-slate-900, text-slate-900 dark:text-slate-100).',
          presetRef: 'Polished presets ship both light and dark.',
          source: 'Apple HIG Dark Mode — https://developer.apple.com/design/human-interface-guidelines/dark-mode'
        });
      }
    }

    // --- S5. Interaction feedback -----------------------------------------------------
    // A page with real controls but zero transitions feels dead — buttons/links snap
    // with no hover or state feedback. EXEMPT static components (no interactive elements).
    if ((craft.interactiveCount || 0) >= 3) {
      checks++;
      if (craft.hasTransitions) { passed++; }
      else {
        deduct += 18;
        findings.push({
          severity: 'warning',
          title: 'No interaction feedback — controls have no hover/transition states',
          detail: (craft.interactiveCount || 0) + ' interactive element(s) but no CSS transitions: buttons and links give no visual response.',
          fix: 'Add hover states and transitions. In Tailwind: hover:bg-* with transition-colors, or hover:-translate-y-0.5 transition.',
          presetRef: 'Polished presets animate hover/focus with transition utilities.',
          source: 'Material Design states — https://m3.material.io/foundations/interaction/states/overview'
        });
      }
    }

    // --- S2. Sibling spacing rhythm ---------------------------------------------------
    // Card-like siblings using 3+ distinct padding values is careless spacing (before
    // stats: p-2/p-3/p-2/p-4). Crafted designs — including minimalist ones — keep sibling
    // padding uniform, so this rewards consistency, never restraint.
    var spread = craft.maxSiblingPaddingSpread || 0;
    if (spread >= 3) {
      checks++;
      deduct += spread >= 4 ? 18 : 12;
      findings.push({
        severity: 'warning',
        title: 'Inconsistent spacing — sibling cards use ' + spread + ' different padding values',
        detail: 'Items in the same row/grid have mismatched internal padding, so the layout reads uneven.',
        fix: 'Use one consistent padding value across a group of sibling cards (e.g. all p-5).',
        presetRef: 'Polished presets keep sibling padding uniform.',
        source: 'Material Design 3 — https://m3.material.io/foundations/layout/understanding-layout/spacing'
      });
    }

    // --- S6. Cleanliness: inline styles + unstyled native controls --------------------
    // INFO-ONLY (reported, zero score impact). These measure CODE STYLE, not how the
    // design LOOKS: a real app can use many inline styles and still be visually polished
    // (the analyzer's own pages do). Penalizing them in a *visual* polish score is a
    // partial false positive on general sites, so we surface them for awareness but do
    // not deduct. The visual/structural signals (S1–S5) carry the score. (For Tailwind-
    // only presets inline styles are still a violation — flagged here, enforced by the
    // PRIME DIRECTIVE / template review, not by this number.)
    if ((craft.inlineStyleCount || 0) > 0) {
      findings.push({
        severity: 'info',
        title: craft.inlineStyleCount + ' inline style attribute(s)',
        detail: 'Inline styles bypass the design system. Not penalized here (a page can use them and still look polished), but they signal ad-hoc styling worth consolidating.',
        fix: 'Move styling into utility classes / design tokens instead of inline style="".',
        presetRef: 'Presets are Tailwind-utility-only — no inline styles.',
        source: 'Maintainable CSS — https://maintainablecss.com/'
      });
    }
    if ((craft.unstyledControls || 0) > 0) {
      findings.push({
        severity: 'info',
        title: craft.unstyledControls + ' unstyled native control(s)',
        detail: 'Buttons/inputs with no styling fall back to raw browser-default chrome. Not penalized here — native controls are sometimes intentional — but usually worth styling.',
        fix: 'Style native controls with utilities (padding, background, border-radius, focus states).',
        presetRef: null,
        source: 'Design systems — https://www.designsystems.com/'
      });
    }

    // --- S7. Problematic horizontal scroll on mobile --------------------------------
    // On a small screen a horizontal scrollbar is only OK for a SINGLE wide element (a
    // table, code block, image) that genuinely needs to scroll, or for a real carousel /
    // tab strip. Two cases ARE problems, penalized only at mobile/tablet widths:
    //   (a) MULTI-BLOCK — multiple content blocks (cards/sections) laid in a row that
    //       should wrap or stack instead of scrolling sideways.
    //   (b) MICRO-SCROLL — content overflows by only a few px (<50px). An almost-fits
    //       sideways nudge is awkward to grab and signals the content should simply fit;
    //       a genuine wide table (>=50px overflow) is fine. Carousels / tab strips exempt.
    var vpw = (data.meta && data.meta.viewportWidth) || 9999;
    if (vpw <= 768) {
      var scrollers = ((data.layout && data.layout.horizontalScrollContainers) || [])
        .filter(function(c) { return !c.isCarousel && !c.isControlStrip; });
      var multi = scrollers.filter(function(c) { return c.multiBlock; });
      var microAll = scrollers.filter(function(c) { return !c.multiBlock && c.overflow > 0 && c.overflow < 50; });
      // Code blocks (<pre>/<code>) are awkward either way but are EXPECTED to scroll, so a
      // micro-overflow there is a lighter touch than on a table/other content.
      var microCode = microAll.filter(function(c) { return c.isCodeBlock; });
      var microOther = microAll.filter(function(c) { return !c.isCodeBlock; });
      if (multi.length > 0) {
        checks++;
        deduct += 20;
        findings.push({
          severity: 'warning',
          title: 'Horizontal scroll of multi-block content on mobile',
          detail: multi.length + ' container(s) scroll multiple content blocks sideways instead of wrapping. A horizontal scrollbar is acceptable for a single wide element, not a row of cards/sections on a small screen.',
          fix: 'Let the row wrap or stack on mobile: flex-wrap, or grid-cols-1 sm:grid-cols-2 lg:grid-cols-3. Reserve overflow-x-auto for a single wide element.',
          presetRef: 'Polished presets wrap/stack their content on mobile instead of scrolling sideways.',
          source: 'NNGroup mobile — https://www.nngroup.com/articles/glanceable-mobile/'
        });
      }
      if (microOther.length > 0) {
        checks++;
        deduct += 12;
        var worstO = microOther.reduce(function(a, b) { return b.overflow > a.overflow ? b : a; });
        findings.push({
          severity: 'warning',
          title: 'Awkward micro horizontal scroll on mobile (overflows by only ' + worstO.overflow + 'px)',
          detail: microOther.length + ' element(s) overflow sideways by under 50px — an almost-fits nudge that is hard to scroll and reads as unpolished. (A genuinely wide element that needs real scrolling is fine.)',
          fix: 'Make it fit: reduce padding, shrink/relayout the content (e.g. stack the cell), or wrap. Only keep overflow-x-auto when the element is meaningfully wider than the screen.',
          presetRef: 'Polished presets either fit the viewport or scroll a clearly wide element — not a few stray pixels.',
          source: 'NNGroup mobile — https://www.nngroup.com/articles/glanceable-mobile/'
        });
      }
      if (microCode.length > 0) {
        checks++;
        deduct += 4; // lighter: a code block scrolling is a normal expectation
        var worstC = microCode.reduce(function(a, b) { return b.overflow > a.overflow ? b : a; });
        findings.push({
          severity: 'info',
          title: 'Code block micro-scrolls on mobile (overflows by ' + worstC.overflow + 'px)',
          detail: microCode.length + ' code block(s) overflow sideways by under 50px. Scrolling code is expected, so this is a minor nit — but an almost-fits overflow still feels awkward.',
          fix: 'If practical, allow the code to wrap (white-space: pre-wrap) or trim long lines so it fits; otherwise this is acceptable.',
          presetRef: null,
          source: 'NNGroup mobile — https://www.nngroup.com/articles/glanceable-mobile/'
        });
      }
    }

    var score = Math.max(0, 100 - deduct);
    return { score: score, findings: findings, checks: checks, passed: passed, weight: 24, label: 'Design Polish', icon: 'consistency' };
  }

  S.register("polish", scoreDesignPolish, 24, "Design Polish", "consistency");
})();
