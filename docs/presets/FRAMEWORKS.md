# Framework Conversion Guide

> **TL;DR:** Presets are HTML+Tailwind by default. This guide shows how to convert them to React, Vue, Svelte, or Angular. For the 15 most interactive components, pre-built React (`.jsx`), Vue (`.vue`), and Svelte 5 (`.svelte`) versions exist in their preset directory.

## Pre-Built Framework Variants

These components have React, Vue, and/or Svelte versions because they need meaningful interactivity (state, events, lifecycle):

| Preset Directory | `react.jsx` | `vue.vue` | `svelte.svelte` | Why |
|------------------|:---:|:---:|:---:|-----|
| `shell-sidebar/` | Yes | Yes | Yes | Sidebar toggle, responsive collapse |
| `shell-sidebar/` (nav) | `react-nav.jsx` | `vue-nav.vue` | `svelte-nav.svelte` | Collapse/expand, active state |
| `shell-marketing/` | Yes | Yes | Yes | Mobile hamburger menu toggle |
| `shell-dashboard/` (mobile nav) | `react-mobile-nav.jsx` | `vue-mobile-nav.vue` | `svelte-mobile-nav.svelte` | Active tab state |
| `pagination/` | Yes | Yes | — | Page navigation, current page state |
| `tabs/` | Yes | Yes | — | Tab switching, keyboard navigation |
| `dropdown/` | Yes | Yes | — | Open/close, outside click, escape key |
| `dropdown/` (modal) | `react-modal.jsx` | `vue-modal.vue` | `svelte-modal.svelte` | Open/close, focus trap, escape key |
| `data-table/` | Yes | Yes | Yes | Sort, filter, pagination |
| `shell-form/` | Yes | Yes | Yes | Login validation, submit handler |
| `form/` | Yes | Yes | Yes | Signup validation, password rules |
| `hero/` (search) | `react-search.jsx` | `vue-search.vue` | `svelte-search.svelte` | Debounced input, filter state |
| `stats-row/` (toast) | `react-toast.jsx` | `vue-toast.vue` | — | Auto-dismiss, stack management |
| `accordion/` | Yes | Yes | — | Expand/collapse, single-open mode |
| `avatars/` | Yes | Yes | — | Dynamic user list, +N overflow |

For everything else (heroes, stat rows, pricing cards, full-page templates, etc.), the HTML preset works in any framework — just adjust attributes per the guide below.

## Converting Page Templates

The expressive templates (`editorial-blog/`, `saas-features/`, `scroll-story/`, etc.) are full-page designs. To use them in a framework:

1. **Copy the HTML** from the `clean.html` (or your preferred personality variant)
2. **Apply attribute changes** per the framework guide below
3. **Extract sections into components** — e.g., the hero, features grid, testimonials, and footer each become separate components
4. **Move inline `<style>` blocks** into your framework's styling approach (CSS modules, styled-components, `<style scoped>`, etc.)
5. **Replace inline `<script>` blocks** (used in scroll-story and jdeworks-personal for IntersectionObserver) with framework-appropriate lifecycle hooks:
   - React: `useEffect` + `useRef`
   - Vue: `onMounted` + `ref`
   - Svelte: `onMount` + `bind:this`

---

## Converting HTML Presets

### React / Next.js

**Attribute changes:**
```
class="..."        → className="..."
for="inputId"      → htmlFor="inputId"
onclick="..."      → onClick={handleClick}
onchange="..."     → onChange={handleChange}
tabindex="0"       → tabIndex={0}
aria-*="..."       → aria-*="..." (unchanged)
<!-- comment -->    → {/* comment */}
```

**Structure:**
```jsx
// Wrap the HTML in a function component
export function ComponentName({ prop1, prop2 }) {
  return (
    // Paste HTML here, fix attributes above
  );
}
```

**State (when needed):**
```jsx
import { useState } from 'react';

export function Toggle() {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen(!open)}>
      {open ? 'Close' : 'Open'}
    </button>
  );
}
```

**Lists:**
```jsx
// HTML: copy-paste the <li> and wrap in .map()
{items.map(item => (
  <li key={item.id}>{item.name}</li>
))}
```

