import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Badge } from "./badge";
import { Button } from "./button";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

/**
 * FRT-338: 버튼·배지 크기는 globals.css 밖에 하드코딩돼 있다.
 * 본문(.text-body)만 16px 로 올리고 여길 두면 본문 > 기본 버튼(15px) 이 되어 위계가 역전된다.
 * "본문보다 작지 않다"는 관계를 테스트로 못 박아, 한쪽만 바뀌는 사고를 막는다.
 */
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

    const px = Number.parseInt(
      /text-\[(\d+)px\]/.exec(screen.getByRole("button").className)?.[1] ?? "0",
      10,
    );

    expect(px).toBeGreaterThanOrEqual(16);
  });

  it("버튼 크기가 sm < md < lg 로 단조 증가한다", () => {
    const sizes = (["sm", "md", "lg"] as const).map((size) => {
      cleanup();
      render(<Button size={size}>저장하기</Button>);
      return Number.parseInt(
        /text-\[(\d+)px\]/.exec(screen.getByRole("button").className)?.[1] ?? "0",
        10,
      );
    });

    expect(sizes[0]).toBeLessThan(sizes[1]);
    expect(sizes[1]).toBeLessThan(sizes[2]);
  });

  it("배지는 13px — 본문보다 작되 캡션과 같은 눈금에 선다", () => {
    render(<Badge variant="brand">동아리 · 학회</Badge>);

    expect(screen.getByText("동아리 · 학회")).toHaveClass("text-[13px]");
  });
});
