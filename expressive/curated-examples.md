# What Makes Great Sites Great — Curated Examples

> **TL;DR:** Study real sites by *design approach*, not brand name. Each approach has specific CSS techniques that make it work — gradient meshes for dark premium, extreme whitespace for editorial, bento grids for friendly SaaS. This file catalogs six approaches with real URLs, replicable patterns, and copy-paste CSS. Also includes placeholder image services, font pairings, and a CSS techniques catalog.

## Core Principles

1. **Design approach comes before technology** — pick the visual personality first, then choose the CSS techniques that serve it
2. **Every great site constrains itself** — the best dark UIs use 2 gradients, not 20. The best editorial sites use one accent color. Constraint creates coherence.
3. **Copy the system, not the surface** — the spacing scale, the color ratio, the type hierarchy matter more than the exact gradient
4. **Techniques combine** — dark premium sites use gradient mesh + glow + stagger. Editorial sites use whitespace + type scale + no decoration. Know which techniques cluster together.
5. **Performance is part of the design** — a 4-second load with WebGL destroys the experience. Choose techniques appropriate to the project scope.

---

## Design Approach 1: Dark Premium / Developer Aesthetic

### What Makes It Work
- Background: near-black (not pure #000 — use #0A0A0F, #0a192f, or slate-950)
- One or two accent colors maximum, high saturation against the dark field
- Subtle light sources: radial gradients positioned behind content create depth
- Monospace font for technical credibility (Geist Mono, JetBrains Mono, Fira Code)
- Generous padding (py-24 / py-32) — dark backgrounds amplify spaciousness
- Card borders at ~8% white opacity, not solid lines

### Replicable Patterns

#### Gradient Mesh Hero
```css
.hero-gradient {
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120, 119, 198, 0.3), transparent),
    radial-gradient(ellipse 60% 80% at 80% 50%, rgba(78, 67, 118, 0.15), transparent),
    radial-gradient(ellipse 50% 60% at 20% 60%, rgba(54, 79, 199, 0.12), transparent),
    #0f0f1a;
}
```

#### Single-Accent Dark UI
```css
:root {
  --bg-primary: #0A0A0F;
  --bg-surface: #13131A;
  --border: rgba(255, 255, 255, 0.08);
  --text-primary: #EDEDEF;
  --text-secondary: #8A8A9A;
  --accent: #8B5CF6; /* violet-500 */
}

.card-dark {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  transition: border-color 200ms ease-out;
}

.card-dark:hover {
  border-color: rgba(139, 92, 246, 0.3);
}
```

#### Hover Glow Card
```css
.project-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 24px;
  transition: box-shadow 250ms ease-out, background 250ms ease-out;
}

.project-card:hover {
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 30px rgba(100, 255, 218, 0.07);
}
```

See also: [visual-identity.md](visual-identity.md) for building a cohesive dark palette.

---

## Design Approach 2: Minimal Editorial / Typography-First

### What Makes It Work
- Maximum content width: 640–720px (max-w-2xl) for reading comfort
- Type scale does all the heavy lifting — h1 at 48–72px, body at 16–18px, no decorative elements needed
- System font stack or a single high-quality typeface — no font pairing complexity
- Whitespace as primary design element: 96–128px between sections
- Links are inline and conversational, not button-styled
- Color used sparingly: one accent for links/interactive, everything else is gray scale

### Replicable Patterns

#### Manifesto Layout
```css
.editorial-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 64px 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  color: #1a1a1a;
}

.editorial-page h1 {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 16px;
}

.editorial-page p + p {
  margin-top: 24px;
}

.editorial-page a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: #a0a0a0;
  transition: text-decoration-color 150ms ease;
}

.editorial-page a:hover {
  text-decoration-color: currentColor;
}
```

#### Large Image + Headline + CTAs
```html
<section class="py-32 text-center">
  <img src="product.jpg" alt="Product"
       class="w-full max-w-5xl mx-auto mb-16" />
  <h2 class="text-5xl md:text-7xl font-semibold tracking-tight mb-6">
    A headline that says one thing.
  </h2>
  <p class="text-xl text-gray-500 mb-8">A single line of supporting text.</p>
  <div class="flex justify-center gap-4">
    <a href="#" class="text-blue-600 text-xl hover:underline">Learn more &rsaquo;</a>
    <a href="#" class="text-blue-600 text-xl hover:underline">Buy &rsaquo;</a>
  </div>
</section>
```

See also: [../typography/type-scale.md](../typography/type-scale.md), [../layout/whitespace.md](../layout/whitespace.md).

---

## Design Approach 3: Friendly / Approachable SaaS

### What Makes It Work
- Rounded corners everywhere (12–16px on cards, fully rounded on avatars/icons)
- Warm or saturated brand colors — not corporate blue, but yellow, pink, purple
- Conversational tone in headlines: "Write, plan, share." not "Enterprise Collaboration Platform"
- Illustrations over stock photos — custom illustrations convey personality
- Bento grid layout for features: unequal grid cells create visual interest
- Generous padding with soft shadows (no hard borders)

### Replicable Patterns

#### Bento Grid Features
```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto;
  gap: 16px;
  padding: 0 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Spanning variations */
.bento-card              { grid-column: span 1; }
.bento-card--wide        { grid-column: span 2; }
.bento-card--full        { grid-column: span 4; }
.bento-card--tall        { grid-row: span 2; }

.bento-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  overflow: hidden;
  border: 1px solid #e5e5e5;
}

/* Color block variants */
.bento-card--yellow { background: #FFF3CD; }
.bento-card--pink   { background: #FCE4EC; }
.bento-card--blue   { background: #E3F2FD; }

@media (max-width: 768px) {
  .bento-grid { grid-template-columns: 1fr; }
  .bento-card--wide,
  .bento-card--full { grid-column: span 1; }
}
```

#### Friendly Card with Soft Shadow
```css
.saas-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04),
              0 6px 24px rgba(0, 0, 0, 0.06);
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}

.saas-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04),
              0 12px 32px rgba(0, 0, 0, 0.08);
}
```

See also: [../components/cards.md](../components/cards.md), [hero-patterns.md](hero-patterns.md).

---

## Design Approach 4: Immersive / Scroll-Storytelling

### What Makes It Work
- Scroll position drives everything: content reveals, parallax, transforms
- Preloader sets mood and manages expectations (3–5s is acceptable here)
- Custom cursor replaces default pointer, creating an "experience" feeling
- Staggered reveals: elements cascade in 80–360ms delay intervals
- Full-viewport sections (min-h-screen) — each scroll stop is a complete composition
- Performance budget: limit WebGL/canvas to hero; use CSS for the rest

### Replicable Patterns

#### Scroll-Triggered Fade-In
```css
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 600ms cubic-bezier(0.0, 0.0, 0.2, 1),
              transform 600ms cubic-bezier(0.0, 0.0, 0.2, 1);
}

.reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
```

#### Staggered Cascade Reveal
```css
.cascade-item {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 500ms ease-out, transform 500ms ease-out;
}

.cascade-item.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger delays — 80ms apart, capped at ~360ms */
.cascade-item:nth-child(1) { transition-delay: 0ms; }
.cascade-item:nth-child(2) { transition-delay: 80ms; }
.cascade-item:nth-child(3) { transition-delay: 160ms; }
.cascade-item:nth-child(4) { transition-delay: 240ms; }
.cascade-item:nth-child(5) { transition-delay: 360ms; }
```

#### Custom Cursor (Dot + Ring)
```css
.cursor-dot {
  position: fixed;
  top: 0;
  left: 0;
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  pointer-events: none;
  z-index: 9999;
  transition: transform 100ms ease-out;
  mix-blend-mode: difference;
}

.cursor-ring {
  position: fixed;
  top: 0;
  left: 0;
  width: 40px;
  height: 40px;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  pointer-events: none;
  z-index: 9998;
  transition: transform 250ms ease-out, width 200ms ease, height 200ms ease;
  mix-blend-mode: difference;
}

/* Expand ring on hovering interactive elements */
.cursor-ring.is-hovering {
  width: 64px;
  height: 64px;
}
```

```js
const dot = document.querySelector('.cursor-dot');
const ring = document.querySelector('.cursor-ring');

document.addEventListener('mousemove', (e) => {
  dot.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 4}px)`;
  ring.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 20}px)`;
});

document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => ring.classList.add('is-hovering'));
  el.addEventListener('mouseleave', () => ring.classList.remove('is-hovering'));
});
```

