# Workflow — ARC

> **정본은 루트 `CLAUDE.md`의 "Development Workflow (Mandatory)" 섹션이다.**
> 이 문서는 빠른 참조용 요약 포인터다. 충돌 시 CLAUDE.md가 우선한다.

## 파이프라인 (복잡도 게이트 기반)

```
0 Triage → 1 Brainstorm → 2 Plan → 3 Isolate → 4 Implement(SDD+TDD)
        → 5 Validate → 6 UI Quality → 7 Self-review → 8 Review(Codex) → 9 Finish → 10 Output
```

**기본값 Standard** — 분류가 애매하면 Standard로 올린다(Trivial은 명백할 때만).

- **Trivial** (1~2파일): Brainstorm·Plan·SDD**만** 생략 — 3 Isolate(dev 분기)와 8 Review(필수)는 유지, 4 → 5 진행
- **Standard** (3~5파일 / UX·상태 변화): 전체
- **Large** (6+파일 / 새 기능): 전체 + design doc

## 구성 요소

- **척추**: superpowers — `brainstorming` · `writing-plans` · `using-git-worktrees` · `subagent-driven-development`(SDD) · `test-driven-development`(TDD) · `finishing-a-development-branch` · `verification-before-completion`
- **리뷰 권위**: Codex — `/codex:review --base dev` (필수), `/codex:adversarial-review --base dev` (조건부)
- **git 규약**: `git-workflow` 스킬(Git 작업 시 자동 로드) — dev 기반 2단계 전략, PR base = dev
- **UI 품질** (조건부): `/audit` `/critique` `/polish` `/normalize`
  - 새 컴포넌트/페이지 → `/audit` + `/critique`
  - 레이아웃·스타일 수정 → `/polish` (+ Storybook 시각 확인)
  - 디자인 시스템 정합성 의심 → `/normalize`

## TDD 상태 — 활성

테스트 인프라(**FRT Test Foundation** 프로젝트) 구축 완료 → TDD **활성**. 4 Implement는 **테스트 전략 매트릭스**(`docs/frontend-testing.md`)를 따른다: 로직·매퍼·방어 파싱은 Vitest **TDD 의무**, 컴포넌트는 Storybook 스토리, `(main)` 흐름은 Playwright 스모크. 2차 통합 E2E(FRT-33)는 deferred(BE 계약 안정화 후 재검토).
