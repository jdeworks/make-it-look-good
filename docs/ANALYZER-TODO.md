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
- [ ] `readability.js` — Flesch-Kincaid, sentence length, passive voice detection
- [ ] `images.js` — Alt text quality (not just present/absent), decorative image detection
- [ ] `forms.js` — Input types, autocomplete, validation patterns, label quality
- [ ] `navigation.js` — Nav depth, breadcrumbs, skip links, landmark completeness
- [ ] `motion.js` — prefers-reduced-motion respect, animation duration audit
- [ ] `seo.js` — Meta tags, heading structure, canonical URL, OG tags
