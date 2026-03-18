# Nielsen's 10 Usability Heuristics

> **TL;DR:** The gold standard checklist for interface usability: visibility of system status, match between system and real world, user control, consistency, error prevention, recognition over recall, flexibility, aesthetic minimalism, error recovery, and help/documentation.

## Core Principles

Jakob Nielsen's 10 heuristics (1994, updated) are broad rules of thumb for interaction design. They are not specific usability guidelines with measurable criteria — they are high-level categories for classifying usability problems. This file maps each heuristic to **concrete, measurable implementation rules** with CSS/code patterns.

Use these heuristics when evaluating existing interfaces or making design decisions. They complement — not replace — WCAG accessibility standards and the [Design Review Checklist](../workflows/design-review-checklist.md).

## Concrete Rules

### 1. Visibility of System Status

**Definition:** The system should always keep users informed about what is going on, through appropriate feedback within reasonable time.

**Good examples:** Progress bars during uploads, "Saving..." indicator in docs, active nav item highlighting, skeleton screens during loading.

**Bad examples:** No feedback after clicking "Submit", spinner with no progress indication for long operations, no indication of which page you are on.

**Implementation rules:**
- Acknowledge every user action within **100ms** — visual feedback (color change, ripple, scale) must appear within this window
- If an operation takes **300ms-1s**, show a subtle loading indicator (spinner, pulse)
- If an operation takes **1-10s**, show a progress bar or step indicator with estimated time
- If an operation takes **>10s**, show progress percentage and allow background operation
- Always show current location in navigation (active state with >=3:1 contrast difference from inactive)
- Form submission must show a success or error state — never return to the same form silently
- See [Loading States](../interaction/loading-states.md) and [Feedback](../components/feedback.md)

### 2. Match Between System and the Real World

**Definition:** The system should speak the user's language, using words, phrases, and concepts familiar to the user rather than system-oriented terms.

**Good examples:** "Shopping cart" instead of "item buffer", dates shown as "March 17, 2026" not "2026-03-17T00:00:00Z", natural sort order (newest first for messages, alphabetical for contacts).

**Bad examples:** Error messages like "Error 0x80004005", jargon like "serialize your preferences", ISO timestamps in user-facing UI.

**Implementation rules:**
- Error messages must describe the problem in plain language and suggest a fix: "Email address is invalid. Check for typos." not "Validation error: field_email regex mismatch"
- Use conventional icons: magnifying glass for search, gear for settings, house for home, X for close
- Date/time formatting matches user locale — use `Intl.DateTimeFormat` or equivalent
- Use natural language labels: "2 minutes ago" instead of "2025-03-17 14:58:00"
- Sort order should match user expectations: most recent first for activity, alphabetical for lists, most relevant for search results
- Maximum 1 technical/jargon term per screen for general-purpose interfaces

### 3. User Control and Freedom

**Definition:** Users often perform actions by mistake. They need a clearly marked "emergency exit" to leave the unwanted state without going through an extended process.

**Good examples:** Undo after delete, back button works as expected, easy dismiss on modals, clear "Cancel" button on forms.

**Bad examples:** Permanent deletion with no undo, wizard with no back button, modal that can only be closed by a tiny X, forced onboarding with no skip.

