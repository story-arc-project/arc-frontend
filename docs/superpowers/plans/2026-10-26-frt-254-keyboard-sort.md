# FRT-254 Keyboard Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** 두 기존 정렬 목록을 키보드로 조작한다.

**Architecture:** 기존 dnd-kit 목록에 KeyboardSensor와 sortableKeyboardCoordinates를 추가하고 핸들 activator를 명시한다. 기존 순서 저장 콜백은 그대로 사용한다.

**Tech Stack:** React19, Next16, dnd-kit, Storybook, Playwright, Node20.

**Spec:** docs/superpowers/specs/2026-10-26-frt-254-keyboard-sort.md

## Global Constraints
기존 pointer 8px/순서저장 유지. FRT199 실기기 미검증·touch-none 제외. 공유 utils/test 변경 제외. 최신 UI 사용자 승인 전 머지 금지.

## Review Focus
입력 필드 Space/Enter 오작동, 취소 저장 방지, 이동 후 초점, readOnly/disabled, nested DndContext 이벤트 격리를 확인한다.

## Task 1 — 센서와 핸들
- [x] BlockList.tsx 및 resume editors/shared.tsx 센서·activator·한국어 공지 추가.
- [x] controlled Storybook에서 양쪽 시작키·이동·완료·취소·초점을 검증.
- [x] 실제 archive userSections/looseCustomBlocks·resume 경로 desktop/mobile 회귀 검증.
- [x] 독립 스펙/품질 리뷰 후 지적 해결.

## Task 2 — 검증과 제출
- [x] Node20 lint/typecheck/unit/build 및 Storybook/Playwright 검사.
- [x] 원격 UI 갤러리·시나리오, FRT199 잔여와 증거 경계 기록.
- [x] dev 대상 Ready PR, 최신head Codex 리뷰 요청 및 실제 종료/CI 확인.
- [x] 사용자 최신 UI 승인 대기로 기록하고 개발 슬롯 반환.

## Verification receipt
Node20.19.2 lint/typecheck/unit3445/build PASS; actual-route Playwright5 PASS; Storybook84 suites/434 PASS. Independent spec/quality/final review approved. UI approval pending; FRT199 physical touch evidence unavailable.
