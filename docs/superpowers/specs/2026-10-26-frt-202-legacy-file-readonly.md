# FRT-202 레거시 첨부 읽기전용 열람

사용자 위임 범위: fileId 없이 fileName/url만 있는 기존 첨부의 readOnly 화면에서 안전한 열람 수단을 제공한다. 일반 구현 판단은 자율, 최신 PR UI에 대한 사용자 승인 전 머지 금지.

기존 isSafeHttpUrl로 HTTP(S) URL을 검증한 후 FileBlock의 기존 pickPreview를 재사용한다. MIME가 있으면 해당 미리보기, 없으면 기존 일반 파일 카드의 링크로 열람한다. filename 확장자만으로 실행 가능한 미디어 타입을 추측하지 않는다. URL-only/name-only/empty/unsafe/error 상태를 구분한다. 이름만 있는 데모 및 빈값 폴백과 편집 화면은 유지한다. fileId 첨부의 TTL 갱신·재시도·재생상태 보존은 변경하지 않는다.

대안: 별도 링크 UI는 중복을 만든다. URL-only를 업로드 상태로 통합하면 편집/TTL 동작이 바뀐다. readOnly 조건만 안전하게 확장하는 방법을 선택한다(구현자 판단).

수정 범위: FileBlock.tsx, FileBlock.test.tsx, FileBlock.stories.tsx, 별도 e2e spec 및 이 문서/계획. block-utils.ts/form-cards.test.ts 및 열린 타 PR 수정 금지. 데이터 삭제/이전, 권한 정책 변경 없음.

검증: MIME별/확장자-only/인코딩/누락/unsafe URL, readOnly 부작용 없음, fileId 회귀. Node20 lint/typecheck/unit/build, Storybook play, 실제 archive 라우트 mock desktop/mobile. mock 결과는 실서버 권한·파일 영구유효성·운영배포 증명이 아니다.
