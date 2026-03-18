# Readability

> **TL;DR:** Optimal line length is 45–75 characters (66 ideal). Line height for body text: 1.4–1.6 (1.5 recommended). Body font size: 16px minimum. These three settings alone fix most readability problems.

## Core Principles

1. **Line length (measure) is the #1 readability factor** — too long and the eye loses its place; too short and reading becomes choppy
2. **Line height must increase with line length** — longer lines need more vertical space between them so the eye can track back
3. **Contrast and font choice affect perceived readability** — a well-set mediocre font reads better than a poorly-set excellent font
4. **Users scan, they don't read** — 79% of users scan; only 16% read word-by-word (Nielsen). F-pattern for text-heavy pages, Z-pattern for minimal pages. Design for scanning first.
5. **Screen reading is ~25% slower than print** — compensate with larger sizes, more spacing, and shorter blocks
6. **Concise writing improves usability dramatically** — cutting word count to 50% improves usability by 58%. Adding scannable formatting (headings, bullets, highlights) adds another 47%. Combined: 124% improvement.

## Concrete Rules

### The Big Three
| Property | Minimum | Optimal | Maximum |
|----------|---------|---------|---------|
| Line length | 45 characters | **66 characters** | 75 characters |
| Line height (body) | 1.4 | **1.5** | 1.6 |
| Body font size | 16px (1rem) | **16–18px** | 21px |

### Line Length in CSS Units
| Characters | Approximate Width |
|-----------|-------------------|
| 45 ch | ~45ch / ~540px at 16px |
| 66 ch | ~66ch / ~660px at 16px |
| 75 ch | ~75ch / ~780px at 16px |

### Line Height by Font Size
| Font Size | Recommended Line Height | Rationale |
|-----------|------------------------|-----------|
| 12–14px | 1.6–1.75 | Small text needs more spacing |
| 16px (body) | 1.5 | Standard body text |
| 18–20px | 1.4–1.5 | Slightly tighter |
| 24–32px (subheading) | 1.2–1.3 | Headings need less |
| 36px+ (heading/display) | 1.1–1.2 | Very tight for large text |

### Paragraph Spacing
| Property | Value | Notes |
|----------|-------|-------|
| Between paragraphs | 0.75em–1em (margin-bottom) | Never use double line breaks |
| Between sections | 1.5em–2em | Clear visual break |
| Between heading and content | 0.5em–0.75em | Heading belongs to its content (proximity) |
| Between content and next heading | 1.5em–2em | Separate from previous section |

### Text Alignment
| Content Type | Alignment | Why |
|-------------|-----------|-----|
| Body text (LTR) | Left-aligned | Ragged right edge creates anchor points for eye tracking |
| Body text (RTL) | Right-aligned | Same principle, mirrored |
| Headings | Left-aligned (or centered for hero) | Consistency with body |
| Short text (cards, buttons) | Center-aligned | Looks balanced in small containers |
| Numbers in tables | Right-aligned | Decimal points line up |
| Long-form content | **Never justified** on web | Inconsistent word spacing without hyphenation |

## CSS/Implementation Patterns

### Optimal Reading Container
```css
.prose {
  max-width: 65ch;                    /* ~66 characters */
  font-size: clamp(1rem, 0.95rem + 0.25vw, 1.125rem); /* 16–18px */
  line-height: 1.5;
  color: var(--color-text-primary);   /* High contrast */
}

.prose p {
  margin-bottom: 1em;                 /* Paragraph spacing */
}

.prose h2 {
  margin-top: 2em;                    /* Space before heading */
  margin-bottom: 0.5em;              /* Heading close to its content */
}

.prose h3 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}
```

### Responsive Reading
```css
/* Full-width on mobile, constrained on desktop */
.article-body {
  width: 100%;
  max-width: 65ch;
  margin-inline: auto;               /* Center the column */
  padding-inline: 1rem;              /* Mobile edge padding */
}

/* Wide elements (images, tables) can break out */
.article-body .wide {
  max-width: 100vw;
  margin-inline: calc(50% - 50vw);
  padding-inline: 1rem;
}
```

### Vertical Rhythm
```css
/* Consistent vertical spacing using a base unit */
:root {
  --rhythm: 1.5rem;                  /* Matches line-height × font-size */
}

.prose > * {
  margin-block: 0;
}

.prose > * + * {
  margin-top: var(--rhythm);         /* Equal spacing between blocks */
}

.prose > h2 + *,
.prose > h3 + * {
  margin-top: calc(var(--rhythm) * 0.5); /* Less space heading → content */
}

.prose > * + h2 {
  margin-top: calc(var(--rhythm) * 2);   /* More space before headings */
}
```

### Text Truncation
```css
/* Single-line truncation */
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Multi-line truncation (2 lines) */
.text-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

## Common Mistakes

1. **Lines too long** — full-width paragraphs on a 1440px screen are ~200 characters. Nobody reads those. Use `max-width: 65ch`.
2. **Lines too short** — narrow sidebars with text at 20 characters create a constant staircase effect. Minimum 30ch for readable text.
3. **Justified text on web** — CSS doesn't have good hyphenation. Justified text creates "rivers" of white space. Use `text-align: left`.
4. **Insufficient paragraph spacing** — paragraphs need visible separation. `margin-bottom: 1em` at minimum.
5. **Heading orphaned from its content** — if there's more space below a heading than above it, the heading appears to belong to the previous section. Keep heading close to its content.
6. **Light gray body text** — "sophisticated" light gray (#aaa) on white is a 2:1 contrast ratio. Body text should be near-black (#333 or darker) for readability.
7. **All caps for long text** — uppercase reduces reading speed by 13–20% (Tinker 1963). Reserve for short labels and buttons only.
8. **Tiny line-height on mobile** — mobile screens are narrow, so lines are shorter, but people still need comfortable line-height. Don't drop below 1.4.

## Decision Tree

```
Is the text hard to read?
├─ Lines feel too long
│  └─ Add max-width: 65ch (or 600–700px)
├─ Losing track between lines
│  ├─ Increase line-height (try 1.5–1.6)
│  └─ If line-height is already 1.5, line length may be too long
├─ Text feels cramped
│  ├─ Increase font size (16px → 18px)
│  ├─ Increase paragraph spacing
│  └─ Increase line-height
├─ Text feels disconnected/floaty
│  ├─ Decrease line-height (try 1.4)
│  └─ Decrease spacing between elements
├─ Hard to tell sections apart
│  └─ Increase spacing before headings (2em+)
│     and decrease spacing after headings (0.5em)
└─ Text looks fine in Figma but bad in browser
   ├─ Check actual font rendering (system fonts vs loaded)
   ├─ Check contrast ratio with a tool
   └─ Browser default is 16px — is your design using 14px body?
```

## Sources
- Bringhurst, R. (2004). *The Elements of Typographic Style*. — 45–75 character line length
- [Butterick's Practical Typography](https://practicaltypography.com/line-length.html) — line length
- [WCAG 2.2 — Success Criterion 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation) — line length, line spacing
- Tinker, M. A. (1963). *Legibility of Print*. — uppercase readability research
- [Nielsen Norman Group — How Users Read on the Web](https://www.nngroup.com/articles/how-users-read-on-the-web/)
