#!/bin/bash
# Batch verification of modified presets (clean personality only)
# After each passes, it's recorded. Run summarize separately.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/tmp/batch-verify.log"
RESULTS="$ROOT/tmp/batch-verify-results.txt"

# Presets with only clean.html modified (test clean personality only)
CLEAN_ONLY="agency-landing avatars buttons card-grid cards dashboard data-table deploy devtool-landing docs-site dropdown editorial-blog event-page form hero jdeworks-personal landing osslanding pagination personal-hero portfolio pricing-cards product-launch product-page project saas-features scroll-story shell-dashboard shell-form shell-marketing shell-sidebar stats-row statuspage tabs"

cd "$ROOT"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

check_bad() {
  local jsonl="$1"
  node -e "
const fs = require('fs');
try {
  const rows = fs.readFileSync('$jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l));
  const bad = rows.filter(r=>r.categories&&r.categories.some(c=>c.errors>0||c.warnings>0));
  if (bad.length) {
    bad.slice(0,3).forEach(r=>console.error(r.key, r.categories.filter(c=>c.errors>0||c.warnings>0).map(c=>c.name+':E'+c.errors+'W'+c.warnings).join(' ')));
  }
  console.log(bad.length);
} catch(e) { console.log('ERR:'+e.message); }
" 2>&1
}

mkdir -p "$ROOT/tmp"
log "=== Batch verify started ==="

# Run each clean-only preset
for preset in $CLEAN_ONLY; do
  out="$ROOT/tmp/bv-${preset}"
  # Skip if already passed
  if [ -f "$out/results.jsonl" ]; then
    bad=$(check_bad "$out/results.jsonl" | tail -1)
    if [ "$bad" = "0" ]; then
      log "SKIP $preset (already passed)"
      echo "PASS $preset" >> "$RESULTS"
      continue
    fi
  fi

  log "--- $preset/clean ---"
  node scripts/generate-preset-score-matrix.mjs \
    --mode full \
    --only "${preset}/clean" \
    --workers 4 \
    --out "tmp/bv-${preset}" \
    --thumbnails none

  bad=$(check_bad "$out/results.jsonl" | tail -1)
  if [ "$bad" = "0" ]; then
    log "PASS $preset"
    echo "PASS $preset" >> "$RESULTS"
  else
    log "FAIL $preset ($bad bad rows)"
    echo "FAIL $preset $bad" >> "$RESULTS"
  fi
done

# Accordion: all 3 personalities
out="$ROOT/tmp/bv-accordion"
if [ -f "$out/results.jsonl" ]; then
  bad=$(check_bad "$out/results.jsonl" | tail -1)
  if [ "$bad" = "0" ]; then
    log "SKIP accordion (already passed)"
    echo "PASS accordion" >> "$RESULTS"
  fi
else
  log "--- accordion (all personalities) ---"
  node scripts/generate-preset-score-matrix.mjs \
    --mode full \
    --only accordion \
    --workers 4 \
    --out "tmp/bv-accordion" \
    --thumbnails none

  bad=$(check_bad "$out/results.jsonl" | tail -1)
  if [ "$bad" = "0" ]; then
    log "PASS accordion"
    echo "PASS accordion" >> "$RESULTS"
  else
    log "FAIL accordion ($bad bad rows)"
    echo "FAIL accordion $bad" >> "$RESULTS"
  fi
fi

log "=== Batch complete ==="
log "Results:"
cat "$RESULTS"
