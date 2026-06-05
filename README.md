# make-it-look-good

> **Make your website, app, or UI actually look good.** Give your AI assistant this repo and it will help you design, redesign, or fix the visual design of any web project — with real design principles, not guesswork.

Your AI asks what you're building, what personality you want (clean, minimalist, playful, editorial), your colors, and your audience — then produces production-ready HTML/CSS with proper spacing, contrast, typography, and responsive behavior. It works on landing pages, dashboards, forms, portfolios, e-commerce, or any UI.

**This is not a library you install.** It's a design knowledge base (45 topics on color, typography, spacing, layout, interaction, accessibility) plus a consultation playbook that guides your AI through the right questions and decisions.

---

## If you are an AI assistant reading this

The user wants you to **help them make their website or UI look good**. This repo is a design toolkit — use it to guide the user through a design consultation for *their* project.

**Start here:**
1. Read [`CONSULT.md`](CONSULT.md) — the full design consultation playbook. Follow it step by step.
2. Read [`docs/presets/_index.md`](docs/presets/_index.md) — template catalog with preview links.
3. Read [`workflows/quick-reference.md`](workflows/quick-reference.md) — critical design numbers.
4. Read ONLY the knowledge files relevant to the user's question (see Step 2 in CONSULT.md).

**Your job:** Ask the user what they're building (or what they want to improve), walk them through personality/colors/audience questions, then generate or fix their UI code using the design principles in this repo. Do NOT improve this repo itself — focus on the user's project.

CONSULT.md includes:
- A consultation depth selector (quick start / guided / thorough) — ask the user how deep to go
- Required intake questions about personality, colors, inspiration, and dark mode — don't skip these
- Website analysis workflow (Step 1E) for when users share reference URLs
- Template catalog with preview links at `https://jdeworks.github.io/make-it-look-good/#preset:{element}/{personality}`

---

## For Developers

### What is this?

You have a website or UI that needs to look better. Give this repo to your AI assistant and it becomes a **design consultant** — asking the right questions, applying real design principles, and producing code that actually looks professional. Not generic blue SaaS. Your brand, your personality, your colors.

### How to use it

**Option A — Online chat** (Claude.ai, ChatGPT, Gemini, Perplexity, etc.)

Copy-paste this entire block as your first message:

```
Fetch this file — it's a design toolkit that will help me make my website look good:
https://raw.githubusercontent.com/jdeworks/make-it-look-good/dev/bundle.xml

Read the CONSULT.md inside it and follow the consultation playbook step by step.
You are a design consultant — help me design or improve MY website/UI, not this
repo. Start by asking what I'm building and how detailed I want the consultation
(quick start / guided / thorough).
```

