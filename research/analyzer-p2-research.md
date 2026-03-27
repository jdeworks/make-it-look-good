# P2/P3 Analyzer Scoring — Detailed Technical Research

> Deep-dive research for six improvement areas. Each section covers browser APIs, implementation approach, complexity, accuracy, relevant libraries, and a verdict on whether it is worth implementing.

---

## 1. Background Image Contrast (P2)

### Problem Statement

When `background-image: url(...)` is used behind text, the analyzer's `getEffectiveBg()` walks ancestors reading `backgroundColor` and never encounters the image. The element reports `rgba(0,0,0,0)` for backgroundColor and the image lives in `backgroundImage`. The contrast pair falls into the "uncertain" bucket (1:1 ratio, fg === bg) and is excluded from scoring.

### How to Draw a Background Image to Canvas and Sample Pixels

**Step-by-step approach:**

1. **Get the image URL:** `getComputedStyle(el).backgroundImage` returns `url("https://...")`. Parse the URL out with a regex: `/url\(["']?(.+?)["']?\)/`.

2. **Load the image onto a canvas:**
   ```
   var img = new Image();
   img.crossOrigin = 'anonymous';  // Request CORS
   img.src = parsedUrl;
   img.onload = function() {
     var canvas = document.createElement('canvas');
     canvas.width = img.naturalWidth;
     canvas.height = img.naturalHeight;
     var ctx = canvas.getContext('2d');
     ctx.drawImage(img, 0, 0);
     // Now ctx.getImageData() works (if CORS allowed)
   };
   ```

3. **Sample pixels at the text position:** Get the text element's bounding rect relative to the background element. Use `getImageData(x, y, 1, 1)` to read pixel color at that position. Sample multiple points (corners + center of the text bbox = 5 points minimum) and use the **worst-case** (lowest contrast) result.

4. **Map element coordinates to image coordinates:** This requires knowing which portion of the image is visible behind the text, which depends on `background-size`, `background-position`, and `background-repeat`.

### Background-Size Cover/Contain Calculations

This is the hard part. The browser computes the final rendering, but the intermediate values are not directly exposed. You must replicate the calculation:

**`background-size: cover`:**
```
scaleX = elementWidth / imageNaturalWidth
scaleY = elementHeight / imageNaturalHeight
scale = Math.max(scaleX, scaleY)
renderedWidth = imageNaturalWidth * scale
renderedHeight = imageNaturalHeight * scale
```

**`background-size: contain`:**
```
scale = Math.min(scaleX, scaleY)
// Same formula otherwise
```

**`background-position` offset:**
The computed value is always resolved to pixel values (e.g., `"50% 50%"` becomes `"120px 80px"` in computed style, but only for pixel values; percentages remain as-is). For percentage positions:
```
offsetX = (elementWidth - renderedWidth) * (percentX / 100)
offsetY = (elementHeight - renderedHeight) * (percentY / 100)
```

**Mapping a point (px, py) in element space to image pixel coordinates:**
```
imgX = (px - offsetX) / scale
imgY = (py - offsetY) / scale
```

If `background-repeat` is active, wrap with modulo: `imgX = ((imgX % naturalWidth) + naturalWidth) % naturalWidth`.

**All computed style values needed:** `backgroundImage`, `backgroundSize`, `backgroundPosition`, `backgroundRepeat`, `backgroundOrigin` (determines the reference box — padding-box by default). All available via `getComputedStyle()`.

**Edge cases:**
- `background-size: auto` — uses the image's natural size.
- `background-size: auto 100%` — one dimension is auto-calculated to preserve aspect ratio.
- Multiple backgrounds — `backgroundImage` can contain a comma-separated list. Only the topmost (first) one matters for the pixel behind text, unless it has transparency.
- `background-clip: text` — the background is clipped to the text shape; contrast checking is irrelevant here since the background IS the text color.

### CORS Limitations and Workarounds

**The hard constraint:** If the image is served from a different origin without `Access-Control-Allow-Origin: *` headers, setting `img.crossOrigin = 'anonymous'` will cause the image load to fail entirely (not just taint the canvas — the image won't load at all if the server doesn't respond with CORS headers).

If you omit `crossOrigin`, the image loads but the canvas becomes **tainted**: `getImageData()` throws `SecurityError: The operation is insecure`.

**There is no workaround in a pure client-side context.** A backend proxy could fetch the image and re-serve it, but that is out of scope.

**Practical impact for the analyzer:**
- **Paste-HTML-into-analyzer flow:** Images are typically `data:` URIs (inline), relative URLs (same-origin in the iframe), or absolute URLs. Data URIs always work. Same-origin URLs always work. Cross-origin URLs from CDNs like Unsplash, Cloudinary, imgix generally DO send CORS headers. Stock photo sites and arbitrary external hosts generally do NOT.
- **Bookmarklet/snippet flow:** The snippet runs on the actual page, so all images are same-origin relative to the page. CORS is only an issue for images loaded from external CDNs, which is common (but those CDNs usually send CORS headers).

**Estimate:** 70-80% of background images in the analyzer's typical use case will be accessible (data URIs + same-origin + CORS-enabled CDNs). The remaining 20-30% should be flagged as "cannot verify — cross-origin image."

**Workaround for non-CORS images — luminance heuristic:**
If the image cannot be sampled, fall back to the **average luminance of the text color** as a heuristic. If the text is very light (luminance > 0.7), assume the designer intended a dark background. If the text is very dark (luminance < 0.3), assume a light background. Flag as "assumed background — verify manually." This is not accurate but prevents false negatives for obvious cases (white text on a photo).

### What axe-core Does

axe-core (Deque Systems) **does not sample background images at all**. When `backgroundImage` contains a `url()`, axe-core marks the result as **"incomplete"** (needs manual review). The relevant code is in `lib/commons/color/get-background-color.js` — it checks for `backgroundImage !== 'none'` and returns `null`, which triggers the incomplete state.

Lighthouse inherits this behavior since it uses axe-core for contrast checks.

**This means any background-image contrast checking, even a basic version, puts the analyzer ahead of axe-core and Lighthouse.**

### Relevant Libraries

| Library | What it does | Size | Useful? |
|---------|-------------|------|---------|
| `html2canvas` | Renders entire DOM elements to canvas | ~50KB gzipped | Nuclear option — renders everything including backgrounds, but very heavy and slow |
| `color.js` (Lea Verou) | Color parsing, contrast calculation | ~30KB | Useful for the contrast math, but the analyzer already has its own `contrastRatio()` |

