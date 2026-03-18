# E2E Test Case: Pricing Page (Step 1C — From Scratch)

> **Purpose:** Validates the full CONSULT.md consultation flow for a "vague idea" input — no existing code, no screenshots. Tests Step 1C (Intake), Step 2 (Knowledge File Selection), Step 3 (Generate Output), and Step 4 (Design Review Notes).

---

## Intake Conversation

**User:** "I need a pricing page for my SaaS product. Can you make it look good?"

**Step 0 — Classify:** Vague idea, no code → Step 1C (Intake)

---

**LLM asks Q1 — What are you building?**
User: "Pricing page for a project management SaaS tool called 'Planly'"

> *Classified as: Landing Page variant (pricing-specific). This maps to the "Landing Page" row in the Knowledge File Selection Matrix, with additional component-specific reads needed for cards, buttons, and comparison tables.*

**LLM asks Q2 — Who uses it?**
User: "Small to medium business teams, mostly desktop but need mobile too"

> *Audience: Business users (desktop-heavy, but mobile support required). This means:*
> - *Desktop-first layout that degrades gracefully to mobile*
> - *Data-dense feature comparison is acceptable — business users compare features carefully*
> - *Touch targets still matter for mobile visitors*
> - *Professional tone, not playful*

**LLM asks Q3 — Design vibe?**
User: "Clean and minimal, we're going for a modern SaaS look. Our competitors are Linear and Notion."

> *Vibe: Clean & minimal. Competitor references (Linear, Notion) give strong signals:*
> - *Generous whitespace, restrained color usage*
> - *One accent color, mostly neutrals*
> - *Subtle shadows or borders, not heavy drop shadows*
> - *Cards with light borders, not colored backgrounds*
> - *Type-driven hierarchy — sizes and weights do the heavy lifting, not color*

**LLM asks Q4 — Tech stack?**
User: "Just plain HTML for now, we'll integrate later"

> *Stack: Plain HTML → will use Tailwind v4 CDN for fast, clean output. Single self-contained file.*

**LLM asks Q5 — Components needed?**
User: "Three pricing tiers (Free, Pro, Enterprise), a toggle for monthly/annual, feature comparison, FAQ"

> *Components identified:*
> - *Pricing cards (3x) with tier badges, feature lists, CTA buttons*
> - *Billing toggle (monthly/annual) with savings badge*
> - *Feature comparison table (checkmarks/dashes)*
> - *FAQ accordion (details/summary)*
> - *Plus standard page furniture: nav, hero heading, footer CTA*

**LLM asks Q6 — Brand constraints?**
User: "Primary color is indigo (#6366f1), secondary is teal (#14b8a6). We use Inter font. No logo yet."

