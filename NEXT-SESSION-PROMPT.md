# Analyzer state — capture/mask/region unified (v3.11.15)

## What was done (v3.11.6 → v3.11.15)

Goal: make extraction + region/mask + full-page capture **single-source** across all
input modes so a change in one place applies everywhere — killing the recurring
"fixed it for URL mode but missed snippet mode" bug class.

### Architecture now
```
<mode PRE>  →  [shared core: MilgExtract + MilgRegion + MilgCapture]  →  <mode POST>
URL/iframe : proxy-fetch → build hidden srcdoc iframe, inject core via .toString() → postMessage → runAnalysis
Snippet    : live page    → core inlined into paste block via manifest               → data obj → paste/import → runAnalysis
Crawl      : per-page same-origin iframe → core injected into each crawl iframe       → aggregate per page
Load saved : —            → replay only                                              → runAnalysis
```
Shared modules expose serializable `getXxxFn()` returning **context-free** functions.
Mode differences (PRE prep, image preload, result-send, region fn) are passed as
`opts` (`preHookSrc` / `preloadSrc` / `sendFn` / `regionFnSrc`) — never branched inside
the core. The snippet paste block is assembled by `SNIPPET_MANIFEST` + literal
`// @milg-insert: <part>` markers in `analyzer.js` `loadSnippet()`.

### Stages shipped
| Stage | Version | What |
|------|---------|------|
| 1 | — | Migrated Playwright tests off the paste-HTML harness onto real URL mode |
| 2 | 3.11.7 | Removed the Paste-HTML input mode entirely |
| 3 | 3.11.8 | Deleted dead `_regionScreenshotFnFallback` (~160 lines) in analyzer-iframe.js |
| 4 | 3.11.9 | Robust marker/manifest snippet assembly (replaced fragile regex) |
| 5 | 3.11.10 | Snippet uses shared `MilgRegion` (deleted its localBboxes region copy) |
| 5b | 3.11.11 | Moved region marking pre-pass into MilgRegion (was duplicated) |
| 6a | 3.11.12 | Unified full-page mask dark-pixel threshold to 240 (snippet/crawl were 180) |
| 6b | 3.11.13 | Extracted iframe capture into new `analyzer-capture.js` (`MilgCapture`) |
| 6c | 3.11.14 | Snippet adopts `MilgCapture` (multi-layer upgrade); regions via core |
| 6d | 3.11.15 | Crawl adopts `MilgCapture`; third capture copy retired |

The full-page capture+mask core is now single-source in `docs/analyzer-capture.js`.
On the carousel fixture, URL-mode and snippet-mode output is byte-identical.

## Key files
| File | Module / role |
|------|---------------|
| `docs/analyzer-extract.js` | `MilgExtract` — DOM/style/token extraction (shared) |
| `docs/analyzer-region.js` | `MilgRegion` — region/carousel detect + per-region screenshot + mask + crop + marking |
| `docs/analyzer-capture.js` | `MilgCapture` — full-page screenshot + multi-layer mask (shared; NEW) |
| `docs/analyzer-iframe.js` | URL-mode shell — proxy/iframe/inject + postMessage |
| `docs/analyzer-snippet-screenshots.js` | Snippet + crawl shells — live-page PRE + clipboard/download POST |
| `docs/analyzer.js` | Orchestrator — `runAnalysis`, `SNIPPET_MANIFEST` / `loadSnippet`, region scoring + verify |

## Cross-mode alignment (v3.11.16)
- **Crawl upgraded to full parity:** crawled pages now use `expand:true` + real region screenshots (region fn serialized in the parent realm, injected per crawl iframe with a no-op fallback). Poll cap 80→160 (80s), hard timeout 45s→90s.
- **Parity proven + guarded:** `tests/cross-mode-parity.spec.js` analyzes a self-contained fixture (`docs/tests/fixtures/parity-page.html`) in BOTH URL and snippet mode at width 1280 and asserts results match — measured identical (score 93=93, contrast pairs 20=20, region 1=1, findings 25=25). Carousel capture/mask was already byte-identical across modes (Stage 6c).
- **The earlier "iframe under-renders responsive pages" follow-up was a MISDIAGNOSIS.** The pricing preset is a bare HTML *fragment* with no CSS of its own: URL mode wraps fragments and injects the Tailwind CDN → styled 1212px (correct); a snippet run on the bare fragment sees no CSS → unstyled 30656px. For real sites (which ship their own CSS) both modes load it and agree; the only inherent residual is viewport width (URL default 1280 vs snippet = live window width — desktop widths 1280–1920 give identical layout height).

## Tests
- `npx playwright test tests/html-analysis.spec.js tests/region-debug.spec.js tests/cross-mode-parity.spec.js --reporter=list` → all green (URL mode; serves docs/ on :8384).
- `node tests/crawl-flow.test.mjs` → 22/0 (URL discovery/normalization only — does NOT cover capture).
- `node tests/contrast-and-palette.test.mjs` → 8 pre-existing failures (focus-visible primary colors + accordion contrast), unrelated to this effort.
- region-debug baseline anchor: region 1, score 84, crop (0,15627), container {744,3863,350,467}. Note: that test hits live fink-translate.com — compare structurally, not byte-exact.

## Follow-ups (not done)
1. `docs/tests/test-bbox-viewer.js` Test 1: 4 assertions read `sessionStorage['milg-last-extraction']` which the analyzer never writes (it exposes `window.__milgLastReport`). Pre-existing, not wired into CI — fix the test to read `window.__milgLastReport.raw`.
2. `textMask` (full-page combined data URI) is now `null` in all modes — consumers use per-pair `_maskBmp`. If anything still expects the combined mask, it should be removed.
3. Minor: an unused `var _cacheBust` remains in `analyzer-snippet-screenshots.js` (Stage 4 left it for parity).
4. Viewport parity for real sites is inherent-limited: a live-page snippet reflects the user's real window width and can't be forced to URL mode's fixed viewport. Acceptable/desired (analyzes the page as the user sees it); only pathological for bare fragment presets, which should be analyzed via URL mode.
