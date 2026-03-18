<!-- snippet: feedback-toast
     category: feedback
     rationale: components/feedback.md
     requires: tailwindcss
-->

<!--
  Usage (parent component):

  <script>
    import ToastContainer from './feedback-toast.svelte';

    let toasts = $state([]);

    function addToast(message, variant = 'info', duration = 5000) {
      const id = Date.now() + Math.random();
      toasts = [...toasts, { id, message, variant, duration }];
    }

    function removeToast(id) {
      toasts = toasts.filter(t => t.id !== id);
    }
  </script>

  <ToastContainer {toasts} onDismiss={removeToast} />
-->

<script>
  let { toasts = [], onDismiss } = $props();

  const variants = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400',
      text: 'text-green-800 dark:text-green-300',
      path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
      text: 'text-red-800 dark:text-red-300',
      path: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
      icon: 'text-amber-600 dark:text-amber-400',
      text: 'text-amber-800 dark:text-amber-300',
      path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
      icon: 'text-blue-600 dark:text-blue-400',
      text: 'text-blue-800 dark:text-blue-300',
      path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  };

  // Auto-dismiss timers managed via $effect
  let timers = new Map();

  $effect(() => {
    // Set up timers for any new toasts
    for (const toast of toasts) {
      if (!timers.has(toast.id)) {
        const duration = toast.duration ?? 5000;
        if (duration > 0) {
          const timer = setTimeout(() => {
            onDismiss?.(toast.id);
            timers.delete(toast.id);
          }, duration);
          timers.set(toast.id, timer);
        }
      }
    }

    // Clean up timers for removed toasts
    const currentIds = new Set(toasts.map((t) => t.id));
    for (const [id, timer] of timers) {
      if (!currentIds.has(id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  });
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none" aria-live="polite">
  {#each toasts as toast (toast.id)}
    {@const v = variants[toast.variant] || variants.info}
    <div
      class={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg ${v.bg}`}
      role="alert"
    >
      <svg class={`w-5 h-5 shrink-0 mt-0.5 ${v.icon}`} fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d={v.path} />
      </svg>
      <p class={`text-sm font-medium flex-1 ${v.text}`}>{toast.message}</p>
      <button
        onclick={() => onDismiss?.(toast.id)}
        class={`shrink-0 p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${v.icon}`}
        aria-label="Dismiss notification"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </div>
  {/each}
</div>
