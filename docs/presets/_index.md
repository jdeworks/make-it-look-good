# Preset & Component Library

> **Copy-paste-ready HTML+Tailwind components and full-page templates.** 41 preset elements (125 variant HTML files across 6 categories). Every element has a `clean` variant; most also have `minimalist` and `playful` as structurally different HTML — not just CSS changes — and a few add `before` or `editorial`. A few elements are clean-only (agency-portfolio, app-showcase, scroll-reveal-landing). **Check `index.json` for the authoritative per-element variant list — do not assume a variant file exists.**

## Preview Links

Every preset can be previewed live. The URL pattern is:
```
https://jdeworks.github.io/make-it-look-good/#preset:{element}/{personality}[/{color}][/{effect}]
```

For example: `#preset:dashboard/clean`, `#preset:landing/playful`, `#preset:agency-landing/minimalist`.

`{color}` is a Tailwind accent name (`sky`, `violet`, `emerald`, …) that retints the template away
from its stock primary: `#preset:product-page/playful/sky`. `{effect}` is a visual style
(`hushed`, `bouncy`, `frosted`, `serif`). Both slots are positional, so a link that sets only an
effect has to fill the color slot with the template's own primary first:
`#preset:product-page/playful/rose/frosted`. An unknown color name is ignored and the stock
palette stays.

Element names and available personalities are listed in `index.json`. Use these links to show users a template before building — especially useful when working from the bundle (online chat) where the raw HTML files aren't available.

## Framework Support

**HTML is the single source of truth.** To use in React, Vue, Svelte, or Angular:
1. Copy the HTML preset
2. Apply attribute changes from [FRAMEWORKS.md](FRAMEWORKS.md)
3. Add interactivity using the behavior recipes in FRAMEWORKS.md

Pre-built framework files (`.jsx`, `.vue`, `.svelte`) only exist for components with **complex interactive logic** — state machines, keyboard navigation, form validation. Presentational components don't need separate framework files; the LLM converts them on the fly.

---

## Layout Shells

Start here. Everything builds on these.

| Preset | Description | Frameworks |
|--------|-------------|:----------:|
| [`shell-sidebar/`](shell-sidebar/) | App shell: 240px sidebar + topbar + content area | [React](shell-sidebar/react.jsx) [Vue](shell-sidebar/vue.vue) [Svelte](shell-sidebar/svelte.svelte) |
| [`shell-marketing/`](shell-marketing/) | Header + hero slot + sections + footer | [React](shell-marketing/react.jsx) [Vue](shell-marketing/vue.vue) [Svelte](shell-marketing/svelte.svelte) |
| [`shell-form/`](shell-form/) | Centered card on gray background (login/signup) | [React](shell-form/react.jsx) [Vue](shell-form/vue.vue) [Svelte](shell-form/svelte.svelte) |
| [`shell-dashboard/`](shell-dashboard/) | Sidebar + topbar + stat cards + table (composed) | HTML only |

## Navigation Components

| Preset | Description | Frameworks |
|--------|-------------|:----------:|
| [`tabs/`](tabs/) | Horizontal tabs with content panels | [React](tabs/react.jsx) [Vue](tabs/vue.vue) [Svelte](tabs/svelte.svelte) |
| [`pagination/`](pagination/) | Page navigation with prev/next + numbers | [React](pagination/react.jsx) [Vue](pagination/vue.vue) [Svelte](pagination/svelte.svelte) |
| [`dropdown/`](dropdown/) | Dropdown menu with items + outside click | [React](dropdown/react.jsx) [Vue](dropdown/vue.vue) |

## Content Sections

