# Framework Conversion Guide

> **TL;DR:** All presets are HTML+Tailwind — the single source of truth. To use in React/Vue/Svelte/Angular: (1) copy the HTML, (2) apply attribute changes below, (3) add interactivity using the behavior recipes at the bottom. Pre-built framework files only exist for components where the interactive logic is complex enough to warrant a reference implementation.

## How It Works

```
HTML preset (source of truth)
  + Attribute conversion (this guide)
  + Behavior recipe (if interactive)
  = Component in any framework
```

**Don't duplicate HTML into framework files for presentational components.** Heroes, stat rows, pricing cards, feature grids, avatars — these are just HTML with props. The LLM converts them on the fly using this guide.

**Framework files exist only for complex interactivity** — where the state management, event handling, or keyboard navigation pattern is non-trivial and differs meaningfully between frameworks.

## Pre-Built Interactive Components

| Preset Directory | Files | Interactive Behavior |
|------------------|-------|---------------------|
| `shell-sidebar/` | react, vue, svelte + nav variants | Sidebar toggle, responsive collapse, active nav state |
| `shell-marketing/` | react, vue, svelte | Mobile hamburger menu toggle |
| `shell-dashboard/` | react/vue/svelte-mobile-nav | Bottom nav active tab state |
| `tabs/` | react, vue, svelte | Tab switching, keyboard nav (Arrow/Home/End) |
| `pagination/` | react, vue, svelte | Page range calculation, ellipsis logic |
| `dropdown/` | react, vue + modal variants | Open/close, outside click, Escape, focus trap |
| `accordion/` | react, vue, svelte | Expand/collapse, single-open vs multi-open mode |
| `data-table/` | react, vue, svelte | Sort, filter, column state |
| `form/` | react, vue, svelte | Validation, password strength, multi-field state |
| `shell-form/` | react, vue, svelte | Login validation, submit handler |
| `hero/` (search variant) | react-search, vue-search, svelte-search | Debounced input, filter dropdown |
| `stats-row/` (toast variant) | react-toast, vue-toast | Auto-dismiss, stack management |

Everything else — use the HTML directly and convert with the guide below.

---

