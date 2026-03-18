# Font Pairing

> **TL;DR:** Limit to 2 typefaces maximum. Pair by contrast (serif headings + sans-serif body) or use a superfamily. System font stacks are fast and free — use them unless brand requires a custom typeface. Load Google Fonts with `display=swap` and preconnect.

## Core Principles

1. **Two typefaces is the maximum for most projects** — one for headings, one for body. A third adds complexity without proportional benefit.
2. **Pair by contrast, not similarity** — serif + sans-serif creates clear visual hierarchy. Two similar sans-serifs creates confusion.
3. **Match x-height between typefaces** — fonts with similar x-heights look harmonious together even when families differ.
4. **Superfamilies are the safest pairing** — families designed together (e.g., Roboto + Roboto Slab) always harmonize.
5. **System fonts are a legitimate choice** — they load instantly, feel native, and cover 90% of use cases.

## Concrete Rules

### Pairing Strategies (Ranked by Safety)
| Strategy | Risk | Example | When to Use |
|----------|------|---------|-------------|
| Single typeface, vary weight | None | Inter 700 headings + Inter 400 body | Apps, dashboards, SaaS |
| Superfamily | Very low | Roboto + Roboto Slab | Content sites wanting subtle contrast |
| Contrast pairing | Low | Playfair Display + Source Sans 3 | Editorial, marketing, portfolios |
| System font stack | None | `system-ui` + native serif | Performance-critical, MVPs |

### Proven Pairings
| Heading | Body | Vibe |
|---------|------|------|
| Playfair Display (serif) | Source Sans 3 (sans) | Elegant editorial |
| Lora (serif) | Inter (sans) | Warm, readable |
| Fraunces (serif) | Work Sans (sans) | Modern editorial |
| Space Grotesk (sans) | Inter (sans) | Tech, geometric |
| DM Serif Display (serif) | DM Sans (sans) | Contemporary, clean |
| Bitter (slab) | Source Sans 3 (sans) | Approachable, sturdy |

### Variable Fonts
- **Prefer variable fonts** — one file replaces multiple weights (400, 500, 600, 700) at smaller total size
- **Inter, Source Sans 3, Roboto Flex** all offer variable versions
- Variable fonts support intermediate weights (e.g., 450, 550) for fine-tuned hierarchy
- Typical savings: 4 separate weight files (~100KB) vs 1 variable file (~30–50KB)

### Google Fonts Loading
- **Always use `display=swap`** — prevents invisible text during load (FOIT)
- **Preconnect to Google's font CDN** — saves ~100ms on first request
- **Self-host for production** — eliminates third-party dependency and privacy concerns
- **Limit to 2–3 weights** — each weight is a separate network request (unless variable)

## CSS/Implementation Patterns

### System Font Stack
```css
:root {
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-serif: 'Iowan Old Style', 'Palatino Linotype', Palatino,
    Georgia, serif;
  --font-mono: ui-monospace, 'Cascadia Code', 'Source Code Pro',
    Menlo, Consolas, monospace;
}
```

### Google Fonts with Preconnect
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@600;700&display=swap" rel="stylesheet">
```

### Variable Font Loading
```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}
```

### Heading + Body Pairing
```css
:root {
  --font-heading: 'Lora', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;
}

h1, h2, h3, h4 {
  font-family: var(--font-heading);
}

body {
  font-family: var(--font-body);
}
```

### Tailwind Config
```js
// tailwind.config.js
module.exports = {
  theme: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      serif: ['Lora', 'Georgia', 'serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
  },
};
```

## Common Mistakes

1. **Three or more typefaces** — adds visual noise. If you think you need a third, try varying weight or size of your existing two instead.
2. **Two sans-serifs that look similar** — Inter + Roboto, or Helvetica + Arial. The user can't tell them apart, so there's no hierarchy benefit.
3. **Loading all weights** — loading 6 weights of a font adds 200–400KB. Pick 2–3 weights maximum (400, 600, 700 covers most needs).
4. **Missing `font-display: swap`** — without it, text is invisible for up to 3 seconds while fonts load. Always set `swap`.
5. **No fallback fonts** — `font-family: 'Inter'` alone means the browser picks a random fallback. Always include a generic family.
6. **Ignoring x-height mismatch** — if your heading font has a tall x-height and body font has a short one, they look mismatched at the same size. Check with `font-size-adjust` or visually compare lowercase letters.

## Decision Tree

```
Choosing fonts:
├─ Do you need a custom typeface?
│  ├─ No / unsure → Use system font stack (fastest, zero load cost)
│  └─ Yes → Continue below
├─ How many typefaces?
│  ├─ One is enough → Pick a versatile sans (Inter, Source Sans 3)
│  │  └─ Create hierarchy with weight + size alone
│  └─ Two for contrast → Pair serif headings + sans body
├─ Picking a pairing:
│  ├─ Want zero risk? → Use a superfamily (Roboto + Roboto Slab)
│  ├─ Want editorial feel? → Serif heading + clean sans body
│  └─ Want modern/tech feel? → Geometric sans heading + neutral sans body
└─ Loading strategy:
   ├─ Variable font available? → Use it (smaller total file size)
   ├─ Self-hosting? → Use woff2 format, preload critical weights
   └─ Google Fonts? → Preconnect + display=swap + limit weights
```

## Sources
- Butterick, M. (2010). *Butterick's Practical Typography* — [practicaltypography.com](https://practicaltypography.com)
- [Google Fonts](https://fonts.google.com/) — font library and pairing suggestions
- [Fontpair](https://www.fontpair.co/) — curated Google Font pairings
- [web.dev — Best practices for fonts](https://web.dev/font-best-practices/)
- [MDN — font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)