| Preset | Description | Frameworks |
|--------|-------------|:----------:|
| [`hero/`](hero/) | Centered hero with heading + subtext + CTAs | HTML + [FRAMEWORKS.md](FRAMEWORKS.md) |
| [`feature-grid/`](feature-grid/) | 3-column feature cards with icons | HTML + [FRAMEWORKS.md](FRAMEWORKS.md) |
| [`pricing-cards/`](pricing-cards/) | 3-tier pricing (Free / Pro / Enterprise) | HTML + [FRAMEWORKS.md](FRAMEWORKS.md) |
| [`stats-row/`](stats-row/) | 4 stat cards with trend indicators | HTML + [FRAMEWORKS.md](FRAMEWORKS.md) |
| [`accordion/`](accordion/) | FAQ-style collapsible accordion | [React](accordion/react.jsx) [Vue](accordion/vue.vue) [Svelte](accordion/svelte.svelte) |
| [`avatars/`](avatars/) | Overlapping avatars with +N indicator | [React](avatars/react.jsx) [Vue](avatars/vue.vue) |

## Data Display

| Preset | Description | Frameworks |
|--------|-------------|:----------:|
| [`data-table/`](data-table/) | Data table with sorting + status badges | [React](data-table/react.jsx) [Vue](data-table/vue.vue) [Svelte](data-table/svelte.svelte) |
| [`card-grid/`](card-grid/) | Responsive product/content card grid | HTML only |

## Forms

| Preset | Description | Frameworks |
|--------|-------------|:----------:|
| [`form/`](form/) | Signup form with password strength | [React](form/react.jsx) [Vue](form/vue.vue) [Svelte](form/svelte.svelte) |
| [`shell-form/`](shell-form/) | Login form (centered layout) | [React](shell-form/react.jsx) [Vue](shell-form/vue.vue) [Svelte](shell-form/svelte.svelte) |

## Feedback (interactive variants only)

| Preset | Description | Frameworks |
|--------|-------------|:----------:|
| [`dropdown/`](dropdown/) (modal) | Modal dialog with backdrop + focus trap | [React](dropdown/react-modal.jsx) [Vue](dropdown/vue-modal.vue) [Svelte](dropdown/svelte-modal.svelte) |
| [`stats-row/`](stats-row/) (toast) | Toast notifications (auto-dismiss, stack) | [React](stats-row/react-toast.jsx) [Vue](stats-row/vue-toast.vue) |
| [`hero/`](hero/) (search) | Debounced search with filter dropdown | [React](hero/react-search.jsx) [Vue](hero/vue-search.vue) [Svelte](hero/svelte-search.svelte) |

## Buttons

| Preset | Description | Frameworks |
|--------|-------------|:----------:|
| [`buttons/`](buttons/) | All emphasis levels x sizes x states | HTML only |

## Full Pages

| Preset | Description |
|--------|-------------|
| [`pricing/`](pricing/) | SaaS pricing page |
| [`portfolio/`](portfolio/) | Portfolio (clean variant is dark-themed) |
| [`restaurant/`](restaurant/) | Restaurant (warm theme) |
| [`statuspage/`](statuspage/) | Status page |

## Before → After Examples

| Preset | Personalities |
|--------|--------------|
| [`dashboard/`](dashboard/) | before, clean, minimalist, playful |
| [`landing/`](landing/) | before, clean, minimalist, playful, editorial |
| [`form/`](form/) | before, clean, minimalist, playful, editorial |
| [`cards/`](cards/) | before, clean, minimalist, playful |
| [`project/`](project/) | before, clean, minimalist, playful |

## Expressive Templates

