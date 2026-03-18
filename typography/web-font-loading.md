# Web Font Loading

> **TL;DR:** Use `font-display: swap` for body text and `font-display: optional` for non-critical fonts. Preload critical fonts, subset to needed character ranges, and self-host when possible.

## Core Principles

### The Font Loading Problem
When a browser encounters a custom web font, it must download the font file before rendering text. How it handles the delay creates three possible outcomes:
- **FOIT (Flash of Invisible Text)** -- text is hidden until the font loads. This is the browser default in most cases. Users see blank space for up to 3 seconds.
- **FOUT (Flash of Unstyled Text)** -- text renders immediately in a fallback font, then swaps to the custom font when loaded. Brief visual shift, but content is readable immediately.
- **FOFT (Flash of Faux Text)** -- a two-stage approach where a subset of the font loads first (e.g., roman weight only), then additional weights/styles load later.

**FOUT is almost always the best tradeoff.** Readable content immediately is better than invisible text.

### Performance Impact
- Each font file is typically **20-100KB** (WOFF2 compressed)
- A typical site uses **2-6 font files** (2 families x 2-3 weights)
- Font downloads are **render-blocking** for text using that font
- Fonts are discovered late -- the browser must parse HTML, then CSS, then start the font download
- **Cumulative Layout Shift (CLS)** occurs when the fallback font swaps to the web font and text reflows

### The Loading Timeline
1. Browser parses HTML, finds `<link>` to CSS
2. Browser downloads and parses CSS, discovers `@font-face` declarations
3. Browser starts downloading font files (only after CSS is parsed)
4. Until the font arrives: FOIT or FOUT depending on `font-display`
5. Font arrives, text re-renders with custom font

**Preloading shortcuts step 2-3** by telling the browser about fonts in the HTML `<head>`, before CSS is even parsed.

## Concrete Rules

### font-display Values
| Value | Behavior | Block period | Swap period | Use when |
|-------|----------|-------------|-------------|----------|
| `swap` | FOUT: show fallback immediately, swap when loaded | 100ms | Infinite | Body text, any text that must be readable instantly |
| `optional` | Show fallback; swap only if font is already cached | 100ms | None | Decorative fonts, non-critical headings |
| `fallback` | Brief FOIT, then FOUT with limited swap window | 100ms | 3s | Compromise when FOUT reflow is unacceptable |
| `block` | FOIT: hide text until font loads (up to 3s) | 3s | Infinite | Icon fonts only (never for text) |
| `auto` | Browser default (usually `block`) | Varies | Varies | Never use explicitly |

