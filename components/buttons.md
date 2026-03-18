# Buttons

> **TL;DR:** Use 3 emphasis levels — primary (filled), secondary (outlined), tertiary (ghost/text). Minimum touch target is 44×44px. Label with verbs ("Save changes", not "Submit"). Every state (hover, active, focus, disabled, loading) needs a distinct visual treatment.

## Core Principles

1. **Visual hierarchy drives action** — primary buttons guide users to the most important action; limit to one primary button per visible section
2. **Every button needs all six states** — default, hover, active/pressed, focus-visible, disabled, loading. Missing states feel broken.
3. **Buttons trigger actions, links navigate** — if it goes somewhere, use `<a>`. If it does something, use `<button>`.
4. **Labels should be verbs** — "Save changes", "Delete account", "Add to cart". Never "Submit", "OK", "Click here".
5. **Disabled buttons need explanation** — a grayed-out button with no tooltip or hint is a dead end. Show why it's disabled.

## Concrete Rules

### Three Emphasis Levels
| Level | Style | When to Use |
|-------|-------|-------------|
| **Primary** | Filled background, high contrast | The single most important action. One per section max. |
| **Secondary** | 1–2px border, transparent fill | Supporting actions: "Cancel", "Back", filter toggles |
| **Tertiary (ghost)** | No border, no fill, text only | Low-emphasis actions: "Learn more", "Skip", inline actions |

### Sizing
| Size | Height | Padding (v × h) | Font Size | Use Case |
|------|--------|-----------------|-----------|----------|
| Small | 32px | 6px 12px | 13–14px | Dense UIs, tables, inline actions |
| Medium (default) | 40px | 8px 16px | 14–16px | Forms, cards, most contexts |
| Large | 48px | 12px 24px | 16–18px | Hero CTAs, mobile primary actions |

- **Minimum touch target: 44×44px** (WCAG 2.5.8). If the visible button is smaller (e.g., 32px), add invisible padding to reach 44px.
- **Horizontal padding ≥ 2× vertical padding** — buttons look squat with equal padding.
- **Min width: 80px** for text buttons — prevents tiny, hard-to-click targets.

### States
| State | Visual Change | Notes |
|-------|--------------|-------|
| Default | Base styling | — |
| Hover | Background lightens/darkens 8–15% | `filter: brightness()` or color shift |
| Active/Pressed | Darkens further, optional 1px inward shift | Should feel "pushed" |
| Focus-visible | 2px outline, 2px offset, 3:1 contrast | Never remove without replacement |
| Disabled | 40–50% opacity OR gray out | Must look inactive, not just faded |
| Loading | Spinner replaces or sits beside label, `pointer-events: none` | Keep button width stable |

### Contrast Requirements
| Element | Minimum Ratio | Reference |
|---------|--------------|-----------|
| Primary button text on fill | **4.5:1** (AA) | [WCAG 1.4.3](../color/contrast-and-accessibility.md) |
| Secondary button border | **3:1** against background | WCAG 1.4.11 |
| Focus ring | **3:1** against adjacent colors | WCAG 2.4.7 |
| Disabled button | No requirement, but must be perceivable | — |

### Icon Buttons
- **Icon-only buttons must have `aria-label`** — e.g., `<button aria-label="Close dialog">✕</button>`
- **Icon size: 20–24px** inside a 40–48px button. Icon should be ~50% of button height.
- **Icon + text gap: 8px** between icon and label
- **Icon goes left** for actions (➕ Add), **right** for direction (Next ➡)

### Destructive / Danger Buttons
- Use **red fills or red text** — `#cc0000` (5.9:1 on white) or `#dc2626`
- **Require confirmation** for irreversible actions (modal or two-step)
- Destructive actions should never be primary emphasis unless it's a dedicated confirmation dialog

### Button Groups
- **Gap between buttons: 8px** (same row), 12px (stacked)
- **Primary button goes right** (or bottom when stacked) — matches reading flow toward commitment
- **Max 3 buttons** in a group — more than 3 creates decision paralysis (Hick's Law)

### Button vs. Link
| Use `<button>` | Use `<a>` |
|----------------|-----------|
| Submits a form | Navigates to a new page/URL |
| Opens a dialog/modal | Links to an anchor on the page |
| Triggers a JS action | Downloads a file (`href` + `download`) |
| Toggles UI state | Links to external resource |

## CSS/Implementation Patterns

### Plain CSS
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 80px;
  height: 40px;
  padding: 8px 16px;
  font-size: 0.875rem;                       /* 14px */
  font-weight: 500;
  line-height: 1;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: background-color 150ms ease, box-shadow 150ms ease;
  -webkit-font-smoothing: antialiased;
}

