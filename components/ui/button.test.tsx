import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Link from "next/link";

import { Button } from "./button";

/**
 * FRT-80 — CTA `<a><button>` 중첩 제거(Button asChild).
 *
 * 배경: CTA가 `<Link href><Button/></Link>` 형태라 DOM이 `<a>` 안에 `<button>`이
 * 중첩(상호작용 요소 중첩)됐다. `asChild`는 Radix Slot으로 자식(Link=`<a>`)에
 * 버튼 스타일을 병합해 **단일 `<a>`**로 렌더한다. 기존 `<button>` 경로는 불변.
 */
describe("Button", () => {
  afterEach(cleanup);

  it("기본은 <button>을 렌더한다", () => {
    render(<Button>저장</Button>);
    const el = screen.getByRole("button", { name: "저장" });
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveAttribute("type", "button");
  });

  it("asChild로 Link를 감싸면 단일 <a>로 렌더된다(중첩 <button> 없음)", () => {
    const { container } = render(
      <Button asChild variant="secondary" size="sm" className="mt-4">
        <Link href="/archive">경험 추가</Link>
      </Button>
    );

    // 단일 상호작용 요소: <a> 하나, 중첩 <button> 없음
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("button")).toBeNull();

    const anchor = screen.getByRole("link", { name: "경험 추가" });
    expect(anchor.tagName).toBe("A");
    expect(anchor).toHaveAttribute("href", "/archive");
  });

  it("asChild anchor는 버튼 스타일 클래스와 이관된 className을 함께 갖는다", () => {
    render(
      <Button asChild variant="secondary" size="sm" className="mt-4">
        <Link href="/archive">경험 추가</Link>
      </Button>
    );
    const anchor = screen.getByRole("link", { name: "경험 추가" });
    // 버튼 base(단일 원천)
    expect(anchor.className).toContain("inline-flex");
    // Button으로 이관한 레이아웃 클래스
    expect(anchor.className).toContain("mt-4");
  });

  it("asChild anchor에는 type=button을 강제 주입하지 않는다", () => {
    render(
      <Button asChild>
        <Link href="/archive">경험 추가</Link>
      </Button>
    );
    const anchor = screen.getByRole("link", { name: "경험 추가" });
    expect(anchor).not.toHaveAttribute("type");
  });
});
