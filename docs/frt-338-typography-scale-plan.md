# FRT-338 타이포 스케일 상향 구현 계획

> **에이전트 작업자에게:** 필수 하위 스킬 — `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`로 태스크 단위 실행. 체크박스(`- [ ]`)로 진행을 추적한다.

**목표:** 화면 글씨를 한 단계 키우고, 긴 글이 실제로 읽히도록 조판을 함께 바로잡는다.

**접근:** `app/globals.css`의 unlayered 타이포 클래스가 앱 전체의 정본이라 값 변경 비용이 작다. 다만 버튼·배지는 그 밖에 하드코딩돼 있어 함께 올려야 위계가 안 뒤집힌다. 레이아웃 파손 위험은 **먼저 안전망(오버플로 검사)을 만든 뒤** 값을 바꾸는 순서로 막는다.

**기술 스택:** Next.js(App Router) · TypeScript(strict) · Tailwind CSS v4 · Vitest + Testing Library · Storybook test-runner(Playwright)

**스펙:** `docs/frt-338-typography-scale-design.md`

## 전역 제약

- `any` 금지 · 요청하지 않은 리팩토링 금지 · 변경 범위 최소화 (`CLAUDE.md`)
- Tailwind only, inline style 금지
- `console.log` 금지 — ESLint `no-console`이 강제
- 유닛 테스트는 `globals: false` — `describe`/`it`/`expect`/`vi`를 **명시 import**하고, 컴포넌트 테스트는 `afterEach(cleanup)`을 **수동 등록**한다
- 브랜치 `feat/frt-338-typography-scale` (base `dev`) · main/dev 직접 커밋 금지
- **랜딩(`app/landing/`)은 범위 밖** — `text-[Npx]` 임의값 86건을 건드리지 않는다
- **`.text-caption`의 `color` 선언을 지우지 않는다** — 지우면 덧붙은 `text-text-tertiary` 8곳이 살아나 도움말이 2.0:1로 나빠진다

---

### Task 1: 오버플로 검사 안전망 (값 변경 전에 먼저 세운다)

전역 `word-break: keep-all`은 좁은 칸의 줄바꿈 기회를 줄여 레이아웃을 넓힐 수 있고, 글자를 키우면 `h-[44px]` 같은 고정 높이가 넘칠 수 있다. 저장소에는 비주얼 스냅숏 인프라가 없으므로 **넘침을 검사하는 게이트를 직접 만든다.** 값을 바꾸기 전에 만들어 현재 코드에서 통과함을 확인해야, 이후 실패가 이번 변경 탓임이 분명해진다.

**Files:**
- Modify: `.storybook/test-runner.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `npm run test-storybook:ci`가 가로 넘침을 실패로 처리한다. Task 8이 이 게이트를 다시 돌린다.

- [ ] **Step 1: 현재 코드에서 스토리북 게이트가 통과하는지 먼저 확인한다**

```bash
npm run test-storybook:ci
```

기대: PASS. 여기서 실패하면 **이번 작업과 무관한 기존 문제**이므로, 고치지 말고 사용자에게 보고하고 멈춘다.

- [ ] **Step 2: `postVisit`에 넘침 검사를 더한다**

`.storybook/test-runner.ts`의 `postVisit`에서 기존 pageerror 검사 **뒤에** 이어 붙인다.

```ts
    // FRT-338: 글자를 키우고 전역 word-break: keep-all 을 걸면 좁은 칸이 넓어지거나
    // 고정 높이 컨테이너가 넘칠 수 있다. 저장소에 비주얼 스냅숏이 없으므로 넘침만 직접 잰다.
    // 가로 넘침만 본다 — 세로는 스크롤이 정상인 자리가 많아 오탐이 크다.
    const overflows = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        const style = getComputedStyle(el);
        // 스스로 스크롤/숨김을 처리하는 요소는 넘쳐도 정상이다.
        if (style.overflowX !== "visible") continue;
        if (el.scrollWidth > el.clientWidth + 1) {
          const id = el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(/\s+/).join(".") : "");
          bad.push(`${id} (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`);
        }
      }
      return bad.slice(0, 10);
    });
    if (overflows.length > 0) {
      throw new Error(
        `"${context.title} / ${context.name}" 스토리에서 가로 넘침 ${overflows.length}건:\n${overflows.join("\n")}`,
      );
    }
