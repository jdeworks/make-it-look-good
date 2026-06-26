<!-- snippet: feedback-toast
     category: feedback
     rationale: components/feedback.md
     requires: tailwindcss
-->
<script setup>
import { ref, onUnmounted } from 'vue'

const STATS = [
  { label: 'Total Revenue',   value: '$48,295', delta: '12.5%', positive: true },
  { label: 'Active Users',    value: '2,847',   delta: '8.2%',  positive: true },
  { label: 'Bounce Rate',     value: '24.3%',   delta: '3.1%',  positive: false },
  { label: 'Conversion Rate', value: '3.24%',   delta: '1.8%',  positive: true },
]

const UP_PATH   = 'M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z'
const DOWN_PATH = 'M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z'

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
  <div id="statsRowWrap" class="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900">
    <main class="py-12 md:py-16 lg:py-20 bg-white dark:bg-slate-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <button
            v-for="stat in STATS"
            :key="stat.label"
            type="button"
            @click="addToast(`${stat.label}: ${stat.value}`, stat.positive ? 'success' : 'warning')"
            class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm text-left hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">{{ stat.label }}</p>
            <p class="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{{ stat.value }}</p>
            <div class="mt-3 flex items-center gap-1.5">
              <span
                :class="['inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', stat.positive ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400']"
              >
                <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" :d="stat.positive ? UP_PATH : DOWN_PATH" clip-rule="evenodd" />
                </svg>
                {{ stat.delta }}
              </span>
              <span class="text-xs text-slate-500 dark:text-slate-400">vs last month</span>
            </div>
          </button>
        </div>
      </div>
    </main>

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
  </div>
</template>
