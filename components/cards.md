# Cards

> **TL;DR:** Cards group related content behind a clear boundary with consistent internal hierarchy: image, eyebrow/category, title, description, actions. Use 16–24px padding from your spacing scale, one primary action per card, and `border-radius: 8–12px`. Use elevation *or* a border for the container — never both.

## Core Principles

1. **Cards are content containers, not decoration** — every card must group genuinely related content. If items don't belong together, don't force a card around them.
2. **One primary action per card** — multiple competing CTAs inside a card destroy hierarchy. One clear next step.
3. **Consistent anatomy** — all cards in a set should share the same structure (media → header → body → footer). Missing sections are fine; reordered sections are not.
4. **Cards imply a collection** — a lone card looks odd. Cards work best as part of a grid or list of peers.
5. **Content-first sizing** — card width is determined by the grid; card height is determined by content. Never force fixed heights that truncate text.

## Concrete Rules

### Card Anatomy (Top to Bottom)
| Section | Contains | Required? |
|---------|----------|-----------|
| **Media** | Image, video, illustration | No |
| **Header** | Eyebrow/category, title, subtitle | Title is required |
| **Body** | Description text, secondary info | No |
| **Footer/Actions** | Buttons, links, metadata | No |

### Spacing & Sizing
| Property | Value | Notes |
|----------|-------|-------|
| Inner padding | 16–24px (use `--space-4` to `--space-6`) | Consistent on all sides |
| Gap between card sections | 8–12px | Tighter than outer padding |
| Border-radius | 8–12px | Match your system's radius scale |
| Media border-radius | Match card radius or 0 (flush) | Don't mix both in the same set |
| Elevation (shadow) | `0 1px 3px rgba(0,0,0,0.12)` (rest) | Subtle — cards aren't floating platforms |
| Min card width | 280px | Below this, content gets cramped |
| Max card width | 400–480px | Beyond this, cards lose their "card" feel |

### Media Aspect Ratios
| Use Case | Ratio | Notes |
|----------|-------|-------|
| Landscape photo | 16:9 | Default for most card media |
| Square thumbnail | 1:1 | Profile cards, product tiles |
| Portrait / tall | 3:4 | Editorial, Pinterest-style |
| Wide cinematic | 2:1 | Blog heroes, featured cards |

### Card Grids
| Viewport | Columns | Gap |
|----------|---------|-----|
| < 640px | 1 | 16px |
| 640–1024px | 2 | 16–24px |
| 1024–1440px | 3 | 24px |
| > 1440px | 3–4 (max) | 24–32px |

### Hover & Focus States
| State | Treatment |
|-------|-----------|
| Hover | Lift shadow (`translateY(-2px)` + deeper shadow) or subtle background shift |
| Focus | Visible 2px outline offset by 2px (never remove — a11y) |
| Active/pressed | Reduce lift, darken slightly |
| Transition | `150–200ms ease` — fast enough to feel responsive |

## CSS/Implementation Patterns

### Base Card
```css
.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 200ms ease, transform 200ms ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.card-media { aspect-ratio: 16 / 9; object-fit: cover; width: 100%; }
.card-body  { padding: var(--space-5, 20px); flex: 1; display: flex; flex-direction: column; }
.card-footer { padding: var(--space-4, 16px) var(--space-5, 20px); border-top: 1px solid var(--color-border); }
```

### Clickable Card (Entire Surface)
```css
/* Wrap content in <article>, put <a> on the title, then stretch it */
.card-link-overlay {
  position: relative;
}

.card-link-overlay a.card-title-link::after {
  content: "";
  position: absolute;
  inset: 0;
}

/* Keep secondary links/buttons above the overlay */
.card-link-overlay .card-footer { position: relative; z-index: 1; }
```
```html
<!-- Accessible clickable card -->
<article class="card card-link-overlay">
  <img class="card-media" src="..." alt="Descriptive alt text" />
  <div class="card-body">
    <span class="card-eyebrow">Category</span>
    <h3><a class="card-title-link" href="/article">Article Title</a></h3>
    <p class="card-description">Brief description here.</p>
  </div>
</article>
```

