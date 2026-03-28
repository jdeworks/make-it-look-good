#!/usr/bin/env bash
# Downloads modern-screenshot and inlines it into the screenshot snippet.
# This creates a version that works on ALL sites regardless of CSP.
# Usage: ./scripts/build-screenshot-snippet.sh
#
# The output file (analyzer-snippet-screenshots-inline.js) can be used
# instead of the CDN-loading version on CSP-restricted sites.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SNIPPET="$ROOT_DIR/docs/analyzer-snippet-screenshots.js"
OUTPUT="$ROOT_DIR/docs/analyzer-snippet-screenshots-inline.js"
LIB_URL="https://cdn.jsdelivr.net/npm/modern-screenshot@4.6.8/dist/index.js"

echo "Downloading modern-screenshot..."
LIB_CODE=$(curl -sL "$LIB_URL")
if [ -z "$LIB_CODE" ] || [ ${#LIB_CODE} -lt 1000 ]; then
  echo "ERROR: Failed to download library"
  exit 1
fi
echo "Downloaded: ${#LIB_CODE} bytes"

# Read the snippet and replace the CDN loading block with inline code
echo "Building inline snippet..."
cat "$SNIPPET" | sed '/try {$/,/var _msLoaded = Promise.reject(); }$/c\
  // Inline modern-screenshot library (29KB, bypasses all CSP restrictions)\
  '"$(echo "$LIB_CODE" | sed 's/[&/\]/\\&/g; s/$/\\/')"'
  var _msLoaded = Promise.resolve();' > "$OUTPUT"

echo "Output: $OUTPUT ($(wc -c < "$OUTPUT") bytes)"
echo "This version works on ALL sites regardless of CSP."