/* Primary */
.btn-primary {
  background: var(--color-primary, #0055cc);
  color: #fff;
}
.btn-primary:hover { background: #003d99; }
.btn-primary:active { background: #002d73; }

/* Secondary */
.btn-secondary {
  background: transparent;
  color: var(--color-primary, #0055cc);
  border: 1.5px solid currentColor;
}
.btn-secondary:hover { background: rgba(0, 85, 204, 0.08); }
.btn-secondary:active { background: rgba(0, 85, 204, 0.14); }

/* Tertiary / Ghost */
.btn-tertiary {
  background: transparent;
  color: var(--color-primary, #0055cc);
  border: none;
  min-width: auto;
}
.btn-tertiary:hover { background: rgba(0, 0, 0, 0.05); }
.btn-tertiary:active { background: rgba(0, 0, 0, 0.1); }

/* Destructive */
.btn-danger {
  background: #cc0000;
  color: #fff;
}
.btn-danger:hover { background: #a30000; }

/* Focus — never remove */
.btn:focus-visible {
  outline: 2px solid var(--color-primary, #0055cc);
  outline-offset: 2px;
}

/* Disabled */
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;                      /* prevents hover flash */
}

/* Loading */
.btn[aria-busy="true"] {
  pointer-events: none;
  position: relative;
  color: transparent;                        /* hides label, keeps width */
}
.btn[aria-busy="true"]::after {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
  color: #fff;                               /* restore visible color */
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Sizes */
.btn-sm { height: 32px; padding: 6px 12px; font-size: 0.8125rem; }
.btn-lg { height: 48px; padding: 12px 24px; font-size: 1rem; }

/* Icon-only */
.btn-icon {
  min-width: auto;
  width: 40px;
  padding: 0;
}
.btn-icon.btn-sm { width: 32px; min-height: 44px; }  /* touch target */
```

### Tailwind
```html
<!-- Primary -->
<button class="inline-flex items-center gap-2 h-10 px-4 min-w-[80px]
  rounded-md bg-blue-700 text-white text-sm font-medium
  hover:bg-blue-800 active:bg-blue-900
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700
  disabled:opacity-45 disabled:pointer-events-none">
  Save changes
</button>

<!-- Secondary -->
<button class="inline-flex items-center gap-2 h-10 px-4 min-w-[80px]
  rounded-md border-[1.5px] border-blue-700 text-blue-700 text-sm font-medium
  hover:bg-blue-50 active:bg-blue-100
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700
  disabled:opacity-45 disabled:pointer-events-none">
  Cancel
</button>

<!-- Tertiary / Ghost -->
<button class="inline-flex items-center gap-2 h-10 px-4
  rounded-md text-blue-700 text-sm font-medium
  hover:bg-gray-100 active:bg-gray-200
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700
  disabled:opacity-45 disabled:pointer-events-none">
  Learn more
</button>

<!-- Danger -->
<button class="inline-flex items-center gap-2 h-10 px-4
  rounded-md bg-red-700 text-white text-sm font-medium
  hover:bg-red-800 active:bg-red-900
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
  Delete account
</button>

<!-- Icon-only (needs aria-label) -->
<button aria-label="Close" class="inline-flex items-center justify-center
  w-10 h-10 rounded-md text-gray-600
  hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2">
  <svg class="w-5 h-5" .../>
</button>

<!-- Button group -->
<div class="flex gap-2 justify-end">
  <button class="...btn-tertiary...">Cancel</button>
  <button class="...btn-primary...">Confirm</button>
</div>
```

## Common Mistakes

1. **Multiple primary buttons in one view** — competing primary actions create choice paralysis. Demote one to secondary.
2. **Using `<div>` or `<a>` instead of `<button>`** — breaks keyboard navigation and screen readers. If it triggers an action, it must be `<button>`.
3. **Removing focus outlines without replacement** — `:focus { outline: none }` fails WCAG 2.4.7. Use `:focus-visible` to hide for mouse users while keeping for keyboard.
4. **Disabled buttons with no context** — users can't figure out *why* it's disabled. Add a tooltip or helper text.
5. **Icon-only buttons without `aria-label`** — a trash can icon is meaningless to screen readers.
6. **Layout shift on loading** — button shrinks or grows when swapping label for spinner. Set explicit `min-width` or keep the label in the DOM.
7. **Ghost buttons as primary actions** — tertiary buttons lack visual weight; users miss them as CTAs.
8. **Tiny buttons on mobile** — a 28px button passes no touch target guideline. Minimum 44×44px tap area.

## Decision Tree

```
Which button type should I use?
├─ Does it navigate to a URL?
│  └─ Yes → Use <a>, styled as a button if needed
│  └─ No → Use <button>
│
├─ Is it the primary action on the page/section?
│  ├─ Yes → Primary (filled). Only ONE per visible area.
│  └─ No ↓
│
├─ Is it a supporting action (Cancel, Back, Reset)?
│  └─ Yes → Secondary (outlined)
│
├─ Is it a low-emphasis or inline action?
│  └─ Yes → Tertiary (ghost/text)
│
├─ Is it destructive (delete, remove, revoke)?
│  ├─ Reversible → Secondary + red text
│  └─ Irreversible → Primary red + confirmation step
│
├─ Is it icon-only?
│  └─ Add aria-label. Use tertiary or secondary style.
│     Ensure 44×44px touch target.
│
└─ How many buttons in this group?
   ├─ 1 → Primary or secondary based on importance
   ├─ 2 → Primary + secondary (primary on right)
   └─ 3 → Primary + secondary + tertiary. More than 3? Rethink the UI.
```

## Sources
- [WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) — 44×44px guidance
- [WCAG 2.2 — Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) — focus indicator requirements
- [Material Design 3 — Buttons](https://m3.material.io/components/buttons/overview) — emphasis levels and anatomy
- [Apple HIG — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) — sizing and placement
- [Nielsen Norman Group — OK-Cancel or Cancel-OK?](https://www.nngroup.com/articles/ok-cancel-or-cancel-ok/) — button order conventions
- [Hick's Law](../foundations/hicks-law.md) — limiting choices to reduce decision time
- [Contrast & Accessibility](../color/contrast-and-accessibility.md) — contrast ratio requirements
- [Spacing System](../layout/spacing-system.md) — padding and gap values

## Related Snippets
- [`btn-system.html`](../snippets/btn-system.html) — All emphasis levels × sizes × states as copy-paste Tailwind