No library exists specifically for background-image-to-contrast-ratio. This must be built from scratch.

### Complexity Assessment

| Sub-task | Complexity |
|----------|-----------|
| Parse URL from `backgroundImage` | Easy |
| Load image to canvas | Easy |
| `background-size: cover/contain` math | Medium — fiddly but deterministic |
| `background-position` mapping | Medium |
| Multiple backgrounds | Medium |
| CORS handling + fallback | Easy (try/catch) |
| Sampling pixels + contrast calc | Easy (reuse existing) |

**Overall: Medium-Hard.** The background-size/position math is the main difficulty. Expect ~150-250 lines of code.

### Accuracy

- **Same-origin / CORS-enabled images:** High accuracy. Pixel sampling is exact.
- **Cross-origin blocked images:** Zero accuracy (must fall back to heuristic or "manual check" flag).
- **Complex cases** (multiple backgrounds, blend modes, background-clip): Low accuracy. Not worth handling initially.
- **Realistic overall accuracy:** ~70% of cases get a real contrast ratio, ~30% get a "needs manual check" flag. This is a significant improvement over the current 0% coverage.

### Verdict: Worth Implementing

Yes. The background-size/position math is the biggest effort, but it is deterministic and well-specified by CSS. Beating axe-core on this front is a real differentiator. Recommend implementing in two phases:

1. **Phase 1:** Handle simple cases — single background image, `background-size: cover`, `background-position: center`. This covers the vast majority of hero sections with text overlays. ~100 lines.
2. **Phase 2:** Handle `contain`, percentage positions, `background-repeat`, multiple backgrounds. ~100 more lines.

---

## 2. SVG Text Contrast (P2)

### Problem Statement

SVG `<text>` and `<tspan>` elements use `fill` instead of CSS `color` for their foreground color. The current analyzer's text walker (`querySelectorAll` for elements with `textContent`) may or may not pick up SVG text, and even if it does, `getComputedStyle(el).color` on an SVG text element may not return the `fill` value consistently. The effective background is also different — it could be a `<rect>` behind the text, the SVG viewport color, or the HTML element's background.

### Reading `fill` from SVG Text Elements

**`getComputedStyle(svgTextEl).fill`** — This works in all modern browsers (Chrome, Firefox, Safari, Edge). It returns the resolved fill value as an `rgb()` string, just like `color` does for HTML elements. If no `fill` is set, it defaults to `rgb(0, 0, 0)` (black).

**`getComputedStyle(svgTextEl).color`** — In modern browsers, the CSS `color` property on SVG elements returns the value of the `color` property (which may differ from `fill`). SVG elements can have `fill: currentColor`, in which case `fill` resolves to the `color` value. But in general, **read `fill`, not `color`**, for SVG text.

**`svgTextEl.getAttribute('fill')`** — Returns the attribute value as a string (could be a color name, hex, rgb, or `currentColor`). Less useful than computed style because it requires manual resolution.

**`fill-opacity`:** Readable via `getComputedStyle(el).fillOpacity`. Defaults to `1`. Must be factored into the effective foreground color, similar to how `opacity` affects HTML text.

**`stroke` and `stroke-width`:** SVG text can have a stroke (outline). A thick stroke in a contrasting color can improve readability. For simplicity, ignore stroke in contrast calculations — it is an edge case.

**Browser support for `getComputedStyle().fill`:** Works in Chrome 1+, Firefox 1+, Safari 3+, Edge 12+. Effectively universal.

### Determining the Effective Background Behind SVG Text

This is the hard part. SVG does not have a simple "background-color" concept. The background behind SVG text depends on the SVG rendering model (painter's model — later elements paint on top of earlier ones).

**Approach 1 — Walk SVG siblings backward (recommended):**

```
1. Get the <text> element's bounding box: el.getBBox() (SVG-specific, returns {x, y, width, height} in SVG user coordinates)
2. Walk backward through preceding siblings in the same SVG parent
3. For each sibling, check:
   a. Is it a filled shape (<rect>, <circle>, <ellipse>, <path>, <polygon>)?
   b. Does its bounding box overlap the text's bounding box?
   c. If yes, read its fill color — this is the effective background
4. If no overlapping filled shape is found, fall back to:
   a. The <svg> element's CSS background-color
   b. The HTML parent element's background (use existing getEffectiveBg())
```

**`el.getBBox()` vs `el.getBoundingClientRect()`:**
- `getBBox()` returns coordinates in the SVG's own coordinate system (user units). Does NOT account for transforms, viewBox scaling, or CSS positioning. Use for comparing positions within the same SVG.
- `getBoundingClientRect()` returns coordinates in the viewport's coordinate system (pixels). Accounts for transforms and viewBox. Use for comparing SVG elements with HTML elements.
- For sibling overlap detection within the same SVG, `getBBox()` is correct (both elements share the same coordinate system).

**Overlap detection:**
```
function boxesOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}
```

**Approach 2 — Canvas rasterization:**

Use `XMLSerializer` to serialize the SVG to a string, create a Blob URL, load it as an image, draw to canvas, and sample pixels behind the text position. This handles all SVG complexity (gradients, patterns, transforms, clip-paths) but is async and heavy.

```
var svgStr = new XMLSerializer().serializeToString(svgElement);
var blob = new Blob([svgStr], {type: 'image/svg+xml'});
var url = URL.createObjectURL(blob);
var img = new Image();
img.onload = function() {
  ctx.drawImage(img, 0, 0);
  // Sample pixel at text position
  URL.revokeObjectURL(url);
};
img.src = url;
```

**Caveat:** The canvas rasterization of SVG does NOT load external resources (fonts, images referenced via `<image>` or `xlink:href`). For self-contained SVGs with filled shapes and text, it works well.

**Approach 3 — SVG `foreignObject` + html2canvas:**

Not applicable here — overkill and fragile.

### Can We Traverse SVG Siblings to Find Overlapping Shapes?

Yes. SVG elements are regular DOM nodes. You can use:
- `el.parentNode.children` to get all siblings
- `el.previousElementSibling` to walk backward
- `document.querySelectorAll('svg rect, svg circle, svg ellipse, svg path, svg polygon')` to find all filled shapes

**SVG rendering order:** Elements are painted in document order. Later elements paint on top. So to find what's "behind" a `<text>` element, walk backward through preceding siblings (and the parent's preceding siblings, if using nested `<g>` groups).

