# Responsive Patterns

> **TL;DR:** Master 5 core patterns: column drop, mostly fluid, layout shifter, off-canvas, and tiny tweaks. Choose based on content priority and complexity. Most layouts use column drop or mostly fluid.

## Core Principles

Responsive design is not just "make it fit on mobile." It is about choosing the right **layout strategy** for your content. Each of the 5 core patterns handles the transition between screen sizes differently, and the right choice depends on your content hierarchy, interaction model, and complexity.

**Key principle:** Content dictates pattern, not the other way around. Choose your pattern based on what your content needs at each breakpoint, not based on what is trendy.

All patterns below assume a [mobile-first](../responsive/mobile-first.md) approach with breakpoints defined in [breakpoints.md](../responsive/breakpoints.md).

## Concrete Rules

### Pattern 1: Column Drop

**What it does:** Starts as a single column on mobile, then progressively places columns side by side as width increases. Columns drop below each other when space runs out.

**When to use:**
- Content has 2-4 equal or near-equal priority sections
- Blog layouts, feature grids, product listings
- Content does not need to reorder between breakpoints
- **Most common pattern** — use this as your default

**Breakpoint behavior:**
- Mobile (<640px): All columns stack vertically, full width
- Tablet (640-1024px): 2 columns side by side
- Desktop (>1024px): 3-4 columns side by side

**Rules:**
- Maximum 4 columns before content becomes too narrow to read (minimum column width: 280px)
- Column gap: 16px (mobile), 24px (tablet), 32px (desktop)
- Use equal-width columns unless content hierarchy demands otherwise

### Pattern 2: Mostly Fluid

**What it does:** Like column drop, but the overall layout has a max-width and centers on large screens with generous margins. The grid is fluid within the container.

**When to use:**
- Content-focused sites (blogs, documentation, marketing pages)
- When you want to prevent content from stretching too wide
- Reading-heavy layouts where line length control matters
- **Second most common pattern**

**Breakpoint behavior:**
- Mobile (<640px): Single column, full-width with 16px margins
- Tablet (640-1024px): Multi-column within a centered container
- Desktop (>1024px): Centered container with max-width (960-1280px), large margins auto

**Rules:**
- Max container width: 960px for reading-heavy, 1280px for mixed, 1440px for dashboards
- Body text line length must stay within 45-75 characters at all breakpoints
- Side margins should be at least 5% of viewport width on large screens

### Pattern 3: Layout Shifter

**What it does:** Content blocks reorder and reflow between breakpoints. The layout fundamentally changes at different sizes — not just stacking.

**When to use:**
- Complex pages with content that has different priorities at different sizes
- Sidebar layouts that move to top/bottom on mobile
- Content that needs to reorder (e.g., image goes from beside text to above text)
- **Use sparingly** — harder to maintain and more confusing for users

**Breakpoint behavior:**
- Mobile (<640px): Reordered single column prioritizing most important content first
- Tablet (640-1024px): Hybrid layout (e.g., sidebar on top, content below)
- Desktop (>1024px): Full multi-region layout (sidebar + content + aside)

**Rules:**
- Use CSS `order` property or CSS Grid `grid-template-areas` for reordering — never change DOM order for layout
- Maximum 3 distinct layout regions — more than 3 creates cognitive overload
- Ensure reading order still makes logical sense at every breakpoint (test with screen reader)
- Content priority must be defined before implementation: what is most important on mobile?

### Pattern 4: Off-Canvas

**What it does:** Hides secondary content (usually navigation) off-screen on small viewports, accessible via a toggle button (hamburger menu, swipe gesture).

**When to use:**
- Navigation-heavy apps with many nav items (>5 top-level items)
- Admin dashboards, email clients, settings panels
- When secondary content (sidebar, filters) is important but not primary
- **Never use for primary content** — only for navigation or secondary panels

**Breakpoint behavior:**
- Mobile (<768px): Sidebar/nav is hidden off-screen; toggle button visible
- Tablet (768-1024px): Optional — sidebar can be collapsible or persistent
- Desktop (>1024px): Sidebar is always visible; no toggle needed

