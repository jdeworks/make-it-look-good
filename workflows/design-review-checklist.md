# Design Review Checklist

> **TL;DR:** A checklist for reviewing UI designs against established principles and accessibility standards.

## Core Principles

A design review catches issues **before they ship**. This checklist is organized by category, with specific pass/fail criteria and numbers for each item. Run through it systematically for every screen, component, or page.

**When to use this checklist:**
- Before handing off designs to development
- During code review of UI changes
- When auditing an existing interface for quality improvements
- As part of QA before release

## Concrete Rules

### Spacing Review

- [ ] **Consistent scale:** All spacing values come from the defined scale (e.g., 4, 8, 12, 16, 24, 32, 48, 64) — no arbitrary values like 13px or 37px
- [ ] **Related elements are closer together** than unrelated ones ([Gestalt proximity](../foundations/gestalt-principles.md)) — gap between related items should be at most 50% of the gap between groups
- [ ] **Padding inside containers** is consistent — same padding on all sides, or intentionally asymmetric (e.g., 16px horizontal, 12px vertical)
- [ ] **Section spacing increases with hierarchy** — spacing between sections > spacing between subsections > spacing between items
- [ ] **No double-spacing errors** — margin on child + padding on parent doesn't create unintentionally large gaps
- [ ] **Minimum touch/click padding:** Interactive elements have at least 8px of padding around the text/icon
- See [Spacing System](../layout/spacing-system.md) and [Whitespace](../layout/whitespace.md)

**Pass criteria:** Zero arbitrary spacing values; clear visual grouping of related elements.

### Typography Review

- [ ] **Body text size:** Minimum 16px (1rem) for body copy on web — **fail if below 14px**
- [ ] **Heading hierarchy:** Each heading level is visibly distinct; minimum 20% size increase between levels
- [ ] **Line height:** Body text between 1.4 and 1.6 (ideal: 1.5); headings between 1.1 and 1.3
- [ ] **Line length (measure):** Body text between 45-75 characters per line — **fail if over 90 characters**
- [ ] **Font weight contrast:** At least 2 distinct weights used (regular + bold); no more than 4 weights total
- [ ] **No orphaned headings:** Headings are visually connected to the content they introduce (closer to content below than content above)
- [ ] **Consistent alignment:** Text blocks share a consistent alignment axis (left-aligned in LTR languages; center only for short hero text)
- [ ] **Font count:** Maximum 2 font families (1 for headings, 1 for body) — **fail if more than 3**
- See [Type Scale](../typography/type-scale.md), [Readability](../typography/readability.md), and [Font Pairing](../typography/font-pairing.md)

**Pass criteria:** All body text >= 16px, line height 1.4-1.6, measure 45-75ch.

### Color Review

- [ ] **Normal text contrast:** Minimum 4.5:1 ratio against background (WCAG AA) — **fail if below 3:1**
- [ ] **Large text contrast:** Minimum 3:1 ratio (text >= 18px bold or >= 24px regular)
- [ ] **UI component contrast:** Interactive borders, icons, and focus indicators at minimum 3:1 against adjacent colors
- [ ] **Color not sole indicator:** Information conveyed by color is also conveyed by text, icon, or pattern — **fail if color is only differentiator**
- [ ] **Palette consistency:** All colors come from the defined palette; no one-off hex values
- [ ] **Color-blind safe:** Tested with protanopia, deuteranopia simulators — red/green combinations have an additional differentiator
- [ ] **Sufficient surface contrast:** Card/surface backgrounds differ from page background by at least 3% lightness or have a visible border
- [ ] **No vibrating color combinations:** High-saturation complementary colors (e.g., red text on blue) are not placed adjacent to each other
- See [Contrast and Accessibility](../color/contrast-and-accessibility.md) and [Color-Blind Safety](../color/color-blind-safety.md)

**Pass criteria:** All text meets 4.5:1 (AA); no color-only meaning; palette is consistent.

### Interactive Elements Review

