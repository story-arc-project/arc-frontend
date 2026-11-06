# FRT-298 Implementation Plan

> Use superpowers:subagent-driven-development for this single task.

**Goal:** 프리셋 응답 오류를 데이터 손실 없이 기존 오류 경로로 전달.
**Architecture:** API 경계에서 unknown을 최소 계약으로 검증하고 원본 객체 그대로 반환.
**Tech Stack:** TypeScript, Vitest, React 19, Node 20.
**Spec:** docs/superpowers/specs/2026-10-26-frt-298-preset-response.md

## Global Constraints
- 정상·데모·미래 블록/추가필드 보존. 임의 항목 삭제/빈목록/ID 조작 금지.
- Node20; API 함수 시그니처·HTTP 메서드·UI/훅 구현 유지.

## Review Focus
- null/missing envelope; mixed malformed list rejects atomically.
- future object blocks retained by reference.
- invalid mutation ID never succeeds.
- hook cache survives failure; subsequent retry restores success.
- demo and transport errors unchanged.

### Task 1: Runtime guard and regressions
Files: lib/api/preset-api.ts; lib/api/preset-api.test.ts; hooks/usePresets.test.tsx.
- [x] Add API invalid/valid/demo/transport and real API-hook integration tests; confirm RED.
- [x] Add typed response error and minimal lossless validation; confirm GREEN.
- [x] Independent spec/quality review; Node20.19.2 lint/typecheck/unit3724/build PASS.
- [x] Inspect UI impact: no production caller/UI change.
- [ ] Ready PR, current-head CI/Codex.