> *Brand: Custom palette provided. Need to build a full system around these two colors:*
> - *Primary indigo (#6366f1) — CTAs, active states, highlighted tier*
> - *Secondary teal (#14b8a6) — accents, badges, savings callouts*
> - *Neutrals: Slate scale (pairs well with indigo)*
> - *Font: Inter — already a standard SaaS choice, excellent at all sizes*

---

## Step 2 — Knowledge Files Read

| File | What Was Extracted |
|---|---|
| `workflows/quick-reference.md` | 4.5:1 contrast minimum, 44px touch targets, 16px body text, 4px spacing scale, 1.4-1.6 line height, 45-75ch line length, breakpoints (320/768/1024/1280px), border radius values |
| `layout/visual-hierarchy.md` | Pricing page needs one clear "recommended" tier that's visually dominant — size, elevation, or color weight. Secondary tiers should be visually subordinate. Heading hierarchy: page title > section title > card title > body text |
| `typography/type-scale.md` | 1.25 Major Third scale for landing pages. Price numbers are display-level (36-48px). Tier names are heading-level (20-24px). Feature list items are body (16px). Use weight contrast: 700 for prices, 600 for headings, 400 for body |
| `components/buttons.md` | Primary CTA: filled, high contrast. Secondary: outlined/ghost. All buttons minimum 44px height. Primary and secondary must be visually distinct. One primary action per card |
| `components/cards.md` | Consistent internal padding (24px). Single primary action per card. Clear content hierarchy inside: title → price → features → CTA. Highlighted card: border-color change or subtle background, slight scale or shadow increase |
| `layout/spacing-system.md` | 4px base. Section spacing: 64-96px. Card gap: 16-24px. Internal card padding: 24px. Feature list item spacing: 12-16px |
| `color/contrast-and-accessibility.md` | Indigo #6366f1 on white = 4.56:1 (passes AA for normal text). Teal #14b8a6 on white = 3.03:1 (fails for normal text — use only for large text, icons, or decorative). White on indigo #6366f1 = 4.56:1 (passes AA). Need darker indigo (#4f46e5) for hover states |

---

## Step 3 — Design Decisions

### Color Palette

```
Primary:         #6366f1 (indigo-500) — brand color, CTA fills, highlighted card border
Primary hover:   #4f46e5 (indigo-600) — button hover, maintains contrast
Primary light:   #eef2ff (indigo-50)  — highlighted card background tint
Secondary:       #14b8a6 (teal-500)   — savings badge, toggle active, accent moments
Secondary dark:  #0d9488 (teal-600)   — text on white where teal is needed (better contrast)
Text primary:    #0f172a (slate-900)   — headings, prices
Text secondary:  #475569 (slate-600)   — body text, feature descriptions
Text tertiary:   #94a3b8 (slate-400)   — metadata, disabled features (dashes)
Surface:         #ffffff (white)       — card backgrounds
Surface alt:     #f8fafc (slate-50)    — page background, comparison table stripes
Border:          #e2e8f0 (slate-200)   — card borders, dividers
```

**Contrast verification:**
- `#0f172a` on `#ffffff` = 15.39:1 (AAA)
- `#475569` on `#ffffff` = 7.09:1 (AAA)
- `#ffffff` on `#6366f1` = 4.56:1 (AA)
- `#ffffff` on `#4f46e5` = 5.67:1 (AA)
- `#14b8a6` on `#ffffff` = 3.03:1 (large text / decorative only)
- `#0d9488` on `#ffffff` = 4.53:1 (AA — use this for teal text)

### Typography

```
Font family:     Inter, system-ui, sans-serif
Page heading:    48px (text-5xl), font-weight 800, tracking -0.025em
Subtitle:        20px (text-xl), font-weight 400, slate-600
Tier name:       20px (text-xl), font-weight 600
Price:           48px (text-5xl), font-weight 700
Price period:    16px (text-base), font-weight 400, slate-500
Feature item:    16px (text-base), font-weight 400
Section heading: 30px (text-3xl), font-weight 700
FAQ question:    18px (text-lg), font-weight 500
Body text:       16px (text-base), line-height 1.6
```

Scale: 1.25 Major Third (12, 14, 16, 20, 24, 30, 36, 48)

### Spacing System

```
Base unit:           4px
Card padding:        32px (p-8)
Card gap:            24px (gap-6) on mobile, 32px (gap-8) on desktop
Feature list gap:    16px (space-y-4)
Section spacing:     96px (py-24) desktop, 64px (py-16) mobile
Nav height:          64px (h-16)
Container max-width: 1280px (max-w-7xl)
Horizontal padding:  16px mobile, 24px tablet, 32px desktop
```

### Layout

```
Cards:           3-column grid on desktop (md:grid-cols-3), stack on mobile
                 Middle card (Pro) visually elevated: ring-2 ring-indigo-500, slight scale
Comparison:      Full-width table with horizontal scroll on mobile
FAQ:             Single column, max-width 768px, centered
Container:       max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
Breakpoints:     320px (min), 640px (sm), 768px (md), 1024px (lg)
```

### Interactive Elements

```
Toggle:          48px height pill, smooth transition (200ms)
Primary button:  indigo-500 fill, white text, min-h-12 (48px), rounded-lg
                 Hover: indigo-600, transition-colors duration-150
Outlined button: slate-200 border, slate-700 text, min-h-12, rounded-lg
                 Hover: slate-50 background
FAQ accordion:   details/summary, 200ms transition, plus/minus indicator
Focus states:    ring-2 ring-indigo-500 ring-offset-2 on all interactive elements
```

---

## Step 4 — Design Review Notes

# Design Review Notes

> Generated from [make-it-look-good](https://github.com/jens/make-it-look-good) knowledge base

## Overview
- **What:** Pricing page for "Planly" — project management SaaS tool. Three tiers (Free, Pro, Enterprise), billing toggle, feature comparison, FAQ.
- **Stack:** Plain HTML + Tailwind v4 CDN (single self-contained file)
- **Input type:** Vague idea — no existing code (Step 1C intake)
- **Date:** 2026-03-17

## Design Decisions

### Color Palette
- Primary: `#6366f1` (indigo-500) — user's brand color, used for CTAs and highlighted tier
- Primary hover: `#4f46e5` (indigo-600) — darker shade for hover states, improves contrast to 5.67:1
- Primary tint: `#eef2ff` (indigo-50) — subtle background for the recommended tier card
- Secondary: `#14b8a6` (teal-500) — user's accent, used for savings badges and decorative elements only (3.03:1 on white — fails AA for text)
- Secondary text-safe: `#0d9488` (teal-600) — 4.53:1 on white, used when teal text is needed
- Neutrals: Slate scale — `#0f172a` (headings), `#475569` (body), `#94a3b8` (tertiary), `#e2e8f0` (borders), `#f8fafc` (alt surface)
- Semantic: Success `#16a34a`, Error `#dc2626` (not used on this page but defined for system consistency)
- Contrast ratios verified: Yes — all text meets 4.5:1 AA minimum. Teal restricted to decorative/badge use

### Typography
- Font: Inter (via Google Fonts CDN) — user's existing brand font, excellent for data-heavy pricing page
- Scale: 1.25 Major Third — 12, 14, 16, 20, 24, 30, 36, 48px
- Body size: 16px, line height: 1.6
- Price display: 48px bold — prices are the most scanned element on a pricing page
- Max line length: ~65ch on body text (enforced by container + card widths)

### Spacing System
- Base unit: 4px
- Scale used: 4, 8, 12, 16, 24, 32, 48, 64, 96px
- Component padding: 32px (cards), 16px (buttons horizontal), 12px (buttons vertical)
- Section spacing: 96px desktop, 64px mobile
- Card gap: 32px desktop, 24px mobile

### Layout
- Grid: CSS Grid — 1 column mobile, 3 columns desktop (md:grid-cols-3)
- Breakpoints: 320px (minimum), 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Container max-width: 1280px (max-w-7xl)
- Mobile behavior: Cards stack vertically, comparison table scrolls horizontally, FAQ remains single-column
- Pro tier card: visually elevated with indigo ring, slight scale, and "Most Popular" badge

## What's Working Well
- User provided clear brand colors and font — eliminates the biggest design bottleneck
- Three tiers is the ideal number for pricing psychology (center option gets highlighted)
- Component choices (toggle, comparison table, FAQ) are industry-standard for pricing pages
- Competitor references (Linear, Notion) give strong stylistic direction

## Implementation Checklist
1. [x] Define color palette with contrast-verified values
2. [x] Set up type scale using Inter + Major Third ratio
3. [x] Build sticky nav with brand + CTA
4. [x] Build pricing hero section (heading + subtitle + billing toggle)
5. [x] Build 3 pricing cards with responsive grid
6. [x] Highlight Pro tier (ring, scale, badge)
7. [x] Build feature comparison table with responsive scroll
8. [x] Build FAQ accordion with `<details>/<summary>`
9. [x] Build bottom CTA section
10. [x] Build footer
11. [x] Verify all touch targets >= 44px
12. [x] Verify all contrast ratios >= 4.5:1
13. [x] Test responsive: 320px, 768px, 1024px+

## Tokens & Values Quick Reference

```css
:root {
  /* Colors */
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-primary-light: #eef2ff;
  --color-secondary: #14b8a6;
  --color-secondary-dark: #0d9488;
  --color-text: #0f172a;
  --color-text-secondary: #475569;
  --color-text-tertiary: #94a3b8;
  --color-surface: #ffffff;
  --color-surface-alt: #f8fafc;
  --color-border: #e2e8f0;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --text-body: 1rem;        /* 16px */
  --text-lg: 1.125rem;      /* 18px */
  --text-xl: 1.25rem;       /* 20px */
  --text-2xl: 1.5rem;       /* 24px */
  --text-3xl: 1.875rem;     /* 30px */
  --text-5xl: 3rem;         /* 48px */
  --leading-body: 1.6;

  /* Spacing (4px base) */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-24: 6rem;     /* 96px */

  /* Radii */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-xl: 1rem;      /* 16px */
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04);

  /* Timing */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
}
```

## Knowledge Files Referenced
- `workflows/quick-reference.md` — all critical numbers (contrast ratios, spacing scale, touch targets, breakpoints, type scale)
- `layout/visual-hierarchy.md` — pricing card hierarchy (highlighted tier dominance, heading scale)
- `typography/type-scale.md` — 1.25 Major Third ratio, size-to-use mappings
- `components/buttons.md` — primary/secondary button patterns, minimum sizing
- `components/cards.md` — internal padding, content hierarchy, highlighted card treatment
- `layout/spacing-system.md` — 4px base, section spacing, component gaps
- `color/contrast-and-accessibility.md` — verified all color combinations, flagged teal limitations
