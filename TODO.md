# Preset Audit TODO

> Generated: 2026-03-18 | Files audited: 88 | Base commit: 168e718

## Summary
- 49 files pass all checks (or are `before` files exempt from quality standards)
- 39 files have issues
- 9 critical issues (accessibility/broken)
- 18 important issues (responsive/dark mode gaps)
- 22 minor issues (missing aria, semantic HTML, etc.)

Note: The 5 `before` files (cards/before, dashboard/before, form/before, landing/before, project/before) are intentionally bad examples and are excluded from issue counts.

---

## Critical Issues

### [accordion/clean.html] Unescaped `</script>` tag
- [ ] Line 197: `</script>` should be `<\/script>` — will break when loaded as innerHTML in the preview tool

### [dropdown/clean.html] Unescaped `</script>` tag
- [ ] Line 100: `</script>` should be `<\/script>` — will break when loaded as innerHTML in the preview tool

### [tabs/clean.html] Unescaped `</script>` tag
- [ ] Line 87: `</script>` should be `<\/script>` — will break when loaded as innerHTML in the preview tool

### [pricing/clean.html] Unescaped `</script>` tag
- [ ] Line 285: `</script>` should be `<\/script>` — will break when loaded as innerHTML in the preview tool

### [project/before.html] Unescaped `</script>` tag
- [ ] Line 109: `</script>` should be `<\/script>` — will break when loaded as innerHTML in the preview tool (the minimalist/playful/clean variants of the same elements already escape correctly)

### [osslanding/clean.html] No touch targets on any buttons/links
- [ ] File has 13 buttons/links but zero `min-h-11` or equivalent — all interactive elements fail the 44px minimum. Add `min-h-11` to all `<button>` and `<a>` elements with interactive purpose

### [portfolio/clean.html] No touch targets on any buttons/links
- [ ] File has 17 buttons/links but zero `min-h-11` or equivalent — all interactive elements fail the 44px minimum. Add `min-h-11` to all `<button>` and `<a>` elements

### [pricing-cards/clean.html] No touch targets on any buttons/links
- [ ] File has 3 buttons/links but zero `min-h-11` or equivalent — all CTA buttons fail the 44px minimum. Add `min-h-11` to all `<button>` and `<a>` elements

### [data-table/clean.html] No touch targets on sort buttons
- [ ] File has 5 sort buttons in table headers with no `min-h-11` — these are interactive but lack touch target sizing. Add `min-h-11` to sort `<button>` elements

---

## Important Issues

### [deploy/clean.html] No dark mode support
- [ ] Entire file uses only dark-themed colors (bg-slate-900, text-white, etc.) with no `dark:` variants — it is permanently dark. Add `dark:` variants and a light-mode base so it works with both themes, or document it as dark-only

### [portfolio/clean.html] No dark mode support
- [ ] File has zero `dark:` class variants — all backgrounds, text, and borders lack dark mode. Add `dark:` variants to all visible elements (backgrounds, text colors, borders)

