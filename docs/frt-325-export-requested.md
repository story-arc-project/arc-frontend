# FRT-325 — FE 요청 결과 계측

2026-10-23 승인 범위: 서버만 공식 생성 완료·실패를 발행한다. FE는 요청 결과를 `export_requested`로 기록하고 접수 여부 불명은 `accepted=null`로 보존한다.

## 이번 변경

이력서 생성 모달, 자기소개서 생성, 이력서 재생성의 `export_completed`를 제거한다. 입력 검증을 통과한 클릭과 기존 종류별 속성은 유지한다. 목록 폴링/상태 매퍼, 생성 API, credit 정책, 입력 보존과 멱등키 동작은 변경 범위 밖이다.

| 요청 호출의 결말 | accepted | request_result |
| --- | --- | --- |
| API 정상 반환 (ID 부재 포함) | true | success |
| 2xx 응답 본문 파싱 실패 | true | response_unreadable |
| ApiError 400–599 | false | api_error |
| 자체 타이머에 의한 abort | null | timeout |
| 그 외 abort | null | aborted |
| 네트워크/raw 예외·미지 상태 | null | network_or_unknown |

false는 오류 종료이며 서버 접수 거절이나 생성 실패의 확정이 아니다. 인증 갱신 오류 등 합성 ApiError도 있을 수 있다. 타임아웃/탭 종료/목록 조회 실패도 생성 실패가 아니다. 요청이 settle되기 전에 계정이 바뀌거나 화면이 언마운트되면 해당 화면의 늦은 요청 관측을 억제한다.

호출당 최대 한 번 기록한다. API 반환 뒤 로컬 저장/라우팅/토스트 오류를 요청 실패로 다시 기록하지 않는다. 같은 멱등키로 재시도해도 호출 관측은 여러 번일 수 있으므로 이벤트 수를 고유 생성 작업 수로 사용하지 않는다.

## 서버 의존 및 데이터 이행

- BAC-75: 결과와 성공 상태 DB commit 후 공식 완료, terminal failed 상태 저장 후 공식 실패 발행. FE가 목록 관측으로 이를 복제하지 않는다.
- 서버 event_id/작업/시도/결과 상관키와 dedupe, 내구성 있는 전달, 탭 종료 후 실제 수신·DB 대사는 별도 연동 범위다. 브라우저 멱등키 원문은 analytics로 보내지 않는다.
- 과거 `export_completed`는 요청 성공 관측이었다. 실제 완료 지표와 합산하거나 소급 변환하지 않는다.
- FE 수정 배포부터 BAC-75 운영 수신 검증까지 완료 계측은 미수집/부분 수집이다. 완료 0건 또는 생성 실패로 표시하지 않는다. 서버 출처·schema_version·검증된 coverage로 이후 집계 범위를 구분한다.
- 이력서 목록 유한 폴링은 별도 PR이다. FRT-325 전체 완료는 BAC-75 실제 수신 검증 뒤 판단한다.

## 검증

분류기 경계값과 세 생성 경로 요청 결과, credit early return, 중복 클릭, 입력/멱등키 재시도, 계정 전환, 성공 후 UI 오류에 대한 회귀 테스트. lint/typecheck/unit/build와 export 생성·재생성/진입 Playwright를 실행한다. 스텁/로컬 검증은 실제 서버 전달 또는 운영 PostHog 수신 증거가 아니다.
