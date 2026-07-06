---
name: ui-preview
description: UI를 새로 만들거나 수정한 후, 사용자가 원격(아이패드 등 localhost·로그인 불가 환경)에서 눈으로 확인해야 할 때 사용한다. UI 변경이 있는 PR을 올리기 전에 반드시 실행한다.
---

# UI Preview — 스크린샷 갤러리 발행

로그인 상태의 실제 화면을 **백엔드·실로그인 없이** 렌더해(e2e 인증 스텁 + API mock) 스크린샷을 찍고,
사용자가 링크 하나로 볼 수 있는 갤러리(Artifact)로 발행한다.

## 절차

1. **대상 라우트 선정**: 이번 변경이 영향을 준 라우트·상태를 나열한다.
   빈 상태(empty)나 특수 상태가 핵심 변경이면 그 시나리오도 포함.

2. **프리뷰 스펙 생성**: 이 스킬 디렉토리의 `preview.template.ts`를
   `e2e/preview/preview.spec.ts`로 복사하고 `ROUTES` 배열만 수정한다.
   (`e2e/preview/`는 gitignore — 커밋되지 않으며 CI·`npm run test:e2e`에서도 제외된다.)

3. **캡처 실행**:

   ```bash
   npx playwright install chromium   # 브라우저 없을 때만
   npx playwright test --config playwright.preview.config.ts
   ```

   JPEG가 `e2e/preview/out/<route>--<viewport>.jpg`로 생성된다 (desktop 1440 + mobile 390, fullPage).

4. **갤러리 HTML 조립**: 이미지들을 base64 data URI로 임베드한 단일 HTML을 만든다.
   구성: 상단에 브랜치·커밋·날짜·대상 PR, 라우트별 섹션(데스크톱/모바일 나란히),
   각 이미지에 라우트 경로 캡션. 파일은 세션 tmp 디렉토리에 둔다 (repo에 넣지 않는다).

   ```bash
   base64 -i e2e/preview/out/dashboard--desktop.jpg   # <img src="data:image/jpeg;base64,...">
   ```

5. **Artifact 발행**: Artifact 도구로 발행한다 (favicon "🖼️" 고정, title "ARC UI Preview — <브랜치>").
   같은 브랜치의 재캡처는 같은 파일 경로로 재발행해 URL을 유지한다.

6. **링크 전달**: Artifact URL을 (a) 사용자 보고에, (b) PR 본문 "📷 직접 확인하는 방법" 섹션에 기재한다.

7. **정리**: `e2e/preview/` 산출물은 남겨도 무해(gitignore)하나, 커밋에 섞이지 않는지 `git status`로 확인.

## Before/After 비교가 필요할 때

dev 체크아웃(또는 변경 전 커밋)에서 같은 스펙을 먼저 실행해 `out-before/`에 받아두고,
갤러리에서 라우트별로 before/after를 나란히 배치한다.

## 폴백

- Artifact 도구를 쓸 수 없는 환경이면: 갤러리 HTML 파일 경로를 보고하고,
  스크린샷을 PR에 남기려면 CI e2e 아티팩트 업로드(`e2e.yml` 패턴)를 활용한다.
- private repo는 PR 코멘트에 repo 내 이미지가 렌더되지 않는다(camo 프록시) —
  이미지를 PR 브랜치에 커밋하는 우회는 하지 않는다.

## 주의

- `stubApi(page, { authed: true })`가 로그인 상태를 만든다. 공개 화면(landing 등)은 `authed: false`.
- 애니메이션은 `animations: "disabled"`로 고정 캡처. 폰트/이미지 로딩 대기는 템플릿의 networkidle이 처리.
- 스크린샷 용량: JPEG quality 70 기준 라우트당 100~300KB. 갤러리가 5MB를 넘으면 라우트를 줄이거나 quality를 낮춘다.
