# Purposeful Motion

> **TL;DR:** Motion in expressive pages differs from utility UI animation. Use motion to guide attention (draw the eye), establish hierarchy (what matters most moves first), and create emotional resonance (motion that matches the brand's energy). Limit to 2-3 motion techniques per page. Motion should explain, reveal, or delight — never decorate.

## Core Principles

1. **Motion is a hierarchy tool** — the first thing to animate gets the most attention. Use motion order to guide the user's eye: headline → subheadline → CTA → supporting content.
2. **Restraint creates impact** — a single well-timed animation in a sea of stillness is memorable. Animation everywhere is noise.
3. **Motion should match brand energy** — a luxury brand uses slow, graceful fades. A gaming startup uses fast, bouncy springs. The motion IS the personality.
4. **Motion must serve the narrative** — on expressive pages, motion reveals the story. Elements appear as they become relevant, creating a sense of progression.
5. **Performance is feel** — 60fps motion feels premium. Janky motion feels broken. Only animate `transform` and `opacity`.

## Concrete Rules

### Motion Techniques by Purpose
| Purpose | Technique | Duration | Easing |
|---------|-----------|----------|--------|
| Draw attention | Fade + slide in | 400-600ms | ease-out (decelerate) |
| Establish hierarchy | Staggered reveal | 200ms each, 80-120ms stagger | ease-out |
| Create delight | Scale bounce | 300-500ms | spring (0.34, 1.56, 0.64, 1) |
| Show progression | Counter/number roll | 600-1000ms | ease-in-out |
| Ambient atmosphere | Slow float/pulse | 3-6s, infinite | ease-in-out |
| Entrance drama | Large slide + fade | 600-800ms | cubic-bezier(0.16, 1, 0.3, 1) |

### Stagger Choreography Rules
- **Maximum elements in a stagger group:** 5-7
- **Stagger delay:** 80-120ms per element
- **Total stagger duration:** max 800ms
- **Direction:** match reading order (top-to-bottom, left-to-right in LTR)
- **First element:** always the headline or most important element

### Motion Budget Per Page
| Page Type | Max Motion Techniques | Max Animated Elements per Viewport |
|-----------|----------------------|-----------------------------------|
| Landing page | 3 | 5-7 |
| Portfolio piece | 2-3 | 3-5 |
| Product page | 2 | 4-6 |
| Personal site | 2-3 | 3-5 |

### Speed by Brand Energy
| Brand Energy | Enter Duration | Hover Duration | Easing Character |
|-------------|---------------|----------------|-----------------|
| Calm/luxury | 600-800ms | 300ms | Gentle ease-out |
| Professional | 300-500ms | 200ms | Standard ease-out |
| Energetic | 200-400ms | 150ms | Bouncy spring |
| Dramatic | 600-1000ms | 200ms | Strong deceleration |

## CSS/Implementation Patterns

### Staggered Hero Reveal
```html
<style>
  @keyframes heroReveal {
    from { opacity: 0; transform: translateY(32px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .hero-stagger > * {
    opacity: 0;
    animation: heroReveal 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .hero-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .hero-stagger > *:nth-child(2) { animation-delay: 100ms; }
  .hero-stagger > *:nth-child(3) { animation-delay: 200ms; }
  .hero-stagger > *:nth-child(4) { animation-delay: 300ms; }

  @media (prefers-reduced-motion: reduce) {
    .hero-stagger > * { opacity: 1; animation: none; }
  }
</style>

<section class="py-32">
  <div class="hero-stagger max-w-2xl mx-auto text-center">
    <span class="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Introducing</span>
    <h1 class="mt-4 text-5xl font-bold tracking-tight">Build faster, ship sooner</h1>
    <p class="mt-6 text-lg text-slate-600">The platform that turns ideas into products.</p>
    <div class="mt-10">
      <a href="#" class="rounded-xl bg-indigo-600 px-8 py-4 text-white font-semibold">Get started</a>
    </div>
  </div>
</section>
```

### Ambient Background Motion
```css
/* Slow floating gradient — adds atmosphere without distraction */
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.ambient-bg {
  background: linear-gradient(-45deg, #dbeafe, #ede9fe, #fce7f3, #e0f2fe);
  background-size: 400% 400%;
  animation: gradientShift 8s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .ambient-bg { animation: none; background-position: 0% 50%; }
}
```

### Number Counter Animation
```html
<style>
  @property --num {
    syntax: '<integer>';
    initial-value: 0;
    inherits: false;
  }
  .counter {
    --num: 0;
    animation: countUp 1s ease-in-out forwards;
    counter-reset: num var(--num);
  }
  .counter::after { content: counter(num); }
  @keyframes countUp { to { --num: 2847; } }
</style>

<span class="counter text-4xl font-bold tabular-nums"></span>
```

### Hover Micro-Motion for Cards
```html
<article class="group rounded-2xl border border-slate-200 dark:border-slate-700 p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50">
  <div class="overflow-hidden rounded-xl">
    <div class="aspect-[16/9] bg-slate-100 dark:bg-slate-800 transition-transform duration-500 ease-out group-hover:scale-105"></div>
  </div>
  <h3 class="mt-4 text-lg font-semibold">Card Title</h3>
  <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Card description goes here.</p>
</article>
```

### Scroll-Triggered Reveal (Intersection Observer)
```html
<style>
  .reveal { opacity: 0; transform: translateY(24px); transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
  .reveal.in-view { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .reveal { opacity: 1; transform: none; transition: none; }
  }
</style>

<div class="reveal">Revealed content</div>

<script>
const obs = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); } }),
  { threshold: 0.15 }
);
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
</script>
```

## Common Mistakes

1. **Animating everything** — if every element fades, slides, and bounces, nothing has impact. Pick 3-5 elements per viewport to animate.
2. **Same animation for every element** — using the same fade-up for headlines, images, and buttons. Vary the technique: headlines slide, images scale, buttons fade.
3. **Ignoring reduced motion** — roughly 25% of users prefer reduced motion. Wrap all animations in a `prefers-reduced-motion` check.
4. **Animation on repeat visits** — entrance animations are great the first time. On return visits or quick navigation, they feel like barriers. Consider only animating on first viewport intersection.
5. **Slow, dramatic animations on utility elements** — a 800ms animation on a form field is painful. Reserve dramatic timing for hero elements and key moments.
6. **Animating layout properties** — `width`, `height`, `top`, `left`, `margin` trigger expensive reflows. Only animate `transform` and `opacity`.

## Decision Tree

```
Adding purposeful motion:
├─ What's the goal?
│  ├─ Guide attention → Staggered reveal (headline → sub → CTA)
│  ├─ Create atmosphere → Ambient background motion (slow, subtle)
│  ├─ Show data → Counter animation or chart reveal
│  ├─ Encourage interaction → Hover micro-motion on interactive elements
│  └─ Tell a story → Scroll-triggered progressive reveal
├─ Brand energy?
│  ├─ Calm → Longer duration (500-800ms), gentle easing
│  ├─ Energetic → Shorter (200-400ms), spring easing
│  └─ Dramatic → Long initial (600-1000ms), strong deceleration
├─ How many motion elements per viewport?
│  ├─ 1-3 → Perfect. Each one gets attention.
│  ├─ 4-5 → OK if staggered properly.
│  └─ 6+ → Too many. Cut to the most important.
└─ Accessibility:
   └─ Always: @media (prefers-reduced-motion: reduce) { animation: none; }
```

## Related Templates
- [`scroll-story/`](../docs/presets/scroll-story/) — IntersectionObserver scroll reveals with staggered cascade
- [`saas-features/`](../docs/presets/saas-features/) — Bouncy hover interactions on bento cards (playful variant)
- [`devtool-landing/`](../docs/presets/devtool-landing/) — Glow card hover effects (clean variant)
- [`agency-landing/`](../docs/presets/agency-landing/) — Service row expand on hover, image zoom

## Sources
- [Material Design 3 — Motion principles](https://m3.material.io/styles/motion/overview)
- [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Stripe.com](https://stripe.com) — exemplar of purposeful motion in product pages
- Cross-reference: [Animation Timing](../interaction/animation-timing.md), [Micro-Interactions](../interaction/micro-interactions.md), [Visual Identity](visual-identity.md)
