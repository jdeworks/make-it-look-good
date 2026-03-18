# New Project Design Checklist

> **TL;DR:** A step-by-step checklist for setting up design foundations when starting a new project.

## Core Principles

Every well-designed project starts with a **design foundation** before any components are built. Skipping this step leads to inconsistent UIs, accessibility debt, and painful refactors later. The order matters: spacing and type come first because they influence everything else. Color and components build on top.

**Time investment:** 2-4 hours upfront saves 20-40 hours of inconsistency fixes later.

## Concrete Rules

### Step 1: Choose a Spacing System

- **Use a 4px base unit** for compact UIs (dashboards, data-heavy apps)
- **Use an 8px base unit** for content-focused UIs (marketing sites, blogs, SaaS)
- Define a spacing scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128` (4px base) or `8, 16, 24, 32, 48, 64, 96, 128` (8px base)
- Never use arbitrary values like 13px or 37px
- See [Spacing System](../layout/spacing-system.md) for full guidance

### Step 2: Set Up a Type Scale

- **Choose a scale ratio:** 1.200 (minor third) for compact UIs, 1.250 (major third) for general use, 1.333 (perfect fourth) for editorial/marketing
- **Define sizes** — minimum 5 levels:
  - `xs`: 12px (0.75rem) — captions, labels
  - `sm`: 14px (0.875rem) — secondary text, metadata
  - `base`: 16px (1rem) — body text (never go below 16px for body)
  - `lg`: 18-20px (1.125-1.25rem) — lead paragraphs, subheadings
  - `xl`: 24px (1.5rem) — section headings
  - `2xl`: 30-32px (1.875-2rem) — page headings
  - `3xl`: 36-48px (2.25-3rem) — hero headings
- **Line heights:** 1.5 for body text, 1.2-1.3 for headings, 1.0-1.1 for display text (48px+)
- **Measure (line length):** 45-75 characters for body text (ideal: 66)
- See [Type Scale](../typography/type-scale.md) and [Readability](../typography/readability.md)

### Step 3: Define Color Palette

- **Primary color:** 1 hue, generate 9-11 shades (50-950 scale)
- **Secondary color:** 1 hue, same shade range — choose a hue 30-60 degrees from primary on the color wheel for harmony, or complementary (180 degrees) for contrast
- **Neutral color:** Gray or tinted gray (add 2-5% of primary hue), 9-11 shades
- **Semantic colors:** Success (green), Warning (amber/yellow), Error (red), Info (blue) — each needs at least 3 shades (light background, default, dark text)
- **Surface colors:** Background, card, elevated surface — at least 3 levels
- Never use pure black (#000) for text — use #111827 or #1a1a2e
- Never use pure white (#fff) for large backgrounds — use #fafafa or #f8fafc
- See [Color Systems](../color/color-systems.md) and [Color Psychology](../color/color-psychology.md)

### Step 4: Verify Contrast and Accessibility

- **Normal text (below 18px):** minimum 4.5:1 contrast ratio (WCAG AA)
- **Large text (18px bold or 24px regular):** minimum 3:1 contrast ratio
- **UI components and graphical objects:** minimum 3:1 contrast ratio
- **Target AAA where possible:** 7:1 for normal text, 4.5:1 for large text
- Test every text/background combination in your palette
- Verify with color blindness simulators (protanopia, deuteranopia, tritanopia)
- Never rely on color alone to convey meaning — always pair with icons, text, or patterns
- See [Contrast and Accessibility](../color/contrast-and-accessibility.md) and [Color-Blind Safety](../color/color-blind-safety.md)

### Step 5: Set Breakpoints

- **Mobile first:** start designing at 320px, then scale up
- Standard breakpoints:
  - `sm`: 640px (large phones in landscape)
  - `md`: 768px (tablets)
  - `lg`: 1024px (small laptops)
  - `xl`: 1280px (desktops)
  - `2xl`: 1536px (large screens)
- **Max content width:** 1280px for most apps, 960px for reading-heavy content, 1440-1600px for dashboards
- See [Breakpoints](../responsive/breakpoints.md) and [Mobile First](../responsive/mobile-first.md)

### Step 6: Set Up Grid System

- **12-column grid** for complex layouts, **6-column** for simpler ones
- **Column gap:** 16px (mobile), 24px (tablet), 32px (desktop)
- **Page margin:** 16px (mobile), 24-32px (tablet), 48-64px (desktop), auto (centered content on large screens)
- See [Grid Systems](../layout/grid-systems.md)

### Step 7: Define Component Tokens

- **Border radius:** Pick one system and stick with it
  - Sharp: 0px, 2px, 4px
  - Rounded: 4px, 8px, 12px, 9999px (pill)
  - Soft: 6px, 12px, 16px, 9999px (pill)
- **Shadows** — define 3-5 elevation levels:
  - `sm`: `0 1px 2px rgba(0,0,0,0.05)` — subtle lift (cards)
  - `md`: `0 4px 6px -1px rgba(0,0,0,0.1)` — dropdown, hover state
  - `lg`: `0 10px 15px -3px rgba(0,0,0,0.1)` — modal, popover
  - `xl`: `0 20px 25px -5px rgba(0,0,0,0.1)` — dialog, toast
- **Transitions:**
  - Duration: 150ms (micro-interactions), 200ms (standard), 300ms (emphasis), 500ms (page transitions)
  - Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (standard), `cubic-bezier(0, 0, 0.2, 1)` (decelerate/enter), `cubic-bezier(0.4, 0, 1, 1)` (accelerate/exit)
- See [Animation Timing](../interaction/animation-timing.md) and [Micro-Interactions](../interaction/micro-interactions.md)

### Step 8: Set Up Dark Mode (If Needed)

- **Do not just invert colors.** Create a separate set of semantic tokens for dark mode.
- Dark backgrounds: #0f172a to #1e293b (not pure black)
- Reduce text contrast slightly — use #e2e8f0 instead of #ffffff on dark backgrounds (ratio ~14:1 is fine, #ffffff on dark can feel harsh)
- Reduce shadow visibility — shadows barely show on dark backgrounds; use subtle borders (1px solid rgba(255,255,255,0.1)) or lighter surface colors instead
- Primary colors may need to shift lighter (400-300 range instead of 600-700) for readability on dark surfaces
- Test every semantic color on both light and dark backgrounds

## CSS/Implementation Patterns

### CSS Custom Properties (Framework-Agnostic)

```css
:root {
  /* Spacing scale (8px base) */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-24: 6rem;     /* 96px */

  /* Type scale (1.250 ratio) */
  --text-xs: 0.75rem;     /* 12px */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.25rem;     /* 20px */
  --text-xl: 1.5rem;      /* 24px */
  --text-2xl: 1.875rem;   /* 30px */
  --text-3xl: 2.25rem;    /* 36px */

  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  /* Colors — Light mode */
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;

  --color-neutral-50: #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-700: #334155;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;

  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-error: #dc2626;
  --color-info: #2563eb;

  /* Semantic tokens */
  --bg-primary: var(--color-neutral-50);
  --bg-surface: #ffffff;
  --bg-elevated: #ffffff;
  --text-primary: var(--color-neutral-900);
  --text-secondary: var(--color-neutral-700);
  --border-default: var(--color-neutral-200);

  /* Component tokens */
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dark mode overrides */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: var(--color-neutral-900);
    --bg-surface: var(--color-neutral-800);
    --bg-elevated: var(--color-neutral-700);
    --text-primary: var(--color-neutral-100);
    --text-secondary: var(--color-neutral-200);
    --border-default: rgba(255, 255, 255, 0.1);
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
  }
}
```

### Tailwind CSS Config

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      spacing: {
        '18': '4.5rem',   /* 72px — fills gap between 16 and 20 */
      },
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem',     { lineHeight: '1.5rem' }],
        'lg':   ['1.25rem',  { lineHeight: '1.75rem' }],
        'xl':   ['1.5rem',   { lineHeight: '2rem' }],
        '2xl':  ['1.875rem', { lineHeight: '2.25rem' }],
        '3xl':  ['2.25rem',  { lineHeight: '2.5rem' }],
      },
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        /* Add secondary, neutral, semantic as needed */
      },
      borderRadius: {
        'sm':   '0.25rem',
        'md':   '0.5rem',
        'lg':   '0.75rem',
        'pill': '9999px',
      },
      boxShadow: {
        'sm':  '0 1px 2px rgba(0, 0, 0, 0.05)',
        'md':  '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'lg':  '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        'xl':  '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
      transitionDuration: {
        'fast': '150ms',
        'base': '200ms',
        'slow': '300ms',
      },
    },
  },
}
```