**Conditional classes (with clsx or template literal):**
```jsx
<div className={`px-3 py-2 rounded ${active ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
```

---

### Vue 3 (Composition API)

**Attribute changes:**
```
class="..."        → class="..." (unchanged)
onclick="..."      → @click="handleClick"
onchange="..."     → @change="handleChange"
```

**Structure:**
```vue
<script setup>
import { ref } from 'vue'

const props = defineProps({
  items: Array,
  activeItem: String
})

const emit = defineEmits(['navigate'])
const open = ref(false)
</script>

<template>
  <!-- Paste HTML here -->
</template>
```

**Lists:**
```vue
<li v-for="item in items" :key="item.id">{{ item.name }}</li>
```

**Conditional classes:**
```vue
<div :class="['px-3 py-2 rounded', active ? 'bg-blue-600 text-white' : 'text-slate-600']">
```

**Conditionals:**
```vue
<div v-if="show">Visible</div>
<div v-else>Hidden</div>
```

---

### Svelte / SvelteKit

**Attribute changes:**
```
class="..."        → class="..." (unchanged)
onclick="..."      → on:click={handleClick}  (Svelte 4)
                   → onclick={handleClick}    (Svelte 5)
```

**Structure:**
```svelte
<script>
  let open = $state(false);        // Svelte 5 runes
  // let open = false;             // Svelte 4 (reactive by default)

  export let items = [];           // Svelte 4 props
  // let { items = [] } = $props() // Svelte 5 props
</script>

<!-- Paste HTML here -->
```

**Lists:**
```svelte
{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}
```

**Conditional classes:**
```svelte
<div class="px-3 py-2 rounded" class:bg-blue-600={active} class:text-white={active}>
```

**Conditionals:**
```svelte
{#if show}
  <div>Visible</div>
{:else}
  <div>Hidden</div>
{/if}
```

---

### Angular

**Attribute changes:**
```
class="..."        → class="..." (unchanged, or [ngClass] for dynamic)
onclick="..."      → (click)="handleClick()"
onchange="..."     → (change)="handleChange($event)"
```

**Structure:**
```typescript
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-component-name',
  standalone: true,
  template: `
    <!-- Paste HTML here -->
  `
})
export class ComponentNameComponent {
  open = signal(false);

  toggle() {
    this.open.update(v => !v);
  }
}
```

**Lists:**
```html
<!-- Angular 17+ -->
@for (item of items; track item.id) {
  <li>{{ item.name }}</li>
}

<!-- Angular 16 and earlier -->
<li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>
```

**Conditional classes:**
```html
<div class="px-3 py-2 rounded" [ngClass]="active ? 'bg-blue-600 text-white' : 'text-slate-600'">
```

**Conditionals:**
```html
<!-- Angular 17+ -->
@if (show) {
  <div>Visible</div>
} @else {
  <div>Hidden</div>
}
```

---

## Common Pitfalls

| Issue | Solution |
|-------|----------|
| Tailwind classes with colons (`dark:`, `hover:`, `sm:`) break JSX? | They don't — Tailwind class strings work fine in `className` |
| SVG attributes (`stroke-width`, `view-box`) in React | Use camelCase: `strokeWidth`, `viewBox` (most SVG attrs already are) |
| Inline `style="color: red"` in React | Use object: `style={{ color: 'red' }}` |
| Dynamic Tailwind classes get purged | Use complete class strings, never concatenate: `bg-${color}-600` won't work |
| Event handlers in loops | React: use arrow function or `.bind()`. Vue: `@click="handler(item)"` |

## Tailwind Setup

All presets assume Tailwind CSS is available. Setup per framework:

| Framework | Install |
|-----------|---------|
| React/Next.js | `npm install tailwindcss @tailwindcss/postcss postcss` + postcss config |
| Vue/Nuxt | `npm install tailwindcss @tailwindcss/postcss postcss` + postcss config |
| Svelte/SvelteKit | `npm install tailwindcss @tailwindcss/postcss postcss` + postcss config |
| Angular | `npm install tailwindcss @tailwindcss/postcss postcss` + postcss config |
| Plain HTML (CDN) | `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>` |

For Tailwind v4, add `@import "tailwindcss"` to your main CSS file. No `tailwind.config.js` needed for default setup.
