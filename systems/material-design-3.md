# Material Design 3

> **TL;DR:** MD3 uses dynamic color from a source color, 5 key color roles, and a tonal palette system. It emphasizes shape, motion, and adaptive layouts. Use as a reference system even if not building for Android.

## Core Principles

### What Changed from MD2 to MD3
Material Design 3 (also called "Material You") is a significant evolution from Material Design 2:
- **Dynamic color** replaces the fixed primary/secondary palette -- colors are derived algorithmically from a single source color
- **Tonal elevation** replaces shadow-based elevation -- surfaces get lighter/more tinted at higher elevations instead of (or in addition to) getting more shadow
- **Shape** becomes a first-class system with defined small/medium/large/extra-large categories
- **Motion** is simplified to two main easing types (emphasized and standard)
- **Typography** shifts to a role-based scale (display, headline, title, body, label) instead of size-based

### The Color System
MD3's color system generates an entire palette from a single source color:

1. **Source color** -- your brand's primary hue
2. **Algorithm** (HCT color space) generates **5 tonal palettes** of 13 tones each (0-100)
3. **Color roles** are assigned from specific tones in these palettes

The 5 key color groups:
- **Primary** -- main brand actions, FABs, active states
- **Secondary** -- less prominent components, filters, chips
- **Tertiary** -- contrasting accent, complementary to primary
- **Error** -- error states, destructive actions
- **Neutral** -- surfaces, backgrounds, outlines

### Tonal Palettes
Each key color generates 13 tonal values:

| Tone | Light theme usage | Dark theme usage |
|------|------------------|-----------------|
| 0 | -- | -- |
| 10 | On-colors (text on primary) | Containers |
| 20 | -- | Surface variants |
| 30 | -- | Primary/Secondary/Tertiary |
| 40 | Primary/Secondary/Tertiary | -- |
| 50 | -- | -- |
| 60 | -- | -- |
| 70 | -- | On-containers |
| 80 | Containers | On-colors |
| 90 | Container variants | -- |
| 95 | Surface variants | -- |
| 99 | Surface | -- |
| 100 | Background | -- |

### Elevation Model
MD3 uses **tonal elevation** -- higher surfaces are more tinted, not just more shadowed:

| Level | Elevation | Shadow | Surface tint opacity |
|-------|-----------|--------|---------------------|
| 0 | 0dp | None | 0% |
| 1 | 1dp | Subtle | 5% |
| 2 | 3dp | Low | 8% |
| 3 | 6dp | Medium | 11% |
| 4 | 8dp | Medium-high | 12% |
| 5 | 12dp | High | 14% |

In dark theme, tonal elevation is the primary hierarchy signal (shadows are barely visible on dark surfaces).

## Concrete Rules

