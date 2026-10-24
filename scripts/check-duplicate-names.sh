#!/bin/sh
# Fails if any git path contains a file or folder name with a space followed
# by digits before the extension or at the end: "page 2.tsx", "utils 3.ts",
# "components 2", "README 2.md". These are iCloud / Finder conflict copies
# (both repos lived on the iCloud-synced Desktop until 2026-10-17) and must
# never be committed. Never "fix" a hit with .gitignore — that would hide a
# duplicate instead of catching it; remove the copy and keep the original.
#
# Identical copy in disclarion-app, disclarion and n8n-nodes-disclarion.
#
#   sh scripts/check-duplicate-names.sh            every tracked path (CI)
#   sh scripts/check-duplicate-names.sh --staged   added/renamed staged paths (pre-commit)
set -eu

if [ "${1:-}" = "--staged" ]; then
  paths=$(git -c core.quotepath=false diff --cached --name-only --diff-filter=ACRT)
else
  paths=$(git -c core.quotepath=false ls-files)
fi

hits=$(printf '%s\n' "$paths" | awk -F/ '
  NF { for (i = 1; i <= NF; i++) if ($i ~ / [0-9]+(\.[A-Za-z][^\/]*)?$/) { print; next } }')

if [ -n "$hits" ]; then
  echo "Duplicate-style file or folder names found (a space + digits before the extension or at the end):" >&2
  printf '%s\n' "$hits" | sed 's/^/  /' >&2
  echo "These are usually iCloud/Finder conflict copies. Remove the copy, keep the original. Do not add them to .gitignore." >&2
  exit 1
fi
echo "check-duplicate-names: no duplicate-style names ($( [ "${1:-}" = "--staged" ] && echo staged || echo tracked ) paths checked)."
