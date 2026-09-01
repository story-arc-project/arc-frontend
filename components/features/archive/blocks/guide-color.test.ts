import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * FRT-338: 도움말에 덧붙인 `text-text-tertiary` 는 색을 바꾸지 못한다.
 *
 * `.text-caption` 이 `color: var(--color-text-secondary)` 를 **unlayered** 로 선언하는데,
 * Tailwind v4 는 유틸리티를 `@layer utilities` 에 넣는다. 캐스케이드 레이어 규칙상
 * unlayered 가 layered 를 이기므로(특이도와 무관) 덧붙인 색은 무시된다.
 *
 * 빌드된 CSS 를 실제 브라우저에 물려 잰 값:
 *   text-caption + text-text-tertiary → rgb(107,118,132)  (secondary, 4.6:1)
 *   text-text-tertiary 단독(대조군)    → rgb(176,184,193)  (tertiary,  2.0:1)
 *
 * 즉 접근성 문제는 없지만, 무효인 채 남겨두면 두 가지가 위험하다.
 *   ① "도움말은 tertiary" 라는 잘못된 인상을 준다
 *   ② 훗날 `.text-caption` 의 color 를 지우는 순간 8곳이 한꺼번에 2.0:1 로 무너진다
 */
const DIR = resolve(process.cwd(), "components/features/archive/blocks");

describe("도움말 색 (아카이브 블록)", () => {
  const files = readdirSync(DIR).filter(
    (f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx") && !f.endsWith(".stories.tsx"),
  );

  it("검사 대상 블록 파일을 실제로 찾았다 — 경로가 틀리면 조용히 통과한다", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)("%s 의 도움말은 죽은 text-text-tertiary 를 덧붙이지 않는다", (file) => {
    // 범위를 '도움말(block.guide)' 로 좁힌다. 같은 죽은 조합이 이 디렉터리에만 51곳 있지만
    // 나머지는 도움말이 아니라 FRT-338 의 결정 범위 밖이다 — 변경 범위 최소화(CLAUDE.md).
    // TODO(FRT-338 후속): 남은 43곳도 같은 이유로 죽어 있다. 별도 이슈로 한 번에 걷어낸다.
    const offenders = readFileSync(join(DIR, file), "utf-8")
      .split("\n")
      .map((line, i) => [i + 1, line.trim()] as const)
      .filter(
        ([, line]) =>
          line.includes("block.guide") && /text-caption[^"'`]*text-text-tertiary/.test(line),
      );

    expect(offenders).toEqual([]);
  });
});
