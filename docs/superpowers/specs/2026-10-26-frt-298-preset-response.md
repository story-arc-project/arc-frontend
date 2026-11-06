# FRT-298 프리셋 응답 경계

목적: 서버의 잘못된 프리셋 응답이 TypeError 또는 거짓 성공으로 이어지지 않게 한다.
사용자가 일반 기술 판단과 폴백 선택을 위임했다. 빈 배열 폴백은 캐시 소실처럼 보이고 항목 필터링은 부분 데이터 손실을 숨기므로 채택하지 않는다. 실패는 typed ApiError로 기존 오류/재시도 경로에 전달한다.

정상 envelope의 data만 검사한다. DTO id/name/is_favorite/created_at/updated_at 및 blocks 객체 배열, optional user_id/description을 검사한다. 블록의 종류/내부 필드와 추가 DTO 필드를 제한하거나 복제·정제하지 않는다. 생성/수정 DTO 및 복제 ID도 검증하며 가짜 ID/기본값을 만들지 않는다. 정상 빈 목록은 성공이다. 데모와 HTTP 오류 경로를 보존한다.

백엔드 app/src/api/presets.py 및 models/base.py 확인: list/detail/duplicate 계약 존재, 최신 원격 dev(554d4dde)에도 create/update 라우트 없음. 기존 프론트 요청 경로/메서드는 변경하지 않는다. 실서버 동작을 주장하지 않는다.

현재 production UI에서 usePresets와 PresetManager 연결이 없음을 확인했다. 공개 UI/훅 변경 없이 API/훅 통합 회귀로 기존 캐시와 retry를 검증한다. 오류 표시가 달라지는 경우 실제 화면 확인과 사용자 UI 승인 대상이다.
