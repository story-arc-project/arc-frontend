# CLAUDE.md — ARC

## Project

ARC는 정성적 경험 데이터를 기록·연결해 커리어 내러티브를 만드는 플랫폼이다.
주요 타겟은 진로가 확정되지 않은 대학생이다.

**제품 원칙** — 스펙 관리 도구가 아니라 경험 기록 도구다.

- 입력 허들 최소화 (UX 최우선) · 입력은 단순하게, 정리는 시스템이
- 사용자가 생각하지 않도록 자동화 · 안정감을 주는 톤 (경쟁/압박 지양)
- 한 화면 = 하나의 핵심 행동 · 빈 상태에서도 다음 행동이 보여야 함
- optional 입력 허용 · validation은 느슨하게, 후처리 강화 · 입력 단계 증가 금지

## Tech Stack & Structure

Next.js (App Router) · TypeScript (strict) · Tailwind CSS

```text
app/          # App Router (pages, layouts, API routes)
components/   # UI·feature·layout 컴포넌트
lib/          # 유틸리티, API 클라이언트, 매퍼
hooks/ types/ contexts/
e2e/          # Playwright (정본: docs/frontend-testing.md)
docs/         # 프로젝트 문서
```

## Commands

- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`
- 테스트: `npm run test:unit` (Vitest) · `npm run test:e2e` (Playwright) · `npm run storybook`
- 4게이트(lint→typecheck→unit→build) 일괄 검증: `validate` 스킬 (서브에이전트 실행)

## Conventions

- PascalCase: components · camelCase: variables/functions · Type: PascalCase (no prefix)
- import order: react/next → external → `@/lib` → `@/components` → relative
- default export 1개 · Tailwind only (inline style 금지)
- 상태는 가능하면 searchParams 기반

## Communication — 행동의 언어

사용자에게 보이는 모든 산출물(Linear 이슈 본문, PR 제목·본문, 작업 완료 보고)은 **행동의 언어**로 쓴다.

- "어떻게 구현했나"가 아니라 **"어떤 기능이 생겼고, 사용자/관리자가 이제 무엇을 할 수 있는가"**를 먼저.
- 구현 세부는 Linear sub-issue 또는 PR의 접힌 `<details>구현 노트</details>`로 격리한다.
- Linear 계층: 부모 이슈 = 행동·가치, sub-issue = 구현 계획.
- 작업 완료 보고 순서: 가능해진 행동 → 직접 확인하는 방법 → 남은 리스크.

## Hard Constraints

- `any` 금지 · 요청하지 않은 리팩토링 금지 · 변경 범위 최소화
- AI 호출은 반드시 backend API — frontend는 fetch만, API key/prompt/판단 로직 frontend 금지
- console.log 금지는 ESLint(no-console)가, main/dev 직접 커밋·푸시와 브랜치 네이밍은
  훅(`.claude/hooks/git-guard.py`)이 강제한다 — 문서 규칙이 아니라 게이트다.

## Development Workflow

코드 변경 작업(기능·버그·리팩토링)은 **`arc-dev-workflow` 스킬**을 따른다.
요약: Triage 기본값 Standard → Brainstorm/Plan → dev에서 분기(worktree) → SDD/TDD 구현 →
`validate` 4게이트 → UI 변경 시 `ui-preview`로 사용자 확인 채널 발행 →
리뷰 `/code-review medium --fix`(사용자 트리거) → **draft PR**(base=dev, ready 전환·머지는 사용자 몫).

경로별 세부 규칙은 `.claude/rules/`(archive · api · testing)가 해당 파일 작업 시 자동 로드된다.

## graphify

지식그래프 `graphify-out/` (로컬 전용, gitignore — 커밋 금지).

- 코드베이스 질문은 `graphify query "<질문>"` 우선 (`path`/`explain`도 활용).
- 코드 수정 후 `graphify update .` 로 로컬 그래프 최신화.

## References

- 테스트 전략·작성법 정본: `docs/frontend-testing.md`
- 워크플로 정본: `arc-dev-workflow` 스킬 · git 규약: `git-workflow` 스킬(자동 로드)
- UI 디자인 시스템: `ui-guidelines` 스킬 · 백엔드 API 계약: api.story-arc.org/docs
