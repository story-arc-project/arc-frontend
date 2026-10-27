# FRT-84 카드 핵심지표

원본: 정확 FRT-84 a4331e42-f406-4ac8-8350-919f81623603, 댓글0. 최신 dev af7a8c2. 상세 기술 선택 자율 및 독립 구현은 작업 지시로 승인됨.

목적: 제목 바로 아래 유형별 대표 성취 한 줄을 보여 목록에서 기록을 구분한다.

접근: 기존 buildDetailSections → computeFormCards와 equivalentLabels를 재사용한다. 안정키 우선 유형별 대표 필드를 선택하고, 없으면 semantic achievement/role 후보 → summary → 본문 첫 문장 → 입력 유도 순서. 새 라벨 재조립이나 저장 스키마 변경 없음. 직접 computeFormCards 재구현은 레거시/숨김 처리 중복, summary만 유지하면 원본 목적 미충족이므로 제외.

UI: 제목 text-title, 지표 text-body-sm medium/tabular-nums + 작은 brand dot, 메타 text-caption tertiary. 유형/상태는 채움 없는 메타. 한 줄 overflow는 ellipsis; 전체 내용은 상세 선택으로 확인. 기존 선택/더보기/라이브러리 동작 보존.

상태: metric / summary / body / empty / long / retired / unknown; 목록 loading/error는 기존 상위 화면 담당. 최신 SYSTEM_TEMPLATES_V2 전체 및 빈값 폴백, 순수성, hidden/formHidden, 기본값 설정/첨부/URL 제외를 테스트한다. template 개수를 하드코딩하지 않는다.

중첩: PR364 URL/필터 훅 직접파일 중첩0. PR325 block-utils/form-cards 테스트는 수정하지 않고 기존 표시 함수만 소비. PR345 release는 dev→main 비교. PR351/365 머지완료. 기존 입력/데이터 보존.

완료: TDD/Storybook play/목록 browser/Node20.19.2 4gate, 독립 review와 원격 최신head Codex actual 완료, 원격 CI 후 Ready. 최신 PR 사용자 UI 승인 전 머지 금지. 실환경/배포 별도.
