# Design Consultation Playbook

> **Purpose:** This file turns the make-it-look-good knowledge base into an interactive design consultation. Read this file first, then follow the steps in order. Works whether the user brings existing code, a vague idea, a screenshot, or anything in between.

---

## Step 0: Classify the Input

Before asking anything, figure out what the user brought. This determines your entire workflow.

### Input Types

| What They Brought | How to Detect | Workflow |
|---|---|---|
| **Repo link or "make it look good"** | GitHub URL, "make it look good", "redesign my project" | → Step 1C (Intake — ask ALL required questions) → Step 1A (Audit repo code) → Step 2 → Step 3 → Step 4 |
| **Existing code** (HTML, JSX, Vue SFC, Svelte, etc.) | Code blocks, file paths, or "here's my component" | → Step 1A (Audit) → Step 2 → Step 3 → Step 4 |
| **Screenshot or mockup** | Image attachment, Figma link, "here's what it looks like" | → Step 1B (Visual Audit) → Step 2 → Step 3 → Step 4 |
| **Reference URL** ("I want it to look like this site") | URL to a site they admire, "make it feel like stripe.com" | → Step 1E (Analyze Reference) → Step 1C (Intake) → Step 2 → Step 3 → Step 4 |
| **Vague idea** ("make me a dashboard", "I need a landing page") | No code, no visuals, just a description | → Step 1C (Intake) → Step 2 → Step 3 → Step 4 |
| **Plain text / data** ("here's my CLI output", "here are my API fields") | Raw text, JSON, CSV, terminal output | → Step 1D (Structure) → Step 2 → Step 3 → Step 4 |
| **Existing design they want improved** | "Make this look better", "this looks amateur" | → Step 1A (Audit) → Step 2 → Step 3 → Step 4 |

### Detect the Tech Stack

Look for clues in whatever they provide:

| Signal | Stack | Output Format |
|---|---|---|
| `className=`, `useState`, `<Component />`, `.jsx`/`.tsx` | React | JSX with className strings |
| `v-bind`, `v-for`, `:class`, `.vue` | Vue | Vue SFC `<template>` block |
| `{#if}`, `{#each}`, `bind:`, `.svelte` | Svelte | Svelte component |
| `@apply`, `@layer` | Tailwind (already using) | Tailwind classes (match their version) |
| `style={{ }}`, inline styles | React with inline styles | Keep inline style pattern or suggest Tailwind |
| `styled.div`, `css\`\`` | CSS-in-JS (styled-components, emotion) | Styled-components or suggest migration |
| `class=""` with custom CSS, `<style>` blocks | Plain HTML + CSS | Plain HTML + CSS or suggest Tailwind |
| Bootstrap classes (`btn btn-primary`, `col-md-6`) | Bootstrap | Bootstrap classes or suggest migration |
| Material UI (`<Button variant="contained">`) | MUI | MUI component props |
| No code at all | Unknown | Default to HTML + Tailwind |

**Critical rule:** Match the user's stack. Don't hand someone using React + styled-components a plain HTML file with Tailwind classes. Meet them where they are.

If you're unsure, ask: *"What's your tech stack? (React, Vue, plain HTML, etc.) And are you using any CSS framework like Tailwind or Bootstrap?"*

---

## Step 1A: Audit Existing Code

When the user brings existing code, **read it carefully before suggesting changes.** Generate a design review first.

### What to Look For

Run through this checklist against their code. Note every issue you find.

**Spacing & Layout**
- [ ] Is there a consistent spacing system? (Look for recurring padding/margin values)
- [ ] Are spacing values from a scale (4, 8, 12, 16, 24, 32, 48) or random (13, 17, 22)?
- [ ] Is there a layout container with max-width and centered content?
- [ ] Are sections separated with consistent vertical rhythm?
- [ ] Does the page have a `min-h-screen` wrapper with a background color? (Prevents white body bleed)
- [ ] Is there horizontal overflow at any breakpoint? (Check for elements wider than viewport — common with absolute positioning or fixed-width elements)

