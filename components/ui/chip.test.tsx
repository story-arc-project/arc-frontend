import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { Chip } from "./chip";

/**
 * FRT-312 — 다중 선택 토글로 쓰이는 Chip 이 선택 상태를 배경색·굵기로만 표시하고
 * 스크린리더에는 전달하지 않았다. `selected` 를 `aria-pressed` 로 노출해
 * "선택됨/선택 안 됨"이 읽히게 한다. 다시 눌러 해제되는 토글이라 radio 가 아니라
 * aria-pressed 다(FRT-296 과 같은 판단).
 */
describe("Chip", () => {
  afterEach(cleanup);

  it("selected 면 aria-pressed=true 로 읽힌다", () => {
    render(<Chip selected>취업</Chip>);
    expect(screen.getByRole("button", { name: "취업", pressed: true })).toBeInTheDocument();
  });

  it("selected 가 아니면 aria-pressed=false 로 읽힌다", () => {
    render(<Chip selected={false}>취업</Chip>);
    expect(screen.getByRole("button", { name: "취업", pressed: false })).toBeInTheDocument();
  });

  it("selected 를 생략해도 토글 버튼이다 — 기본값은 선택 안 됨", () => {
    render(<Chip>취업</Chip>);
    expect(screen.getByRole("button", { name: "취업" })).toHaveAttribute("aria-pressed", "false");
  });

  it("호출부가 aria-pressed 를 직접 넘기면 그 값이 이긴다", () => {
    render(
      <Chip selected aria-pressed={false}>
        취업
      </Chip>
    );
    expect(screen.getByRole("button", { name: "취업" })).toHaveAttribute("aria-pressed", "false");
  });
});
