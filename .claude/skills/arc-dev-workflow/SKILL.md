---
name: arc-dev-workflow
description: ARC 코드 변경 작업(기능 개발·버그 수정·리팩토링·스타일 변경)을 시작할 때 사용한다. 어떤 규모의 구현 작업이든 착수 전에 로드해 파이프라인 단계를 정한다.
---

# ARC Development Workflow

> 개발 프로세스는 품질 기준으로 운영한다. 척추 = superpowers 스킬 ·
> 리뷰 = `/code-review medium --fix`(사용자 트리거) · git 규약 = `git-workflow` 스킬(자동 로드).

## 0. Triage — 복잡도 게이트

규모에 비례해 단계를 정한다. **기본값은 Standard** — 분류가 애매하면 Standard로 올린다.
Trivial은 아래 조건이 *명백할 때만* 적용한다.

- **Trivial** (1~2파일, UX/상태/API 변화 없음): Brainstorm·Plan·SDD**만** 생략.
  **3 Isolate(dev에서 분기)는 반드시 수행** → 4 Implement → 5 Validate.
  **8 Review(`/code-review medium --fix`)도 생략하지 않는다.**
- **Standard** (3~5파일 또는 UX/상태 변화): 전체 파이프라인
- **Large** (6+파일, 새 기능/흐름): 전체 + 설계 문서

## 1. Brainstorm (Standard+)

`superpowers:brainstorming`으로 의도·요구·설계 정리. Large는 design doc까지.

## 2. Plan

`superpowers:writing-plans`로 단계별 구현 계획 작성. 변경 파일·영향 범위 식별.

## 3. Isolate

`superpowers:using-git-worktrees` + `git-workflow` 스킬. **dev에서 분기, PR base = dev.**
(main/dev 직접 커밋과 브랜치 네이밍은 `.claude/hooks/git-guard.py`가 강제한다.)

## 4. Implement

계획을 `superpowers:subagent-driven-development`(SDD)로 실행 — 독립 태스크 단위,
2단계 리뷰(스펙 준수 → 코드 품질).

- 각 태스크는 테스트 전략 매트릭스(`docs/frontend-testing.md`)로 검증 —
  로직·매퍼·방어 파싱은 **TDD 의무**, 컴포넌트는 Storybook 스토리, `(main)` 흐름은 Playwright 스모크.
- 신규 컴포넌트/페이지: **UI Spec 상태 매트릭스** 먼저 (loading/error/empty/partial × 컴포넌트).
- 기존 패턴 유지, Hard Constraints 준수. Trivial은 SDD 없이 직접 구현.

## 5. Validate

`validate` 스킬로 4게이트(lint → typecheck → test:unit → build)를 서브에이전트 실행하고 요약을 받는다.
UI 변경 시 Storybook(`play`)·Playwright로 동작 확인 (→ `docs/frontend-testing.md`).

## 6. UI Quality + 사용자 확인 (조건부 — UI 변경)

- **`ui-preview` 스킬로 스크린샷 갤러리를 발행해 사용자가 원격에서 눈으로 확인할 수 있게 한다.**
  갤러리 링크는 PR 본문 "직접 확인하는 방법"에 기재.
- 새 컴포넌트/페이지 → `/audit` + `/critique` · 레이아웃/스타일 수정 → `/polish` ·
  디자인 시스템 정합성 의심 → `/normalize`
- 시각 회귀가 걱정되는 변경은 Chromatic 수동 실행: `gh workflow run chromatic.yml --ref <브랜치>`

## 7. Self-review

`superpowers:requesting-code-review` 체크리스트로 셀프 점검 후 리뷰 요청.

## 8. Review (필수) — `/code-review medium --fix`

- **리뷰는 `/code-review medium --fix` 하나로 돌린다.** Claude가 임의로 트리거하지 않는다 —
  사용자가 실행하고, Claude는 지적을 받아 수정·재검증한다.
- **Codex 리뷰(`/codex:review` · `/codex:adversarial-review`)는 더 이상 돌리지 않는다.**
  (`/codex:rescue`는 리뷰가 아니라 막힌 구현의 구조 요청이므로 별개다.)

## 9. Finish

`superpowers:finishing-a-development-branch` → PR(base dev) → merge → 브랜치 삭제.

- **PR은 항상 draft로 연다** — `gh pr create --draft`. ready 전환은 사용자 몫이다.
  단 **주간 `dev → main` 릴리스 PR은 예외**(draft면 `release-gate` 자동 머지가 실패한다 → `git-workflow`).
- **머지는 사용자 확인 후에만** — draft PR 오픈까지가 자율 범위다.

## 10. Output — 행동의 언어

작업 완료 보고와 PR 본문은 CLAUDE.md의 Communication 원칙을 따른다:
**가능해진 행동 → 직접 확인하는 방법(스크린샷/갤러리/시나리오) → 남은 리스크.**
구현 세부는 접힌 `<details>구현 노트</details>`로.

> 가로지르는 규율: 완료 주장 전 `superpowers:verification-before-completion`(검증 명령 실제 실행),
> 버그·실패 시 `superpowers:systematic-debugging` 우선.
