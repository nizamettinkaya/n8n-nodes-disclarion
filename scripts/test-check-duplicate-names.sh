#!/bin/sh
# Tests scripts/check-duplicate-names.sh against a throwaway git repo.
set -eu
CHECK="$(cd "$(dirname "$0")" && pwd)/check-duplicate-names.sh"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
cd "$tmp" && git init -q && git config user.email t@example.invalid && git config user.name t
fail=0
expect() { # expect <ok|fail> <mode> <path...>
  want=$1; mode=$2; shift 2
  git rm -rq --cached . >/dev/null 2>&1 || true; rm -rf ./*
  for p in "$@"; do mkdir -p "$(dirname "$p")"; : > "$p"; git add -- "$p"; done
  if sh "$CHECK" $mode >/dev/null 2>&1; then got=ok; else got=fail; fi
  if [ "$got" = "$want" ]; then echo "  pass: $want $mode $*"; else echo "  FAIL: wanted $want, got $got: $mode $*"; fail=1; fi
}
expect fail ""       "src/app/page 2.tsx"
expect fail ""       "lib/utils 3.ts"
expect fail ""       "components 2/Button.tsx"
expect fail ""       "README 2.md"
expect fail ""       "notes 10"
expect fail ""       "src/a.test 2.ts"
expect fail "--staged" "src/app/page 2.tsx"
expect ok   ""       "src/app/page.tsx" "page2.tsx" "v2/x.ts" "Release 0.3.1-notes.md" "a-2.ts" "file (1).txt"
expect ok   ""       "Screenshot 2026-10-24 at 10.00.png"
expect ok   "--staged" "src/app/page.tsx"
exit $fail
