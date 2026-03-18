# Spacing System

> **TL;DR:** Use a base unit of 4px (compact) or 8px (comfortable). Build a spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px. Apply consistently using CSS custom properties. Never use arbitrary values like 13px or 17px.

## Core Principles

1. **Consistent spacing creates visual rhythm** — irregular spacing feels chaotic even if users can't articulate why
2. **A base unit creates mathematical harmony** — all spacing values should be multiples of 4px (or 8px)
3. **Fewer spacing values is better** — 8–12 values in your scale is enough. If you need a value not in the scale, your scale is wrong or your design is.
4. **Spacing communicates relationships** — tighter spacing = related items; looser spacing = separate items (Gestalt proximity)
5. **The 4px grid** is the industry standard — Material Design, Apple, most major design systems use 4px increments

## Concrete Rules

### The Spacing Scale
| Token | Value | Multiple | Common Use |
|-------|-------|----------|------------|
| space-0.5 | 2px | 0.5× | Hairline gaps, borders |
| space-1 | 4px | 1× | Icon-to-label gaps, tight padding |
| space-2 | 8px | 2× | Related item spacing, compact padding |
| space-3 | 12px | 3× | Default gap within groups |
| space-4 | 16px | 4× | Standard padding, form field gaps |
| space-6 | 24px | 6× | Section padding, card padding |
| space-8 | 32px | 8× | Between content sections |
| space-10 | 40px | 10× | Major section breaks |
| space-12 | 48px | 12× | Page section spacing |
| space-16 | 64px | 16× | Major page divisions |
| space-24 | 96px | 24× | Hero/section vertical spacing |

### Where to Apply Each Size
| Space | Use Cases |
|-------|-----------|
| 4px | Gap between icon and label, badge padding, tight inline elements |
| 8px | Gap between list items, between tags, between related buttons |
| 12px | Default gap in flex/grid layouts, compact card padding |
| 16px | Standard component padding, mobile edge margins, form field gaps |
| 24px | Card inner padding, section padding (desktop), header height contributions |
| 32px | Between content sections, card outer margins |
| 48px | Between major page sections |
| 64px | Page top/bottom padding, large section divisions |
| 96px | Hero section vertical padding |

### Spacing Relationships
| Relationship | Spacing Rule |
|-------------|-------------|
| Within a component (tight) | 1–2× base (4–8px) |
| Between elements in a group | 2–3× base (8–12px) |
| Standard component padding | 3–4× base (12–16px) |
| Between groups | 4–6× base (16–24px) |
| Between sections | 8–12× base (32–48px) |
| Between major page areas | 12–24× base (48–96px) |

## CSS/Implementation Patterns

### CSS Custom Properties
```css
:root {
  --space-0: 0px;
  --space-0-5: 2px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
}
```

### Component Padding Pattern
```css
/* Cards — generous padding, consistent on all sides */
.card {
  padding: var(--space-6);           /* 24px all sides */
}

/* Buttons — asymmetric padding (more horizontal) */
.btn {
  padding: var(--space-2) var(--space-4);  /* 8px 16px */
}

.btn-lg {
  padding: var(--space-3) var(--space-6);  /* 12px 24px */
}

/* Input fields */
.input {
  padding: var(--space-2) var(--space-3);  /* 8px 12px */
}
```

### Layout Spacing with Gap
```css
/* Vertical stack of content sections */
.page-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);               /* 48px between sections */
}

/* Card grid */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-6);                /* 24px between cards */
}

/* Form fields */
.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);                /* 16px between fields */
}

/* Inline elements (tags, buttons) */
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);                /* 8px between tags */
}
```

### Responsive Spacing
```css
/* Tighter spacing on mobile, looser on desktop */
.section {
  padding: var(--space-8) var(--space-4);    /* 32px 16px on mobile */
}

@media (min-width: 768px) {
  .section {
    padding: var(--space-12) var(--space-8); /* 48px 32px on tablet */
  }
}

@media (min-width: 1024px) {
  .section {
    padding: var(--space-16) var(--space-12); /* 64px 48px on desktop */
  }
}

/* Or use clamp for fluid spacing */
.section-fluid {
  padding-block: clamp(var(--space-8), 5vw, var(--space-16));
  padding-inline: clamp(var(--space-4), 3vw, var(--space-12));
}
```

### Margin Utilities
```css
/* Compose spacing with utility classes if needed */
.mt-0 { margin-top: var(--space-0); }
.mt-1 { margin-top: var(--space-1); }
.mt-2 { margin-top: var(--space-2); }
.mt-3 { margin-top: var(--space-3); }
.mt-4 { margin-top: var(--space-4); }
.mt-6 { margin-top: var(--space-6); }
.mt-8 { margin-top: var(--space-8); }
/* etc. — same pattern for mb, ml, mr, mx, my, p variants */
```

## Common Mistakes

1. **Arbitrary spacing values** — `margin: 13px 17px 11px 22px` has no relationship between values. Use the scale.
2. **Different spacing for same relationship** — if card A has 16px padding and card B has 20px padding, it looks broken even though both "look fine" in isolation.
3. **Too tight on mobile** — 8px horizontal page margins make content feel cramped. Minimum 16px on mobile edges.
4. **No spacing scale at all** — picking values by "what looks right" leads to dozens of unique values. This makes the UI feel subtly chaotic.
5. **Using margin instead of gap** — `gap` on flex/grid containers is more predictable than margins (no collapsing, no `:last-child` overrides).
6. **Spacing that doesn't reflect relationships** — if a label and its input have the same gap as two unrelated sections, the proximity principle fails. Tighter = related, looser = separate.

## Decision Tree

```
What spacing value should I use?
├─ Between icon and its label → 4px
├─ Between related buttons/tags → 8px
├─ Between form field and its label → 4–8px
├─ Between form fields → 16px
├─ Padding inside a card → 16–24px
├─ Padding inside a button → 8px 16px (vertical horizontal)
├─ Between cards in a grid → 16–24px
├─ Between content sections → 32–48px
├─ Between major page areas → 48–96px
├─ Page edge margins (mobile) → 16px minimum
├─ Page edge margins (desktop) → 24–48px (or centered max-width)
└─ Not sure → Start with 16px, adjust up/down by one scale step
```

## Sources
- [Material Design 3 — Layout](https://m3.material.io/foundations/layout/understanding-layout/spacing)
- [Every Layout — The Stack](https://every-layout.dev/layouts/stack/)
- [Tailwind CSS — Spacing](https://tailwindcss.com/docs/customizing-spacing) — widely adopted 4px-based scale
- Nathan Curtis — [Space in Design Systems](https://medium.com/eightshapes-llc/space-in-design-systems-188bcbae0d62)