| Preset | Description | Design Approach |
|--------|-------------|-----------------|
| [`personal-hero/`](personal-hero/) | Personal portfolio site | Clean personal branding |
| [`agency-landing/`](agency-landing/) | Creative agency landing | Bold Creative / Agency |
| [`agency-portfolio/`](agency-portfolio/) | Agency portfolio with scroll-shrink logo | Typographic / Scroll-Driven Agency |
| [`app-showcase/`](app-showcase/) | Dark app showcase with phone mockup + stacking cards | Dark Warm / App-Centric Scroll |
| [`scroll-reveal-landing/`](scroll-reveal-landing/) | Sky gradient hero with line-by-line text reveal | Airy / Scroll-Reveal Education |
| [`product-launch/`](product-launch/) | Product launch page | Dark Premium / Product |
| [`editorial-blog/`](editorial-blog/) | Long-form blog / editorial | Minimal Editorial / Typography-First |
| [`saas-features/`](saas-features/) | SaaS feature showcase | Friendly SaaS / Bento |
| [`scroll-story/`](scroll-story/) | Scroll-triggered portfolio | Immersive / Scroll-Storytelling |
| [`product-page/`](product-page/) | E-commerce product page | E-commerce / Product-Focused |
| [`devtool-landing/`](devtool-landing/) | Developer tool landing | Dark Premium / Developer |
| [`docs-site/`](docs-site/) | Documentation site | Documentation / Reference |
| [`event-page/`](event-page/) | Event/conference landing | Event / Conference |
| [`jdeworks-personal/`](jdeworks-personal/) | Personalized "This is Me" portfolio | Scroll-Driven Storytelling |

## Edge Cases

| Preset | Description |
|--------|-------------|
| [`deploy/`](deploy/) | Deploy monitor |
| [`osslanding/`](osslanding/) | OSS landing page |

---

## Composition Recipes

Combine presets to build full pages:

### Dashboard
```
shell-dashboard/ (includes sidebar + topbar + stats + table)
```
Or build custom: `shell-sidebar/` → add `stats-row/` + `data-table/` in content area.

### Landing Page
```
shell-marketing/
  └ Add hero section from: hero/
  └ Add sections: feature-grid/
  └ Add sections: pricing-cards/
```

### Login / Signup Page
```
shell-form/ (centered login form)
```

### Settings Page
```
shell-sidebar/ layout
  └ In content area: form elements
```

### Data Browser
```
shell-sidebar/ layout
  └ In content area: search bar + data-table/
```

---

## Design Tokens (Consistent Across All Presets)

| Token | Value | Tailwind |
|-------|-------|----------|
| Primary | `#2563eb` | `blue-600` |
| Primary hover | `#1d4ed8` | `blue-700` |
| Text primary | `#0f172a` / `#f1f5f9` | `slate-900` / `slate-100` |
| Text secondary | `#475569` / `#94a3b8` | `slate-600` / `slate-400` |
| Background | `#ffffff` / `#0f172a` | `white` / `slate-900` |
| Surface | `#f8fafc` / `#1e293b` | `slate-50` / `slate-800` |
| Border | `#e2e8f0` / `#334155` | `slate-200` / `slate-700` |
| Success | `#16a34a` | `green-600` |
| Error | `#dc2626` | `red-600` |
| Warning | `#d97706` | `amber-600` |
| Border radius | `8px` (cards), `8px` (buttons), `8px` (inputs) | `rounded-lg` |
| Touch target | 44px minimum | `min-h-11` |

Note: Expressive templates use different primary colors appropriate to their personality (rose for playful, indigo for editorial, etc.). See `index.json` for per-preset color mappings.

## Preset Format

Each preset directory contains:
- `clean.html` — Standard Tailwind, balanced, professional
- `minimalist.html` — Stripped back, hairline borders, light font weights
- `playful.html` — Big rounded corners, colorful shadows, bouncy animations
- `react.jsx` (optional) — React component variant for interactive components
- `vue.vue` (optional) — Vue SFC variant
- `svelte.svelte` (optional) — Svelte 5 component variant
- Some presets also have `before.html` and/or `editorial.html` variants

All presets are:
- **Tailwind v4** classes only
- **Self-contained** (inline SVG icons, no external deps except Google Fonts for display variants)
- **Responsive** (320px → 768px → 1024px+)
- **Dark mode** via `dark:` classes
- **WCAG AA** contrast, 44px touch targets, semantic HTML
- **Realistic content** (not lorem ipsum)
