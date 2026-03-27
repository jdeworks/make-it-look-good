# Multi-Viewport and Dark Mode Variant Testing — Feasibility Research

> **TL;DR:** Multi-viewport testing is straightforward in iframe/URL mode (spawn 3 iframes at different widths, merge results) and partially possible in snippet mode (self-iframe trick). Dark mode testing is reliable for class-based sites (toggle `.dark` and re-extract) but harder for `prefers-color-scheme` sites — the best JS-only workaround is injecting a `<style>` block that rewrites `@media (prefers-color-scheme: dark)` rules into unconditional rules, which works but has edge cases.

---

## Multi-Viewport Testing

### 1. Snippet approach (runs on the live page)

**Can the snippet resize the viewport?**
No. `window.resizeTo()` is blocked by every modern browser for windows not opened by `window.open()`. Even for script-opened windows, many browsers ignore it. This is a dead end.

**Self-iframe trick:**
The snippet can create a same-origin `<iframe>` pointed at the current page (`location.href`) at a different width (e.g., 375px). Since the iframe is same-origin, the snippet can reach into it with `iframe.contentDocument` and run extraction logic.

Feasibility assessment:
- **Works:** The iframe gets its own layout at the specified width. Media queries fire. `getComputedStyle()` returns the correct responsive values. Elements reflow.
- **Caveat 1 — Network cost:** The page is fetched again (though browser cache helps). For pages with heavy JS initialization, this could mean duplicate API calls, analytics events, auth token refreshes.
- **Caveat 2 — Auth/session pages:** If the page is behind login, the iframe load will typically work (same-origin, same cookies). But some SPAs detect iframe embedding via `window.top !== window.self` and refuse to render.
- **Caveat 3 — CSP `frame-ancestors`:** Pages with `Content-Security-Policy: frame-ancestors 'none'` or `X-Frame-Options: DENY` will refuse to load in a self-iframe. This includes many banking, email, and enterprise apps.
- **Caveat 4 — SPA routing:** For SPAs using `pushState`, the iframe loads the same route, but JS initialization may produce a different state (e.g., the SPA redirects to a default route).
- **Estimated failure rate:** ~15-25% of real sites due to CSP/frame-busting/SPA issues.

**Verdict:** Partially viable. The snippet can offer "test at mobile width" as a best-effort feature with a clear disclaimer that it re-loads the page in a hidden iframe. It should not be the default — it's an opt-in extra.

### 2. Iframe approach (URL mode)

**Spawning multiple iframes at different sizes:**
The analyzer already creates one hidden iframe with `position:fixed; top:-9999px; left:-9999px; width:Wpx; height:Hpx`. Creating 3 iframes (375px, 768px, 1280px) with the same `srcdoc` is trivial.

