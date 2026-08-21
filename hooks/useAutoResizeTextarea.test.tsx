import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { useAutoResizeTextarea } from "./useAutoResizeTextarea";

// jsdom 은 레이아웃을 계산하지 않아 `scrollHeight` 가 언제나 0이다 — 스텁 없이는
// "내용만큼 늘어난다"를 단언할 방법이 없다. 그래서 실제 브라우저의 계약만 최소로 흉내낸다:
//   scrollHeight = max(내용 높이, 명시적으로 지정된 height)
// 두 번째 항이 핵심이다. 훅이 `height="auto"` 로 먼저 리셋하지 않으면 한 번 커진 칸은
// 영영 안 줄어든다 — 아래 '짧아지면 다시 줄어든다' 테스트가 그 리셋을 잡아낸다.
const LINE_PX = 20;
const PADDING_PX = 16;

function contentHeight(el: HTMLTextAreaElement) {
  return PADDING_PX + LINE_PX * Math.max(1, el.value.split("\n").length);
}

const originalScrollHeight = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  "scrollHeight"
);

Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
  configurable: true,
  get(this: HTMLTextAreaElement) {
    const explicit = this.style.height;
    if (!explicit || explicit === "auto") return contentHeight(this);
    return Math.max(contentHeight(this), parseFloat(explicit) || 0);
  },
});

afterEach(cleanup);

// 프로토타입을 되돌려 놓지 않으면 같은 워커에서 도는 다른 테스트 파일까지 이 스텁을 물려받는다.
afterEach(() => {
  if (originalScrollHeight) {
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", originalScrollHeight);
  }
});

function Probe({ value, borderPx = 0 }: { value: string; borderPx?: number }) {
  const ref = useAutoResizeTextarea(value);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={() => {}}
      aria-label="probe"
      style={{ borderTopWidth: `${borderPx}px`, borderBottomWidth: `${borderPx}px` }}
    />
  );
}

function heightOf(container: HTMLElement) {
  const el = container.querySelector("textarea");
  if (!el) throw new Error("textarea 가 렌더되지 않았다");
  return parseFloat(el.style.height);
}

describe("useAutoResizeTextarea", () => {
  it("마운트 직후부터 내용 높이에 맞춰져 있다 — 저장된 긴 값을 불러오는 경로", () => {
    const { container } = render(<Probe value={"한 줄\n두 줄\n세 줄"} />);
    expect(heightOf(container)).toBe(PADDING_PX + LINE_PX * 3);
  });

  it("내용이 길어지면 칸이 자란다", () => {
    const { container, rerender } = render(<Probe value="한 줄" />);
    const before = heightOf(container);

    rerender(<Probe value={"한 줄\n두 줄\n세 줄\n네 줄"} />);

    expect(heightOf(container)).toBeGreaterThan(before);
    expect(heightOf(container)).toBe(PADDING_PX + LINE_PX * 4);
  });

  it("내용이 짧아지면 칸이 다시 줄어든다 — height 를 auto 로 리셋한다는 증거", () => {
    const { container, rerender } = render(<Probe value={"한 줄\n두 줄\n세 줄\n네 줄"} />);

    rerender(<Probe value="한 줄" />);

    expect(heightOf(container)).toBe(PADDING_PX + LINE_PX);
  });

  it("테두리 두께를 더해 준다 — box-sizing:border-box 에서 마지막 줄이 잘리지 않도록", () => {
    // `style.height` 는 테두리를 포함(border-box)하지만 `scrollHeight` 는 테두리를 뺀 값이다.
    // 보정하지 않으면 위아래 테두리 합만큼 칸이 모자라 `overflow-hidden` 이 마지막 줄을 갉아먹는다.
    const { container } = render(<Probe value={"한 줄\n두 줄"} borderPx={1} />);

    expect(heightOf(container)).toBe(PADDING_PX + LINE_PX * 2 + 2);
  });
});
