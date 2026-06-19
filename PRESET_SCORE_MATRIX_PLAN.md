# Preset Score Matrix Plan

Purpose: build a deterministic scoring pipeline for every relevant template combination so the gallery can show score badges and we can find weak combinations before launch.

This document is intended to be handed to a clean Codex/LLM session as the implementation brief for the scoring system.

## Core Idea

The analyzer is deterministic. We should use that to generate scores for template combinations, then filter the results for combinations that need design fixes.

The existing `node scripts/test-presets-headless.mjs` validates base presets. It now runs all 125 preset variants successfully through a headless browser path, but it only covers one default rendering per preset.

We need a broader matrix:

- template
- personality variant
- viewport
- color accent
- dark mode
- visual effect
- preview/fullscreen state where relevant

This creates a large cross product. Run it in parallel, save structured results, then inspect only failures and low scores.

## Important Scope Rule

Exclude `before` variants from quality scoring. They are intentionally worse.

Still allow before/after delta scoring separately, but do not fail the quality gate because a `before` preset scores low.

## Recommended Implementation Language

Prefer Node + Playwright over Python.

Reasons:

- The product is browser-based.
- Existing tests already use Playwright.
- Existing scoring modules are JavaScript.
- It avoids Python-to-browser glue complexity.

Python is acceptable only as an orchestrator, but the actual rendering/scoring should still happen through Playwright/Chromium.

## Target Artifacts

Generate these files:

```text
docs/presets/scores.json
research/preset-score-matrix/latest.json
research/preset-score-matrix/latest.md
research/preset-score-matrix/failures.md
```

`docs/presets/scores.json` is the compact production artifact used by the gallery.

`research/...` files are local/development reports. Note that `research/*` is ignored except `research/sources.md`, so do not rely on those being committed unless `.gitignore` is changed intentionally.

Runs must not replace the gallery artifact by default. Focused and global runs should write research artifacts only unless `--publish` is passed intentionally. Publish only after blocker rows are fixed and the final rescore is the one we want the gallery to consume.

Use two gates:

- Blocker gate: run error or overall score below 95. These should be fixed before publishing the gallery scores.
- Polish gate: category-level errors/warnings at an otherwise passing overall score. These should be grouped and reviewed after blockers, but they should not automatically block publication.

## Suggested Score Schema

Compact gallery artifact:

```json
{
  "generatedAt": "2026-06-16T00:00:00.000Z",
  "analyzerVersion": "3.11.66",
  "matrix": {
    "landing/clean": {
      "default": {
        "score": 97,
        "grade": "A",
        "errors": 2,
        "warnings": 0
      },
      "min": 91,
      "max": 100,
      "avg": 96,
      "failures": 0,
      "worst": [
        {
          "score": 91,
          "viewport": "mobile",
          "color": "yellow",
          "effect": "frosted",
          "dark": false
        }
      ]
    }
  }
}
```

Full research artifact should include category scores and top findings for every combination.

## Matrix Dimensions

### Templates

Source: `docs/presets/index.json`

Include:

- every element
- every personality listed in `elements[element].personalities`

Exclude:

- `before` personality for quality gate

### Viewports

Minimum set:

- `mobile`: `375x812`
- `tablet`: `768x1024`
- `desktop`: `1280x900`
- `wide`: `1920x1080`

Optional additional stress viewports:

- `small-mobile`: `320x568`
- `short-desktop`: `1280x720`

### Colors

Testing every Tailwind accent for every combination can explode quickly. Use tiers.

Tier 1, default launch gate:

- manifest primary color
- blue
- slate
- emerald
- rose
- amber
- violet
- cyan

Tier 2, full stress:

- all colors exposed in the gallery swatch list

### Dark Mode

Test:

- light
- dark

### Effects

Test:

- none
- hushed
- bouncy
- frosted
- serif

Use the exact effect names/indexes from `docs/app.js`.

### Preview State

Most scoring can happen without preview chrome.

Still add smoke coverage for:

- normal preview
- fullscreen preview

Do not multiply fullscreen across every combination unless there is a known difference in rendering. Use a smaller smoke subset.

## Estimated Size

If there are roughly 100 non-before variants:

```text
100 templates x 4 viewports x 8 colors x 2 dark states x 5 effects = 32,000 runs
```

That is large. We need parallel execution, batching, resume support, and failure isolation.

## Parallel Execution Strategy

Use Playwright workers or a custom Node worker pool.

Recommended approach:

1. Build a job list JSON.
2. Shard jobs by template or by hash.
3. Run `N` workers in parallel.
4. Each worker owns one browser context and reuses pages when possible.
5. Each worker writes incremental JSONL results.
6. Aggregator merges JSONL into final reports.

Avoid one browser per job. That will be too slow.

Suggested commands:

```bash
node scripts/generate-preset-score-matrix.mjs --mode smoke --workers 4
node scripts/generate-preset-score-matrix.mjs --mode default --workers 6
node scripts/generate-preset-score-matrix.mjs --mode full --workers 8
node scripts/generate-preset-score-matrix.mjs --mode full --only devtool-landing/clean --workers 6 --out research/preset-score-matrix/devtool-clean-full
node scripts/generate-preset-score-matrix.mjs --combine-only --out research/preset-score-matrix/devtool-clean-full
```

Modes:

- `smoke`
  - 5-10 representative templates
  - 2 viewports
  - manifest color only
  - light/dark
  - none/frosted

- `default`
  - all non-before templates
  - 4 viewports
  - Tier 1 colors
  - light/dark
  - all effects

- `full`
  - all non-before templates
  - all configured viewports
  - all gallery colors
  - light/dark
  - all effects

