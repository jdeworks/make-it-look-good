# Pixel Contrast Verification — Approach Reference

> **TL;DR:** Capture the page twice with domToCanvas (original at 1.5x + text mask), detect text boundaries via 4-connected neighbor check, sample FG at exactly dist=2 inside boundary, BG at dist 2-4 outside, cluster-average FG colors, match each FG pixel to nearest BG cluster, compute WCAG contrast ratio.

## Pipeline (7 Steps)

### Step 1: Capture original page
```
domToCanvas(document.documentElement, { scale: 1.5 })
→ screenshot (WebP 0.8 quality, for color sampling)
```

### Step 2: Apply mask CSS + capture per-layer masks
```css
*, *::before, *::after {
  color: #fff !important;
  background: transparent !important;
  background-image: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
  text-shadow: none !important;
  -webkit-text-fill-color: #fff !important;
  opacity: 1 !important;
  transition: none !important;
  animation: none !important;
}
html { background: #fff !important; }
img, svg, video, canvas, picture, iframe { opacity: 0 !important; }
```
Elements are layered by z-order. Each layer captures its text as white-on-white with text visible as dark pixels.

### Step 3: Extract binary mask
```
For each pixel in layer mask: avg(R, G, B) < 180 → mask[i] = 1 (foreground/text)
```

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
BFS flood fill: dist[neighbor] = dist[current] + 1, up to MAX_DIST = 7
```

### Step 6: Zone classification
```
FG zone: exactly dist=2 inside boundary (single-pixel inset line)
  - Tight space (3+ boundary cardinals): promote to FG directly
  - Fallback for thin strokes: deepest available inside pixel
BG zone: dist 2-4 outside boundary (thin ring)
  - Extends outside bbox via padding area sampling
  - Clustered into 4px grid cells, averaged per cell
```

FG cluster averaging: each FG pixel's color = average of nearby FG pixels within 6px radius.
FG outlier removal: reject pixels with luminance >40 from median.
Each FG pixel → matched to closest BG cluster by distance.

### Step 7: Contrast calculation
```
For each FG pixel: ratio = WCAG contrast(smoothedFG, closestBG)
Report: worst, P10, median, P90, best ratios
Threshold: P10 ratio used for pass/fail determination
```

## BBox Edge Contrast (v42.0)

Separate from text contrast. Checks if interactive/container elements visually stand out:
- Sample inner strip (3px inside bbox edge) and outer strip (5px outside)
- Average inner vs outer colors → compute contrast ratio
- Warning threshold: 1.15:1 (elements with border/shadow/outline exempt)
- Severity: WARNING only (not error) since border/outline can provide distinction

## Viewer Display Rules
- On hover over a verify rect, show nearest FG/BG pair with color swatches
- 5 percentile dots: worst, P10, median, P90, best (with pair-specific tooltips)
- Right-click on verify rect cycles debug overlay: none → mask → zones
- BBox edge warnings shown as dashed yellow rects with "edge X:1" labels

## Key Constants
| Constant | Value | Rationale |
|----------|-------|-----------|
| SCREENSHOT_SCALE | 1.5 | Good text AA resolution without excessive memory |
| SCREENSHOT_QUALITY | 0.8 | WebP quality (PNG tested, no improvement) |
| FG_IDEAL | 2 | 2px inside boundary — skips AA fringe |
| BG_DIST_MIN | 2 | Background ring starts 2px outside |
| BG_DIST_MAX | 4 | Background ring ends 4px outside |
| BG_SEARCH_R | 12 | Max radius for BG cluster matching |
| FG_CLUSTER_R | 6 | FG color averaging radius |
| BG_CELL | 4 | BG pixel clustering grid size |
| LUM_THRESHOLD | 40 | FG outlier rejection (luminance from median) |
| EDGE_INNER_DIST | 3 | BBox edge: sample 3px inside |
| EDGE_OUTER_DIST | 5 | BBox edge: sample 5px outside |
| EDGE_WARN_RATIO | 1.15 | BBox edge: below this = blends into bg |

## Files
- `analyzer-iframe.js` — screenshot + mask capture pipeline
- `analyzer-contrast-verify.js` — pixel contrast verification (boundary-based + bbox edge)
- `analyzer-viewer.js` — viewer overlay, debug layers, tooltips
- `analyzer-snippet-screenshots.js` — console snippet with screenshot capture
- `analyzer-extract.js` — DOM data extraction (bgEdgePairs collection)
