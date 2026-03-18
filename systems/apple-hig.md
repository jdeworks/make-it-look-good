# Apple Human Interface Guidelines

> **TL;DR:** Apple HIG prioritizes clarity, deference, and depth. Key specifics: 44pt minimum tap targets, SF Pro system font, semantic colors that adapt to light/dark mode, and platform-specific navigation patterns.

## Core Principles

### The Three Themes
Apple's design philosophy rests on three pillars established in iOS 7 and refined through every release since:

1. **Clarity** -- Text is legible at every size, icons are precise and clear, adornments are subtle and appropriate. Function drives design. Every element serves a purpose.

2. **Deference** -- The UI helps users understand and interact with content without competing with it. The interface stays out of the way. Fluid motion, minimal chrome, translucent materials.

3. **Depth** -- Visual layers and realistic motion communicate hierarchy and facilitate understanding. Layers, transitions, and parallax create a sense of dimension without skeuomorphism.

### What Transfers to Web
Not everything in HIG is Apple-platform-specific. These principles apply universally to web design:
- **Content over chrome** -- minimize navigation overhead, let content breathe
- **Consistency** -- reuse patterns, don't reinvent interactions per page
- **Feedback** -- every interaction gets immediate visual response
- **Metaphors** -- use familiar mental models (tabs, toggles, lists)
- **User control** -- actions are reversible, destructive actions require confirmation

### Apple's Design Language (Post-iOS 15)
The current Apple aesthetic combines:
- Large, bold headings with generous whitespace
- Subtle material/vibrancy effects (frosted glass)
- Rounded rectangles (12-16px radius) everywhere
- Muted, accessible color palettes with bright accent colors
- System font (SF Pro) with careful weight variations
- Minimal borders -- separation through spacing and surface color

## Concrete Rules

### Touch Targets
- **Minimum 44x44pt** (44x44 CSS pixels) for all interactive elements
- This includes buttons, links, toggle switches, checkboxes, and icons
- **Target spacing:** at least 8pt between adjacent touch targets
- On web, ensure `<a>` and `<button>` elements have enough padding to meet this size, even if the visible element is smaller
- See [Touch Targets](../interaction/touch-targets.md) for comprehensive rules

### Typography (SF Pro Principles for Web)
- **Large Title:** 34pt bold -- used for top-level navigation (page titles)
- **Title 1:** 28pt regular -- section headings
- **Title 2:** 22pt regular -- sub-sections
- **Title 3:** 20pt semi-bold -- group headings
- **Headline:** 17pt semi-bold -- inline headings, labels
- **Body:** 17pt regular -- default reading text
- **Callout:** 16pt regular -- secondary body text
- **Footnote:** 13pt regular -- timestamps, metadata
- **Caption:** 12pt regular -- labels, helper text

For web, use the system font stack to get SF Pro on Apple devices:
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
             "SF Pro Display", system-ui, sans-serif;
