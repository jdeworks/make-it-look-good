# Analyzer TODO

## Completed (43 items)

### Core
- [x] Modular scoring architecture (14 modules in `scoring/`)
- [x] 5 audience profiles with evidence-based thresholds
- [x] 3 input modes (URL fetch, console snippet, paste HTML)
- [x] Gradient contrast via canvas sampling
- [x] Background image contrast via canvas (CORS-limited)
- [x] CSS filter contrast math (brightness, contrast, opacity)
- [x] APCA contrast algorithm alongside WCAG
- [x] oklch/oklab color parsing via canvas fallback
- [x] Space-separated rgb() syntax support
- [x] Page context detection (marketing/form/app/content)
- [x] Decorative element filtering
- [x] Post-analysis exclusion suggestions (two-step flow)
- [x] Extraction data caching (sessionStorage)
- [x] Dark mode report styling
- [x] AA/AAA profile switching (captures pairs up to 7.5:1)

### Extraction
- [x] Actual character-per-line via span measurement
- [x] Section gaps for whitespace rhythm
- [x] Left-edge alignment clustering
- [x] Heading-to-body ratio for visual hierarchy
- [x] Border radius value clustering
- [x] Paragraph text extraction (Coleman-Liau)
- [x] Font loading rules from stylesheets
- [x] Render-blocking resource counts
- [x] DOM size and depth
- [x] Adjacent sibling spacing
- [x] Animation/keyframe detection
- [x] Scroll-reveal pattern detection
- [x] Transform translateY off-screen detection
- [x] Element overflow detection
- [x] Letter spacing audit
- [x] Negative margin detection
- [x] Container padding clustering
- [x] Third-party script count
- [x] Image format audit (WebP/AVIF vs legacy)
- [x] CLS via PerformanceObserver
- [x] LCP estimation (API + heuristic)
- [x] Fixed-width element detection
- [x] Text truncation (ellipsis) audit
- [x] ARIA role audit (button tabindex, hidden focusable)
- [x] Bad link text detection
- [x] Missing autocomplete on form fields
- [x] Color-only indicator detection
- [x] Auto-playing unmuted media detection
- [x] Padding-inclusive touch measurement (checks parent label/link)

## Future: Deep Scan Mode

These require re-rendering the page and are best offered as an explicit "deep scan" option:

- [x] **Multi-viewport testing** — Spawn 3 parallel iframes at 375/768/1280px, merge results. Architecture ready, ~2-4s. See `research/multi-viewport-dark-mode.md`
- [x] **Dark mode class toggle** — Toggle `.dark` on html, re-extract colors. ~95% reliable for Tailwind/class-based sites.
- [ ] **Dark mode media query rewriting** — Extract `prefers-color-scheme: dark` rules from stylesheets, inject unconditionally. ~80-90% reliable. See research.
- [ ] **Scroll before extraction** — Auto-scroll full page to trigger intersection observers. Console warning already implemented for manual use.

## Future: LLM Integration (opt-in)

Default off. Only when user provides API key. See research notes in this file's git history.

- [ ] Soft judgment: tone, copy clarity, color palette appropriateness
- [ ] Finding summarization in plain language
- [ ] Clearly labeled as "AI-generated" separate from evidence-based findings

## Decided to Skip (with reasons)

| Item | Reason |
|------|--------|
| Vertical rhythm detection | ~60% accuracy, too many false positives |
| Nested spacing consistency | Can't determine spacing "intent" without component boundaries |
| Gap vs margin consistency | Mixing is often correct (gap for flex, margin for flow) |
| Overlapping targets | False positives from menus, dropdowns, positioned elements |
| Click density mapping | No clear threshold for "too dense," subjective |
| Shadow consistency | Too many legitimate shadow variations (elevation levels) |
| Color distance (CIEDE2000) | Complex (~200 lines), similar colors often intentional |
| Icon sizing consistency | SVG sizing too chaotic in practice |
| Decision point counting | Counting buttons/links per section unreliable |
| Information density | Elements-per-viewport varies wildly by page type |
| Modal/popup detection | position:fixed catches headers/footers too |
| Grid structure detection | Inferring columns from widths unreliable with flexbox |
| Proximity grouping | Requires semantic understanding, pure DOM can't do it |
| Sticky element audit | Almost always intentional, nothing actionable |
| Critical CSS detection | Requires multi-viewport rendering analysis |
| Inline CSS size | Often intentional (critical CSS pattern) |
| Flash/strobe detection | Needs frame-by-frame analysis, not feasible from DOM |
| F-pattern detection | ~40% accuracy without AI |
| Whitespace ratio | Varies by page type, no universal threshold |
| Web Worker extraction | Workers can't access DOM |

## Research Documents

- `research/analyzer-roadmap.md` — P0/P1 roadmap, priority matrix (794 lines)
- `research/analyzer-p2-research.md` — P2/P3 feature research (928 lines)
- `research/multi-viewport-dark-mode.md` — Multi-viewport & dark mode feasibility (345 lines)
