# Design Analyzer Technical Roadmap

> Research document covering four improvement areas for the client-side design analyzer.
> For each capability: what browser APIs exist, what's technically feasible, complexity estimate, accuracy expectations, and relevant open-source libraries.

---

## Area 1: Better Contrast Detection

### Current State

The analyzer's `getEffectiveBg()` walks the DOM tree upward, reading `getComputedStyle(el).backgroundColor` at each ancestor, compositing semi-transparent layers onto an assumed white base. This works for solid `background-color` values but fails when:

- The background is a CSS gradient (`linear-gradient`, `radial-gradient`, `conic-gradient`)
- The background is an image (`background-image: url(...)`)
- The text is inside an SVG (`<text>`, `<tspan>` with `fill`)
- CSS filters alter perceived contrast (`filter: brightness()`, `filter: blur()`, `opacity`)

The scoring engine already flags these as "uncertain" (1:1 ratio with fg === bg) and excludes them from the score, but they silently pass without any real check.

### 1.1 Gradient Backgrounds

**The problem:** `getComputedStyle(el).backgroundImage` returns the raw CSS string (e.g., `"linear-gradient(135deg, rgb(59, 130, 246), rgb(147, 51, 234))"`), but `backgroundColor` returns `rgba(0,0,0,0)` when a gradient is present. The current code sees transparent and walks up, never finding the gradient.

**What's possible in a browser:**

1. **Parse the gradient string.** The `backgroundImage` computed value is a serialized, resolved form. Browsers normalize it into a predictable format: `linear-gradient(Xdeg, rgb(r,g,b) Y%, rgb(r,g,b) Z%, ...)`. This can be parsed with regex to extract color stops and their positions.

2. **Sample multiple points along the gradient.** For a `linear-gradient`, calculate the color at several points (e.g., 0%, 25%, 50%, 75%, 100%) by interpolating between stops. For each sample point, compute the contrast ratio against the text color. Report the **worst-case** (minimum) contrast ratio.

3. **Use a canvas for accurate rendering.** Create an off-screen `<canvas>` sized to the element's dimensions, draw the gradient using the Canvas 2D API (`createLinearGradient`, `createRadialGradient`), then sample pixel colors at the text's bounding box positions. This handles all gradient types uniformly.

**Approach — canvas sampling (recommended):**

```
1. Detect backgroundImage contains "gradient"
2. Create canvas sized to element's bounding rect
3. Set canvas fillStyle to the gradient CSS string (via a temporary div or CSS-to-canvas conversion)
4. Sample pixels at text bounding box corners + center (5-9 points)
5. Compute contrast for each sample against foreground color
6. Use the worst (lowest) ratio as the reported value
7. Flag as "gradient background — worst-case contrast reported"
```

**Key detail:** The Canvas 2D API's `createLinearGradient(x0,y0,x1,y1)` and `addColorStop()` can reproduce any CSS linear/radial gradient, but you need to parse the CSS gradient syntax into canvas API calls. Alternatively, you can render the element to a canvas:

- **`html2canvas`** library (see below) can render the element, but it's heavy (40KB+).
- **`element.toDataURL()` does not exist** — there is no native way to rasterize an arbitrary DOM element in the browser.
- **Simpler approach:** create a temporary `<div>` with the same gradient, same dimensions, append it off-screen, then use `canvas.getContext('2d').drawImage()` — but `drawImage` only accepts `<img>`, `<canvas>`, or `<video>`, not `<div>`.

**Best practical approach:** Parse the gradient CSS string, reconstruct it via Canvas 2D gradient API, sample pixels.

**Libraries:**

- **`gradient-parser`** (npm) — parses CSS gradient strings into AST. ~2KB. Handles linear, radial, conic.
- **`css-gradient-parser`** (npm) — similar, newer.
- **No single library does gradient-to-canvas-to-contrast**, but the parsing + Canvas 2D API combination is straightforward.

**Complexity:** Medium. Parsing CSS gradient syntax has edge cases (color spaces, `color-mix()`, `oklch()` stops), but for the common 90% (rgb/hex stops with percentage positions), a regex parser is sufficient. Canvas sampling is straightforward.

**Accuracy:** High for simple gradients (linear with 2-4 stops). Lower for complex radial/conic gradients where text positioning matters. Sampling 9 points across the text bounding box catches most worst-case scenarios.

### 1.2 Background Images

**The problem:** When `background-image: url(photo.jpg)` is used behind text, the effective background color depends on the actual image pixels under the text.

**What's possible:**

1. **Load the image onto a canvas, sample pixels.** If the image URL is same-origin or CORS-enabled, you can draw it to a `<canvas>` and call `getImageData()` to read pixel colors. Then sample pixels at the text's position within the element.

2. **Cross-origin limitation:** If the image is from a different domain without CORS headers, the canvas becomes "tainted" and `getImageData()` throws a security error. This is a hard browser restriction with no workaround.

3. **Background-size/position calculations:** You need to account for `background-size`, `background-position`, `background-repeat`, and the element's dimensions to know which part of the image is actually behind the text. This is complex but deterministic — all values are available via `getComputedStyle`.

**Approach:**

