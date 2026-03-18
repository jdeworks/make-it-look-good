# Consultation Flow Audit TODO

> Generated: 2026-03-18

## Summary
- 4 critical gaps (flow produces broken/inaccessible output or sends LLM down wrong path)
- 9 important gaps (flow produces subpar output)
- 8 minor gaps (missing guidance, could be better)
- 5 consistency issues

---

## Critical Gaps

### [Step 2.5 / Personality] Glass personality is documented but does not exist
CONSULT.md Step 2.5 lists "glass" as a personality with description "Frosted blur surfaces, gradient backgrounds, translucent borders" and marks it as suitable for "Modern SaaS, creative tools, product showcases." Step 1C question 3 also lists "Glass/Modern" as a design vibe option. However, **zero glass preset files exist** anywhere in `docs/presets/`. An LLM following the flow would try to load `docs/presets/{element}/glass.html`, fail, and either hallucinate a glass design or fall back silently.
- [ ] Either create glass personality presets for at least the core elements (dashboard, landing, form, cards, shell-sidebar, hero), OR remove "glass" from CONSULT.md Step 1C question 3 and the Step 2.5 personality table

### [Step 2.5 / Personality] Editorial personality barely exists (2 of 27 elements)
CONSULT.md lists "editorial" as a full personality option. Only `form/editorial.html` and `landing/editorial.html` exist. An LLM asked to build an editorial dashboard, card grid, or shell has no preset to start from.
- [ ] Either expand editorial presets to cover at least: dashboard, cards, project, shell-sidebar, hero, stats-row — OR mark editorial as "limited availability" in the personality table and note which elements have it

### [Step 1C / Personality] Bold personality listed in intake but has zero presets
Step 1C question 3 lists "Bold — sharp/zero-radius corners, heavy font weights, offset shadows, uppercase headings, high contrast" as a design vibe option. There are **no bold personality presets** at all. The recent commit message "remove Bold style" confirms it was deliberately removed, but the intake question still offers it.
- [ ] Remove "Bold" from Step 1C question 3, OR re-create bold presets. If removing, update the description of other personalities to cover the bold use cases (e.g., note that "clean" with zero-radius and heavy weights can achieve a bold look)

### [Step 1A / Audit] No guidance on script safety or XSS in user-submitted HTML
When auditing existing code that gets loaded into the preview tool (which uses `srcdoc` + `sandbox="allow-scripts"`), there is no checklist item for checking whether user code contains `<script>` tags that could cause issues. The preview tool sandboxes scripts but CONSULT.md doesn't tell the LLM to warn users about script content or sanitization.
- [ ] Add a checklist item under "Semantic HTML & Accessibility" in Step 1A: "Does the HTML contain inline `<script>` tags? If loading in the preview tool, scripts execute in the sandbox. Warn the user if scripts make network requests or modify `document.cookie`"

---

## Important Gaps

### [Step 2.5] No guidance on how personality affects design tokens
CONSULT.md tells the LLM to select a personality and load the template, but Step 3a (Design Tokens) always shows the same blue-600/slate defaults. There is no mapping from personality to token values. An LLM would generate playful HTML but provide clean tokens.
- [ ] Add a personality-to-token table in Step 3a showing how border-radius, shadow style, font weight, animation timing, and spacing density change per personality. Example: playful = rounded-2xl, shadow-lg with color, font-bold headings, 300ms bouncy transitions; minimalist = rounded-none or rounded-sm, no shadows, font-light headings, 150ms subtle transitions

### [Step 2.5] Personality table doesn't match actual preset availability
The personality table in Step 2.5 shows 5 personalities (clean, minimalist, playful, glass, editorial). The actual presets are almost exclusively clean/minimalist/playful. The index.json has some elements with only clean, and the "before" variants are separate. An LLM consulting the table gets a false picture.
- [ ] Add a note: "Not all personalities are available for all elements. Check `docs/presets/index.json` for the actual manifest. If a personality file doesn't exist for the requested element, use the 'clean' variant as base and apply the personality's visual characteristics manually"

