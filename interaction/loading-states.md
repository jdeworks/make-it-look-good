# Loading States

> **TL;DR:** <100ms feels instant. 100ms-300ms: no indicator needed. 300ms-1s: show skeleton screen. >1s: show progress indicator. >10s: show progress bar with estimate. Always show something — blank screens destroy trust.

## Core Principles

1. **Perceived performance matters more than actual performance** — a 2s load with a skeleton feels faster than a 1s load with a blank screen
2. **Match the indicator to the expected duration** — spinners for short waits, skeletons for page sections, progress bars for long operations
3. **Loading states should preview the content layout** — skeletons show users what's coming, reducing perceived wait time
4. **Never block the entire page if only a section is loading** — use inline and section-level loading states
5. **Optimistic UI is the fastest loading state** — show the expected result immediately, reconcile with the server in the background

## Concrete Rules

### Perceived Performance Thresholds
| Duration | User Perception | Required Indicator |
|----------|----------------|-------------------|
| **< 100ms** | Feels instant | None — don't show anything |
| **100ms – 300ms** | Slight delay noticed | None, or subtle transition |
| **300ms – 1s** | Noticeable wait | Skeleton screen or spinner |
| **1s – 5s** | Feels slow | Skeleton screen + shimmer animation |
| **5s – 10s** | Uncomfortable | Progress bar (determinate if possible) |
| **> 10s** | "Is it broken?" | Progress bar + time estimate + cancel option |

### Loading State Hierarchy
| Scope | Pattern | When to Use |
|-------|---------|-------------|
| **Inline** | Spinner inside button, text shimmer | Single action (submit, save, toggle) |
| **Section** | Skeleton replacing a card/list/table | Part of the page loading independently |
| **Page** | Full-page skeleton or progress bar | Initial page load, route transition |
| **Overlay** | Modal spinner or progress | Blocking operation the user must wait for |

### Skeleton Screen Anatomy
| Element | Skeleton Representation |
|---------|----------------------|
| Text heading | Rectangle, 60–80% width, 24px height |
| Body text (multi-line) | 2–3 rectangles, varying width (100%, 90%, 60%), 16px height |
| Avatar / image | Circle or rounded rectangle matching image dimensions |
| Button | Rectangle matching button dimensions |
| Icon | Small square or circle |

### Spinner Usage Rules
- Show spinner **after 300ms delay** — never immediately (avoids flash for fast responses)
- Minimum display time: **500ms** — once shown, keep it visible long enough to register. Flashing a spinner for 50ms feels glitchy.
- Use **indeterminate** spinners only when you cannot estimate completion
- Size: **20–24px** inline, **32–48px** for section/page level

### Progress Bar Rules
| Type | When to Use | Requirements |
|------|-------------|-------------|
| **Determinate** | File upload, multi-step process, download | Show percentage or step count |
| **Indeterminate** | Server processing, unknown duration | Animated bar (no percentage) |
| **Segmented** | Multi-step wizard | Show current step and total steps |

- Never let a determinate progress bar go backwards
- Don't start at 0% — start at 5–10% to show immediate progress
- Slow down near 100% rather than jumping from 80% to done

## CSS/Implementation Patterns

### Skeleton Screen with Shimmer
```css
.skeleton {
  background: #e5e7eb;
  border-radius: 0.25rem;
  position: relative;
  overflow: hidden;
}

/* Shimmer animation */
.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Skeleton variants */
.skeleton--text {
  height: 1rem;
  width: 80%;
  margin-bottom: 0.5rem;
}

.skeleton--text-short {
  height: 1rem;
  width: 55%;
}

.skeleton--heading {
  height: 1.5rem;
  width: 65%;
  margin-bottom: 0.75rem;
}

.skeleton--avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
}

.skeleton--image {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 0.5rem;
}
```

### Spinner (CSS-Only)
```css
.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner--lg {
  width: 2.5rem;
  height: 2.5rem;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Button Loading State
```css
.btn--loading {
  position: relative;
  color: transparent; /* Hide text but keep width */
  pointer-events: none;
}

