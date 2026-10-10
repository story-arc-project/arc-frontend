# FRT-348 미션 센터

사용자가 승인한 [미션 센터 설계](https://arc-frt348-mission-design.drchasekim.chatgpt.site/approved.html)를 React 화면과 계정별 상태 관리로 구현했다. [실제 컴포넌트 미리보기](https://arc-frt348-mission-design.drchasekim.chatgpt.site)는 예시 데이터로만 동작하며 실제 지급을 하지 않는다.

## 구현 범위

- `/credits/missions`, `/credits/missions/M1`–`M10`, 내 계정 진입점.
- 부족 안내의 동일 Dialog 내부 미션 탐색. 원래 폼을 유지하며 Escape는 부족 안내로 돌아간다. 자동 생성 재시도 없음.
- 수령 가능 / 참여 / 검토·보완 / 완료 구분, 상세 참여 조건, URL 증빙과 보완 사유.
- 계정 단위 메모리 초안과 불변 요청 ID. 불확실한 제출·수령은 같은 ID/페이로드로 확인한다. 계정 변경·로그아웃 시 폐기한다.
- 이전 보상 응답 유실과 새 회차 보상을 구분하고, 확정한 보상 ID를 재지급하지 않는다. 지급 확정 후 잔액을 다시 조회한다. 잔액 조회 실패를 지급 실패로 취급하지 않는다.
- M1–M10 고정 보상과 개별 제한, M7–M10만 소급 인정. 패키지 가격/선택과 미션 보상은 독립이다.
- 개발 전용 `/dev/missions`는 development + `FRT348_PREVIEW=true` 두 조건이 필요하다. 기존 FRT-138 Fake Door 미리보기도 동일 미션 UI로 연결한다.

## 실제 API 연결 경계

2026-10-10 원격 backend `dev`의 `fe92b85c462d36e294021e4b1d8a48f17fbc1b70`에서 미션 라우트·모델·계약을 찾지 못했다. BAC-77/78/79 및 FRT-105는 조회 시 Backlog였다. 따라서 production은 `unavailableAdapter`로 상태 확인 불가를 표시하고 참여·제출·지급 요청을 전송하지 않는다. `lib/missions/types.ts`는 프런트엔드 주입 인터페이스이며 합의된 HTTP API 계약이 아니다.

백엔드 계약 확정 후 별도 어댑터에서 인증·미션/회차/보상 식별자·원자적 지급·중복키·재시도/거절 오류를 매핑해야 한다. 기존 내부 credit grant 함수는 공개 미션 지급 API로 사용할 수 없다. 실운영 참여 링크, 초대 주소, 운영자 검토와 FRT-105 이벤트 매핑도 별도 확인이 필요하다. 운영 Fake Door 활성화/BAC-89 및 실로그인 통합 검증/FRT-363은 이 구현의 완료 증거에 포함하지 않는다.

## UI 검토

| Before | After | Why |
| --- | --- | --- |
| Fake Door의 미션 연결 자리표시자 | 실제 목록·상세·증빙·수령 화면 | 원래 입력으로 돌아오는 동작 검증 |
| 진행 상태가 바뀌면 응답 유실 재확인 버튼 소실 | 미확정 작업 종류에 따라 재확인 유지 | 서버 진행 상태와 전송 결과를 분리 |
| 조회 실패 뒤 상세의 이전 행동 버튼 잔존 | 상태 미확인 안내, 신규 작업 차단, 기존 요청 확인 유지 | 오래된 정보로 새 지급 요청 방지 |
| StrictMode에서 초기 조회 중복 | 취소 가능한 microtask로 단일 초기 조회 | 첫 조회 실패가 자동 재요청으로 숨겨지지 않음 |

터치 목표 최소 44px, focus-visible, reduced-motion, 폼 오류와 입력 보존을 적용했다. 데스크톱 목록과 iPad 상세의 렌더링을 시각 확인했으며 브라우저 자동화의 iPad는 Chromium 기기 에뮬레이션이다. 실제 iPad Safari·VoiceOver·실제 계정 및 서버 원장 검증은 별도다.

## 검증

Node 20.19.2. 단위 테스트 178개 파일 / 3,153개 통과.
- `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`: 모두 PASS
- Storybook: `--includeTags frt348`, 17 interaction plays
- Playwright: `playwright.missions.config.ts`의 desktop/iPad/320px 모바일, 27개 통과, 기존 `playwright.fake-door.config.ts` 회귀 14개 통과
- 정적 Sites 번들에서도 실제 React 컴포넌트 수령·증빙 입력·768px overflow·console 검사

단위/모의 E2E 통과는 실제 지급, 실운영 멱등성 또는 인증 서버 통합 완료를 의미하지 않는다.