### [Step 1C] No question about content volume or data density
The intake asks what they're building and who uses it, but never asks "How much content/data will be on screen?" A dashboard with 3 metrics and a dashboard with 50 rows of data need fundamentally different spacing, font sizes, and layout approaches. The Design Profiles (Step 6) hint at this (14px base for dashboards) but the intake doesn't surface it.
- [ ] Add intake question: "How data-dense is this? (a) Light — few items, generous whitespace (b) Medium — standard content amount (c) Dense — lots of data/metrics/rows visible at once." Use this to adjust spacing system (4px compact vs 8px generous) and base font size

### [Step 2] Knowledge file matrix is missing several files
The Step 2 matrix doesn't reference these existing files anywhere:
  - `foundations/aesthetic-usability.md` — never referenced
  - `foundations/peak-end-rule.md` — never referenced
  - `foundations/fitts-law.md` — only indirectly relevant via touch-targets
  - `systems/building-a-system.md` — never referenced
  - `systems/material-design-3.md` — never referenced
  - `systems/apple-hig.md` — never referenced
  - `responsive/responsive-patterns.md` — never referenced
  - `responsive/breakpoints.md` — never referenced
  - `typography/web-font-loading.md` — never referenced
  - `heuristics/ux-frameworks.md` — never referenced
- [ ] Add these to the By Project Type or By Pain Point tables where relevant. For example: `systems/building-a-system.md` under "Inconsistent" pain point; `typography/web-font-loading.md` under Content Site and Landing Page; `responsive/breakpoints.md` under Mobile App; `heuristics/ux-frameworks.md` under "Hard to use" pain point

### [Step 2] No matrix entry for Portfolio / Personal Site
Step 1C question 1 lists "Portfolio / personal site" as a project type, but Step 2's By Project Type table has no entry for it. An LLM would have to guess which knowledge files to read.
- [ ] Add a Portfolio row: Always Read: `typography/font-pairing.md`, `layout/visual-hierarchy.md`, `layout/whitespace.md`. Also Read: `color/color-systems.md`, `interaction/animation-timing.md`

### [Step 3] No guidance on container max-width selection
Step 3 doesn't explain when to use `max-w-7xl` (1280px) vs `max-w-5xl` (1024px) vs `max-w-3xl` (768px) vs `max-w-lg` (512px). The quick-reference file says "1200-1440px" for content max-width but that's a wide range. Different page types need different widths.
- [ ] Add a container width decision tree to Step 3 or Step 5: full-width dashboard = `max-w-full` or `max-w-[1440px]`; marketing page = `max-w-7xl`; blog/article = `max-w-3xl` or `max-w-prose`; form = `max-w-lg`; centered card = `max-w-md`

### [Step 3] Default tokens always show blue-600 regardless of personality or brand
Step 3a provides a single set of design tokens with `--color-primary: #2563eb` (blue-600). If the user chose a warm/playful vibe or provided brand colors, the LLM still sees this blue default first. There's no instruction to adapt tokens to the chosen personality or brand colors.
- [ ] Add explicit instruction: "If the user provided brand colors (intake question 7) or chose a non-default personality, replace the primary color in the tokens. If using a personality template, extract the primary color from the template's HTML. The blue-600 default is a fallback, not a requirement"

### [Step 4] Design Review Notes template has no dark mode section
The review template covers Color Palette, Typography, Spacing, Layout but has no dedicated Dark Mode section. Given that dark mode is a specific intake question (question 5) and a full audit checklist section, the review notes should explicitly document dark mode decisions.
- [ ] Add a "### Dark Mode" subsection under Design Decisions in the Step 4 template: "Strategy: [none / OS preference / toggle / both], Dark surface: `#hex`, Dark text: `#hex`, Contrast verified: [yes/no]"

---

## Minor Gaps

### [Step 1A] Checklist missing: page wrapper / full-viewport background
The audit checklist has "Does the page have a `min-h-screen` wrapper with a background color?" (line 57), which is good. But it doesn't check for the inverse problem: elements that bleed outside the viewport causing horizontal scroll. Missing check for `overflow-x-hidden` on body or main wrapper.
- [ ] Add to Spacing & Layout: "Is there horizontal overflow at any breakpoint? Check for elements wider than viewport (common with absolute positioning or fixed-width elements)"

