# FRT-264 Google OAuth URL 공용화

Google authorize URL만 순수 함수로 추출한다. login/signup/탈퇴 재인증이 같은 빌더를 사용한다.
client_id, redirect_uri, response_type=code, scope=openid email profile, access_type=offline, prompt=select_account, state와 인코딩/순서를 보존한다.
state 생성·CSRF 쿠키·콜백·탈퇴 접두사·환경변수 검증·signup 계측과 handoff 정리는 기존 호출부에서 유지한다.
인증/권한 정책, UI 문구/상태/마크업 변경 없음. 실계정 OAuth 승인 없음.
회귀: 순수 URL의 정확한 파라미터/특수문자, 세 호출부의 URL/state/환경변수 누락 동작을 검증한다.
