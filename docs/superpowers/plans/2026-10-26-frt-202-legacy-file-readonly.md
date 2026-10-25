# FRT-202 Legacy Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** URL-only 레거시 첨부를 readOnly에서 안전하게 열람한다.
**Architecture:** isSafeHttpUrl로 legacy URL을 검증하고 기존 pickPreview를 재사용한다. fileId URL 갱신/편집 동작은 유지한다.
**Tech Stack:** Next16, React19, TypeScript, Vitest, Storybook, Playwright, Node20.
**Spec:** docs/superpowers/specs/2026-10-26-frt-202-legacy-file-readonly.md

## Global Constraints
- 최신 dev ed862c5 기반 격리 fix/frt-202-legacy-file-readonly; PR base dev.
- block-utils.ts/form-cards.test.ts 변경 금지. fileId TTL/재생 보존 회귀 금지.
- HTTP(S)만 legacy 렌더 허용. 이름만/빈값/편집 폴백 보존.
- UI 승인 전 머지 금지. mock 검증과 실서버/배포 구분.

## Review Focus
- MIME 누락/filename-only 확장자는 일반 링크를 제공한다.
- javascript/data/blob/mailto/깨진 URL은 열람 대상으로 승격하지 않는다.
- URL-only 첨부에는 file API 호출과 onChange가 없다.
- 인코딩된 파일명 URL은 보존한다.
- 이름만 데모·빈값·기존 fileId TTL/재시도가 유지된다.

### Task 1: readOnly legacy preview and regression
**Files:** FileBlock.tsx, FileBlock.test.tsx, FileBlock.stories.tsx (components/features/archive/blocks/ 내부).
**Interfaces:** 기존 FileBlock props 및 pickPreview, isSafeHttpUrl(value:string):boolean.
- [x] URL-only/MIME/인코딩/unsafe/폴백 regression tests를 추가하고 기존 코드에서 실패 확인.
- [x] readOnly 미리보기 조건만 안전한 legacy URL까지 확장.
- [x] 집중 유닛 테스트 PASS, legacy Storybook play 추가.
- [x] 독립 spec/quality review.

### Task 2: service QA and delivery (controller)
**Files:** e2e/legacy-file-readonly.spec.ts; ignored preview outputs.
- [x] 실제 archive 상세 readOnly 경로에 legacy mock 주입; desktop/mobile 링크·폴백·unsafe 회귀.
- [x] Node20 lint/typecheck/unit/build 및 Storybook play.
- [ ] 원격 UI preview와 체크리스트, Ready PR dev, attach, 최신head Codex 요청/종료 확인.
- [ ] 개인 기존 Notion행·Linear 갱신; 사용자 UI승인 대기로 종료.