**Rules:**
- Toggle button (hamburger) must be minimum 44x44px touch target
- Off-canvas panel should be at least 280px wide but no more than 85% of viewport width
- Include a visible close mechanism (X button, backdrop click, swipe, Escape key)
- Backdrop overlay: `rgba(0, 0, 0, 0.3)` to `rgba(0, 0, 0, 0.5)` — must be clickable to close
- Slide-in animation: 200-300ms with `ease-out` easing
- Focus must be trapped inside the open panel (accessibility requirement)
- See [Navigation](../components/navigation.md)

### Pattern 5: Tiny Tweaks

**What it does:** Makes small adjustments (font size, padding, image size) without changing the fundamental layout structure.

**When to use:**
- Simple, single-column layouts (landing pages, article pages)
- When the layout works at all sizes but needs refinement
- As a **complement** to other patterns — fine-tune spacing and typography within a larger layout strategy

**Breakpoint behavior:**
- Adjustments are gradual: slightly larger fonts, more padding, bigger images
- Layout structure stays the same across all breakpoints

**Rules:**
- Use [fluid typography](../responsive/fluid-typography.md) (`clamp()`) instead of breakpoint-based font size changes where possible
- Scale padding proportionally: 16px on mobile, 24px on tablet, 32px on desktop
- Image sizes should use percentage widths or `max-width` rather than fixed pixel widths
- This is rarely a complete solution — usually combined with column drop or mostly fluid

## CSS/Implementation Patterns

### Column Drop

```css
/* CSS Grid — Column Drop */
.column-drop {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;            /* 16px */
  padding: 1rem;
}

@media (min-width: 640px) {
  .column-drop {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;        /* 24px */
  }
}

@media (min-width: 1024px) {
  .column-drop {
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;           /* 32px */
  }
}

/* Auto-fit variant — columns auto-adjust based on min width */
.column-drop-auto {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}
```

```html
<!-- Tailwind — Column Drop -->
<div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
</div>

<!-- Auto-fit variant -->
<div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
</div>
```

### Mostly Fluid

```css
/* CSS — Mostly Fluid */
.mostly-fluid {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1rem;      /* 16px side padding on mobile */
}

@media (min-width: 640px) {
  .mostly-fluid {
    padding: 0 1.5rem;  /* 24px */
  }
}

@media (min-width: 1024px) {
  .mostly-fluid {
    padding: 0 2rem;    /* 32px */
  }
}

.mostly-fluid .content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 640px) {
  .mostly-fluid .content-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .mostly-fluid .content-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

```html
<!-- Tailwind — Mostly Fluid -->
<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
    <div>Item 1</div>
    <div>Item 2</div>
    <div>Item 3</div>
  </div>
</div>
```

### Layout Shifter

```css
/* CSS Grid — Layout Shifter */
.layout-shifter {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-areas:
    "header"
    "main"
    "sidebar"
    "footer";
  gap: 1rem;
}

@media (min-width: 768px) {
  .layout-shifter {
    grid-template-columns: 240px 1fr;
    grid-template-areas:
      "header  header"
      "sidebar main"
      "footer  footer";
    gap: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .layout-shifter {
    grid-template-columns: 280px 1fr 240px;
    grid-template-areas:
      "header  header  header"
      "sidebar main    aside"
      "footer  footer  footer";
    gap: 2rem;
  }
}

.layout-header  { grid-area: header; }
.layout-main    { grid-area: main; }
.layout-sidebar { grid-area: sidebar; }
.layout-aside   { grid-area: aside; }
.layout-footer  { grid-area: footer; }
```

```html
<!-- Tailwind — Layout Shifter (simplified sidebar + content) -->
<div class="flex flex-col md:flex-row">
  <aside class="w-full md:w-60 lg:w-72 shrink-0">Sidebar</aside>
  <main class="flex-1 min-w-0 p-4 md:p-6">Content</main>
</div>
```

### Off-Canvas

```css
/* CSS — Off-Canvas Sidebar */
.off-canvas-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  visibility: hidden;
  transition: opacity 200ms ease-out, visibility 200ms;
  z-index: 40;
}

