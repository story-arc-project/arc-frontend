---
paths:
  - "e2e/**"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.stories.tsx"
  - "playwright.config.ts"
  - "playwright.preview.config.ts"
  - "vitest.config.*"
  - ".storybook/**"
---

# 테스트 규칙 (정본: docs/frontend-testing.md)

- 전략 매트릭스: 로직·매퍼·방어파싱 = **TDD 의무**(Vitest, RED→GREEN→REFACTOR) ·
  컴포넌트 = Storybook 스토리(`play`) · `(main)` 흐름 = Playwright 스모크/behavior.
- 네이밍으로 러너가 갈린다: 유닛 `*.test.ts(x)` · e2e `*.spec.ts`. 섞지 말 것.
- Vitest는 `globals: false` → 컴포넌트 `.test.tsx`에 수동 `afterEach(cleanup)` 필수
  (testing-library 자동 cleanup 미등록).
- e2e 인증은 런타임 `/auth/me` 스텁(`stubApi(page, { authed: true })`) —
  `NEXT_PUBLIC_E2E_AUTH` 전역 플래그를 켜면 공개 화면(`/landing`)이 깨진다.
- API mock은 `e2e/fixtures/{stub-api,api-data,stateful-store}.ts`를 재사용한다. 새 스텁을 만들기 전에
  기존 핸들(mutations 캡처, scenario "data"/"empty")로 가능한지 확인.
- `e2e/preview/`는 `ui-preview` 스킬 전용 임시 산출물 — 커밋·CI 대상이 아니다(gitignore).
