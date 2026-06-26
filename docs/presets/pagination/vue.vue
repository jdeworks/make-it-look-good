<!-- snippet: nav-pagination
     category: navigation
     rationale: components/navigation.md
     requires: tailwindcss
-->
<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  totalPages: { type: Number, default: 10 },
})

const emit = defineEmits(['pageChange'])

const currentPage = ref(1)

const pages = computed(() => {
  const total = props.totalPages
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (currentPage.value <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (currentPage.value >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', currentPage.value - 1, currentPage.value, currentPage.value + 1, '...', total]
})

function goToPage(page) {
  if (page < 1 || page > props.totalPages) return
  currentPage.value = page
  emit('pageChange', page)
}
</script>

<template>
  <nav class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3" aria-label="Pagination">
    <div class="flex items-center justify-between gap-1">
      <!-- Previous -->
      <button
        :disabled="currentPage === 1"
        :class="[
          'inline-flex items-center justify-center min-h-11 min-w-11 px-2 sm:px-3 py-2 text-sm font-medium rounded-lg',
          currentPage === 1 ? 'text-slate-600 dark:text-slate-400 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none'
        ]"
        aria-label="Previous page"
        @click="goToPage(currentPage - 1)"
      >
        <svg class="w-4 h-4 sm:mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
        <span class="hidden sm:inline" aria-hidden="true">Previous</span>
      </button>

      <!-- Page numbers (desktop) -->
      <div class="hidden sm:flex items-center gap-1">
        <template v-for="(page, i) in pages" :key="i">
          <span v-if="page === '...'" class="min-h-11 min-w-11 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center" aria-hidden="true">&hellip;</span>
          <button
            v-else
            :class="[
              'min-h-11 min-w-11 px-3 py-2 text-sm font-medium rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
              page === currentPage ? 'text-white bg-blue-700' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors'
            ]"
            :aria-current="page === currentPage ? 'page' : undefined"
            :aria-label="`Page ${page}`"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </template>
      </div>

      <!-- Mobile page indicator -->
      <span class="sm:hidden text-sm text-slate-600 dark:text-slate-400 px-3">
        Page {{ currentPage }} of {{ totalPages }}
      </span>

      <!-- Next -->
      <button
        :disabled="currentPage === totalPages"
        :class="[
          'inline-flex items-center justify-center min-h-11 min-w-11 px-2 sm:px-3 py-2 text-sm font-medium rounded-lg',
          currentPage === totalPages ? 'text-slate-600 dark:text-slate-400 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none'
        ]"
        aria-label="Next page"
        @click="goToPage(currentPage + 1)"
      >
        <span class="hidden sm:inline" aria-hidden="true">Next</span>
        <svg class="w-4 h-4 sm:ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>
  </nav>
</template>
