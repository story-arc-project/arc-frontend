# FRT-240 File URL Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 오래 열린 경험 폼에서 파일 다운로드·미리보기 링크가 갱신되고 조회 실패를 재시도할 수 있게 한다.
**Architecture:** FileBlock 내부에서 파일 ID에 귀속된 URL/오류 상태와 취소 가능한 단일 갱신 타이머를 운용한다. FileCellInput 선례를 사용하되 파일 교체와 fallback이 실패한 URL을 되살리지 않도록 한다.
**Tech Stack:** React19 Next16 TypeScript Vitest Playwright Node20
**Spec:** docs/superpowers/specs/2026-10-25-frt-240-file-url-refresh.md

## Global Constraints
- 변경 범위는 FRT-240 FileBlock URL 수명과 직접 회귀/스토리/e2e만. 기존 열린 PR 파일 수정 금지.
- 파일 데이터·보안 URL/API·서버 삭제 정책 변경 금지. 파일 ID 없는 value/데모 표시 보존.
- UI 최신 PR 사용자 명시 승인 전 머지 금지. Node20 사용.

## Review Focus
- stale 성공/실패가 다른 파일의 링크를 덮지 않는다.
- 갱신 실패 후 val.url로 만료 링크를 재노출하지 않는다.
- readOnly에 오류 안내와 수동 재시도가 존재한다.
- 짧은 TTL/과거 만료는 최소 간격으로 제한하고 실패는 무한 반복하지 않는다.
- 업로드 완료가 그동안 수정한 설명/증빙 유형을 덮지 않는다.

### Task 1: FileBlock URL lifecycle and regression coverage
**Files:** Modify components/features/archive/blocks/FileBlock.tsx, FileBlock.test.tsx, FileBlock.stories.tsx (same directory).
**Interfaces:** getFileUrl(id): Promise<{url:string;expiresAt?:string}>. onChange(FileBlockValue) 기존 계약 보존.
- [ ] 실패하는 fake timer 회귀를 먼저 작성하고 RED 확인: 만료 60초 전(최소30초), 정보없음/invalid5분, 실패/재시도, readOnly, A→B 늦은 resolve/reject, 삭제/언마운트, 업로드 중 설명변경.
- [ ] 단일 타이머·취소가드·파일별 상태를 구현하고 회귀 GREEN 확인. 오류는 고정 문구로 보안URL 유출 방지.
- [ ] 변경된 상태를 Storybook play로 검증한다.
- [ ] 집중 테스트와 self-review 후 커밋한다.

### Task 2: Actual form browser verification and delivery
**Files:** Create e2e/file-block-url-refresh.spec.ts. 기존 e2e fixtures는 수정하지 않는다.
- [ ] /archive 실제 폼에 API mock 첨부를 주입하여 desktop1440/mobile390에서 성공·시간갱신·실패/재시도 확인. 스크린샷 수집.
- [ ] Node20 lint/typecheck/unit/build와 browser/Storybook 검사. 독립 spec/quality 리뷰.
- [ ] gallery HTML 생성, 개인 기존 Notion 업무행에 결과/체크리스트 갱신. Ready PR base dev/attach, 최신head Codex 리뷰 요청과 CI 조회. pending은 기록 후 종료.