```

### Color System
Apple uses **semantic colors** that adapt automatically to light/dark mode and accessibility settings:

| Role | Light Mode | Dark Mode | Use For |
|------|-----------|-----------|---------|
| Label (primary) | #000000 (alpha 1.0) | #FFFFFF (alpha 1.0) | Primary text |
| Label (secondary) | #3C3C43 (alpha 0.6) | #EBEBF5 (alpha 0.6) | Secondary text |
| Label (tertiary) | #3C3C43 (alpha 0.3) | #EBEBF5 (alpha 0.3) | Placeholder text |
| System Blue | #007AFF | #0A84FF | Default tint/accent |
| System Green | #34C759 | #30D158 | Success states |
| System Red | #FF3B30 | #FF453A | Errors, destructive |
| System Orange | #FF9500 | #FF9F0A | Warnings |
| Fill (primary) | #787880 (alpha 0.2) | #787880 (alpha 0.36) | Thin overlays |
| Fill (secondary) | #787880 (alpha 0.16) | #787880 (alpha 0.32) | Thicker overlays |
| Background (primary) | #FFFFFF | #000000 | Page background |
| Background (secondary) | #F2F2F7 | #1C1C1E | Grouped content |
| Background (tertiary) | #FFFFFF | #2C2C2E | Elevated surfaces |
| Separator | #3C3C43 (alpha 0.3) | #545458 (alpha 0.65) | Dividers |

### Spacing & Layout
- **Standard margins:** 16pt (compact width), 20pt (regular width)
- **Navigation bar height:** 44pt (standard), 96pt (large title)
- **Tab bar height:** 49pt
- **List row height:** 44pt minimum
- **Section spacing:** 35pt between grouped sections
- **Content inset:** 16-20pt from screen edges
- **Corner radius:** 10pt for small elements, 12-13pt for medium (cards, modals), 16pt for large surfaces, continuous (squircle) curve

### Elevation & Materials
Apple uses **materials** (blurred, tinted translucency) instead of drop shadows for elevation:
- **Regular material:** heavy blur, high background tinting
- **Thin material:** moderate blur, moderate tinting
- **Ultra-thin material:** light blur, light tinting
- Shadows are used sparingly -- primarily on floating elements and modals
- Surface color change (lighter surface = higher elevation) is the primary hierarchy signal in dark mode

### Motion
- **Duration:** 250-350ms for most transitions
- **Easing:** custom spring curves, not CSS ease/ease-in-out
- Spring parameters (approximate CSS): `cubic-bezier(0.2, 0.8, 0.2, 1)`
- **Meaningful motion:** elements animate from their origin (a button opens a sheet from the button's position)
- **Interruptible:** all animations can be interrupted by new gestures

## CSS/Implementation Patterns

### Apple-Style System Font Stack
```css
:root {
  --font-system: -apple-system, BlinkMacSystemFont, "SF Pro Text",
                 "SF Pro Display", system-ui, "Segoe UI", Roboto,
                 "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", ui-monospace, "Cascadia Code",
               "Source Code Pro", Menlo, Consolas, monospace;

  /* Apple-style type scale */
  --text-caption2: 0.6875rem;  /* 11px */
  --text-caption1: 0.75rem;    /* 12px */
  --text-footnote: 0.8125rem;  /* 13px */
  --text-subhead: 0.9375rem;   /* 15px */
  --text-callout: 1rem;        /* 16px */
  --text-body: 1.0625rem;      /* 17px */
  --text-headline: 1.0625rem;  /* 17px, semi-bold */
  --text-title3: 1.25rem;      /* 20px */
  --text-title2: 1.375rem;     /* 22px */
  --text-title1: 1.75rem;      /* 28px */
  --text-large-title: 2.125rem; /* 34px */
}

body {
  font-family: var(--font-system);
  font-size: var(--text-body);
  line-height: 1.47;  /* Apple's standard body line-height: 25/17 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Semantic Color Tokens (Light/Dark Adaptive)
```css
:root {
  color-scheme: light dark;

  /* Semantic text colors */
  --color-label: #000000;
  --color-label-secondary: rgba(60, 60, 67, 0.6);
  --color-label-tertiary: rgba(60, 60, 67, 0.3);

  /* Semantic backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F2F2F7;
  --bg-tertiary: #FFFFFF;
  --bg-grouped: #F2F2F7;
  --bg-grouped-secondary: #FFFFFF;

  /* Tint colors */
  --tint-blue: #007AFF;
  --tint-green: #34C759;
  --tint-red: #FF3B30;
  --tint-orange: #FF9500;
  --tint-yellow: #FFCC00;
  --tint-purple: #AF52DE;

  /* Fills & separators */
  --fill-primary: rgba(120, 120, 128, 0.2);
  --fill-secondary: rgba(120, 120, 128, 0.16);
  --separator: rgba(60, 60, 67, 0.29);
  --separator-opaque: #C6C6C8;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-label: #FFFFFF;
    --color-label-secondary: rgba(235, 235, 245, 0.6);
    --color-label-tertiary: rgba(235, 235, 245, 0.3);

    --bg-primary: #000000;
    --bg-secondary: #1C1C1E;
    --bg-tertiary: #2C2C2E;
    --bg-grouped: #000000;
    --bg-grouped-secondary: #1C1C1E;

    --tint-blue: #0A84FF;
    --tint-green: #30D158;
    --tint-red: #FF453A;
    --tint-orange: #FF9F0A;
    --tint-yellow: #FFD60A;
    --tint-purple: #BF5AF2;

    --fill-primary: rgba(120, 120, 128, 0.36);
    --fill-secondary: rgba(120, 120, 128, 0.32);
    --separator: rgba(84, 84, 88, 0.65);
    --separator-opaque: #38383A;
  }
}
```

### Frosted Glass / Material Effect
```css
.material-regular {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

.material-thin {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
}

@media (prefers-color-scheme: dark) {
  .material-regular {
    background: rgba(30, 30, 30, 0.72);
  }
  .material-thin {
    background: rgba(30, 30, 30, 0.6);
  }
}

/* Sticky nav with material effect */
.nav-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid var(--separator);
}
```

### Apple-Style Card
```css
.card {
  background: var(--bg-grouped-secondary);
  border-radius: 13px;
  padding: 16px;
  /* Apple uses minimal shadow, relies on surface color for elevation */
}

/* Inset grouped list style (like iOS Settings) */
.grouped-list {
  background: var(--bg-grouped);
  padding: 20px 16px;
}

