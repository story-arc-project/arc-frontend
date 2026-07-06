#!/usr/bin/env python3
"""PreToolUse(Bash) git 가드 — CLAUDE.md Hard Constraints 의 결정론적 강제.

1. main/master/dev 브랜치 직접 커밋 생성 차단 (commit·merge·cherry-pick·revert·rebase)
2. main/dev 로의 `git push` 차단 (PR 로만 머지)
3. 브랜치 생성·리네임 시 네이밍 컨벤션 강제: (feat|fix|docs|refactor|chore|hotfix)/<소문자-하이픈>

차단 시 permissionDecision=deny 를 출력한다. 판단 불가/파싱 실패는 조용히 통과(막지 않음).
"""
import json
import os
import re
import shlex
import subprocess
import sys

BRANCH_RE = re.compile(r"^(feat|fix|docs|refactor|chore|hotfix)/[a-z0-9]+(?:-[a-z0-9]+)*$")
PROTECTED = {"main", "master", "dev"}
CONVENTION = "feat/ · fix/ · docs/ · refactor/ · chore/ · hotfix/ + 영문 소문자·하이픈"

SHELL_PUNCT = ";&|<>()"
UNKNOWN_CWD = "\0unknown"  # cd 대상을 정적으로 알 수 없음 → 브랜치 판정 포기(fail-open)
# 보호 브랜치 위에서 커밋을 만들거나 브랜치를 움직이는 서브커맨드
COMMITTING_SUBS = {"commit", "merge", "cherry-pick", "revert", "rebase"}
# 값을 뒤따르는 git 글로벌 옵션 (git [글로벌옵션...] <subcommand> ...)
GIT_GLOBAL_WITH_ARG = {
    "-C", "-c", "--git-dir", "--work-tree", "--namespace",
    "--super-prefix", "--config-env", "--exec-path", "--list-cmds", "--attr-source",
}
# 값을 뒤따르는 push 옵션 (positional/refspec 오인 방지)
PUSH_OPT_WITH_ARG = {"-o", "--push-option", "--repo", "--receive-pack", "--exec"}


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
    if cwd == UNKNOWN_CWD:
        return ""
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


def resolve_dir(base: str | None, path: str) -> str:
    """base(셸 추적 cwd) 기준으로 path 를 해석. 판정 불가면 UNKNOWN_CWD."""
    if "$" in path or path == "-":
        return UNKNOWN_CWD
    path = os.path.expanduser(path)
    if os.path.isabs(path):
        return os.path.normpath(path)
    if base == UNKNOWN_CWD:
        return UNKNOWN_CWD
    return os.path.normpath(os.path.join(base or os.getcwd(), path))


def tokenize(cmd: str) -> list[str]:
    """셸 연산자(;, &&, | 등)를 공백 없이 붙여 써도 별도 토큰으로 분리한다."""
    try:
        lex = shlex.shlex(cmd, posix=True, punctuation_chars=SHELL_PUNCT)
        lex.whitespace_split = True
        return list(lex)
    except ValueError:
        return cmd.split()


def split_segments(tokens: list[str]) -> list[list[str]]:
    segs: list[list[str]] = []
    cur: list[str] = []
    for t in tokens:
        if t and all(c in SHELL_PUNCT for c in t):
            segs.append(cur)
            cur = []
        else:
            cur.append(t)
    segs.append(cur)
    return segs


def check_push(rest: list[str], cwd: str | None) -> None:
    if {"--all", "--branches", "--mirror"} & set(rest):
        deny("전체 브랜치 push(--all/--mirror) 금지 — main/dev 는 PR 로만 머지합니다.")

    positionals: list[str] = []
    i = 0
    while i < len(rest):
        a = rest[i]
        if a in PUSH_OPT_WITH_ARG:
            i += 2
            continue
        if a.startswith("-"):
            i += 1
            continue
        positionals.append(a)
        i += 1

    refspecs = positionals[1:]  # positionals[0] = remote
    if not refspecs:
        if current_branch(cwd) in PROTECTED:
            deny("main/dev 브랜치에서의 push 금지 — PR 로만 머지합니다.")
        return

    for r in refspecs:
        r = r.removeprefix("+")  # 강제 push 축약형 [+]<src>[:<dst>]
        if r == ":":
            deny("matching push(`:`) 금지 — main/dev 가 포함될 수 있습니다. 브랜치를 명시하세요.")
        if ":" in r:
            _src, dst = r.split(":", 1)
        else:
            dst = r
        dst = dst.removeprefix("refs/heads/")
        if dst in ("HEAD", "@"):
            dst = current_branch(cwd)
        if dst in PROTECTED:
            deny("main/dev 직접 push 금지 — PR 로만 머지합니다 (git-workflow 스킬).")
        if "*" in dst:
            deny("와일드카드 refspec push 금지 — main/dev 가 포함될 수 있습니다. 브랜치를 명시하세요.")


def check_segment(seg: list[str], base_cwd: str | None) -> None:
    if "git" not in seg:
        return
    args = seg[seg.index("git") + 1 :]
    cwd = base_cwd
    # 글로벌 옵션(-C <path>, --no-pager, --git-dir <path> 등) 전부 스킵
    while args and args[0].startswith("-"):
        if args[0] in GIT_GLOBAL_WITH_ARG and len(args) >= 2:
            if args[0] == "-C":
                cwd = resolve_dir(base_cwd, args[1])
            args = args[2:]
        else:
            args = args[1:]
    if not args:
        return
    sub, rest = args[0], args[1:]

    if sub in COMMITTING_SUBS:
        br = current_branch(cwd)
        if br in PROTECTED:
            deny(
                f"'{br}' 브랜치 직접 {sub} 금지 — dev 에서 분기한 작업 브랜치에서 작업하고"
                " PR 로만 머지하세요 (git-workflow 스킬)."
            )

    elif sub == "push":
        check_push(rest, cwd)

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
        positionals = [a for a in rest if not a.startswith("-")]
        # 리네임/복사: (-m|-M|-c|-C) [<old>] <new> — 마지막 positional 이 새 이름
        if set(rest) & {"-m", "-M", "--move", "-c", "-C", "--copy"}:
            if positionals:
                new_branch = positionals[-1]
        else:
            # 생성이 아닌 조회/삭제 플래그가 있으면 통과
            non_create = {
                "-d", "-D", "--delete", "--list", "-a", "-r",
                "-v", "-vv", "--show-current", "-u", "--set-upstream-to", "--unset-upstream",
                "--merged", "--no-merged", "--contains", "--sort", "--format",
                "--edit-description",
            }
            if not (set(rest) & non_create) and positionals:
                new_branch = positionals[0]
    elif sub == "worktree" and rest[:1] == ["add"]:
        wt = rest[1:]
        for i, a in enumerate(wt):
            if a in ("-b", "-B", "--orphan") and i + 1 < len(wt):
                new_branch = wt[i + 1]
        if new_branch is None and "--detach" not in wt:
            positionals = [a for a in wt if not a.startswith("-")]
            if len(positionals) == 1:
                # <path> 만 주면 basename 브랜치가 암묵 생성된다 (-b 와 동일)
                new_branch = os.path.basename(positionals[0].rstrip("/"))

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
    shell_cwd: str | None = None  # None = 훅 프로세스 cwd 그대로
    for seg in split_segments(tokenize(cmd)):
        if seg and seg[0] == "cd":
            shell_cwd = resolve_dir(shell_cwd, seg[1]) if len(seg) > 1 else UNKNOWN_CWD
            continue
        check_segment(seg, shell_cwd)


if __name__ == "__main__":
    main()