```
1. Get backgroundImage URL from computed style
2. Load image into an Image object (with crossOrigin = "anonymous")
3. Calculate which region of the image is behind the text (accounting for bg-size/position)
4. Draw that region to a canvas
5. Sample pixels at text position
6. Compute worst-case contrast
7. If CORS fails, flag as "background image — cannot verify contrast automatically"
```

**Complexity:** Hard. The background-size/position math is fiddly (cover, contain, percentage positions, multiple backgrounds). Cross-origin failures are common in practice. However, for the analyzer's use case (user pastes their own HTML), images are often data URIs or same-origin, making this more feasible.

**Accuracy:** High when images are accessible, but CORS blocks it for many real-world sites. Best to combine with a fallback heuristic: if the image is dark (average luminance < 0.5), assume dark background; if light, assume light.

**Libraries:**

- **`html2canvas`** — renders DOM elements to canvas. Handles backgrounds, gradients, borders, etc. Heavy (~50KB gzipped) but battle-tested. Could be used as a nuclear option: render the parent element, sample the pixel behind the text.
- **No lightweight library specifically for background-image contrast checking.**

### 1.3 SVG Text

**The problem:** SVG `<text>` and `<tspan>` elements use `fill` for color instead of CSS `color`, and their backgrounds are determined by the SVG viewport, underlying `<rect>` elements, or the HTML element containing the SVG.

**What's possible:**

1. **Read SVG fill:** `getComputedStyle(svgTextElement).fill` returns the fill color. Modern browsers resolve this to an `rgb()` value. Alternatively, `svgTextElement.getAttribute('fill')` gets the attribute value, and computed style gets the resolved value.

2. **Determine SVG background:** Walk backward through SVG siblings/ancestors to find `<rect>` or other filled shapes positioned behind the text, or fall back to the SVG element's CSS background, or its HTML parent's background.

3. **SVG `<text>` with `getComputedStyle`:** The `color` property on SVG text elements often returns the fill value in modern browsers. `fill`, `stroke`, `fill-opacity` are also readable via computed style.

**Approach:**

```
1. Detect SVG text elements: querySelectorAll('svg text, svg tspan')
2. Read fill color via getComputedStyle(el).fill (resolved to rgb)
3. For background: check for <rect> siblings/ancestors with fill, then fall back to SVG element's HTML parent background
4. Compute contrast ratio
```

**Complexity:** Medium. The main difficulty is determining what's "behind" the SVG text — SVG rendering order is document order (later elements on top), so you'd need to find the last filled shape whose bounding box overlaps the text's bounding box.

**Accuracy:** Good for simple cases (text on a filled rect). Poor for complex SVGs with overlapping shapes, patterns, or gradients as fills. For the analyzer's typical use case (UI components with SVG icons/labels), this covers the majority.

### 1.4 CSS Filters Affecting Contrast

**The problem:** CSS `filter: brightness(0.5)` or `filter: contrast(1.5)` or `opacity: 0.7` applied to a parent can change the effective contrast ratio, but the analyzer reads raw color values unaffected by these filters.

**What's possible:**

1. **`opacity`:** Straightforward. Read `getComputedStyle(el).opacity` for each ancestor. Multiply all opacities together. Blend the text color against the background using the effective opacity. The current code already handles `opacity: 0` for visibility — extending to partial opacity is simple.

2. **`filter: brightness(N)`:** Multiply each RGB channel by N. `brightness(0.5)` halves the color values. Browsers expose the computed filter string: `getComputedStyle(el).filter` returns e.g. `"brightness(0.5)"`.

3. **`filter: contrast(N)`:** Apply contrast formula: `channel = ((channel / 255 - 0.5) * N + 0.5) * 255`. Available via computed style.

4. **`filter: blur()`:** Does not change contrast ratios directly but reduces edge sharpness. WCAG does not have guidance on blur and contrast interaction. Best to flag as a warning if blur is applied to a text-containing element.

5. **`backdrop-filter`:** Applied to the element's backdrop, affecting what's behind it (e.g., `backdrop-filter: blur(10px) brightness(0.8)`). The `brightness` component affects the effective background color. Readable via `getComputedStyle(el).backdropFilter`.

6. **`mix-blend-mode`:** Extremely hard to simulate without rasterization. The blending math depends on both the element's color and the underlying pixels. Skip this for now and flag as "uncertain."

**Approach:**

```
1. Walk ancestors collecting opacity values — multiply for effective opacity
2. Walk ancestors collecting filter values — parse brightness/contrast multipliers
3. Apply brightness/contrast transforms to the resolved fg and bg colors
4. Blend using effective opacity
5. Flag blur, mix-blend-mode, and complex filters as "manual check needed"
```

**Complexity:** Easy for opacity. Medium for brightness/contrast filters. Hard for backdrop-filter (need to apply to the background, not the foreground). Impossible for mix-blend-mode without rasterization.

**Accuracy:** High for opacity and brightness. Medium for contrast filters. Low for anything involving blend modes.

### 1.5 What Do Lighthouse and axe-core Do?

**Lighthouse (Google):**

