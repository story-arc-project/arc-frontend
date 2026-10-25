# FRT-137 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Each task includes regression verification and review.

**Goal:** AI 출력 5개 경계 규칙을 기존 상세에서 보장한다.
**Architecture:** 기존 API 매퍼에서 불확실한 비율을 null로 표시하고 명시 false의 강점 내용을 비운다. 페이지는 유효한 비율만 렌더한다.
**Tech Stack:** TypeScript, Next.js16, React19, Vitest, Playwright, Node20.
**Spec:** docs/superpowers/specs/2026-10-25-frt-137-analysis-output-guards.md

## Global Constraints

- 최신 origin/dev16a4882 기반 fix/frt-137-analysis-output-guards 격리 작업.
- 기존 FRT123 방어 파싱 사용; backend/API 정책 변경 금지.
- 수치 재계산 금지; 유효한 API 비율 보존; 명시 false 강점 무시; absent legacy 보존.
- 학교/학과 없으면 줄 숨김; strength_diagnosis 먼저 critical_diagnosis 뒤 고정.
- meta.format 부재/이상값에서도 상세 크래시 없음.
- UI 사용자 승인 전 머지 금지. Mock과 실서버·배포 증거 분리.

## Review Focus

누락/0/음수/관련수초과 분모, 비정상 비율, 명시 false의 모순 강점, 학교누락/키순서역전, 레쥬메 format 부재/객체/미상값.

## Task 1: 누락 방어 구현

- [ ] worker owns analysis-api.ts/test, keyword page/test, types/analysis.ts.
- [ ] 실패하는 원시 응답 매퍼·표시 회귀 작성 후 RED 확인.
- [ ] 기존 매퍼 최소 수정 및 키워드 fraction/progressbar 게이트, GREEN 확인.
- [ ] 독립 스펙·품질 리뷰.

## Task 2: 기존 방어의 통합 증명

- [ ] 종합 상세 학교누락/순서 회귀와 레쥬메 format 회귀 추가.
- [ ] 실제 분석 라우트 raw API 결함 fixture 데스크톱·모바일 QA와 캡처.
- [ ] Node20 4게이트 및 독립 전체 diff 리뷰.
- [ ] 커밋/Ready PR(base dev)/갤러리/attach/Codex 요청 ID+SHA+시각 기록.
- [ ] 기존 개인 업무DB 행만 갱신/재조회, CI·리뷰 pending이면 증거 남기고 종료.
