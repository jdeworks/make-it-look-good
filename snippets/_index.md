# Snippet Library

> **Copy-paste-ready HTML+Tailwind components.** Each snippet is a self-contained fragment — no `<!DOCTYPE>`, no `<head>`, just the HTML you need. Paste into your project and customize.

## Framework Support

Snippets are **HTML+Tailwind by default** (works in any framework). Interactive components also have **React** (`react/*.jsx`), **Vue** (`vue/*.vue`), and **Svelte 5** (`svelte/*.svelte`) versions.

See [FRAMEWORKS.md](FRAMEWORKS.md) for conversion guides to Svelte, Angular, or any other framework.

---

## Layout Shells

Start here. Everything builds on these.

| Snippet | Description | Frameworks |
|---------|-------------|:----------:|
| [`shell-sidebar-topbar.html`](shell-sidebar-topbar.html) | App shell: 240px sidebar + topbar + content area | [React](react/shell-sidebar-topbar.jsx) [Vue](vue/shell-sidebar-topbar.vue) |
| [`shell-marketing-page.html`](shell-marketing-page.html) | Header + hero slot + sections + footer | HTML only |
| [`shell-centered-form.html`](shell-centered-form.html) | Centered card on gray background | HTML only |
| [`shell-dashboard.html`](shell-dashboard.html) | Sidebar + topbar + stat cards + table (composed) | HTML only |

## Navigation

| Snippet | Description | Frameworks |
|---------|-------------|:----------:|
| [`nav-topbar.html`](nav-topbar.html) | Horizontal nav with logo + links + CTA | [React](react/nav-topbar.jsx) [Vue](vue/nav-topbar.vue) |
| [`nav-sidebar.html`](nav-sidebar.html) | Vertical sidebar with icons + sections + active state | [React](react/nav-sidebar.jsx) [Vue](vue/nav-sidebar.vue) |
| [`nav-sidebar-collapsed.html`](nav-sidebar-collapsed.html) | Icon-only collapsed sidebar (56px) | HTML only |
| [`nav-bottom-mobile.html`](nav-bottom-mobile.html) | Bottom nav bar (3-5 items, mobile) | [React](react/nav-bottom-mobile.jsx) [Vue](vue/nav-bottom-mobile.vue) |
| [`nav-breadcrumbs.html`](nav-breadcrumbs.html) | Breadcrumb trail | HTML only |
| [`nav-pagination.html`](nav-pagination.html) | Page navigation with prev/next + numbers | [React](react/nav-pagination.jsx) [Vue](vue/nav-pagination.vue) |
| [`nav-tabs.html`](nav-tabs.html) | Horizontal tabs with content panels | [React](react/nav-tabs.jsx) [Vue](vue/nav-tabs.vue) |
| [`nav-dropdown.html`](nav-dropdown.html) | Dropdown menu with items + outside click | [React](react/nav-dropdown.jsx) [Vue](vue/nav-dropdown.vue) |

## Content Sections

| Snippet | Description | Frameworks |
|---------|-------------|:----------:|
| [`content-hero.html`](content-hero.html) | Centered hero with heading + subtext + CTAs | HTML only |
| [`content-feature-grid.html`](content-feature-grid.html) | 3-column feature cards with icons | HTML only |
| [`content-pricing-cards.html`](content-pricing-cards.html) | 3-tier pricing (Free / Pro / Enterprise) | HTML only |
| [`content-testimonials.html`](content-testimonials.html) | Testimonial cards row | HTML only |
| [`content-stats-row.html`](content-stats-row.html) | 4 stat cards with trend indicators | HTML only |
| [`content-empty-state.html`](content-empty-state.html) | Empty state with icon + message + action | HTML only |
| [`content-cta-section.html`](content-cta-section.html) | Full-width call-to-action banner | HTML only |
| [`content-accordion.html`](content-accordion.html) | FAQ-style collapsible accordion | [React](react/content-accordion.jsx) [Vue](vue/content-accordion.vue) |
| [`content-avatar-group.html`](content-avatar-group.html) | Overlapping avatars with +N indicator | [React](react/content-avatar-group.jsx) [Vue](vue/content-avatar-group.vue) |