```

- [ ] **Step 3: 검사가 현재 코드에서도 통과하는지 확인한다 (기준선)**

```bash
npm run test-storybook:ci
```

기대: PASS.

**실패하면** — 이번 변경 이전부터 넘치던 자리다. 값을 바꾸기 전에 드러난 것이므로 **고치지 말고**, 넘친 스토리 이름을 기록한 뒤 그 스토리를 검사에서 제외하는 대신 사용자에게 보고한다. 기준선이 빨간 상태로는 이 게이트가 쓸모없다.

- [ ] **Step 4: 커밋**

```bash
git add .storybook/test-runner.ts
git commit -m "✅ [Storybook] 스토리에서 가로 넘침을 실패로 잡는다 (FRT-338 안전망)"
```

---

### Task 2: 스케일 값 상향 + 회귀 테스트

`globals.css`의 값은 앱 전체가 의존하는 인터페이스인데 지금은 아무도 지키지 않는다. 나중에 누가 조용히 줄이지 못하도록 **파일을 파싱해 값을 못 박는 테스트**를 함께 만든다.

**Files:**
- Create: `app/globals.typography.test.ts`
- Modify: `app/globals.css` (114-201행 구간의 `font-size` 값)

**Interfaces:**
- Consumes: 없음
- Produces: `readTypographyScale()` — `globals.css`를 읽어 `{ [클래스명]: { fontSize, lineHeight } }`를 돌려주는 테스트 헬퍼. Task 4·5가 같은 파일에 테스트를 덧붙인다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`app/globals.typography.test.ts` 생성:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * globals.css 의 타이포 스케일은 앱 전체(text-body 616곳 등)가 의존하는 인터페이스다.
 * 값이 조용히 되돌아가는 것을 막으려고 파일을 직접 파싱해 못 박는다.
 * jsdom 은 외부 CSS 를 적용하지 않아 getComputedStyle 로는 잴 수 없다.
 */
const CSS = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf-8",
);

/** `.text-body { ... }` 블록에서 한 속성의 값을 뽑는다. */
export function readRule(selector: string, prop: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(CSS);
  if (!block) return undefined;
  const found = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(block[1]);
  return found?.[1].trim();
}

describe("타이포 스케일 (globals.css)", () => {
  it.each([
    [".text-caption", "13px"],
    [".text-label", "14px"],
    [".text-body-sm", "14px"],
    [".text-body", "16px"],
    [".text-body-lg", "18px"],
    [".text-title", "20px"],
    [".text-heading-3", "24px"],
    [".text-heading-2", "30px"],
    [".text-heading-1", "36px"],
    [".text-display", "48px"],
  ])("%s 의 font-size 는 %s 다", (selector, expected) => {
    expect(readRule(selector, "font-size")).toBe(expected);
  });

  it("필드 라벨은 18px — 입력값(16px)보다 2px 크고 섹션 제목(20px)보다 작아야 층위가 선다", () => {
    expect(readRule(".text-field-label", "font-size")).toBe("18px");
  });

  it("하단 세 단계가 3px 안에 몰리지 않는다 — caption < body-sm < body", () => {
    const px = (s: string) => Number.parseInt(readRule(s, "font-size") ?? "0", 10);

    expect(px(".text-caption")).toBeLessThan(px(".text-body-sm"));
    expect(px(".text-body-sm")).toBeLessThan(px(".text-body"));
    expect(px(".text-body") - px(".text-caption")).toBeGreaterThanOrEqual(3);
  });

  it("아카이브 입력값은 16px — iOS Safari 는 16px 미만이면 포커스 시 화면을 확대한다", () => {
    // .archive-input-14 래퍼가 하위 input/textarea/select 를 눌러쓰는 규칙.
    const rule = /\.archive-input-14 input:not\(\.text-title\)[^{]*\{([^}]*)\}/.exec(CSS);

    expect(rule?.[1]).toContain("font-size: 16px");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run app/globals.typography.test.ts
```

