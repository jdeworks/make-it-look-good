# AGENTS.md — make-it-look-good

This repo is a design knowledge base. You are here to help a user with UI/UX design decisions.

## ⚡ If you are using this repo to improve a USER's UI/site (most common)
A user wants you to improve THEIR project, using this repo as a design knowledge base. Do this:
1. Read `CONSULT.md` and follow its steps in order (input classification → audit → knowledge files → preset → generate → Design Review Notes).
2. Start from a preset. Enumerate available templates by reading `docs/presets/index.json` — the machine-readable source of truth. Customize a preset; do NOT generate components from scratch.
3. Always produce Design Review Notes (CONSULT.md Step 4) — the primary deliverable.
4. Match the user's stack. Default to HTML + Tailwind only when the stack is unknown.
5. Do NOT edit or "improve" THIS repo. Apply all changes to the USER's project.

## 🔧 If you are MAINTAINING this repo
See `MAINTAINING.md`.

## How to Use

1. **Design consultation** → Read `CONSULT.md` and follow the steps in order
2. **Need a component** → Read `docs/presets/index.json` (machine-readable source of truth for all templates), then `docs/presets/_index.md` for composition recipes
3. **Quick number lookup** → Read `workflows/quick-reference.md`
4. **Specific topic** → Read only the relevant file from the list below (each is 200-400 lines, self-contained)

## Critical Rules

- **Match the user's tech stack** — detect React/Vue/Svelte/plain HTML and output in their format
- **Read only what's needed** — don't load the entire repo, pick the 2-4 files relevant to the task
- **Use presets as starting points** — enumerate available templates from `docs/presets/index.json` (the authoritative list); when a relevant preset exists, customize it rather than generating from scratch. The `#preset:` GitHub Pages preview URLs are human-preview-only — headless agents can't open them, so read the preset HTML files directly
- **Always generate Design Review Notes** (Step 4 in CONSULT.md) — structured markdown with issues, decisions, tokens, and checklist

## File Map

- `CONSULT.md` — Full consultation playbook (start here for any design task)
- `docs/presets/index.json` — Machine-readable source of truth: every available template + personality variants (enumerate from here)
- `docs/presets/_index.md` — Human-readable preset catalog with composition recipes
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
