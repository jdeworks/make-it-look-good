<!-- snippet: nav-sidebar
     category: navigation
     rationale: components/navigation.md
     requires: tailwindcss
-->

<script>
  let { activeItem = 'dashboard', onNavigate } = $props();
  let collapsed = $state(false);

  const navSections = [
    {
      label: 'Main',
      items: [
        { id: 'dashboard', name: 'Dashboard', href: '#', icon: 'grid' },
        { id: 'analytics', name: 'Analytics', href: '#', icon: 'chart' },
        { id: 'customers', name: 'Customers', href: '#', icon: 'users' },
      ],
    },
    {
      label: 'Management',
      items: [
        { id: 'products', name: 'Products', href: '#', icon: 'box' },
        { id: 'orders', name: 'Orders', href: '#', icon: 'clipboard' },
      ],
    },
  ];

  function handleNav(e, id) {
    e.preventDefault();
    onNavigate?.(id);
  }
</script>

<aside
  class={`${
    collapsed ? 'w-14' : 'w-60'
  } bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-screen sticky top-0 transition-[width] duration-200`}
>
  <!-- Header with collapse toggle -->
  <div class="h-16 flex items-center justify-between px-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
    {#if !collapsed}
      <span class="text-lg font-bold text-slate-900 dark:text-white pl-3 truncate">AppName</span>
    {/if}
    <button
      onclick={() => collapsed = !collapsed}
      class="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg min-h-11 min-w-11 flex items-center justify-center"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        {#if collapsed}
          <path d="M9 18l6-6-6-6" />
        {:else}
          <path d="M15 18l-6-6 6-6" />
        {/if}
      </svg>
    </button>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 overflow-y-auto p-2" aria-label="Main navigation">
    {#each navSections as section (section.label)}
      <div class="mb-4">
        {#if !collapsed}
          <p class="px-3 mb-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {section.label}
          </p>
        {/if}
        <div class="space-y-1">
          {#each section.items as item (item.id)}
            {@const isActive = activeItem === item.id}
            <a
              href={item.href}
              onclick={(e) => handleNav(e, item.id)}
              class={`flex items-center ${
                collapsed ? 'justify-center' : 'gap-3'
              } px-3 py-2.5 text-sm font-medium rounded-lg transition-colors min-h-11 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
              }`}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.name : undefined}
            >
              {#if item.icon === 'grid'}
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              {:else if item.icon === 'chart'}
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6m6 0h6m-6 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m6 0v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/></svg>
              {:else if item.icon === 'users'}
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              {:else if item.icon === 'box'}
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              {:else if item.icon === 'clipboard'}
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2"/></svg>
              {/if}
              {#if !collapsed}{item.name}{/if}
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </nav>

  <!-- Footer -->
  <div class="p-2 border-t border-slate-200 dark:border-slate-700 shrink-0">
    <a
      href="#"
      class={`flex items-center ${
        collapsed ? 'justify-center' : 'gap-3'
      } px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors min-h-11`}
      title={collapsed ? 'Settings' : undefined}
    >
      <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      {#if !collapsed}Settings{/if}
    </a>
    <!-- User -->
    <div class={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 mt-1`}>
      <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">JD</div>
      {#if !collapsed}
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-900 dark:text-white truncate">Jane Doe</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 truncate">jane@example.com</p>
        </div>
      {/if}
    </div>
  </div>
</aside>
