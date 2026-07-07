#!/usr/bin/env python3
"""PreToolUse(Bash) git 가드 — CLAUDE.md Hard Constraints 의 결정론적 강제.

1. main/master/dev 브랜치 직접 커밋 생성·이동 차단 (commit·merge·cherry-pick·revert·rebase,
   다른 ref 를 통합하는 pull·브랜치를 움직이는 reset 포함 — --abort/--quit 복구는 허용)
2. main/dev 로의 `git push` 차단 (PR 로만 머지) — 암묵 대상(@{push})도 해석
3. 브랜치 생성·리네임 시 네이밍 컨벤션 강제: (feat|fix|docs|refactor|chore|hotfix)/<소문자-하이픈>

차단 시 permissionDecision=deny 를 출력한다. 판단 불가/파싱 실패는 조용히 통과(막지 않음).

위협 모델: 이 훅은 세션이 "실수로" 보호 브랜치를 건드리는 것을 막는 가드레일이지 보안 경계가
아니다. fail-open 설계상 의도적 우회(임의 스크립트 실행, --stdin 파이프, 저장소 상태에 의존하는
간접 경로 등)는 스코프 밖이며, 그런 경로는 원격 브랜치 보호 규칙(GitHub)이 최종 방어선이다.
여기서 다루는 것은 실수로 타이핑될 개연성이 있는 명령 형태까지다.
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
COMMITTING_SUBS = {"commit", "merge", "cherry-pick", "revert", "rebase", "am"}
# `bash -c '<cmd>'` 래핑 — 인용 문자열 안의 git 도 검사한다
SHELLS = {"bash", "sh", "zsh", "dash", "ksh"}
# 진행 중인 merge/rebase 등을 되돌리기만 하는 모드 — 커밋을 만들지 않으므로 허용
ABORT_SAFE = {"--abort", "--quit"}
# 값을 뒤따르는 git 글로벌 옵션 (git [글로벌옵션...] <subcommand> ...)
GIT_GLOBAL_WITH_ARG = {
    "-C", "-c", "--git-dir", "--work-tree", "--namespace",
    "--super-prefix", "--config-env", "--exec-path", "--list-cmds", "--attr-source",
}
# 값을 뒤따르는 push/pull 옵션 (positional/refspec 오인 방지)
PUSH_OPT_WITH_ARG = {"-o", "--push-option", "--repo", "--receive-pack", "--exec"}
PULL_OPT_WITH_ARG = {
    "-s", "--strategy", "-X", "--strategy-option", "-o", "--server-option",
    "--upload-pack", "--negotiation-tip", "--depth", "--shallow-since",
    "--shallow-exclude", "-j", "--jobs", "--refmap",
}
# 값을 뒤따르는 reset/worktree-add 옵션 (positional 오인 방지)
RESET_OPT_WITH_ARG = {"--pathspec-from-file"}
WORKTREE_OPT_WITH_ARG = {"--reason"}
# 이 가드가 직접 다루는 서브커맨드 — 그 외 토큰은 alias 확장을 시도한다
HANDLED_SUBS = COMMITTING_SUBS | {
    "push", "pull", "fetch", "reset", "update-ref",
    "checkout", "switch", "branch", "worktree", "stash",
}


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


def push_target(cwd: str | None, cfg: list[str]) -> str:
    """refspec 없는 push 의 실제 대상 브랜치(@{push}) — push.default/upstream 설정 반영."""
    if cwd == UNKNOWN_CWD:
        return ""
    try:
        out = subprocess.run(
            ["git", *cfg, "rev-parse", "--abbrev-ref", "@{push}"],
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=5,
        )
        ref = out.stdout.strip()
        return ref.split("/", 1)[1] if "/" in ref else ref
    except Exception:
        return ""


def upstream_branch(cwd: str | None, cfg: list[str]) -> str:
    """현재 브랜치의 @{upstream} 브랜치명 (원격 prefix 제거). 미설정/판정 불가 시 ""."""
    if cwd == UNKNOWN_CWD:
        return ""
    try:
        out = subprocess.run(
            ["git", *cfg, "rev-parse", "--symbolic-full-name", "@{upstream}"],
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=5,
        )
        ref = out.stdout.strip()
        if ref.startswith("refs/remotes/"):
            rest = ref[len("refs/remotes/") :]
            return rest.split("/", 1)[1] if "/" in rest else rest
        return ref.removeprefix("refs/heads/")
    except Exception:
        return ""


def git_alias(sub: str, cwd: str | None, cfg: list[str]) -> str:
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", sub):
        return ""
    try:
        out = subprocess.run(
            ["git", *cfg, "config", "--get", f"alias.{sub}"],
            capture_output=True,
            text=True,
            cwd=None if cwd == UNKNOWN_CWD else cwd,
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


def check_push(rest: list[str], cwd: str | None, cfg: list[str]) -> None:
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
        # push.default=upstream 등으로 현재 브랜치명과 다른 대상에 붙을 수 있다 → @{push} 해석
        if current_branch(cwd) in PROTECTED or push_target(cwd, cfg) in PROTECTED:
            deny("main/dev 로의 push 금지 — PR 로만 머지합니다 (push.default/upstream 대상 포함).")
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


def check_fetch(rest: list[str]) -> None:
    """`git fetch <repo> <src>:<dst>` 는 로컬 <dst> ref 를 직접 갱신한다 — 보호 브랜치 금지."""
    positionals: list[str] = []
    i = 0
    while i < len(rest):
        a = rest[i]
        if a in PULL_OPT_WITH_ARG:
            i += 2
            continue
        if a.startswith("-"):
            i += 1
            continue
        positionals.append(a)
        i += 1
    for r in positionals[1:]:  # positionals[0] = remote/저장소
        if ":" not in r:
            continue  # 콜론 없는 refspec 은 remote-tracking ref 만 갱신
        dst = r.removeprefix("+").split(":", 1)[1].removeprefix("refs/heads/")
        if dst in PROTECTED or "*" in dst:
            deny("fetch refspec 으로 main/dev 로컬 브랜치 갱신 금지 — PR 로만 머지합니다.")


def check_pull(rest: list[str], cwd: str | None, cfg: list[str]) -> None:
    """보호 브랜치에서의 pull 은 같은 브랜치 refspec(원격 동기화)만 허용."""
    br = current_branch(cwd)
    if br not in PROTECTED:
        return
    positionals: list[str] = []
    i = 0
    while i < len(rest):
        a = rest[i]
        if a in PULL_OPT_WITH_ARG:
            i += 2
            continue
        if a.startswith("-"):
            i += 1
            continue
        positionals.append(a)
        i += 1
    if len(positionals) < 2:
        # refspec 없는 pull 은 @{upstream} 을 통합한다 — 다른 브랜치를 추적 중이면 우회 가능
        up = upstream_branch(cwd, cfg)
        if up and up != br:
            deny(
                f"'{br}' 브랜치의 upstream({up})이 다른 브랜치입니다 — pull 통합 금지,"
                " main/dev 는 PR 로만 머지합니다."
            )
        return
    for r in positionals[1:]:  # positionals[0] = remote/저장소
        src = r.removeprefix("+").split(":", 1)[0].removeprefix("refs/heads/")
        if src != br:
            deny(
                f"'{br}' 브랜치에 다른 ref 를 pull 로 통합 금지 — main/dev 는 PR 로만 머지합니다"
                " (원격 동기화는 git pull origin " + br + " 만 허용)."
            )


def check_segment(seg: list[str], base_cwd: str | None, depth: int = 0) -> None:
    check_shell_wrap(seg, base_cwd, depth)
    # `/usr/bin/git` 같은 경로 호출도 인식한다
    idx = next((i for i, t in enumerate(seg) if os.path.basename(t) == "git"), None)
    if idx is None:
        return
    # GIT_DIR=/x/.git GIT_WORK_TREE=/x git ... — 환경변수로 대상 저장소를 바꾸는 형태
    cwd = base_cwd
    env_git_dir = env_work_tree = None
    for t in seg[:idx]:
        if t.startswith("GIT_DIR="):
            env_git_dir = t[len("GIT_DIR=") :]
        elif t.startswith("GIT_WORK_TREE="):
            env_work_tree = t[len("GIT_WORK_TREE=") :]
    target = env_work_tree or env_git_dir
    if target:
        cwd = resolve_dir(cwd, target)
    check_git_args(seg[idx + 1 :], cwd, depth)


def check_shell_wrap(seg: list[str], base_cwd: str | None, depth: int) -> None:
    """bash -c '<cmd>' / sh -lc '<cmd>' 안의 git 명령도 재귀 검사한다."""
    if depth > 2:
        return
    idx = next((i for i, t in enumerate(seg) if os.path.basename(t) in SHELLS), None)
    if idx is None:
        return
    for i in range(idx + 1, len(seg) - 1):
        a = seg[i]
        # -c 또는 -lc 같은 결합 단축 플래그의 마지막이 c 인 경우 → 다음 토큰이 명령 문자열
        if a == "-c" or (a.startswith("-") and not a.startswith("--") and a.endswith("c")):
            check_command(seg[i + 1], base_cwd, depth + 1)
            return


def check_git_args(args: list[str], base_cwd: str | None, depth: int = 0) -> None:
    if depth > 2:
        return
    cwd = base_cwd
    cfg: list[str] = []
    # 글로벌 옵션 스킵 — 대상 저장소를 바꾸는 -C/--git-dir/--work-tree 는 cwd 추적에 반영
    while args and args[0].startswith("-"):
        a = args[0]
        if a in GIT_GLOBAL_WITH_ARG and len(args) >= 2:
            if a in ("-C", "--git-dir", "--work-tree"):
                cwd = resolve_dir(cwd, args[1])
            elif a == "-c":
                cfg += ["-c", args[1]]
            args = args[2:]
            continue
        for opt in ("--git-dir=", "--work-tree="):
            if a.startswith(opt):
                cwd = resolve_dir(cwd, a[len(opt) :])
        args = args[1:]
    if not args:
        return
    sub, rest = args[0], args[1:]

    # 알 수 없는 서브커맨드는 alias 확장을 시도한다 (git 은 내장 명령을 alias 로 가릴 수 없음)
    if sub not in HANDLED_SUBS:
        expansion = git_alias(sub, cwd, cfg)
        if expansion.startswith("!"):
            # 셸 alias 는 호출 시 인자를 명령 끝에 덧붙여 실행한다
            segs = split_segments(tokenize(expansion[1:]))
            if segs and rest:
                segs[-1] = segs[-1] + rest
            for s in segs:
                check_segment(s, cwd, depth + 1)
        elif expansion:
            check_git_args(tokenize(expansion) + rest, cwd, depth + 1)
        return

    if sub in COMMITTING_SUBS:
        if not (ABORT_SAFE & set(rest)):
            br = current_branch(cwd)
            if br in PROTECTED:
                deny(
                    f"'{br}' 브랜치 직접 {sub} 금지 — dev 에서 분기한 작업 브랜치에서 작업하고"
                    " PR 로만 머지하세요 (git-workflow 스킬)."
                )

    elif sub == "push":
        check_push(rest, cwd, cfg)

    elif sub == "pull":
        check_pull(rest, cwd, cfg)

    elif sub == "fetch":
        check_fetch(rest)

    elif sub == "update-ref":
        # 보호 브랜치 ref 직접 이동/삭제 금지 (어느 브랜치에 있든)
        for p in (a for a in rest if not a.startswith("-")):
            if p.removeprefix("refs/heads/") in PROTECTED:
                deny("update-ref 로 main/dev ref 직접 변경 금지 — PR 로만 머지합니다.")

    elif sub == "reset":
        br = current_branch(cwd)
        if br in PROTECTED:
            positionals = []
            i = 0
            while i < len(rest):
                a = rest[i]
                if a == "--":  # 이후는 전부 pathspec — 브랜치를 움직이지 않는다
                    break
                if a in RESET_OPT_WITH_ARG:
                    i += 2
                    continue
                if a.startswith("-"):
                    i += 1
                    continue
                positionals.append(a)
                i += 1
            # 첫 positional 이 HEAD 가 아니면 커밋 대상 reset 으로 간주 (브랜치 이동 가능)
            if positionals and positionals[0] != "HEAD":
                deny(
                    f"'{br}' 브랜치에서 커밋 대상 reset 금지 — 보호 브랜치를 직접 움직일 수"
                    " 없습니다. 파일 unstage 는 git reset -- <경로> 를 사용하세요."
                )

    new_branch: str | None = None
    if sub in ("checkout", "switch"):
        short_flags = ("-b", "-B") if sub == "checkout" else ("-c", "-C")
        create_flags = short_flags + (
            ("--orphan",) if sub == "checkout"
            else ("--create", "--force-create", "--orphan")
        )
        track = False
        for i, a in enumerate(rest):
            if a in create_flags and i + 1 < len(rest):
                new_branch = rest[i + 1]
            elif a.startswith("--orphan="):
                new_branch = a[len("--orphan=") :]
            elif a.startswith(short_flags) and len(a) > 2 and not a.startswith("--"):
                new_branch = a[2:]  # -b<name> 붙여쓰기
            elif a == "-t" or a == "--track" or a.startswith("--track="):
                track = True
        if new_branch is None and track:
            # --track <remote>/<branch> 는 원격 브랜치명 그대로 로컬 브랜치를 만든다
            positionals = [a for a in rest if not a.startswith("-")]
            if positionals:
                ref = positionals[0].removeprefix("refs/remotes/")
                new_branch = ref.split("/", 1)[1] if "/" in ref else ref
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
            elif a.startswith("--orphan="):
                new_branch = a[len("--orphan=") :]
            elif a.startswith(("-b", "-B")) and len(a) > 2 and not a.startswith("--"):
                new_branch = a[2:]  # -b<name> 붙여쓰기
        if new_branch is None and "--detach" not in wt:
            positionals = []
            i = 0
            while i < len(wt):
                a = wt[i]
                if a in WORKTREE_OPT_WITH_ARG:  # --reason <string> 등 값 옵션
                    i += 2
                    continue
                if a.startswith("-"):
                    i += 1
                    continue
                positionals.append(a)
                i += 1
            if len(positionals) == 1:
                # <path> 만 주면 basename 브랜치가 암묵 생성된다 (-b 와 동일)
                new_branch = os.path.basename(positionals[0].rstrip("/"))
    elif sub == "stash" and rest[:1] == ["branch"] and len(rest) > 1:
        new_branch = rest[1]

    if new_branch and not BRANCH_RE.match(new_branch):
        deny(f"브랜치명 '{new_branch}' 컨벤션 위반 — {CONVENTION} (git-workflow 스킬).")


def check_command(cmd: str, base_cwd: str | None = None, depth: int = 0) -> None:
    """cd 추적을 포함해 명령 문자열 전체를 세그먼트 단위로 검사한다."""
    shell_cwd = base_cwd  # None = 훅 프로세스 cwd 그대로
    for seg in split_segments(tokenize(cmd)):
        if seg and seg[0] == "cd":
            if len(seg) > 1:
                nd = resolve_dir(shell_cwd, seg[1])
                # 존재하지 않는 대상 → cd 실패, 셸은 원래 디렉토리에 남는다 (cwd 유지)
                if nd == UNKNOWN_CWD or os.path.isdir(nd):
                    shell_cwd = nd
            else:
                shell_cwd = UNKNOWN_CWD  # 맨몸 cd = $HOME
            continue
        check_segment(seg, shell_cwd, depth)


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    cmd = (data.get("tool_input") or {}).get("command", "")
    if "git" not in cmd:
        return
    check_command(cmd)


if __name__ == "__main__":
    main()
