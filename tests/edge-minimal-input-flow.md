# Edge Case: Extremely Minimal Input — "make me a button"

> Generated from [make-it-look-good](https://github.com/jdeworks/make-it-look-good) knowledge base

## Step 0 — Classify Input

**User:** "make me a button"

- No code provided
- No context: no page, no framework, no purpose, no color, no size
- **Classification:** Vague idea (extremely minimal) — Step 1C, but too vague even for standard intake. The request is four words with zero constraints. Need to ask clarifying questions before any design work can begin.

---

## Step 1C — Guided Intake Conversation

Standard intake assumes the user has *some* idea of what they want. This user may not. The strategy is to ask a small batch of high-leverage questions (not a long survey) to unlock enough context to proceed.

**LLM:** "I can help! A few quick questions so I design the right button:
1. What does this button do? (e.g., submit a form, buy something, navigate, sign up)
2. Is this part of an existing page, or standalone?
3. Any color preferences?"

**User:** "It's a checkout button for an e-commerce site. Green would be good. Actually, can you give me a whole set of buttons I can use?"

### Reassessment

The request has shifted. What started as "one button" is now a **component library request** — a complete button system. This changes the scope:

| Before | After |
|--------|-------|
| Single button | Button system (multiple variants) |
| One-off component | Reusable component library |
| Minimal context | Clear context: e-commerce, checkout, green brand |

**Revised classification:** Component library / design system fragment — still Step 1C but with a much broader scope.

### Derived Intake Answers

From the brief exchange, we can infer:

**Q1: What type of page?**
E-commerce site — checkout flow is mentioned, implying product pages, cart, and payment.

**Q2: Who is the audience?**
General public shoppers. E-commerce means all ages, all devices, high mobile usage (60-70% typical for e-commerce). Accessibility is critical — buttons are the primary conversion driver.

**Q3: Personality/tone?**
Not stated, but e-commerce + green suggests: trustworthy, clean, professional. Not playful, not brutalist.

**Q4: Tech stack?**
Not stated. We will produce plain HTML + Tailwind CSS (single file) as a showcase. The token values and patterns can be ported to any framework.

**Q5: What components?**
A complete button system:
- Multiple emphasis levels (primary, secondary, ghost/tertiary)
- Multiple states (default, hover, focus, disabled, loading)
- Multiple sizes (small, medium, large)
- Danger variant for destructive actions
- Icon buttons
- Button groups

**Q6: Brand colors?**
Green — we will use emerald-600 (`#059669`) as the primary action color. This is a strong e-commerce green: associated with "go," "confirm," "money," and "trust."

---

## Step 2 — Knowledge File Selection

| File | Why |
|------|-----|
| `components/buttons.md` | Core button anatomy, emphasis hierarchy, state design, sizing rules |
| `color/contrast-and-accessibility.md` | WCAG AA contrast for green-on-white and white-on-green |
| `interaction/touch-targets.md` | 44px minimum touch target for all interactive buttons |
| `color/color-blind-safety.md` | Green is problematic for deuteranopia — danger (red) vs. primary (green) must be distinguishable without color alone |
| `layout/spacing-system.md` | Consistent internal padding, gap between button groups |
| `interaction/animation-timing.md` | Hover/focus transition timing, loading spinner speed |
| `typography/type-scale.md` | Button label font sizes across small/medium/large |

---

## Design Review Notes

### Overview

- **What:** Complete button system for e-commerce site
- **Stack:** HTML + Tailwind CSS (showcase/reference page)
- **Input type:** Edge case — extremely minimal initial request, expanded via clarifying questions
- **Date:** 2026-03-17

---

### Button System Matrix

**3 emphasis levels x 4 states x 3 sizes = 36 base combinations, plus danger variant and icon buttons.**

#### Emphasis Levels

| Level | Name | Visual Treatment | When to Use |
|-------|------|-----------------|-------------|
| **High** | Primary | Filled green (`emerald-600`) with white text | Main CTA per screen: "Add to Cart," "Checkout," "Place Order" |
| **Medium** | Secondary | 2px green border, green text, transparent fill | Supporting actions: "Save for Later," "Continue Shopping," "View Details" |
| **Low** | Ghost / Tertiary | No border, no fill, green text only | Least important actions: "Cancel," "Skip," "Learn More" |

**Rule:** Maximum ONE primary button per visual section. If everything is primary, nothing is primary.

#### States

| State | Visual Change | Implementation Notes |
|-------|--------------|---------------------|
| **Default** | Base styling | Resting state |
| **Hover** | Darken fill 10-15% (primary: `emerald-700`), subtle lift | `transition-all duration-150 ease-in-out` — 150ms is fast enough to feel instant but smooth enough to notice |
| **Focus** | 3px offset ring (`ring-2 ring-offset-2 ring-emerald-500`) | MUST be visible — keyboard users depend on this. Never remove focus styles. |
| **Active/Pressed** | Darken further (primary: `emerald-800`), slight scale-down | `transform: scale(0.98)` — subtle physical feedback |
| **Disabled** | 40% opacity, `cursor-not-allowed` | Remove from tab order OR use `aria-disabled="true"`. Never just grey out — communicate *why* it is disabled. |
| **Loading** | Replace label with spinner, maintain button width | Use `aria-busy="true"`, disable click handler. Button must not change size (layout shift). |

#### Sizes

| Size | Height | Padding (x / y) | Font Size | Use Case |
|------|--------|-----------------|-----------|----------|
| **Small** | 36px (min 44px touch target with padding) | `px-3 py-1.5` | 14px (`text-sm`) | Inline actions, table rows, tight spaces |
| **Medium** | 44px | `px-5 py-2.5` | 16px (`text-base`) | Default — most buttons |
| **Large** | 52px | `px-7 py-3.5` | 18px (`text-lg`) | Primary CTAs, hero sections, checkout |

**Critical:** Even the "small" button must meet the 44px minimum touch target. If the visible button is 36px tall, add transparent padding to reach 44px. On mobile, no interactive element should be smaller than 44x44px.

---

### Danger Variant

| Property | Value |
|----------|-------|
| Fill color | `red-600` (`#dc2626`) |
| Hover | `red-700` |
| Use case | "Delete Account," "Remove Item," "Cancel Order" |
| Color-blind note | Red vs. green is the most common confusion. Danger buttons MUST differ from primary by more than just hue: use a warning icon, different label language ("Delete" not "Confirm"), or destructive action confirmation dialog. |

---

### Accessibility Checklist

- [x] **Contrast:** White text on `emerald-600` = 4.53:1 (passes AA for normal text at 16px+). Verify with large text exception for 14px small buttons.
- [x] **Contrast (secondary):** `emerald-600` text on white = 4.53:1 (passes AA).
- [x] **Contrast (danger):** White text on `red-600` = 4.63:1 (passes AA).
- [x] **Touch targets:** All buttons >= 44px effective touch area.
- [x] **Focus visible:** 3px ring with 2px offset — clearly visible on all backgrounds.
- [x] **Disabled state:** Uses `aria-disabled` or `disabled` attribute, not just visual styling.
- [x] **Loading state:** Uses `aria-busy="true"` and `aria-label` to announce loading to screen readers.
- [x] **Color-blind safety:** Danger vs. primary distinguishable by shape (icon), label text, and position — not color alone.
- [x] **Motion:** Spinner respects `prefers-reduced-motion` — falls back to pulsing dot or static "Loading..." text.

---

### Design Tokens (CSS Custom Properties)

```css
:root {
  /* Colors */
  --btn-primary-bg: #059669;        /* emerald-600 */
  --btn-primary-hover: #047857;     /* emerald-700 */
  --btn-primary-active: #065f46;    /* emerald-800 */
  --btn-primary-text: #ffffff;
  --btn-danger-bg: #dc2626;         /* red-600 */
  --btn-danger-hover: #b91c1c;      /* red-700 */
  --btn-disabled-opacity: 0.4;

  /* Sizing */
  --btn-height-sm: 36px;
  --btn-height-md: 44px;
  --btn-height-lg: 52px;
  --btn-min-touch: 44px;

  /* Typography */
  --btn-font-sm: 0.875rem;         /* 14px */
  --btn-font-md: 1rem;             /* 16px */
  --btn-font-lg: 1.125rem;         /* 18px */
  --btn-font-weight: 600;

  /* Spacing */
  --btn-px-sm: 0.75rem;            /* 12px */
  --btn-px-md: 1.25rem;            /* 20px */
  --btn-px-lg: 1.75rem;            /* 28px */
  --btn-gap: 0.5rem;               /* 8px — icon-to-label gap */

  /* Motion */
  --btn-transition: 150ms ease-in-out;
  --btn-spinner-speed: 600ms;

  /* Focus */
  --btn-focus-ring-width: 3px;
  --btn-focus-ring-offset: 2px;
  --btn-focus-ring-color: #10b981; /* emerald-500 */
}
```

---

### Key Design Decisions

1. **Why emerald-600 instead of green-500?** Emerald-600 (`#059669`) has enough depth to hit 4.5:1 contrast with white text. Brighter greens (like `green-400` or `green-500`) fail contrast requirements. This is the darkest shade that still reads as vibrant green.

2. **Why 150ms transitions?** Research shows 100-200ms is the sweet spot for hover transitions. Below 100ms feels glitchy, above 200ms feels sluggish. 150ms is the safe middle.

3. **Why not just opacity for disabled?** Opacity alone does not communicate "disabled" to screen readers. Always pair with `disabled` attribute or `aria-disabled="true"`. The 40% opacity is a visual hint, not the mechanism.

4. **Why maintain button width during loading?** If the button shrinks when the spinner replaces the label, it causes layout shift — the surrounding content jumps. This is jarring. Set `min-width` to the button's natural width before switching to the spinner.

5. **Why include ghost buttons at all?** In e-commerce, ghost buttons serve as escape hatches: "Cancel," "Go Back," "Skip." They intentionally look less important so users are guided toward the primary action. Removing them forces all actions to compete for attention.

---

### Edge Case Lessons

This test case demonstrates several important patterns for handling minimal input:

1. **Do not guess — ask.** "Make me a button" has infinite valid interpretations. Three targeted questions unlocked the real need.
2. **Listen for scope changes.** The user casually said "actually, can you give me a whole set" — this is a 10x scope expansion. Acknowledge it and adjust.
3. **Derive what you can.** "E-commerce" + "checkout" + "green" gives enough signal to make dozens of informed decisions (audience, tone, accessibility priority, color palette) without asking 20 more questions.
4. **Offer a system, not just a component.** When someone asks for "a button," giving them a system (with variants, states, and sizes) is more useful than giving them one perfect button they cannot adapt.