**Responsive & Mobile**
- [ ] Does the layout work at 320px? At 768px? At 1024px+?
- [ ] Do sidebars collapse to off-canvas on mobile? (Fixed sidebars eat >50% of mobile screen)
- [ ] Do grids reduce columns on smaller screens? (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- [ ] Do flex rows wrap or stack on mobile? (`flex-col sm:flex-row`)
- [ ] Are paddings responsive? (`p-4 sm:p-6 lg:p-8`, not a fixed `p-8`)
- [ ] Do tables have `overflow-x-auto` on their container?
- [ ] Is navigation mobile-appropriate? (Hamburger + off-canvas, not just squished links)

**Typography**
- [ ] Is body text ≥16px? (Check for `font-size: 12px` or `text-xs` on body text — common mistake)
- [ ] Is there a clear heading hierarchy? (h1 > h2 > h3 in size)
- [ ] Is line height between 1.4–1.6 for body text?
- [ ] Is line length constrained to 45–75 characters? (Look for `max-width` on text containers)
- [ ] Are more than 2 typefaces used?
- [ ] Are web fonts loaded with `font-display: swap`? Is there a `<link rel="preconnect">` for the font CDN?

**Color & Contrast**
- [ ] Does text meet 4.5:1 contrast ratio against its background?
- [ ] Is there a consistent color palette or random hex values scattered?
- [ ] Are interactive elements (links, buttons) visually distinct?
- [ ] Is color used as the _only_ indicator for anything? (Error = red only, no icon/text)
- [ ] Are there any low-contrast situations? (gray on white, light blue on white)

**Interactive Elements**
- [ ] Are click/touch targets at least 44×44px?
- [ ] Do buttons have hover/focus states?
- [ ] Are form labels associated with inputs? (`for`/`htmlFor` attribute)
- [ ] Are form labels visible? (Not placeholder-only)
- [ ] Do form inputs have `autocomplete` attributes? (Reduces friction by ~30%)
- [ ] Is there visual feedback for actions? (Loading states, success/error messages)

**Dark Mode**
- [ ] Does the design support dark mode? (Check for `dark:` variants or a dark color scheme)
- [ ] If yes: are all backgrounds, text, borders, and form elements covered?
- [ ] If no: should it? (Ask the user — see intake question 5)

**Semantic HTML & Accessibility**
- [ ] Are semantic elements used? (`<nav>`, `<main>`, `<header>`, `<footer>`, `<article>`, `<section>`)
- [ ] Does the navigation have `aria-label` and `aria-current="page"` on the active item?
- [ ] Do images have `alt` text?
- [ ] Is the heading hierarchy logical? (`<h1>` → `<h2>` → `<h3>`, not skipping levels)
- [ ] If HTML contains `<script>` tags: warn the user. Scripts execute in the preview tool's sandboxed iframe. Flag any scripts that make network requests or access cookies.

**Hierarchy & Structure**
- [ ] Is there a clear visual hierarchy? (Can you tell what's most important in 2 seconds?)
- [ ] Are related items grouped visually? (Gestalt proximity)
- [ ] Is there a clear primary action on each screen/section?
- [ ] Are secondary actions visually subordinate to the primary?

**Component-Specific**
- [ ] Cards: consistent padding, single primary action, clear content hierarchy?
- [ ] Tables: right-aligned numbers, adequate row height, header distinction?
- [ ] Navigation: ≤7 items, clear active state, mobile-appropriate pattern?
- [ ] Forms: single column, labels above, grouped into logical sections, `autocomplete` attributes?
- [ ] Modals: max ~600px wide, trap focus, clear dismiss action?

### Output the Design Review Notes

After auditing, generate a **Design Review Notes** document (see Step 4 for the full template). This is the most important output — it gives the user a persistent record of what to fix and why.

---

## Step 1B: Visual Audit (Screenshots / Mockups)

When the user provides a screenshot or image:

1. Describe what you see — layout, colors, typography, spacing
2. Run the same checklist from Step 1A, noting what you can observe visually
3. Call out anything you can't assess from the image alone (e.g., "I can't tell if those targets are 44px — can you confirm?")
4. Note the approximate tech stack if visible (browser chrome suggests web, device frame suggests native)
5. Proceed to generate Design Review Notes (Step 4)

---

## Step 1C: Intake Questions (Starting from Scratch)

When there's no existing code or visuals, ask these questions. **Ask only what's needed** — if someone says "I need a contact form," don't ask about dashboards.

### First: Set the Consultation Depth

Before diving into design questions, gauge how much guidance the user wants. **Ask this first** (or infer from context):

> **How detailed should we go?**
> - **Quick start** — I'll pick sensible defaults based on your project type and get you working code fast. You can steer from there. *(Best for: experienced developers, "just make it not ugly," tight deadlines)*
> - **Guided** — I'll walk you through the key decisions (personality, colors, layout) with options to pick from, explaining trade-offs briefly. *(Best for: most people — you get real choices without a design degree)*
> - **Thorough** — Full consultation with reasoning behind every decision, alternative approaches, and detailed design review notes. *(Best for: learning, client work where you need to justify choices, complex projects)*

**How to adapt based on depth:**

| Depth | Questions to ask | Explanation level | Output |
|---|---|---|---|
| **Quick start** | Only #1 (what), #4 (stack). Infer the rest from project type. | Minimal — just state what you chose | Code + brief token summary |
| **Guided** | All required (#1–7). Batch into 1-2 messages. | Brief — one sentence per decision | Code + design review notes |
| **Thorough** | All required + all relevant. One topic at a time. | Detailed — why each choice, alternatives considered | Code + full design review notes + token reference |

> **Minimum questions rule (Guided & Thorough):** Questions 1–7 below are ALL required. Do NOT skip personality (3), colors (5), inspiration (6), or dark mode (7) — these are the questions users most want to answer and that most affect the output. You may batch them into a single message, but you must get answers before proceeding to code.
>
> **Quick start exception:** If the user picks quick start (or says "don't ask questions, just do it" or "use defaults"), pick reasonable defaults AND state what you chose so they can course-correct. Always state the personality, primary color, and dark mode choice you defaulted to.

### Required (Always Ask — Guided & Thorough)

1. **What are you building?**
   - Dashboard / admin panel
   - Landing page / marketing site
   - Form / multi-step wizard
   - Content site / blog
   - E-commerce / product listing
   - Photo gallery / image-heavy site
   - Mobile app (React Native / Flutter)
   - Internal tool
   - Email template
   - Portfolio / personal site
   - Full project / existing codebase (point me at the repo or paste code)
   - Other: ___

2. **Who uses it?**
   - General public (all ages, devices, accessibility critical)
   - Business users (desktop-heavy, data-dense, efficiency matters)
   - Developers (information-dense OK, keyboard shortcuts expected)
   - Mobile-first consumers (touch targets critical, thumb zones)

3. **What's the design personality?** (This matters — don't default to "clean blue SaaS" every time. Push for personality. Show the options.)
   - **Clean** — balanced, professional, standard Tailwind look (rounded-xl, subtle shadows, system sans). The safe default.
   - **Minimalist** — stripped back, no shadows, hairline borders, light font weights (300), lots of whitespace, uppercase labels. Think Apple, Muji, Scandinavian.
   - **Playful** — big rounded corners (16-24px), colorful shadows, bouncy hover animations, generous spacing, pill-shaped buttons. Think Duolingo, Slack.
   - **Editorial** — serif headings (Playfair Display), no shadows, fine borders, elegant spacing, muted palette, uppercase button labels. Think Medium, premium brands. *(Available for: form, landing; other elements use clean as base and apply editorial characteristics.)*
   - **Dark & technical** — dark backgrounds, monospace accents, terminal feel. **Important: "dark" is a MODE, not a personality.** Always ask for a base personality (clean, minimalist, playful, editorial) first, then apply dark mode on top. Use the dark mode toggle in the preview tool.
   - Match existing brand: ___ (ask for colors, fonts, logo)

   *Why this matters:* A default blue-gray SaaS layout is technically correct but has zero personality. Users' brands are different — a children's app needs Playful, a law firm needs Editorial, a productivity tool needs Clean or Minimalist. The design vibe affects border-radius, shadow style, font weight, hover animations, spacing density, and color temperature. Don't just change the accent color — change the visual character.

   *Personality presets:* Every element in `docs/presets/` has a `clean` variant; most also have `minimalist` and `playful` as structurally different HTML, except a few clean-only elements (e.g. agency-portfolio, app-showcase, scroll-reveal-landing). A handful of elements additionally have `before` or `editorial` variants. **Do NOT assume a given variant file exists — check `docs/presets/index.json` before referencing a preset path.** If a personality file doesn't exist for a specific element, use the clean variant as base and apply the personality's visual characteristics manually.

4. **What's your tech stack?**
   - Plain HTML + CSS (will suggest Tailwind CDN)
   - React / Next.js
   - Vue / Nuxt
   - Svelte / SvelteKit
   - React Native / Flutter
   - Other: ___

5. **Colors — do you have brand colors or preferences?** (Don't skip this. The primary color alone changes the entire feel.)
   - Specific brand colors: ___ (hex values, Tailwind palette names, or "like Stripe's blue")
   - General direction: warm (amber, orange, rose), cool (blue, cyan, teal), neutral (slate, gray), bold (violet, fuchsia, emerald)
   - No preference — pick something that fits the personality

   *Why this matters:* Color is the single fastest way to make a design feel intentional vs. generic. Even users who say "I don't care about colors" have opinions when they see the output. Asking upfront avoids a revision cycle.

6. **Any sites or pages you like the look of?** (Inspiration is the fastest shortcut to a good result.)
   - Share a link — even a single page that "feels right." I'll identify what makes it work (layout rhythm, color temperature, typography choices, image treatment, whitespace) and apply those principles to your project.
   - Describe what caught your eye — "I like how Stripe shows code examples inline" or "the way Aesop's site lets the product photos breathe" is enough.
   - Reference one of our presets — if you've seen the [preview tool](https://jdeworks.github.io/make-it-look-good/), tell me which template or personality resonated and what you'd change.
   - No inspiration — that's fine, I'll work from the personality and project type.

   *Why this matters:* A perfume brand, a photo portfolio, and a SaaS dashboard all need completely different visual treatment — even if they're all "minimalist." Inspiration links tell me about image treatment (full-bleed hero vs. contained grid), content rhythm (editorial scroll vs. dense grid), whitespace ratios, and typography tone in a way that personality labels alone can't capture. One good reference link saves 3 rounds of "not quite what I meant."

   *What to look for in their reference:*
   - **Layout pattern** — single column editorial? Bento grid? Full-bleed sections? Masonry gallery?
   - **Image treatment** — hero images, product photography style, aspect ratios, overlays, spacing around images
   - **Typography tone** — bold/geometric, elegant/serif, neutral/system, monospace/technical
   - **Density** — how much breathing room between elements
   - **Color temperature** — warm, cool, neutral, high-contrast, muted
   - **Special touches** — scroll effects, hover reveals, micro-animations, asymmetric layouts

7. **Do you need dark mode?**
   - No — light only
   - Yes — toggle button (user-controlled, store preference in `localStorage`)
   - Yes — follow OS preference (`prefers-color-scheme: dark`, CSS-only)
   - Yes — both (OS default + user override toggle)

   *Implementation notes:* Dark mode with Tailwind uses the `dark:` variant on every element (`bg-white dark:bg-slate-800`, `text-slate-900 dark:text-white`). The `<html>` element gets a `class="dark"` attribute. Ask how the user activates it — some projects use a toggle button that sets the class via JS and stores the preference; others use a CSS media query. The approach affects how you write the code.

### Ask If Relevant

8. **How image/content-heavy is your site?** (Ask if the project involves product photos, galleries, portfolios, or visual storytelling.)
   - **Text-first** — the content is mostly text, images are supporting (blogs, docs, dashboards)
   - **Balanced** — mix of text and imagery (landing pages, most SaaS, e-commerce listings)
   - **Image-dominant** — photos/visuals are the primary content (galleries, portfolios, fashion, food, luxury products)

   *Affects:* Image-dominant sites need: generous whitespace to let images breathe, careful aspect ratio control (`aspect-ratio: 3/4` for portraits, `16/9` for landscapes), `object-fit: cover` with consistent containers, lazy loading, responsive `srcset`, and minimal UI chrome competing with visuals. For product photography sites (perfume, fashion, food), the layout itself should feel like a curated display — think gallery walls, not data grids. Consider masonry layouts, full-bleed hero sections, and letting single hero images fill the viewport.

9. **How data-dense is the UI?**
   - Light — few items, generous whitespace (landing pages, forms, portfolios)
   - Medium — standard content (most SaaS, dashboards with 4-6 cards)
   - Dense — lots of data visible at once (analytics, spreadsheets, admin tables)

   *Affects:* Spacing system (4px compact vs 8px generous), base font size (14px for dense, 16px for standard), line height, card padding. Dense UIs can use `text-sm` for data; light UIs should use `text-base` or larger.

10. **What components do you need?** (List the specific ones)

11. **Existing brand constraints beyond colors?** (Fonts, logo, existing design system)

12. **Any specific pain points?** (What's wrong with what you have now?)
    - "It looks amateur" → focus on spacing, type scale, color system
    - "It's hard to use" → focus on hierarchy, cognitive load, touch targets
    - "It's inconsistent" → focus on design tokens, spacing system
    - "It's not accessible" → focus on contrast, targets, screen reader

---

## Step 1D: Structure Raw Content

When the user brings plain text, data, or non-visual content:

1. **Identify the data shape** — Is it a list? Table? Key-value pairs? Nested hierarchy?
2. **Identify the use case** — Is this for displaying to end users? Admin view? Report?
3. **Suggest a component pattern:**
   - List of items → card grid or data table
   - Key-value pairs → detail/summary view or definition list
   - Nested data → tree view or accordion
   - Time series → chart or timeline
   - Status/metrics → stat cards or dashboard
4. **Ask what actions users need** — View only? Edit? Filter? Sort? Compare?
5. Proceed to Step 2 (Knowledge File Selection) with the identified pattern

---

## Step 1E: Analyze a Reference Website

When the user provides a URL as inspiration (from intake question 6) or wants you to analyze an existing site and create a template based on it. This workflow captures the **design language** of a site — layout patterns, color palette, typography, spacing, personality — and translates it into the make-it-look-good format.

### 1. Gather Visual & Structural Data

If you have access to screenshot/scraping tools (e.g., `shot-scraper`, browser automation, or built-in web tools), capture:

**Screenshots** (desktop + mobile):
```bash
shot-scraper "$URL" -o /tmp/site-desktop.png --width 1280 --height 900 --wait 2000
shot-scraper "$URL" -o /tmp/site-mobile.png --width 375 --height 812 --wait 2000
```

**Scrolled screenshots** (to capture scroll effects):
```bash
shot-scraper "$URL" -o /tmp/site-scrolled1.png --width 1280 --height 900 --wait 2000 -j "window.scrollTo(0, 800)"
shot-scraper "$URL" -o /tmp/site-scrolled2.png --width 1280 --height 900 --wait 3000 -j "window.scrollTo(0, 2500)"
```

**Design token extraction** (automated):
```bash
shot-scraper javascript "$URL" "
(() => {
  const els = document.querySelectorAll('*');
  const colors = new Set(), bgColors = new Set(), fonts = new Set(), sizes = new Set(), radii = new Set();
  els.forEach(el => {
    const s = getComputedStyle(el);
    if (s.color !== 'rgba(0, 0, 0, 0)') colors.add(s.color);
    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') bgColors.add(s.backgroundColor);
    fonts.add(s.fontFamily); sizes.add(s.fontSize); radii.add(s.borderRadius);
  });
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({
    tag: h.tagName, text: h.textContent.trim().slice(0, 60),
    fontSize: getComputedStyle(h).fontSize, fontWeight: getComputedStyle(h).fontWeight,
    fontFamily: getComputedStyle(h).fontFamily
  }));
  return {
    title: document.title,
    textColors: [...colors].slice(0, 20), bgColors: [...bgColors].slice(0, 20),
    fontFamilies: [...fonts], fontSizes: [...sizes],
    borderRadii: [...radii].filter(r => r !== '0px'),
    headings: headings.slice(0, 10),
    bodyFontSize: getComputedStyle(document.body).fontSize,
    bodyLineHeight: getComputedStyle(document.body).lineHeight,
    bodyFontFamily: getComputedStyle(document.body).fontFamily
  };
})()"
```

**If you don't have screenshot tools:** Use `WebFetch` to get the page HTML, or ask the user for a screenshot. Many LLM environments support reading images — ask the user to paste one.

### 2. Analyze the Design

Whether you have screenshots, HTML, or just a URL the user describes, analyze:

- **Layout structure** — header, hero, sections, sidebar, footer, grid patterns
- **Color palette** — map colors to nearest Tailwind palette. Identify primary, secondary, accent, neutrals
- **Typography** — font families, heading scale, body size, weights
- **Spacing patterns** — padding density, section spacing, component gaps
- **Component patterns** — cards, buttons, nav, forms, tables
- **Visual personality** — which personality does it match? (clean, minimalist, playful, editorial, or a blend)
- **Distinctive features** — what makes this design memorable? Gradients, animations, unusual layouts, bold typography, image treatment?
- **Scroll effects** — compare initial and scrolled views for parallax, sticky headers, reveal effects, shrinking logos
- **Dark mode** — is the site light, dark, or both?

### 3. Apply to the User's Project

Cross-reference the reference site's design choices against the knowledge base:
- Does it follow the spacing scale? Adapt good patterns, fix deviations
- Are contrast ratios accessible? (4.5:1 minimum)
- Are touch targets adequate? (44px minimum)
- Is typography within best practice ranges?

Then use the extracted patterns to inform Steps 2–4. The reference site is an input to the design process, not a thing to copy — capture the **design language**, not the content or branding.

---

## Step 2: Knowledge File Selection Matrix

Based on what you learned in Step 1, read the relevant files. **Read the minimum set needed.**

### By Project Type

| Project Type | Always Read | Also Read |
|---|---|---|
| **Dashboard** | `layout/grid-systems.md`, `layout/spacing-system.md`, `components/navigation.md`, `components/tables-and-lists.md` | `color/color-systems.md`, `typography/type-scale.md` |
| **Landing Page** | `layout/visual-hierarchy.md`, `typography/type-scale.md`, `components/buttons.md` | `color/color-psychology.md`, `interaction/animation-timing.md` |
| **Form / Wizard** | `components/forms.md`, `layout/spacing-system.md`, `components/buttons.md` | `components/feedback.md`, `interaction/touch-targets.md` |
| **Content Site** | `typography/readability.md`, `typography/type-scale.md`, `layout/whitespace.md` | `typography/font-pairing.md`, `responsive/fluid-typography.md` |
| **E-commerce** | `components/cards.md`, `layout/grid-systems.md`, `components/buttons.md` | `color/color-psychology.md`, `components/forms.md` |
| **Mobile App** | `interaction/touch-targets.md`, `components/navigation.md`, `responsive/mobile-first.md` | `interaction/micro-interactions.md`, `interaction/loading-states.md` |
| **Internal Tool** | `components/tables-and-lists.md`, `components/forms.md`, `layout/spacing-system.md` | `components/navigation.md`, `components/feedback.md` |
| **Portfolio** | `typography/font-pairing.md`, `layout/visual-hierarchy.md`, `expressive/visual-identity.md` | `expressive/hero-patterns.md`, `expressive/purposeful-motion.md`, `expressive/scroll-effect-patterns.md`, `layout/whitespace.md` |
| **Personal Site** | `expressive/visual-identity.md`, `expressive/hero-patterns.md`, `typography/font-pairing.md` | `expressive/purposeful-motion.md`, `expressive/scroll-effect-patterns.md`, `expressive/scroll-storytelling.md` |
| **Company Landing** | `expressive/hero-patterns.md`, `expressive/visual-identity.md`, `layout/visual-hierarchy.md` | `expressive/purposeful-motion.md`, `expressive/scroll-effect-patterns.md`, `color/color-psychology.md` |
| **Product Launch** | `expressive/hero-patterns.md`, `expressive/scroll-storytelling.md`, `expressive/purposeful-motion.md` | `expressive/visual-identity.md`, `expressive/scroll-effect-patterns.md`, `interaction/animation-timing.md` |
| **Email Template** | `typography/readability.md`, `color/contrast-and-accessibility.md`, `components/buttons.md` | `layout/spacing-system.md` |

### By Pain Point

| Pain Point | Read These |
|---|---|
| "Looks amateur" | `layout/spacing-system.md`, `typography/type-scale.md`, `color/color-systems.md` |
| "Hard to use" | `layout/visual-hierarchy.md`, `foundations/cognitive-load.md`, `interaction/touch-targets.md` |
| "Inconsistent" | `layout/spacing-system.md`, `systems/design-tokens.md` |
| "Not accessible" | `color/contrast-and-accessibility.md`, `color/color-blind-safety.md`, `interaction/touch-targets.md` |
| "Looks dated" | `typography/type-scale.md`, `color/color-systems.md`, `layout/whitespace.md` |
| "Too cluttered" | `layout/whitespace.md`, `foundations/cognitive-load.md`, `layout/visual-hierarchy.md` |
| "Looks generic / forgettable" | `expressive/visual-identity.md`, `expressive/hero-patterns.md`, `expressive/purposeful-motion.md` |
| "Needs more personality" | `expressive/visual-identity.md`, `expressive/purposeful-motion.md`, `typography/font-pairing.md` |

### Always Read (Every Consultation)

- `workflows/quick-reference.md` — critical numbers at a glance

---

## Step 2.5: Select Starting Snippets & Personality

Before generating code from scratch, check the **live preview tool** for starting points. The preview tool at `docs/index.html` has templates organized by element and personality.

### Show the User Examples

If the user is unsure about their design vibe (intake question 3), point them to the preview tool:

> *"Take a look at the [live preview tool](docs/index.html) — try loading the same template in different personalities (Clean, Minimalist, Playful) to see which direction feels right for your project. You can also try the Effect buttons (Hushed, Bouncy, Frosted, Serif) for CSS overlays on any personality. Tell me which one resonates and we'll build from there."*

### Personality → Template Mapping

Templates live in `docs/presets/{element}/{personality}.html`. Each element can have multiple personality variants with genuinely different HTML structures (not just CSS changes):

| Personality | Visual Character | Best For | Availability |
|------------|-----------------|----------|-------------|
| **clean** | Standard Tailwind, rounded-xl, subtle shadows, system sans | Safe default, B2B SaaS, internal tools | All 41 elements |
| **minimalist** | No shadows, hairline borders, light fonts (300), extreme whitespace | Luxury, Japanese-inspired, portfolios, Scandinavian | Most elements (not the 3 clean-only ones) |
| **playful** | Big rounded corners (16-24px), colorful shadows, bouncy animations | Consumer apps, children's products, social platforms | Most elements (not the 3 clean-only ones) |
| **editorial** | Serif headings (Playfair Display), no shadows, fine borders, muted palette | Publishing, blogs, law firms, premium brands | form, landing only (use clean + serif for others) |

**Do NOT assume a given variant file exists — check `docs/presets/index.json` (the live source of truth) before referencing a preset path.** The 3 clean-only elements are agency-portfolio, app-showcase, and scroll-reveal-landing.

### Using Personality Templates

1. Based on intake question 3 (design vibe), select the matching personality
2. Load the template from `docs/presets/{element}/{personality}.html`
3. Use it as the HTML starting point — customize content, colors, and branding
4. The color theme switcher in the preview tool lets users explore color variations on any personality

### Preset Index

Also check [`docs/presets/_index.md`](docs/presets/_index.md) for component presets and composition recipes.

### Routing Priority

**Check the user's design intent first.** If they used words like "premium," "unique," "not generic," "personality," "stand out," "expressive," or described a specific visual style — skip the generic project-type table and go straight to **By Design Approach** below. The project-type table produces safe, standard layouts; the design-approach table produces distinctive, memorable ones.

### By Project Type

Use this table for standard app UIs where the user hasn't expressed a strong design preference:

| Project Type | Shell Preset | Component Presets |
|---|---|---|
| **Dashboard** | `shell-dashboard/` | `stats-row/`, `data-table/` |
| **Landing Page** | `shell-marketing/` | `hero/`, `feature-grid/`, `pricing-cards/`. *For premium/expressive landing pages, see Design Approach table: `product-launch/`, `saas-features/`, `agency-landing/`* |
| **Multi-Page App** | `shell-sidebar/` | See `project/` preset for a complete before/after example with Dashboard, Team, and Settings views |
| **Form / Wizard** | `shell-form/` | `form/` |
| **Internal Tool** | `shell-sidebar/` | `data-table/`, `tabs/` |
| **Login / Signup** | `shell-form/` | — |
| **Data Browser** | `shell-sidebar/` | `data-table/` or `card-grid/` |
| **E-commerce** | `shell-marketing/` | `card-grid/`, `hero/`. *For product pages, see `product-page/` in Design Approach table* |
| **Portfolio / Personal Site** | Use expressive templates: `personal-hero/`, `jdeworks-personal/`, or `scroll-story/` | See Design Approach table below |

### By Design Approach

For expressive, personality-driven, or creative projects, pick a starting template directly. Also check **Step 6 Design Profiles** for full token/component specs for each approach:

| Design Approach | Best For | Template Preset |
|---|---|---|
| Dark Premium / Dev | Dev tools, APIs, CLI tools | `devtool-landing/` or `product-launch/` |
| Minimal Editorial | Blogs, content-first sites, magazines | `editorial-blog/` |
| Friendly SaaS / Bento | Consumer SaaS, feature showcases | `saas-features/` |
| Immersive / Scroll | Portfolios, case studies, showcases | `scroll-story/` |
| Bold Creative | Agencies, studios, creative brands | `agency-landing/` |
| Typographic / Scroll-Driven Agency | Agency portfolios, studios with scroll effects | `agency-portfolio/` |
| Dark Warm / App-Centric | Fintech, app showcases, phone-first products | `app-showcase/` |
| Airy / Scroll-Reveal | Education, wellness, content platforms | `scroll-reveal-landing/` |
| E-commerce / Product | Product pages, launches | `product-page/` |
| Documentation | Technical docs, API refs, guides | `docs-site/` |
| Event / Conference | Events, meetups, launches | `event-page/` |
| Personal / Portfolio | Personal sites, developer portfolios | `personal-hero/` or `jdeworks-personal/` |

### Framework-Aware Selection

If the user's stack is **React**, **Vue**, or **Svelte**, check if a framework variant exists in the preset directory. See [`docs/presets/FRAMEWORKS.md`](docs/presets/FRAMEWORKS.md) for the full list. For Angular or other frameworks, use the HTML preset and follow the conversion guide.

### Using Presets

1. Start with the appropriate **shell** preset or **full-page** template
2. Drop **component presets** into the shell's content area
3. Customize colors, content, and branding for the user's project
4. Add interactivity (state, events) if using a framework variant

---

## Step 3: Generate Output

Adapt your output format to match the user's tech stack and situation.

### 3a. Design Tokens

Always provide design tokens first — they apply regardless of framework. Present them in whichever format matches the user's stack.

**Adapt tokens to the chosen personality and brand.** The blue-600 defaults below are a fallback. If the user provided brand colors (intake question 8) or chose a personality, replace the primary color. If using a personality template, extract the primary color from the template's HTML. Personality also affects non-color tokens:

| Token | Clean | Minimalist | Playful | Editorial |
|-------|-------|-----------|---------|-----------|
| Border radius | 8-12px | 2-4px | 16-24px | 1-2px |
| Shadow | subtle | none | colorful, multi-layer | none |
| Heading weight | 600-700 | 300 | 800 | 400-700 |
| Hover effect | color change | opacity fade | scale + lift | opacity/underline |
| Transition | 150ms ease | 200ms ease-out | 300ms bouncy | 200ms ease |

**CSS custom properties** (default, works everywhere):
```css
:root {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-secondary: #64748b;
  --color-success: #16a34a;
  --color-error: #dc2626;
  --color-warning: #d97706;
  --color-surface: #ffffff;
  --color-surface-alt: #f8fafc;
  --color-text: #0f172a;
  --color-text-secondary: #475569;
  --color-border: #e2e8f0;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --space-1: 0.25rem;  --space-2: 0.5rem;   --space-3: 0.75rem;
  --space-4: 1rem;     --space-6: 1.5rem;    --space-8: 2rem;
  --space-12: 3rem;    --space-16: 4rem;

  --radius-sm: 0.25rem;  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);

  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
}
```

**Tailwind config** (if using Tailwind):
```js
// tailwind.config.js additions — or use @theme in Tailwind v4
theme: {
  extend: {
    colors: {
      primary: { DEFAULT: '#2563eb', hover: '#1d4ed8' },
      // ...
    }
  }
}
```

**JavaScript object** (for CSS-in-JS, React Native, etc.):
```js
export const tokens = {
  color: { primary: '#2563eb', primaryHover: '#1d4ed8', /* ... */ },
  space: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px' },
  radius: { sm: '4px', md: '8px', lg: '12px' },
};
```

### 3b. Implementation

**When a relevant preset exists in `docs/presets/`**, use it as base code. Customize colors, content, and branding for the user's project rather than generating from scratch. If the user's framework has a variant (`.jsx`, `.vue`, `.svelte`) in the preset directory, use that version. For other frameworks, start from the HTML preset and convert per `docs/presets/FRAMEWORKS.md`.

Generate code in the user's framework/language:

**Plain HTML + Tailwind** (default for unknown stack):
- This knowledge base primarily uses [Tailwind CSS](https://tailwindcss.com) for all snippets and examples — it's the default output format when the user's stack is unknown or when they're starting from scratch
- Include Tailwind v4 CDN: `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>`
- Self-contained, single file
- Semantic HTML (`<header>`, `<main>`, `<nav>`, `<section>`)

**React / JSX:**
- Use `className` (not `class`)
- Respect their styling approach (Tailwind classes, CSS modules, styled-components, inline styles)
- If they use TypeScript, include proper types
- Export as a named component

**Vue SFC:**
- Use `<template>` / `<script setup>` / `<style scoped>` structure
- Use their styling approach (Tailwind, scoped CSS, etc.)

**Svelte:**
- Use `<script>` / markup / `<style>` structure
- Use their styling approach

**CSS-only** (if they just want styling help):
- Provide CSS that targets their existing HTML structure
- Use their existing class naming convention if visible
- Don't restructure their HTML unless the structure itself is the problem

**For any framework, always ensure:**
- Responsive: works at 320px, 768px, 1024px+
- Accessible: 4.5:1 contrast, 44px targets, visible focus states, semantic elements
- Consistent: spacing from a scale, type from a scale, colors from a palette
- Dark mode: `dark:` variants on all elements if user requested it (intake question 6)
- Performance: `loading="lazy"` on below-fold images, `<link rel="preconnect">` for font CDNs, `font-display: swap` for web fonts. See `typography/web-font-loading.md`

**For multi-page apps:** use a shared shell snippet (shell-sidebar or shell-marketing) as the consistent frame. Only the content area changes between pages. Reference the `project` preset in `docs/presets/` for a multi-page example with Dashboard, Team, and Settings views.

### 3c. Preview

After generating code, help the user see it:

- **Plain HTML / Tailwind** → suggest the make-it-look-good preview tool or pasting into a browser
- **React** → suggest running their dev server, or extracting the JSX into a standalone HTML file for preview
- **Any framework** → if they want a quick visual check, offer to generate a standalone HTML + Tailwind version of the same design for the preview tool, clearly labeled as "preview-only — use the [framework] code in your project"

---

## Step 4: Design Review Notes

**This is the most important deliverable.** Whether you audited existing code or designed from scratch, always generate a structured design review document. The user should save this alongside their code as a persistent reference.

### Template

Generate this as a markdown document. Fill in only the sections relevant to the consultation — don't include sections with nothing to say.

````markdown
# Design Review Notes

> Generated from [make-it-look-good](https://github.com/jdeworks/make-it-look-good) knowledge base

## Overview
- **What:** [Brief description of what was reviewed/designed]
- **Stack:** [Tech stack detected or stated]
- **Date:** [Current date]

## Design Decisions

### Color Palette
- Primary: `#hex` — [why this color]
- Secondary: `#hex` — [why]
- Neutrals: [palette used]
- Semantic: success `#hex`, error `#hex`, warning `#hex`
- Contrast ratios verified: [Yes/No, specifics]

### Typography
- Heading font: [font name] — [why]
- Body font: [font name] — [why]
- Scale: [ratio used, e.g., 1.25 Major Third]
- Body size: [size]px, line height: [value]
- Max line length: [value]

### Spacing System
- Base unit: [4px / 8px]
- Scale used: [list values, e.g., 4, 8, 12, 16, 24, 32, 48, 64]
- Component padding: [pattern]
- Section spacing: [pattern]

### Layout
- Grid: [system used]
- Breakpoints: [values]
- Container max-width: [value]
- Mobile behavior: [stacking, reflow, etc.]

### Dark Mode
- Strategy: [none / OS preference / toggle / both]
- Dark surface: `#hex` (e.g., slate-800 for cards, slate-900 for bg)
- Dark text: `#hex` (e.g., slate-100 for primary, slate-400 for secondary)
- Contrast verified: [Yes/No]

## Issues Found
[Only include if auditing existing code]

### Critical (Fix These First)
- [ ] **[Issue]** — [What's wrong, where, and why it matters]
  - Fix: [Specific change to make]
  - Reference: [link to relevant knowledge file]

### Important (Fix Soon)
- [ ] **[Issue]** — [What, where, why]
  - Fix: [Specific change]
  - Reference: [knowledge file]

### Nice to Have
- [ ] **[Issue]** — [What, where, why]
  - Fix: [Specific change]
  - Reference: [knowledge file]

## What's Working Well
[Call out things the existing design does right — reinforces good patterns]
- [Good thing 1]
- [Good thing 2]

## Implementation Checklist
[Actionable next steps in priority order]
- [ ] [Step 1 — highest impact change]
- [ ] [Step 2]
- [ ] [Step 3]
- [ ] ...

## Tokens & Values Quick Reference
[Paste the final token values here for easy copy-paste]

```css
:root {
  /* final tokens */
}
```

## Knowledge Files Referenced
- `[file]` — [what was used from it]
- `[file]` — [what was used from it]
````

### What Makes Good Review Notes

- **Specificity over generality** — "Change `padding: 10px` to `padding: 16px` on `.card`" not "improve spacing"
- **Explain _why_** — "16px aligns to the 4px spacing scale and matches the gap between form fields" not just "use 16px"
- **Prioritize** — Critical issues first (accessibility violations, broken layouts), cosmetic tweaks last
- **Acknowledge what's good** — If the existing code has good structure, say so. Users need to know what _not_ to change
- **Include the numbers** — Contrast ratios, pixel values, timing values. This is a reference document, not a vibes document
- **Make it actionable** — Every issue should have a concrete fix, not just a description of the problem

---

## Step 5: Tailwind Class Quick Reference

For users working with Tailwind. Skip this section if they're using a different framework.

### Spacing Scale (4px base)

| Token | Tailwind | Pixels | Use For |
|-------|----------|--------|---------|
| space-1 | `p-1`, `m-1`, `gap-1` | 4px | Icon-to-text gap |
| space-2 | `p-2`, `m-2`, `gap-2` | 8px | Compact inner padding, target spacing |
| space-3 | `p-3`, `m-3`, `gap-3` | 12px | Default inner padding |
| space-4 | `p-4`, `m-4`, `gap-4` | 16px | Card padding, form field spacing |
| space-6 | `p-6`, `m-6`, `gap-6` | 24px | Section padding, card body |
| space-8 | `p-8`, `m-8`, `gap-8` | 32px | Section separation |
| space-12 | `p-12`, `m-12`, `gap-12` | 48px | Page section spacing |
| space-16 | `p-16`, `m-16`, `gap-16` | 64px | Hero padding, major breaks |

### Type Scale

| Level | Tailwind | Size | Use For |
|-------|----------|------|---------|
| Caption | `text-xs` | 12px | Timestamps, metadata |
| Small | `text-sm` | 14px | Secondary text, labels |
| Body | `text-base` | 16px | Default body text |
| Large | `text-lg` | 18px | Lead paragraphs |
| Heading 4 | `text-xl` | 20px | Sub-section headings |
| Heading 3 | `text-2xl` | 24px | Section headings |
| Heading 2 | `text-3xl` | 30px | Page headings |
| Heading 1 | `text-4xl` | 36px | Hero headings |
| Display | `text-5xl` | 48px | Landing page hero |

### Touch Targets & Interactive

| Rule | Tailwind |
|------|----------|
| 44×44px minimum | `min-h-11 min-w-11` |
| 48×48px recommended | `min-h-12 min-w-12` |
| 8px spacing between targets | `gap-2` |
| Button padding | `px-4 py-2` (minimum `px-3 py-2`) |
| Focus ring | `focus:ring-2 focus:ring-blue-500 focus:outline-none` |
| Transition | `transition-colors duration-150` |

### Colors (Accessibility-Safe Defaults)

| Role | Light Mode | Dark Mode | Tailwind |
|------|-----------|-----------|----------|
| Text primary | `#0f172a` | `#f1f5f9` | `text-slate-900 dark:text-slate-100` |
| Text secondary | `#475569` | `#94a3b8` | `text-slate-600 dark:text-slate-400` |
| Background | `#ffffff` | `#0f172a` | `bg-white dark:bg-slate-900` |
| Surface | `#f8fafc` | `#1e293b` | `bg-slate-50 dark:bg-slate-800` |
| Border | `#e2e8f0` | `#334155` | `border-slate-200 dark:border-slate-700` |
| Primary | `#2563eb` | `#3b82f6` | `bg-blue-600 dark:bg-blue-500` |
| Error | `#dc2626` | `#f87171` | `text-red-600 dark:text-red-400` |
| Success | `#16a34a` | `#4ade80` | `text-green-600 dark:text-green-400` |

### Common Component Patterns

| Pattern | Tailwind Classes |
|---------|-----------------|
| Card | `bg-white rounded-lg shadow-sm border border-slate-200 p-6` |
| Section spacing | `py-12 md:py-16 lg:py-20` |
| Container | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` |
| Button (primary) | `bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-150 min-h-11` |
| Button (secondary) | `border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors duration-150 min-h-11` |
| Input field | `w-full border border-slate-300 rounded-lg px-3 py-2 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11` |
| Nav link | `text-slate-600 hover:text-slate-900 font-medium px-3 py-2 rounded-md transition-colors duration-150` |
| Badge | `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium` |

---

## Step 6: Design Profiles

Preset starting points for common project types. Use these as defaults, then customize based on intake answers.

### SaaS Dashboard
```
Colors: Blue primary (#2563eb), slate neutrals
Typography: Inter or system-ui, 14px base for dense data
Layout: Sidebar nav (240px), 12-column grid, 16px gutters
Spacing: 4px base, compact (py-1.5 for table rows)
Components: Sidebar, data table, stat cards, charts, breadcrumbs
Dark mode: Yes (users often prefer it)
```

### Landing Page
```
Colors: Brand primary, high-contrast CTA (often orange/green on blue)
Typography: Display font for headings, 18px body, generous line height (1.6)
Layout: Single column hero, alternating left-right sections, full-width
Spacing: 8px base, generous (py-16 to py-24 between sections)
Components: Hero, feature grid, testimonials, pricing cards, CTA, footer
Dark mode: Optional
```

### Form / Internal Tool
```
Colors: Neutral palette, blue for interactive, red for errors
Typography: System-ui, 16px base, clear label hierarchy
Layout: Single column forms (max-w-lg), sidebar for navigation
Spacing: 4px base, moderate (gap-4 between fields, gap-8 between sections)
Components: Input fields, selects, radio/checkbox, validation, buttons
Dark mode: Match OS preference
```

### Card Grid (E-commerce, Content)
```
Colors: Minimal chrome, product images are the hero
Typography: 16px body, bold prices, truncated titles (line-clamp-2)
Layout: Responsive grid (1 col mobile, 2-3 tablet, 4 desktop), gap-4 to gap-6
Spacing: 4px base, consistent card padding (p-4)
Components: Product cards, filters sidebar, pagination, search
Dark mode: Usually no (images look better on white)
```

### Email Template
```
Colors: Brand colors, high contrast (email clients vary wildly)
Typography: System fonts only (16px body, 22-28px headings)
Layout: Single column, max-width 600px, table-based for compatibility
Spacing: Generous (20-30px between sections), padding via table cells
Components: Header with logo, CTA button (not link), footer with unsubscribe
Dark mode: Include dark mode meta tag + inverted-colors-safe palette
```

### Editorial Blog
```
Colors: Minimal — grayscale with one accent color
Typography: Playfair Display for headings, Inter or system for body, 18px body
Layout: Single column, 640-720px max-width, extreme whitespace (96-128px sections)
Spacing: 8px base, very generous
Components: Article with pull quote, byline, related articles, newsletter CTA
Dark mode: Optional
Template: docs/presets/editorial-blog/
```

### SaaS Feature Showcase
```
Colors: Violet/blue primary, warm accents per feature
Typography: Inter or Sora, 16px body, bold headings
Layout: Bento grid (4-col with spanning), responsive collapse
Spacing: 8px base, generous cards
Components: Bento features, testimonials, email signup, pricing
Dark mode: Yes
Template: docs/presets/saas-features/
```

### Developer Tool Landing
```
Colors: Dark slate-950 base, cyan/blue accent, high-saturation glow
Typography: Space Grotesk headings, JetBrains Mono for code, 16px body
Layout: Full-width hero with gradient mesh, centered content
Spacing: 8px base, generous (py-24/py-32 sections)
Components: Terminal code block, feature grid, pricing, testimonials
Dark mode: Always dark
Template: docs/presets/devtool-landing/
```

### Documentation Site
```
Colors: Indigo primary, neutral sidebar
Typography: Inter or system, JetBrains Mono for code, 16px body
Layout: Sidebar nav + content + optional TOC, responsive collapse
Spacing: 4px base, moderate density
Components: Sidebar nav, breadcrumbs, code blocks, callout boxes, tables
Dark mode: Yes (users expect it)
Template: docs/presets/docs-site/
```

### Event / Conference
```
Colors: Amber/orange primary (or brand), gradient CTAs
Typography: Space Grotesk or bold sans-serif, 16px body
Layout: Full-width hero, speaker grid, timeline schedule
Spacing: 8px base, generous
Components: Speaker cards, schedule timeline, ticket tiers, sponsors
Dark mode: Optional
Template: docs/presets/event-page/
```

### Product Page (E-commerce)
```
Colors: Product-derived palette, dark/light section alternation
Typography: Inter or system, 16px body
Layout: Full-bleed hero, spec grid, feature sections
Spacing: 8px base, section-based
Components: Product image, specs, features, reviews, related products
Dark mode: Optional
Template: docs/presets/product-page/
```

### Scroll-Driven Portfolio
```
Colors: Emerald/brand accent, gradient reveals
Typography: Space Grotesk, 16px body
Layout: Full-viewport sections, scroll-triggered reveals
Spacing: Full-screen sections (min-h-screen)
Components: Hero, project showcases, about, contact CTA
Dark mode: Yes
Template: docs/presets/scroll-story/ or docs/presets/jdeworks-personal/
```

### Agency Portfolio (Typographic / Scroll-Driven)
```
Colors: Teal primary (#3C6269), lavender accent (#CDD5FA), slate neutrals
Typography: System sans / Inter, 18px body, giant display logo (12vw hero)
Layout: Full-height hero with scroll-shrink logo, two-column services, offset project grid
Spacing: 8px base, very generous (py-24/py-32 sections)
Components: Scroll-shrink logo, horizontal marquee, service list, project cards, stats, CTA
Scroll effects: Logo interpolates from giant to small fixed (single element), reveal animations
Dark mode: Yes
Template: docs/presets/agency-portfolio/
```

---

## Step 7: Iteration & Visual Feedback

### Iteration Loop
1. Classify input → 2. Audit or intake → 3. Read knowledge files → 4. Generate design review notes + code → 5. User previews → 6. User gives feedback → 7. Adjust → 8. Repeat from 5

### Handling Feedback
Common user feedback and how to respond:

| Feedback | What to Adjust |
|---|---|
| "Too much whitespace" | Reduce section spacing by one step (e.g., `py-16` → `py-12`), but don't go below readable minimums |
| "Feels cramped" | Increase spacing by one step, add more margin between sections |
| "The blue is too bright" | Shift to a darker shade (600→700) or reduce saturation |
| "It looks boring" | Add one accent color, increase contrast between heading/body sizes, add subtle shadows |
| "Too many colors" | Reduce to primary + neutral + one semantic color, use shades instead of hues |
| "The font is weird" | Switch to system-ui or Inter — safe defaults that work everywhere |
| "It doesn't look professional" | Tighten spacing, reduce border-radius (rounded-lg → rounded-md), mute colors, use system fonts |
| "Make it pop more" | Increase size contrast between heading and body, add visual weight to CTAs, use whitespace to create focus |
| "It doesn't work on my phone" | Check responsive breakpoints, sidebar collapse, grid columns, touch targets, padding scaling |
| "The text is hard to read" | Check contrast ratio (4.5:1), font size (≥16px body), line height (1.4-1.6), line length (≤75ch) |
| "It loads slowly" | Add `loading="lazy"` on images, `<link rel="preconnect">` for fonts, subset web fonts, use system fonts as fallback |
| "I want it darker/lighter" | Adjust the overall color scheme — toggle dark mode, or shift the neutral scale (warmer stones vs cooler slates) |
| "It all looks the same" | Switch personality (minimalist → playful, or vice versa). Change the primary color via color theme. Vary spacing density. |

### Screenshot Tools
- **Preview Tool** — paste HTML into the make-it-look-good preview tool for quick visual check
- **Browser DevTools** — responsive mode for testing breakpoints
- **LLM screenshot** — if the platform supports it (Claude desktop, Cursor, etc.), take one to review

---

## Before/After Examples

The preview tool includes before/after examples for key UI patterns. Use these to show users what "good design" looks like compared to typical MVP output:
- Dashboard: [Before](docs/index.html#preset:dashboard/before) → [After](docs/index.html#preset:dashboard/clean)
- Landing Page: [Before](docs/index.html#preset:landing/before) → [After](docs/index.html#preset:landing/clean)
- Form: [Before](docs/index.html#preset:form/before) → [After](docs/index.html#preset:form/clean)
- Card Grid: [Before](docs/index.html#preset:cards/before) → [After](docs/index.html#preset:cards/clean)
- Multi-Page App: [Before](docs/index.html#preset:project/before) → [After](docs/index.html#preset:project/clean)

Each "after" has multiple personality variants (Clean, Minimalist, Playful) accessible via the personality buttons in the preview header.

## Validated Test Cases

The `tests/` directory contains end-to-end validations of this consultation flow with real code:

| Test Case | Input Stack | What It Proves |
|---|---|---|
| `test-case-1-react-settings` | React + inline styles | Flow works for React, outputs JSX (no forced Tailwind migration) |
| `test-case-2-barebones-html` | Plain HTML + CSS | Flow works for bare HTML, suggests Tailwind CDN, full redesign |
| `test-case-3-vue-dashboard` | Vue 3 SFC + scoped CSS | Flow works for Vue, outputs Vue SFC (preserves `<style scoped>`) |

Each test case has:
- **Input file** — realistic "old" code a real user would bring
- **Review file** (`*-review.md`) — the design review notes generated by following this playbook
- **After file** — the improved code in the user's original framework

Use these to calibrate your output quality and verify the flow works.