See also: [scroll-storytelling.md](scroll-storytelling.md), [purposeful-motion.md](purposeful-motion.md), [../interaction/animation-timing.md](../interaction/animation-timing.md).

---

## Design Approach 5: Bold Creative / Agency

### What Makes It Work
- Typography IS the design — headings at 80–160px, often with negative letter-spacing (-0.04em)
- High contrast: pure black on white or white on black, no grays in between
- Unconventional layouts: horizontal scroll, overlapping elements, asymmetric grids
- Clip-path for non-rectangular shapes (torn edges, diagonal cuts, organic blobs)
- `mix-blend-mode: difference` or `exclusion` for text over images
- Cursor and scroll interactions are part of the brand expression

### Replicable Patterns

#### Oversized Typography
```css
.hero-headline {
  font-size: clamp(3rem, 10vw, 10rem);
  font-weight: 900;
  line-height: 0.9;
  letter-spacing: -0.04em;
  text-transform: uppercase;
}
```

#### Torn Edge Section Divider (Clip-path)
```css
.torn-edge {
  clip-path: polygon(
    0% 0%, 100% 0%, 100% 85%,
    95% 88%, 90% 85%, 85% 90%,
    80% 86%, 75% 92%, 70% 87%,
    65% 90%, 60% 85%, 55% 91%,
    50% 86%, 45% 89%, 40% 84%,
    35% 90%, 30% 86%, 25% 92%,
    20% 87%, 15% 90%, 10% 85%,
    5% 88%, 0% 85%
  );
}
```

