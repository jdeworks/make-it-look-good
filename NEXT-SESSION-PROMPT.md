# Task: Region sub-page polish + modular refactoring (v3.7+)

## What shipped in v3.0–v3.6

The analyzer now treats hidden carousel/overflow content as independent sub-pages:

- **Container indicator** always visible on main screenshot (blue dashed box with label, `data-permanent` SVG)
- **Clipped bboxes excluded** from main screenshot overlays (WeakSet of bbox object refs + string-key fallback)
- **Region extraction**: `MilgExtract` injected into mini-page iframe, runs after force-reveal, produces `extractedData` with contrast pairs + bboxes in mini-page coordinates
- **Region scoring**: `MilgScoring.runScoring(rgn.extractedData)` runs independently per region (fink-translate.com carousel scores 82/100 B)
- **Region pixel verify**: queued sequentially after main verify via `MilgContrastVerify.verify()`
- **Viewer sub-report**: screenshot + SVG bbox overlays from `regionReport` + score summary bar with error/warning/info counts
- **Shared module**: `docs/analyzer-region.js` exposes `window.MilgRegion` — source of truth for force-reveal, mini-page creation, DOM cleanup, region capture

### Key files changed
- `docs/analyzer-region.js` — NEW shared module
- `docs/analyzer-iframe.js` — delegates to `MilgRegion.getRegionFn()`, assigns `window.MilgExtract` in analysis iframe
- `docs/analyzer-viewer.js` — permanent container indicators in `onImageReady()`, region sub-reports with SVG overlays
- `docs/analyzer.js` — region scoring loop after main scoring, region pixel verify queue after main verify
- `tests/region-debug.spec.js` — diagnostic test capturing real data from fink-translate.com

## Outstanding issues to fix

### 1. Region screenshot whitespace (HIGH)

The region screenshot for fink-translate.com has massive whitespace — canvas is 2427×17109 pixels but actual content is only in the bottom ~15%. Root cause: the carousel's internal DOM structure (wrapper divs with height constraints, flex gaps) inflates `scrollHeight` after force-reveal + extraction. The DOM cleanup in `MilgRegion` only resets heights on the container's direct children, but the whitespace comes from deeper nested wrappers.

**Approach ideas:**
- After force-reveal + extraction but BEFORE screenshot, crop the capture area to the bounding box of actual visible content (compute the union of all element rects that have text/images)
- OR: use `domToCanvas` with a clip rect option if supported by modern-screenshot
- OR: post-capture, trim the canvas to the non-white bounding rect before encoding to webp

**Test**: `test-results/region-debug/report-dump.json` has `screenshotMeta.canvasHeight: 17109` — should be ~2000–3000 for just the carousel content.

### 2. Screenshot pipeline modularization (MEDIUM)

`buildScreenshotScript()` in `analyzer-iframe.js` (lines 545–1065, 520 lines) builds a massive string that gets injected into iframes. It includes the text mask pipeline (~200 lines of font inlining, white-bg masking, per-element bitmap extraction) which is tightly coupled. The console snippet (`analyzer-snippet-screenshots.js`) has its own ~400-line copy of similar logic.

**The blocker**: iframe flow uses postMessage to return results; snippet runs directly in the page context. Different execution models prevent simple code sharing.

**User's vision**: all three paths (URL analyze, HTML paste, console snippet) should use the SAME logic files. The console snippet should be dynamically assembled from shared modules when the user visits the tab (the `loadSnippet()` function in `analyzer.js` already fetches + inlines files).

**Architecture decision needed**: How to abstract the iframe/direct execution difference? Options:
- A) Shared "operations" module with an adapter pattern (iframe adapter posts messages, direct adapter calls callbacks)
- B) The script builder produces code that detects its context (iframe vs direct) and routes accordingly
- C) Accept the duplication for snippet (it's a different execution model) and only share `analyzer-region.js` + `analyzer-extract.js`

### 3. Region content not fully expanded (LOW)

Some carousel implementations still don't fully expand. The force-reveal handles `display:none`, `visibility:hidden`, `opacity:0`, `position:absolute/fixed`, `transform`, and `clip-path`. But some edge cases remain:
- CSS Grid with `grid-template` constraints
- `contain: layout` or `contain: paint` properties
- JavaScript-controlled visibility (React state, Vue v-show compiled to inline styles)

### 4. Region report in HTML output (LOW)

The HTML report (`analyzer-report.js`) doesn't yet include region findings. The viewer shows them, but the downloadable/printable report doesn't. Add a "Hidden Regions" section after main findings.

## Testing checklist

1. `npx playwright test tests/html-analysis.spec.js` — all 21 existing tests
2. `npx playwright test tests/region-debug.spec.js` — fink-translate.com diagnostic
3. Check `test-results/region-debug/report-dump.json`:
   - `regions[0].hasExtractedData === true`
   - `regions[0].extractedPairCount > 0`
   - `regions[0].hasRegionReport === true`
   - `regions[0].regionScore` is a number
4. Check `test-results/region-debug/viewer-region-section.png` — SVG overlays visible on region screenshot
5. Check `test-results/region-debug/viewer-indicator-area.png` — blue container indicator on main screenshot

## Key data structures

Region data on `reportData.raw.regionScreenshots[]`:
```javascript
{
  screenshot: 'data:image/webp;base64,...',
  screenshotMeta: { scale: 1.5, canvasWidth: 2427, canvasHeight: 17109 },
  pairIndices: [65, 60, 104, ...],   // indices into main contrastPairs
  containerRect: { left: 744, top: 2154, width: 350, height: 467 },
  extractedData: { colors: { contrastPairs: [...] }, typography: {...}, ... },  // NEW v3.6
  regionReport: { overall: 82, grade: 'B', categories: [...] },               // NEW v3.6
  regionVerifyResults: [...]                                                     // NEW v3.6
}
```

## Files reference

| File | Purpose | Lines |
|------|---------|-------|
| `docs/analyzer-region.js` | Shared region module (MilgRegion) | ~280 |
| `docs/analyzer-iframe.js` | URL analysis orchestrator | ~1310 |
| `docs/analyzer-viewer.js` | Screenshot viewer with overlays | ~1920 |
| `docs/analyzer.js` | Main UI controller | ~1350 |
| `docs/analyzer-extract.js` | Extraction engine (MilgExtract) | ~1240 |
| `docs/analyzer-snippet-screenshots.js` | Console snippet (standalone) | ~1020 |
| `docs/analyzer-report.js` | HTML report renderer | ~680 |
| `docs/analyzer-contrast-verify.js` | Pixel verification | ~1340 |
| `tests/region-debug.spec.js` | Region diagnostic test | ~180 |
| `tests/html-analysis.spec.js` | Full test suite (21 tests) | ~430 |

Start by reading this file, then pick the highest-priority issue to tackle.