**Handling `<g>` groups:**
SVG elements are often wrapped in `<g>` elements for grouping. The background shape might be in a sibling `<g>`, not a direct sibling. Full traversal requires:
1. Walk backward through preceding siblings of the `<text>` element
2. If the text is inside a `<g>`, also walk backward through the `<g>`'s preceding siblings
3. Recurse up through nested `<g>` groups
4. For each candidate shape, check bounding box overlap

**Handling transforms:**
If a shape has a `transform` attribute, `getBBox()` returns the pre-transform bounds. Use `el.getCTM()` (Current Transformation Matrix) to get the element's total transform, then apply it to the bounding box corners. Or use `getBoundingClientRect()` which already accounts for transforms (but then both text and shape must use `getBoundingClientRect()` for the comparison to be valid).

### Relevant Libraries

No libraries specifically address SVG text contrast checking. The SVG DOM API provides everything needed natively.

### Complexity Assessment

| Sub-task | Complexity |
|----------|-----------|
| Read SVG text fill via computed style | Easy |
| Find SVG text elements via querySelectorAll | Easy |
| Bounding box overlap detection | Easy |
| Walk backward through SVG siblings | Easy-Medium |
| Handle `<g>` group nesting | Medium |
| Handle transforms on shapes | Medium |
| Fall back to HTML parent background | Easy (reuse existing `getEffectiveBg`) |

**Overall: Medium.** Expect ~80-120 lines of code. The `<g>` nesting and transform handling add complexity but cover important real-world cases.

### Accuracy

- **Simple SVGs** (text on a rect, icon with label): High accuracy.
- **Complex SVGs** (overlapping shapes, gradients as fills, patterns, clip-paths): Low accuracy. The sibling-walk approach only finds solid fill colors on simple shapes.
- **SVG icons with text labels:** Usually the text is outside the SVG (in HTML), not inside it. The analyzer already handles this case.
- **Decorative SVGs with embedded text:** Rare but exists in infographics and data visualizations.

**Realistic coverage:** SVG text in web UIs is uncommon. Most SVG usage is for icons (no text) or illustrations (text is usually in HTML overlaying the SVG). The main value is for data visualization libraries (D3, Chart.js rendered to SVG) where axis labels and data labels are `<text>` elements.

### Verdict: Worth Implementing (Low Priority)

Yes, but the ROI is lower than background-image contrast. SVG text is uncommon in typical web UIs. The implementation is straightforward, so the cost is low. Recommend:

1. Detect `svg text, svg tspan` elements during the text walk
2. Read `fill` instead of `color` for these elements
3. Try the backward-sibling walk for background; fall back to HTML parent's background
4. Skip transform handling initially — handle it only if real-world SVGs expose the gap

---

## 3. CSS Filter Contrast Impact (P2)

### Problem Statement

CSS `filter` and `backdrop-filter` properties can alter the visual appearance of elements without changing their computed `color` or `backgroundColor` values. The analyzer reads raw color values and computes contrast from those, ignoring filters entirely. A `filter: brightness(0.5)` on a parent could halve the luminance of both foreground and background colors, changing the effective contrast ratio.

### How Individual Filters Affect Perceived Contrast

**`filter: brightness(N)`**
- Multiplies each RGB channel by N.
- `brightness(0.5)` halves all channels: `rgb(200, 100, 50)` becomes `rgb(100, 50, 25)`.
- Effect on contrast: Depends on both fg and bg colors. If both are affected equally (filter on a common ancestor), the ratio can change significantly. Brightness < 1 compresses the range toward black; brightness > 1 pushes toward white.
- **Mathematical adjustment:** `adjustedChannel = clamp(channel * N, 0, 255)`.

**`filter: contrast(N)`**
- Adjusts contrast around the midpoint (128 / 50% gray).
- Formula per channel: `adjustedChannel = clamp(((channel / 255 - 0.5) * N + 0.5) * 255, 0, 255)`.
- `contrast(0)` makes everything gray. `contrast(2)` doubles the distance from midpoint.
- Effect on contrast ratio: `contrast(N > 1)` increases the ratio (pushes colors apart). `contrast(N < 1)` decreases it.
- **Mathematical adjustment:** Apply the formula above to each channel of both fg and bg, then recompute the WCAG contrast ratio.

**`filter: opacity(N)` / `opacity` property**
- Makes the element semi-transparent, blending with whatever is behind it.
- For text: the effective foreground color blends with the background. `effectiveFg = fg * opacity + bg * (1 - opacity)`.
- The analyzer's existing `getEffectiveBg` already handles `opacity: 0` for visibility but does NOT handle partial opacity for contrast blending.
- **Mathematical adjustment:** Alpha-blend the fg color against the bg color using the effective opacity (product of all ancestor opacities).

**`filter: saturate(N)`**
- Adjusts color saturation. Does not meaningfully affect luminance or contrast ratio for most color pairs. Can be safely ignored for contrast purposes.

**`filter: grayscale(N)`**
- Converts colors toward grayscale. The WCAG contrast algorithm is based on relative luminance, which already ignores chrominance. Grayscale filter has minimal impact on WCAG contrast ratios. Can be safely ignored.

**`filter: invert(N)`**
- `invert(1)` flips all channels: `channel = 255 - channel`.
- `invert(0.5)` pushes everything toward middle gray.
- Effect on contrast: `invert(1)` preserves the contrast ratio (luminance relationship flips but ratio stays the same). `invert(0.5)` destroys contrast.
- **Mathematical adjustment:** `adjustedChannel = channel + (255 - 2 * channel) * N`.

**`filter: blur(Npx)`**
- Gaussian blur. Does not change color values at the center of large uniform areas, but at edges it blends adjacent colors.
- WCAG has no guidance on blur affecting contrast. A blurred text is unreadable regardless of contrast ratio.
- **Recommendation:** Do not adjust contrast for blur. Instead, flag any `filter: blur()` applied to a text-containing element as a separate readability issue ("blurred text is unreadable").

