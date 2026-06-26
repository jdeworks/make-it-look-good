<!-- snippet: form-search-bar
     category: forms
     rationale: components/forms.md
     requires: tailwindcss
-->

<script>
  let { onSearch, placeholder = 'Search...', filters = [] } = $props();

  let query = $state('');
  let activeFilter = $state('all');
  let filterOpen = $state(false);
  let debounceTimer = $state(null);

  const defaultFilters = $derived(
    filters.length > 0
      ? filters
      : [
          { value: 'all', label: 'All' },
          { value: 'products', label: 'Products' },
          { value: 'users', label: 'Users' },
          { value: 'orders', label: 'Orders' },
        ]
  );

  let activeLabel = $derived(defaultFilters.find((f) => f.value === activeFilter)?.label);

  $effect(() => {
    // Track reactive deps
    const q = query;
    const f = activeFilter;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onSearch?.({ query: q, filter: f });
    }, 300);

    return () => clearTimeout(debounceTimer);
  });

  function selectFilter(value) {
    activeFilter = value;
    filterOpen = false;
  }
</script>

<div id="heroWrap" class="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900">
  <main class="py-12 md:py-16 lg:py-20 bg-white dark:bg-slate-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mx-auto text-center">
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white">
          Ship better products,<br class="hidden sm:inline" /> faster than ever
        </h1>
        <p class="mt-6 text-lg sm:text-xl leading-8 text-slate-600 dark:text-slate-300">
          Streamline your workflow with powerful tools designed for modern teams.
          From idea to deployment in minutes, not months.
        </p>
        <!-- Search bar replaces CTA buttons in this variant -->
        <div class="mt-10 relative flex items-center w-full max-w-2xl mx-auto">
          <!-- Search icon -->
          <svg class="absolute left-3 w-5 h-5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>

          <!-- Input -->
          <input
            type="search"
            bind:value={query}
            {placeholder}
            class="w-full pl-11 pr-28 py-2.5 text-base bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11"
          />

          <!-- Filter dropdown -->
          <div class="absolute right-1.5">
            <button
              onclick={() => filterOpen = !filterOpen}
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors min-h-[36px]"
              aria-expanded={filterOpen}
              aria-haspopup="true"
            >
              {activeLabel}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>

            {#if filterOpen}
              <div class="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[140px] z-10">
                {#each defaultFilters as f (f.value)}
                  <button
                    onclick={() => selectFilter(f.value)}
                    class={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                      activeFilter === f.value
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
