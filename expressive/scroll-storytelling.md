# Scroll-Based Storytelling

> **TL;DR:** Scroll storytelling uses scroll position as a timeline to reveal content progressively. Use CSS `scroll-snap`, `position: sticky`, and `@keyframes` with `animation-timeline: scroll()` for native scroll-driven animations. Keep each "scene" viewport-height sized, limit to 3-5 scroll scenes per page, and always provide a skip/nav option for users who don't want to scroll.

## Core Principles

1. **Scroll is a timeline, not a decoration** — each scroll position should reveal new information. If removing the scroll effect doesn't lose meaning, the effect is decorative, not narrative.
2. **Progressive disclosure builds anticipation** — reveal information in a logical sequence. Don't show everything at once and animate it for no reason.
3. **One idea per viewport** — each scroll "scene" should communicate one concept. Cramming multiple ideas into a sticky section creates cognitive overload.
4. **The user controls the pace** — scroll-driven animation lets users speed up, slow down, or reverse. This is fundamentally different from auto-playing animation.
5. **Performance is non-negotiable** — scroll-triggered layout shifts, heavy JS scroll listeners, or janky animations destroy the experience. Use CSS scroll-driven animations or IntersectionObserver, not scroll event listeners.

## Concrete Rules

### Scroll Scene Sizing
| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Scene height | 100vh (1 viewport) | Each scene fills the screen, creating clear transitions |
| Sticky section height | 200-500vh scroll distance | 200vh = fast transition, 500vh = slow, detailed reveal |
| Number of scenes | 3-5 per page | More than 5 causes fatigue. Users lose patience. |
| Skip option | Always present | Users must be able to jump to content without scrolling through every scene |

### Animation Trigger Points
| Technique | CSS/JS | Use For |
|-----------|--------|---------|
| Scroll snap | `scroll-snap-type: y mandatory` | Full-viewport scene transitions |
| Sticky + progress | `position: sticky` + scroll distance | Sections that transform as you scroll |
| IntersectionObserver | JS | Reveal-on-enter animations |
| `animation-timeline: scroll()` | CSS | Native scroll-driven animations (modern browsers) |

### Timing and Distance
- **Reveal animations:** trigger at 20-30% viewport intersection (threshold: 0.2-0.3)
- **Sticky transform distance:** 200-300vh for a single transformation sequence
- **Fade-in distance:** 10-20% of viewport height (not too fast, not too slow)
- **Parallax ratio:** foreground 1:1, midground 0.5:1, background 0.2:1

## CSS/Implementation Patterns

### Scroll-Snap Sections
```html
<div class="h-screen overflow-y-scroll snap-y snap-mandatory">
  <section class="h-screen snap-start flex items-center justify-center">
    <h2 class="text-5xl font-bold">Scene One</h2>
  </section>
  <section class="h-screen snap-start flex items-center justify-center bg-slate-900 text-white">
    <h2 class="text-5xl font-bold">Scene Two</h2>
  </section>
  <section class="h-screen snap-start flex items-center justify-center">
    <h2 class="text-5xl font-bold">Scene Three</h2>
  </section>
</div>
```

### Sticky Section with Content Swap
```html
<!-- The sticky container stays fixed while scroll distance passes -->
<div class="relative" style="height: 300vh">
  <div class="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
    <div class="max-w-2xl mx-auto px-4 text-center">
      <h2 class="text-4xl font-bold text-slate-900 dark:text-white">
        How it works
      </h2>
      <p class="mt-4 text-lg text-slate-600 dark:text-slate-300">
        Scroll to explore each step
      </p>
    </div>
  </div>
</div>
```

### CSS Scroll-Driven Animation (Modern)
```css
/* Fade in and slide up as element enters viewport */
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(40px); }
  to   { opacity: 1; transform: translateY(0); }
}

.reveal-on-scroll {
  animation: fadeSlideIn linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 40%;
}
```
```html
<div class="reveal-on-scroll">
  <h3 class="text-2xl font-bold">This fades in on scroll</h3>
</div>
```

