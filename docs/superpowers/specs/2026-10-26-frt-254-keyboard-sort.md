# FRT-254 키보드 순서 변경

## 목적과 승인된 범위
아카이브 사용자 섹션·loose custom 블록 및 이력서 반복 항목을 키보드로 재정렬한다. 사용자 실행 지시가 기존 dnd-kit KeyboardSensor/sortableKeyboardCoordinates 접근 및 일반 구현 선택을 승인했다.

## 접근과 제약
기존 PointerSensor의 8px 활성화 조건과 onChange/onReorder 저장 계약을 유지하며 KeyboardSensor를 추가한다. 별도 이동 버튼은 불필요한 UI를 추가하고 센서 교체는 포인터 동작을 바꾸므로 채택하지 않는다. 핸들을 activator로 등록해 입력 필드의 Enter/Space와 분리하고 완료·취소 후 초점을 복원한다. 한국어 조작 안내 및 시작·위치·완료·취소 공지를 제공한다. 읽기 전용 및 allowReorder=false는 핸들을 노출하지 않고 내부 정렬 등록도 비활성화한다.

새 의존성·API·저장 정책 변경, block-utils/form-cards 리팩터링은 범위 밖이다. FRT-199는 실물 Safari/Chrome 재현 근거가 없어 미검증으로 남기며 archive touch-none를 추가하지 않는다. UI 동작 변경이므로 최신 PR 사용자 승인 전 머지하지 않는다.

## 중첩 확인
origin/dev ed862c5 기반. 열린 PR323/326/328/333/335에는 직접 파일 중첩이 없다. PR325는 BlockList 표 빈 값 주석 두 줄만 수정하므로 센서·핸들과 독립적이며 해당 주석/표 코드는 보존한다.

## 완료 기준
Space/Enter 시작·완료, 위아래 이동, Escape 취소, 완료/취소 초점, 한국어 공지, readOnly/disabled/nested context 회귀 및 포인터 동작을 검증한다. 실제 경로의 인증/API mock desktop/mobile 검증은 실서버 저장·실기기 음성·운영 배포 증거와 구분한다.
