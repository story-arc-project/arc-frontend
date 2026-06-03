# Workflow — ARC

> **정본은 루트 `CLAUDE.md`의 "Development Workflow (Mandatory)" 섹션이다.**
> 이 문서는 빠른 참조용 요약 포인터다. 충돌 시 CLAUDE.md가 우선한다.

## 파이프라인 (복잡도 게이트 기반)

```
0 Triage → 1 Brainstorm → 2 Plan → 3 Isolate → 4 Implement(SDD+TDD)
        → 5 Validate → 6 UI Quality → 7 Self-review → 8 Review(Codex) → 9 Finish → 10 Output
```

- **Trivial** (1~2파일): Brainstorm·Plan·SDD 생략, 4 → 5 직행 — 단 8 Review(필수)는 유지
- **Standard** (3~5파일 / UX·상태 변화): 전체
- **Large** (6+파일 / 새 기능): 전체 + design doc

## 구성 요소

- **척추**: superpowers — `brainstorming` · `writing-plans` · `using-git-worktrees` · `subagent-driven-development`(SDD) · `test-driven-development`(TDD) · `finishing-a-development-branch` · `verification-before-completion`
- **리뷰 권위**: Codex — `/codex:review --base dev` (필수), `/codex:adversarial-review --base dev` (조건부)
- **git 규약**: `/git-workflow` (skill) — dev 기반 2단계 전략, PR base = dev
- **UI 품질** (조건부): `/expect` `/audit` `/critique` `/polish` `/normalize`
  - 새 컴포넌트/페이지 → `/audit` + `/critique`
  - 레이아웃·스타일 수정 → `/expect` + `/polish`
  - 디자인 시스템 정합성 의심 → `/normalize`

## TDD 상태

테스트 인프라(**FRT Test Foundation, FRT-22..33**)는 미구현. 완료 전까지 검증은 `npm run lint` + `npm run build` + `/expect`로 대체하며, 완료 후 4 Implement에서 **TDD 의무화**한다.
