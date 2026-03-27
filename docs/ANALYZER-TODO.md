# Analyzer TODO

## Recently Fixed
- [x] General vs WCAG AAA shows no difference — Fixed: snippet now captures all pairs up to 7.5:1 ratio
- [x] Two-step exclusion flow — Fixed: post-analysis exclusion suggestions with detected patterns
- [x] Gradient contrast — Fixed: canvas-based sampling in all extractors
- [x] Persona profiles — Fixed: 5 profiles with evidence-based thresholds
- [x] Modular architecture — Fixed: scoring/ directory with 13 independent modules

## Open Issues

- [ ] **Touch targets on responsive sites** — Desktop scan flags small elements that may be larger at mobile breakpoints. Add note when responsive CSS is detected: "This site uses responsive breakpoints — touch targets may be correctly sized on mobile."
- [ ] **URL link in report** — Some users report the URL isn't clickable. May need to test across browsers.
- [x] **Extraction data caching** — Store last extraction in sessionStorage so profile/exclusion changes don't require re-fetch
- [ ] **Report comparison** — Show score delta when re-scoring with different profile or exclusions
- [x] **Dark mode on report** — Severity badges use hardcoded colors. Should respect dark-ui class.

## P2 Features (research complete, implementation pending)

- [x] **Background image contrast** — Canvas sampling with CORS fallback (see research/analyzer-p2-research.md §1)
- [x] **CSS filter contrast math** — Apply brightness()/contrast()/opacity() adjustments to RGB before ratio calc (see research §3)
- [x] **Coleman-Liau readability** — Full implementation with text extraction from `<p>` elements (see research §4)
- [x] **Scanability scoring** — Paragraph length, heading frequency, list usage, wall-of-text detection (see research §5)
- [x] **LCP estimation** — PerformanceObserver in Chromium, heuristic fallback (see research/analyzer-roadmap.md §4.4)

## Extension: LLM API Integration (future, opt-in)

**Default: off.** Only visible when user provides an API key (OpenRouter for free models, or direct Anthropic/OpenAI key).

**What LLMs are good at** (soft judgment): tone, copy clarity, color palette appropriateness, summarizing findings.
**What LLMs are NOT good at** (hard facts): contrast ratios, pixel measurements — rule engine is better.

Low priority — the analyzer's value is evidence-based scoring, not AI opinions.

## Animation & Keyframe Analysis

- [x] Detect `opacity: 0` + transition combo (scroll-reveal state) — implemented
- [x] Count @keyframes rules — implemented
- [x] Detect prefers-reduced-motion support — implemented
- [x] Detect scroll-reveal library patterns (AOS, wow.js) — implemented
- [x] Scroll page before extraction to trigger intersection observers
- [x] Mark findings with "element may be in pre-animation state"
- [x] Detect `transform: translateY()` off-screen elements

---

## Module Optimization Research & Detection Improvements

### contrast.js — Color & Contrast (20%)
**Current:** Walks DOM parents for backgroundColor, canvas fallback for oklch/oklab, gradient sampling.
**To improve:**
- [x] **Background images:** Draw bg-image to canvas, sample pixels at text position. Needs background-size/position math. CORS limitation for cross-origin images. (research/analyzer-p2-research.md §1)
- [x] **CSS filters on ancestors:** Walk parent chain checking for `filter: brightness(X) contrast(Y)`. Adjust RGB mathematically before computing ratio. brightness(0.5) halves each channel. contrast(2) doubles distance from 128. (research §3)
- [ ] **Semi-transparent overlays:** Current blending is correct but doesn't handle backdrop-filter or mix-blend-mode. Flag these as "uncertain" rather than computing wrong values.
- [ ] **Dark mode variant testing:** Automatically test dark: variant contrast by toggling `.dark` class before extraction. Currently only tests the active mode.
- [x] **APCA (Advanced Perceptual Contrast Algorithm):** Add as alternative metric alongside WCAG. More accurate for large/small text. Library: `apca-w3` (~5KB). Source: https://github.com/Myndex/SAPC-APCA

### typography.js — Typography (15%)
**Current:** Body font size, line height, line length, heading scale, font weight count, family count.
**To improve:**
- [x] **Actual character-per-line measurement:** Current uses `element.width / (fontSize * 0.5)` which is a rough estimate. Better: create a temporary `<span>` with representative text, measure its width, divide element width by character width.
- [ ] **Font loading performance:** Check for `font-display: optional` vs `swap` vs `block`. Measure if custom fonts are subset or full. Source: https://web.dev/articles/font-best-practices
- [ ] **Vertical rhythm detection:** Check if line heights create a consistent baseline grid. All spacings should be multiples of the base line height.
- [x] **Letter spacing audit:** Detect `letter-spacing` values that reduce readability (too tight < -0.02em or too loose > 0.1em for body text).
- [x] **Paragraph spacing:** Check `margin-bottom` on `<p>` elements. Should be 0.75-1em. Source: Butterick's Practical Typography.

