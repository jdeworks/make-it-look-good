// make-it-look-good — SPA View Explorer v3.11.152
// Runs INSIDE the analysis iframe (injected alongside MilgExtract). Discovers the
// hidden "views" of a single-page app — reached by hash/History routes (Tier 1) or
// by clicking nav controls (Tier 2, opt-in) — and re-runs MilgExtract on each so the
// crawl pipeline can treat every view as a "page". Crawljax-lite: enumerate candidate
// clickables, fire, wait for the DOM to settle, diff a structural signature, and keep
// only genuinely new states. Single-iframe, depth-limited, capped, and safety-gated.
//
// Exposed as window.MilgSpaExplore(opts) -> Promise<{views, clicked, skipped, notes,
// truncated, navCandidateCount}>. Each view: {stateKey, kind, label, trigger,
// parentStateKey, depth, regionAnchor, data} — parentStateKey/depth give the
// pages > tabs > sub-tabs hierarchy (a control nests under the state that revealed it).
//
// IMPORTANT: this is injected into the iframe via Function.toString(), so the ENTIRE
// implementation (every helper) MUST live inside this one function — a serialized
// function loses its closure, so nothing may reference an outer-scope binding.
window.MilgSpaExplore = function MilgSpaExplore(opts) {
  "use strict";
  opts = opts || {};

  function nowMs() { return (window.performance && performance.now) ? performance.now() : +new Date(); }

  // Re-run extraction and capture the result WITHOUT the usual parent postMessage
  // (we batch all views into one milg-spa-views message at the end).
  function extractNow() {
    var captured = null;
    var prev = window.__milgOnExtractComplete;
    window.__milgOnExtractComplete = function(d) { captured = d; };
    try { window.MilgExtract(); } catch (e) {}
    window.__milgOnExtractComplete = prev;
    return captured || window.__milgData || null;
  }

  // Is the element actually rendered (has a box)? getClientRects() is empty for
  // display:none / [hidden] / detached. CRITICAL for tab layouts that pre-render all
  // panels and just toggle visibility — a visibility-agnostic signature wouldn't change
  // when the active tab swaps. We only signature RENDERED elements.
  function isRendered(el) { try { return el.getClientRects().length > 0; } catch (e) { return false; } }

  // Cheap structural signature of the VISIBLE DOM: tag + first class token + a coarse
  // text-length bucket, in document order, hashed to 32 bits. Visibility-aware (see
  // isRendered) so a tab swap changes it; ignores exact text values so dynamic timestamps
  // don't churn it. NOT full Levenshtein — kept light for in-browser use.
  function domSignature() {
    var parts = [];
    var els = document.body.getElementsByTagName('*');
    var cap = Math.min(els.length, 4000), n = 0;
    for (var i = 0; i < cap; i++) {
      var el = els[i];
      if (!isRendered(el)) continue;
      var cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/)[0] : '';
      var tlen = 0;
      try { tlen = (el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3) ? el.firstChild.nodeValue.trim().length : 0; } catch (e) {}
      parts.push(el.tagName + cls + (tlen ? ('~' + (tlen < 8 ? 's' : tlen < 40 ? 'm' : 'l')) : ''));
      n++;
    }
    var str = parts.join('|'), h = 5381;
    for (var j = 0; j < str.length; j++) { h = ((h << 5) + h + str.charCodeAt(j)) | 0; }
    return h + ':' + n; // rendered-element count included so visibility toggles register
  }

  // Wait until the DOM stops mutating for `quietMs`, or `maxMs` elapses.
  function settle() {
    return new Promise(function(resolve) {
      var quietMs = opts.settleMs || 250, maxMs = opts.settleMaxMs || 1500;
      var last = nowMs(), start = last, done = false, obs = null;
      try {
        obs = new MutationObserver(function() { last = nowMs(); });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      } catch (e) {}
      (function tick() {
        if (done) return;
        var t = nowMs();
        if (t - last >= quietMs || t - start >= maxMs) { done = true; if (obs) obs.disconnect(); resolve(); return; }
        setTimeout(tick, 50);
      })();
    });
  }

  function labelOf(el) {
    return (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
  }

  // --- Appearance/theme-toggle detection (dark↔light etc.) ---
  // A theme switch re-skins the page but keeps the same text + structure, so it must NOT
  // be counted as a new "view". Two deterministic signals (see clickAndSettle): the visible
  // TEXT is unchanged across the click, and/or a ROOT theme attribute/class flips. A
  // label/icon hint is a corroborating fast-path for the rare case both are ambiguous.

  // Hash of the page's normalized visible text — identical before/after a pure re-skin.
  function textSig() {
    try {
      var t = (document.body.textContent || '').replace(/\s+/g, ' ').trim();
      var h = 5381; for (var i = 0; i < t.length; i++) { h = ((h << 5) + h + t.charCodeAt(i)) | 0; }
      return h + ':' + t.length;
    } catch (e) { return '0'; }
  }

  // Root-level theme state: <html>/<body> class + data-theme/-color-scheme/-mode + inline
  // style (color vars / color-scheme). A change here = the app flipped its appearance.
  function themeKey() {
    try {
      var de = document.documentElement, bd = document.body;
      function k(el) {
        if (!el) return '';
        return (el.getAttribute('class') || '') + '§' + (el.getAttribute('data-theme') || el.getAttribute('data-color-scheme') || el.getAttribute('data-mode') || el.getAttribute('data-color-mode') || '') + '§' + (el.getAttribute('style') || '');
      }
      return k(de) + '¶' + k(bd);
    } catch (e) { return ''; }
  }

  // Cheap label/icon/class hint that a control is an appearance toggle.
  function themeHint(el) {
    try {
      var s = (labelOf(el) + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '') + ' ' + ((el.className && typeof el.className === 'string') ? el.className : '')).toLowerCase();
      if (/\btheme\b|appearance|colou?r\s*scheme|\b(dark|light|night|day)\s*mode\b/.test(s)) return true;
      if (/[☀☁☼☽☾\u{1F311}-\u{1F31C}\u{1F506}]/u.test(labelOf(el))) return true; // sun/moon glyphs
      if (el.querySelector && el.querySelector('[class*="moon" i],[class*="sun" i],[class*="theme" i]')) return true;
    } catch (e) {}
    return false;
  }

  // Live clickable candidates (re-queried each step so framework re-renders + newly
  // revealed nested controls are handled). Includes generic buttons/[role=button] —
  // NOT just nav — because mid-page tab strips are often plain content buttons with no
  // role/aria/data hints (e.g. React tabs). Safety denylist + dedup + caps gate the
  // blast radius; disabled controls are skipped (clicking is a no-op anyway).
  // Aggressive (non-semantic) discovery state — only fires on sparse-markup pages (A4 gate).
  // _aggSet tags the candidates found ONLY by the aggressive pass so the click loop can rank
  // them last and apply a per-state sub-budget. Rebuilt fresh each liveCandidates() call.
  var aggressiveOn = false, _aggSet = null;
  function isAggCand(el) { try { return !!(_aggSet && _aggSet.has(el)); } catch (e) { return false; } }
  function liveCandidates() {
    var out = [], seen = [];
    _aggSet = (typeof WeakSet !== 'undefined') ? new WeakSet() : null;
    // NOTE: no a[href] here — with the injected <base> tag, clicking a hash anchor
    // (e.g. a skip-to-content link) resolves against the real URL and navigates the
    // iframe away, tearing down our injected scripts. Hash routes are handled safely by
    // Tier-1 (location.hash=) instead.
    var sel = 'button, [role="button"], [role="tab"], [role="menuitem"], [aria-controls], [aria-selected], [data-page], [data-view], [data-tab], [data-step], [data-nav], .nav-link, .tab';
    function add(el, agg) {
      if (!el || seen.indexOf(el) !== -1) return;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      // Skip controls that aren't currently rendered (display:none / [hidden] / detached):
      // they belong to an inactive view (e.g. a tab strip inside a hidden panel) and would
      // otherwise be attributed to the CURRENT state at boot and consumed by no-op clicks.
      // They become candidates — correctly nested under their parent view — once shown.
      if (!isRendered(el)) return;
      // Skip checkbox/radio/switch — these toggle settings/filters (e.g. a findings-table
      // filter), not navigation, so they shouldn't spawn "views".
      var role = (el.getAttribute('role') || '').toLowerCase();
      var ty = (el.getAttribute('type') || '').toLowerCase();
      if (role === 'checkbox' || role === 'radio' || role === 'switch' || ty === 'checkbox' || ty === 'radio') return;
      seen.push(el); out.push(el); if (agg && _aggSet) _aggSet.add(el);
    }
    try { Array.prototype.forEach.call(document.querySelectorAll(sel), function(el) { add(el, false); }); } catch (e) {}
    try { Array.prototype.forEach.call(document.querySelectorAll('[onclick]'), function(el) { try { if (getComputedStyle(el).cursor === 'pointer') add(el, false); } catch (e) {} }); } catch (e) {}
    // Aggressive second pass (A3) — non-semantic handler-wired toggles. Only when the page is
    // sparse on semantic nav (A4); these get tagged so step() ranks them LAST and budgets them.
    if (aggressiveOn) {
      var semCount = out.length;
      // Toggle-class / tabindex elements that often carry a JS click handler with no a11y hint.
      try {
        Array.prototype.forEach.call(document.querySelectorAll('[class*="toggle" i],[class*="accordion" i],[class*="expand" i],[class*="collaps" i],[class*="dropdown" i],[class*="disclos" i],[class*="reveal" i],div[tabindex],span[tabindex],li[tabindex]'), function(el) {
          var tg = el.tagName;
          if (tg === 'DIV' || tg === 'SPAN' || tg === 'LI' || tg === 'A' || tg === 'HEADER' || tg === 'H2' || tg === 'H3' || tg === 'H4') add(el, true);
        });
      } catch (e) {}
      // Bounded cursor:pointer sweep over generic containers; innermost-wins (skip a wrapper
      // that already contains a collected candidate); size-sane; collected count capped.
      try {
        var all = document.querySelectorAll('div,span,li'), scanned = 0, collected = 0;
        for (var ai = 0; ai < all.length && scanned < 1200 && collected < 60; ai++) {
          var el = all[ai]; scanned++;
          if (seen.indexOf(el) !== -1) continue;
          var cs; try { cs = getComputedStyle(el); } catch (e) { continue; }
          if (cs.cursor !== 'pointer') continue;
          var r; try { r = el.getBoundingClientRect(); } catch (e) { continue; }
          if (r.width < 16 || r.height < 12 || r.width > 1700 || r.height > 1200) continue;
          var wraps = false;
          for (var wi = 0; wi < out.length; wi++) { if (el !== out[wi] && el.contains(out[wi])) { wraps = true; break; } }
          if (wraps) continue;
          add(el, true); collected++;
        }
      } catch (e) {}
      void semCount;
    }
    return out;
  }

  // Key for "already tried" tracking (tag + first STABLE class + label) so re-enumeration
  // after a re-render doesn't re-click the same logical control forever. Volatile state
  // classes (active/selected/current/open/…) are stripped — SPA nav toggles them on the
  // clicked control, which would otherwise change its key, make it look "new", and cause
  // re-clicks + wrong parent attribution.
  function candKey(el) {
    var cls = '';
    if (el.className && typeof el.className === 'string') {
      var toks = el.className.trim().split(/\s+/);
      for (var i = 0; i < toks.length; i++) {
        if (toks[i] && !/^(active|selected|current|open|show|shown|expanded|collapsed|is-active|is-selected|is-open|is-expanded|is-collapsed|w--current)$/i.test(toks[i]) && !/(-open|-active|-current|-selected|-expanded|-collapsed)$/i.test(toks[i])) { cls = toks[i]; break; }
      }
    }
    return el.tagName + '|' + cls + '|' + labelOf(el).substring(0, 40);
  }

  // Safety denylist — never click controls that may mutate data or leave the app.
  function unsafeReason(el) {
    var t = labelOf(el).toLowerCase();
    if (/\b(submit|delete|remove|destroy|trash|logout|log ?out|sign ?out|pay|buy|checkout|purchase)\b/.test(t)) return 'destructive';
    // Social / auth / subscription controls: clicking can launch OAuth popups or off-site
    // flows even when the control is a plain <div>/<button> with no href — label-gated.
    if (/\b(share|tweet|connect|oauth|sign ?in|sign ?up|log ?in|subscribe|follow|account|profile)\b/.test(t)) return 'social-auth';
    // Global page/app state controls are not "views" for the design crawl. Skip them before
    // clicking so locale/theme/app-launch controls do not create noisy states or trigger app code.
    var attrs = '';
    try { attrs = [el.id || '', el.getAttribute('class') || '', el.getAttribute('aria-label') || '', el.getAttribute('title') || '', el.getAttribute('data-lang') || '', el.getAttribute('lang') || ''].join(' ').toLowerCase(); } catch (e) {}
    if (/\b(cookie|consent|privacy|dismiss|accept|agree|got it|apply|cancel|close)\b/.test(t + ' ' + attrs)) return 'utility-control';
    if (/\b(carousel|slider|slide|slideshow)\b/.test(attrs) || /\b(go to slide|previous slide|next slide|prev slide)\b/.test(t)) return 'carousel-control';
    if (themeHint(el)) return 'theme-toggle';
    if (/\b(language|locale|select language|change language|preferred language)\b/.test(t + ' ' + attrs)) return 'locale-control';
    if (/^(en|de|fr|es|it|pt|nl|pl|sv|no|da|fi|cs|ja|ko|zh|ar|tr|uk|ro)$/i.test((el.getAttribute('data-lang') || '').trim())) return 'locale-control';
    if (/\b(open app|launch app|go to app)\b/.test(t)) return 'app-launch';
    var type = (el.getAttribute('type') || '').toLowerCase();
    if (el.tagName === 'BUTTON' && type === 'submit') return 'submit';
    if (el.tagName === 'INPUT' && (type === 'submit' || type === 'reset' || type === 'file')) return 'input';
    try { if (el.closest && el.closest('form')) return 'in-form'; } catch (e) {}
    if (el.tagName === 'A') {
      var href = el.getAttribute('href') || '';
      if (el.target === '_blank') return 'external';
      if (href && href.charAt(0) !== '#' && /^(https?:)?\/\//.test(href)) return 'external';
    } else {
      // Non-anchor el wrapped in an off-site/non-hash anchor (e.g. a clickable card linking
      // out) — clicking it navigates away; the bootstrap blocks it, but skip it cleanly.
      try {
        var a = el.closest && el.closest('a[href]');
        if (a) { var ah = a.getAttribute('href') || ''; if (a.target === '_blank' || (ah && ah.charAt(0) !== '#' && !/^javascript:/i.test(ah))) return 'in-anchor'; }
      } catch (e) {}
    }
    // Wraps a submit/external affordance (a custom control around a real form/nav action).
    try { if (el.querySelector && el.querySelector('[type="submit"], a[target="_blank"]')) return 'wraps-nav'; } catch (e) {}
    return null;
  }

  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40); }

  // Stable, DETERMINISTIC descriptor for the control that triggered a state change.
  // Precedence: aria-controls target → data-{tab,view,page,step} → id → role+name →
  // positional. Path-based (not discovery-index) so the same control yields the same
  // key across runs — this is the activation half of the state identity.
  function controlDescriptor(el) {
    try {
      var ac = el.getAttribute('aria-controls'); if (ac) return 'panel:' + ac;
      var d = el.getAttribute('data-tab') || el.getAttribute('data-view') || el.getAttribute('data-page') || el.getAttribute('data-step'); if (d) return 'data:' + slug(d);
      if (el.id) return 'id:' + el.id;
      var role = (el.getAttribute('role') || el.tagName).toLowerCase();
      var name = labelOf(el).substring(0, 40);
      if (name) return role + ':' + slug(name);
      var p = el.parentNode, n = 0, k = 0;
      if (p) { for (var i = 0; i < p.children.length; i++) { if (p.children[i].tagName === el.tagName) { n++; if (p.children[i] === el) k = n; } } }
      return role + ':nth' + k;
    } catch (e) { return 'ctrl:' + (el.tagName || 'x').toLowerCase(); }
  }

  function areaOf(el) { try { var r = el.getBoundingClientRect(); return Math.max(0, r.width) * Math.max(0, r.height); } catch (e) { return 0; } }

  // Real content guard — avoids the "empty container" trap (a sized-but-empty panel that
  // would screenshot blank). True if the region has meaningful text or replaced media.
  function hasRealContent(root) {
    try {
      if ((root.textContent || '').trim().length >= 8) return true;
      return !!root.querySelector('img,svg,video,canvas,picture,input,button,a,table,ul,ol');
    } catch (e) { return true; }
  }

  function commonAncestor(a, b) {
    if (a === b) return a;
    var ap = [], x = a; while (x) { ap.push(x); x = x.parentNode; }
    var y = b; while (y) { if (ap.indexOf(y) !== -1) return y; y = y.parentNode; }
    return null;
  }

  // The region that changed after a click: prefer the trigger's aria-controls target
  // (reliable tabs), else the nearest common ancestor of the mutated element nodes.
  function changedRegionFor(trigger, mutated) {
    try { var ac = trigger.getAttribute('aria-controls'); if (ac) { var t = document.getElementById(ac); if (t) return t; } } catch (e) {}
    var els = [];
    for (var i = 0; i < mutated.length; i++) { var n = mutated[i]; if (n && n.nodeType === 1 && document.contains(n)) els.push(n); }
    if (!els.length) return document.body;
    var anc = els[0];
    for (var j = 1; j < els.length; j++) { anc = commonAncestor(anc, els[j]); if (!anc) { anc = document.body; break; } }
    // Prefer a semantic panel ancestor if the raw common ancestor is a bare text wrapper.
    try { var pnl = anc.closest && anc.closest('[role="tabpanel"],[role="region"],section,article'); if (pnl && areaOf(pnl) <= areaOf(document.body)) anc = pnl; } catch (e) {}
    return anc || document.body;
  }

  // Compact stable selector for the changed region (anchor metadata + screenshot target).
  function regionSelector(el) {
    if (!el || el === document.body) return 'body';
    if (el.id) return '#' + el.id;
    var parts = [], cur = el, depth = 0;
    while (cur && cur.nodeType === 1 && cur !== document.body && depth < 4) {
      if (cur.id) { parts.unshift('#' + cur.id); break; }
      var part = cur.tagName.toLowerCase();
      var cls = (cur.className && typeof cur.className === 'string') ? cur.className.trim().split(/\s+/)[0] : '';
      if (cls) part += '.' + cls;
      var p = cur.parentNode, n = 0, k = 0;
      if (p) { for (var i = 0; i < p.children.length; i++) { if (p.children[i].tagName === cur.tagName) { n++; if (p.children[i] === cur) k = n; } } if (n > 1) part += ':nth-of-type(' + k + ')'; }
      parts.unshift(part); cur = cur.parentNode; depth++;
    }
    return parts.join('>');
  }

  // Structural+text signature of a subtree (region-scoped variant of domSignature).
  function subtreeSig(root) {
    if (!root) return '0:0';
    var parts = [], els = root.getElementsByTagName('*'), cap = Math.min(els.length, 2000), n = 0;
    for (var i = 0; i < cap; i++) {
      var el = els[i];
      if (!isRendered(el)) continue;
      var cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/)[0] : '';
      var tlen = 0; try { tlen = (el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3) ? el.firstChild.nodeValue.trim().length : 0; } catch (e) {}
      parts.push(el.tagName + cls + (tlen ? ('~' + (tlen < 8 ? 's' : tlen < 40 ? 'm' : 'l')) : ''));
      n++;
    }
    var str = parts.join('|'), h = 5381;
    for (var j = 0; j < str.length; j++) { h = ((h << 5) + h + str.charCodeAt(j)) | 0; }
    return 'r' + h + ':' + n;
  }

  // Extraction scoped to a region subtree (so region units don't re-analyze page chrome).
  // Honored by extractFromDocument via window.__milgScopeRoot (Stage 2).
  function extractScoped(root) {
    var prev = window.__milgScopeRoot;
    if (root && root !== document.body) window.__milgScopeRoot = root;
    var d = extractNow();
    window.__milgScopeRoot = prev;
    return d;
  }

  // Click + wait for settle, capturing WHICH nodes mutated (observer attached BEFORE the
  // click so synchronous innerHTML swaps are recorded too). Resolves {before, after, mutated}.
  function clickAndSettle(el) {
    return new Promise(function(resolve) {
      var mutated = [], last = nowMs(), start = last, done = false, obs = null;
      var pageErrors = [];
      var quietMs = opts.settleMs || 250, maxMs = opts.settleMaxMs || 1500;
      function summarizePageError(e) {
        try {
          if (!e) return 'unknown error';
          var msg = e.message || (e.reason && (e.reason.message || String(e.reason))) || String(e.error || e);
          var src = e.filename ? (' @ ' + e.filename.replace(location.origin, '') + (e.lineno ? ':' + e.lineno : '')) : '';
          return String(msg || 'unknown error').substring(0, 220) + src;
        } catch (_e) { return 'unknown error'; }
      }
      function onError(e) {
        pageErrors.push(summarizePageError(e));
        try { if (e && e.preventDefault) e.preventDefault(); } catch (_e) {}
      }
      function onRejection(e) {
        pageErrors.push(summarizePageError(e));
        try { if (e && e.preventDefault) e.preventDefault(); } catch (_e) {}
      }
      try {
        window.addEventListener('error', onError, true);
        window.addEventListener('unhandledrejection', onRejection, true);
      } catch (e) {}
      function cleanup() {
        try { window.removeEventListener('error', onError, true); } catch (e) {}
        try { window.removeEventListener('unhandledrejection', onRejection, true); } catch (e) {}
      }
      try {
        obs = new MutationObserver(function(muts) { last = nowMs(); for (var i = 0; i < muts.length; i++) { var t = muts[i].target; if (t) mutated.push(t.nodeType === 1 ? t : t.parentNode); } });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      } catch (e) {}
      var before = domSignature(), beforeText = textSig(), beforeTheme = themeKey();
      try { el.click(); } catch (e) { pageErrors.push(summarizePageError(e)); if (obs) obs.disconnect(); cleanup(); resolve({ error: true, pageErrors: pageErrors }); return; }
      (function tick() {
        if (done) return;
        var t = nowMs();
        if (t - last >= quietMs || t - start >= maxMs) { done = true; if (obs) obs.disconnect(); cleanup(); resolve({ before: before, after: domSignature(), mutated: mutated, beforeText: beforeText, afterText: textSig(), beforeTheme: beforeTheme, afterTheme: themeKey(), pageErrors: pageErrors }); return; }
        setTimeout(tick, 50);
      })();
    });
  }

  var maxViews = opts.maxViews || 7;
  var deadline = nowMs() + (opts.timeBudgetMs || 15000);
  // After entering a full view, lazy sub-content (e.g. a tab strip behind an async data
  // fetch) can mount AFTER the click settles — the settle observer goes quiet on the
  // initial swap and resolves before the tabs exist, so a naive loop races past them.
  // Grace window: once a page view is added, wait (bounded, early-exit) for the candidate
  // set to grow before re-enumerating, so newly-mounted controls are explored as children.
  var pageEnterGraceMs = opts.pageEnterGraceMs != null ? opts.pageEnterGraceMs : 1500;
  var FULL_VIEW_RATIO = 0.6;   // changed area ≥ 60% of viewport ⇒ full view (a "page")
  var NOTICEABLE_MIN = 0.10;   // changed region < 10% of viewport ⇒ tiny toggle, skip
  var MAX_DEPTH = 4;           // overall hierarchy guard (pages > tabs > sub-tabs > …)
  var REGION_MAX_DEPTH = 2;    // bounded panels only as top-level tab-panels (depth ≤ 2);
                               // deeper small-region toggles are filters/settings, not views.
  var views = [], clicked = [], skipped = [], notes = [];
  var seenSigs = {}, truncated = false;
  var vpArea = (window.innerWidth || 1280) * (window.innerHeight || 900);
  // Hierarchy bookkeeping: depth per stateKey so children (inner tabs) nest under the
  // state that revealed them — the report renders pages > tabs > sub-tabs from this.
  var depthByKey = {};

  // --- Flow graph (additive; the views[] parent-pointer tree above is untouched). Nodes are
  // distinct UI states keyed by CONTENT SIGNATURE (domSignature/subtreeSig), so the same state
  // reached two ways collapses to one node and the second arrival is a back-edge — the
  // multi-path/cycle retention the tree discards. Edges are interactions {from,to,control,...}.
  // ensureNode/recordEdge are SYNCHRONOUS (registered at decision time, not in addState's async
  // screenshot path). currentNodeId = the actual DOM from-state (distinct from the tree's
  // parentStateKey = the revealing parent). coverage is filled at the end from bookkeeping.
  var graph = { nodes: [], edges: [], coverage: {} };
  var nodeBySig = {}, nodeSeq = 0, currentNodeId = null, rootNodeId = null;
  var controlsDiscovered = 0;   // distinct SEMANTIC candKeys ever enumerated (coverage denominator)
  var aggressiveDiscovered = 0; // distinct AGGRESSIVE (non-semantic) candKeys — tracked separately
  function ensureNode(sig, meta) {
    meta = meta || {};
    var ex = nodeBySig[sig];
    if (ex) { ex.hits = (ex.hits || 1) + 1; return ex; }
    var n = {
      id: 'n' + (nodeSeq++), sig: sig, kind: meta.kind || 'page', label: meta.label || '',
      stateKey: meta.stateKey || null, depth: meta.depth || 0,
      special: !!meta.special, hits: 1
    };
    nodeBySig[sig] = n; graph.nodes.push(n); return n;
  }
  function recordEdge(fromId, control, label, toId, effect, back) {
    if (fromId == null || toId == null) return;
    graph.edges.push({ from: fromId, to: toId, control: control || null, label: (label || '').substring(0, 40), effect: effect || null, back: !!back });
  }

  // Best-effort screenshot of a target (full page = documentElement, or a region element)
  // via modern-screenshot (loaded by the bootstrap). Returns {uri, meta} or null. For a
  // region the canvas is the element's box; cropOffset = the element's PAGE position so
  // post-hoc pixel-verify can map page-coordinate contrast-pair bboxes into the crop.
  function captureTarget(target, kind) {
    var ms = window.modernScreenshot;
    if (!opts.capture || !ms || !ms.domToCanvas || !target) return Promise.resolve(null);
    var scale = opts.captureScale || 1;
    var rect; try { rect = target.getBoundingClientRect(); } catch (e) { rect = { left: 0, top: 0 }; }
    function filter(n) { try { return !(n && n.getAttribute && (n.getAttribute('data-milg-overlay') || n.hasAttribute('data-milg-iframe-ph'))); } catch (e) { return true; } }
    return ms.domToCanvas(target, { scale: scale, timeout: 20000, filter: filter }).then(function(canvas) {
      if (!canvas || !canvas.width || !canvas.height) return null;
      var uri; try { uri = canvas.toDataURL('image/webp', 0.85); } catch (e) { try { uri = canvas.toDataURL('image/png'); } catch (e2) { return null; } }
      var isRegion = kind === 'region';
      return { uri: uri, meta: {
        scale: scale, viewportHeight: window.innerHeight, canvasWidth: canvas.width, canvasHeight: canvas.height,
        // cropOffset is subtracted by consumers AFTER they scale the bbox (`bbox*scale - cropOffset`),
        // so it must be in the SAME scaled canvas-pixel units — multiply the element's page position
        // by scale (matches analyzer-region.js). Was unscaled CSS px: a no-op at scale=1 but a
        // scale-proportional misalignment for region views at any capture scale > 1.
        cropOffsetX: isRegion ? Math.round(((rect.left || 0) + (window.scrollX || 0)) * scale) : 0,
        cropOffsetY: isRegion ? Math.round(((rect.top || 0) + (window.scrollY || 0)) * scale) : 0,
        isRegion: isRegion
      } };
    }).catch(function() { return null; });
  }

  // Per-view scroll-pane screenshots. SPA views don't run the region pipeline (MilgRegion isn't
  // injected into this iframe), so a vertically-scrollable inner pane would only ever show its
  // ~visible slice in the flat view shot. For each pane detected by THIS view's extract
  // (window.__milgScrollRegions) temporarily force full height + overflow:visible, rasterize the
  // pane, then restore — giving its FULL content its own region screenshot (kind:'scroll') attached
  // to the view in the same shape the single-page region pipeline emits. Skipped for 'region'
  // sub-views (their shot is already a zoomed element, so a page-coordinate anchor wouldn't map).
  function captureScrollRegions(mainKind, viewData) {
    var ms = window.modernScreenshot;
    if (!opts.capture || !ms || !ms.domToCanvas || mainKind === 'region') return Promise.resolve([]);
    var allPanes = (window.__milgScrollRegions || []).filter(function(p) { return p && p.el && p.el.isConnected; });
    // Cap at 3 panes/view, spending the slots on the panes hiding the MOST content
    // (detection order is DOM order — arbitrary). The coverage hint in the viewer
    // tells the user when panes were dropped.
    var panes = allPanes.slice().sort(function(a, b) {
      function hidden(p) { try { return Math.max(0, (p.el.scrollHeight || 0) - (p.el.clientHeight || 0)) * Math.max(1, p.el.clientWidth || 1); } catch (e) { return 0; } }
      return hidden(b) - hidden(a);
    }).slice(0, 3);
    // Surface capture coverage in the view data so the UI can say when panes were dropped
    // (cap) or scored from clipped page findings instead of a native region extract (budget).
    if (viewData) viewData._scrollCapture = { detected: allPanes.length, captured: 0, nativeScored: 0 };
    if (!panes.length) return Promise.resolve([]);
    var scale = opts.captureScale || 1;
    // A native pane-scoped extract gives the region its own runScoring (typography/touch/
    // spacing local to the pane) like single-page regions get from the mini-page re-extract —
    // but it costs a scoped MilgExtract pass per pane, which is what previously timed the
    // exploration out when run unconditionally. Only spend it while there is comfortable
    // budget headroom; otherwise fall back to clipping the view's pairs/findings (_regionFromMain).
    var extractHeadroomMs = Math.max(12000, 0.25 * (opts.timeBudgetMs || 15000));
    // The scoped extract clobbers the globals extractFromDocument writes (hidden panels feed
    // the holistic-state passes, __milgData/__milgBboxRefs feed post-capture re-reads) with
    // pane-scoped values — snapshot and restore them around each native extract.
    var GLOBAL_KEYS = ['__milgScrollRegions', '__milgHiddenPanels', '__milgBboxRefs', '__milgData', '__milgGetFlowPosition', '__milgReReadBboxes'];
    function extractPaneScoped(el) {
      var saved = {};
      GLOBAL_KEYS.forEach(function(k) { saved[k] = window[k]; });
      var d = null;
      try { d = extractScoped(el); } catch (e) {}
      GLOBAL_KEYS.forEach(function(k) { window[k] = saved[k]; });
      return d;
    }
    // The view's own extract already produced contrast pairs for the pane's content at natural
    // (scrollTop 0) layout — the same layout the full-height capture shows — so we reuse them,
    // geometrically clipped to the pane, instead of a costly per-pane re-extract (which also
    // timed the exploration out). Pairs carry page-coordinate bboxes; the region cropOffset maps
    // them into the pane-relative canvas so verifyRegions() can pixel-verify below-the-fold text.
    var allPairs = (viewData && viewData.colors && viewData.colors.contrastPairs) || [];
    var out = [];
    function filter(n) { try { return !(n && n.getAttribute && (n.getAttribute('data-milg-overlay') || n.hasAttribute('data-milg-iframe-ph'))); } catch (e) { return true; } }
    return panes.reduce(function(chain, p) {
      return chain.then(function() {
        var el = p.el, savedCss = el.style.cssText, rectPre;
        // VISIBLE box + full page-coordinate content bounds, measured BEFORE the reveal (the pane's
        // top-left is where its scrollTop-0 content — and thus the view's pairs — are anchored).
        try { rectPre = el.getBoundingClientRect(); } catch (e) { rectPre = { left: 0, top: 0, width: 0, height: 0 }; }
        var w = Math.round(rectPre.width || 0);
        var padLeft = (rectPre.left || 0) + (window.scrollX || 0);
        var padTop = (rectPre.top || 0) + (window.scrollY || 0);
        var fullH = Math.max(el.scrollHeight || 0, Math.round(rectPre.height || 0));
        // Clip the view's pairs to the pane's full content rect (a pair belongs to the pane if its
        // bbox centre falls inside). Below-the-fold pairs sit past the visible bottom but within scrollHeight.
        var rgnPairs = allPairs.filter(function(pr) {
          var b = pr && pr.bbox; if (!b) return false;
          var cx = b.left + (b.width || 0) / 2, cy = b.top + (b.height || 0) / 2;
          return cx >= padLeft - 2 && cx <= padLeft + w + 2 && cy >= padTop - 2 && cy <= padTop + fullH + 2;
        });
        // cropOffset = pane top-left (scrollTop-0 anchor) in SCALED canvas px; the canvas origin is
        // the pane's own box, so bbox*scale - cropOffset lands each pair in canvas space.
        var cropOX = Math.round(padLeft * scale), cropOY = Math.round(padTop * scale);
        // Reveal the pane's FULL content. height:auto/overflow:visible alone does NOT grow a
        // flex-item scroller (flex-basis re-stretches it) or an absolutely-pinned shell — the pane
        // stays at its clipped height. Neutralize the sizing constraints too: flex:none + min-height:0
        // (defeat flex stretch) and position:static + inset/top/bottom:auto (release absolute pins),
        // pinning width to the visible width so it doesn't shrink to content. In a column app-shell
        // (the common case) this grows the pane DOWNWARD, leaving its top-left — and the pair anchor
        // — stable. (The single-page region pipeline sidesteps this by cloning into a mini-page.)
        try {
          el.style.cssText = savedCss + '; width: ' + w + 'px !important; height: auto !important; max-height: none !important; min-height: 0 !important; overflow: visible !important; position: static !important; flex: none !important; inset: auto !important; top: auto !important; bottom: auto !important; transform: none !important;';
          void el.offsetHeight;
        } catch (e) {}
        // Native pane extract runs while the pane is REVEALED so bboxes reflect the same
        // full-content layout the capture shows (page coords → mapped by the region cropOffset).
        var nativeData = (nowMs() < deadline - extractHeadroomMs) ? extractPaneScoped(el) : null;
        if (nativeData && !(nativeData.colors && (nativeData.colors.contrastPairs || []).length) && rgnPairs.length) nativeData = null;
        return ms.domToCanvas(el, { scale: scale, timeout: 15000, filter: filter }).then(function(canvas) {
          try { el.style.cssText = savedCss; void el.offsetHeight; } catch (e) {}
          if (!canvas || !canvas.width || !canvas.height) return;
          var uri; try { uri = canvas.toDataURL('image/webp', 0.85); } catch (e) { try { uri = canvas.toDataURL('image/png'); } catch (e2) { return; } }
          out.push({
            screenshot: uri,
            screenshotMeta: {
              scale: scale, canvasWidth: canvas.width, canvasHeight: canvas.height,
              // cropOffset in SCALED canvas px (consumers do bbox*scale - cropOffset), per analyzer-region.js.
              cropOffsetX: cropOX, cropOffsetY: cropOY, isRegion: true
            },
            containerRect: { left: Math.round(rectPre.left), top: Math.round(rectPre.top), width: Math.round(rectPre.width), height: Math.round(rectPre.height) },
            kind: 'scroll', noAnchor: false, label: p.label || 'Scrollable region', pairIndices: [], _domOrder: out.length,
            // extractedData present → verifyRegions() pixel-verifies the region on the maskless
            // grid path, incl. below-the-fold text the flat view shot clips. Prefer the NATIVE
            // pane-scoped extract (full data → analyzer.js runScoring gives the region its own
            // report, like single-page regions); fall back to the view's pairs clipped to the pane.
            extractedData: nativeData || (rgnPairs.length ? { colors: { contrastPairs: rgnPairs } } : null),
            // Fallback only: screenshot is in PAGE coordinates, so finding overlays ("normal
            // validation boxes") are synthesized from the page's already-scored findings clipped
            // to the pane (analyzer.js region loop) instead of runScoring on pairs-only data.
            _regionFromMain: !nativeData
          });
          if (viewData && viewData._scrollCapture) {
            viewData._scrollCapture.captured++;
            if (nativeData) viewData._scrollCapture.nativeScored++;
          }
        }, function() { try { el.style.cssText = savedCss; } catch (e) {} });
      });
    }, Promise.resolve()).then(function() { return out; });
  }
  // Build a state, capture its screenshot (best-effort, attached to data.screenshots /
  // screenshotMeta in the shape pixel-verify consumes), then store it. Async.
  // stateKey is the DETERMINISTIC activation key — the parent prefixes the page URL.
  function addState(o, target) {
    // depth = parent's depth + 1 (root states have null/unknown parent → depth 0).
    var pk = (o.parentStateKey == null) ? null : o.parentStateKey;
    var depth = (pk != null && depthByKey[pk] != null) ? depthByKey[pk] + 1 : 0;
    if (depthByKey[o.stateKey] == null) depthByKey[o.stateKey] = depth;
    // Pre-captured / no-shot state views. The all-expanded pass rasterizes the LIVE revealed DOM
    // itself (before restoring) and passes the result as o.shot; all-collapsed passes o.noShot
    // (collapsed ≈ the base view, not worth a second full-page shot). Either way there is no
    // element to (re-)capture here, so attach the shot if present and push synchronously.
    if (o.shot || o.noShot) {
      if (o.shot) { o.data.screenshots = [o.shot.uri]; o.data.screenshotMeta = o.shot.meta; }
      views.push({
        stateKey: o.stateKey, kind: o.kind || 'page', regionAnchor: o.regionAnchor || null,
        activation: o.activation || null, label: o.label, trigger: o.trigger || null,
        parentStateKey: pk, depth: depth, contentSig: o.contentSig, hasShot: !!o.shot, data: o.data
      });
      return Promise.resolve();
    }
    return captureTarget(target, o.kind).then(function(shot) {
      if (shot) { o.data.screenshots = [shot.uri]; o.data.screenshotMeta = shot.meta; }
      return captureScrollRegions(o.kind, o.data).then(function(regions) {
        if (regions && regions.length) o.data.regionScreenshots = (o.data.regionScreenshots || []).concat(regions);
        views.push({
          stateKey: o.stateKey, kind: o.kind || 'page', regionAnchor: o.regionAnchor || null,
          activation: o.activation || null, label: o.label, trigger: o.trigger || null,
          parentStateKey: pk, depth: depth,
          contentSig: o.contentSig, hasShot: !!shot, data: o.data
        });
      });
    });
  }
  function capExceeded() {
    if (views.length >= maxViews) { truncated = true; notes.push('view cap (' + maxViews + ') reached'); return true; }
    if (nowMs() > deadline) { truncated = true; notes.push('time budget reached'); return true; }
    return false;
  }
  // Wait (bounded) for lazy controls to mount after entering a view; resolves early the
  // moment the candidate count grows past the post-settle baseline.
  function awaitNewCandidates(baseCount) {
    if (!pageEnterGraceMs || capExceeded()) return Promise.resolve();
    return new Promise(function(resolve) {
      var start = nowMs();
      (function tick() {
        try { if (liveCandidates().length > baseCount) return resolve(); } catch (e) { return resolve(); }
        if (nowMs() - start >= pageEnterGraceMs) return resolve();
        setTimeout(tick, 200);
      })();
    });
  }

  // --- Holistic state passes: analyze the page with ALL disclosures open at once
  // (worst-case density/overflow) and all closed (clean baseline). Run on the pristine
  // baseline DOM, BEFORE clickLoop, and never seed seenSigs. Each pass mutates synchronously,
  // forces one reflow, extracts SYNCHRONOUSLY (before framework re-collapse handlers fire),
  // then restores the exact DOM state in a finally. Gated on hiddenPanelCount >= threshold.
  var stateCoverageActive = false; // true once all-expanded ran → suppress redundant per-panel region views
  var _coveredPanels = [];          // the disclosure elements the expanded pass already covered
  function runHolisticStates() {
    if (!opts.stateCapture) return Promise.resolve();
    var threshold = opts.stateThreshold || 6;
    var hpCount = (views[0] && views[0].data && views[0].data.layout && views[0].data.layout.hiddenPanelCount) || 0;
    if (hpCount < threshold) { notes.push('state-capture skipped (hiddenPanelCount ' + hpCount + ' < ' + threshold + ')'); return Promise.resolve(); }
    return Promise.resolve()
      .then(function() { return runExpandedState({ parentStateKey: (views[0] && views[0].stateKey), parentNodeId: rootNodeId, keySuffix: '', label: 'All expanded' }); })
      .then(runCollapsedState);
  }
  // P5 — per-page holistic expand pass. When the click loop enters a NEW PAGE that has its own
  // disclosure-dense content (e.g. narratu's nav-gated Demo), re-run the all-expanded pass scoped
  // to THAT page's panels so its hidden content is measured as a state node parented to the page.
  // Budgeted + deduped per page sig; gated on the same stateCapture flag + per-page panel count.
  // Per-page threshold is LOWER than the root threshold: once you've navigated INTO a page, even
  // a small cluster of disclosures (3+) is worth an all-expanded measurement — that's how we reach
  // nav-gated content (narratu's Demo pages carry ~3 panels each). The pass-budget caps the blast.
  var _statePasses = 0, STATE_PASS_BUDGET = (opts.maxStatePasses != null ? opts.maxStatePasses : 8), _pageStateDone = {};
  function maybeCapturePageState(pageData, pageStateKey, pageNodeId, descriptor, pageSig) {
    if (!opts.stateCapture || capExceeded()) return Promise.resolve();
    if (_statePasses >= STATE_PASS_BUDGET) return Promise.resolve();
    if (pageSig && _pageStateDone[pageSig]) return Promise.resolve();
    var hp = (pageData && pageData.layout && pageData.layout.hiddenPanelCount) || 0;
    if (hp < (opts.perPageStateThreshold || 3)) return Promise.resolve();
    if (pageSig) _pageStateDone[pageSig] = 1;
    _statePasses++;
    return runExpandedState({ parentStateKey: pageStateKey, parentNodeId: pageNodeId, keySuffix: descriptor, label: 'All expanded' });
  }
  // Reveal every in-flow disclosure currently in window.__milgHiddenPanels (rebuilt by the most
  // recent extract — so this is implicitly scoped to the current page), extract synchronously,
  // then restore. ctx routes the emitted state node + union edge to the right parent.
  function runExpandedState(ctx) {
    ctx = ctx || {};
    if (capExceeded()) return;
    // In-flow disclosures only: opening every menu/dialog/tooltip (aria-role) or any
    // fixed/absolute overlay at once produces an unrealistic pile, not "all content shown".
    var reg = (window.__milgHiddenPanels || []).filter(function(h) {
      if (!h.el || !h.el.isConnected) return false;
      if (h.kind === 'aria-role') return false;
      var pos; try { pos = getComputedStyle(h.el).position; } catch (e) { return false; }
      return pos !== 'fixed' && pos !== 'absolute';
    });
    if (!reg.length) { if (!ctx.keySuffix) notes.push('all-expanded skipped (no in-flow disclosures)'); return; }
    var saved = [], data;
    function restore() {
      saved.forEach(function(s) {
        try {
          if (s.detailsOpen !== null) { s.el.open = s.detailsOpen; }
          else { s.el.style.cssText = s.cssText; if (s.hadHidden) s.el.setAttribute('hidden', ''); if (s.ariaHidden != null) s.el.setAttribute('aria-hidden', s.ariaHidden); else s.el.removeAttribute('aria-hidden'); }
          if (s.trigger && s.triggerAria != null) s.trigger.setAttribute('aria-expanded', s.triggerAria);
        } catch (e) {}
      });
      void document.body.offsetHeight;
    }
    // Reveal every in-flow disclosure and extract synchronously (before framework re-collapse
    // handlers fire). Unlike the old flow — which restored immediately in a finally and shipped a
    // screenshot-less view — we keep the revealed DOM LIVE across an async rasterize so the state
    // view carries a real "all open" screenshot, then restore once the capture settles.
    try {
      reg.forEach(function(h) {
        var el = h.el, tr = h.triggerEl || null;
        saved.push({ el: el, cssText: el.style.cssText, ariaHidden: el.getAttribute('aria-hidden'), hadHidden: el.hasAttribute('hidden'), detailsOpen: (el.tagName === 'DETAILS' ? el.open : null), trigger: tr, triggerAria: tr ? tr.getAttribute('aria-expanded') : null });
        if (el.tagName === 'DETAILS') { el.open = true; }
        else { el.style.cssText = el.style.cssText + '; display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: none !important; max-height: none !important; height: auto !important; overflow: visible !important; transform: none !important; clip-path: none !important;'; if (el.hasAttribute('hidden')) el.removeAttribute('hidden'); if (el.getAttribute('aria-hidden')) el.setAttribute('aria-hidden', 'false'); }
        if (tr && tr.getAttribute('aria-expanded') != null) tr.setAttribute('aria-expanded', 'true');
      });
      void document.body.offsetHeight;
      data = extractNow();
    } catch (e) { restore(); return; }

    stateCoverageActive = true;
    reg.forEach(function(h) { _coveredPanels.push(h.el); });   // suppress per-panel region double-count
    var sk = 'state:all-expanded' + (ctx.keySuffix ? ':' + ctx.keySuffix : '');
    var lbl = ctx.label || 'All expanded';
    var parentNodeId = ctx.parentNodeId != null ? ctx.parentNodeId : rootNodeId;
    // Union node: the all-open extreme as a distinguished summary node OUTSIDE the click graph.
    recordEdge(parentNodeId, 'all-expanded', lbl, ensureNode(sk, { kind: 'state', label: lbl, stateKey: sk, special: true, depth: (ctx.keySuffix ? 2 : 1) }).id, 'union', false);
    var stateObj = { stateKey: sk, kind: 'state', activation: 'all-expanded', label: lbl, parentStateKey: (ctx.parentStateKey != null ? ctx.parentStateKey : (views[0] && views[0].stateKey)), contentSig: sk, data: data };
    // Full-page shot of the live revealed DOM. kind 'state' (not 'region') → isRegion false, so
    // cropOffset stays 0, matching the base screenshot's coordinate space. Restore after it settles.
    return captureTarget(document.documentElement, 'state').then(function(s) {
      restore();
      if (s) stateObj.shot = s; else stateObj.noShot = true;
      return addState(stateObj, null);
    }, function() {
      restore();
      stateObj.noShot = true;
      return addState(stateObj, null);
    });
  }
  function runCollapsedState() {
    if (capExceeded()) return;
    var open = [];
    try {
      Array.prototype.forEach.call(document.querySelectorAll('details[open]'), function(d) { open.push({ el: d }); });
      Array.prototype.forEach.call(document.querySelectorAll('[aria-expanded="true"][aria-controls]'), function(t) { var tgt = document.getElementById(t.getAttribute('aria-controls')); if (tgt) open.push({ el: tgt, trigger: t }); });
    } catch (e) {}
    if (!open.length) { notes.push('all-collapsed skipped (nothing open at rest)'); return; }
    var saved = [], data;
    try {
      open.forEach(function(o) {
        var el = o.el, tr = o.trigger || null;
        saved.push({ el: el, cssText: el.style.cssText, detailsOpen: (el.tagName === 'DETAILS' ? el.open : null), trigger: tr, triggerAria: tr ? tr.getAttribute('aria-expanded') : null });
        if (el.tagName === 'DETAILS') { el.open = false; }
        else { el.style.cssText = el.style.cssText + '; display: none !important;'; }
        if (tr) tr.setAttribute('aria-expanded', 'false');
      });
      void document.body.offsetHeight;
      data = extractNow();
    } finally {
      saved.forEach(function(s) {
        try {
          if (s.detailsOpen !== null) { s.el.open = s.detailsOpen; } else { s.el.style.cssText = s.cssText; }
          if (s.trigger && s.triggerAria != null) s.trigger.setAttribute('aria-expanded', s.triggerAria);
        } catch (e) {}
      });
      void document.body.offsetHeight;
    }
    recordEdge(rootNodeId, 'all-collapsed', 'All collapsed', ensureNode('state:all-collapsed', { kind: 'state', label: 'All collapsed', stateKey: 'state:all-collapsed', special: true, depth: 1 }).id, 'union', false);
    return addState({ stateKey: 'state:all-collapsed', kind: 'state', activation: 'all-collapsed', label: 'All collapsed', parentStateKey: (views[0] && views[0].stateKey), contentSig: 'state:all-collapsed', data: data, noShot: true }, null);
  }

  // State 0 — the initial full view.
  var sig0 = domSignature();
  seenSigs[sig0] = true;
  rootNodeId = ensureNode(sig0, { kind: 'page', label: 'initial', stateKey: location.hash || '/', depth: 0 }).id;
  currentNodeId = rootNodeId;
  var spa = {};
  return addState({ stateKey: location.hash || '/', kind: 'page', label: 'initial', parentStateKey: null, contentSig: sig0, data: extractNow() }, document.documentElement).then(function() {
    spa = (views[0].data && views[0].data.structure && views[0].data.structure.spa) || {};
    // A4 — aggressive click-to-discover fires only on SPARSE-markup pages (few semantic nav
    // controls ⇒ a custom/handler-wired SPA like narratu). Pages with real nav (our own UI,
    // the fixture) keep semantic-only exploration. Master flag `opts.aggressive` defaults on.
    aggressiveOn = (opts.aggressive !== false) && ((spa.navCandidates || []).length < (opts.aggressiveNavThreshold || 3));
    if (aggressiveOn) notes.push('aggressive discovery on (sparse nav: ' + ((spa.navCandidates || []).length) + ' candidates)');
    return runHolisticStates();
  }).then(function() {
    // Tier 1 — deterministic hash routes (always safe; no clicks; full views).
    var routes = (spa.routes || []).slice();
    return routes.reduce(function(p, route) {
      return p.then(function() {
        if (capExceeded()) return;
        try { location.hash = route.charAt(0) === '#' ? route : '#' + route; } catch (e) { return; }
        return settle().then(function() {
          var s = domSignature();
          if (seenSigs[s]) {
            var dn = nodeBySig[s];
            if (dn) recordEdge(rootNodeId, 'route:' + route, route, dn.id, 'route', true);
            return;
          }
          seenSigs[s] = true;
          recordEdge(rootNodeId, 'route:' + route, route, ensureNode(s, { kind: 'page', label: route, stateKey: location.hash || route, depth: 1 }).id, 'route', false);
          return addState({ stateKey: location.hash || route, kind: 'page', activation: 'route:' + route, label: route, trigger: 'route:' + route, parentStateKey: (views[0] && views[0].stateKey), contentSig: s, data: extractNow() }, document.documentElement);
        });
      });
    }, Promise.resolve());
  }).then(function() {
    try { if (location.hash) location.hash = ''; } catch (e) {}
    currentNodeId = rootNodeId;   // Tier 1 reset the hash → DOM is back at the root state.
    if (!opts.exploreClicks) { notes.push('click exploration disabled (Tier 1 routes only)'); return; }
    return settle().then(clickLoop);
  }).then(function() {
    // Coverage: derived from existing bookkeeping. controlsFired = clicks actually attempted;
    // controlsDiscovered = distinct candKeys ever enumerated; pct is a LOWER BOUND when truncated.
    var skippedByReason = {};
    skipped.forEach(function(s) { var r = s.reason || 'other'; skippedByReason[r] = (skippedByReason[r] || 0) + 1; });
    graph.coverage = {
      controlsDiscovered: controlsDiscovered,
      aggressiveDiscovered: aggressiveDiscovered,
      controlsFired: clicked.length,
      pct: controlsDiscovered ? Math.min(1, clicked.length / controlsDiscovered) : 0,
      nodesReached: graph.nodes.length,
      edgeCount: graph.edges.length,
      backEdgeCount: graph.edges.filter(function(e) { return e.back; }).length,
      skippedByReason: skippedByReason,
      truncated: truncated
    };
    return {
      views: views, clicked: clicked, skipped: skipped, notes: notes,
      truncated: truncated, navCandidateCount: (spa.navCandidates || []).length,
      graph: graph
    };
  });

  // Tier 2 — click safe controls, re-enumerating each step. Classifies each change as a
  // full-view PAGE or a bounded REGION, keys it deterministically, and dedups by content.
  function clickLoop() {
    var triedKeys = {}, everSeen = {}, guard = 0;
    var pageErrorNotes = {};
    // Aggressive (non-semantic) clicks are budgeted per from-state so a pointer-heavy page
    // can't blow the whole exploration on speculative div clicks.
    var aggCountByState = {}, AGG_BUDGET = 12;
    // The state the DOM is currently in (clickLoop starts from the initial view — Tier 1
    // reset location.hash). A control's PARENT is the state active when it first appeared
    // as a candidate, so we tag each newly-seen control with the current state key.
    var currentStateKey = views[0] ? views[0].stateKey : (location.hash || '/');
    var discoveredUnder = {};
    // Depth-first by hierarchy: clicking a nav reveals a view's inner tab strip — explore
    // those (and any deeper) BEFORE returning to sibling navs, so a view's tabs nest under
    // it instead of being skipped when the loop wanders off to the next nav. We rank each
    // candidate by the DEPTH of the state that first revealed it (deeper = explore first):
    // inner tabs (revealed by a depth-1 view) outrank top-nav siblings (revealed at the
    // root), and stay ahead even after we've stepped into one of the tabs. Robust to
    // sidebar layouts (nav + content in one container) where containment can't separate them.
    function candParentDepth(c) {
      var du = discoveredUnder[candKey(c)];
      return (du != null && depthByKey[du] != null) ? depthByKey[du] : -1;
    }
    function recordPageErrors(label, res) {
      if (!res || !res.pageErrors || !res.pageErrors.length) return;
      for (var i = 0; i < res.pageErrors.length; i++) {
        var msg = res.pageErrors[i] || 'unknown error';
        var key = label + '|' + msg;
        if (!pageErrorNotes[key]) {
          pageErrorNotes[key] = 1;
          notes.push('Target page script error after clicking "' + label + '": ' + msg);
        }
      }
    }
    function step() {
      if (capExceeded() || guard++ > 200) { if (guard > 200) notes.push('exploration guard limit'); return; }
      var cands = liveCandidates(), next = null, nextKey = null;
      // Record first-appearance parent BEFORE ranking, so freshly-revealed controls are
      // attributed to the view that revealed them.
      // Classify each newly-seen control as SEMANTIC (1) or AGGRESSIVE (2). Coverage's headline
      // denominator counts only semantic controls — aggressive ones rank last and are rarely
      // clicked, so including them would dilute coverage with affordances we never intend to fire.
      cands.forEach(function(c) {
        var k = candKey(c);
        if (!everSeen[k]) {
          var ag = isAggCand(c);
          everSeen[k] = ag ? 2 : 1; discoveredUnder[k] = currentStateKey;
          if (ag) aggressiveDiscovered++; else controlsDiscovered++;
        }
      });
      // Value-ranked exploration. When the time/view budget runs out, we want the HIGH-value
      // controls (real view/nav that reveals a whole page) to have fired first and the low-value
      // ones (sub-filters past the region cap, utility/pagination toggles, speculative) to be what
      // gets dropped — on narratu the explorer otherwise burns ~49 clicks on nested filters before
      // time runs out. Reordering is SAFE: a control's tree-parent is fixed at DISCOVERY time
      // (discoveredUnder above), not click order, so this only changes which views survive truncation.
      function candValue(c) {
        if (isAggCand(c)) return -1000;                       // speculative non-semantic → always last
        var v = 0, d = candParentDepth(c);
        try {
          if (c.matches && c.matches('[role="tab"],[role="menuitem"],[data-page],[data-view],[data-tab],[data-step],[data-nav],.nav-link,.tab')) v += 100; // semantic view-nav
          if (c.getAttribute && c.getAttribute('aria-controls')) v += 40;
        } catch (e) {}
        // Keep the existing deeper-first NESTING up to the region cap (inner tabs nest under their
        // page); past it a control almost always opens a filter that gets skipped → low marginal
        // value, deprioritize rather than spend budget on it.
        if (d <= REGION_MAX_DEPTH) v += d * 20; else v -= (d - REGION_MAX_DEPTH) * 50;
        var lbl = labelOf(c).toLowerCase();
        if (/\b(filter|sort|close|dismiss|reset|zoom|prev|previous|next|show all|expand all|collapse all)\b|^[\s\d.,+\-%]+$|^[▲▼◀▶←→↑↓+\-]+$/.test(lbl)) v -= 60; // utility/pagination/bulk
        return v;
      }
      cands.sort(function(a, b) { return candValue(b) - candValue(a); });
      var nextAgg = false;
      for (var i = 0; i < cands.length; i++) {
        var key = candKey(cands[i]);
        if (triedKeys[key]) continue;
        var reason = unsafeReason(cands[i]);
        if (reason) { triedKeys[key] = 1; skipped.push({ label: labelOf(cands[i]).substring(0, 40) || cands[i].tagName.toLowerCase(), reason: reason }); continue; }
        // Per-state aggressive sub-budget: once spent, skip remaining speculative clicks here.
        if (isAggCand(cands[i]) && (aggCountByState[currentStateKey] || 0) >= AGG_BUDGET) {
          triedKeys[key] = 1; skipped.push({ label: labelOf(cands[i]).substring(0, 40) || cands[i].tagName.toLowerCase(), reason: 'aggressive-budget' }); continue;
        }
        next = cands[i]; nextKey = key; nextAgg = isAggCand(cands[i]); break;
      }
      if (!next) return; // nothing new and safe to click
      if (nextAgg) aggCountByState[currentStateKey] = (aggCountByState[currentStateKey] || 0) + 1;
      triedKeys[nextKey] = 1;
      var trigger = next;
      var label = labelOf(trigger).substring(0, 40) || trigger.tagName.toLowerCase();
      var descriptor = controlDescriptor(trigger);
      var aggClick = nextAgg;                                    // provenance + click-to-revert
      var fromNodeId = currentNodeId, fromStateKey = currentStateKey;
      return clickAndSettle(trigger).then(function(res) {
        recordPageErrors(label, res);
        if (!res || res.error) { skipped.push({ label: label, reason: (res && res.pageErrors && res.pageErrors.length) ? 'page-script-error' : 'click-error', pageErrors: (res && res.pageErrors) || [] }); return step(); }
        var changed = res.after !== res.before;
        clicked.push({ label: label, changed: changed, pageErrors: res.pageErrors || [] });
        if (!changed) {
          if (res.pageErrors && res.pageErrors.length) skipped.push({ label: label, reason: 'page-script-error', pageErrors: res.pageErrors });
          recordEdge(currentNodeId, descriptor, label, currentNodeId, 'no-op', false); return step();
        }
        // Appearance/theme toggle (dark↔light, etc.) — a re-skin, not a view. Skip it when
        // the visible text is unchanged AND/OR a root theme attribute flipped (two signals,
        // a label/icon hint corroborates). Then click it again to RESTORE the default
        // appearance so later views aren't all captured in the toggled theme.
        var themeFlip = res.afterTheme !== res.beforeTheme;
        var textSame = res.afterText === res.beforeText;
        var hinted = themeHint(trigger);
        if ((themeFlip && textSame) || (hinted && (themeFlip || textSame))) {
          skipped.push({ label: label, reason: 'theme-toggle' });
          recordEdge(currentNodeId, descriptor, label, currentNodeId, 'theme', false);
          return clickAndSettle(trigger).then(function() { return step(); });
        }
        // Depth of the state this control was revealed under → the new state sits one below.
        var parentDepth = (discoveredUnder[nextKey] != null && depthByKey[discoveredUnder[nextKey]] != null) ? depthByKey[discoveredUnder[nextKey]] : 0;
        if (parentDepth + 1 > MAX_DEPTH) { skipped.push({ label: label, reason: 'too-deep' }); return step(); }
        var root = changedRegionFor(trigger, res.mutated);
        var ratio = vpArea ? areaOf(root) / vpArea : 1;
        var kind = (root === document.body || ratio >= FULL_VIEW_RATIO) ? 'page' : 'region';
        if (kind === 'region') {
          // When the all-expanded state pass already covered this disclosure, a per-panel
          // region view would just re-measure the same panel and double-count its findings.
          if (stateCoverageActive) {
            var _covered = false;
            for (var _ci = 0; _ci < _coveredPanels.length; _ci++) { var _cp = _coveredPanels[_ci]; if (_cp && (_cp === root || root.contains(_cp) || _cp.contains(root))) { _covered = true; break; } }
            if (_covered) { skipped.push({ label: label, reason: 'covered-by-state-capture' }); return step(); }
          }
          // Bounded panels are captured as tab-panels near the top of the tree; a small
          // region nested under a sub-tab is a filter/setting, not a view — skip it.
          if (parentDepth + 1 > REGION_MAX_DEPTH) { skipped.push({ label: label, reason: 'nested-filter' }); return step(); }
          // "Noticeable" gate + empty guard: skip tiny toggles / zero-size panels.
          var rr; try { rr = root.getBoundingClientRect(); } catch (e) { rr = { width: 0, height: 0 }; }
          if (rr.width < 40 || rr.height < 20 || ratio < NOTICEABLE_MIN) { skipped.push({ label: label, reason: 'change-too-small' }); return step(); }
          if (!hasRealContent(root)) { skipped.push({ label: label, reason: 'empty-region' }); return step(); }
          var rsig = subtreeSig(root);
          if (seenSigs[rsig]) {
            // Already-known state reached by another path → record a back-edge (cycle/alt-path
            // retention the tree discards) but do NOT recurse or move currentNodeId.
            var dnR = nodeBySig[rsig];
            if (dnR) recordEdge(currentNodeId, descriptor, label, dnR.id, 'region', true);
            skipped.push({ label: label, reason: 'duplicate-content' }); return step();
          }
          seenSigs[rsig] = true;
          var rk = 'act:' + descriptor;
          var rNode = ensureNode(rsig, { kind: 'region', label: label, stateKey: rk, depth: parentDepth + 1 });
          recordEdge(currentNodeId, descriptor, label, rNode.id, 'region', false);
          return addState({ stateKey: rk, kind: 'region', regionAnchor: regionSelector(root), activation: (aggClick ? 'aggressive:' : '') + descriptor, label: label, trigger: 'click:' + label, parentStateKey: (discoveredUnder[nextKey] != null ? discoveredUnder[nextKey] : currentStateKey), contentSig: rsig, data: extractScoped(root) }, root).then(function() {
            currentStateKey = rk; currentNodeId = rNode.id;
            // Aggressive region toggles are click-to-revert: re-click to close the speculative
            // panel (keeps later signatures clean) and return to the from-state. The forward
            // edge is already recorded, so the graph keeps it; exploration resumes at the parent.
            if (aggClick) return clickAndSettle(trigger).then(function() { currentStateKey = fromStateKey; currentNodeId = fromNodeId; return step(); });
            return step();
          });
        } else {
          if (seenSigs[res.after]) {
            var dnP = nodeBySig[res.after];
            if (dnP) recordEdge(currentNodeId, descriptor, label, dnP.id, 'page', true);
            skipped.push({ label: label, reason: 'duplicate-content' }); return step();
          }
          seenSigs[res.after] = true;
          var pk2 = 'act:' + descriptor;
          var pNode = ensureNode(res.after, { kind: 'page', label: label, stateKey: pk2, depth: parentDepth + 1 });
          recordEdge(currentNodeId, descriptor, label, pNode.id, 'page', false);
          var pageData = extractNow();
          return addState({ stateKey: pk2, kind: 'page', activation: (aggClick ? 'aggressive:' : '') + descriptor, label: label, trigger: 'click:' + label, parentStateKey: (discoveredUnder[nextKey] != null ? discoveredUnder[nextKey] : currentStateKey), contentSig: res.after, data: pageData }, document.documentElement).then(function() {
            currentStateKey = pk2; currentNodeId = pNode.id;
            // P5 — if this new page carries its own disclosure-dense content (e.g. a nav-gated
            // Demo), capture its all-expanded state as a child state node before moving on.
            return maybeCapturePageState(pageData, pk2, pNode.id, descriptor, res.after).then(function() {
              // Let lazy sub-content (tab strips, etc.) mount before re-enumerating so it
              // nests under THIS view rather than being missed.
              return awaitNewCandidates(liveCandidates().length).then(step);
            });
          });
        }
      });
    }
    return Promise.resolve().then(step);
  }
};