### Base Reset

```css
/* Always include */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 100%;                  /* Respect user font-size preferences */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--text-primary);
  background-color: var(--bg-primary);
}

img, svg {
  display: block;
  max-width: 100%;
}

/* Focus visible for keyboard users only */
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
```

## Common Mistakes

1. **Skipping the spacing system** — leads to 47 different padding values across the project
2. **Too many font sizes** — if you have more than 8 distinct sizes, you have too many
3. **No semantic color tokens** — using `#3b82f6` directly means changing the primary color requires find-and-replace across the entire codebase
4. **Forgetting dark mode from the start** — retrofitting dark mode on hardcoded colors is painful; use semantic tokens from day one even if you ship light-only at first
5. **Setting font-size in px on html/body** — this overrides user accessibility preferences; always use rem or percentage
6. **Not testing on real mobile devices** — browser DevTools device simulation misses touch target issues and font rendering differences
7. **Defining breakpoints in px** — use em or rem for breakpoints so they respect user font-size settings (Tailwind does this by default)
8. **Pure black text on pure white** — contrast ratio of 21:1 causes eye strain; #111827 on #ffffff (17.5:1) is more comfortable

## Decision Tree

```
Starting a new project?
├── Step 1: What kind of UI?
│   ├── Data-heavy (dashboard, admin) → 4px spacing base
│   └── Content-focused (marketing, SaaS) → 8px spacing base
│
├── Step 2: What kind of content?
│   ├── Long-form reading → 1.200 type ratio, max-width 65ch
│   ├── Mixed content → 1.250 type ratio, max-width 80ch
│   └── Headline-heavy → 1.333 type ratio
│
├── Step 3: Brand colors defined?
│   ├── Yes → Generate shade scale from brand color
│   └── No → Start with blue (universally trusted), generate later
│
├── Step 4: Dark mode needed?
│   ├── Yes → Use semantic tokens from day one
│   ├── Maybe later → Still use semantic tokens (future-proofs)
│   └── No → Semantic tokens still recommended
│
├── Step 5: Framework?
│   ├── Tailwind → Configure tailwind.config.js with tokens
│   ├── CSS Modules/Styled → Use CSS custom properties
│   └── Other → Map tokens to framework's theming system
│
└── Step 6: Verify
    ├── Run contrast checker on all text/background combinations
    ├── Test on 320px, 768px, 1280px viewports
    └── Check with screen reader (VoiceOver or NVDA)
```

## Sources

- Material Design 3 — Design Tokens: https://m3.material.io/foundations/design-tokens
- Tailwind CSS Default Configuration: https://tailwindcss.com/docs/configuration
- WCAG 2.1 Contrast Requirements: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum
- "Refactoring UI" by Adam Wathan & Steve Schoger (2018)
- "Design Systems" by Alla Kholmatova (Smashing Magazine, 2017)
