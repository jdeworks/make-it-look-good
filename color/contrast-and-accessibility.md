# Contrast & Accessibility

> **TL;DR:** WCAG 2.2 requires 4.5:1 contrast for normal text, 3:1 for large text (≥18pt/24px or ≥14pt/18.5px bold), and 3:1 for UI components. These are minimums — aim for 7:1 when possible. Test with real tools, not eyeballing.

## Core Principles

1. **Contrast ratio** is the relative luminance difference between foreground and background, expressed as `lighter:darker` (e.g., 4.5:1)
2. **WCAG defines three conformance levels** — A (minimum), AA (standard target), AAA (enhanced). Most projects target AA.
3. **Large text has lower requirements** because it's inherently more legible
4. **Non-text elements need contrast too** — borders, icons, focus indicators, form controls
5. **Contrast is relative** — the same color can pass or fail depending on its background

## Concrete Rules

### WCAG 2.2 Contrast Requirements
| Element | Level AA | Level AAA |
|---------|----------|-----------|
| Normal text (<18pt / <24px) | **4.5:1** | **7:1** |
| Large text (≥18pt / ≥24px) | **3:1** | **4.5:1** |
| Bold large text (≥14pt / ≥18.5px bold) | **3:1** | **4.5:1** |
| UI components (borders, icons, controls) | **3:1** | — |
| Focus indicators | **3:1** | — |
| Graphical objects (charts, infographics) | **3:1** | — |
| Decorative/inactive elements | No requirement | — |
| Logos/brand text | No requirement | — |

### "Large Text" Thresholds
| Definition | Size |
|-----------|------|
| Large text (regular weight) | ≥18pt = ≥24px = ≥1.5rem |
| Large text (bold, ≥700 weight) | ≥14pt = ≥18.5px = ≥1.17rem |

### Common Color Combinations — Pass/Fail
| Foreground | Background | Ratio | AA Normal | AA Large |
|-----------|------------|-------|-----------|----------|
| #000000 (black) | #FFFFFF (white) | 21:1 | PASS | PASS |
| #333333 | #FFFFFF | 12.6:1 | PASS | PASS |
| #595959 | #FFFFFF | 7:1 | PASS | PASS |
| #767676 | #FFFFFF | 4.5:1 | PASS | PASS |
| #949494 | #FFFFFF | 3:1 | FAIL | PASS |
| #FFFFFF | #0066CC | 5.1:1 | PASS | PASS |
| #FFFFFF | #2196F3 | 3.1:1 | FAIL | PASS |
| #FFFFFF | #FF5722 | 3.1:1 | FAIL | PASS |

### Practical Minimums for Common Scenarios
| Scenario | Minimum Foreground on White | Hex |
|----------|---------------------------|-----|
| Body text | 4.5:1 | #767676 or darker |
| Placeholder text | 4.5:1 (not 3:1!) | #767676 or darker |
| Secondary text | 4.5:1 | #767676 or darker |
| Disabled text (AA exception) | No requirement | #949494 acceptable |
| Link text | 4.5:1 + 3:1 against surrounding text | Depends on body color |
| Icon (meaningful) | 3:1 | #949494 or darker |

## CSS/Implementation Patterns

### Custom Properties for Accessible Colors
```css
:root {
  /* Text colors — all pass 4.5:1 on white */
  --color-text-primary: #1a1a1a;    /* 16.8:1 */
  --color-text-secondary: #595959;  /* 7:1 */
  --color-text-tertiary: #767676;   /* 4.54:1 — barely passes */
  --color-text-disabled: #949494;   /* 3:1 — WCAG allows for disabled */
  --color-text-inverse: #ffffff;

  /* Interactive colors — pass 3:1 for UI components */
  --color-primary: #0055cc;         /* 7.9:1 on white */
  --color-primary-hover: #003d99;   /* 10.7:1 on white */
  --color-error: #cc0000;           /* 5.9:1 on white */
  --color-success: #007a33;         /* 5.0:1 on white */

  /* Borders — pass 3:1 for UI components */
  --color-border: #767676;          /* 4.54:1 on white */
  --color-border-subtle: #949494;   /* 3:1 on white — minimum */

  /* Backgrounds */
  --color-bg: #ffffff;
  --color-bg-subtle: #f5f5f5;
  --color-bg-hover: #ebebeb;
}
```

### Focus Indicators
```css
/* Focus indicator must have 3:1 contrast against adjacent colors */
:focus-visible {
  outline: 2px solid var(--color-primary);  /* 3:1+ against white bg */
  outline-offset: 2px;                      /* Gap prevents blending */
}

/* Dark backgrounds need different focus color */
.dark-bg :focus-visible {
  outline-color: #ffffff;
}

/* Never use outline: none without a visible alternative */
/* ❌ :focus { outline: none; } */
```

