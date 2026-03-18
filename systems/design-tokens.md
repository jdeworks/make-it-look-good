# Design Tokens

> **TL;DR:** Design tokens are the atomic values of a design system — colors, spacing, typography, shadows — stored as platform-agnostic variables. Use semantic naming (e.g., `color-text-primary` not `color-gray-900`). Structure tokens in tiers: global (raw values) → alias (semantic meaning) → component (specific usage).

## Core Principles

1. **Tokens are named design decisions** — not just variables, but the reasoning behind a value captured in a name
2. **Semantic names over raw values** — `color-error` communicates intent; `color-red-600` communicates nothing about usage
3. **Single source of truth** — change a token in one place, it updates everywhere across platforms
4. **Platform-agnostic definition** — define tokens in a neutral format (JSON/YAML), then transform for each platform (CSS, iOS, Android)
5. **Tokens enable theming** — swap the alias layer to switch between light/dark mode, brand themes, or white-label products

## Token Tiers

### Three-Tier Architecture
```
┌─────────────────────────────────────────────────┐
│  COMPONENT TOKENS (most specific)               │
│  button-bg-primary, card-border-radius           │
│  → Reference alias tokens                        │
├─────────────────────────────────────────────────┤
│  ALIAS / SEMANTIC TOKENS (intent layer)          │
│  color-bg-primary, spacing-md, font-size-body    │
│  → Reference global tokens                       │
├─────────────────────────────────────────────────┤
│  GLOBAL / PRIMITIVE TOKENS (raw values)          │
│  blue-600: #0055cc, space-4: 1rem, gray-100      │
│  → Hardcoded values                              │
└─────────────────────────────────────────────────┘
```

| Tier | Purpose | Example | Who Edits |
|------|---------|---------|-----------|
| **Global** | Raw palette, all possible values | `blue-600: #0055cc` | Design system team |
| **Alias** | Semantic meaning, context | `color-primary: {blue-600}` | Design system team |
| **Component** | Specific component usage | `button-bg: {color-primary}` | Component authors |

> Most projects need only **global + alias**. Add the component tier when your system has 50+ components or multiple consuming teams.

## Token Types

| Type | Examples | Typical Count |
|------|----------|---------------|
| **Color** | Text, background, border, brand, status | 30–60 |
| **Spacing** | Padding, margin, gap | 8–12 (scale-based) |
| **Typography** | Font family, size, weight, line-height, letter-spacing | 15–25 |
| **Border radius** | Small, medium, large, full | 4–6 |
| **Elevation / Shadow** | Card, dropdown, modal, toast | 4–6 |
| **Motion** | Duration, easing | 6–10 |
| **Breakpoints** | sm, md, lg, xl | 4–6 |
| **Z-index** | Dropdown, sticky, modal, toast | 4–6 |
| **Opacity** | Disabled, hover overlay | 3–5 |

## Concrete Rules

### Naming Convention
```
{category}-{property}-{variant}-{state}

color-text-primary
color-text-primary-hover
color-bg-surface
spacing-padding-md
font-size-body-lg
shadow-elevation-md
```

| Do | Don't |
|----|-------|
| `color-text-primary` | `color-gray-900` (no intent) |
| `color-bg-error` | `color-red-100` (no context) |
| `spacing-md` | `spacing-16` (hardcoded pixel value in name) |
| `font-size-heading-lg` | `font-size-32` (no semantic meaning) |
| `shadow-elevation-sm` | `shadow-1` (no meaning) |

### When to Create a Token vs. Hardcode
| Create a Token When | Hardcode When |
|---------------------|---------------|
| Value is used in 3+ places | Truly one-off value |
| Value should change with theming | Value is structural, not thematic (e.g., `50%` for centering) |
| Value is part of a scale (spacing, type) | Value is a CSS mechanic (`0`, `auto`, `100%`, `1fr`) |
| Value has semantic meaning | Value is a math result (`calc()` internals) |
| Other team members need to reference it | Value is specific to a single animation keyframe |

## CSS/Implementation Patterns

### CSS Custom Properties (Recommended)
```css
/* Global tokens — raw values */
:root {
  --blue-500: #2563eb;
  --blue-600: #1d4ed8;
  --blue-700: #1e40af;
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-900: #111827;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
}

/* Alias tokens — semantic meaning */
:root {
  --color-text-primary: var(--gray-900);
  --color-text-secondary: #6b7280;
  --color-bg-primary: #ffffff;
  --color-bg-secondary: var(--gray-50);
  --color-brand-primary: var(--blue-600);
  --color-brand-primary-hover: var(--blue-700);
  --color-border-default: var(--gray-100);
  --spacing-sm: var(--space-2);
  --spacing-md: var(--space-4);
  --spacing-lg: var(--space-6);
  --spacing-xl: var(--space-8);
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

/* Dark theme — swap alias layer, globals stay the same */
[data-theme="dark"] {
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
  --color-bg-primary: #111827;
  --color-bg-secondary: #1f2937;
  --color-brand-primary: #60a5fa;
  --color-brand-primary-hover: #93bbfd;
  --color-border-default: #374151;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
}
```

