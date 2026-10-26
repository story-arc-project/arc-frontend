# FRT-275 Table Cell Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** 표 셀을 블록·행·열 맥락을 가진 이름으로 탐색한다.
**Architecture:** TableBlock의 현재 배열 위치에서 이름을 파생하고 useId로 편집 그룹 제목을 연결한다.
**Tech Stack:** React19, TypeScript, Vitest, Storybook, Playwright, Node20.
**Spec:** docs/superpowers/specs/2026-10-26-frt-275-table-cell-labels.md

## Global Constraints
- dev 기반 격리 브랜치 / PR base dev / 최신 UI 승인 전 미머지.
- 레이아웃·저장 shape·읽기전용·기존 삭제 동작 유지.

## Review Focus
- 반복된 열명은 열 번호로 구분한다.
- 같은 블록명은 고유 DOM 라벨 연결을 유지한다.
- 행 삭제 후 남은 값과 현재 번호가 대응한다.
- 신규 행/열은 이름과 빈 값을 가진다.
- 키보드 순서·편집·읽기전용 보존.

### Task 1: 셀 이름과 회귀
**Files:** TableBlock.tsx / .test.tsx / .stories.tsx.
**Interfaces:** Block, TableBlockValue, onChange 기존 형태 유지.
- [x] 이름·중복블록·행 추가삭제·열 추가·키보드·읽기전용 테스트 작성.
- [x] focused RED 확인: 5 failed, 1 passed.
- [x] group 제목 연결과 셀 aria-label 구현.
- [x] focused GREEN 6/6 및 독립 스펙/품질 리뷰 PASS.

### Task 2: 통합 검증과 전달
**Files:** e2e/frt-275-table-cell-labels.spec.ts, preview(비커밋).
- [x] mock 앱 desktop/mobile 2/2, Storybook 5/5(play 포함) PASS.
- [x] Node20.19.2 lint/typecheck/test:unit(199 files, 3534 tests)/build PASS.
- [ ] UI 미리보기·Ready PR·최신 head Codex 리뷰·개인행 최소 갱신·슬롯 반환.
