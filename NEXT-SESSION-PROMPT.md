# Task: Fix remaining region issues (v3.10.4 → v3.11)

## Context

The analyzer detects overflow:hidden containers (carousels, tabs), creates "region" mini-pages with independent analysis, and runs pixel verification on them. v3.10–v3.10.4 added the mask pipeline, mask data flow, false-positive stripping, right-click debug menus, and bbox exclusion. Two issues remain.

## Current status (v3.10.4)

### What works
- Region mask capture: `maskResults=58 maskBmp=58` — masks flow through the dict correctly
- Region pixel verify: `verified=58 noFgBg=2` — verify runs and produces results
- Main page masks: `maskBmp=56/56 verified=56` — fully working
- Region false-positive stripping: horizontal scroll, offscreen elements, hidden panels removed from region scoring
- Right-click debug menu: works on all 4 overlay types (finding, verify, region finding, region verify)
- Region scoring: 83/100 with 13 errors, 3 warnings, 13 info

### What's broken

#### 1. Region verify overlays don't render
Despite 58 verified pairs, "Pixel Verified" and "Pixel Fails" filters show nothing on the region screenshot. The `[milg] Region pixel verify:` callback log never appears in diagnostics, meaning the verify callback chain was dying before `rgn.regionVerifyResults` got set. v3.10.4 added try-catch around `bgEdgePairs` (the suspected crash site) but this hasn't been confirmed working yet.

**Diagnostic to check**: After deploying v3.10.4, run fink-translate.com and check `_milgCopyDiag()` for:
- `[milg] Region pixel verify: N results` — if this appears, the callback fix worked
- `[milg-verify] bboxEdge error:` — if this appears, the bgEdgePairs crash was the cause
- `[D] renderRegionVerifyOverlays bail:` — if this appears, results aren't reaching the viewer

If the callback fix didn't help, the crash is somewhere else in the verify pipeline between the stats log and the callback. The next step would be wrapping the ENTIRE `onAllLoaded` function body in try-catch.

#### 2. Main page overlay still shows findings for hidden elements
Findings like "4 jagged alignment(s)" and "7 distinct border-radius values" appear on the main screenshot at bbox positions inside the carousel area (e.g., `{left:444, top:2088}`). These come from scoring modules that analyze aggregate page metrics including hidden carousel content.

v3.10.4 added "region-bounds" exclusion: builds a merged bounding rect from all clipped/region contrast pair bboxes and excludes any finding bbox whose center falls within it. This hasn't been confirmed working yet.

**Diagnostic to check**: Look for `[D] viewer exclusion keys=N regionBounds=N [coords]` in the output. The coords should cover the Y range where the carousel sits (~y:2000–2300 based on the debug data). If `regionBounds=0`, the clipped pairs don't have bboxes, or the merge logic has a bug.

The user's last debug capture showed the leaking bbox at `{left:444, top:2088}`. The region bounds should contain center point `(605, 2107.5)`. If the bounds don't cover this, the merge tolerance (50px Y) might need increasing, or the clipped pair bboxes are in a different Y range than expected.

**Fallback approach**: If region-bounds exclusion still fails, the most reliable fix is to filter findings in `analyzer.js` AFTER scoring but BEFORE passing to the viewer. Iterate `reportData.categories[].findings[]`, check each finding's `locator.bboxes` against clipped pair bbox positions (using a spatial index or Y-range check), and remove findings where ALL bboxes are inside regions.

#### 3. Region overlay shows only info-level findings (blue boxes)
The score bar shows 13 errors, 3 warnings, 13 info — but the overlay only shows blue (info) boxes. This is likely CORRECT behavior: the error findings (probably contrast and typography) don't have `locator.bboxes` in the region context, so they're excluded from the overlay by the `f.locator.bboxes.length === 0` filter in the viewer's region findings builder (line ~357). Only info-level findings (border-radius, alignment) have bboxes.

To verify: check `window.__milgLastReport.raw.regionScreenshots[0].regionReport.categories` in the console and inspect which categories have error-level findings with bboxes vs without.

## Key files

| File | What changed in v3.10–v3.10.4 |
|------|------|
| `docs/analyzer-region.js` | Mask capture pipeline, maskResults dict, increased timeouts |
| `docs/analyzer-contrast-verify.js` | cropOffset in prepareContext + verifyBboxEdge, try-catch around bgEdgePairs |
| `docs/analyzer-viewer.js` | Right-click debug menu, region-bounds exclusion, diagnostic logging |
| `docs/analyzer.js` | Region false-positive stripping, maskResults application before verify |

## Data flow reference

```
Region mini-page iframe (analyzer-region.js):
  MilgExtract() → __milgData + __milgBboxRefs
  domToCanvas() → screenshot
  Mask pipeline: kill transitions → mask style → overlap layers → domToCanvas per layer
    → extract/bit-pack/base64 → store in _mMaskResults dict + on pairs
  Return: { screenshot, screenshotMeta, extractedData, maskResults, containerRect }

Parent receives via postMessage structured clone (analyzer-iframe.js):
  reportData.raw.regionScreenshots[i] = above data

Scoring (analyzer.js ~line 771):
  Strip layout false positives (hscroll, offscreen, hidden panels)
  MilgScoring.runScoring(rgn.extractedData) → rgn.regionReport

Verify (analyzer.js ~line 1004):
  Apply maskResults dict → pairs get _maskBmp/_maskW/_maskH/_maskDark
  Build miniReport with region screenshot + extraction colors
  MilgContrastVerify.verify(miniReport) → rgn.regionVerifyResults

Viewer (analyzer-viewer.js):
  renderRegionOverlays() → severity/category filter overlays
  renderRegionVerifyOverlays(rd) → pixel verify overlays (reads rd.regionRef.regionVerifyResults)
```

## Version
Current: v3.10.4. Bump to v3.11 after fixing.

## Testing
1. Run fink-translate.com → check `_milgCopyDiag()` output
2. `[milg] Region pixel verify: N results` should appear (verify callback works)
3. Region "Pixel Verified" filter should show overlay boxes
4. Main screenshot should NOT show findings with bboxes in the carousel area
5. `[D] viewer exclusion regionBounds=N [coords]` should show the carousel Y range
