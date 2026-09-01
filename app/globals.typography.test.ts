import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * globals.css 의 타이포 스케일은 앱 전체(text-body 616곳 · text-body-sm 447곳 · text-caption 318곳)가
 * 의존하는 인터페이스인데 지금까지 아무도 지키지 않았다. 값이 조용히 되돌아가는 것을 막으려고
 * 파일을 직접 파싱해 못 박는다.
 *
 * jsdom 은 외부 CSS 를 적용하지 않으므로 getComputedStyle 로는 잴 수 없다 — 소스를 읽는 게 유일한 수단이다.
 *
 * 경로는 cwd 기준으로 잡는다. jsdom 환경에서 `import.meta.url` 은 file: 스킴이 아니라
 * fileURLToPath 가 "The URL must be of scheme file" 로 터진다.
 */
const CSS = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf-8")
  // 주석을 먼저 걷어낸다. 남겨두면 주석 바로 뒤 선언이 "앞이 ; 또는 줄머리" 경계에 걸려 안 잡힌다.
  .replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * `.text-body { ... }` 블록에서 한 속성의 값을 뽑는다.
 *
 * 선택자 앞에 경계를 요구한다 — 이게 없으면 `body` 를 찾을 때 `.text-body {` 가 먼저 걸린다.
 */
export function readRule(selector: string, prop: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`(?:^|[\\n,])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(CSS);
  if (!block) return undefined;
  const found = new RegExp(`(?:^|[;\\n])\\s*${prop}\\s*:\\s*([^;]+)`).exec(block[1]);
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
    const px = (selector: string) => Number.parseInt(readRule(selector, "font-size") ?? "0", 10);

    expect(px(".text-caption")).toBeLessThan(px(".text-body-sm"));
    expect(px(".text-body-sm")).toBeLessThan(px(".text-body"));
    expect(px(".text-body") - px(".text-caption")).toBeGreaterThanOrEqual(3);
  });

  it("아카이브 입력값은 16px — iOS Safari 는 16px 미만이면 포커스 순간 화면을 확대한다", () => {
    // .archive-input-14 래퍼가 하위 input/textarea/select 를 눌러쓰는 규칙.
    const rule = /\.archive-input-14 input:not\(\.text-title\)[^{]*\{([^}]*)\}/.exec(CSS);

    expect(rule?.[1]).toContain("font-size: 16px");
  });

  it("블록 설정 다이얼로그는 값 입력이 아니라 원래 크기를 지킨다 — 함께 키우지 않는다", () => {
    const rule = /\.archive-input-14 \[role="dialog"\] input[^{]*\{([^}]*)\}/.exec(CSS);

    expect(rule?.[1]).toContain("font-size: 13px");
  });
});

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
    // CSS px 는 기준 시청 거리에서의 각크기로 정의된 단위라 기기가 달라도 체감 크기가 비슷하다.
    // 갈라야 하는 것은 크기가 아니라 큰 제목이다 — 48px 은 폰에서 세 줄로 깨진다.
    for (const selector of [
      ".text-body",
      ".text-body-sm",
      ".text-caption",
      ".text-label",
      ".text-field-label",
    ]) {
      expect(mobileBlock).not.toContain(selector);
    }
  });

  it("제목 축소 뒤에도 위계가 유지된다 — display > heading-1 > heading-2", () => {
    const px = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rule = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(mobileBlock);
      return Number.parseInt(/font-size:\s*(\d+)px/.exec(rule?.[1] ?? "")?.[1] ?? "0", 10);
    };

    expect(px(".text-display")).toBeGreaterThan(px(".text-heading-1"));
    expect(px(".text-heading-1")).toBeGreaterThan(px(".text-heading-2"));
  });
});

describe("긴 글 조판 (FRT-338)", () => {
  it("한글이 어절 중간에서 갈리지 않도록 전역에서 막는다", () => {
    // 한글은 브라우저 기본 줄바꿈이 CJK 규칙이라 "가독성을" 이 "가독"/"성을" 로 쪼개진다.
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
    // .text-caption 의 unlayered color 가 layered 유틸리티를 이기는 덕에 도움말이 4.6:1 로 렌더된다.
    expect(readRule(".text-caption", "color")).toBe("var(--color-text-secondary)");
  });
});
