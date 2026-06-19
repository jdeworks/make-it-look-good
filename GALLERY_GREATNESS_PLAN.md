# Gallery Greatness Plan

Purpose: make the `make-it-look-good` template gallery feel like a polished product, not just a code editor with a dropdown. This document is intended to be handed to a clean Codex/LLM session as the implementation brief.

## Current State

- The gallery lives in `docs/index.html`, `docs/app.js`, and `docs/style.css`.
- Presets live under `docs/presets/<element>/<variant>.html`.
- The authoritative manifest is `docs/presets/index.json`.
- The analyzer can already score rendered templates deterministically.
- The gallery already supports:
  - preset loading through `#preset:<element>/<variant>`
  - personality variants
  - color swatches
  - visual effects
  - viewport switching
  - dark mode
  - preview analysis handoff
  - share links / code copy

The gap: users still have to know what they want. The gallery should guide discovery, comparison, trust, and LLM handoff.

## Product Goal

Turn the gallery into a guided design selection and agent handoff surface:

1. Find the right template fast.
2. Compare variants without relying on memory.
3. See objective score/trust signals.
4. Export the selected direction to an AI coding agent.
5. Add enough template variety that users can find a close starting point more often.

## Parallel Agent Instructions

Start a clean session by spawning multiple agents in parallel. Use disjoint write scopes.

Recommended split:

- Agent A, `gallery-discovery-ui`
  - Owns `docs/index.html`, `docs/app.js`, `docs/style.css`.
  - Build visual template picker, filters, and first-run chooser.

- Agent B, `agent-handoff-export`
  - Owns `docs/app.js`, any new docs/presets metadata fields, and optional export helper files.
  - Build Agent Pack / Copy Prompt / Copy Markdown export.
  - Coordinate with Agent A before editing shared areas in `docs/app.js`.

- Agent C, `preset-metadata-and-new-templates`
  - Owns `docs/presets/index.json`, new preset files under `docs/presets/`, and `docs/presets/_index.md`.
  - Adds metadata and new templates.

- Agent D, `score-badges-and-validation`
  - Owns score artifacts/scripts only after reading `PRESET_SCORE_MATRIX_PLAN.md`.
  - Produces `docs/presets/scores.json` or an equivalent generated artifact.
  - Does not edit preset HTML unless given a filtered issue list.

Main agent responsibilities:

- Keep write scopes from colliding.
- Review and integrate patches.
- Run focused smoke tests after each slice.
- Run the full deterministic score matrix only when enough implementation is merged, because it will take a long time.

## Implementation Slices

### Slice 1: Rich Gallery Picker

Add an expanded visual picker while keeping the current dropdown for power users.

Features:

- Template cards with:
  - thumbnail
  - element label
  - category
  - available personalities
  - best-for text
  - framework support badges if framework files exist
  - score badge once `scores.json` exists
  - `Start with this` button
- Filters:
  - Landing
  - Dashboard / App
  - Form
  - Component
  - Full Page
  - Expressive
  - Before / After
  - Has React
  - Has Vue
  - Has Svelte
- Search should match:
  - manifest key
  - label
  - tags
  - best-for text

Implementation notes:

- Extend `docs/presets/index.json` carefully. Keep backward compatibility with existing `categories` and `elements`.
- Suggested optional fields per element:

```json
{
  "label": "DevTool Landing",
  "description": "Technical product landing page for developer tools.",
  "kind": "landing",
  "tags": ["developer", "saas", "technical", "marketing"],
  "bestFor": ["CLI tools", "API products", "open-source SaaS"],
  "frameworks": ["html", "react", "vue", "svelte"],
  "thumbnail": "presets/devtool-landing/thumb.webp",
  "personalities": {
    "clean": { "primaryColor": "cyan" }
  }
}
```

- Do not break existing app code that expects `personalities` to be present.

### Slice 2: First-Run Find My Template Chooser

Add a short guided chooser for users who do not know which preset to pick.

Questions:

- What are you building?
  - Landing page
  - App / dashboard
  - Form / onboarding
  - Docs / content
  - Portfolio
  - Product page
  - Component
- Who is it for?
  - Developers
  - Business users
  - General public
  - Mobile-first consumers
- Personality?
  - Clean
  - Minimalist
  - Playful
  - Editorial
  - Dark technical
- Need framework code?
  - HTML
  - React
  - Vue
  - Svelte

Output:

- Ranked top 3 presets.
- Each recommendation should show a short rationale.
- Direct load button.
- Deep-link state like `#recommend:landing,developers,clean`.

Rules:

- Do not block expert users. Add a clear dismiss path.
- Store dismissed state in `localStorage`.
- Keep mobile usable.

### Slice 3: Agent Pack / LLM Handoff

Add an `Agent Pack` button for the current preset.

The copied/generated markdown should include:

