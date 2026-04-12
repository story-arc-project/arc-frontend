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

기본 흐름:

> 작은 구현 → 검증 → (필요 시) Codex 리뷰 → 마무리

### 1. Plan
- 요구사항을 1~2문장으로 정리
- 변경 파일과 영향 범위 식별

### 2. Implement
- 최소 동작 버전 먼저 구현
- 기존 구조 유지

### 3. Validate
```bash
npm run lint
npm run build
```

### 4. Adversarial Review (조건부)

다음 경우 실행:
- 3개 이상 파일 변경
- UX 흐름 변경
- 상태 구조 변경
- API 변경

```bash
/codex:adversarial-review --base main
```

### 5. Final Review (필수)

```bash
/codex:review --base main
```

---

## Codex Usage

### 역할
- Claude: 구현
- Codex: 리뷰 / 문제 해결

### Rescue
```bash
/codex:rescue
```

사용 조건:
- 동일 문제 2회 반복
- 원인 불명 버그

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

- workflow: `docs/claude/workflow.md`
- codex: `docs/claude/codex.md`
- checklist: `docs/claude/checklist.md`
- git-workflow: `/git-workflow` (skill)
