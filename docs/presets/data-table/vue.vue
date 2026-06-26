<!-- snippet: data-table
     category: data-display
     rationale: components/tables-and-lists.md
     requires: tailwindcss
-->
<script setup>
// Avatar color classes — full strings kept as named consts for Tailwind JIT and sync-check visibility.
const scAvatarClass = 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
const jwAvatarClass = 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
const mgAvatarClass = 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
const atAvatarClass = 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
const ppAvatarClass = 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'

// Status badge classes — full strings for Tailwind JIT.
const completedBadgeClass = 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100'
const pendingBadgeClass = 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100'
const cancelledBadgeClass = 'bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-100'

const statusBadgeClass = {
  Completed: completedBadgeClass,
  Pending: pendingBadgeClass,
  Cancelled: cancelledBadgeClass,
}

const orders = [
  { id: '#4721', initials: 'SC', avatarClass: scAvatarClass, name: 'Sarah Chen',   email: 'sarah.chen@email.com', amount: '$1,240.00', status: 'Completed', date: 'Mar 15, 2026' },
  { id: '#4720', initials: 'JW', avatarClass: jwAvatarClass, name: 'James Wilson',  email: 'j.wilson@email.com',   amount: '$856.50',   status: 'Pending',   date: 'Mar 15, 2026' },
  { id: '#4719', initials: 'MG', avatarClass: mgAvatarClass, name: 'Maria Garcia',  email: 'm.garcia@email.com',   amount: '$432.00',   status: 'Cancelled', date: 'Mar 14, 2026' },
  { id: '#4718', initials: 'AT', avatarClass: atAvatarClass, name: 'Alex Thompson', email: 'alex.t@email.com',     amount: '$189.99',   status: 'Completed', date: 'Mar 13, 2026' },
  { id: '#4717', initials: 'PP', avatarClass: ppAvatarClass, name: 'Priya Patel',   email: 'priya.p@email.com',    amount: '$67.25',    status: 'Pending',   date: 'Mar 12, 2026' },
]
</script>

<template>
  <main id="dataTableWrap" class="min-h-screen flex items-center justify-center p-4 md:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900">
    <div class="w-full max-w-4xl">
      <!-- Data Table: Sortable columns, status badges, hover rows -->
      <section class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" aria-labelledby="orders-title">
        <header class="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h1 id="orders-title" class="text-2xl font-semibold text-slate-900 dark:text-white">Orders</h1>
          <span class="text-sm text-slate-500 dark:text-slate-400">5 results</span>
        </header>
        <div class="overflow-x-auto min-w-0 max-w-full">
          <table class="w-full max-sm:block">
            <caption class="sr-only">Recent orders</caption>
            <thead class="max-sm:hidden">
              <tr class="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                <th scope="col" class="text-left text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-3 md:px-4">
                  <button class="min-h-11 inline-flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Sort by Order number">
                    Order #
                    <svg class="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/></svg>
                  </button>
                </th>
                <th scope="col" class="text-left text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-3 md:px-4">
                  <button class="min-h-11 inline-flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Sort by Customer">
                    Customer
                    <svg class="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/></svg>
                  </button>
                </th>
                <th scope="col" class="text-right text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-3 md:px-4">
                  <button class="min-h-11 inline-flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group ml-auto focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Sort by Amount, currently sorted descending">
                    Amount
                    <!-- Active sort indicator (descending) -->
                    <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 15l-4 4-4-4"/></svg>
                  </button>
                </th>
                <th scope="col" class="text-left text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-3 md:px-4">
                  <button class="min-h-11 inline-flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Sort by Status">
                    Status
                    <svg class="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/></svg>
                  </button>
                </th>
                <th scope="col" class="text-left text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-3 md:px-4">
                  <button class="min-h-11 inline-flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Sort by Date">
                    Date
                    <svg class="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/></svg>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700 max-sm:divide-y-0">
              <tr v-for="order in orders" :key="order.id" class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors max-sm:block max-sm:w-full max-sm:my-3 max-sm:py-2 max-sm:rounded-xl max-sm:border max-sm:border-slate-200 dark:max-sm:border-slate-700">
                <td data-label="Order #" class="px-2 py-4 md:px-4 text-sm font-medium text-slate-900 dark:text-white max-sm:flex max-sm:w-full max-sm:items-center max-sm:flex-wrap max-sm:justify-between max-sm:gap-4 max-sm:min-h-11 max-sm:text-right">
                  <span class="hidden max-sm:block text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">Order #</span>
                  <span class="min-w-0 break-words">{{ order.id }}</span>
                </td>
                <td data-label="Customer" class="px-2 py-4 md:px-4 max-sm:flex max-sm:w-full max-sm:items-center max-sm:flex-wrap max-sm:justify-between max-sm:gap-4 max-sm:min-h-11 max-sm:text-right">
                  <span class="hidden max-sm:block text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">Customer</span>
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0" :class="order.avatarClass">{{ order.initials }}</div>
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-slate-900 dark:text-white">{{ order.name }}</p>
                      <p class="text-sm text-slate-500 dark:text-slate-400 break-words">{{ order.email }}</p>
                    </div>
                  </div>
                </td>
                <td data-label="Amount" class="px-2 py-4 md:px-4 text-sm text-slate-900 dark:text-white text-right font-medium tabular-nums max-sm:flex max-sm:w-full max-sm:items-center max-sm:flex-wrap max-sm:justify-between max-sm:gap-4 max-sm:min-h-11">
                  <span class="hidden max-sm:block text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">Amount</span>
                  <span>{{ order.amount }}</span>
                </td>
                <td data-label="Status" class="px-2 py-4 md:px-4 max-sm:flex max-sm:w-full max-sm:items-center max-sm:flex-wrap max-sm:justify-between max-sm:gap-4 max-sm:min-h-11 max-sm:text-right">
                  <span class="hidden max-sm:block text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">Status</span>
                  <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium" :class="statusBadgeClass[order.status]">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>
                    {{ order.status }}
                  </span>
                </td>
                <td data-label="Date" class="px-2 py-4 md:px-4 text-sm text-slate-600 dark:text-slate-400 max-sm:flex max-sm:w-full max-sm:items-center max-sm:flex-wrap max-sm:justify-between max-sm:gap-4 max-sm:min-h-11 max-sm:text-right">
                  <span class="hidden max-sm:block text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">Date</span>
                  <span>{{ order.date }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>
</template>
