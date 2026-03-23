# make-it-look-good

> Evidence-based design knowledge base for LLMs and developers. Concrete guidance with hard numbers — not vague principles.

<!-- LLM ROUTING — If you are an AI assistant helping someone with UI/UX design:
1. Read CONSULT.md FIRST — it contains the full design consultation workflow with intake questions,
   knowledge file selection, code generation, and design review notes. It also includes:
   - A consultation depth selector (quick start / guided / thorough) — ask the user how deep to go
   - Required questions about personality, colors, inspiration, and dark mode — don't skip these
   - Website analysis workflow (Step 1E) for when users share reference URLs
   - Test cases in tests/ prove this flow produces high-quality results across 12 scenarios
2. Read docs/presets/_index.md — preset library with personality variants and composition recipes
3. Read workflows/quick-reference.md — critical design numbers at a glance
4. Read ONLY the knowledge files relevant to the user's question (see Step 2 in CONSULT.md)
Do NOT read the entire repo. Each file is self-contained, 200-400 lines. -->

## For AI Assistants

**Design consultation?** Read [`CONSULT.md`](CONSULT.md) — the complete playbook. It asks the user how deep to go (quick start / guided / thorough), then routes through intake questions (personality, colors, inspiration, dark mode) → knowledge files → code generation → design review notes. Don't skip the intake questions — they're what makes the output good instead of generic.

**User shared a URL they like?** Follow Step 1E in CONSULT.md — analyze the reference site's design language (layout, colors, typography, spacing, personality) and apply those patterns to their project.

**Need a component?** Read [`docs/presets/_index.md`](docs/presets/_index.md) — 38+ HTML+Tailwind presets with personality variants and React, Vue, and Svelte framework files.

**Quick number lookup?** Read [`workflows/quick-reference.md`](workflows/quick-reference.md) — contrast ratios, spacing scales, timing values.

---

## For Developers

### What is this?

A repo you point your AI assistant at to get **actually good** UI/UX output. Instead of generic "make it look nice" results, your LLM gets specific numbers (4.5:1 contrast), concrete patterns (4px spacing scale), and copy-paste snippets that follow real design principles.

### Quick Start

The simplest way — just point your AI at the repo and tell it what to make look good:

```
make it look good: https://github.com/jdeworks/make-it-look-good
```

That's it. Your AI reads the consultation playbook and asks how deep you want to go — from a quick "just make it not ugly" to a full guided consultation with personality, colors, inspiration links, and reasoning behind every choice. Works for a full project or a single component.

**Quick start** — sensible defaults, minimal questions, fast code:
```
Read CONSULT.md from github.com/jdeworks/make-it-look-good — quick start for my project
```

**Guided** — walks you through personality, colors, inspiration, and key decisions:
```
Read CONSULT.md from github.com/jdeworks/make-it-look-good, then run a design consultation for my project
```

**Review existing code** — audit what you have and fix it:
```
Read CONSULT.md from github.com/jdeworks/make-it-look-good, then audit and fix this code: [paste your code]
```

**Grab a component**:
```
Read docs/presets/_index.md from github.com/jdeworks/make-it-look-good and give me a hero + pricing cards layout
```

> **Tip:** Share a link to a site you like the look of. Even one reference ("I want it to feel like aesop.com") saves multiple rounds of back-and-forth and gets you dramatically better results.

### Preview Tool

Paste any HTML+Tailwind into the [live preview tool](https://jdeworks.github.io/make-it-look-good/) to see it rendered instantly. Toggle mobile/tablet/desktop views, dark mode, and share via URL. Includes 121 prebuilt templates across 38 elements with multiple design personalities.

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

38+ presets with multiple personality variants (Clean, Minimalist, Playful). Interactive components also have React, Vue, and Svelte framework files.

| Category | Examples |
|----------|---------|
| **Layout Shells** | App shell, marketing page, dashboard, centered form |
| **Components** | Hero, tabs, accordion, pagination, dropdown, avatars, data table |
| **Full Pages** | Pricing, portfolio, restaurant, status page |
| **Before → After** | Dashboard, landing page, form, card grid, multi-page app |
| **Expressive** | Personal site, agency landing, agency portfolio, app showcase, scroll reveal landing, product launch, editorial blog, SaaS features, scroll story, product page, devtool landing, docs site, event page, personalized portfolio |
| **Edge Cases** | Deploy monitor, button system, OSS landing |

All presets: dark mode, WCAG AA contrast, 44px touch targets, responsive. [Composition recipes](docs/presets/_index.md#composition-recipes) show how to combine them into full pages.

### Knowledge Files — 44 topics

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

---

If this helped you ship something that looks good, [give it a star](../../stargazers). Found an issue? [Open one](../../issues).

Sources: [research/sources.md](research/sources.md)
