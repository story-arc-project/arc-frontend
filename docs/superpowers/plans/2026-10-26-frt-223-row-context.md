# FRT-223 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** 반복 기록 입력의 행·컬럼을 접근 가능한 이름으로 구분한다.
**Architecture:** RowEditor index에서 이름을 파생해 기존 CellInput으로 전달한다. 옵션별 컨트롤도 전달된 맥락을 반영한다.
**Tech Stack:** React19, TypeScript, Next16, Vitest, Storybook, Playwright, Node20.
**Spec:** docs/superpowers/specs/2026-10-26-frt-223-row-context.md

## Global Constraints
- dev기반 격리 branch / PR base dev / UI 명시승인전 미머지.
- 9개 유형, 저장값·행id 보존, 새 정렬 UI 없음.

## Review Focus
- 체크리스트 옵션·역할칩도 맥락 유지.
- 기간 시작/종료/현재 각각 이름 유지.
- 행 삭제와 외부 순서 변경 후 값·번호 대응.
- 빈 표시 행 실체화 후 이름 유지.
- 기존 소비자 정확일치 테스트·스토리 갱신.

### Task 1: 행 맥락 구현과 회귀
**Files:** RepeatableCellBlock.tsx / .test.tsx / .stories.tsx, 필요 시 RoleChips.tsx와 관련 테스트 소비자.
**Interfaces:** RowEditor index:number -> CellInput ariaLabel:string; 선택 옵션 및 역할칩에 맥락 전달.
- [x] 실패 테스트: 9개 유형 두 행 및 기간·옵션 하위컨트롤 이름, 추가/삭제/외부순서/placeholder 검증.
- [x] focused Vitest RED 확인.
- [x] 공통 이름·행 삭제 이름 및 우회 분기 구현, 정확일치 소비자 갱신.
- [x] focused GREEN, 상호작용 Storybook 추가.
- [x] 독립 스펙·품질 리뷰.

### Task 2: 통합 검증과 전달
**Files:** e2e/frt-223-row-context.spec.ts, preview 산출물(비커밋).
- [x] 실제 앱 mock 기반 desktop/mobile 행 맥락·추가삭제 확인.
- [x] Node20 lint/typecheck/unit/build, Storybook play 실행.
- [ ] 최종 독립 리뷰 후 Ready PR, 최신head Codex 요청·상태 기록.
- [ ] UI 갤러리/CI artifact 체크리스트, 개인행 최소 갱신, 슬롯 반환.
