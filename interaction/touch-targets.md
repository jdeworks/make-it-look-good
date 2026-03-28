# Touch Targets

> **TL;DR:** Minimum touch target: 44x44px (WCAG 2.5.8) or 48x48dp (Material Design). Minimum spacing between targets: 8px. Use padding to enlarge hit areas without changing visual size. Desktop click targets: minimum 24x24px.

## Core Principles

1. **Fingers are imprecise** — the average adult fingertip covers ~7mm (about 44px at 160dpi). Targets smaller than this cause mis-taps and frustration.
2. **Fitts's Law applies** — time to hit a target is proportional to distance / target size. Doubling target size meaningfully reduces interaction time, especially for frequently used actions.
3. **The tap target is not the visual element** — a 16px icon can have a 48px tap target via padding. Visual size and interactive size are independent.
4. **Spacing prevents accidental activation** — adjacent targets without gaps cause mis-taps. 8px minimum between interactive elements.
5. **Thumb reach drives mobile layout** — bottom of screen is easiest to reach; top corners are hardest. Place primary actions in the natural thumb zone.

## Concrete Rules

### Minimum Sizes
| Standard | Minimum Size | Context |
|----------|-------------|---------|
| WCAG 2.5.8 (AAA) | 44 x 44px | Web Content Accessibility Guidelines |
| WCAG 2.5.5 (AA) | 24 x 24px target with 44px spacing | Minimum with adequate spacing |
| Material Design 3 | 48 x 48dp | Google's recommendation |
| Apple HIG | 44 x 44pt | iOS/macOS Human Interface Guidelines |
| Desktop click targets | 24 x 24px min | Mouse precision allows smaller targets |

### Spacing Between Targets
| Spacing | When |
|---------|------|
| 8px minimum | Between any two touch targets |
| 12–16px comfortable | Between buttons in a toolbar |
| 16–24px generous | Between destructive actions and others |

### Common Violators — Required Sizes
| Element | Common Size | Required Minimum | Fix |
|---------|------------|-------------------|-----|
| Icon buttons | 24x24px icon | 44x44px target | Add padding: 10px |
| Nav links | Text height ~20px | 44px tall target | `min-height: 44px; padding-block: 12px` |
| Checkbox/Radio | 16x16px input | 44x44px target | Enlarge label's clickable area |
| Close buttons (X) | 16x16px icon | 44x44px target | Generous padding on the button |
| Breadcrumb links | ~16px tall text | 44px tall target | Increase padding |
| Pagination numbers | 24x24px | 44x44px target | `min-width: 44px; min-height: 44px` |
| Social media icons | 24x24px icon | 44x44px target | Padding or larger wrapper |

### Thumb Zone on Mobile
| Screen Region | Reachability | Place Here |
|---------------|-------------|------------|
| Bottom center | Easy — natural thumb rest | Primary actions, main navigation |
| Bottom edges | Comfortable | Secondary actions, tabs |
| Middle of screen | Comfortable | Content, scrollable areas |
| Top center | Stretch required | Status info, page titles (read-only) |
| Top corners | Hard — requires grip shift | Infrequent actions only (settings, profile) |

## CSS/Implementation Patterns

### Padding to Enlarge Hit Area
```css
/* Icon button: 24px icon, 48px touch target */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
}

.icon-btn svg {
  width: 24px;
  height: 24px;
}
```

### Invisible Extended Hit Area
```css
/* Extend clickable area beyond visual bounds with a pseudo-element */
.small-link {
  position: relative;
}

.small-link::after {
  content: "";
  position: absolute;
  inset: -8px;                /* extends 8px in every direction */
  min-width: 44px;
  min-height: 44px;
}
```

### Navigation Links
```css
.nav-link {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 8px 16px;
  text-decoration: none;
}
```

### Checkbox / Radio with Label
```css
/* Make the label the clickable target, not just the tiny input */
.form-check {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 4px 0;
  cursor: pointer;
}

.form-check input[type="checkbox"],
.form-check input[type="radio"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}
```

### Tailwind Utility Pattern
```html
<!-- Icon button with 44px minimum target -->
<button class="inline-flex items-center justify-center min-h-11 min-w-11 p-2.5 rounded-lg">
  <svg class="w-6 h-6"><!-- icon --></svg>
</button>

<!-- Nav link with adequate height -->
<a href="/page" class="flex items-center min-h-11 px-4 py-2">
  Link Text
</a>

<!-- Spacing between adjacent targets -->
<div class="flex gap-2">  <!-- 8px gap -->
  <button class="min-h-11 min-w-11 ...">A</button>
  <button class="min-h-11 min-w-11 ...">B</button>
</div>
```

