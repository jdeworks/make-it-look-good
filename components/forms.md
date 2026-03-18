# Forms

> **TL;DR:** Use a single-column layout with labels above inputs. Minimum input height is 44px. Validate inline on blur, show errors below the field, and mark required fields with an asterisk. Keep forms to 5–7 fields per step — break longer forms into a multi-step wizard.

## Core Principles

1. **Single column wins** — single-column forms are completed ~16% faster than multi-column (Baymard Institute). Two columns cause ambiguous reading order and increase error rates.
2. **Labels must always be visible** — placeholder text disappears on focus, removing context. Users forget what field they're filling in. Always use a persistent `<label>` element above the field.
3. **Every field has a cost** — each added field reduces conversion. Remove optional fields aggressively. If you need more than 7 fields, use a multi-step form.
4. **Error prevention beats error correction** — use appropriate input types, autocomplete attributes, and input masks to prevent errors before they happen.
5. **Progressive disclosure** — show only what's relevant now. Conditional fields, multi-step flows, and smart defaults reduce cognitive load.

## Concrete Rules

### Layout and Sizing
| Property | Value | Notes |
|----------|-------|-------|
| Layout | Single column | Two columns only for tightly coupled short fields (city + zip, first + last name) |
| Input min-height | 44px | WCAG 2.5.8 target size; 48px on touch devices |
| Input width | 100% of container on mobile | Desktop: match expected content length (e.g., zip code field is narrower) |
| Label position | Above the field | Left-aligned labels on desktop are OK but slower (Matteo Penzo, UXMatters) |
| Label-to-field gap | 4–8px | Tight coupling — label belongs to its field |
| Between fields | 16px | Clear separation without breaking flow |
| Between field groups | 24–32px | Use `<fieldset>` + `<legend>` for semantic grouping |
| Form max-width | 480–560px | Prevents inputs from becoming uncomfortably wide on large screens |

### Required vs Optional Marking
| Scenario | Approach |
|----------|----------|
| Most fields are required | Mark optional fields with "(optional)" text |
| Most fields are optional | Mark required fields with asterisk `*` + legend explaining it |
| All fields are required | State "All fields are required" once at the top |

### Input Types
| Data | HTML Input Type | Why |
|------|----------------|-----|
| Email | `type="email"` | Mobile keyboard with `@`, built-in validation |
| Phone | `type="tel"` | Numeric keypad on mobile |
| URL | `type="url"` | Keyboard with `/` and `.com` |
| Numbers (quantity) | `type="number"` | Spinner, constrained input |
| Numbers (credit card, ID) | `type="text" inputmode="numeric"` | Numeric keyboard without spinner/step issues |
| Date | `type="date"` | Native date picker; avoids ambiguous format |
| Password | `type="password"` | Masked input with show/hide toggle |
| Search | `type="search"` | Clearable, native styling |
| Multi-line text | `<textarea>` | Visible area hints at expected length |

### Autocomplete Attributes
Always set `autocomplete` on common fields — it reduces friction by up to 30%:
- `autocomplete="name"` / `given-name` / `family-name`
- `autocomplete="email"` / `tel`
- `autocomplete="street-address"` / `address-line1` / `postal-code` / `country`
- `autocomplete="cc-number"` / `cc-exp` / `cc-csc`
- `autocomplete="new-password"` / `current-password`

### Validation
| Rule | Implementation |
|------|---------------|
| When to validate | On blur (when user leaves the field). Never on every keystroke — it's distracting. |
| When to clear errors | Immediately on input (as user corrects the mistake) |
| Error placement | Below the field, left-aligned, in red/danger color with an icon |
| Success indication | Subtle green checkmark — don't overdo it |
| On-submit validation | Always validate again server-side. Show a summary at the top + inline errors. |
| Error message tone | Specific and helpful: "Enter an email like name@example.com" not "Invalid input" |

### Multi-Step Forms
| Rule | Value |
|------|-------|
| When to break up | More than 7 fields, or logically distinct sections (account → shipping → payment) |
| Fields per step | 3–5 ideal, 7 max |
| Progress indicator | Numbered steps or progress bar — show total steps and current position |
| Navigation | "Back" and "Continue" buttons; allow revisiting completed steps |
| Validation | Validate each step before allowing progression |
| Data persistence | Save progress on each step; don't lose data on back-navigation |

## CSS/Implementation Patterns

### Base Form Layout
```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);              /* 16px between fields */
  max-width: 32rem;                 /* ~512px — prevents overly wide inputs */
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);              /* 4px label-to-input */
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);              /* 16px between fields in group */
  padding-top: var(--space-6);     /* 24px before new section */
}

.form-section legend {
  font-weight: 600;
  font-size: 1.125rem;
  padding-bottom: var(--space-2);  /* 8px below legend */
}
```

### Input States
```css
.input {
  height: 2.75rem;                  /* 44px */
  padding: var(--space-2) var(--space-3);  /* 8px 12px */
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  font-size: 1rem;                  /* 16px — prevents iOS zoom */
  background: var(--color-surface);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  width: 100%;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-ring);  /* Focus ring */
}

.input[aria-invalid="true"] {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px var(--color-error-ring);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-surface-disabled);
}
```

### Error and Help Text
```css
.field-error {
  color: var(--color-error);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: var(--space-1);              /* 4px icon-to-text */
}

.field-hint {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}
```

