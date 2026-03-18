# Feedback Components

> **TL;DR:** Toast notifications for non-critical confirmations (auto-dismiss 4–8s, max 3 visible). Inline alerts for contextual warnings/errors. Never auto-dismiss errors — users need time to read and act. Always pair color with an icon and text for accessibility.

## Core Principles

1. **Match urgency to intrusiveness** — a success confirmation can be a quiet toast; a destructive error needs an inline alert that persists until resolved.
2. **Never rely on color alone** — ~8% of men have color vision deficiency. Every feedback state needs an icon and descriptive text alongside its color.
3. **Feedback must be immediate** — users should see a response within 100ms of their action. If processing takes longer, show a spinner or skeleton.
4. **Don't punish the user** — error messages should explain what went wrong and how to fix it, not just say "Invalid input."
5. **Respect attention** — too many notifications cause alert fatigue. Be selective about what deserves a toast vs. a subtle inline indicator.

## Concrete Rules

### Toast / Snackbar Notifications
| Property | Value |
|----------|-------|
| Auto-dismiss duration | 4–8 seconds (5s default) |
| Position | Top-right (desktop) or bottom-center (mobile) |
| Max visible simultaneously | 3 — queue the rest |
| Min width | 288px |
| Max width | 560px |
| Animation | Slide in 200ms ease-out, fade out 150ms |
| Z-index | 1000+ (above modals if needed) |
| Include dismiss button | Always — don't force users to wait |

- Use toasts for: save confirmations, sent messages, copied-to-clipboard, non-critical status updates
- Never use toasts for: errors requiring action, form validation, destructive confirmations
- Snackbars (Material pattern): include one optional action ("Undo") — 10s duration for undoable actions

### Inline Alerts
| Variant | Color | Icon | Use Case |
|---------|-------|------|----------|
| Error | Red (`hsl(0 72% 51%)`) | Circle-X / Exclamation | Failed actions, critical problems |
| Warning | Amber (`hsl(38 92% 50%)`) | Triangle-exclamation | Potential issues, approaching limits |
| Success | Green (`hsl(142 71% 45%)`) | Check-circle | Completed actions, verified states |
| Info | Blue (`hsl(217 91% 60%)`) | Info-circle | Neutral information, tips, guidance |

- Place inline alerts near the content they relate to — not at the top of the page
- Persist errors until the issue is resolved — never auto-dismiss
- Keep alert text concise: one sentence for the problem, one for the fix
- Dismissible: warnings and info yes, errors no (until resolved)

### Form Validation Messages
| Property | Value |
|----------|-------|
| Position | Directly below the invalid field, above the next field |
| Color | Red text (`hsl(0 72% 51%)`) with red left-border or red outline on the field |
| Font size | 13–14px (one step smaller than input text) |
| Icon | Small error icon (16px) before the text |
| Timing | On blur (first pass) then on change (after first error shown) |

- Message pattern: "Password must be at least 8 characters" — not "Invalid password"
- Mark fields with `aria-invalid="true"` and link to error with `aria-describedby`
- Show a summary of all errors at the top of long forms, with anchor links to each field

### Progress Indicators — Timing Thresholds
| Duration | Indicator | Reason |
|----------|-----------|--------|
| < 300ms | None | Feels instant; spinner would flash distractingly |
| 300ms – 2s | Spinner | Brief enough that progress percentage isn't meaningful |
| 2s – 10s | Spinner + label | "Loading..." gives confidence something is happening |
| > 10s | Progress bar | Users need to estimate remaining time |
| Unknown duration | Skeleton screen | Content-shaped placeholders reduce perceived wait time |

- Delay spinner appearance by 300ms — if the action completes faster, no spinner flashes
- Progress bars: animate smoothly, never jump backward, reach 100% before completing
- Skeleton screens: use for initial page loads and content-heavy sections
- Never use a spinner AND a skeleton at the same time

### Empty States
- Show when: no data yet, search returns nothing, filters exclude everything, errors cleared a list
- Structure: illustration/icon (optional) + headline + description + primary action button
- Headline: "No [items] yet" or "No results found"
- Description: explain why it's empty and what to do — "Create your first project to get started"
- Don't leave areas completely blank — blank space looks like a loading bug

