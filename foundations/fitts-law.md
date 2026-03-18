# Fitts's Law

> **TL;DR:** The time to reach a target is a function of the distance to it and its size. Larger targets closer to the cursor/finger are faster to hit. Make important interactive elements big and place them where users already are.

## Core Principles

1. **The formula:** `MT = a + b × log₂(2D/W)` where MT is movement time, D is distance to target center, W is target width along the axis of motion
2. **Size matters more than you think** — doubling target size has a bigger effect than halving distance
3. **Edges and corners are infinite targets** — on desktop, screen edges effectively have infinite width (cursor can't overshoot). This is why menus at screen edges are fast.
4. **The current cursor position is distance zero** — right-click context menus and inline editing are fast because D ≈ 0
5. **Applies to both mouse and touch** — but touch has additional considerations (finger occlusion, fat finger problem)

## Concrete Rules

### Minimum Target Sizes
| Context | Minimum Size | Standard |
|---------|-------------|----------|
| Touch target (mobile) | 44×44px (CSS pixels) | WCAG 2.2 Success Criterion 2.5.8 |
| Touch target (Material Design) | 48×48dp | Material Design 3 |
| Touch target (Apple HIG) | 44×44pt | Apple Human Interface Guidelines |
| Touch spacing between targets | 8px minimum | WCAG 2.2 |
| Desktop click target | 24×24px minimum | WCAG 2.2 |
| Desktop comfortable click | 32×32px | UX best practice |
| Text link minimum hit area | 44×22px (padded) | Accessibility best practice |

### Strategic Placement
| Principle | Application |
|-----------|-------------|
| Primary actions at natural resting positions | Bottom of screen (mobile), top-right or bottom-right (desktop) |
| Destructive actions away from common targets | Don't put "Delete" next to "Save" |
| Related actions grouped together | Reduces D between sequential actions |
| Confirm/cancel in predictable positions | "OK/Save" on the right, "Cancel" on the left (platform dependent) |
| Infinite edge targets (desktop) | Sticky headers, edge-anchored toolbars |
| Contextual actions near trigger | Edit button next to the item being edited |

### Size vs. Importance
| Element | Recommended Size | Reason |
|---------|-----------------|--------|
| Primary CTA button | Height: 40–48px, Min width: 120px | Most important action, needs to be easy to hit |
| Secondary button | Height: 36–40px | Less important, but still easily clickable |
| Icon button | 40×40px (with 24px icon) | Touch-friendly with visual breathing room |
| Navigation link | Full height of nav bar (padding included) | Makes the entire row clickable |
| Form input | Height: 40–48px | Comfortable tap/click target |
| Small actions (close, dismiss) | ≥24×24px visible, ≥44×44px hit area | Visually small, but tappable area is larger |

## CSS/Implementation Patterns

### Expanding Hit Areas
```css
/* Visually small element with large touch target */
.icon-button {
  position: relative;
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
}

/* Expand the clickable area without changing visual size */
.icon-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  /* Invisible but clickable */
}
```

### Full-Width Clickable Rows
```css
/* Make the entire row clickable, not just the text */
.list-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;      /* Padding makes the hit area large */
  min-height: 48px;         /* Touch-friendly height */
  cursor: pointer;
  transition: background-color 150ms ease;
}

.list-item:hover {
  background-color: var(--color-surface-hover);
}

/* The link fills the entire row */
.list-item a {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  text-decoration: none;
  color: inherit;
}
```

### Comfortable Button Sizing
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;        /* WCAG touch target */
  padding: 8px 20px;       /* Generous horizontal padding */
  min-width: 80px;         /* Prevents tiny buttons */
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

/* Primary gets more visual weight */
.btn-primary {
  min-height: 48px;
  padding: 10px 24px;
  min-width: 120px;
  font-size: 1rem;
}
```

### Safe Destructive Action Placement
```css
/* Separate destructive actions from primary actions */
.action-bar {
  display: flex;
  justify-content: space-between; /* Push apart */
  align-items: center;
}

.action-bar-primary {
  display: flex;
  gap: 8px;
  margin-left: auto;       /* Primary actions on the right */
}

.action-bar-destructive {
  margin-right: auto;      /* Destructive actions on the left, far away */
}
```

## Common Mistakes

1. **Tiny close buttons** — the × on modals/toasts is often 12×12px. The visual element can be small, but the hit area must be ≥44×44px.
2. **Delete next to Edit** — placing destructive actions adjacent to common actions. Separate them spatially.
3. **Icon-only buttons without padding** — a 16px icon with no surrounding padding is a 16px target. Add padding or use `::before` to expand the hit area.
4. **Text links in body copy** — inline links are inherently small targets. For important actions, use buttons instead.
5. **Floating action buttons too close to edge** — on mobile, FABs placed at the very edge of the screen are partially occluded by thumb. Offset by 16px.
6. **Relying on hover areas** — hover targets that appear on mouseover add distance. Show actions inline or on tap for mobile.

## Decision Tree

```
Is this element interactive?
├─ Yes
│  ├─ Is it a primary action?
│  │  ├─ Yes → Make it large (≥48px height), place at natural resting position
│  │  └─ No → Minimum 44×44px touch target
│  ├─ Is it visually small (icon, close button)?
│  │  └─ Expand hit area with padding or pseudo-element to 44×44px
│  ├─ Is it destructive?
│  │  └─ Place it physically away from common actions
│  └─ Will users click it repeatedly?
│     └─ Keep it near the result of the action (reduces D for next click)
└─ No → No sizing requirements, but don't make it look clickable
```

## Sources
- Fitts, P. M. (1954). The information capacity of the human motor system in controlling the amplitude of movement. *Journal of Experimental Psychology, 47*(6), 381-391.
- [WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [Laws of UX — Fitts's Law](https://lawsofux.com/fittss-law/)
- [Material Design 3 — Touch Targets](https://m3.material.io/foundations/accessible-design/accessibility-basics)
- [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
