#!/usr/bin/env bash
# Reads PROXY_URL from .env and injects it (base64-encoded) into docs/analyzer.js
# Usage: ./scripts/inject-proxy.sh
#
# The encoded URL replaces __PROXY_ENCODED__ in analyzer.js.
# If no .env or PROXY_URL is empty, it resets to the placeholder (third-party fallback).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ANALYZER="$ROOT_DIR/docs/analyzer.js"
ENV_FILE="$ROOT_DIR/.env"

# Read .env if it exists
PROXY_URL=""
if [ -f "$ENV_FILE" ]; then
  # Source only PROXY_URL (safe: we control the .env format)
  PROXY_URL=$(grep -E '^PROXY_URL=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d "'\"" | xargs)
fi

if [ -z "$PROXY_URL" ]; then
  echo "No PROXY_URL found in .env — resetting to placeholder (third-party fallback mode)"
  # Reset to placeholder if it was previously injected
  sed -i "s|var _pe = '[^']*';|var _pe = '__PROXY_ENCODED__';|" "$ANALYZER"
  echo "Done: docs/analyzer.js uses third-party proxies only"
  exit 0
fi

# Base64-encode the URL
ENCODED=$(echo -n "$PROXY_URL" | base64 -w 0 2>/dev/null || echo -n "$PROXY_URL" | base64)

# Replace in analyzer.js (works whether current value is placeholder or a previous injection)
sed -i "s|var _pe = '[^']*';|var _pe = '${ENCODED}';|" "$ANALYZER"

echo "Injected proxy URL into docs/analyzer.js"
echo "  URL: $PROXY_URL"
echo "  Encoded: $ENCODED"
echo ""
echo "Next: commit docs/analyzer.js and push to deploy."
