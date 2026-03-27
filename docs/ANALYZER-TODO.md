# Analyzer TODO

## Open Issues (from user testing)

- [ ] **General vs WCAG AAA shows no difference** — The scoring contrast check re-evaluates pairs but the extraction already filters by the original 4.5:1 threshold. Need to collect ALL contrast pairs (not just failures + near-misses) so AAA mode can find elements that pass AA but fail AAA.
- [ ] **Exclude element suggestions don't appear on report page** — The exclude presets (Mock UI, Footer, etc.) only show on the input page. Need a "re-analyze with exclusions" option on the report page, or show detected patterns after first analysis (two-step flow).
- [ ] **Two-step analysis flow** — Extract first → show detected patterns → user confirms exclusions → score. Currently exclusions must be set before analysis.
- [ ] **URL link in report still not clickable for some users** — May be a CSS specificity issue or the `a` tag inside `.report-url` needs more explicit styles.

## P2 Features (research in progress)

- [ ] Background image contrast — Canvas sampling with CORS fallback
- [ ] SVG text contrast — Read `fill` attribute, find background from sibling shapes
- [ ] CSS filter contrast impact — Mathematical adjustment for brightness/contrast/opacity filters
- [ ] Readability scoring (Flesch-Kincaid) — Syllable counting, extract main content text
- [ ] LCP estimation — PerformanceObserver or heuristic (largest visible element)

## P3 Features (need more research)

- [ ] Reading pattern detection (Z/F/scanning) — Heuristic from DOM layout
- [ ] Visual weight balance — Quadrant density analysis
- [ ] Orphaned element detection — Elements far from their visual group

## Architecture / UX

- [ ] **Post-analysis exclusion editor** — After scoring, show: "We detected X elements with .mock-* classes. Exclude and re-score?"
- [ ] **Extraction data caching** — Store last extraction in sessionStorage so profile/exclusion changes don't require re-fetch
- [ ] **Report comparison** — Show before/after when re-scoring with different profile or exclusions
- [ ] **Share report via URL** — Compress and encode report data in hash for sharing (already partially works via #data=)
- [ ] **Dark mode on report** — Report uses hardcoded light colors for severity badges. Should respect dark-ui class.

## Scoring Module Ideas

Each would be a new file in `docs/scoring/`:
- [ ] `readability.js` — Coleman-Liau index (no syllable counting), scanability (paragraph length, heading frequency, list usage)
- [ ] `images.js` — Alt text quality (not just present/absent), decorative image detection
- [ ] `forms.js` — Input types, autocomplete, validation patterns, label quality
- [ ] `navigation.js` — Nav depth, breadcrumbs, skip links, landmark completeness
- [ ] `motion.js` — prefers-reduced-motion respect, animation audit, scroll-triggered detection, keyframe analysis
- [ ] `seo.js` — Meta tags, heading structure, canonical URL, OG tags
- [ ] `filters.js` — CSS filter impact on contrast (brightness, contrast, opacity math adjustments)
- [ ] `balance.js` — Visual weight balance (left-right quadrant density, per Ngo et al. 2003)

## Extension: LLM API Integration (future, opt-in)

**Default: off.** Only visible when user provides an API key (OpenRouter for free models, or direct Anthropic/OpenAI key). On the settings/config page, not the main flow.

**What LLMs are good at** (soft judgment, context):
- "Does this hero section convey the right tone?"
- "Is the copy clear for the target audience?"
- "Does the color palette feel appropriate for a medical site?"
- Summarizing findings into plain-language recommendations

**What LLMs are NOT good at** (hard facts):
- Contrast ratios, pixel measurements, spacing values — the rule engine does this better
- LLMs hallucinate numbers and can't reliably compute WCAG ratios

**Implementation notes:**
- LLM receives the extracted JSON + rule-engine findings as context
- Adds a "Design Review" section to the report with soft suggestions
- Clearly labeled as "AI-generated suggestions" separate from evidence-based findings
- Could also use LLM to generate the HTML extraction (fetch page → ask LLM to extract), but snippet is more accurate
- Low priority — the analyzer's value is evidence-based scoring, not AI opinions

## Animation & Keyframe Analysis

**Problem:** Pages with scroll-reveal animations, CSS keyframes, and intersection-observer triggers may have elements that aren't visible at extraction time. The analyzer scans a static snapshot — it misses:
- Elements with `opacity: 0` waiting for scroll-trigger
- Elements translated off-screen (`transform: translateY(100px)`)
- Content that loads lazily via JS
- Carousel slides that aren't the active slide

**Approaches to investigate:**
- [ ] Detect CSS `@keyframes` rules and `animation` properties — flag elements with animations as "may change state"
- [ ] Detect `opacity: 0` + `transition`/`animation` combo — likely scroll-reveal, skip from contrast checks
- [ ] Scroll the page before extraction: `window.scrollTo(0, document.body.scrollHeight)` then back, triggering intersection observers
- [ ] Detect intersection-observer usage via checking for `data-aos`, `[class*="animate"]`, `.wow`, `.reveal` patterns
- [ ] For the snippet: add a "scroll to reveal" option that scrolls the full page before extracting
- [ ] Mark findings with "element may be in pre-animation state" when transform/opacity suggests hidden-until-scroll
