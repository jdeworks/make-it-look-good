# Hick's Law

> **TL;DR:** The time to make a decision increases logarithmically with the number of choices. More options = slower decisions = more abandonment. Limit visible choices to 5–7, categorize larger sets, and highlight recommended options.

## Core Principles

1. **The formula:** `RT = a + b × log₂(n + 1)` where RT is reaction time, n is number of equally probable choices, a and b are empirically determined constants
2. **Logarithmic, not linear** — going from 2 to 4 options is a bigger jump than going from 20 to 22, but every addition still increases decision time
3. **Only applies to equally weighted choices** — if one option is clearly better/default, Hick's Law effect is reduced
4. **Familiarity reduces the effect** — expert users with learned patterns are less affected
5. **Does NOT apply to reading/searching** — Hick's Law is about choosing, not scanning. A long list with good search is fine.

## Concrete Rules

### Maximum Choices by Context
| Context | Max Items | Why |
|---------|-----------|-----|
| Primary navigation | 5–7 | Users must choose a path quickly |
| Action buttons per section | 1 primary + 2–3 secondary | Decision between actions |
| Pricing tiers | 3–4 | Purchase decision paralysis |
| Onboarding options | 3–5 | First-time decision, no familiarity |
| Context menu items | ≤10 | Quick, focused decisions |
| Tabs | 3–7 | Tab labels must all be visible |
| Filter categories visible | 5–7 | More → progressive disclosure |
| Homepage hero CTAs | 1–2 | The most critical decision on the page |

### When Hick's Law Applies vs. Doesn't
| Applies | Doesn't Apply |
|---------|---------------|
| Navigation menus | Search results (user is scanning, not choosing) |
| CTA buttons | Scrollable content feeds (no decision required) |
| Pricing plans | Settings pages (users go to specific items) |
| Feature toggles in onboarding | Data tables (reading, not deciding) |
| Dropdown selects (country, etc.) | Autocomplete suggestions (narrowed by input) |

## CSS/Implementation Patterns

### Highlight the Recommended Option
```css
/* Pricing card — reduce Hick's Law by suggesting a choice */
.pricing-card {
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  text-align: center;
}

.pricing-card.recommended {
  border: 2px solid var(--color-primary);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transform: scale(1.05);   /* Slightly larger */
  position: relative;
}

.pricing-card.recommended::before {
  content: "Most popular";
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-primary);
  color: white;
  padding: 2px 12px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}
```

### Progressive Disclosure for Large Sets
```css
/* Show top 5, reveal more on demand */
.category-list > li:nth-child(n+6) {
  display: none;
}

.category-list.expanded > li:nth-child(n+6) {
  display: list-item;
}

.show-more-btn {
  color: var(--color-primary);
  background: none;
  border: none;
  padding: 8px 0;
  cursor: pointer;
  font-size: 0.875rem;
}
```

### Reduce Navigation Choices
```css
/* Primary nav: limited top-level items */
.nav-primary {
  display: flex;
  gap: 4px;
}

/* Group secondary items under "More" */
.nav-overflow {
  position: relative;
}

.nav-overflow-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--color-surface);
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  padding: 4px;
  min-width: 200px;
}
```

## Common Mistakes

1. **Exposing all features in navigation** — "but users need to access everything!" They don't. They need to access the most common things quickly. Put the rest under "More" or in settings.
2. **Too many CTA buttons** — if you have 4 buttons of equal weight, the user won't click any. Pick one primary action.
3. **Dropdown with 200 unsorted options** — country selects without search or grouping. Add search for >15 options.
4. **Applying Hick's Law to search results** — a list of 50 search results is fine because users are scanning/filtering, not choosing blindly.
5. **No defaults** — when a reasonable default exists, pre-select it. This eliminates the choice entirely for most users.

## Decision Tree

```
How many choices am I presenting?
├─ 1–3 → Fine as-is. Ensure clear visual hierarchy.
├─ 4–7 → Acceptable. Highlight the recommended option.
├─ 8–15 → Too many for open display.
│  ├─ Can you group into 3–5 categories?
│  │  ├─ Yes → Show categories, items within each
│  │  └─ No → Use progressive disclosure (show 5, "Show more")
│  └─ Is there a searchable pattern?
│     └─ Yes → Add search/filter
├─ 15+ → Must use search, autocomplete, or multi-step narrowing
└─ Is there a sensible default?
   └─ Yes → Pre-select it. Fewer decisions = faster task completion.
```

## Sources
- Hick, W. E. (1952). On the rate of gain of information. *Quarterly Journal of Experimental Psychology, 4*(1), 11-26.
- Hyman, R. (1953). Stimulus information as a determinant of reaction time. *Journal of Experimental Psychology, 45*(3), 188-196.
- [Laws of UX — Hick's Law](https://lawsofux.com/hicks-law/)
- [Nielsen Norman Group — Hick's Law](https://www.nngroup.com/videos/hicks-law/)