- Uses the axe-core engine for contrast checking.
- For gradients and background images, **Lighthouse simply skips them** and marks the check as "incomplete" (needs manual review). It does not attempt gradient sampling or image analysis.
- Lighthouse's contrast check is in `@axe-core/core` under `color/get-background-color.js`.

**axe-core (Deque Systems):**

- Walks the DOM tree upward to find effective background color, similar to the current analyzer.
- **Gradients:** axe-core attempts to determine if a gradient provides insufficient contrast by checking the color at the text's position. It uses `getComputedStyle` to get the gradient string, parses it, and evaluates colors at the element's position. However, it marks results as "incomplete" when it can't determine the background with confidence.
- **Background images:** Marked as "incomplete" — axe-core does not load or sample background images.
- **Opacity:** axe-core handles opacity in its color compositing — it multiplies opacity through the ancestor chain.
- **Filters:** axe-core does NOT account for CSS filters. This is a known limitation.
- **SVG:** axe-core has limited SVG support — it can check `<text>` elements but not complex SVG scenes.

**Key takeaway:** Even the most widely used accessibility tools punt on gradients, images, and filters. Doing better than axe-core on gradient contrast would be a genuine differentiator. The canvas-sampling approach described above would put this analyzer ahead of the industry standard.

**Relevant open-source code:**

- **axe-core** (`github.com/dequelabs/axe-core`) — MIT license. The `lib/commons/color/` directory contains all their color/contrast logic. `get-background-color.js`, `get-foreground-color.js`, `flatten-colors.js` are the key files.
- **`color.js`** (Lea Verou) — perceptual color manipulation, WCAG contrast, APCA contrast. Useful for advanced contrast algorithms.
- **APCA** (Accessible Perceptual Contrast Algorithm) — the proposed replacement for WCAG 2.x contrast. Available as `apca-w3` on npm. More perceptually accurate but not yet a standard.

---

## Area 2: User Persona / Use Case Profiles

### Overview

The current analyzer scores against a single standard (WCAG AA). Different user groups have different needs, and industry-specific guidelines add further requirements. A persona system would let users select a target audience and get tailored scoring thresholds and recommendations.

### 2.1 Elderly Users (65+)

**Source standards:** W3C WAI "Web Accessibility for Older Users" (2010), ISO/TR 22411, WCAG AAA, various gerontology HCI research.

**Specific recommendations:**

| Property | Standard Recommendation | Practical Minimum |
|----------|------------------------|-------------------|
| Body font size | 16px minimum, 18-20px recommended | 18px |
| Line height | 1.5-1.8 (more generous than general) | 1.6 |
| Contrast ratio | 7:1 (WCAG AAA) for all text | 7:1 |
| Target size | 44x44px minimum, 48x48px recommended | 48px |
| Target spacing | 8px minimum gap | 12px |
| Link underlines | Always visible (not just color-differentiated) | Underline required |
| Animation | Reduced or no animation; respect prefers-reduced-motion | Minimal transitions |
| Color reliance | Never use color as sole indicator | Always pair with icon/text |
| Font weight | Prefer 400+ for body, 600+ for emphasis | Avoid thin (100-300) weights |
| Letter spacing | Slightly increased (0.02-0.05em) | 0.02em minimum |

**Scoring adjustments:**
- Raise contrast threshold from 4.5:1 to 7:1 for all text
- Raise minimum body font from 16px to 18px
- Raise touch target minimum from 44px to 48px
- Add check: links must have underline decoration (not just color difference)
- Add check: no font-weight below 300

**Complexity:** Easy. These are threshold changes to existing checks plus a few new boolean checks.

### 2.2 Motor Impairment

**Source standards:** WCAG 2.5.5 (Target Size Enhanced — AAA), WCAG 2.5.8 (Target Size Minimum — AA, new in 2.2), Section 508.

**Specific recommendations:**

| Property | WCAG 2.5.5 (AAA) | WCAG 2.5.8 (AA) | Best Practice |
|----------|-------------------|------------------|---------------|
| Target size | 44x44px | 24x24px | 48x48px |
| Target spacing | Not specified directly | Spacing can substitute for size | 12px minimum |
| Drag alternatives | Must have click alternative | Required | Always |
| Timeout | Adjustable or >20hrs | Adjustable | No timeouts |
| Single pointer | All functions via single click | Required | Always |

**Additional checks to implement:**

- **Spacing between targets:** Current analyzer already checks adjacent interactive element spacing. For motor impairment profile, raise the minimum from 8px to 12px.
- **Hover-only interactions:** Detect elements with `:hover` styles that have no click/keyboard equivalent. Detectable by checking if computed styles change on hover (hard without actually hovering) or by inspecting stylesheet rules for `:hover` selectors without matching `:focus`/`:active`.
- **Drag-and-drop without alternatives:** Detect `draggable="true"` elements. Flag if no alternative interaction is apparent.
- **Custom scrollbars:** Check if scrollbar width is below 15px (thin scrollbars are hard for motor-impaired users). Detectable via CSS custom properties or by measuring actual scrollbar dimensions.

**Complexity:** Easy for threshold adjustments. Medium for hover-only detection (requires stylesheet rule inspection).

### 2.3 Low Vision (Beyond WCAG AA)