The bundle (~164k tokens) includes the full consultation playbook, all 45 knowledge files, and the template catalog (`docs/presets/index.json`). To keep it pasteable it does **not** embed the template HTML — fetch a specific preset on demand from `https://raw.githubusercontent.com/jdeworks/make-it-look-good/dev/docs/presets/<element>/<variant>.html` (variants per `index.json`), or browse them in the [live preview tool](https://jdeworks.github.io/make-it-look-good/) and tell your AI which ones you like.

**Option B — Local AI agent** (Claude Code, Cursor, Windsurf, Codex, etc.)

Clone and point your agent at the folder:
```bash
git clone -b dev https://github.com/jdeworks/make-it-look-good.git
```

Then tell your agent:
```
Read CONSULT.md from the make-it-look-good folder. It's a design consultation
playbook — use it to help me make my website/UI look good. Follow the steps
and start by asking what I'm building.
```

A local agent gets the full file structure including all 125 template HTML files. This is the recommended approach for hands-on design work.

**Option C — Quick prompts** (if your AI already has the repo loaded)

Guided consultation (asks about personality, colors, audience):
```
Follow the CONSULT.md playbook to run a design consultation for my project.
```

Audit existing code:
```
Follow CONSULT.md Step 1A to audit this code, then generate design review notes: [paste your code]
```

Grab a component:
```
Look at docs/presets/_index.md and give me a hero + pricing cards layout.
```

> **Tip:** Share a link to a site you like the look of. Even one reference ("I want it to feel like aesop.com") dramatically improves results.

---

### Preview Tool

Paste any HTML+Tailwind into the [live preview tool](https://jdeworks.github.io/make-it-look-good/) to see it rendered instantly. Toggle mobile/tablet/desktop views, dark mode, and share via URL. Includes 125 prebuilt template files across 41 elements with multiple design personalities.

### Design Analyzer

Score any website against evidence-based design rules with the [Design Analyzer](https://jdeworks.github.io/make-it-look-good/analyzer.html). **~60 checks across 14 scoring modules** — no AI, just math against WCAG 2.2, Material Design, NNGroup research, and typography best practices. Every finding links to its source.

Three ways to analyze:

| Method | Best for | How |
|--------|----------|-----|
| **Enter URL** | Phone, quick checks | Paste a URL — fetched via CORS proxy, scored automatically |
| **Console Snippet** | Most accurate, localhost, behind login | Copy snippet → run in DevTools console → paste JSON |
| **Paste HTML** | Static mockups | Paste HTML source, rendered in iframe |

Scoring modules: Color & Contrast (WCAG + APCA), Typography, Spacing & Layout, Touch & Interaction, Accessibility, Responsive Design, Visual Consistency, Cognitive Load, Layout Quality, Performance, Readability, Motion & Animation, Visual Balance.

Features: 8 audience profiles (General, WCAG AAA, Elderly, Low Vision, Motor Impairment, Color Blind, Children, Cognitive), page context detection, gradient/background-image/CSS-filter contrast resolution, decorative element filtering, context-aware touch targets (nav/footer/inline exemptions per WCAG 2.5.8), CVD palette simulation (Machado et al. 2009), post-analysis exclusion suggestions, extraction caching, dark mode report, viewport size selection, deep scan (multi-viewport + dark mode), page screenshots, analysis history, N/A category detection, progress bar, JSON export/import, markdown/PDF export. Self-hostable CORS proxy (Cloudflare Worker, free tier 100K req/day) — see [`proxy/README.md`](proxy/README.md).

Validated against 125 preset templates via headless browser testing (Puppeteer) — average score 88, min 69, max 100, with a 7-point gap between "before" (81 avg) and "clean" (88 avg) variants.

### Run the analyzer locally / offline

The analyzer normally runs on GitHub Pages, but you can run it locally — which also lets you analyze a page served on **localhost** (the hosted version's CORS proxy refuses localhost/private IPs).

Requirements: Node 18+. No `npm install` needed — the server uses only Node built-ins.

```bash
node server.js
# then open http://localhost:8765/analyzer.html
```

- Enter any `http://localhost:<port>/...` page as the URL target — the local server proxies the fetch, which the hosted version cannot do for localhost.
- Flags: `--port <n>` (default 8765), `--host <addr>` (default 127.0.0.1; use 0.0.0.0 only on a trusted network — the proxy is intentionally unrestricted).

#### Fully offline

Vendor the CDN assets once (while you still have internet), then run with `--offline`:

```bash
node scripts/setup-offline.mjs   # downloads Tailwind, modern-screenshot, jszip, fonts, and Monaco into docs/vendor/
node server.js --offline
```

Offline mode keeps everything working — screenshots, pixel-contrast, the .zip LLM-pack export, Tailwind rendering, and the Monaco editor in the Live Preview — with no network calls. Vendored files live in `docs/vendor/` (gitignored); the GitHub Pages deployment is unaffected and keeps loading them from their CDNs.

### Before & After Examples

Each "before" shows a typical MVP. Each "after" is a structurally different redesign — not just CSS tweaks but genuinely different layouts. Multiple personalities (Clean, Minimalist, Playful, Editorial) show how the same content can look completely different.

| Example | Personalities | Try it |
|---------|--------------|--------|
| Dashboard | Clean, Minimalist, Playful | [Before](https://jdeworks.github.io/make-it-look-good/#preset:dashboard/before) → [After](https://jdeworks.github.io/make-it-look-good/#preset:dashboard/clean) |
| Landing Page | Clean, Minimalist, Playful, Editorial | [Before](https://jdeworks.github.io/make-it-look-good/#preset:landing/before) → [After](https://jdeworks.github.io/make-it-look-good/#preset:landing/clean) |
| Form | Clean, Minimalist, Playful, Editorial | [Before](https://jdeworks.github.io/make-it-look-good/#preset:form/before) → [After](https://jdeworks.github.io/make-it-look-good/#preset:form/clean) |
| Card Grid | Clean, Minimalist, Playful | [Before](https://jdeworks.github.io/make-it-look-good/#preset:cards/before) → [After](https://jdeworks.github.io/make-it-look-good/#preset:cards/clean) |
| Multi-Page App | Clean, Minimalist, Playful | [Before](https://jdeworks.github.io/make-it-look-good/#preset:project/before) → [After](https://jdeworks.github.io/make-it-look-good/#preset:project/clean) |

Click any "After" link — personality buttons appear in the preview header to switch between variants. Color swatches let you recolor with any Tailwind palette. Effect buttons apply CSS overlays (Hushed, Bouncy, Frosted, Serif).

### Example: Guided Consultation Flow

Here's what a real consultation looks like when an LLM follows the playbook. The user says *"I need a website for my cafe. Something warm and inviting."*

**1. The AI classifies the input** → vague idea, no code → guided intake

**2. Intake questions asked:**
- What are you building? → Landing page / content site, single-page with sections
- Who uses it? → General public, 65-75% mobile traffic
- Personality? → Playful & friendly, "specialty coffee shop" feel
- Tech stack? → Plain HTML + Tailwind CDN
- Colors? → Warm amber `#f59e0b`, rich brown `#78350f`
- Inspiration? → "Your favorite neighborhood spot, not corporate chain"
- Dark mode? → No

**3. The AI reads knowledge files** → `layout/visual-hierarchy.md`, `typography/type-scale.md`, `color/color-psychology.md`, `interaction/touch-targets.md`, `responsive/mobile-first.md`

**4. Design decisions (with reasoning):**
- Playfair Display headings + Inter body → artisanal yet readable
- Amber-900 on amber-50 at 7.2:1 contrast → AAA pass
- White text on amber buttons fails WCAG → switched to amber-900 text
- `rounded-2xl` cards + pill-shaped CTAs → warmth, not corporate
- 48px touch targets everywhere → mobile-heavy audience
- Section order: Hero → Menu → About → Hours → Footer → inverted pyramid

**5. Output:** A single self-contained HTML file that renders on 375px–1440px+, passes WCAG AA on all text, with warm amber palette and serif/sans font pairing.

The full flow with all design decisions is in [`tests/e2e-restaurant-flow.md`](tests/e2e-restaurant-flow.md). The output is in [`tests/e2e-restaurant.html`](tests/e2e-restaurant.html).

### Validated Test Cases

The consultation flow is tested across 12 real-world scenarios — all pass all applicable design rules (contrast, touch targets, spacing, hierarchy). See [`tests/`](tests/) for the full set.

| Scenario | Input | What It Proves |
|----------|-------|----------------|
| React settings page | JSX + inline styles | Outputs in user's framework, no forced Tailwind migration |
| Barebones HTML | Hackathon-quality landing page | Full redesign with Tailwind CDN |
| Vue dashboard | Vue 3 SFC + scoped CSS | Preserves Vue SFC structure |
| Restaurant landing | "warm and inviting cafe" | Guided intake → personality-driven output |
| Developer portfolio | "dark mode, emerald accent" | Dark mode design with monospace accents |
| SaaS pricing | Brand colors provided | Brand color application, clean personality |
| Status page | JSON API data pasted | Raw data → structured UI (Step 1D) |
| CLI output | Terminal table pasted | Non-standard input → dark technical dashboard |
| Email template | "welcome email" | Non-web output with email-specific constraints |

---

## What's Inside

### Preset Library — [`docs/presets/_index.md`](docs/presets/_index.md)

41 preset elements (125 variant HTML files across 6 categories) with multiple personality variants. Every element has a `clean` variant; most also have `minimalist` and `playful`, and a few add `before` or `editorial`. See [`docs/presets/index.json`](docs/presets/index.json) for the authoritative per-element list. Interactive components also have React, Vue, and Svelte framework files.

| Category | Examples |
|----------|---------|
| **Layout Shells** | App shell, marketing page, dashboard, centered form |
| **Components** | Hero, tabs, accordion, pagination, dropdown, avatars, data table |
| **Full Pages** | Pricing, portfolio, restaurant, status page |
| **Before → After** | Dashboard, landing page, form, card grid, multi-page app |
| **Expressive** | Personal site, agency landing, agency portfolio, app showcase, scroll reveal landing, product launch, editorial blog, SaaS features, scroll story, product page, devtool landing, docs site, event page, personalized portfolio |
| **Edge Cases** | Deploy monitor, button system, OSS landing |

All presets: dark mode, WCAG AA contrast, 44px touch targets, responsive. [Composition recipes](docs/presets/_index.md#composition-recipes) show how to combine them into full pages.

### Knowledge Files — 45 topics

| Area | Topics |
|------|--------|
| **Foundations** | [Cognitive load](foundations/cognitive-load.md), [Gestalt](foundations/gestalt-principles.md), [Hick's Law](foundations/hicks-law.md), [Fitts's Law](foundations/fitts-law.md), [Aesthetic-usability](foundations/aesthetic-usability.md), [Peak-end rule](foundations/peak-end-rule.md) |
| **Color** | [Contrast & a11y](color/contrast-and-accessibility.md), [Color systems](color/color-systems.md), [Psychology](color/color-psychology.md), [Color-blind safety](color/color-blind-safety.md) |
| **Typography** | [Type scale](typography/type-scale.md), [Font pairing](typography/font-pairing.md), [Readability](typography/readability.md), [Web font loading](typography/web-font-loading.md) |
| **Layout** | [Spacing system](layout/spacing-system.md), [Visual hierarchy](layout/visual-hierarchy.md), [Grid systems](layout/grid-systems.md), [Whitespace](layout/whitespace.md) |
| **Interaction** | [Animation timing](interaction/animation-timing.md), [Micro-interactions](interaction/micro-interactions.md), [Touch targets](interaction/touch-targets.md), [Loading states](interaction/loading-states.md) |
| **Responsive** | [Mobile-first](responsive/mobile-first.md), [Breakpoints](responsive/breakpoints.md), [Fluid typography](responsive/fluid-typography.md), [Patterns](responsive/responsive-patterns.md) |
| **Systems** | [Design tokens](systems/design-tokens.md), [Material Design 3](systems/material-design-3.md), [Apple HIG](systems/apple-hig.md), [Building a system](systems/building-a-system.md) |
| **Expressive** | [Visual identity](expressive/visual-identity.md), [Hero patterns](expressive/hero-patterns.md), [Scroll storytelling](expressive/scroll-storytelling.md), [Purposeful motion](expressive/purposeful-motion.md), [Scroll effect patterns](expressive/scroll-effect-patterns.md), [Curated examples](expressive/curated-examples.md) |
| **Heuristics** | [Nielsen's 10](heuristics/nielsen-10.md), [UX frameworks](heuristics/ux-frameworks.md) |
| **Components** | [Buttons](components/buttons.md), [Forms](components/forms.md), [Cards](components/cards.md), [Navigation](components/navigation.md), [Modals](components/modals-and-dialogs.md), [Tables](components/tables-and-lists.md), [Feedback](components/feedback.md) |

Each file: 200–400 lines, concrete rules with numbers, CSS/Tailwind patterns, decision trees, sources.

### Workflows

| Workflow | Use when |
|----------|----------|
| [Quick Reference](workflows/quick-reference.md) | Need a number fast (contrast ratio, spacing value, timing) |
| [New Project Checklist](workflows/new-project-checklist.md) | Starting from scratch |
| [Design Review Checklist](workflows/design-review-checklist.md) | Auditing an existing design |

### Critical Numbers

| What | Value |
|------|-------|
| Text contrast (AA) | 4.5:1 |
| Large text contrast (AA) | 3:1 |
| Body font size | ≥16px |
| Line height | 1.4–1.6 |
| Line length | 45–75 characters |
| Touch target | ≥44×44px |
| Base spacing unit | 4px or 8px |
| Nav items | 5–7 max |
| Enter animation | 200–300ms |
| Exit animation | 150–200ms |

## Third-party libraries

The Design Analyzer (`docs/`) loads a few libraries from public CDNs at runtime; none are vendored into this repository. Credit and licenses:

| Library | Used for | License |
|---------|----------|---------|
| [JSZip](https://github.com/Stuk/jszip) | Building the "LLM pack (.zip)" export in the browser | Dual [MIT or GPLv3](https://github.com/Stuk/jszip/blob/main/LICENSE.markdown); used here under **MIT**. © Stuart Knightley & JSZip contributors |
| [Tailwind CSS (Play CDN)](https://tailwindcss.com) | Styling generated previews / fragment analysis | [MIT](https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE) |
| [modern-screenshot](https://github.com/qq15725/modern-screenshot) | Full-page / region screenshot capture | [MIT](https://github.com/qq15725/modern-screenshot/blob/main/LICENSE) |

Each generated LLM pack also ships a `THIRD_PARTY.md` repeating the JSZip attribution.

---

If this helped you ship something that looks good, [give it a star](../../stargazers). Found an issue? [Open one](../../issues).

Sources: [research/sources.md](research/sources.md)