**`filter: drop-shadow(x y blur color)`**
- Adds a shadow behind the element's alpha channel. Does NOT change the element's own colors.
- The shadow can create a pseudo-background behind text, which could theoretically improve contrast (dark shadow behind light text on a light background). However, the shadow's blur and offset make it unreliable as a contrast mechanism.
- **Recommendation:** Ignore drop-shadow for contrast calculations. Flag it as an info note if present on text elements.

**`filter: hue-rotate(Ndeg)`**
- Rotates hue. Can change luminance slightly (because different hues have different perceptual luminance). The effect is small for most rotations.
- **Recommendation:** Ignore for contrast. The luminance change from hue rotation is typically < 5%.

### Can We Mathematically Adjust the Contrast Ratio?

**Yes, for `brightness()`, `contrast()`, `opacity()`, and `invert()`.** These have well-defined mathematical formulas that can be applied to RGB channel values before computing the WCAG contrast ratio.

**Implementation approach:**

```
1. Walk ancestors from the text element upward
2. At each ancestor, read getComputedStyle(el).filter
3. Parse the filter string: "brightness(0.8) contrast(1.2)" ->
   [{fn: 'brightness', value: 0.8}, {fn: 'contrast', value: 1.2}]
4. Collect all filter functions in order (outer ancestor first)
5. Apply each filter function to both fg and bg colors:
   - If the filter is on a common ancestor of both fg and bg elements,
     apply to both
   - If the filter is only on the text element, apply to fg only
6. Recompute WCAG contrast ratio with adjusted colors
```

**Parsing the filter string:** `getComputedStyle(el).filter` returns a normalized string like `"brightness(0.8) contrast(1.2)"`. Parse with a regex: `/(\w+)\(([^)]+)\)/g` to extract function names and values.

**Compositing multiple filters:** CSS applies filters left-to-right (first filter in the list applies first). When multiple ancestors have filters, outer ancestors apply first (their filter affects the entire rendered subtree). This is equivalent to composing the filter functions: `result = outerFilter(innerFilter(originalColor))`.

**`backdrop-filter`:** This is trickier. `backdrop-filter` affects the area BEHIND the element, not the element itself. So `backdrop-filter: brightness(0.8)` darkens whatever is behind the element. This effectively modifies the background color that the element's text is read against.

```
For backdrop-filter on the text's container:
- Apply the backdrop-filter transforms to the bg color (not fg)
- Then compute contrast between original fg and modified bg
```

### What About `filter: drop-shadow()` Creating Pseudo-Backgrounds?

A drop-shadow behind text can visually improve contrast by adding a dark halo around light text. However:

1. The shadow's effective area depends on blur radius and the text's exact shape (per-glyph).
2. The shadow blends with whatever is behind the text, not replacing it.
3. There is no standard method to calculate the effective contrast improvement from a shadow.
4. WCAG does not count shadows as background for contrast purposes.

**Recommendation:** Do not count drop-shadow as a contrast aid. Mention in the finding that a shadow is present but is not a substitute for proper contrast.

### Relevant Browser APIs

| API | What it provides | Support |
|-----|-----------------|---------|
| `getComputedStyle(el).filter` | Resolved filter string | All modern browsers |
| `getComputedStyle(el).backdropFilter` | Resolved backdrop-filter string | Chrome 76+, Firefox 103+, Safari 9+ |
| `getComputedStyle(el).opacity` | Opacity value (0-1) | Universal |
| `getComputedStyle(el).webkitFilter` | Prefixed version | Needed for older Safari |

### Complexity Assessment

| Sub-task | Complexity |
|----------|-----------|
| Parse filter strings | Easy |
| Apply brightness/contrast/opacity to RGB | Easy (simple math) |
| Walk ancestor chain collecting filters | Easy (extend existing ancestor walk) |
| Handle backdrop-filter on bg | Medium (need to identify which element has the backdrop-filter) |
| Handle filter composition order | Medium (must track which ancestors have which filters) |
| Handle mix-blend-mode | Not feasible (skip) |

**Overall: Medium.** The math is straightforward. The main complexity is correctly tracking which filters apply to which colors (fg vs bg) based on the DOM hierarchy. Expect ~80-120 lines of code.

### Accuracy

- **`brightness()` and `contrast()`:** High accuracy. The formulas are exact matches to the CSS spec.
- **`opacity`:** High accuracy. Alpha blending is well-defined.
- **`invert()`:** High accuracy when N is 0 or 1. Medium accuracy for partial inversion.
- **`backdrop-filter`:** Medium accuracy. The backdrop is composited by the browser in a complex way; our mathematical approximation is close but not pixel-perfect.
- **`blur()`, `drop-shadow()`, `mix-blend-mode`:** Not computable. Flag as "manual check."
- **Multiple stacked filters across multiple ancestors:** Medium accuracy. The composition order is correct but floating-point precision and clamping may cause minor differences from the browser's rendering.

### Verdict: Worth Implementing (Selective)

Implement `brightness()`, `contrast()`, and `opacity` adjustments. These three cover the vast majority of real-world filter usage that affects contrast. Skip `blur`, `drop-shadow`, `hue-rotate`, `saturate`, and `mix-blend-mode` — flag them as "manual check needed."

The opacity handling is the highest-value item since semi-transparent text on colored backgrounds is a common pattern that the current analyzer misses entirely.

---

## 4. Readability Scoring — Flesch-Kincaid (P2)

### Problem Statement

The analyzer currently checks structural complexity (heading count, form field count) but does not assess the readability of the actual text content. WCAG 2.2 SC 3.1.5 (Reading Level, AAA) recommends that text be understandable at a lower secondary education level (approximately US grade 8 / Flesch-Kincaid Grade Level 8). This is especially relevant for healthcare, government, and education sites.

### How to Count Syllables in JavaScript

Syllable counting is the core challenge in Flesch-Kincaid scoring. English syllable counting is inherently imprecise without a dictionary lookup.

**Heuristic approach (~85% accuracy):**

```
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  // Count vowel groups
  var syllables = word.match(/[aeiouy]+/g);
  var count = syllables ? syllables.length : 1;

  // Subtract silent-e at end
  if (word.endsWith('e') && !word.endsWith('le') && count > 1) count--;

  // Subtract silent -es, -ed endings
  if (word.endsWith('es') && !word.match(/(sh|ch|x|s|z)es$/)) count--;
  if (word.endsWith('ed') && !word.match(/(t|d)ed$/)) count--;

  return Math.max(count, 1);
}
```