## CSS/Implementation Patterns

### Toast Container
```css
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 560px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface-elevated);
  border-radius: 8px;
  box-shadow: 0 4px 12px hsl(0 0% 0% / 0.15);
  animation: toast-in 200ms ease-out;
}

.toast.dismissing {
  animation: toast-out 150ms ease-in forwards;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(100%); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes toast-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(100%); }
}

/* Mobile: bottom-center */
@media (max-width: 639px) {
  .toast-container {
    top: auto;
    bottom: 16px;
    right: 16px;
    left: 16px;
    align-items: center;
  }
}
```

### Inline Alert
```css
.alert {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  border-left: 4px solid;
  font-size: 0.875rem;
}

.alert-error   { border-color: hsl(0 72% 51%);   background: hsl(0 72% 51% / 0.08);   }
.alert-warning { border-color: hsl(38 92% 50%);   background: hsl(38 92% 50% / 0.08);  }
.alert-success { border-color: hsl(142 71% 45%);  background: hsl(142 71% 45% / 0.08); }
.alert-info    { border-color: hsl(217 91% 60%);  background: hsl(217 91% 60% / 0.08); }

.alert-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 1px;
}
```

### Validation Message
```css
.field-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 0.8125rem;
  color: hsl(0 72% 51%);
}

.field-error-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

/* Delayed spinner — only shows after 300ms */
.spinner-delayed {
  opacity: 0;
  animation: fade-in 150ms ease-in 300ms forwards;
}

@keyframes fade-in {
  to { opacity: 1; }
}
```

## Common Mistakes

1. **Auto-dismissing error toasts** — users may not read them in time, especially with screen readers. Errors must persist until acknowledged or resolved.
2. **Stacking 5+ toasts** — this overwhelms users. Queue them, show max 3, or consolidate ("3 items saved").
3. **Validation only on submit** — users fill 10 fields then get a wall of red. Validate on blur for the first pass, then on change after an error is shown.
4. **Generic error messages** — "Something went wrong" is useless. Say what failed and what the user can do about it.
5. **Spinner for instant actions** — if an action takes < 300ms, a spinner flashing for one frame looks janky. Delay spinner display by 300ms.
6. **Color-only feedback** — a red border means nothing to a color-blind user. Add an icon and error text.
7. **No `aria-live` on dynamic feedback** — toasts and inline alerts inserted into the DOM need `aria-live="polite"` (info/success) or `role="alert"` (errors) so screen readers announce them.

## Decision Tree

```
What feedback pattern should I use?
├─ Non-critical confirmation (saved, copied, sent) → Toast (5s auto-dismiss)
├─ Undoable action (deleted, archived) → Snackbar with "Undo" action (10s)
├─ Error requiring user action → Inline alert (persistent, not dismissible)
├─ Warning about a potential issue → Inline alert (dismissible)
├─ Form field invalid → Validation message below the field
├─ Action takes 300ms–2s → Delayed spinner
├─ Action takes 2s–10s → Spinner with label
├─ Action takes 10s+ → Progress bar with percentage
├─ Initial page load → Skeleton screen
├─ No data to display → Empty state with action
└─ Not sure → Inline alert (safest default — visible, persistent, accessible)
```

## Sources
- [Material Design 3 — Snackbar](https://m3.material.io/components/snackbar)
- [WCAG 1.3.1 — Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships)
- [WCAG 4.1.3 — Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages) — `aria-live` requirements
- [Nielsen Norman Group — Indicators, Validations, and Notifications](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- [Adrian Roselli — Defining Toast Messages](https://adrianroselli.com/2020/01/defining-toast-messages.html)
- [Nielsen Norman Group — Response Time Limits](https://www.nngroup.com/articles/response-times-3-important-limits/) — 100ms/1s/10s thresholds

## Related Presets
- Toast notifications — [React](../docs/presets/stats-row/react-toast.jsx), [Vue](../docs/presets/stats-row/vue-toast.vue)
- Modal dialog — [React](../docs/presets/dropdown/react-modal.jsx), [Vue](../docs/presets/dropdown/vue-modal.vue), [Svelte](../docs/presets/dropdown/svelte-modal.svelte)