### Link Contrast
```css
/* Links must be distinguishable from surrounding text */
/* Option 1: Color alone (must be 3:1 against body text AND 4.5:1 against bg) */
a {
  color: #0055cc;         /* 4.5:1 against body, 3:1 against #333 text */
  text-decoration: none;
}

/* Option 2 (safer): Underline — no contrast requirement against body text */
a {
  color: #0055cc;
  text-decoration: underline;  /* Underline removes the 3:1 body text req */
}

a:hover {
  text-decoration: none;  /* Can remove on hover since pointer indicates link */
}
```

### Dark Mode
```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: #f0f0f0;    /* 15.3:1 on #1a1a1a */
    --color-text-secondary: #a0a0a0;  /* 7.4:1 on #1a1a1a */
    --color-text-tertiary: #808080;   /* 4.6:1 on #1a1a1a */
    --color-bg: #1a1a1a;
    --color-bg-subtle: #2a2a2a;
    --color-primary: #6699ff;         /* 5.3:1 on #1a1a1a */
    --color-border: #404040;          /* 3:1 on #1a1a1a */
  }
}
```

## Common Mistakes

1. **Light gray placeholder text** — `#c0c0c0` on white is 1.6:1. Placeholder text must meet 4.5:1 unless paired with a visible label (WCAG 1.4.5 exception is narrow).
2. **Colored buttons with white text that fail** — many "brand blue" and "brand red" colors don't achieve 4.5:1 with white text. Test every combination.
3. **Assuming dark mode is just inverted** — pure white (#fff) on pure black (#000) is 21:1, which causes halation (text glows). Use off-white (#f0f0f0) on dark gray (#1a1a1a).
4. **Checking contrast only in Figma** — test in the browser at actual font sizes. Anti-aliasing affects perceived contrast.
5. **Ignoring focus indicators** — removing `outline` for aesthetics without providing a visible alternative fails WCAG 2.4.7.
6. **Semi-transparent overlays** — `rgba(0,0,0,0.5)` overlay contrast depends on what's behind it. Test worst-case backgrounds.
7. **Gradient backgrounds** — text on gradients must pass contrast at every point, not just the average.

## Decision Tree

```
What type of element needs contrast checking?
├─ Text
│  ├─ Is it ≥24px (or ≥18.5px bold)?
│  │  ├─ Yes → 3:1 minimum (AA), 4.5:1 for AAA
│  │  └─ No → 4.5:1 minimum (AA), 7:1 for AAA
│  ├─ Is it disabled?
│  │  └─ No contrast requirement, but must be perceivable as disabled
│  └─ Is it a link?
│     ├─ Has underline → 4.5:1 against background only
│     └─ No underline → 4.5:1 against background AND 3:1 against surrounding text
├─ UI Component (border, icon, control)
│  └─ 3:1 against adjacent colors
├─ Focus indicator
│  └─ 3:1 against the background AND the focused element
├─ Graphical object (chart, icon conveying meaning)
│  └─ 3:1 against adjacent colors
└─ Decorative / inactive / logo
   └─ No requirement
```

## APCA — Advanced Perceptual Contrast Algorithm

WCAG 2.x contrast ratios are a useful baseline, but APCA (Accessible Perceptual Contrast Algorithm) provides a more perceptually accurate model. Key differences:

| Aspect | WCAG 2.x Ratio | APCA (Lc value) |
|--------|----------------|-----------------|
| Polarity | Symmetric (same ratio either way) | Asymmetric (dark-on-light ≠ light-on-dark) |
| Scale | 1:1 to 21:1 | Lc 0 to ~±108 |
| Font size/weight | Large text = one lower threshold | Continuous lookup table by size × weight |
| Perception | Luminance-only | Better models human contrast sensitivity |

**Practical use:** APCA is not yet a WCAG requirement (under development for WCAG 3.0/Silver). Use WCAG 2.x ratios as the compliance standard and APCA as a supplementary perceptual check. The [Design Analyzer](../docs/analyzer.html) reports both.

- Lc 60+ → readable body text (equivalent to ~4.5:1 WCAG for typical sizes)
- Lc 45+ → readable large/bold text
- Lc 30+ → non-text UI elements

## Testing Tools
- **Chrome DevTools** — Inspect element → color picker shows contrast ratio
- **axe DevTools** — Browser extension, automated WCAG testing
- **Lighthouse** — Built into Chrome, checks contrast in accessibility audit
- **WebAIM Contrast Checker** — https://webaim.org/resources/contrastchecker/
- **Colour Contrast Analyser** — Desktop app (TPGi), tests against WCAG 2.2
- **[Design Analyzer](../docs/analyzer.html)** — Reports WCAG ratio + APCA Lc value, gradient/filter-aware, 8 audience profiles

## Sources
- [WCAG 2.2 — Success Criterion 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
- [WCAG 2.2 — Success Criterion 1.4.6 Contrast (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced)
- [WCAG 2.2 — Success Criterion 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- [WebAIM — Contrast and Color Accessibility](https://webaim.org/articles/contrast/)
- [APCA — Accessible Perceptual Contrast Algorithm](https://github.com/Myndex/SAPC-APCA)
- [APCA Readability Criterion](https://readtech.org/ARC/)