#### Horizontal Scroll Section
```html
<section class="overflow-x-auto overflow-y-hidden">
  <div class="flex gap-6 px-6 py-12" style="width: max-content;">
    <div class="w-[80vw] max-w-lg flex-shrink-0">Card 1</div>
    <div class="w-[80vw] max-w-lg flex-shrink-0">Card 2</div>
    <div class="w-[80vw] max-w-lg flex-shrink-0">Card 3</div>
    <div class="w-[80vw] max-w-lg flex-shrink-0">Card 4</div>
  </div>
</section>
```

#### Mix-Blend Text Over Image
```css
.blend-overlay {
  position: relative;
}

.blend-overlay h2 {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(3rem, 8vw, 8rem);
  font-weight: 900;
  color: #fff;
  mix-blend-mode: difference;
  pointer-events: none;
}
```

---

## Design Approach 6: E-commerce / Product-Focused

### What Makes It Work
- Product image is the hero — full-bleed, high resolution, minimal surrounding UI
- Dark/light section alternation creates visual rhythm and section separation
- Specs and features revealed progressively on scroll (not dumped as a list)
- Minimal navigation on product pages — focused on conversion
- Color palette often derived from the product itself
- Interactive demos > static screenshots

### Replicable Patterns

#### Dark/Light Section Alternation
```html
<section class="bg-white text-gray-900 py-24 px-6">
  <div class="max-w-6xl mx-auto"><!-- Light section content --></div>
</section>

<section class="bg-gray-950 text-white py-24 px-6">
  <div class="max-w-6xl mx-auto"><!-- Dark section content --></div>
</section>

<section class="bg-gray-50 text-gray-900 py-24 px-6">
  <div class="max-w-6xl mx-auto"><!-- Light section content --></div>
</section>
```

#### Product Hero (Full-bleed)
```html
<section class="relative bg-black min-h-screen flex items-center justify-center">
  <img src="product-hero.jpg" alt="Product Name"
       class="w-full max-w-4xl object-contain" />
  <div class="absolute bottom-16 left-1/2 -translate-x-1/2 text-center text-white">
    <h1 class="text-5xl font-semibold tracking-tight mb-2">Product Name</h1>
    <p class="text-xl text-gray-400 mb-6">One line that captures it.</p>
    <a href="#" class="inline-block bg-blue-600 text-white px-8 py-3 rounded-full
                       text-lg font-medium hover:bg-blue-500 transition-colors">
      Buy
    </a>
  </div>
</section>
```

---

## Placeholder Image Services

For prototyping and wireframing — use these to get realistic imagery without assets.

