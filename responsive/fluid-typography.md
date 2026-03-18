# Fluid Typography

> **TL;DR:** Use CSS `clamp()` to scale type smoothly between breakpoints: `font-size: clamp(1rem, 0.5rem + 1.5vw, 1.5rem)`. This eliminates jarring size jumps, reduces media query complexity, and respects user font-size preferences when built on `rem`.

## Core Principles

1. **Fluid type scales smoothly between a minimum and maximum size** — no jumps, no media queries needed
2. **`clamp()` is the modern standard** — `clamp(min, preferred, max)` handles the math in one line
3. **Use `rem` for min/max, `vw` for the fluid middle** — this respects user font-size preferences while scaling with the viewport
4. **Fluid spacing should match fluid type** — if your headings scale fluidly, your margins and padding should too
5. **Accessibility comes first** — fluid type must still zoom properly (200% browser zoom) and respect user-set base font sizes

## Concrete Rules

### The clamp() Formula
```
font-size: clamp(MIN, PREFERRED, MAX);
```
- **MIN** — smallest the text should ever be (in `rem`)
- **PREFERRED** — a `rem + vw` expression that scales with viewport
- **MAX** — largest the text should ever be (in `rem`)

### Calculating the Preferred Value
The preferred value follows this formula:
```
preferred = base-rem + slope-vw

Where:
  slope = (max-size - min-size) / (max-viewport - min-viewport)
  base  = min-size - (slope × min-viewport)
```

For practical use, target scaling between **320px** (mobile) and **1280px** (desktop) viewports.

### Fluid Type Scale
| Step | clamp() Value | ~320px | ~768px | ~1280px |
|------|--------------|--------|--------|---------|
| sm | `clamp(0.833rem, 0.8rem + 0.15vw, 0.875rem)` | 13.3px | 14px | 14px |
| base | `clamp(1rem, 0.9rem + 0.5vw, 1.25rem)` | 16px | 18px | 20px |
| md | `clamp(1.2rem, 1rem + 1vw, 1.5rem)` | 19.2px | 22.7px | 24px |
| lg | `clamp(1.44rem, 1.1rem + 1.7vw, 2rem)` | 23px | 30.7px | 32px |
| xl | `clamp(1.728rem, 1.2rem + 2.6vw, 2.5rem)` | 27.6px | 39.2px | 40px |
| 2xl | `clamp(2.074rem, 1.3rem + 3.5vw, 3.5rem)` | 33.2px | 47.6px | 56px |
| 3xl | `clamp(2.488rem, 1.5rem + 4.5vw, 4.5rem)` | 39.8px | 58.6px | 72px |

### Fluid Spacing Scale
Apply the same `clamp()` approach to spacing for visual consistency:
| Token | clamp() Value | Use |
|-------|--------------|-----|
| `--space-xs` | `clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem)` | Inline gaps |
| `--space-sm` | `clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem)` | Component padding |
| `--space-md` | `clamp(1rem, 0.8rem + 1vw, 1.5rem)` | Section gaps |
| `--space-lg` | `clamp(1.5rem, 1rem + 2.5vw, 3rem)` | Section margins |
| `--space-xl` | `clamp(2rem, 1rem + 4vw, 5rem)` | Hero/page padding |

### Accessibility Constraints
- **Minimum body text: 1rem (16px)** — never let `clamp()` go below this for body copy
- **Must zoom to 200%** — `clamp()` with `rem` units passes this test; pure `vw` units fail it
- **Never use `vw` alone for font-size** — `font-size: 3vw` ignores user preferences and doesn't scale with zoom
- **Always include a `rem` component** — `0.5rem + 1.5vw` respects user base font size; `1.5vw` alone does not

## CSS/Implementation Patterns

### Full Fluid Type Scale
```css
:root {
  --font-size-sm: clamp(0.833rem, 0.8rem + 0.15vw, 0.875rem);
  --font-size-base: clamp(1rem, 0.9rem + 0.5vw, 1.25rem);
  --font-size-md: clamp(1.2rem, 1rem + 1vw, 1.5rem);
  --font-size-lg: clamp(1.44rem, 1.1rem + 1.7vw, 2rem);
  --font-size-xl: clamp(1.728rem, 1.2rem + 2.6vw, 2.5rem);
  --font-size-2xl: clamp(2.074rem, 1.3rem + 3.5vw, 3.5rem);
  --font-size-3xl: clamp(2.488rem, 1.5rem + 4.5vw, 4.5rem);
}

body { font-size: var(--font-size-base); }
h1   { font-size: var(--font-size-3xl); }
h2   { font-size: var(--font-size-2xl); }
h3   { font-size: var(--font-size-xl); }
h4   { font-size: var(--font-size-lg); }
```

