# Task: Add mask pipeline to region mini-pages (v3.10)

## Context

The analyzer detects overflow:hidden containers (carousels, tabs) and creates "region" sub-pages with independent analysis. **v3.9.4 fixed the main overlay exclusion** — carousel bboxes no longer leak onto the main screenshot. But **region pixel verification is broken** because region mini-pages don't capture text masks.

## Current status (v3.9.4)

### What works
- `_regionContainerId` tagging: 60/116 pairs tagged, survives postMessage ✓
- Pre-scoring filter: scoring sees only 56 main-page pairs ✓  
- Verify exclusion: `clippedSkipped=60` (both `_isClipped` and `_regionContainerId` pairs skipped) ✓
- Region extraction + scoring: 60 pairs extracted, scored 82/100 ✓
- Region overlays: severity/category filters show bboxes on region screenshot ✓
- Diagnostic copy button: `_milgCopyDiag()` or header clipboard icon captures `[D]`, `[milg-verify]`, `[milg-region]`, `[milg]` logs ✓

### What's broken
- **Region pixel verify**: `maskBmp=0/60 verified=0 noFgBg=60` — ALL region pairs fail because no mask data exists
- Region mini-pages run `MilgExtract` + single `domToCanvas` but NOT the mask capture pipeline
- Without `_maskBmp`, the edge-based verifier can't run, grid fallback can't find FG/BG
- "Pixel Verified" and "Pixel Fails" filters show nothing on region screenshots

## The problem: missing mask pipeline in region mini-pages

### Main page mask flow (works — in analyzer-iframe.js)
1. After screenshot capture, for each text layer:
   - Set layer text to black via inline `color: #000`
   - `domToCanvas()` to capture mask bitmap
   - Read pixel data, threshold at 240
   - Bit-pack into Uint8Array, base64 encode
   - Store on each pair: `_maskBmp`, `_maskPacked`, `_maskW`, `_maskH`, `_maskLayer`, `_maskDark`
2. The verify function checks `pair._maskBmp` to decide edge vs grid method
3. Edge method uses the mask to identify text vs background pixels

### Region mini-page flow (broken — in analyzer-region.js `_regionScreenshotFn`)
1. Clone container → mini-page iframe → force-reveal → `MilgExtract()` → single `domToCanvas()` → return
2. NO mask capture pass
3. Region pairs have no `_maskBmp` → verify produces zero results

## What needs to change

The user's directive: **"The mini pages should be handled the same as the main page. Not just the bbox but also the interaction with them like masking and pixel compare. In multi-viewport analysis we do something similar — we run the whole logic again with a different viewport. In this case we run the whole logic again with a different DOM tree."**

The region mini-page needs to also run the mask pipeline. This means adding to `_regionScreenshotFn` (or a post-processing step):

1. After the region screenshot `domToCanvas`, identify text elements (build layers like the main pipeline)
2. For each layer: set text color to black → `domToCanvas` → extract mask → unpack per pair
3. Store `_maskBmp` etc. on `rgn.extractedData.colors.contrastPairs`
4. Then when `MilgContrastVerify.verify(miniReport)` runs for the region, pairs have masks and verification works

### Key constraint
Must work for **console snippet AND HTML paste AND URL** — build on same modules. For console snippet, code must be self-contained in one assembled function.

## Key files

| File | What to change |
|------|----------------|
| `docs/analyzer-region.js` | `_regionScreenshotFn` (line 155) — add mask capture after screenshot |
| `docs/analyzer-iframe.js` | Reference for mask pipeline (Phase D, lines ~900-1095) — the mask layer logic to replicate |
| `docs/analyzer-viewer.js` | `renderRegionVerifyOverlays()` already exists (line ~1600), will work once data exists |
| `docs/analyzer-contrast-verify.js` | Already handles `_maskBmp` pairs correctly, no changes needed |

## Data flow reference

```
Region mini-page iframe:
  MilgExtract() → __milgData with contrastPairs + __milgBboxRefs
  domToCanvas() → screenshot (already working)
  *** ADD: mask layer detection → domToCanvas per layer → unpack _maskBmp per pair ***
  
Return to parent:
  { screenshot, screenshotMeta, extractedData (with _maskBmp on pairs), ... }

Scoring (analyzer.js):
  MilgScoring.runScoring(rgn.extractedData) → rgn.regionReport (already working)

Pixel verify (analyzer.js ~line 963):
  MilgContrastVerify.verify(miniReport) → rgn.regionVerifyResults
  *** WILL WORK once pairs have _maskBmp ***

Viewer (analyzer-viewer.js):
  renderRegionVerifyOverlays(rd) reads rd.regionRef.regionVerifyResults
  *** WILL WORK once verify produces results ***
```

## Mask pipeline details (from analyzer-iframe.js)

The mask capture in the main page works like this (simplified):

```javascript
// 1. Build pair-element list from __milgBboxRefs
var _pairEls = [];
_refs.forEach(function(ref) {
    if (ref.obj.ratio !== undefined) {
        _pairEls.push({ pair: ref.obj, el: ref.el, idx: _pairs.indexOf(ref.obj) });
    }
});

// 2. Group into layers (overlapping elements get separate layers)
var _layers = buildOverlapLayers(_pairEls, scaleX, scaleY);

// 3. For each layer:
layer.forEach(function(pe) { pe.el.style.color = '#000'; });
domToCanvas(root, { scale }).then(function(maskCanvas) {
    var ctx = maskCanvas.getContext('2d');
    // For each element in the layer:
    layer.forEach(function(pe) {
        var bbox = pe.pair.bbox;
        var imgData = ctx.getImageData(bx, by, bw, bh);
        // Threshold: pixel < 240 brightness = text
        // Bit-pack into Uint8Array, base64 encode
        pe.pair._maskBmp = base64String;
        pe.pair._maskW = bw;
        pe.pair._maskH = bh;
        pe.pair._maskDark = darkPixelCount;
    });
    layer.forEach(function(pe) { pe.el.style.color = ''; }); // reset
});
```

The region version needs to do the same in the mini-page iframe context.

## Version
Current: v3.9.4. Bump to v3.10 after implementing.

## Testing
1. Run fink-translate.com → check `_milgCopyDiag()` output
2. Region verify stats should show `maskBmp=N/60 verified=N` (not 0/60)
3. Click "Pixel Verified" → region screenshot should show overlays
4. Click "Pixel Fails" → region should highlight failing pairs (if any)
