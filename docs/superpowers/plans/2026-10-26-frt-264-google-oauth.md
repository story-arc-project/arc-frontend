# FRT-264 Implementation Plan

**Goal:** Google authorize URL 중복을 제거하며 세 인증 흐름의 동작을 보존한다.
**Architecture:** lib/auth/google-auth-url.ts의 순수 buildGoogleAuthUrl({clientId, redirectUri, state})를 세 호출부에서 사용. state와 부수효과는 호출부 소유.
**Tech Stack:** TypeScript, Vitest, React 19/Next 16, Node 20.
**Spec:** ../specs/2026-10-26-frt-264-google-oauth.md

## Constraints
인증/권한/CSRF/콜백 정책 및 UI 불변. origin/dev eb840033 기반. 타인 변경 보존.

## Review Focus
- 특수문자 state/client ID/redirect URI의 이중 인코딩 금지
- 탈퇴만 delete 접두사 유지
- client ID 미설정 시 state 생성 금지
- signup 계측 순서 및 handoff 정리 유지
- 순수 빌더에서 쿠키/브라우저 접근 금지

## Task 1
- [x] URL 계약 및 세 흐름 회귀를 먼저 작성하고 실패 확인.
- [x] lib/auth/google-auth-url.ts 생성, login/page.tsx/signup/page.tsx/oauth-providers.ts에서 URL 조립만 교체.
- [x] focused 회귀 확인, 독립 리뷰.
- [x] Node20 lint/typecheck/test:unit/build 실행.
- [ ] Ready PR(base dev), 최신 head Codex 리뷰와 CI 확인; 비UI 승인 범위 조건 충족 시 merge.
