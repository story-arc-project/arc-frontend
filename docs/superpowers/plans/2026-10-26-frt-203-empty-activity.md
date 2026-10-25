# FRT-203 Implementation Plan

> Agentic workers: use superpowers:subagent-driven-development.

Goal: 의미 있는 활동 내용이 없는 행을 미리보기와 문서에서 동일하게 숨긴다.
Architecture: 전용 resume-activity 유틸을 PreviewActivity와 resume-document 활동 분기에서만 사용한다.
Tech Stack: TypeScript / React / Vitest / Next.js.
Spec: docs/superpowers/specs/2026-10-26-frt-203-empty-activity.md

## Constraints and review focus
Node20. 기존 isEmptySection·저장·편집기 변경 금지. page.test.tsx 변경 금지.
날짜/진행중만 존재, 공백 배열, 부분 이름/기관/역할/내용/성과, 표시=false, 순위 및 원본 불변성 검증.

## Task 1
- [x] 전용 회귀 테스트에서 기존 유령 행 노출 RED 확인.
- [x] 활동 필터 구현 및 미리보기/문서 연결.
- [ ] focused/unit/typecheck/lint/build 및 실제 라우트 desktop/mobile 검증.
- [ ] 독립 리뷰, Ready PR, 최신 head Codex 리뷰와 UI 승인 대기.

## 검증 기록

- TDD: 수정 전 신규 12개 중 6 FAIL; 수정 후 기존 문서·visibility 포함 49 PASS, 확장 전용 13 PASS.
- Node20 lint/typecheck PASS; 전체 unit194파일3458 PASS.
- 독립 명세·품질 및 전체 리뷰: 제품 지적 없음. E2E API 요청 범위/CORS 지적 수정 후 scoped re-review clean.
- UI 승인·최신 head Codex/CI 종료는 PR 생성 후 별도 확인.

- 실제경로 desktop/mobile 4PASS(Word XML, 편집기 보존), 화면4장 직접 확인. Storybook84 suites432 PASS.
