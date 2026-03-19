# Scroll Effect Patterns

> **TL;DR:** Scroll-driven effects create immersive storytelling pages. This file has copy-paste JS patterns for the most common scroll effects, plus a decision tree for choosing the right one. The key rules: effects need **enough scroll distance to breathe**, they should be **scroll-driven (not time-driven)** so they reverse when scrolling back up, and **never put CSS transitions on scroll-driven properties**.

## Decision Tree: Which Effect to Use

```
What kind of content?
│
├─ Text (headings, paragraphs, statements)
│  ├─ Single block → Scroll-driven fade + translateY (Pattern 7)
│  └─ Multi-line storytelling → Line-by-line reveal (Pattern 4)
│
├─ Cards / grid items
│  ├─ Want them to feel like they arrive → Fly-in: translateY + scale + opacity (Pattern 7)
│  ├─ Want them to spread open → Open-up / converge gap effect (Pattern 6)
│  └─ Want layered depth → Stacking cards with sticky (Pattern 5)
│
├─ Device mockup (phone, laptop)
│  ├─ Content changes while phone stays → Sticky + scroll-driven screens (Pattern 1)
│  └─ Phone alongside feature text → Sticky phone + scrolling descriptions (Pattern 2)
│
├─ Hero element (logo, headline)
│  └─ Shrinks/moves on scroll → Scroll-shrink with fixed position (Pattern 3)
│
└─ Background / ambient
   ├─ Sky, gradient, image → Parallax at 0.3-0.5x speed
   └─ Page load entrance → Time-based fade+scale (only exception to scroll-driven rule)
```

### Fade vs Fly-in vs Scale: When to Use Which

| Effect | Best For | Feeling | Properties |
|--------|----------|---------|------------|
| **Fade only** (opacity) | Backgrounds, overlays, ambient elements | Subtle, doesn't draw attention | `opacity` |
| **Fade + translateY** | Text blocks, headings, paragraphs | Content arriving, reading flow | `opacity` + `translateY(32px → 0)` |
| **Fade + translateY + scale** | Cards, images, interactive elements | Flying in, energetic, playful | `opacity` + `translateY(48px → 0)` + `scale(0.88 → 1)` |
| **Scale only** | Modals, popups, page load hero | Expanding from center, dramatic | `scale(0.85 → 1)` |
| **Fade + rotateY** | Card grids with open-up effect | Depth, 3D, spreading apart | `opacity` + `rotateY(6deg → 0)` + gap animation |

**Rule of thumb:** Text gets `translateY`. Cards get `translateY + scale`. Backgrounds get `opacity`. Hero load gets `scale`. Never use `translateX` for scroll reveals — horizontal movement fights the vertical scroll direction and feels wrong.

## Core Principles

1. **Scroll-driven, not time-driven** — Use scroll position to calculate opacity/transform directly. This makes effects reversible when scrolling back up. Only use time-based CSS transitions for one-time events (page load, button clicks). **Never use IntersectionObserver with `unobserve` for scroll effects** — that makes them one-shot and non-reversible.

2. **Never put CSS `transition` on scroll-driven elements** — If JS updates `transform` on every scroll frame, a CSS `transition: all 300ms` creates mushy lag because the browser smooths between the JS-set values. Remove `transition-all`, `duration-300`, etc. from any element whose transform/opacity is set by a scroll listener.

3. **Give effects runway** — A scroll effect that completes in 200px of scrolling is invisible. Most effects need 40-60% of viewport height as their scroll range.

4. **Trigger in the reading zone, not at the edge** — Use `vh * 0.85 - rect.top` instead of `vh - rect.top` as the numerator. This starts the reveal when the element is 85% up the viewport (comfortable reading zone), not at the very bottom edge where the user isn't looking.

5. **Ease-out, not linear** — `1 - Math.pow(1 - t, 3)` (cubic ease-out) so effects start fast and settle slowly. Linear feels robotic.

6. **One sticky element at a time** — If everything sticks, nothing sticks. Pick one focal element and let other content scroll past it.

