# E2E Test: Restaurant / Cafe Landing Page

## CONSULT.md Step 1C — Full Intake Conversation

### Initial Request

**User:** "I need a website for my cafe. Something warm and inviting."

### Classification

**Step 0 — Classify:** Vague idea with no wireframes, no tech stack, no specifics beyond mood.
Result: **Step 1C** (guided intake required).

---

### Guided Intake Questions

**Q1: What type of page is this?**
Landing page / content site. Single-page with sections. Not an app, not a dashboard. The goal is to showcase the cafe, display the menu, and drive foot traffic.

**Q2: Who is the audience?**
General public — mobile-heavy, all ages. Cafe visitors skew toward mobile search ("coffee near me"). Expect 65-75% mobile traffic. Age range 18-65+, so accessibility matters. No assumed tech literacy.

**Q3: What personality/tone?**
Playful & friendly — but not childish. Think specialty coffee shop: warm, welcoming, a little artisanal. The vibe is "your favorite neighborhood spot" not "corporate chain" and not "kids' party."

**Q4: What tech stack?**
Plain HTML with Tailwind CSS (CDN). No build tools, no framework. Self-contained single file for easy hosting on any static server.

**Q5: What sections/content?**
1. **Hero** — Cafe name, tagline, two CTAs (View Menu + Find Us)
2. **Menu** — Three categories: Coffee, Pastries, Sandwiches. Each with 3-4 items showing name, description, price.
3. **About** — Short cafe story (2-3 sentences), image placeholder
4. **Hours & Location** — Address, phone, business hours, map placeholder
5. **Footer** — Social links, hours summary, copyright

**Q6: Brand details?**
- **Name:** Golden Hour Cafe
- **Primary color:** Warm amber `#f59e0b` (Tailwind `amber-500`)
- **Secondary color:** Rich brown `#78350f` (Tailwind `brown-900` / `amber-900`)
- **Brand feel:** Warm, golden, inviting — like late afternoon sunlight

---

## Step 2 — Knowledge Files Consulted

| File | Why |
|---|---|
| `layout/visual-hierarchy.md` | Establish section ordering, heading sizes, emphasis patterns |
| `typography/type-scale.md` | Pick scale for headings (Playfair Display) and body (Inter) |
| `typography/readability.md` | Line length, line height, contrast for menu item descriptions |
| `color/color-psychology.md` | Warm palette validation — amber/brown evokes comfort, appetite, warmth |
| `layout/spacing-system.md` | Consistent spacing scale (4px base) for padding and gaps |
| `interaction/touch-targets.md` | 48px minimum for all interactive elements (mobile-heavy audience) |
| `responsive/mobile-first.md` | Structure all layouts mobile-first, enhance for larger screens |

---

## Design Review Notes

### Color Palette Decisions

| Role | Color | Tailwind Class | Rationale |
|---|---|---|---|
| Primary action | `#f59e0b` | `amber-500` | Warm, appetizing, high energy. Amber triggers appetite and warmth associations. |
| Primary text | `#78350f` | `amber-900` | Rich brown on warm backgrounds. Contrast ratio 7.2:1 against `#fffbeb` — passes AAA. |
| Background (main) | `#fffbeb` | `amber-50` | Warm white. Avoids the clinical feel of pure white `#fff`. |
| Background (cards) | `#ffffff` | `white` | Cards pop slightly against the warm page background. |
| Accent/hover | `#d97706` | `amber-600` | Darker amber for hover states. Sufficient contrast shift for interactivity cue. |
| Muted text | `#92400e` | `amber-800` | Descriptions and secondary info. 5.8:1 against white — passes AA. |

**Contrast checks:**
- `amber-900` on `amber-50`: **7.2:1** (AAA pass for normal text)
- `amber-900` on `white`: **8.4:1** (AAA pass)
- `amber-500` on `amber-900` (button): **4.6:1** (AA pass for large text / UI components)
- White on `amber-500`: **2.7:1** (fails for small text — use `amber-900` text on amber buttons instead)

**Key decision:** Buttons use `amber-500` background with `amber-900` text (not white text) to maintain contrast. White text on amber fails WCAG AA.