## Multiple Agent Instructions

Start a clean session by spawning agents in parallel.

Recommended split:

- Agent A, `matrix-runner`
  - Owns new script `scripts/generate-preset-score-matrix.mjs`.
  - Builds job generation, worker pool, resume logic, and JSONL output.

- Agent B, `matrix-render-harness`
  - Owns test harness HTML or helper module under `docs/tests/` if needed.
  - Makes sure a template can be rendered with selected color/effect/dark/viewport in isolation.
  - Should reuse existing scoring modules, not duplicate scoring logic.

- Agent C, `matrix-reporter`
  - Owns aggregation/report code.
  - Produces `docs/presets/scores.json`, `latest.md`, and `failures.md`.

- Agent D, `gallery-score-consumer`
  - Owns `docs/app.js` / `docs/style.css` score display after the artifact schema is stable.
  - Should wait for Agent C schema or use a small mocked `scores.json`.

Main agent responsibilities:

- Keep scripts from writing over each other.
- Decide final schema.
- Run `smoke` first.
- Run `default` only after smoke is clean.
- Do not run `full` by default unless user explicitly accepts the long runtime.

## Rendering Approach

Two possible approaches:

### Option A: Harness Page

Create a dedicated harness page:

```text
docs/tests/preset-score-harness.html
```

Inputs via query string or `postMessage`:

- element
- variant
- viewport
- color
- dark
- effect

The harness should:

1. Load preset HTML.
2. Apply color transform using the same logic as gallery if possible.
3. Apply dark mode.
4. Apply effect CSS.
5. Run `MilgExtract`.
6. Run `MilgScoring`.
7. Return structured JSON.

Pros:

- Easy to debug manually in browser.
- Keeps scoring close to docs app.

Cons:

- Need to avoid duplicating gallery transformation logic.

### Option B: Direct Playwright Page

The Node script creates a page with scoring modules loaded and injects preset HTML directly.

Pros:

- Fewer committed harness files.
- Easier worker control.

Cons:

- More logic in the script.
- Harder to visually debug.

Recommendation: Option A if the script grows beyond a few hundred lines.

## Result Thresholds

Suggested quality gates:

- Score below `85`: fail
- Score below `90`: review
- Any error-level finding in accessibility, contrast, touch, or responsive: review
- Any mobile viewport below `90`: review
- Any dark-mode combination below `90`: review

Do not blindly optimize every warning. Some visual effects may trade strict score for intentional style. Document exceptions.

## Failure Report

`failures.md` should group by:

1. Template
2. Category
3. Repeated finding title
4. Combination dimensions

Example:

```md
## product-page/playful

- Worst score: 78
- Repeated issue: Low contrast text
- Affected combinations:
  - mobile, dark, amber, frosted
  - mobile, dark, yellow, frosted
- Suggested action:
  - Adjust frosted overlay text color in playful variant.
```

## Resume / Caching

The full matrix may take a long time.

Required features:

- Write JSONL incrementally.
- Skip already completed jobs when `--resume` is passed.
- Include a stable job id:

```text
<element>/<variant>|<viewport>|<color>|<dark>|<effect>
```

- On crash, preserve partial results.
- Write failed jobs separately.

## Parallelism Details

Use conservative defaults:

- Local laptop: `--workers 4`
- Strong machine: `--workers 8`
- CI: `--workers 2` unless configured

Each worker should:

- Launch one browser context.
- Reuse one page where possible.
- Clear page state between jobs.
- Apply timeout per job, e.g. 20-30 seconds.

Avoid too much parallelism because Tailwind/browser rendering can become CPU-bound and produce noisy timeouts.

## Score Double-Check Strategy

Because the analyzer is deterministic but browser rendering can still be affected by timing:

1. Run `smoke`.
2. Run `default`.
3. Re-run only failures and low scores.
4. Compare repeated run scores.
5. Mark unstable combinations if variance exists.

Suggested command:

```bash
node scripts/generate-preset-score-matrix.mjs --rerun failures --workers 4
```

Only act on stable failures.

## Integration With Gallery

After `docs/presets/scores.json` exists:

- Load it lazily in `docs/app.js`.
- Show current preset score near template name.
- Show score badges in picker cards.
- Show warning if selected current combination is below threshold.
- Show before/after delta for examples with `before`.

Do not block template loading if scores fail to load.

## New Template Validation Flow

When adding new templates:

1. Add files under `docs/presets/<element>/`.
2. Update `docs/presets/index.json`.
3. Run base preset validation:

```bash
node scripts/test-presets-headless.mjs
```

4. Run matrix smoke for the new element:

```bash
node scripts/generate-preset-score-matrix.mjs --mode smoke --only <element> --workers 4
```

5. Run default matrix for the new element:

```bash
node scripts/generate-preset-score-matrix.mjs --mode default --only <element> --workers 4
```

6. Fix low-scoring combinations.
7. Regenerate `docs/presets/scores.json`.

## Implementation Order

1. Build job generator.
2. Build one-job renderer/scorer.
3. Add worker pool.
4. Add JSONL incremental output.
5. Add aggregation and markdown reports.
6. Run smoke mode.
7. Fix script/harness bugs.
8. Run default mode.
9. Generate `docs/presets/scores.json`.
10. Wire scores into gallery.
11. Use failures report to improve templates/effects/colors.

## Done Criteria

The score system is done when:

- `smoke` mode finishes without script errors.
- `default` mode can run in parallel and resume after interruption.
- `docs/presets/scores.json` is generated.
- Gallery can display score badges without blocking if scores are absent.
- `failures.md` gives actionable groups, not just raw rows.
- README validation numbers are generated from the current run, not stale manual claims.
