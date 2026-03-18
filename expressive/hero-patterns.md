# Hero Section Patterns

> **TL;DR:** A hero has 3 seconds to communicate what the page is about and why the visitor should care. Lead with a clear value proposition (5-8 words), support with 1 sentence, and include exactly 1 primary CTA. The hero type (centered, split, editorial, immersive) should match the content's intent, not just look impressive.

## Core Principles

1. **The hero IS the first impression** — 94% of first impressions are design-related. The hero sets the emotional tone for the entire page.
2. **Clarity beats creativity** — a clever hero that confuses is worse than a simple hero that communicates. Lead with what you do, not how clever you are.
3. **One action, not a menu** — the hero should funnel attention to a single primary CTA. Secondary actions can exist but must be visually subordinate.
4. **Visual hierarchy in 3 layers** — headline (what), subheadline (why), CTA (what to do). Each layer is distinct in size and weight.
5. **Performance affects perception** — a hero that loads in 1s feels premium. A hero that loads in 4s feels broken. Optimize images and defer non-critical assets.

## Concrete Rules

### Hero Anatomy
| Element | Sizing | Purpose |
|---------|--------|---------|
| Headline | text-4xl to text-7xl (36-72px) | The value proposition. 5-8 words max |
| Subheadline | text-lg to text-xl (18-20px) | Supporting context. 1-2 sentences max |
| Primary CTA | min-h-[48px], text-base to text-lg | The ONE thing you want them to do |
| Secondary CTA | text-sm to text-base, ghost/outlined | Alternative action (lower priority) |
| Visual | Full-bleed or constrained | Product screenshot, illustration, or gradient |

### Hero Types by Intent
| Type | Layout | Best For |
|------|--------|----------|
| Centered | Text centered, CTAs below, visual below or bg | SaaS landing, product launch, app download |
| Split (50/50) | Text left, visual right (or reversed) | Product demos, portfolios, agency pages |
| Editorial | Large serif headline, minimal visual | Publishing, editorial, personal brand |
| Immersive | Full-viewport visual, text overlay | Photography, luxury brands, experiences |
| Card-stack | Multiple overlapping cards/panels | Feature highlights, multi-product pages |

### Headline Sizing by Viewport
| Viewport | Headline Size | Line Height |
|----------|--------------|-------------|
| Mobile (320-639px) | text-3xl to text-4xl (30-36px) | 1.1-1.2 |
| Tablet (640-1023px) | text-4xl to text-5xl (36-48px) | 1.1 |
| Desktop (1024px+) | text-5xl to text-7xl (48-72px) | 1.05-1.1 |

### Spacing Rules
- **Headline to subheadline:** 16-24px (mt-4 to mt-6)
- **Subheadline to CTA:** 24-40px (mt-6 to mt-10)
- **Hero section padding:** 80-160px vertical (py-20 to py-40)
- **Max content width:** 640px for centered text (max-w-2xl)

## CSS/Implementation Patterns

### Centered Hero (Most Common)
```html
<section class="relative py-24 sm:py-32 lg:py-40">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center">
      <h1 class="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
        Ship products<br>
        <span class="text-indigo-600 dark:text-indigo-400">people love</span>
      </h1>
      <p class="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
        The design platform that helps teams build beautiful, accessible interfaces in half the time.
      </p>
      <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href="#" class="w-full sm:w-auto rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white hover:bg-indigo-500 transition-colors">
          Start free trial
        </a>
        <a href="#" class="w-full sm:w-auto rounded-xl border border-slate-300 dark:border-slate-600 px-8 py-4 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          Watch demo
        </a>
      </div>
    </div>
  </div>
</section>
```

### Split Hero with Product Visual
```html
<section class="py-20 lg:py-32">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      <div>
        <h1 class="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
          Analytics that<br>actually make sense
        </h1>
        <p class="mt-6 text-lg text-slate-600 dark:text-slate-300">
          Stop drowning in dashboards. Get the 3 metrics that matter, updated in real time.
        </p>
        <div class="mt-8 flex flex-wrap gap-4">
          <a href="#" class="rounded-lg bg-slate-900 dark:bg-white px-6 py-3 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors">
            Get started
          </a>
        </div>
      </div>
      <div class="relative">
        <div class="aspect-[4/3] rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/30 dark:to-violet-900/30 border border-slate-200 dark:border-slate-700 shadow-xl"></div>
      </div>
    </div>
  </div>
</section>
```

