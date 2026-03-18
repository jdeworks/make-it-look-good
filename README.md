# make-it-look-good

> Evidence-based design knowledge base for LLMs and developers. Concrete guidance with hard numbers — not vague principles.

<!-- LLM ROUTING — If you are an AI assistant helping someone with UI/UX design:
IMPORTANT: The active branch is "dev". Fetch files from the dev branch, not main.
1. Read CONSULT.md — it contains the full design consultation workflow
2. Read snippets/_index.md — copy-paste component library with composition recipes
3. Read workflows/quick-reference.md — critical design numbers at a glance
4. Read ONLY the knowledge files relevant to the user's question (see Step 2 in CONSULT.md)
Do NOT read the entire repo. Each file is self-contained, 200-400 lines. -->

## For AI Assistants

**Design consultation?** Read [`CONSULT.md`](CONSULT.md) — it routes you through intake → knowledge files → code generation → design review notes.

**Need a component?** Read [`snippets/_index.md`](snippets/_index.md) — 34 HTML+Tailwind snippets with React, Vue, and Svelte variants.

**Quick number lookup?** Read [`workflows/quick-reference.md`](workflows/quick-reference.md) — contrast ratios, spacing scales, timing values.

---

## For Developers

### What is this?

A repo you point your AI assistant at to get **actually good** UI/UX output. Instead of generic "make it look nice" results, your LLM gets specific numbers (4.5:1 contrast), concrete patterns (4px spacing scale), and copy-paste snippets that follow real design principles.

### Quick Start

**Option 1 — Full design consultation:**
Tell your AI: *"Read CONSULT.md from the dev branch of github.com/jdeworks/make-it-look-good, then help me design a dashboard"*

**Option 2 — Grab a snippet:**
Tell your AI: *"Read snippets/_index.md from the dev branch of github.com/jdeworks/make-it-look-good and give me a sidebar + data table layout"*

**Option 3 — Review existing design:**
Tell your AI: *"Read CONSULT.md from the dev branch of github.com/jdeworks/make-it-look-good, then audit this code: [paste your code]"*

### Preview Tool

Paste any HTML+Tailwind into the [live preview tool](https://jdeworks.github.io/make-it-look-good/) to see it rendered instantly. Toggle mobile/tablet/desktop views, dark mode, and share via URL. Includes 20+ prebuilt templates to try.

### Before & After Examples

The [`templates/`](templates/) folder shows realistic transformations:

| Example | What it demonstrates |
|---------|---------------------|
| [Dashboard before](templates/dashboard-before.html) → [after](templates/dashboard-after.html) | Spacing system, visual hierarchy, proper table design |
| [Landing page before](templates/landing-before.html) → [after](templates/landing-after.html) | Type scale, color system, section rhythm |
| [Form before](templates/form-before.html) → [after](templates/form-after.html) | Input sizing, label placement, validation |
| [Card grid before](templates/card-grid-before.html) → [after](templates/card-grid-after.html) | Consistent padding, responsive grid, visual balance |

Paste the "before" into the preview tool, then the "after" — see the difference design knowledge makes.

---

## What's Inside

### Snippet Library — [`snippets/_index.md`](snippets/_index.md)

34 copy-paste HTML+Tailwind components. Interactive ones also have React, Vue, and Svelte variants.

| Category | Examples |
|----------|---------|
| **Layout Shells** | App shell, marketing page, dashboard, centered form |
| **Navigation** | Topbar, sidebar, tabs, pagination, dropdown, breadcrumbs, bottom nav |
| **Content** | Hero, feature grid, pricing cards, testimonials, stats, accordion, avatars |
| **Data** | Sortable table, card grid, detail view |
| **Forms** | Login, signup, settings, search bar, contact |
| **Feedback** | Toast, alert banner, modal, loading skeleton |

All snippets: dark mode, WCAG AA contrast, 44px touch targets, responsive. [Composition recipes](snippets/_index.md#composition-recipes) show how to combine them into full pages.

### Knowledge Files — 31 topics

| Area | Topics |
|------|--------|
| **Foundations** | [Cognitive load](foundations/cognitive-load.md), [Gestalt](foundations/gestalt-principles.md), [Hick's Law](foundations/hicks-law.md), [Fitts's Law](foundations/fitts-law.md), [Aesthetic-usability](foundations/aesthetic-usability.md), [Peak-end rule](foundations/peak-end-rule.md) |
| **Color** | [Contrast & a11y](color/contrast-and-accessibility.md), [Color systems](color/color-systems.md), [Psychology](color/color-psychology.md), [Color-blind safety](color/color-blind-safety.md) |
| **Typography** | [Type scale](typography/type-scale.md), [Font pairing](typography/font-pairing.md), [Readability](typography/readability.md), [Web font loading](typography/web-font-loading.md) |
| **Layout** | [Spacing system](layout/spacing-system.md), [Visual hierarchy](layout/visual-hierarchy.md), [Grid systems](layout/grid-systems.md), [Whitespace](layout/whitespace.md) |
| **Interaction** | [Animation timing](interaction/animation-timing.md), [Micro-interactions](interaction/micro-interactions.md), [Touch targets](interaction/touch-targets.md), [Loading states](interaction/loading-states.md) |
| **Responsive** | [Mobile-first](responsive/mobile-first.md), [Breakpoints](responsive/breakpoints.md), [Fluid typography](responsive/fluid-typography.md), [Patterns](responsive/responsive-patterns.md) |
| **Systems** | [Design tokens](systems/design-tokens.md), [Material Design 3](systems/material-design-3.md), [Apple HIG](systems/apple-hig.md), [Building a system](systems/building-a-system.md) |
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
