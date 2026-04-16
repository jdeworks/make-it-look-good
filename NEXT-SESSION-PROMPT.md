# Task: Verify v3.11.1 region fixes

## What was fixed in v3.11.1

### Fix 1: Region pixel verify overlays never appear (analyzer.js + analyzer-viewer.js)
**Root cause**: `MilgContrastVerify.verify()` runs asynchronously. When the callback fires and sets `rgn.regionVerifyResults`, nothing triggers a re-render of the region SVG overlays. The viewer's `renderRegionVerifyOverlays()` only runs on filter toggle — but if the filter was already set to 'verify' before results arrived, the overlays stay empty.
**Fix**: After storing `regionVerifyResults`, call `MilgViewer.refreshRegionOverlays()` (newly exposed) to re-render all region overlays with the now-available verify data.

### Fix 2: Summary bar shows phantom errors/warnings (analyzer-viewer.js)
**Root cause**: The region summary bar counted ALL findings from scoring (including those without `locator.bboxes`), but overlay rendering only shows findings that have bboxes. This made the bar show "13 errors, 3 warnings" when only a few were actually visible.
**Fix**: Summary bar count now filters by `f.locator.bboxes.length > 0`, matching the same filter used for building `rgnFindings`.

## Testing (v3.11.1)
1. Confirm header shows **v3.11.1**
2. Run fink-translate.com with deep scan → regions should appear
3. Select "Pixel Verified" or "Pixel Fails" filter:
   - Region screenshots should now show verify overlay rects (green/red/yellow)
   - Console should log `[milg-viewer] Region verify overlays: N results, M rects`
4. Region summary bar error/warning counts should now match what's actually visible as overlay rects
5. Main screenshot verify overlays should still work as before

## Key files changed
| File | Change |
|------|--------|
| `docs/analyzer.js` | Call MilgViewer.refreshRegionOverlays() after region verify callback |
| `docs/analyzer-viewer.js` | Expose refreshRegionOverlays; filter summary bar counts by bbox presence |
| `docs/analyzer.html` | Version bump v3.11.1 |

## Version
Current: v3.11.1