### Editorial Hero (Type-Driven)
```html
<section class="py-32 sm:py-40">
  <div class="max-w-4xl mx-auto px-4 sm:px-6">
    <h1 class="text-5xl sm:text-6xl lg:text-8xl font-light tracking-tight text-slate-900 dark:text-white leading-[1.05]" style="font-family: 'Playfair Display', serif">
      Design is not<br>just what it looks like.
    </h1>
    <p class="mt-8 text-xl text-slate-500 dark:text-slate-400 max-w-2xl">
      It's how it works. We help companies build products that feel as good as they function.
    </p>
    <div class="mt-12 flex items-center gap-6">
      <a href="#" class="text-base font-medium text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white pb-1 hover:border-indigo-600 dark:hover:border-indigo-400 transition-colors">
        Explore our work
      </a>
    </div>
  </div>
</section>
```

### Immersive Hero (Full Viewport)
```html
<section class="relative min-h-screen flex items-center justify-center overflow-hidden">
  <!-- Background -->
  <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900"></div>
  <!-- Content -->
  <div class="relative z-10 max-w-3xl mx-auto px-4 text-center">
    <h1 class="text-4xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.1]">
      Experience design<br>without limits
    </h1>
    <p class="mt-6 text-lg sm:text-xl text-slate-300 max-w-xl mx-auto">
      Immersive creative tools for the next generation of digital experiences.
    </p>
    <div class="mt-10">
      <a href="#" class="inline-flex rounded-full bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
        Enter the experience
      </a>
    </div>
  </div>
</section>
```

## Common Mistakes

1. **Headline too long** — over 10 words in a hero headline and the user skims past it. 5-8 words. Cut ruthlessly.
2. **Two equal CTAs** — "Sign Up" and "Learn More" at the same visual weight. Make one clearly primary.
3. **Hero too tall on mobile** — a min-h-screen hero with large text can push all useful content below the fold on mobile. Use py-24 instead.
4. **Stock photo hero** — generic stock photos actively hurt credibility. A solid gradient or abstract shape is better than a fake team photo.
5. **Autoplaying video background** — most users find it distracting, it kills performance, and it doesn't work on mobile Safari. Use a static image with a play button instead.
6. **Text over busy images without overlay** — white text on a photo needs a dark overlay (bg-black/50 minimum) for readability.

## Decision Tree

```
Choosing a hero type:
├─ What are you showing?
│  ├─ A product/app → Split hero with screenshot or Centered + visual below
│  ├─ A service/brand → Centered or Editorial (type-driven)
│  ├─ A portfolio/creative work → Immersive or Editorial
│  └─ An experience/event → Immersive (full viewport)
├─ What's the headline length?
│  ├─ 3-5 words → Can go very large (text-7xl+), editorial works well
│  ├─ 5-8 words → Standard sizing (text-5xl-6xl)
│  └─ 8+ words → Needs careful line breaking, consider split layout
├─ How many CTAs?
│  ├─ 1 → Center it. Make it big.
│  ├─ 2 → Primary (filled) + Secondary (outlined/ghost). Clear hierarchy.
│  └─ 3+ → Rethink. A hero is not a navigation menu.
└─ Mobile considerations:
   └─ Always stack CTAs vertically on mobile (flex-col sm:flex-row)
```

## Related Templates
- [`personal-hero/`](../docs/presets/personal-hero/) — Personal site with staggered reveal hero
- [`agency-landing/`](../docs/presets/agency-landing/) — Agency with gradient mesh hero
- [`product-launch/`](../docs/presets/product-launch/) — Product launch with gradient text hero
- [`devtool-landing/`](../docs/presets/devtool-landing/) — Developer tool with gradient mesh + terminal hero
- [`event-page/`](../docs/presets/event-page/) — Event with bold date hero

## Sources
- [NN/g — How Users Read on the Web](https://www.nngroup.com/articles/how-users-read-on-the-web/)
- [Peep Laja — Above the Fold](https://cxl.com/blog/above-the-fold/)
- [web.dev — LCP Optimization](https://web.dev/lcp/)
- Cross-reference: [Visual Hierarchy](../layout/visual-hierarchy.md), [Type Scale](../typography/type-scale.md), [Animation Timing](../interaction/animation-timing.md)
