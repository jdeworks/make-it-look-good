<!-- snippet: nav-bottom-mobile
     category: navigation
     rationale: components/navigation.md
     requires: tailwindcss
-->

<script>
  let { activeTab: controlledTab, onTabChange } = $props();
  let internalTab = $state('home');
  let activeTab = $derived(controlledTab ?? internalTab);

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'search', label: 'Search' },
    { id: 'notifications', label: 'Alerts' },
    { id: 'messages', label: 'Messages' },
    { id: 'profile', label: 'Profile' },
  ];

  function handleTabChange(id) {
    internalTab = id;
    onTabChange?.(id);
  }
</script>

<nav
  class="fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 safe-area-bottom"
  aria-label="Bottom navigation"
>
  <div class="flex items-center justify-around">
    {#each tabs as tab (tab.id)}
      {@const isActive = activeTab === tab.id}
      <button
        onclick={() => handleTabChange(tab.id)}
        class={`flex flex-col items-center justify-center gap-1 py-2 px-1 min-h-14 min-w-14 flex-1 transition-colors ${
          isActive
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
        aria-current={isActive ? 'page' : undefined}
        aria-label={tab.label}
      >
        {#if tab.id === 'home'}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11l2 2m-2-2v10a1 1 0 0 1-1 1h-3m-4 0a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2z" />
          </svg>
        {:else if tab.id === 'search'}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        {:else if tab.id === 'notifications'}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        {:else if tab.id === 'messages'}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        {:else if tab.id === 'profile'}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        {/if}
        <span class="text-[10px] font-medium leading-tight">{tab.label}</span>
      </button>
    {/each}
  </div>
</nav>
