# Micro-Interactions

> **TL;DR:** Micro-interactions provide feedback, guide tasks, and communicate state. Every user action should have a visible response within 100ms. Keep animations subtle -- they should support the experience, not distract from it.

## Core Principles

1. **Every action needs a reaction** — if the user clicks, taps, hovers, or types, something visible must happen within 100ms
2. **Micro-interactions are functional, not decorative** — they communicate state changes, confirm actions, and prevent errors
3. **Subtlety is key** — the best micro-interactions are felt, not noticed. If users comment on your animation, it's probably too much.
4. **Consistency builds trust** — the same action should produce the same feedback everywhere in your UI
5. **Performance is non-negotiable** — a janky 60fps-dropping animation is worse than no animation at all

## Concrete Rules

### Response Time Thresholds
| Threshold | User Perception | Required Feedback |
|-----------|----------------|-------------------|
| 0--100ms | Instant | Visual state change (color, shadow, scale) |
| 100--300ms | Slight delay | Transition animation to show something is happening |
| 300--1000ms | Noticeable wait | Progress indicator or skeleton screen |
| 1000ms+ | Long wait | Progress bar with estimate, or background processing message |

### Feedback by Interaction Type
| Interaction | Feedback | Timing |
|-------------|----------|--------|
| Button press | Scale down 96--98%, darken 10% | 100ms |
| Button release | Return to original | 150ms |
| Hover enter | Subtle lift (shadow + translateY -1px) | 150ms |
| Hover exit | Return to resting state | 200ms |
| Toggle on/off | Thumb slides, background color changes | 200ms |
| Checkbox check | Check mark draws in / scales up | 150ms |
| Form field focus | Border color change, subtle glow | 100ms |
| Form validation error | Shake (2--3px, 2 cycles) + red border | 300ms |
| Form validation success | Green check icon fades in | 200ms |

### Skeleton-to-Content Transition
- Show skeleton shapes matching content layout (not a spinner)
- Shimmer animation: `1.5s ease-in-out infinite`. Crossfade to real content: `200ms ease-out`
- Never show skeleton for less than 200ms (causes flicker)

### Scroll-Triggered Effects
- Use `IntersectionObserver`, not scroll event listeners
- Trigger when element is 10--20% visible (threshold 0.1--0.2)
- Fade + translate up (8--16px) is the standard reveal pattern
- Only animate elements once — don't re-animate on scroll up

## CSS/Implementation Patterns

### Button Press Feedback
```css
.button {
  transition: transform 100ms ease-out, box-shadow 100ms ease-out;
}

.button:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); transform: translateY(-1px); }
.button:active { transform: scale(0.97); box-shadow: 0 1px 2px rgba(0,0,0,0.1); transition-duration: 50ms; }
```

### Toggle Switch
```css
.toggle-thumb {
  transition: transform 200ms cubic-bezier(0.4, 0.0, 0.2, 1);
}

.toggle[aria-checked="true"] .toggle-thumb {
  transform: translateX(20px);
}

.toggle-track {
  transition: background-color 200ms ease-in-out;
}
```

### Skeleton Loading
```css
.skeleton {
  background: linear-gradient(
    90deg,
    hsl(0 0% 90%) 25%,
    hsl(0 0% 96%) 50%,
    hsl(0 0% 90%) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Scroll-Triggered Reveal
```css
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```
```js
// Use IntersectionObserver — animate once, then stop observing
const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
  }),
  { threshold: 0.15 }
);
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
```

### Form Validation Shake
```css
.input-error {
  animation: shake 300ms ease-out;
  border-color: var(--color-error);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  50% { transform: translateX(3px); }
  75% { transform: translateX(-2px); }
}
```

## Common Mistakes

1. **No hover/active states** — every interactive element needs `:hover`, `:focus-visible`, and `:active` styles.
2. **Animating everything** — static labels, paragraphs, and decorative elements should stay still.
3. **Slow micro-interactions** — feedback over 200ms feels laggy. Button presses and hovers: 100--150ms.
4. **Spinner instead of skeleton** — skeletons show the shape of incoming content and feel faster.
5. **Scroll animations that replay** — re-animating on scroll-up is disorienting. Animate once.
6. **Animating layout properties** — stick to `transform` and `opacity` to avoid layout thrashing.
7. **Missing reduced-motion support** — always provide a `prefers-reduced-motion: reduce` override.

## Decision Tree

```
Does this element need a micro-interaction?
├─ Is it interactive (button, link, toggle, input)?
│  ├─ Yes → It MUST have hover, focus, and active states
│  └─ No → Probably doesn't need animation
├─ Does it change state (loading, success, error)?
│  ├─ Yes → Animate the transition between states (150--250ms)
│  └─ No → Leave it static
├─ Is content loading?
│  ├─ Under 200ms → Show nothing (avoid flicker)
│  ├─ 200ms--2s → Show skeleton screen
│  └─ Over 2s → Show skeleton + progress indicator
└─ Is it triggered by scroll?
   ├─ Yes → Use IntersectionObserver, animate once, fade+slide
   └─ No → Only animate on user action or state change
```

## Sources
- Saffer, D. (2013). *Microinteractions: Designing with Details*
- Nielsen, J. (1993). *Usability Engineering* — response time thresholds
- [Material Design 3 — Interaction states](https://m3.material.io/foundations/interaction/states/overview)
- [web.dev — Content visibility and Intersection Observer](https://web.dev/intersectionobserver/)
- [Apple HIG — Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
