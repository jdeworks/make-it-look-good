# Navigation

> **TL;DR:** 5-7 top-level items maximum. Current location must always be visible. Use bottom navigation on mobile (3-5 items), sidebar for complex desktop apps, top bar for marketing/content sites. Breadcrumbs for hierarchies deeper than 2 levels.

## Core Principles

1. **Users must always know where they are** -- an active/current state indicator is non-negotiable on every nav pattern
2. **Navigation is a Hick's Law problem** -- every added item slows decision-making (see [Hick's Law](../foundations/hicks-law.md))
3. **Thumb zone matters on mobile** -- bottom navigation beats hamburger menus for discoverability and reachability (see [Touch Targets](../interaction/touch-targets.md))
4. **Progressive disclosure over flat dumps** -- show top-level categories, reveal sub-items on interaction
5. **Consistency across pages** -- navigation position, order, and behavior must not change as users move through the site

## Concrete Rules

### Top Bar Navigation
| Rule | Value |
|------|-------|
| Max top-level items | 5-7 (excluding logo and utility actions) |
| Height | 48-64px (desktop), 44-56px (mobile) |
| Logo placement | Left (LTR languages) |
| Utility actions (search, profile, cart) | Right side |
| Active indicator | Bottom border (3-4px), color change, or bold weight |
| Dropdown trigger | Hover on desktop (with click fallback), tap on mobile |

### Sidebar Navigation
| Rule | Value |
|------|-------|
| Width | 240-280px expanded, 56-72px collapsed (icon-only) |
| Item height | 40-48px |
| Icon size | 20-24px with 12-16px gap to label |
| Active state | Background fill + left border (3-4px) or bold text + tinted background |
| Max nesting depth | 2 levels (parent + child). Deeper = rethink your IA |
| Collapse trigger | Chevron toggle at top/bottom or hamburger icon |

### Bottom Navigation (Mobile)
| Rule | Value |
|------|-------|
| Items | 3-5 (never more than 5) |
| Bar height | 56-80px (must clear safe area insets) |
| Icon size | 24px, label 10-12px below |
| Touch target | Minimum 48x48px per item |
| Active state | Filled icon + color change + label always visible |
| Label | Always show labels -- icon-only bottom nav fails usability tests |

### Breadcrumbs
| Rule | Value |
|------|-------|
| When to use | Hierarchies 3+ levels deep |
| Separator | `>` or `/` -- use `aria-hidden` on separators |
| Truncation | Collapse middle items to `...` when > 4 levels, always show first and last |
| Current page | Displayed as plain text (not a link) |
| Font size | 12-14px, secondary text color |

### Tab Navigation
| Rule | Value |
|------|-------|
| Max tabs | 3-7 visible (scrollable beyond that) |
| Active indicator | Bottom border 2-3px in primary color |
| Height | 40-48px |
| Tab spacing | 16-24px padding horizontal |
| Behavior | Tabs switch content in-place; they don't navigate to new pages |

## CSS/Implementation Patterns

### Top Bar
```css
.top-bar {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 40;
}

.top-bar__nav { display: flex; gap: 4px; margin-left: 32px; }

.top-bar__link {
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}

.top-bar__link[aria-current="page"] {
  color: var(--color-primary);
  background: var(--color-primary-subtle);
}

/* Tailwind equivalent */
/* nav: flex items-center h-14 px-4 bg-white border-b sticky top-0 z-40 */
/* link: px-3 py-2 rounded-md text-sm font-medium text-gray-600
         aria-[current=page]:text-blue-600 aria-[current=page]:bg-blue-50 */
```

### Sidebar
```css
.sidebar {
  width: 256px;
  height: 100dvh;
  position: sticky;
  top: 0;
  overflow-y: auto;
  border-right: 1px solid var(--color-border);
  padding: 16px 8px;
  transition: width 200ms ease;
}

.sidebar.collapsed { width: 64px; }
.sidebar.collapsed .sidebar__label { display: none; }

.sidebar__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.sidebar__item[aria-current="page"] {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
  font-weight: 600;
  border-left: 3px solid var(--color-primary);
}

/* Tailwind: w-64 h-dvh sticky top-0 overflow-y-auto border-r p-4
   collapsed: w-16 transition-[width] duration-200 */
```

### Bottom Navigation (Mobile)
```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  height: 56px;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  z-index: 40;
}

.bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 48px;
  font-size: 0.625rem;
  color: var(--color-text-secondary);
}

.bottom-nav__item[aria-current="page"] {
  color: var(--color-primary);
  font-weight: 600;
}

/* Tailwind: fixed bottom-0 inset-x-0 flex justify-around h-14
   pb-[env(safe-area-inset-bottom)] bg-white border-t z-40 */
```

