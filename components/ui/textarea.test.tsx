import { describe, it, expect, afterAll, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

import { Textarea } from "./textarea";

// jsdom 은 레이아웃이 없어 `scrollHeight` 가 늘 0이다. 실제 브라우저 계약 중 이 테스트가 기대는
// 부분만 흉내낸다: 내용 높이는 줄 수에 비례하고, 테두리는 위아래 1px 씩이다.
// 핵심 단언은 "높이 = scrollHeight + 테두리" — `box-sizing: border-box` 아래서 테두리를 되돌려 주지
// 않으면 마지막 줄이 2px 잘린다(FRT-327).
const LINE_PX = 20;
const BORDER_PX = 1;

const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "scrollHeight");
const originalGetComputedStyle = window.getComputedStyle;

Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
  configurable: true,
  get(this: HTMLTextAreaElement) {
    return LINE_PX * this.value.split("\n").length;
  },
});
window.getComputedStyle = ((el: Element) => {
  const base = originalGetComputedStyle(el);
  if (el instanceof HTMLTextAreaElement) {
    return new Proxy(base, {
      get(target, prop) {
        if (prop === "borderTopWidth" || prop === "borderBottomWidth") return `${BORDER_PX}px`;
        return Reflect.get(target, prop);
      },
    });
  }
  return base;
}) as typeof window.getComputedStyle;

afterEach(cleanup);
afterAll(() => {
  if (originalScrollHeight) {
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", originalScrollHeight);
  }
  window.getComputedStyle = originalGetComputedStyle;
});

function heightOf(el: HTMLTextAreaElement) {
  return parseFloat(el.style.height);
}

describe("Textarea 자동 높이", () => {
  it("제어 값이 바뀌면 내용 높이 + 테두리만큼 늘어난다", () => {
    const { getByRole, rerender } = render(<Textarea value="a" onChange={() => {}} />);
    const el = getByRole("textbox") as HTMLTextAreaElement;
    expect(heightOf(el)).toBe(LINE_PX * 1 + BORDER_PX * 2);

    rerender(<Textarea value={"a\nb\nc"} onChange={() => {}} />);
    expect(heightOf(el)).toBe(LINE_PX * 3 + BORDER_PX * 2);
  });

  it("defaultValue 로 마운트해도 처음부터 내용 높이에 맞춰져 있다", () => {
    const { getByRole } = render(<Textarea defaultValue={"a\nb\nc\nd"} />);
    const el = getByRole("textbox") as HTMLTextAreaElement;
    expect(heightOf(el)).toBe(LINE_PX * 4 + BORDER_PX * 2);
  });

  it("비제어로 타이핑해도 다시 잰다", () => {
    const { getByRole } = render(<Textarea />);
    const el = getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(el, { target: { value: "a\nb" } });
    expect(heightOf(el)).toBe(LINE_PX * 2 + BORDER_PX * 2);
  });
});
