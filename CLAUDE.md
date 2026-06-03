# CLAUDE.md — ARC

## Project

ARC는 정성적 경험 데이터를 기록·연결해 커리어 내러티브를 만드는 플랫폼이다.  
주요 타겟은 진로가 확정되지 않은 대학생이다.

---

## Core Principles

- 입력 허들을 최소화한다 (UX 최우선)
- 경험은 정성 데이터로 다룬다
- 사용자가 생각하지 않도록 자동화한다
- 안정감을 주는 톤 유지 (경쟁/압박 지양)

---

## Product Perspective

- ARC는 스펙 관리 도구가 아니라 경험 기록 도구다
- 사용자는 구조화보다 빠른 기록을 원한다
- 입력은 단순하게, 정리는 시스템이 수행한다

---

## Tech Stack

- Next.js (App Router)
- TypeScript (strict)
- Tailwind CSS

---

## Structure

```text
app/          # Next.js App Router (pages, layouts, API routes)
components/   # UI·feature·layout 컴포넌트
lib/          # 유틸리티, API 클라이언트, 매퍼
hooks/        # 커스텀 React 훅
types/        # 공유 타입 정의
contexts/     # React Context providers
public/       # 정적 에셋
docs/         # 프로젝트 문서 (claude 등)
```

---

## Commands

- `npm run dev`
- `npm run build`
- `npm run lint`

---

## Conventions

- PascalCase: components
- camelCase: variables/functions
- Type: PascalCase (no prefix)
- import order:
  react/next → external → `@/lib` → `@/components` → relative
- default export 1개
- Tailwind only (no inline style)
- 상태는 가능하면 searchParams 기반

---

## AI Rules

- AI 호출은 반드시 backend API
- frontend는 fetch만 담당
- API key / prompt 로직 frontend 금지
- 판단 로직은 서버에 둔다

---

## UX Rules

- 입력 단계 최소화
- optional 입력 허용
- validation은 느슨하게, 후처리 강화
- 한 화면 = 하나의 핵심 행동
- 빈 상태에서도 다음 행동이 보여야 함

---

## Hard Constraints

- `any` 금지
- console.log 커밋 금지
- 요청하지 않은 리팩토링 금지
- 변경 범위 최소화
- 프론트에 AI 로직 구현 금지

---

## Development Workflow (Mandatory)

> 개발 프로세스는 품질 기준으로 운영한다. "입력 허들 최소화"는 *제품 사용자* 원칙이며 개발 워크플로우와 무관하다.
> 척추 = superpowers 스킬 · 리뷰 권위 = Codex · git 규약 = `/git-workflow` (skill)

### 0. Triage — 복잡도 게이트
규모에 비례해 단계를 정한다.
- **Trivial** (1~2파일, UX/상태/API 변화 없음): Brainstorm·Plan·SDD**만** 생략한다. **3 Isolate(dev에서 분기)는 반드시 수행** → 4 Implement → 5 Validate. **8 Review의 필수 `/codex:review --base dev`도 생략하지 않는다** (조건부 adversarial·6 UI Quality는 해당 시). main/dev 직접 커밋 금지는 규모와 무관하게 적용된다.
- **Standard** (3~5파일 또는 UX/상태 변화): 전체 파이프라인
- **Large** (6+파일, 새 기능/흐름): 전체 + 설계 문서

### 1. Brainstorm (Standard+)
`superpowers:brainstorming` 으로 의도·요구·설계 정리. Large는 design doc까지.

### 2. Plan
`superpowers:writing-plans` 로 단계별 구현 계획 작성. 변경 파일·영향 범위 식별.

### 3. Isolate
`superpowers:using-git-worktrees` + `/git-workflow` (skill). **dev에서 분기, PR base = dev.**

### 4. Implement
계획을 `superpowers:subagent-driven-development` (SDD)로 실행 — 독립 태스크 단위, 2단계 리뷰(스펙 준수 → 코드 품질).
- 각 태스크는 **TDD** (RED→GREEN→REFACTOR) — **FRT Test Foundation(FRT-22..33) 완료 후 의무화**. 그 전까지는 5 Validate로 대체. *(pending)*
- 신규 컴포넌트/페이지: **UI Spec 상태 매트릭스** 먼저 (loading/error/empty/partial × 컴포넌트).
- 기존 패턴 유지, Hard Constraints 준수. Trivial은 SDD 없이 직접 구현.

### 5. Validate
```bash
npm run lint
npm run build
```
UI 변경 시 `/expect` 브라우저 테스트.

### 6. UI Quality (조건부 — UI 변경)
- 새 컴포넌트/페이지 → `/audit` + `/critique`
- 레이아웃·스타일 수정 → `/expect` + `/polish`
- 디자인 시스템 정합성 의심 → `/normalize`

### 7. Self-review
`superpowers:requesting-code-review` 체크리스트로 셀프 점검 후 리뷰 요청.

### 8. Review (필수) — Codex가 최종 권위
- 조건부 `/codex:adversarial-review --base dev` (3+파일 / UX / 상태 / API 변경 시)
- 필수 `/codex:review --base dev`
- Codex = 제안자, 실제 수정 = Claude. 반복 실패(2회) / 원인 불명 버그 → `/codex:rescue`.

### 9. Finish
`superpowers:finishing-a-development-branch` → PR(base dev) → merge → 브랜치 삭제. (PR 템플릿은 `/git-workflow`)

### 10. Output
변경 내용 / 이유 / 수정 파일 / 검증 결과 / 남은 리스크.

> 가로지르는 규율: 완료 주장 전 `superpowers:verification-before-completion`(검증 명령 실제 실행), 버그·실패 시 `superpowers:systematic-debugging` 우선.

---

## Quality Bar

- lint 통과
- build 통과
- 타입 안정성 유지
- UX 악화 없음
- 입력 단계 증가 없음
- AI 로직 frontend 없음

---

## Output Rules

작업 완료 시:

- 변경 내용
- 변경 이유
- 수정 파일
- 검증 결과
- 남은 리스크

---

## References

워크플로우 정본은 위 **Development Workflow** 섹션이다. 아래는 보조 자료.

- checklist: `docs/claude/checklist.md`
- workflow (요약 포인터): `docs/claude/workflow.md`
- codex (요약 포인터): `docs/claude/codex.md`
- git-workflow: `/git-workflow` (skill) — 브랜치 전략·커밋·PR 규약
- superpowers (skill): `brainstorming` · `writing-plans` · `using-git-worktrees` · `subagent-driven-development` · `test-driven-development` · `requesting-code-review` · `finishing-a-development-branch` · `verification-before-completion` · `systematic-debugging`
