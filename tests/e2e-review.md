# Design Review Notes

> Generated from [make-it-look-good](https://github.com/jdeworks/make-it-look-good) knowledge base

## Overview
- **What:** "TeamPulse" employee dashboard — sidebar, stat cards, chart placeholders, tabbed user table
- **Stack:** Plain HTML + CSS (no framework)
- **Input type:** Existing code — user says "make it look good"
- **Date:** 2026-03-17

## Design Decisions

### Color Palette
- Primary: `#2563eb` (blue-600) — replacing `#3498db` for better contrast on white
- Sidebar: `#0f172a` (slate-900) — replacing `#2c3e50`, darker for more contrast
- Neutrals: Slate scale (slate-50 through slate-900)
- Success: `#16a34a` (green-600), Error: `#dc2626` (red-600), Warning: `#d97706` (amber-600)
- All status colors meet 4.5:1 on white backgrounds

### Typography
- Font: Inter / system-ui — replacing Arial
- Base: 14px for data-dense dashboard (exception to 16px rule)
- Page title: 20px semibold
- Stat values: 28px bold
- Stat labels: 12px uppercase tracking-wide slate-500
- Table body: 14px, table headers: 12px uppercase semibold
- Line height: 1.5

### Spacing System
- Base unit: 4px
- Sidebar width: 240px (was 140px — too narrow)
- Sidebar item height: 40px with 12px horizontal padding
- Main content padding: 24px
- Card padding: 20px
- Table row height: 48px (was ~28px)
- Stat cards gap: 16px
- Section spacing: 24px between major blocks

### Layout
- Fixed sidebar (240px) + scrollable main
- Stat cards: 5 across desktop, wrapping on tablet/mobile
- Full-width table with horizontal scroll fallback

## Issues Found

### Critical (Fix These First)
- [ ] **Base font 12px, labels 10-11px** — Well below readable minimum. Table text, sidebar links, buttons — nearly everything is undersized.
  - Fix: 14px base, 12px minimum for metadata/labels only
  - Reference: `typography/readability.md`, `workflows/quick-reference.md`

- [ ] **Table action buttons 10px/2px padding = ~18px height** — Fails WCAG touch target minimum by a wide margin.
  - Fix: Minimum 32px height for compact table actions, 8px+ gap between buttons
  - Reference: `interaction/touch-targets.md` (44px minimum, 8px spacing)

- [ ] **Sidebar nav links too small** — `padding: 4px 6px` at 12px font = ~22px height. Below 44px target.
  - Fix: 40px item height, 14px font, add icons
  - Reference: `components/navigation.md` (sidebar item height 40-48px)

- [ ] **Status uses color only** — Active (green), Away (orange), Offline (red) with no icon or text differentiation for color-blind users.
  - Fix: Add icon (dot, checkmark, clock, x) alongside text in badge
  - Reference: `color/color-blind-safety.md`

- [ ] **Quick action buttons too small** — `padding: 4px 10px` at 11px = ~22px. Primary "Add Member" button same size as secondary actions.
  - Fix: 44px height, clear primary/secondary visual distinction
  - Reference: `components/buttons.md`, `interaction/touch-targets.md`

### Important (Fix Soon)
- [ ] **Sidebar too narrow (140px)** — Links are cramped, no room for icons. "Integrations" barely fits.
  - Fix: 240px width, add icons left of each label, proper section grouping
  - Reference: `components/navigation.md` (240-280px expanded)

- [ ] **No spacing system** — Values are 2, 4, 5, 6, 8, 10, 15px. Random, inconsistent.
  - Fix: Use 4px scale: 4, 8, 12, 16, 20, 24, 32
  - Reference: `layout/spacing-system.md`

- [ ] **Stat cards lack hierarchy** — Label (13px #555) and value (22px bold) are close in weight. Change values feel like afterthoughts.
  - Fix: Label 12px uppercase slate-500, value 28px bold slate-900, change 13px with arrow icon
  - Reference: `layout/visual-hierarchy.md`

- [ ] **Table rows too short** — `padding: 5px 8px` = ~26px rows. Hard to click, hard to scan.
  - Fix: 48px minimum row height, 12-16px padding
  - Reference: `components/tables-and-lists.md` (48px min)

- [ ] **Hours column left-aligned** — Numbers should be right-aligned for comparison.
  - Fix: Right-align "Hours This Week" column
  - Reference: `components/tables-and-lists.md`

- [ ] **Search input unstyled and tiny** — `padding: 4px 8px` at 12px, 200px wide. Easy to miss.
  - Fix: 44px height, search icon, 300px+ width, proper focus ring
  - Reference: `components/forms.md`

- [ ] **No focus states anywhere** — Tab through the page — nothing highlights.
  - Fix: Add `focus-visible` styles on all interactive elements
  - Reference: `color/contrast-and-accessibility.md`

### Nice to Have
- [ ] **Tab buttons have no padding/target size** — `padding: 5px 12px` = ~28px
- [ ] **Notification badge is tiny (9px)** — Hard to read
- [ ] **Remove buttons too close to Edit** — Accidental destructive actions
- [ ] **No empty state if table has no data**
- [ ] **Chart placeholders could have better visual treatment**

## What's Working Well
- Good information architecture (sidebar sections, stat overview, tabbed table)
- Real content with meaningful data
- Status indicators present (just need redundant coding)
- Trend indicators on stats (↑↓→)
- Search functionality present
- Tab filtering for table data
- Quick actions bar with clear primary action

## Implementation Checklist
1. [ ] Widen sidebar to 240px, add icons, 40px item height
2. [ ] Increase all font sizes (14px base, 12px min for metadata)
3. [ ] Apply consistent 4px spacing scale
4. [ ] Add 44px minimum touch targets on all buttons and inputs
5. [ ] Add status icons alongside color badges
6. [ ] Right-align number columns in table
7. [ ] 48px table row height
8. [ ] Style search with icon and proper sizing
9. [ ] Add focus-visible states
10. [ ] Add proper primary/secondary button distinction
11. [ ] Increase stat card visual hierarchy

## Knowledge Files Referenced
- `workflows/quick-reference.md` — all critical numbers
- `layout/spacing-system.md` — 4px scale, spacing relationships
- `components/navigation.md` — sidebar width, item height, icons
- `components/tables-and-lists.md` — row height, alignment, headers
- `components/buttons.md` — sizing, emphasis levels
- `interaction/touch-targets.md` — 44px minimum
- `color/color-blind-safety.md` — redundant status coding
- `layout/visual-hierarchy.md` — stat card hierarchy
- `components/forms.md` — search input sizing
- `color/contrast-and-accessibility.md` — focus states