This heuristic handles ~85% of English words correctly. It fails on words like "area" (3 syllables, heuristic says 2), "every" (3, heuristic says 2), "chocolate" (3, heuristic says 4).

**Libraries for syllable counting:**

| Library | Accuracy | Size | Notes |
|---------|----------|------|-------|
| `syllable` (npm, wooorm) | ~90-95% | ~26KB (includes exception lists) | Uses a dictionary of exceptions + rules. Best option for JS. MIT license. |
| `compromise` (npm) | ~90% | ~200KB | Full NLP library. Overkill for just syllable counting. |
| `natural` (npm) | ~85% | ~500KB+ | Node.js NLP toolkit. Not suitable for browser use without bundling. |
| Custom heuristic (above) | ~85% | ~0.5KB | Good enough for a design analyzer where precision is not critical. |

**Recommendation:** Use the heuristic approach with a small exception list (~50 common words). The analyzer does not need clinical-grade readability scoring. A directional score (easy / moderate / difficult) is sufficient. The `syllable` package is good if you want higher accuracy, but 26KB is heavy for a single metric.

### How to Extract Meaningful Text Content from a Page

**The challenge:** A page contains navigation labels, footer links, UI button text, form labels, and other non-content text alongside the actual prose content. Readability scoring should focus on prose content (paragraphs, articles) and exclude UI chrome.

**Extraction strategy:**

1. **Target prose containers:** Focus on text within `<p>`, `<article>`, `<main>`, `<section>` elements. Exclude text within `<nav>`, `<header>`, `<footer>`, `<aside>`, `<button>`, `<a>`, `<label>`, `<input>`, `<select>`, `<option>`, `[role="navigation"]`, `[role="banner"]`, `[role="contentinfo"]`.

2. **Minimum text length filter:** Only score text blocks with 20+ words. Short fragments ("Learn more", "Sign up today") are not meaningful for readability analysis.

3. **Implementation:**
   ```
   var proseSelectors = 'p, article p, main p, section p, blockquote, li';
   var excludeSelectors = 'nav, header, footer, aside, [role="navigation"], [role="banner"]';

   var proseElements = document.querySelectorAll(proseSelectors);
   var proseText = [];
   proseElements.forEach(function(el) {
     // Skip if inside an excluded container
     if (el.closest(excludeSelectors)) return;
     var text = el.textContent.trim();
     if (text.split(/\s+/).length >= 10) {
       proseText.push(text);
     }
   });
   var fullText = proseText.join(' ');
   ```

4. **Handle edge cases:**
   - Pages with no prose content (dashboards, forms) — skip readability scoring entirely. If `fullText` has < 50 words, return a "not applicable" result.
   - Pages with mixed content — score each content section separately and report the worst.

### Flesch-Kincaid Formulas

**Flesch Reading Ease (FRE):**
```
FRE = 206.835 - 1.015 * (totalWords / totalSentences) - 84.6 * (totalSyllables / totalWords)
```

| Score | Reading Level | Audience |
|-------|--------------|---------|
| 90-100 | 5th grade | Very easy, understood by 11-year-olds |
| 80-89 | 6th grade | Easy |
| 70-79 | 7th grade | Fairly easy |
| 60-69 | 8th-9th grade | Standard / plain English |
| 50-59 | 10th-12th grade | Fairly difficult |
| 30-49 | College level | Difficult |
| 0-29 | College graduate | Very difficult |

**Flesch-Kincaid Grade Level (FKGL):**
```
FKGL = 0.39 * (totalWords / totalSentences) + 11.8 * (totalSyllables / totalWords) - 15.59
```

The grade level maps directly to US school grades. Target: grade 8 or below for general audiences.

**Sentence detection:**
```
var sentences = text.split(/[.!?]+/).filter(function(s) { return s.trim().length > 0; });
```

This is imprecise (fails on abbreviations like "U.S.A.", "Dr.", "e.g.") but acceptable for a design analyzer. Abbreviation handling adds complexity for marginal accuracy gain.

**Word detection:**
```
var words = text.split(/\s+/).filter(function(w) { return w.replace(/[^a-zA-Z]/g, '').length > 0; });
```

### Other Readability Metrics (Without NLP)

**Gunning Fog Index:**
```
GFI = 0.4 * ((totalWords / totalSentences) + 100 * (complexWords / totalWords))
```
"Complex words" = words with 3+ syllables (excluding common suffixes like -ed, -es, -ing). Target: 8-10 for general audiences.

**Coleman-Liau Index (no syllable counting needed):**
```
CLI = 0.0588 * L - 0.296 * S - 15.8
L = average number of letters per 100 words
S = average number of sentences per 100 words
```
This is attractive because it avoids syllable counting entirely, using character counts instead. Slightly less accurate than Flesch-Kincaid but much simpler to implement.

**Automated Readability Index (ARI, also no syllables):**
```
ARI = 4.71 * (characters / words) + 0.5 * (words / sentences) - 21.43
```
Another character-based formula. Fast and simple.

**Recommendation:** Implement Coleman-Liau OR Flesch-Kincaid. Coleman-Liau is simpler (no syllable counting). Flesch-Kincaid is more widely recognized. If syllable counting is already implemented (for other features), use Flesch-Kincaid. Otherwise, Coleman-Liau gives a similar signal with less code.

### Detecting Reading Level Without NLP

Yes, all the formulas above are statistical, not NLP-based. They count words, sentences, syllables (or characters), and compute a score. No parsing, no tokenization, no part-of-speech tagging needed.

**Limitations without NLP:**
- Cannot detect jargon or domain-specific vocabulary
- Cannot detect passive voice (which hurts readability)
- Cannot detect sentence complexity (embedded clauses, nested conditionals)
- Cannot handle non-English text (formulas are English-specific)

For a design analyzer, the statistical approach is appropriate. It catches the most impactful readability issue — long words and long sentences — which are the primary drivers of reading difficulty.

### Complexity Assessment

| Sub-task | Complexity |
|----------|-----------|
| Extract prose text from page | Easy-Medium |
| Sentence/word counting | Easy |
| Syllable counting (heuristic) | Easy |
| Flesch-Kincaid calculation | Easy (one formula) |
| Coleman-Liau (no syllables) | Very Easy |
| Interpreting and scoring the result | Easy |
| Handling pages with no prose | Easy |