## Data Display

| Snippet | Description | Frameworks |
|---------|-------------|:----------:|
| [`data-table.html`](data-table.html) | Data table with sorting indicators + status badges | [React](react/data-table.jsx) [Vue](vue/data-table.vue) |
| [`data-card-grid.html`](data-card-grid.html) | Responsive product/content card grid | HTML only |
| [`data-detail-view.html`](data-detail-view.html) | Key-value detail view (profile, order, etc.) | HTML only |

## Forms

| Snippet | Description | Frameworks |
|---------|-------------|:----------:|
| [`form-login.html`](form-login.html) | Email + password + remember me + forgot link | [React](react/form-login.jsx) [Vue](vue/form-login.vue) |
| [`form-signup.html`](form-signup.html) | Name + email + password + terms checkbox | [React](react/form-signup.jsx) [Vue](vue/form-signup.vue) |
| [`form-settings.html`](form-settings.html) | Grouped settings with labels + save/cancel | HTML only |
| [`form-search-bar.html`](form-search-bar.html) | Search input with icon + filter dropdown | [React](react/form-search-bar.jsx) [Vue](vue/form-search-bar.vue) |
| [`form-contact.html`](form-contact.html) | Name + email + message textarea + send | HTML only |

## Feedback

| Snippet | Description | Frameworks |
|---------|-------------|:----------:|
| [`feedback-toast.html`](feedback-toast.html) | Toast notifications (success/error/warning/info) | [React](react/feedback-toast.jsx) [Vue](vue/feedback-toast.vue) |
| [`feedback-alert-banner.html`](feedback-alert-banner.html) | Full-width alert banner (dismissible) | HTML only |
| [`feedback-modal.html`](feedback-modal.html) | Modal dialog with backdrop + focus trap | [React](react/feedback-modal.jsx) [Vue](vue/feedback-modal.vue) |
| [`feedback-loading-skeleton.html`](feedback-loading-skeleton.html) | Skeleton loading placeholders | HTML only |

## Buttons

| Snippet | Description | Frameworks |
|---------|-------------|:----------:|
| [`btn-system.html`](btn-system.html) | All emphasis levels × sizes × states | HTML only |

---

## Composition Recipes

Combine snippets to build full pages:

### Dashboard
```
shell-dashboard.html (includes sidebar + topbar + stats + table)
```
Or build custom: `shell-sidebar-topbar` → add `content-stats-row` + `data-table` in content area.

### Landing Page
```
shell-marketing-page.html
  └ Replace hero slot with: content-hero.html
  └ Add sections: content-feature-grid.html
  └ Add sections: content-testimonials.html
  └ Add sections: content-pricing-cards.html
  └ Add sections: content-cta-section.html
```

### Login / Signup Page
```
shell-centered-form.html
  └ Replace form content with: form-login.html or form-signup.html
```

### Settings Page
```
shell-sidebar-topbar.html
  └ In content area: form-settings.html
```

### Data Browser
```
shell-sidebar-topbar.html
  └ In content area: form-search-bar.html + data-table.html
```

### E-commerce
```
shell-marketing-page.html
  └ Replace hero with: form-search-bar.html
  └ Add section: data-card-grid.html
```

### Empty / Loading States
```
Any shell
  └ While loading: feedback-loading-skeleton.html
  └ No results: content-empty-state.html
  └ Notifications: feedback-toast.html
  └ Confirm actions: feedback-modal.html
```

---

## Design Tokens (Consistent Across All Snippets)

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

## Snippet Format

Every HTML snippet starts with a metadata comment:
```html
<!-- snippet: nav-sidebar
     category: navigation
     rationale: components/navigation.md
     tags: sidebar, nav, dashboard
     dark-mode: yes
     frameworks: react, vue
-->
```

All snippets are:
- **Tailwind v4** classes only
- **Self-contained** (inline SVG icons, no external deps)
- **Responsive** (320px → 768px → 1024px+)
- **Dark mode** via `dark:` classes
- **WCAG AA** contrast, 44px touch targets, semantic HTML
- **Realistic content** (not lorem ipsum)