| Service | URL Format | Best For |
|---------|-----------|----------|
| Picsum Photos | `https://picsum.photos/seed/{seed}/{width}/{height}` | Seeded random photos, consistent across loads |
| Unsplash Source | `https://images.unsplash.com/{photo-id}?w={width}&h={height}&fit=crop` | Real photography (direct URLs for known IDs) |
| Placehold.co | `https://placehold.co/{width}x{height}/{bg}/{text}` | Solid color with text label |

### Tips
- **Picsum** supports filters: `?grayscale` and `?blur=N` (1–10). Always use `seed/` for consistent results across page loads.
- **Placehold.co** hex colors omit the `#`: `https://placehold.co/600x400/1e293b/e2e8f0` (slate-800 bg, slate-200 text).
- **Unsplash** direct URLs work without API keys if you know the photo ID. For search, you need an API key.

### Quick Copy Examples
```html
<!-- Consistent hero image -->
<img src="https://picsum.photos/seed/hero/1200/600" alt="Hero" />

<!-- Grayscale placeholder for editorial -->
<img src="https://picsum.photos/seed/editorial/800/400?grayscale" alt="Article" />

<!-- Labeled wireframe box -->
<img src="https://placehold.co/400x300/f1f5f9/64748b?text=Feature+Image" alt="Feature" />

<!-- Square avatar -->
<img src="https://picsum.photos/seed/avatar1/80/80" alt="User" class="rounded-full" />
```

---

## Free Font Pairings for Identity

All available on [Google Fonts](https://fonts.google.com). Load only the weights you use.

| Personality | Display Font | Body Font | Example Use |
|-------------|-------------|-----------|-------------|
| Bold / Tech | Space Grotesk (700) | Inter (400) | Startups, dev tools, SaaS dashboards |
| Elegant / Editorial | Playfair Display (400) | Source Serif Pro (400) | Luxury brands, publishing, magazines |
| Friendly / Rounded | Sora (800) | DM Sans (400) | Consumer apps, creative tools, social |
| Minimal / Modern | Inter (300) | Inter (400) | Ultra-clean, Scandinavian, minimal SaaS |
| Expressive / Creative | Clash Display or Satoshi | General Sans | Agencies, portfolios, studios |

### Loading Pattern
```html
<!-- Only load what you need — 2 families, 2-3 weights max -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Inter:wght@400;500&display=swap"
      rel="stylesheet" />
```

```css
:root {
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
}

h1, h2, h3 { font-family: var(--font-display); }
body        { font-family: var(--font-body); }
```

**Note:** Clash Display and Satoshi are from [fontshare.com](https://www.fontshare.com/) (free for personal and commercial use) — not Google Fonts.

See also: [../typography/font-pairing.md](../typography/font-pairing.md), [../typography/web-font-loading.md](../typography/web-font-loading.md).

---

## CSS Techniques Catalog

Every technique below is copy-paste-ready. Combine them to build any of the design approaches above.

### 1. Gradient Mesh Background
```css
.gradient-mesh {
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120, 119, 198, 0.3), transparent),
    radial-gradient(ellipse 60% 80% at 80% 50%, rgba(78, 67, 118, 0.15), transparent),
    radial-gradient(ellipse 50% 60% at 20% 60%, rgba(54, 79, 199, 0.12), transparent),
    #0f0f1a;
}
```
**How it works:** Layer 3–4 `radial-gradient` ellipses at different positions and sizes. Each has a single color fading to `transparent`. The stacking creates organic color blending.

### 2. Glow Effects
```css
/* Ambient glow behind a card */
.glow-card {
  box-shadow:
    0 0 15px rgba(139, 92, 246, 0.15),
    0 0 45px rgba(139, 92, 246, 0.08);
}

/* Button glow on hover */
.glow-button {
  transition: box-shadow 200ms ease-out;
}
.glow-button:hover {
  box-shadow:
    0 0 20px rgba(59, 130, 246, 0.4),
    0 0 60px rgba(59, 130, 246, 0.15);
}
```

### 3. Glassmorphism
```css
.glass {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

/* Light mode variant */
.glass-light {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 16px;
}
```
**Caveat:** `backdrop-filter` is GPU-intensive. Avoid on large areas or many overlapping elements.

### 4. Gradient Text
```css
.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```
**Accessibility note:** Gradient text cannot be selected with high contrast mode. Use on decorative headings only, not body text or links. Always ensure the lightest gradient stop meets 4.5:1 contrast against the background.

### 5. Custom Cursor
```css
/* Hide default cursor on the container */
.custom-cursor-area {
  cursor: none;
}

.cursor-dot {
  position: fixed;
  top: 0;
  left: 0;
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  pointer-events: none;
  z-index: 9999;
  mix-blend-mode: difference;
}
```
```js
const dot = document.querySelector('.cursor-dot');
window.addEventListener('mousemove', (e) => {
  dot.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 4}px)`;
});
```
**Accessibility:** Always keep `cursor: auto` on form inputs and interactive elements. Custom cursors should enhance, not replace core usability. Hide on touch devices.

### 6. Hover Glow on Cards
```css
.card-hover-glow {
  background: var(--bg-surface, #1a1a2e);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 24px;
  transition: box-shadow 250ms ease-out, border-color 250ms ease-out;
}

.card-hover-glow:hover {
  border-color: rgba(139, 92, 246, 0.3);
  box-shadow: 0 0 30px rgba(139, 92, 246, 0.08);
}
```

### 7. Scroll-Triggered Fade-In
```css
.fade-in {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 500ms cubic-bezier(0, 0, 0.2, 1),
              transform 500ms cubic-bezier(0, 0, 0.2, 1);
}

.fade-in.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```
```js
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
);