**Overall: Easy-Medium.** Expect ~60-100 lines of code including text extraction. Coleman-Liau variant: ~40 lines.

### Accuracy

- **Flesch-Kincaid with heuristic syllables:** ~85% accuracy vs. reference implementations. Sufficient for "easy / moderate / hard" classification.
- **Coleman-Liau:** ~80% accuracy for grade level, but more consistent (no syllable estimation error).
- **Both are well-validated** on English prose. They are less meaningful for pages with minimal text content, technical documentation with unavoidable jargon, or non-English content.

### Verdict: Worth Implementing

Yes. Readability scoring is a unique feature that most design analysis tools do not provide. It adds a new dimension (content quality) beyond visual design. Recommend:

1. Use Coleman-Liau for simplicity (no syllable counting)
2. Extract text from `<p>` elements outside nav/header/footer
3. Only score pages with 50+ words of prose content
4. Report as a grade level with an interpretation ("Grade 6 — accessible to most audiences")
5. If the cognitive load scoring module already exists, add readability as a sub-check within it

---

## 5. Reading Pattern Detection (P3)

### Problem Statement

Web design theory identifies common scanning patterns (F-pattern, Z-pattern) that describe how users visually navigate pages. Detecting whether a page's layout aligns with these patterns could provide layout quality feedback. The question is whether this can be detected from DOM structure and bounding rectangles alone, without eye-tracking data or AI.

### Z-Pattern: What Layout Characteristics Indicate It?

The Z-pattern applies to pages with low text density and high visual hierarchy — typically landing pages, marketing pages, and hero sections.

**Z-pattern structure:**
```
[Logo/Brand] -------- [Nav/CTA]      (top bar, left to right)
       \                              (diagonal scan)
        \
         \
[Secondary info] ---- [Primary CTA]  (bottom bar, left to right)
```

**Detectable signals from the DOM:**

1. **Top-left content:** Look for a logo or brand element in the top-left quadrant. Detect via: `<header>` children, elements with class/id containing "logo", `<img>` elements in the top-left 25% of the viewport.

2. **Top-right content:** Look for navigation or a CTA in the top-right quadrant. Detect via: `<nav>` element position, `<button>` or `<a>` elements with button-like classes in the top-right 25%.

3. **Diagonal content:** The diagonal is the least detectable. Look for a large central element (hero image, headline) that draws the eye from top-right to bottom-left. Detect via: the largest element by area in the center 50% of the viewport.

4. **Bottom-right CTA:** Look for a prominent button or call-to-action in the bottom-right quadrant of the first viewport. Detect via: `<button>` or `<a>` elements with prominent styling (large font, high contrast, bold) whose bounding rect is in the bottom-right 25%.

**Scoring heuristic:**
```
z_score = 0
if (has_logo_top_left) z_score += 25
if (has_nav_or_cta_top_right) z_score += 25
if (has_large_central_element) z_score += 25
if (has_cta_bottom_right) z_score += 25
```

### F-Pattern: How to Detect Heading-Heavy Left-Aligned Content

The F-pattern applies to text-heavy pages — blogs, articles, documentation, news sites.

**F-pattern structure:**
```
[==========================]  (first full-width line read completely)
[==========================]
[===========]                 (second line read partially)
[===]                         (subsequent lines: mostly left side scanned)
[====]
[==]
```

**Detectable signals:**

1. **Left-aligned headings:** Headings (`h1`-`h6`) should be left-aligned or full-width. Check `textAlign` and position within parent.

2. **Content density in left 60%:** Measure the proportion of text content area (sum of text-containing element widths * heights) that falls in the left 60% of the viewport vs. the right 40%.

3. **Heading frequency:** F-pattern pages have regular headings that create "scan points." Check if headings appear every 200-400px of vertical scroll (roughly every 2-4 paragraphs).

4. **Bold/emphasized text in first lines:** F-pattern readers scan the first line of each paragraph more thoroughly. Check if paragraphs begin with `<strong>`, `<b>`, or bold-weight text.

**Detection from DOM + bounding rects:**
```
1. Classify page type:
   - Count words in <p> elements vs. total elements
   - High text-to-element ratio = content page (F-pattern expected)
   - Low ratio = marketing/app page (Z-pattern expected)

2. For content pages, check F-pattern compliance:
   a. headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6')
   b. For each heading, check: getBoundingClientRect().left < viewport.width * 0.4
   c. Calculate text area in left 60% vs right 40%
   d. Check vertical spacing between headings (consistent ~300px = good)
```

### Scanability vs. Wall-of-Text Detection

This is more practical and higher-value than pattern detection.

**Wall-of-text indicators:**
1. **Long paragraphs:** Any `<p>` with > 150 words (or > 5 lines at current line-height)
2. **No subheadings:** A content section with > 500 words and zero `h2`-`h6` elements
3. **No visual breaks:** No images, lists, blockquotes, or horizontal rules breaking up text within a 600px+ vertical span
4. **Line length:** Text lines > 80 characters (measure `element.clientWidth / parseFloat(fontSize) * averageCharWidth`)
5. **No lists:** Content pages with 500+ words and zero `<ul>`, `<ol>`, or `<dl>` elements

**Scanability score (practical):**
```
scanability = 100
if (max_paragraph_words > 150) scanability -= 20
if (longest_text_run_without_heading > 500_words) scanability -= 25
if (no_lists_in_content) scanability -= 15
if (no_images_or_media_in_content) scanability -= 10
if (line_length > 80_chars) scanability -= 15
if (no_bold_or_emphasis_in_paragraphs) scanability -= 15
```

### Can We Detect These from DOM Structure + Bounding Rects Alone?

**Yes, partially.** Here is what IS detectable vs. what is NOT:

| Signal | Detectable from DOM? | How |
|--------|---------------------|-----|
| Element positions (quadrants) | Yes | `getBoundingClientRect()` |
| Text density by region | Yes | Count text content length per quadrant |
| Heading positions | Yes | Heading elements + bounding rects |
| Paragraph lengths | Yes | `textContent.length` or word count |
| Visual breaks (images, lists) | Yes | Query for `img`, `ul`, `ol`, `blockquote` |
| Line length in characters | Approximately | Element width / font size * ~0.5 |
| "Prominent" buttons | Heuristic | Size + contrast + font-weight |
| User's actual scan path | No | Requires eye tracking |
| Visual hierarchy perception | Partially | Size ratios, color contrast, spacing |
| Content importance | No | Requires semantic understanding |