### Fluid Spacing System
```css
:root {
  --space-xs: clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem);
  --space-sm: clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem);
  --space-md: clamp(1rem, 0.8rem + 1vw, 1.5rem);
  --space-lg: clamp(1.5rem, 1rem + 2.5vw, 3rem);
  --space-xl: clamp(2rem, 1rem + 4vw, 5rem);
}

.section {
  padding-block: var(--space-lg);
  padding-inline: var(--space-md);
}

.stack > * + * {
  margin-block-start: var(--space-md);
}
```

### Tailwind Fluid Utilities
```js
// tailwind.config.js
module.exports = {
  theme: {
    fontSize: {
      sm: 'clamp(0.833rem, 0.8rem + 0.15vw, 0.875rem)',
      base: 'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)',
      md: 'clamp(1.2rem, 1rem + 1vw, 1.5rem)',
      lg: 'clamp(1.44rem, 1.1rem + 1.7vw, 2rem)',
      xl: 'clamp(1.728rem, 1.2rem + 2.6vw, 2.5rem)',
      '2xl': 'clamp(2.074rem, 1.3rem + 3.5vw, 3.5rem)',
      '3xl': 'clamp(2.488rem, 1.5rem + 4.5vw, 4.5rem)',
    },
  },
};
```

### Fluid Type Without clamp() (Legacy Fallback)
```css
/* For browsers without clamp() support (pre-2020) */
h1 {
  font-size: 2.488rem;                     /* Fallback */
  font-size: clamp(2.488rem, 1.5rem + 4.5vw, 4.5rem);
}
```

## Common Mistakes

1. **Using `vw` alone** — `font-size: 4vw` ignores user zoom and base font preferences. Always combine with `rem`: `clamp(1.5rem, 1rem + 2vw, 3rem)`.
2. **Min value too small** — setting min to `0.75rem` (12px) makes text unreadable on mobile. Body text minimum is `1rem`.
3. **Max value too large** — headings over `5rem` (80px) on desktop waste space and overwhelm. Cap display text at `4--5rem`.
4. **Not testing at extremes** — check your fluid type at 320px and 2560px. `clamp()` handles this, but verify the min and max feel right.
5. **Fluid type without fluid spacing** — if headings grow 50% but margins stay fixed, the vertical rhythm breaks. Scale spacing too.
6. **Overcomplicating the formula** — use a fluid type calculator to generate values. Hand-calculating the slope is error-prone and unnecessary.

## Decision Tree

```
Should you use fluid typography?
├─ Is the design responsive?
│  ├─ Yes → Use fluid type with clamp()
│  └─ No (fixed-width) → Use static rem values
├─ How to set up:
│  ├─ Pick your type scale ratio (see type-scale.md)
│  ├─ Set min sizes (at 320px viewport)
│  ├─ Set max sizes (at 1280px viewport)
│  └─ Generate clamp() values (use a calculator or the formula above)
├─ What about spacing?
│  ├─ Match fluid spacing to fluid type
│  └─ Use same clamp() pattern for padding and margins
└─ Accessibility check:
   ├─ Body text min >= 1rem? ✓
   ├─ Uses rem (not just vw)? ✓
   ├─ Works at 200% browser zoom? ✓
   └─ All pass → Ship it
```

## Sources
- [Utopia](https://utopia.fyi/) — fluid type and space calculator (recommended)
- [Modern Fluid Typography](https://www.smashingmagazine.com/2022/01/modern-fluid-typography-css-clamp/) — Smashing Magazine
- [MDN — clamp()](https://developer.mozilla.org/en-US/docs/Web/CSS/clamp)
- [WCAG 1.4.4 — Resize Text](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html)
- [Type Scale](https://typescale.com/) — interactive type scale calculator
