# MAINTAINING.md — make-it-look-good

> Guidance for contributors who are **maintaining this repo itself** (adding knowledge files, presets, or sources). If you are instead using this repo to improve a USER's UI/site, see the consumer directive at the top of `CLAUDE.md` / `AGENTS.md` and follow `CONSULT.md`.

## File Format Convention
Every knowledge file follows this template:

```
# {Topic Title}
> **TL;DR:** {2-3 sentence actionable summary}
## Core Principles
## Concrete Rules
## CSS/Implementation Patterns
## Common Mistakes
## Decision Tree
## Sources
```

Not every section is required, but **Concrete Rules** and **CSS/Implementation Patterns** are mandatory — every file must have actionable specifics.

## Maintenance Rules
- **One file per focused topic** — don't merge topics; create new files instead
- **Flat folders** (max 1 level deep) — no nested subdirectories within topic folders (exception: `docs/presets/` contains per-preset directories with framework variants)
- **Concrete numbers over vague principles** — "4.5:1 contrast ratio" not "ensure sufficient contrast"
- **Markdown only** — no JSON/YAML data files unless tooling specifically requires it
- **research/ is gitignored** — only `research/sources.md` (bibliography) is committed
- **Update `research/sources.md`** when adding new sources to any file
- **Update `README.md`** index when adding new knowledge files
- **Cross-reference related files** using relative links: `[topic](../folder/file.md)`
- **Every preset in `docs/presets/` needs:** consistent design tokens (blue-600 primary default, slate neutrals), dark mode support, responsive design, and an entry in `docs/presets/index.json`. Personality variants use different color palettes appropriate to their personality (rose for playful, indigo for editorial, etc.)
- **`docs/presets/index.json` is the machine-readable source of truth** for which templates exist — keep it in sync whenever you add, remove, or rename a preset or personality variant.

## Directory Structure
- `foundations/` — Cognitive/psychological principles (Gestalt, Hick's Law, Fitts's Law, etc.)
- `color/` — Color theory, accessibility, psychology, color-blind safety
- `typography/` — Type scales, font pairing, readability, web font loading
- `layout/` — Spacing systems, visual hierarchy, grids, whitespace
- `interaction/` — Animation timing, micro-interactions, touch targets, loading states
- `responsive/` — Mobile-first, breakpoints, fluid typography, responsive patterns
- `systems/` — Design tokens, Material Design 3, Apple HIG, building a system
- `expressive/` — Visual identity, hero patterns, scroll storytelling, purposeful motion
- `heuristics/` — Nielsen's 10 heuristics, UX frameworks
- `components/` — Concrete component patterns (buttons, forms, cards, etc.)
- `docs/presets/` — Copy-paste-ready HTML+Tailwind presets with personality variants (see `docs/presets/_index.md`)
  - Each preset dir has `clean.html`, `minimalist.html`, `playful.html` (and optionally `react.jsx`, `vue.vue`, `svelte.svelte`)
- `workflows/` — Cross-cutting decision guides and checklists
- `research/` — Raw research data (gitignored except sources.md)
