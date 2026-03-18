# Peak-End Rule

> **TL;DR:** Users judge experiences based on the most intense moment (peak) and the final moment (end), not the average. Design the climax and conclusion of every flow deliberately.

## Core Principles

### Kahneman's Research
Daniel Kahneman and colleagues demonstrated the peak-end rule through a series of experiments in the 1990s. In the "cold pressor" study (Kahneman et al., 1993), participants preferred a longer painful experience that ended with slightly reduced pain over a shorter one that ended abruptly at peak pain. The overall "duration" of discomfort was ignored -- only the peak intensity and the final moment shaped memory.

**Key insight:** People do not average their experience over time. They remember the most intense moment and the last moment, then generalize from those two data points.

### Duration Neglect
A related finding: the total duration of an experience has almost no effect on how it's remembered. A 3-minute frustrating flow and a 30-second frustrating flow are remembered equally badly if the peak and end are the same. This means:
- A long, smooth onboarding with a great finale is remembered as "easy"
- A short, bumpy onboarding that ends on a confusing step is remembered as "hard"

### Application to UX
Every user flow has a peak and an end. If you don't design them deliberately, they happen by accident -- and accidental peaks are usually negative (an error, a confusing form field, an unexpected charge).

**The four moments that matter most in any product:**
1. **First use / onboarding** -- the user's first peak experience
2. **Core task completion** -- the moment the user gets value (the "aha" moment)
3. **Error recovery** -- the worst peak if handled badly, a trust-building peak if handled well
4. **Session end / checkout completion** -- the final impression stored in memory

## Concrete Rules

### Designing Positive Peaks
- **Celebrate task completion** with visual feedback lasting 1-2 seconds (animation, color change, icon)
- **Show progress milestones** -- when a user hits 50% or 100% of a goal, mark it visually
- **Make the "aha moment" unmissable** -- the first time the product delivers its core value, make it feel special
- **Time peak moments at 60-70% through a flow** -- not at the start (too early to appreciate) or end (conflicts with the ending)
- Success animations should last **800-1500ms** -- long enough to notice, short enough not to block

### Designing Good Endings
- **Always confirm completion** with a clear success state (green check, congratulatory message)
- **Suggest a next step** on every completion screen -- never leave users at a dead end
- **End on the user's accomplishment**, not your upsell. Show what they achieved before showing related offers
- **Checkout confirmation** should reinforce the purchase decision with order summary, expected delivery, and a positive tone
- **Save the best for last** in multi-step flows -- put the most satisfying step at the end if possible

### Mitigating Negative Peaks
- **Prevent errors** rather than recovering from them (validation on blur, not on submit)
- **Inline validation** should appear within **300-500ms** of the user leaving a field
- When errors occur, **never clear the user's input** -- preserve their work
- Error messages must be **specific and actionable**: "Password needs 1 number" not "Invalid password"
- **Recovery should feel effortless** -- auto-focus on the error field, pre-fill what you can
- If a negative peak is unavoidable (payment failure, out of stock), **follow it immediately** with helpful alternatives

