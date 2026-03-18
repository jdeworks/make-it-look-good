# Breakpoints

> **TL;DR:** Common breakpoints: 480px (mobile landscape), 640px (large mobile), 768px (tablet), 1024px (desktop), 1280px (large desktop). Use mobile-first `min-width` queries. Design for content, not devices -- add breakpoints where your layout breaks, not at arbitrary device widths.

## Core Principles

1. **Content drives breakpoints** — add a breakpoint when your content looks bad, not because a device has that screen width
2. **Mobile-first with `min-width`** — start with the smallest layout, then add complexity. This produces simpler CSS and better default mobile experiences.
3. **Breakpoints are ranges, not points** — "tablet" means 768px--1023px, not exactly 768px. Test across the full range.
4. **Fewer breakpoints is better** — most layouts need 3--4 breakpoints. If you have 8+, your layout is too rigid.
5. **Container queries complement breakpoints** — use breakpoints for page layout, container queries for component-level responsiveness.

## Concrete Rules

### Standard Breakpoints
| Name | Min-width | Target | Key Layout Changes |
|------|-----------|--------|-------------------|
| `sm` | 480px | Mobile landscape | Minor spacing adjustments |
| `sm`/`md` | 640px | Large mobile | Stack-to-side-by-side for small components |
| `md` | 768px | Tablet portrait | 2-column layouts, side navigation possible |
| `lg` | 1024px | Desktop | Full navigation, multi-column grids, sidebar |
| `xl` | 1280px | Large desktop | Max-width containers, wider gutters |
| `2xl` | 1536px | Ultra-wide | Optional; content max-width with centered layout |

### Tailwind Breakpoints (Default)
| Prefix | Min-width | CSS |
|--------|-----------|-----|
| `sm:` | 640px | `@media (min-width: 640px)` |
| `md:` | 768px | `@media (min-width: 768px)` |
| `lg:` | 1024px | `@media (min-width: 1024px)` |
| `xl:` | 1280px | `@media (min-width: 1280px)` |
| `2xl:` | 1536px | `@media (min-width: 1536px)` |

### What Changes at Each Breakpoint
| Concern | Mobile (<768px) | Tablet (768--1023px) | Desktop (1024px+) |
|---------|----------------|---------------------|-------------------|
| Columns | 1 column, stacked | 2 columns | 3--4 columns, grid |
| Navigation | Hamburger menu | Hamburger or tab bar | Full horizontal nav |
| Typography | Base scale | Slightly larger headings | Full type scale |
| Spacing | 16px gutters | 24px gutters | 32--48px gutters |
| Touch targets | 44px minimum | 44px minimum | 36px+ (mouse-friendly) |
| Images | Full-width, smaller files | Medium resolution | Full resolution |
| Sidebar | Hidden or drawer | Optional | Visible by default |

### Container Queries — When to Use
- **Use breakpoints for:** page-level layout (grid columns, navigation, sidebar)
- **Use container queries for:** component-level layout (card goes horizontal when its container is wide enough)
- Container queries make components truly reusable — they adapt to their parent, not the viewport

## CSS/Implementation Patterns

### Mobile-First Media Queries
```css
/* Base styles — mobile (no media query) */
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

/* Tablet */
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }
}
```

### Container Queries
```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* Card stacks vertically in narrow containers */
.card {
  display: flex;
  flex-direction: column;
}

/* Card goes horizontal when container is wide enough */
@container card (min-width: 400px) {
  .card {
    flex-direction: row;
    align-items: center;
  }
}
```

### Max-Width Content Container
```css
.container {
  width: 100%;
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: 16px;
}

@media (min-width: 768px) {
  .container { padding-inline: 24px; }
}

@media (min-width: 1024px) {
  .container { padding-inline: 32px; }
}
```

### Tailwind Responsive Patterns
```html
<!-- Stack on mobile, 2-col tablet, 3-col desktop -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
  <div>Card 1</div>
  <div>Card 2</div>
  <div>Card 3</div>
</div>

<!-- Navigation: hamburger on mobile, full on desktop -->
<nav class="hidden lg:flex gap-6">...</nav>
<button class="lg:hidden" aria-label="Menu">...</button>
```

## Common Mistakes

1. **Device-driven breakpoints** — "iPhone 14 is 390px so I'll use 390px" breaks when the next phone is 393px. Use content-driven breakpoints at round numbers.
2. **Desktop-first (max-width)** — `max-width` queries lead to overriding desktop styles for mobile, producing bloated CSS and missed edge cases.
3. **Too many breakpoints** — if you have breakpoints at 320, 375, 414, 480, 640, 768, 1024, 1200, 1440, your layout isn't flexible enough. Use fluid techniques and fewer breakpoints.
4. **Not testing between breakpoints** — if your breakpoints are 768px and 1024px, test at 800px, 900px, and 950px. Layouts often break mid-range.
5. **Forgetting landscape mobile** — a phone in landscape is ~700px wide but only ~350px tall. Navigation and modals need to work here.
6. **Fixed-width containers without max-width** — on a 2560px monitor, a full-width paragraph is unreadable. Always cap content width at 1280--1440px.

## Decision Tree

```
Setting up breakpoints:
├─ Start with mobile layout (no media query)
├─ Resize browser wider — where does the layout break?
│  ├─ Content looks cramped → Not a breakpoint, fix with fluid CSS
│  ├─ Layout genuinely needs restructuring → Add a breakpoint
│  └─ Only one component needs to change → Consider container query
├─ How many breakpoints do you have?
│  ├─ 0--1 → Probably need at least 2 (tablet + desktop)
│  ├─ 2--4 → Good range for most projects
│  └─ 5+ → Simplify layout or use more fluid techniques
└─ Component or page layout?
   ├─ Page layout (grid, nav, sidebar) → Viewport breakpoints
   └─ Component layout (card, widget) → Container queries
```

## Sources
- [Tailwind CSS — Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN — Using media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries)
- [MDN — CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
- [Material Design 3 — Applying layout](https://m3.material.io/foundations/layout/applying-layout/overview)
- Wroblewski, L. (2011). *Mobile First*