### Component Tokens (When Needed)
```css
/* Component-level tokens reference alias tokens */
.btn {
  --btn-padding-x: var(--spacing-md);
  --btn-padding-y: var(--spacing-sm);
  --btn-radius: var(--radius-md);
  --btn-font-size: 0.875rem;

  padding: var(--btn-padding-y) var(--btn-padding-x);
  border-radius: var(--btn-radius);
  font-size: var(--btn-font-size);
}

.btn--lg {
  --btn-padding-x: var(--spacing-lg);
  --btn-padding-y: var(--spacing-md);
  --btn-font-size: 1rem;
}
```

### Tailwind Theme as Tokens
```js
// tailwind.config.js — Tailwind's theme IS your token system
module.exports = {
  theme: {
    colors: {
      // Alias tokens
      'text-primary': 'var(--color-text-primary)',
      'bg-primary': 'var(--color-bg-primary)',
      'brand': 'var(--color-brand-primary)',
    },
    spacing: {
      'sm': 'var(--spacing-sm)',
      'md': 'var(--spacing-md)',
      'lg': 'var(--spacing-lg)',
    },
    borderRadius: {
      'sm': 'var(--radius-sm)',
      'md': 'var(--radius-md)',
      'lg': 'var(--radius-lg)',
    },
  },
};
```

### JSON Token Format (Design Token Community Group)
```json
{
  "color": {
    "brand": {
      "primary": {
        "$value": "#1d4ed8",
        "$type": "color",
        "$description": "Primary brand color for interactive elements"
      }
    },
    "text": {
      "primary": {
        "$value": "{color.gray.900}",
        "$type": "color"
      }
    }
  }
}
```

## Common Mistakes

1. **Using raw values as token names** — `color-gray-900` tells you nothing about when to use it. Use `color-text-primary`.
2. **Too many tokens too early** — start with 30–50 tokens covering color, spacing, and typography. Add more only when patterns repeat.
3. **No alias layer** — jumping from `blue-600` directly in components means you can't theme. Always have a semantic layer.
4. **Inconsistent naming** — mixing `bg-color-primary` and `color-primary-bg` across the codebase. Pick one convention and enforce it.
5. **Tokenizing everything** — don't create tokens for `width: 100%`, `display: flex`, or `position: relative`. These are layout mechanics, not design decisions.
6. **Forgetting dark mode when defining tokens** — if a token doesn't have a dark mode mapping, it will break. Define both themes from day one.
7. **Not documenting token purpose** — a token without a description becomes a mystery. Add `$description` or comments explaining when to use each token.

## Decision Tree

```
Need to define a visual value?
├─ Is it used in 3+ places?
│  ├─ No → Hardcode it (consider promoting later if reuse grows)
│  └─ Yes → Create a token
│     ├─ Is it a raw color/size/value?
│     │  └─ Create a GLOBAL token (e.g., blue-600)
│     ├─ Does it have semantic meaning?
│     │  └─ Create an ALIAS token (e.g., color-primary → blue-600)
│     └─ Is it specific to one component with variants?
│        └─ Create a COMPONENT token (e.g., btn-bg → color-primary)
├─ What format?
│  ├─ Web only → CSS custom properties
│  ├─ Multi-platform → JSON (DTCG format) + build tool (Style Dictionary)
│  └─ Tailwind project → tailwind.config.js theme + CSS custom properties
└─ How to migrate an existing codebase?
   ├─ Phase 1: Audit — list all hardcoded values, find patterns
   ├─ Phase 2: Define globals — create the raw palette
   ├─ Phase 3: Define aliases — map semantic names to globals
   ├─ Phase 4: Replace — swap hardcoded values for tokens, one file at a time
   └─ Phase 5: Lint — add stylelint rules to prevent new hardcoded values
```

## Sources
- [Design Tokens Community Group — W3C](https://www.w3.org/community/design-tokens/)
- [Design Tokens Format Module (W3C Draft)](https://tr.designtokens.org/format/)
- [Style Dictionary — Amazon](https://amzn.github.io/style-dictionary/)
- [Tokens Studio — Figma Plugin](https://tokens.studio/)
- [Nathan Curtis — Naming Tokens in Design Systems (2022)](https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676)
