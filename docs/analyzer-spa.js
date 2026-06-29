// make-it-look-good — SPA View Explorer v3.11.98
// Runs INSIDE the analysis iframe (injected alongside MilgExtract). Discovers the
// hidden "views" of a single-page app — reached by hash/History routes (Tier 1) or
// by clicking nav controls (Tier 2, opt-in) — and re-runs MilgExtract on each so the
// crawl pipeline can treat every view as a "page". Crawljax-lite: enumerate candidate
// clickables, fire, wait for the DOM to settle, diff a structural signature, and keep
// only genuinely new states. Single-iframe, depth-limited, capped, and safety-gated.
//
// Exposed as window.MilgSpaExplore(opts) -> Promise<{views, clicked, skipped, notes,
// truncated, navCandidateCount}>. Each view: {stateKey, label, trigger, data}.
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

  // Live clickable candidates (re-queried each step so framework re-renders + newly
  // revealed nested controls are handled). Includes generic buttons/[role=button] —
  // NOT just nav — because mid-page tab strips are often plain content buttons with no
  // role/aria/data hints (e.g. React tabs). Safety denylist + dedup + caps gate the
  // blast radius; disabled controls are skipped (clicking is a no-op anyway).
  function liveCandidates() {
    var out = [], seen = [];
    // NOTE: no a[href] here — with the injected <base> tag, clicking a hash anchor
    // (e.g. a skip-to-content link) resolves against the real URL and navigates the
    // iframe away, tearing down our injected scripts. Hash routes are handled safely by
    // Tier-1 (location.hash=) instead.
    var sel = 'button, [role="button"], [role="tab"], [role="menuitem"], [aria-controls], [aria-selected], [data-page], [data-view], [data-tab], [data-step], [data-nav], .nav-link, .tab';
    function add(el) {
      if (!el || seen.indexOf(el) !== -1) return;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      seen.push(el); out.push(el);
    }
    try { Array.prototype.forEach.call(document.querySelectorAll(sel), add); } catch (e) {}
    try { Array.prototype.forEach.call(document.querySelectorAll('[onclick]'), function(el) { try { if (getComputedStyle(el).cursor === 'pointer') add(el); } catch (e) {} }); } catch (e) {}
    return out;
  }

  // Key for "already tried" tracking (tag + first class + label) so re-enumeration after
  // a re-render doesn't re-click the same logical control forever.
  function candKey(el) {
    var cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/)[0] : '';
    return el.tagName + '|' + cls + '|' + labelOf(el).substring(0, 40);
  }

  // Safety denylist — never click controls that may mutate data or leave the app.
  function unsafeReason(el) {
    var t = labelOf(el).toLowerCase();
    if (/\b(submit|delete|remove|destroy|trash|logout|log ?out|sign ?out|pay|buy|checkout|purchase)\b/.test(t)) return 'destructive';
    var type = (el.getAttribute('type') || '').toLowerCase();
    if (el.tagName === 'BUTTON' && type === 'submit') return 'submit';
    if (el.tagName === 'INPUT' && (type === 'submit' || type === 'reset' || type === 'file')) return 'input';
    try { if (el.closest && el.closest('form')) return 'in-form'; } catch (e) {}
    if (el.tagName === 'A') {
      var href = el.getAttribute('href') || '';
      if (el.target === '_blank') return 'external';
      if (href && href.charAt(0) !== '#' && /^(https?:)?\/\//.test(href)) return 'external';
    }
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
      var quietMs = opts.settleMs || 250, maxMs = opts.settleMaxMs || 1500;
      try {
        obs = new MutationObserver(function(muts) { last = nowMs(); for (var i = 0; i < muts.length; i++) { var t = muts[i].target; if (t) mutated.push(t.nodeType === 1 ? t : t.parentNode); } });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      } catch (e) {}
      var before = domSignature();
      try { el.click(); } catch (e) { if (obs) obs.disconnect(); resolve({ error: true }); return; }
      (function tick() {
        if (done) return;
        var t = nowMs();
        if (t - last >= quietMs || t - start >= maxMs) { done = true; if (obs) obs.disconnect(); resolve({ before: before, after: domSignature(), mutated: mutated }); return; }
        setTimeout(tick, 50);
      })();
    });
  }

  var maxViews = opts.maxViews || 7;
  var deadline = nowMs() + (opts.timeBudgetMs || 15000);
  var FULL_VIEW_RATIO = 0.6;   // changed area ≥ 60% of viewport ⇒ full view (a "page")
  var NOTICEABLE_MIN = 0.10;   // changed region < 10% of viewport ⇒ tiny toggle, skip
  var views = [], clicked = [], skipped = [], notes = [];
  var seenSigs = {}, truncated = false;
  var vpArea = (window.innerWidth || 1280) * (window.innerHeight || 900);

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
        cropOffsetX: isRegion ? Math.round((rect.left || 0) + (window.scrollX || 0)) : 0,
        cropOffsetY: isRegion ? Math.round((rect.top || 0) + (window.scrollY || 0)) : 0,
        isRegion: isRegion
      } };
    }).catch(function() { return null; });
  }

  // Build a state, capture its screenshot (best-effort, attached to data.screenshots /
  // screenshotMeta in the shape pixel-verify consumes), then store it. Async.
  // stateKey is the DETERMINISTIC activation key — the parent prefixes the page URL.
  function addState(o, target) {
    return captureTarget(target, o.kind).then(function(shot) {
      if (shot) { o.data.screenshots = [shot.uri]; o.data.screenshotMeta = shot.meta; }
      views.push({
        stateKey: o.stateKey, kind: o.kind || 'page', regionAnchor: o.regionAnchor || null,
        activation: o.activation || null, label: o.label, trigger: o.trigger || null,
        contentSig: o.contentSig, hasShot: !!shot, data: o.data
      });
    });
  }
  function capExceeded() {
    if (views.length >= maxViews) { truncated = true; notes.push('view cap (' + maxViews + ') reached'); return true; }
    if (nowMs() > deadline) { truncated = true; notes.push('time budget reached'); return true; }
    return false;
  }

  // State 0 — the initial full view.
  var sig0 = domSignature();
  seenSigs[sig0] = true;
  var spa = {};
  return addState({ stateKey: location.hash || '/', kind: 'page', label: 'initial', contentSig: sig0, data: extractNow() }, document.documentElement).then(function() {
    spa = (views[0].data && views[0].data.structure && views[0].data.structure.spa) || {};
    // Tier 1 — deterministic hash routes (always safe; no clicks; full views).
    var routes = (spa.routes || []).slice();
    return routes.reduce(function(p, route) {
      return p.then(function() {
        if (capExceeded()) return;
        try { location.hash = route.charAt(0) === '#' ? route : '#' + route; } catch (e) { return; }
        return settle().then(function() {
          var s = domSignature();
          if (seenSigs[s]) return;
          seenSigs[s] = true;
          return addState({ stateKey: location.hash || route, kind: 'page', activation: 'route:' + route, label: route, trigger: 'route:' + route, contentSig: s, data: extractNow() }, document.documentElement);
        });
      });
    }, Promise.resolve());
  }).then(function() {
    try { if (location.hash) location.hash = ''; } catch (e) {}
    if (!opts.exploreClicks) { notes.push('click exploration disabled (Tier 1 routes only)'); return; }
    return settle().then(clickLoop);
  }).then(function() {
    return {
      views: views, clicked: clicked, skipped: skipped, notes: notes,
      truncated: truncated, navCandidateCount: (spa.navCandidates || []).length
    };
  });

  // Tier 2 — click safe controls, re-enumerating each step. Classifies each change as a
  // full-view PAGE or a bounded REGION, keys it deterministically, and dedups by content.
  function clickLoop() {
    var triedKeys = {}, everSeen = {}, guard = 0;
    // Depth-first via "newly-appeared first": clicking a nav reveals a view's inner tab
    // strip — those controls weren't candidates before, so prioritize them over the
    // already-seen sibling navs. This explores a view's nested tabs BEFORE navigating
    // away, and is robust to sidebar layouts (nav + content in one container) where a
    // containment-based scope can't separate nav from inner tabs.
    function step() {
      if (capExceeded() || guard++ > 200) { if (guard > 200) notes.push('exploration guard limit'); return; }
      var cands = liveCandidates(), next = null, nextKey = null;
      cands.sort(function(a, b) { return (everSeen[candKey(a)] ? 1 : 0) - (everSeen[candKey(b)] ? 1 : 0); });
      cands.forEach(function(c) { everSeen[candKey(c)] = 1; });
      for (var i = 0; i < cands.length; i++) {
        var key = candKey(cands[i]);
        if (triedKeys[key]) continue;
        var reason = unsafeReason(cands[i]);
        if (reason) { triedKeys[key] = 1; skipped.push({ label: labelOf(cands[i]).substring(0, 40) || cands[i].tagName.toLowerCase(), reason: reason }); continue; }
        next = cands[i]; nextKey = key; break;
      }
      if (!next) return; // nothing new and safe to click
      triedKeys[nextKey] = 1;
      var trigger = next;
      var label = labelOf(trigger).substring(0, 40) || trigger.tagName.toLowerCase();
      var descriptor = controlDescriptor(trigger);
      return clickAndSettle(trigger).then(function(res) {
        if (!res || res.error) { skipped.push({ label: label, reason: 'click-error' }); return step(); }
        var changed = res.after !== res.before;
        clicked.push({ label: label, changed: changed });
        if (!changed) return step();
        var root = changedRegionFor(trigger, res.mutated);
        var ratio = vpArea ? areaOf(root) / vpArea : 1;
        var kind = (root === document.body || ratio >= FULL_VIEW_RATIO) ? 'page' : 'region';
        if (kind === 'region') {
          // "Noticeable" gate + empty guard: skip tiny toggles / zero-size panels.
          var rr; try { rr = root.getBoundingClientRect(); } catch (e) { rr = { width: 0, height: 0 }; }
          if (rr.width < 40 || rr.height < 20 || ratio < NOTICEABLE_MIN) { skipped.push({ label: label, reason: 'change-too-small' }); return step(); }
          if (!hasRealContent(root)) { skipped.push({ label: label, reason: 'empty-region' }); return step(); }
          var rsig = subtreeSig(root);
          if (seenSigs[rsig]) { skipped.push({ label: label, reason: 'duplicate-content' }); return step(); }
          seenSigs[rsig] = true;
          return addState({ stateKey: 'act:' + descriptor, kind: 'region', regionAnchor: regionSelector(root), activation: descriptor, label: label, trigger: 'click:' + label, contentSig: rsig, data: extractScoped(root) }, root).then(step);
        } else {
          if (seenSigs[res.after]) { skipped.push({ label: label, reason: 'duplicate-content' }); return step(); }
          seenSigs[res.after] = true;
          return addState({ stateKey: 'act:' + descriptor, kind: 'page', activation: descriptor, label: label, trigger: 'click:' + label, contentSig: res.after, data: extractNow() }, document.documentElement).then(step);
        }
      });
    }
    return Promise.resolve().then(step);
  }
};
