# Building a Design System

> **TL;DR:** Start with tokens (colors, spacing, type), then primitives (buttons, inputs), then patterns (forms, cards). Document as you go. A system with 3 well-documented components beats 30 undocumented ones.

## Core Principles

A design system is not a component library. It is a **shared language** — tokens, rules, and documented patterns that ensure visual and behavioral consistency across an entire product. The key insight: build incrementally from the inside out (tokens first, then primitives, then patterns), and document each layer before moving to the next.

**Three truths about design systems:**
1. A system nobody uses is worse than no system — adoption requires documentation and ease of use
2. Tokens are the foundation — if your tokens are wrong, every component built on top is wrong
3. Start small and grow — extract patterns from real product needs, do not design abstractly

Cross-reference [Design Tokens](../systems/design-tokens.md) for the token specification layer.

## Concrete Rules

### Phase 1: Audit Existing UI (1-2 days)

Before building anything, inventory what already exists.

- **Screenshot every unique screen** in the product
- **Catalog all colors in use** — extract every unique hex/rgb value; group similar ones
  - Typical finding: 15-40 unique grays, 5-10 unique blues where 3 of each would suffice
- **Catalog all font sizes** — list every unique font-size value in the codebase
  - Target: reduce to 6-8 distinct sizes on a [type scale](../typography/type-scale.md)
- **Catalog all spacing values** — list every unique margin/padding value
  - Target: reduce to 8-12 values on a consistent scale (see [Spacing System](../layout/spacing-system.md))
- **Catalog all border-radius values** — typically 2-4 are needed
- **Catalog all shadow values** — typically 3-5 elevation levels
- **Catalog all transition durations** — typically 3-4 values

**Audit output:** A spreadsheet or document listing every unique value, grouped by category, with a "keep/merge/remove" decision for each.

### Phase 2: Define Tokens (1-3 days)

Tokens are the atomic values from which everything is built. Define three layers:

**Layer 1 — Global tokens** (raw values):
- Color palette: 9-11 shades per hue (50-950), 1-3 hues + neutrals + semantics
- Spacing scale: 8-12 values on a 4px or 8px base
- Type scale: 6-8 sizes with matching line heights
- Border radius: 3-5 values (sm, md, lg, full)
- Shadows: 3-5 elevation levels
- Transitions: 3-4 duration/easing pairs

**Layer 2 — Semantic tokens** (purpose-based aliases):
- `--color-text-primary` not `--gray-900`
- `--color-bg-surface` not `--white`
- `--space-component-padding` not `--space-4`
- This layer enables theming (dark mode, brand variants) without changing components

**Layer 3 — Component tokens** (component-specific overrides):
- `--button-height` references `--space-10` (40px)
- `--input-border-color` references `--color-border-default`
- Only create these when a component truly needs to deviate from semantic tokens

**Token naming convention:**
```
--{category}-{property}-{variant}-{state}
--color-text-primary
--color-bg-surface-hover
--space-padding-lg
--font-size-heading-xl
```

### Phase 3: Build Primitives (1-2 weeks)

Primitives are the smallest reusable UI components. Build them in this order (each depends on the previous):

1. **Typography components** — Heading, Text, Label, Caption
   - Map each to a token: `Heading` uses `--font-size-heading-*`, `--leading-tight`
   - Define weight, color, and spacing rules

2. **Button** — the most-used interactive component
   - Variants: primary, secondary, ghost, danger
   - Sizes: sm (32px height), md (40px), lg (48px)
   - States: default, hover, active, focus, disabled, loading
   - See [Buttons](../components/buttons.md)

3. **Input** — text input, textarea, select
   - Height: 40px (desktop), 48px (mobile)
   - States: default, hover, focus, error, disabled
   - Always pair with a label component
   - See [Forms](../components/forms.md)

4. **Icon** — consistent size system
   - Sizes: 16px, 20px, 24px (match text sizes)
   - Color inherits from parent by default (`currentColor`)

5. **Badge/Tag** — status indicators, categories
   - Height: 20-24px
   - Variants: map to semantic colors (success, warning, error, info, neutral)

**Rules for every primitive:**
- Must accept all standard HTML attributes (className, id, data-*, aria-*)
- Must forward refs (React) or support native element extension
- Must be accessible: correct ARIA roles, keyboard support, contrast compliance
- Must have at least 3 documented examples (default, with options, edge case)

### Phase 4: Compose Patterns (2-4 weeks)

Patterns combine primitives to solve common UI problems.

1. **Form pattern** — Label + Input + Error message + Help text
   - Standard field layout, validation pattern, form submission flow
   - See [Forms](../components/forms.md)