### IntersectionObserver Reveal (Broad Support)
```html
<style>
  .scroll-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease-out, transform 0.6s ease-out; }
  .scroll-reveal.visible { opacity: 1; transform: translateY(0); }
</style>

<div class="scroll-reveal">Content that reveals on scroll</div>

<script>
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.2 });
document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
</script>
```

### Horizontal Scroll Inside Vertical Page
```html
<section class="relative" style="height: 400vh">
  <div class="sticky top-0 h-screen flex items-center overflow-hidden">
    <div class="flex gap-8 px-8" id="hscroll-track" style="transform: translateX(0)">
      <div class="w-[80vw] flex-shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-800 p-12">
        <h3 class="text-2xl font-bold">Panel 1</h3>
      </div>
      <div class="w-[80vw] flex-shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-800 p-12">
        <h3 class="text-2xl font-bold">Panel 2</h3>
      </div>
      <div class="w-[80vw] flex-shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-800 p-12">
        <h3 class="text-2xl font-bold">Panel 3</h3>
      </div>
    </div>
  </div>
</section>
```

## Common Mistakes

1. **Scroll-jacking** — overriding the browser's native scroll behavior (changing scroll speed, direction, or snapping aggressively). Users hate losing control of scroll.
2. **No skip option** — forcing users through a 5-scene scroll sequence to reach the CTA. Always provide navigation or a "skip to content" link.
3. **Heavy JS scroll listeners** — attaching animation logic to `scroll` events causes jank. Use IntersectionObserver, CSS `animation-timeline`, or `requestAnimationFrame` with throttling.
4. **Too many scroll scenes** — 3-5 is the sweet spot. More than 5 and users feel trapped in a never-ending scroll sequence.
5. **Scroll effects on every element** — if everything fades in on scroll, nothing feels special. Use reveal animations on 3-5 key elements per viewport.
6. **No mobile fallback** — complex scroll effects often break on touch devices. Simplify to basic reveals on mobile, keep full effects for desktop.
7. **Content unreachable without JavaScript** — scroll-driven layouts must be readable if JS fails. Use progressive enhancement.

## Decision Tree

```
Adding scroll storytelling:
├─ Is the content sequential/narrative?
│  ├─ Yes → Scroll storytelling adds value
│  └─ No → Use standard page layout instead
├─ How many "scenes"?
│  ├─ 1-2 → Simple reveal-on-scroll is enough
│  ├─ 3-5 → Sticky sections with content swap
│  └─ 6+ → Too many. Consolidate or use a different pattern.
├─ Technical approach:
│  ├─ Simple fade-in → CSS animation-timeline: view() or IntersectionObserver
│  ├─ Sticky transformations → position: sticky + scroll distance calculation
│  ├─ Full-page snapping → scroll-snap-type: y mandatory
│  └─ Horizontal scroll → Sticky container + translateX based on scroll %
├─ Mobile:
│  ├─ Simplify → Reduce to basic reveals, remove parallax
│  └─ Skip option → Always provide a way to bypass
└─ Accessibility:
   ├─ prefers-reduced-motion → Disable all scroll animations
   └─ Keyboard nav → Ensure all content reachable without scrolling
```

## Related Templates
- [`scroll-story/`](../docs/presets/scroll-story/) — Scroll-triggered portfolio with IntersectionObserver reveals
- [`jdeworks-personal/`](../docs/presets/jdeworks-personal/) — Personalized scroll-driven portfolio

## Sources
- [MDN — Scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline)
- [web.dev — Scroll-driven animations](https://developer.chrome.com/docs/css-ui/scroll-driven-animations)
- [NN/g — Scrolljacking](https://www.nngroup.com/articles/scrolljacking-101/)
- Cross-reference: [Animation Timing](../interaction/animation-timing.md), [Visual Hierarchy](../layout/visual-hierarchy.md)