**Implementation rules:**
- Every destructive action must be **undoable for at least 5 seconds** or **preceded by a confirmation dialog**
- Modals must be dismissable via: close button (minimum 44x44px target), clicking the backdrop, and pressing Escape
- Multi-step flows must have a visible back button and step indicator
- Every form must have a Cancel action that is accessible without scrolling
- Long processes must be interruptible — show a "Cancel" option
- Browser back button must work correctly (don't break history)
- See [Modals and Dialogs](../components/modals-and-dialogs.md)

### 4. Consistency and Standards

**Definition:** Users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform conventions.

**Good examples:** All primary buttons are the same color and size, form validation works the same everywhere, icons are consistent.

**Bad examples:** "Save" is blue on one page and green on another, different date formats across the app, some links are underlined and others are not.

**Implementation rules:**
- Use a single design token system for all components — see [Design Tokens](../systems/design-tokens.md)
- All buttons of the same type (primary, secondary, ghost) must share identical styles across the app: same height, padding, border-radius, font-size, and colors
- Interactive text must be consistently styled: if links are blue and underlined, that pattern must be followed everywhere
- Icon usage must be 1:1 — one icon per concept, one concept per icon
- Follow platform conventions: underlined text = link; checkbox = multi-select; radio = single select
- Spacing between identical component types (e.g., cards in a grid) must be uniform
- Component behavior must be identical: if one dropdown opens on click, all dropdowns open on click (not hover)

### 5. Error Prevention

**Definition:** Even better than good error messages is a careful design that prevents problems from occurring in the first place.

**Good examples:** Disabling the "Submit" button until form is valid, inline validation as user types, confirmation for destructive actions, autocomplete for complex inputs.

**Bad examples:** Allowing form submission with empty required fields then showing errors, no character count on limited fields, placing "Delete" next to "Save".

**Implementation rules:**
- Inline validation should trigger **on blur** (not on every keystroke) for fields where the user might be mid-entry
- Show character count for fields with limits when the user reaches 80% of the limit
- Destructive actions (delete, discard, send) must be visually distinct: red or separated from safe actions by at least **24px** gap
- Confirmation dialogs for destructive actions must name the specific item: "Delete 'Project Alpha'?" not "Are you sure?"
- Disable submit buttons while the form is invalid, but provide clear indication of what needs fixing
- Use input types that constrain entry: `type="email"`, `type="tel"`, `type="number"` with min/max, `<select>` for fixed options
- Place dangerous actions away from common actions — bottom of page, secondary styling, or behind a "More options" menu
- See [Forms](../components/forms.md)

### 6. Recognition Rather Than Recall

**Definition:** Minimize the user's memory load by making elements, actions, and options visible. The user should not have to remember information from one part of the interface to another.

**Good examples:** Autocomplete for search, recently used items list, visible breadcrumbs, tooltips on icon-only buttons, persistent labels on form fields.

**Bad examples:** Placeholder-only form labels (disappear on focus), requiring users to remember codes or IDs, hidden navigation.

**Implementation rules:**
- Form labels must be **persistent and visible** — never rely solely on placeholder text (it vanishes on focus)
- Search inputs should offer autocomplete or recent searches after 2 characters
- Use breadcrumbs for navigation deeper than 2 levels
- Icon-only buttons must have a tooltip (on hover/focus) and an `aria-label`
- Show contextual information inline: "3 items selected" not just a checkbox count
- Dashboard widgets should display units and labels directly (not in a legend the user must cross-reference)
- Maximum **5 options** before providing search or filtering (Hick's Law — see [Hick's Law](../foundations/hicks-law.md))

### 7. Flexibility and Efficiency of Use

**Definition:** Accelerators — unseen by the novice user — may speed up interaction for the expert user such that the system can cater to both inexperienced and experienced users.

**Good examples:** Keyboard shortcuts (Cmd+S to save), bulk actions, drag-and-drop alongside button alternatives, customizable dashboards.

**Bad examples:** Forcing mouse-only interaction, no keyboard shortcuts for frequent actions, no way to customize repetitive workflows.

**Implementation rules:**
- Provide keyboard shortcuts for top 5 most-used actions; display them in menus and tooltips
- Allow bulk operations (select all, bulk delete) when users manage lists of >10 items
- Offer both simple and advanced modes for complex interfaces (e.g., basic and advanced search)
- Support drag-and-drop **and** a button-based alternative for reordering
- Provide sensible defaults for all settings — expert users can change them, novice users never need to
- Saved/recent searches for search-heavy interfaces
- Keyboard shortcut hints: show in tooltips, menu items, or via a `?` shortcut overlay

### 8. Aesthetic and Minimalist Design

**Definition:** Interfaces should not contain information that is irrelevant or rarely needed. Every extra unit of information competes with the relevant units and diminishes their relative visibility.