2. **Card pattern** — Container + Image + Title + Description + Actions
   - Standard card layout with consistent spacing
   - See [Cards](../components/cards.md)

3. **Navigation pattern** — Logo + Nav links + Actions
   - Responsive behavior (desktop nav to mobile hamburger)
   - See [Navigation](../components/navigation.md)

4. **Table pattern** — Header + Rows + Pagination + Sort + Filter
   - Responsive behavior (table on desktop, card list on mobile)
   - See [Tables and Lists](../components/tables-and-lists.md)

5. **Feedback pattern** — Toast + Alert + Modal + Empty state
   - Consistent positioning, timing, and dismissal rules
   - See [Feedback](../components/feedback.md) and [Modals and Dialogs](../components/modals-and-dialogs.md)

### Phase 5: Document (Ongoing)

Documentation is not optional. An undocumented component does not exist.

**For every token:**
- Name, value, and semantic meaning
- Visual swatch or example
- When to use and when not to use

**For every component:**
- Purpose statement (1 sentence)
- Props/API table with types and defaults
- Live examples for each variant and state
- Do's and don'ts with visual examples
- Accessibility notes

**Documentation rules:**
- One page per component
- Every example must be copy-pasteable working code
- Update docs in the same PR as the component change — never "later"
- Include a changelog or version history for breaking changes

### Phase 6: Maintain (Ongoing)

- **Audit quarterly:** Compare live product against the system; catch drift
- **Measure adoption:** Track what percentage of UI uses system components vs. custom one-offs; target >80%
- **Version and deprecate:** Semantic versioning for the system; deprecate with a migration path, never silently remove
- **Single owner:** One person or team must own the system; shared ownership = no ownership

## CSS/Implementation Patterns

### Token Layer — CSS Custom Properties

```css
:root {
  /* === Global Tokens === */

  /* Colors — Primary */
  --color-primary-50:  #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;

  /* Colors — Neutral */
  --color-neutral-50:  #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-300: #cbd5e1;
  --color-neutral-400: #94a3b8;
  --color-neutral-500: #64748b;
  --color-neutral-600: #475569;
  --color-neutral-700: #334155;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;

  /* Spacing */
  --space-1:  0.25rem;  /* 4px */
  --space-2:  0.5rem;   /* 8px */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */

  /* === Semantic Tokens === */

  /* Text */
  --color-text-primary:   var(--color-neutral-900);
  --color-text-secondary: var(--color-neutral-600);
  --color-text-tertiary:  var(--color-neutral-400);
  --color-text-inverse:   #ffffff;
  --color-text-link:      var(--color-primary-600);
  --color-text-error:     #dc2626;

  /* Backgrounds */
  --color-bg-page:     var(--color-neutral-50);
  --color-bg-surface:  #ffffff;
  --color-bg-elevated: #ffffff;
  --color-bg-muted:    var(--color-neutral-100);

  /* Borders */
  --color-border-default: var(--color-neutral-200);
  --color-border-strong:  var(--color-neutral-300);
  --color-border-focus:   var(--color-primary-500);
  --color-border-error:   #dc2626;

  /* Component tokens */
  --radius-sm:   0.25rem;
  --radius-md:   0.5rem;
  --radius-lg:   0.75rem;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dark mode — only semantic tokens change */
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary:   var(--color-neutral-100);
    --color-text-secondary: var(--color-neutral-300);
    --color-text-tertiary:  var(--color-neutral-500);
    --color-text-inverse:   var(--color-neutral-900);
    --color-text-link:      var(--color-primary-400);

    --color-bg-page:     var(--color-neutral-900);
    --color-bg-surface:  var(--color-neutral-800);
    --color-bg-elevated: var(--color-neutral-700);
    --color-bg-muted:    var(--color-neutral-800);

    --color-border-default: rgba(255, 255, 255, 0.1);
    --color-border-strong:  rgba(255, 255, 255, 0.2);
  }
}
```

For Tailwind configuration of these tokens, see [New Project Checklist](../workflows/new-project-checklist.md).

### Primitive Example — Button Component (CSS)

