# Test Cases

End-to-end validation of the CONSULT.md design consultation flow. Each test case is a realistic "old" code example that a real user would bring, paired with:

1. **The input** (what the user brings)
2. **Design review notes** (what the LLM generates after auditing)
3. **The improved version** (what the LLM outputs, in the user's original framework)

## Test Cases

### Test Case 1: React Settings Page
- **Input:** `test-case-1-react-settings.jsx` — React component with inline styles, cramped spacing, tiny fonts
- **Review:** `test-case-1-review.md` — 4 critical, 4 important, 3 nice-to-have issues found
- **After:** `test-case-1-react-settings-after.jsx` — Same React + inline styles, all issues fixed
- **Stack test:** Proves the flow works for React with inline styles (no Tailwind migration)

### Test Case 2: Barebones HTML Landing Page
- **Input:** `test-case-2-barebones-html.html` — Hackathon-quality landing + signup page
- **Review:** `test-case-2-review.md` — 6 critical, 5 important issues found
- **After:** `test-case-2-barebones-html-after.html` — Redesigned with Tailwind CDN
- **Stack test:** Proves the flow works for plain HTML with no framework (suggests Tailwind)

### Test Case 3: Vue Dashboard Component
- **Input:** `test-case-3-vue-dashboard.vue` — Vue 3 SFC admin tool with scoped CSS
- **Review:** `test-case-3-review.md` — 5 critical, 5 important issues found
- **After:** `test-case-3-vue-dashboard-after.vue` — Same Vue SFC structure, all issues fixed
- **Stack test:** Proves the flow works for Vue SFC with scoped CSS (no framework switch)

### E2E: Full Flow Dashboard (Screenshotted)
- **Input:** `e2e-before.html` — Plain HTML employee dashboard with sidebar, stats, charts, tabbed table
- **Review:** `e2e-review.md` — 5 critical, 6 important issues (tiny fonts, small targets, color-only status, no spacing system)
- **After:** `e2e-after.html` — Full redesign with Tailwind CDN, responsive (mobile sidebar collapses)
- **Verified:** Screenshots taken at 1280px desktop and 375px mobile to confirm visual improvement
- **Stack test:** Full CONSULT.md flow from Step 0 → Step 1A → Step 2 → Step 3 → Step 4, all steps verified

## Intake Flow Tests (Step 1C — Starting from Scratch)

### Pricing Page (Clean/Minimal + Brand Colors)
- **Flow:** `e2e-pricing-flow.md` — User wants SaaS pricing, provides indigo/teal brand colors
- **Output:** `e2e-pricing.html` — 3-tier pricing with monthly/annual toggle, FAQ, feature comparison
- **Tests:** Step 1C intake, brand color application, clean vibe, component selection

### Developer Portfolio (Dark/Technical)
- **Flow:** `e2e-portfolio-flow.md` — User wants dark mode dev portfolio with emerald accent
- **Output:** `e2e-portfolio.html` — Dark hero, project cards with hover glow, tech stack badges, contact form
- **Tests:** Step 1C intake, dark mode design (borders not shadows, inverted contrast), monospace accents

### Restaurant (Playful/Warm)
- **Flow:** `e2e-restaurant-flow.md` — Cafe site with amber/brown warm palette
- **Output:** `e2e-restaurant.html` — Serif headings, warm colors, menu cards, mobile-first
- **Tests:** Step 1C intake, font pairing (serif + sans), warm palette, mobile-heavy audience (48px targets)

### Status Page (JSON Data → UI)
- **Flow:** `e2e-api-data-flow.md` — User pastes JSON API response, needs public status page
- **Output:** `e2e-status-page.html` — Stat cards, service list, incident timeline, subscribe form
- **Tests:** Step 1D structuring, corporate vibe, color-blind safe status indicators

## Edge Case Tests

### CLI Output → Deploy Dashboard
- **Flow:** `edge-cli-output-flow.md` — User pastes terminal table output
- **Output:** `edge-cli-output.html` — Dark deploy monitor with CPU bars, version badges, alert banner
- **Tests:** Step 1D with non-standard input (terminal ASCII table), monospace preservation, dark technical vibe

### "Make me a button" → Button System
- **Flow:** `edge-minimal-input-flow.md` — Extremely minimal user input ("make me a button")
- **Output:** `edge-minimal-input.html` — Full button component library (3 emphasis × 3 sizes × all states)
- **Tests:** LLM handling of vague input, clarification questions, scope expansion

### Markdown README → Landing Page
- **Flow:** `edge-markdown-input-flow.md` — User pastes project README markdown
- **Output:** `edge-markdown-input.html` — OSS landing page with dark hero, feature grid, benchmarks table
- **Tests:** Step 1D with markdown input, content preservation, developer tool aesthetic

### Email Template (Non-Web)
- **Flow:** `edge-email-template-flow.md` — User needs welcome email (NOT a web page)
- **Output:** `edge-email-template.html` — Table-based email with inline styles, MSO conditionals
- **Tests:** Non-web output, email-specific constraints (no CSS Grid, no Flexbox, inline styles, 600px max)

## Rules Analysis

See `ANALYSIS.md` for systematic compliance checking of all outputs against knowledge base rules (contrast ratios, touch targets, spacing scale, heading hierarchy, etc.).

**Result: All 12 test cases pass all applicable rules. 0 failures.**

## Preview Tool Integration

All HTML outputs are loadable as presets in the [preview tool](../docs/index.html):
- Templates dropdown → Full Pages → Pricing, Portfolio, Restaurant, Status Page
- Templates dropdown → Edge Cases → Deploy, Buttons, OSS Landing

## Automated Analyzer Tests

Beyond the consultation-flow cases above, `tests/` contains the automated spec files that guard the analyzer engine (Playwright + Node):

```bash
node server.js &   # local server on 8384 (the specs expect it)
npx playwright test
node tests/contrast-and-palette.test.mjs   # WCAG math + preset palette rules
```

Key suites: `html-analysis.spec.js` (core extraction/scoring), `verify-spa-followups.spec.js` (SPA scroll-section capture + budgets), `verify-spa-grid-samples.spec.js` (pixel-verify grid sampler), `spa-snippet.spec.js` (console-snippet SPA + settings parity), `analyzer-a11y.spec.js`, `motion-scoring.spec.js`, plus crawl-flow, export-roundtrip, region-debug, viewer-overlay-alignment, and right-click-live coverage. The self-analysis gate (`node scripts/test-self-analysis.mjs`) scores the analyzer's own pages against a committed baseline.

## What These Validate

- Step 0 (Input Classification) correctly identifies React, HTML, and Vue
- Step 1A (Code Audit) catches real design issues with specific fixes
- Step 2 (Knowledge File Selection) picks the right files for each scenario
- Step 3 (Generate Output) produces code in the user's original framework
- Step 4 (Design Review Notes) generates actionable, prioritized markdown
- The review notes reference knowledge files that actually have content
