# FRT-338 — 타이포 스케일 상향과 긴 글 조판

**작성** 2026-08-31 · **이슈** [FRT-338](https://linear.app/story-arc/issue/FRT-338)
**교정쇄(결정 근거)** https://claude.ai/code/artifact/7a31659f-39dd-40e7-9321-ab24b1d90340

---

## 1. 가능해지는 행동

분석 결과·경험 입력·대시보드 어디서든 **확대 없이 편하게 읽힌다.**
아이폰에서 경험을 기록할 때 **입력칸을 눌러도 화면이 튀지 않는다.**
입력 폼에서 **무엇을 묻는지(라벨)와 무엇을 답했는지(입력값)가 한눈에 갈린다.**

## 2. 무엇이 문제였나

"글씨가 작다"는 지적이 유저테스트마다 반복됐고, 8/23 참가자는 분석 화면에서 "1.25배만 되어도 괜찮겠다"고 구체적으로 짚었다.
착수 전 측정해 보니 **크기는 다섯 원인 중 하나**였다. 나머지 넷은 이슈에 적혀 있지 않았다.

| # | 문제 | 측정값 | 확인 위치 |
|---|---|---|---|
| ① | 본문이 작다 | body 15px · body-sm 13px · caption 12px | `app/globals.css:113-198` |
| ② | 한글이 **어절 중간에서 갈린다** | `word-break: keep-all` 앱 전체 2건(둘 다 랜딩) | 전역 |
| ③ | 장문 본문이 **회색** | `#6b7684` — 흰 배경 대비 **4.6:1** (AA 최저선 4.5) | 214곳 |
| ④ | 호출부의 Tailwind **덮어쓰기가 조용히 죽는다** | `leading-*` 61곳 · 도움말 `text-text-tertiary` 8곳 전부 무효 | 아래 참조 |
| ⑤ | 줄이 길다 | `max-w-4xl`(896px) ÷ 13px ≈ **69자** (한글 적정 40~50) | 분석 상세 |

추가로 발견한 것:

- **가장 긴 글이 가장 작은 크기로 렌더된다.** 종합분석의 짧은 '한눈에 보기'는 `text-body`(15px)인데 긴 '상세 요약'은 `text-body-sm`(13px)이다. — `app/(main)/analysis/comprehensive/[analysisId]/page.tsx:246,255`
- **폼 도움말의 `text-text-tertiary`는 죽은 코드다.** 아카이브 블록 8곳이 `.text-caption`에 `text-text-tertiary`를 덧붙이지만, `.text-caption`이 이미 `color: var(--color-text-secondary)`를 unlayered로 선언해 **덧붙인 색이 적용되지 않는다.** 실제 렌더는 `#6b7684`(4.6:1)다 — 즉 접근성 문제는 없고, **오해를 부르는 코드**가 남아 있는 것이다.
- **입력칸이 iOS에서 화면을 확대시킨다.** iOS Safari는 `input`/`textarea`/`select`의 `font-size`가 16px 미만이면 포커스 순간 자동 확대한다. ARC의 입력값은 `.archive-input-14`로 14px에 묶여 있다.
- **라벨과 입력값의 차이가 1px뿐이다.** 라벨 15px / 입력값 14px. 스케일만 올리면 16 / 16이 되어 **차이가 아예 사라진다.**

### ④의 원인 — 캐스케이드 레이어

빌드된 CSS(`.next/dev/static/chunks/app_globals_*.css`)를 파싱해 확인했다.

```
.text-body { line-height: 1.6 }   → 감싸는 레이어: 없음 (unlayered)
.leading-relaxed { ... }          → 감싸는 레이어: ['utilities']
```

Tailwind v4는 `@layer theme, base, components, utilities;`를 선언하고 유틸리티를 `utilities` 레이어에 넣는다.
CSS 캐스케이드 레이어 규칙상 **unlayered 선언이 layered 선언을 이긴다** — 특이도와 무관하다.

빌드된 CSS를 실제 브라우저에 물려 계산값을 읽어 확인했다.

| 마크업 | 계산된 값 | 판정 |
|---|---|---|
| `text-body` + `leading-relaxed` | `line-height: 24px` (= 15×1.6) | `leading-relaxed` **무효** |
| `text-body-sm` + `leading-relaxed` | `line-height: 20.15px` (= 13×1.55) | **무효** |
| `text-caption` + `text-text-tertiary` | `color: rgb(107,118,132)` | `text-text-tertiary` **무효** |
| `text-text-tertiary` 단독 (대조군) | `color: rgb(176,184,193)` | 정상 적용 |

> **교훈 — 이번 작업의 가장 중요한 발견.**
> `globals.css`의 타이포 클래스는 unlayered라, **그 클래스가 선언한 모든 속성**(`font-size`·`line-height`·`color`)에 대해
> 호출부의 Tailwind 유틸리티를 **조용히 무력화한다.** 에러도 경고도 없다.
> 지금까지 두 종류가 이렇게 죽어 있었다 — `leading-*` 61곳, 도움말 `text-text-tertiary` 8곳.
> **클래스에 속성을 하나 더 박을 때마다, 호출부에서 그 속성을 조절할 자유를 하나씩 뺏는 것이다.**

이 때문에 `.text-caption`의 `color` 선언은 **그대로 둔다.** 지우면 덧붙어 있던 `text-text-tertiary` 8곳이
그제서야 살아나 도움말이 2.0:1로 **더 나빠진다.** 대신 죽은 `text-text-tertiary` 쪽을 지운다.

## 3. 결정

### 3.1 스케일 — B안 (본문 16px, 위계 동반 상향)

| 토큰 | 현재 | 변경 | 비고 |
|---|---:|---:|---|
| `.text-caption` | 12 | **13** | |
| `.text-label` | 13 | **14** | |
| `.text-body-sm` | 13 | **14** | |
| `.text-body` | 15 | **16** | 616곳 — 웹 표준 기준선 |
| `.text-body-lg` | 17 | **18** | |
| `.text-title` | 18 | **20** | |
| `.text-heading-3` | 22 | **24** | |
| `.text-heading-2` | 28 | **30** | |
| `.text-heading-1` | 36 | 36 | 유지 |
| `.text-display` | 48 | 48 | 유지 |
| `.text-field-label` | 15 | **18** | §3.2 |
| `.archive-input-14` 입력값 | 14 | **16** | iOS 자동 확대 해소 |
| `Button` sm/md/lg | 13/15/17 | **14/16/18** | `components/ui/button.tsx:30-32` |
| `Badge` | 12 | **13** | `components/ui/badge.tsx:23` |

**버튼·배지를 함께 올리는 이유** — 이 둘은 `globals.css` 밖에 하드코딩돼 있다. 본문만 16px로 올리면 본문(16) > 기본 버튼(15)이 되어 **위계가 역전**된다.

**하단 3단계가 12/13/15 → 13/14/16으로 벌어진다.** 지금은 3px 안에 세 단계가 몰려 있어 본문·보조·캡션이 눈으로 안 갈렸다.

### 3.2 폼의 네 층

라벨을 **18px**로 정한다. 20px은 쓸 수 없다 — `FormSection.tsx:88`의 섹션 제목(`.text-title`)이 B안에서 20px이 되므로 **필드 라벨이 섹션 제목과 같아져 폼 구조가 무너진다.** 17px은 입력값과 1px 차이라 현재 문제가 그대로 남는다.

| 층 | 클래스 | 크기 | 굵기 | 색 |
|---|---|---:|---:|---|
| 경험 제목 | `.text-heading-3` | 24 | 600 | primary |
| 섹션 제목 | `.text-title` | 20 | 600 | primary |
| **질문(라벨)** | `.text-field-label` | **18** | 600 | primary |
| **답(입력값)** | `.archive-input-14` | **16** | 400 | primary |
| **도움말** | `.text-caption` | 13 | 400 | secondary (이미 그렇게 렌더됨) |

층위는 **크기·굵기·색 세 축**으로 세운다. 라벨과 입력값은 크기(+2px)와 굵기(600 vs 400)로 갈리고, 도움말은 크기(13)와 색(secondary)으로 갈린다.

`.text-field-label`은 공유 `Input`·`Textarea`·`DatePicker`·`PeriodPicker`와 아카이브 블록 **18곳 전부**가 쓰는 단일 클래스라 한 곳만 고치면 된다.

**도움말 색은 바꿀 게 없다** — 이미 `#6b7684`(4.6:1)로 렌더된다. 다만 아카이브 블록 8곳에 붙은 **죽은 `text-text-tertiary`를 지운다.** 남겨두면 "도움말은 tertiary"라는 잘못된 인상을 주고, 훗날 `.text-caption`의 `color`를 건드리는 순간 8곳이 한꺼번에 2.0:1로 무너진다.

`text-text-tertiary`는 앱 전체에 429곳 쓰이지만 나머지는 아이콘·플레이스홀더·비활성 표시라 성격이 다르므로 건드리지 않는다.

### 3.3 모바일 — 큰 제목만 축소

**본문·라벨·캡션은 브레이크포인트로 가르지 않는다.** CSS px는 기준 시청 거리에서의 각크기로 정의된 단위라 폰과 데스크톱에서 체감 크기가 비슷하다. 갈라야 하는 것은 **큰 제목**이다 — 48px 디스플레이는 폰에서 세 줄로 깨진다.

| 토큰 | 데스크톱 | 모바일(`< sm`) |
|---|---:|---:|
| `.text-display` | 48 | **32** |
| `.text-heading-1` | 36 | **28** |
| `.text-heading-2` | 30 | **26** |
| `.text-heading-3` 이하 | — | 분리 없음 |

랜딩이 이미 `sm:text-[38px]` 패턴으로 제목에만 반응형을 쓰고 있다. 같은 방식을 앱 제목으로 넓히는 것뿐이다.

### 3.4 긴 글 조판 — `.text-prose`

장문 전용 클래스 하나를 만들고, **실제로 읽는 자리에만** 적용한다.
214곳을 전수 변경하지 않는다 — `CLAUDE.md`의 "변경 범위 최소화"를 지키기 위해서다.

```css
/* 분석 상세의 서술형 문단 전용. 훑는 글이 아니라 읽는 글에만 쓴다. */
.text-prose {
  font-size: 16px;
  line-height: 1.8;              /* leading-relaxed 가 무효였던 자리를 대신한다 */
  color: var(--color-text-primary);  /* 4.6:1 → 16.6:1 */
  word-break: keep-all;
  overflow-wrap: break-word;
}
```

적용 대상은 종합분석의 '한눈에 보기'·'상세 요약'을 비롯한 서술형 문단이다.
특히 **'상세 요약'은 `text-body-sm`(13px)에서 `.text-prose`(16px)로 올라가며**, 가장 긴 글이 가장 작았던 역전이 해소된다.

### 3.5 전역 — 어절 단위 줄바꿈

```css
body {
  word-break: keep-all;
  overflow-wrap: break-word;
}
```

한글은 브라우저 기본 줄바꿈이 CJK 규칙이라 **어절 중간에서 갈린다**("가독성을" → `가독` / `성을`). 대시보드 배지가 음절 중간에서 갈렸던 사고와 같은 원인이며 범위가 훨씬 넓다.

`overflow-wrap: break-word`가 안전망이다 — 한 낱말이 칸보다 길면(긴 URL 등) 그때만 강제로 자르므로 오버플로가 나지 않는다.

### 3.6 범위에서 뺀 것

**⑤ 줄 길이 제한(`max-width`)은 이번에 하지 않는다.** 크기를 16px로 올리는 것만으로 분석 상세의 줄당 글자 수가 **69자 → 56자**로 줄어 적정선(40~50)에 상당히 가까워진다. 레이아웃을 움직이는 변경은 효과 대비 위험이 크다.

**랜딩(`app/landing/`)의 `text-[Npx]` 임의값 86건은 범위 밖이다.** 마케팅 페이지는 별도 조판을 따른다.

## 4. 위험과 대응

| 위험 | 왜 | 대응 |
|---|---|---|
| **전역 `keep-all`이 레이아웃을 넓힌다** | 좁은 칸에서 줄바꿈 기회가 줄어든다 | `overflow-wrap: break-word` 안전망 + 신규 오버플로 검사(§5.3) |
| **고정 높이 컨테이너가 넘친다** | `h-[44px]` 9곳 · `h-[28px]` 2곳 등 | 신규 오버플로 검사로 확인, 필요 시 `min-h`로 완화 |
| **배지 줄바꿈·`truncate` 파손** | 배지 12→13px, 제목 18→20px | 대시보드 카드 집중 점검 + `ui-preview` (과거 동일 계열 사고 있음) |
| **`leading-*` 죽은 코드 61곳** | 지금도 무효 (랜딩 제외 59곳) | `.text-prose`가 필요한 자리를 대신하고, 분석 화면의 것만 함께 정리 |
| **`.text-field-label` 18px가 좁은 폼에서 넘친다** | 라벨이 길면 두 줄이 된다 | `keep-all`이 함께 들어가므로 어절 단위로 접힌다 |

## 5. 검증

1. **`validate` 4게이트** — lint → typecheck → unit → build
2. **스케일 회귀 테스트(신규)** — `globals.css`를 파싱해 토큰 값을 못 박는 유닛 테스트. 나중에 누가 조용히 줄이면 깨진다
3. **오버플로 검사(신규)** — 스토리북 test-runner의 `postVisit`에 넘침 검사를 더한다. 전역 `keep-all`이 좁은 칸을 넓히는 위험을 자동으로 잡는다
4. **`ui-preview`** — 실제 앱을 사용자가 폰·PC에서 확인
5. **iOS 실기 확인** — 아카이브 입력칸 포커스 시 화면이 확대되지 않는지

> 저장소에는 **비주얼 스냅숏 인프라가 없다.** 스토리북 test-runner(`.storybook/test-runner.ts`)는
> 콘솔 에러와 잡히지 않은 예외만 잡는다. 그래서 레이아웃 위험은 2·3번을 새로 만들어 막는다.

## 6. 정본 파일

- `app/globals.css` — 스케일 정의(113-198) · `.text-prose` 신설 · `body`의 `word-break`
- `components/ui/button.tsx:30-32` — 버튼 3종 크기
- `components/ui/badge.tsx:23` — 배지 크기
- `app/(main)/analysis/comprehensive/[analysisId]/page.tsx` — 서술형 문단에 `.text-prose` 적용
- 아카이브 블록 8곳 — 죽은 `text-text-tertiary` 제거 (색은 이미 secondary)
