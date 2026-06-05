#!/usr/bin/env bash
# make-it-look-good — start the local analyzer server.
#
# Usage:
#   ./start.sh                 # serve at http://localhost:8765/analyzer.html
#   ./start.sh --offline       # vendor CDN assets if missing, then run fully offline
#   ./start.sh --port 9000     # any server.js flag is passed straight through
#   ./start.sh --offline --port 9000 --host 0.0.0.0
#
# Requires Node 18+. No `npm install` needed — the server uses only Node built-ins.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: 'node' not found. Install Node 18+ (https://nodejs.org)." >&2
  exit 1
fi

# If --offline is requested but the vendored assets are missing, fetch them once
# (needs internet). setup-offline.mjs is idempotent, so a partial vendor is repaired.
for arg in "$@"; do
  if [ "$arg" = "--offline" ]; then
    if [ ! -f docs/vendor/tailwind-browser.js ] || [ ! -f docs/vendor/monaco/min/vs/loader.min.js ]; then
      echo "Offline assets missing — running scripts/setup-offline.mjs (one-time, needs internet)..."
      node scripts/setup-offline.mjs
    fi
    break
  fi
done

exec node server.js "$@"