7. **prefers-reduced-motion** — Always respect it: `@media (prefers-reduced-motion: reduce) { .scroll-reveal { opacity: 1; transform: none; } }`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Effect happens off-screen at viewport bottom | Use `vh * 0.85` offset in trigger formula, not `vh` |
| CSS `transition-all duration-300` on scroll-driven cards | Remove it — CSS transitions fight scroll-driven JS updates and create lag |
| IntersectionObserver with `unobserve` | Don't unobserve — or better, use scroll position directly so effects reverse |
| Stagger too fast, looks like a glitch | 250-400ms for time-based, or spread elements 40+ px apart for scroll-driven |
| Fixed element jumps on/off screen | Use `position: sticky` or `position: fixed` from the start. Never toggle. |
| Phone/device mockup is static | Make it sticky with scroll-driven screen states |
| Effect completes before user sees it | Increase the divisor in `(vh * 0.85 - rect.top) / (vh * range)` |
| Hero background appears instantly | Fade it in alongside content: start at `opacity: 0`, transition on load |

## The Scroll-Driven Reveal Formula

This is the core calculation used by all scroll-driven effects. Learn this once, apply everywhere:

```javascript
// For each element you want to reveal:
var rect = element.getBoundingClientRect();
var vh = window.innerHeight;

// t: 0 = element below viewport, 1 = element in reading zone
// The 0.85 offset triggers before the element hits the bottom edge
// The 0.4 divisor controls how much scroll distance the reveal takes
var t = Math.min(Math.max((vh * 0.85 - rect.top) / (vh * 0.4), 0), 1);

// Ease-out cubic: starts fast, settles slowly
var ease = 1 - Math.pow(1 - t, 3);

// Apply to element — choose properties based on content type:
element.style.opacity = ease;
element.style.transform = 'translateY(' + ((1 - ease) * 32) + 'px)'; // text
// OR for cards:
element.style.transform = 'translateY(' + ((1-ease)*48) + 'px) scale(' + (0.88+ease*0.12) + ')';
```

**Tuning knobs:**
- `0.85` — trigger offset. Lower = starts earlier (higher on screen). Range: 0.7-0.95
- `0.4` — scroll range. Higher = slower reveal over more scroll distance. Range: 0.3-0.6
- `32` — translateY distance in pixels for text. Cards use 48. Hero uses 0 (scale only).
- `0.88` — starting scale for cards. Text doesn't scale. Range: 0.85-0.95

## Pattern 1: Sticky Element with Scroll-Driven Content

**Use for:** Phone mockups, laptop frames, device showcases where content inside changes as user scrolls.

**Key insight:** The scroll zone container must be a separate section with NO `overflow: hidden` — that kills `position: sticky`. Give it 200-300vh of height for dwell time.

```html
<!-- IMPORTANT: no overflow-hidden on this container or any ancestor -->
<section id="scrollZone" style="height: 300vh; background: inherit;">
  <div class="sticky top-[10vh] flex justify-center">
    <div class="phone-frame">
      <div id="screens">
        <div class="screen" data-screen="0" style="opacity:1">Screen 1</div>
        <div class="screen" data-screen="1" style="opacity:0">Screen 2</div>
        <div class="screen" data-screen="2" style="opacity:0">Screen 3</div>
      </div>
    </div>
  </div>
</section>
```

```javascript
var zone = document.getElementById('scrollZone');
var screens = document.querySelectorAll('.screen');
var count = screens.length;

window.addEventListener('scroll', function() {
  var progress = Math.min(Math.max(
    (window.scrollY - zone.offsetTop) / (zone.offsetHeight - window.innerHeight), 0), 1);
  var active = Math.min(Math.floor(progress * count), count - 1);
  screens.forEach(function(s, i) {
    s.style.opacity = i === active ? '1' : '0';
    s.style.transition = 'opacity 700ms ease'; // OK here: crossfade is triggered, not continuous
  });
}, { passive: true });
```

## Pattern 2: Sticky Phone + Scrolling Feature Descriptions

**Use for:** Product feature showcases (Apple-style). Phone stays put, descriptions scroll past.

```html
<div class="lg:grid lg:grid-cols-2 lg:gap-16">
  <div class="hidden lg:flex justify-center">
    <div class="sticky top-[15vh]"><!-- phone with data-screen states --></div>
  </div>
  <!-- Tall spacing IS the scroll runway -->
  <div class="space-y-52">
    <div class="feature-text" data-screen="0" style="opacity:0; transform:translateY(32px);">Feature 1</div>
    <div class="feature-text" data-screen="1" style="opacity:0; transform:translateY(32px);">Feature 2</div>
    <div class="feature-text" data-screen="2" style="opacity:0; transform:translateY(32px);">Feature 3</div>
  </div>
</div>
```

