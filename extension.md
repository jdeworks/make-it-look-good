# Live Preview Tool — Extension Plan

> Bidirectional inspect/edit feature for `docs/index.html`. Researched 2026-03-18.

## Current Setup

- Single-page HTML tool at `docs/index.html`
- Left panel: `<textarea>` with HTML source code
- Right panel: `<iframe>` rendering HTML with Tailwind CSS v4 (browser CDN)
- Iframe uses `srcdoc` and `sandbox="allow-scripts"` (no `allow-same-origin`)
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

1. **`postMessage` works with sandboxed iframes** — even without `allow-same-origin`, the iframe can call `parent.postMessage()` and the parent can call `iframe.contentWindow.postMessage()`. This is the designed communication channel. The parent cannot access `iframe.contentDocument` (blocked by sandbox).

2. **Source mapping strategy** — inject `data-milg-id="N"` attributes into each opening tag at render time using a regex tokenizer. Maintain a map: `id → {startOffset, endOffset, tagName}`. When the iframe reports a hover on `data-milg-id="5"`, the parent looks up source offsets.

3. **GitHub Pages** — no constraints. Everything runs client-side. No WebSocket or server needed.

---

## Phase 1: Hover-to-Highlight (Inspect Mode)

**Complexity: ~200-300 lines | Priority: High**

### What It Does
Hover over an element in the preview → highlight it visually in the iframe AND highlight/scroll-to the corresponding HTML in the editor.

### Implementation

1. **Inspect-mode toggle button** in the header toolbar (crosshair icon, next to dark mode button).

2. **Source-map indexer** (parent-side function):
   - Input: raw HTML string from textarea
   - Output: `{annotatedHtml, sourceMap}` where `sourceMap` is `Map<number, {start, end}>`
   - Regex tokenizer finds opening tags, injects `data-milg-id="N"`
   - Handles: quoted attributes, self-closing tags, skips script/style contents

3. **Modify `updatePreview()`**:
   - Run source-map indexer on HTML before building srcdoc
   - Store sourceMap in module-level variable
   - Inject inspector agent script into srcdoc (before `</body>`)
   - Inject overlay CSS into srcdoc `<head>`

4. **Inspector agent script** (injected into srcdoc):
   - On load: send `{type: 'inspector-ready'}` to parent
   - Listen for `{type: 'set-inspect-mode', enabled: boolean}` from parent
   - When inspect mode on:
     - `mousemove`: find nearest element with `data-milg-id`, position overlay, send `{type: 'hover', milgId: N}` to parent
     - `click`: send `{type: 'select', milgId: N}`, prevent default
   - Overlay CSS: fixed-position div with blue border + 8% blue background, `pointer-events: none`

5. **Parent message handler**:
   - On `hover`: look up `milgId` in sourceMap, call `textarea.setSelectionRange(start, end)`, scroll textarea
   - On `select`: persistent selection + visual indicator

### Edge Cases
- Self-closing tags (`<img />`, `<br />`) — get IDs, work normally
- `<script>` / `<style>` blocks — skip injection inside these
- Dynamically added elements (via user scripts) — won't have `data-milg-id`, gracefully ignored

---

## Phase 2: Replace Textarea with CodeMirror 6

**Complexity: ~150-200 lines | Priority: Medium**

### Why
Plain `<textarea>` limitations:
- Only one selection highlight (can't show hover highlight AND user cursor)
- No syntax highlighting
- No line numbers
- Imprecise scroll-to-position

### Implementation
1. Load CodeMirror 6 from CDN (~45KB gzipped, ESM modules)
2. Replace textarea with `EditorView`
3. Port existing features: tab handling, input debounce, get/set value
4. Use Decoration API for hover highlighting (colored background, independent of cursor)
5. `scrollIntoView` dispatch for precise positioning
6. Line numbers and HTML syntax highlighting come free

### Fallback
Show textarea until CodeMirror loads (async CDN load). Progressive enhancement.

---

## Phase 3: Click-to-Edit (Right-to-Left Sync)

**Complexity: ~200-250 lines | Priority: Medium**

### What It Does
Click element in preview → edit text inline → changes sync back to source.

### Implementation

1. **Element selection**: click in inspect mode → thicker border + small toolbar (edit text, copy classes)

2. **contenteditable**: double-click or toolbar button activates text editing in the iframe

3. **Text change sync**:
   - Inspector agent listens for `input` events on contenteditable elements
   - Debounce, send `{type: 'text-edit', milgId: N, newText: '...'}` to parent
   - Parent patches source string surgically (find tag by offset, replace inner content)
   - Rebuild source map (offsets shifted)
   - Do NOT call `updatePreview()` (avoids losing cursor in iframe)

4. **Class editing**: show element's Tailwind classes as editable pills. Add/remove classes syncs back to `class="..."` in source.

### Sync Strategy: Surgical Patches (not full DOM serialize)
- Preserves user's source formatting and indentation
- Only changes the specific text/attribute that was edited
- Much more reliable than trying to serialize entire DOM back to HTML

---

## Phase 4: Visual Drag Handles (Optional, Advanced)

**Complexity: ~400+ lines | Priority: Low**

### What It Does
When element is selected, show colored overlays for margin (orange) and padding (green) with drag handles, like browser DevTools.

### Implementation
1. Read computed styles for margin/padding
2. Render 8 drag handles (4 padding edges, 4 margin edges)
3. Convert pixel drag distance to nearest Tailwind spacing class (e.g., 16px → `p-4`)
4. Parse and replace spacing classes in the source `class="..."` attribute

### Recommendation
Defer until Phases 1-3 are proven. This phase is significantly more complex and benefits less from the investment.

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

All messages namespaced with `channel: 'milg-inspector'` to avoid conflicts with user scripts.

---

## Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Source-map tokenizer fails on edge-case HTML | Medium | State machine tokenizer (in-tag, in-attribute, in-script). Skip unparseable tags gracefully. |
| srcdoc reload loses inspector state | Low | Inspector sends `ready` on load. Parent resends current mode. Inspector is stateless between reloads. |
| User scripts modify DOM, breaking source map | Medium | Elements without `data-milg-id` are not inspectable. Show "dynamic element" indicator. |
| Text edit creates offset drift | Medium | Rebuild entire source map after any patch. O(n) string scan, fast even for 50KB HTML. |
| CodeMirror CDN bundle size | Low | ~45KB gzipped. Load async, textarea fallback until loaded. |
| postMessage origin checking | Low | Sandboxed iframe has origin `null`. Check `event.source === preview.contentWindow` instead. |

---

## Files to Modify

All changes in `docs/index.html`:
- **CSS section** (lines ~7-370): overlay and inspect-mode styling
- **Header HTML** (lines ~382-488): inspect-mode toggle button
- **JS variables** (lines ~493-500): source map, inspect state, message listener
- **`updatePreview()`** (lines ~504-536): source-map indexing + inspector agent injection
- **Keyboard handling** (lines ~5138+): reference pattern for editor interactions
