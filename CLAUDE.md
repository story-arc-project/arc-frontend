# CLAUDE.md — ARC

## 프로젝트

포트폴리오 아카이빙 및 AI 연계 자동화 플랫폼.
정성적 경험 데이터를 수집·연결해 커리어 내러티브를 만들어주는 서비스.
주요 타겟: 진로가 확정되지 않은 대학생.

## 핵심 원칙

- **기록 허들을 낮추는 것이 최우선.** UX 판단 기준은 항상 입력 편의성.
- 이력은 스펙 목록이 아니라 정성적 경험의 총체. 데이터 수집·연결에 집중.
- 안정감을 주는 플랫폼 톤. 위압적이거나 경쟁적인 UI 지양.

## 스택

- Next.js 16.2.1 (App Router)
- TypeScript (strict mode)
- Tailwind CSS

## 폴더 구조

```
app/
├── (auth)/          — 인증 관련 라우트
├── (main)/
│   ├── dashboard/   — 역량 가시화, 퀵 레코딩
│   ├── archive/     — 유형별 경험 입력·관리
│   ├── analysis/    — 키워드 분석, 시각화 리포트
│   ├── strategy/    — 진로 로드맵, 내러티브 구축
│   └── export/      — 이력서·자소서 자동 생성
├── landing/         — 서비스 소개, 플랜 비교
└── layout.tsx
components/
├── ui/              — 범용 UI 컴포넌트
├── layout/          — 레이아웃 관련
└── features/        — 도메인별 컴포넌트 (archive/, analysis/ 등)
lib/                 — 유틸리티, API 클라이언트
hooks/               — 커스텀 훅
types/               — 타입 정의
styles/              — 글로벌 스타일
```

## 명령어

- `npm dev` — 개발 서버
- `npm build` — 프로덕션 빌드
- `eslint` — 린트
- `npm start` — 서버 시작

## 컨벤션

- 컴포넌트: PascalCase (`ArchiveCard.tsx`)
- 함수·변수: camelCase
- 타입·인터페이스: PascalCase, `I` 접두사 없이 사용
- import 순서: react/next → 외부 라이브러리 → `@/lib` → `@/components` → 상대경로
- 컴포넌트 파일 하나에 default export 하나
- 적응형 웹 기준으로 Tailwind 클래스 작성
- 페이지 간 상태는 URL searchParams로 관리, 전역 상태 최소화

## AI 기능 규칙

- AI 호출은 반드시 백엔드 API 엔드포인트로 분리
- 프론트에서는 fetch로 호출만 한다. 프론트에 API 키나 프롬프트 로직 두지 않는다
- 워터마크·Pro 기능은 서버에서 검증 후 적용

## UX Rules
- 입력은 항상 최소 단계로 설계
- optional 입력을 기본값으로 허용
- validation은 느슨하게, 후처리 강화
- 사용자가 생각하지 않도록 자동화 우선

## 금지 사항

- `any` 타입 사용 금지
- `console.log` 커밋 금지
- 인라인 스타일 사용 금지 (Tailwind로 통일)
- 요청하지 않은 리팩토링 금지 — 변경 범위를 최소화할 것
- AI 관련 로직을 프론트엔드에 직접 구현 금지

## 기획 문서

Phase별 기능 상세는 아래 문서를 참조한다.
작업 시작 전 해당 Phase 문서를 확인할 것.

- Phase 1 (대회용 구현): `docs/phase-1.md`
- Phase 1.5 (방향성 제시): `docs/phase-1.5.md`

## Skills

UI·Git 관련 상세 규칙은 Skills로 분리되어 있다.
Claude가 관련 작업을 감지하면 자동으로 로드한다.

|Skill          |자동 로드 조건              |
|---------------|----------------------|
|`ui-guidelines`|컴포넌트, 스타일, 색상, 레이아웃 작업|
|`git-workflow` |브랜치 생성, 커밋, PR, 푸시 작업 |