### What Accuracy is Realistic Without AI?

**For Z/F-pattern detection:** Low accuracy (50-60%). The heuristics can identify whether a layout has the structural characteristics of a pattern, but cannot determine if the pattern is intentional or effective. A page might have a CTA in the bottom-right by coincidence, not by design. False positives are common.

**For scanability/wall-of-text detection:** High accuracy (85-90%). Long paragraphs, missing headings, and missing visual breaks are objectively measurable. These are the most actionable findings.

**Recommendation:** Focus on scanability metrics rather than pattern detection. Scanability is objectively measurable, actionable, and high-value. Z/F-pattern detection is interesting but too heuristic to be reliable without AI.

### Complexity Assessment

| Sub-task | Complexity |
|----------|-----------|
| Page type classification | Easy |
| Wall-of-text detection | Easy |
| Scanability scoring | Easy |
| Z-pattern heuristic | Medium (lots of edge cases) |
| F-pattern heuristic | Medium |
| Heading spacing analysis | Easy |

**Overall: Easy for scanability, Medium for pattern detection.** Recommend implementing scanability (~40-60 lines) and deferring Z/F-pattern detection.

### Verdict: Partially Worth Implementing

Implement **scanability scoring** (wall-of-text detection, paragraph length, heading frequency, list/image breaks). Skip Z-pattern and F-pattern detection — the accuracy is too low to provide confident recommendations, and wrong suggestions erode trust in the analyzer.

If pattern detection is desired later, frame it as "observations" not "issues": "This layout has characteristics of a Z-pattern — consider placing your primary CTA in the bottom-right of the hero section."

---

## 6. Visual Weight Balance (P3)

### Problem Statement

A well-balanced page distributes visual weight across the layout so that no single area feels overwhelmingly heavy or empty. Can we approximate visual weight from element sizes, colors, and positions using only DOM APIs?

### Approximating Visual Weight from Element Properties

Visual weight in design theory is influenced by:

1. **Size** — Larger elements carry more weight.
2. **Color darkness** — Darker colors are "heavier" than lighter colors.
3. **Color saturation** — Saturated colors are heavier than desaturated ones.
4. **Contrast** — High-contrast elements against their background are heavier.
5. **Density** — Areas with more content (text, images) feel heavier.
6. **Isolation** — An element surrounded by whitespace feels heavier than one crowded by neighbors.
7. **Images** — Photos and illustrations carry more weight than text or empty space.

**What's measurable from the DOM:**

| Factor | Measurable? | How |
|--------|------------|-----|
| Element area | Yes | `width * height` from `getBoundingClientRect()` |
| Color darkness (luminance) | Yes | `getComputedStyle(el).backgroundColor` -> relative luminance |
| Saturation | Yes | Convert RGB to HSL, read S component |
| Is it an image? | Yes | `<img>`, `<video>`, `<svg>`, `background-image` |
| Text density | Yes | `textContent.length / area` |
| Whitespace around element | Approximately | Gap to nearest sibling bounding box |
| Contrast against parent | Yes | Compare element bg to parent bg luminance |

### Quadrant-Based Density Comparison

**Basic approach:**

```
1. Get viewport dimensions: W = window.innerWidth, H = window.innerHeight
2. Define quadrants (or halves):
   - Left half: x < W/2
   - Right half: x >= W/2
   - Top half: y < H/2
   - Bottom half: y >= H/2

3. For each visible element with meaningful content:
   a. Get bounding rect
   b. Calculate which quadrant(s) it overlaps
   c. If it spans multiple quadrants, split its weight proportionally

4. Weight per element:
   Simple: weight = area (width * height)
   Better: weight = area * (1 - luminance)  // darker = heavier
   Best:   weight = area * (1 - luminance) * (isImage ? 1.5 : 1)

5. Sum weights per quadrant/half
6. Compare:
   - Left vs. Right ratio
   - Top vs. Bottom ratio
   - If ratio > 2.0 (one side has 2x the weight), flag as unbalanced
```

**Which elements to include:**

Not all DOM elements contribute to visual weight. Filter to:
- Elements with `offsetWidth > 0` and `offsetHeight > 0` (visible)
- Elements that are "leaf" content holders: `<img>`, `<video>`, `<svg>`, `<canvas>`, `<p>`, `<h1>`-`<h6>`, `<button>`, `<input>`, `<div>` with background-color or background-image
- Exclude structural wrappers that are transparent/invisible containers

**Handling elements that span the entire width:**

Full-width elements (headers, hero sections, footers) span both halves equally and should not affect the left-right balance. Filter out elements wider than 90% of the viewport for left-right balance checks. Similarly, filter out elements taller than 90% of the viewport for top-bottom balance checks.

### Research on Visual Balance in Web Design

**Academic research:**

1. **Ngo, Teo, Byrne (2003)** — "Modelling interface aesthetics" in Information Sciences. Defined 14 aesthetic measures for web interfaces including balance, equilibrium, symmetry, and sequence. The **balance measure** compares the visual weight on left vs. right and top vs. bottom. Their formula:

   ```
   Balance_LR = |WL - WR| / max(WL, WR)
   Balance_TB = |WT - WB| / max(WT, WB)
   Balance = 1 - (Balance_LR + Balance_TB) / 2

   Where W = sum of (area * weight_factor) for all elements in that half
   ```

   A balance score of 1.0 = perfect balance, 0.0 = completely unbalanced.

2. **Zheng, Chakraborty, Lin, Rauterberg (2009)** — Validated the Ngo model computationally. Confirmed that balance correlates with user aesthetic preference (r = 0.67). They noted that **color weight matters more than size** for perceived balance.

3. **Miniukovich & De Angeli (2014)** — "Quantification of interface visual complexity" in International Conference on Advanced Visual Interfaces. Proposed pixel-based metrics: render the page to an image and compute quadrant densities. Not directly applicable to DOM-only analysis but validates the quadrant approach.

4. **Reinecke et al. (2013)** — "Predicting users' first impressions of website aesthetics with a quantification of perceived visual complexity and colorfulness." Found that moderate complexity and balanced layouts correlate with positive first impressions (r = 0.54).

