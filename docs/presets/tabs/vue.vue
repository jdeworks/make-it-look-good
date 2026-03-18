<!-- snippet: nav-tabs
     category: navigation
     rationale: components/navigation.md
     requires: tailwindcss
-->
<script setup>
import { ref } from 'vue'

const props = defineProps({
  tabs: {
    type: Array,
    default: () => [
      { id: 'overview', label: 'Overview', content: 'This is the overview panel. It provides a summary of all the key information you need at a glance.' },
      { id: 'features', label: 'Features', content: 'Explore all the features available. Each feature is designed to improve your workflow and productivity.' },
      { id: 'reviews', label: 'Reviews', content: 'Read what our users have to say. Over 2,000 verified reviews with an average rating of 4.8 stars.' },
      { id: 'settings', label: 'Settings', content: 'Configure your preferences. Adjust notifications, display options, and account details here.' },
    ],
  },
})

const activeTab = ref(props.tabs[0]?.id)

function handleKeyDown(e) {
  const tablist = e.currentTarget
  const tabs = [...tablist.querySelectorAll('[role="tab"]')]
  const idx = tabs.indexOf(e.target)
  let next

  if (e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length]
  else if (e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length]
  else if (e.key === 'Home') next = tabs[0]
  else if (e.key === 'End') next = tabs[tabs.length - 1]

  if (next) {
    e.preventDefault()
    activeTab.value = next.dataset.tabId
    next.focus()
  }
}
</script>

<template>
  <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
    <!-- Tab list -->
    <div class="border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6">
      <nav class="flex gap-0 -mb-px overflow-x-auto" role="tablist" aria-label="Content tabs" @keydown="handleKeyDown">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          role="tab"
          :data-tab-id="tab.id"
          :aria-selected="tab.id === activeTab"
          :aria-controls="`panel-${tab.id}`"
          :id="`tab-${tab.id}`"
          :tabindex="tab.id === activeTab ? 0 : -1"
          :class="[
            'relative min-h-11 px-4 py-3 text-sm font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 rounded-t-md',
            tab.id === activeTab
              ? 'text-blue-600 dark:text-blue-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors'
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tab panel -->
    <template v-for="tab in tabs" :key="tab.id">
      <div
        v-if="tab.id === activeTab"
        :id="`panel-${tab.id}`"
        role="tabpanel"
        :aria-labelledby="`tab-${tab.id}`"
        tabindex="0"
        class="p-4 sm:p-6"
      >
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">{{ tab.label }}</h3>
        <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{{ tab.content }}</p>
      </div>
    </template>
  </div>
</template>