### Typography Decisions

| Element | Font | Size (mobile) | Size (desktop) | Weight |
|---|---|---|---|---|
| Cafe name (hero) | Playfair Display | 2.5rem (40px) | 4rem (64px) | 700 |
| Section headings | Playfair Display | 1.875rem (30px) | 2.25rem (36px) | 700 |
| Menu category | Playfair Display | 1.25rem (20px) | 1.5rem (24px) | 600 |
| Body / descriptions | Inter | 1rem (16px) | 1.125rem (18px) | 400 |
| Menu item name | Inter | 1rem (16px) | 1.125rem (18px) | 600 |
| Price | Inter | 1rem (16px) | 1.125rem (18px) | 700 |
| Small / meta text | Inter | 0.875rem (14px) | 0.875rem (14px) | 400 |

**Rationale:** Playfair Display is a transitional serif that feels artisanal and warm without being stuffy. Inter is a highly legible sans-serif for body content. The pairing creates a "specialty cafe" feel — crafted headings with clean readable content.

**Line height:** 1.6 for body text, 1.2 for headings. Menu descriptions at 1.5 for scannability.

### Spacing Decisions

- **Base unit:** 4px (Tailwind default)
- **Section padding:** `py-16` mobile (64px), `py-24` desktop (96px)
- **Card padding:** `p-6` (24px) — generous for touch friendliness
- **Gap between menu items:** `gap-4` (16px)
- **Gap between sections:** Handled by section padding; no additional margin
- **Container max-width:** `max-w-6xl` (72rem / 1152px) — appropriate for content site

### Mobile-First Considerations

1. **Layout:** Single column on mobile, multi-column on `md:` (768px+) breakpoint
2. **Menu categories:** Stack vertically on mobile. Three-column grid on desktop.
3. **Hero CTAs:** Stack vertically on mobile (`flex-col`), side by side on desktop (`sm:flex-row`)
4. **Touch targets:** All buttons minimum `py-3 px-6` (48px effective height with text). Links in footer have `py-2` minimum padding for 44px+ tap targets.
5. **Font sizes:** Start at mobile sizes, scale up at `md:` breakpoint. No text smaller than 14px anywhere.
6. **Card tap areas:** Menu category cards have generous padding. No tiny price text or cramped item rows.
7. **Hours section:** Table-like layout using grid, not an actual `<table>`, for better mobile rendering.

### Component Decisions

- **Rounded corners:** `rounded-2xl` (16px) on cards and major containers. Conveys warmth and friendliness vs. sharp corners.
- **Shadows:** `shadow-lg` with warm tint. Avoids cold gray shadows — uses amber-tinted custom shadow where possible, or default shadow which reads as warm on the amber-50 background.
- **Buttons:** Rounded-full (pill shape) for primary CTAs — feels friendly and approachable. `rounded-xl` for secondary actions.
- **Dividers:** Avoided in favor of spacing and background color shifts. Dividers would feel too rigid for a "warm and inviting" personality.
- **Images:** Placeholder divs with amber gradient backgrounds and centered icon/text. Aspect ratio containers.

### Section Flow Rationale

1. **Hero first** — Immediate brand impression. Name + tagline + CTAs above the fold.
2. **Menu second** — Primary reason people visit a cafe website. Don't bury it.
3. **About third** — Builds connection after they've seen the menu. Supports the "neighborhood spot" feel.
4. **Hours & Location fourth** — Decision-enabling info. After they're interested, tell them how to visit.
5. **Footer last** — Social links, condensed hours, legal.

This follows the inverted pyramid: most critical info first, supporting detail later.

---

## Expected Output

A single self-contained HTML file (`e2e-restaurant.html`) that:
- Renders correctly on mobile (375px) through desktop (1440px+)
- Passes WCAG AA contrast on all text
- Has no interactive element smaller than 48px tap target
- Uses only Tailwind CDN + Google Fonts (no other dependencies)
- Loads fast (no heavy assets, minimal external requests)
- Feels warm, inviting, and artisanal — like walking into a good coffee shop