```javascript
var texts = document.querySelectorAll('.feature-text');
var screens = document.querySelectorAll('.feature-screen');
var current = -1;

window.addEventListener('scroll', function() {
  var vh = window.innerHeight;
  var closest = 0, closestDist = Infinity;

  texts.forEach(function(ft, i) {
    var rect = ft.getBoundingClientRect();
    // Scroll-driven reveal (reversible)
    var t = Math.min(Math.max((vh * 0.85 - rect.top) / (vh * 0.4), 0), 1);
    var ease = 1 - Math.pow(1 - t, 3);
    ft.style.opacity = ease;
    ft.style.transform = 'translateY(' + ((1 - ease) * 32) + 'px)';
    // Track closest to center for phone screen switch
    var dist = Math.abs(rect.top + rect.height / 2 - vh * 0.45);
    if (dist < closestDist) { closestDist = dist; closest = i; }
  });

  if (screens.length && closest !== current) {
    current = closest;
    screens.forEach(function(s) {
      s.style.opacity = parseInt(s.dataset.screen) === closest ? '1' : '0';
    });
  }
}, { passive: true });
```

## Pattern 3: Scroll-Shrink Logo/Hero Element

**Use for:** Agency sites, portfolios. Giant element shrinks to fixed corner position.

**Key insight:** `position: fixed` from the start. Never toggle between static and fixed.

```html
<h1 id="logo" style="position:fixed; z-index:50; transform-origin:top left;">Brand</h1>
<div id="logoSpacer" aria-hidden="true"></div>
```

```javascript
var logo = document.getElementById('logo');
var startSize = Math.max(Math.min(window.innerWidth * 0.12, 144), 40);
var endSize = 18;
var scrollRange = window.innerHeight * 0.35;

window.addEventListener('scroll', function() {
  var t = Math.min(Math.max(window.scrollY / scrollRange, 0), 1);
  var ease = 1 - Math.pow(1 - t, 3);
  logo.style.fontSize = (startSize + (endSize - startSize) * ease) + 'px';
  logo.style.left = (40 + (40 - 40) * ease) + 'px';
  logo.style.top = (48 + (32 - 48) * ease) + 'px';
}, { passive: true });
```

## Pattern 4: Line-by-Line Text Reveal (Scroll-Driven, Reversible)

**Use for:** Mission statements, value propositions, storytelling sections.

**Key insight:** Each line reveals based on its own viewport position. Scrolling back up reverses. No IntersectionObserver, no unobserve.

```html
<span class="reveal-line" style="opacity:0; transform:translateY(32px); display:block;">Line one</span>
<span class="reveal-line" style="opacity:0; transform:translateY(32px); display:block;">Line two</span>
<span class="reveal-line" style="opacity:0; transform:translateY(32px); display:block;">Line three</span>
```

```javascript
var lines = document.querySelectorAll('.reveal-line');
window.addEventListener('scroll', function() {
  var vh = window.innerHeight;
  lines.forEach(function(el) {
    var rect = el.getBoundingClientRect();
    var t = Math.min(Math.max((vh * 0.85 - rect.top) / (vh * 0.4), 0), 1);
    var ease = 1 - Math.pow(1 - t, 3);
    el.style.opacity = ease;
    el.style.transform = 'translateY(' + ((1 - ease) * 32) + 'px)';
  });
}, { passive: true });
```

## Pattern 5: Stacking Cards (Sticky Overlap)

**Use for:** Feature sections, pricing tiers. Each card slides over the previous as you scroll.

```html
<section class="relative">
  <div class="sticky top-0 min-h-screen flex items-center" style="z-index:1; background: #fef7f0;">
    Card 1
  </div>
  <div class="sticky top-0 min-h-screen flex items-center" style="z-index:2; background: #fffbf7;">
    Card 2
  </div>
  <div class="sticky top-0 min-h-screen flex items-center" style="z-index:3; background: #ffffff;">
    Card 3
  </div>
</section>
```

No JS needed — pure CSS `sticky`. Z-index must increment. Add `box-shadow: 0 -4px 30px rgba(0,0,0,0.08)` on each card so the stacking is visible.

## Pattern 6: Open-Up / Converge Effect

**Use for:** Card grids. Elements start close together and spread apart.

