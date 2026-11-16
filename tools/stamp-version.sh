#!/usr/bin/env bash
# Write a version (yymmddhhmm, UTC) into index.html, sw.js and version.json.
# Usage: tools/stamp-version.sh [yymmddhhmm]   (default: the current UTC time)
set -euo pipefail
cd "$(dirname "$0")/.."
ver="${1:-$(date -u +%y%m%d%H%M)}"
[[ "$ver" =~ ^[0-9]{10}$ ]] || { echo "version must be yymmddhhmm, got '$ver'" >&2; exit 1; }
for f in index.html sw.js; do
  sed -i -E "s/^const VERSION = '[0-9]*';/const VERSION = '$ver';/" "$f"
  grep -q "^const VERSION = '$ver';" "$f" || { echo "could not stamp $f" >&2; exit 1; }
done
printf '{"version":"%s"}\n' "$ver" > version.json
echo "stamped $ver"
