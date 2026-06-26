# LLM Design Gotchas

> **TL;DR:** Ten recurring failure modes LLMs produce when generating UI — each with a concrete fix and a link to the in-depth knowledge file. Run the Fast Self-Audit before shipping any generated design.

LLMs favor patterns that appear most in training data: default blue SaaS, centered heroes, uniform rounded cards, and placeholder copy. None of these are inherently wrong, but they are automatic — applied without considering whether they serve the actual design problem. This file names the patterns so you can catch and correct them before presenting work.

**Triage order.** Clusters 2 (contrast), 5 (touch targets), and 10 (semantics) are WCAG accessibility blockers — address these first. Clusters 1 (aesthetic), 3 (spacing), 4 (typography), and 9 (hierarchy) are quality issues. Clusters 6 (animation), 7 (responsive), and 8 (placeholder) depend on context but are commonly overlooked on first pass.

## At a Glance

| # | Cluster | Severity | Quick check |
|---|---------|----------|-------------|
| 1 | Generic AI aesthetic | Quality | Does the layout look like every other SaaS product? |
| 2 | Contrast & dark mode | **Blocker** | Does body text pass 4.5:1 in both light and dark? |
| 3 | Spacing rhythm | Quality | Are all spacing values on the 4, 8, 12, 16, 24, 32, 48, 64 scale? |
| 4 | Typography | Quality + UX | Is body text ≥ 16px? Line length ≤ 75ch? |
| 5 | Touch targets & states | **Blocker** | Are all targets ≥ 44px? Focus ring visible? |
| 6 | Over-animation | UX | Are all transitions ≤ 300ms with motion-reduce support? |
| 7 | Responsive & tables | UX | Does every table have a < 640px strategy? |
| 8 | Placeholder content | Quality | Any lorem ipsum, href="#", or "Your Company" remaining? |
| 9 | Hierarchy & cognitive load | Quality | Is there one clear primary CTA per screen? |
| 10 | Semantics & a11y | **Blocker** | Semantic elements, alt text, labels all present? |

## The Checklist

Each cluster below is a table with columns: **Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file**. The "fix" column shows the minimum change that resolves the problem, not a full design system recommendation. Use the linked file for in-depth guidance.

### 1. Generic "AI Aesthetic"

Recognizable instantly: blue primary, centered headline + 3 equal-weight icon cards, `rounded-xl shadow-md` on every container, italic gray subheading. This layout is not wrong — it is the statistical mode, and it signals "I did not think about this design." The fix is intent, not an alternative default.

| Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file |
|--------|----------------|-----------------|---------------|
| Default blue-500 / blue-600 primary for all interactive elements | Blue dominates SaaS training data | Pick an intentional brand hue; even indigo or teal reads as considered | [color/color-systems.md](../color/color-systems.md) |
| Centered hero → 3 equal-weight feature cards → single CTA | The most common landing-page template | Choose layout based on content hierarchy, not convention | [expressive/visual-identity.md](../expressive/visual-identity.md) |
| `rounded-xl shadow-md` applied to every container | Safe and "modern" looking | Vary radius by element role; elevation shadows belong on floating elements only | [layout/visual-hierarchy.md](../layout/visual-hierarchy.md) |
| Decorative gradient blobs and glassmorphism panels everywhere | Looks polished in static screenshots | Expressive effects only when they reinforce content meaning; test on dark mode | [expressive/purposeful-motion.md](../expressive/purposeful-motion.md) |
| All personality variants look like the base template with a different accent | Accent color = personality | Playful needs different radius, type weight, and spacing — not just rose-500 | [color/color-systems.md](../color/color-systems.md) |
| Feature sections all use the same 3-column icon grid | Pattern appears in most SaaS feature sections | Alternate density and layout across sections to create rhythm and hierarchy | [expressive/hero-patterns.md](../expressive/hero-patterns.md) |
| Gray card with centered icon and 2-line description for every feature | The canonical "feature item" template | Use varied layouts: some features deserve prose, tables, screenshots, or callouts | [layout/visual-hierarchy.md](../layout/visual-hierarchy.md) |