### Responsive — Larger on Touch, Smaller on Desktop
```css
/* Desktop: 32px targets are fine */
.action-btn {
  min-width: 32px;
  min-height: 32px;
  padding: 4px;
}

/* Touch devices: 44px minimum */
@media (pointer: coarse) {
  .action-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 10px;
  }
}
```

## Context-Aware Exceptions (WCAG 2.5.8)

Not all interactive elements need the same target size. WCAG 2.5.8 defines exceptions based on context:

| Context | Rule | Rationale |
|---------|------|-----------|
| **Inline text links** (inside `<p>`, `<blockquote>`, etc.) | Exempt from target size requirements | Users expect paragraph links to be text-sized; enlarging would break reading flow |
| **Navigation links** | Must meet full target size | Navigation is high-frequency, critical interaction |
| **Footer links** | Relaxed but not zero — 16px desktop / 24px mobile minimum | Footer links are low-frequency; overly strict sizing is impractical |
| **Buttons / styled links** | Must meet full target size | Button-styled elements signal "click me" and need adequate sizing |

The [Design Analyzer](../docs/analyzer.html) automatically classifies interactive elements by DOM ancestry (nav, footer, inline paragraph, button-styled) and applies appropriate severity levels.

## Common Mistakes

1. **Relying on icon size as target size** — a 24px icon with no padding has a 24px target. Users will mis-tap constantly. Always pad to at least 44px.
2. **Forgetting spacing between targets** — two 48px buttons touching each other effectively merge into one confusing zone. Add 8px+ gap.
3. **Desktop-only testing** — targets that work fine with a mouse fail on tablets. Use `@media (pointer: coarse)` to detect touch devices and increase sizes.
4. **Text links in body copy** — short links like "here" can be tiny targets. Ensure link text is descriptive and padding makes the target at least 44px tall. Note: inline text links in paragraphs are exempt from WCAG 2.5.8 target size requirements, but padding still improves usability.
5. **Fixed headers with tiny buttons** — hamburger menus, close buttons, and back arrows in headers are frequent offenders. These are high-frequency targets — make them generously sized.
6. **Overlapping hit areas** — using negative margins or absolute positioning can cause targets to overlap. Test by outlining all interactive elements.
7. **Ignoring the thumb zone** — placing the most important action in the top-right corner of a mobile screen makes it the hardest to reach. Primary actions belong at the bottom.
8. **Treating all links equally** — footer links, inline text links, and navigation links have different sizing expectations. Applying strict 44px minimums to footer text links creates unnecessary noise.

## Decision Tree

```
How big should my touch target be?
├─ Mobile / tablet interface → 44x44px minimum (48x48px ideal)
├─ Desktop-only interface → 24x24px minimum (32px+ recommended)
├─ Both mobile and desktop → 44x44px on touch, 32px+ on pointer: fine
└─ Not sure → Default to 44x44px — it works everywhere

How do I make a small icon tappable?
├─ Icon button → Add padding: `min-width: 44px; min-height: 44px`
├─ Inline icon in text → Use `::after` pseudo-element to extend hit area
├─ Icon inside a container → Make the whole container clickable
└─ Can't change padding → Use negative margins on a pseudo-element

Where should I place primary actions on mobile?
├─ Single primary action → Bottom center, floating or fixed
├─ 2–5 navigation items → Bottom tab bar
├─ Contextual action → Inline near relevant content
├─ Destructive action → Require confirmation; keep away from primary action
└─ Infrequent settings → Top corners or behind a menu — fine if hard to reach
```

## Sources
- [WCAG 2.5.8 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) — 24px minimum with spacing
- [WCAG 2.5.5 — Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced) — 44px recommendation
- [Material Design 3 — Touch Targets](https://m3.material.io/foundations/accessible-design/accessibility-basics) — 48dp minimum
- [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) — 44pt minimum
- [Fitts's Law](https://www.interaction-design.org/literature/topics/fitts-law) — mathematical basis for target sizing
- [Steven Hoober — Design for Fingers and Thumbs](https://www.smashingmagazine.com/2012/02/finger-friendly-design-ideal-mobile-touchscreen-target-sizes/) — thumb zone research
