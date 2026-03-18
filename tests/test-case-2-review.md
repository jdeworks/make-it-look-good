# Design Review Notes

> Generated from [make-it-look-good](https://github.com/jens/make-it-look-good) knowledge base

## Overview
- **What:** Barebones HTML landing page + signup form for "TaskFlow"
- **Stack:** Plain HTML + inline CSS (no framework)
- **Input type:** Existing code — hackathon quality, needs full design pass
- **Date:** 2026-03-17

## Design Decisions

### Color Palette
- Primary: `#2563eb` (blue-600) — trust, professionalism for a SaaS tool
- CTA accent: `#2563eb` on hero, could use `#ea580c` (orange-600) for high-contrast CTA if brand allows
- Neutrals: Slate scale
- Background: White for hero, `#f8fafc` (slate-50) for alternating sections
- Text: `#0f172a` (slate-900) primary, `#475569` (slate-600) secondary

### Typography
- Heading font: System-ui (adequate for MVP, consider Inter for polish)
- Hero heading: 48px (text-5xl) — currently same size as everything else
- Section headings: 30px (text-3xl)
- Body: 18px for landing page (larger than standard 16px for readability at distance)
- Line height: 1.6 for body text (generous for scanning)
- Max line length: 65ch on paragraphs

### Spacing System
- Base unit: 8px (landing pages benefit from generous spacing)
- Section spacing: 80–96px (py-20 to py-24)
- Card padding: 24px (p-6)
- Form field spacing: 16px (gap-4)

### Layout
- Single column hero → 3-column feature grid → testimonials → signup → footer
- Max container: 1152px (max-w-6xl)
- Features: 1 col mobile, 2 tablet, 3+ desktop (currently forced 4-across)
- Signup form: extracted to its own visual section, max-w-md

## Issues Found

### Critical (Fix These First)
- [ ] **No visual hierarchy whatsoever** — h1, h2, and body text are nearly the same visual weight. User can't scan the page.
  - Fix: h1 → 48px bold, h2 → 30px bold, body → 18px regular. Add whitespace between sections.
  - Reference: `layout/visual-hierarchy.md`, `typography/type-scale.md`

- [ ] **Hero paragraph is a wall of text** — 3 sentences crammed together, no breathing room, buries the value proposition.
  - Fix: Lead with one clear sentence (18-20px), break supporting details into feature cards below. Max 2 lines for hero subtext.
  - Reference: `typography/readability.md` (45-75 chars/line), `layout/whitespace.md`

- [ ] **CTA is buried below the fold** — "Sign Up Free" button is at the very bottom after all content. Users may never scroll there.
  - Fix: Add primary CTA in hero section, secondary CTA after features, keep form at bottom as alternative
  - Reference: `layout/visual-hierarchy.md`, `components/buttons.md`

- [ ] **Form uses placeholder-only labels** — "Full Name", "Work Email" disappear when typing. User forgets what field they're in.
  - Fix: Add visible `<label>` elements above each field
  - Reference: `components/forms.md` (labels above, never placeholder-only)

- [ ] **Features forced into 4 columns** — `display: flex` with no wrap, 4 items side by side. Unreadable on mobile, cramped on tablet.
  - Fix: CSS Grid with responsive columns: 1 mobile, 2 tablet, 3-4 desktop
  - Reference: `layout/grid-systems.md`, `responsive/mobile-first.md`

- [ ] **Touch targets too small** — Form inputs at `padding: 5px` = ~26px height. Submit button at `padding: 8px 15px` = ~34px. Both below 44px minimum.
  - Fix: All inputs/buttons to `min-height: 44px`, padding `10px 16px`
  - Reference: `interaction/touch-targets.md`

### Important (Fix Soon)
- [ ] **No section separation** — Content runs together with minimal spacing. Features blend into testimonials blend into signup.
  - Fix: Add 80px+ vertical padding between sections, alternate background colors (white ↔ slate-50)
  - Reference: `layout/whitespace.md`, `layout/spacing-system.md`

- [ ] **Feature cards have no visual weight** — `border: 1px solid #ddd; padding: 10px` looks like an afterthought. No icons, no hierarchy within cards.
  - Fix: Increase padding to 24px, add icons/emoji, bold the feature name, add subtle shadow or background
  - Reference: `components/cards.md`

- [ ] **Testimonials are unstyled blocks** — Gray boxes with no attribution structure, no visual credibility markers.
  - Fix: Add quote marks, avatar placeholder, proper name/title formatting, star rating or logo
  - Reference: `layout/visual-hierarchy.md`

- [ ] **Footer is an afterthought** — `font-size: 11px` barely readable, no structure.
  - Fix: Proper footer with 14px text, organized links, adequate padding
  - Reference: `typography/readability.md`

- [ ] **`<br>` tags for layout** — Form uses `<br>` between fields. Breaks semantics and creates unpredictable spacing.
  - Fix: Wrap each field in a div, use flex/grid with gap for spacing
  - Reference: `components/forms.md`

### Nice to Have
- [ ] **No favicon or meta description** — Missing `<meta name="description">` and `<link rel="icon">`
- [ ] **No open graph tags** — Page won't look good when shared on social
- [ ] **Terms checkbox label is tiny** — 11px, hard to read
- [ ] **"Sign Up Free" could be stronger** — Consider "Start Free — No Credit Card" for higher conversion

## What's Working Well
- Page has all the right sections (hero, features, testimonials, signup, footer)
- Content is real and compelling (specific benefits, real-sounding testimonials)
- Feature descriptions are concrete and benefit-focused
- Max-width container prevents full-bleed stretching
- Form asks for relevant fields (not too many)

## Implementation Checklist
- [ ] Add type scale: hero 48px, sections 30px, body 18px
- [ ] Add hero CTA button above the fold
- [ ] Convert features to responsive grid with icons and proper card styling
- [ ] Add 80px+ spacing between sections with alternating backgrounds
- [ ] Convert form to use visible labels, 44px targets, proper spacing
- [ ] Style testimonials with proper attribution
- [ ] Add proper footer with readable text
- [ ] Remove all `<br>` tags, use flex/grid layout
- [ ] Add responsive meta viewport tag (already present — good)
- [ ] Add focus states on all interactive elements

## Tokens & Values Quick Reference

```css
:root {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-text: #0f172a;
  --color-text-secondary: #475569;
  --color-surface: #ffffff;
  --color-surface-alt: #f8fafc;
  --color-border: #e2e8f0;
  --color-success: #16a34a;
  --color-error: #dc2626;

  --font-sans: system-ui, -apple-system, sans-serif;
  --text-lg: 1.125rem;   /* 18px - body */
  --text-3xl: 1.875rem;  /* 30px - section headings */
  --text-5xl: 3rem;      /* 48px - hero */

  --space-4: 1rem;       /* 16px - field spacing */
  --space-6: 1.5rem;     /* 24px - card padding */
  --space-20: 5rem;      /* 80px - section spacing */
}
```

## Knowledge Files Referenced
- `layout/visual-hierarchy.md` — heading scale, CTA placement, scanning patterns
- `typography/type-scale.md` — modular scale ratios, size recommendations
- `typography/readability.md` — body size, line length, line height
- `layout/whitespace.md` — section spacing, breathing room
- `layout/spacing-system.md` — 4px/8px base, consistent scale
- `layout/grid-systems.md` — responsive column patterns
- `components/buttons.md` — CTA sizing, emphasis levels
- `components/forms.md` — label placement, field sizing, layout
- `components/cards.md` — padding, hierarchy, hover states
- `interaction/touch-targets.md` — 44px minimum
- `color/contrast-and-accessibility.md` — text contrast requirements
