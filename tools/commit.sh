#!/usr/bin/env bash
# Commit everything with the version stamped to the commit's own date/time (UTC, yymmddhhmm).
# The commit's author and committer date are set to that same minute, so
#   TZ=UTC git log -1 --format=%ad --date=format:%y%m%d%H%M
# always equals the version inside the commit.
# Usage: tools/commit.sh -m "message" [more git commit options]
set -euo pipefail
cd "$(dirname "$0")/.."
ver="$(date -u +%y%m%d%H%M)"
when="$(date -u +%Y-%m-%dT%H:%M:00+0000)"
tools/stamp-version.sh "$ver"
git add -A
GIT_AUTHOR_DATE="$when" GIT_COMMITTER_DATE="$when" git commit "$@"
echo "committed as version $ver"
