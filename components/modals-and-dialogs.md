# Modals and Dialogs

> **TL;DR:** Use modals sparingly — they interrupt user flow. Reserve them for confirmations and focused tasks. Always provide three close mechanisms (X button, Escape key, backdrop click). Trap focus inside the modal. Max width 500–600px. On mobile, consider bottom sheets instead.

## Core Principles

1. **Modals are interruptions by design** — they block the underlying content and force a decision. Use them only when that interruption is justified (destructive action confirmation, focused task that needs isolation).
2. **Every modal needs an obvious exit** — users should never feel trapped. Provide an X button (top-right), Escape key handler, and backdrop click-to-dismiss (except for critical confirmations).
3. **Focus must be trapped** — keyboard users pressing Tab must cycle through focusable elements inside the modal only. Focus escaping to the page behind is a critical accessibility failure.
4. **One modal at a time** — never open a modal from within a modal. If you need nested dialogs, rethink the UX flow. Use inline expansion, a multi-step flow within the same modal, or navigate to a new page.
5. **Modals are not pages** — if the content requires scrolling through many fields, a dedicated page or panel is a better pattern. Modals work best for 1–5 inputs or a single decision.

## Concrete Rules

### When to Use a Modal
| Use Case | Modal? | Better Alternative |
|----------|--------|--------------------|
| Destructive action confirmation | Yes | — |
| Quick edit (1–3 fields) | Yes | — |
| Sharing/permissions | Yes | — |
| Image/media preview | Yes | — |
| Cookie/consent notice | No | Banner |
| Long form (6+ fields) | No | Dedicated page |
| Help text / info | No | Tooltip or popover |
| Error messages | No | Inline alert or toast |
| Non-destructive confirmation | No | Toast notification |

### Sizing
| Property | Value |
|----------|-------|
| Max width | 500–600px default, 400px simple confirm, 800px complex |
| Min width | 320px (must fit smallest mobile) |
| Max height | 85vh (leave visible backdrop) |
| Border radius | 8–12px |
| Padding | 24px desktop, 16–20px mobile |
| Backdrop | `rgba(0,0,0,0.5)`, click to dismiss (except alertdialog) |
| Backdrop blur (optional) | `backdrop-filter: blur(4px)` |

### Anatomy
- **Close button** — top-right, always visible, minimum 44x44px touch target
- **Title** — required, describes the action or content
- **Body** — main content or form fields
- **Actions** — right-aligned buttons, primary on the right, destructive in red/danger color

## CSS/Implementation Patterns

### HTML Structure
```html
<div class="modal-backdrop" aria-hidden="true"></div>
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal-content">
    <header class="modal-header">
      <h2 id="modal-title">Confirm Deletion</h2>
      <button class="modal-close" aria-label="Close dialog">&times;</button>
    </header>
    <div class="modal-body">
      <p>This action cannot be undone. Continue?</p>
    </div>
    <footer class="modal-actions">
      <button class="btn-secondary">Cancel</button>
      <button class="btn-danger">Delete</button>
    </footer>
  </div>
</div>
```

### Alert Dialog (No Backdrop Dismiss)
```html
<!-- role="alertdialog" for critical confirmations — no backdrop dismiss -->
<div class="modal" role="alertdialog" aria-modal="true"
     aria-labelledby="alert-title" aria-describedby="alert-desc">
  <h2 id="alert-title">Unsaved Changes</h2>
  <p id="alert-desc">You have unsaved changes. Discard them?</p>
  <footer class="modal-actions">
    <button class="btn-secondary">Keep Editing</button>
    <button class="btn-danger">Discard</button>
  </footer>
</div>
```

### CSS for Modal and Backdrop
```css
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; }

.modal {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-4);                  /* Edge safety on mobile */
}

.modal-content {
  background: white; border-radius: 12px;
  width: 100%; max-width: 560px; max-height: 85vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-6) var(--space-6) var(--space-4); }
.modal-body   { padding: var(--space-2) var(--space-6); overflow-y: auto; flex: 1; }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-6) var(--space-6); }
.modal-close  { all: unset; cursor: pointer; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 8px; font-size: 1.5rem; }
```

### Native `<dialog>` Element
Use the native `<dialog>` element when possible. Calling `.showModal()` gives you backdrop rendering, Escape-to-close, and top-layer stacking for free. Pair with `<form method="dialog">` for built-in close-on-submit.

### Mobile Bottom Sheet Pattern
```css
@media (max-width: 640px) {
  .modal {
    align-items: flex-end;                  /* Pin to bottom on mobile */
  }

  .modal-content {
    max-width: 100%;
    border-radius: 16px 16px 0 0;           /* Round top corners only */
    max-height: 90vh;
  }
}
```

### Focus Trap (JavaScript)
```js
function trapFocus(modal) {
  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });
  first.focus();
}
```

### Tailwind Pattern
```html
<div class="fixed inset-0 bg-black/50 z-40"></div>
<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
    <div class="flex items-center justify-between p-6 pb-4">
      <h2 class="text-lg font-semibold">Title</h2>
      <button class="w-11 h-11 grid place-items-center rounded-lg hover:bg-gray-100">&times;</button>
    </div>
    <div class="px-6 py-2 overflow-y-auto flex-1">Content</div>
    <div class="flex justify-end gap-3 p-6 pt-4">
      <button class="btn-secondary">Cancel</button>
      <button class="btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

## Common Mistakes

1. **Using modals for inline-friendly content** — help text, success messages, status updates don't need to block the page. Use tooltips, toasts, or inline elements.
2. **No close mechanism besides action buttons** — always provide X button + Escape key. Users expect to dismiss without committing.
3. **Backdrop dismiss on alert dialogs** — destructive confirmations must not close on backdrop click. Use `role="alertdialog"`.
4. **Forgetting to return focus** — on close, focus must return to the triggering element or keyboard users lose their place.
5. **Scrolling the backdrop instead of the body** — set `overflow-y: auto` on `.modal-body`, not the outer wrapper.
6. **Nested modals** — never open a modal from a modal. Use steps within one modal or navigate to a page.
7. **No animation** — use 150–200ms fade-in + scale. Instant show/hide feels jarring.
8. **Too wide on desktop** — 400–600px for most modals. Only go wider (800px) for data tables or media.

## Decision Tree

```
Should I use a modal?
├─ Destructive action confirmation? → role="alertdialog", no backdrop dismiss
├─ Quick focused task (1–5 inputs)? → Standard modal, role="dialog"
├─ Media preview / lightbox? → Modal with max-width 80vw
├─ Long form (6+ fields)? → No. Use a dedicated page
├─ Info / help content? → No. Use tooltip or popover
├─ Success/error message? → No. Use toast or inline alert
├─ On mobile? → Consider bottom sheet
└─ Second modal on screen? → Never. Use steps or navigate
```

## Sources
- [WAI-ARIA Authoring Practices — Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WAI-ARIA Authoring Practices — Alert Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
- [MDN — `<dialog>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
- [Nielsen Norman Group — Modal & Nonmodal Dialogs](https://www.nngroup.com/articles/modal-nonmodal-dialog/)
- [Material Design 3 — Dialogs](https://m3.material.io/components/dialogs/overview)
- Related: [Forms](forms.md), [Buttons](buttons.md), [Feedback](feedback.md)

## Related Snippets
- [`feedback-modal.html`](../snippets/feedback-modal.html) — Modal dialog with backdrop + focus trap ([React](../snippets/react/feedback-modal.jsx), [Vue](../snippets/vue/feedback-modal.vue))