### Critical Rules
1. **Always declare `font-display: swap`** on body/paragraph fonts -- content must be readable immediately
2. **Preload at most 1-2 font files** -- only the fonts needed above the fold. Over-preloading hurts performance.
3. **Use WOFF2 format** -- it has the best compression (30% smaller than WOFF). WOFF is the only fallback needed for legacy browsers.
4. **Self-host fonts** when possible -- eliminates the extra DNS lookup and connection to Google Fonts / Adobe Fonts CDN. Use [google-webfonts-helper](https://gwfh.mranftl.com/fonts) for easy downloads.
5. **Subset to Latin** if your audience is primarily English/European -- reduces file size by 50-80% for CJK-inclusive fonts.
6. **Limit total font weight to under 200KB** -- combined size of all font files.
7. **Use no more than 2 font families** and **3-4 weights total** (e.g., regular 400, medium 500, bold 700).
8. **Match fallback font metrics** using `size-adjust`, `ascent-override`, `descent-override` to minimize CLS.

### System Font Stacks (Zero-Cost Fallbacks)
When custom fonts aren't essential, system fonts render instantly with zero layout shift:
```css
/* Modern system font stack */
font-family: system-ui, -apple-system, BlinkMacSystemFont,
             "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

/* Monospace system stack */
font-family: ui-monospace, "Cascadia Code", "Source Code Pro",
             Menlo, Consolas, "DejaVu Sans Mono", monospace;

/* Serif system stack */
font-family: "Iowan Old Style", "Palatino Linotype",
             "URW Palladio L", P052, serif;
```

## CSS/Implementation Patterns

### Basic Setup: Preload + font-display: swap
```html
<head>
  <!-- Preload critical fonts (above-the-fold only) -->
  <link rel="preload" href="/fonts/inter-latin-400.woff2"
        as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/inter-latin-700.woff2"
        as="font" type="font/woff2" crossorigin>

  <!-- Note: crossorigin is required even for same-origin fonts -->
  <link rel="stylesheet" href="/css/styles.css">
</head>
```

```css
/* @font-face with font-display: swap */
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/inter-latin-400.woff2") format("woff2"),
       url("/fonts/inter-latin-400.woff") format("woff");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC,
                 U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
                 U+2000-206F, U+2074, U+20AC, U+2122, U+2191,
                 U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("/fonts/inter-latin-700.woff2") format("woff2"),
       url("/fonts/inter-latin-700.woff") format("woff");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC,
                 U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
                 U+2000-206F, U+2074, U+20AC, U+2122, U+2191,
                 U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

### CLS Reduction: Fallback Font Metric Matching
```css
/* Override fallback font metrics to match the web font */
@font-face {
  font-family: "Inter Fallback";
  src: local("Arial");
  size-adjust: 107.64%;      /* Scale fallback to match web font width */
  ascent-override: 90%;       /* Match ascender height */
  descent-override: 22.43%;   /* Match descender depth */
  line-gap-override: 0%;      /* Match line gap */
}

body {
  font-family: "Inter", "Inter Fallback", sans-serif;
}
```

To calculate these values for your font pair, use the [Fallback Font Generator](https://screenspan.net/fallback) or the `@next/font` automatic optimization in Next.js.

### Variable Font (Single File for All Weights)
```css
/* One file replaces multiple weight-specific files */
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 100 900;   /* Full weight range */
  font-display: swap;
  src: url("/fonts/inter-latin-variable.woff2") format("woff2-variations");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}

/* Use any weight without loading extra files */
.body { font-weight: 400; }
.medium { font-weight: 500; }
.bold { font-weight: 700; }
```

Variable fonts are a single file (typically 80-150KB) that replaces 4-6 static files (20-50KB each). Net savings when using 3+ weights.

### font-display: optional for Non-Critical Fonts
```css
/* Decorative heading font -- OK if it doesn't load on first visit */
@font-face {
  font-family: "Playfair Display";
  font-style: normal;
  font-weight: 700;
  font-display: optional;   /* Use if cached, skip if not */
  src: url("/fonts/playfair-display-700.woff2") format("woff2");
}

h1, h2 {
  font-family: "Playfair Display", Georgia, serif;
}
```

With `optional`, the browser will:
- First visit: show the fallback font (Georgia), download the custom font to cache
- Subsequent visits: use the cached custom font instantly (no swap, no CLS)

### FOFT (Flash of Faux Text) Two-Stage Strategy
```css
/* Stage 1: Load Roman (normal weight) first */
@font-face {
  font-family: "Inter Stage1";
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/inter-latin-400.woff2") format("woff2");
}

/* Stage 2: Load bold/italic after Roman is ready */
@font-face {
  font-family: "Inter";
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/inter-latin-400.woff2") format("woff2");
}

