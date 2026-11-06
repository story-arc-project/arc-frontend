# FRT-240 파일 블록 URL 갱신

사용자 위임 범위: 오래 열린 경험 폼의 파일 링크를 자동 갱신하고 실패하면 명시적으로 재시도할 수 있게 한다. UI 승인은 PR에서 별도로 받는다.

- 기존 FileCellInput 방식(만료 60초 전, 최소 30초, 만료 정보 없으면 5분)을 FileBlock에 적용한다. 백엔드 소스 const DOWNLOAD_EXPIRES_IN=3600, GET /files/{id}/download data는 URL 문자열이다.
- 대안: 클릭할 때만 재조회하면 미리보기 갱신을 놓친다. 공용 훅 추출은 다른 컴포넌트 변경을 늘린다. FileBlock에 한정한 갱신을 선택한다(일반 구현 선택 위임).
- 성공 뒤 한 개 타이머만 예약한다. 실패하면 자동 반복하지 않고 기존 URL을 폐기하고 다운로드 링크 다시 시도 버튼을 제공한다. readOnly에서도 동일하다.
- fileId 변경·삭제·언마운트 때 타이머/늦은 응답을 무효화한다. 오류 상태도 파일 ID별로 격리한다. 업로드 중 다른 필드를 수정해도 최신 값/콜백으로 결과를 반영한다.
- 파일 ID 없는 기존 value/데모 표시를 보존한다. 저장값·보안 URL·파일 데이터·서버 삭제 정책·FRT-202는 변경하지 않는다.
- fake timer 회귀: TTL/fallback/invalid expiration, 실패와 재시도, 성공 오류 해제, 파일 A→B, 삭제, 언마운트, 업로드 동기화. 실제 archive 폼 desktop/mobile API mock 검사와 갤러리, Node20 lint/typecheck/unit/build, Ready PR base dev, 최신 head Codex 요청.
