#!/usr/bin/env python3
"""PreToolUse(Bash) git 가드 — CLAUDE.md Hard Constraints 의 결정론적 강제.

1. main/master/dev 브랜치 직접 `git commit` 차단
2. main/dev 로의 `git push` 차단 (PR 로만 머지)
3. 브랜치 생성 시 네이밍 컨벤션 강제: (feat|fix|docs|refactor|chore|hotfix)/<소문자-하이픈>

차단 시 permissionDecision=deny 를 출력한다. 판단 불가/파싱 실패는 조용히 통과(막지 않음).
"""
import json
import re
import shlex
import subprocess
import sys

BRANCH_RE = re.compile(r"^(feat|fix|docs|refactor|chore|hotfix)/[a-z0-9][a-z0-9._-]*$")
PROTECTED = {"main", "master", "dev"}
CONVENTION = "feat/ · fix/ · docs/ · refactor/ · chore/ · hotfix/ + 영문 소문자·하이픈"


def deny(reason: str) -> None:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )
    sys.exit(0)


def current_branch(cwd: str | None) -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=5,
        )
        return out.stdout.strip()
    except Exception:
        return ""


def split_segments(tokens: list[str]) -> list[list[str]]:
    segs: list[list[str]] = []
    cur: list[str] = []
    for t in tokens:
        if t in ("&&", ";", "||", "|"):
            segs.append(cur)
            cur = []
        else:
            cur.append(t)
    segs.append(cur)
    return segs


def check_segment(seg: list[str]) -> None:
    if "git" not in seg:
        return
    args = seg[seg.index("git") + 1 :]
    cwd: str | None = None
    # 글로벌 옵션(-C <path>, -c <k=v>) 스킵
    while len(args) >= 2 and args[0] in ("-C", "-c"):
        if args[0] == "-C":
            cwd = args[1]
        args = args[2:]
    if not args:
        return
    sub, rest = args[0], args[1:]

    if sub == "commit":
        br = current_branch(cwd)
        if br in PROTECTED:
            deny(
                f"'{br}' 브랜치 직접 커밋 금지 — dev 에서 분기한 작업 브랜치에서 커밋하세요"
                " (git-workflow 스킬)."
            )

    elif sub == "push":
        positionals = [a for a in rest if not a.startswith("-")]
        refspecs = positionals[1:]  # positionals[0] = remote
        targets = {r.split(":")[-1].removeprefix("refs/heads/") for r in refspecs}
        if targets & PROTECTED:
            deny("main/dev 직접 push 금지 — PR 로만 머지합니다 (git-workflow 스킬).")
        if not refspecs and current_branch(cwd) in PROTECTED:
            deny("main/dev 브랜치에서의 push 금지 — PR 로만 머지합니다.")

    new_branch: str | None = None
    if sub == "checkout":
        for i, a in enumerate(rest):
            if a in ("-b", "-B") and i + 1 < len(rest):
                new_branch = rest[i + 1]
    elif sub == "switch":
        for i, a in enumerate(rest):
            if a in ("-c", "-C", "--create", "--force-create") and i + 1 < len(rest):
                new_branch = rest[i + 1]
    elif sub == "branch":
        # 생성이 아닌 조회/삭제/이동 플래그가 있으면 통과
        non_create = {
            "-d", "-D", "--delete", "-m", "-M", "--move", "--list", "-a", "-r",
            "-v", "-vv", "--show-current", "-u", "--set-upstream-to", "--unset-upstream",
            "--merged", "--no-merged", "--contains", "--sort", "--format", "--edit-description",
        }
        if not (set(rest) & non_create):
            positionals = [a for a in rest if not a.startswith("-")]
            if positionals:
                new_branch = positionals[0]
    elif sub == "worktree" and rest[:1] == ["add"]:
        for i, a in enumerate(rest):
            if a == "-b" and i + 1 < len(rest):
                new_branch = rest[i + 1]

    if new_branch and not BRANCH_RE.match(new_branch):
        deny(f"브랜치명 '{new_branch}' 컨벤션 위반 — {CONVENTION} (git-workflow 스킬).")


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    cmd = (data.get("tool_input") or {}).get("command", "")
    if "git" not in cmd:
        return
    try:
        tokens = shlex.split(cmd, posix=True)
    except ValueError:
        tokens = cmd.split()
    for seg in split_segments(tokens):
        check_segment(seg)


if __name__ == "__main__":
    main()
