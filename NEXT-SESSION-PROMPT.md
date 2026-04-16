# Task: Verify v3.11 region fixes

## What was fixed in v3.11

### Fix 1: Region verify callback crash (analyzer-contrast-verify.js)
**Root cause**: `processBatch()` runs via `setTimeout` — if `verifyPair()` throws on ANY pair, the batch loop dies silently (unhandled async error) and the callback never fires. The v3.10.4 try-catch only protected `bgEdgePairs` AFTER batch completion.
**Fix**: Wrapped `verifyPair()` call in try-catch inside `processBatch`. Individual pair errors are logged as `[milg-verify] verifyPair[N] error:` and counted as `noFgBg`.

### Fix 2: Layout findings leak into main overlay (3 files)
**Root cause**: `layout.alignmentElements` and `layout.borderRadii` were not included in `updatedData` sent from iframe to parent. The `_regionContainerId` and `_rcid` tags (set during force-reveal) never reached the parent data. Three gaps compounded:
1. `updatedData` omitted layout items → `_rcid` lost in transit
2. Viewer's `_addRegionalBbox` only processed headings/touchTargets → string-key exclusion missed layout items
3. Scoring didn't filter layout items → carousel elements inflated aggregate counts

**Fixes applied:**
- `analyzer-iframe.js`: Added `alignmentElements` and `borderRadii` to `updatedData` + parent merge
- `analyzer.js`: Filter `alignmentElements` by `_regionContainerId` and `borderRadii` by `_rcid` before main scoring (restore after)
- `analyzer-viewer.js`: Added `alignmentElements` and `borderRadii` to `_addRegionalBbox` exclusion sets

## Testing (v3.11)
1. Confirm header shows **v3.11**
2. Run fink-translate.com → `_milgCopyDiag()`:
   - `[milg] Region pixel verify: N results` should appear (callback now survives pair errors)
   - `[milg-verify] verifyPair[N] error:` may appear (shows which pairs crashed — for future debugging)
   - `[D] scoring filter: ... align removed=N` should show carousel alignment elements were excluded
3. Region "Pixel Verified"/"Pixel Fails" filters should now render overlays
4. Main screenshot should NOT show jagged alignment / border-radius bboxes in carousel area
5. Region overlay should still show its own findings independently

## Key files changed
| File | Change |
|------|--------|
| `docs/analyzer-contrast-verify.js` | try-catch around verifyPair in processBatch |
| `docs/analyzer-iframe.js` | alignmentElements + borderRadii in updatedData + parent merge |
| `docs/analyzer.js` | Filter layout items before scoring, restore after |
| `docs/analyzer-viewer.js` | Add layout items to _addRegionalBbox exclusion |
| `docs/analyzer.html` | Version bump v3.11 |

## If verify still shows 0 results
The try-catch will now log `[milg-verify] verifyPair[N] error:` for crashing pairs. If ALL pairs crash, results will be empty but the callback WILL fire (no more silent death). Check the error messages to understand what region pairs have differently (likely a coordinate/meta issue).

## Version
Current: v3.11
