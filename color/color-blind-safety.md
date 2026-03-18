# Color-Blind Safety

> **TL;DR:** ~8% of men and ~0.5% of women have color vision deficiency. Never use color alone to convey meaning. Always pair color with text, icons, or patterns. Blue+orange is the safest universal color combination.

## Core Principles

1. **Color vision deficiency (CVD) is common** — roughly 1 in 12 men are affected; designing for it is not edge-case work
2. **Never rely on color alone** to convey information (WCAG 1.4.1 — Use of Color)
3. **Redundant coding** — every color-coded element needs a second visual channel: icon, text label, pattern, or shape
4. **Test with simulation tools** — you cannot eyeball CVD safety; use browser-based simulators
5. **The problem is distinguishability, not visibility** — people with CVD can see colors, they just confuse certain pairs

## Types of Color Vision Deficiency

| Type | Affects | Prevalence (men) | Colors Confused |
|------|---------|-------------------|-----------------|
| **Deuteranopia** (no green cones) | Green perception | ~5% | Red ↔ Green, Brown ↔ Orange |
| **Protanopia** (no red cones) | Red perception | ~2.5% | Red ↔ Green, Red appears darker |
| **Tritanopia** (no blue cones) | Blue perception | ~0.01% | Blue ↔ Yellow, Purple ↔ Red |
| **Achromatopsia** (no cones) | All color | ~0.003% | All — sees luminance only |

> Deuteranopia + Protanopia = **red-green CVD**, accounting for ~95% of all cases. Design for these first.

## Concrete Rules

### Safe Color Combinations (Distinguishable by All Types)
| Pair | Why It Works |
|------|-------------|
| **Blue + Orange** | Safe across all CVD types — the universal safe pair |
| **Blue + Red** | Distinguishable even in deuteranopia/protanopia |
| **Blue + Brown** | High luminance contrast, different hue channels |
| **Dark blue + Yellow** | Maximum luminance difference |
| **Purple + Yellow/Orange** | Works across red-green and blue-yellow CVD |

### Dangerous Color Combinations (Avoid Without Redundancy)
| Pair | Why It Fails |
|------|-------------|
| **Red + Green** | Indistinguishable for ~7.5% of men |
| **Green + Brown** | Confused in deuteranopia |
| **Green + Orange** | Confused in protanopia |
| **Blue + Purple** | Confused in tritanopia |
| **Light green + Yellow** | Low luminance contrast, confused in most CVD types |
| **Red + Brown** | Nearly identical in protanopia |

### Practical Thresholds
- **Charts/graphs**: minimum 3 distinguishable data series without color (use patterns, shapes, labels)
- **Status indicators**: always pair with icon or text — never a colored dot alone
- **Form validation**: red error borders must include an icon (e.g., !) or inline text
- **Traffic light patterns** (red/yellow/green): add icons or positional cues

## CSS/Implementation Patterns

### Status Indicators with Redundant Coding
```css
/* Always pair color with icon/text — never color-only dots */
.status {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 500;
}

.status::before {
  font-size: 1em;
}

.status--success {
  color: #007a33;
}
.status--success::before {
  content: "\2713";  /* ✓ checkmark */
}

.status--error {
  color: #cc0000;
}
.status--error::before {
  content: "\2717";  /* ✗ cross */
}

.status--warning {
  color: #b45309;
}
.status--warning::before {
  content: "\26A0";  /* ⚠ warning triangle */
}
```

### Chart-Safe Palette (8 Distinguishable Colors)
```css
:root {
  /* Okabe-Ito palette — designed for CVD safety */
  --chart-1: #0072b2;  /* Blue */
  --chart-2: #e69f00;  /* Orange */
  --chart-3: #009e73;  /* Bluish green */
  --chart-4: #cc79a7;  /* Reddish purple */
  --chart-5: #56b4e9;  /* Sky blue */
  --chart-6: #d55e00;  /* Vermillion */
  --chart-7: #f0e442;  /* Yellow */
  --chart-8: #000000;  /* Black */
}
```

### Form Validation with Icon Redundancy
```css
.input--error {
  border-color: #cc0000;
  border-width: 2px;
  /* Add icon inside the input via background */
  background-image: url("data:image/svg+xml,..."); /* Error icon SVG */
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}

.input--success {
  border-color: #007a33;
  background-image: url("data:image/svg+xml,..."); /* Check icon SVG */
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}

/* Error message text — don't rely on red alone */
.error-message {
  color: #cc0000;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.error-message::before {
  content: "\26A0";  /* ⚠ */
}
```

### Link Distinction Without Color Alone
```css
/* Links inside body text should have underlines, not just color */
.prose a {
  color: #0055cc;
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
```

## Common Mistakes

1. **Red/green status indicators with no icon or label** — the most common CVD failure. A green dot vs. a red dot is meaningless to 8% of men.
2. **Heat maps and charts using red-to-green gradients** — use blue-to-orange or blue-to-yellow instead.
3. **"Click the green button"** — instructions that reference color. Always provide a second identifier: "Click the green Submit button."
4. **Assuming colorblind = sees no color** — most people with CVD see a full range, they just confuse specific pairs.
5. **Testing only for protanopia** — deuteranopia is twice as common. Test for both red-green types plus tritanopia.
6. **Using thin colored lines in charts** — thin lines are harder to distinguish. Use ≥2px stroke width and add dashes/dots for line charts.
7. **Relying on colored badges without text** — a red "3" notification badge needs the number; don't use a color-only dot.

## Decision Tree

```
Does this element use color to convey information?
├─ No → No CVD concern
└─ Yes
   ├─ Is there a redundant indicator (icon, text, pattern, position)?
   │  ├─ Yes → Safe (but still verify color pairs are distinguishable)
   │  └─ No → ADD one. This is a WCAG 1.4.1 failure.
   ├─ Does it use red+green to distinguish states?
   │  ├─ Yes → Replace with blue+orange, or add icons/text
   │  └─ No → Check against the dangerous pairs list above
   └─ Is it a chart or data visualization?
      ├─ Use Okabe-Ito palette or similar CVD-safe palette
      ├─ Add patterns/shapes/labels as redundant channels
      └─ Test with Chrome DevTools simulation (all 3 types)
```

## Testing Tools

- **Chrome DevTools** — Rendering tab → "Emulate vision deficiencies" → simulates protanopia, deuteranopia, tritanopia, achromatopsia
- **Firefox** — Accessibility Inspector → "Simulate" dropdown
- **Sim Daltonism** (macOS) — Real-time color blindness simulator overlay
- **Color Oracle** (Windows/macOS/Linux) — System-wide CVD simulator
- **Coblis** — https://www.color-blindness.com/coblis-color-blindness-simulator/ — upload screenshots

## Sources
- [WCAG 2.2 — Success Criterion 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- [Okabe & Ito (2008) — Color Universal Design](https://jfly.uni-koeln.de/color/)
- [Colour Blind Awareness — Types of Colour Blindness](https://www.colourblindawareness.org/colour-blindness/types-of-colour-blindness/)
- [WebAIM — Visual Disabilities: Color-Blindness](https://webaim.org/articles/visual/colorblind)