### [buttons/clean.html] Uses `text-gray-400` for section labels in light mode
- [ ] Multiple instances of `text-gray-400 dark:text-gray-500` used for section sub-headings (lines 63, 74, 94, 114, 133, etc.) — gray-400 (#9ca3af) against white bg is only ~2.7:1 contrast ratio, below the 4.5:1 AA minimum. Change to `text-gray-500 dark:text-gray-400` (gray-500 = #6b7280, ~4.6:1)

### [shell-dashboard/clean.html] Missing `autocomplete` on search input
- [ ] Search input lacks `autocomplete` attribute — add `autocomplete="off"` or appropriate value

### [shell-dashboard/minimalist.html] Missing `autocomplete` on search input
- [ ] Search input lacks `autocomplete` attribute — add `autocomplete="off"` or appropriate value

### [shell-dashboard/playful.html] Missing `autocomplete` on search input
- [ ] Search input lacks `autocomplete` attribute — add `autocomplete="off"` or appropriate value

### [shell-sidebar/clean.html] Missing `autocomplete` on search input
- [ ] Search input lacks `autocomplete` attribute — add `autocomplete="off"` or appropriate value

### [shell-sidebar/minimalist.html] Missing `autocomplete` on search input
- [ ] Search input lacks `autocomplete` attribute — add `autocomplete="off"` or appropriate value

### [shell-sidebar/playful.html] Missing `autocomplete` on search input
- [ ] Search input lacks `autocomplete` attribute — add `autocomplete="off"` or appropriate value

### [shell-form/clean.html] Missing `autocomplete` on form inputs
- [ ] Form inputs lack `autocomplete` attributes — add appropriate values (e.g., `autocomplete="email"`, `autocomplete="name"`)

### [statuspage/clean.html] Missing `autocomplete` on input
- [ ] Input element lacks `autocomplete` attribute

### [statuspage/minimalist.html] Missing `autocomplete` on input
- [ ] Input element lacks `autocomplete` attribute

### [statuspage/playful.html] Missing `autocomplete` on input
- [ ] Input element lacks `autocomplete` attribute

### [feature-grid/clean.html] Missing `min-h-screen` wrapper
- [ ] Component section preset — no `min-h-screen` wrapper. These are section-level components so they may not need full page height, but they lack any centering/padding wrapper for standalone preview

### [feature-grid/minimalist.html] Missing `min-h-screen` wrapper
- [ ] Same as feature-grid/clean.html

### [feature-grid/playful.html] Missing `min-h-screen` wrapper
- [ ] Same as feature-grid/clean.html

### [hero/clean.html] Missing `min-h-screen` wrapper
- [ ] Hero section has no `min-h-screen` wrapper — when previewed standalone it floats without full-page context

### [hero/minimalist.html] Missing `min-h-screen` wrapper
- [ ] Same as hero/clean.html

### [hero/playful.html] Missing `min-h-screen` wrapper
- [ ] Same as hero/clean.html — though it does have generous padding, no `min-h-screen`

---

## Minor Issues

### [accordion/clean.html] No `<nav>` or `aria-label` on FAQ container
- [ ] FAQ accordion groups lack `aria-label` — add descriptive labels to the accordion group containers

### [accordion/minimalist.html] Fewer FAQ items than clean variant
- [ ] Clean has 8 items (5 General + 3 Account & Billing), minimalist has only 5 General items — content parity mismatch. Add Account & Billing section to match clean variant

### [accordion/playful.html] Fewer FAQ items than clean variant
- [ ] Clean has 8 items (5 General + 3 Account & Billing), playful has only 5 General items — content parity mismatch. Add Account & Billing section to match clean variant

### [data-table/clean.html] No semantic `<main>` or `<section>` wrapper
- [ ] Table content is wrapped only in `<div>` — wrap the table in a `<section>` or add `<main>` for better semantics

### [data-table/minimalist.html] No semantic `<main>` or `<section>` wrapper
- [ ] Same as data-table/clean.html

### [data-table/playful.html] No semantic `<main>` or `<section>` wrapper
- [ ] Same as data-table/clean.html

### [dropdown/clean.html] No semantic elements
- [ ] Entire dropdown component uses only `<div>` wrappers — acceptable for a component preset but could benefit from wrapping in a meaningful container

### [dropdown/minimalist.html] No semantic elements
- [ ] Same as dropdown/clean.html

### [dropdown/playful.html] No semantic elements
- [ ] Same as dropdown/clean.html

### [avatars/clean.html] No semantic elements
- [ ] Avatar groups use only `<div>` wrappers — acceptable for a component but could use `role="group"` with `aria-label="Team members"` on the flex container

### [avatars/minimalist.html] No semantic elements
- [ ] Same as avatars/clean.html

### [avatars/playful.html] No semantic elements
- [ ] Same as avatars/clean.html

### [stats-row/clean.html] Missing `min-h-screen` wrapper
- [ ] Component preset lacks full-page wrapper — add `min-h-screen` with centering for standalone preview

### [stats-row/minimalist.html] Missing `min-h-screen` wrapper
- [ ] Same as stats-row/clean.html

### [stats-row/playful.html] Missing `min-h-screen` wrapper
- [ ] Same as stats-row/clean.html

### [shell-dashboard/clean.html] Search input missing visible `<label>`
- [ ] Search input (line ~) uses only `aria-label` via icon button but lacks a `<label>` element — add `<label class="sr-only" for="...">` or ensure the input has `aria-label`

### [shell-dashboard/minimalist.html] Search input missing visible `<label>`
- [ ] Same as shell-dashboard/clean.html

### [shell-dashboard/playful.html] Search input missing visible `<label>`
- [ ] Same as shell-dashboard/clean.html

### [shell-sidebar/clean.html] Search input missing visible `<label>`
- [ ] Same as shell-dashboard

### [shell-sidebar/minimalist.html] Search input missing visible `<label>`
- [ ] Same as shell-dashboard

### [shell-sidebar/playful.html] Search input missing visible `<label>`
- [ ] Same as shell-dashboard

---

## Passing Files

The following files pass all audit checks:

- accordion/clean.html (except script escaping - listed above)
- accordion/minimalist.html (except content parity - listed above)
- accordion/playful.html (except content parity - listed above)
- avatars/clean.html (minor semantic only)
- avatars/minimalist.html (minor semantic only)
- avatars/playful.html (minor semantic only)
- buttons/clean.html (except gray-400 contrast - listed above)
- buttons/minimalist.html
- buttons/playful.html
- card-grid/clean.html
- card-grid/minimalist.html
- card-grid/playful.html
- cards/clean.html
- cards/minimalist.html
- cards/playful.html
- dashboard/clean.html
- dashboard/minimalist.html
- dashboard/playful.html
- data-table/minimalist.html
- data-table/playful.html
- deploy/minimalist.html
- deploy/playful.html
- dropdown/minimalist.html
- dropdown/playful.html
- form/clean.html
- form/editorial.html
- form/minimalist.html
- form/playful.html
- hero/clean.html (minor: no min-h-screen)
- hero/minimalist.html (minor: no min-h-screen)
- hero/playful.html (minor: no min-h-screen)
- landing/clean.html
- landing/editorial.html
- landing/minimalist.html
- landing/playful.html
- osslanding/minimalist.html
- osslanding/playful.html
- pagination/clean.html
- pagination/minimalist.html
- pagination/playful.html
- pricing/minimalist.html
- pricing/playful.html
- pricing-cards/minimalist.html
- pricing-cards/playful.html
- project/clean.html
- project/minimalist.html
- project/playful.html
- restaurant/clean.html
- restaurant/minimalist.html
- restaurant/playful.html
- shell-dashboard/clean.html (except autocomplete/label - listed above)
- shell-dashboard/minimalist.html (except autocomplete/label - listed above)
- shell-dashboard/playful.html (except autocomplete/label - listed above)
- shell-form/clean.html (except autocomplete - listed above)
- shell-form/minimalist.html
- shell-form/playful.html
- shell-marketing/clean.html
- shell-marketing/minimalist.html
- shell-marketing/playful.html
- shell-sidebar/clean.html (except autocomplete/label - listed above)
- shell-sidebar/minimalist.html (except autocomplete/label - listed above)
- shell-sidebar/playful.html (except autocomplete/label - listed above)
- statuspage/clean.html (except autocomplete - listed above)
- statuspage/minimalist.html (except autocomplete - listed above)
- statuspage/playful.html (except autocomplete - listed above)
- tabs/clean.html (except script escaping - listed above)
- tabs/minimalist.html
- tabs/playful.html

### Before Files (intentionally bad, exempt from audit)
- cards/before.html
- dashboard/before.html
- form/before.html
- landing/before.html
- project/before.html

---

## Cross-Cutting Patterns

### What's consistently good across the codebase
- **Responsive grids**: Nearly all grids use proper breakpoint patterns (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- **Sidebar collapsing**: All sidebar presets (dashboard, shell-dashboard, shell-sidebar, project) properly use `-translate-x-full lg:translate-x-0` with hamburger toggle
- **Dark mode coverage**: 81 of 83 non-before files have dark mode (only deploy/clean.html and portfolio/clean.html lack it)
- **Responsive padding**: Nearly universal use of `p-4 sm:p-6 lg:p-8` patterns
- **Table overflow**: All tables have `overflow-x-auto` wrappers
- **Touch targets**: 61 of 83 non-before files have proper `min-h-11` on interactive elements
- **Form labels**: All form presets (form/clean, form/editorial, form/minimalist, form/playful) have proper `<label for>` + `<input id>` pairing
- **Focus states**: Consistent `focus-visible:ring-2` or `focus:ring-2` across all interactive elements
- **`aria-current="page"`**: Present on active nav items in all navigation-containing presets (18 files)
- **`aria-label`** on `<nav>` elements: Present in all 39 files that use `<nav>`
- **Script escaping**: Minimalist and playful variants consistently escape `<\/script>` — only the clean variants of 4 elements missed this

### Systemic gaps to address
1. **`autocomplete` on form inputs**: Missing from 12 files (all shell-dashboard, shell-sidebar, shell-form/clean, statuspage variants)
2. **Touch targets on clean variants**: osslanding/clean, portfolio/clean, pricing-cards/clean, data-table/clean all have buttons without `min-h-11` while their minimalist/playful siblings do
3. **Component presets without page wrappers**: feature-grid (3), hero (3), stats-row (3) lack `min-h-screen` centering wrappers — 9 files total