**Source standards:** WCAG AAA, WCAG 2.2 SC 1.4.12 (Text Spacing), SC 1.4.4 (Resize Text), Low Vision Task Force findings.

**Specific recommendations:**

| Property | Requirement | How to Check |
|----------|-------------|--------------|
| Contrast | 7:1 for normal text, 4.5:1 for large | Threshold change |
| Text resize | Content usable at 200% zoom | Check if layout breaks at 2x font size |
| Text spacing override | Content works with: line-height 1.5x, paragraph spacing 2x, letter-spacing 0.12em, word-spacing 0.16em | Apply styles and check for overflow/clipping |
| Reflow | Content reflows at 320px width (no horizontal scroll) | Check at narrow viewport |
| Images of text | Avoid using images for text content | Detect images with OCR-like text content (hard) |

**Key unique check — text spacing resilience (WCAG 1.4.12):**

This is testable client-side: apply the WCAG text spacing overrides via JavaScript, then check if any element has `overflow: hidden` that clips content. This is a powerful automated test.

```
Approach:
1. Save current styles
2. Apply: line-height: 1.5em, paragraph margin-bottom: 2em, letter-spacing: 0.12em, word-spacing: 0.16em
3. Check all elements for overflow clipping (scrollHeight > clientHeight with overflow:hidden)
4. Restore styles
5. Report elements that clip
```

**Complexity:** Medium. The text spacing resilience check is elegant and unique — few tools do this. The 200% zoom and 320px reflow checks would require re-running the analyzer at different viewport sizes, which is feasible in an iframe but adds complexity.

**Accuracy:** High for text spacing resilience. The zoom/reflow checks are approximations unless you actually resize.

### 2.4 Cognitive Disabilities

**Source standards:** WCAG 2.2 SC 3.1.5 (Reading Level — AAA), COGA (Cognitive and Learning Disabilities Accessibility) Task Force guidance, EN 301 549.

**Specific recommendations:**

