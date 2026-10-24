#!/usr/bin/env python3
"""Claude Code PreToolUse hook: refuses to create (or edit) a file or folder
whose name has a space followed by digits before the extension or at the
end ("page 2.tsx", "utils 3.ts", "components 2") — iCloud/Finder conflict
copy names, which must never reach the repo (see CLAUDE.md).

- Edit / Write / NotebookEdit: denies when any component of the target path
  matches.
- Bash: parses the command with shlex (quotes and escapes handled) and
  checks only what creates names: cp/mv/rsync/ditto/install/ln (destination,
  plus source names when copying into a directory), touch/mkdir/tee (every
  argument), git mv (destination), and > / >> redirect targets. Commit
  messages or other text containing "step 2" are not touched.
  A pragmatic parser, not a full shell: it won't see names built from
  variables at run time. The CI check and the pre-commit hook catch those.

Identical copy in disclarion-app, disclarion and n8n-nodes-disclarion.
"""
import json
import os
import re
import shlex
import sys

PATTERN = re.compile(r" [0-9]+(\.[A-Za-z][^/]*)?$")
COPY_LIKE = {"cp", "mv", "rsync", "ditto", "install", "ln"}
ALL_ARGS = {"touch", "mkdir", "tee"}
OPERATORS = {";", "&&", "||", "|", "&", "(", ")"}
REDIRECTS = {">", ">>", "&>", ">|"}


def bad(path: str) -> bool:
    return any(PATTERN.search(part) for part in path.replace("\\", "/").split("/") if part)


def bash_targets(command: str) -> list:
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|()<>")
    lexer.whitespace_split = True
    try:
        tokens = list(lexer)
    except ValueError:
        return []
    targets, segment = [], []
    tokens.append(";")
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok in REDIRECTS or re.fullmatch(r"[0-9]?>>?", tok):
            if i + 1 < len(tokens):
                targets.append(tokens[i + 1])
            i += 2
            continue
        if tok in OPERATORS:
            targets.extend(segment_targets(segment))
            segment = []
        else:
            segment.append(tok)
        i += 1
    return targets


def segment_targets(seg: list) -> list:
    while seg and (re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", seg[0]) or seg[0] in ("sudo", "command", "nohup")):
        seg = seg[1:]
    if not seg:
        return []
    cmd, args = os.path.basename(seg[0]), [a for a in seg[1:] if not a.startswith("-")]
    if cmd == "git" and args[:1] == ["mv"]:
        cmd, args = "mv", args[1:]
    if cmd in ALL_ARGS:
        return args
    if cmd in COPY_LIKE and len(args) >= 2:
        dest = args[-1]
        if dest.endswith("/") or os.path.isdir(dest):
            return [dest] + [os.path.basename(a.rstrip("/")) for a in args[:-1]]
        return [dest]
    return []


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except ValueError:
        return
    tool, ti = data.get("tool_name", ""), data.get("tool_input") or {}
    if tool == "Bash":
        offenders = [t for t in bash_targets(ti.get("command", "")) if bad(t)]
    else:
        path = ti.get("file_path") or ti.get("notebook_path") or ""
        offenders = [path] if path and bad(path) else []
    if offenders:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"Refused: {offenders[0]!r} has a duplicate-style name (a space + digits before the "
                "extension or at the end, like \"page 2.tsx\"). These are iCloud/Finder conflict copies "
                "and must never be created in this repo (CLAUDE.md). Use the original name, or ask the user."),
        }}))


if __name__ == "__main__":
    main()
