# Edge Case: Markdown README to Landing Page

> **Scenario:** User pastes raw markdown and wants it transformed into a visually appealing web page. This tests the LLM's ability to classify unstructured text input, choose the right page archetype, and convert every piece of content without dropping anything.

---

## User Prompt

**User:** "Can you turn this README into a nice looking page?"

```markdown
# Tempo
> Fast, lightweight task runner for modern teams

## Features
- **Parallel execution** — Run tasks across all cores
- **Smart caching** — Skip tasks that haven't changed
- **Watch mode** — Automatic re-runs on file changes
- **Plugin system** — Extend with community plugins
- **Zero config** — Works out of the box with sensible defaults

## Quick Start
npm install -g tempo-cli
tempo init
tempo run build

## Benchmarks
| Runner | 100 tasks | 1000 tasks | 10000 tasks |
|--------|-----------|------------|-------------|
| Tempo  | 0.8s      | 3.2s       | 28s         |
| Make   | 2.1s      | 12.4s      | 180s        |
| Grunt  | 3.4s      | 18.7s      | 340s        |

## Used by
Google, Shopify, Vercel, Cloudflare
```

---

## Decision Flow

### Step 0 — Classify

Input type: **Plain text (markdown)**
Route to: **Step 1D (Structure)**

The input is not an existing UI, not a wireframe, not a design spec. It is raw content that needs both structure and visual treatment.

### Step 1D — Structure the Content

1. **Data shape:** Structured document with:
   - Hero content (title + tagline)
   - Features list (5 items, each with bold label + description)
   - Code snippet (3 shell commands)
   - Comparison table (3 runners x 3 benchmarks)
   - Social proof (4 company names)

2. **Use case:** Open-source project landing page

3. **Component pattern:**
   - Hero section (title, tagline, CTA)
   - Feature grid (icon cards)
   - Code block (styled terminal)
   - Comparison table (highlighted own product)
   - Logo/social proof bar
   - Final CTA

4. **Primary actions:**
   - Install (copy `npm install` command)
   - View documentation
   - Star on GitHub

### Clarification Needed

**LLM asks:** "Should this be a documentation page or a marketing/landing page?"

**User:** "Landing page — I want people to install it."

This answer determines:
- **Tone:** Persuasive, not instructional
- **Layout:** Full-width sections with visual impact, not sidebar-nav docs layout
- **Hierarchy:** Hero + install CTA are dominant; benchmarks are proof, not reference
- **Style:** Dark hero, accent colors, generous whitespace — think Vite, Bun, Turbo

---

## Content Mapping

Every markdown element must appear in the final output. Nothing gets dropped.

| Markdown Element | Page Component | Section |
|---|---|---|
| `# Tempo` | H1 in hero | Hero |
| `> Fast, lightweight...` | Subtitle / tagline | Hero |
| Feature list (5 items) | Card grid with icons | Features |
| `npm install -g tempo-cli` | Copyable code block | Hero + Quick Start |
| `tempo init` / `tempo run build` | Styled terminal block | Quick Start |
| Benchmark table | Styled comparison table | Benchmarks |
| Company names | Text-logo badges | Social Proof |

---

## Design Decisions

### Color
- **Primary accent:** `#8b5cf6` (violet-500) — fits developer tool aesthetic
- **Hero background:** Dark gradient (`slate-950` to `slate-900`)
- **Light sections:** `slate-50` or white for contrast rhythm
- **Code blocks:** `slate-800` with colored syntax spans

### Typography
- **Headings:** System sans-serif or Inter (clean, modern)
- **Code:** JetBrains Mono (monospace, ligature-friendly)
- **Body:** 16-18px base, generous line-height (1.6-1.75)

### Layout
- **Max content width:** 1200px
- **Feature grid:** 3 columns on desktop, 1 on mobile
- **Section spacing:** 80-120px vertical padding
- **Responsive:** Mobile-first, single-column stacking

### Interaction
- **Copy button** on install command (clipboard API)
- **Smooth scroll** between sections via nav anchors
- **Hover states** on feature cards and CTAs
- **Benchmark row highlight** for Tempo (own product)

---

## Design Review Notes

### What to verify

1. **Content completeness:** All 5 features present? All 3 benchmark rows? All 4 company names? All 3 quick-start commands?
2. **Hierarchy:** Is "Tempo" the most visually dominant element? Is the install command immediately visible?
3. **Contrast:** Dark hero text meets 4.5:1 against gradient background? Light section text meets ratio?
4. **Code readability:** Monospace font loads correctly? Syntax colors distinguishable?
5. **Table accessibility:** Benchmark table has proper `<thead>`, `<th>` elements? Highlighted row distinguishable without color alone (e.g., bold text)?
6. **Responsive:** Feature grid collapses cleanly? Table scrolls horizontally or stacks on mobile? Hero text scales down?
7. **CTA clarity:** Primary action (install) has highest visual weight? Secondary action (docs/GitHub) is clearly secondary?

### Common mistakes for this edge case

- **Dropping content:** Skipping one feature, omitting a benchmark row, or forgetting company names
- **Wrong archetype:** Building a docs page instead of a landing page (sidebar nav, flat styling)
- **Code block as image:** Rendering code as a screenshot instead of selectable, copyable text
- **Table overflow:** Benchmark table breaks layout on mobile without horizontal scroll
- **Missing copy functionality:** Install command shown but no copy button
- **Accent overuse:** Using violet for everything instead of reserving it for CTAs and highlights
- **Dark-on-dark:** Insufficient contrast in the dark hero section, especially for the tagline

### Reference sites (aesthetic targets)

- [vitejs.dev](https://vitejs.dev) — dark hero, feature grid, clean code blocks
- [bun.sh](https://bun.sh) — benchmark comparison, install-focused CTA
- [turbo.build](https://turbo.build) — developer tool landing page pattern

---

## Files

- **Flow document:** `tests/edge-markdown-input-flow.md` (this file)
- **Output HTML:** `tests/edge-markdown-input.html`
