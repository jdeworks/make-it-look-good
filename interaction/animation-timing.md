# Animation Timing

> **TL;DR:** Enter animations: 200--300ms. Exit animations: 150--200ms. Never exceed 500ms. Use `ease-out` for entering elements, `ease-in` for exiting. Always respect `prefers-reduced-motion`. Purpose determines duration: feedback 100ms, state changes 200ms, page transitions 300ms.

## Core Principles

1. **Animation serves communication, not decoration** — every animation should help the user understand what changed and why
2. **Faster is almost always better** — users perceive animations over 400ms as sluggish. When in doubt, go shorter.
3. **Entering and exiting need different timing** — enters can be slightly longer (the user is waiting to see content); exits should be fast (the user is done with that element)
4. **Easing makes motion feel natural** — linear motion looks robotic. Real objects accelerate and decelerate.
5. **Reduced motion is not optional** — vestibular disorders, motion sensitivity, and user preference all require a `prefers-reduced-motion` fallback

## Concrete Rules

### Duration by Purpose
| Purpose | Duration | Example |
|---------|----------|---------|
| Instant feedback | 50--100ms | Button press, checkbox toggle, ripple |
| State change | 150--250ms | Accordion expand, tab switch, dropdown open |
| Enter transition | 200--300ms | Modal appear, card slide in, fade in |
| Exit transition | 150--200ms | Modal dismiss, toast disappear, fade out |
| Page/route transition | 250--350ms | Page crossfade, slide between views |
| Complex choreography | 300--500ms | Multi-element stagger, onboarding sequence |

**Hard limit:** No single animation should exceed 500ms. Sequences can be longer but each step stays under 500ms.

### Easing Curves
| Easing | CSS Value | Use For |
|--------|-----------|---------|
| Ease-out (decelerate) | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Elements entering the screen |
| Ease-in (accelerate) | `cubic-bezier(0.4, 0.0, 1, 1)` | Elements leaving the screen |
| Ease-in-out | `cubic-bezier(0.4, 0.0, 0.2, 1)` | Elements changing state in place |
| Standard (Material) | `cubic-bezier(0.2, 0.0, 0, 1)` | General-purpose motion |
| Spring-like | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful UI, bouncy feedback |

**Rule:** Never use `linear` for UI transitions. It looks mechanical and unnatural.

### Stagger Timing
- **Stagger delay between items:** 30--50ms per item
- **Maximum total stagger:** 500ms (cap at ~10 items, then batch the rest)
- **Direction:** stagger top-to-bottom or left-to-right, matching reading order

### Tailwind Duration and Easing Classes
| Class | Value | Use |
|-------|-------|-----|
| `duration-75` | 75ms | Micro-feedback (color change) |
| `duration-100` | 100ms | Instant feedback (toggle, check) |
| `duration-150` | 150ms | Fast state change, exits |
| `duration-200` | 200ms | Standard state change, enters |
| `duration-300` | 300ms | Enter transitions, modals |
| `duration-500` | 500ms | Complex/page transitions (max) |
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Enter transitions |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit transitions |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | In-place state changes |

## CSS/Implementation Patterns

### Standard Transition Setup
```css
.element {
  transition-property: opacity, transform;
  transition-duration: 200ms;
  transition-timing-function: cubic-bezier(0.0, 0.0, 0.2, 1); /* ease-out */
}
```

### Enter and Exit Transitions
```css
/* Enter — ease-out, slightly longer */
.modal-enter {
  animation: fadeSlideIn 250ms cubic-bezier(0.0, 0.0, 0.2, 1) forwards;
}

/* Exit — ease-in, slightly shorter */
.modal-exit {
  animation: fadeSlideOut 150ms cubic-bezier(0.4, 0.0, 1, 1) forwards;
}

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeSlideOut {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(8px); }
}
```

### Stagger Animation
```css
.list-item {
  animation: fadeIn 200ms cubic-bezier(0.0, 0.0, 0.2, 1) both;
}

.list-item:nth-child(1) { animation-delay: 0ms; }
.list-item:nth-child(2) { animation-delay: 40ms; }
.list-item:nth-child(3) { animation-delay: 80ms; }
.list-item:nth-child(4) { animation-delay: 120ms; }
/* Cap at ~10 items or 400ms total delay */
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Tailwind Reduced Motion
```html
<!-- Element fades in normally, but instant for reduced-motion users -->
<div class="transition duration-200 ease-out motion-reduce:transition-none">
  Content
</div>
```

### Only Animate Cheap Properties
```css
/* GOOD — only opacity and transform (GPU-composited) */
.card {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}

/* BAD — triggers layout recalculation */
.card {
  transition: height 200ms, width 200ms, margin 200ms;
}
```

## Common Mistakes

1. **Animations over 500ms** — feels sluggish. Users start wondering if the UI is broken. Keep individual animations under 500ms.
2. **Same duration for enter and exit** — exits should be 25--50% shorter than enters. The user is moving on; don't make them wait.
3. **Using `ease` (CSS default)** — the built-in `ease` keyword is generic. Use explicit cubic-bezier curves for more intentional motion.
4. **Animating `width`, `height`, `top`, `left`** — these trigger expensive layout recalculations. Use `transform` and `opacity` only when possible.
5. **Ignoring `prefers-reduced-motion`** — roughly 1 in 4 users have some motion sensitivity. Always provide reduced-motion styles.
6. **Linear easing** — looks robotic. Real-world objects don't move at constant speed. Always use an easing curve.
7. **Stagger without a cap** — staggering 50 items at 50ms each = 2.5s before the last item appears. Cap at 10 items or 400ms total.
8. **Animating on page load** — entrance animations for static content feel like waiting. Reserve animation for user-triggered state changes.

## Decision Tree

```
Choosing animation timing:
├─ What triggered the animation?
│  ├─ Direct user action (click, tap) → 100--200ms
│  ├─ State change (expand, collapse, switch) → 200--250ms
│  ├─ Content appearing (modal, popover) → 200--300ms with ease-out
│  ├─ Content disappearing → 150--200ms with ease-in
│  └─ Page/route change → 250--350ms crossfade
├─ Which easing curve?
│  ├─ Element entering view → ease-out (decelerate)
│  ├─ Element leaving view → ease-in (accelerate)
│  └─ Element changing in place → ease-in-out
├─ Multiple elements?
│  ├─ Yes → Stagger 30--50ms per item, cap at 400ms total
│  └─ No → Single animation, no stagger
└─ Reduced motion?
   └─ Always add @media (prefers-reduced-motion: reduce) fallback
```

## Sources
- [Material Design 3 — Motion](https://m3.material.io/styles/motion/overview)
- [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- Nielsen, J. (1993). *Usability Engineering* — response time thresholds (100ms, 1s, 10s)
- [web.dev — Animations and performance](https://web.dev/animations-guide/)
- [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
