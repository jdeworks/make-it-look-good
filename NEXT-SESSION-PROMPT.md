# Task: Fix region viewer overlays + main screenshot exclusion (v3.9)

## Context

The analyzer detects overflow:hidden containers (carousels, tabs) and creates "region" sub-pages that reveal hidden content. Each region gets its own screenshot + extraction + scoring, displayed below the main screenshot in the viewer. **v3.8 shipped the layout, cropping, and basic overlay plumbing, but three problems remain.**

## Problem 1: Region bbox overlays don't appear when filters are active

`renderRegionOverlays()` in `analyzer-viewer.js:796` returns early when `_activeFilter` is null (correct — matches main overlay). But it ALSO returns early for ALL non-null filters due to this guard:

```javascript
if (_activeFilter.type === 'verify' || _activeFilter.type === 'verifySelector' ||
    _activeFilter.type === 'finding' || _activeFilter.type === 'findingBbox') return;
```

The problem: when the user clicks a **severity** or **category** filter button, `_activeFilter` is set to e.g. `{type:'severity', value:'all'}`. The guard above doesn't block severity/category filters, BUT the real issue is that **the initial render after clicking "All" (first interaction) shows no region overlays at all**. Debug this by:

1. Check the `renderOverlays()` call path — when is `renderRegionOverlays()` actually called?
2. Check if `_regionData[].findings` is populated (it's built during `open()` from `rgn.regionReport.categories`)
3. Check if findings have bboxes — the scoring module produces `locator.bboxes` from extraction contrastPairs

The main screenshot's `renderOverlays()` function (line 569) is the reference implementation. Region overlays must respond to the same filter types: `severity` (all/error/warning/info/pass) and `category` (icon-based).

## Problem 2: Region rects lack full interaction parity with main screenshot

The main screenshot rects have (lines 734-789):
- **mouseenter** → `showFindingTooltip(e, findingIdx)` — rich tooltip with severity badge, title, detail, overlapping findings, "show group" button, copy button
- **mouseleave** → `scheduleHideTooltip()`
- **click** → overlap picker if multiple findings overlap, or `scrollToFinding()` which filters to just that finding
- **shift+click** → copies debug JSON to clipboard

Region rects currently only have a simplified mouseenter tooltip. They need the SAME interaction as main rects, adapted for the region findings array. Key considerations:
- Region rects use `data-finding` indices into `_regionData[rIdx].findings`, NOT `_allFindings`
- The tooltip's "show group" button calls `scrollToFinding()` which uses `_allFindings` indices — this needs adaptation for region findings
- The overlap picker and shift+click debug info should work within the region SVG context

**Approach**: Rather than duplicating the full interaction code, refactor the existing handlers to accept a findings array and SVG element as parameters, so both main and region rects can use the same code paths.

## Problem 3: Carousel bboxes still leak onto main screenshot

Despite three layers of filtering (WeakSet, string-key, containerRect), some bboxes from hidden carousel slides appear on the main screenshot. These are elements from adjacent slides that are:
- Positioned via `transform: translateX()` or `left: 100%` — the force-reveal sets `position: relative` on them, causing them to shift into the normal flow and appear at unexpected coordinates
- NOT marked as `_isClipped` because they partially overlap the container's visible area (the clipping detection at `analyzer-region.js:116` requires the element to be COMPLETELY outside the container)

### Current exclusion approach (viewer `renderOverlays` ~line 653)
```javascript
// Three checks: WeakSet identity, string-key fallback, containerRect overlap
var _isRegional = (_regionalBboxes && _regionalBboxes.has(bbox)) ||
  _regionalBboxKeys[...];
if (!_isRegional) {
  // Extended horizontal check: 3× container width on each side
  for (var _ri = 0; _ri < _containerRects.length; _ri++) {
    var _cr = _containerRects[_ri];
    var _exW = _cr.width * 3;
    if (bbox overlaps _cr expanded by _exW horizontally && bbox within _cr vertically) {
      _isRegional = true; break;
    }
  }
}
```

### Better approach: Mark ALL container descendants at extraction time

Instead of guessing which bboxes belong to carousel content via coordinate heuristics, **tag them at the source**. In the analysis iframe (where extraction runs), after detecting clipping containers, walk each container's DOM subtree and mark ALL its descendant contrastPairs with a `_regionContainer` ID. Then in the viewer, any pair with `_regionContainer` set gets excluded from the main overlay.

Implementation:
1. In `_regionScreenshotFn` (analyzer-region.js:130), after building `_clipContainerList`, walk each container's descendants and mark matching contrastPairs
2. The clip detection script (`getClipDetectionScript`) already has `__milgBboxRefs` — extend it to also set `pair._regionContainerId = cid` for ALL pairs inside a clipping container (not just clipped ones)
3. In the viewer's `renderOverlays()`, check `pair._regionContainerId` — if set, skip the bbox

This is more reliable than coordinate-based heuristics because it uses the actual DOM hierarchy.

## Key files

| File | Lines | What to change |
|------|-------|----------------|
| `docs/analyzer-viewer.js` | ~2100 | `renderRegionOverlays()` at line 796, `renderOverlays()` filter at line 653, rect event handlers |
| `docs/analyzer-region.js` | ~373 | `getClipDetectionScript()` at line 103, `_regionScreenshotFn` at line 130 |
| `docs/analyzer-iframe.js` | ~1310 | Calls `getClipDetectionScript()` — may need to pass container info |

## Data flow reference

```
Extraction (analyzer-extract.js in iframe)
  → contrastPairs[] with .bbox, tracked via __milgBboxRefs[]
  
Clip detection (analyzer-region.js getClipDetectionScript(), runs in iframe)
  → walks __milgBboxRefs, sets pair._isClipped = true if outside overflow:hidden ancestor
  
Region detection (_regionScreenshotFn, runs in iframe)  
  → finds clipping containers from _isClipped pairs
  → builds pairIndices[] (indices of clipped pairs per container)
  → clones container → mini-page iframe → force-reveal → extraction → screenshot + crop
  
Scoring (analyzer.js, runs in main page)
  → MilgScoring.runScoring(rgn.extractedData) → regionReport with categories/findings/bboxes
  
Viewer (analyzer-viewer.js)
  → open(): builds _allFindings from main report, _regionData[].findings from regionReport
  → renderOverlays(): main SVG rects, skips _isRegional bboxes
  → renderRegionOverlays(): region SVG rects with crop offset adjustment
  → Filter buttons → toggle _activeFilter → re-render both main + region overlays
```

## Coordinate systems

The region screenshot has TWO coordinate origins that don't match:

- **Extraction bboxes**: captured when mini-page iframe is 3000px tall (before resize). Coordinates from `getBoundingClientRect()` at that viewport size.
- **DOM content bounds**: computed after iframe resize to full scrollHeight. Used for the canvas crop rectangle.

The `cropOffsetX/Y` in `screenshotMeta` is computed from the EXTRACTION bboxes' min top/left (lines 297-312 in analyzer-region.js), so the viewer formula `canvasPos = bbox * scale - cropOffset` correctly maps extraction bboxes to the cropped canvas.

## Version

Current: v3.8. Bump to v3.9 after fixing. Update `<span>` in analyzer.html line 34 AND all `?v=` cache busters (26 script tags).

## Testing

1. `npx playwright test tests/region-debug.spec.js` — fink-translate.com diagnostic
2. Check `test-results/region-debug/viewer-region-section.png` — bbox overlays should appear ONLY when a filter is active (the test clicks "All" before screenshotting)
3. Check `test-results/region-debug/viewer-indicator-area.png` — NO bbox overlays should appear inside or near the container indicator area on the main screenshot
4. Manual test: open the viewer, verify filters toggle region overlays on/off, hover shows tooltip, click works
