# Card headline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 유형별 성취 한 줄과 안전한 폴백을 목록에 표시한다.
**Architecture:** card-headline pure utility consumes detail/form models; ExperienceCard renders result.
**Tech Stack:** React19/Next16/TypeScript/Vitest/Storybook/Playwright, Node20.19.2.
**Spec:** docs/superpowers/specs/2026-10-27-frt-84-card-headline.md

## Global Constraints
- 안정키/기존 저장 계약 보존. 라벨 매칭 재조립 금지. 기존 semantic equivalentLabels/buildDetailSections/computeFormCards 재사용.
- 최신 SYSTEM_TEMPLATES_V2 전체 기준, 유형 수 하드코딩 금지. hidden/formHidden/설정/첨부 안전.
- UI 승인 전 머지 금지. PR base dev. 다른 PR 파일 수정 금지.

### Task 1: 순수 headline 추출
Ownership lib/utils/card-headline.ts 및 card-headline.test.ts. buildCardHeadline(experience, template: TemplateV2 | null): string export. 빈 최종 입력은 안내문 '지표를 추가하면 카드가 더 잘 보여요'. 입력 mutate 금지. 대표 필드 stable key 매핑과 기존 semantic 동의어. 대표값 없으면 summary, 본문 첫 문장, 안내. 단일 블록의 실제 값만 읽고 임의 숫자 추론 금지. 모든 최신 템플릿별 representative fixture, 빈값 fallback, long whitespace, 레거시, unknown, hidden/formHidden, 설정/파일 제외 테스트. 실패 테스트 실행 → 최소 구현 → focused PASS → 보고. 전체 UI/추가 테스트는 Task2.

### Task 2: 카드 표시와 상태 스토리
Ownership ExperienceCard.tsx, ExperienceCard.stories.tsx, e2e/archive-card-headline.spec.ts. Task1 utility 연결. 타입/상태는 무채움 메타, 제목/핵심/메타 위계와 작은 dot. summary 중복 표시 없이 한줄 truncate. 지표 있음/없음/긴값/본문/안내 Storybook play. 실제 archive browser mobile/desktop 출력과 선택/메뉴 확인.

### Task 3: 검증·리뷰·Ready PR
Node20.19.2 lint→typecheck→test:unit→build. Storybook/browser 증거 및 원격 갤러리, 독립 review, Codex 최신head 실제완료와 원격CI 확인. 개인 Notion 기존행 원문 보존 갱신. PR 본문에 목적/범위/DoD/검증/잔여/UI확인/Task없음 명시. Ready 상태 및 사용자 UI 승인 대기 후 슬롯반환.
