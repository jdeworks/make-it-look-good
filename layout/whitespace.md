# Whitespace

> **TL;DR:** Whitespace is not wasted space — it improves comprehension by ~20% (Lin 2004). Use generous padding and margins. Group related items with less space; separate unrelated items with more. When in doubt, add more whitespace, not less.

## Core Principles

1. **Whitespace improves comprehension** — research by Lin (2004) found that margins and spacing around text improved reading comprehension by approximately 20%. Users don't notice whitespace, but they feel its absence.
2. **Proximity signals relationships** (Gestalt Law of Proximity) — elements placed close together are perceived as related. Elements with more space between them are perceived as separate groups. This is the most powerful grouping tool available.
3. **Macro vs micro whitespace** — macro whitespace is the space between major sections, around page edges, and between content blocks. Micro whitespace is the space within components: line-height, letter-spacing, padding inside buttons. Both matter.
4. **Whitespace creates visual hierarchy** — generous whitespace around an element gives it importance and draws attention. Luxury brands use extreme whitespace; data-dense tools use minimal whitespace. Both are valid for their context.
5. **Content density is a design choice, not a constraint** — dashboards and data tables need tighter spacing; marketing pages and articles need generous spacing. Match the density to the task.

## Concrete Rules

### Macro Whitespace (Between Sections)
| Location | Minimum | Comfortable | Generous |
|----------|---------|-------------|----------|
| Between major page sections | 32px | 48–64px | 80–96px |
| Between content blocks within a section | 16px | 24–32px | 40–48px |
| Page edge margins (mobile) | 16px | 16–20px | 24px |
| Page edge margins (desktop) | 24px | 32–48px | 64px |
| Above a section heading | 32–48px | 48–64px | 80px |
| Below a section heading | 12–16px | 16–24px | 24–32px |

**Key ratio:** space above a heading should be ~1.5–2x the space below it. This visually attaches the heading to its content rather than to the section above.

### Micro Whitespace (Within Components)
| Element | Spacing Rule |
|---------|-------------|
| Line-height for body text | 1.5–1.6 (150–160% of font size) |
| Line-height for headings | 1.1–1.3 (tighter, since letters are larger) |
| Paragraph spacing | 0.75–1em (roughly one blank line) |
| Padding inside buttons | 8–12px vertical, 16–24px horizontal |
| Padding inside cards | 16–24px |
| Padding inside input fields | 8–12px vertical, 12–16px horizontal |
| Space between icon and label | 4–8px |
| Space between form label and input | 4–8px |
| Space between form fields | 16–24px |

### Proximity Rules (Grouping)
| Relationship | Spacing |
|-------------|---------|
| Items in the same group | 8–12px |
| Between groups | 24–32px |
| Between sections | 48–64px |
| Ratio: within-group vs between-group | At least 1:2 (e.g., 8px within, 24px between) |

The ratio matters more than the absolute values. If items within a group are spaced at 16px, the space between groups must be at least 32px, or users won't perceive the groups as distinct.

### Content Density Spectrum
| Context | Density | Approach |
|---------|---------|----------|
| Data tables / dashboards | High | 8px cell padding, 4px gaps, compact line-height (1.3) |
| Admin panels / tools | Medium | 12–16px padding, 8–12px gaps, standard line-height (1.5) |
| Content sites / blogs | Low | 24px+ padding, 16–24px gaps, generous line-height (1.6) |
| Marketing / landing pages | Very low | 48px+ padding, large section gaps (64–96px), ample breathing room |

## CSS/Implementation Patterns

### Section Spacing
```css
/* Consistent vertical rhythm between sections */
.section {
  padding-block: var(--space-16);           /* 64px top and bottom */
}

.section + .section {
  border-top: 1px solid var(--color-border);
}

/* Tighter on mobile */
@media (max-width: 768px) {
  .section {
    padding-block: var(--space-8);          /* 32px on mobile */
  }
}
```

### Heading Spacing (Asymmetric)
```css
/* More space above headings, less below — attaches heading to its content */
h2 {
  margin-top: var(--space-12);              /* 48px above */
  margin-bottom: var(--space-4);            /* 16px below */
}

h3 {
  margin-top: var(--space-8);              /* 32px above */
  margin-bottom: var(--space-3);            /* 12px below */
}
```

