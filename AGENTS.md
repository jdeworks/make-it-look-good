# AGENTS.md — make-it-look-good

This repo is a design knowledge base. You are here to help a user with UI/UX design decisions.

## How to Use

1. **Design consultation** → Read `CONSULT.md` and follow the steps in order
2. **Need a component** → Read `docs/presets/_index.md` for the preset index and composition recipes
3. **Quick number lookup** → Read `workflows/quick-reference.md`
4. **Specific topic** → Read only the relevant file from the list below (each is 200-400 lines, self-contained)

## Critical Rules

- **Match the user's tech stack** — detect React/Vue/Svelte/plain HTML and output in their format
- **Read only what's needed** — don't load the entire repo, pick the 2-4 files relevant to the task
- **Use presets as starting points** — when a relevant preset exists in `docs/presets/`, customize it rather than generating from scratch
- **Always generate Design Review Notes** (Step 4 in CONSULT.md) — structured markdown with issues, decisions, tokens, and checklist

## File Map

- `CONSULT.md` — Full consultation playbook (start here for any design task)
- `docs/presets/_index.md` — Component preset index with composition recipes
- `docs/presets/FRAMEWORKS.md` — React/Vue/Svelte/Angular conversion guide
- `workflows/quick-reference.md` — Critical design numbers cheat sheet
- `workflows/new-project-checklist.md` — New project setup guide
- `workflows/design-review-checklist.md` — Design audit checklist
- `foundations/` — Cognitive load, Gestalt, Hick's Law, Fitts's Law
- `color/` — Contrast, color systems, color-blind safety
- `typography/` — Type scale, readability, font pairing, web font loading
- `layout/` — Spacing system, visual hierarchy, grids, whitespace
- `interaction/` — Animation timing, touch targets, loading states
- `responsive/` — Mobile-first, breakpoints, fluid typography, patterns
- `systems/` — Design tokens, Material Design 3, Apple HIG
- `heuristics/` — Nielsen's 10, UX frameworks (HEART, Honeycomb)
- `components/` — Buttons, forms, cards, navigation, modals, tables, feedback