### spacing.js — Spacing & Layout (15%)
**Current:** 4px grid adherence, content max-width, body padding, adjacent element spacing.
**To improve:**
- [ ] **Nested spacing consistency:** Check if spacing increases predictably from component → section → page level. Gestalt proximity principle.
- [x] **Container padding audit:** Verify cards, modals, sections have consistent internal padding (not some 12px and others 24px in the same design).
- [x] **Overflow detection:** Check if any elements overflow their containers (`scrollWidth > clientWidth`). Common on mobile.
- [x] **Negative margin detection:** Flag negative margins as potential layout fragility.
- [ ] **Gap vs margin consistency:** Check if the same spacing is achieved via gap in some places and margin in others (should be consistent).

### touch.js — Touch & Interaction (15%)
**Current:** Viewport-aware thresholds (24px desktop / 44px mobile), profile-aware, desktop touch note.
**To improve:**
- [x] **Responsive CSS detection for touch:** When site has `@media` queries, note that touch targets may have different sizes at mobile breakpoints. Don't error if responsive classes exist.
- [x] **Padding-inclusive measurement:** Some elements have small visible size but larger clickable area via padding. Check if the padding box (not just content box) meets the threshold.
- [ ] **Overlapping targets:** Check if any interactive elements overlap each other (absolute positioning causing stacking).
- [ ] **Click density mapping:** Identify areas with many small targets clustered together (e.g., tag clouds, icon grids) and flag the group, not each individual element.
- [ ] **Hover state detection:** Check if interactive elements have `:hover` styles defined (computed style can't detect this directly — need to check stylesheet rules).

### accessibility.js — Accessibility (15%)
**Current:** Semantic HTML, heading hierarchy, alt text, form labels, focus indicators.
**To improve:**
- [x] **ARIA role audit:** Check for common ARIA mistakes (role="button" without keyboard handler, aria-hidden on focusable elements).
- [x] **Color-only indicators:** Detect if status/error states rely solely on color (e.g., red text without an icon or label). Source: WCAG §1.4.1.
- [x] **Link text quality:** Flag links with "click here", "read more", "learn more" as non-descriptive. Source: WCAG §2.4.4.
- [x] **Skip navigation link:** Check for `<a href="#main-content">` or similar skip link as first focusable element. Source: WCAG §2.4.1.
- [x] **Language attribute:** Check `<html lang="...">` is set. Source: WCAG §3.1.1.
- [x] **Autocomplete attributes:** Check if common form fields (name, email, phone, address) have appropriate `autocomplete` values. Source: WCAG §1.3.5.

### responsive.js — Responsive Design (10%)
**Current:** Checks for Tailwind responsive classes or CSS @media queries, dark mode detection.
**To improve:**
- [x] **Viewport meta tag audit:** Check for `width=device-width` and absence of `user-scalable=no` (which blocks pinch-to-zoom). Source: WCAG §1.4.4.
- [x] **Horizontal overflow detection:** Check `document.documentElement.scrollWidth > viewport.width`. Common responsive failure.
- [x] **Image responsive sizing:** Check if images use `max-width: 100%` or `width: 100%; height: auto`. Images that overflow containers on small screens.
- [x] **Fixed-width element detection:** Find elements with hardcoded pixel widths that don't flex (e.g., `width: 800px` without max-width).
- [x] **Text truncation audit:** Detect `text-overflow: ellipsis` on elements — content may be hidden on small screens.

### consistency.js — Visual Consistency (5%)
**Current:** Color count, font size count, page-context scaling.
**To improve:**
- [ ] **Border radius consistency:** Cluster border-radius values and flag when too many distinct values exist (e.g., 4px, 6px, 8px, 10px, 12px — should be 2-3 values max).
- [ ] **Shadow consistency:** Same approach for box-shadow — cluster and flag inconsistency.
- [ ] **Color distance analysis:** Check if similar-but-not-identical colors exist (e.g., #333 and #2d2d2d used for the same purpose). Use CIEDE2000 for perceptual distance.
- [ ] **Icon sizing consistency:** Check if SVG/icon elements use consistent sizing across the page.

### cognitive.js — Cognitive Load (5%)
**Current:** Heading count, form field count.
**To improve:**
- [ ] **Decision point counting:** Count visible CTAs, buttons, links per section. Hick's Law: decision time increases logarithmically with choices. Source: https://lawsofux.com/hicks-law/
- [ ] **Information density heuristic:** Elements-per-viewport-height as a density metric. Too dense = overwhelming. Source: cognitive load research.
- [ ] **Modal/popup detection:** Count elements with `position: fixed` or `z-index > 100` that might be modals. Multiple modals = bad UX.
- [ ] **Input complexity:** For forms, check if placeholder is used instead of label (bad for memory), if required fields are marked, if inline validation exists.

### layout.js — Layout Quality (5%)
**Current:** Whitespace rhythm (section gap variance), alignment consistency, H1-to-body ratio.
**To improve:**
- [ ] **Grid structure detection:** Detect if the page uses a consistent grid (12-col, 8-col, etc.) by analyzing element widths as fractions of container width.
- [ ] **Proximity grouping audit:** Check if related elements (e.g., label + input, image + caption) have tighter spacing than unrelated elements. Gestalt proximity.
- [ ] **Full-bleed detection:** Identify sections that break out of the content container (full-width backgrounds, hero images).
- [ ] **Sticky element audit:** Check for `position: sticky` elements and verify they have appropriate z-index.

### performance.js — Performance (5%)
**Current:** Font loading, render-blocking resources, DOM size, DOM depth.
**To improve:**
- [x] **CLS detection:** Use `PerformanceObserver` with `layout-shift` entries (Chromium only). Source: https://web.dev/articles/cls
- [ ] **Image format audit:** Check if images use modern formats (WebP, AVIF) vs legacy (JPEG, PNG). Available from `<img>` src extension.
- [x] **Third-party script count:** Count `<script>` tags with external domains. Flag when > 5.
- [ ] **Inline CSS size:** Measure total bytes of `<style>` blocks. Large inline CSS delays rendering.
- [ ] **Critical CSS detection:** Check if above-fold styles are inlined and below-fold CSS is deferred.

### readability.js — Readability (5%)
**Current:** Heading density, short heading detection, small text audit.
**To improve:**
- [ ] **Coleman-Liau readability index:** Full implementation. Formula: `0.0588 * L - 0.296 * S - 15.8` where L = avg letters per 100 words, S = avg sentences per 100 words. No syllable counting needed.
- [ ] **Paragraph length audit:** Flag paragraphs > 150 words. Ideal: 40-80 words. Source: NNGroup.
- [ ] **List usage detection:** Pages with long text blocks but no lists score lower. Lists improve scanability by 47% (NNGroup).
- [ ] **Text extraction from main content:** Filter out nav, footer, sidebar text to only score the main content area.
- [ ] **Reading level appropriateness by audience:** General audience = grade 8-10. Professional = grade 12+. Elderly = grade 6-8.

### filters.js — Motion & Animation (3%)
**Current:** prefers-reduced-motion check, hidden scroll-reveal elements, library detection.
**To improve:**
- [ ] **Animation duration audit:** Extract all `animation-duration` values from computed styles and @keyframes. Flag durations > 1s.
- [ ] **Parallax detection:** Check for `background-attachment: fixed` or `transform: translateZ()` patterns that indicate parallax scrolling.
- [ ] **Auto-playing media:** Detect `<video autoplay>` or `<audio autoplay>` without `muted`. Source: WCAG §1.4.2.
- [ ] **Flash/strobe detection:** Check if any animation rapidly alternates between high-contrast states (> 3 flashes per second). Source: WCAG §2.3.1.

### balance.js — Visual Balance (3%)
**Current:** Left-right content distribution from alignment edges.
**To improve:**
- [ ] **Top-bottom balance:** Check if content density is evenly distributed vertically or heavily top-loaded.
- [ ] **Visual weight by color:** Dark/saturated elements carry more visual weight than light/muted ones. Weight the area calculation by element darkness.
- [ ] **Whitespace ratio:** Calculate ratio of empty space to content area. Too little = cramped, too much = sparse. Sweet spot: 40-60% whitespace.
- [ ] **F-pattern support:** For text-heavy pages, check if content aligns to a strong left edge with decreasing engagement rightward (expected F-pattern).

---

## Extraction Script Improvements

### Performance
- [ ] **Element limit:** Cap DOM traversal at 2000 elements for performance on very large pages
- [ ] **Batched getComputedStyle:** Reading computed styles is expensive. Batch reads to minimize layout thrashing.
- [ ] **Web Worker extraction:** Move the heavy extraction to a Web Worker to avoid blocking the main thread (requires restructuring since Workers can't access DOM — would need to serialize DOM data first).

### Accuracy
- [ ] **Scroll-before-extract mode:** Option in snippet to scroll the full page before extracting, triggering intersection observers and lazy loading.
- [ ] **Multi-viewport extraction:** Run extraction at multiple viewport widths (375px, 768px, 1280px) and merge findings. Shows which issues are viewport-specific.
- [ ] **Dark mode extraction:** Toggle `.dark` class, re-extract, merge findings. Shows issues specific to dark mode.
- [ ] **Hover/focus state simulation:** Use `el.matches(':hover')` — can't simulate directly, but can check stylesheet rules for `:hover`/`:focus` selectors and verify they exist.
- [ ] **iFrame content:** Detect iframes and optionally extract from them (same-origin only).
