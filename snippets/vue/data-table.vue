<!-- snippet: data-table
     category: data-display
     rationale: components/tables-and-lists.md
     requires: tailwindcss
-->
<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => [
      { id: '#3210', customer: 'Sarah Chen', amount: 240.00, status: 'Completed', date: '2026-03-15' },
      { id: '#3209', customer: 'James Wilson', amount: 125.50, status: 'Pending', date: '2026-03-15' },
      { id: '#3208', customer: 'Maria Garcia', amount: 89.99, status: 'Completed', date: '2026-03-14' },
      { id: '#3207', customer: 'Alex Thompson', amount: 312.00, status: 'Cancelled', date: '2026-03-14' },
      { id: '#3206', customer: 'Priya Patel', amount: 67.25, status: 'Completed', date: '2026-03-13' },
    ],
  },
})

const sortKey = ref(null)
const sortDir = ref('asc')
const filter = ref('')

const statusStyles = {
  Completed: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  Pending: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  Cancelled: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

function handleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const filtered = computed(() => {
  let rows = props.data
  if (filter.value) {
    const q = filter.value.toLowerCase()
    rows = rows.filter(r => r.customer.toLowerCase().includes(q) || r.id.includes(q))
  }
  if (sortKey.value) {
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey.value]
      const bv = b[sortKey.value]
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir.value === 'asc' ? cmp : -cmp
    })
  }
  return rows
})

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
    <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Orders</h2>
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        <input
          v-model="filter"
          type="search"
          placeholder="Filter orders..."
          class="pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11 w-full sm:w-64"
        >
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
            <th v-for="col in [
              { key: 'id', label: 'Order', align: 'left' },
              { key: 'customer', label: 'Customer', align: 'left' },
              { key: 'amount', label: 'Amount', align: 'right' },
              { key: 'status', label: 'Status', align: 'left' },
              { key: 'date', label: 'Date', align: 'left' },
            ]" :key="col.key"
              :class="[
                'text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none',
                col.align === 'right' ? 'text-right' : 'text-left'
              ]"
              @click="handleSort(col.key)"
            >
              {{ col.label }}
              <svg
                class="w-4 h-4 inline-block ml-1"
                :class="sortKey === col.key ? 'text-slate-900 dark:text-white' : 'text-slate-400'"
                fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
              >
                <path v-if="sortKey === col.key && sortDir === 'desc'" d="M17 7l-5 5-5-5" />
                <path v-else d="M7 17l5-5 5 5" />
              </svg>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
          <tr v-for="row in filtered" :key="row.id" class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <td class="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{{ row.id }}</td>
            <td class="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{{ row.customer }}</td>
            <td class="px-6 py-4 text-sm text-slate-900 dark:text-white text-right font-medium">${{ row.amount.toFixed(2) }}</td>
            <td class="px-6 py-4">
              <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', statusStyles[row.status]]">
                {{ row.status }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{{ formatDate(row.date) }}</td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="5" class="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No orders found matching "{{ filter }}"
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