- [ ] **Touch target size:** Minimum 44x44px for mobile, 32x32px for desktop — **fail if below 24x24px**
- [ ] **Touch target spacing:** At least 8px gap between adjacent targets on mobile
- [ ] **Hover state:** Every clickable element has a visible hover state (color change, underline, shadow, or scale)
- [ ] **Focus state:** Every interactive element has a visible focus indicator — minimum 2px outline, 3:1 contrast ratio against surrounding area
- [ ] **Active/pressed state:** Buttons show a pressed state (darker shade, subtle scale, or shadow reduction)
- [ ] **Disabled state:** Disabled elements are visually distinct (reduced opacity 0.4-0.6 or grayed out) but still readable; contrast may be reduced to 3:1
- [ ] **Loading state:** Any action that takes >300ms shows a loading indicator
- [ ] **Cursor:** Pointer cursor on clickable elements; not-allowed on disabled; grab on draggable
- See [Touch Targets](../interaction/touch-targets.md), [Micro-Interactions](../interaction/micro-interactions.md), and [Loading States](../interaction/loading-states.md)

**Pass criteria:** All targets >= 44px on mobile; every interactive element has hover + focus states.

### Visual Hierarchy Review

- [ ] **Clear primary action:** Each screen/section has one visually dominant action (largest, highest contrast, most saturated) — **fail if two actions compete equally**
- [ ] **Action hierarchy:** Primary (filled/high contrast) > Secondary (outlined/muted) > Tertiary (text/ghost) — at most 1 primary action per view
- [ ] **Visual scanning:** Content follows F-pattern (content pages) or Z-pattern (landing pages) — most important content is top-left or center
- [ ] **Grouping:** Related items are visually grouped by proximity, shared background, or border — 3-7 groups per screen section (Miller's law)
- [ ] **Progressive disclosure:** Secondary information is hidden behind interaction (expand, tab, tooltip) — not everything shown at once
- [ ] **Squint test:** When you squint at the screen, the visual hierarchy is still clear (primary action, headings, groups are distinguishable)
- See [Visual Hierarchy](../layout/visual-hierarchy.md), [Hick's Law](../foundations/hicks-law.md), and [Cognitive Load](../foundations/cognitive-load.md)

**Pass criteria:** One clear primary action; content logically grouped; squint test passes.

### Component-Specific Review

#### Buttons
- [ ] Minimum height 36px (desktop), 44px (mobile)
- [ ] Minimum horizontal padding 16px
- [ ] Label is a verb or verb phrase ("Save changes" not "OK")
- [ ] Maximum 1 primary button per view section
- See [Buttons](../components/buttons.md)

#### Forms
- [ ] Labels are above inputs (not placeholder-only)
- [ ] Input height minimum 40px (desktop), 48px (mobile)
- [ ] Error messages are below the field, in red with an icon — not color alone
- [ ] Required fields are marked; optional is labeled if most fields are required
- See [Forms](../components/forms.md)

#### Cards
- [ ] Consistent border-radius across all cards
- [ ] Content padding minimum 16px
- [ ] If clickable, the entire card is the click target — not just a small link inside
- See [Cards](../components/cards.md)

#### Tables
- [ ] Header row is visually distinct (bold, background color, or border)
- [ ] Row height minimum 40px for readability
- [ ] Numeric data is right-aligned; text is left-aligned
- [ ] Horizontal scroll with sticky first column on mobile (or card layout)
- See [Tables and Lists](../components/tables-and-lists.md)

#### Navigation
- [ ] Current location is clearly indicated (active state)
- [ ] Maximum 7 top-level items (5 for mobile bottom nav)
- [ ] Touch targets meet 44px minimum on mobile
- See [Navigation](../components/navigation.md)

### Accessibility Review (WCAG AA)

- [ ] **Semantic HTML:** Headings use h1-h6 in order; lists use ul/ol; buttons use `<button>`
- [ ] **Alt text:** Every informational image has descriptive alt text; decorative images have `alt=""`
- [ ] **Keyboard navigation:** All functionality is accessible via keyboard (Tab, Enter, Escape, Arrow keys)
- [ ] **Skip link:** "Skip to main content" link is present as first focusable element
- [ ] **Form labels:** Every input has an associated `<label>` element (not just placeholder)
- [ ] **ARIA landmarks:** Page has main, nav, and banner landmarks at minimum
- [ ] **Motion:** Animations respect `prefers-reduced-motion` media query
- [ ] **Zoom:** Content is readable and functional at 200% zoom without horizontal scroll

**Pass criteria:** All items checked; zero hard fails on contrast, target size, or keyboard access.

### Performance Review

- [ ] **Web fonts:** Maximum 2 font families, 4 weights total — each weight adds ~20-50KB
- [ ] **Font loading:** font-display: swap or optional set to prevent invisible text (FOIT)
- [ ] **Images:** Largest image below 200KB; all images have width/height to prevent layout shift
- [ ] **Above-the-fold:** Critical CSS is inlined or loaded first; first contentful paint under 1.5s
- [ ] **Layout shift:** CLS (Cumulative Layout Shift) below 0.1 — reserve space for dynamic content
- See [Web Font Loading](../typography/web-font-loading.md)

**Pass criteria:** 2 fonts max; font-display set; CLS < 0.1; images sized and optimized.

## CSS/Implementation Patterns

### Quick Contrast Check in Browser DevTools

```
/* Chrome DevTools: Inspect element → color picker shows contrast ratio */
/* Firefox DevTools: Accessibility tab → Check for Issues → Contrast */
/* Use Lighthouse audit: Accessibility section checks contrast automatically */
```

### Focus Indicator Pattern

```css
/* Ensure all interactive elements have visible focus */
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Remove default outline only when :focus-visible is supported */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Reduced Motion Safety

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Measure (Line Length) Control

```css
/* Cap line length for readability */
.prose {
  max-width: 65ch; /* ~45-75 characters depending on font */
}

/* Tailwind */
/* <p class="max-w-prose"> */
```

### Minimum Touch Target

```css
/* Ensure minimum touch target for small interactive elements */
.touch-target {
  position: relative;
  min-width: 44px;
  min-height: 44px;
}

/* For inline links or icons smaller than 44px */
.touch-target-expand::after {
  content: '';
  position: absolute;
  inset: -8px; /* Expand hit area by 8px on each side */
}
```

## Common Mistakes

1. **Reviewing on one viewport only** — always check mobile (375px), tablet (768px), and desktop (1280px) at minimum
2. **Skipping keyboard navigation test** — press Tab through the entire page; if you get lost or stuck, it fails
3. **Relying only on automated tools** — Lighthouse catches ~30% of accessibility issues; manual testing (screen reader, keyboard) is required
4. **Checking contrast on only one color combination** — test every text color on every background it appears on (including hover states, selected states, and dark mode)
5. **Ignoring disabled states** — disabled elements still need sufficient contrast for readability (3:1 minimum)
6. **Not testing with real content** — "Lorem ipsum" hides line length, wrapping, and overflow problems; test with real or realistic content
7. **Reviewing static mockups only** — interactive states (hover, focus, active, loading, error, empty) are where most issues hide

## Decision Tree

```
Running a design review?
│
├── Quick review (< 15 min)?
│   ├── Check contrast on all text (use browser DevTools color picker)
│   ├── Tab through the page (every element reachable? Focus visible?)
│   ├── Squint test (can you identify the primary action?)
│   └── Resize to 375px width (anything broken?)
│
├── Standard review (30-60 min)?
│   ├── Run through all sections above with checkboxes
│   ├── Test on 3 viewports (375px, 768px, 1280px)
│   ├── Run Lighthouse accessibility audit
│   └── Test with one screen reader (VoiceOver on Mac, NVDA on Windows)
│
└── Comprehensive review (2+ hours)?
    ├── All of the above
    ├── Test with 3 color blindness simulators
    ├── Test at 200% zoom
    ├── Test with keyboard only (no mouse)
    ├── Test with slow network (3G throttling)
    └── Test with real/edge-case content (long names, empty states, errors)
```

## Sources

- WCAG 2.1 Quick Reference: https://www.w3.org/WAI/WCAG21/quickref/
- Nielsen Norman Group — "How to Conduct a Heuristic Evaluation": https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Inclusive Design Principles: https://inclusivedesignprinciples.org/
- Deque University — axe Accessibility Rules: https://dequeuniversity.com/rules/axe/
- Google Lighthouse Documentation: https://developer.chrome.com/docs/lighthouse/
