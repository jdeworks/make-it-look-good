<!-- snippet: content-avatar-group
     category: content
     rationale: components/cards.md
     requires: tailwindcss
-->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  users: {
    type: Array,
    default: () => [
      { id: 1, name: 'Sarah Chen', initials: 'SC', color: 'bg-[#1d4ed8]', status: 'online' },
      { id: 2, name: 'James Wilson', initials: 'JW', color: 'bg-[#6d28d9]', status: 'online' },
      { id: 3, name: 'Maria Garcia', initials: 'MG', color: 'bg-[#92400e]', status: 'offline' },
      { id: 4, name: 'Alex Thompson', initials: 'AT', color: 'bg-[#be123c]', status: 'online' },
      { id: 5, name: 'Priya Patel', initials: 'PP', color: 'bg-teal-600', status: 'online' },
      { id: 6, name: 'David Kim', initials: 'DK', color: 'bg-indigo-600', status: 'offline' },
      { id: 7, name: 'Emma Brown', initials: 'EB', color: 'bg-pink-600', status: 'online' },
    ],
  },
  maxVisible: { type: Number, default: 4 },
})

const sizeConfig = {
  sm: { avatar: 'w-7 h-7', text: 'text-xs', spacing: '-space-x-2', dot: 'w-2 h-2 border' },
  md: { avatar: 'w-9 h-9', text: 'text-xs', spacing: '-space-x-2', dot: 'w-3 h-3 border-2' },
  lg: { avatar: 'w-12 h-12', text: 'text-sm', spacing: '-space-x-3', dot: 'w-3 h-3 border-2' },
}

const groups = computed(() =>
  ['lg', 'md', 'sm'].map((size) => ({
    size,
    config: sizeConfig[size],
    visible: props.users.slice(0, props.maxVisible),
    remaining: props.users.length - props.maxVisible,
  }))
)
</script>

<template>
  <main class="min-h-screen flex items-center justify-center p-6 sm:p-8 md:p-10 bg-slate-50 dark:bg-slate-900">
    <div class="w-full max-w-md">
      <header class="mb-6 md:mb-8">
        <h1 class="text-base font-semibold text-slate-800 dark:text-slate-200">Avatar Groups</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Overlapping teams with status indicators</p>
      </header>
      <section aria-label="Avatar size examples" class="flex flex-col gap-6 sm:gap-7 md:gap-8">
        <div v-for="group in groups" :key="group.size" class="flex items-center">
          <div role="group" aria-label="Team members" :class="['flex', group.config.spacing]">
            <div v-for="user in group.visible" :key="user.id" class="relative">
              <div
                :class="[group.config.avatar, 'rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-white font-medium', user.color, group.config.text]"
                :title="user.name"
              >
                {{ user.initials }}
              </div>
              <span
                :class="[
                  'absolute bottom-0 right-0 border-white dark:border-slate-800 rounded-full',
                  group.config.dot,
                  user.status === 'online' ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-500',
                ]"
                :aria-label="user.status === 'online' ? 'Online' : 'Offline'"
              />
            </div>
            <div
              v-if="group.remaining > 0"
              :class="[group.config.avatar, 'rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-medium text-slate-700 dark:text-slate-300', group.config.text]"
              :title="`${group.remaining} more member${group.remaining === 1 ? '' : 's'}`"
            >
              +{{ group.remaining }}
            </div>
          </div>
        </div>
      </section>
      <footer class="mt-8 md:mt-10 pt-4 border-t border-slate-200 dark:border-slate-800">
        <p class="text-xs text-slate-500 dark:text-slate-400">Component · avatar groups</p>
      </footer>
    </div>
  </main>
</template>
