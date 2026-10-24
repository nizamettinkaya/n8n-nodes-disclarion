#!/bin/sh
# Tests .claude/hooks/block-duplicate-names.py with sample tool inputs.
set -eu
HOOK="$(cd "$(dirname "$0")" && pwd)/block-duplicate-names.py"
fail=0
check() { # check <deny|allow> <json>
  out=$(printf '%s' "$2" | python3 "$HOOK")
  if printf '%s' "$out" | grep -q '"deny"'; then got=deny; else got=allow; fi
  if [ "$got" = "$1" ]; then echo "  pass: $1 $2"; else echo "  FAIL: wanted $1, got $got: $2"; fail=1; fi
}
check deny  '{"tool_name":"Write","tool_input":{"file_path":"/repo/src/app/page 2.tsx"}}'
check deny  '{"tool_name":"Edit","tool_input":{"file_path":"/repo/components 2/Button.tsx"}}'
check deny  '{"tool_name":"NotebookEdit","tool_input":{"notebook_path":"/repo/analysis 3.ipynb"}}'
check allow '{"tool_name":"Write","tool_input":{"file_path":"/repo/src/app/page.tsx"}}'
check allow '{"tool_name":"Write","tool_input":{"file_path":"/repo/v2/page2.tsx"}}'
check deny  '{"tool_name":"Bash","tool_input":{"command":"cp src/app/page.tsx \"src/app/page 2.tsx\""}}'
check deny  '{"tool_name":"Bash","tool_input":{"command":"mv utils.ts utils\\ 3.ts"}}'
check deny  '{"tool_name":"Bash","tool_input":{"command":"mkdir -p \"components 2\""}}'
check deny  '{"tool_name":"Bash","tool_input":{"command":"echo hi > \"README 2.md\""}}'
check deny  '{"tool_name":"Bash","tool_input":{"command":"cat a | tee \"notes 2.txt\""}}'
check deny  '{"tool_name":"Bash","tool_input":{"command":"git mv a.ts \"a 2.ts\""}}'
check deny  '{"tool_name":"Bash","tool_input":{"command":"cd x && touch \"page 2.tsx\""}}'
check allow '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"P5 step 2\""}}'
check allow '{"tool_name":"Bash","tool_input":{"command":"sleep 2 && head -n 2 file.txt"}}'
check allow '{"tool_name":"Bash","tool_input":{"command":"cp \"page 2.tsx\" page.tsx"}}'
check allow '{"tool_name":"Bash","tool_input":{"command":"grep -r \"page 2.tsx\" ."}}'
check allow '{"tool_name":"Bash","tool_input":{"command":"echo \"Release 0.3.1\" > CHANGELOG.md"}}'
exit $fail
