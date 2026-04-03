# Pixel Contrast Verification — Approach Reference

> **TL;DR:** Capture the whole page twice with domToCanvas (original + mask), detect text boundaries via 4-connected neighbor check, sample FG colors 0.5–1.5px inside and BG colors 3–4px outside the boundary, group connected pixels, average colors per group, calculate WCAG contrast ratio.

## What We Learned (Investigation Log)

### Problem: Mask misalignment on nav bar elements
- The tokenmade test page nav uses Tailwind `fixed top-0 flex items-center`
- The saved HTML referenced external `/_next/static/css/` files that don't load in srcdoc iframe
- **Without CSS, flex/fixed/centering don't apply** — text renders at default block positions
- This was the primary cause of mask offset (text at top-left of bbox instead of centered)

### fillText fallback is fundamentally broken
- The analyzer's fillText fallback renders text at `(0,0)` within a bbox-sized canvas
- Even with padding/flex-centering corrections, it can never match real DOM rendering:
  - Line breaking differs from browser layout
  - Font metrics differ between fillText and CSS rendering
  - No support for flex gap, margin collapse, pseudo-elements, etc.
- **Decision: abandon fillText, use domToCanvas for masks**

### Edge detection (Roberts/Sobel/etc.) smudges
- Convolution-based edge detectors widen the boundary by 1-2px
- For small text this is significant — edges bleed into each other
- **Decision: use simple 4-connected boundary detection** (is this pixel FG and neighbor BG?)

### Background must be transparent, not white
- Setting `background: white` on all elements makes overlapping elements (gradient overlays, decorative shapes) render as solid white, blocking text beneath
- **Decision: `background: transparent` on all elements, `background: white` only on `<html>`**
- Canvas naturally shows white where nothing is rendered

### Scale matters for small text
- At 0.5x scale, small text characters lose detail on diagonals and curves
- At 2x scale, what was anti-aliased at 1x becomes distinct dark/light pixels
- **Decision: capture at 2x for half-pixel edge accuracy**

## Pipeline (7 Steps)

### Step 1: Capture original page
```
domToCanvas(document.documentElement, { scale: 2.0 })
→ origCanvas (for color sampling)
```

### Step 2: Apply mask CSS + capture mask
```css
*, *::before, *::after {
  color: #000 !important;
  background: transparent !important;
  background-image: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
  text-shadow: none !important;
  -webkit-text-fill-color: #000 !important;
  opacity: 1 !important;
  transition: none !important;
  animation: none !important;
}
html { background: #fff !important; }
img, svg, video, canvas, picture, iframe { opacity: 0 !important; }
```
```
domToCanvas(document.documentElement, { scale: 2.0 })
→ maskCanvas (for boundary detection)
```
Remove mask CSS immediately after capture.

### Step 3: Extract binary mask
```
For each pixel: avg(R, G, B) < 180 → mask[i] = 1 (foreground/text)
```
Threshold 180 at 2x scale captures text cleanly without picking up light artifacts.

### Step 4: Boundary detection (4-connected)
```
For each mask[i] = 1:
  If any of 4 neighbors (up/down/left/right) is mask = 0:
    cat[i] = 1 (boundary)
  Else:
    cat[i] = 2 (inside)
```
No convolution. No smudging. Exact pixel boundary.

### Step 5: BFS distance from boundary
```
Initialize: all boundary pixels → dist = 0, queue
BFS flood fill: dist[neighbor] = dist[current] + 1, up to MAX_DIST = 10
```

### Step 6: Zone classification + connected component grouping
```
FG sample zone: mask = 1 AND dist 1–3  (@2x = 0.5–1.5 display px inside)
BG sample zone: mask = 0 AND dist 6–8  (@2x = 3–4 display px outside)
```
- FG is constrained to inside the bbox for per-element display
- **BG can extend outside the bbox** — the background color at 3-4px away is what the eye sees
- Connected component labeling via flood fill (8-connected) groups adjacent FG/BG pixels
- Each FG group is matched to the nearest BG group by centroid distance

### Step 7: Color averaging + contrast calculation
```
For each group: average R, G, B from the ORIGINAL screenshot at those pixel positions
For each FG/BG pair: WCAG contrast ratio = (L1 + 0.05) / (L2 + 0.05)
```

## Viewer Display Rules
- Don't show all FG/BG points at once (too noisy)
- On element interaction, show FG pixels inside that element's bbox
- BG pixels for that element can extend outside the bbox
- Color-code: red = boundary, orange = FG sample, green = BG sample
- Tooltip: contrast ratio, PASS/AA-lg/FAIL, color swatches

## Key Constants
| Constant | Value | Rationale |
|----------|-------|-----------|
| SCALE | 2.0 | Half-pixel accuracy for small text |
| Mask threshold | 180 | Clean text detection at 2x |
| FG zone | dist 1–3 @2x | 0.5–1.5 display px inside boundary |
| BG zone | dist 6–8 @2x | 3–4 display px outside (thin ring) |
| BFS max | 10 | Enough for BG zone + margin |

## Files
- `analyzer-iframe.js` — mask capture (Phase B CSS, domToCanvas)
- `analyzer-contrast-verify.js` — pixel contrast pipeline (this rewrite)
- `analyzer-viewer.js` — debug overlay display
- `docs/tests/test-page-small.html` — test page with interactive overlay prototype