// Shared view→crawl mapper. Turns a MilgSpaExplore result ({views, clicked, skipped,
// notes, truncated}) into the crawl payload the analyzer ingests: per-view {url, data}
// with breadcrumb titles + _spa* meta, plus aggregate counts/provenance. ONE source of
// truth used by all three entry points — the URL path (analyzer.js _finishUrl), the crawl
// fold (analyzer-crawl-ui.js _foldSpaViews), and the console snippet (inlined). Lives
// OUTSIDE MilgSpaExplore (not serialized into the iframe — mapping happens in the parent).
//   opts: { base, rootTitle, inputMethod='url', skipInitial=false, sourceUrl=null, profile=null }
//   returns: { results:[{url,data}], counts:{pages,subViews,panels}, provenance:{...,counts} }
window.MilgSpaMap = {
  build: function build(result, opts) {
    opts = opts || {};
    var states = (result && result.views) ? result.views : [];
    var base = opts.base || '';
    var rootTitle = opts.rootTitle || 'App';
    var inputMethod = opts.inputMethod || 'url';
    var skipInitial = !!opts.skipInitial;
    var byKey = {};
    states.forEach(function(v) { byKey[v.stateKey] = v; });
    // Breadcrumb labels from the parent chain (a control nests under the state that revealed
    // it): "App › Live demo › Summary". 'initial' is the root and contributes no segment.
    function crumbs(v) {
      var parts = [], seen = {}, cur = v, guard = 0;
      while (cur && guard++ < 12) {
        if (cur.label && cur.label !== 'initial') parts.unshift(cur.label);
        var pk = cur.parentStateKey;
        if (pk == null || seen[pk]) break;
        seen[pk] = 1; cur = byKey[pk] || null;
      }
      return parts;
    }
    var pages = 0, subViews = 0, panels = 0, states_ = 0, results = [];
    for (var i = 0; i < states.length; i++) {
      if (skipInitial && i === 0) continue;          // baseline == the page we already have
      var v = states[i];
      if (!v || !v.data) continue;
      var isState = v.kind === 'state';
      if (skipInitial && !v.trigger && !isState) continue;   // extra guard against the baseline (state views have no trigger)
      var isRegion = v.kind === 'region';
      var depth = v.depth || 0;
      if (isState) states_++; else if (isRegion) panels++; else if (depth >= 2) subViews++; else pages++;
      var sk = String(v.stateKey || '').replace(/^#/, '');
      var cr = crumbs(v);
      if (isState) { cr = [v.label]; }            // holistic states aren't a crumb path
      else if (isRegion && cr.length) cr[cr.length - 1] = '▤ ' + cr[cr.length - 1];
      if (isState && cr.length) cr[cr.length - 1] = '▣ ' + cr[cr.length - 1];
      v.data.meta = v.data.meta || {};
      v.data.meta.url = base + (sk ? '#' + sk : '');
      v.data.meta.title = [rootTitle].concat(cr).join(' › ');
      v.data.meta._inputMethod = inputMethod;
      v.data.meta._spaView = true;
      v.data.meta._spaKind = v.kind;
      if (isState) v.data.meta._stateTag = v.activation || sk.replace('state:', '');
      v.data.meta._spaRegionAnchor = v.regionAnchor || null;
      v.data.meta._spaTrigger = v.trigger || null;
      v.data.meta._spaParentKey = (v.parentStateKey == null) ? null : v.parentStateKey;
      v.data.meta._spaDepth = depth;
      if (opts.sourceUrl) v.data.meta._spaSourceUrl = opts.sourceUrl;
      if (opts.profile && !v.data.profile) v.data.profile = opts.profile;
      results.push({ url: v.data.meta.url, data: v.data });
    }
    var counts = { pages: pages, subViews: subViews, panels: panels, states: states_ };
    return {
      results: results,
      counts: counts,
      provenance: {
        clicked: (result && result.clicked) || [],
        skipped: (result && result.skipped) || [],
        notes: (result && result.notes) || [],
        truncated: !!(result && result.truncated),
        counts: counts,
        graph: (result && result.graph) || null,
        navCandidateCount: (result && result.navCandidateCount) || 0
      }
    };
  }
};