document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));
```

See also: [../interaction/animation-timing.md](../interaction/animation-timing.md) for duration/easing rules.

### 8. Staggered Animation (nth-child Delays)
```css
.stagger-item {
  opacity: 0;
  transform: translateY(16px);
  animation: staggerIn 400ms cubic-bezier(0, 0, 0.2, 1) forwards;
}

.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 50ms; }
.stagger-item:nth-child(3) { animation-delay: 100ms; }
.stagger-item:nth-child(4) { animation-delay: 150ms; }
.stagger-item:nth-child(5) { animation-delay: 200ms; }
.stagger-item:nth-child(6) { animation-delay: 250ms; }

@keyframes staggerIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```
**Rule:** 30–50ms between items, cap total stagger at ~400ms. After that, batch remaining items at the cap delay.

### 9. Dark/Light Section Alternation
```css
.section-light {
  background: #ffffff;
  color: #0f172a;
  padding: 96px 24px;
}

.section-dark {
  background: #0f172a;
  color: #e2e8f0;
  padding: 96px 24px;
}

.section-muted {
  background: #f8fafc;
  color: #0f172a;
  padding: 96px 24px;
}
```
**Pattern:** Alternate light/dark/muted to create visual rhythm. Each section is a self-contained composition with its own max-width container inside.

### 10. Bento Grid Layout
```css
.bento {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.bento > :nth-child(1) { grid-column: span 2; grid-row: span 2; }
.bento > :nth-child(2) { grid-column: span 2; }
.bento > :nth-child(3) { grid-column: span 1; }
.bento > :nth-child(4) { grid-column: span 1; }
.bento > :nth-child(5) { grid-column: span 4; }

.bento > * {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e5e7eb;
  min-height: 180px;
}

@media (max-width: 768px) {
  .bento {
    grid-template-columns: 1fr;
  }
  .bento > * {
    grid-column: span 1 !important;
    grid-row: span 1 !important;
  }
}
```
**Tip:** The visual interest comes from *unequal* cell sizes. One cell spanning 2x2 among 1x1 cells creates the bento effect. Don't make all cells the same size.

---

## Common Mistakes

1. **Mixing design approaches** — dark premium gradients on a friendly SaaS page creates visual confusion. Pick one approach and commit.
2. **Overloading techniques** — gradient mesh + glassmorphism + custom cursor + stagger animations all at once. Choose 2–3 techniques max.
3. **Ignoring performance on immersive sites** — WebGL backgrounds on mobile will drain battery and drop frames. Use CSS-only fallbacks with `@media (hover: hover)`.
4. **Pure black backgrounds** — #000000 is harsh. Use #0A0A0F, #0f0f1a, or slate-950 (#020617) for dark themes.
5. **Placeholder images in production** — Picsum and Placehold.co are for prototyping only. Replace with real assets before shipping.
6. **Too many font weights** — each weight is a network request. Load 2–3 weights maximum per family.
7. **Custom cursors on touch devices** — there is no hover cursor on mobile. Gate custom cursor JS behind `@media (hover: hover)` or `matchMedia`.
8. **Gradient text on body copy** — gradient text is decorative. It reduces readability and breaks in high-contrast mode. Use on headings only.

## Decision Tree

```
Choosing a design approach:
├─ What's the product?
│  ├─ Developer tool / API / technical product → Dark Premium
│  ├─ Blog / personal site / content-first → Minimal Editorial
│  ├─ Consumer SaaS / productivity tool → Friendly SaaS
│  ├─ Portfolio / creative showcase → Immersive or Bold Creative
│  ├─ Agency / studio → Bold Creative
│  └─ E-commerce / physical product → Product-Focused
├─ What's the audience expectation?
│  ├─ "This should feel premium/fast" → Dark Premium
│  ├─ "This should feel trustworthy/clear" → Minimal Editorial or Friendly SaaS
│  ├─ "This should feel like an experience" → Immersive
│  └─ "This should feel bold/memorable" → Bold Creative
└─ What's the performance budget?
   ├─ Must be fast / low bandwidth → Minimal Editorial (zero JS, system fonts)
   ├─ Standard web app → Friendly SaaS or Dark Premium (CSS-only techniques)
   └─ Showcase / portfolio (performance secondary) → Immersive (WebGL, heavy animation)
```

## Related Templates

Each design approach has dedicated presets in `docs/presets/` with clean, minimalist, and playful personality variants:

| Design Approach | Template Preset | Primary Color |
|---|---|---|
| Dark Premium / Developer | [`devtool-landing/`](../docs/presets/devtool-landing/) | cyan |
| Minimal Editorial | [`editorial-blog/`](../docs/presets/editorial-blog/) | slate |
| Friendly SaaS / Bento | [`saas-features/`](../docs/presets/saas-features/) | violet |
| Immersive / Scroll-Storytelling | [`scroll-story/`](../docs/presets/scroll-story/) | emerald |
| Bold Creative / Agency | [`agency-landing/`](../docs/presets/agency-landing/) | blue |
| E-commerce / Product-Focused | [`product-page/`](../docs/presets/product-page/) | sky |
| Documentation | [`docs-site/`](../docs/presets/docs-site/) | indigo |
| Event / Conference | [`event-page/`](../docs/presets/event-page/) | amber |
| Personal / Portfolio | [`personal-hero/`](../docs/presets/personal-hero/), [`jdeworks-personal/`](../docs/presets/jdeworks-personal/) | blue, violet |
| Product Launch | [`product-launch/`](../docs/presets/product-launch/) | indigo |

## Sources & Inspiration

### Design Galleries
- [Awwwards](https://www.awwwards.com/) — curated award-winning web design, searchable by category
- [Muzli](https://muz.li/) — design inspiration feed, portfolio roundups
- [Godly](https://godly.website/) — curated web design inspiration

### Inspiration by Approach
The CSS techniques in this file are generic patterns found across modern web design. For reference, sites known for excelling at each approach:
- **Dark Premium:** Stripe, Linear, Vercel, Arc Browser — gradient meshes, glow effects, monospace type
- **Minimal Editorial:** Rauno Freiberg, Lee Robinson, Apple — system fonts, extreme whitespace, content-first
- **Friendly SaaS:** Notion, Slack, Mailchimp — illustrations, bento grids, conversational tone
- **Immersive:** Awwwards SOTD winners, creative portfolios — WebGL, custom cursors, scroll-driven reveals
- **Bold Creative:** Agency portfolios on Awwwards — oversized type, clip-paths, mix-blend-mode
- **Product-Focused:** Apple product pages, Aesop — full-bleed imagery, scroll-driven specs

### Tools
- [Fontshare](https://www.fontshare.com/) — Clash Display, Satoshi, General Sans (free)
- [Google Fonts](https://fonts.google.com/) — all listed font pairings
- [Picsum Photos](https://picsum.photos/) — placeholder image API
- [Placehold.co](https://placehold.co/) — labeled placeholder images
- [Unsplash](https://unsplash.com/) — free photography (attribution appreciated)