### Responsive Top Bar to Hamburger
```css
/* Show full nav on desktop, hamburger on mobile */
.top-bar__nav   { display: flex; }
.top-bar__toggle { display: none; }

@media (max-width: 768px) {
  .top-bar__nav    { display: none; }
  .top-bar__toggle { display: flex; }
  .top-bar__nav.open {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 56px;
    left: 0;
    right: 0;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    padding: 8px;
  }
}
```

## Accessibility

- **`<nav aria-label="Main">`** on the primary nav landmark. Use distinct labels if multiple navs exist (e.g., `aria-label="Footer"`)
- **`aria-current="page"`** on the active link -- screen readers announce "current page"
- **Skip link** as the first focusable element: `<a href="#main-content" class="skip-link">Skip to content</a>`
- **Keyboard navigation:** arrow keys within tab bars and menu bars (`role="menubar"`); `Tab` between nav groups
- **`aria-expanded`** on hamburger toggles and collapsible sidebar triggers
- **Breadcrumb semantics:** wrap in `<nav aria-label="Breadcrumb">` with `<ol>` and use `aria-current="page"` on the last item

## Common Mistakes

1. **Hamburger-only on desktop** -- hides all navigation behind a click, killing discoverability. Hamburger is a mobile compromise, not a desktop pattern
2. **No active state indicator** -- users can't tell where they are. Every nav must visually mark the current page
3. **More than 5 items in bottom nav** -- cramped icons, unreadable labels, missed touch targets. Stick to 3-5
4. **Icon-only bottom nav without labels** -- icons are ambiguous; users misinterpret them 60%+ of the time without labels
5. **Breadcrumbs as primary navigation** -- breadcrumbs supplement, they don't replace a main nav
6. **Too many top-level items** -- 10+ links in a top bar overwhelm users. Group under dropdowns or use sidebar
7. **Sidebar always open on mobile** -- a 256px sidebar on a 375px screen leaves no room. Collapse to overlay or switch to bottom nav
8. **No focus management on mobile menu** -- opening a hamburger menu must trap focus within the menu and return focus on close

## Decision Tree

```
What type of product?
├─ Marketing / content site (< 7 sections)
│  └─ Use top bar navigation
│     ├─ Mobile → hamburger with slide-out menu
│     └─ > 7 items → group into dropdowns or prune
├─ Dashboard / SaaS app
│  ├─ Many sections (8+) → sidebar navigation
│  │  ├─ Mobile → collapsible overlay or bottom nav for top 4-5
│  │  └─ Need quick switching? → keep sidebar always visible on desktop
│  └─ Few sections (≤ 5) → top bar or bottom nav on mobile
├─ Mobile app (native-like)
│  └─ Use bottom navigation (3-5 items)
│     └─ More items? → 4 visible + "More" tab
├─ Deep hierarchy (3+ levels)
│  └─ Add breadcrumbs alongside primary nav
└─ Content tabs (same page, different views)
   └─ Use tab navigation (3-7 tabs)
      └─ More tabs? → scrollable tabs with overflow indicators
```

## Sources
- [Material Design 3 — Navigation](https://m3.material.io/components/navigation-bar/overview)
- [Apple HIG — Tab Bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Nielsen Norman Group — Navigation Design](https://www.nngroup.com/articles/navigation-design/)
- [Nielsen Norman Group — Hamburger Menus](https://www.nngroup.com/articles/hamburger-menus/)
- [WAI-ARIA — Breadcrumb Pattern](https://www.w3.org/WAI/ARIA/apd/patterns/breadcrumb/)
- [WAI-ARIA — Navigation Landmark](https://www.w3.org/WAI/ARIA/apd/practices/landmark-regions/)
- Luke Wroblewski — *Mobile First* (2011)

## Related Snippets
- [`nav-topbar.html`](../snippets/nav-topbar.html) — Horizontal nav with logo + links + CTA ([React](../snippets/react/nav-topbar.jsx), [Vue](../snippets/vue/nav-topbar.vue))
- [`nav-sidebar.html`](../snippets/nav-sidebar.html) — Vertical sidebar with icons + sections ([React](../snippets/react/nav-sidebar.jsx), [Vue](../snippets/vue/nav-sidebar.vue))
- [`nav-sidebar-collapsed.html`](../snippets/nav-sidebar-collapsed.html) — Icon-only 56px sidebar
- [`nav-bottom-mobile.html`](../snippets/nav-bottom-mobile.html) — Bottom nav bar for mobile ([React](../snippets/react/nav-bottom-mobile.jsx), [Vue](../snippets/vue/nav-bottom-mobile.vue))
- [`nav-breadcrumbs.html`](../snippets/nav-breadcrumbs.html) — Breadcrumb trail
