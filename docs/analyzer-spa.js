// make-it-look-good — SPA View Explorer v3.11.92
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

  // Cheap structural signature of the visible DOM: tag + first class token + a coarse
  // text-length bucket, in document order, hashed to 32 bits. Sensitive to view changes
  // (different content / active-tab class) but ignores exact text values, so dynamic
  // timestamps don't churn it. NOT full Levenshtein — kept light for in-browser use.
  function domSignature() {
    var parts = [];
    var els = document.body.getElementsByTagName('*');
    var n = Math.min(els.length, 4000);
    for (var i = 0; i < n; i++) {
      var el = els[i];
      var cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/)[0] : '';
      var tlen = 0;
      try { tlen = (el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3) ? el.firstChild.nodeValue.trim().length : 0; } catch (e) {}
      parts.push(el.tagName + cls + (tlen ? ('~' + (tlen < 8 ? 's' : tlen < 40 ? 'm' : 'l')) : ''));
    }
    var str = parts.join('|'), h = 5381;
    for (var j = 0; j < str.length; j++) { h = ((h << 5) + h + str.charCodeAt(j)) | 0; }
    return h + ':' + n; // element count included so add/remove of small nodes still differs
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

  // Live nav-control candidates (re-queried each step so framework re-renders are handled).
  function liveCandidates() {
    var out = [], seen = [];
    var sel = 'nav button, header button, aside button, [role="navigation"] button, [role="tab"], [role="menuitem"], [data-page], [data-view], [data-tab], [data-step], [data-nav], .nav-link, .tab';
    function add(el) { if (!el || seen.indexOf(el) !== -1) return; seen.push(el); out.push(el); }
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

  var maxViews = opts.maxViews || 7;
  var deadline = nowMs() + (opts.timeBudgetMs || 15000);
  var views = [], clicked = [], skipped = [], notes = [];
  var seenSigs = {}, truncated = false;
  // Baselines so we only treat hash/pathname as a state key when it ACTUALLY changed
  // (in a srcdoc iframe location.pathname is a constant like "srcdoc" — useless as a key).
  var basePath = location.pathname, baseHash = location.hash;
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 32); }
  function stateKeyFor(label, index) {
    if (location.hash && location.hash !== baseHash) return location.hash;
    if (location.pathname !== basePath) return location.pathname;
    return 'view-' + index + (label ? '-' + slug(label) : '');
  }
  function pushView(stateKey, label, trigger) {
    views.push({ stateKey: stateKey, label: label, trigger: trigger, data: extractNow() });
  }
  function capExceeded() {
    if (views.length >= maxViews) { truncated = true; notes.push('view cap (' + maxViews + ') reached'); return true; }
    if (nowMs() > deadline) { truncated = true; notes.push('time budget reached'); return true; }
    return false;
  }

  // View 0 — the initial state.
  seenSigs[domSignature()] = true;
  pushView(location.hash || '/', 'initial', null);
  var spa = (views[0].data && views[0].data.structure && views[0].data.structure.spa) || {};

  // Tier 1 — deterministic hash routes (always safe; no clicks).
  var routes = (spa.routes || []).slice();
  return routes.reduce(function(p, route) {
    return p.then(function() {
      if (capExceeded()) return;
      try { location.hash = route.charAt(0) === '#' ? route : '#' + route; } catch (e) { return; }
      return settle().then(function() {
        var s = domSignature();
        if (!seenSigs[s]) { seenSigs[s] = true; pushView(location.hash || route, route, 'route:' + route); }
      });
    });
  }, Promise.resolve()).then(function() {
    // Reset to base before click exploration.
    try { if (location.hash) location.hash = ''; } catch (e) {}
    if (!opts.exploreClicks) { notes.push('click exploration disabled (Tier 1 routes only)'); return; }
    return settle().then(clickLoop);
  }).then(function() {
    return {
      views: views, clicked: clicked, skipped: skipped, notes: notes,
      truncated: truncated, navCandidateCount: (spa.navCandidates || []).length
    };
  });

  // Tier 2 — click safe nav controls, re-enumerating each step.
  function clickLoop() {
    var triedKeys = {}, guard = 0;
    function step() {
      if (capExceeded() || guard++ > 60) { if (guard > 60) notes.push('exploration guard limit'); return; }
      var cands = liveCandidates(), next = null, nextKey = null;
      for (var i = 0; i < cands.length; i++) {
        var key = candKey(cands[i]);
        if (triedKeys[key]) continue;
        var reason = unsafeReason(cands[i]);
        if (reason) { triedKeys[key] = 1; skipped.push({ label: labelOf(cands[i]).substring(0, 40) || cands[i].tagName.toLowerCase(), reason: reason }); continue; }
        next = cands[i]; nextKey = key; break;
      }
      if (!next) return; // nothing new and safe to click
      triedKeys[nextKey] = 1;
      var label = labelOf(next).substring(0, 40) || next.tagName.toLowerCase();
      var before = domSignature();
      try { next.click(); } catch (e) { skipped.push({ label: label, reason: 'click-error' }); return step(); }
      return settle().then(function() {
        var after = domSignature();
        var changed = after !== before;
        clicked.push({ label: label, changed: changed });
        if (changed && !seenSigs[after]) {
          seenSigs[after] = true;
          pushView(stateKeyFor(label, views.length), label, 'click:' + label);
        }
        return step();
      });
    }
    return Promise.resolve().then(step);
  }
};