@font-face {
  font-family: "Inter";
  font-weight: 700;
  font-display: swap;
  src: url("/fonts/inter-latin-700.woff2") format("woff2");
}
```

```js
// JavaScript: Detect when Stage 1 loads, then apply Stage 2
if ('fonts' in document) {
  document.fonts.load('400 1em "Inter Stage1"').then(() => {
    document.documentElement.classList.add('fonts-stage1');

    Promise.all([
      document.fonts.load('400 1em "Inter"'),
      document.fonts.load('700 1em "Inter"'),
    ]).then(() => {
      document.documentElement.classList.add('fonts-stage2');
    });
  });
}
```

```css
/* Progressive enhancement */
body { font-family: Arial, sans-serif; }
.fonts-stage1 body { font-family: "Inter Stage1", Arial, sans-serif; }
.fonts-stage2 body { font-family: "Inter", Arial, sans-serif; }
```

### Google Fonts Optimized Loading
```html
<!-- If you must use Google Fonts CDN: preconnect + display=swap -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap">
```

Better alternative: download the files and self-host. Eliminates two extra origins and gives you full control over caching.

## Common Mistakes

1. **Not using `font-display` at all** -- the browser defaults to `block`, causing invisible text for up to 3 seconds. Always declare `font-display`.

2. **Preloading too many fonts** -- preloading 6 font files wastes bandwidth on resources that may not be needed above the fold. Preload 1-2 maximum.

3. **Forgetting `crossorigin` on preload** -- font preloads require the `crossorigin` attribute even when self-hosted. Without it, the browser downloads the font twice.

4. **Loading fonts from multiple origins** -- Google Fonts CSS from `fonts.googleapis.com` + font files from `fonts.gstatic.com` = two DNS lookups + two TLS handshakes before any font bytes arrive. Self-host instead.

5. **Not subsetting** -- loading a full Inter font file (250KB+) when you only need Latin characters (25KB). Use `unicode-range` and subset files.

6. **Using `@import` in CSS** -- `@import url('https://fonts.googleapis.com/...')` creates a chain: HTML -> CSS -> @import CSS -> font files. Use `<link>` in HTML instead.

7. **Loading too many weights** -- Regular, Medium, SemiBold, Bold, ExtraBold... Most designs need 2-3 weights. Each extra weight is another 20-50KB.

8. **Ignoring CLS from font swap** -- the text reflow when fonts swap is measurable CLS. Use `size-adjust` and metric overrides to minimize it.

## Decision Tree

**"Which font loading strategy should I use?"**

```
How many font families do you need?
│
├── 0 (system fonts are fine)
│   --> Use system font stack. Zero loading time, zero CLS.
│   --> Best for: dashboards, tools, documentation, text-heavy apps.
│
├── 1 family
│   How many weights?
│   ├── 1-2 weights --> Static WOFF2 files + preload + font-display: swap
│   └── 3+ weights --> Variable font (single file) + preload + swap
│
└── 2 families
    Is the second family critical (body text)?
    ├── YES --> Preload both families' primary weight.
    │          font-display: swap for both.
    │          Consider variable fonts if using 3+ weights total.
    │
    └── NO (headings/decorative only)
        --> Preload the body font only.
           font-display: swap for body, optional for decorative.
           Decorative loads from cache on repeat visits.
```

**"Should I self-host or use a CDN?"**

```
Are you using a framework with built-in font optimization
(Next.js, Nuxt, etc.)?
├── YES --> Use the framework's font module (handles
│          optimization automatically).
│
└── NO -->
    Do you need fonts from Google Fonts or Adobe Fonts?
    ├── YES --> Self-host. Download WOFF2 files and serve
    │          from your own domain. Faster (no extra DNS),
    │          more reliable, GDPR-compliant.
    │
    └── Already have font files -->
        Self-host with proper cache headers:
        Cache-Control: public, max-age=31536000, immutable
```

## Sources

- Clagnut. (2015). *A Comprehensive Guide to Font Loading Strategies.*
- Google Web Fundamentals. *Web Font Optimization.* web.dev/learn/performance/optimize-web-fonts
- Storey, B. (2020). *A New Way To Reduce Font Loading Impact: CSS Font Descriptors.* Smashing Magazine.
- Bramstein, B. (2017). *Font Loading Revisited with Font Face Observer.* Filament Group.
- Web.dev. *Optimize Cumulative Layout Shift.* web.dev/optimize-cls
- MDN Web Docs. *font-display.* developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display
- MDN Web Docs. *CSS Font Loading API.* developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API

---

*Related: [Font Pairing](../typography/font-pairing.md) | [Readability](../typography/readability.md)*
