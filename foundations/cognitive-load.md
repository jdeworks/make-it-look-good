# Cognitive Load

> **TL;DR:** Every interface element consumes mental processing power. There are 3 types of cognitive load — intrinsic (task complexity), extraneous (bad design), and germane (learning). Minimize extraneous load ruthlessly. Users can hold 4±1 chunks in working memory.

## Core Principles

1. **Working memory is limited** — humans can hold ~4 items (Cowan 2001), not 7±2 (Miller's original finding was about discrimination, not memory capacity)
2. **Three types of load:**
   - **Intrinsic** — inherent task complexity (can't reduce without simplifying the task)
   - **Extraneous** — caused by poor design (eliminate this)
   - **Germane** — effort spent learning/understanding (support this)
3. **Total cognitive load is additive** — intrinsic + extraneous + germane must stay within capacity
4. **Recognition beats recall** — showing options is cheaper than requiring users to remember them
5. **Progressive disclosure** — show only what's needed now; reveal complexity on demand

## Concrete Rules

### Information Limits
| Context | Maximum | Rationale |
|---------|---------|-----------|
| Navigation items (top-level) | 5–7 | Hick's Law + working memory |
| Form fields visible at once | 5–7 | Chunk limit |
| Steps in a wizard | 3–5 visible | Progress tracking limit |
| Options in a dropdown | ≤15 before adding search | Scanning speed |
| Actions in a toolbar | ≤7 primary | Decision paralysis |
| Nested menu levels | ≤2 | Spatial memory limit |
| Dashboard widgets | ≤7 | Attention splitting |

### Visual Complexity Reduction
| Technique | Reduction Effect |
|-----------|-----------------|
| Group related items (Gestalt proximity) | ~20% faster scanning |
| Use whitespace between sections | ~20% better comprehension (Lin 2004) |
| Consistent layout patterns | Reduces extraneous load via learned patterns |
| Progressive disclosure | Only load relevant cognitive demand |
| Sensible defaults | Eliminate decisions for common paths |
| Inline validation (not batch) | Reduce error-recovery memory load |

## CSS/Implementation Patterns

### Progressive Disclosure
```css
/* Hide secondary content behind expandable sections */
details.advanced-options {
  margin-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
}

details.advanced-options summary {
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}
```

### Chunking with Visual Groups
```css
/* Group related form fields */
.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);        /* 12px — tight within group */
  margin-bottom: var(--space-6); /* 24px — loose between groups */
}

.field-group-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

### Reducing Choice Overload
```css
/* Primary + secondary action pattern */
.action-bar {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

/* Visually emphasize the primary path */
.btn-primary {
  background: var(--color-primary);
  color: white;
  font-weight: 600;
}

/* De-emphasize secondary actions */
.btn-secondary {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
```

## Common Mistakes

1. **Showing everything at once** — "but users need access to all features!" No. They need access to the right features at the right time.
2. **Too many choices with equal visual weight** — when everything is bold, nothing is. Use visual hierarchy to guide attention.
3. **Requiring memorization across pages** — if a user selected something on page 1, show that selection on page 3. Don't force them to remember.
4. **Inconsistent patterns** — every time you break a pattern, you add extraneous load. Same action should look the same everywhere.
5. **Clever over clear** — creative icons without labels, unusual navigation patterns, novel interaction models. Familiar is almost always better.
6. **Information-dense dashboards without hierarchy** — raw data dumps. Users need to know where to look first.

## Decision Tree

```
Is the user confused or making errors?
├─ Yes → Which type of cognitive load is too high?
│  ├─ Intrinsic (task is complex)
│  │  ├─ Break into steps (wizard pattern)
│  │  ├─ Provide sensible defaults
│  │  └─ Show examples, not just instructions
│  ├─ Extraneous (design is adding load)
│  │  ├─ Remove unnecessary elements
│  │  ├─ Group related items visually
│  │  ├─ Add whitespace between sections
│  │  └─ Make patterns consistent
│  └─ Germane (learning curve)
│     ├─ Add onboarding tooltips (dismissible)
│     ├─ Use progressive disclosure
│     └─ Provide inline help text
└─ No → Don't add complexity "just in case"
```

## Sources
- Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science, 12*(2), 257-285.
- Cowan, N. (2001). The magical number 4 in short-term memory. *Behavioral and Brain Sciences, 24*(1), 87-114.
- Miller, G. A. (1956). The magical number seven, plus or minus two. *Psychological Review, 63*(2), 81-97.
- [Nielsen Norman Group — Minimize Cognitive Load](https://www.nngroup.com/articles/minimize-cognitive-load/)
- Lin, D. Y. M. (2004). Evaluating older adults' retention in hypertext perusal. *Computers in Human Behavior, 20*(4), 491-503.
