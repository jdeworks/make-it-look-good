# Task: Region pipeline unification + verify v3.11.6

## What was fixed in v3.11 → v3.11.6

### v3.11: Verify callback crash + layout findings leak
- Wrapped verifyPair() in try-catch inside processBatch (silent batch death)
- Added alignmentElements + borderRadii to updatedData from iframe→parent
- Filtered layout items by _regionContainerId before main scoring
- Added layout items to _addRegionalBbox exclusion in viewer

### v3.11.1: Region verify re-render + phantom error counts
- Call MilgViewer.refreshRegionOverlays() after async region verify callback
- Summary bar counts now filter by locator.bboxes presence

### v3.11.3: Clean screenshot preview
- Report preview now shows a single 240px thumbnail of the clean (as-rendered) screenshot
- Previously showed expanded screenshot sections with carousel content overlaying the page

### v3.11.4: Main verify excludes region rects + right-click fix
- Added containerRect bounds check to renderVerifyOverlays — verify rects inside region containers excluded from main overlay
- Right-click on verify rects cycles mask/zones debug layers (was showing generic debug menu)

### v3.11.5: Region verify coordinate mismatch (ROOT CAUSE FIX)
- **Root cause**: cropOffsetY was computed from extraction bboxes (pre-resize mini-page ~40002), but `__milgReReadBboxes()` mutated those same bbox objects during mask capture to post-resize coordinates (~9345). Verify results inherited the mutated bboxes → rects at y=-45945 (off-screen).
- **Fix**: Compute cropOffset from DOM content bounds (same values used for actual canvas crop), not from extraction bboxes that get mutated. In `analyzer-region.js` lines 316-325.

### v3.11.6: Full interaction parity for region verify rects
- Right-click/double-click: cycle mask/zones debug layers
- Click: cycle sample point dots (all/worst/P10/median/P90/best/off)
- Hover: verify tooltip with nearest FG/BG sample colors and ratio
- showVerifyTooltip accepts optional results array for region context

## Testing v3.11.6
1. Confirm header shows **v3.11.6**
2. Run fink-translate.com → open viewer
3. Select "Pixel Verified" or "Pixel Fails" filter:
   - Main screenshot: NO verify rects in the carousel area (containerRect exclusion)
   - Region section: verify overlay rects visible with correct positioning
   - Right-click on region verify rect → cycles mask/zones
   - Click on region verify rect → cycles sample dots
   - Hover shows tooltip with FG/BG colors
4. Select severity filter (e.g. "All"): region findings render correctly
5. Preview thumbnail shows clean page (no carousel overlay)
6. regionExcluded count in console log should be >0

## Next: Region pipeline unification

Deep analysis found these issues across the three analysis modes (URL, HTML paste, console snippet):

### Issue 1: Console snippet missing cropOffset (HIGH)
- **Location**: `docs/analyzer-snippet-screenshots.js` lines 331-335
- Snippet region data uses `localBboxes` (relative coordinates) instead of `cropOffsetX/Y`
- Pixel verify falls back to cropOffset=0, mapping to wrong canvas pixels
- **Fix**: Apply the same content-bounds crop offset logic from `analyzer-region.js` lines 316-325

### Issue 2: Inline fallback duplicates MilgRegion (MEDIUM)
- **Location**: `docs/analyzer-iframe.js` lines 381-540
- ~160 lines duplicate all of analyzer-region.js as a fallback
- MilgRegion is always loaded (via script tag in analyzer.html), so fallback is dead code
- **Fix**: Remove fallback, always use MilgRegion.getRegionFn()

### Issue 3: Console snippet region data format mismatch (MEDIUM)
- Snippet regions lack `extractedData` and `maskResults` fields
- Viewer/verify code expects these → no regional findings or mask-based verify for snippet
- **Fix**: Populate extractedData + maskResults in snippet region capture, matching iframe format

### Priority order
1. Add cropOffset to snippet regions (correctness)
2. Remove inline fallback from analyzer-iframe.js (maintenance)
3. Unify region data format across modes (completeness)

## Key files
| File | Role |
|------|------|
| `docs/analyzer-region.js` | Shared region detection module (MilgRegion) |
| `docs/analyzer-iframe.js` | URL/HTML mode — uses MilgRegion + has inline fallback to remove |
| `docs/analyzer-snippet-screenshots.js` | Console snippet — needs cropOffset + data format alignment |
| `docs/analyzer-viewer.js` | Viewer overlays — region verify interactions added in v3.11.6 |
| `docs/analyzer-contrast-verify.js` | Pixel verify — uses cropOffset for coordinate mapping |
| `docs/analyzer.js` | Orchestrator — region scoring + verify kickoff |

## Version
Current: v3.11.6