### Responsive Card Grid
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: var(--space-6, 24px);
}
```

### Horizontal Card (Side-by-Side)
```css
@media (min-width: 640px) {
  .card-horizontal {
    flex-direction: row;
  }
  .card-horizontal .card-media {
    width: 40%;
    min-width: 200px;
    aspect-ratio: auto;
    height: 100%;
  }
}
```

### Skeleton Loading State
```css
.card-skeleton .skel {
  background: linear-gradient(90deg, var(--color-muted) 25%, var(--color-muted-light) 50%, var(--color-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm, 4px);
}

.card-skeleton .skel-media  { aspect-ratio: 16 / 9; }
.card-skeleton .skel-title  { height: 1.25rem; width: 70%; }
.card-skeleton .skel-text   { height: 0.875rem; width: 100%; margin-top: 0.5rem; }
.card-skeleton .skel-text:last-child { width: 60%; }

@keyframes shimmer { to { background-position: -200% 0; } }
```

### Tailwind Patterns
```html
<!-- Vertical card -->
<article class="group rounded-xl shadow-sm hover:shadow-md transition overflow-hidden bg-white">
  <img class="aspect-video w-full object-cover" src="..." alt="..." />
  <div class="p-5 flex flex-col gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-indigo-600">Category</span>
    <h3 class="text-lg font-bold text-gray-900">Card Title</h3>
    <p class="text-sm text-gray-600 line-clamp-3">Description text goes here.</p>
  </div>
</article>

<!-- Responsive grid -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- cards -->
</div>
```

## Common Mistakes

1. **Inconsistent internal padding** — 24px top, 16px sides, 12px bottom. Pick one value and use it on all sides.
2. **No content hierarchy** — title, description, and metadata are all the same size and color. Use at least 3 visual levels (see [visual hierarchy](../layout/visual-hierarchy.md)).
3. **Too many actions** — "Read more", "Save", "Share", "Like" all crammed into the footer. Limit to 1 primary + 1 secondary max.
4. **Fixed card heights** — causes text truncation or awkward whitespace. Let content determine height; use `line-clamp` for description overflow if needed.
5. **Clickable card with nested interactive elements** — entire card is an `<a>` wrapping buttons/links. This creates invalid HTML and confuses screen readers. Use the overlay pattern instead.
6. **Massive drop shadows** — `box-shadow: 0 10px 40px rgba(0,0,0,0.3)` makes cards look like they're floating off the page. Keep shadows subtle.
7. **Missing alt text on card media** — decorative images get `alt=""`, meaningful images get descriptive alt text. Never omit the `alt` attribute entirely.
8. **Border AND shadow** — pick one container delineation method. Both together is visual clutter.
9. **No hover/focus state** — if the card is interactive, users need visual feedback. A clickable card with no hover state feels broken.
10. **Images stretching or squishing** — always use `object-fit: cover` with a defined `aspect-ratio`.

## Accessibility

- **Heading levels** — card titles should use the correct heading level for page context (usually `<h3>` inside a section with an `<h2>`). Never skip levels.
- **Link text** — avoid "Read more" for every card. Use the card title as link text, or use `aria-label` / `aria-labelledby` on the link.
- **Focus order** — when using the clickable overlay pattern, ensure Tab order is logical (title link first, then any footer actions).
- **Reduced motion** — wrap hover transforms and skeleton animations in `@media (prefers-reduced-motion: no-preference)`.
- **Color contrast** — eyebrow/category text and metadata must still meet 4.5:1 against the card background.

## Decision Tree

```
Designing a card component?
├─ Does content have an image?
│  ├─ Yes → Use 16:9 aspect-ratio (landscape default), object-fit: cover
│  └─ No  → Start with header section (eyebrow + title)
├─ Is the card clickable?
│  ├─ Entire card is one link → Use overlay pattern (stretched <a> on title)
│  ├─ Multiple actions → Use distinct buttons in footer, card is NOT a link
│  └─ Not interactive → No hover lift, no cursor:pointer
├─ Horizontal or vertical?
│  ├─ Content-heavy / featured → Horizontal (image left, content right)
│  └─ Browsing / grid → Vertical (image top, content below)
├─ How many per row?
│  ├─ Mobile → 1 column always
│  ├─ Tablet → 2 columns
│  └─ Desktop → 3 columns (4 max on wide screens)
├─ Loading state needed?
│  ├─ Yes → Skeleton placeholder matching card anatomy
│  └─ No  → Fine for static content
└─ Container style?
   ├─ On white background → Use subtle shadow (no border)
   ├─ On colored/gray background → Border or shadow, not both
   └─ On image background → Use shadow for contrast
```

## Sources
- [Material Design 3 — Cards](https://m3.material.io/components/cards/overview) — anatomy, types, states
- [Nielsen Norman Group — Cards](https://www.nngroup.com/articles/cards-component/) — usability research
- [Inclusive Components — Cards](https://inclusive-components.design/cards/) — accessible clickable card patterns
- [Adrian Roselli — Block Links](https://adrianroselli.com/2020/02/block-links-cards-clickable-regions-etc.html) — a11y pitfalls of clickable cards
- [Refactoring UI](https://www.refactoringui.com/) — card styling and shadow techniques

## Related Snippets
- [`data-card-grid.html`](../snippets/data-card-grid.html) — Responsive product/content card grid
- [`content-pricing-cards.html`](../snippets/content-pricing-cards.html) — 3-tier pricing cards
- [`content-testimonials.html`](../snippets/content-testimonials.html) — Testimonial cards row
- [`content-stats-row.html`](../snippets/content-stats-row.html) — Stat cards with trend indicators