### Timing Rules
- **Success feedback:** 150-300ms delay after action, then 800-1500ms animation
- **Progress celebrations:** trigger at meaningful thresholds (25%, 50%, 100%), not arbitrary ones
- **Completion screens:** display for at least **3 seconds** before auto-redirecting (or don't auto-redirect)
- **Error recovery:** return user to a working state within **1 interaction** (one click or one field edit)

## CSS/Implementation Patterns

### Success State Animation
```css
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
}

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #22c55e;
  display: grid;
  place-items: center;
  animation: success-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  opacity: 0;
  transform: scale(0);
}

@keyframes success-pop {
  0% {
    opacity: 0;
    transform: scale(0);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.success-icon svg {
  width: 32px;
  height: 32px;
  color: white;
  stroke-dasharray: 50;
  stroke-dashoffset: 50;
  animation: checkmark-draw 400ms ease forwards 300ms;
}

@keyframes checkmark-draw {
  to {
    stroke-dashoffset: 0;
  }
}

.success-message {
  opacity: 0;
  transform: translateY(8px);
  animation: fade-up 400ms ease forwards 500ms;
}

@keyframes fade-up {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Confetti / Celebration Effect (CSS-only)
```css
.celebration {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  overflow: hidden;
}

.confetti-piece {
  position: absolute;
  width: 10px;
  height: 10px;
  top: -10px;
  animation: confetti-fall 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.confetti-piece:nth-child(odd) {
  border-radius: 50%;
}

.confetti-piece:nth-child(1) { left: 10%; background: #f43f5e; animation-delay: 0ms; }
.confetti-piece:nth-child(2) { left: 25%; background: #3b82f6; animation-delay: 100ms; }
.confetti-piece:nth-child(3) { left: 40%; background: #22c55e; animation-delay: 50ms; }
.confetti-piece:nth-child(4) { left: 55%; background: #f59e0b; animation-delay: 150ms; }
.confetti-piece:nth-child(5) { left: 70%; background: #8b5cf6; animation-delay: 75ms; }
.confetti-piece:nth-child(6) { left: 85%; background: #ec4899; animation-delay: 125ms; }

@keyframes confetti-fall {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  75% {
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg) scale(0.5);
    opacity: 0;
  }
}
```

### Smooth Completion Transition
```css
/* Transition from a form to a success state */
.flow-container {
  position: relative;
  overflow: hidden;
}

.flow-step {
  transition: opacity 300ms ease, transform 300ms ease;
}

.flow-step[data-state="exiting"] {
  opacity: 0;
  transform: translateX(-20px);
  position: absolute;
  inset: 0;
}

.flow-step[data-state="entering"] {
  animation: step-enter 400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  opacity: 0;
}

@keyframes step-enter {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### Progress Milestone Pulse
```css
.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 4px;
  transition: width 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* Pulse when hitting a milestone */
.progress-fill[data-milestone] {
  animation: milestone-pulse 800ms ease;
}

@keyframes milestone-pulse {
  0%, 100% {
    box-shadow: none;
  }
  50% {
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
  }
}

.milestone-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  animation: badge-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes badge-pop {
  0% { transform: scale(0); }
  100% { transform: scale(1); }
}
```

### Error Recovery with Preserved Context
```css
.form-field--error input {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
  animation: shake 400ms ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}

.form-field__error-message {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.375rem;
  animation: error-appear 200ms ease;
}

@keyframes error-appear {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Common Mistakes

1. **No success state at all** -- the most common anti-pattern. User completes a complex flow and sees... a plain text "Done." Design the success moment.

2. **Celebrating too often** -- if every button click triggers confetti, nothing feels special. Reserve celebrations for meaningful accomplishments (account creation, first project, major milestone).

3. **Ending on an upsell** -- "Thanks for purchasing! Now buy this." The end of the experience is the upsell, not the purchase. Users remember being sold to, not their successful purchase.

4. **Auto-redirecting from success screens** -- let users savor the completion. If you must redirect, wait at least 5 seconds and show a visible countdown.

5. **Clearing form data on error** -- this creates a devastating negative peak. The user's work vanishes, and they must re-enter everything. Always preserve input.

6. **Generic error messages** -- "Something went wrong" is the laziest negative peak. Specific, helpful messages turn errors from negative peaks into neutral moments.

7. **Ignoring the last step of onboarding** -- many apps front-load the onboarding experience and neglect the final step. Make the transition from "setting up" to "using the product" feel like a moment of arrival.

8. **Negative peak at payment** -- unexpected costs (shipping, tax, fees) revealed at checkout create the strongest negative peaks. Show total cost as early as possible.

## Decision Tree

**"Where should I invest in peak/end design?"**

```
What type of flow are you designing?
│
├── Onboarding / Sign-up
│   Peak: The moment the user sees the product working for them.
│   End: Transition into the actual product (not a blank dashboard).
│   Action: Add a welcome state with sample data or a quick-win task.
│
├── E-commerce / Checkout
│   Peak: Adding to cart (desire) or order confirmation (achievement).
│   End: Confirmation page with order details + expected delivery.
│   Action: Design a rich confirmation page. Avoid redirect to homepage.
│
├── Form / Data Entry
│   Peak: Often negative (a confusing field). Mitigate with
│         inline validation and helpful placeholder text.
│   End: Clear success confirmation with summary of what was submitted.
│   Action: Focus on preventing negative peaks (validation, autofill).
│
├── Content / Media
│   Peak: The most engaging piece of content in the session.
│   End: A recommendation or "what's next" prompt.
│   Action: Never end on a blank state. Always suggest next content.
│
└── Tool / Productivity
    Peak: Task completion (the "aha" -- the thing got done).
    End: Dashboard or summary showing accumulated progress.
    Action: Celebrate task completion. Show running totals/streaks.
```

**"How much celebration is appropriate?"**

```
Is this the user's first time completing this action?
├── YES --> Full celebration (animation, message, confetti if major).
│
└── NO --> How significant is the action?
    ├── Major (purchase, project complete, account milestone)
    │   --> Medium celebration (success animation, encouraging message).
    │
    ├── Regular (save, submit, send)
    │   --> Subtle confirmation (checkmark, brief color flash, toast).
    │
    └── Frequent / trivial (toggle, select, filter)
        --> Micro-feedback only (state change, no animation > 200ms).
```

## Sources

- Kahneman, D., Fredrickson, B. L., Schreiber, C. A., & Redelmeier, D. A. (1993). *When more pain is preferred to less: Adding a better end.* Psychological Science, 4(6), 401-405.
- Kahneman, D. (2011). *Thinking, Fast and Slow.* Farrar, Straus and Giroux.
- Do, A. M., Rupert, A. V., & Wolford, G. (2008). *Evaluations of pleasurable experiences: The peak-end rule.* Psychonomic Bulletin & Review, 15(1), 96-98.
- Fredrickson, B. L., & Kahneman, D. (1993). *Duration neglect in retrospective evaluations of affective episodes.* Journal of Personality and Social Psychology, 65(1), 45-55.
- Chase, W. M., & Dasu, S. (2001). *Want to perfect your company's service? Use behavioral science.* Harvard Business Review, 79(6), 78-84.

---

*Related: [Micro-interactions](../interaction/micro-interactions.md) | [Animation Timing](../interaction/animation-timing.md) | [Feedback Components](../components/feedback.md)*