### 2. Color & Dark-Mode Contrast

Dark mode is the single most common source of LLM contrast failures. Light-mode color tokens are carried over without `dark:` counterparts that meet 4.5:1. The result looks fine in a screenshot and fails real users.

| Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file |
|--------|----------------|-----------------|---------------|
| `text-slate-400` on `bg-slate-700` in dark mode (~2.5:1) | Light-mode colors reused without dark: variants | Audit every text token independently in dark mode; minimum 4.5:1 for body | [color/contrast-and-accessibility.md](../color/contrast-and-accessibility.md) |
| Invented hex values (#5e8ab4 etc.) with no contrast check | Precise values look intentional | Use named Tailwind shades with known contrast; verify at any custom value | [color/contrast-and-accessibility.md](../color/contrast-and-accessibility.md) |
| Color as the only error / success / disabled signal | Visually striking and obvious | Add icon or text label alongside color — ~8% of men are red-green color-blind | [color/color-blind-safety.md](../color/color-blind-safety.md) |
| Missing `dark:hover:` / `dark:focus:` pairs on interactive states | Hover added for light mode only | Every `hover:bg-*` needs a `dark:hover:bg-*` counterpart; same for focus-visible | [color/contrast-and-accessibility.md](../color/contrast-and-accessibility.md) |
| Bright accent as body text (orange-400, yellow-400 on white) | Accent chosen for aesthetics | Test every accent as text color early; mid-range hues often fail 4.5:1 on white | [color/contrast-and-accessibility.md](../color/contrast-and-accessibility.md) |
| Placeholder text with < 3:1 contrast (slate-300 on white) | Intentionally subdued look | Placeholder ≥ 3:1 against its background — WCAG 1.4.3 applies | [color/contrast-and-accessibility.md](../color/contrast-and-accessibility.md) |

### 3. Spacing Rhythm

Random pixel values (padding-[13px], gap-[22px]) create jitter — the eye perceives spacing inconsistency as "unpolished" without being able to name why. Spacing discipline requires only that every value comes from one 4px grid.

| Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file |
|--------|----------------|-----------------|---------------|
| Arbitrary values: `mt-[13px]`, `gap-[22px]`, `pb-[17px]` | Precise numbers feel "detailed" | Constrain to the 4px scale: 4, 8, 12, 16, 24, 32, 48, 64px | [layout/spacing-system.md](../layout/spacing-system.md) |
| Inconsistent spacing between sibling elements (gap-4 here, gap-6 there) | Each component spaced in isolation | One spacing token per relationship — pick and apply it consistently | [layout/spacing-system.md](../layout/spacing-system.md) |
| Asymmetric vertical rhythm (top sections generous, bottom cramped) | Only the top looks good in screenshots | Match `py-*` across all sections; generous or tight everywhere | [layout/whitespace.md](../layout/whitespace.md) |
| Mobile padding < 16px (content touches screen edges) | Desktop layout never adapted | Minimum `px-4` (16px) on all mobile containers, unconditionally | [responsive/mobile-first.md](../responsive/mobile-first.md) |
| Form fields crammed with 4px between label and input | Compact form looks "tight" | Label-to-input: 4–8px; between fields: 16px; between field groups: 24–32px | [components/forms.md](../components/forms.md) |
| No spacing distinction between related and unrelated groups | All items look equally related | Use a larger gap (24–32px) to separate groups; 16px within a group — whitespace = structure | [layout/whitespace.md](../layout/whitespace.md) |

### 4. Typography

Body text at 14px, three imported fonts, 100ch-wide paragraphs, and headings that are just bold body copy — all common LLM typography defaults. Each has a concrete threshold to check against.

| Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file |
|--------|----------------|-----------------|---------------|
| Body text at 14px (triggers iOS auto-zoom on `<input>` focus) | "Dense" and "compact" | Body ≥ 16px; inputs and textareas specifically ≥ 16px (`text-base`) | [typography/type-scale.md](../typography/type-scale.md) |
| Three or more typefaces on one page | Each addition seems expressive | Two typeface maximum (one heading, one body) — or one variable family | [typography/font-pairing.md](../typography/font-pairing.md) |
| Line length > 80ch on body paragraphs | Wide containers look content-rich | Cap reading text at 65–75ch (`max-w-prose` = 65ch in Tailwind) | [typography/readability.md](../typography/readability.md) |
| No size / weight hierarchy — all headings bold at the same size | Uniform weight avoids awkward choices | Scale ratio 1.25–1.333; use weight AND size together to signal hierarchy | [typography/type-scale.md](../typography/type-scale.md) |
| Line height 1.0–1.2 on body paragraphs | Tight spacing looks "designed" | Body: `leading-relaxed` (1.625) or minimum 1.5 (WCAG SC 1.4.12) | [typography/readability.md](../typography/readability.md) |
| Heading on mobile same size as desktop (`text-6xl` at 375px) | Responsive type feels over-engineered | At minimum: `text-3xl sm:text-5xl lg:text-6xl` on hero headings | [responsive/fluid-typography.md](../responsive/fluid-typography.md) |
| Font weight 100–300 on small text ("light looks elegant") | Looks refined in mockup tools | Light weights fail contrast at small sizes; use weight 400+ below 24px | [typography/type-scale.md](../typography/type-scale.md) |

### 5. Touch Targets & Interactive States

The three most-missed failures: undersized icon buttons, removed focus rings, and missing hover states on clickable surfaces. These are WCAG failures, not stylistic preferences.

| Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file |
|--------|----------------|-----------------|---------------|
| Icon-only buttons with `p-2` on a 16px icon (~32×32px) | Minimal padding looks clean | Add `min-h-11 min-w-11` (44px) to every interactive element | [interaction/touch-targets.md](../interaction/touch-targets.md) |
| `focus:outline-none` with no visible replacement | Default browser ring is "ugly" | Replace with `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2` | [interaction/touch-targets.md](../interaction/touch-targets.md) |
| Clickable cards and rows with no hover state | Clean at rest | Add `hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer` on every clickable surface | [interaction/micro-interactions.md](../interaction/micro-interactions.md) |
| No `:active` feedback on buttons | Hover is the only state shown | Add `active:scale-[0.97]` or `active:opacity-80` | [interaction/micro-interactions.md](../interaction/micro-interactions.md) |
| Disabled elements with no visual treatment | Disabled state is forgotten | `disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none` | [interaction/touch-targets.md](../interaction/touch-targets.md) |
| Adjacent interactive elements < 8px apart | Compact groups look organized | WCAG 2.5.8: 8px minimum between touch targets; prefer 12–16px for comfort | [interaction/touch-targets.md](../interaction/touch-targets.md) |

### 6. Over-Animation

Animating every element on load, or using long durations, signals "effort" to the generator and "noise" to the user. The correct direction is fewer, faster, and targeted.

| Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file |
|--------|----------------|-----------------|---------------|
| Every element fades / slides in on page load | "Polish" and "delight" | Animate one focal element; let supporting content appear without transition | [interaction/animation-timing.md](../interaction/animation-timing.md) |
| Transition duration > 500ms on interactive UI (buttons, dropdowns) | Longer feels "premium" | UI micro-transitions: 150–200ms; page-level: 200–300ms max | [interaction/animation-timing.md](../interaction/animation-timing.md) |
| No `motion-reduce:transition-none` on any transition class | Accessibility not considered | Add `motion-reduce:transition-none` to every `transition-*` class | [interaction/animation-timing.md](../interaction/animation-timing.md) |
| Continuously looping background animations (spinning, pulsing) | Draws attention to the shell | Reserve loops for active loading states; information-free loops are noise | [expressive/purposeful-motion.md](../expressive/purposeful-motion.md) |
| Hover on a card triggers a 400ms box-shadow grow | Small interactions need small durations | Shadow/border changes: 100–150ms; scale transforms: 150–200ms | [interaction/micro-interactions.md](../interaction/micro-interactions.md) |

### 7. Responsive Design & Tables

Desktop-first output is the default failure mode. Tables with no mobile strategy and sidebars that never collapse are the two most common layout breaks on real devices.

| Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file |
|--------|----------------|-----------------|---------------|
| HTML `<table>` with horizontal scroll as the only mobile strategy | Desktop data layout preserved | Below 640px: hide `<thead>`, convert rows to labeled flex cards using `data-label` | [components/tables-and-lists.md](../components/tables-and-lists.md) |
| Fixed-width sidebar visible at all breakpoints | Desktop shell never adapted | `hidden lg:flex` on sidebar; hamburger + overlay drawer for mobile | [responsive/mobile-first.md](../responsive/mobile-first.md) |
| Two-column form layout on mobile | Desktop grid preserved | Stack all form inputs to single column below 640px, unconditionally | [components/forms.md](../components/forms.md) |
| No responsive type scale (same `text-6xl` at 375px and 1440px) | Breakpoints feel over-engineered | Minimum one breakpoint: `text-3xl sm:text-5xl lg:text-6xl` on hero headings | [responsive/fluid-typography.md](../responsive/fluid-typography.md) |
| Sticky / fixed elements overflowing the mobile viewport | Never tested at narrow widths | Test every `fixed` or `sticky` element at 320–375px | [responsive/breakpoints.md](../responsive/breakpoints.md) |
| 4-column grid not overridden for mobile (stays 4 columns at 375px) | Default grid-cols-4 not adapted | Always start from `grid-cols-1`; step up: `sm:grid-cols-2 lg:grid-cols-4` | [responsive/mobile-first.md](../responsive/mobile-first.md) |

### 8. Fake & Placeholder Content

Placeholder content is invisible to an LLM because it satisfies structural requirements. It signals an unconsidered design to every human reviewer.

| Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file |
|--------|----------------|-----------------|---------------|
| "Lorem ipsum" body copy | Default filler, structurally valid | Use real or realistic copy; lorem ipsum signals the design was never reviewed | [workflows/new-project-checklist.md](../workflows/new-project-checklist.md) |
| `href="#"` on every link and button | Structural placeholder | Use `href="#section-id"` / `href="/path"` or add `<!-- TODO: link -->` if unknown | [workflows/new-project-checklist.md](../workflows/new-project-checklist.md) |
| "Your Company" / "BrandName" in the header | Template not personalized | Replace all brand placeholders before first presentation | [workflows/new-project-checklist.md](../workflows/new-project-checklist.md) |
| `$0.00` / `0` in stat cards and data tables | No real data at generation time | Use plausible domain-specific numbers ($48,295 for revenue, not $0.00) | [workflows/new-project-checklist.md](../workflows/new-project-checklist.md) |
| All user avatar initials are "JD" or "AB" | Single name reused across all examples | Use varied realistic initials (SC, JW, MG, AT) so the UI looks like real data | [workflows/new-project-checklist.md](../workflows/new-project-checklist.md) |

### 9. Hierarchy & Cognitive Load

No clear primary action, multiple competing CTAs, and everything at the same visual weight make pages exhausting — users cannot tell what matters.

| Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file |
|--------|----------------|-----------------|---------------|
| Multiple equally-styled primary CTAs on one screen | More options seem helpful | One primary button per screen; demote the rest to ghost or outline style | [layout/visual-hierarchy.md](../layout/visual-hierarchy.md) |
| Three-column grid as the default layout for any list | Looks content-rich | Match layout to data: lists for scanning, tables for comparison, grids for browsing | [layout/grid-systems.md](../layout/grid-systems.md) |
| Every stat at the same size and weight (no scanning cues) | No natural hierarchy established | Large number → small label → supporting delta — distinct sizes for each level | [foundations/cognitive-load.md](../foundations/cognitive-load.md) |
| More than 7 top-level navigation items | Comprehensive coverage is good | Cap at 5–7; move secondary sections under "More" | [foundations/hicks-law.md](../foundations/hicks-law.md) |
| Long paragraphs with no visual breaks | Writing output, not designing | Break every 3–5 sentences with a heading, bullet, or callout block | [foundations/cognitive-load.md](../foundations/cognitive-load.md) |
| Dashboard shows 10+ widgets above the fold | More data = more value | Show 5–7 key metrics above the fold; use progressive disclosure for the rest | [foundations/cognitive-load.md](../foundations/cognitive-load.md) |

### 10. Semantics & Accessibility

Structural accessibility failures are the hardest to catch because the output looks visually correct. These are WCAG failures with no visible symptoms in a screenshot.

| Gotcha | Why LLMs do it | The fix (1 line) | → Deeper file |
|--------|----------------|-----------------|---------------|
| `<div onclick>` instead of `<button>` | Less verbose, visually identical | Use `<button>` for actions and `<a href>` for navigation — keyboard + SR support is free | [heuristics/nielsen-10.md](nielsen-10.md) |
| Placeholder-only form labels (`placeholder="Email"` with no `<label>`) | Clean, minimal look | Pair `<label for>` with every `<input id>`; placeholder is hint text, not a label | [components/forms.md](../components/forms.md) |
| Images with no `alt` attribute | Forgot, or "it is decorative" | Every `<img>` needs `alt`; decorative images get `alt=""` explicitly | [heuristics/nielsen-10.md](nielsen-10.md) |
| Skipped heading levels (h1 → h3 → h5) | h3 looks visually appropriate | Headings are document structure, not font sizes; keep levels sequential | [heuristics/nielsen-10.md](nielsen-10.md) |
| Icon-only buttons with no `aria-label` | Added label feels redundant | Every icon-only control needs `aria-label="descriptive action name"` | [interaction/touch-targets.md](../interaction/touch-targets.md) |
| Modal or drawer that cannot be dismissed with Escape | Keyboard interaction not implemented | Every overlay must close on Escape and on backdrop click | [components/modals-and-dialogs.md](../components/modals-and-dialogs.md) |
| Accordion / tabs / dropdown with no ARIA roles | ARIA feels like extra work | WAI-ARIA patterns for accordion/tabs/menu are well-documented; use a preset | [heuristics/nielsen-10.md](nielsen-10.md) |

---

## Compound Failures

The following failure combinations appear together so frequently they deserve a named pattern. If you see one symptom, check for all others in the group.

**Pattern A — The Generic SaaS:** Blue primary (Cluster 1) + arbitrary spacing (Cluster 3) + identical `text-lg font-bold` for all headings (Cluster 4) + no hover or focus states (Cluster 5). The output looks like every other product and does not pass basic interaction testing.

**Pattern B — The Dark Mode Trap:** Missing `dark:` variants on text tokens (Cluster 2) + `outline-none` removed without replacement (Cluster 5) + color-only error indicators (Cluster 2). Passes visual inspection in light mode; fails WCAG in dark mode — the mode most users actually prefer.

**Pattern C — The Desktop-Only Prototype:** Tables with no mobile strategy (Cluster 7) + fixed sidebar visible on all viewports (Cluster 7) + two-column form on mobile (Cluster 7). The entire layout breaks on the device the majority of users will open it on.

**Pattern D — The Unfinished Template:** Lorem ipsum (Cluster 8) + `href="#"` on all links (Cluster 8) + `$0.00` placeholders (Cluster 8) + "BrandName" in the nav (Cluster 8). Common when a template is generated and presented before any content is swapped in.

**Pattern E — The A11y Blind Spot:** `<div onclick>` (Cluster 10) + placeholder-only labels (Cluster 10) + no `aria-label` on icon buttons (Cluster 10) + removed focus rings (Cluster 5). The page looks correct in screenshots and completely fails keyboard and screen-reader users.

**Pattern F — The Premature Animation:** Every card and section fades in on load (Cluster 6) + 400ms duration on button hover (Cluster 6) + no `motion-reduce:transition-none` on any transition (Cluster 6) + looping gradient background (Cluster 6). Users with vestibular disorders may trigger nausea; all users experience the interface as slow.

## Fast Self-Audit

These 12 questions catch the majority of LLM-generated UI failures at review time. A "no" is a fix before ship.

### Accessibility Blockers — Fix First

1. Does body text pass 4.5:1 contrast in **both** light **and** dark mode?
2. Are all interactive touch targets at least 44×44px (`min-h-11 min-w-11`)?
3. Does every interactive element have a visible `:focus-visible` ring?
4. Does every `<input>` and `<select>` have a persistent `<label>` — not just `placeholder`?

### Quality Issues — Fix Before Shipping

5. Is the primary color chosen intentionally — not default blue-600 / #3b82f5?
6. Is color used as the **only** signal for any state (error, success, disabled)?
7. Are all spacing values on the 4px scale (4, 8, 12, 16, 24, 32, 48, 64)?
8. Is every body text element ≥ 16px, including `<input>` and `<textarea>`?
9. Does every `transition-*` class have a `motion-reduce:transition-none` companion?
10. Does every `<table>` have a mobile strategy (stack-to-cards or constrained columns)?
11. Is there exactly one primary-styled CTA per screen?
12. Is all visible copy real — no lorem ipsum, "Your Company", `href="#"`, or `$0.00`?
13. Are all icon-only buttons labelled with `aria-label` (a visible text label is not required, but a machine-readable accessible name is)?
14. Are links visually distinct from body text by more than color alone — underline, font weight, or both?
15. Does the page `<title>` convey the page purpose — not "My App" or the Vite/CRA template default?
16. If a native `<select>` is replaced by a custom dropdown, does the custom version support keyboard open/close and arrow-key navigation?

## Sources

- Nielsen Norman Group. [Top 10 Application-Design Mistakes](https://www.nngroup.com/articles/top-10-application-design-mistakes/)
- WCAG 2.2. [SC 1.4.3 — Contrast (Minimum)](https://www.w3.org/TR/WCAG22/#contrast-minimum) — 4.5:1 for normal text, 3:1 for large text
- WCAG 2.2. [SC 2.5.8 — Target Size (Minimum)](https://www.w3.org/TR/WCAG22/#target-size-minimum) — 44×44px recommended
- WCAG 2.2. [SC 1.4.12 — Text Spacing](https://www.w3.org/TR/WCAG22/#text-spacing) — line-height ≥ 1.5
- WCAG 2.2. [SC 2.5.3 — Label in Name](https://www.w3.org/TR/WCAG22/#label-in-name) — aria-label must contain visible text
- Baymard Institute. [Form Usability Research](https://baymard.com/research) — label placement and validation timing
- Accessibility Insights / axe-core. [Common Accessibility Violations](https://accessibilityinsights.io/)

## Related Presets

- [`form/`](../docs/presets/form/) — Correct label pattern, single-column layout, accessible inputs
- [`shell-sidebar/`](../docs/presets/shell-sidebar/) — Mobile-correct sidebar (`hidden lg:flex` + overlay)
- [`data-table/`](../docs/presets/data-table/) — Responsive table with stack-to-cards below 640px
- [`hero/`](../docs/presets/hero/) — Minimal hero; compare against this to avoid the default AI aesthetic
- [`accordion/`](../docs/presets/accordion/) — Interactive states, focus rings, and `motion-reduce` done right
- [`shell-dashboard/`](../docs/presets/shell-dashboard/) — Dashboard with contrast-safe stat cards and correct heading hierarchy