기대: FAIL — `.text-caption`이 `12px`, `.text-body`가 `15px` 등으로 나온다.

- [ ] **Step 3: `app/globals.css` 값을 바꾼다**

각 블록의 `font-size`만 바꾼다. `line-height`·`font-weight`·`letter-spacing`은 **건드리지 않는다.**

| 행 | 선택자 | 현재 | 변경 |
|---:|---|---:|---:|
| 129 | `.text-heading-2` | `28px` | `30px` |
| 136 | `.text-heading-3` | `22px` | `24px` |
| 142 | `.text-title` | `18px` | `20px` |
| 148 | `.text-body-lg` | `17px` | `18px` |
| 154 | `.text-body` | `15px` | `16px` |
| 160 | `.text-body-sm` | `13px` | `14px` |
| 166 | `.text-caption` | `12px` | `13px` |
| 173 | `.text-label` | `13px` | `14px` |
| 179 | `.text-field-label` | `15px` | `18px` |
| 192 | `.archive-input-14 …` | `14px` | `16px` |

`.text-display`(48px)·`.text-heading-1`(36px)·`body`(16px)와 199행의 다이얼로그 되돌림 규칙(`13px`)은 **그대로 둔다.**

`.text-field-label` 위에 주석을 남긴다:

```css
/* 폼의 질문(라벨)과 답(입력값)을 갈라 세운다 — 크기 18 vs 16, 굵기 600 vs 400.
   20px 은 쓸 수 없다: 섹션 제목(.text-title)이 20px 이라 필드 라벨과 같아진다. */
```

192행 규칙에도 이유를 남긴다:

```css
/* 16px 미만이면 iOS Safari 가 포커스 순간 화면을 확대한다 — 기록할 때마다 화면이 튀었다.
   클래스 이름의 "14" 는 FRT-146 당시 값에서 온 역사적 흔적이다. */
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run app/globals.typography.test.ts
```

기대: PASS (14개 케이스 전부).

- [ ] **Step 5: 커밋**

```bash
git add app/globals.css app/globals.typography.test.ts
git commit -m "✨ [Typography] 본문을 16px 로 올리고 스케일을 값으로 못 박는다 (FRT-338)"
```

---

### Task 3: 버튼·배지 크기 — 위계 역전 막기

버튼·배지는 `globals.css` 밖에 하드코딩돼 있다. Task 2만 하고 멈추면 본문 16px > 기본 버튼 15px이 되어 **위계가 역전된다.**

**Files:**
- Modify: `components/ui/button.tsx:30-32`
- Modify: `components/ui/badge.tsx:23`
- Create: `components/ui/button.size.test.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`components/ui/button.size.test.tsx` 생성:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Button } from "./button";
import { Badge } from "./badge";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

describe("컨트롤 크기 위계 (FRT-338)", () => {
  it.each([
    ["sm", "text-[14px]"],
    ["md", "text-[16px]"],
    ["lg", "text-[18px]"],
  ] as const)("버튼 %s 는 %s 다", (size, expected) => {
    render(<Button size={size}>저장하기</Button>);

    expect(screen.getByRole("button")).toHaveClass(expected);
  });

  it("기본 버튼(md)이 본문(16px)보다 작지 않다 — 작으면 위계가 역전된다", () => {
    render(<Button size="md">저장하기</Button>);

    const cls = screen.getByRole("button").className;
    const px = Number.parseInt(/text-\[(\d+)px\]/.exec(cls)?.[1] ?? "0", 10);

    expect(px).toBeGreaterThanOrEqual(16);
  });

  it("배지는 13px — 본문보다 작되 캡션과 같은 눈금에 선다", () => {
    render(<Badge variant="brand">동아리 · 학회</Badge>);

    expect(screen.getByText("동아리 · 학회")).toHaveClass("text-[13px]");
  });
});
```

