<!-- snippet: feedback-modal
     category: feedback
     rationale: components/modals-and-dialogs.md
     requires: tailwindcss
-->

<script>
  let {
    open = false,
    onClose,
    title = '',
    children,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    variant = 'default',
  } = $props();

  let dialogEl = $state(null);
  let previousFocus = $state(null);

  let confirmColors = $derived(
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white'
  );

  $effect(() => {
    if (open) {
      previousFocus = document.activeElement;
      // Focus the dialog after a tick so the DOM is rendered
      requestAnimationFrame(() => dialogEl?.focus());
    } else if (previousFocus) {
      previousFocus.focus();
    }
  });

  $effect(() => {
    if (!open) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose?.();

      // Focus trap
      if (e.key === 'Tab') {
        const focusable = dialogEl?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onclick={onClose} aria-hidden="true"></div>

    <!-- Dialog -->
    <div
      bind:this={dialogEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
      class="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 focus:outline-none"
    >
      <!-- Close button -->
      <button
        onclick={onClose}
        class="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md transition-colors min-h-8 min-w-8 flex items-center justify-center"
        aria-label="Close dialog"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>

      <!-- Content -->
      <h2 id="modal-title" class="text-lg font-semibold text-slate-900 dark:text-white pr-8">{title}</h2>
      <div class="mt-3 text-sm text-slate-600 dark:text-slate-400">
        {@render children()}
      </div>

      <!-- Actions -->
      <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button
          onclick={onClose}
          class="border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium px-4 py-2 rounded-lg text-sm transition-colors min-h-11"
        >
          {cancelLabel}
        </button>
        <button
          onclick={onConfirm}
          class={`font-medium px-4 py-2 rounded-lg text-sm transition-colors min-h-11 ${confirmColors}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
