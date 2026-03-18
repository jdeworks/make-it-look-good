# Visual Hierarchy

> **TL;DR:** Visual hierarchy controls where users look and in what order. The tools, in order of strength: size, color/contrast, weight, spacing, and position. Every screen needs exactly one focal point. If everything is emphasized, nothing is.

## Core Principles

1. **Users scan before they read** — hierarchy determines the scan path
2. **One focal point per view** — the single most important element must be unmistakably dominant
3. **Three levels is usually enough** — primary (look here first), secondary (supporting info), tertiary (available if needed)
4. **Squint test** — blur your eyes; if you can still see the structure, hierarchy is working
5. **Hierarchy is relative** — an element is "big" only compared to its neighbors

## Concrete Rules

### Hierarchy Tools (Ranked by Visual Weight)
| Rank | Tool | How to Apply | Relative Impact |
|------|------|-------------|-----------------|
| 1 | **Size** | 1.5–3× larger than surrounding elements | Strongest |
| 2 | **Color/Contrast** | Saturated or high-contrast colors vs. muted surroundings | Very strong |
| 3 | **Weight** | Bold (700) vs. regular (400); filled vs. outlined | Strong |
| 4 | **Spacing** | More whitespace around important elements | Moderate |
| 5 | **Position** | Top-left (F-pattern), center (hero), or visual axis | Moderate |
| 6 | **Depth** | Shadows, elevation, overlapping layers | Moderate |
| 7 | **Typography** | Different typeface, italic, uppercase | Subtle |
| 8 | **Imagery** | Photos/illustrations draw the eye (especially faces) | Context-dependent |

### Size Ratios for Hierarchy
| Level | Relative Size | Example at 16px Base |
|-------|--------------|---------------------|
| Primary (hero/h1) | 2.5–3× body | 40–48px |
| Secondary (h2/key info) | 1.5–2× body | 24–32px |
| Body (default) | 1× | 16px |
| Tertiary (metadata) | 0.75–0.85× body | 12–14px |
| De-emphasized (captions) | 0.65–0.75× body | 10–12px |

### Color for Hierarchy
| Level | Text Color | Opacity Approach |
|-------|-----------|-----------------|
| Primary | Near-black (#1a1a1a) | 87% opacity |
| Secondary | Dark gray (#595959) | 60% opacity |
| Tertiary | Medium gray (#767676) | 38% opacity |
| Disabled | Light gray (#949494) | ~26% opacity |
| Interactive | Brand color | Full saturation |

### CTA Hierarchy (Button Priority)
| Level | Style | When to Use |
|-------|-------|-------------|
| Primary | Filled background, high contrast | 1 per section maximum |
| Secondary | Outlined, subtle fill | Supporting actions |
| Tertiary | Text-only, no background | Cancel, dismiss, less important |
| Destructive | Red, same emphasis as secondary | Delete, remove (separated spatially) |

## CSS/Implementation Patterns

### Three-Level Text Hierarchy
```css
/* Primary — commands attention */
.text-primary {
  font-size: var(--font-size-3xl);   /* ~48px */
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  line-height: 1.1;
}

/* Secondary — supporting structure */
.text-secondary {
  font-size: var(--font-size-lg);    /* ~25px */
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
}

/* Tertiary — available but quiet */
.text-tertiary {
  font-size: var(--font-size-sm);    /* ~13px */
  font-weight: 400;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
```

### Card with Internal Hierarchy
```css
.card {
  padding: var(--space-6);
}

/* Eyebrow — small, colored, uppercase */
.card-eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-primary);
  margin-bottom: var(--space-1);
}

/* Title — largest, heaviest element in the card */
.card-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

/* Description — standard weight, secondary color */
.card-description {
  font-size: 1rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: var(--space-4);
}

/* Metadata — smallest, least emphasized */
.card-meta {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}
```

### Hero Section — Clear Focal Point
```css
.hero {
  text-align: center;
  padding: var(--space-24) var(--space-6);
}

.hero-title {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 800;
  color: var(--color-text-primary);
  letter-spacing: -0.03em;
  line-height: 1.1;
  max-width: 20ch;                    /* Short lines for impact */
  margin-inline: auto;
  margin-bottom: var(--space-4);
}

.hero-subtitle {
  font-size: clamp(1.125rem, 2vw, 1.5rem);
  color: var(--color-text-secondary);
  max-width: 50ch;
  margin-inline: auto;
  margin-bottom: var(--space-8);
}

.hero-cta {
  font-size: 1.125rem;
  padding: var(--space-3) var(--space-8);
  /* This is the ONLY primary button in the hero */
}
```

### De-Emphasizing Without Hiding
```css
/* Reduce visual weight without removing content */
.de-emphasized {
  color: var(--color-text-tertiary);
  font-size: 0.875rem;
}

/* Show on hover/focus for progressive disclosure */
.reveal-on-hover {
  opacity: 0;
  transition: opacity 150ms ease;
}

.parent:hover .reveal-on-hover,
.parent:focus-within .reveal-on-hover {
  opacity: 1;
}
```

## Common Mistakes

1. **Everything is bold** — if all text is font-weight 700, nothing stands out. Use bold for 1–2 levels only.
2. **Multiple primary CTAs** — "Sign up", "Learn more", "Get started" all in the same prominent style. Pick ONE primary action per view.
3. **Colorful everything** — when every element uses bright saturated colors, the eye has no resting place and no hierarchy.
4. **Heading sizes too similar** — if h2 is 24px and h3 is 22px, users can't tell the difference. Maintain at least 1.2× ratio between levels.
5. **Important info buried below the fold** — position in the visual hierarchy also means position on the page. Don't hide the key message.
6. **Metadata with same weight as content** — timestamps, author names, and tags should be visually quiet (small, gray, light weight).
7. **Centering everything** — centered text reduces scannability. Reserve centering for short hero text and headings. Left-align body content.

## Decision Tree

```
How do I establish hierarchy on this page?
├─ Step 1: What's the ONE most important thing?
│  └─ Make it 2–3× larger than everything else
├─ Step 2: What supports the main thing?
│  └─ Make it 1.5× body size, slightly less weight
├─ Step 3: What's "nice to have" information?
│  └─ Use body size or smaller, secondary color
├─ Step 4: Do the squint test
│  ├─ Can you see the structure blurred? → Good
│  └─ Everything blurs into sameness → Increase contrast between levels
├─ Step 5: Count the primary CTAs
│  ├─ 0 → Add one (what should the user do?)
│  ├─ 1 → Perfect
│  └─ 2+ → Demote extras to secondary/tertiary
└─ Step 6: Check on mobile
   └─ Does hierarchy survive on a 375px screen? Sizes may need adjustment.
```

## Sources
- [Nielsen Norman Group — Visual Hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)
- [Refactoring UI — Hierarchy](https://www.refactoringui.com/) — practical hierarchy techniques
- [Material Design 3 — Typography Hierarchy](https://m3.material.io/styles/typography/overview)
- [Laws of UX — Von Restorff Effect](https://lawsofux.com/von-restorff-effect/) — the isolation effect
