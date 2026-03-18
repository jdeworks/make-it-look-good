# Color Psychology

> **TL;DR:** Colors carry cultural and emotional associations that affect user perception. Use these associations intentionally — red for urgency/errors, green for success, blue for trust — but always validate with contrast and accessibility checks first. Cultural context matters: red means luck in China, mourning white varies by region.

## Core Principles

1. **Color associations are learned, not universal** — cultural context overrides biological responses
2. **Saturation and brightness matter as much as hue** — a muted red feels different from a vivid red
3. **Context determines meaning** — red on a sale banner means urgency; red on a form field means error
4. **Don't rely on psychology alone** — pair color choices with usability testing and [accessibility standards](./contrast-and-accessibility.md)
5. **Consistency trumps cleverness** — once you assign meaning to a color in your UI, use it consistently

## Color Associations (Western Default)

| Color | Primary Associations | UI Applications | Caution |
|-------|---------------------|-----------------|---------|
| **Red** | Urgency, danger, passion, energy | Error states, destructive actions, sale badges, notifications | Overuse causes anxiety; avoid for primary CTAs unless brand-driven |
| **Blue** | Trust, calm, professionalism, stability | Primary actions, links, corporate brands, healthcare | Overused in tech — can feel generic if not differentiated |
| **Green** | Success, nature, growth, permission | Success states, confirmations, "go" actions, eco/health brands | Ensure sufficient contrast — many greens fail WCAG on white |
| **Yellow** | Warning, optimism, attention, warmth | Warning states, highlights, callouts | Low contrast on white — needs dark text; can feel cheap if overused |
| **Orange** | Energy, warmth, enthusiasm, affordability | CTAs, sale promotions, creative brands | Walks the line between "energetic" and "cheap" — use deliberately |
| **Purple** | Luxury, creativity, wisdom, spirituality | Premium brands, creative tools, beauty/wellness | Dark purples can feel heavy; light purples can feel juvenile |
| **Black** | Sophistication, premium, power, elegance | Luxury brands, premium tiers, editorial | Full black (#000) on white causes halation — use #1a1a1a |
| **White** | Cleanliness, simplicity, space, minimalism | Backgrounds, cards, whitespace | Too much white without hierarchy feels empty, not minimal |
| **Gray** | Neutral, professional, balance | Secondary text, borders, disabled states, backgrounds | Gray-only palettes feel lifeless — accent with one strong color |
| **Pink** | Playfulness, romance, femininity, warmth | Fashion, beauty, food, youth-oriented products | Gendered assumptions — use intentionally, not by default |

## Cultural Variations

| Color | Western | East Asian | Middle Eastern | South Asian |
|-------|---------|------------|----------------|-------------|
| **Red** | Danger, urgency | Luck, prosperity, celebration (China) | Danger, caution | Purity, fertility (India) |
| **White** | Purity, cleanliness | Mourning, death (China, Japan, Korea) | Purity, peace | Mourning (India) |
| **Yellow** | Warning, optimism | Imperial, sacred (China) | Happiness, prosperity | Sacred, auspicious |
| **Green** | Nature, success | Youth, fertility | Islam, paradise, fertility | Islam, harvest |
| **Blue** | Trust, corporate | Immortality (China) | Protection, heaven | Strength, bravery (India) |
| **Black** | Sophistication, death | Water element (China) | Mystery, evil | Evil, negativity |
| **Purple** | Luxury, royalty | Wealth, nobility | Wealth | Sorrow, comforting |

> **For international products:** avoid relying on a single color's meaning. Pair color with icons and text to ensure clarity across cultures.

## Concrete Rules

### Status Colors (Standard Web Conventions)
| Status | Color | Hex Range | Always Pair With |
|--------|-------|-----------|-----------------|
| **Error / Danger** | Red | #cc0000 – #dc2626 | Error icon + message text |
| **Warning** | Yellow/Amber | #b45309 – #d97706 | Warning icon + explanation |
| **Success** | Green | #007a33 – #16a34a | Checkmark icon + confirmation |
| **Info** | Blue | #0055cc – #2563eb | Info icon + details |
| **Neutral** | Gray | #6b7280 – #9ca3af | Text label alone is sufficient |

### CTA Color Guidelines
- **Primary CTA**: Use your brand's strongest color — blue and orange convert well in A/B tests across industries
- **Destructive actions**: Red, but never the same red as your primary CTA
- **Secondary actions**: Outlined or muted version of primary, or neutral gray
- **The "isolation effect"**: A CTA converts better when its color is unique on the page, not when it's a specific color

### Brand Color Temperature
| Temperature | Colors | Personality | Best For |
|-------------|--------|-------------|----------|
| **Warm** | Red, orange, yellow | Energetic, urgent, passionate | Food, retail, entertainment |
| **Cool** | Blue, green, purple | Calm, trustworthy, professional | Finance, healthcare, tech |
| **Neutral** | Black, white, gray | Sophisticated, minimal, editorial | Luxury, fashion, design tools |

## CSS/Implementation Patterns

### Semantic Status Colors
```css
:root {
  /* Status colors — chosen for both meaning AND accessibility */
  --color-error: #cc0000;           /* 5.9:1 on white */
  --color-error-bg: #fef2f2;        /* Light red background */
  --color-warning: #b45309;         /* 4.8:1 on white */
  --color-warning-bg: #fffbeb;
  --color-success: #007a33;         /* 5.0:1 on white */
  --color-success-bg: #f0fdf4;
  --color-info: #0055cc;            /* 7.9:1 on white */
  --color-info-bg: #eff6ff;
}
```

### Alert Component Using Psychology
```css
.alert {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border-left: 4px solid;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.alert--error {
  background: var(--color-error-bg);
  border-color: var(--color-error);
  color: var(--color-error);
}

.alert--success {
  background: var(--color-success-bg);
  border-color: var(--color-success);
  color: var(--color-success);
}
```

## Common Mistakes

1. **Too much red** — using red for primary CTAs, headers, AND error states creates visual confusion and anxiety. Reserve red for errors and destructive actions.
2. **Ignoring cultural context** — launching a product in China with white as the primary celebration color, or using green for finance in markets where it has religious significance.
3. **Assuming color psychology is science** — most "studies" are pop psychology. Color preference is personal, cultural, and contextual. Use associations as starting points, not rules.
4. **Same color for conflicting meanings** — green "Submit" button next to green "Success" banner makes it unclear what the green means.
5. **Gendered color assumptions** — defaulting to pink for women and blue for men alienates users. Use brand-appropriate colors for everyone.
6. **Ignoring accessibility for "brand feel"** — a luxurious light-gray-on-white aesthetic that fails WCAG is not sophisticated, it's exclusionary. See [contrast-and-accessibility.md](./contrast-and-accessibility.md).
7. **Using yellow text on white** — yellow has inherently low contrast on light backgrounds. Use dark amber/brown text instead (e.g., #92400e on white = 7.5:1).

## Decision Tree

```
Choosing a color for a UI element?
├─ Is it a status indicator?
│  └─ Use standard conventions: red=error, yellow=warning, green=success, blue=info
├─ Is it a brand/primary color?
│  ├─ What personality does the brand need?
│  │  ├─ Trustworthy/professional → Blue, dark green
│  │  ├─ Energetic/youthful → Orange, bright red, magenta
│  │  ├─ Premium/luxury → Black, dark purple, gold
│  │  └─ Natural/healthy → Green, earth tones
│  └─ Check contrast: does it pass 4.5:1 for text, 3:1 for UI components?
├─ Is this for an international audience?
│  ├─ Yes → Don't rely on color meaning alone; add icons/text
│  └─ No → Local conventions may apply, but still add redundant cues
└─ Is this a CTA?
   ├─ Make it visually unique on the page (isolation effect)
   ├─ Don't use the same color as error/status indicators
   └─ Test — color psychology suggests, but A/B testing decides
```

## Sources
- [Labrecque & Milne — Exciting Red and Competent Blue (Journal of the Academy of Marketing Science, 2012)](https://doi.org/10.1007/s11747-010-0245-y)
- [Elliot & Maier — Color and Psychological Functioning (Current Directions in Psychological Science, 2007)](https://doi.org/10.1111/j.1467-8721.2007.00514.x)
- [Joe Hallock — Colour Assignment (2003)](https://www.joehallock.com/edu/COM498/preferences.html)
- [Nick Kolenda — Color Psychology (2024)](https://www.nickkolenda.com/color-psychology/)
- [WebAIM — Contrast and Color Accessibility](https://webaim.org/articles/contrast/)
