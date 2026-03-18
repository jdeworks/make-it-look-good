# Gestalt Principles

> **TL;DR:** Humans automatically group visual elements based on proximity, similarity, closure, continuity, and figure-ground relationships. Use these principles deliberately to create clear visual structure without relying on borders and lines.

## Core Principles

1. **Proximity** — elements close together are perceived as a group. This is the most powerful and most used Gestalt principle in UI design.
2. **Similarity** — elements that look alike (color, shape, size) are perceived as related.
3. **Closure** — the brain completes incomplete shapes. You don't need full borders to define regions.
4. **Continuity** — elements arranged on a line or curve are perceived as related. The eye follows the path.
5. **Figure-Ground** — the brain separates foreground (figure) from background (ground). Only one interpretation is active at a time.
6. **Common Region** — elements within a shared boundary (card, box, background color) are perceived as grouped.
7. **Common Fate** — elements that move in the same direction are perceived as related.

## Concrete Rules

### Proximity — Spacing Ratios
The key rule: **space within a group should be noticeably less than space between groups**.

| Relationship | Spacing Guideline |
|-------------|-------------------|
| Within a group | 1× base unit (e.g., 8px) |
| Between groups | 2–3× base unit (e.g., 16–24px) |
| Between sections | 4–6× base unit (e.g., 32–48px) |
| Between major page areas | 8×+ base unit (e.g., 64px+) |

**Minimum ratio:** inter-group spacing should be **at least 2× intra-group spacing** for the grouping to be perceived.

### Similarity — What Creates "Same"
| Property | Grouping Strength | Use For |
|----------|------------------|---------|
| Color | Very strong | Status (red=error, green=success), categories |
| Shape | Strong | Distinguishing element types (circle=avatar, square=icon) |
| Size | Moderate | Hierarchy (larger=more important) |
| Orientation | Moderate | Grouping in data visualization |
| Texture/pattern | Weak-moderate | Background differentiation |

### Figure-Ground — Elevation & Depth
| Technique | Creates Foreground | Use Case |
|-----------|-------------------|----------|
| Drop shadow | Element with shadow | Cards, modals, dropdowns |
| Higher contrast | Higher contrast element | Text on background |
| Larger size | Larger element | Hero sections, CTAs |
| Overlap | Overlapping element | Modals, popovers |
| Background dimming | Non-dimmed content | Modal focus |

## CSS/Implementation Patterns

### Proximity — Group with Spacing
```css
/* Form field groups — tight within, loose between */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;               /* Within group: 1× */
  margin-bottom: 24px;    /* Between groups: 3× */
}

.form-section-title {
  margin-bottom: 4px;     /* Tight to its content */
  margin-top: 0;
}

/* Card content — elements within are grouped by proximity */
.card-body {
  padding: 16px;
}

.card-body > * + * {
  margin-top: 8px;        /* 1× within the card */
}

.card + .card {
  margin-top: 16px;       /* 2× between cards */
}
```

### Similarity — Consistent Styling for Related Items
```css
/* Status badges — same shape, different colors */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;  /* Pill shape — all badges share this */
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-success { background: #dcfce7; color: #166534; }
.badge-warning { background: #fef3c7; color: #92400e; }
.badge-error   { background: #fee2e2; color: #991b1b; }
.badge-info    { background: #dbeafe; color: #1e40af; }
```

### Common Region — Cards and Containers
```css
/* Common region through background + padding */
.card {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 16px;
  /* Use EITHER border OR shadow, not both */
  border: 1px solid var(--color-border);
}

/* Or with elevation */
.card-elevated {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
}
```

### Figure-Ground — Modal Overlay
```css
/* Dim background to push modal to foreground */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);  /* Dims the ground */
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); /* Lifts above */
}
```

## Common Mistakes

1. **Equal spacing everywhere** — if everything is 16px apart, there are no groups. Vary spacing deliberately.
2. **Using borders instead of spacing** — proximity is more powerful and cleaner than adding box borders around everything. Try spacing first.
3. **Breaking similarity accidentally** — one button that's slightly different in color or size will look intentionally different, even if it's the same type.
4. **Ignoring proximity in forms** — a label must be closer to its input than to the previous input. Common violation: equal spacing between label-input-label-input.
5. **Too many visual regions** — excessive cards/borders/backgrounds fragment the page. Use proximity and whitespace before reaching for containers.

### Label Proximity Anti-Pattern
```
❌ Bad — ambiguous which input the label belongs to:
  Label A
  [Input A]
                    ← same spacing
  Label B
  [Input B]

✓ Good — label clearly belongs to its input:
  Label A
  [Input A]         ← 4px below label
                    ← 16px gap before next field
  Label B
  [Input B]
```

## Decision Tree

```
How should I visually group these elements?
├─ They're related and adjacent
│  └─ Use PROXIMITY — reduce space between them
├─ They're the same type but scattered across the page
│  └─ Use SIMILARITY — same color, shape, or size
├─ They need a clear boundary
│  ├─ Try spacing/whitespace first (proximity)
│  ├─ If not enough → add background color (common region)
│  └─ Last resort → add border (common region)
├─ One element needs to stand out from the page
│  └─ Use FIGURE-GROUND — shadow, size, contrast, or overlay dimming
└─ Elements need to feel connected in a flow
   └─ Use CONTINUITY — align on a line or curve
```

## Sources
- Wertheimer, M. (1923). Laws of organization in perceptual forms. *Psychologische Forschung, 4*, 301-350.
- [Nielsen Norman Group — Gestalt Principles](https://www.nngroup.com/articles/gestalt-proximity/)
- [Laws of UX — Law of Proximity](https://lawsofux.com/law-of-proximity/)
- [Interaction Design Foundation — Gestalt Principles](https://www.interaction-design.org/literature/topics/gestalt-principles)