.grouped-section {
  background: var(--bg-grouped-secondary);
  border-radius: 10px;
  overflow: hidden;
}

.grouped-section + .grouped-section {
  margin-top: 35px;
}

.grouped-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
  min-height: 44px;
  font-size: var(--text-body);
  color: var(--color-label);
}

.grouped-row + .grouped-row {
  border-top: 0.5px solid var(--separator);
  margin-left: 16px;
  padding-left: 0;
}

.grouped-row__detail {
  color: var(--color-label-secondary);
  font-size: var(--text-body);
}
```

### Apple-Style Spring Animation
```css
/* Approximate Apple's spring curve with cubic-bezier */
.spring-transition {
  transition: transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Sheet presentation (slides up from bottom) */
.sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-primary);
  border-radius: 13px 13px 0 0;
  transform: translateY(100%);
  transition: transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.sheet.is-open {
  transform: translateY(0);
}

/* Button press feedback */
.btn-apple {
  transition: transform 100ms ease, opacity 100ms ease;
}

.btn-apple:active {
  transform: scale(0.97);
  opacity: 0.7;
}
```

### Large Title Scroll Pattern
```css
.large-title-header {
  padding: 0 16px;
}

.large-title {
  font-size: var(--text-large-title);
  font-weight: 700;
  letter-spacing: 0.37px;
  line-height: 1.18;
  margin-bottom: 8px;
}

/* Collapsed state (apply via JS on scroll) */
.large-title-header.is-collapsed .large-title {
  font-size: var(--text-headline);
  font-weight: 600;
  transition: font-size 250ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

## Common Mistakes

1. **Using drop shadows for everything** -- Apple uses materials (translucent blur) and surface color for hierarchy. Heavy drop shadows look dated and non-Apple.

2. **Sharp corners on cards and buttons** -- Apple uses large corner radii (10-16px) with continuous curves (squircles). `border-radius: 4px` looks more Google than Apple.

3. **Too many colors** -- Apple interfaces are predominantly neutral (white/gray surfaces) with a single tint color as accent. Using 4-5 bright colors at once breaks the aesthetic.

4. **Ignoring dark mode** -- HIG is built around semantic colors that adapt. If you use hardcoded hex values, dark mode will break. Use CSS custom properties with `prefers-color-scheme`.

5. **Small touch targets** -- 44x44pt is not a suggestion. Anything smaller will feel broken on touch devices. Even text links need enough padding.

6. **Using thin (100-200) font weights** -- SF Pro's thin weights are designed for large display sizes (60px+). At body sizes, use regular (400) or medium (500).

7. **Ignoring the system font** -- using a custom font where the system font would work better. SF Pro is optimized for screens and renders beautifully at all sizes.

8. **Over-decorating** -- Apple's aesthetic is about restraint. Every border, shadow, color, and element you add should pass the test: "Does removing this make it worse?"

## Decision Tree

**"How do I make my web app feel Apple-like?"**

```
START: Are you using the system font stack?
├── NO --> Switch to -apple-system, system-ui stack.
│         This alone changes the entire feel on Apple devices.
│
└── YES --> Is your spacing consistent and generous?
    ├── NO --> Use 16px page margins, 44px min row heights,
    │         35px section gaps. Double your current whitespace.
    │
    └── YES --> Are your corner radii 10px+?
        ├── NO --> Set cards/modals to 12-13px, buttons to 10px,
        │         small elements to 8px. Be consistent.
        │
        └── YES --> Do you have dark mode support?
            ├── NO --> Implement semantic color tokens with
            │         prefers-color-scheme media query.
            │
            └── YES --> Are surfaces using materials/blur?
                ├── NO --> Add backdrop-filter: blur(20px)
                │         to sticky headers and overlays.
                │
                └── YES --> Audit: remove unnecessary borders,
                            shadows, and decorative elements.
                            Apple is about what you remove.
```

## Sources

- Apple. (2024). *Human Interface Guidelines.* developer.apple.com/design/human-interface-guidelines
- Apple. (2024). *SF Pro Font Family.* developer.apple.com/fonts
- Apple. (2024). *iOS Design Themes.* developer.apple.com/design/human-interface-guidelines/designing-for-ios
- Apple. (2024). *Color (Human Interface Guidelines).* developer.apple.com/design/human-interface-guidelines/color
- Apple. (2024). *Typography (Human Interface Guidelines).* developer.apple.com/design/human-interface-guidelines/typography
- Apple. (2024). *Motion (Human Interface Guidelines).* developer.apple.com/design/human-interface-guidelines/motion

*Related: [Touch Targets](../interaction/touch-targets.md) | [Design Tokens](design-tokens.md)*