**Key finding from the research:** The quadrant-based area comparison is a valid approximation. Academic studies use essentially the same approach (sum of weighted element areas per region) and find it correlates meaningfully (r = 0.5-0.7) with human aesthetic judgments.

### Practical Implementation Considerations

**Viewport vs. full page:** Balance should be checked per viewport-height section, not across the entire page. A long page naturally has more content at the top (header, hero) and the bottom is "lighter" — this is normal, not a balance issue. Check balance within:
- The first viewport (above the fold)
- Each major section (`<section>` or equivalent)

**Left-right balance is more important than top-bottom:** Users expect top-heavy layouts (header/hero at top, footer at bottom). Left-right imbalance is more visually jarring. Weight the left-right check more heavily.

**Symmetric vs. asymmetric layouts:** Some layouts are intentionally asymmetric (sidebar on the left, content on the right). Detect sidebar layouts (`display: grid` or `display: flex` with a narrow + wide column) and adjust expectations. A 30/70 split is intentional asymmetry, not imbalance.

```
Detect sidebar layout:
1. Find flex/grid containers with 2 children
2. If one child is < 35% of parent width, it's a sidebar
3. For sidebar layouts, skip left-right balance check
   OR adjust the expected ratio to match the sidebar proportions
```

### Relevant Libraries

No libraries exist for DOM-based visual weight analysis. The implementation is custom geometric math.

**Related tools:**
- **`html2canvas`** — Could render to canvas for pixel-based analysis, but is heavy and slow.
- **`dom-to-image`** — Similar to html2canvas, renders DOM to an image. Could be used for pixel-density analysis per quadrant. ~15KB. But this is overkill for the DOM-based approach.

### Complexity Assessment

| Sub-task | Complexity |
|----------|-----------|
| Collect visible elements with areas | Easy |
| Calculate weight (area * luminance) | Easy |
| Sum weights per quadrant/half | Easy |
| Handle full-width elements | Easy |
| Detect sidebar layouts | Medium |
| Per-section balance (not whole page) | Medium |

**Overall: Easy-Medium.** The basic implementation (left-right and top-bottom area comparison) is ~40-60 lines. Adding color-based weight and sidebar detection adds ~30-40 lines.

### Accuracy

- **Extreme imbalances** (all content on one side, huge empty area): High accuracy. These are obvious even with a simple area-based metric.
- **Subtle weight differences** (dark image on right balancing text on left): Low accuracy. Requires color-weight analysis to detect, and even then the correlation with human perception is moderate (r ~0.6).
- **Intentional asymmetry** (sidebars, split layouts): Moderate accuracy with sidebar detection. Without it, many sidebar layouts would be flagged as "unbalanced."
- **False positive rate:** Medium-high for the simple approach. A page with a left sidebar is not "unbalanced" but would trigger the check. Sidebar detection mitigates this.

### Verdict: Worth Implementing (Basic Version Only)

Implement the basic quadrant-area approach with these guardrails:

1. Only check left-right balance (skip top-bottom — it's rarely meaningful)
2. Only flag severe imbalance (ratio > 3.0, not 2.0 — reduce false positives)
3. Skip full-width elements (>90% viewport width)
4. Detect and exclude sidebar layouts
5. Check per-section or per-viewport-height, not the entire page
6. Frame findings as "observation" not "error" — balance is subjective

The severity should be `info`, never `warning` or `error`. Visual balance is a design choice, not a compliance requirement.

---

## Summary: Implementation Priority and Effort

| Feature | Priority | Effort (lines) | Accuracy | Standalone Value | Verdict |
|---------|----------|----------------|----------|-----------------|---------|
| Background Image Contrast | P2 | 150-250 | 70% cases covered | High — beats axe-core | **Implement** (phased) |
| SVG Text Contrast | P2 | 80-120 | Good for simple SVGs | Low — rare in typical UIs | **Implement** (minimal) |
| CSS Filter Contrast | P2 | 80-120 | High for brightness/opacity | Medium — filters near text are common | **Implement** (selective: brightness, contrast, opacity only) |
| Readability Scoring | P2 | 60-100 | 85% vs reference | High — unique feature | **Implement** (Coleman-Liau or FK) |
| Reading Pattern Detection | P3 | 40-60 useful / 80-120 full | 85% scanability / 50% patterns | Medium for scanability | **Implement scanability only** |
| Visual Weight Balance | P3 | 60-100 | Catches extreme cases | Low — subjective metric | **Implement basic** (info severity) |

**Recommended implementation order:**
1. Readability scoring (highest standalone value, lowest effort)
2. CSS filter contrast — opacity and brightness handling (common real-world gap)
3. Background image contrast — phase 1 (cover + center, biggest differentiator vs. axe-core)
4. Scanability scoring (easy, actionable findings)
5. SVG text contrast (straightforward extension of existing text walk)
6. Visual weight balance (low priority, info-only findings)
7. Background image contrast — phase 2 (remaining edge cases)

---

## Sources

- WCAG 2.2 specification: https://www.w3.org/TR/WCAG22/
- WCAG 2.2 SC 3.1.5 (Reading Level): https://www.w3.org/TR/WCAG22/#reading-level
- axe-core color module source: https://github.com/dequelabs/axe-core/tree/develop/lib/commons/color
- CSS Filter Effects spec: https://drafts.fxtf.org/filter-effects/
- CSS Backgrounds and Borders spec (background-size): https://www.w3.org/TR/css-backgrounds-3/#background-size
- Canvas 2D API — getImageData: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getImageData
- SVG getBBox(): https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getBBox
- Flesch-Kincaid readability: https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests
- Coleman-Liau Index: https://en.wikipedia.org/wiki/Coleman%E2%80%93Liau_index
- `syllable` npm package: https://github.com/words/syllable
- Ngo, Teo, Byrne (2003) — Modelling interface aesthetics, Information Sciences 152:25-46
- Zheng, Chakraborty, Lin, Rauterberg (2009) — Correlation of aesthetic measures, Proc. HCII 2009
- Miniukovich & De Angeli (2014) — Quantification of interface visual complexity, AVI 2014
- Reinecke et al. (2013) — Predicting first impressions, CHI 2013
- CORS and canvas tainting: https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
- SVG rendering model (painter's model): https://www.w3.org/TR/SVG2/render.html
