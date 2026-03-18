<!-- snippet: feedback-modal
     category: feedback
     rationale: components/modals-and-dialogs.md
     requires: tailwindcss
-->
<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  open: Boolean,
  title: { type: String, default: 'Confirm action' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' },
  variant: { type: String, default: 'default' },
})

const emit = defineEmits(['close', 'confirm'])

const dialogRef = ref(null)
let previousFocus = null

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    previousFocus = document.activeElement
    await nextTick()
    dialogRef.value?.focus()
  } else if (previousFocus) {
    previousFocus.focus()
  }
})

function handleKeyDown(e) {
  if (!props.open) return
  if (e.key === 'Escape') emit('close')

  if (e.key === 'Tab') {
    const focusable = dialogRef.value?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

onMounted(() => document.addEventListener('keydown', handleKeyDown))
onUnmounted(() => document.removeEventListener('keydown', handleKeyDown))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" @click="emit('close')" aria-hidden="true" />

      <!-- Dialog -->
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabindex="-1"
        class="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 focus:outline-none"
      >
        <button
          @click="emit('close')"
          class="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md transition-colors min-h-8 min-w-8 flex items-center justify-center"
          aria-label="Close dialog"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        <h2 id="modal-title" class="text-lg font-semibold text-slate-900 dark:text-white pr-8">{{ title }}</h2>
        <div class="mt-3 text-sm text-slate-600 dark:text-slate-400">
          <slot />
        </div>

        <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            @click="emit('close')"
            class="border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium px-4 py-2 rounded-lg text-sm transition-colors min-h-11"
          >
            {{ cancelLabel }}
          </button>
          <button
            @click="emit('confirm')"
            :class="[
              'font-medium px-4 py-2 rounded-lg text-sm transition-colors min-h-11',
              variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
            ]"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
