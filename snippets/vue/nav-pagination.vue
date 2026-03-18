<!-- snippet: nav-pagination
     category: navigation
     rationale: components/navigation.md
     requires: tailwindcss
-->
<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  totalItems: { type: Number, default: 97 },
  itemsPerPage: { type: Number, default: 10 },
  totalPages: { type: Number, default: null },
})

const emit = defineEmits(['pageChange'])

const currentPage = ref(1)
const computedTotalPages = computed(() => props.totalPages || Math.ceil(props.totalItems / props.itemsPerPage))

const rangeStart = computed(() => (currentPage.value - 1) * props.itemsPerPage + 1)
const rangeEnd = computed(() => Math.min(currentPage.value * props.itemsPerPage, props.totalItems))

const pages = computed(() => {
  const total = computedTotalPages.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items = [1]
  if (currentPage.value > 3) items.push('...')
  const start = Math.max(2, currentPage.value - 1)
  const end = Math.min(total - 1, currentPage.value + 1)
  for (let i = start; i <= end; i++) items.push(i)
  if (currentPage.value < total - 2) items.push('...')
  items.push(total)
  return items
})

function goToPage(page) {
  if (page < 1 || page > computedTotalPages.value) return
  currentPage.value = page
  emit('pageChange', page)
}
</script>

<template>
  <nav class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3" aria-label="Pagination">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Showing <span class="font-medium text-slate-900 dark:text-white">{{ rangeStart }}</span>&ndash;<span class="font-medium text-slate-900 dark:text-white">{{ rangeEnd }}</span> of <span class="font-medium text-slate-900 dark:text-white">{{ totalItems }}</span> results
      </p>

      <div class="flex items-center gap-1">
        <!-- Previous -->
        <button
          :disabled="currentPage === 1"
          :class="[
            'inline-flex items-center justify-center min-h-11 min-w-11 px-2 sm:px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            currentPage === 1 ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          ]"
          aria-label="Previous page"
          @click="goToPage(currentPage - 1)"
        >
          <svg class="w-4 h-4 sm:mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
          <span class="hidden sm:inline">Previous</span>
        </button>

        <!-- Page numbers (desktop) -->
        <div class="hidden sm:flex items-center gap-1">
          <template v-for="(page, i) in pages" :key="i">
            <span v-if="page === '...'" class="min-h-11 min-w-11 px-3 py-2 text-sm text-slate-400 dark:text-slate-500 flex items-center justify-center" aria-hidden="true">&hellip;</span>
            <button
              v-else
              :class="[
                'min-h-11 min-w-11 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                page === currentPage ? 'text-white bg-blue-600' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
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
          Page {{ currentPage }} of {{ computedTotalPages }}
        </span>

        <!-- Next -->
        <button
          :disabled="currentPage === computedTotalPages"
          :class="[
            'inline-flex items-center justify-center min-h-11 min-w-11 px-2 sm:px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            currentPage === computedTotalPages ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          ]"
          aria-label="Next page"
          @click="goToPage(currentPage + 1)"
        >
          <span class="hidden sm:inline">Next</span>
          <svg class="w-4 h-4 sm:ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>
  </nav>
</template>
