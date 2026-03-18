# Mobile-First Design

> **TL;DR:** Start with the smallest screen, then enhance. Use `min-width` media queries to add complexity. This ensures core content and functionality work everywhere. Set 16px minimum font size to prevent iOS auto-zoom.

## Core Principles

1. **Progressive enhancement** — start with the constrained version (mobile), then add layout and features for larger screens
2. **Content priority** — mobile forces you to decide what actually matters; this clarity benefits all screen sizes
3. **`min-width` over `max-width`** — mobile styles are the default; media queries add complexity, never remove it
4. **Touch-first** — design for fingers first, then enhance for pointer precision on desktop
5. **Performance is a mobile feature** — mobile users are often on slower connections; ship less by default

## Concrete Rules

### Viewport Configuration
```html
<!-- Required in every document -->
<meta name="viewport" content="width=device-width, initial-scale=1">
```
- **Never use** `maximum-scale=1` or `user-scalable=no` — these break pinch-to-zoom accessibility (WCAG 1.4.4)
- **Never set** `width=320` or any fixed pixel value

### Typography
| Rule | Value | Why |
|------|-------|-----|
| Minimum body font size | **16px** | Prevents iOS Safari auto-zoom on form inputs |
| Minimum input font size | **16px** | iOS zooms the viewport if `<input>` font is <16px |
| Line length on mobile | **35–50 characters** | Comfortable reading on narrow screens |
| Line height on mobile | **1.5–1.6** | Generous leading improves small-screen readability |

### Touch Targets
| Element | Minimum Size | Minimum Spacing |
|---------|-------------|-----------------|
| Buttons, links, controls | **44 × 44px** (WCAG), **48 × 48px** (Material) | **8px** between targets |
| Icon-only buttons | **48 × 48px** touch area (icon can be smaller) | **8px** between targets |
| Nav items | **48px** height minimum | Full-width tap area on mobile |

### Thumb Zone (One-Handed Use)
| Zone | Screen Position | Guideline |
|------|----------------|-----------|
| **Easy** (natural reach) | Bottom center/right | Primary actions, navigation |
| **Stretch** (reachable) | Top center, sides | Secondary actions |
| **Hard** (requires grip change) | Top-left corner | Infrequent actions only |

> Place primary CTAs and navigation in the bottom 1/3 of the screen for thumb-friendly access.

### Breakpoints (Common System)
| Name | `min-width` | Typical Devices |
|------|-------------|-----------------|
| Default (no query) | 0 | Small phones |
| `sm` | **640px** | Large phones (landscape) |
| `md` | **768px** | Tablets (portrait) |
| `lg` | **1024px** | Tablets (landscape), small laptops |
| `xl` | **1280px** | Desktops |
| `2xl` | **1536px** | Large desktops |

### Mobile Navigation Patterns
| Pattern | Best For | Avoid When |
|---------|----------|------------|
| **Bottom tab bar** | 3–5 primary destinations | >5 items |
| **Hamburger menu** | >5 items, secondary nav | Primary navigation (hides discoverability) |
| **Tab bar (top)** | Content categories, filters | Deep navigation |
| **Full-screen overlay** | Complex menus, e-commerce categories | Simple navigation |

## CSS/Implementation Patterns

### Mobile-First Media Queries
```css
/* Base styles = mobile (no media query) */
.container {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
    flex-direction: row;
    gap: 2rem;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin-inline: auto;
    padding: 3rem;
  }
}
```

### Responsive Grid (Mobile-First)
```css
.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;              /* Mobile: single column */
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, 1fr); /* Tablet: 2 columns */
  }
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr); /* Desktop: 3 columns */
    gap: 1.5rem;
  }
}
```

### Preventing iOS Input Zoom
```css
/* Inputs MUST be ≥16px to prevent iOS auto-zoom */
input, select, textarea {
  font-size: 1rem; /* = 16px at default root */
}

/* If your design needs smaller inputs on desktop, scale up on mobile */
@media (min-width: 1024px) {
  .input--compact {
    font-size: 0.875rem; /* 14px — safe on desktop only */
  }
}
```

### Touch-Friendly Tap Targets
```css
/* Ensure minimum 44px touch target, even if visual element is smaller */
.icon-button {
  position: relative;
  width: 24px;
  height: 24px;
}

.icon-button::before {
  content: "";
  position: absolute;
  inset: -12px; /* Expands touch target to 48x48 */
}

/* Full-width buttons on mobile for easy thumb reach */
.btn-primary {
  width: 100%;
  min-height: 48px;
  padding: 0.75rem 1.5rem;
}

@media (min-width: 768px) {
  .btn-primary {
    width: auto;
  }
}
```

### Tailwind Mobile-First Patterns
```html
<!-- Single column on mobile, 2 on tablet, 3 on desktop -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

<!-- Stack on mobile, row on tablet -->
<div class="flex flex-col md:flex-row md:items-center gap-4">

<!-- Full-width button on mobile, auto on desktop -->
<button class="w-full md:w-auto px-6 py-3 text-base">

<!-- Hide on mobile, show on desktop -->
<nav class="hidden lg:flex">

<!-- Show on mobile, hide on desktop -->
<button class="lg:hidden" aria-label="Open menu">
```

## Common Mistakes

1. **Desktop-first CSS with `max-width` overrides** — results in constantly undoing styles. Start mobile, add with `min-width`.
2. **Font size <16px on inputs** — causes iOS Safari to zoom the viewport, disorienting the user. Always use `font-size: 1rem` or larger.
3. **Tiny touch targets** — a 30px button is frustrating on mobile. Minimum 44px (WCAG) or 48px (Material Design).
4. **Hamburger menu for 3 items** — if you have few nav items, show them directly. Hamburger menus reduce discoverability by ~50%.
5. **Fixed-position elements covering content** — sticky headers and floating CTAs eat screen real estate. Keep them compact (<60px height).
6. **Hover-dependent interactions** — tooltips, dropdown menus, and hover previews don't work on touch. Always provide a tap alternative.
7. **Testing only in Chrome DevTools** — device simulation is a starting point, not a replacement. Real devices have different rendering, scroll behavior, and performance.
8. **Disabling pinch-to-zoom** — `user-scalable=no` or `maximum-scale=1` is a WCAG failure. Users with low vision need zoom.

## Decision Tree

```
Starting a new page/component?
├─ Write styles for 320px–480px first (no media query)
│  ├─ Single column layout
│  ├─ Stack all elements vertically
│  ├─ Full-width buttons and inputs
│  └─ 16px+ font sizes
├─ Does content need more structure on wider screens?
│  ├─ Yes → Add @media (min-width: 768px) for tablet
│  │  ├─ 2-column grid
│  │  ├─ Side-by-side elements
│  │  └─ Inline buttons
│  └─ No → Keep single column (it might be fine everywhere)
├─ Does desktop need further enhancement?
│  └─ Yes → Add @media (min-width: 1024px) for desktop
│     ├─ 3+ column grid
│     ├─ max-width container
│     └─ Larger spacing/typography
└─ Test on real devices
   ├─ iPhone SE (375px) — smallest common screen
   ├─ iPhone 14/15 (390px) — most common phone
   ├─ iPad (768px) — tablet baseline
   └─ Thumb-reach test: can you use it one-handed?
```

## Sources
- [WCAG 2.2 — Success Criterion 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text)
- [WCAG 2.2 — Success Criterion 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [Google — Mobile-First Indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing)
- [Luke Wroblewski — Mobile First (2011)](https://www.lukew.com/ff/entry.asp?933)
- [Steven Hoober — How Do Users Really Hold Mobile Devices? (UXmatters, 2013)](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php)
