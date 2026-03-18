<!-- snippet: data-table
     category: data-display
     rationale: components/tables-and-lists.md
     requires: tailwindcss
-->

<script>
  let { data = [] } = $props();

  let sortKey = $state(null);
  let sortDir = $state('asc');
  let filter = $state('');

  const initialData = [
    { id: '#3210', customer: 'Sarah Chen', amount: 240.00, status: 'Completed', date: '2026-03-15' },
    { id: '#3209', customer: 'James Wilson', amount: 125.50, status: 'Pending', date: '2026-03-15' },
    { id: '#3208', customer: 'Maria Garcia', amount: 89.99, status: 'Completed', date: '2026-03-14' },
    { id: '#3207', customer: 'Alex Thompson', amount: 312.00, status: 'Cancelled', date: '2026-03-14' },
    { id: '#3206', customer: 'Priya Patel', amount: 67.25, status: 'Completed', date: '2026-03-13' },
  ];

  let rows = $derived(data.length > 0 ? data : initialData);

  const statusStyles = {
    Completed: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    Pending: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    Cancelled: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };

  function handleSort(key) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'asc';
    }
  }

  let filtered = $derived.by(() => {
    let result = rows;
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter(
        (r) => r.customer.toLowerCase().includes(q) || r.id.includes(q)
      );
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  });

  function sortIconClass(column) {
    return `w-4 h-4 inline-block ml-1 ${sortKey === column ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`;
  }
</script>

<div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
  <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Orders</h2>
    <div class="relative">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
      <input
        type="search"
        placeholder="Filter orders..."
        bind:value={filter}
        class="pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11 w-full sm:w-64"
      />
    </div>
  </div>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
          <th class="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none" onclick={() => handleSort('id')}>
            Order
            <svg class={sortIconClass('id')} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              {#if sortKey === 'id' && sortDir === 'desc'}
                <path d="M17 7l-5 5-5-5" />
              {:else}
                <path d="M7 17l5-5 5 5" />
              {/if}
            </svg>
          </th>
          <th class="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none" onclick={() => handleSort('customer')}>
            Customer
            <svg class={sortIconClass('customer')} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              {#if sortKey === 'customer' && sortDir === 'desc'}
                <path d="M17 7l-5 5-5-5" />
              {:else}
                <path d="M7 17l5-5 5 5" />
              {/if}
            </svg>
          </th>
          <th class="text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none" onclick={() => handleSort('amount')}>
            Amount
            <svg class={sortIconClass('amount')} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              {#if sortKey === 'amount' && sortDir === 'desc'}
                <path d="M17 7l-5 5-5-5" />
              {:else}
                <path d="M7 17l5-5 5 5" />
              {/if}
            </svg>
          </th>
          <th class="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none" onclick={() => handleSort('status')}>
            Status
            <svg class={sortIconClass('status')} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              {#if sortKey === 'status' && sortDir === 'desc'}
                <path d="M17 7l-5 5-5-5" />
              {:else}
                <path d="M7 17l5-5 5 5" />
              {/if}
            </svg>
          </th>
          <th class="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none" onclick={() => handleSort('date')}>
            Date
            <svg class={sortIconClass('date')} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              {#if sortKey === 'date' && sortDir === 'desc'}
                <path d="M17 7l-5 5-5-5" />
              {:else}
                <path d="M7 17l5-5 5 5" />
              {/if}
            </svg>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
        {#each filtered as row (row.id)}
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <td class="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{row.id}</td>
            <td class="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{row.customer}</td>
            <td class="px-6 py-4 text-sm text-slate-900 dark:text-white text-right font-medium">${row.amount.toFixed(2)}</td>
            <td class="px-6 py-4">
              <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[row.status]}`}>
                {row.status}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
              {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="5" class="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No orders found matching "{filter}"
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
