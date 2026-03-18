# Preset & Component Library

> **Copy-paste-ready HTML+Tailwind components and full-page templates.** Each preset has multiple personality variants (Clean, Minimalist, Playful) as structurally different HTML — not just CSS changes. Interactive components also have React, Vue, and Svelte versions.

## Framework Support

Presets are **HTML+Tailwind by default** (works in any framework). Interactive components also have **React** (`.jsx`), **Vue** (`.vue`), and **Svelte 5** (`.svelte`) versions in their preset directory.

See [FRAMEWORKS.md](FRAMEWORKS.md) for conversion guides to Angular or any other framework.

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
| [`tabs/`](tabs/) | Horizontal tabs with content panels | [React](tabs/react.jsx) [Vue](tabs/vue.vue) |
| [`pagination/`](pagination/) | Page navigation with prev/next + numbers | [React](pagination/react.jsx) [Vue](pagination/vue.vue) |
| [`dropdown/`](dropdown/) | Dropdown menu with items + outside click | [React](dropdown/react.jsx) [Vue](dropdown/vue.vue) |

## Content Sections

| Preset | Description | Frameworks |
|--------|-------------|:----------:|
| [`hero/`](hero/) | Centered hero with heading + subtext + CTAs | HTML only |
| [`feature-grid/`](feature-grid/) | 3-column feature cards with icons | HTML only |
| [`pricing-cards/`](pricing-cards/) | 3-tier pricing (Free / Pro / Enterprise) | HTML only |
| [`stats-row/`](stats-row/) | 4 stat cards with trend indicators | HTML only |
| [`accordion/`](accordion/) | FAQ-style collapsible accordion | [React](accordion/react.jsx) [Vue](accordion/vue.vue) |
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

## Feedback

| Preset | Description | Frameworks |
|--------|-------------|:----------:|
| [`dropdown/`](dropdown/) (modal) | Modal dialog with backdrop + focus trap | [React](dropdown/react-modal.jsx) [Vue](dropdown/vue-modal.vue) [Svelte](dropdown/svelte-modal.svelte) |
| [`stats-row/`](stats-row/) (toast) | Toast notifications (success/error/warning/info) | [React](stats-row/react-toast.jsx) [Vue](stats-row/vue-toast.vue) |

## Buttons

| Preset | Description | Frameworks |
|--------|-------------|:----------:|
| [`buttons/`](buttons/) | All emphasis levels x sizes x states | HTML only |

## Full Pages

| Preset | Description |
|--------|-------------|
| [`pricing/`](pricing/) | SaaS pricing page |
| [`portfolio/`](portfolio/) | Portfolio (dark theme) |
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
