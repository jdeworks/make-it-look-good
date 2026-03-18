<!-- snippet: feedback-toast
     category: feedback
     rationale: components/feedback.md
     requires: tailwindcss
-->
<script setup>
import { ref, onUnmounted } from 'vue'

const toasts = ref([])
const timers = new Map()

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
}

function addToast(message, variant = 'info', duration = 5000) {
  const id = Date.now() + Math.random()
  toasts.value.push({ id, message, variant })
  if (duration > 0) {
    const timer = setTimeout(() => dismiss(id), duration)
    timers.set(id, timer)
  }
  return id
}

function dismiss(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
  if (timers.has(id)) {
    clearTimeout(timers.get(id))
    timers.delete(id)
  }
}

onUnmounted(() => {
  timers.forEach(timer => clearTimeout(timer))
  timers.clear()
})

defineExpose({ addToast, dismiss })
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none" aria-live="polite">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg', variants[toast.variant]?.bg]"
        role="alert"
      >
        <svg
          :class="['w-5 h-5 shrink-0 mt-0.5', variants[toast.variant]?.icon]"
          fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" :d="variants[toast.variant]?.path" />
        </svg>
        <p :class="['text-sm font-medium flex-1', variants[toast.variant]?.text]">{{ toast.message }}</p>
        <button
          @click="dismiss(toast.id)"
          :class="['shrink-0 p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors', variants[toast.variant]?.icon]"
          aria-label="Dismiss notification"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  </Teleport>
</template>