### [Step 1A] Checklist missing: font loading strategy
No checklist item for whether web fonts are loaded efficiently (preconnect, font-display: swap, FOUT/FOIT handling). The knowledge file `typography/web-font-loading.md` exists but is never referenced.
- [ ] Add to Typography section: "Are web fonts loaded with `font-display: swap`? Is there a `<link rel='preconnect'>` for the font CDN?"

### [Step 1D] No guidance on sanitizing user data before rendering
When structuring raw content (JSON, CSV, CLI output) into HTML, there's no mention of escaping HTML entities in user-provided data. If someone pastes JSON with `<script>` in a string value and the LLM renders it as HTML, it could create XSS.
- [ ] Add to Step 1D: "When rendering user-provided data as HTML, ensure text content is escaped. In templates: use `textContent` not `innerHTML`, or HTML-encode angle brackets"

### [Step 7] Feedback table is useful but incomplete
The iteration feedback table handles 8 common feedback types but misses: "It doesn't work on my phone" (responsive debugging), "The text is hard to read" (contrast/font size/line length), "It loads slowly" (font loading, image optimization), "I want it darker/lighter" (adjusting the entire color scheme).
- [ ] Add 4-5 more feedback rows covering responsive issues, readability complaints, performance, and light/dark theming requests

### [Step 6] Design Profiles don't mention personality system
Step 6 provides preset starting points for project types (SaaS Dashboard, Landing Page, Form, etc.) but doesn't cross-reference the personality system from Step 2.5. These profiles all describe a "clean" aesthetic. An LLM that reads Step 6 might ignore the personality choice made in Step 1C.
- [ ] Add a note to Step 6: "These profiles describe the 'clean' personality defaults. Adjust border-radius, shadow style, font weight, and spacing density based on the personality selected in Step 2.5"

### [CONSULT.md] No guidance on multi-page consistency
Step 1C asks what they're building but doesn't address multi-page apps. When someone says "I need a dashboard with settings, users list, and detail pages," there's no guidance on maintaining consistent navigation, header, spacing, and color across pages. The `project` preset in docs/presets demonstrates multi-page but CONSULT.md doesn't reference it.
- [ ] Add guidance in Step 3: "For multi-page apps: use a shared shell snippet (sidebar-topbar or marketing-page) as the consistent frame. Only the content area changes between pages. Reference the `project` preset for a multi-page example"

### [CONSULT.md] No performance considerations mentioned anywhere
No mention of image optimization (`loading="lazy"`, `srcset`, WebP), font subsetting, or bundle size awareness. For landing pages and content sites, these matter for real-world usage.
- [ ] Add a brief performance note to Step 3b: "For production use: add `loading='lazy'` to below-fold images, use `<link rel='preconnect'>` for font CDNs, consider `srcset` for responsive images. See `typography/web-font-loading.md` for font loading strategy"

### [snippets/_index.md] Svelte variants not listed
The _index.md file only shows React and Vue columns in its framework tables. Svelte variants exist for 10 components in `snippets/svelte/` but aren't listed in _index.md. FRAMEWORKS.md correctly lists them.
- [ ] Add a Svelte column to the tables in _index.md, or add a note: "Svelte 5 variants available for 10 components — see FRAMEWORKS.md for the full list"

---

## Consistency Issues

### [CONSULT.md vs index.json] Personality names mismatch
CONSULT.md Step 1C lists 7 vibes: Clean, Minimalist, Bold, Playful, Glass/Modern, Editorial/Premium, Dark & technical. The actual presets in index.json have: before, clean, minimalist, playful, editorial. "Bold" was removed (per commit 384d3d4). "Glass" never existed. "Dark & technical" is not a personality but a color scheme choice. This creates confusion about what's a personality vs a color theme vs a vibe.
- [ ] Align Step 1C question 3 with the actual personality system: clean, minimalist, playful, editorial (and glass if created). Move "Dark & technical" to a separate note about dark color schemes that can apply to any personality. Remove "Bold" or re-add it

