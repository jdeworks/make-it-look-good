# Design Review Notes

> Generated from [make-it-look-good](https://github.com/jdeworks/make-it-look-good) knowledge base

## Overview
- **What:** React settings page component with inline styles
- **Stack:** React (useState, inline style={{ }} objects)
- **Input type:** Existing code — user wants it to "look good"
- **Date:** 2026-03-17

## Design Decisions

### Color Palette
- Primary: `#2563eb` (blue-600) — standard interactive color, high trust
- Neutrals: Slate scale (slate-50 through slate-900) — more refined than pure gray
- Error: `#dc2626` — standard red, meets 4.5:1 on white
- Success: `#16a34a` — standard green, meets 4.5:1 on white
- Contrast ratios verified: Yes — all text meets WCAG AA (4.5:1 minimum)

### Typography
- Font: system-ui stack (no external font needed for a settings page)
- Body: 16px (was 13px — critically undersized)
- Labels: 14px semibold (was 11px — nearly unreadable)
- Heading: 24px bold (appropriate for page-level heading)
- Line height: 1.5 for body text

### Spacing System
- Base unit: 4px
- Scale used: 4, 8, 12, 16, 24, 32
- Field spacing: 20px between fields (gap-5), 32px between sections (gap-8)
- Page padding: 24px on mobile, 32px on desktop
- Card/container padding: 24px

### Layout
- Single column form (was 2-column for name+email — no benefit to side-by-side)
- Max width: 672px (max-w-2xl) — prevents overly wide form
- Centered on page

## Issues Found

### Critical (Fix These First)
- [ ] **Body text 13px, labels 11px** — Below minimum readable size (16px body, 14px labels). Users will struggle to read on any device.
  - Fix: Body text to `font-size: 16px` (1rem), labels to `font-size: 14px` (0.875rem)
  - Reference: `typography/readability.md` (body ≥16px), `typography/type-scale.md`

- [ ] **Buttons too small (5px 12px padding)** — Computed height ~24px, well below 44px minimum touch target. Fails WCAG 2.5.5.
  - Fix: `padding: 8px 16px`, add `min-height: 44px`
  - Reference: `interaction/touch-targets.md` (44×44px minimum)

- [ ] **Checkbox has no visual label association** — `<input type="checkbox">` next to `<span>` — no `id`/`htmlFor` link. Clicking the text doesn't toggle.
  - Fix: Add `id="notifications"` to checkbox, wrap in `<label>` or use `htmlFor`
  - Reference: `components/forms.md` (label association)

- [ ] **Label contrast too low** — `#666` on white = 5.7:1 (passes AA for normal text, but at 11px it's hard to read). At proper 14px, `#475569` (slate-600) = 7:1.
  - Fix: Labels to `color: #334155` (slate-700) at 14px
  - Reference: `color/contrast-and-accessibility.md` (4.5:1 minimum)

### Important (Fix Soon)
- [ ] **Side-by-side name + email fields** — No benefit to 2-column here. Increases cognitive load, breaks on mobile.
  - Fix: Stack vertically, full width
  - Reference: `components/forms.md` (single column default)

- [ ] **No spacing system** — Padding/margin values are 4, 5, 6, 8, 10, 15px. Random, creates visual noise.
  - Fix: Use 4px scale: 4, 8, 12, 16, 24, 32
  - Reference: `layout/spacing-system.md`

- [ ] **Success message too small and unstyled** — `fontSize: 11px, color: green` is easy to miss and raw green is not accessible.
  - Fix: Use a proper inline alert with icon, 14px text, accessible green (#16a34a), background tint
  - Reference: `components/feedback.md`

- [ ] **No focus states** — Tab through the form and nothing highlights. Keyboard users can't tell where they are.
  - Fix: Add `focus:ring-2 focus:ring-blue-500` or equivalent focus styles
  - Reference: `color/contrast-and-accessibility.md`

### Nice to Have
- [ ] **No visual grouping** — All fields run together. Profile fields (name, email, bio) and preference fields (notifications, theme) should be grouped.
  - Fix: Add section headings or fieldset/legend grouping with spacing between groups
  - Reference: `components/forms.md`, `foundations/gestalt-principles.md` (proximity)

- [ ] **No hover state on cancel button** — Looks clickable but no visual feedback on hover.
  - Fix: Add hover background color
  - Reference: `components/buttons.md` (all states needed)

- [ ] **Textarea too short** — 60px height is ~3 lines. Bio fields should allow more.
  - Fix: `min-height: 96px` (6 lines) with resize vertical

## What's Working Well
- Correct use of React state management (useState for each field)
- Save confirmation with auto-dismiss (good UX pattern)
- Form has logical field order (name → email → bio → preferences → actions)
- Cancel button present alongside Save (escape hatch)

## Implementation Checklist
- [ ] Increase all font sizes (16px body, 14px labels, 24px heading)
- [ ] Add 44px minimum height to all interactive elements
- [ ] Switch to single-column layout
- [ ] Apply consistent spacing scale (4px base)
- [ ] Add visible focus states on all inputs and buttons
- [ ] Associate checkbox label properly
- [ ] Group fields into Profile and Preferences sections
- [ ] Style success message as proper inline feedback
- [ ] Add hover states to all buttons
- [ ] Add max-width container to prevent form stretching

## Tokens & Values Quick Reference

```jsx
// Design tokens for this component
const tokens = {
  color: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    text: '#0f172a',
    textSecondary: '#475569',
    border: '#e2e8f0',
    surface: '#f8fafc',
    success: '#16a34a',
    successBg: '#f0fdf4',
    error: '#dc2626',
  },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 },
  radius: { sm: 4, md: 8, lg: 12 },
  fontSize: { sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24 },
  minTarget: 44,
};
```

## Knowledge Files Referenced
- `typography/readability.md` — minimum font sizes, line height
- `typography/type-scale.md` — heading/body size ratios
- `layout/spacing-system.md` — 4px base unit, scale values
- `components/forms.md` — single column, label placement, field grouping
- `components/buttons.md` — sizing, states, emphasis levels
- `components/feedback.md` — success message patterns
- `interaction/touch-targets.md` — 44px minimum, padding requirements
- `color/contrast-and-accessibility.md` — contrast ratios, focus indicators
- `foundations/gestalt-principles.md` — proximity for grouping
