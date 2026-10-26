# FRT-284 검색 입력 접근 가능한 이름

목적: 아카이브 검색 입력을 값 유무와 무관하게 “경험 검색”으로 식별한다.

기존 admin 검색 패턴에 맞춰 `aria-label="경험 검색"`을 추가한다. 보이는 label은 레이아웃을 바꾸므로 선택하지 않는다. placeholder·검색 정책·정렬·필터 칩은 보존한다. FRT-276은 별도 잔여다.

완료 기준: 빈 값·입력·지우기 뒤 동일한 접근 가능한 이름, 키보드 초점 이동, 기존 검색 결과 유지. FilterBar에는 disabled prop이나 검색 전용 clear 버튼이 없으므로 disabled 검증은 해당 없음이며 기존 필터 초기화와 키보드 지우기를 검증한다.

검증은 Node20 lint/typecheck/unit/build와 Storybook play, API mock 실제 /archive desktop/mobile이다. 실기기 음성·실검색 API·배포는 별도이며 최신 UI 명시 승인 전 머지하지 않는다.