### Readable Text Block
```css
.prose {
  max-width: 65ch;                          /* ~65 characters per line */
  line-height: 1.6;
  letter-spacing: 0.01em;
}

.prose p + p {
  margin-top: 1em;                          /* One line of space between paragraphs */
}

.prose > * + * {
  margin-top: var(--space-4);               /* Default flow spacing */
}
```

### Content Density Variants
```css
/* Compact — data tables, dashboards */
.density-compact {
  --density-padding: var(--space-2);        /* 8px */
  --density-gap: var(--space-1);            /* 4px */
  line-height: 1.3;
}

/* Default — most UI */
.density-default {
  --density-padding: var(--space-4);        /* 16px */
  --density-gap: var(--space-3);            /* 12px */
  line-height: 1.5;
}

/* Comfortable — content, marketing */
.density-comfortable {
  --density-padding: var(--space-6);        /* 24px */
  --density-gap: var(--space-4);            /* 16px */
  line-height: 1.6;
}
```

### Tailwind Patterns
```html
<!-- Generous section spacing -->
<section class="py-16 md:py-24 px-4 md:px-8">
  <div class="max-w-5xl mx-auto space-y-8">
    <h2 class="text-3xl font-bold">Section Title</h2>
    <p class="text-lg leading-relaxed max-w-prose">Content here.</p>
  </div>
</section>

<!-- Proximity grouping -->
<div class="space-y-8">              <!-- 32px between groups -->
  <div class="space-y-2">            <!-- 8px within group -->
    <h3>Group A Heading</h3>
    <p>Group A content</p>
  </div>
  <div class="space-y-2">
    <h3>Group B Heading</h3>
    <p>Group B content</p>
  </div>
</div>
```

## Common Mistakes

1. **Filling every pixel** — stakeholders say "there's too much empty space." Resist the urge to fill it. Whitespace is functional, not wasted. Show them the comprehension research.
2. **Equal spacing everywhere** — if a heading has 24px above and 24px below, it floats between sections instead of belonging to the content below it. Use asymmetric spacing (more above, less below).
3. **Same gap for related and unrelated items** — if list items within a group have 16px gaps and sections also have 16px gaps, the visual grouping is destroyed. Maintain at least a 1:2 ratio.
4. **Tight padding on mobile** — small screens need proportionally more breathing room, not less. Don't reduce padding below 16px on mobile edges.
5. **Ignoring line-height** — body text at `line-height: 1.0` or `1.2` is noticeably harder to read. Default to 1.5 for body text.
6. **Data-dense styling on content pages** — a blog post styled like a spreadsheet is exhausting. Match density to the content type.
7. **Reducing whitespace to "fit more above the fold"** — the fold is largely a myth for engagement. Users scroll. Cramming content above 600px hurts more than it helps.

## Decision Tree

```
How much whitespace do I need?
├─ Between items in the same group?
│  └─ 8–12px (tight, shows relationship)
├─ Between groups of items?
│  └─ 24–32px (clear separation)
├─ Between major sections?
│  └─ 48–96px (depending on density)
├─ Above a heading?
│  └─ 1.5–2× the space below it
├─ Inside a card or container?
│  └─ 16–24px padding
├─ Around body text?
│  └─ line-height 1.5–1.6, max-width 65ch, paragraph spacing 1em
├─ Dashboard or data-dense UI?
│  └─ Reduce all spacing by ~50%, line-height 1.3
├─ Marketing or landing page?
│  └─ Increase all spacing by ~50%, generous section padding
└─ Someone says "too much whitespace"?
   └─ Show them the page with reduced spacing. They'll usually prefer the original.
```

## Sources
- Lin, D.Y.M. (2004). "Evaluating older adults' retention in hypertext perusal: Impacts of presentation media as a function of text topology." — found ~20% comprehension improvement with proper whitespace
- [Gestalt Principles — Law of Proximity](https://www.interaction-design.org/literature/topics/gestalt-principles)
- [Material Design 3 — Layout Spacing](https://m3.material.io/foundations/layout/understanding-layout/spacing)
- [Butterick's Practical Typography — Space](https://practicaltypography.com/space-above-and-below.html)
- Related: [Spacing System](spacing-system.md), [Grid Systems](grid-systems.md), [Visual Hierarchy](visual-hierarchy.md)