```javascript
var grid = document.getElementById('grid');
window.addEventListener('scroll', function() {
  var rect = grid.getBoundingClientRect();
  var vh = window.innerHeight;
  var t = Math.min(Math.max((vh * 0.85 - rect.top) / (vh * 1.4), 0), 1);
  var ease = 1 - Math.pow(1 - t, 3);
  grid.style.gap = (4 + ease * 16) + 'px';
}, { passive: true });
```

## Pattern 7: Scroll-Driven Card Fly-In (Reversible)

**Use for:** Card grids, feature cards, any block-level elements that should feel like they arrive.

**Key insight:** Combine translateY + scale + opacity. Do NOT add CSS `transition` classes — they create lag on scroll-driven updates. The transform values give a sense of flying in from below while growing to full size.

```html
<!-- No transition classes! Scroll JS handles everything directly. -->
<div class="card" style="opacity:0; transform:translateY(48px) scale(0.88);">Card 1</div>
<div class="card" style="opacity:0; transform:translateY(48px) scale(0.88);">Card 2</div>
```

```javascript
var cards = document.querySelectorAll('.card');
window.addEventListener('scroll', function() {
  var vh = window.innerHeight;
  cards.forEach(function(card) {
    var rect = card.getBoundingClientRect();
    var t = Math.min(Math.max((vh * 0.85 - rect.top) / (vh * 0.4), 0), 1);
    var ease = 1 - Math.pow(1 - t, 3);
    card.style.opacity = ease;
    card.style.transform = 'translateY(' + ((1-ease)*48) + 'px) scale(' + (0.88+ease*0.12) + ')';
  });
}, { passive: true });
```

## Pattern 8: Hero Load Animation (Time-Based — The One Exception)

**Use for:** Page entrance only. This is the one effect that should be time-based, not scroll-driven, because it happens before the user scrolls.

**Speed presets:** Pick one based on the page's energy:

| Speed | Duration | Best for |
|-------|----------|----------|
| **Fast** | 1000ms | Developer tools, dashboards, utility-focused |
| **Common** | 2000ms | Most landing pages, SaaS, portfolios |
| **Slow** | 3000ms | Luxury brands, editorial, immersive storytelling |

```html
<div id="heroBg" class="opacity-0"><!-- background --></div>
<div id="heroContent" class="opacity-0" style="transform: scale(0.85);">
  <!-- headline, subtitle, CTA -->
</div>
```

```javascript
var loadSpeed = 2000; // fast: 1000, common: 2000, slow: 3000

requestAnimationFrame(function() {
  var bg = document.getElementById('heroBg');
  bg.style.transition = 'opacity ' + loadSpeed + 'ms ease-out';
  bg.style.opacity = '1';

  var hero = document.getElementById('heroContent');
  hero.style.transition = 'opacity ' + loadSpeed + 'ms cubic-bezier(0.16,1,0.3,1), transform ' + loadSpeed + 'ms cubic-bezier(0.16,1,0.3,1)';
  hero.style.opacity = '1';
  hero.style.transform = 'scale(1)';
});
```

## Timing Quick Reference

| Effect Type | Duration / Range | Properties | Reversible? |
|-------------|-----------------|------------|:-----------:|
| Hero load | fast 1000 / common 2000 / slow 3000ms | opacity + scale | No (one-time) |
| Text reveal | 40% vh scroll range | opacity + translateY(32px) | Yes |
| Card fly-in | 40% vh scroll range | opacity + translateY(48px) + scale(0.88) | Yes |
| Line-by-line | 40% vh per line (natural stagger from position) | opacity + translateY(32px) | Yes |
| Sticky phone dwell | 200-300vh zone height | screen crossfade (700ms transition OK) | N/A |
| Stacking cards | min-h-screen per card (CSS only) | position: sticky | N/A |
| Logo shrink | 35% vh scroll range | fontSize + position | Yes |
| Open-up/converge | 140% vh scroll range | gap + rotateY | Yes |
| Parallax | Continuous while in view | translateY at 0.3-0.5x | Yes |

## Sources
- Apple product pages — gold standard for sticky phone + scrolling descriptions
- `interaction/animation-timing.md` — base timing values
- `expressive/purposeful-motion.md` — when and why to use motion
- `docs/presets/scroll-reveal-landing/` — reference implementation of patterns 4, 6, 7, 8
- `docs/presets/app-showcase/` — reference implementation of patterns 1, 5
- `docs/presets/agency-portfolio/` — reference implementation of pattern 3