.btn--loading::after {
  content: "";
  position: absolute;
  width: 1.25rem;
  height: 1.25rem;
  top: 50%;
  left: 50%;
  margin: -0.625rem 0 0 -0.625rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
```

### Delayed Spinner (Show After 300ms)
```css
.spinner--delayed {
  animation: spin 0.6s linear infinite, fade-in 0s 300ms both;
  opacity: 0;
}

@keyframes fade-in {
  to { opacity: 1; }
}
```

### Tailwind Patterns
```html
<!-- Skeleton block -->
<div class="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>

<!-- Skeleton card -->
<div class="space-y-3 p-4">
  <div class="h-6 w-2/3 bg-gray-200 rounded animate-pulse"></div>
  <div class="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
  <div class="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
</div>

<!-- Spinner -->
<div class="w-6 h-6 border-2 border-gray-200 border-t-blue-600
            rounded-full animate-spin"></div>

<!-- Button with loading state -->
<button class="relative px-4 py-2 bg-blue-600 text-transparent"
        disabled>
  Submit
  <span class="absolute inset-0 flex items-center justify-center">
    <span class="w-5 h-5 border-2 border-white/30 border-t-white
                 rounded-full animate-spin"></span>
  </span>
</button>
```

## Optimistic UI

### When to Use Optimistic Updates
| Action | Optimistic? | Why |
|--------|------------|-----|
| Like / favorite | Yes | Low-stakes, easily reversible |
| Toggle setting | Yes | Low-stakes, user expects instant feedback |
| Send message | Yes | Show in chat immediately, mark as "sending" |
| Delete item | Maybe | Show removal, but offer undo for 5–10 seconds |
| Payment / checkout | No | High-stakes, must confirm server success |
| File upload | No | Cannot fake progress; show real upload state |

### Stale-While-Revalidate Pattern
1. Show **cached/stale data** immediately on page load
2. Fetch **fresh data** in the background
3. **Swap in** new data when it arrives (avoid layout shifts)
4. Best for: dashboards, feeds, product listings — content that changes but is not mission-critical in real time

## Common Mistakes

1. **Blank screen while loading** — the worst UX. Show a skeleton, a spinner, or at minimum the page shell (header, nav, footer).
2. **Spinner for everything** — spinners give no information about what's loading or how long it will take. Use skeletons for content areas.
3. **Flash of loading state** — showing a spinner for 50ms on a fast response feels broken. Delay the spinner by 300ms.
4. **Progress bar that lies** — fake progress bars that race to 90% then stall destroy trust. If you can't measure real progress, use an indeterminate indicator.
5. **No minimum display time for spinners** — showing and immediately hiding a spinner in <200ms creates a visual glitch. Keep it visible for at least 500ms once shown.
6. **Loading state doesn't match content layout** — a skeleton that looks nothing like the loaded content causes layout shift and disorientation. Match dimensions.
7. **Blocking the entire page for a section load** — if only a data table is refreshing, only show a loading state on that table, not a full-page overlay.
8. **No error recovery** — loading states without error handling leave users in limbo. Always handle timeout (show retry button) and failure (show error message).

## Decision Tree

```
How long will this operation take?
├─ < 100ms → Show nothing
├─ 100ms – 300ms → Show subtle transition (opacity, content swap)
├─ 300ms – 1s
│  ├─ Is it content loading? → Skeleton screen
│  └─ Is it an action? → Inline spinner (in button/control)
├─ 1s – 10s
│  ├─ Can you show partial content? → Progressive loading / stale-while-revalidate
│  ├─ Can you measure progress? → Determinate progress bar
│  └─ Unknown duration → Skeleton + shimmer animation
├─ > 10s
│  ├─ Show progress bar + time estimate
│  ├─ Allow cancellation
│  └─ Consider background processing + notification
└─ Can the result be predicted?
   ├─ Yes (>95% success rate) → Optimistic UI
   └─ No / high-stakes → Wait for server confirmation
```

## Sources
- [Jakob Nielsen — Response Times: The 3 Important Limits (1993, updated)](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [Luke Wroblewski — Mobile First (2011) — Perceived Performance chapter](https://www.lukew.com/ff/entry.asp?933)
- [Google — RAIL Performance Model](https://web.dev/articles/rail)
- [Bill Chung — Skeleton Screens: A Better UX (UX Collective, 2018)](https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a)
- [Material Design 3 — Progress Indicators](https://m3.material.io/components/progress-indicators/overview)
