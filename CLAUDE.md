# CLAUDE.md — make-it-look-good

## Quick Start
- **Design consultation** → Read `CONSULT.md` and follow the steps
- **Need a component** → Read `snippets/_index.md` for snippets and composition recipes
- **Quick number lookup** → Read `workflows/quick-reference.md`
- **Read only what's needed** — each knowledge file is self-contained (~200-400 lines)

## Purpose
This repo is a **design knowledge base for LLMs**. When an LLM needs to make UI/UX decisions, it reads files from this repo to get concrete, evidence-based guidance with hard numbers.

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
- **Flat folders** (max 1 level deep) — no nested subdirectories within topic folders (exception: `snippets/react/` and `snippets/vue/`)
- **Concrete numbers over vague principles** — "4.5:1 contrast ratio" not "ensure sufficient contrast"
- **Markdown only** — no JSON/YAML data files unless tooling specifically requires it
- **research/ is gitignored** — only `research/sources.md` (bibliography) is committed
- **Update `research/sources.md`** when adding new sources to any file
- **Update `README.md`** index when adding new knowledge files
- **Cross-reference related files** using relative links: `[topic](../folder/file.md)`
- **Every snippet needs:** metadata comment header (snippet name, category, rationale, tags, dark-mode, frameworks), consistent design tokens (blue-600 primary, slate neutrals), and an entry in `snippets/_index.md`

## Design Consultation Workflow
- **`CONSULT.md`** is the LLM consultation playbook — read it to run an interactive design consultation
- **Step 0 in CONSULT.md classifies the input** — existing code (any framework), screenshot, vague idea, or raw data — and routes to the right workflow
- **Match the user's tech stack** — don't output Tailwind HTML to someone using React + styled-components. Detect the framework and output code in their format
- **Always generate Design Review Notes** (Step 4 in CONSULT.md) — a structured markdown document with issues found, design decisions, tokens, and an implementation checklist. This is the primary deliverable
- **`docs/index.html`** is a live preview tool (GitHub Pages) — paste HTML + Tailwind to preview designs
- **`templates/`** contains before/after HTML examples showing MVP vs properly designed versions

## Directory Structure
- `foundations/` — Cognitive/psychological principles (Gestalt, Hick's Law, Fitts's Law, etc.)
- `color/` — Color theory, accessibility, psychology, color-blind safety
- `typography/` — Type scales, font pairing, readability, web font loading
- `layout/` — Spacing systems, visual hierarchy, grids, whitespace
- `interaction/` — Animation timing, micro-interactions, touch targets, loading states
- `responsive/` — Mobile-first, breakpoints, fluid typography, responsive patterns
- `systems/` — Design tokens, Material Design 3, Apple HIG, building a system
- `heuristics/` — Nielsen's 10 heuristics, UX frameworks
- `components/` — Concrete component patterns (buttons, forms, cards, etc.)
- `snippets/` — Copy-paste-ready HTML+Tailwind component snippets (see `snippets/_index.md`)
  - `snippets/react/` — React component variants (`.jsx`) for interactive snippets
  - `snippets/vue/` — Vue SFC variants (`.vue`) for interactive snippets
  - `snippets/svelte/` — Svelte 5 component variants (`.svelte`) for interactive snippets
- `workflows/` — Cross-cutting decision guides and checklists
- `research/` — Raw research data (gitignored except sources.md)
