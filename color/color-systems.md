# Color Systems

> **TL;DR:** Build your palette from a small set of key colors, then generate tonal scales (50–950) for each. You need: 1 primary, 1 neutral, and 3 semantic colors (error, warning, success) at minimum. Use HSL for manipulation, use semantic token names, and always verify contrast.

## Core Principles

1. **Start with 3–5 key colors**, not 50 — primary, neutral, error, warning, success
2. **Generate tonal scales** — each key color gets a 10-step lightness scale (50=lightest, 950=darkest)
3. **Name tokens semantically** — `color-text-primary` not `color-gray-900`; `color-error` not `color-red-500`
4. **HSL is best for manipulation** — adjusting lightness is intuitive; RGB is not
5. **Every color must pass contrast checks** against its intended background
6. **Dark mode is a second palette**, not a CSS filter — re-map semantic tokens, don't just invert

## Concrete Rules

### Minimum Palette Structure
| Role | Light Mode | Dark Mode | Usage |
|------|-----------|-----------|-------|
| **Primary** | Brand color | Lighter tint of brand | CTAs, links, focus indicators |
| **On Primary** | White or very light | Dark or very dark | Text/icons on primary bg |
| **Neutral** | Gray scale | Gray scale (inverted) | Text, borders, backgrounds |
| **Error** | Red-based (#dc2626) | Lighter red (#f87171) | Validation errors, destructive |
| **Warning** | Amber-based (#d97706) | Lighter amber (#fbbf24) | Warnings, caution states |
| **Success** | Green-based (#16a34a) | Lighter green (#4ade80) | Confirmations, positive |
| **Info** | Blue-based (#2563eb) | Lighter blue (#60a5fa) | Informational states |
| **Surface** | White (#ffffff) | Dark gray (#1a1a1a) | Page/card backgrounds |

### Tonal Scale Pattern
Generate a 10-step scale for each key color. The exact values depend on your brand, but the structure is consistent:

| Step | Lightness (HSL L%) | Typical Use |
|------|-------------------|-------------|
| 50 | ~97% | Subtle backgrounds (alerts, badges) |
| 100 | ~93% | Hover backgrounds |
| 200 | ~87% | Active/pressed backgrounds |
| 300 | ~76% | Borders (subtle) |
| 400 | ~62% | Borders (strong), disabled text |
| 500 | ~50% | Icons, secondary text |
| 600 | ~40% | Body text (on light bg), primary interactive |
| 700 | ~32% | Headings (on light bg) |
| 800 | ~24% | High emphasis text |
| 900 | ~16% | Highest emphasis |
| 950 | ~8% | Near-black, maximum contrast |

### Token Naming Convention
```
{category}-{property}-{variant}

Examples:
  color-text-primary        → main body text
  color-text-secondary      → less important text
  color-text-inverse        → text on dark backgrounds
  color-bg-default          → page background
  color-bg-subtle           → offset sections
  color-bg-surface          → cards, elevated surfaces
  color-border-default      → standard borders
  color-border-strong       → emphasized borders
  color-interactive-default → links, buttons (default state)
  color-interactive-hover   → hover state
  color-interactive-active  → pressed/active state
  color-status-error        → error states
  color-status-warning      → warning states
  color-status-success      → success states
  color-status-info         → informational states
```

## CSS/Implementation Patterns

### Full Color System with CSS Custom Properties
```css
:root {
  /* === Primary palette === */
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;
  --color-primary-950: #172554;

  /* === Neutral palette === */
  --color-neutral-50: #fafafa;
  --color-neutral-100: #f5f5f5;
  --color-neutral-200: #e5e5e5;
  --color-neutral-300: #d4d4d4;
  --color-neutral-400: #a3a3a3;
  --color-neutral-500: #737373;
  --color-neutral-600: #525252;
  --color-neutral-700: #404040;
  --color-neutral-800: #262626;
  --color-neutral-900: #171717;
  --color-neutral-950: #0a0a0a;

  /* === Semantic tokens (map to palette) === */
  --color-text-primary: var(--color-neutral-900);
  --color-text-secondary: var(--color-neutral-600);
  --color-text-tertiary: var(--color-neutral-500);
  --color-text-inverse: #ffffff;
  --color-text-link: var(--color-primary-700);

  --color-bg-default: #ffffff;
  --color-bg-subtle: var(--color-neutral-50);
  --color-bg-surface: #ffffff;
  --color-bg-surface-hover: var(--color-neutral-100);

  --color-border-default: var(--color-neutral-300);
  --color-border-strong: var(--color-neutral-400);
  --color-border-focus: var(--color-primary-600);

  --color-interactive: var(--color-primary-600);
  --color-interactive-hover: var(--color-primary-700);
  --color-interactive-active: var(--color-primary-800);

  /* === Status colors === */
  --color-error: #dc2626;
  --color-error-bg: #fef2f2;
  --color-error-border: #fecaca;
  --color-warning: #d97706;
  --color-warning-bg: #fffbeb;
  --color-warning-border: #fde68a;
  --color-success: #16a34a;
  --color-success-bg: #f0fdf4;
  --color-success-border: #bbf7d0;
  --color-info: #2563eb;
  --color-info-bg: #eff6ff;
  --color-info-border: #bfdbfe;
}
```

### Dark Mode via Token Remapping
```css
@media (prefers-color-scheme: dark) {
  :root {
    /* Remap semantic tokens — DON'T redefine the palette */
    --color-text-primary: var(--color-neutral-100);
    --color-text-secondary: var(--color-neutral-400);
    --color-text-tertiary: var(--color-neutral-500);
    --color-text-link: var(--color-primary-400);

    --color-bg-default: var(--color-neutral-950);
    --color-bg-subtle: var(--color-neutral-900);
    --color-bg-surface: var(--color-neutral-800);
    --color-bg-surface-hover: var(--color-neutral-700);

    --color-border-default: var(--color-neutral-700);
    --color-border-strong: var(--color-neutral-600);

    --color-interactive: var(--color-primary-400);
    --color-interactive-hover: var(--color-primary-300);

    /* Status colors — use lighter variants in dark mode */
    --color-error: #f87171;
    --color-error-bg: #450a0a;
    --color-warning: #fbbf24;
    --color-warning-bg: #451a03;
    --color-success: #4ade80;
    --color-success-bg: #052e16;
  }
}
```

### Generating a Tonal Scale in HSL
```css
/* Given a brand color in HSL, generate the scale by varying lightness */
:root {
  --hue: 221;    /* Your brand hue */
  --sat: 83%;    /* Your brand saturation */

  --color-brand-50:  hsl(var(--hue), var(--sat), 97%);
  --color-brand-100: hsl(var(--hue), var(--sat), 93%);
  --color-brand-200: hsl(var(--hue), var(--sat), 87%);
  --color-brand-300: hsl(var(--hue), var(--sat), 76%);
  --color-brand-400: hsl(var(--hue), var(--sat), 62%);
  --color-brand-500: hsl(var(--hue), var(--sat), 50%);
  --color-brand-600: hsl(var(--hue), var(--sat), 40%);
  --color-brand-700: hsl(var(--hue), var(--sat), 32%);
  --color-brand-800: hsl(var(--hue), var(--sat), 24%);
  --color-brand-900: hsl(var(--hue), var(--sat), 16%);
  --color-brand-950: hsl(var(--hue), var(--sat), 8%);
}
/* Note: Reduce saturation at extremes for more natural tones */
```

## Common Mistakes

1. **Too many colors** — 5 key colors × 10 shades = 50 values is plenty. Adding more creates inconsistency.
2. **Using raw palette values in components** — always go through semantic tokens. `var(--color-text-primary)` not `var(--color-neutral-900)`. This is what makes dark mode possible.
3. **Generating dark mode with `filter: invert()`** — images get inverted, shadows flip, brand colors change. Use token remapping instead.
4. **Not testing status colors for color blindness** — red/green color blindness affects ~8% of men. Never rely on red vs. green alone. See [color-blind-safety.md](color-blind-safety.md).
5. **Choosing brand colors without checking contrast** — that beautiful light blue your designer picked might only achieve 2.5:1 contrast as text. Check before committing.
6. **Flat lightness scales** — if steps 400 and 500 look nearly identical, the scale isn't useful. Ensure visible distinction at every step.

## Decision Tree

```
Building a color system from scratch?
├─ Step 1: Pick your primary brand color (1 hue)
│  └─ Verify it achieves 4.5:1 as text on white (or adjust shade)
├─ Step 2: Generate a 10-step tonal scale for primary
│  └─ Use HSL, varying lightness from 97% to 8%
├─ Step 3: Generate a neutral gray scale (same structure)
│  └─ Optionally warm or cool the gray by tinting with brand hue
├─ Step 4: Pick semantic status colors
│  ├─ Error: red-based hue
│  ├─ Warning: amber/yellow-based hue
│  ├─ Success: green-based hue
│  └─ Info: blue-based hue (can be the primary if primary is blue)
├─ Step 5: Create semantic tokens mapping to palette values
│  └─ text, bg, border, interactive, status categories
├─ Step 6: Create dark mode token remapping
│  └─ Flip the lightness mapping (900→100, 100→900)
└─ Step 7: Verify ALL text/bg combinations pass WCAG AA
   └─ See [contrast-and-accessibility.md](contrast-and-accessibility.md)
```

## Sources
- [Material Design 3 — Color System](https://m3.material.io/styles/color/overview)
- [Tailwind CSS — Customizing Colors](https://tailwindcss.com/docs/customizing-colors)
- [Radix Colors](https://www.radix-ui.com/colors) — well-designed accessible color scales
- [Open Color](https://yeun.github.io/open-color/) — open-source optimized color scheme
