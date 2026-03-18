# Grid Systems

> **TL;DR:** Use CSS Grid for 2D page layouts and Flexbox for 1D component layouts. Default to a 12-column grid on desktop (8 tablet, 4 mobile) with 16–24px gutters. Wrap content in a max-width container (1280px) centered with auto margins.

## Core Principles

1. **CSS Grid for layout, Flexbox for alignment** — Grid handles rows and columns simultaneously; Flexbox handles a single axis. Use Grid for page structure, Flexbox for navbars, button groups, and inline elements.
2. **Column count should match device capability** — 12 columns (desktop) give flexible subdivision (halves, thirds, quarters, sixths). 8 columns (tablet) allow halves and quarters. 4 columns (mobile) keep things simple.
3. **Gutters maintain rhythm** — consistent gaps between columns prevent content from feeling cramped or disconnected. 16px minimum, 24px is comfortable.
4. **Content should have a maximum width** — lines of text beyond ~75 characters become hard to read. A max-width container (1200–1440px) solves this.
5. **Let the grid do the math** — avoid manual pixel calculations. Use `fr` units, `auto-fit`, and `minmax()` to let the browser handle responsive behavior.

## Concrete Rules

### Column Structure by Breakpoint
| Breakpoint | Columns | Gutters | Margins (edge padding) |
|-----------|---------|---------|----------------------|
| Mobile (<640px) | 4 | 16px | 16px |
| Tablet (640–1024px) | 8 | 16–24px | 24px |
| Desktop (>1024px) | 12 | 24px | 24–48px |

### Common Column Spans
| Layout Pattern | Desktop (12-col) | Tablet (8-col) | Mobile (4-col) |
|---------------|-----------------|----------------|----------------|
| Full width | 12 | 8 | 4 |
| Main content | 8 | 5–6 | 4 |
| Sidebar | 3–4 | 2–3 | 4 (stacked) |
| Card in grid | 3–4 | 4 | 4 |
| Centered narrow | 6–8 (offset) | 6 (offset) | 4 |

### Container Max Widths
| Use Case | Max Width |
|----------|-----------|
| Default content container | 1280px |
| Narrow text/article | 720px |
| Wide dashboard/admin | 1440px |
| Full-bleed (hero, banner) | 100% (no max) |

### Grid vs Flexbox Decision
| Scenario | Use |
|----------|-----|
| Page-level layout (sidebar + main) | Grid |
| Card grid with wrapping | Grid (`auto-fit`) |
| Navigation bar | Flexbox |
| Button group / tag list | Flexbox |
| Form layout (label + input pairs) | Grid |
| Centering a single element | Flexbox |
| Complex overlapping areas | Grid (named areas) |
| Unknown number of equal items in a row | Flexbox (`flex-wrap`) or Grid (`auto-fit`) |

## CSS/Implementation Patterns

### Basic 12-Column Grid
```css
.container {
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: var(--space-4);           /* 16px edge padding */
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-6);                      /* 24px gutters */
}

/* Span helpers */
.col-4  { grid-column: span 4; }
.col-6  { grid-column: span 6; }
.col-8  { grid-column: span 8; }
.col-12 { grid-column: span 12; }
```

### Sidebar + Main Layout
```css
.layout-sidebar {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--space-6);
}

@media (max-width: 768px) {
  .layout-sidebar {
    grid-template-columns: 1fr;             /* Stack on mobile */
  }
}
```

### Holy Grail Layout (Named Areas)
```css
.layout-holy-grail {
  display: grid;
  grid-template-areas:
    "header  header  header"
    "nav     main    aside"
    "footer  footer  footer";
  grid-template-columns: 200px 1fr 200px;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
  gap: var(--space-6);
}

@media (max-width: 768px) {
  .layout-holy-grail {
    grid-template-areas:
      "header"
      "nav"
      "main"
      "aside"
      "footer";
    grid-template-columns: 1fr;
  }
}
```

### Responsive Card Grid (auto-fit)
```css
/* Cards automatically fill available space, minimum 280px each */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-6);
}
```

**`auto-fill` vs `auto-fit`:**
- `auto-fill` — creates empty tracks if space remains (preserves column sizing)
- `auto-fit` — collapses empty tracks so items stretch to fill (better for fewer items)
- Use `auto-fill` for card grids. Use `auto-fit` when you have 1–3 items that should expand.

### Responsive Columns (Tailwind)
```html
<!-- 1 col mobile, 2 col tablet, 3 col desktop -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <div>Card</div>
  <div>Card</div>
  <div>Card</div>
</div>

<!-- Sidebar layout -->
<div class="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
  <aside>Sidebar</aside>
  <main>Content</main>
</div>

<!-- Centered narrow container -->
<div class="max-w-3xl mx-auto px-4">
  <article>Readable text content</article>
</div>
```

## Common Mistakes

1. **Using Grid for everything** — a navigation bar with logo-left and links-right is simpler with `display: flex; justify-content: space-between`. Grid is overkill for single-axis layouts.
2. **Hardcoding pixel widths for all columns** — use `fr` units. `grid-template-columns: 200px 400px 200px` breaks on resize. Use `200px 1fr 200px` instead.
3. **Forgetting the max-width container** — without it, content stretches to full viewport width on ultrawide monitors, making text unreadable.
4. **Mixing margin-based spacing with gap** — if the grid has `gap: 24px`, don't also add margins to grid children. The spacing doubles.
5. **Too many breakpoint overrides** — `auto-fill` with `minmax()` handles responsiveness without media queries in most card/grid scenarios. Reach for media queries only for layout structure changes (sidebar stacking).
6. **Nested grids with conflicting gutters** — if the outer grid has 24px gaps and the inner grid has 16px gaps, the rhythm breaks. Keep gutter sizes consistent or intentionally stepped (24px outer, 16px inner for related items).

## Decision Tree

```
What grid approach should I use?
├─ Page-level structure (header/sidebar/main/footer)?
│  └─ CSS Grid with named areas
├─ Card grid with unknown item count?
│  └─ CSS Grid with auto-fill + minmax(280px, 1fr)
├─ Sidebar + main content?
│  └─ CSS Grid: grid-template-columns: 280px 1fr
├─ Navigation bar or toolbar?
│  └─ Flexbox with justify-content
├─ Centering a single element?
│  └─ Flexbox (or Grid) with place-items: center
├─ Equal-width columns (2, 3, or 4)?
│  └─ CSS Grid: repeat(N, 1fr)
├─ Form with labels and inputs?
│  └─ CSS Grid: grid-template-columns: auto 1fr
└─ Not sure?
   └─ Start with Flexbox. Switch to Grid when you need column alignment across rows.
```

## Sources
- [CSS Grid Layout — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)
- [A Complete Guide to CSS Grid — CSS-Tricks](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Material Design 3 — Layout Grid](https://m3.material.io/foundations/layout/understanding-layout/overview)
- [Every Layout — The Sidebar](https://every-layout.dev/layouts/sidebar/)
- [Tailwind CSS — Grid Template Columns](https://tailwindcss.com/docs/grid-template-columns)
- Related: [Spacing System](spacing-system.md), [Whitespace](whitespace.md), [Visual Hierarchy](visual-hierarchy.md)