### [CONSULT.md vs CLAUDE.md] CLAUDE.md says "blue-600 primary, slate neutrals" for all snippets; personality system disagrees
CLAUDE.md maintenance rules state: "Every snippet needs... consistent design tokens (blue-600 primary, slate neutrals)." But the personality system and preset system use different primary colors (rose for playful, indigo for editorial, amber for restaurant, emerald for portfolio). The rule about blue-600 applies to the `snippets/` folder (which is all clean personality), but could mislead an LLM into thinking all output must be blue.
- [ ] Clarify in CLAUDE.md: "The blue-600/slate defaults apply to the base snippets in `snippets/`. The `docs/presets/` personality variants use different color palettes appropriate to their personality and element type"

### [CONSULT.md vs README.md] README says "20+ prebuilt templates" but there are 27 elements x ~3 personalities = 80+ presets
The README says "Includes 20+ prebuilt templates to try" which significantly understates the current count. Not critical but could confuse users about the scope.
- [ ] Update README to reflect actual count, or use a vaguer phrase like "dozens of prebuilt templates"

### [CONSULT.md Steps] Step numbering creates confusion between consultation steps and snippet steps
CONSULT.md goes: Step 0, 1A/B/C/D, 2, 2.5, 3, 4, 5, 6, 7. Step 2.5 was clearly inserted later. Step 5 (Tailwind Quick Reference) and Step 6 (Design Profiles) are reference sections, not sequential steps. Step 7 (Iteration) is the actual next step after Step 4. This makes the flow harder to follow.
- [ ] Consider renaming: Steps 0-4 stay as "Steps" (the actual flow). Steps 5-6 become "Appendix A: Tailwind Quick Reference" and "Appendix B: Design Profiles." Step 7 becomes "Step 5: Iteration." Or at minimum, add a note at the top clarifying that Steps 5-6 are reference material, not sequential steps

### [CONSULT.md vs actual presets] Templates section references wrong folder
CONSULT.md line 673-679 references `templates/dashboard-before.html` etc. These exist. But the same before/after pairs also exist in `docs/presets/` (e.g., `docs/presets/dashboard/before.html`, `docs/presets/dashboard/clean.html`). It's unclear which is the canonical version and whether they're identical or different files.
- [ ] Clarify the relationship: `templates/` = standalone before/after HTML files for offline viewing. `docs/presets/` = preset files loadable in the preview tool. Document whether they're the same content or separate

---

## What's Working Well

- **Step 0 input classification is thorough.** The 5 input types cover realistic scenarios. The tech stack detection table is practical and includes good signals (not just framework names but actual code patterns like `className=`, `v-bind`, `{#if}`).
- **Step 1A audit checklist is comprehensive.** 40+ specific items across 8 categories, with concrete pass/fail criteria. The responsive/mobile section is particularly strong.
- **Step 1D (Structure Raw Content) is a genuine differentiator.** Most design guides assume visual input. Handling JSON, CLI output, and markdown as input types is valuable and the test cases prove it works.
- **Step 2 knowledge file matrix is well-organized.** The By Project Type and By Pain Point tables give clear routing. The "Always Read" directive for quick-reference.md is smart.
- **Step 4 Design Review Notes template is excellent.** The template is actionable, prioritized, and includes both problems and "what's working well." The guidance about specificity ("Change `padding: 10px` to `padding: 16px`" not "improve spacing") is exactly right.
- **Test coverage is strong.** 12 test cases covering all 4 input paths (1A, 1C, 1D), multiple frameworks (React, Vue, plain HTML), multiple vibes (clean, dark, warm, playful), and edge cases (email, minimal input, CLI output). All pass rules compliance.
- **The snippet system is well-structured.** 34 HTML snippets with 15 having React/Vue/Svelte variants. The composition recipes showing how to combine snippets into full pages are practical. The FRAMEWORKS.md conversion guide covers 4 frameworks with real code patterns.
- **The flow correctly routes rather than dumps.** Step 2 says "Read the minimum set needed" rather than loading everything. This is essential for LLM context management.
- **Step 7 feedback handling table is practical.** Mapping common subjective complaints ("too much whitespace", "it looks boring") to specific Tailwind adjustments is exactly what an LLM needs.