## Converting HTML → Framework

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
stroke-width="2"   → strokeWidth="2"
fill-rule="..."    → fillRule="..."
clip-rule="..."    → clipRule="..."
```

**Structure:**
```jsx
export function ComponentName({ prop1, prop2 }) {
  return (
    // Paste HTML here, fix attributes above
  );
}
```

**Lists:**
```jsx
{items.map(item => (
  <li key={item.id}>{item.name}</li>
))}
```

**Conditional classes:**
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

### Svelte 5 / SvelteKit

**Attribute changes:**
```
class="..."        → class="..." (unchanged)
onclick="..."      → onclick={handleClick}
```

**Structure:**
```svelte
<script>
  let { items = [], activeItem = '' } = $props();
  let open = $state(false);
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
<div class={`px-3 py-2 rounded ${active ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
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
  template: `<!-- Paste HTML here -->`
})
export class ComponentNameComponent {
  open = signal(false);
  toggle() { this.open.update(v => !v); }
}
```

**Lists:**
```html
@for (item of items; track item.id) {
  <li>{{ item.name }}</li>
}
```

---

## Converting Page Templates

The expressive templates (`editorial-blog/`, `scroll-story/`, etc.) are full-page designs. To use in a framework:

1. **Copy the HTML** from the personality variant you want
2. **Apply attribute changes** per the framework section above
3. **Extract sections into components** — hero, features, footer each become separate components
4. **Move inline `<style>` blocks** into your framework's styling (CSS modules, `<style scoped>`, etc.)
5. **Replace inline `<script>` blocks** with framework lifecycle hooks:
   - React: `useEffect` + `useRef`
   - Vue: `onMounted` + `ref`
   - Svelte: `onMount` + `bind:this`

---

## Interactive Behavior Recipes

These are the reusable patterns that make components interactive. Combine any HTML preset with the relevant recipe below.

### Toggle (sidebar, mobile menu, accordion)

```jsx
// React
const [open, setOpen] = useState(false);
<button onClick={() => setOpen(!open)}>Toggle</button>
{open && <div>Content</div>}
```
```vue
<!-- Vue -->
<script setup>
const open = ref(false)
</script>
<template>
  <button @click="open = !open">Toggle</button>
  <div v-if="open">Content</div>
</template>
```
```svelte
<!-- Svelte -->
<script>
  let open = $state(false);
</script>
<button onclick={() => open = !open}>Toggle</button>
{#if open}<div>Content</div>{/if}
```

### Single-open accordion (only one panel open at a time)

```jsx
// React
const [openIndex, setOpenIndex] = useState(0);
const toggle = (idx) => setOpenIndex(openIndex === idx ? -1 : idx);
// In each item:
<button onClick={() => toggle(idx)} aria-expanded={openIndex === idx}>
```
```vue
<!-- Vue -->
<script setup>
const openIndex = ref(0)
function toggle(idx) { openIndex.value = openIndex.value === idx ? -1 : idx }
</script>
```
```svelte
<!-- Svelte -->
<script>
  let openIndex = $state(0);
  function toggle(idx) { openIndex = openIndex === idx ? -1 : idx; }
</script>
```

### Outside-click close (dropdown, popover)

```jsx
// React
const ref = useRef(null);
useEffect(() => {
  const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
}, []);
<div ref={ref}>...</div>
```
```vue
<!-- Vue -->
<script setup>
const wrapper = ref(null)
function onClickOutside(e) { if (!wrapper.value?.contains(e.target)) open.value = false }
onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>
<template><div ref="wrapper">...</div></template>
```
```svelte
<!-- Svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  let wrapper;
  function onClickOutside(e) { if (!wrapper?.contains(e.target)) open = false; }
  onMount(() => document.addEventListener('click', onClickOutside));
  onDestroy(() => document.removeEventListener('click', onClickOutside));
</script>
<div bind:this={wrapper}>...</div>
```

### Keyboard navigation (tabs, dropdown menu items)

```jsx
// React — arrow keys cycle through items, Home/End jump to first/last
function onKeyDown(e, items, activeIndex, setActiveIndex) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    setActiveIndex((activeIndex + 1) % items.length);
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    setActiveIndex((activeIndex - 1 + items.length) % items.length);
  }
  if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); }
  if (e.key === 'End') { e.preventDefault(); setActiveIndex(items.length - 1); }
  if (e.key === 'Escape') setOpen(false);
}
```
Vue/Svelte: same logic, just use the framework's event binding (`@keydown` / `onkeydown`).

### Debounced search input

```jsx
// React
const [query, setQuery] = useState('');
const debounceRef = useRef(null);
useEffect(() => {
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => onSearch(query), 300);
  return () => clearTimeout(debounceRef.current);
}, [query]);
```
```vue
<!-- Vue -->
<script setup>
const query = ref('')
let timer = null
watch(query, (val) => {
  clearTimeout(timer)
  timer = setTimeout(() => emit('search', val), 300)
})
</script>
```
```svelte
<!-- Svelte -->
<script>
  let query = $state('');
  let timer;
  $effect(() => {
    clearTimeout(timer);
    timer = setTimeout(() => onSearch(query), 300);
    return () => clearTimeout(timer);
  });
</script>
```

### Form validation

```jsx
// React — validate on submit, show per-field errors
const [errors, setErrors] = useState({});
const validate = () => {
  const errs = {};
  if (!form.email) errs.email = 'Required';
  else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email';
  if (!form.password) errs.password = 'Required';
  else if (form.password.length < 8) errs.password = 'Min 8 characters';
  return errs;
};
const handleSubmit = (e) => {
  e.preventDefault();
  const errs = validate();
  setErrors(errs);
  if (Object.keys(errs).length === 0) onSubmit(form);
};
// Per-field error display:
{errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
```

### Password strength indicator

```jsx
// Works in any framework — pure function
function passwordStrength(pw) {
  if (pw.length < 8) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' };
  let score = 0;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  if (score <= 1) return { label: 'Weak', color: 'bg-amber-500', width: 'w-1/2' };
  if (score <= 2) return { label: 'Good', color: 'bg-blue-500', width: 'w-3/4' };
  return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
}
// Render: <div class="h-1.5 bg-slate-200 rounded-full"><div class={`h-full rounded-full ${s.color} ${s.width}`} /></div>
```

### Pagination range with ellipsis

```jsx
// Works in any framework — pure function
function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, '...', total];
  if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}
```

### Scroll-triggered reveal (IntersectionObserver)

```jsx
// React
const ref = useRef(null);
useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) entry.target.classList.add('revealed');
  }, { threshold: 0.1 });
  if (ref.current) observer.observe(ref.current);
  return () => observer.disconnect();
}, []);
```
```vue
<!-- Vue -->
<script setup>
const el = ref(null)
onMounted(() => {
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) entry.target.classList.add('revealed')
  }, { threshold: 0.1 }).observe(el.value)
})
</script>
```
```svelte
<!-- Svelte -->
<script>
  import { onMount } from 'svelte';
  let el;
  onMount(() => {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) entry.target.classList.add('revealed');
    }, { threshold: 0.1 }).observe(el);
  });
</script>
<div bind:this={el}>...</div>
```

---

## Common Pitfalls

| Issue | Solution |
|-------|----------|
| Tailwind classes with colons (`dark:`, `hover:`, `sm:`) break JSX? | They don't — Tailwind class strings work fine in `className` |
| SVG attributes (`stroke-width`, `view-box`) in React | Use camelCase: `strokeWidth`, `viewBox` (most SVG attrs already are) |
| Inline `style="color: red"` in React | Use object: `style={{ color: 'red' }}` |
| Dynamic Tailwind classes get purged | Use complete class strings, never concatenate: `bg-${color}-600` won't work |
| Event handlers in loops | React: use arrow function. Vue: `@click="handler(item)"` |

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