| Property | Recommendation | How to Check |
|----------|---------------|--------------|
| Reading level | Lower secondary education level (Flesch-Kincaid Grade 8 or below) | Flesch-Kincaid algorithm on text content |
| Layout complexity | Consistent navigation, predictable layout | Count unique layout patterns |
| Number of choices | 5-7 items per group (Hick's Law) | Count nav items, form fields per section |
| Consistent navigation | Same nav on every page | N/A for single-page analysis |
| Error prevention | Clear form validation, confirmation for destructive actions | Check for form validation attributes |
| Clear labels | Descriptive button/link text (not "click here") | Text content analysis |
| Animation | No auto-playing content, pause controls | Detect autoplay, animation-duration |
| Font choice | Sans-serif preferred, avoid decorative fonts | Check font-family |

**Flesch-Kincaid readability scoring — client-side:**

This is fully computable in the browser:
- Extract all visible text content
- Count sentences (period/question mark/exclamation), words, syllables
- Apply formula: `206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)`
- Score > 60 = accessible to most users; < 30 = very difficult

Syllable counting is the hard part. Heuristic: count vowel groups per word, subtract silent-e endings. ~85% accurate. Libraries like `syllable` (npm, ~2KB) are more accurate.

**"Click here" / vague link detection:**

```
Check all <a> and <button> text content for:
- "click here", "read more", "learn more", "here", "more", "link"
- Very short text (1-2 characters, like ">" or "X") without aria-label
```

**Complexity:** Easy for vague link detection. Medium for readability scoring (syllable counting). The current analyzer already has a cognitive load section with heading counts and form field counts — this extends it.

### 2.5 Mobile-First Users

**Source standards:** Google Material Design touch guidelines, Apple HIG, WCAG 2.5.5/2.5.8.

**Specific recommendations:**

| Property | Recommendation | How to Check |
|----------|---------------|--------------|
| Touch targets | 48x48dp (Material), 44pt (Apple) | Existing check with raised threshold |
| Thumb zone | Primary actions in bottom 60% of screen | Check position of CTAs relative to viewport |
| Scroll depth | Critical info above fold | Check if key elements are within initial viewport |
| Horizontal scroll | No horizontal scroll on mobile | Check for elements wider than viewport |
| Font size minimum | 16px to prevent iOS zoom on input focus | Check input font-size |
| Viewport meta | Must include `width=device-width` | Check meta tag |
| Tap delay | No 300ms delay (touch-action: manipulation) | Check CSS for touch-action |

**Thumb zone analysis:**

The "thumb zone" concept (Steven Hoober's research): on a phone held in one hand, the natural thumb reach covers roughly the bottom-center area. Primary actions (CTAs, navigation) should be in this zone.

```
Approach:
1. Identify primary CTAs (buttons with prominent styling, <a> with button-like classes)
2. Get their bounding rect positions
3. Check if they're in the bottom 60% of the viewport height
4. Flag CTAs in the top 20% as "outside thumb zone on mobile"
```

**Complexity:** Easy. This is pure position checking with existing APIs.

### 2.6 WCAG AAA vs AA Summary

| Criterion | AA | AAA |
|-----------|-----|-----|
| Text contrast (normal) | 4.5:1 | 7:1 |
| Text contrast (large) | 3:1 | 4.5:1 |
| Target size | 24x24px (2.5.8) | 44x44px (2.5.5) |
| Resize text | Up to 200% | Up to 200% (same) |
| Reading level | Not required | Grade 9 or below (3.1.5) |
| Multiple ways to find content | Required (2.4.5) | Required (same) |
| Section headings | Not required | Required (2.4.10) |
| Link purpose | In context (2.4.4) | From link text alone (2.4.9) |

**Implementation:** A "WCAG Level" toggle (AA / AAA) that adjusts all thresholds simultaneously. This is a simple config object swap — all the checks already exist, only thresholds change.

**Complexity:** Easy. Create a thresholds object per level, pass it to scoring functions.

### 2.7 Industry-Specific Guidelines

| Industry | Standard | Key Additions Beyond WCAG AA |
|----------|----------|------------------------------|
| **U.S. Government** | Section 508 (maps to WCAG AA) | Mandatory, not optional. PDF accessibility. |
| **EU Government/Public** | EN 301 549 (maps to WCAG AA) | Mobile app accessibility, ICT products. |
| **Healthcare** | Section 508 + HIPAA (data) | Larger fonts for elderly patients. Clear medication names. Error prevention on forms. |
| **Education** | Section 508 + IDEA | Cognitive load limits. Reading level checks. Alternative content. |
| **E-commerce** | ADA Title III (case law) | Color-blind-safe product selection. Cart/checkout form accessibility. Price readability. |
| **Banking/Finance** | Section 508 + PCI (data) | Session timeout warnings. Error recovery. Large touch targets for ATM-style interfaces. |

**Implementation approach:** Create persona profiles as JSON config objects:

```
{
  "name": "Healthcare — Patient Portal",
  "extends": "wcag-aaa",
  "overrides": {
    "minBodyFontSize": 18,
    "minContrastNormal": 7,
    "minTouchTarget": 48,
    "requireLinkUnderlines": true,
    "maxReadingLevel": 8,
    "requireErrorPrevention": true
  }
}
```

**Complexity:** Easy once the scoring functions accept threshold parameters (which is a refactor of the current hardcoded values).

---

## Area 3: Layout and Visual Relationship Scoring

### Overview

Layout quality assessment without AI is possible by using geometric analysis of element bounding boxes. Every technique below relies on `getBoundingClientRect()`, which returns exact pixel positions, and `getComputedStyle()` for style information.

### 3.1 Orphaned Elements

**Definition:** Elements that are visually disconnected from their semantic group — e.g., a label floating far from its input, or a card that's misaligned from the card grid.

**Detection approach:**

```
1. Group elements by semantic parent (section, article, div with role)
2. For each group, compute the bounding box of the group (union of all children)
3. Find children whose bounding box is far from the group's center or edges
4. "Far" = distance > 2x the group's average child spacing
```

**More practical heuristic — form label-input proximity:**

```
1. For each <label>, find its associated <input> (via for= or DOM nesting)
2. Measure distance between label and input bounding boxes
3. If distance > 24px (or if another element is visually between them), flag as orphaned
```

**Complexity:** Medium. The general case (arbitrary element grouping) is hard. Specific patterns like label-input proximity and card-grid alignment are well-defined and easy.

**Accuracy:** High for specific patterns (form labels, grid items). Low for general "visual disconnection" without understanding design intent.

### 3.2 Inconsistent Alignment

**Definition:** Elements that are "almost but not quite" aligned — e.g., two cards where the left edge is 2px off, or headings that are 3px off from the content margin.

**Detection approach:**

```
1. Collect left-edge x-positions of all block-level children within each section
2. Cluster the x-values (group values within 4px of each other)
3. If a cluster has 1 element but another cluster has 3+ elements at nearly the same position (within 1-5px), the outlier is misaligned
4. Same logic for top-edges, right-edges, and baselines
```

**Algorithm detail — alignment clustering:**

```
x-positions: [16, 16, 16, 18, 32, 32]
Clusters (4px tolerance): [16, 16, 16, 18] and [32, 32]
Within cluster 1: 18 is 2px off from the mode (16) — flag as "near-miss alignment"
```

This is essentially a 1D clustering problem. Use a simple sweep: sort positions, group adjacent values within a threshold.

**Additional checks:**
- **Center alignment consistency:** For centered elements, check if the computed center-x is within 2px of the parent's center-x.
- **Baseline alignment:** For inline/flex items in a row, check if text baselines align. This is harder because `getBoundingClientRect()` gives the element box, not the text baseline. Approximation: `top + fontSize * 0.8` (for most fonts, the baseline is roughly 80% down from the top of the em-square).

**Complexity:** Medium. The clustering algorithm is simple. The challenge is knowing which elements *should* be aligned — you need to compare elements at the same hierarchical level and within the same visual row/column.

**Accuracy:** High when comparing siblings in a grid or flex container. Lower for arbitrary cross-section comparisons.

**Libraries:**

- No specific library for this. It's straightforward geometric math.
- **`fast-cluster`** or simple sort-and-group is sufficient.

### 3.3 Visual Weight Balance

**Definition:** Whether the density of content is roughly balanced between left/right and top/bottom halves of the viewport or sections.

**Detection approach:**

```
1. Divide the viewport (or each section) into quadrants
2. For each element, calculate its "visual weight":
   - Area (width × height) contributes base weight
   - Dark elements weigh more than light (darker fills attract more attention)
   - Text density (characters per area) adds weight
   - Images are heavy
   - High-contrast elements are heavier
3. Sum weights per quadrant
4. Compare: if one quadrant has >60% of the total weight, flag as unbalanced
```

**Simpler approach — pixel density:**

```
1. Divide viewport into left/right halves
2. Count total element area in each half (sum of width × height for all visible elements)
3. Ratio = larger / smaller
4. If ratio > 2.0, flag as "visually unbalanced"
```

**Complexity:** Easy for the simple area-based approach. Medium for the weighted approach (needs color analysis per element). The simple approach is actually quite effective — severe balance issues are obvious at the area level.

**Accuracy:** The simple approach catches extreme imbalances (e.g., all content in the left 40%). It misses subtle weight differences (e.g., a dark image on the right visually balancing text on the left). For an automated tool without AI, the area-based check is the right trade-off.

### 3.4 Whitespace Rhythm

**Definition:** Consistent spacing between sections creates visual rhythm. Inconsistent gaps between sections feel disjointed.

**Detection approach:**

```
1. Select all direct children of <main> (or <body> if no main), typically <section> elements
2. Measure the vertical gap between each consecutive pair: section[i+1].top - section[i].bottom
3. Compute the standard deviation of these gaps
4. If stddev / mean > 0.3, flag as "inconsistent section spacing"
5. Report the specific gaps for remediation
```

**Extended check — internal spacing consistency:**

```
1. Within each section, measure gaps between children
2. Check if internal gaps follow a ratio (e.g., all 16px, or alternating 16/32)
3. Flag sections where gap variance is high
```

**Complexity:** Easy. This is straightforward measurement with basic statistics.

**Accuracy:** High. Section spacing is directly measurable and the standard deviation threshold is a good proxy for visual rhythm.

### 3.5 Z-Pattern and F-Pattern Detection

**Definition:** Users tend to scan content in an F-pattern (for text-heavy pages) or Z-pattern (for marketing/landing pages). Checking if important content aligns with these patterns can indicate reading flow quality.

**F-pattern check:**

```
1. Identify the page type (text-heavy = content/blog; visual = landing/marketing)
2. For text-heavy pages, check F-pattern compliance:
   - H1/H2 headings should be left-aligned or full-width (users read the first line fully)
   - Key content should be in the left 60% of the viewport
   - Right 40% should be secondary (sidebar, images, ads)
3. Measure: what percentage of text content area is in the left 60%?
4. If < 50% of text is in the left 60%, the layout fights F-pattern reading
```

**Z-pattern check:**

```
1. For marketing/landing pages, check Z-pattern:
   - Top-left: logo/brand (check if <header> has content in top-left)
   - Top-right: CTA or nav (check if nav/button is in top-right quadrant)
   - Bottom-left: secondary info
   - Bottom-right: primary CTA (check if a prominent button is in bottom-right area)
2. Score based on how many Z-points have appropriate content
```

**Complexity:** Medium. The pattern checks are heuristic — defining what "important content" is requires assumptions. Using heading elements and buttons as proxies for importance is reasonable.

**Accuracy:** Low-medium. These are rules of thumb, not strict laws. A page can be excellent without following F or Z patterns. Best used as a suggestion ("consider Z-pattern for your CTA placement") rather than a hard error.

### 3.6 Visual Hierarchy Quality

**Definition:** Headings should be clearly larger than body text, and the size progression should be consistent.

**Detection approach:**

```
1. Already partially implemented in scoreTypography (heading scale ratio)
2. Extend with:
   - Heading-to-body ratio: h1 should be 2x-3x body size
   - Heading-to-next-heading ratio: each level should be 1.2x-1.5x the next
   - Visual weight differentiation: headings should differ from body in at least 2 of: size, weight, color
   - Spacing signal: headings should have more margin-top than margin-bottom (they "belong to" the content below)
```

**Heading proximity check (Gestalt proximity):**

```
1. For each heading, measure:
   - margin-bottom (space to its content)
   - margin-top (space from previous section)
2. If margin-top <= margin-bottom, the heading feels like it belongs to the previous section
3. Ideal: margin-top >= 1.5 × margin-bottom
```

**Complexity:** Easy. This extends existing typography scoring with additional ratio checks.

**Accuracy:** High. These are well-established typographic rules with clear numeric thresholds.

---

## Area 4: Performance and Web Vitals Correlation

### 4.1 Cumulative Layout Shift (CLS)

**Can we measure CLS from within a page?**

Yes. The `PerformanceObserver` API with `type: 'layout-shift'` is supported in all Chromium browsers (Chrome, Edge, Opera — ~70% of desktop, ~65% of mobile). Not supported in Firefox or Safari.

**Approach:**

```javascript
// This works in Chromium browsers
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) { // Exclude user-triggered shifts
      clsValue += entry.value;
      // entry.sources tells you WHICH elements shifted
    }
  }
}).observe({ type: 'layout-shift', buffered: true });
```

**Key details:**

- **`buffered: true`** gives you shifts that already occurred before the observer was created — critical for the analyzer scenario where the script runs after page load.
- **`entry.sources`** provides the DOM nodes that shifted, allowing specific element-level reporting ("this image caused a 0.15 layout shift").
- **Thresholds:** CLS < 0.1 = good, 0.1-0.25 = needs improvement, > 0.25 = poor.

**Limitation:** The analyzer snippet runs at a single point in time. To capture CLS accurately, it would need to be injected before or during page load. For the paste-HTML-into-analyzer flow, this works naturally because the HTML is loaded into an iframe and the observer can be set up before the content renders.

**Complexity:** Easy. The API is straightforward and well-documented. The iframe injection point is ideal.

**Accuracy:** High in Chromium. Zero coverage in Firefox/Safari — fall back to heuristic checks (see below).

### 4.2 Font Loading Impact (FOIT/FOUT)

**Detection approach:**

1. **Detect web font usage:** Check if any `@font-face` rules exist in stylesheets, or if `document.fonts` API shows non-system fonts.

2. **`document.fonts` API** (Font Loading API — supported in all modern browsers):
   ```javascript
   document.fonts.ready.then(() => {
     document.fonts.forEach(font => {
       console.log(font.family, font.status); // "loaded", "loading", "error"
     });
   });
   ```

3. **Detect `font-display` strategy:** Parse `@font-face` rules from stylesheets for the `font-display` property:
   - `auto` / missing = browser default (usually FOIT for up to 3s) — flag as warning
   - `swap` = FOUT (text visible immediately in fallback, swaps when loaded) — acceptable
   - `block` = FOIT (invisible text for up to 3s) — flag as error
   - `fallback` = brief FOIT (100ms), then FOUT — acceptable
   - `optional` = brief FOIT, may not swap at all — best for performance

4. **Detect preloading:** Check `<link rel="preload" as="font">` tags. Fonts without preload hints load later, increasing FOIT/FOUT duration.

**Approach:**

```
1. Enumerate document.fonts — list all fonts and their status
2. Parse @font-face rules from accessible stylesheets
3. For each web font, check:
   - Does it have font-display: swap/fallback/optional? (good) or block/auto? (bad)
   - Is it preloaded via <link rel="preload">? (good if critical)
   - Is it loaded from a third-party CDN? (adds latency)
4. Count the number of web font files — more than 4-6 files = warning
```

**Complexity:** Easy to medium. The `document.fonts` API and stylesheet rule inspection are well-supported. Parsing `@font-face` from cross-origin stylesheets (e.g., Google Fonts) will fail due to CORS — but you can detect the `<link>` to Google Fonts and infer font-display from the URL parameters.

**Accuracy:** High for detecting the presence and strategy. Cannot measure actual load time without network timing (which `PerformanceObserver` with `type: 'resource'` can provide).

### 4.3 Image Sizing Issues

**Detection approach:**

1. **Images without explicit dimensions:** Query all `<img>` elements. Check for `width` and `height` attributes (not just CSS). Images without intrinsic dimensions cause layout shifts when they load.

   ```
   document.querySelectorAll('img').forEach(img => {
     const hasWidth = img.hasAttribute('width') || img.style.width;
     const hasHeight = img.hasAttribute('height') || img.style.height;
     const hasCSSAspect = getComputedStyle(img).aspectRatio !== 'auto';
     if (!hasWidth || !hasHeight) { /* flag */ }
   });
   ```

2. **Oversized images:** Compare `naturalWidth`/`naturalHeight` to the displayed `clientWidth`/`clientHeight`. If the natural size is >2x the displayed size, the image is wasting bandwidth.

   ```
   if (img.naturalWidth > img.clientWidth * 2) {
     // Image is at least 2x larger than displayed — flag
   }
   ```

3. **Missing lazy loading:** Check for `loading="lazy"` on images below the fold. Images without it load eagerly, slowing initial page load.

   ```
   // Images below the fold without lazy loading
   const fold = window.innerHeight;
   if (img.getBoundingClientRect().top > fold && img.loading !== 'lazy') {
     // Flag: below-fold image without lazy loading
   }
   ```

4. **Missing `srcset` / responsive images:** Check if images have `srcset` attributes for responsive serving.

5. **Format detection:** Check image URLs for modern formats (`.webp`, `.avif`). Flag `.png` and `.jpg` as "consider modern format" if they're large.

**Complexity:** Easy. All of these are simple attribute/property checks.

**Accuracy:** High. These are deterministic checks with clear pass/fail criteria.

### 4.4 Estimating LCP from the DOM

**Can we identify the LCP element?**

Yes, using the `PerformanceObserver` API with `type: 'largest-contentful-paint'` (Chromium only).

```javascript
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1]; // LCP is the last entry
  console.log('LCP element:', lastEntry.element); // DOM node
  console.log('LCP time:', lastEntry.startTime); // ms
  console.log('LCP size:', lastEntry.size); // pixel area
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

**Thresholds:** LCP < 2.5s = good, 2.5-4s = needs improvement, > 4s = poor.

**Heuristic LCP estimation (for non-Chromium):**

Without the Performance API, we can estimate LCP by finding the largest visible element:

```
1. Get all visible elements with content (images, text blocks, videos)
2. Calculate visible area (intersection with viewport)
3. The element with the largest visible area is likely the LCP element
4. Check if it's an image (slow to load) or text (fast to render)
5. If image: check if it's preloaded, has fetchpriority="high", or uses lazy loading (bad for LCP)
```

**Specific LCP optimizations to check:**

| Check | What to Look For | Severity |
|-------|-----------------|----------|
| Hero image preload | `<link rel="preload">` for the LCP image | Warning if missing |
| Fetch priority | `fetchpriority="high"` on LCP image | Info |
| Lazy loading on LCP | `loading="lazy"` on above-fold images | Error (hurts LCP) |
| LCP image in CSS | LCP is a `background-image` (not discoverable by preload scanner) | Warning |
| LCP text rendering | LCP is text blocked by web font loading | Warning (check font-display) |

**Complexity:** Easy for the Performance API approach. Medium for the heuristic approach (need to correctly identify the largest visible element and check its loading strategy).

**Accuracy:** High with the Performance API (it's the actual browser measurement). Medium for the heuristic (we can identify the likely LCP element but can't measure actual load time without the API).

### 4.5 Additional Performance Checks (No API Required)

These checks require no Performance API — they're pure DOM/CSS inspection:

| Check | How | Complexity |
|-------|-----|-----------|
| Render-blocking CSS | Count `<link rel="stylesheet">` in `<head>` without `media` attribute | Easy |
| Render-blocking JS | Count `<script>` in `<head>` without `async`/`defer` | Easy |
| Excessive DOM size | `document.querySelectorAll('*').length` > 1500 = warning, > 3000 = error | Easy |
| Deep DOM nesting | Walk the tree, find max depth. > 32 levels = warning | Easy |
| Excessive CSS animations | Count elements with non-static `animation` property. > 10 simultaneous = warning | Easy |
| Third-party scripts | Count `<script>` with external domains | Easy |
| Uncompressed inline SVG | Measure total size of inline SVG content. > 50KB = warning | Easy |
| `will-change` overuse | Count elements with `will-change` != `auto`. > 10 = warning (memory) | Easy |

**Complexity:** All easy. These are simple DOM queries.

---

## Implementation Priority Matrix

| Feature | Impact | Complexity | Accuracy | Priority |
|---------|--------|------------|----------|----------|
| Gradient contrast sampling | High | Medium | High | **P0** |
| Image sizing checks (4.3) | High | Easy | High | **P0** |
| WCAG AA/AAA toggle (2.6) | High | Easy | High | **P0** |
| Whitespace rhythm (3.4) | Medium | Easy | High | **P1** |
| CLS measurement (4.1) | High | Easy | High (Chromium) | **P1** |
| Font loading analysis (4.2) | Medium | Easy-Medium | High | **P1** |
| Alignment consistency (3.2) | Medium | Medium | High | **P1** |
| Persona profiles (2.1-2.5) | High | Easy | High | **P1** |
| Visual hierarchy checks (3.6) | Medium | Easy | High | **P1** |
| LCP estimation (4.4) | Medium | Easy-Medium | Medium-High | **P2** |
| Background image contrast (1.2) | Medium | Hard | Medium (CORS) | **P2** |
| SVG text contrast (1.3) | Low-Medium | Medium | Medium | **P2** |
| CSS filter contrast (1.4) | Low | Medium | Medium | **P2** |
| Readability scoring (2.4) | Medium | Medium | Medium | **P2** |
| Visual weight balance (3.3) | Low | Easy | Low-Medium | **P3** |
| Z/F pattern detection (3.5) | Low | Medium | Low | **P3** |
| Orphaned elements (3.1) | Low | Medium | Low | **P3** |

## Key Libraries Summary

| Library | Purpose | Size | License |
|---------|---------|------|---------|
| `axe-core` | Reference implementation for contrast/a11y | ~300KB | MPL-2.0 |
| `color.js` (Lea Verou) | Color parsing, WCAG + APCA contrast | ~30KB | MIT |
| `apca-w3` | APCA contrast algorithm | ~5KB | W3C License |
| `gradient-parser` | CSS gradient string parsing | ~2KB | MIT |
| `syllable` | Syllable counting for readability | ~2KB | MIT |
| `html2canvas` | DOM-to-canvas rendering (nuclear option for contrast) | ~50KB | MIT |

---

## Sources

- WCAG 2.2 specification: https://www.w3.org/TR/WCAG22/
- axe-core source (color handling): https://github.com/dequelabs/axe-core/tree/develop/lib/commons/color
- Web Vitals documentation: https://web.dev/vitals/
- Layout Shift API: https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift
- Font Loading API: https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet
- Largest Contentful Paint API: https://developer.mozilla.org/en-US/docs/Web/API/LargestContentfulPaint
- W3C WAI — Older Users: https://www.w3.org/WAI/older-users/
- COGA Task Force: https://www.w3.org/WAI/GL/task-forces/coga/
- Steven Hoober thumb zone research: https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/
- APCA contrast: https://github.com/Myndex/SAPC-APCA