### Color Role Assignments
For light theme, using a blue source color (#6750A4 as reference):

| Role | Token | Description | Contrast requirement |
|------|-------|-------------|---------------------|
| Primary | `--md-sys-color-primary` | Key actions, FABs | -- |
| On Primary | `--md-sys-color-on-primary` | Text/icons on primary | 4.5:1 against primary |
| Primary Container | `--md-sys-color-primary-container` | Filled cards, selected states | -- |
| On Primary Container | `--md-sys-color-on-primary-container` | Text on primary container | 4.5:1 against container |
| Secondary | `--md-sys-color-secondary` | Filters, chips | -- |
| Secondary Container | `--md-sys-color-secondary-container` | Selected chips, tonal buttons | -- |
| Tertiary | `--md-sys-color-tertiary` | Complementary accent | -- |
| Error | `--md-sys-color-error` | Error states | -- |
| Surface | `--md-sys-color-surface` | Background | -- |
| On Surface | `--md-sys-color-on-surface` | Body text | 4.5:1 against surface |
| Surface Variant | `--md-sys-color-surface-variant` | Card backgrounds, secondary surfaces | -- |
| On Surface Variant | `--md-sys-color-on-surface-variant` | Secondary text | 4.5:1 against surface variant |
| Outline | `--md-sys-color-outline` | Borders, dividers | 3:1 against surface |
| Outline Variant | `--md-sys-color-outline-variant` | Subtle dividers | -- |

### Shape System
MD3 defines four shape categories applied consistently across components:

| Shape | Corner radius | Used for |
|-------|--------------|----------|
| None | 0px | -- |
| Extra Small | 4px | Tooltips, snackbars |
| Small | 8px | Chips, small buttons, text fields |
| Medium | 12px | Cards, dialogs, floating action buttons |
| Large | 16px | Large cards, navigation drawers |
| Extra Large | 28px | Sheets, large FABs |
| Full | 9999px (50%) | Badges, pills, toggles |

**Rule:** Every component gets exactly one shape category. Don't mix.

### Typography Scale (Roles, Not Sizes)

| Role | Size | Line height | Weight | Tracking | Use for |
|------|------|------------|--------|----------|---------|
| Display Large | 57px | 64px | 400 | -0.25px | Hero numbers |
| Display Medium | 45px | 52px | 400 | 0 | Section headers |
| Display Small | 36px | 44px | 400 | 0 | Page titles |
| Headline Large | 32px | 40px | 400 | 0 | Content headers |
| Headline Medium | 28px | 36px | 400 | 0 | Sub-headers |
| Headline Small | 24px | 32px | 400 | 0 | Card titles |
| Title Large | 22px | 28px | 400 | 0 | Top app bar |
| Title Medium | 16px | 24px | 500 | 0.15px | Tabs, subtitles |
| Title Small | 14px | 20px | 500 | 0.1px | Small headers |
| Body Large | 16px | 24px | 400 | 0.5px | Primary body |
| Body Medium | 14px | 20px | 400 | 0.25px | Secondary body |
| Body Small | 12px | 16px | 400 | 0.4px | Captions |
| Label Large | 14px | 20px | 500 | 0.1px | Buttons, tabs |
| Label Medium | 12px | 16px | 500 | 0.5px | Small buttons |
| Label Small | 11px | 16px | 500 | 0.5px | Badges |

### Motion System

| Type | Duration | Easing | Use for |
|------|----------|--------|---------|
| Emphasized (enter) | 500ms | `cubic-bezier(0.2, 0, 0, 1)` | Elements entering the screen |
| Emphasized (exit) | 200ms | `cubic-bezier(0.2, 0, 0, 1)` | Elements leaving the screen |
| Emphasized Accelerate | 200ms | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Elements moving off-screen |
| Emphasized Decelerate | 400ms | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Elements arriving on-screen |
| Standard | 300ms | `cubic-bezier(0.2, 0, 0, 1)` | Most state changes |
| Standard Accelerate | 200ms | `cubic-bezier(0.3, 0, 1, 1)` | Fading out |
| Standard Decelerate | 250ms | `cubic-bezier(0, 0, 0, 1)` | Fading in |

**Rule:** Entering is always slower than exiting. Users need more time to perceive what's arriving than what's leaving.

## CSS/Implementation Patterns

### Full Color Token System
```css
:root {
  /* Generate these from your source color using the
     Material Theme Builder: https://m3.material.io/theme-builder */

  /* Primary */
  --md-sys-color-primary: #6750A4;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #EADDFF;
  --md-sys-color-on-primary-container: #21005D;

  /* Secondary */
  --md-sys-color-secondary: #625B71;
  --md-sys-color-on-secondary: #FFFFFF;
  --md-sys-color-secondary-container: #E8DEF8;
  --md-sys-color-on-secondary-container: #1D192B;

  /* Tertiary */
  --md-sys-color-tertiary: #7D5260;
  --md-sys-color-on-tertiary: #FFFFFF;
  --md-sys-color-tertiary-container: #FFD8E4;
  --md-sys-color-on-tertiary-container: #31111D;

  /* Error */
  --md-sys-color-error: #B3261E;
  --md-sys-color-on-error: #FFFFFF;
  --md-sys-color-error-container: #F9DEDC;
  --md-sys-color-on-error-container: #410E0B;

  /* Surface */
  --md-sys-color-surface: #FFFBFE;
  --md-sys-color-on-surface: #1C1B1F;
  --md-sys-color-surface-variant: #E7E0EC;
  --md-sys-color-on-surface-variant: #49454F;
  --md-sys-color-surface-container-lowest: #FFFFFF;
  --md-sys-color-surface-container-low: #F7F2FA;
  --md-sys-color-surface-container: #F3EDF7;
  --md-sys-color-surface-container-high: #ECE6F0;
  --md-sys-color-surface-container-highest: #E6E0E9;

  /* Outline */
  --md-sys-color-outline: #79747E;
  --md-sys-color-outline-variant: #CAC4D0;

  /* Inverse */
  --md-sys-color-inverse-surface: #313033;
  --md-sys-color-inverse-on-surface: #F4EFF4;
  --md-sys-color-inverse-primary: #D0BCFF;

  /* Shape */
  --md-sys-shape-corner-none: 0px;
  --md-sys-shape-corner-extra-small: 4px;
  --md-sys-shape-corner-small: 8px;
  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-large: 16px;
  --md-sys-shape-corner-extra-large: 28px;
  --md-sys-shape-corner-full: 9999px;

  /* Motion */
  --md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
  --md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
  --md-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-easing-standard-accelerate: cubic-bezier(0.3, 0, 1, 1);
  --md-sys-motion-easing-standard-decelerate: cubic-bezier(0, 0, 0, 1);

  --md-sys-motion-duration-short1: 50ms;
  --md-sys-motion-duration-short2: 100ms;
  --md-sys-motion-duration-short3: 150ms;
  --md-sys-motion-duration-short4: 200ms;
  --md-sys-motion-duration-medium1: 250ms;
  --md-sys-motion-duration-medium2: 300ms;
  --md-sys-motion-duration-medium3: 350ms;
  --md-sys-motion-duration-medium4: 400ms;
  --md-sys-motion-duration-long1: 450ms;
  --md-sys-motion-duration-long2: 500ms;
}
```

### Dark Theme
Dark theme values are generated by the [Material Theme Builder](https://m3.material.io/theme-builder). Key shift: primary moves from tone 40 → 80, surfaces from tone 99 → tone 10-20. Export both light and dark token sets.

### Tonal Elevation (Surface Tint)
```css
/* Instead of (or in addition to) shadow, surfaces get tinted */
.surface-level-0 {
  background: var(--md-sys-color-surface);
}

.surface-level-1 {
  background: var(--md-sys-color-surface-container-low);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.surface-level-2 {
  background: var(--md-sys-color-surface-container);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08),
              0 2px 6px rgba(0, 0, 0, 0.06);
}

.surface-level-3 {
  background: var(--md-sys-color-surface-container-high);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06),
              0 4px 8px rgba(0, 0, 0, 0.08);
}

.surface-level-4 {
  background: var(--md-sys-color-surface-container-highest);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06),
              0 8px 16px rgba(0, 0, 0, 0.1);
}
```

### MD3 Filled Button
```css
.md3-button-filled {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 24px;
  border: none;
  border-radius: var(--md-sys-shape-corner-full);
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.1px;
  line-height: 20px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: box-shadow var(--md-sys-motion-duration-short4)
              var(--md-sys-motion-easing-standard);
}

.md3-button-filled:hover {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12),
              0 1px 2px rgba(0, 0, 0, 0.08);
}

/* State layer (MD3 uses overlay for hover/focus/pressed states) */
.md3-button-filled::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--md-sys-color-on-primary);
  opacity: 0;
  transition: opacity var(--md-sys-motion-duration-short3)
              var(--md-sys-motion-easing-standard);
}

.md3-button-filled:hover::after { opacity: 0.08; }
.md3-button-filled:focus-visible::after { opacity: 0.12; }
.md3-button-filled:active::after { opacity: 0.12; }
```

### MD3 Card
```css
.md3-card-elevated {
  background: var(--md-sys-color-surface-container-low);
  border-radius: var(--md-sys-shape-corner-medium);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  padding: 16px;
  transition: box-shadow var(--md-sys-motion-duration-short4)
              var(--md-sys-motion-easing-standard);
}

.md3-card-filled {
  background: var(--md-sys-color-surface-container-highest);
  border-radius: var(--md-sys-shape-corner-medium);
  padding: 16px;
}

.md3-card-outlined {
  background: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium);
  padding: 16px;
}
```

## Common Mistakes

1. **Using shadow-only elevation** -- MD3's key innovation is tonal elevation. In dark mode especially, shadows are nearly invisible. Use surface color changes as the primary elevation signal.

2. **Applying MD2 colors to MD3** -- MD3 has "container" variants (primary-container, secondary-container) that MD2 did not. These lighter tints are essential for filled components.

3. **Inconsistent shape categories** -- if your cards use 12px radius, all cards must use 12px radius. Don't mix shape categories within the same component type.

4. **Forgetting state layers** -- MD3 uses semi-transparent overlays for hover (8% opacity), focus (12%), and pressed (12%) states. Without these, components feel static.

5. **Too many surface levels** -- most layouts need 2-3 surface levels at most. Using all 5 creates confusing hierarchy.

6. **Ignoring the on-* color roles** -- every surface color has a corresponding "on" color for text/icons. Using random text colors breaks contrast guarantees.

7. **Static motion** -- MD3 specifies different durations for entering (longer) vs exiting (shorter). Using the same duration for both feels unnatural.

8. **Not using the Material Theme Builder** -- hand-picking MD3 colors is error-prone. The [Theme Builder](https://m3.material.io/theme-builder) generates a complete, harmonious, contrast-safe palette from a single source color.

## Decision Tree

**"Should I use Material Design 3?"**

```
Are you building for Android/Google platforms?
├── YES --> Use MD3. It's the platform standard. Users expect it.
│          Use Material Web Components or Jetpack Compose.
│
└── NO -->
    Do you need a complete, well-documented design system
    with tokens, components, and guidelines?
    ├── YES --> MD3 is excellent as a reference system.
    │          Use its color algorithm, shape scale, and motion
    │          values, even with custom components.
    │
    └── NO (have your own system) -->
        Cherry-pick:
        - Tonal elevation model (better than shadow-only)
        - Dynamic color generation (HCT algorithm)
        - State layer pattern (hover/focus overlays)
        - Motion durations (enter slower, exit faster)
```

## Sources

- Google. (2024). *Material Design 3.* m3.material.io
- Google. (2024). *Material Theme Builder.* m3.material.io/theme-builder
- Google. (2024). *Dynamic Color.* m3.material.io/styles/color/dynamic
- Google. (2024). *Elevation (Material Design 3).* m3.material.io/styles/elevation/overview
- Google. (2024). *Shape (Material Design 3).* m3.material.io/styles/shape/overview
- Google. (2024). *Motion (Material Design 3).* m3.material.io/styles/motion/overview
- Scheifer, J. (2022). *Material Design 3 for Web Developers.* web.dev

*Related: [Color Systems](../color/color-systems.md) | [Design Tokens](design-tokens.md) | [Animation Timing](../interaction/animation-timing.md)*