`Button`·`Badge`의 실제 export 형태(default / named)를 먼저 확인하고 import를 맞춘다.

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run components/ui/button.size.test.tsx
```

기대: FAIL — 현재 `text-[13px]` / `text-[15px]` / `text-[17px]` / 배지 `text-[12px]`.

- [ ] **Step 3: 값을 바꾼다**

`components/ui/button.tsx:30-32`:

```ts
  sm: "h-9 px-4 text-[14px] font-medium rounded-sm",
  md: "h-11 px-5 text-[16px] font-semibold rounded-md",
  lg: "h-14 px-6 text-[18px] font-semibold rounded-lg",
```

`components/ui/badge.tsx:23`:

```ts
        "text-[13px] font-medium leading-none",
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run components/ui/button.size.test.tsx
```

기대: PASS (5개 케이스).

- [ ] **Step 5: 커밋**

```bash
git add components/ui/button.tsx components/ui/badge.tsx components/ui/button.size.test.tsx
git commit -m "✨ [Typography] 버튼·배지를 함께 올려 위계 역전을 막는다 (FRT-338)"
```

---

### Task 4: 큰 제목만 모바일 축소

본문·라벨·캡션은 폰과 PC가 같은 값이다. 48px 디스플레이만 폰에서 깨지므로 큰 제목 셋만 가른다.

**Files:**
- Modify: `app/globals.css` (`.text-display`/`.text-heading-1`/`.text-heading-2` 정의 **뒤**)
- Modify: `app/globals.typography.test.ts`

**Interfaces:**
- Consumes: Task 2의 `readRule()` — 이번엔 미디어쿼리 안을 봐야 하므로 별도 헬퍼를 더한다
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`app/globals.typography.test.ts` 끝에 덧붙인다:

```ts
describe("모바일 제목 축소 (FRT-338)", () => {
  /** `@media (max-width: 639px) { ... }` 블록 전체를 뽑는다. */
  const mobileBlock = /@media \(max-width: 639px\) \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";

  it.each([
    [".text-display", "32px"],
    [".text-heading-1", "28px"],
    [".text-heading-2", "26px"],
  ])("폰에서 %s 는 %s 로 줄어든다", (selector, expected) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(mobileBlock);

    expect(rule?.[1]).toContain(`font-size: ${expected}`);
  });

  it("본문·라벨·캡션은 브레이크포인트로 가르지 않는다 — 폰과 PC 가 같은 크기다", () => {
    for (const selector of [".text-body", ".text-body-sm", ".text-caption", ".text-label", ".text-field-label"]) {
      expect(mobileBlock).not.toContain(selector);
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run app/globals.typography.test.ts
```

기대: FAIL — 미디어쿼리 블록이 없어 `mobileBlock`이 빈 문자열이다.

- [ ] **Step 3: 미디어쿼리를 더한다**

`.text-field-label` 정의 **뒤**, `.archive-input-14` 규칙 **앞**에 넣는다.

```css
/* 큰 제목만 폰에서 줄인다. 48px 디스플레이는 데스크톱에선 시원하지만 폰에선 세 줄로 깨진다.
   본문·라벨·캡션은 가르지 않는다 — CSS px 는 기준 시청 거리에서의 각크기로 정의된 단위라
   폰과 데스크톱의 체감 크기가 비슷하다. 랜딩이 이미 쓰는 sm:text-[Npx] 패턴과 같은 방식이다.
   Tailwind 의 sm 브레이크포인트(640px) 아래를 폰으로 본다. */
@media (max-width: 639px) {
  .text-display {
    font-size: 32px;
  }

  .text-heading-1 {
    font-size: 28px;
  }

  .text-heading-2 {
    font-size: 26px;
  }
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run app/globals.typography.test.ts
```

기대: PASS (4개 케이스 추가, 총 18개).

- [ ] **Step 5: 커밋**

```bash
git add app/globals.css app/globals.typography.test.ts
git commit -m "✨ [Typography] 폰에서 큰 제목만 줄인다 — 본문은 PC 와 같은 크기로 (FRT-338)"
```

---

### Task 5: `.text-prose` 신설 + 전역 어절 단위 줄바꿈

긴 글의 조판을 한 클래스로 모은다. 214곳을 전수 변경하지 않고 **읽는 자리에만** 쓴다. 그리고 한글이 어절 중간에서 갈리는 문제를 전역에서 막는다.

**Files:**
- Modify: `app/globals.css` (`body` 규칙 · `.text-caption` 뒤에 `.text-prose` 신설)
- Modify: `app/globals.typography.test.ts`

**Interfaces:**
- Consumes: Task 2의 `readRule()`
- Produces: `.text-prose` — Task 6이 이 클래스를 호출부에 붙인다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`app/globals.typography.test.ts` 끝에 덧붙인다:

```ts
describe("긴 글 조판 (FRT-338)", () => {
  it("한글이 어절 중간에서 갈리지 않도록 전역에서 막는다", () => {
    expect(readRule("body", "word-break")).toBe("keep-all");
  });

  it("긴 낱말은 여전히 잘린다 — keep-all 만 걸면 URL 이 칸을 넘긴다", () => {
    expect(readRule("body", "overflow-wrap")).toBe("break-word");
  });

  it.each([
    ["font-size", "16px"],
    ["line-height", "1.8"],
    ["word-break", "keep-all"],
    ["overflow-wrap", "break-word"],
  ])(".text-prose 의 %s 는 %s 다", (prop, expected) => {
    expect(readRule(".text-prose", prop)).toBe(expected);
  });

  it(".text-prose 는 본문색을 스스로 정한다 — 장문을 회색으로 두지 않는다", () => {
    expect(readRule(".text-prose", "color")).toBe("var(--color-text-primary)");
  });

  it(".text-prose 의 행간이 본문보다 넉넉하다 — 훑는 글과 읽는 글은 다르다", () => {
    const prose = Number.parseFloat(readRule(".text-prose", "line-height") ?? "0");
    const body = Number.parseFloat(readRule(".text-body", "line-height") ?? "0");

    expect(prose).toBeGreaterThan(body);
  });

  it(".text-caption 은 색 선언을 유지한다 — 지우면 덧붙은 tertiary 8곳이 살아나 2.0:1 로 나빠진다", () => {
    expect(readRule(".text-caption", "color")).toBe("var(--color-text-secondary)");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run app/globals.typography.test.ts
```

기대: FAIL — `body`에 `word-break`가 없고 `.text-prose`가 정의되지 않았다.

- [ ] **Step 3: `body`에 줄바꿈 규칙을 더한다**

`app/globals.css`의 `body { ... }`(104행) 안에 두 줄을 더한다.

```css
  /* 한글은 브라우저 기본 줄바꿈이 CJK 규칙이라 어절 중간에서 갈린다("가독성을" → "가독"/"성을").
     keep-all 로 낱말을 통째로 넘기되, 한 낱말이 칸보다 길면(긴 URL 등) break-word 가 잘라 준다.
     둘을 함께 걸어야 넘침 없이 어절이 지켜진다. */
  word-break: keep-all;
  overflow-wrap: break-word;
```

- [ ] **Step 4: `.text-prose`를 신설한다**

`.text-caption` 정의 **뒤**에 넣는다.

```css
/* 긴 서술형 문단 전용 — 훑는 글이 아니라 '읽는' 글에만 쓴다.
   .text-body 와 나누는 이유: 본문 616곳을 전부 이 조판으로 바꿀 수는 없다(카드·목록엔 과하다).
   line-height 를 여기 두는 것은 의도적이다 — 호출부의 leading-* 는 unlayered 규칙에 막혀
   어차피 무효였다(FRT-338 에서 61곳이 그렇게 죽어 있었다). 조판을 클래스가 책임진다. */
.text-prose {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.8;
  color: var(--color-text-primary);
  word-break: keep-all;
  overflow-wrap: break-word;
}
```

- [ ] **Step 5: 통과를 확인한다**

```bash
npx vitest run app/globals.typography.test.ts
```

기대: PASS (9개 케이스 추가, 총 27개).

- [ ] **Step 6: 커밋**

```bash
git add app/globals.css app/globals.typography.test.ts
git commit -m "✨ [Typography] 긴 글 조판을 .text-prose 로 모으고 어절 단위 줄바꿈을 전역에 건다 (FRT-338)"
```

---

### Task 6: 분석 상세에 `.text-prose` 적용

가장 긴 글('상세 요약')이 가장 작은 크기(13px)로 렌더되던 역전을 해소한다. 무효였던 `leading-relaxed`도 이 자리에서 함께 걷어낸다.

**Files:**
- Modify: `app/(main)/analysis/comprehensive/[analysisId]/page.tsx:238-262` (`SummaryBlock`)
- Modify: `app/(main)/analysis/comprehensive/[analysisId]/page.test.tsx`

**Interfaces:**
- Consumes: Task 5의 `.text-prose`
- Produces: 없음

- [ ] **Step 1: 기존 테스트 파일의 렌더 방식을 먼저 읽는다**

```bash
sed -n '1,60p' "app/(main)/analysis/comprehensive/[analysisId]/page.test.tsx"
```

이 파일이 이미 쓰는 목킹·렌더 헬퍼를 그대로 재사용한다. **새 렌더 방식을 발명하지 않는다.**

- [ ] **Step 2: 실패하는 테스트를 쓴다**

기존 `page.test.tsx`에 덧붙인다. `briefSummary`/`detailedSummary`를 채운 픽스처로 렌더한 뒤:

```tsx
  it("긴 요약을 .text-prose 로 조판한다 — 가장 긴 글이 가장 작게 렌더되던 역전을 없앤다", async () => {
    // (이 파일이 이미 쓰는 목킹·렌더 헬퍼로 briefSummary/detailedSummary 를 채워 렌더한다)
    const detailed = await screen.findByText(/스스로 분류 축을 세운/);

    expect(detailed).toHaveClass("text-prose");
    expect(detailed).not.toHaveClass("text-body-sm");
  });

  it("짧은 요약도 같은 조판을 쓴다 — 둘 다 '읽는' 글이다", async () => {
    const brief = await screen.findByText(/하나의 기준으로 묶은/);

    expect(brief).toHaveClass("text-prose");
  });

  it("무효였던 leading-relaxed 를 남겨두지 않는다 — 조판은 .text-prose 가 책임진다", async () => {
    const detailed = await screen.findByText(/스스로 분류 축을 세운/);

    expect(detailed).not.toHaveClass("leading-relaxed");
  });
```

픽스처 문구는 위 정규식과 맞아야 한다. 기존 픽스처에 요약 문구가 없다면 이 테스트용으로 채운다.

- [ ] **Step 3: 실패를 확인한다**

```bash
npx vitest run "app/(main)/analysis/comprehensive/[analysisId]/page.test.tsx"
```

기대: FAIL — 현재 클래스가 `text-body-sm text-text-secondary leading-relaxed`다.

- [ ] **Step 4: `SummaryBlock`을 고친다**

`app/(main)/analysis/comprehensive/[analysisId]/page.tsx`의 두 `<p>`를 바꾼다.

```tsx
function SummaryBlock({ brief, detailed }: { brief: string; detailed: string }) {
  if (!brief && !detailed) return null;
  return (
    <section className="space-y-4">
      {brief && (
        <div className="space-y-2">
          <h2 className="text-title text-text-primary">한눈에 보기</h2>
          <div className="bg-surface-secondary rounded-lg p-4">
            {/* FRT-338: 훑는 글이 아니라 읽는 글이다 — 크기·행간·색·줄바꿈을 .text-prose 가 함께 책임진다.
                이전의 leading-relaxed 는 .text-body 가 unlayered 라 애초에 무효였다. */}
            <p className="text-prose whitespace-pre-line">{brief}</p>
          </div>
        </div>
      )}
      {detailed && (
        <div className="space-y-2">
          <h2 className="text-title text-text-primary">상세 요약</h2>
          {/* FRT-338: 가장 긴 글이 가장 작은 크기(text-body-sm 13px)로 렌더되던 역전을 없앤다. */}
          <p className="text-prose whitespace-pre-line">{detailed}</p>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: 통과를 확인한다**

```bash
npx vitest run "app/(main)/analysis/comprehensive/[analysisId]/page.test.tsx"
```

기대: PASS.

- [ ] **Step 6: 커밋**

```bash
git add "app/(main)/analysis/comprehensive/[analysisId]/page.tsx" "app/(main)/analysis/comprehensive/[analysisId]/page.test.tsx"
git commit -m "✨ [Analysis] 가장 긴 요약을 가장 작게 보여주던 역전을 없앤다 (FRT-338)"
```

---

### Task 7: 죽은 `text-text-tertiary` 8곳 제거

이 8곳은 색을 바꾸지 않는다 — `.text-caption`의 unlayered `color`에 막혀 이미 무효다. 지우는 이유는 **오해를 없애기 위해서**다. 남겨두면 "도움말은 tertiary"라는 잘못된 인상을 주고, 훗날 `.text-caption`의 `color`를 건드리는 순간 8곳이 한꺼번에 2.0:1로 무너진다.

**Files:**
- Modify: `components/features/archive/blocks/MoodTagBlock.tsx:85`
- Modify: `components/features/archive/blocks/BinaryChoiceBlock.tsx:55`
- Modify: `components/features/archive/blocks/RoleHistoryBlock.tsx:191`
- Modify: `components/features/archive/blocks/OutcomeList.tsx:280`
- Modify: `components/features/archive/blocks/RepeatableCellBlock.tsx:304`
- Modify: `components/features/archive/blocks/SingleSelectBlock.tsx:185`
- Modify: `components/features/archive/blocks/FileBlock.tsx:225`
- Modify: `components/features/archive/blocks/TagsBlock.tsx:66`
- Create: `components/features/archive/blocks/guide-color.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`components/features/archive/blocks/guide-color.test.ts` 생성:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * FRT-338: 도움말에 붙은 text-text-tertiary 는 색을 바꾸지 못한다.
 * .text-caption 이 color 를 unlayered 로 선언해 layered 유틸리티를 이기기 때문이다
 * (빌드 CSS 실측: text-caption + text-text-tertiary → rgb(107,118,132)).
 * 무효인 채 남겨두면 .text-caption 의 color 를 건드리는 순간 한꺼번에 2.0:1 로 무너진다.
 */
const DIR = fileURLToPath(new URL(".", import.meta.url));

describe("도움말 색 (아카이브 블록)", () => {
  const files = readdirSync(DIR).filter(
    (f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx") && !f.endsWith(".stories.tsx"),
  );

  it.each(files)("%s 는 text-caption 에 죽은 text-text-tertiary 를 덧붙이지 않는다", (file) => {
    const src = readFileSync(join(DIR, file), "utf-8");
    const offenders = src
      .split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /text-caption[^"'`]*text-text-tertiary/.test(line));

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run components/features/archive/blocks/guide-color.test.ts
```

기대: FAIL — 8개 파일이 걸린다.

- [ ] **Step 3: 8곳에서 `text-text-tertiary`만 지운다**

각 파일에서 `className`의 `text-text-tertiary` **토큰 하나만** 빼고 나머지 클래스(`text-caption`, `mb-1`, `-mt-2` 등)는 **그대로 둔다.**

예 — `BinaryChoiceBlock.tsx:55`:

```tsx
{block.guide && <p className="text-caption">{block.guide}</p>}
```

예 — `FileBlock.tsx:225` (여백 클래스 유지):

```tsx
{block.guide && <p className="text-caption -mt-2">{block.guide}</p>}
```

예 — `MoodTagBlock.tsx:85`:

```tsx
{block.guide && <p className="text-caption mb-1">{block.guide}</p>}
```

`.text-caption`이 이미 `color: var(--color-text-secondary)`를 주므로 **렌더 결과는 바뀌지 않는다.** 이 태스크는 순수한 죽은 코드 제거다.

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run components/features/archive/blocks/guide-color.test.ts
```

기대: PASS.

- [ ] **Step 5: 렌더 결과가 안 바뀌었는지 확인한다**

```bash
npx vitest run components/features/archive
```

기대: PASS — 기존 블록 테스트가 하나도 깨지지 않아야 한다. 깨진다면 클래스를 잘못 지운 것이다.

- [ ] **Step 6: 커밋**

```bash
git add components/features/archive/blocks/
git commit -m "🧹 [Archive] 색을 바꾸지 못하는 도움말 tertiary 8곳을 지운다 (FRT-338)"
```

---

### Task 8: 전체 검증과 사용자 확인

**Files:** 없음 (검증만)

**Interfaces:**
- Consumes: Task 1~7 전부
- Produces: 사용자가 볼 미리보기 채널

- [ ] **Step 1: 4게이트를 돌린다**

`validate` 스킬(서브에이전트)로 lint → typecheck → unit → build를 일괄 실행한다.

기대: 4게이트 전부 PASS. 유닛 테스트 수가 기존(2892) 대비 **약 30개 늘어난다.**

- [ ] **Step 2: 오버플로 안전망을 다시 돌린다**

```bash
npm run test-storybook:ci
```

기대: PASS.

**실패하면** — Task 1에서 기준선이 초록이었으므로 **이번 변경이 원인이다.** 넘친 요소를 보고 판단한다:
- 고정 높이(`h-[44px]` 등)가 원인이면 그 자리를 `min-h-[44px]`로 완화한다
- 배지·칩이 원인이면 `whitespace-nowrap`과 부모의 `flex-wrap`을 확인한다
- **전역 `keep-all`을 되돌리는 것은 마지막 수단이다** — 되돌린다면 왜인지 사용자에게 보고한다

- [ ] **Step 3: UI 미리보기를 발행한다**

`ui-preview` 스킬로 사용자가 폰·PC에서 실제 앱을 확인할 채널을 만든다. 확인 요청 항목:

1. 분석 상세 — 상세 요약이 커지고 어절이 안 갈리는지
2. 아카이브 입력 — 라벨(18)과 입력값(16)의 층위가 갈리는지, **아이폰에서 입력칸을 눌러도 화면이 안 튀는지**
3. 대시보드 카드 — 배지 줄바꿈·제목 말줄임이 깨지지 않았는지
4. 폰에서 큰 제목이 깨지지 않는지

- [ ] **Step 4: draft PR 을 연다**

base `dev`, `--draft`. 본문은 **행동의 언어**로 쓰고 구현 세부는 접힌 `<details>`에 넣는다. ready 전환과 머지는 사용자 몫이다.

```bash
gh pr create --draft --base dev --title "✨ [Typography] 화면 글씨를 한 단계 키우고 긴 글이 읽히게 한다 (FRT-338)" --body-file <경로>
```

---

## 자체 검토

**스펙 대조** — §3.1 스케일(Task 2·3) · §3.2 폼 네 층(Task 2) · §3.3 모바일 제목(Task 4) · §3.4 `.text-prose`(Task 5·6) · §3.5 전역 `keep-all`(Task 5) · §3.6 범위 제외(전역 제약에 명시) · §4 위험(Task 1·8) · §5 검증(Task 8). **누락 없음.**

**타입 일관성** — `readRule(selector, prop)`은 Task 2에서 정의하고 Task 4·5가 같은 파일 안에서 재사용한다. Task 4의 `mobileBlock`은 그 파일 안의 지역 상수다.

**의존 순서** — Task 1(안전망) → 2(스케일) → 3(컨트롤) → 4(모바일) → 5(`.text-prose` 정의) → 6(적용) → 7(정리) → 8(검증). Task 6은 Task 5에 의존하고, 나머지는 서로 독립이다.
