# Live Preview Tool — Extension Plan

> Bidirectional inspect/edit feature for `docs/index.html`. Researched 2026-03-18, updated 2026-03-18.

## Current Setup (as of latest)

- **`docs/index.html`** — ~1150 lines, the tool UI and JS logic
- **`docs/presets/{element}/{personality}.html`** — 88 preset files across 27 elements
- **`docs/presets/index.json`** — manifest with categories, elements, personalities, primaryColors
- Left panel: `<textarea>` with HTML source code
- Right panel: `<iframe>` rendering HTML with Tailwind CSS v4 (browser CDN)
- Iframe uses `srcdoc` and `sandbox="allow-scripts"` (no `allow-same-origin`)
- Presets load on-demand via `fetch()` and cache after first load
- **Personality buttons** in preview header switch between structurally different HTML variants
- **Color swatches** (8 themes) recolor via string replacement at render time
- **Style buttons** (Clean, Minimal, Playful, Glass, Editorial) inject CSS overrides
- **Dark mode toggle** adds `class="dark"` to iframe `<html>` + injects `@custom-variant dark` into all `<style type="text/tailwindcss">` blocks
- **Trust dialog** for shared links with script detection
- **Link prevention** script injected into iframe catches all `href="#..."` clicks
- Hosted on GitHub Pages (static files only, no server)

## Architecture

Two execution contexts communicating via `postMessage`:

```
Parent (index.html)                    Iframe (srcdoc, sandboxed)
┌──────────────────────┐              ┌──────────────────────┐
│ textarea / editor    │   postMsg    │ Inspector Agent      │
│ inspect-mode toggle  │ ──────────> │  - mousemove overlay │
│ source-map index     │              │  - click selection   │
│                      │ <────────── │  - contenteditable   │
│ highlight/scroll     │   postMsg    │  - DOM serialize     │
│ source updater       │              │                      │
└──────────────────────┘              └──────────────────────┘
```

### Key Research Findings

1. **`postMessage` works with sandboxed iframes** — even without `allow-same-origin`, the iframe can call `parent.postMessage()` and the parent can call `iframe.contentWindow.postMessage()`. The parent cannot access `iframe.contentDocument` (blocked by sandbox).

2. **Source mapping strategy** — inject `data-milg-id="N"` attributes into each opening tag at render time using a regex tokenizer. Maintain a map: `id → {startOffset, endOffset, tagName}`. When the iframe reports a hover on `data-milg-id="5"`, the parent looks up source offsets.

3. **GitHub Pages** — no constraints. Everything runs client-side.

### Integration Points with Existing Features

The inspect/edit system must work alongside:
- **Personality switching** — when user clicks a personality button, the entire HTML changes. Source map must rebuild. Inspector state resets.
- **Color theme switching** — `selectTheme()` applies string replacement to `originalPresetHtml`. The source map must use the CURRENT editor value, not the original.
- **Style injection** — CSS style overrides are injected into `<head>`, not the HTML body. These don't affect source mapping but do affect visual appearance in the iframe.
- **Dark mode** — `@custom-variant dark` injection and `class="dark"` on `<html>` don't affect source mapping.
- **Link prevention script** — already injected at end of `<body>`. Inspector agent script must not conflict.
- **Preset `<script>` blocks** — some presets (accordion, dropdown, tabs, project) have their own scripts that modify DOM. Elements created by these scripts won't have `data-milg-id`.

---

## Phase 1: Hover-to-Highlight (Inspect Mode)

**Complexity: ~250-350 lines | Priority: High**

### What It Does
Hover over an element in the preview → highlight it visually in the iframe AND highlight/scroll-to the corresponding HTML in the editor.

### Implementation

1. **Inspect-mode toggle button** in the header toolbar (between dark mode and share buttons). Crosshair icon. Uses `.btn` + `.btn-icon` styling already in the CSS.

2. **Source-map indexer** (parent-side function):
   - Input: raw HTML string from the textarea (after color theme replacement, before style injection)
   - Output: `{annotatedHtml, sourceMap}` where `sourceMap` is `Map<number, {start, end}>`
   - Regex tokenizer finds opening tags, injects `data-milg-id="N"`
   - Must handle: quoted attributes, self-closing tags, `<script>`/`<style>` blocks (skip contents), `<\/script>` escaped closing tags
   - **New consideration**: presets may contain `<style type="text/tailwindcss">` blocks — skip contents of these too

3. **Modify `updatePreview()`** (currently line ~584):
   - BEFORE building `processedHtml`, run source-map indexer on `editor.value`
   - Use `annotatedHtml` (with data attributes) instead of raw HTML for the srcdoc body
   - Store `sourceMap` in module-level variable
   - Inject inspector agent script into srcdoc BEFORE the existing link-prevention script
   - Inject overlay CSS into srcdoc `<head>` after the `body { margin: 0; }` style
   - **Only inject when inspect mode is active** — don't add overhead for normal preview