**Good examples:** Clean dashboard with 3-5 key metrics, progressive disclosure (expand for details), focused task flows.

**Bad examples:** Walls of text, 15+ dashboard widgets visible at once, showing every possible action on every element.

**Implementation rules:**
- Each screen should have **one primary purpose** — if you cannot state it in one sentence, split the screen
- Show a maximum of **5-7 data points** above the fold on dashboards (Miller's law)
- Use progressive disclosure: details on demand, collapsed sections, "Show more" patterns
- Content-to-chrome ratio should favor content — navigation, toolbars, and sidebars should not occupy >25% of the viewport
- Whitespace is a design element, not wasted space — see [Whitespace](../layout/whitespace.md)
- Every UI element must earn its place: if removing an element does not hurt the user experience, remove it
- Reduce visual noise: limit borders, dividers, and backgrounds — use spacing and alignment to create structure instead

### 9. Help Users Recognize, Diagnose, and Recover from Errors

**Definition:** Error messages should be expressed in plain language (no codes), precisely indicate the problem, and constructively suggest a solution.

**Good examples:** "Password must be at least 8 characters. You entered 5." with the field highlighted; 404 page with search bar and navigation links.

**Bad examples:** "An error occurred", "Error 500", "Invalid input" without indicating which field.

**Implementation rules:**
- Error messages must follow the pattern: **What went wrong** + **How to fix it**
- Form errors must appear inline, adjacent to the problematic field (not only at the top of the form)
- Error text color: use red (#dc2626 or similar) with an icon — do not rely on color alone
- Error state on inputs: red border (minimum 2px), red text below, icon inside or beside the field
- Error messages must persist until the user corrects the problem — do not auto-dismiss error messages
- 404 pages must offer: a link to the homepage, a search bar, and suggested navigation
- Network/server errors must offer a retry action
- Validation error summary: if a form has 3+ errors, show a summary at the top linking to each errored field

### 10. Help and Documentation

**Definition:** Even though it is better if the system can be used without documentation, it may be necessary to provide help and documentation. Any such information should be easy to search, focused on the user's task, list concrete steps, and not be too large.

**Good examples:** Inline tooltips for complex fields, contextual help links, onboarding tours for first-time users, searchable knowledge base.

**Bad examples:** No help at all, 50-page PDF manual, help docs that are outdated or only describe features (not tasks).

**Implementation rules:**
- Every form field with a non-obvious expectation should have a help text line (gray, 12-14px, below the label)
- Provide contextual help (tooltip or inline text) on fields with specific formatting requirements (e.g., "Format: MM/DD/YYYY")
- Onboarding tours: maximum 3-5 steps for first-time users; skippable; re-accessible from settings
- Empty states should include guidance: "No projects yet. Create your first project to get started." with a CTA button
- Keyboard shortcut overlay accessible via `?` key on keyboard-heavy apps
- Search functionality for any help/documentation system

## CSS/Implementation Patterns

### System Status: Loading and Success Feedback

```css
/* Skeleton loading state */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-neutral-200) 25%,
    var(--color-neutral-100) 50%,
    var(--color-neutral-200) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Success flash after save */
.save-success {
  animation: flash-success 300ms ease-out;
}

@keyframes flash-success {
  0% { background-color: rgba(22, 163, 74, 0.1); }
  100% { background-color: transparent; }
}
```

### Error Prevention: Inline Validation

```css
/* Error state for form inputs */
.input-error {
  border: 2px solid #dc2626;
  background-color: #fef2f2;
}

.input-error:focus {
  outline: 2px solid #dc2626;
  outline-offset: 2px;
}

.error-message {
  color: #dc2626;
  font-size: 0.875rem;  /* 14px */
  margin-top: 0.25rem;  /* 4px */
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Tailwind equivalent */
/* <input class="border-2 border-red-600 bg-red-50 focus:outline-2 focus:outline-red-600 focus:outline-offset-2" /> */
/* <p class="text-red-600 text-sm mt-1 flex items-center gap-1">
     <svg>...</svg> Email address is invalid
   </p> */
```

### Consistency: Button Hierarchy

```css
/* Enforce consistent button hierarchy */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.5rem;     /* 40px */
  padding: 0.5rem 1rem;   /* 8px 16px */
  font-size: 0.875rem;    /* 14px */
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.btn-primary {
  background-color: var(--color-primary-600);
  color: #ffffff;
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-primary-600);
  border: 1px solid var(--color-primary-600);
}

.btn-ghost {
  background-color: transparent;
  color: var(--color-neutral-700);
  border: none;
}

.btn-danger {
  background-color: #dc2626;
  color: #ffffff;
}
```

### Recognition: Persistent Labels

```css
/* Floating label pattern — label stays visible */
.field-group {
  position: relative;
  margin-top: 1rem;
}

.field-group label {
  position: absolute;
  top: -0.625rem;
  left: 0.75rem;
  background: var(--bg-surface);
  padding: 0 0.25rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.field-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: 1rem;
}
```

## Common Mistakes

1. **Treating heuristics as a checklist of yes/no items** — they are severity scales; an issue can violate a heuristic mildly (cosmetic) or severely (prevents task completion)
2. **Focusing only on heuristic #8 (aesthetics)** — a beautiful UI that violates #1 (no status feedback) or #5 (no error prevention) fails users more than an ugly but functional one
3. **Ignoring heuristic #3 (user control)** — single most common source of user frustration is inability to undo, go back, or escape from an unwanted state
4. **Vague error messages (#9)** — "Something went wrong" is almost as bad as no error message; always tell users what to do next
5. **Placeholder-only labels (#6)** — violates recognition over recall; labels must persist while the user types
6. **Overloading the interface (#8)** — showing every feature at once makes none of them discoverable; use progressive disclosure
7. **No keyboard shortcuts (#7)** — for productivity tools, keyboard efficiency is the #1 differentiator for power users

## Decision Tree

```
User reports a usability issue — which heuristic is violated?

The user...
├── ...doesn't know if their action worked
│   └── #1 Visibility of System Status
│       → Add loading indicator, success/error feedback
│
├── ...doesn't understand a label, message, or icon
│   └── #2 Match Between System and Real World
│       → Rewrite in plain language, use conventional icons
│
├── ...can't undo, go back, or escape
│   └── #3 User Control and Freedom
│       → Add undo, back button, dismiss mechanism
│
├── ...is surprised by inconsistent behavior
│   └── #4 Consistency and Standards
│       → Audit and align to design system tokens
│
├── ...made an easily preventable mistake
│   └── #5 Error Prevention
│       → Add constraints, inline validation, confirmation
│
├── ...has to remember something from another screen
│   └── #6 Recognition Rather Than Recall
│       → Make information visible, add labels, breadcrumbs
│
├── ...finds a repetitive task slow and tedious
│   └── #7 Flexibility and Efficiency of Use
│       → Add shortcuts, bulk actions, defaults
│
├── ...feels overwhelmed by the interface
│   └── #8 Aesthetic and Minimalist Design
│       → Remove non-essential elements, use progressive disclosure
│
├── ...saw an error but doesn't know how to fix it
│   └── #9 Help Users Recognize, Diagnose, Recover from Errors
│       → Rewrite error message: what happened + how to fix
│
└── ...can't figure out how to use a feature
    └── #10 Help and Documentation
        → Add inline help, tooltips, onboarding, searchable docs
```

## Sources

- Nielsen, J. (1994). "10 Usability Heuristics for User Interface Design." Nielsen Norman Group. https://www.nngroup.com/articles/ten-usability-heuristics/
- Nielsen, J. (1994). "Severity Ratings for Usability Problems." Nielsen Norman Group. https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/
- Nielsen Norman Group (2020). "10 Usability Heuristics Applied to Complex Applications." https://www.nngroup.com/articles/usability-heuristics-complex-applications/
- Nielsen Norman Group. "Error Message Guidelines." https://www.nngroup.com/articles/error-message-guidelines/
- Nielsen, J. (1993). "Usability Engineering." Academic Press.
