# E2E: Dark Developer Portfolio — Full CONSULT.md Flow

> Generated from [make-it-look-good](https://github.com/jens/make-it-look-good) knowledge base

## Step 0 — Classify Input

**User:** "I want a personal developer portfolio site. Dark mode, techy vibe."

- No existing code provided
- Vague idea with aesthetic direction but no specifics
- **Classification:** Vague idea → **Step 1C** (Guided Intake)

## Step 1C — Guided Intake Conversation

**Q1: What type of site/app is this?**
Portfolio / personal site

**Q2: Who's the audience?**
General public — potential employers, clients, fellow developers

**Q3: What's the visual feel you're going for?**
Dark & technical — "techy vibe," thinks Vercel/GitHub-style aesthetic

**Q4: What tech stack?**
Plain HTML — no framework, wants a single self-contained file

**Q5: What sections/components do you need?**
- Hero with name/title
- About section
- Project cards (3-4 projects)
- Skills/tech stack display
- Contact form

**Q6: Do you have brand colors?**
No existing brand colors. Suggested emerald green (#10b981) as accent on dark background — user agreed.

## Step 2 — Knowledge File Selection

Based on the intake, these knowledge files are relevant:

| File | Why |
|------|-----|
| `layout/visual-hierarchy.md` | Hero section prominence, section ordering, heading scale |
| `typography/type-scale.md` | Font sizing for hero name (display), section headers, body |
| `components/cards.md` | Project card structure, padding, hover states |
| `components/forms.md` | Contact form field sizing, labels, validation patterns |
| `layout/spacing-system.md` | Consistent spacing between sections, card gaps, padding |
| `color/color-systems.md` | Dark mode palette construction, surface elevation levels |
| `color/contrast-and-accessibility.md` | Light-on-dark contrast requirements, focus states |

## Design Review Notes

### Overview
- **What:** "Alex Chen" personal developer portfolio — hero, about, projects, tech stack, contact
- **Stack:** Plain HTML + Tailwind CDN (single file)
- **Input type:** New build from vague idea (Step 1C intake)
- **Date:** 2026-03-17

### Color Palette

**Dark Mode Palette:**
- Background (base): `#020617` (slate-950) — deepest surface
- Surface (cards/inputs): `#0f172a` (slate-900) — elevated surfaces
- Surface hover: `#1e293b` (slate-800) — hover/active states
- Border default: `#334155` (slate-700) — subtle separation
- Border accent: `#10b981` (emerald-500) — hover glow, active states
- Text primary: `#f1f5f9` (slate-100) — main body text
- Text secondary: `#94a3b8` (slate-400) — descriptions, labels
- Text muted: `#64748b` (slate-500) — metadata, placeholders
- Accent primary: `#10b981` (emerald-500) — buttons, links, highlights
- Accent hover: `#059669` (emerald-600) — button hover state
- Accent subtle: `rgba(16, 185, 129, 0.1)` — tag backgrounds, glow effects

**Contrast Verification (on slate-950 #020617):**
- slate-100 (#f1f5f9) on slate-950: ~15.4:1 — passes AAA
- slate-400 (#94a3b8) on slate-950: ~6.5:1 — passes AA
- slate-500 (#64748b) on slate-950: ~4.2:1 — borderline, use only for large text/decorative
- emerald-500 (#10b981) on slate-950: ~6.8:1 — passes AA
- slate-100 (#f1f5f9) on slate-900 (#0f172a): ~13.8:1 — passes AAA
- slate-400 (#94a3b8) on slate-900: ~5.9:1 — passes AA

### Dark Mode Considerations

**Inverted Mental Model:**
- Light mode: shadows create elevation. Dark mode: shadows are invisible against dark backgrounds
- Instead, use **border-based elevation** — lighter borders (slate-700, slate-600) indicate higher surfaces
- Subtle background lightening (slate-950 → slate-900 → slate-800) creates layering

**Light Text on Dark Rules:**
- Never use pure white (#fff) for body text — too harsh. Use slate-100 or slate-200
- Reserve white (#fff) for hero display text and critical headings only
- Reduce body font-weight perception: light text on dark appears bolder, so avoid bold for body text

**Shadow Replacement Strategy:**
- Drop `box-shadow` for card elevation — use `border border-slate-700/50` instead
- For hover emphasis: emerald border glow (`border-emerald-500/50`, `shadow-emerald-500/20`)
- Subtle `ring` effects work better than shadows on dark

**Accent Color Usage:**
- Emerald green is high-contrast on dark — safe for buttons, links, and highlights
- Avoid emerald for large background fills (too vibrant) — use at 10% opacity for subtle backgrounds
- Tech stack tags: emerald text on emerald/10 background

### Typography

- **Display font:** Inter for headings, body — clean and modern
- **Monospace accent:** JetBrains Mono for code-related text (tech tags, section labels, subtle accents)
- **Hero name:** 48px (3rem) bold, white — desktop. 36px (2.25rem) mobile
- **Hero title:** 20px (1.25rem) emerald-500, monospace
- **Section headings:** 30px (1.875rem) semibold, slate-100
- **Card titles:** 18px (1.125rem) semibold, slate-100
- **Body text:** 16px (1rem) regular, slate-300/slate-400
- **Tech tags:** 13px (0.8125rem) medium, monospace, emerald-400
- **Form labels:** 14px (0.875rem) medium, slate-300
- **Line height:** 1.6 for body, 1.2 for display/headings

### Spacing System

- **Base unit:** 4px
- **Section padding:** 80px (5rem) vertical — generous breathing room between sections
- **Container max-width:** 1120px (70rem) centered
- **Hero vertical padding:** 120px top, 80px bottom
- **Card padding:** 24px (1.5rem)
- **Card grid gap:** 24px (1.5rem)
- **Form field spacing:** 20px (1.25rem) between fields
- **Tech tag gap:** 8px (0.5rem)
- **Content max-width for text blocks:** 640px (40rem) for readability

### Layout

- **Single column, full-width sections** — no sidebar for portfolio
- **Hero:** centered text, full viewport attention
- **About:** two-column (photo placeholder + text) on desktop, stacked on mobile
- **Projects:** 2x2 grid on desktop, single column on mobile
- **Tech stack:** flex-wrap badge grid, centered
- **Contact:** centered form with max-width 480px
- **Footer:** minimal, centered

### Component Decisions

**Project Cards:**
- Dark surface (slate-900) with slate-700/50 border
- On hover: border transitions to emerald-500/50, subtle emerald glow shadow
- Transition: 300ms ease for border-color and box-shadow
- Content: project name (semibold), tech tags (monospace badges), description (slate-400), "View Project" link (emerald-500)
- Corner radius: 12px (rounded-xl)

**Contact Form:**
- Dark surface card (slate-900) wrapping the form
- Input fields: slate-800 background, slate-600 border, slate-100 text
- Focus: emerald-500 ring, emerald-500 border
- Submit button: emerald-500 background, white text, 44px height minimum
- Field height: 44px minimum for touch targets

**Tech Stack Badges:**
- Inline-flex, monospace text
- emerald-400 text on emerald-500/10 background
- Rounded-full, px-3 py-1
- No hover state needed (display only)

**Social/CTA Links (Hero):**
- GitHub and LinkedIn as icon links, 44px touch target
- "Download Resume" as primary outlined button with emerald border

### Responsive Breakpoints

- **Mobile (<640px):** Single column everything, hero text 36px, reduced section padding (48px)
- **Tablet (640-1024px):** Projects 2-col, about 2-col
- **Desktop (>1024px):** Full layout as designed

### Animations

- **Card hover glow:** `transition-all duration-300` on border-color and shadow
- **Smooth scroll:** `scroll-behavior: smooth` on html
- **Link hover:** color transition 200ms
- **Button hover:** background-color transition 200ms
- **No entrance animations** — keep it fast and professional, not flashy

## Knowledge Files Referenced
- `layout/visual-hierarchy.md` — section ordering, heading hierarchy
- `typography/type-scale.md` — display/heading/body sizes
- `components/cards.md` — card structure, padding, hover
- `components/forms.md` — input sizing, focus states, labels
- `layout/spacing-system.md` — 4px scale, section spacing
- `color/color-systems.md` — dark mode palette, surface elevation
- `color/contrast-and-accessibility.md` — light-on-dark contrast, focus rings