### Tailwind Equivalents
```html
<!-- Form group -->
<div class="flex flex-col gap-1">
  <label class="text-sm font-medium text-gray-700" for="email">
    Email <span class="text-red-500">*</span>
  </label>
  <input
    id="email"
    type="email"
    autocomplete="email"
    required
    class="h-11 px-3 border border-gray-300 rounded-md text-base
           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
           aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500
           disabled:opacity-50 disabled:cursor-not-allowed"
  />
  <p class="text-sm text-red-600 flex items-center gap-1" role="alert">
    <!-- Error icon + message here when invalid -->
  </p>
</div>
```

## Accessibility Checklist

| Requirement | Implementation |
|-------------|---------------|
| Label association | Every `<input>` has a `<label>` with matching `for`/`id` |
| Error announcement | Error messages use `role="alert"` or `aria-live="assertive"` |
| Invalid state | Set `aria-invalid="true"` on invalid fields |
| Error description | Link error to field with `aria-describedby` |
| Field grouping | Related fields in `<fieldset>` with `<legend>` |
| Required fields | Use `required` attribute (or `aria-required="true"` for custom controls) |
| Keyboard navigation | All fields reachable via Tab; logical tab order matches visual order |
| Font size | Inputs at 16px+ to prevent iOS Safari zoom on focus |

## Common Mistakes

1. **Placeholder-only labels** — placeholders disappear on focus. Users with cognitive disabilities, slow typers, and anyone who tabs away and back lose context. Always use visible labels.
2. **Tiny tap targets** — inputs under 44px height cause miss-taps on mobile. Apple and Google both mandate 44–48px minimum.
3. **Too many fields** — every field you add reduces completion rate. A study by Imagescape found reducing fields from 11 to 4 increased conversions by 120%.
4. **Validating on keystroke** — showing "Invalid email" while someone is still typing is hostile. Validate on blur, clear on input.
5. **Generic error messages** — "This field is invalid" tells the user nothing. Say what's wrong and how to fix it: "Phone number must be 10 digits."
6. **Multi-column on mobile** — two-column forms are confusing on any screen, but on mobile they're unusable. Always stack to single column.
7. **Missing autocomplete** — not setting autocomplete attributes forces users to re-type information their browser already knows.
8. **No visible focus indicator** — removing outlines without replacement makes keyboard navigation impossible. Always provide a focus ring.
9. **Disabled submit without explanation** — a grayed-out button with no indication of what's wrong is a dead end. Show inline errors or a tooltip.
10. **CAPTCHAs as the first interaction** — they frustrate users and reduce conversions by 3–12%. Use invisible/backend detection instead.

## Decision Tree

```
Building a form?
├─ How many fields?
│  ├─ 1–7 → Single-step form
│  └─ 8+ → Multi-step wizard (3–5 fields per step, progress bar)
├─ Layout?
│  ├─ Default → Single column, 480–560px max-width
│  └─ Two tightly coupled short fields (first/last name, city/zip)
│     └─ Side-by-side OK, but stack on mobile (<480px)
├─ Label placement?
│  ├─ Default → Above the field, left-aligned
│  └─ Very space-constrained horizontal layout → Left-aligned inline labels
│     (but this is slower — avoid if possible)
├─ Validation?
│  ├─ When → On blur; clear errors on input
│  ├─ Where → Error message below the field
│  └─ Server-side → Always re-validate; show summary + inline errors
├─ Required/optional?
│  ├─ Most required → Mark the optional ones "(optional)"
│  └─ Mix → Mark required with asterisk + explain at top
└─ Submit button?
   ├─ Always visible and enabled (don't disable without explanation)
   ├─ Label with specific action: "Create Account" not "Submit"
   └─ Full width on mobile, auto-width on desktop
```

## Sources
- Wroblewski, L. (2008). *Web Form Design: Filling in the Blanks*. — label placement, single-column layout
- [Baymard Institute — Form Usability](https://baymard.com/blog/avoid-multi-column-forms) — multi-column completion rate data
- Penzo, M. (2006). [Label Placement in Forms](https://www.uxmatters.com/mt/archives/2006/07/label-placement-in-forms.php), UXMatters — eye-tracking study
- [WCAG 2.2 — Success Criterion 2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) — 44px minimum
- [WCAG 2.2 — Success Criterion 3.3.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)
- [Google Material Design 3 — Text Fields](https://m3.material.io/components/text-fields/overview)
- [Apple HIG — Text Fields](https://developer.apple.com/design/human-interface-guidelines/text-fields)
- [HTML autocomplete attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete) — MDN

## Related Snippets
- [`form-login.html`](../snippets/form-login.html) — Login form ([React](../snippets/react/form-login.jsx), [Vue](../snippets/vue/form-login.vue))
- [`form-signup.html`](../snippets/form-signup.html) — Signup with password strength ([React](../snippets/react/form-signup.jsx), [Vue](../snippets/vue/form-signup.vue))
- [`form-settings.html`](../snippets/form-settings.html) — Grouped settings with toggles
- [`form-search-bar.html`](../snippets/form-search-bar.html) — Search with filter dropdown ([React](../snippets/react/form-search-bar.jsx), [Vue](../snippets/vue/form-search-bar.vue))
- [`form-contact.html`](../snippets/form-contact.html) — Contact form
