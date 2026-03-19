<!-- snippet: nav-tabs
     category: navigation
     rationale: components/navigation.md
     requires: tailwindcss
-->

<script>
  let { tabs = defaultTabs } = $props();
  let activeTab = $state(null);

  const defaultTabs = [
    { id: 'overview', label: 'Overview', content: 'This is the overview panel. It provides a summary of all the key information you need at a glance.' },
    { id: 'features', label: 'Features', content: 'Explore all the features available. Each feature is designed to improve your workflow and productivity.' },
    { id: 'reviews', label: 'Reviews', content: 'Read what our users have to say. Over 2,000 verified reviews with an average rating of 4.8 stars.' },
    { id: 'settings', label: 'Settings', content: 'Configure your preferences. Adjust notifications, display options, and account details here.' },
  ];

  // Initialize active tab to first tab
  $effect(() => {
    if (activeTab === null && tabs.length > 0) {
      activeTab = tabs[0].id;
    }
  });

  let activePanel = $derived(tabs.find((t) => t.id === activeTab));

  let tablistEl;

  function handleKeyDown(e) {
    const tabButtons = tablistEl?.querySelectorAll('[role="tab"]');
    if (!tabButtons) return;
    const tabArr = [...tabButtons];
    const idx = tabArr.indexOf(e.target);
    let next;

    if (e.key === 'ArrowRight') next = tabArr[(idx + 1) % tabArr.length];
    else if (e.key === 'ArrowLeft') next = tabArr[(idx - 1 + tabArr.length) % tabArr.length];
    else if (e.key === 'Home') next = tabArr[0];
    else if (e.key === 'End') next = tabArr[tabArr.length - 1];

    if (next) {
      e.preventDefault();
      next.focus();
      activeTab = next.dataset.tabId;
    }
  }
</script>

<div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
  <!-- Tab list -->
  <div class="border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6">
    <nav
      class="flex gap-0 -mb-px overflow-x-auto"
      role="tablist"
      aria-label="Content tabs"
      bind:this={tablistEl}
      onkeydown={handleKeyDown}
    >
      {#each tabs as tab (tab.id)}
        {@const isActive = tab.id === activeTab}
        <button
          role="tab"
          data-tab-id={tab.id}
          aria-selected={isActive}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          tabindex={isActive ? 0 : -1}
          onclick={() => activeTab = tab.id}
          class={`relative min-h-11 px-4 py-3 text-sm font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 rounded-t-md ${
            isActive
              ? 'text-blue-600 dark:text-blue-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors'
          }`}
        >
          {tab.label}
        </button>
      {/each}
    </nav>
  </div>

  <!-- Tab panel -->
  {#if activePanel}
    <div
      id={`panel-${activePanel.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${activePanel.id}`}
      tabindex="0"
      class="p-4 sm:p-6"
    >
      <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">{activePanel.label}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{activePanel.content}</p>
    </div>
  {/if}
</div>