4. **Inspector agent script** (injected into srcdoc):
   - On load: send `{type: 'inspector-ready'}` to parent
   - Listen for `{type: 'set-inspect-mode', enabled: boolean}` from parent
   - When inspect mode on:
     - `mousemove`: find nearest element with `data-milg-id`, position overlay, send `{type: 'hover', milgId: N}` to parent
     - `mouseleave` on body: hide overlay, send `{type: 'hover-end'}`
     - `click`: send `{type: 'select', milgId: N}`, `preventDefault()`
   - Overlay: single fixed-position div, `pointer-events: none`, blue border + 8% blue bg, transitions for smooth movement
   - **Must coexist with**: link-prevention script, preset scripts (accordion toggles, etc.)

5. **Parent message handler** (new `window.addEventListener('message', ...)`):
   - Check `event.source === preview.contentWindow` (not origin, since sandbox origin is `null`)
   - Check `event.data.channel === 'milg-inspector'`
   - On `hover`: look up `milgId` in sourceMap, call `textarea.setSelectionRange(start, end)`, scroll textarea to show selection
   - On `hover-end`: clear selection
   - On `select`: persistent selection + maybe a visual gutter indicator

6. **Textarea scroll-to-selection**:
   - Calculate line number from character offset (count `\n` before offset)
   - Estimate scroll position: `lineNumber * lineHeight`
   - Set `textarea.scrollTop` to center the selection in view

### Edge Cases
- Self-closing tags (`<img />`, `<br />`) — get IDs, work normally
- `<script>` / `<style>` / `<style type="text/tailwindcss">` blocks — skip injection inside these
- `<\/script>` escaped tags in presets — tokenizer must handle backslash-escaped closing tags
- Dynamically added elements (preset scripts) — won't have `data-milg-id`, gracefully ignored
- **Personality switch during inspect mode** — must rebuild source map, reset inspector state
- **Color theme switch** — `selectTheme()` changes `editor.value` and calls `updatePreview()` which rebuilds source map automatically
- **Style override switch** — CSS-only, no source map impact

### Files to Modify
- `docs/index.html` lines ~338-351: add `.btn` for inspect toggle to CSS
- `docs/index.html` lines ~448-456: add inspect button to header HTML (header-right div)
- `docs/index.html` lines ~500-503: add `let inspectMode = false; let sourceMap = null;`
- `docs/index.html` lines ~584-626: modify `updatePreview()` to run source-map indexer and inject agent
- `docs/index.html` lines ~1140+: add message listener and inspect toggle function

---

## Phase 2: Replace Textarea with CodeMirror 6

**Complexity: ~200-250 lines | Priority: Medium**

