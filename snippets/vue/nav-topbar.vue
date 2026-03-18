<!-- snippet: nav-topbar
     category: navigation
     rationale: components/navigation.md
     requires: tailwindcss
-->
<script setup>
import { ref } from 'vue'

const props = defineProps({
  activeLink: { type: String, default: 'home' },
})

const emit = defineEmits(['navigate'])

const mobileMenuOpen = ref(false)

const navLinks = [
  { id: 'home', name: 'Home', href: '#' },
  { id: 'features', name: 'Features', href: '#' },
  { id: 'pricing', name: 'Pricing', href: '#' },
  { id: 'about', name: 'About', href: '#' },
  { id: 'blog', name: 'Blog', href: '#' },
]

function handleNavigate(id) {
  emit('navigate', id)
  mobileMenuOpen.value = false
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <a href="#" class="text-lg font-bold text-slate-900 dark:text-white">BrandName</a>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-1" aria-label="Main navigation">
          <a
            v-for="link in navLinks"
            :key="link.id"
            :href="link.href"
            @click.prevent="handleNavigate(link.id)"
            :class="[
              'px-3 py-2 text-sm font-medium rounded-md transition-colors min-h-11 flex items-center',
              activeLink === link.id
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
            ]"
            :aria-current="activeLink === link.id ? 'page' : undefined"
          >
            {{ link.name }}
          </a>
        </nav>

        <!-- Right side -->
        <div class="flex items-center gap-3">
          <a
            href="#"
            class="hidden md:inline-flex text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-md transition-colors min-h-11 items-center"
          >
            Sign In
          </a>
          <a
            href="#"
            class="hidden sm:inline-flex bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors min-h-11 items-center"
          >
            Get Started
          </a>
          <!-- Mobile menu button -->
          <button
            class="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-h-11 min-w-11 flex items-center justify-center"
            @click="mobileMenuOpen = !mobileMenuOpen"
            aria-label="Toggle menu"
            :aria-expanded="mobileMenuOpen"
          >
            <!-- Close icon -->
            <svg v-if="mobileMenuOpen" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
            <!-- Hamburger icon -->
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile menu -->
      <nav
        v-if="mobileMenuOpen"
        class="md:hidden pb-4 border-t border-slate-200 dark:border-slate-700 mt-2 pt-4 space-y-1"
        aria-label="Mobile navigation"
      >
        <a
          v-for="link in navLinks"
          :key="link.id"
          :href="link.href"
          @click.prevent="handleNavigate(link.id)"
          :class="[
            'block px-3 py-2.5 text-sm font-medium rounded-lg min-h-11 flex items-center',
            activeLink === link.id
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          ]"
          :aria-current="activeLink === link.id ? 'page' : undefined"
        >
          {{ link.name }}
        </a>
        <div class="pt-4 flex flex-col gap-2">
          <a
            href="#"
            class="text-center text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 px-4 py-2.5 rounded-lg min-h-11 flex items-center justify-center"
          >
            Sign In
          </a>
          <a
            href="#"
            class="text-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors min-h-11 flex items-center justify-center"
          >
            Get Started
          </a>
        </div>
      </nav>
    </div>
  </header>
</template>
