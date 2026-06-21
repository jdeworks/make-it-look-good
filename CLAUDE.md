# CLAUDE.md — make-it-look-good

## ⚡ If you are using this repo to improve a USER's UI/site (most common)
A user wants you to improve THEIR project, using this repo as a design knowledge base. Do this:
1. Read `CONSULT.md` and follow its steps in order (input classification → audit → knowledge files → preset → generate → Design Review Notes).
2. Start from a preset. Enumerate available templates by reading `docs/presets/index.json` — the machine-readable source of truth. Customize a preset; do NOT generate components from scratch.
3. Always produce Design Review Notes (CONSULT.md Step 4) — the primary deliverable.
4. Match the user's stack. Default to HTML + Tailwind only when the stack is unknown.
5. Do NOT edit or "improve" THIS repo. Apply all changes to the USER's project.

## 🔧 If you are MAINTAINING this repo
See `MAINTAINING.md`.

## 🚫 PRIME DIRECTIVE — NO `<style>` BLOCKS IN PRESET TEMPLATES
This is absolute and overrides any urge to "make a template pass the analyzer."
- **Preset HTML files (`docs/presets/**/*.html`) must NOT contain `<style>` blocks, and must NOT use inline `style="..."` attributes.** All styling is Tailwind utility classes only. If a `<style>` block exists in a preset, **we failed** — remove it.
- **Never hack a template to satisfy the analyzer.** Frosted/backdrop-filter "locks", `!important` color overrides, `[data-open]` visibility CSS, and media-query `display:none` hacks are all forbidden — they were band-aids over analyzer findings, not real fixes.
- **If the analyzer is wrong, fix the analyzer** (`docs/analyzer-*.js`, `docs/scoring/*.js`), not the template. False positives get fixed at the source.
- **We do NOT need 100/A on every template/personality/color/effect combination.** Chasing infinite edge-case optimization via template hacks is exactly what produced the `<style>` mess. The goal is to **showcase the templates well AND resolve the genuine open issues** — not to game a perfect score.
- Tailwind covers nearly everything via utilities + arbitrary values: fonts → `font-['Sora']`, smooth scroll → `scroll-smooth`, hover motion → `hover:-translate-y-1 transition`, gradients → `bg-[radial-gradient(...)]`, responsive table→card → `max-sm:block` variants. Use these instead of CSS.
- **The ONLY permitted `<style>` content is custom `@keyframes` definitions** (CDN Tailwind can't express them otherwise). Such a block may contain *only* `@keyframes` rules — no selectors, no properties, no `!important`, no locks. Apply the animation with a Tailwind arbitrary utility: `class="animate-[gradientShift_12s_ease-in-out_infinite]"`. Everything else stays Tailwind. No other use of `<style>` is allowed.

## Quick Start
- **Design consultation** → Read `CONSULT.md` and follow the steps
- **Need a component** → Read `docs/presets/index.json` (machine-readable source of truth for all available templates), then `docs/presets/_index.md` for composition recipes
- **Quick number lookup** → Read `workflows/quick-reference.md`
- **Read only what's needed** — each knowledge file is self-contained (~200-400 lines)

## Purpose
This repo is a **design knowledge base for LLMs**. When an LLM needs to make UI/UX decisions, it reads files from this repo to get concrete, evidence-based guidance with hard numbers.

## CSS Framework
All presets and examples use **[Tailwind CSS](https://tailwindcss.com)** as the default styling framework. When the user's stack is unknown, output Tailwind classes. For the preview tool, Tailwind v4 is loaded via CDN (`@tailwindcss/browser@4`). Match the user's stack if they use something else — see CONSULT.md Step 0.

## Maintainer Reference
See `MAINTAINING.md` for file-format conventions, directory structure, and maintenance rules.

## Design Consultation Workflow
- **`CONSULT.md`** is the LLM consultation playbook — read it to run an interactive design consultation
- **Step 0 in CONSULT.md classifies the input** — existing code (any framework), screenshot, vague idea, or raw data — and routes to the right workflow
- **Match the user's tech stack** — don't output Tailwind HTML to someone using React + styled-components. Detect the framework and output code in their format
- **Always generate Design Review Notes** (Step 4 in CONSULT.md) — a structured markdown document with issues found, design decisions, tokens, and an implementation checklist. This is the primary deliverable
- **Enumerate templates from `docs/presets/index.json`** — the machine-readable source of truth for every available preset and its personality variants. `docs/index.html` is a live preview tool (GitHub Pages); its `#preset:{element}/{personality}` URLs are for HUMAN preview only — headless agents can't open them, so read the preset HTML files directly instead.