```css
/* Button primitive built on tokens */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  cursor: pointer;
  border: none;
  text-decoration: none;
  line-height: 1;
}

/* Sizes */
.btn-sm { height: 2rem;   padding: 0 var(--space-3); font-size: 0.8125rem; } /* 32px */
.btn-md { height: 2.5rem; padding: 0 var(--space-4); font-size: 0.875rem; }  /* 40px */
.btn-lg { height: 3rem;   padding: 0 var(--space-6); font-size: 1rem; }      /* 48px */

/* Variants */
.btn-primary {
  background: var(--color-primary-600);
  color: var(--color-text-inverse);
}
.btn-primary:hover { background: var(--color-primary-700); }
.btn-primary:active { background: var(--color-primary-800); }

.btn-secondary {
  background: transparent;
  color: var(--color-primary-600);
  box-shadow: inset 0 0 0 1px var(--color-primary-600);
}
.btn-secondary:hover { background: var(--color-primary-50); }

.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
}
.btn-ghost:hover { background: var(--color-bg-muted); }

/* States */
.btn:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

### Pattern Example — Form Field (CSS)

```css
/* Form field pattern: label + input + error — built entirely on tokens */
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label { font-size: 0.875rem; font-weight: 500; color: var(--color-text-primary); }

.field-input {
  height: 2.5rem;  /* 40px */
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  font-size: 1rem;
  background: var(--color-bg-surface);
  transition: border-color var(--transition-fast);
}
.field-input:hover  { border-color: var(--color-border-strong); }
.field-input:focus  { outline: 2px solid var(--color-border-focus); outline-offset: -1px; }
.field-input[aria-invalid="true"] { border-color: var(--color-border-error); }

.field-error { font-size: 0.875rem; color: var(--color-text-error); }
.field-hint  { font-size: 0.75rem;  color: var(--color-text-tertiary); }
```

## Common Mistakes

1. **Starting with components instead of tokens** — building a Button component before defining your color palette and spacing scale means you will rebuild it when tokens change
2. **Token layer is too abstract** — `--color-alpha-7` means nothing to developers; use semantic names like `--color-text-primary`
3. **No semantic token layer** — using `--blue-600` directly in components makes theming (dark mode, brand variants) impossible without rewriting every component
4. **Documenting after the fact** — if documentation is a separate task, it never happens; document in the same PR as the code
5. **Building for hypothetical needs** — do not build a DataGrid component because you "might need it"; build what the product needs now, extract patterns as they repeat
6. **One-size-fits-all components** — a Button with 47 props is harder to use than 4 focused variants; favor composition over configuration
7. **No adoption tracking** — if you don't measure how much of the product uses the system, you cannot know if it is succeeding; target >80% system component usage
8. **Shared ownership** — "everyone owns it" means nobody maintains it; assign a single owner or team
9. **Pixel-perfect obsession** — the system should enforce consistency, not pixel-perfect uniformity; allow controlled flexibility through tokens

## Decision Tree

```
Building a design system?
│
├── Starting from scratch (greenfield)?
│   ├── Phase 1: Skip audit, go directly to tokens
│   ├── Phase 2: Define tokens (use New Project Checklist)
│   │   └── See ../workflows/new-project-checklist.md
│   ├── Phase 3: Build Button + Input first (most used)
│   ├── Phase 4: Add patterns as product features require them
│   └── Phase 5: Document each component as you build it
│
├── Existing product (brownfield)?
│   ├── Phase 1: Audit — catalog every unique value
│   ├── Phase 2: Consolidate into tokens (merge similar values)
│   ├── Phase 3: Wrap most-used components first (highest ROI)
│   ├── Phase 4: Migrate screen by screen (not all at once)
│   └── Phase 5: Measure adoption; target 80%+ coverage
│
├── How many components to start with?
│   ├── Minimum viable system: Button, Input, Typography (3 components)
│   ├── Solid foundation: + Card, Badge, Form Field, Alert (7 components)
│   └── Comprehensive: + Table, Nav, Modal, Tabs, Dropdown (12 components)
│
├── Which tool/framework?
│   ├── CSS custom properties → framework-agnostic, works everywhere
│   ├── Tailwind → config-driven, fast iteration, good for small teams
│   ├── Styled-components/Emotion → JS-driven tokens, good for React
│   └── Whatever your team already uses → adoption > purity
│
└── When to stop adding to the system?
    ├── When >80% of new features use system components
    ├── When custom one-offs are rare (<1 per sprint)
    └── Never fully "done" — maintain, iterate, deprecate
```

## Sources

- Kholmatova, Alla (2017). "Design Systems." Smashing Magazine.
- Frost, Brad (2016). "Atomic Design." https://atomicdesign.bradfrost.com/
- Suarez, Marco et al. (2019). "Design Systems Handbook." DesignBetter by InVision. https://www.designbetter.co/design-systems-handbook
- Material Design 3 — Design Tokens: https://m3.material.io/foundations/design-tokens
- Nathan Curtis — "Tokens in Design Systems." https://medium.com/eightshapes-llc/tokens-in-design-systems-25dd82d58421
- Salesforce Lightning Design System: https://www.lightningdesignsystem.com/