.off-canvas-backdrop.is-open {
  opacity: 1;
  visibility: visible;
}

.off-canvas-panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  max-width: 85vw;
  background: var(--bg-surface, #ffffff);
  transform: translateX(-100%);
  transition: transform 250ms ease-out;
  z-index: 50;
  overflow-y: auto;
}

.off-canvas-panel.is-open {
  transform: translateX(0);
}

/* On desktop, sidebar is always visible */
@media (min-width: 1024px) {
  .off-canvas-backdrop {
    display: none;
  }

  .off-canvas-panel {
    position: static;
    transform: none;
    width: 280px;
  }
}
```

### Tiny Tweaks with Fluid Typography

```css
/* CSS — Tiny Tweaks using clamp() */
.tiny-tweaks h1 {
  font-size: clamp(1.75rem, 4vw + 1rem, 3rem);    /* 28px → 48px */
  line-height: 1.2;
}

.tiny-tweaks p {
  font-size: clamp(1rem, 0.5vw + 0.875rem, 1.125rem);  /* 16px → 18px */
  line-height: 1.5;
}

.tiny-tweaks .section {
  padding: clamp(1rem, 3vw, 3rem);                  /* 16px → 48px */
}
```

## Common Mistakes

1. **Using layout shifter when column drop would suffice** — layout shifter is harder to maintain and test; default to column drop unless content truly needs reordering
2. **Setting column min-width too narrow** — columns below 280px are unreadable; use `minmax(280px, 1fr)` to prevent this
3. **Off-canvas without focus trapping** — when the panel opens, keyboard focus must be trapped inside it; Tab should not reach elements behind the backdrop
4. **Ignoring the content between breakpoints** — test at 500px, 700px, 900px too, not just the exact breakpoint values; layouts often break at in-between sizes
5. **Hiding content on mobile instead of rethinking it** — `display: none` on mobile is a sign the content might not be needed at all, or needs a better pattern (accordion, tabs, progressive disclosure)
6. **Fixed-width containers on small screens** — always use `max-width` with percentage-based or auto margins, never `width: 1280px`
7. **No max-width on text content** — text that spans the full viewport width on a 2560px monitor is unreadable; always constrain body text to 45-75 characters
8. **Breakpoints in pixels** — use em for breakpoints (e.g., `48em` instead of `768px`) to respect user font-size preferences; Tailwind handles this correctly by default

## Decision Tree

```
Choosing a responsive pattern?
│
├── How many content regions/columns?
│   ├── 1 column at all sizes
│   │   └── Tiny Tweaks — just scale type, spacing, images
│   │
│   ├── 2-4 equal-priority columns
│   │   ├── Content has a max-width? → Mostly Fluid
│   │   └── Content fills viewport? → Column Drop
│   │
│   ├── Content blocks need to reorder between sizes?
│   │   └── Layout Shifter — use grid-template-areas
│   │
│   └── Navigation or sidebar needs to hide on mobile?
│       └── Off-Canvas — slide-in panel with toggle
│
├── Still not sure?
│   ├── Start with Column Drop (most common, simplest)
│   ├── Add max-width container → now it is Mostly Fluid
│   ├── Need to reorder? → upgrade to Layout Shifter
│   └── Need to hide nav? → add Off-Canvas for that piece
│
└── Combining patterns?
    ├── Mostly Fluid + Off-Canvas = SaaS app (centered content + sidebar nav)
    ├── Column Drop + Tiny Tweaks = Feature grid (responsive grid + fluid type)
    └── Layout Shifter + Off-Canvas = Admin dashboard (complex layout + collapsible nav)
```

## Sources

- Luke Wroblewski (2012). "Multi-Device Layout Patterns." https://www.lukew.com/ff/entry.asp?1514
- Google Web Fundamentals — Responsive Web Design Patterns: https://developers.google.com/web/fundamentals/design-and-ux/responsive/patterns
- CSS-Tricks — "A Complete Guide to CSS Grid": https://css-tricks.com/snippets/css/complete-guide-grid/
- MDN Web Docs — CSS Grid Layout: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout
- Ethan Marcotte (2011). "Responsive Web Design." A Book Apart.
