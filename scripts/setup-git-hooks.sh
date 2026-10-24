#!/bin/sh
# One-time, per-clone setup: points git at this repo's tracked .githooks/
# directory (core.hooksPath) so the hooks in it run on every clone —
# currently .githooks/pre-commit (blocks duplicate-style names like
# "page 2.tsx"; see scripts/check-duplicate-names.sh).
#
# Run once after cloning:
#   sh scripts/setup-git-hooks.sh

set -e
repo_root=$(git rev-parse --show-toplevel)
git -C "$repo_root" config core.hooksPath .githooks
echo "core.hooksPath set to .githooks — pre-commit duplicate-name check is now active."
