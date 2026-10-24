# FRT-346 P0 브라우저 이벤트 대응표

2026-10-24. 기준 dev `0eda1f3`에서 분기. 이 문서의 구현/로컬 검증은 운영 배포·실수신 증거와 다르다. 신계약은 `schema_version=2`, `source=browser`이며 업무 완료의 정본은 서버다.

| 사용자 행동 | 이벤트·구현 위치 | 연결 / 발행 순간 | 경계·운영 증거 |
|---|---|---|---|
| 가입 단계 표시 | `signup_step_viewed`, `app/(auth)/signup/page.tsx` | start/password/verify, step_index; 인증 판정 후 표시된 단계별 1회 | StrictMode 중복 억제. 뒤로가기 후 재진입은 실제 조회. 신규 실수신 미검증 |
| 가입 경로 선택 | 기존 `signup_method_selected`, signup 페이지 | email/google 클릭 | 기존 이벤트 유지 |
| 이메일 인증·최초 소셜 인증 관측 | 기존 `signup_completed`, signup·callback/google 페이지 | 성공 응답 후 사용자 해시 마커 | onboarded=false는 서버 최초가입 증거가 아님. 서버 immutable 가입완료 시각 미확정 |
| 온보딩 단계·이탈 | 기존 `onboarding_step_viewed`, `onboarding_abandoned` | 단계 표시/흐름 종료, step/last_step·경과 | 완료 사용자 stale URL 제외; 기존 FRT-107 재사용 |
| 온보딩 저장 성공 | 기존 `onboarding_completed`, signup 페이지 | 성공 응답 후 즉시 전송(atUnload), 이후 하드 이동 | DUPLICATE_ONBOARDING은 완료 재발행 제외 |
| 유입 UTM | PostHog SDK campaign persistence | SDK `save_campaign_params` 기본 true, capture 시 저장 | 별도 URL 수집기 없음. 설치된 SDK 기준 코드 확인; 실제 OAuth 왕복/수신 검증 필요 |
| 기록 입력 시작 | `archive_entry_started`, archive/new | `entry_attempt_id`, browser/v2 | 새 화면 진입마다 새 시도. 신규 작성만 시작 분모 |
| 초안 재개 | `archive_entry_resumed`, archive/[id]/edit | record_id·entry_attempt_id, 불러온 draft 표시 후 | 완료 기록 편집과 분리 |
| 섹션 완료·이탈 | `archive_section_completed`, `archive_entry_abandoned`, use-archive-entry | 같은 entry_attempt_id, 편집이면 record_id; snapshot/sections/field keys | 저장 대기 중 이탈 중복 억제. 입력 내용 전송 없음 |
| 저장 성공 | 신규 `record_saved`, archive new/edit/list | 성공 응답 뒤 record_id·entry_attempt_id·save_kind·status | new/draft/draft_to_complete/complete_edit/duplicate. 편집 snapshot은 요청 직전, elapsed는 응답 후 |
| 기존 생성 관측 | 기존 `record_created`, archive new/list | 기존 신규/복제 경로 유지 | legacy 이벤트를 서버 완료나 사용자 최초완료로 재해석하지 않음 |
| 사용자 최초 완료 | 기존 `first_record_created` 브라우저 추정 발화 중단 | total count와 localStorage로 최초완료를 확정하지 않음 | BAC-75/81의 서버 최초완료 사실·unique 계약 필요. 초안/수정 저장으로 activation을 만들지 않음 |
| 결과 본문 조회 | 신규 `analysis_result_viewed`, use-analysis-viewed | ready + foreground 표시, analysis_id/type·view_id·viewed_at | 본문 loadedId와 route id 일치 확인. result_version 없는 API에서 값을 만들지 않음 |
| 결과 체류 종료 | 기존 `analysis_viewed`, use-analysis-viewed | 기존 체류 의미 유지 | 신규 조회 시작과 혼합 집계 금지 |
| 북마크 성공 | 신규 `analysis_bookmark_changed`, BookmarkToggle | 성공 응답 뒤 analysis_id, action(added/removed), is_bookmarked; 같은 화면에서 시작한 요청이면 view_id/type 연결 | 목록 북마크는 조회 ID 없음. 실패·이전 계정/경로 응답 제외; 서버 append-only 이력과는 다름 |
| 긍정 피드백 | FRT-106/BAC-39 의존 | 기존 캠페인 feedback_submitted는 결과별 up 반응이 아님 | 2026-10-24 Linear FRT-106은 Todo, BAC-75는 Backlog로 확인. 캠페인 transport는 analysis_id를 분석에 싣지 않는 계약. 해당 제한 유지; 새 반응 API/가짜 성공 이벤트 없음 |
| 엑스포트 | FRT-325 기존 export_requested | 이번 변경에서 재구현하지 않음 | 완료/실패 정본은 서버 |