### Why
Plain `<textarea>` limitations become painful with inspect mode:
- Only one selection highlight (can't show hover highlight AND user cursor simultaneously)
- No syntax highlighting makes it hard to find the highlighted element
- No line numbers for orientation
- Imprecise scroll-to-position

### Implementation
1. Load CodeMirror 6 from CDN (~45KB gzipped): `https://cdn.jsdelivr.net/npm/codemirror@6`
2. Replace `<textarea id="editor">` with a CodeMirror `EditorView`
3. Port existing features:
   - Tab key handling (already custom, line ~1083)
   - Input debounce → use CodeMirror's `updateListener`
   - Get/set value → `view.state.doc.toString()` / `view.dispatch({changes: ...})`
   - The `editor.value` references throughout the codebase (~20 occurrences) need updating
4. Use **Decoration API** for inspect hover highlighting:
   - Create a `StateField` that holds the highlighted range
   - Apply `Decoration.mark` with a custom CSS class (blue background)
   - This is independent of the cursor position — key advantage over textarea
5. `scrollIntoView` via `dispatch({effects: EditorView.scrollIntoView.of(pos)})`
6. HTML syntax highlighting via `@codemirror/lang-html`

### Fallback
Show textarea until CodeMirror loads (async CDN import). Progressive enhancement — the tool works without it, just with less polish on the inspect highlight.

### Integration Impact
- `editor.value` → `editorView.state.doc.toString()` (many references)
- `editor.addEventListener('input', ...)` → CodeMirror `updateListener`
- `editor.selectionStart/End` → CodeMirror selection API
- The placeholder text needs CodeMirror's placeholder extension
- Tab key handling can be removed (CodeMirror handles it)

---

## Phase 3: Click-to-Edit (Right-to-Left Sync)

**Complexity: ~250-300 lines | Priority: Medium**

### What It Does
Click element in preview → edit text inline → changes sync back to source.

### Implementation

1. **Element selection in iframe**: click in inspect mode → thicker border + small floating toolbar:
   - "Edit text" button (pencil icon)
   - "Copy classes" button (clipboard icon)
   - "Copy element" button
   - Toolbar positioned above/below selected element

2. **contenteditable activation**: toolbar "Edit text" button sets `element.contentEditable = true` and focuses it

3. **Text change sync** (surgical patches, not full DOM serialize):
   - Inspector agent listens for `input` events on contenteditable elements
   - Debounce 300ms, then send `{type: 'text-edit', milgId: N, newText: '...'}` to parent
   - Parent finds element in source by `data-milg-id` offset from sourceMap
   - Locate the `>` end of opening tag and `<` start of closing tag
   - Replace the text content between them
   - Update textarea/CodeMirror content
   - Rebuild source map (offsets shifted)
   - Do NOT call `updatePreview()` — avoids losing cursor position in iframe

4. **Class editing**: show element's Tailwind classes as editable pills in the toolbar
   - Click pill to remove class
   - Type in input to add class (with autocomplete from common Tailwind utilities)
   - Changes sync back: find `class="..."` in source, replace attribute value
   - **Integration with color themes**: class edits should update `originalPresetHtml` too if a theme is active, otherwise theme switching will revert the edit

### Sync Strategy: Surgical Patches
- Preserves user's source formatting and indentation
- Only changes the specific text/attribute that was edited
- Much more reliable than serializing entire DOM back to HTML
- After any patch, rebuild source map (O(n) string scan, fast even for 50KB)

---

## Phase 4: Visual Drag Handles (Optional, Advanced)

**Complexity: ~400+ lines | Priority: Low**

### What It Does
When element is selected, show colored overlays for margin (orange) and padding (green) with drag handles, like browser DevTools.

### Implementation
1. Read computed styles via `getComputedStyle()` for margin/padding
2. Render 8 drag handles (4 padding edges, 4 margin edges)
3. Convert pixel drag distance to nearest Tailwind spacing class (e.g., 16px → `p-4`)
4. Parse and replace spacing classes in the source `class="..."` attribute
5. **Tailwind class mapping**: need a lookup table for px → Tailwind class (4→1, 8→2, 12→3, 16→4, 20→5, 24→6, 32→8, 48→12, 64→16)

### Recommendation
Defer until Phases 1-3 are proven. This phase is significantly more complex and the UX value is lower than text/class editing.

---

## Phase 5: AI-Assisted Editing (Future)

**Complexity: High | Priority: Future**

### Concept
Select an element in the preview → right-click → "Improve with AI" → the LLM reads the selected element's HTML + the CONSULT.md guidelines + the current personality → suggests improvements → user accepts/rejects → source updates.

This would connect the preview tool back to the consultation flow, making it a full design improvement loop.

### Prerequisites
- Phases 1-3 working
- An API key configuration (stored in localStorage)
- Streaming response display in a panel

---

## Communication Protocol

```
// Parent → Iframe
{channel: 'milg-inspector', type: 'set-inspect-mode', enabled: boolean}
{channel: 'milg-inspector', type: 'set-edit-mode', milgId: number}      // Phase 3

// Iframe → Parent
{channel: 'milg-inspector', type: 'inspector-ready'}
{channel: 'milg-inspector', type: 'hover', milgId: number, rect: {x,y,w,h}}
{channel: 'milg-inspector', type: 'hover-end'}
{channel: 'milg-inspector', type: 'select', milgId: number}
{channel: 'milg-inspector', type: 'text-edit', milgId: number, newText: string}   // Phase 3
{channel: 'milg-inspector', type: 'class-edit', milgId: number, newClasses: string} // Phase 3
```

All messages namespaced with `channel: 'milg-inspector'` to avoid conflicts with user scripts and preset scripts.

---

## Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Source-map tokenizer fails on edge-case HTML | Medium | State machine tokenizer. Skip unparseable tags. Handle `<\/script>` escaping. |
| srcdoc reload loses inspector state | Low | Inspector sends `ready` on load. Parent resends current mode. |
| User scripts modify DOM, breaking source map | Medium | Elements without `data-milg-id` show "dynamic element" indicator. |
| Text edit creates offset drift | Medium | Rebuild source map after any patch. O(n), fast. |
| CodeMirror CDN bundle size | Low | ~45KB gzipped. Async load, textarea fallback. |
| postMessage origin checking | Low | Check `event.source === preview.contentWindow`. |
| Personality switch during inspect | Low | Reset inspect state, rebuild source map on `loadPreset()`. |
| Color theme + inspect conflict | Low | Source map uses current editor value, rebuilt on every `updatePreview()`. |
| Inspector agent conflicts with preset scripts | Low | Agent uses unique IDs (`milg-*`), doesn't touch preset DOM. Namespaced messages. |

---

## Implementation Order

1. **Phase 1** first — it's the highest value and validates the core architecture (source mapping + postMessage)
2. **Phase 2** can happen in parallel or immediately after — it's independent of inspect logic
3. **Phase 3** depends on Phase 1 (needs source map) and benefits from Phase 2 (needs good highlighting)
4. **Phase 4** only after Phase 3 is stable
5. **Phase 5** is a future direction, not planned for near-term

## Files to Modify

All changes in `docs/index.html`:
- **CSS** (lines ~7-405): overlay styling, inspect-mode button, CodeMirror container
- **Header HTML** (lines ~448-456): inspect toggle button in header-right
- **JS state** (lines ~497-503): `inspectMode`, `sourceMap`, message listener
- **`updatePreview()`** (lines ~584-626): source-map indexer, agent injection
- **New functions**: `toggleInspect()`, `buildSourceMap()`, inspector message handler
- **Init** (lines ~1140-1145): add message listener setup
