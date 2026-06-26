<!-- snippet: shell-sidebar-topbar
     category: layout-shell
     rationale: components/navigation.md, layout/grid-systems.md
     requires: tailwindcss
-->

<script>
  let { children } = $props();
  let sidebarOpen = $state(false);

  const activeNavClass = 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  const inactiveNavClass = 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white';

  const navItems = [
    { name: 'Dashboard', href: '#', icon: 'grid', active: true },
    { name: 'Users', href: '#', icon: 'users' },
    { name: 'Products', href: '#', icon: 'box' },
    { name: 'Orders', href: '#', icon: 'clipboard' },
    { name: 'Reports', href: '#', icon: 'chart' },
  ];
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-900">
  <!-- Mobile overlay -->
  {#if sidebarOpen}
    <div
      class="fixed inset-0 bg-slate-900/50 z-20 lg:hidden"
      aria-hidden="true"
      onclick={() => sidebarOpen = false}
      role="presentation"
    ></div>
  {/if}

  <!-- Sidebar -->
  <aside
    id="sidebar"
    class={`fixed inset-y-0 left-0 w-60 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col z-30 transition-transform duration-200 ${
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    } lg:translate-x-0`}
  >
    <div class="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-700">
      <span class="text-lg font-bold text-slate-900 dark:text-white">AppName</span>
    </div>

    <nav class="flex-1 overflow-y-auto p-4 space-y-1" aria-label="Main navigation">
      {#each navItems as item (item.name)}
        <a
          href={item.href}
          class={`flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
            item.active ? activeNavClass : inactiveNavClass
          }`}
          aria-current={item.active ? 'page' : undefined}
        >
          {#if item.icon === 'grid'}
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          {:else if item.icon === 'users'}
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          {:else if item.icon === 'box'}
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          {:else if item.icon === 'clipboard'}
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2"/></svg>
          {:else if item.icon === 'chart'}
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6m6 0h6m-6 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m6 0v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/></svg>
          {/if}
          {item.name}
        </a>
      {/each}
    </nav>

    <div class="p-4 border-t border-slate-200 dark:border-slate-700">
      <a href="#" class="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors">
        <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        Settings
      </a>
    </div>
  </aside>

  <!-- Main wrapper -->
  <div class="lg:ml-60 flex flex-col min-h-screen">
    <!-- Top bar -->
    <header class="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
      <button
        class="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        onclick={() => sidebarOpen = !sidebarOpen}
        aria-label="Toggle menu"
        aria-expanded={sidebarOpen}
        aria-controls="sidebar"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>

      <div class="hidden sm:flex items-center flex-1 max-w-md">
        <div class="relative w-full">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="search" autocomplete="off" aria-label="Search" placeholder="Search..." class="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11" />
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button class="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg min-h-11 min-w-11 relative focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Notifications">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div class="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-white text-sm font-semibold">JD</div>
      </div>
    </header>

    <!-- Content area -->
    <main class="flex-1 p-4 lg:p-8">
      <div class="max-w-7xl">
        {@render children()}
      </div>
    </main>
  </div>
</div>
