# Design Review Notes

> Generated from [make-it-look-good](https://github.com/jens/make-it-look-good) knowledge base

## Overview
- **What:** Vue SFC admin dashboard with sidebar, stat cards, and user table
- **Stack:** Vue 3 (Composition API, `<script setup>`, scoped CSS)
- **Input type:** Existing code — internal tool that "team hates using"
- **Date:** 2026-03-17

## Design Decisions

### Color Palette
- Primary: `#2563eb` (blue-600) — replacing `#3498db` for better contrast
- Sidebar: `#0f172a` (slate-900) — darker than `#2c3e50` for more contrast with text
- Active state: `#2563eb` (blue-600) on dark sidebar
- Neutrals: Slate scale — replacing generic grays
- Status colors: Green `#16a34a` / Red `#dc2626` — meet 4.5:1 as text on white
- Stat positive: `#16a34a`, stat negative: `#dc2626`

### Typography
- Font: Inter or system-ui — replacing Arial (more refined for data-dense UI)
- Base: 14px for data-dense dashboard (acceptable exception to 16px rule)
- Headings: 20px page title, 16px section titles
- Table: 14px data, 12px headers (uppercase, tracked)
- Stat values: 24px bold, stat labels: 12px medium uppercase
- Line height: 1.5

### Spacing System
- Base unit: 4px (compact for dashboard)
- Sidebar width: 240px (was 150px — too narrow for icon+text nav)
- Sidebar padding: 16px
- Main content padding: 24px
- Card padding: 20px
- Table row height: 44px (meets touch target)
- Gap between stat cards: 16px

### Layout
- Fixed sidebar (240px) + scrollable main content
- Stat cards: 4 across on desktop, 2 on tablet, 1 on mobile
- Table: full width, responsive (horizontal scroll or card view on mobile)

## Issues Found

### Critical (Fix These First)
- [ ] **Base font 13px** — Below readable minimum. Dashboard data density is no excuse for illegible text.
  - Fix: 14px minimum for all text (acceptable for data-dense UI), 12px only for metadata/labels
  - Reference: `typography/readability.md`

- [ ] **Sidebar nav items too small** — `padding: 6px 8px` at 13px font = ~28px height. Below 44px target.
  - Fix: `padding: 10px 12px` with 14px font, add icons for scannability
  - Reference: `interaction/touch-targets.md`, `components/navigation.md`

- [ ] **Table action buttons are tiny** — `font-size: 11px; padding: 2px 6px` = ~20px height. Unusable on touch.
  - Fix: Minimum 32px height for compact table actions, or use icon buttons with 36px targets
  - Reference: `interaction/touch-targets.md`, `components/buttons.md`

- [ ] **Delete button has no confirmation protection** — Uses `confirm()` (browser native). Also, red text button is too easy to accidentally click next to Edit.
  - Fix: Add more spacing between Edit/Delete, use a proper confirmation modal, make Delete visually distinct (ghost with red text, not inline)
  - Reference: `components/buttons.md` (destructive actions), `components/modals-and-dialogs.md`

- [ ] **Status uses color only** — "Active" in green, "Inactive" in red. Color-blind users can't distinguish.
  - Fix: Add status badge with background tint + text, or add icon (checkmark / x)
  - Reference: `color/color-blind-safety.md`

### Important (Fix Soon)
- [ ] **Sidebar too narrow (150px)** — Nav items are cramped. "Overview", "Settings" barely fit. No room for icons.
  - Fix: 240px width, add icons left of text, pad items properly
  - Reference: `components/navigation.md`

- [ ] **Stat cards lack context** — Just a number and label. No trend indicator, no comparison to previous period.
  - Fix: Add trend arrow (↑↓) with color, "vs last month" subtext
  - Reference: `layout/visual-hierarchy.md`, `components/cards.md`

- [ ] **Table has no empty state** — If search returns 0 results, user sees blank space.
  - Fix: Add "No users found" message with illustration or icon
  - Reference: `components/feedback.md`

- [ ] **No focus management or keyboard nav** — Tab through sidebar items, table actions — no visible focus indicators.
  - Fix: Add focus-visible styles on all interactive elements
  - Reference: `color/contrast-and-accessibility.md`

- [ ] **Search input is unstyled** — `padding: 3px; width: 200px` — too small, inconsistent with table.
  - Fix: 44px height, proper padding, search icon, full width or 300px+
  - Reference: `components/forms.md`

### Nice to Have
- [ ] **No page header structure** — Just an h2 in the main area. No breadcrumbs, no action button.
  - Fix: Add page header with title + subtitle + primary action button
- [ ] **Table headers could be sortable** — Common expectation for admin tables
- [ ] **No loading states** — Data appears instantly (or not at all)
  - Reference: `interaction/loading-states.md`
- [ ] **Sidebar has no user avatar or account section** — Common dashboard pattern at bottom of sidebar

## What's Working Well
- Correct Vue 3 patterns (Composition API, computed for filtering)
- Tab-based navigation with reactive state
- Computed filtered users — good reactivity pattern
- Table has all necessary columns (name, email, role, status, actions)
- Delete has a confirmation step (even if it's browser native)
- Search input with reactive filtering

## Implementation Checklist
- [ ] Increase base font to 14px, labels to 12px uppercase
- [ ] Widen sidebar to 240px, add icons, increase nav item padding to 44px height
- [ ] Resize table action buttons to minimum 32px height
- [ ] Add status badges instead of color-only indicators
- [ ] Add trend indicators to stat cards
- [ ] Style search input properly (44px, icon, wider)
- [ ] Add empty state for search results
- [ ] Add focus-visible states on all interactive elements
- [ ] Add page header with title + action button
- [ ] Make sidebar responsive (collapse to icons on tablet, hamburger on mobile)

## Tokens & Values Quick Reference

```js
// Vue component tokens
const tokens = {
  sidebar: { width: '240px', bg: '#0f172a', activeBg: '#2563eb' },
  color: {
    primary: '#2563eb', primaryHover: '#1d4ed8',
    text: '#0f172a', textSecondary: '#475569', textMuted: '#94a3b8',
    border: '#e2e8f0', surface: '#f8fafc',
    success: '#16a34a', successBg: '#f0fdf4',
    error: '#dc2626', errorBg: '#fef2f2',
  },
  space: { xs: '4px', sm: '8px', md: '12px', base: '16px', lg: '20px', xl: '24px', '2xl': '32px' },
  fontSize: { xs: '12px', sm: '14px', base: '16px', lg: '20px', xl: '24px' },
  minTarget: '44px',
  radius: { sm: '6px', md: '8px', lg: '12px' },
}
```

## Knowledge Files Referenced
- `typography/readability.md` — minimum sizes for data-dense UIs
- `layout/spacing-system.md` — 4px scale, dashboard-appropriate spacing
- `components/navigation.md` — sidebar width, icon+text pattern, active states
- `components/tables-and-lists.md` — row height, header styling, actions
- `components/buttons.md` — action button sizing, destructive patterns
- `components/cards.md` — stat card structure, trend indicators
- `components/feedback.md` — empty states, status badges
- `interaction/touch-targets.md` — 44px minimum, compact alternatives
- `color/color-blind-safety.md` — never use color alone for status
- `color/contrast-and-accessibility.md` — focus states, text contrast
- `components/modals-and-dialogs.md` — confirmation dialogs for destructive actions