- Preset id: `element/variant`
- Source path: `docs/presets/<element>/<variant>.html`
- Raw GitHub URL:
  - `https://raw.githubusercontent.com/jdeworks/make-it-look-good/dev/docs/presets/<element>/<variant>.html`
- Available variants from `index.json`
- Selected accent color
- Selected effect
- Dark mode state
- Intended use if known from chooser
- Recommended knowledge files:
  - layout/visual-hierarchy.md
  - layout/spacing-system.md
  - typography/type-scale.md
  - color/contrast-and-accessibility.md
  - interaction/touch-targets.md
  - responsive/mobile-first.md
  - component-specific file when relevant
- Instructions:
  - Use this preset as the starting point.
  - Customize content and brand.
  - Preserve spacing, contrast, hierarchy, responsive behavior, and accessible structure.
  - Match the target project stack.
  - Generate Design Review Notes.

Export formats:

- Copy Agent Prompt
- Copy Markdown
- Copy HTML
- Download `.html`
- Optional: Copy React/Vue/Svelte conversion prompt

### Slice 4: Comparison Mode

Add comparison affordances.

Must-have:

- Before/after toggle for elements that have a `before` variant.
- Personality comparison matrix for available variants.
- At least a simple side-by-side mode for desktop.

Nice-to-have:

- Design decision notes:
  - density
  - radius
  - shadows
  - typography
  - color temperature
  - interaction style

### Slice 5: Score Badges

Use `PRESET_SCORE_MATRIX_PLAN.md` to generate deterministic score data.

Display:

- Current preset score.
- Variant score in picker cards.
- Before/after delta where applicable.
- Warning when a selected color/effect/viewport combination drops below threshold.

Do not hardcode scores in the app. Generate a JSON artifact.

Suggested artifact:

```text
docs/presets/scores.json
```

### Slice 6: More Templates

Add more variety similar to the existing preset quality level.

Important rules:

- Add presets through `docs/presets/index.json`.
- Each new element should have at least `clean`, `minimalist`, and `playful` unless there is a strong reason not to.
- For high-value interactive components, add React/Vue/Svelte variants where feasible.
- Avoid one-note palettes.
- Keep responsive behavior first-class.
- Run deterministic scores after adding.

Recommended new template groups:

1. `auth-flow`
   - sign in, sign up, forgot password, MFA card
   - useful for SaaS and internal tools

2. `onboarding-wizard`
   - multi-step setup flow
   - progress, form sections, review step

3. `settings-billing`
   - account settings, plan card, payment method, invoices
   - common app page missing from many template sets

4. `analytics-dashboard`
   - charts placeholders, KPI cards, filters, table
   - more data-heavy than current dashboard

5. `ai-chat-app`
   - chat layout, prompt input, side history, response cards
   - relevant for AI builders

6. `marketplace-listing`
   - card grid, filters, detail preview
   - useful for directories and marketplaces

7. `docs-api-reference`
   - sidebar, endpoint cards, code samples, params table
   - developer-focused

8. `changelog-roadmap`
   - timeline, status tags, vote/upcoming sections
   - OSS/SaaS common need

9. `mobile-app-landing`
   - app store CTAs, phone mockup area, feature rows
   - marketing page variant

10. `case-study`
   - hero, metrics, narrative sections, testimonial, CTA
   - portfolio/agency/product proof

11. `empty-states`
   - empty, loading, error, success states
   - component set useful for real apps

12. `command-palette`
   - modal command UI with groups and keyboard hint styling
   - high leverage for developer/internal tools

### Slice 7: Mobile Gallery Mode

Make mobile primarily browse/share rather than edit.

Changes:

- Keep preview as default.
- Add mobile-visible Share / Agent Pack.
- Keep code behind `HTML` tab.
- Add previous/next swipe or obvious template nav.

## Quality Gates

Before merging a major gallery slice:

- `node --check docs/app.js`
- `npx playwright test tests/html-analysis.spec.js`
- Smoke test:
  - load `index.html`
  - open template picker
  - load a preset
  - switch personality
  - change color
  - apply effect
  - toggle dark mode
  - switch mobile/desktop viewport
  - copy Agent Pack

Before claiming the gallery is fantastic:

- Run full deterministic matrix from `PRESET_SCORE_MATRIX_PLAN.md`.
- Fix all critical combinations below threshold.
- Generate updated `scores.json`.
- Update README validation numbers.

## Success Criteria

The gallery is great when:

- A first-time user can find a relevant preset in under 30 seconds.
- A user can understand why a preset is good without opening the analyzer.
- A user can hand the exact selected direction to an AI agent in one copy action.
- Most combinations of template, variant, viewport, color, dark mode, and effect score acceptably.
- The gallery is useful on mobile as a browsing/share surface.

The gallery is fantastic when:

- It feels like a design direction tool, not a code sample library.
- It produces social/share artifacts.
- It creates reliable LLM implementation briefs.
- It has enough template variety that most common AI-built app/site needs have a close starting point.