## 프로필 속성 계약

현재 로컬 FE 가입 폼은 school/department를 optional 문자열, interest를 관리된 선택지 배열로 보낸다. BE `app/src/db/models.py:UserProfile`와 `app/src/api/auth.py`의 온보딩·프로필 갱신·조회에 저장 경로가 있다. 학교·전공은 자유 입력이므로 관리된 세그먼트 코드로 확정하지 않는다. 사용자 미입력을 허용하고 임의 추론·원문 person 속성 전송을 추가하지 않는다. 학년 전용 필드는 없으므로 `not_collected`; 신규 폼/DB 마이그레이션은 제외한다. 로컬 BE 모델 확인은 실제 배포 OpenAPI/DB 확인과 다르다.

## 식별·내부/데모·동시 탭

- 식별: 기존 이메일 정규화 SHA-256 distinct_id, 익명→identify 흐름 유지. reset/계정 변경의 epoch가 이전 요청 응답의 새 계정 귀속을 차단한다.
- 로그아웃: FRT-330의 `flushExitSignals → resetUser` 유지. 기존 client/AuthContext 테스트 재사용.
- 데모: capture는 `isDemoMode()`이면 no-op, 북마크 UI는 demo에서 숨김. SDK 미초기화도 no-op.
- 내부 계정: 서버 admin 판정의 `$internal_or_test_user` person 표식 유지. 전송 차단이 아니라 프로젝트 필터로 제외하는 구조. 배포 환경의 필터 설정/익명 pre-identify 포함 여부는 이번 로컬 검증으로 보장하지 않는다.
- 가입 마커: 지원되는 secure context에서 Web Locks로 같은 origin/브라우저 탭의 읽기→쓰기를 직렬화. 미지원/권한·storage 오류는 기존 best-effort로 degrade. 기기 간·storage 삭제·서버 lifetime once 보장은 아님.
- 작성 시도와 조회 ID는 탭/화면별 관측 ID이며 서버 idempotency key로 사용하지 않는다. 여러 탭의 실제 조회를 합쳐 한 번이라고 주장하지 않는다.

## 검증 증거

- 변경 전 baseline: client/use-archive-entry 37 tests pass.
- 기록 작업: 최종 56 focused tests pass, typecheck/targeted lint pass. 별도 리뷰가 발견한 A→B→A 저장 응답과 초안 재개 관측 경계는 회귀 테스트와 함께 수정했고 재리뷰를 통과했다.
- 가입 작업: 47 focused tests pass. Web Locks 부재/거절 fallback, 동일 사용자 승자 1회, 온보딩 완료 즉시 전송, 복원 URL 허위 시작 방지 포함.
- 결과 조회/북마크 작업: 63 focused tests pass, typecheck/targeted lint pass. 초기 인증 식별과 화면 마운트 순서 문제를 실제 AuthProvider 통합 회귀 테스트로 수정했고 재리뷰를 통과했다(관련 45 tests pass).
- Playwright Chromium 스텁 API 스모크: 기록 CRUD, 신규/편집 직접 진입, 개별/종합 북마크 왕복 5/5 pass (격리 3146 포트). 운영 로그인이나 실제 PostHog 수신 검증이 아니다.
- 최종 브랜치 리뷰: spec PASS / quality PASS. 마지막 수정은 draft resume을 record ID 대신 entry_attempt_id로 중복 억제한다.
- 최종 코드 `a3d3ca8`, Node 20.19.2: lint PASS, typecheck PASS, test:unit 189 files / 3,318 tests PASS, production build PASS (exit 0).
- 운영 배포 SHA, 실제 로그인 수신 payload, PostHog 내부/데모 제외 쿼리, 서버 최초 완료 대사는 미검증이다. 신규 이벤트의 운영 수신 및 FRT-346 전체 Done을 주장하지 않는다.