Feasibility assessment:
- **Works reliably:** Same-origin srcdoc iframes. No CSP issues (the content is injected, not navigated to). Media queries respond to iframe width. `getComputedStyle()` returns responsive values.
- **Performance:** Three iframes means 3x the rendering work. Each iframe must:
  - Parse HTML + CSS (fast — it's the same srcdoc, browser caches parsed resources)
  - Execute Tailwind CDN or other CSS framework JS (this is the bottleneck — ~500ms each)
  - Run the extraction script (~200-500ms depending on DOM size)
  - Total: roughly 1.5-3 seconds per iframe, so ~4.5-9 seconds for all three sequentially
- **Parallel execution:** All 3 iframes can be created simultaneously. The browser will render them in parallel (they're independent documents). Extraction scripts fire independently and `postMessage` back. Total wall-clock time: ~2-4 seconds (roughly the cost of the slowest iframe, plus overhead).
- **Memory:** Each iframe holds a full DOM copy. For a typical page (500-2000 elements), this is ~5-15 MB per iframe. Three iframes = ~15-45 MB. Acceptable for desktop; potentially tight on low-end mobile devices.

**Verdict:** This is the best approach. Parallel iframes at 3 widths, merge results. The current architecture already supports this — just create 3 iframes instead of 1.

### 3. What changes between viewports?

**Must re-check (values change with viewport):**
- **Touch target sizes:** Responsive padding/sizing (e.g., `py-2 md:py-3`). A button might be 44px tall on mobile and 36px on desktop.
- **Line length (characters per line):** A `max-w-prose` paragraph is fine, but an unconstrained paragraph changes dramatically. This is one of the highest-value checks across viewports.
- **Layout type:** Flex/grid changes (e.g., `flex-col md:flex-row`). A card grid might be 1-col on mobile, 3-col on desktop.
- **Element visibility:** Mobile hamburger vs desktop nav. `hidden md:block` elements. This affects what gets scored.
- **Font sizes:** Fluid typography (`clamp()`) or responsive size classes (`text-sm md:text-base`).
- **Spacing/padding:** Responsive spacing affects visual hierarchy and density scores.

**Can skip (viewport-independent):**
- **Color palette:** Same colors at every width (unless someone does `dark:md:bg-blue-500`, which is rare).
- **Font families:** Don't change with viewport.
- **Contrast ratios:** Same colors = same ratios.
- **Border radii, shadows:** Rarely viewport-dependent.

**Optimization:** Run the full extraction at the primary viewport. At additional viewports, only re-extract the viewport-sensitive subset: element dimensions, visibility, computed font sizes, line widths. Skip color sampling, font enumeration, and gradient analysis. This could cut per-viewport extraction time by 60-70%.

### 4. Merging results

**Option A — Per-viewport breakdown (recommended):**
Show results with a viewport switcher (tabs or segmented control: Phone | Tablet | Desktop). Each viewport gets its own score. The user sees exactly what's wrong at each size.

**Option B — Worst-case-per-check:**
Take the lowest score for each check across viewports. Pro: single score, simple. Con: a check failing only on phone drags down the overall score even if the user only cares about desktop.

**Option C — Weighted composite:**
Weight viewports by traffic share (e.g., phone 55%, desktop 35%, tablet 10%). More "correct" but requires assumptions about the user's traffic.

**Recommendation:** Option A (per-viewport breakdown) with the overall score being the primary viewport's score. Show badges like "3 mobile-only issues" on the other viewports. This gives the user full information without confusing the single-number score.

### 5. Timing concerns

**Lazy loading and scroll-triggered content:**
- At 375px width, content stacks vertically. More elements are "above the fold" in terms of document flow, but less is visible in the viewport. `IntersectionObserver`-triggered content won't fire because the iframe is off-screen (all elements have negative position).
- **Fix:** After initial load, scroll the iframe's `contentWindow` programmatically: `iframe.contentWindow.scrollTo(0, iframe.contentDocument.body.scrollHeight)`, wait 500ms, then scroll back and extract. This triggers most intersection observers and lazy-load handlers.
- **Load event timing:** The current code waits for `window.load` + 1000ms timeout, with an 8000ms hard fallback. This is reasonable. For multi-viewport, the same timeouts apply per iframe.
- **Recommendation:** Keep the current 1-second-after-load approach. Add the scroll trick for URL mode. Don't increase timeouts — if content hasn't rendered by then, it's unlikely to help.

---

## Dark Mode Variant Testing

### 1. How to trigger dark mode

**Class-based dark mode (Tailwind, most component libraries):**

Sites use one of these patterns:
- `<html class="dark">` — Tailwind default
- `<body class="dark-mode">` or `<body class="dark-theme">` — common convention
- `<html data-theme="dark">` — DaisyUI, some headless UI systems
- `<html data-mode="dark">` — less common

To trigger: add the appropriate class/attribute to `<html>` or `<body>`, wait for styles to recompute (~50ms), then re-extract colors.

**`prefers-color-scheme` media query:**

This is the OS-level preference. Sites using only this approach have no class toggle — their dark styles live entirely inside `@media (prefers-color-scheme: dark) { ... }`.

**The problem:** JavaScript cannot change the result of `window.matchMedia('(prefers-color-scheme: dark)')`. The browser evaluates this based on the OS setting. There is no `window.matchMedia.override()` API.

**Workarounds for `prefers-color-scheme`:**

#### Approach A — `matchMedia` monkey-patch (does NOT work for CSS)
You can override `window.matchMedia` to return a fake result:
```js
window.matchMedia = function(query) {
  if (query === '(prefers-color-scheme: dark)') {
    return { matches: true, media: query, addEventListener: function(){}, removeEventListener: function(){} };
  }
  return originalMatchMedia(query);
};
```
**Problem:** This only affects JS code that calls `matchMedia()`. It does NOT affect CSS `@media` rules. The browser's CSS engine evaluates media queries internally — it doesn't call JS `matchMedia`. So dark mode styles defined purely in CSS won't activate. This approach is nearly useless.

#### Approach B — Inject a `<style>` that rewrites dark-mode rules (WORKS)
Read all stylesheets, find rules inside `@media (prefers-color-scheme: dark)`, extract those rules, and inject them as unconditional (non-media-queried) styles at the end of `<head>`.

```js
// Pseudocode
for (const sheet of document.styleSheets) {
  for (const rule of sheet.cssRules) {
    if (rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-color-scheme: dark')) {
      // Extract inner rules and inject them without the media wrapper
      injectedStyles += Array.from(rule.cssRules).map(r => r.cssText).join('\n');
    }
  }
}
const style = document.createElement('style');
style.textContent = injectedStyles;
document.head.appendChild(style);
```

**Assessment:**
- **Works for same-origin stylesheets.** `cssRules` is accessible for same-origin and inline `<style>` tags.
- **Fails for cross-origin stylesheets** (e.g., Google Fonts, CDN-hosted CSS) unless they have `crossorigin` attribute or CORS headers. Accessing `cssRules` on a cross-origin sheet throws `SecurityError`. However, cross-origin sheets rarely contain `prefers-color-scheme` rules (they're usually font-face declarations), so this is acceptable.
- **Edge case — nested media queries:** `@media (prefers-color-scheme: dark) and (min-width: 768px)` needs the viewport condition preserved while removing the color-scheme condition. This requires parsing the media query text, which is doable but adds complexity.
- **Edge case — `:root` variables:** Many sites define dark mode via CSS custom properties: `@media (prefers-color-scheme: dark) { :root { --bg: #1a1a1a; } }`. Injecting these as unconditional rules works because the injected `<style>` comes later in document order and overrides the light-mode `:root` values.
- **Estimated reliability:** ~80-85% of sites using `prefers-color-scheme`. Main failures: cross-origin stylesheets with dark rules (rare), heavily dynamic CSS-in-JS that doesn't use stylesheets.

#### Approach C — iframe with srcdoc (URL mode only — BEST for URL mode)
In URL mode, the analyzer controls the iframe's `srcdoc`. Before setting `srcdoc`, inject a `<style>` at the top that force-applies dark mode by both:
1. Adding `class="dark"` to `<html>` (covers Tailwind/class-based)
2. Injecting the extracted `prefers-color-scheme: dark` rules as unconditional styles

Since the srcdoc is constructed before the iframe renders, this sidesteps the cross-origin stylesheet issue — the stylesheets are already inlined during the proxy fetch step.

**This is the most reliable approach for URL mode.** The proxy-fetch step already inlines external stylesheets (see `analyzer.js` line 647: "Find and inline linked stylesheets so CSS works inside srcdoc iframe"). Since they're inlined, `cssRules` access won't throw `SecurityError`.

### 2. What changes in dark mode?

**Must re-check:**
- Background colors (obviously)
- Text colors
- Border colors
- Shadow colors and visibility (shadows often become invisible or change to lighter glows)
- Contrast ratios (the most important check — dark mode frequently has worse contrast)
- Link/accent colors against dark backgrounds
- Image/icon visibility (dark icons on dark backgrounds)

**Can skip (same in light and dark):**
- Touch target sizes
- Typography (font size, line height, font family)
- Layout and spacing
- Animation timing
- Element structure

**Optimization:** For dark mode, only re-extract the color-related data: background colors, text colors, border colors. Skip element dimensions, font metrics, structure analysis. This reduces extraction time by ~70%.

### 3. Detecting which dark mode approach the site uses

A detection function should check in priority order:

1. **Check for class/attribute toggles already present:**
   - `document.documentElement.classList.contains('dark')` or `dataset.theme`
   - Presence of `.dark` or `[data-theme="dark"]` in any stylesheet rule selector

2. **Scan stylesheets for `prefers-color-scheme` rules:**
   ```js
   Array.from(document.styleSheets).some(sheet => {
     try {
       return Array.from(sheet.cssRules).some(rule =>
         rule instanceof CSSMediaRule &&
         rule.conditionText.includes('prefers-color-scheme')
       );
     } catch(e) { return false; } // cross-origin sheet
   });
   ```

3. **Scan HTML for Tailwind `dark:` variants:**
   ```js
   /class="[^"]*dark:/.test(document.documentElement.outerHTML)
   ```

4. **Check for dark mode toggle buttons** (heuristic):
   Look for buttons/switches with aria-label or text containing "dark", "theme", "mode", "light".

The existing code in `analyzer.js` (line 127) already does a version of this for the `darkModeClasses` field. This can be extended to return an enum: `"class-html"`, `"class-body"`, `"data-attribute"`, `"media-query"`, `"tailwind-dark"`, `"none-detected"`.

### 4. `matchMedia` override — full assessment

As covered in Section 1 Approach A: **monkey-patching `window.matchMedia` does not affect CSS rendering.** The CSS engine is native C++ code that evaluates media queries independently of the JS API. The JS `matchMedia` API is a read-only reflection, not a control mechanism.

**Chrome DevTools approach:** DevTools uses the Chrome DevTools Protocol (CDP) command `Emulation.setEmulatedMedia` with `features: [{name: 'prefers-color-scheme', value: 'dark'}]`. This actually changes the browser's internal media query evaluation. But:
- CDP is only available via the DevTools protocol (WebSocket connection to the browser's debugging port)
- Not available from page JS, content scripts, or even regular extensions
- Only available in Chromium-based browsers

**Puppeteer/Playwright can do this** via `page.emulateMediaFeatures([{name: 'prefers-color-scheme', value: 'dark'}])`. But we're running client-side in a browser, not in a Node.js automation tool.

**Conclusion:** There is no way to truly override `prefers-color-scheme` from client-side JS. The stylesheet rewriting approach (Section 1, Approach B/C) is the only viable path.

### 5. CSS `@media` override via style injection

**The rewriting approach in detail:**

For the iframe/URL mode (where stylesheets are inlined):

```js
// After iframe loads, before extraction:
const doc = iframe.contentDocument;
let darkCSS = '';

for (const sheet of doc.styleSheets) {
  try {
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSMediaRule) {
        const cond = rule.conditionText;
        if (cond.includes('prefers-color-scheme: dark')) {
          // Simple case: only prefers-color-scheme condition
          if (cond.trim() === '(prefers-color-scheme: dark)') {
            darkCSS += Array.from(rule.cssRules).map(r => r.cssText).join('\n');
          }
          // Compound case: prefers-color-scheme AND other conditions
          // Strip the color-scheme part, keep the rest as a media query
          else {
            const remaining = cond
              .replace(/\(prefers-color-scheme:\s*dark\)/g, '')
              .replace(/^\s*and\s+/i, '')
              .replace(/\s+and\s*$/i, '')
              .trim();
            if (remaining) {
              darkCSS += '@media ' + remaining + ' {\n' +
                Array.from(rule.cssRules).map(r => r.cssText).join('\n') +
                '\n}\n';
            } else {
              darkCSS += Array.from(rule.cssRules).map(r => r.cssText).join('\n');
            }
          }
        }
      }
    }
  } catch(e) { /* cross-origin sheet — skip */ }
}

if (darkCSS) {
  const style = doc.createElement('style');
  style.textContent = darkCSS;
  doc.head.appendChild(style);
}
```

**Edge cases:**
- **`@media (prefers-color-scheme: dark) and (min-width: 768px)`:** The compound-condition handling above preserves the `min-width` part. This works correctly.
- **`@media not (prefers-color-scheme: light)`:** Equivalent to dark, but harder to detect. Should match on `prefers-color-scheme` in general and handle `not` + `light` as equivalent to dark.
- **Nested `@layer` or `@supports` inside the media query:** `CSSMediaRule.cssRules` returns the inner rules correctly, including nested at-rules. These are preserved by `.cssText`.
- **CSS custom properties cascading:** If light mode defines `--bg: white` and dark mode defines `--bg: #111`, injecting the dark rule at the end of `<head>` correctly overrides due to cascade order. This works.
- **`!important` conflicts:** Some sites use `!important` in light mode base styles. The injected dark rules without `!important` won't override them. This is an edge case that's difficult to solve without parsing every property declaration.

---

## Practical Recommendations

### Multi-viewport testing

| Aspect | Snippet mode | Iframe/URL mode |
|---|---|---|
| **Approach** | Create same-origin iframe of current page at target width | Spawn 3 parallel iframes with same srcdoc at different widths |
| **Reliability** | ~75-85% (CSP/frame-busting blocks some sites) | ~98% (same-origin srcdoc, no CSP issues) |
| **Performance** | Page re-fetches + re-renders (~2-5s per viewport) | Parallel render (~2-4s total for all 3) |
| **Recommendation** | Offer as opt-in "Test mobile layout" button. Not default. | **Implement this.** Low complexity, high value. |

**Concrete plan for iframe/URL mode:**
1. Add a "Multi-viewport" checkbox/toggle (default off for speed, but easy to enable)
2. When enabled, create 3 iframes (375, 768, 1280) in parallel instead of 1
3. Each iframe runs the extraction script and `postMessage`s results back
4. Show results with a viewport tab bar; primary viewport is the one selected in the dropdown
5. Only re-extract viewport-sensitive checks at secondary viewports (dimensions, visibility, font sizes, line length). Reuse color/typography/structure data from the primary viewport.
6. Estimated added complexity: ~150 lines of JS. Moderate.

**Concrete plan for snippet mode:**
1. Add an optional "Also check at mobile width" button in the snippet output
2. When clicked, create a 375px iframe of `location.href`, run extraction, merge results
3. Show a "Mobile" tab alongside the main results
4. Mark as "best effort" — some pages will block self-iframing
5. Estimated added complexity: ~80 lines of JS. Low.

### Dark mode testing

| Aspect | Snippet mode | Iframe/URL mode |
|---|---|---|
| **Class-based sites** | Toggle class on `<html>`/`<body>`, wait 50ms, re-extract colors. Reliable (~95%). | Same — toggle class on iframe's `documentElement`. Reliable. |
| **`prefers-color-scheme` sites** | Stylesheet rewriting (Approach B). ~80% reliable. Cross-origin sheets may block access. | Stylesheet rewriting (Approach C). ~90% reliable — stylesheets already inlined by proxy step. |
| **Hybrid sites (class + media query)** | Toggle class handles the class part. Stylesheet rewriting handles the media query part. Both needed. | Same. |
| **Detection** | Scan for `.dark` classes, `data-theme` attributes, `prefers-color-scheme` rules. Already partially implemented. | Same detection, but run inside iframe context. |
| **Recommendation** | Implement class toggle (easy). Stylesheet rewriting as opt-in advanced feature. | **Implement both.** Inlined stylesheets make rewriting reliable. |

**Concrete plan:**
1. **Detection phase:** Before extraction, detect which dark mode mechanism the site uses (extend existing `darkModeClasses` detection). Return: `{ type: 'class'|'data-attr'|'media-query'|'tailwind'|'none', target: 'html'|'body', className: 'dark'|'dark-mode'|... }`.
2. **Toggle phase:** Based on detection:
   - Class-based: `doc.documentElement.classList.add('dark')` (or whatever was detected)
   - Data attribute: `doc.documentElement.dataset.theme = 'dark'`
   - Media query: inject rewritten stylesheet rules
   - Tailwind: add `class="dark"` to `<html>` (Tailwind's `dark:` variants activate via this class)
3. **Re-extract:** Only re-run color-related extraction (backgrounds, text colors, borders). Skip layout, typography metrics, structure.
4. **Present:** Show a "Dark mode" toggle in results. When toggled, show the dark-mode color scores (contrast, palette consistency, etc.).
5. **Estimated added complexity:** ~200 lines of JS (detection + toggle + rewriting + re-extraction). Moderate-high.

### Priority order

1. **Multi-viewport in URL mode** — Highest value, lowest risk. The architecture already supports it. Most design issues surface at mobile widths. Implement first.
2. **Dark mode class toggle** — High value, low complexity. Most dark-mode sites use classes. A few lines of detection + toggle code.
3. **Dark mode media query rewriting** — Medium value, medium complexity. Handles the remaining sites. More edge cases but the inlined-stylesheet approach in URL mode makes it manageable.
4. **Multi-viewport in snippet mode** — Lower priority. The snippet already runs at the user's current viewport. If they want mobile testing, they can use URL mode. The self-iframe trick is fragile.

### What's NOT worth doing

- **`window.resizeTo()`** — Blocked by browsers. Dead end.
- **`matchMedia` monkey-patching for CSS** — Does not affect CSS rendering. Only useful for JS-side detection.
- **Full re-extraction at every viewport** — Wasteful. Color data doesn't change with viewport width. Only re-extract layout-sensitive metrics.
- **More than 3 viewports** — Diminishing returns. 375/768/1280 covers phone/tablet/desktop. Adding 1920 or 320 adds noise without actionable insight.

---

## Sources and References

- [MDN: window.resizeTo()](https://developer.mozilla.org/en-US/docs/Web/API/Window/resizeTo) — Documents the browser restriction on resizing windows not opened by script.
- [MDN: CSSMediaRule](https://developer.mozilla.org/en-US/docs/Web/API/CSSMediaRule) — API for reading media query conditions and inner rules from stylesheets.
- [MDN: SecurityError on cross-origin CSSStyleSheet.cssRules](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/cssRules) — Documents the cross-origin restriction.
- [Chrome DevTools Protocol: Emulation.setEmulatedMedia](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setEmulatedMedia) — The CDP command that DevTools uses to override media features (not available from page JS).
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode) — Documents the `class` strategy (`dark:` variants activate when `<html>` has `class="dark"`).
- [CSSOM: CSSRule.cssText](https://developer.mozilla.org/en-US/docs/Web/API/CSSRule/cssText) — Used to serialize extracted rules back to CSS text for re-injection.
